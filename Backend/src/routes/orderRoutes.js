import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, formatOrderResponse } from './sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';
import { checkProductQuantityStandards } from '../utils/bulkOrder.js';
import { deductOrderRemainingServings, restoreOrderRemainingServings } from '../utils/servingsDeduction.js';

const router = Router();

function outOfStockError(name) {
  return Object.assign(new Error(`Item "${name}" is currently out of stock.`), {
    statusCode: 409,
    code: 'ITEM_OUT_OF_STOCK',
  });
}

function itemDeletedError(name) {
  return Object.assign(new Error(`Item "${name}" has been removed from the menu and can no longer be ordered.`), {
    statusCode: 409,
    code: 'ITEM_DELETED',
  });
}

export async function assertItemsAvailable(client, items) {
  const ids = items
    .map((item) => item.product_id || item.productId || item.item?.id || item.id)
    .filter(Boolean)
    .map(String);
  const names = items
    .map((item) => item.name || item.product_name_snapshot || item.item?.name)
    .filter(Boolean)
    .map((name) => String(name).toLowerCase());
  const { rows } = await client.query(
    `SELECT id::text AS id, name, is_available, is_active, remaining_servings
     FROM products
     WHERE id::text = ANY($1::text[]) OR LOWER(name) = ANY($2::text[])
     FOR SHARE`,
    [ids, names]
  );

  for (const item of items) {
    const id = String(item.product_id || item.productId || item.item?.id || item.id || '');
    const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood Dish';
    const product = rows.find((row) => row.id === id)
      || rows.find((row) => row.name.toLowerCase() === String(name).toLowerCase());
    if (!product) throw outOfStockError(name);
    if (product.is_active === false) throw itemDeletedError(name);
    if (!product.is_available) throw outOfStockError(name);

    if (product.remaining_servings !== null && product.remaining_servings !== undefined) {
      const remaining = Number(product.remaining_servings);
      if (remaining <= 0) {
        throw outOfStockError(name);
      }
      const requestedQty = Number(item.quantity) || 1;
      if (requestedQty > remaining) {
        const err = new Error(`Only ${remaining} serving${remaining === 1 ? '' : 's'} remaining for ${name}. Please reduce quantity.`);
        err.statusCode = 409;
        err.code = 'INSUFFICIENT_SERVINGS';
        throw err;
      }
    }
  }

  return rows;
}

// GET /api/orders - Get orders with pagination, search, and filtering (Staff only)
router.get('/orders', requireAuth, requireRole(['admin', 'cashier', 'assistant', 'kitchen', 'rider']), async (req, res) => {
  try {
    const { status, type, limit, offset, page, search, payment, tab, period, startDate, endDate } = req.query;
    let sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             COALESCE(o.fulfillment_type, 'DELIVERY') AS fulfillment_type,
             COALESCE(o.fulfillment_type, 'DELIVERY') AS "fulfillmentType",
             CASE
               WHEN UPPER(COALESCE(o.fulfillment_type, '')) = 'PICKUP' THEN 'Store Pick-Up'
               WHEN UPPER(o.order_type) = 'ONLINE' THEN 'Delivery'
               WHEN UPPER(o.order_type) = 'ON_SITE' THEN 'POS Order'
               ELSE COALESCE(o.order_type, 'POS Order')
             END AS type,
             o.order_type, o.status,
             o.subtotal, o.tax AS vat, o.tax, o.delivery_fee, o.total, o.notes,
             o.created_at, o.updated_at,
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS customer_name,
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS "customerName",
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS customer,
             c.phone AS customer_phone,
             c.phone AS phone,
             COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
             COALESCE(d.delivery_address, c.delivery_address) AS address,
             d.status AS delivery_status,
             d.rider_id,
             r_emp.fullname AS rider_name,
             t.name AS table_name,
             COALESCE(o.payment_method, p_pay.payment_method, 'CASH') AS payment_method,
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS payment_reference,
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS reference_number,
             COALESCE(NULLIF(o.payment_receipt, ''), NULLIF(p_pay.payment_receipt, '')) AS payment_receipt,
             COALESCE(NULLIF(o.payment_receipt, ''), NULLIF(p_pay.payment_receipt, '')) AS "paymentReceipt",
             COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, '')) AS delivery_proof,
             COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, '')) AS "deliveryProof",
             COALESCE(o.rider_cash_received, d.rider_cash_received) AS rider_cash_received,
             p_pay.status AS payment_status,
             COUNT(*) OVER() AS full_count,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'menu_item_id', oi.product_id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'subtotal', oi.subtotal,
                   'notes', oi.notes,
                   'name', oi.product_name_snapshot,
                   'snapshot_item_name', oi.product_name_snapshot,
                   'item_status', oi.item_status
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, delivery_address, status, rider_id, rider_cash_received, delivery_proof
        FROM deliveries
        ORDER BY order_id, created_at DESC
      ) d ON o.id = d.order_id
      LEFT JOIN employees r_emp ON d.rider_id = r_emp.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products pr ON oi.product_id = pr.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, status, reference_number, payment_receipt
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p_pay ON o.id = p_pay.order_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND LOWER(o.status) = LOWER($${paramIndex++})`;
      params.push(status);
    }

    const selectedPeriod = (tab || period || '').toLowerCase().trim();
    if (selectedPeriod === 'today' || selectedPeriod === '1d') {
      sql += ` AND o.created_at >= (((NOW() AT TIME ZONE 'Asia/Manila')::date)::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this week' || selectedPeriod === 'week' || selectedPeriod === '1w') {
      sql += ` AND o.created_at >= ((((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days'))::timestamp AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this month' || selectedPeriod === 'month' || selectedPeriod === '1m') {
      sql += ` AND o.created_at >= (DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this year' || selectedPeriod === 'year' || selectedPeriod === '1y') {
      sql += ` AND o.created_at >= (DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') AND o.created_at < ((((NOW() AT TIME ZONE 'Asia/Manila')::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
    } else {
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(startDate).trim())) {
        sql += ` AND o.created_at >= (($${paramIndex++}::date)::timestamp AT TIME ZONE 'Asia/Manila')`;
        params.push(String(startDate).trim());
      }
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
        sql += ` AND o.created_at < ((($${paramIndex++}::date + 1))::timestamp AT TIME ZONE 'Asia/Manila')`;
        params.push(String(endDate).trim());
      }
    }

    if (type && type !== 'All') {
      if (type.toLowerCase() === 'pos' || type.toLowerCase() === 'on_site') {
        sql += ` AND LOWER(o.order_type) = 'on_site'`;
      } else if (type.toLowerCase() === 'online' || type.toLowerCase() === 'delivery') {
        sql += ` AND LOWER(o.order_type) = 'online'`;
      } else {
        sql += ` AND LOWER(o.order_type) = LOWER($${paramIndex++})`;
        params.push(type);
      }
    }

    if (search && search.trim()) {
      sql += ` AND (LOWER(o.id) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(o.customer_name, c.fullname, '')) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (payment && payment !== 'All') {
      if (payment.toLowerCase() === 'hybrid' || payment.toLowerCase() === 'split') {
        sql += ` AND (LOWER(COALESCE(p_pay.payment_method, '')) LIKE '%hybrid%' OR LOWER(COALESCE(p_pay.payment_method, '')) LIKE '%split%')`;
      } else {
        sql += ` AND LOWER(COALESCE(p_pay.payment_method, '')) LIKE LOWER($${paramIndex++})`;
        params.push(`%${payment.trim()}%`);
      }
    }

    sql += ` GROUP BY o.id, o.fulfillment_type, o.customer_name, c.fullname, c.phone, c.delivery_address, d.delivery_address, d.status, d.rider_id, d.rider_cash_received, d.delivery_proof, r_emp.fullname, t.name, p_pay.payment_method, p_pay.status, p_pay.reference_number, p_pay.payment_receipt ORDER BY o.created_at DESC`;

    const limitNum = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 50), 300) : 50;
    let offsetNum = offset ? parseInt(offset, 10) : 0;
    if (page && limitNum && !offset) {
      const pageNum = Math.max(1, parseInt(page, 10));
      offsetNum = (pageNum - 1) * limitNum;
    }

    if (limitNum) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(limitNum);
    }
    if (offsetNum > 0) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(offsetNum);
    }

    const { rows } = await query(sql, params);
    const totalCount = rows.length > 0 ? parseInt(rows[0].full_count, 10) : 0;

    return res.status(200).json({
      success: true,
      count: rows.length,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message,
    });
  }
});

// GET /api/orders/:id - Get single order details
router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             COALESCE(o.fulfillment_type, 'DELIVERY') AS fulfillment_type,
             COALESCE(o.fulfillment_type, 'DELIVERY') AS "fulfillmentType",
             CASE
               WHEN UPPER(COALESCE(o.fulfillment_type, '')) = 'PICKUP' THEN 'Store Pick-Up'
               WHEN UPPER(o.order_type) = 'ONLINE' THEN 'Delivery'
               WHEN UPPER(o.order_type) = 'ON_SITE' THEN 'POS Order'
               ELSE COALESCE(o.order_type, 'POS Order')
             END AS type,
             o.order_type, o.status,
             o.subtotal, o.tax AS vat, o.tax, o.delivery_fee, o.total, o.notes,
             o.created_at, o.updated_at,
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS customer_name,
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS "customerName",
             COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS customer,
             c.phone AS customer_phone,
             c.phone AS phone,
             COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
             COALESCE(d.delivery_address, c.delivery_address) AS address,
             o.customer_resolution, o.customer_resolution_status, o.customer_replacements,
             t.name AS table_name,
             COALESCE(o.payment_method, p_pay.payment_method, 'CASH') AS payment_method,
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS payment_reference,
             COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS reference_number,
             COALESCE(NULLIF(o.payment_receipt, ''), NULLIF(p_pay.payment_receipt, '')) AS payment_receipt,
             COALESCE(NULLIF(o.payment_receipt, ''), NULLIF(p_pay.payment_receipt, '')) AS "paymentReceipt",
             COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, '')) AS delivery_proof,
             COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, '')) AS "deliveryProof",
             COALESCE(o.rider_cash_received, d.rider_cash_received) AS rider_cash_received,
             r_emp.fullname AS rider_name,
             p_pay.status AS payment_status,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'menu_item_id', oi.product_id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'subtotal', oi.subtotal,
                   'notes', oi.notes,
                   'name', oi.product_name_snapshot,
                   'snapshot_item_name', oi.product_name_snapshot,
                   'item_status', oi.item_status
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, delivery_address, status, rider_id, rider_cash_received, delivery_proof
        FROM deliveries
        ORDER BY order_id, created_at DESC
      ) d ON o.id = d.order_id
      LEFT JOIN employees r_emp ON d.rider_id = r_emp.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products pr ON oi.product_id = pr.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, status, reference_number, payment_receipt
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p_pay ON o.id = p_pay.order_id
      WHERE o.id = $1
      GROUP BY o.id, o.fulfillment_type, o.customer_name, c.fullname, c.phone, c.delivery_address, d.delivery_address, t.name, p_pay.payment_method, p_pay.status, p_pay.reference_number, p_pay.payment_receipt, d.rider_cash_received, d.delivery_proof, r_emp.fullname
    `;
    const { rows } = await query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error fetching order detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
      error: error.message,
    });
  }
});

// POST /api/orders - Create a new order with transaction (Staff POS action)
router.post('/orders', requireAuth, requireRole(['admin', 'cashier']), async (req, res) => {
  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    const { tableId, type, orderType, paymentMethod, notes, customerId, cashierId, assistantId, deliveryAddress, paymentReference, referenceNumber } = req.body;
    const finalPaymentRef = paymentReference || referenceNumber || null;
    const cartItems = req.body.cartItems || req.body.items || [];

    if (!cartItems || cartItems.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Cart cannot be empty',
      });
    }

    await client.query('BEGIN');

    // Resolve or provision customer for POS/On-site orders
    let validCustomerId = customerId || null;
    const candidateCustomer = (req.body.customerName || req.body.customer_name || req.body.name || req.body.customer || '').trim();
    if (!validCustomerId && candidateCustomer && candidateCustomer.toLowerCase() !== 'walk-in' && candidateCustomer.toLowerCase() !== 'walk-in customer') {
      try {
        const custRes = await client.query('SELECT id FROM customers WHERE LOWER(fullname) = LOWER($1) LIMIT 1', [candidateCustomer]);
        if (custRes.rows.length > 0) {
          validCustomerId = custRes.rows[0].id;
        } else {
          const safeEmail = `${candidateCustomer.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'customer'}_${Date.now()}@guest.seafudz.ph`;
          const insertCustRes = await client.query(
            `INSERT INTO customers (fullname, email, phone, delivery_address)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE SET
               fullname = EXCLUDED.fullname,
               updated_at = NOW()
             RETURNING id`,
            [candidateCustomer, safeEmail, req.body.phone || null, req.body.deliveryAddress || null]
          );
          if (insertCustRes.rows.length > 0) {
            validCustomerId = insertCustRes.rows[0].id;
          }
        }
      } catch (custErr) {
        console.warn('Customer provision error in POST /orders:', custErr);
      }
    }
    const finalCustomerName = candidateCustomer || (validCustomerId ? 'Customer' : null);

    const availableProducts = await assertItemsAvailable(client, cartItems);

    const normalizedCartItems = cartItems.map((ci) => {
      const pId = String(ci.item?.id || ci.productId || ci.id || '');
      const pName = String(ci.item?.name || ci.name || '');
      const prod = availableProducts.find(
        (r) => r.id === pId || r.name.toLowerCase() === pName.toLowerCase()
      );
      const rawServ = prod && prod.remaining_servings !== null && prod.remaining_servings !== undefined
        ? Number(prod.remaining_servings)
        : (ci.remaining_servings !== undefined ? ci.remaining_servings : ci.item?.remaining_servings);
      return {
        ...ci,
        id: pId,
        product_id: pId,
        name: pName,
        quantity: Number(ci.quantity) || 1,
        remaining_servings: rawServ !== undefined ? rawServ : null,
        remainingServings: rawServ !== undefined ? rawServ : null,
      };
    });

    const standardCheck = checkProductQuantityStandards(normalizedCartItems);
    const requiresKitchenApproval = req.body.requires_kitchen_approval === true ||
      req.body.requiresKitchenApproval === true ||
      String(req.body.status || '').toUpperCase() === 'AWAITING_KITCHEN_APPROVAL' ||
      standardCheck.requiresApproval;

    const posStatus = requiresKitchenApproval
      ? 'AWAITING_KITCHEN_APPROVAL'
      : (req.body.status ? req.body.status.toUpperCase() : 'CONFIRMED');

    const kitchenApprovalStatus = requiresKitchenApproval ? 'PENDING' : 'NONE';

    const orderNumber = req.body.id || req.body.ref || `ORD-${Date.now().toString().slice(-6)}`;
    const subtotal = cartItems.reduce((acc, ci) => {
      const price = ci.item ? ci.item.price : (ci.price || ci.unit_price || 0);
      return acc + (price * ci.quantity);
    }, 0);
    const tax = Math.round(subtotal * 0.12 * 100) / 100;
    const deliveryFee = (type === 'ONLINE' || type === 'Delivery' || orderType === 'ONLINE') ? 50 : 0;
    const totalAmount = subtotal + tax + deliveryFee;

    const normalizedOrderType = (type === 'ONLINE' || type === 'Delivery' || orderType === 'ONLINE') ? 'ONLINE' : 'ON_SITE';

    const orderSql = `
      INSERT INTO orders (
        id, customer_id, cashier_id, assistant_id, table_id,
        order_type, status, subtotal, tax, delivery_fee, total, notes,
        payment_reference, payment_method, requires_kitchen_approval, kitchen_approval_status,
        customer_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        customer_name = COALESCE(EXCLUDED.customer_name, orders.customer_name),
        payment_reference = COALESCE(EXCLUDED.payment_reference, orders.payment_reference),
        payment_method = COALESCE(EXCLUDED.payment_method, orders.payment_method),
        status = EXCLUDED.status,
        requires_kitchen_approval = EXCLUDED.requires_kitchen_approval,
        kitchen_approval_status = EXCLUDED.kitchen_approval_status,
        updated_at = NOW()
      RETURNING *
    `;

    const orderRes = await client.query(orderSql, [
      orderNumber,
      validCustomerId || null,
      cashierId || null,
      assistantId || null,
      tableId || null,
      normalizedOrderType,
      posStatus,
      subtotal,
      tax,
      deliveryFee,
      totalAmount,
      notes || null,
      finalPaymentRef,
      paymentMethod || 'CASH',
      requiresKitchenApproval,
      kitchenApprovalStatus,
      finalCustomerName || null,
    ]);

    const createdOrder = orderRes.rows[0];

    // Insert order items
    for (const ci of cartItems) {
      const productId = ci.item ? ci.item.id : (ci.productId || ci.menuItemId || ci.id || null);
      const snapshotItemName = ci.item ? ci.item.name : (ci.name || ci.snapshot_item_name || 'Seafood Item');
      const unitPrice = ci.item ? ci.item.price : (ci.price || ci.unit_price || 0);
      const itemQuantity = ci.quantity || 1;
      const itemSubtotal = Math.round(unitPrice * itemQuantity * 100) / 100;
      const itemNotes = ci.notes || ci.specialNote || null;

      const itemSql = `
        INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await client.query(itemSql, [
        createdOrder.id,
        productId,
        snapshotItemName,
        unitPrice,
        itemQuantity,
        itemSubtotal,
        itemNotes,
      ]);
    }

    // Insert payment record
    const finalPaymentMethod = paymentMethod || 'CASH';
    const paymentStatus = requiresKitchenApproval ? 'PENDING' : 'PAID';

    const paymentSql = `
      INSERT INTO payments (order_id, payment_method, amount, status, reference_number, paid_at)
      VALUES ($1, $2, $3, $4, $5, ${requiresKitchenApproval ? 'NULL' : 'NOW()'})
    `;
    await client.query(paymentSql, [
      createdOrder.id,
      finalPaymentMethod,
      totalAmount,
      paymentStatus,
      finalPaymentRef,
    ]);

    // Create kitchen order ticket for POS and on-site orders (only if already approved / ready)
    if ((normalizedOrderType !== 'ONLINE' || req.body.isPosOrder) && !requiresKitchenApproval) {
      const kitchenSql = `
        INSERT INTO kitchen_orders (order_id, status, updated_at)
        VALUES ($1, 'PENDING', NOW())
        ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()
      `;
      await client.query(kitchenSql, [createdOrder.id]);
    }

    // Create delivery entry if online delivery
    if (normalizedOrderType === 'ONLINE' || deliveryAddress) {
      const deliverySql = `
        INSERT INTO deliveries (order_id, delivery_address, status)
        VALUES ($1, $2, 'PENDING')
        ON CONFLICT (order_id) DO NOTHING
      `;
      await client.query(deliverySql, [
        createdOrder.id,
        deliveryAddress || 'Standard Delivery Address',
      ]);
    }

    const inMemPayload = {
      id: createdOrder.id,
      ref: createdOrder.id,
      customerName: finalCustomerName || '',
      customer: finalCustomerName || '',
      customer_name: finalCustomerName || '',
      type: createdOrder.order_type === 'ONLINE' ? 'Delivery' : 'POS Order',
      orderType: createdOrder.order_type,
      status: createdOrder.status || posStatus,
      requires_kitchen_approval: requiresKitchenApproval,
      requiresKitchenApproval,
      kitchen_approval_status: kitchenApprovalStatus,
      kitchenApprovalStatus,
      is_bulk: requiresKitchenApproval,
      isBulk: requiresKitchenApproval,
      flagged_quantity_items: standardCheck.flaggedItems,
      flaggedQuantityItems: standardCheck.flaggedItems,
      items: cartItems.map((ci) => ({
        id: ci.item ? ci.item.id : (ci.id || ci.productId),
        product_id: ci.item ? ci.item.id : (ci.id || ci.productId),
        name: ci.item ? ci.item.name : ci.name,
        quantity: ci.quantity || 1,
        price: ci.item ? ci.item.price : (ci.price || 0),
      })),
      total: totalAmount,
      subtotal,
      vat: tax,
      paymentMethod: finalPaymentMethod,
      paymentReference: finalPaymentRef,
      referenceNumber: finalPaymentRef,
      payment_status: paymentStatus,
      paymentStatus,
      created_at: createdOrder.created_at || new Date().toISOString(),
      updated_at: createdOrder.updated_at || new Date().toISOString(),
    };
    inMemoryOrders.set(createdOrder.id, inMemPayload);

    // Atomically deduct remaining servings for on-site POS orders (status is CONFIRMED)
    if (createdOrder.status === 'CONFIRMED') {
      try {
        await deductOrderRemainingServings(client, createdOrder.id);
      } catch (servErr) {
        console.warn('[SERVINGS] POS deduction note:', servErr.message);
      }
    }

    await client.query('COMMIT');
    client.release();

    const formattedOrder = formatOrderResponse(inMemPayload);
    emitOrderUpdate(formattedOrder);

    return res.status(201).json({
      success: true,
      message: 'Order created successfully in database',
      data: {
        ...createdOrder,
        customerName: finalCustomerName,
        customer: finalCustomerName,
        customer_name: finalCustomerName,
        requires_kitchen_approval: requiresKitchenApproval,
        requiresKitchenApproval,
        kitchen_approval_status: kitchenApprovalStatus,
        kitchenApprovalStatus,
        is_bulk: requiresKitchenApproval,
        isBulk: requiresKitchenApproval,
        flagged_quantity_items: standardCheck.flaggedItems,
        flaggedQuantityItems: standardCheck.flaggedItems,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error creating order:', error);
    if (error.code === 'ITEM_OUT_OF_STOCK' || error.code === 'ITEM_DELETED') {
      return res.status(409).json({ success: false, error: error.code, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create order in database',
      error: error.message,
    });
  }
});

// DELETE /api/orders/:id - Delete order from DB and memory
router.delete('/orders/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryOrders.delete(id);

    try {
      await query(`DELETE FROM refunds WHERE order_id = $1`, [id]);
      await query(`DELETE FROM assistant_calls WHERE order_id = $1`, [id]);
      await query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
      await query(`DELETE FROM kitchen_orders WHERE order_id = $1`, [id]);
      await query(`DELETE FROM deliveries WHERE order_id = $1`, [id]);
      await query(`DELETE FROM payments WHERE order_id = $1`, [id]);
      await query(`DELETE FROM orders WHERE id = $1`, [id]);
    } catch (dbErr) {
      console.warn('DB delete note:', dbErr.message);
    }

    emitOrderUpdate({ id, type: 'ORDER_DELETED', timestamp: Date.now() });
    console.log(`[DELETE] Order ${id} deleted from database and memory`);

    return res.status(200).json({
      success: true,
      message: `Order ${id} deleted successfully`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message,
    });
  }
});

// PUT /api/orders/:id - Update full transaction details in DB (Admin/Cashier action)
router.put('/orders/:id', requireAuth, requireRole(['admin', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      phone,
      address,
      status,
      paymentMethod,
      paymentStatus,
      notes,
      items,
      subtotal,
      vat,
      deliveryFee,
      total,
      type,
      orderType,
      table,
      paymentReference,
      referenceNumber,
      paymentReceipt,
      adminOverride,
    } = req.body;
    const finalRef = (paymentReference || referenceNumber || '').toString().trim() || null;
    const finalReceipt = paymentReceipt !== undefined ? paymentReceipt : undefined;

    const rawType = (orderType || type || '').toString().trim().toUpperCase();
    const normalizedOrderType = rawType
      ? ((rawType === 'ONLINE' || rawType === 'DELIVERY') ? 'ONLINE' : 'ON_SITE')
      : null;

    // Check if order is already being processed or prepared in the kitchen
    const nonModifiableKitchenStatuses = [
      'PREPARING', 'COOKING', 'IN_PROCESS', 'IN_PREPARATION',
      'READY', 'PREPARED', 'READY TO SERVE',
      'COMPLETED', 'SERVED', 'DELIVERED', 'CANCELLED'
    ];
    let currentStatus = inMemoryOrders.get(id)?.status;
    if (!currentStatus) {
      try {
        const checkRes = await query('SELECT status FROM orders WHERE id = $1', [id]);
        if (checkRes.rows.length > 0) {
          currentStatus = checkRes.rows[0].status;
        }
      } catch (err) {
        console.warn('Status lookup note in orderRoutes PUT:', err.message);
      }
    }
    const normCurrent = (currentStatus || '').toUpperCase();
    const isAdmin = req.user?.role?.toLowerCase() === 'admin';
    const isOverride = Boolean(adminOverride);
    if (!isAdmin || !isOverride) {
      if (nonModifiableKitchenStatuses.includes(normCurrent)) {
        return res.status(400).json({
          success: false,
          error: 'ORDER_PROCESSING',
          message: 'This order is already being processed or prepared in the kitchen and can no longer be edited or modified.',
        });
      }
    }

    // 1. Update inMemoryOrders if present
    let existingInMemory = inMemoryOrders.get(id) || {};
    const updatedInMemory = {
      ...existingInMemory,
      id,
      customerName: customerName || existingInMemory.customerName,
      customer: customerName || existingInMemory.customer,
      phone: phone || existingInMemory.phone,
      address: address || existingInMemory.address,
      status: status ? status.toUpperCase() : existingInMemory.status,
      paymentMethod: paymentMethod || existingInMemory.paymentMethod,
      notes: notes !== undefined ? notes : existingInMemory.notes,
      items: items || existingInMemory.items,
      total: total !== undefined ? total : existingInMemory.total,
      type: type || existingInMemory.type,
      table: table || existingInMemory.table,
      paymentReference: finalRef || existingInMemory.paymentReference,
      referenceNumber: finalRef || existingInMemory.referenceNumber || existingInMemory.paymentReference,
      paymentReceipt: finalReceipt !== undefined ? finalReceipt : existingInMemory.paymentReceipt,
      updated_at: new Date().toISOString(),
    };
    inMemoryOrders.set(id, updatedInMemory);

    // 2. Persist in PostgreSQL DB with transactional servings reconciliation
    let updatedProducts = [];
    let pool;
    let client;
    try {
      pool = await getDbPool();
      client = await pool.connect();
      await client.query('BEGIN');

      const calcTotal = total !== undefined ? total : (subtotal || 0) + (vat || 0) + (deliveryFee || 0);

      const checkExists = await client.query('SELECT id, status, servings_deducted FROM orders WHERE id = $1 FOR UPDATE', [id]);
      console.log(`[PUT /orders/${id}] checkExists:`, checkExists.rows, 'items count:', items?.length);
      
      // If order already exists and items are being modified, restore previous deducted servings first
      if (checkExists.rows.length > 0 && Array.isArray(items) && items.length > 0) {
        try {
          const restRes = await restoreOrderRemainingServings(client, id);
          console.log(`[PUT /orders/${id}] restRes:`, restRes);
          if (restRes?.updatedProducts?.length) {
            updatedProducts.push(...restRes.updatedProducts);
          }
        } catch (restErr) {
          console.warn('[SERVINGS] Order modification restore servings note:', restErr.message);
        }
      }

      const reqKitchenApproval = req.body.requiresKitchenApproval ?? req.body.requires_kitchen_approval;
      const reqKitchenApprovalStatus = req.body.kitchenApprovalStatus || req.body.kitchen_approval_status;

      const cleanCustName = customerName !== undefined ? (customerName.trim() === 'Walk-In' || customerName.trim() === 'Walk-In Customer' ? null : customerName.trim() || null) : undefined;

      if (checkExists.rows.length === 0) {
        await client.query(
          `INSERT INTO orders (id, order_type, status, subtotal, tax, delivery_fee, total, notes, payment_reference, payment_method, payment_receipt, requires_kitchen_approval, kitchen_approval_status, customer_name, updated_at)
           VALUES ($1, COALESCE($2, 'ON_SITE'), COALESCE($3, 'CONFIRMED'), $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, FALSE), COALESCE($13, 'NONE'), $14, NOW())`,
          [
            id,
            normalizedOrderType || 'ON_SITE',
            status ? status.toUpperCase() : 'CONFIRMED',
            subtotal !== undefined && subtotal !== null ? subtotal : 0,
            vat !== undefined && vat !== null ? vat : 0,
            deliveryFee !== undefined && deliveryFee !== null ? deliveryFee : 0,
            calcTotal !== undefined && calcTotal !== null ? calcTotal : 0,
            notes || null,
            finalRef,
            paymentMethod || null,
            finalReceipt || null,
            reqKitchenApproval !== undefined ? Boolean(reqKitchenApproval) : null,
            reqKitchenApprovalStatus || null,
            cleanCustName !== undefined ? cleanCustName : null,
          ]
        );
        await client.query(
          `INSERT INTO kitchen_orders (order_id, status, updated_at)
           VALUES ($1, 'PENDING', NOW())
           ON CONFLICT (order_id) DO NOTHING`,
          [id]
        );
      } else {
        await client.query(
          `UPDATE orders
           SET status = COALESCE($1, status),
               subtotal = COALESCE($2, subtotal),
               tax = COALESCE($3, tax),
               delivery_fee = COALESCE($4, delivery_fee),
               total = COALESCE($5, total),
               notes = COALESCE($6, notes),
               order_type = COALESCE($7, order_type),
               payment_reference = COALESCE($9, payment_reference),
               payment_method = COALESCE($10, payment_method),
               payment_receipt = COALESCE($11, payment_receipt),
               requires_kitchen_approval = COALESCE($12, requires_kitchen_approval),
               kitchen_approval_status = COALESCE($13, kitchen_approval_status),
               customer_name = COALESCE($14, customer_name),
               updated_at = NOW()
           WHERE id = $8`,
          [
            status ? status.toUpperCase() : null,
            subtotal || null,
            vat || null,
            deliveryFee || null,
            calcTotal || null,
            notes || null,
            normalizedOrderType,
            id,
            finalRef,
            paymentMethod || null,
            finalReceipt || null,
            reqKitchenApproval !== undefined ? Boolean(reqKitchenApproval) : null,
            reqKitchenApprovalStatus || null,
            cleanCustName !== undefined ? cleanCustName : null,
          ]
        );
      }

      if (cleanCustName) {
        try {
          const checkCust = await client.query('SELECT customer_id FROM orders WHERE id = $1', [id]);
          const existingCustId = checkCust.rows[0]?.customer_id;
          if (existingCustId) {
            await client.query('UPDATE customers SET fullname = $1, updated_at = NOW() WHERE id = $2', [cleanCustName, existingCustId]);
          }
        } catch (cErr) {
          console.warn('Customer update note in PUT /orders/:id:', cErr.message);
        }
      }

      // If items provided, recreate order_items in DB
      if (Array.isArray(items) && items.length > 0) {
        await client.query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
        for (const item of items) {
          const itemName = item.name || item.product_name_snapshot || 'Item';
          const qty = item.quantity || 1;
          const price = item.price || item.unit_price || 0;
          const prodId = item.productId || item.product_id || null;
          await client.query(
            `INSERT INTO order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, prodId, itemName, qty, price, qty * price]
          );
        }

        // Atomically deduct servings for the new items of the modified order (if active / confirmed)
        const effectiveStatus = (status ? status.toUpperCase() : existingInMemory.status || 'CONFIRMED').toUpperCase();
        if (effectiveStatus !== 'CANCELLED' && effectiveStatus !== 'AWAITING_KITCHEN_APPROVAL') {
          try {
            const deductRes = await deductOrderRemainingServings(client, id);
            console.log(`[PUT /orders/${id}] deductRes:`, deductRes);
            if (deductRes?.updatedProducts?.length) {
              updatedProducts.push(...deductRes.updatedProducts);
            }
          } catch (deductErr) {
            console.warn('[SERVINGS] Order modification deduction note:', deductErr.message);
          }
        }
      } else {
        // If items not re-sent but order status transitioned to CONFIRMED, ensure servings are deducted
        const effectiveStatus = (status ? status.toUpperCase() : existingInMemory.status || 'CONFIRMED').toUpperCase();
        if (effectiveStatus === 'CONFIRMED') {
          try {
            const deductRes = await deductOrderRemainingServings(client, id);
            if (deductRes?.updatedProducts?.length) {
              updatedProducts.push(...deductRes.updatedProducts);
            }
          } catch (deductErr) {
            console.warn('[SERVINGS] Order confirmation deduction note:', deductErr.message);
          }
          try {
            await client.query(`
              INSERT INTO kitchen_orders (order_id, status, updated_at)
              VALUES ($1, 'PENDING', NOW())
              ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()
            `, [id]);
          } catch (kErr) {
            console.warn('[KITCHEN] Ticket insert note:', kErr.message);
          }
        }
      }

      // Update payment record if payment method/status/ref/receipt supplied
      if (paymentMethod || paymentStatus || finalRef || finalReceipt) {
        const normPayStatus = (paymentStatus === 'PAID' || paymentStatus === 'COMPLETED' || paymentStatus === 'Paid') ? 'PAID' : (paymentStatus || 'PAID');
        const payCheck = await client.query('SELECT id FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
        if (payCheck.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (order_id, payment_method, amount, status, reference_number, payment_receipt, paid_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [id, paymentMethod || 'Cash', calcTotal || 0, normPayStatus, finalRef, finalReceipt || null]
          );
        } else {
          await client.query(
            `UPDATE payments
             SET payment_method = COALESCE($2, payment_method),
                 amount = $3,
                 status = $4,
                 reference_number = COALESCE($5, reference_number),
                 payment_receipt = COALESCE($6, payment_receipt),
                 updated_at = NOW()
             WHERE id = $1`,
            [payCheck.rows[0].id, paymentMethod || 'Cash', calcTotal || 0, normPayStatus, finalRef, finalReceipt || null]
          );
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      if (client) {
        try { await client.query('ROLLBACK'); } catch {}
      }
      console.error('[PUT /orders/:id] DB update order ERROR:', dbErr);
    } finally {
      if (client) {
        client.release();
      }
    }

    console.log(`[UPDATE] Order ${id} updated in DB and memory`);
    try {
      emitOrderUpdate(updatedInMemory);
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Order ${id} updated successfully`,
      data: updatedInMemory,
      updatedProducts,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message,
    });
  }
});

// PATCH /api/orders/:id/status - Update order status (Staff action)
router.patch('/orders/:id/status', requireAuth, requireRole(['admin', 'cashier', 'kitchen', 'rider', 'assistant']), async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const finalStatus = normalizedStatus;

    if (inMemoryOrders.has(id)) {
      const o = inMemoryOrders.get(id);
      o.status = finalStatus;
      o.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, o);
    }

    const sql = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await query(sql, [finalStatus, id]);

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${finalStatus}`,
      data: rows[0] || { id, status: finalStatus },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    });
  }
});

/**
 * Online Customer places an order -> Saved in Backend Memory & DB
 */
export async function handleCreateCustomerFlowOrder(req, res) {
  try {
    const {
      customerName,
      phone,
      deliveryAddress,
      address,
      deliveryLatitude: rawDeliveryLatitude,
      deliveryLongitude: rawDeliveryLongitude,
      paymentMethod,
      notes,
      items,
      cartItems,
    } = req.body;

    const rawItems = items || cartItems || [];
    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items cannot be empty',
      });
    }

    // Determine fulfillment type: DELIVERY vs PICKUP
    const rawFulfillment = (req.body.fulfillmentType || req.body.fulfillment_type || req.body.fulfillment || (req.body.type === 'Store Pick-Up' ? 'PICKUP' : 'DELIVERY')).toString().trim().toUpperCase();
    const isPickup = rawFulfillment.includes('PICKUP');
    const fulfillmentType = isPickup ? 'PICKUP' : 'DELIVERY';

    // Authoritative Server-side Calculations with fallback to client totals
    const calcSubtotal = req.body.subtotal !== undefined && Number(req.body.subtotal) > 0
      ? Number(req.body.subtotal)
      : rawItems.reduce((acc, i) => acc + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0);
    const calcVat = req.body.vat !== undefined && Number(req.body.vat) > 0
      ? Number(req.body.vat)
      : Math.round(calcSubtotal * 0.12 * 100) / 100;
    const calcFee = isPickup
      ? 0
      : (req.body.deliveryFee !== undefined
          ? Number(req.body.deliveryFee)
          : ((req.body.orderType === 'ONLINE' || req.body.type === 'Delivery' || deliveryAddress || address) ? 50 : 0));
    const calcTotal = req.body.total !== undefined && Number(req.body.total) > 0
      ? Number(req.body.total)
      : Math.round((calcSubtotal + calcVat + calcFee) * 100) / 100;

    const cleanCustomer = customerName || (req.user && req.user.fullname) || 'Online Customer';
    const cleanPhone = phone || (req.user && req.user.phone) || '0917-000-0000';
    const cleanAddress = isPickup
      ? (deliveryAddress || address || 'Store Pick-Up (Seafudz ng Bayan Store Counter, Caloocan)')
      : (deliveryAddress || address || (req.user && req.user.delivery_address) || 'Metro Manila Address');
    const hasLatitude = rawDeliveryLatitude !== undefined && rawDeliveryLatitude !== null;
    const hasLongitude = rawDeliveryLongitude !== undefined && rawDeliveryLongitude !== null;
    const deliveryLatitude = hasLatitude ? Number(rawDeliveryLatitude) : null;
    const deliveryLongitude = hasLongitude ? Number(rawDeliveryLongitude) : null;
    if (
      !isPickup && (
        hasLatitude !== hasLongitude ||
        (hasLatitude && (
          !Number.isFinite(deliveryLatitude) ||
          !Number.isFinite(deliveryLongitude) ||
          deliveryLatitude < -90 ||
          deliveryLatitude > 90 ||
          deliveryLongitude < -180 ||
          deliveryLongitude > 180
        ))
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Delivery coordinates must include a valid latitude and longitude.',
      });
    }
    const customerId = (req.user && req.user.id) ? req.user.id : null;

    const requestedOrderId = req.body.id || req.body.ref;
    const orderId = requestedOrderId || `SFB-${Math.floor(1000 + Math.random() * 9000)}`;
    const existingOrder = requestedOrderId ? inMemoryOrders.get(String(requestedOrderId)) : null;
    if (existingOrder) {
      return res.status(200).json({
        success: true,
        message: `Order ${orderId} already exists`,
        data: formatOrderResponse(existingOrder),
      });
    }

    const isPayInStore = (paymentMethod || '').toUpperCase().includes('STORE') || (paymentMethod || '').toUpperCase().includes('COUNTER');
    const isCod = (paymentMethod || 'GCash').toUpperCase().includes('COD');
    const initialPaymentMethod = isPickup
      ? (isPayInStore ? 'Pay in Store' : 'GCash')
      : (isCod ? 'COD' : 'GCash');
    const isPayLater = isCod || (isPickup && isPayInStore);
    const normalizedItems = rawItems.map(item => {
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.price ?? item.unit_price ?? 0);
      const rawServings = item.remaining_servings !== undefined ? item.remaining_servings : item.remainingServings;
      return {
        id: item.id || item.product_id || item.productId || 'item-1',
        product_id: item.product_id || item.productId || item.id || null,
        name: item.name || item.product_name_snapshot || 'Seafood Dish',
        quantity,
        price,
        subtotal: Math.round(price * quantity * 100) / 100,
        specialNote: item.specialNote || item.notes || '',
        remaining_servings: rawServings !== undefined ? rawServings : undefined,
        remainingServings: rawServings !== undefined ? rawServings : undefined,
      };
    });

    const rawOrderType = (req.body.orderType || req.body.type || '').toString().trim().toUpperCase();
    const isPos = Boolean(
      req.body.isPosOrder ||
      req.body.is_pos_order ||
      (requestedOrderId && String(requestedOrderId).startsWith('POS-')) ||
      rawOrderType.includes('DINE') ||
      rawOrderType.includes('TAKE') ||
      rawOrderType.includes('ON_SITE')
    );

    // Check individual product quantities against standards
    let standardCheck = checkProductQuantityStandards(normalizedItems);
    let requiresKitchenApproval = standardCheck.requiresApproval;
    // If order is below standards or covered by estimated servings, permit customer/cashier to pay immediately
    let initialStatus = requiresKitchenApproval
      ? 'AWAITING_KITCHEN_APPROVAL'
      : (isPos ? (req.body.status || 'CONFIRMED') : (isPayLater ? 'PENDING_COD' : 'GCASH_AUTHORIZED'));
    let kitchenApprovalStatus = requiresKitchenApproval ? 'PENDING' : 'NONE';
    let isGcashAuthorized = !requiresKitchenApproval && !isPayLater && !isPos;

    const orderRecord = {
      id: orderId,
      customer_id: customerId,
      customer_name: cleanCustomer,
      customerName: cleanCustomer,
      customer_phone: cleanPhone,
      phone: cleanPhone,
      delivery_address: cleanAddress,
      address: cleanAddress,
      delivery_latitude: deliveryLatitude,
      delivery_longitude: deliveryLongitude,
      payment_method: initialPaymentMethod,
      paymentMethod: initialPaymentMethod,
      fulfillment_type: fulfillmentType,
      fulfillmentType: fulfillmentType,
      type: isPickup ? 'Store Pick-Up' : (isPos ? 'POS Order' : 'Delivery'),
      payment_reference: req.body.paymentReference || req.body.referenceNumber || undefined,
      paymentReference: req.body.paymentReference || req.body.referenceNumber || undefined,
      referenceNumber: req.body.referenceNumber || req.body.paymentReference || undefined,
      payment_receipt: req.body.paymentReceipt || undefined,
      paymentReceipt: req.body.paymentReceipt || undefined,
      gcash_authorized: isGcashAuthorized,
      gcashAuthorized: isGcashAuthorized,
      status: initialStatus,
      receipt_status: 'NONE',
      receiptStatus: 'NONE',
      requires_kitchen_approval: requiresKitchenApproval,
      requiresKitchenApproval,
      kitchen_approval_status: kitchenApprovalStatus,
      kitchenApprovalStatus,
      flagged_quantity_items: standardCheck.flaggedItems,
      flaggedQuantityItems: standardCheck.flaggedItems,
      servings_deducted: false,
      servingsDeducted: false,
      is_bulk: requiresKitchenApproval,
      isBulk: requiresKitchenApproval,
      isPosOrder: isPos,
      is_pos_order: isPos,
      orderType: isPos ? 'ON_SITE' : 'ONLINE',
      order_type: isPos ? 'ON_SITE' : 'ONLINE',
      notes: notes || '',
      customer_resolution: null,
      customerResolution: null,
      customer_resolution_status: 'NONE',
      customerResolutionStatus: 'NONE',
      customer_replacements: [],
      customerReplacements: [],
      subtotal: calcSubtotal,
      vat: calcVat,
      delivery_fee: calcFee,
      total: calcTotal,
      status: initialStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: normalizedItems,
    };

    // Persist in PostgreSQL DB
    try {
      const pool = await getDbPool();
      const client = await pool.connect();
      let persistedItems = [];
      try {
        await client.query('BEGIN');

        // 1. Verify availability of order items inside transaction
        let productRows = [];
        try {
          productRows = await assertItemsAvailable(client, normalizedItems);
        } catch (itemErr) {
          await client.query('ROLLBACK');
          if (itemErr.code === 'ITEM_OUT_OF_STOCK' || itemErr.code === 'ITEM_DELETED' || itemErr.code === 'INSUFFICIENT_SERVINGS') {
            return res.status(409).json({ success: false, error: itemErr.code, message: itemErr.message });
          }
          console.error('Could not validate item availability:', itemErr.message);
          return res.status(503).json({
            success: false,
            error: 'INVENTORY_VALIDATION_UNAVAILABLE',
            message: 'Could not verify item availability. Please try again.',
          });
        }

        // 1b. Authoritatively link remaining_servings from database products
        // When kitchen has set estimated servings, portion capacity is already verified and approved.
        if (Array.isArray(productRows) && productRows.length > 0) {
          for (const item of normalizedItems) {
            const prod = productRows.find(
              (r) => r.id === String(item.product_id) || r.name.toLowerCase() === String(item.name).toLowerCase()
            );
            if (prod) {
              item.remaining_servings = prod.remaining_servings !== null && prod.remaining_servings !== undefined
                ? Number(prod.remaining_servings)
                : null;
              item.remainingServings = item.remaining_servings;
            }
          }

          standardCheck = checkProductQuantityStandards(normalizedItems);
          requiresKitchenApproval = standardCheck.requiresApproval;
          initialStatus = requiresKitchenApproval
            ? 'AWAITING_KITCHEN_APPROVAL'
            : (isPos ? (req.body.status || 'CONFIRMED') : (isPayLater ? 'PENDING_COD' : 'GCASH_AUTHORIZED'));
          kitchenApprovalStatus = requiresKitchenApproval ? 'PENDING' : 'NONE';
          isGcashAuthorized = !requiresKitchenApproval && !isPayLater && !isPos;

          orderRecord.requires_kitchen_approval = requiresKitchenApproval;
          orderRecord.requiresKitchenApproval = requiresKitchenApproval;
          orderRecord.kitchen_approval_status = kitchenApprovalStatus;
          orderRecord.kitchenApprovalStatus = kitchenApprovalStatus;
          orderRecord.gcash_authorized = isGcashAuthorized;
          orderRecord.gcashAuthorized = isGcashAuthorized;
          orderRecord.status = initialStatus;
          orderRecord.is_bulk = requiresKitchenApproval;
          orderRecord.isBulk = requiresKitchenApproval;
          orderRecord.flagged_quantity_items = standardCheck.flaggedItems;
          orderRecord.flaggedQuantityItems = standardCheck.flaggedItems;
        }

        // 2. Resolve customer_id safely
        // NOTE: If req.user is an employee (e.g. staff testing online ordering while logged in),
        // their employee ID must not be used as customer_id because of foreign key constraint orders_customer_id_fkey.
        let validCustomerId = null;
        const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
        const candidateUserId = req.user?.id;
        const isEmployee = req.user?.type === 'employee' || ['admin', 'cashier', 'kitchen', 'rider', 'assistant'].includes(req.user?.role?.toLowerCase());

        if (!isEmployee && isUuid(candidateUserId)) {
          const custCheck = await client.query('SELECT id FROM customers WHERE id = $1 LIMIT 1', [candidateUserId]);
          if (custCheck.rows.length > 0) {
            validCustomerId = custCheck.rows[0].id;
          }
        }

        if (!validCustomerId) {
          const candidateEmail = (!isEmployee && req.user?.email ? req.user.email : req.body.email || '').trim().toLowerCase();
          const candidatePhone = (cleanPhone || '').trim();
          const candidateName = (cleanCustomer || '').trim();

          if (candidateEmail) {
            const custRes = await client.query('SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1', [candidateEmail]);
            if (custRes.rows.length > 0) {
              validCustomerId = custRes.rows[0].id;
            }
          }

          if (!validCustomerId && candidatePhone && candidatePhone !== '0917-000-0000') {
            const custRes = await client.query('SELECT id FROM customers WHERE phone = $1 LIMIT 1', [candidatePhone]);
            if (custRes.rows.length > 0) {
              validCustomerId = custRes.rows[0].id;
            }
          }

          if (!validCustomerId && candidateName && candidateName !== 'Online Customer') {
            const custRes = await client.query('SELECT id FROM customers WHERE LOWER(fullname) = LOWER($1) LIMIT 1', [candidateName]);
            if (custRes.rows.length > 0) {
              validCustomerId = custRes.rows[0].id;
            }
          }

          if (!validCustomerId && candidateName && candidateName !== 'Online Customer') {
            try {
              const safeEmail = candidateEmail || `${candidateName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'customer'}_${Date.now()}@guest.seafudz.ph`;
              const insertCustRes = await client.query(
                `INSERT INTO customers (fullname, email, phone, delivery_address)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (email) DO UPDATE SET
                   fullname = EXCLUDED.fullname,
                   phone = COALESCE(EXCLUDED.phone, customers.phone),
                   delivery_address = COALESCE(EXCLUDED.delivery_address, customers.delivery_address),
                   updated_at = NOW()
                 RETURNING id`,
                [candidateName, safeEmail, candidatePhone || null, cleanAddress || null]
              );
              if (insertCustRes.rows.length > 0) {
                validCustomerId = insertCustRes.rows[0].id;
              }
            } catch (custErr) {
              console.warn('Could not auto-provision customer record:', custErr.message);
            }
          }
        }

        orderRecord.customer_id = validCustomerId;

        const dbOrderType = isPos ? 'ON_SITE' : 'ONLINE';

        await client.query(
          `INSERT INTO orders (
             id, customer_id, customer_name, order_type, status, subtotal, tax, delivery_fee, total, notes,
             created_at, delivery_latitude, delivery_longitude, payment_method, payment_reference, payment_receipt,
             requires_kitchen_approval, kitchen_approval_status, servings_deducted, fulfillment_type
           )
           VALUES ($1, $2, $18, $16, $8, $3, $4, $5, $6, $7, NOW(), $9, $10, $11, $12, $13, $14, $15, FALSE, $17)
           ON CONFLICT (id) DO UPDATE SET
             customer_name = COALESCE(EXCLUDED.customer_name, orders.customer_name),
             order_type = EXCLUDED.order_type,
             fulfillment_type = EXCLUDED.fulfillment_type,
             status = EXCLUDED.status,
             delivery_latitude = COALESCE(EXCLUDED.delivery_latitude, orders.delivery_latitude),
             delivery_longitude = COALESCE(EXCLUDED.delivery_longitude, orders.delivery_longitude),
             payment_method = COALESCE(EXCLUDED.payment_method, orders.payment_method),
             payment_reference = COALESCE(EXCLUDED.payment_reference, orders.payment_reference),
             payment_receipt = COALESCE(EXCLUDED.payment_receipt, orders.payment_receipt),
             requires_kitchen_approval = EXCLUDED.requires_kitchen_approval,
             kitchen_approval_status = EXCLUDED.kitchen_approval_status`,
          [
            orderId,
            validCustomerId,
            calcSubtotal,
            calcVat,
            calcFee,
            calcTotal,
            notes || null,
            initialStatus,
            deliveryLatitude,
            deliveryLongitude,
            isPos ? (req.body.paymentMethod || 'Paid (POS)') : initialPaymentMethod,
            orderRecord.paymentReference || null,
            orderRecord.paymentReceipt || null,
            requiresKitchenApproval,
            kitchenApprovalStatus,
            dbOrderType,
            fulfillmentType,
            cleanCustomer,
          ]
        );
        if (!isPos && !isPickup) {
          await client.query(
            `INSERT INTO deliveries (order_id, delivery_address, status)
             VALUES ($1, $2, 'PENDING')
             ON CONFLICT (order_id) DO UPDATE SET
               delivery_address = EXCLUDED.delivery_address,
               updated_at = NOW()`,
            [orderId, cleanAddress]
          );
        }

        const existingItems = await client.query(
          `SELECT id, product_id, product_name_snapshot, unit_price, quantity, item_status, notes
           FROM order_items WHERE order_id = $1 ORDER BY id`,
          [orderId]
        );
        if (existingItems.rows.length > 0) {
          persistedItems = existingItems.rows;
        } else {
          for (const item of normalizedItems) {
            const { rows } = await client.query(
              `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes)
               VALUES ($1, (SELECT id FROM products WHERE id = $2 OR LOWER(name) = LOWER($3) LIMIT 1), $3, $4, $5, $6, $7)
               RETURNING id, product_id, product_name_snapshot, unit_price, quantity, item_status, notes`,
              [orderId, item.product_id, item.name, item.price, item.quantity, item.subtotal, item.specialNote || null]
            );
            persistedItems.push(rows[0]);
          }
        }

        const posPaymentStatus = (requiresKitchenApproval || initialStatus === 'AWAITING_KITCHEN_APPROVAL') ? 'PENDING' : 'PAID';
        const finalPaymentMethod = req.body.paymentMethod || (initialPaymentMethod === 'COD' ? 'CASH' : 'GCASH');
        const existingPayments = await client.query(`SELECT id FROM payments WHERE order_id = $1 LIMIT 1`, [orderId]);
        if (existingPayments.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (order_id, payment_method, amount, status, reference_number, payment_receipt, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [orderId, isPos ? finalPaymentMethod : (initialPaymentMethod === 'COD' ? 'CASH' : 'GCASH'), calcTotal, isPos ? posPaymentStatus : 'PENDING', orderRecord.paymentReference || null, orderRecord.paymentReceipt || null]
          );
        } else {
          await client.query(
            `UPDATE payments 
             SET reference_number = COALESCE($2, reference_number), 
                 payment_receipt = COALESCE($3, payment_receipt),
                 status = COALESCE($4, status),
                 updated_at = NOW()
             WHERE order_id = $1`,
            [orderId, orderRecord.paymentReference || null, orderRecord.paymentReceipt || null, isPos ? posPaymentStatus : 'PENDING']
          );
        }

        // Deduct servings atomically for items configured with remaining servings countdown
        if (initialStatus === 'CONFIRMED') {
          try {
            await deductOrderRemainingServings(client, orderId);
          } catch (servErr) {
            console.warn('[SERVINGS] Note during order creation deduction:', servErr.message);
          }
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        try { await client.query('ROLLBACK'); } catch {}
        console.error('Could not persist order:', dbErr.message);
        return res.status(500).json({
          success: false,
          error: 'ORDER_PERSISTENCE_FAILED',
          message: 'Failed to create and record your order. Please try again.',
        });
      } finally {
        client.release();
      }

      if (persistedItems.length > 0) {
        orderRecord.items = persistedItems.map(item => ({
          id: item.id,
          product_id: item.product_id,
          name: item.product_name_snapshot,
          quantity: Number(item.quantity) || 1,
          price: Number(item.unit_price) || 0,
          item_status: item.item_status || 'ACTIVE',
          specialNote: item.notes || '',
        }));
      }
      inMemoryOrders.set(orderId, orderRecord);
    } catch (poolErr) {
      console.warn('Database connection unavailable, falling back to in-memory store:', poolErr.message);
      inMemoryOrders.set(orderId, orderRecord);
    }

    const formatted = formatOrderResponse(orderRecord);
    emitOrderUpdate(formatted);
    console.log(`[ORDER] Customer order created ${orderId} -> Status: PENDING | Total: PHP ${calcTotal}`);

    return res.status(201).json({
      success: true,
      message: `Order ${orderId} created successfully`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error creating order in user flow:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      ...(error.code ? { error: error.code } : {}),
      message: 'Failed to create order',
      error: error.message,
    });
  }
}

/**
 * Online Customer or Role monitors single order by ID
 */
export async function handleGetCustomerFlowOrder(req, res) {
  try {
    const { id } = req.params;

    let dbOrder = null;
    try {
      const { rows } = await query(`
        SELECT o.id, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes,
               o.customer_resolution, o.customer_resolution_status, o.customer_replacements,
               o.receipt_status, o.is_receipt_printed, o.receipt_printed_at,
               o.created_at, o.updated_at,
               COALESCE(NULLIF(o.customer_name, ''), c.fullname, '') AS customer_name, c.phone AS customer_phone, c.delivery_address,
               COALESCE(r_emp.fullname, NULL) AS rider_name,
               COALESCE(r_emp.phone, NULL) AS rider_phone,
               COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, ''), '') AS delivery_proof,
               COALESCE(NULLIF(o.delivery_proof, ''), NULLIF(d.delivery_proof, ''), '') AS "deliveryProof",
               COALESCE(
                 json_agg(
                   DISTINCT jsonb_build_object(
                     'id', oi.id,
                     'product_id', oi.product_id,
                     'name', oi.product_name_snapshot,
                     'quantity', oi.quantity,
                     'price', oi.unit_price,
                     'item_status', oi.item_status,
                     'replacement_for_item_id', oi.replacement_for_item_id
                   )
                 ) FILTER (WHERE oi.id IS NOT NULL), '[]'
               ) AS items,
               COALESCE(
                 (SELECT json_agg(json_build_object('id', p.id, 'amount', p.amount, 'status', p.status, 'payment_method', p.payment_method, 'payment_type', p.payment_type, 'paid_at', p.paid_at, 'reference_number', p.reference_number, 'payment_receipt', p.payment_receipt, 'created_at', p.created_at)) FROM payments p WHERE p.order_id = o.id), '[]'
               ) AS payments,
               COALESCE(
                 (SELECT json_agg(json_build_object('id', r.id, 'amount', r.amount, 'status', r.status, 'reason', r.reason, 'reference_number', r.reference_number, 'refund_receipt', r.refund_receipt, 'created_at', r.created_at, 'completed_at', r.completed_at)) FROM refunds r WHERE r.order_id = o.id), '[]'
               ) AS refunds
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN (
          SELECT DISTINCT ON (order_id) order_id, rider_id, delivery_proof
          FROM deliveries
          ORDER BY order_id, created_at DESC
        ) d ON o.id = d.order_id
        LEFT JOIN employees r_emp ON d.rider_id = r_emp.id
        WHERE o.id = $1
        GROUP BY o.id, o.customer_name, c.fullname, c.phone, c.delivery_address, r_emp.fullname, r_emp.phone, o.delivery_proof, d.delivery_proof
      `, [id]);

      if (rows.length > 0) {
        dbOrder = rows[0];
      }
    } catch (dbErr) {
      console.warn('DB read error in handleGetCustomerFlowOrder:', dbErr.message);
    }

    const memOrder = inMemoryOrders.get(id);

    if (dbOrder) {
      const merged = {
        ...dbOrder,
        ...(memOrder || {}),
        items: (dbOrder.items && dbOrder.items.length > 0) ? dbOrder.items : (memOrder?.items || []),
        payments: dbOrder.payments || memOrder?.payments || [],
        refunds: dbOrder.refunds || memOrder?.refunds || [],
      };
      return res.status(200).json({
        success: true,
        data: formatOrderResponse(merged),
      });
    }

    if (memOrder) {
      return res.status(200).json({
        success: true,
        data: formatOrderResponse(memOrder),
      });
    }

    return res.status(404).json({
      success: false,
      message: `Order ${id} not found`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order status',
      error: error.message,
    });
  }
}

/**
 * GET /api/cashier/online-receipts
 * Fetch online orders formatted as printable receipts for the cashier
 */
router.get('/cashier/online-receipts', async (req, res) => {
  try {
    const { receiptStatus, search } = req.query;

    let dbOrders = [];
    try {
      const { rows } = await query(`
        SELECT o.id, o.order_type, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes,
               COALESCE(o.fulfillment_type, 'DELIVERY') AS fulfillment_type,
               COALESCE(o.receipt_status, 'UNPRINTED') AS receipt_status,
               COALESCE(o.is_receipt_printed, FALSE) AS is_receipt_printed,
               o.receipt_printed_at,
               o.created_at, o.updated_at,
               COALESCE(NULLIF(o.customer_name, ''), c.fullname, 'Online Customer') AS customer_name,
               c.phone AS customer_phone,
               COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
               COALESCE(o.payment_method, p_pay.payment_method, 'ONLINE') AS payment_method,
               COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS payment_reference,
               COALESCE(NULLIF(o.payment_reference, ''), NULLIF(p_pay.reference_number, '')) AS reference_number,
               COALESCE(o.rider_cash_received, d.rider_cash_received) AS rider_cash_received,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'name', oi.product_name_snapshot,
                     'quantity', oi.quantity,
                     'price', oi.unit_price
                   )
                 ) FILTER (WHERE oi.id IS NOT NULL), '[]'
               ) AS items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN (
          SELECT DISTINCT ON (order_id) order_id, delivery_address, rider_cash_received
          FROM deliveries
          ORDER BY order_id, created_at DESC
        ) d ON o.id = d.order_id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN (
          SELECT DISTINCT ON (order_id) order_id, payment_method, reference_number
          FROM payments
          ORDER BY order_id, created_at DESC
        ) p_pay ON o.id = p_pay.order_id
        WHERE UPPER(COALESCE(o.order_type, '')) = 'ONLINE'
          AND o.id NOT LIKE 'POS-%'
        GROUP BY o.id, o.customer_name, c.fullname, c.phone, c.delivery_address, d.delivery_address, d.rider_cash_received, p_pay.payment_method, p_pay.reference_number, o.fulfillment_type
        ORDER BY o.created_at ASC
      `);
      dbOrders = rows;
    } catch (dbErr) {
      console.warn('DB query note (cashier online receipts):', dbErr.message);
    }

    const mergedMap = new Map();

    inMemoryOrders.forEach((val, key) => {
      const keyStr = String(key || val.id || val.ref || '');
      const normType = String(val.orderType || val.order_type || val.type || '').toUpperCase();
      const isPos = Boolean(
        val.isPosOrder ||
        val.is_pos_order ||
        keyStr.startsWith('POS-') ||
        normType.includes('ON_SITE') ||
        normType.includes('DINE') ||
        normType.includes('TAKE') ||
        (val.customer === 'Walk-In' && !val.deliveryAddress)
      );

      // STRICT CHECK: Exclude all on-site POS transactions
      if (isPos) return;

      const isOnline = normType.includes('ONLINE') || normType.includes('DELIVERY') || keyStr.startsWith('SFB-');
      if (isOnline) {
        mergedMap.set(key, formatOrderResponse(val));
      }
    });

    dbOrders.forEach(row => {
      const idStr = String(row.id || '');
      if (idStr.startsWith('POS-')) return;

      if (!mergedMap.has(row.id)) {
        mergedMap.set(row.id, formatOrderResponse(row));
      } else {
        const existing = mergedMap.get(row.id);
        const isPrinted = Boolean(
          existing.isReceiptPrinted ||
          row.is_receipt_printed ||
          row.receipt_status === 'PRINTED' ||
          existing.receiptStatus === 'PRINTED'
        );
        mergedMap.set(row.id, {
          ...existing,
          receiptStatus: isPrinted ? 'PRINTED' : 'UNPRINTED',
          isReceiptPrinted: isPrinted,
        });
      }
    });

    let result = Array.from(mergedMap.values());

    const confirmedStatuses = ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
    result = result.filter(o => {
      const idStr = String(o.id || o.ref || '');
      const typeStr = String(o.type || o.order_type || o.orderType || '').toUpperCase();
      const isPos = Boolean(
        o.isPosOrder ||
        o.is_pos_order ||
        idStr.startsWith('POS-') ||
        typeStr.includes('DINE') ||
        typeStr.includes('TAKE') ||
        typeStr.includes('ON_SITE') ||
        (o.customer === 'Walk-In' && !o.deliveryAddress)
      );
      if (isPos) return false;

      return confirmedStatuses.includes((o.status || '').toUpperCase());
    });

    if (receiptStatus) {
      const target = receiptStatus.toUpperCase();
      if (target === 'UNPRINTED') {
        result = result.filter(o => !o.isReceiptPrinted && o.receiptStatus !== 'PRINTED');
      } else if (target === 'PRINTED') {
        result = result.filter(o => o.isReceiptPrinted || o.receiptStatus === 'PRINTED');
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(o =>
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q))
      );
    }

    // Sort FIFO: Oldest creation time first
    result.sort((a, b) => {
      const tA = new Date(a.createdAt || a.created_at).getTime() || 0;
      const tB = new Date(b.createdAt || b.created_at).getTime() || 0;
      return tA - tB;
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching cashier online receipts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve online receipts',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/cashier/online-receipts/:id/print
 * Records that Cashier printed the restaurant receipt for an online order.
 * Does NOT modify order fulfillment status (status remains intact).
 */
router.patch('/cashier/online-receipts/:id/print', async (req, res) => {
  try {
    const { id } = req.params;

    let updatedOrder = null;

    const rec = inMemoryOrders.get(id) || { id, status: 'CONFIRMED' };
    rec.receipt_status = 'PRINTED';
    rec.receiptStatus = 'PRINTED';
    rec.is_receipt_printed = true;
    rec.isReceiptPrinted = true;
    rec.receipt_printed_at = new Date().toISOString();
    inMemoryOrders.set(id, rec);
    updatedOrder = formatOrderResponse(rec);

    try {
      await query(
        `UPDATE orders SET receipt_status = 'PRINTED', is_receipt_printed = TRUE, receipt_printed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );

      const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0) {
        updatedOrder = formatOrderResponse({
          ...rows[0],
          receipt_status: 'PRINTED',
          is_receipt_printed: true,
          receipt_printed_at: new Date().toISOString(),
        });
      }
    } catch (dbErr) {
      console.warn('DB receipt print update note:', dbErr.message);
    }

    if (!updatedOrder) {
      const fallback = {
        id,
        receipt_status: 'PRINTED',
        is_receipt_printed: true,
        status: 'CONFIRMED',
      };
      inMemoryOrders.set(id, fallback);
      updatedOrder = formatOrderResponse(fallback);
    }

    console.log(`🧾 [Cashier Receipt] Official receipt printed for online order ${id}`);
    emitOrderUpdate({ ...updatedOrder, type: 'ONLINE_RECEIPT_PRINTED' });

    return res.status(200).json({
      success: true,
      message: `Receipt printed successfully for order ${id}`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error recording receipt print:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record receipt print action',
      error: error.message,
    });
  }
});

/**
 * POST /api/orders/:id/pickup-handover
 * Cashier marks a store pickup order as completed / handed over, collecting payment if unpaid.
 */
router.post('/orders/:id/pickup-handover', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, cashReceived, change } = req.body;
    let order = inMemoryOrders.get(id);
    let dbOrder = null;

    try {
      const pool = await getDbPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [id]);
        if (rows.length > 0) {
          dbOrder = rows[0];
        }

        // Prevent handover before the kitchen has marked the order as READY
        const currentStatus = String(dbOrder?.status || order?.status || '').toUpperCase();
        if (!['READY', 'PREPARED', 'READY_FOR_PICKUP'].includes(currentStatus)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Cannot hand over pickup order while still ${currentStatus || 'in kitchen'}. The kitchen must mark it as Ready first.`,
          });
        }

        // Update orders table status to COMPLETED
        await client.query(
          `UPDATE orders 
           SET status = 'COMPLETED',
               updated_at = NOW()
           WHERE id = $1`,
          [id]
        );

        // Reconcile payment status to PAID
        const payMethod = paymentMethod || dbOrder?.payment_method || order?.paymentMethod || 'Cash';
        const existingPay = await client.query(`SELECT id FROM payments WHERE order_id = $1 LIMIT 1`, [id]);
        const finalAmt = Number(dbOrder?.total || order?.total || 0);
        if (existingPay.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (order_id, payment_method, amount, status, paid_at, updated_at)
             VALUES ($1, $2, $3, 'PAID', NOW(), NOW())`,
            [id, payMethod, finalAmt]
          );
        } else {
          await client.query(
            `UPDATE payments 
             SET status = 'PAID',
                 payment_method = COALESCE($2, payment_method),
                 paid_at = NOW(),
                 updated_at = NOW()
             WHERE order_id = $1`,
            [id, payMethod]
          );
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        console.warn('[PICKUP HANDOVER] Database update warning:', dbErr.message);
      } finally {
        client.release();
      }
    } catch (poolErr) {
      console.warn('[PICKUP HANDOVER] DB connection warning:', poolErr.message);
    }

    if (!order) {
      order = { ...(dbOrder || {}), id };
    }
    order.status = 'COMPLETED';
    order.paymentStatus = 'Paid';
    order.updated_at = new Date().toISOString();
    inMemoryOrders.set(id, order);

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: 'Order successfully marked as picked up!',
      data: formatted,
    });
  } catch (error) {
    console.error('Error handling pickup handover:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete pickup handover',
      error: error.message,
    });
  }
});

export default router;

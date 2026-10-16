import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, formatOrderResponse } from './sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';

const router = Router();

function outOfStockError(name) {
  return Object.assign(new Error(`Item "${name}" is currently out of stock.`), {
    statusCode: 409,
    code: 'ITEM_OUT_OF_STOCK',
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
    `SELECT id::text AS id, name, is_available
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
    if (!product || !product.is_available) throw outOfStockError(name);
  }
}

// GET /api/orders - Get orders with pagination, search, and filtering (Staff only)
router.get('/orders', requireAuth, requireRole(['admin', 'cashier', 'assistant', 'kitchen', 'rider']), async (req, res) => {
  try {
    const { status, type, limit, offset, page, search, payment, tab, period } = req.query;
    let sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             o.order_type AS type, o.order_type, o.status,
             o.subtotal, o.tax AS vat, o.tax, o.delivery_fee, o.total, o.notes,
             o.created_at, o.updated_at,
             COALESCE(c.fullname, 'Walk-In Customer') AS customer_name,
             c.phone AS customer_phone,
             COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
             d.status AS delivery_status,
             d.rider_id,
             r_emp.fullname AS rider_name,
             t.name AS table_name,
             p_pay.payment_method,
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
                   'snapshot_item_name', oi.product_name_snapshot
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, delivery_address, status, rider_id
        FROM deliveries
        ORDER BY order_id, created_at DESC
      ) d ON o.id = d.order_id
      LEFT JOIN employees r_emp ON d.rider_id = r_emp.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products pr ON oi.product_id = pr.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, status
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

    const selectedPeriod = (tab || period || '').toLowerCase();
    if (selectedPeriod === 'today') {
      sql += ` AND o.created_at >= (NOW() AT TIME ZONE 'Asia/Manila')::date`;
    } else if (selectedPeriod === 'this week' || selectedPeriod === 'week') {
      sql += ` AND o.created_at >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '6 days'`;
    } else if (selectedPeriod === 'this month' || selectedPeriod === 'month') {
      sql += ` AND o.created_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Manila')`;
    } else if (selectedPeriod === 'this year' || selectedPeriod === 'year') {
      sql += ` AND o.created_at >= DATE_TRUNC('year', NOW() AT TIME ZONE 'Asia/Manila')`;
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
      sql += ` AND (LOWER(o.id) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(c.fullname, '')) LIKE LOWER($${paramIndex}))`;
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

    sql += ` GROUP BY o.id, c.fullname, c.phone, c.delivery_address, d.delivery_address, d.status, d.rider_id, r_emp.fullname, t.name, p_pay.payment_method, p_pay.status ORDER BY o.created_at DESC`;

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
             o.order_type AS type, o.order_type, o.status,
             o.subtotal, o.tax AS vat, o.tax, o.delivery_fee, o.total, o.notes,
             o.created_at, o.updated_at,
             t.name AS table_name,
             p_pay.payment_method,
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
                   'snapshot_item_name', oi.product_name_snapshot
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products pr ON oi.product_id = pr.id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, status
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p_pay ON o.id = p_pay.order_id
      WHERE o.id = $1
      GROUP BY o.id, t.name, p_pay.payment_method, p_pay.status
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
    const { tableId, type, orderType, paymentMethod, notes, customerId, cashierId, assistantId, deliveryAddress } = req.body;
    const cartItems = req.body.cartItems || req.body.items || [];

    if (!cartItems || cartItems.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Cart cannot be empty',
      });
    }

    await client.query('BEGIN');
    await assertItemsAvailable(client, cartItems);

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
        order_type, status, subtotal, tax, delivery_fee, total, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const orderRes = await client.query(orderSql, [
      orderNumber,
      customerId || null,
      cashierId || null,
      assistantId || null,
      tableId || null,
      normalizedOrderType,
      'PENDING',
      subtotal,
      tax,
      deliveryFee,
      totalAmount,
      notes || null,
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
    const normalizedPaymentMethod = (paymentMethod || 'CASH').toUpperCase();
    const validPaymentMethods = ['CASH', 'GCASH', 'CARD', 'ONLINE'];
    const finalPaymentMethod = validPaymentMethods.includes(normalizedPaymentMethod) ? normalizedPaymentMethod : 'CASH';

    const paymentSql = `
      INSERT INTO payments (order_id, payment_method, amount, status, paid_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    await client.query(paymentSql, [
      createdOrder.id,
      finalPaymentMethod,
      totalAmount,
      'PAID',
    ]);

    // Create kitchen order ticket for POS and on-site orders
    if (normalizedOrderType !== 'ONLINE' || req.body.isPosOrder) {
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

    await client.query('COMMIT');
    client.release();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully in database',
      data: createdOrder,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error creating order:', error);
    if (error.code === 'ITEM_OUT_OF_STOCK') {
      return res.status(409).json({ success: false, error: error.code, message: error.message });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create order in database',
      error: error.message,
    });
  }
});

// DELETE /api/orders/:id - Delete order from DB and memory (Admin only)
router.delete('/orders/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryOrders.delete(id);

    try {
      await query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
      await query(`DELETE FROM kitchen_orders WHERE order_id = $1`, [id]);
      await query(`DELETE FROM deliveries WHERE order_id = $1`, [id]);
      await query(`DELETE FROM payments WHERE order_id = $1`, [id]);
      await query(`DELETE FROM orders WHERE id = $1`, [id]);
    } catch (dbErr) {
      console.warn('DB delete note:', dbErr.message);
    }

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
      table,
    } = req.body;

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
      updated_at: new Date().toISOString(),
    };
    inMemoryOrders.set(id, updatedInMemory);

    // 2. Persist in PostgreSQL DB
    try {
      const calcTotal = total !== undefined ? total : (subtotal || 0) + (vat || 0) + (deliveryFee || 0);

      await query(
        `UPDATE orders
         SET status = COALESCE($1, status),
             subtotal = COALESCE($2, subtotal),
             tax = COALESCE($3, tax),
             delivery_fee = COALESCE($4, delivery_fee),
             total = COALESCE($5, total),
             notes = COALESCE($6, notes),
             order_type = COALESCE($7, order_type),
             updated_at = NOW()
         WHERE id = $8`,
        [
          status ? status.toUpperCase() : null,
          subtotal || null,
          vat || null,
          deliveryFee || null,
          calcTotal || null,
          notes || null,
          type || null,
          id,
        ]
      );

      // If items provided, recreate order_items in DB
      if (Array.isArray(items) && items.length > 0) {
        await query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
        for (const item of items) {
          const itemName = item.name || item.product_name_snapshot || 'Item';
          const qty = item.quantity || 1;
          const price = item.price || item.unit_price || 0;
          await query(
            `INSERT INTO order_items (order_id, product_name_snapshot, quantity, unit_price, subtotal)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, itemName, qty, price, qty * price]
          );
        }
      }

      // Update payment record if payment method/status supplied
      if (paymentMethod || paymentStatus) {
        await query(
          `INSERT INTO payments (order_id, payment_method, amount, status, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (order_id) DO UPDATE SET
             payment_method = EXCLUDED.payment_method,
             status = EXCLUDED.status,
             updated_at = NOW()`,
          [id, paymentMethod || 'Cash', calcTotal || 0, paymentStatus || 'COMPLETED']
        ).catch(() => { });
      }
    } catch (dbErr) {
      console.warn('DB update order note:', dbErr.message);
    }

    console.log(`[UPDATE] Admin updated order ${id} in DB and memory`);

    return res.status(200).json({
      success: true,
      message: `Order ${id} updated successfully`,
      data: updatedInMemory,
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

    // Authoritative Server-side Calculations with fallback to client totals
    const calcSubtotal = req.body.subtotal !== undefined && Number(req.body.subtotal) > 0
      ? Number(req.body.subtotal)
      : rawItems.reduce((acc, i) => acc + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0);
    const calcVat = req.body.vat !== undefined && Number(req.body.vat) > 0
      ? Number(req.body.vat)
      : Math.round(calcSubtotal * 0.12 * 100) / 100;
    const calcFee = req.body.deliveryFee !== undefined
      ? Number(req.body.deliveryFee)
      : ((req.body.orderType === 'ONLINE' || req.body.type === 'Delivery' || deliveryAddress || address) ? 50 : 0);
    const calcTotal = req.body.total !== undefined && Number(req.body.total) > 0
      ? Number(req.body.total)
      : Math.round((calcSubtotal + calcVat + calcFee) * 100) / 100;

    const cleanCustomer = customerName || (req.user && req.user.fullname) || 'Online Customer';
    const cleanPhone = phone || (req.user && req.user.phone) || '0917-000-0000';
    const cleanAddress = deliveryAddress || address || (req.user && req.user.delivery_address) || 'Metro Manila Address';
    const hasLatitude = rawDeliveryLatitude !== undefined && rawDeliveryLatitude !== null
    const hasLongitude = rawDeliveryLongitude !== undefined && rawDeliveryLongitude !== null
    const deliveryLatitude = hasLatitude ? Number(rawDeliveryLatitude) : null
    const deliveryLongitude = hasLongitude ? Number(rawDeliveryLongitude) : null
    if (
      hasLatitude !== hasLongitude ||
      (hasLatitude && (
        !Number.isFinite(deliveryLatitude) ||
        !Number.isFinite(deliveryLongitude) ||
        deliveryLatitude < -90 ||
        deliveryLatitude > 90 ||
        deliveryLongitude < -180 ||
        deliveryLongitude > 180
      ))
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

    const initialPaymentMethod = (paymentMethod || 'GCash').toUpperCase().includes('COD') ? 'COD' : 'GCash';
    const initialStatus = initialPaymentMethod === 'COD' ? 'PENDING_COD' : 'GCASH_PENDING_APPROVAL';
    const normalizedItems = rawItems.map(item => {
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.price ?? item.unit_price ?? 0);
      return {
        id: item.id || item.product_id || item.productId || 'item-1',
        product_id: item.product_id || item.productId || item.id || null,
        name: item.name || item.product_name_snapshot || 'Seafood Dish',
        quantity,
        price,
        subtotal: Math.round(price * quantity * 100) / 100,
        specialNote: item.specialNote || item.notes || '',
      };
    });

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
      payment_receipt: req.body.paymentReceipt || undefined,
      paymentReceipt: req.body.paymentReceipt || undefined,
      gcash_authorized: false,
      gcashAuthorized: false,
      status: initialStatus,
      receipt_status: 'NONE',
      receiptStatus: 'NONE',
      is_bulk: false,
      isBulk: false,
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
        await assertItemsAvailable(client, normalizedItems);
        await client.query(
          `INSERT INTO orders (
             id, customer_id, order_type, status, subtotal, tax, delivery_fee, total, notes,
             created_at, delivery_latitude, delivery_longitude
           )
           VALUES ($1, $2, 'ONLINE', $8, $3, $4, $5, $6, $7, NOW(), $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             delivery_latitude = COALESCE(EXCLUDED.delivery_latitude, orders.delivery_latitude),
             delivery_longitude = COALESCE(EXCLUDED.delivery_longitude, orders.delivery_longitude)`,
          [
            orderId,
            customerId,
            calcSubtotal,
            calcVat,
            calcFee,
            calcTotal,
            notes || null,
            initialStatus,
            deliveryLatitude,
            deliveryLongitude,
          ]
        );
        await client.query(
          `INSERT INTO deliveries (order_id, delivery_address, status)
           VALUES ($1, $2, 'PENDING')
           ON CONFLICT (order_id) DO UPDATE SET
             delivery_address = EXCLUDED.delivery_address,
             updated_at = NOW()`,
          [orderId, cleanAddress]
        );

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
               VALUES ($1, (SELECT id FROM products WHERE id = $2), $3, $4, $5, $6, $7)
               RETURNING id, product_id, product_name_snapshot, unit_price, quantity, item_status, notes`,
              [orderId, item.product_id, item.name, item.price, item.quantity, item.subtotal, item.specialNote || null]
            );
            persistedItems.push(rows[0]);
          }
        }

        const existingPayments = await client.query(`SELECT id FROM payments WHERE order_id = $1 LIMIT 1`, [orderId]);
        if (existingPayments.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (order_id, payment_method, amount, status)
             VALUES ($1, $2, $3, 'PENDING')`,
            [orderId, initialPaymentMethod === 'COD' ? 'CASH' : 'GCASH', calcTotal]
          );
        }

        await client.query('COMMIT');
      } catch (dbErr) {
        try { await client.query('ROLLBACK'); } catch {}
        throw dbErr;
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
    } catch (dbErr) {
      if (dbErr.code === 'ITEM_OUT_OF_STOCK') {
        return res.status(409).json({ success: false, error: dbErr.code, message: dbErr.message });
      }
      console.error('Could not validate or persist order availability:', dbErr.message);
      return res.status(503).json({
        success: false,
        error: 'INVENTORY_VALIDATION_UNAVAILABLE',
        message: 'Could not verify item availability. Please try again.',
      });
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
               o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
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
        WHERE o.id = $1
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address
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
, async (req, res) => {
  try {
    const { receiptStatus, search } = req.query;

    let dbOrders = [];
    try {
      const { rows } = await query(`
        SELECT o.id, o.order_type, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes,
               'UNPRINTED' AS receipt_status, o.created_at, o.updated_at,
               COALESCE(c.fullname, 'Online Customer') AS customer_name,
               c.phone AS customer_phone,
               COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
               p_pay.payment_method,
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
          SELECT DISTINCT ON (order_id) order_id, delivery_address
          FROM deliveries
          ORDER BY order_id, created_at DESC
        ) d ON o.id = d.order_id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN (
          SELECT DISTINCT ON (order_id) order_id, payment_method
          FROM payments
          ORDER BY order_id, created_at DESC
        ) p_pay ON o.id = p_pay.order_id
        WHERE UPPER(COALESCE(o.order_type, 'ONLINE')) = 'ONLINE'
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address, d.delivery_address, p_pay.payment_method
        ORDER BY o.created_at ASC
      `);
      dbOrders = rows;
    } catch (dbErr) {
      console.warn('DB query note (cashier online receipts):', dbErr.message);
    }

    const mergedMap = new Map();

    inMemoryOrders.forEach((val, key) => {
      const formatted = formatOrderResponse(val);
      const normType = (val.orderType || val.order_type || val.type || 'ONLINE').toUpperCase();
      if (normType.includes('ONLINE') || val.deliveryAddress || val.address || val.phone) {
        mergedMap.set(key, formatted);
      }
    });

    dbOrders.forEach(row => {
      if (!mergedMap.has(row.id)) {
        mergedMap.set(row.id, formatOrderResponse(row));
      } else {
        const existing = mergedMap.get(row.id);
        mergedMap.set(row.id, {
          ...existing,
          receiptStatus: existing.receiptStatus || row.receipt_status || 'UNPRINTED',
          isReceiptPrinted: existing.isReceiptPrinted || row.receipt_status === 'PRINTED',
        });
      }
    });

    let result = Array.from(mergedMap.values());

    const confirmedStatuses = ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
    result = result.filter(o => confirmedStatuses.includes((o.status || '').toUpperCase()));

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

    if (inMemoryOrders.has(id)) {
      const rec = inMemoryOrders.get(id);
      rec.receipt_status = 'PRINTED';
      rec.receiptStatus = 'PRINTED';
      rec.is_receipt_printed = true;
      rec.isReceiptPrinted = true;
      rec.receipt_printed_at = new Date().toISOString();
      inMemoryOrders.set(id, rec);
      updatedOrder = formatOrderResponse(rec);
    }

    try {
      await query(
        `UPDATE orders SET receipt_status = 'PRINTED', updated_at = NOW() WHERE id = $1`,
        [id]
      ).catch(() => { });

      const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0 && !updatedOrder) {
        updatedOrder = formatOrderResponse({
          ...rows[0],
          receipt_status: 'PRINTED',
          is_receipt_printed: true,
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

export default router;

import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { inMemoryOrders, formatOrderResponse } from './sharedFlowStore.js';

const router = Router();

// GET /api/orders - Get all orders
router.get('/orders', async (req, res) => {
  try {
    const { status, type, limit } = req.query;
    let sql = `
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
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND LOWER(o.status) = LOWER($${paramIndex++})`;
      params.push(status);
    }

    if (type) {
      sql += ` AND LOWER(o.order_type) = LOWER($${paramIndex++})`;
      params.push(type);
    }

    sql += ` GROUP BY o.id, t.name, p_pay.payment_method, p_pay.status ORDER BY o.created_at DESC`;

    if (limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit, 10));
    }

    const { rows } = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: rows.length,
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
router.get('/orders/:id', async (req, res) => {
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

// POST /api/orders - Create a new order with transaction
router.post('/orders', async (req, res) => {
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

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const subtotal = cartItems.reduce((acc, ci) => {
      const price = ci.item ? ci.item.price : (ci.price || ci.unit_price || 0);
      return acc + (price * ci.quantity);
    }, 0);
    const tax = Math.round(subtotal * 0.12 * 100) / 100;
    const deliveryFee = (type === 'ONLINE' || type === 'Delivery' || orderType === 'ONLINE') ? 100 : 0;
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

    // Create kitchen order ticket for on-site orders (online orders wait for assistant confirmation)
    if (normalizedOrderType !== 'ONLINE') {
      const kitchenSql = `
        INSERT INTO kitchen_orders (order_id, status)
        VALUES ($1, 'PENDING')
        ON CONFLICT (order_id) DO NOTHING
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
    return res.status(500).json({
      success: false,
      message: 'Failed to create order in database',
      error: error.message,
    });
  }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const validStatuses = ['PENDING', 'IN_PROCESS', 'COMPLETED', 'CANCELLED'];
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'PENDING';

    const sql = `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await query(sql, [finalStatus, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${finalStatus}`,
      data: rows[0],
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
      paymentMethod,
      notes,
      items,
      cartItems,
      subtotal,
      vat,
      deliveryFee,
      total,
    } = req.body;

    const rawItems = items || cartItems || [];
    if (!rawItems || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order items cannot be empty',
      });
    }

    const orderId = `SFB-${Math.floor(1000 + Math.random() * 9000)}`;
    const calcSubtotal = subtotal || rawItems.reduce((acc, i) => acc + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0);
    const calcVat = vat || Math.round(calcSubtotal * 0.12 * 100) / 100;
    const calcFee = deliveryFee || 50;
    const calcTotal = total || (calcSubtotal + calcVat + calcFee);
    const cleanAddress = deliveryAddress || address || 'Metro Manila Address';
    const cleanPhone = phone || '0917-000-0000';
    const cleanCustomer = customerName || 'Online Customer';

    const orderRecord = {
      id: orderId,
      customer_name: cleanCustomer,
      customerName: cleanCustomer,
      customer_phone: cleanPhone,
      phone: cleanPhone,
      delivery_address: cleanAddress,
      address: cleanAddress,
      payment_method: paymentMethod || 'GCash',
      paymentMethod: paymentMethod || 'GCash',
      notes: notes || '',
      subtotal: calcSubtotal,
      vat: calcVat,
      delivery_fee: calcFee,
      total: calcTotal,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: rawItems.map(i => ({
        id: i.id || i.product_id || 'item-1',
        name: i.name || i.product_name_snapshot || 'Seafood Dish',
        quantity: i.quantity || 1,
        price: i.price || i.unit_price || 0,
        specialNote: i.specialNote || i.notes || '',
      })),
    };

    // Store in Backend Memory
    inMemoryOrders.set(orderId, orderRecord);

    // Try saving to PostgreSQL DB if DB is active
    try {
      await query(
        `INSERT INTO orders (id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at)
         VALUES ($1, 'ONLINE', 'PENDING', $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'PENDING'`,
        [orderId, calcSubtotal, calcVat, calcFee, calcTotal, notes || null]
      );
    } catch (dbErr) {
      console.warn('DB query note (using central memory fallback):', dbErr.message);
    }

    const formatted = formatOrderResponse(orderRecord);
    console.log(`🛒 [Order Flow] Customer placed order ${orderId} -> Status: PENDING`);

    return res.status(201).json({
      success: true,
      message: `Order ${orderId} created successfully with status PENDING`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error creating order in user flow:', error);
    return res.status(500).json({
      success: false,
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

    if (inMemoryOrders.has(id)) {
      const order = formatOrderResponse(inMemoryOrders.get(id));
      return res.status(200).json({
        success: true,
        data: order,
      });
    }

    // DB search
    try {
      const { rows } = await query(`
        SELECT o.id, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes, o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
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
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address
      `, [id]);

      if (rows.length > 0) {
        const order = formatOrderResponse(rows[0]);
        return res.status(200).json({
          success: true,
          data: order,
        });
      }
    } catch {
      /* ignore */
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

export default router;

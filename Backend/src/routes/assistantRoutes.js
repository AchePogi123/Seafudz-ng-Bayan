import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';

const router = Router();

// GET /api/assistant/calls - Get active table assistance requests
router.get('/assistant/calls', requireAuth, requireRole(['admin', 'assistant', 'cashier']), async (req, res) => {
  try {
    const sql = `
      SELECT ac.id, ac.type AS type, ac.status, ac.created_at AS timestamp,
             t.name AS table_name, t.id AS table_id
      FROM assistant_calls ac
      LEFT JOIN tables t ON ac.table_id = t.id
      ORDER BY ac.created_at DESC
    `;
    const { rows } = await query(sql);

    const formattedCalls = rows.map((r) => ({
      id: r.id,
      table: r.table_name ? (r.table_name.toLowerCase().startsWith('table') ? r.table_name : `Table ${r.table_name}`) : (r.table_id || 'Floor'),
      tableId: r.table_id,
      type: r.type,
      status: r.status,
      timestamp: r.timestamp,
    }));

    return res.status(200).json({
      success: true,
      count: formattedCalls.length,
      data: formattedCalls,
    });
  } catch (error) {
    console.error('Error fetching assistant calls:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assistant calls',
      error: error.message,
    });
  }
});

// POST /api/assistant/call - Trigger table assistance request
router.post('/assistant/call', async (req, res) => {
  try {
    const { tableId, type } = req.body;
    const callId = `CALL-${Date.now().toString().slice(-6)}`;

    const sql = `
      INSERT INTO assistant_calls (id, table_id, type, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const { rows } = await query(sql, [callId, tableId || null, type || 'Call Waiter', 'Pending']);

    return res.status(201).json({
      success: true,
      message: 'Assistance request sent to floor team',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error creating assistant call:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create assistance request',
      error: error.message,
    });
  }
});

// PATCH /api/assistant/calls/:id/resolve - Resolve assistance call
router.patch('/assistant/calls/:id/resolve', requireAuth, requireRole(['admin', 'assistant', 'cashier']), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    const sql = `
      UPDATE assistant_calls
      SET status = 'Resolved', assistant_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const { rows } = await query(sql, [employeeId || null, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Call '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Call '${id}' resolved`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error resolving assistant call:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve assistance call',
      error: error.message,
    });
  }
});

// GET /api/assistant/orders - Get online orders for payment verification
router.get('/assistant/orders', optionalAuth, async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.id AS ref, o.order_type, o.status, o.total, o.notes, o.created_at,
             c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
             p_pay.payment_method, p_pay.status AS payment_status,
             COALESCE(
               json_agg(
                 json_build_object(
                   'name', oi.product_name_snapshot,
                   'quantity', oi.quantity,
                   'price', oi.unit_price
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS items
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN (
        SELECT DISTINCT ON (order_id) order_id, payment_method, status
        FROM payments
        ORDER BY order_id, created_at DESC
      ) p_pay ON o.id = p_pay.order_id
      WHERE UPPER(o.order_type) = 'ONLINE'
      GROUP BY o.id, c.fullname, c.phone, c.delivery_address, p_pay.payment_method, p_pay.status
      ORDER BY o.created_at DESC
    `;

    const { rows } = await query(sql);

    const formattedOrders = rows.map((o) => ({
      id: o.id,
      ref: o.ref,
      customer: o.customer_name || 'Online Customer',
      phone: o.customer_phone || 'N/A',
      address: o.delivery_address || 'Customer Delivery Address',
      paymentMethod: o.payment_method || 'GCash',
      paymentStatus: o.payment_status || 'PENDING',
      status: o.status === 'PENDING' ? 'pending' : (o.status === 'IN_PROCESS' || o.status === 'PREPARING' ? 'preparing' : o.status.toLowerCase()),
      items: o.items || [],
      total: parseFloat(o.total || 0),
      createdAt: o.created_at,
      notes: o.notes,
    }));

    return res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders,
    });
  } catch (error) {
    console.error('Error fetching assistant orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve assistant online orders',
      error: error.message,
    });
  }
});

// PATCH /api/assistant/orders/:id/verify - Verify online payment and send order to Kitchen
router.patch('/assistant/orders/:id/verify', optionalAuth, async (req, res) => {
  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { assistantId } = req.body;

    await client.query('BEGIN');

    // 1. Update order status to CONFIRMED
    const orderSql = `
      UPDATE orders
      SET status = 'CONFIRMED', assistant_id = COALESCE($1, assistant_id), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const orderRes = await client.query(orderSql, [assistantId || null, id]);

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: `Order '${id}' not found`,
      });
    }

    // 2. Update payment status to PAID
    await client.query(`
      UPDATE payments
      SET status = 'PAID', paid_at = NOW()
      WHERE order_id = $1
    `, [id]);

    // 3. Insert or update kitchen order ticket to PENDING so it appears in Kitchen Display
    await client.query(`
      INSERT INTO kitchen_orders (order_id, status)
      VALUES ($1, 'PENDING')
      ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()
    `, [id]);

    await client.query('COMMIT');
    client.release();

    const formatted = formatOrderResponse(orderRes.rows[0]);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `Online Payment Verified for Order #${id}! Forwarded to Kitchen Queue.`,
      data: formatted,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error verifying order payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify online order payment',
      error: error.message,
    });
  }
});

// PATCH /api/assistant/orders/:id/authorize-gcash - Authorize customer GCash payment
router.patch('/assistant/orders/:id/authorize-gcash', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let order = inMemoryOrders.get(id) || { id };

    order.gcashAuthorized = true;
    order.status = 'GCASH_AUTHORIZED';
    order.receiptStatus = 'AWAITING_RECEIPT';
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      await query(`UPDATE orders SET status = 'GCASH_AUTHORIZED', updated_at = NOW() WHERE id = $1`, [id]);
    } catch (err) {
      console.warn('DB update note (Authorize GCash):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `GCash payment authorized for order #${id}`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/assistant/orders/:id/upload-receipt - Customer uploads GCash screenshot
router.patch('/assistant/orders/:id/upload-receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentReceipt } = req.body;
    let order = inMemoryOrders.get(id) || { id };

    order.paymentReceipt = paymentReceipt;
    order.status = 'RECEIPT_SUBMITTED';
    order.receiptStatus = 'PENDING_VERIFICATION';
    order.rejectionReason = '';
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      await query(`UPDATE orders SET status = 'RECEIPT_SUBMITTED', updated_at = NOW() WHERE id = $1`, [id]);
    } catch (err) {
      console.warn('DB update note (Upload Receipt):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `Receipt uploaded for order #${id}`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/assistant/orders/:id/attach-proof - Upload or update proof screenshot / reference number
router.patch('/assistant/orders/:id/attach-proof', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentReceipt, paymentReference, refundReceipt, refundReference } = req.body;
    let order = inMemoryOrders.get(id) || { id };

    if (paymentReceipt !== undefined) order.paymentReceipt = paymentReceipt;
    if (paymentReference !== undefined) order.paymentReference = paymentReference;
    if (refundReceipt !== undefined) order.refundReceipt = refundReceipt;
    if (refundReference !== undefined) order.refundReference = refundReference;
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      if (paymentReference) {
        await query(
          `UPDATE payments SET reference_number = $2 WHERE order_id = $1`,
          [id, paymentReference]
        );
      }
    } catch (err) {
      console.warn('DB payments update note (attach-proof):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `Payment proof updated for order #${id}`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/assistant/orders/:id/verify-receipt - Assistant approves receipt screenshot
router.patch('/assistant/orders/:id/verify-receipt', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let order = inMemoryOrders.get(id) || { id };

    order.status = 'CONFIRMED';
    order.receiptStatus = 'APPROVED';
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      await query(
        `INSERT INTO orders (id, status, created_at) VALUES ($1, 'CONFIRMED', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED', updated_at = NOW()`,
        [id]
      );
      await query(
        `INSERT INTO kitchen_orders (order_id, status) VALUES ($1, 'PENDING')
         ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
        [id]
      );
    } catch (err) {
      console.warn('DB update note (Verify Receipt):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `Receipt approved for order #${id}. Sent to kitchen!`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/assistant/orders/:id/reject-receipt - Assistant rejects invalid screenshot
router.patch('/assistant/orders/:id/reject-receipt', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    let order = inMemoryOrders.get(id) || { id };

    order.status = 'RECEIPT_REJECTED';
    order.receiptStatus = 'REJECTED';
    order.rejectionReason = reason || 'Invalid payment receipt or reference image. Please upload a clear official GCash confirmation.';
    order.paymentReceipt = undefined; // clear invalid screenshot
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      await query(`UPDATE orders SET status = 'RECEIPT_REJECTED', updated_at = NOW() WHERE id = $1`, [id]);
    } catch (err) {
      console.warn('DB update note (Reject Receipt):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `Receipt rejected for order #${id}`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/assistant/orders/:id/confirm-cod - Assistant confirms COD availability
router.patch('/assistant/orders/:id/confirm-cod', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let order = inMemoryOrders.get(id) || { id };

    order.status = 'CONFIRMED';
    order.updated_at = new Date().toISOString();

    inMemoryOrders.set(id, order);

    try {
      await query(`UPDATE orders SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`, [id]);
      await query(
        `INSERT INTO kitchen_orders (order_id, status) VALUES ($1, 'PENDING')
         ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
        [id]
      );
    } catch (err) {
      console.warn('DB update note (Confirm COD):', err.message);
    }

    const formatted = formatOrderResponse(order);
    emitOrderUpdate(formatted);

    return res.status(200).json({
      success: true,
      message: `COD Order #${id} availability confirmed! Sent to kitchen!`,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


// PATCH /api/assistant/orders/:id/resolve-out-of-stock - Resolve out-of-stock issue
router.patch('/assistant/orders/:id/resolve-out-of-stock', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const { resolution, refundReceipt, refundReference } = req.body;

  if (!['REPLACE', 'FULL_REFUND'].includes(resolution)) {
    return res.status(400).json({ success: false, message: 'Invalid customer resolution.' });
  }

  const expectedChoice = resolution === 'FULL_REFUND' ? 'REFUND' : 'REPLACE';
  let order = inMemoryOrders.get(id);
  let dbOrder = null;
  let databaseError = null;
  let customerReplacements = [];
  let dbItems = [];
  let refundAmount = 0;

  try {
    const pool = await getDbPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, status, subtotal, tax, delivery_fee, total,
                customer_resolution, customer_resolution_status, customer_replacements
         FROM orders WHERE id = $1 FOR UPDATE`,
        [id]
      );
      dbOrder = rows[0] || null;

      if (dbOrder) {
        const dbChoice = String(dbOrder.customer_resolution || '').toUpperCase();
        const dbChoiceStatus = String(dbOrder.customer_resolution_status || '').toUpperCase();
        if (normalizeFlowStatus(dbOrder.status) !== 'OUT_OF_STOCK' || dbChoice !== expectedChoice || dbChoiceStatus !== 'PENDING_ASSISTANT') {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, message: 'The customer has not submitted this resolution, or it was already handled.' });
        }

        const formattedDbOrder = formatOrderResponse(dbOrder);
        customerReplacements = formattedDbOrder.customerReplacements;
        refundAmount = Number(dbOrder.total) || 0;
        const itemResult = await client.query(
          `SELECT id, product_id, product_name_snapshot AS name, unit_price AS price, quantity, item_status
           FROM order_items WHERE order_id = $1 ORDER BY id`,
          [id]
        );
        dbItems = itemResult.rows;

        if (resolution === 'FULL_REFUND') {
          await client.query(
            `UPDATE orders SET status = 'CANCELLED', customer_resolution_status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [id]
          );
          await client.query(`UPDATE payments SET status = 'REFUNDED', refunded_amount = amount WHERE order_id = $1`, [id]);
          await client.query(`UPDATE kitchen_orders SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE order_id = $1`, [id]);
          await client.query(`UPDATE order_items SET item_status = 'REFUNDED' WHERE order_id = $1`, [id]);
        } else {
          if (!Array.isArray(customerReplacements) || customerReplacements.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'The customer replacement selection is missing.' });
          }

          for (const replacement of customerReplacements) {
            await client.query(
              `UPDATE order_items
               SET product_id = (SELECT id FROM products WHERE id = $2 AND is_available = TRUE),
                   product_name_snapshot = $3, item_status = 'REPLACED'
               WHERE order_id = $1 AND id::text = $4 AND item_status = 'OUT_OF_STOCK'`,
              [id, replacement.newProductId, replacement.newName, String(replacement.oldItemId)]
            );
          }
          await client.query(
            `UPDATE orders SET status = 'CONFIRMED', customer_resolution_status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
            [id]
          );
          await client.query(
            `INSERT INTO kitchen_orders (order_id, status, updated_at) VALUES ($1, 'PENDING', NOW())
             ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
            [id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      try { await client.query('ROLLBACK'); } catch {}
      databaseError = dbErr;
      console.warn('DB note (resolve-out-of-stock):', dbErr.message);
    } finally {
      client.release();
    }
  } catch (poolErr) {
    databaseError = poolErr;
    console.warn('DB pool note (resolve-out-of-stock):', poolErr.message);
  }

  if (!order && !dbOrder) {
    return res.status(databaseError ? 503 : 404).json({
      success: false,
      message: databaseError ? 'Unable to load this order right now.' : 'Order not found.',
    });
  }

  const customerChoice = String(dbOrder?.customer_resolution || order?.customerResolution || '').toUpperCase();
  const customerChoiceStatus = String(dbOrder?.customer_resolution_status || order?.customerResolutionStatus || '').toUpperCase();
  if (normalizeFlowStatus(dbOrder?.status || order?.status) !== 'OUT_OF_STOCK' || customerChoice !== expectedChoice || customerChoiceStatus !== 'PENDING_ASSISTANT') {
    return res.status(409).json({ success: false, message: 'The customer has not submitted this resolution, or it was already handled.' });
  }

  if (databaseError && !order) {
    return res.status(503).json({ success: false, message: 'Unable to process the customer resolution right now.' });
  }

  if (!customerReplacements.length) {
    customerReplacements = order?.customerReplacements || [];
  }
  if (resolution === 'REPLACE' && customerReplacements.length === 0) {
    return res.status(409).json({ success: false, message: 'The customer replacement selection is missing.' });
  }

  if (!order) {
    order = {
      ...(dbOrder || {}),
      id,
      items: dbItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        item_status: item.item_status,
      })),
      total: Number(dbOrder?.total) || 0,
      subtotal: Number(dbOrder?.subtotal) || 0,
      vat: Number(dbOrder?.tax) || 0,
      deliveryFee: Number(dbOrder?.delivery_fee) || 0,
    };
  }

  if (resolution === 'FULL_REFUND') {
    order.status = 'CANCELLED';
    order.customerResolution = 'REFUND';
    order.customer_resolution = 'REFUND';
    order.customerResolutionStatus = 'COMPLETED';
    order.customer_resolution_status = 'COMPLETED';
    order.customerReplacements = [];
    order.customer_replacements = [];
    order.outOfStockItems = [];
    if (refundReceipt !== undefined) order.refundReceipt = refundReceipt;
    if (refundReference !== undefined) order.refundReference = refundReference;
    (order.items || []).forEach(item => { item.item_status = 'REFUNDED'; });
    refundAmount = Number(order.total ?? dbOrder?.total ?? refundAmount) || 0;
  } else {
    customerReplacements.forEach(replacement => {
      const item = (order.items || []).find(i => String(i.id) === String(replacement.oldItemId))
        || (order.items || []).find(i => i.name === replacement.oldItemName);
      if (item) {
        item.name = replacement.newName;
        item.product_id = replacement.newProductId;
        item.item_status = 'REPLACED';
      }
    });
    order.status = 'CONFIRMED';
    order.customerResolution = 'REPLACE';
    order.customer_resolution = 'REPLACE';
    order.customerResolutionStatus = 'COMPLETED';
    order.customer_resolution_status = 'COMPLETED';
    order.customerReplacements = customerReplacements;
    order.customer_replacements = customerReplacements;
    order.outOfStockItems = [];
  }

  order.updated_at = new Date().toISOString();
  inMemoryOrders.set(id, order);

  const formatted = formatOrderResponse({
    ...(dbOrder || {}),
    ...order,
    id,
    customer_resolution: expectedChoice,
    customer_resolution_status: 'COMPLETED',
    customer_replacements: customerReplacements,
  });
  emitOrderUpdate({
    ...formatted,
    type: 'OUT_OF_STOCK_RESOLVED',
    resolution,
    refundAmount,
  });

  console.log(`[ASSISTANT] Order ${id} resolved with ${resolution}.`);

  return res.status(200).json({
    success: true,
    message: resolution === 'FULL_REFUND'
      ? `Order #${id} was marked as fully refunded.`
      : `Customer's replacement choice was confirmed for order #${id}. Sent back to kitchen.`,
    data: { orderId: id, resolution, refundAmount, orderStatus: order.status },
  });
});

/**
 * Handles status updates triggered by the Assistant role
 * Transitions: PENDING -> CONFIRMED or PENDING -> FLAGGED
 */
export async function handleAssistantStatusUpdate(req, res) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const nextStatus = normalizeFlowStatus(status);
    let updatedOrder = null;

    if (inMemoryOrders.has(id)) {
      const existing = inMemoryOrders.get(id);
      existing.status = nextStatus;
      existing.updated_at = new Date().toISOString();
      if (note) existing.notes = note;
      inMemoryOrders.set(id, existing);
      updatedOrder = formatOrderResponse(existing);
    }

    // Update PostgreSQL Database
    try {
      const { rows } = await query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [nextStatus, id]
      );

      // If order confirmed, create a kitchen queue entry
      if (nextStatus === 'CONFIRMED') {
        await query(
          `INSERT INTO kitchen_orders (order_id, status) VALUES ($1, 'PENDING')
           ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
          [id]
        );
      }

      if (rows.length > 0 && !updatedOrder) {
        updatedOrder = formatOrderResponse(rows[0]);
      }
    } catch (dbErr) {
      console.warn('DB update note (Assistant Flow):', dbErr.message);
    }

    if (!updatedOrder) {
      const newRec = {
        id,
        status: nextStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryOrders.set(id, newRec);
      updatedOrder = formatOrderResponse(newRec);
    }

    if (updatedOrder) {
      emitOrderUpdate(updatedOrder);
    }

    console.log(`[ASSISTANT] Order ${id} verified -> Status: ${nextStatus}`);

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${nextStatus} by Assistant`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error in Assistant status update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status in Assistant flow',
      error: error.message,
    });
  }
}

export default router;

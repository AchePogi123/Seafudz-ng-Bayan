import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';

const router = Router();

// GET /api/assistant/calls - Get active table assistance requests
router.get('/assistant/calls', async (req, res) => {
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
router.patch('/assistant/calls/:id/resolve', async (req, res) => {
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
router.get('/assistant/orders', async (req, res) => {
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
router.patch('/assistant/orders/:id/verify', async (req, res) => {
  const pool = await getDbPool();
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { assistantId } = req.body;

    await client.query('BEGIN');

    // 1. Update order status to IN_PROCESS
    const orderSql = `
      UPDATE orders
      SET status = 'IN_PROCESS', assistant_id = COALESCE($1, assistant_id), updated_at = NOW()
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

    return res.status(200).json({
      success: true,
      message: `Online Payment Verified for Order #${id}! Forwarded to Kitchen Queue.`,
      data: orderRes.rows[0],
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

// PATCH /api/assistant/orders/:id/flag - Flag online order for correction
router.patch('/assistant/orders/:id/flag', async (req, res) => {
  try {
    const { id } = req.params;
    const { correctionNote } = req.body;

    const sql = `
      UPDATE orders
      SET notes = COALESCE($1, notes), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const { rows } = await query(sql, [correctionNote ? `FLAGGED: ${correctionNote}` : null, id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Order '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Order #${id} flagged for correction`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error flagging order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to flag order',
      error: error.message,
    });
  }
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

    console.log(`🔄 [Assistant Flow] Order ${id} verified -> Status: ${nextStatus}`);

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

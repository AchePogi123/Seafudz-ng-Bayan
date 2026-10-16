import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse, calculateFinancialLedger } from './sharedFlowStore.js';
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
      SELECT o.id, o.id AS ref, o.order_type, o.status, o.subtotal, o.tax AS vat,
             o.delivery_fee, o.total, o.notes, o.created_at,
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
      subtotal: parseFloat(o.subtotal || 0),
      vat: parseFloat(o.vat || 0),
      deliveryFee: parseFloat(o.delivery_fee || 50),
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

    if (refundReceipt !== undefined || refundReference !== undefined) {
      if (!Array.isArray(order.refunds)) order.refunds = [];
      const pendingRefund = order.refunds.find(r => r.status === 'PENDING') || order.refunds[order.refunds.length - 1];
      if (pendingRefund) {
        if (refundReceipt !== undefined) pendingRefund.refund_receipt = refundReceipt;
        if (refundReference !== undefined) pendingRefund.reference_number = refundReference;
      } else if (Number(order.excessAmount || 0) > 0) {
        order.refunds.push({
          id: `ref-${Date.now()}`,
          order_id: id,
          amount: Number(order.excessAmount),
          status: 'PENDING',
          reason: 'OUT_OF_STOCK_REPLACEMENT_EXCESS',
          refund_receipt: refundReceipt,
          reference_number: refundReference,
          created_at: new Date().toISOString(),
        });
      }
    }

    inMemoryOrders.set(id, order);

    try {
      if (paymentReference) {
        await query(
          `UPDATE payments SET reference_number = $2 WHERE order_id = $1`,
          [id, paymentReference]
        );
      }
      if (refundReceipt !== undefined || refundReference !== undefined) {
        const upd = await query(
          `UPDATE refunds
           SET refund_receipt = COALESCE($2, refund_receipt),
               reference_number = COALESCE($3, reference_number)
           WHERE order_id = $1 AND status IN ('PENDING', 'COMPLETED')
           RETURNING id`,
          [id, refundReceipt || null, refundReference || null]
        );
        if (upd.rows.length === 0 && Number(order.excessAmount || 0) > 0) {
          await query(
            `INSERT INTO refunds (order_id, amount, status, reason, refund_receipt, reference_number)
             VALUES ($1, $2, 'PENDING', 'OUT_OF_STOCK_REPLACEMENT_EXCESS', $3, $4)
             ON CONFLICT (order_id) WHERE status = 'PENDING'
             DO UPDATE SET refund_receipt = EXCLUDED.refund_receipt, reference_number = EXCLUDED.reference_number`,
            [id, Number(order.excessAmount), refundReceipt || null, refundReference || null]
          );
        }
      }
    } catch (err) {
      console.warn('DB payments/refunds update note (attach-proof):', err.message);
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

    if (!order.payments || !Array.isArray(order.payments) || order.payments.length === 0) {
      order.payments = [{
        amount: order.total || 0,
        status: 'PAID',
        payment_method: order.paymentMethod || 'GCASH',
        paid_at: new Date().toISOString(),
      }];
    } else {
      order.payments.forEach(p => {
        p.status = 'PAID';
        p.paid_at = new Date().toISOString();
      });
    }

    if (req.body?.paymentReference) {
      order.paymentReference = req.body.paymentReference;
    }

    inMemoryOrders.set(id, order);

    try {
      await query(
        `INSERT INTO orders (id, order_type, status, created_at)
         VALUES ($1, 'ONLINE', 'CONFIRMED', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'CONFIRMED', updated_at = NOW()`,
        [id]
      );
      await query(
        `INSERT INTO kitchen_orders (order_id, status) VALUES ($1, 'PENDING')
         ON CONFLICT (order_id) DO UPDATE SET status = 'PENDING', updated_at = NOW()`,
        [id]
      );
      const paymentRef = req.body?.paymentReference || order.paymentReference || null;
      await query(
        `UPDATE payments
         SET status = 'PAID', paid_at = NOW(),
             reference_number = COALESCE($2, reference_number)
         WHERE order_id = $1`,
        [id, paymentRef]
      );
      const payCheck = await query(`SELECT id FROM payments WHERE order_id = $1`, [id]);
      if (payCheck.rows.length === 0) {
        await query(
          `INSERT INTO payments (order_id, payment_method, amount, status, reference_number, paid_at)
           VALUES ($1, 'GCASH', (SELECT total FROM orders WHERE id = $1), 'PAID', $2, NOW())`,
          [id, paymentRef]
        );
      }
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
  let refundAmount = 0;
  let updatedSubtotal = 0;
  let updatedVat = 0;
  let updatedDeliveryFee = 0;
  let updatedTotal = 0;
  let finalPayments = [];
  let finalRefunds = [];

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
        const memChoice = String(order?.customerResolution || '').toUpperCase();
        const memChoiceStatus = String(order?.customerResolutionStatus || '').toUpperCase();
        const effectiveChoice = dbChoice || memChoice;
        const effectiveChoiceStatus = (dbChoiceStatus && dbChoiceStatus !== 'NONE') ? dbChoiceStatus : memChoiceStatus;
        const isOOS = normalizeFlowStatus(dbOrder.status) === 'OUT_OF_STOCK' || normalizeFlowStatus(order?.status) === 'OUT_OF_STOCK';

        if (!isOOS || effectiveChoice !== expectedChoice || effectiveChoiceStatus !== 'PENDING_ASSISTANT') {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, message: 'The customer has not submitted this resolution, or it was already handled.' });
        }

        const formattedDbOrder = formatOrderResponse(dbOrder);
        customerReplacements = formattedDbOrder.customerReplacements;

        if (resolution === 'FULL_REFUND') {
          const payRes = await client.query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
          const refRes = await client.query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
          const ledger = calculateFinancialLedger(payRes.rows, refRes.rows, dbOrder.total, 'GCASH');
          refundAmount = ledger.netConfirmedPaid > 0 ? ledger.netConfirmedPaid : Number(dbOrder.total) || 0;

          await client.query(
            `UPDATE orders
             SET status = 'CANCELLED', customer_resolution_status = 'COMPLETED', updated_at = NOW()
             WHERE id = $1`,
            [id]
          );

          const updRef = await client.query(
            `UPDATE refunds
             SET status = 'COMPLETED', refund_receipt = COALESCE($2, refund_receipt),
                 reference_number = COALESCE($3, reference_number), completed_at = NOW()
             WHERE order_id = $1 AND status = 'PENDING'
             RETURNING id`,
            [id, refundReceipt || null, refundReference || null]
          );

          if (updRef.rows.length === 0 && refundAmount > 0) {
            await client.query(
              `INSERT INTO refunds (order_id, amount, status, reason, refund_receipt, reference_number, completed_at)
               VALUES ($1, $2, 'COMPLETED', 'CUSTOMER_FULL_REFUND', $3, $4, NOW())`,
              [id, refundAmount, refundReceipt || null, refundReference || null]
            );
          }

          await client.query(
            `UPDATE payments
             SET status = 'REFUNDED', refunded_amount = amount
             WHERE order_id = $1`,
            [id]
          );

          await client.query(
            `UPDATE kitchen_orders
             SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
             WHERE order_id = $1`,
            [id]
          );

          await client.query(`UPDATE order_items SET item_status = 'REFUNDED' WHERE order_id = $1`, [id]);
        } else {
          // resolution === 'REPLACE'
          if (!Array.isArray(customerReplacements) || customerReplacements.length === 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'The customer replacement selection is missing.' });
          }

          for (const replacement of customerReplacements) {
            const oldItemId = replacement.oldItemId;
            await client.query(
              `UPDATE order_items
               SET item_status = 'REPLACED'
               WHERE order_id = $1 AND (id::text = $2 OR product_id = $2 OR product_name_snapshot = $2) AND item_status = 'OUT_OF_STOCK'`,
              [id, String(oldItemId)]
            );

            const prodRes = await client.query(
              `SELECT id, name, price, is_available FROM products
               WHERE id = $1 OR LOWER(id) = LOWER($1) OR LOWER(name) = LOWER($2)
               ORDER BY (id = $1) DESC, (LOWER(id) = LOWER($1)) DESC, (LOWER(name) = LOWER($2)) DESC
               LIMIT 1`,
              [replacement.newProductId, replacement.newName || '']
            );
            const verifiedId = prodRes.rows[0]?.id || replacement.newProductId;
            const verifiedName = prodRes.rows[0]?.name || replacement.newName;
            const verifiedPrice = prodRes.rows[0]?.price ? parseFloat(prodRes.rows[0].price) : Number(replacement.newPrice || 0);
            const qty = Number(replacement.quantity) || 1;
            const subtotal = Math.round(verifiedPrice * qty * 100) / 100;

            await client.query(
              `INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, item_status, replacement_for_item_id)
               VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7)`,
              [id, verifiedId, verifiedName, verifiedPrice, qty, subtotal, Number.isInteger(Number(oldItemId)) ? Number(oldItemId) : null]
            );
          }

          const sumRes = await client.query(
            `SELECT COALESCE(SUM(unit_price * quantity), 0) AS active_subtotal
             FROM order_items
             WHERE order_id = $1 AND item_status = 'ACTIVE'`,
            [id]
          );
          updatedSubtotal = Math.round(parseFloat(sumRes.rows[0]?.active_subtotal || 0) * 100) / 100;
          updatedVat = Math.round(updatedSubtotal * 0.12 * 100) / 100;
          updatedDeliveryFee = Math.round(parseFloat(dbOrder.delivery_fee || 0) * 100) / 100;
          updatedTotal = Math.round((updatedSubtotal + updatedVat + updatedDeliveryFee) * 100) / 100;

          const refUpd = await client.query(
            `UPDATE refunds
             SET status = 'COMPLETED',
                 refund_receipt = COALESCE($2, refund_receipt),
                 reference_number = COALESCE($3, reference_number),
                 payment_id = COALESCE(payment_id, (SELECT id FROM payments WHERE order_id = $1 AND COALESCE(payment_type, 'INITIAL') = 'INITIAL' LIMIT 1)),
                 completed_at = NOW()
             WHERE order_id = $1 AND status = 'PENDING'
             RETURNING id, amount, refund_receipt`,
            [id, refundReceipt || null, refundReference || null]
          );

          if (refUpd.rows.length > 0) {
            const completedExcess = refUpd.rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
            refundAmount = completedExcess;
            await client.query(
              `UPDATE payments
               SET refunded_amount = COALESCE(refunded_amount, 0) + $2,
                   status = CASE WHEN (COALESCE(refunded_amount, 0) + $2) >= amount THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END
               WHERE order_id = $1 AND COALESCE(payment_type, 'INITIAL') = 'INITIAL'`,
              [id, completedExcess]
            );
          } else {
            const payRes = await client.query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
            const existingRefs = await client.query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
            const calcLedger = calculateFinancialLedger(payRes.rows, existingRefs.rows, updatedTotal, 'GCASH');
            if (calcLedger.excessAmount > 0) {
              const completedExcess = calcLedger.excessAmount;
              refundAmount = completedExcess;
              const payId = payRes.rows.find(p => ['INITIAL', null, undefined].includes(p.payment_type))?.id || payRes.rows[0]?.id || null;
              await client.query(
                `INSERT INTO refunds (order_id, payment_id, amount, status, reason, refund_receipt, reference_number, completed_at)
                 VALUES ($1, $2, $3, 'COMPLETED', 'OUT_OF_STOCK_REPLACEMENT_EXCESS', $4, $5, NOW())`,
                [id, payId, completedExcess, refundReceipt || null, refundReference || null]
              );
              await client.query(
                `UPDATE payments
                 SET refunded_amount = COALESCE(refunded_amount, 0) + $2,
                     status = CASE WHEN (COALESCE(refunded_amount, 0) + $2) >= amount THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END
                 WHERE order_id = $1 AND COALESCE(payment_type, 'INITIAL') = 'INITIAL'`,
                [id, completedExcess]
              );
            }
          }

          await client.query(
            `UPDATE orders
             SET subtotal = $2, tax = $3, total = $4, status = 'CONFIRMED',
                 customer_resolution_status = 'COMPLETED', updated_at = NOW()
             WHERE id = $1`,
            [id, updatedSubtotal, updatedVat, updatedTotal]
          );

          await client.query(
            `INSERT INTO kitchen_orders (order_id, status, updated_at)
             VALUES ($1, 'PENDING', NOW())
             ON CONFLICT (order_id) DO UPDATE
             SET status = CASE
               WHEN kitchen_orders.status = 'OUT_OF_STOCK' THEN 'PENDING'
               ELSE kitchen_orders.status
             END,
             updated_at = NOW()`,
            [id]
          );
        }

        const finalP = await client.query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
        const finalR = await client.query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
        finalPayments = finalP.rows;
        finalRefunds = finalR.rows;
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

  if (databaseError && !order) {
    return res.status(503).json({ success: false, message: 'Unable to process the customer resolution right now.' });
  }

  if (order) {
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
    } else {
      const currentItems = Array.isArray(order.items) ? [...order.items] : [];
      customerReplacements.forEach(replacement => {
        const item = currentItems.find(i => String(i.id) === String(replacement.oldItemId))
          || currentItems.find(i => i.name === replacement.oldItemName);
        if (item) {
          item.item_status = 'REPLACED';
        }
        currentItems.push({
          id: `rep-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          product_id: replacement.newProductId,
          name: replacement.newName,
          price: Number(replacement.newPrice || 0),
          quantity: Number(replacement.quantity || 1),
          item_status: 'ACTIVE',
          replacementForItemId: replacement.oldItemId,
        });
      });
      order.items = currentItems;
      order.status = 'CONFIRMED';
      order.customerResolution = 'REPLACE';
      order.customer_resolution = 'REPLACE';
      order.customerResolutionStatus = 'COMPLETED';
      order.customer_resolution_status = 'COMPLETED';
      order.customerReplacements = customerReplacements;
      order.customer_replacements = customerReplacements;
      order.outOfStockItems = [];
      if (updatedTotal > 0) {
        order.subtotal = updatedSubtotal;
        order.vat = updatedVat;
        order.deliveryFee = updatedDeliveryFee;
        order.total = updatedTotal;
      }
      if (refundReceipt !== undefined) order.refundReceipt = refundReceipt;
      if (refundReference !== undefined) order.refundReference = refundReference;
      if (!Array.isArray(order.refunds)) order.refunds = [];
      const pendingRefund = order.refunds.find(r => r.status === 'PENDING');
      if (pendingRefund) {
        pendingRefund.status = 'COMPLETED';
        if (refundReceipt) pendingRefund.refund_receipt = refundReceipt;
        if (refundReference) pendingRefund.reference_number = refundReference;
        pendingRefund.completed_at = new Date().toISOString();
      } else if (refundAmount > 0 || Number(order.excessAmount || 0) > 0) {
        const excessVal = refundAmount > 0 ? refundAmount : Number(order.excessAmount);
        order.refunds.push({
          id: `ref-${Date.now()}`,
          order_id: id,
          amount: excessVal,
          status: 'COMPLETED',
          reason: 'OUT_OF_STOCK_REPLACEMENT_EXCESS',
          refund_receipt: refundReceipt || order.refundReceipt,
          reference_number: refundReference || order.refundReference,
          completed_at: new Date().toISOString(),
        });
      }
      if (finalRefunds && finalRefunds.length > 0) {
        order.refunds = finalRefunds;
        const refReceipt = finalRefunds.find(r => r.refund_receipt)?.refund_receipt;
        if (refReceipt) order.refundReceipt = refReceipt;
      }
      if (finalPayments && finalPayments.length > 0) {
        order.payments = finalPayments;
      }
    }
    order.updated_at = new Date().toISOString();
    inMemoryOrders.set(id, order);
  }

  const formatted = formatOrderResponse({
    ...(dbOrder || {}),
    ...order,
    id,
    status: resolution === 'FULL_REFUND' ? 'CANCELLED' : 'CONFIRMED',
    customer_resolution: expectedChoice,
    customer_resolution_status: 'COMPLETED',
    customer_replacements: customerReplacements,
    payments: finalPayments.length ? finalPayments : order?.payments || [],
    refunds: finalRefunds.length ? finalRefunds : order?.refunds || [],
    total: updatedTotal > 0 ? updatedTotal : (order?.total || dbOrder?.total),
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
    data: { orderId: id, resolution, refundAmount, orderStatus: formatted.status },
  });
});

// PATCH /api/assistant/orders/:id/verify-additional-payment - Verify additional GCash payment
router.patch('/assistant/orders/:id/verify-additional-payment', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const { assistantId, referenceNumber } = req.body;

  try {
    const { rows } = await query(
      `UPDATE payments
       SET status = 'PAID', paid_at = NOW(),
           reference_number = COALESCE($2, reference_number)
       WHERE order_id = $1 AND payment_type = 'ADDITIONAL' AND status = 'PENDING'
       RETURNING *`,
      [id, referenceNumber || null]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending additional payment found for this order.',
      });
    }

    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
    const payRes = await query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
    const refRes = await query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);

    const formatted = formatOrderResponse({
      ...(orderRes.rows[0] || {}),
      payments: payRes.rows,
      refunds: refRes.rows,
    });

    emitOrderUpdate({
      ...formatted,
      type: 'ADDITIONAL_PAYMENT_VERIFIED',
    });

    return res.status(200).json({
      success: true,
      message: `Additional payment of ₱${parseFloat(rows[0].amount).toLocaleString()} verified for order #${id}.`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error verifying additional payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify additional payment',
      error: error.message,
    });
  }
});

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

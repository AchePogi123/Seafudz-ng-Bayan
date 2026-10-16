import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse, calculateFinancialLedger } from './sharedFlowStore.js';
import { handleAssistantStatusUpdate } from './assistantRoutes.js';
import { handleKitchenStatusUpdate } from './kitchenRoutes.js';
import { handleRiderStatusUpdate, handleDeleteOrder } from './riderRoutes.js';
import { handleCreateCustomerFlowOrder, handleGetCustomerFlowOrder } from './orderRoutes.js';

import { realtimeEmitter, emitOrderUpdate } from '../utils/realtimeEvents.js';

const router = Router();

// Real-time Server-Sent Events (SSE) Stream for 0ms order updates
router.get('/events/orders', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();

  const onUpdate = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data || { type: 'ORDER_UPDATE', timestamp: Date.now() })}\n\n`);
    } catch {}
  };

  realtimeEmitter.on('order_update', onUpdate);

  try {
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);
  } catch {}

  req.on('close', () => {
    realtimeEmitter.removeListener('order_update', onUpdate);
  });
});

// Online customer endpoints
router.post('/user-flow/orders', optionalAuth, handleCreateCustomerFlowOrder);
router.get('/user-flow/orders/:id', handleGetCustomerFlowOrder);

/**
 * Common GET /api/user-flow/orders
 * Returns all active orders in the central backend store (used by all roles)
 */
router.get('/user-flow/orders', async (req, res) => {
  try {
    const { status, customerName, customerId, phone } = req.query;

    // Fetch DB orders if available
    let dbOrders = [];
    try {
      const { rows } = await query(`
        SELECT o.id, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes,
               o.delivery_latitude, o.delivery_longitude,
               o.customer_resolution, o.customer_resolution_status, o.customer_replacements,
               o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone,
               COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'product_id', oi.product_id,
                     'name', oi.product_name_snapshot,
                     'quantity', oi.quantity,
                     'price', oi.unit_price,
                      'item_status', oi.item_status)
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
        LEFT JOIN deliveries d ON d.order_id = o.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address, d.delivery_address
        ORDER BY o.created_at DESC
      `);
      dbOrders = rows;
    } catch {
      /* ignore DB errors */
    }

    // Merge in-memory orders and DB orders
    const mergedMap = new Map();

    // In-memory orders first
    inMemoryOrders.forEach((val, key) => {
      mergedMap.set(key, formatOrderResponse(val));
    });

    // DB orders overlay (inMemoryOrders updated status takes precedence)
    dbOrders.forEach(row => {
      if (row.id && String(row.id).startsWith('ORD-')) return;

      const dbOrder = formatOrderResponse(row);
      if (!mergedMap.has(row.id)) {
        mergedMap.set(row.id, dbOrder);
      } else {
        const existing = mergedMap.get(row.id);
        const mergedPayments = dbOrder.payments?.length ? dbOrder.payments : (existing.payments || []);
        const mergedRefunds = dbOrder.refunds?.length ? dbOrder.refunds : (existing.refunds || []);
        const mergedTotal = existing.total !== undefined ? existing.total : dbOrder.total;
        const mergedMethod = dbOrder.paymentMethod || existing.paymentMethod || 'GCash';
        const mergedLedger = calculateFinancialLedger(mergedPayments, mergedRefunds, mergedTotal, mergedMethod);

        mergedMap.set(row.id, {
          ...dbOrder,
          ...existing,
          payments: mergedPayments,
          refunds: mergedRefunds,
          status: normalizeFlowStatus(existing.status || row.status),
          outOfStockItems: dbOrder.outOfStockItems.length > 0 ? dbOrder.outOfStockItems : existing.outOfStockItems || [],
          customerResolution: dbOrder.customerResolution || existing.customerResolution || null,
          customerResolutionStatus: dbOrder.customerResolutionStatus !== 'NONE'
            ? dbOrder.customerResolutionStatus
            : existing.customerResolutionStatus || 'NONE',
          customerReplacements: dbOrder.customerResolution
            ? dbOrder.customerReplacements
            : existing.customerReplacements || [],
          refundReceipt: existing.refundReceipt || dbOrder.refundReceipt || undefined,
          refundReference: existing.refundReference || dbOrder.refundReference || undefined,
          financialStatus: mergedLedger.financialStatus,
          netConfirmedPaid: mergedLedger.netConfirmedPaid,
          grossConfirmedPaid: mergedLedger.grossConfirmedPaid,
          completedRefundAmount: mergedLedger.completedRefunds,
          pendingRefundAmount: mergedLedger.pendingRefundAmount,
          additionalRequired: mergedLedger.additionalRequired,
          excessAmount: mergedLedger.excessAmount,
          total: mergedTotal,
        });
      }
    });

    let allOrders = Array.from(mergedMap.values());

    if (customerName) {
      const lower = String(customerName).toLowerCase().trim();
      allOrders = allOrders.filter(o =>
        (o.customerName && String(o.customerName).toLowerCase().trim() === lower) ||
        (o.customer && String(o.customer).toLowerCase().trim() === lower)
      );
    }

    if (phone) {
      const cleanP = String(phone).trim();
      allOrders = allOrders.filter(o => o.phone === cleanP);
    }

    if (customerId) {
      allOrders = allOrders.filter(o => String(o.customer_id) === String(customerId));
    }

    if (status) {
      const targetNorm = normalizeFlowStatus(status);
      allOrders = allOrders.filter(o => o.status === targetNorm);
    }

    return res.status(200).json({
      success: true,
      count: allOrders.length,
      data: allOrders,
    });
  } catch (error) {
    console.error('Error fetching user flow orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve orders',
      error: error.message,
    });
  }
});

router.patch('/user-flow/orders/:id/out-of-stock-choice', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const resolution = String(req.body.resolution || '').toUpperCase();

  if (!['REPLACE', 'REFUND'].includes(resolution)) {
    return res.status(400).json({
      success: false,
      message: 'Choose either REPLACE or REFUND.',
    });
  }

  const order = inMemoryOrders.get(id);
  let dbOrder = null;
  let dbOutOfStockItems = [];
  let databaseReadError = null;

  try {
    const { rows } = await query(
      `SELECT id, status, subtotal, tax, delivery_fee, total, customer_resolution_status
       FROM orders WHERE id = $1`,
      [id]
    );
    dbOrder = rows[0] || null;

    if (dbOrder) {
      const itemResult = await query(
        `SELECT id, product_id, product_name_snapshot AS name, unit_price AS price, quantity
         FROM order_items WHERE order_id = $1 AND item_status = 'OUT_OF_STOCK' ORDER BY id`,
        [id]
      );
      dbOutOfStockItems = itemResult.rows;
    }
  } catch (error) {
    databaseReadError = error;
  }

  if (!order && !dbOrder) {
    return res.status(databaseReadError ? 503 : 404).json({
      success: false,
      message: databaseReadError ? 'Unable to load this order right now.' : 'Order not found.',
    });
  }

  const isOutOfStock = normalizeFlowStatus(order?.status) === 'OUT_OF_STOCK'
    || normalizeFlowStatus(dbOrder?.status) === 'OUT_OF_STOCK';

  if (!isOutOfStock) {
    return res.status(409).json({ success: false, message: 'This order is not awaiting an out-of-stock decision.' });
  }

  // Ensure DB order status is aligned to OUT_OF_STOCK if it lagged behind in-memory status
  if (dbOrder && normalizeFlowStatus(dbOrder.status) !== 'OUT_OF_STOCK') {
    try {
      await query(
        `UPDATE orders
         SET status = 'OUT_OF_STOCK', customer_resolution = NULL,
             customer_resolution_status = 'AWAITING_CUSTOMER', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      dbOrder.status = 'OUT_OF_STOCK';
    } catch (syncErr) {
      console.warn('Sync orders table to OUT_OF_STOCK note:', syncErr.message);
    }
  }

  const currentResolutionStatus = String(dbOrder?.customer_resolution_status || order?.customerResolutionStatus || 'AWAITING_CUSTOMER').toUpperCase();
  if (currentResolutionStatus === 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'This out-of-stock issue has already been resolved.' });
  }

  let flaggedItems = dbOutOfStockItems.length > 0
    ? dbOutOfStockItems
    : order?.outOfStockItems?.length
      ? order.outOfStockItems
      : (order?.items || []).filter(item => String(item.item_status || item.itemStatus || '').toUpperCase() === 'OUT_OF_STOCK');

  if (flaggedItems.length === 0 && Array.isArray(order?.items) && order.items.length > 0) {
    flaggedItems = order.items;
  }

  if (flaggedItems.length === 0) {
    return res.status(409).json({ success: false, message: 'No unavailable items were found for this order.' });
  }

  let customerReplacements = [];
  let projectedSubtotal = 0;
  let projectedVat = 0;
  let deliveryFee = Number(dbOrder?.delivery_fee || order?.deliveryFee || 0);
  let projectedTotal = 0;
  let calculatedLedger = null;
  let payMethod = order?.payment_method || order?.paymentMethod || (order?.status === 'PENDING_COD' ? 'COD' : 'GCash');

  if (resolution === 'REPLACE') {
    const submittedReplacements = req.body.replacements;
    if (!Array.isArray(submittedReplacements) || submittedReplacements.length !== flaggedItems.length) {
      return res.status(400).json({ success: false, message: 'Choose a replacement for every unavailable item.' });
    }

    const replacementByItemId = new Map(submittedReplacements.map(item => [String(item.oldItemId), item]));
    let replacementSubtotal = 0;

    for (const [index, item] of flaggedItems.entries()) {
      const oldItemId = item.id ?? index;
      const replacement = replacementByItemId.get(String(oldItemId))
        || replacementByItemId.get(String(index))
        || replacementByItemId.get(String(item.product_id || item.productId))
        || submittedReplacements[index];
      const newProductId = String(replacement?.newProductId || '').trim();

      if (!replacement || !newProductId) {
        return res.status(400).json({ success: false, message: 'One or more replacement selections are invalid.' });
      }

      let prodName = String(replacement?.newName || '').trim();
      let prodPrice = Number(replacement?.newPrice);
      let authoritativeProductId = newProductId;

      try {
        const prodRes = await query(
          `SELECT id, name, price, is_available FROM products
           WHERE id = $1 OR LOWER(id) = LOWER($1) OR LOWER(name) = LOWER($2)
           ORDER BY (id = $1) DESC, (LOWER(id) = LOWER($1)) DESC, (LOWER(name) = LOWER($2)) DESC
           LIMIT 1`,
          [newProductId, prodName]
        );
        if (prodRes.rows.length === 0 || !prodRes.rows[0].is_available) {
          return res.status(400).json({
            success: false,
            message: `Selected replacement dish '${prodName || newProductId}' is currently unavailable.`
          });
        }
        authoritativeProductId = prodRes.rows[0].id;
        prodName = prodRes.rows[0].name;
        prodPrice = parseFloat(prodRes.rows[0].price);
      } catch (err) {
        console.warn('DB note (validate replacement product):', err.message);
      }

      const qty = Number(item.quantity) || 1;
      replacementSubtotal += prodPrice * qty;

      customerReplacements.push({
        oldItemId,
        oldItemName: item.name || item.product_name_snapshot || '',
        newProductId: authoritativeProductId,
        newName: prodName,
        newPrice: prodPrice,
        quantity: qty,
      });
    }

    // Calculate active items subtotal
    let activeSubtotal = 0;
    if (dbOrder) {
      try {
        const actRes = await query(
          `SELECT COALESCE(SUM(unit_price * quantity), 0) AS active_subtotal
           FROM order_items
           WHERE order_id = $1 AND COALESCE(item_status, 'ACTIVE') NOT IN ('OUT_OF_STOCK', 'REPLACED')`,
          [id]
        );
        activeSubtotal = parseFloat(actRes.rows[0]?.active_subtotal || 0);
      } catch (err) {
        console.warn('DB note (calc active subtotal):', err.message);
      }
    } else if (order?.items) {
      activeSubtotal = order.items
        .filter(i => !['OUT_OF_STOCK', 'REPLACED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase()))
        .reduce((sum, i) => sum + (Number(i.price || i.unit_price || 0) * (Number(i.quantity) || 1)), 0);
    }

    projectedSubtotal = Math.round((activeSubtotal + replacementSubtotal) * 100) / 100;
    projectedVat = Math.round(projectedSubtotal * 0.12 * 100) / 100;
    projectedTotal = Math.round((projectedSubtotal + projectedVat + deliveryFee) * 100) / 100;
  }

  let databaseWriteError = null;
  let dbPayments = [];
  let dbRefunds = [];

  if (dbOrder) {
    try {
      const payRes = await query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
      const refRes = await query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
      dbPayments = payRes.rows;
      dbRefunds = refRes.rows;

      const isCod = String(dbOrder.status).toUpperCase() === 'PENDING_COD'
        || dbPayments.some(p => ['COD', 'CASH'].includes(String(p.payment_method).toUpperCase()));
      payMethod = isCod ? 'COD' : (dbPayments[0]?.payment_method || 'GCash');

      const targetTotal = resolution === 'REPLACE' ? projectedTotal : Number(dbOrder.total || 0);
      calculatedLedger = calculateFinancialLedger(dbPayments, dbRefunds, targetTotal, payMethod);

      if (resolution === 'REPLACE') {
        if (calculatedLedger.excessAmount > 0) {
          await query(
            `INSERT INTO refunds (order_id, amount, status, reason)
             VALUES ($1, $2, 'PENDING', 'OUT_OF_STOCK_REPLACEMENT_EXCESS')
             ON CONFLICT (order_id) WHERE status = 'PENDING'
             DO UPDATE SET amount = EXCLUDED.amount`,
            [id, calculatedLedger.excessAmount]
          );
        } else {
          await query(
            `UPDATE refunds SET status = 'CANCELLED'
             WHERE order_id = $1 AND status = 'PENDING'`,
            [id]
          );
        }
      } else if (resolution === 'REFUND') {
        const refundTargetAmount = isCod ? 0 : Number(dbOrder.total || 0);
        if (refundTargetAmount > 0) {
          await query(
            `INSERT INTO refunds (order_id, amount, status, reason)
             VALUES ($1, $2, 'PENDING', 'OUT_OF_STOCK_REFUND_REQUEST')
             ON CONFLICT (order_id) WHERE status = 'PENDING'
             DO UPDATE SET amount = EXCLUDED.amount`,
            [id, refundTargetAmount]
          );
        }
      }

      const { rows } = await query(
        `UPDATE orders
         SET customer_resolution = $2, customer_resolution_status = 'PENDING_ASSISTANT',
             customer_replacements = $3::jsonb, updated_at = NOW()
         WHERE id = $1 AND UPPER(status) = 'OUT_OF_STOCK'
           AND COALESCE(customer_resolution_status, 'NONE') <> 'COMPLETED'
         RETURNING id`,
        [id, resolution, JSON.stringify(customerReplacements)]
      );
      if (rows.length === 0) {
        return res.status(409).json({ success: false, message: 'This out-of-stock issue has already been resolved.' });
      }

      const refetchPay = await query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
      const refetchRef = await query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
      dbPayments = refetchPay.rows;
      dbRefunds = refetchRef.rows;
    } catch (error) {
      databaseWriteError = error;
      console.warn('DB note (customer out-of-stock choice):', error.message);
    }
  }

  if (databaseWriteError && !order) {
    return res.status(503).json({ success: false, message: 'Unable to save your choice right now. Please try again.', error: databaseWriteError?.message });
  }

  const normalizedOutOfStockItems = flaggedItems.map((item, index) => ({
    id: item.id ?? index,
    name: item.name || item.product_name_snapshot || 'Seafood Dish',
    price: Number(item.price ?? item.unit_price ?? 0),
    quantity: Number(item.quantity) || 1,
  }));

  if (order) {
    order.customerResolution = resolution;
    order.customer_resolution = resolution;
    order.customerResolutionStatus = 'PENDING_ASSISTANT';
    order.customer_resolution_status = 'PENDING_ASSISTANT';
    order.customerReplacements = customerReplacements;
    order.customer_replacements = customerReplacements;
    order.outOfStockItems = normalizedOutOfStockItems;
    if (resolution === 'REPLACE' && projectedTotal > 0) {
      order.projectedSubtotal = projectedSubtotal;
      order.projectedVat = projectedVat;
      order.projectedTotal = projectedTotal;
      order.total = projectedTotal;
      order.subtotal = projectedSubtotal;
      order.vat = projectedVat;
    }
    if (calculatedLedger) {
      order.excessAmount = calculatedLedger.excessAmount;
      order.additionalRequired = calculatedLedger.additionalRequired;
      order.financialStatus = calculatedLedger.financialStatus;
      order.pendingRefundAmount = calculatedLedger.pendingRefundAmount;
      order.netConfirmedPaid = calculatedLedger.netConfirmedPaid;
      order.grossConfirmedPaid = calculatedLedger.grossConfirmedPaid;
    }
    if (dbPayments && dbPayments.length > 0) order.payments = dbPayments;
    if (dbRefunds && dbRefunds.length > 0) order.refunds = dbRefunds;
    order.updated_at = new Date().toISOString();
    inMemoryOrders.set(id, order);
  }

  const updatedOrder = formatOrderResponse({
    ...(dbOrder || {}),
    ...(order || {}),
    id,
    payment_method: payMethod,
    paymentMethod: payMethod,
    status: 'OUT_OF_STOCK',
    outOfStockItems: normalizedOutOfStockItems,
    customer_resolution: resolution,
    customer_resolution_status: 'PENDING_ASSISTANT',
    customer_replacements: customerReplacements,
    payments: dbPayments.length ? dbPayments : order?.payments || [],
    refunds: dbRefunds.length ? dbRefunds : order?.refunds || [],
    total: (resolution === 'REPLACE' && projectedTotal > 0) ? projectedTotal : (dbOrder?.total || order?.total),
  });
  realtimeEmitter.emit('order_update', { ...updatedOrder, type: 'CUSTOMER_OUT_OF_STOCK_CHOICE' });

  return res.status(200).json({
    success: true,
    message: resolution === 'REFUND' ? 'Refund request sent to the assistant.' : 'Replacement choice sent to the assistant.',
    data: updatedOrder,
  });
});

/**
 * POST /api/user-flow/orders/:id/additional-payment-receipt
 * Customer submits proof of additional payment when replacement order total is higher than amount paid
 */
router.post('/user-flow/orders/:id/additional-payment-receipt', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentReceipt, referenceNumber } = req.body;

    if (!paymentReceipt) {
      return res.status(400).json({
        success: false,
        message: 'Payment receipt proof is required.',
      });
    }

    let dbOrder = null;
    let payRows = [];
    let refRows = [];

    try {
      const oRes = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
      dbOrder = oRes.rows[0] || null;
      if (dbOrder) {
        const pRes = await query(`SELECT * FROM payments WHERE order_id = $1`, [id]);
        const rRes = await query(`SELECT * FROM refunds WHERE order_id = $1`, [id]);
        payRows = pRes.rows;
        refRows = rRes.rows;
      }
    } catch (e) {
      console.warn('DB query error on additional payment receipt:', e.message);
    }

    const order = inMemoryOrders.get(id);
    if (!order && !dbOrder) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const currentTotal = Number(dbOrder?.total || order?.total || 0);
    const payMethod = dbOrder?.status === 'PENDING_COD' ? 'COD' : 'GCash';
    const ledger = calculateFinancialLedger(payRows, refRows, currentTotal, payMethod);
    const additionalAmount = ledger.additionalRequired > 0 ? ledger.additionalRequired : 0;

    if (dbOrder) {
      try {
        const existingAdd = payRows.find(
          p => String(p.payment_type || '').toUpperCase() === 'ADDITIONAL' && String(p.status).toUpperCase() === 'PENDING'
        );

        if (existingAdd) {
          await query(
            `UPDATE payments
             SET payment_receipt = $1, reference_number = COALESCE($2, reference_number),
                 amount = $3
             WHERE id = $4`,
            [paymentReceipt, referenceNumber || null, additionalAmount || existingAdd.amount, existingAdd.id]
          );
        } else {
          await query(
            `INSERT INTO payments (order_id, payment_method, amount, status, payment_type, reference_number, payment_receipt)
             VALUES ($1, 'GCASH', $2, 'PENDING', 'ADDITIONAL', $3, $4)`,
            [id, additionalAmount, referenceNumber || null, paymentReceipt]
          );
        }
      } catch (dbErr) {
        console.warn('DB insert/update additional payment error:', dbErr.message);
      }
    }

    if (order) {
      order.additionalPaymentReceipt = paymentReceipt;
      order.additionalPaymentReference = referenceNumber || null;
      order.financialStatus = 'ADDITIONAL_PAYMENT_PENDING';
      inMemoryOrders.set(id, order);
    }

    // Refetch complete updated order
    let updatedOrderData = null;
    if (dbOrder) {
      try {
        const fullRes = await query(`
          SELECT o.*,
                 c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
                 COALESCE(
                   (SELECT json_agg(json_build_object('id', p.id, 'amount', p.amount, 'status', p.status, 'payment_method', p.payment_method, 'payment_type', p.payment_type, 'paid_at', p.paid_at, 'reference_number', p.reference_number, 'payment_receipt', p.payment_receipt, 'created_at', p.created_at)) FROM payments p WHERE p.order_id = o.id), '[]'
                 ) AS payments,
                 COALESCE(
                   (SELECT json_agg(json_build_object('id', r.id, 'amount', r.amount, 'status', r.status, 'reason', r.reason, 'reference_number', r.reference_number, 'refund_receipt', r.refund_receipt, 'created_at', r.created_at, 'completed_at', r.completed_at)) FROM refunds r WHERE r.order_id = o.id), '[]'
                 ) AS refunds
          FROM orders o
          LEFT JOIN customers c ON o.customer_id = c.id
          WHERE o.id = $1
        `, [id]);
        if (fullRes.rows.length > 0) {
          updatedOrderData = formatOrderResponse(fullRes.rows[0]);
        }
      } catch {}
    }

    const finalOrder = updatedOrderData || formatOrderResponse({ ...(dbOrder || {}), ...(order || {}), id });
    realtimeEmitter.emit('order_update', { ...finalOrder, type: 'ADDITIONAL_PAYMENT_SUBMITTED' });

    return res.status(200).json({
      success: true,
      message: 'Additional payment proof submitted successfully. Restaurant staff will verify it shortly.',
      data: finalOrder,
    });
  } catch (error) {
    console.error('Error submitting additional payment receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit additional payment receipt',
      error: error.message,
    });
  }
});

async function executeOrderCancellation(id) {
  let orderInMemory = inMemoryOrders.get(id);
  if (!orderInMemory) {
    for (const [k, v] of inMemoryOrders.entries()) {
      if (k === id || v.id === id || v.ref === id) {
        orderInMemory = v;
        break;
      }
    }
  }

  let dbOrder = null;
  try {
    const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
    if (rows.length > 0) {
      dbOrder = rows[0];
    }
  } catch (e) {
    console.warn('Orders DB lookup note:', e.message);
  }

  const currentStatus = orderInMemory?.status || dbOrder?.status || null;
  const normCurrent = normalizeFlowStatus(currentStatus);

  if (normCurrent === 'CANCELLED') {
    const activeOrderObj = orderInMemory || (dbOrder ? formatOrderResponse(dbOrder) : { id, status: 'CANCELLED' });
    return { success: true, message: `Order ${id} is already cancelled.`, order: activeOrderObj };
  }

  const nonCancellableStatuses = ['PREPARING', 'COOKING', 'IN_PREPARATION', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'];
  if (nonCancellableStatuses.includes(normCurrent)) {
    return {
      success: false,
      status: 400,
      message: 'Order is already being prepared in the kitchen and cannot be cancelled.',
    };
  }

  // Update in-memory orders
  if (orderInMemory) {
    orderInMemory.status = 'CANCELLED';
    orderInMemory.updated_at = new Date().toISOString();
    inMemoryOrders.set(orderInMemory.id || id, orderInMemory);
  } else if (dbOrder) {
    const formatted = formatOrderResponse(dbOrder);
    formatted.status = 'CANCELLED';
    formatted.updated_at = new Date().toISOString();
    inMemoryOrders.set(id, formatted);
    orderInMemory = formatted;
  }

  // Update PostgreSQL orders table
  try {
    await query(
      `UPDATE orders
       SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  } catch (dbErr) {
    console.warn('Update orders cancelled_at fallback:', dbErr.message);
    try {
      await query(
        `UPDATE orders
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } catch (e2) {
      console.error('Fatal error updating orders to CANCELLED:', e2.message);
    }
  }

  // Keep kitchen_orders table in sync
  try {
    await query(
      `UPDATE kitchen_orders
       SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
       WHERE order_id = $1`,
      [id]
    );
  } catch (e) {
    console.warn('Sync kitchen_orders cancel note:', e.message);
  }

  // Keep order_items table in sync
  try {
    await query(
      `UPDATE order_items
       SET item_status = 'CANCELLED'
       WHERE order_id = $1 AND item_status != 'CANCELLED'`,
      [id]
    );
  } catch (e) {}

  const activeOrderObj = inMemoryOrders.get(id) || orderInMemory || (dbOrder ? { ...formatOrderResponse(dbOrder), status: 'CANCELLED' } : { id, status: 'CANCELLED' });
  const formattedResponse = formatOrderResponse(activeOrderObj);

  emitOrderUpdate(formattedResponse);

  return {
    success: true,
    message: `Order ${id} has been cancelled successfully.`,
    order: formattedResponse,
  };
}

router.patch('/user-flow/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await executeOrderCancellation(id);
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message,
    });
  }
});

/**
 * Common PATCH /api/user-flow/orders/:id/status
 * Central Status Transition router: Delegates logic to respective role controllers
 */
router.patch('/user-flow/orders/:id/status', optionalAuth, async (req, res) => {
  const { status } = req.body;
  const targetNorm = normalizeFlowStatus(status);

  if (targetNorm === 'CANCELLED') {
    const { id } = req.params;
    const result = await executeOrderCancellation(id);
    if (!result.success) {
      return res.status(result.status || 400).json(result);
    }
    return res.status(200).json(result);
  }

  // Delegate based on role responsible for the status transition:
  if (targetNorm === 'OUT_OF_STOCK') {
    // Kitchen flags order as out of stock
    return handleKitchenStatusUpdate(req, res);
  } else if (targetNorm === 'CONFIRMED' || targetNorm === 'FLAGGED' || targetNorm === 'PENDING') {
    // Assistant confirms or flags orders
    return handleAssistantStatusUpdate(req, res);
  } else if (targetNorm === 'PREPARING' || targetNorm === 'READY') {
    // Kitchen marks cooking or ready
    return handleKitchenStatusUpdate(req, res);
  } else if (targetNorm === 'OUT_FOR_DELIVERY' || targetNorm === 'COMPLETED') {
    // Rider dispatches or completes deliveries
    return handleRiderStatusUpdate(req, res);
  } else {
    // Default fallback update logic directly in memory/DB
    try {
      const { id } = req.params;
      if (inMemoryOrders.has(id)) {
        const order = inMemoryOrders.get(id);
        order.status = targetNorm;
        order.updated_at = new Date().toISOString();
        inMemoryOrders.set(id, order);
      }
      await query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, [targetNorm, id]);
      return res.status(200).json({
        success: true,
        message: `Order ${id} status updated to ${targetNorm}`,
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Common DELETE and cancel cleanup routes (Staff only action)
router.delete(['/user-flow/orders/:id', '/kitchen/orders/:id'], requireAuth, requireRole(['admin', 'cashier', 'rider', 'kitchen']), handleDeleteOrder);

export default router;

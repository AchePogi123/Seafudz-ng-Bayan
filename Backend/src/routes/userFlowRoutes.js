import { Router } from 'express';
import { query } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';
import { handleAssistantStatusUpdate } from './assistantRoutes.js';
import { handleKitchenStatusUpdate } from './kitchenRoutes.js';
import { handleRiderStatusUpdate, handleDeleteOrder } from './riderRoutes.js';
import { handleCreateCustomerFlowOrder, handleGetCustomerFlowOrder } from './orderRoutes.js';

import { realtimeEmitter } from '../utils/realtimeEvents.js';

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
               o.customer_resolution, o.customer_resolution_status, o.customer_replacements,
               o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone, c.delivery_address,
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
               ) AS items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address
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
        mergedMap.set(row.id, {
          ...existing,
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
      `SELECT id, status, customer_resolution_status FROM orders WHERE id = $1`,
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

  if (normalizeFlowStatus(dbOrder?.status || order?.status) !== 'OUT_OF_STOCK') {
    return res.status(409).json({ success: false, message: 'This order is not awaiting an out-of-stock decision.' });
  }

  const currentResolutionStatus = String(dbOrder?.customer_resolution_status || order?.customerResolutionStatus || 'AWAITING_CUSTOMER').toUpperCase();
  if (currentResolutionStatus === 'COMPLETED') {
    return res.status(409).json({ success: false, message: 'This out-of-stock issue has already been resolved.' });
  }

  const flaggedItems = dbOutOfStockItems.length > 0
    ? dbOutOfStockItems
    : order?.outOfStockItems?.length
      ? order.outOfStockItems
      : (order?.items || []).filter(item => String(item.item_status || item.itemStatus || '').toUpperCase() === 'OUT_OF_STOCK');

  if (flaggedItems.length === 0) {
    return res.status(409).json({ success: false, message: 'No unavailable items were found for this order.' });
  }

  let customerReplacements = [];
  if (resolution === 'REPLACE') {
    const submittedReplacements = req.body.replacements;
    if (!Array.isArray(submittedReplacements) || submittedReplacements.length !== flaggedItems.length) {
      return res.status(400).json({ success: false, message: 'Choose a replacement for every unavailable item.' });
    }

    const replacementByItemId = new Map(submittedReplacements.map(item => [String(item.oldItemId), item]));
    for (const [index, item] of flaggedItems.entries()) {
      const oldItemId = item.id ?? index;
      const replacement = replacementByItemId.get(String(oldItemId));
      const newProductId = String(replacement?.newProductId || '').trim();
      const newName = String(replacement?.newName || '').trim();
      const newPrice = Number(replacement?.newPrice);

      if (!replacement || !newProductId || newProductId.length > 100 || !newName || newName.length > 255) {
        return res.status(400).json({ success: false, message: 'One or more replacement selections are invalid.' });
      }

      customerReplacements.push({
        oldItemId,
        oldItemName: item.name || item.product_name_snapshot || '',
        newProductId,
        newName,
        newPrice: Number.isFinite(newPrice) && newPrice >= 0 ? newPrice : Number(item.price || item.unit_price || 0),
        quantity: Number(item.quantity) || 1,
      });
    }
  }

  let databaseWriteError = null;
  if (dbOrder) {
    try {
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
    } catch (error) {
      databaseWriteError = error;
      console.warn('DB note (customer out-of-stock choice):', error.message);
    }
  }

  if (databaseWriteError && !order) {
    return res.status(503).json({ success: false, message: 'Unable to save your choice right now. Please try again.' });
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
    order.updated_at = new Date().toISOString();
    inMemoryOrders.set(id, order);
  }

  const updatedOrder = formatOrderResponse({
    ...(dbOrder || {}),
    ...(order || {}),
    id,
    status: 'OUT_OF_STOCK',
    outOfStockItems: normalizedOutOfStockItems,
    customer_resolution: resolution,
    customer_resolution_status: 'PENDING_ASSISTANT',
    customer_replacements: customerReplacements,
  });
  realtimeEmitter.emit('order_update', { ...updatedOrder, type: 'CUSTOMER_OUT_OF_STOCK_CHOICE' });

  return res.status(200).json({
    success: true,
    message: resolution === 'REFUND' ? 'Refund request sent to the assistant.' : 'Replacement choice sent to the assistant.',
    data: updatedOrder,
  });
});

/**
 * Customer / User Flow Cancel Order Endpoint
 * PATCH /api/user-flow/orders/:id/cancel
 */
router.patch('/user-flow/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    let currentStatus = null;
    let orderInMemory = inMemoryOrders.get(id);
    if (orderInMemory) {
      currentStatus = orderInMemory.status;
    } else {
      try {
        const { rows } = await query(`SELECT status FROM orders WHERE id = $1`, [id]);
        if (rows.length > 0) {
          currentStatus = rows[0].status;
        }
      } catch (e) {}
    }

    const normCurrent = normalizeFlowStatus(currentStatus);
    const nonCancellableStatuses = ['PREPARING', 'COOKING', 'IN_PREPARATION', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'OUT_OF_STOCK'];

    if (nonCancellableStatuses.includes(normCurrent)) {
      return res.status(400).json({
        success: false,
        message: 'Order is already being prepared in the kitchen and cannot be cancelled.',
      });
    }

    if (orderInMemory) {
      orderInMemory.status = 'CANCELLED';
      orderInMemory.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, orderInMemory);
    }

    try {
      await query(`UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Order ${id} has been cancelled successfully.`,
    });
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
    let currentStatus = null;
    let orderInMemory = inMemoryOrders.get(id);
    if (orderInMemory) currentStatus = orderInMemory.status;
    else {
      try {
        const { rows } = await query(`SELECT status FROM orders WHERE id = $1`, [id]);
        if (rows.length > 0) currentStatus = rows[0].status;
      } catch (e) {}
    }

    const normCurrent = normalizeFlowStatus(currentStatus);
    const nonCancellableStatuses = ['PREPARING', 'COOKING', 'IN_PREPARATION', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'OUT_OF_STOCK'];
    if (nonCancellableStatuses.includes(normCurrent)) {
      return res.status(400).json({
        success: false,
        message: 'Order is already being prepared in the kitchen and cannot be cancelled.',
      });
    }

    if (orderInMemory) {
      orderInMemory.status = 'CANCELLED';
      orderInMemory.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, orderInMemory);
    }
    try {
      await query(`UPDATE orders SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Order ${id} cancelled successfully`,
    });
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

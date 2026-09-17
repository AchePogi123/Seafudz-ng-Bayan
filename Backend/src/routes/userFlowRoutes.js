import { Router } from 'express';
import { query } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';
import { handleAssistantStatusUpdate } from './assistantRoutes.js';
import { handleKitchenStatusUpdate } from './kitchenRoutes.js';
import { handleRiderStatusUpdate, handleDeleteOrder } from './riderRoutes.js';
import { handleCreateCustomerFlowOrder, handleGetCustomerFlowOrder } from './orderRoutes.js';

const router = Router();

// Online customer endpoints
router.post('/user-flow/orders', handleCreateCustomerFlowOrder);
router.get('/user-flow/orders/:id', handleGetCustomerFlowOrder);

/**
 * Common GET /api/user-flow/orders
 * Returns all active orders in the central backend store (used by all roles)
 */
router.get('/user-flow/orders', async (req, res) => {
  try {
    const { status } = req.query;

    // Fetch DB orders if available
    let dbOrders = [];
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

      if (!mergedMap.has(row.id)) {
        mergedMap.set(row.id, formatOrderResponse(row));
      } else {
        const existing = mergedMap.get(row.id);
        mergedMap.set(row.id, {
          ...existing,
          status: normalizeFlowStatus(existing.status || row.status),
        });
      }
    });

    let allOrders = Array.from(mergedMap.values());

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

/**
 * Common PATCH /api/user-flow/orders/:id/status
 * Central Status Transition router: Delegates logic to respective role controllers
 */
router.patch('/user-flow/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const targetNorm = normalizeFlowStatus(status);

  // Delegate based on role responsible for the status transition:
  if (targetNorm === 'CONFIRMED' || targetNorm === 'FLAGGED' || targetNorm === 'PENDING') {
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

// Common DELETE and cancel cleanup routes (handled by Rider deletion controller)
router.delete(['/user-flow/orders/:id', '/kitchen/orders/:id'], handleDeleteOrder);

export default router;

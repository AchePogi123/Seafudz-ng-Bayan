import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';

const router = Router();

// GET /api/kitchen/orders - Get active kitchen order tickets
router.get('/kitchen/orders', optionalAuth, async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             o.order_type, o.status AS order_status,
             COALESCE(ko.status, o.status) AS status,
             o.notes, o.created_at, o.updated_at,
             t.name AS table_name,
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
                   'name', COALESCE(oi.product_name_snapshot, p.name)
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN kitchen_orders ko ON o.id = ko.order_id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE UPPER(COALESCE(ko.status, o.status)) IN (
        'CONFIRMED', 'PENDING_PREPARATION', 'IN_KITCHEN', 
        'IN_PROCESS', 'COOKING', 'PREPARING', 'READY', 'PREPARED', 'COMPLETED'
      ) OR (
        UPPER(COALESCE(ko.status, o.status)) = 'PENDING' AND LOWER(COALESCE(o.order_type, '')) NOT LIKE '%delivery%'
      ) OR (
        UPPER(o.status) = 'CONFIRMED' AND UPPER(COALESCE(ko.status, 'PENDING')) = 'PENDING'
      )
      GROUP BY o.id, ko.status, t.name
      ORDER BY o.created_at ASC
    `;
    let dbOrders = [];
    try {
      const { rows } = await query(sql);
      dbOrders = rows;
    } catch (dbErr) {
      /* ignore DB errors */
    }

    const mergedMap = new Map();
    dbOrders.forEach((row) => {
      mergedMap.set(row.id, row);
    });

    const validKitchenStatuses = [
      'CONFIRMED', 'PENDING_PREPARATION', 'IN_KITCHEN', 
      'IN_PROCESS', 'COOKING', 'PREPARING', 'READY', 'PREPARED', 'COMPLETED'
    ];

    inMemoryOrders.forEach((order, id) => {
      const normStatus = normalizeFlowStatus(order.status);
      if (
        validKitchenStatuses.includes(normStatus) || 
        (normStatus === 'PENDING' && String(order.order_type || '').toLowerCase() !== 'online')
      ) {
        const existing = mergedMap.get(id) || {};
        mergedMap.set(id, {
          id: id,
          order_type: order.order_type || existing.order_type || 'ONLINE',
          status: normStatus,
          order_status: normStatus,
          notes: order.notes || existing.notes || '',
          created_at: order.created_at || existing.created_at || new Date().toISOString(),
          updated_at: order.updated_at || existing.updated_at || new Date().toISOString(),
          table_name: existing.table_name || null,
          items: order.items || existing.items || [],
        });
      }
    });

    const finalOrders = Array.from(mergedMap.values());

    return res.status(200).json({
      success: true,
      count: finalOrders.length,
      data: finalOrders,
    });
  } catch (error) {
    console.error('Error fetching kitchen orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve kitchen tickets',
      error: error.message,
    });
  }
});

// PATCH /api/kitchen/orders/:id/status - Update ticket status
router.patch('/kitchen/orders/:id/status', optionalAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROCESS', 'PREPARING', 'COOKING', 'READY', 'COMPLETED', 'CANCELLED'];
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'READY';

    // Update in-memory store if present
    let memoryUpdated = false;
    if (inMemoryOrders.has(id)) {
      const order = inMemoryOrders.get(id);
      order.status = finalStatus;
      order.updatedAt = new Date().toISOString();
      inMemoryOrders.set(id, order);
      memoryUpdated = true;
    } else {
      for (const [k, v] of inMemoryOrders.entries()) {
        if (v.id === id || v.ref === id || k === id) {
          v.status = finalStatus;
          v.updatedAt = new Date().toISOString();
          inMemoryOrders.set(k, v);
          memoryUpdated = true;
        }
      }
    }

    // Try updating DB kitchen_orders & orders
    let dbUpdated = false;
    let updatedRow = null;
    try {
      await query(`
        INSERT INTO kitchen_orders (order_id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (order_id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [id, finalStatus]);

      const sql = `
        UPDATE orders
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const { rows } = await query(sql, [finalStatus, id]);
      if (rows.length > 0) {
        dbUpdated = true;
        updatedRow = rows[0];
      }
    } catch (dbErr) {
      /* DB fallback silent */
    }

    if (!dbUpdated && !memoryUpdated) {
      // Create/update in inMemoryOrders as fallback
      inMemoryOrders.set(id, { id, ref: id, status: finalStatus, updatedAt: new Date().toISOString() });
    }

    emitOrderUpdate(formatOrderResponse(updatedRow || { id, status: finalStatus }));

    return res.status(200).json({
      success: true,
      message: `Kitchen ticket '${id}' updated to ${finalStatus}`,
      data: updatedRow || { id, status: finalStatus },
    });
  } catch (error) {
    console.error('Error updating kitchen order status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update kitchen ticket status',
      error: error.message,
    });
  }
});

// DELETE /api/kitchen/orders/:id - Cancel/remove ticket
router.delete('/kitchen/orders/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE kitchen_orders
      SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
      WHERE order_id = $1
    `, [id]);

    const sql = `
      UPDATE orders
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    await query(sql, [id]);

    return res.status(200).json({
      success: true,
      message: `Kitchen ticket '${id}' updated to cancelled`,
    });
  } catch (error) {
    console.error('Error deleting kitchen order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete kitchen ticket',
      error: error.message,
    });
  }
});


// PATCH /api/kitchen/orders/:id/flag-out-of-stock - Kitchen flags items as unavailable
router.patch('/kitchen/orders/:id/flag-out-of-stock', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const { itemIds } = req.body; // Array of order_item IDs that are out of stock

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of item IDs (itemIds) that are out of stock.',
    });
  }

  let flaggedItems = [];

  // 1. Try DB update if available
  try {
    const pool = await getDbPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const itemIdsAsText = itemIds.map(String);
      const flagResult = await client.query(
        `UPDATE order_items SET item_status = 'OUT_OF_STOCK'
         WHERE order_id = $1 AND (
           id::text = ANY($2::text[])
           OR product_id = ANY($2::text[])
           OR LOWER(product_name_snapshot) = ANY(SELECT LOWER(x) FROM unnest($2::text[]) AS x)
         )
         RETURNING id, product_id, product_name_snapshot, unit_price, quantity`,
        [id, itemIdsAsText]
      );
      await client.query(
        `UPDATE orders
         SET status = 'OUT_OF_STOCK', customer_resolution = NULL,
             customer_resolution_status = 'AWAITING_CUSTOMER', customer_replacements = '[]'::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
      await client.query(
        `INSERT INTO kitchen_orders (order_id, status, updated_at)
         VALUES ($1, 'OUT_OF_STOCK', NOW())
         ON CONFLICT (order_id) DO UPDATE SET status = 'OUT_OF_STOCK', updated_at = NOW()`,
        [id]
      );
      await client.query('COMMIT');

      if (flagResult.rows && flagResult.rows.length > 0) {
        flaggedItems = flagResult.rows.map(r => ({
          id: r.id,
          productId: r.product_id,
          name: r.product_name_snapshot,
          price: parseFloat(r.unit_price),
          quantity: r.quantity,
        }));
      }
    } catch (dbErr) {
      try { await client.query('ROLLBACK'); } catch {}
      console.warn('DB note (flag-out-of-stock):', dbErr.message);
    } finally {
      client.release();
    }
  } catch (poolErr) {
    console.warn('DB pool note (flag-out-of-stock):', poolErr.message);
  }

  // 2. Always update inMemoryOrders
  let order = inMemoryOrders.get(id) || { id, items: [] };
  order.status = 'OUT_OF_STOCK';
  order.customerResolution = null;
  order.customer_resolution = null;
  order.customerResolutionStatus = 'AWAITING_CUSTOMER';
  order.customer_resolution_status = 'AWAITING_CUSTOMER';
  order.customerReplacements = [];
  order.customer_replacements = [];
  order.updated_at = new Date().toISOString();

  if (Array.isArray(order.items)) {
    const memoryFlaggedItems = order.items.filter((item, idx) => {
      const match = itemIds.includes(item.id) || itemIds.includes(String(item.id)) || itemIds.includes(idx) || itemIds.includes(String(idx));
      if (match) item.item_status = 'OUT_OF_STOCK';
      return match;
    });
    if (flaggedItems.length === 0) {
      flaggedItems = memoryFlaggedItems.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
      }));
    }
  }

  order.outOfStockItems = flaggedItems;
  inMemoryOrders.set(id, order);

  // 3. Emit real-time SSE update
  const updatedOrder = formatOrderResponse(order);
  emitOrderUpdate({
    ...updatedOrder,
    type: 'OUT_OF_STOCK_FLAGGED',
    outOfStockItems: flaggedItems,
  });

  const flaggedItemNames = flaggedItems.map(i => i.name);
  console.log(`[KITCHEN] Order ${id} flagged OUT_OF_STOCK — Items: ${flaggedItemNames.join(', ')}`);

  return res.status(200).json({
    success: true,
    message: `Order #${id} flagged as out of stock. Assistant and customer have been notified.`,
    data: {
      orderId: id,
      flaggedItems,
      orderStatus: 'OUT_OF_STOCK',
    },
  });
});

/**
 * Handles status updates triggered by the Kitchen role
 * Transitions: CONFIRMED -> PREPARING -> READY
 */
export async function handleKitchenStatusUpdate(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const nextStatus = normalizeFlowStatus(status);
    let updatedOrder = null;

    if (inMemoryOrders.has(id)) {
      const existing = inMemoryOrders.get(id);
      existing.status = nextStatus;
      existing.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, existing);
      updatedOrder = formatOrderResponse(existing);
    }

    // Update PostgreSQL Database
    try {
      const { rows } = await query(
        `INSERT INTO orders (id, status, created_at) VALUES ($2, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
         RETURNING *`,
        [nextStatus, id]
      );
      
      // Keep kitchen_orders table in sync
      let dbKitchenStatus = 'PENDING';
      if (nextStatus === 'PREPARING') dbKitchenStatus = 'IN_PROCESS';
      else if (nextStatus === 'READY') dbKitchenStatus = 'COMPLETED';

      await query(
        `INSERT INTO kitchen_orders (order_id, status, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [id, dbKitchenStatus]
      );

      if (rows.length > 0 && !updatedOrder) {
        updatedOrder = formatOrderResponse(rows[0]);
      }
    } catch (dbErr) {
      console.warn('DB update note (Kitchen Flow):', dbErr.message);
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

    console.log(`[KITCHEN] Order ${id} -> Status: ${nextStatus}`);

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${nextStatus} by Kitchen`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error in Kitchen status update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status in Kitchen flow',
      error: error.message,
    });
  }
}

export default router;

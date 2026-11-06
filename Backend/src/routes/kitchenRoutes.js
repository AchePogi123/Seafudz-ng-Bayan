import { Router } from 'express';
import { query, getDbPool } from '../config/db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/authMiddleware.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';
import { restoreOrderRemainingServings } from '../utils/servingsDeduction.js';

const router = Router();

// GET /api/kitchen/orders - Get active kitchen order tickets
router.get('/kitchen/orders', optionalAuth, async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.customer_id, o.cashier_id, o.assistant_id, o.table_id,
             o.order_type, COALESCE(o.fulfillment_type, 'DELIVERY') AS fulfillment_type, o.status AS order_status,
             COALESCE(ko.status, o.status) AS status,
             o.notes, o.created_at, o.updated_at,
             t.name AS table_name,
             COALESCE(NULLIF(c.fullname, ''), 'Customer') AS customer_name,
             c.phone AS customer_phone,
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
                   'name', COALESCE(oi.product_name_snapshot, p.name),
                   'item_status', oi.item_status,
                   'remaining_servings', p.remaining_servings,
                   'remainingServings', p.remaining_servings
                 )
               ) FILTER (WHERE oi.id IS NOT NULL AND oi.item_status NOT IN ('REPLACED', 'REFUNDED', 'CANCELLED')), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN kitchen_orders ko ON o.id = ko.order_id
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE (
        UPPER(COALESCE(ko.status, o.status)) IN (
          'CONFIRMED', 'PENDING_PREPARATION', 'IN_KITCHEN', 
          'IN_PROCESS', 'COOKING', 'PREPARING', 'READY', 'PREPARED', 'COMPLETED'
        ) OR (
          UPPER(COALESCE(ko.status, o.status)) = 'PENDING' 
          AND LOWER(COALESCE(o.order_type, '')) NOT LIKE '%delivery%'
          AND LOWER(COALESCE(o.order_type, '')) NOT LIKE '%online%'
        ) OR (
          UPPER(o.status) = 'CONFIRMED' AND UPPER(COALESCE(ko.status, 'PENDING')) = 'PENDING'
        )
      )
      AND UPPER(COALESCE(ko.status, o.status)) NOT IN ('AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED', 'APPROVED_BY_KITCHEN')
      AND UPPER(o.status) NOT IN ('AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED', 'APPROVED_BY_KITCHEN')
      AND COALESCE(o.kitchen_approval_status, 'APPROVED') != 'PENDING'
      GROUP BY o.id, ko.status, t.name, c.fullname, c.phone
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
      const isPendingApproval = normStatus === 'AWAITING_KITCHEN_APPROVAL'
        || normStatus === 'KITCHEN_REJECTED'
        || order.kitchen_approval_status === 'PENDING'
        || order.kitchenApprovalStatus === 'PENDING'
        || (order.requires_kitchen_approval === true && order.kitchen_approval_status !== 'APPROVED')
        || (order.requiresKitchenApproval === true && order.kitchenApprovalStatus !== 'APPROVED');

      if (isPendingApproval || normStatus === 'APPROVED_BY_KITCHEN') {
        return;
      }

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
          customer_name: order.customer_name || order.customer || order.customerName || existing.customer_name || 'Customer',
          customer_phone: order.customer_phone || order.phone || existing.customer_phone || '',
          customer: order.customer || order.customer_name || order.customerName || existing.customer_name || 'Customer',
          created_at: order.created_at || existing.created_at || new Date().toISOString(),
          updated_at: order.updated_at || existing.updated_at || new Date().toISOString(),
          table_name: existing.table_name || null,
          items: (order.items || existing.items || []).filter((i) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase())),
        });
      }
    });

    const finalOrders = Array.from(mergedMap.values()).map((ord) => ({
      ...ord,
      customer: ord.customer_name || ord.customer || 'Customer',
      customer_name: ord.customer_name || ord.customer || 'Customer',
    }));

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

    // Strictly enforce: orders requiring Kitchen quantity approval CANNOT be moved to cooking queue
    let currentStatus = null;
    let approvalStatus = null;
    let foundOrder = inMemoryOrders.get(id);
    if (!foundOrder) {
      for (const [k, v] of inMemoryOrders.entries()) {
        if (v.id === id || v.ref === id || k === id) {
          foundOrder = v;
          break;
        }
      }
    }
    if (foundOrder) {
      currentStatus = normalizeFlowStatus(foundOrder.status);
      approvalStatus = foundOrder.kitchen_approval_status || foundOrder.kitchenApprovalStatus;
    }

    try {
      const { rows } = await query(`SELECT status, kitchen_approval_status FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0) {
        currentStatus = normalizeFlowStatus(rows[0].status);
        approvalStatus = rows[0].kitchen_approval_status || approvalStatus;
      }
    } catch {}

    if (currentStatus === 'AWAITING_KITCHEN_APPROVAL' || approvalStatus === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Order requires Kitchen quantity approval before it can enter the kitchen preparation queue.',
      });
    }

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

      let dbKitchenStatus = 'PENDING';
      if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(finalStatus)) {
        dbKitchenStatus = 'IN_PROCESS';
      } else if (['READY', 'COMPLETED', 'SERVED'].includes(finalStatus)) {
        dbKitchenStatus = 'COMPLETED';
      } else if (finalStatus === 'CANCELLED') {
        dbKitchenStatus = 'CANCELLED';
      } else if (finalStatus === 'OUT_OF_STOCK') {
        dbKitchenStatus = 'OUT_OF_STOCK';
      }

      await query(`
        INSERT INTO kitchen_orders (order_id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (order_id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
      `, [id, dbKitchenStatus]);
    } catch (dbErr) {
      console.warn('DB update note (Kitchen Status Route):', dbErr.message);
    }

    if (updatedRow) {
      const existing = inMemoryOrders.get(id) || {};
      inMemoryOrders.set(id, {
        ...existing,
        ...updatedRow,
        status: finalStatus,
        updated_at: new Date().toISOString(),
      });
    } else if (!memoryUpdated) {
      const existing = inMemoryOrders.get(id) || {};
      inMemoryOrders.set(id, {
        ...existing,
        id,
        ref: id,
        status: finalStatus,
        updatedAt: new Date().toISOString(),
      });
    }

    const payload = formatOrderResponse(updatedRow || inMemoryOrders.get(id) || { id, status: finalStatus });
    emitOrderUpdate(payload);

    return res.status(200).json({
      success: true,
      message: `Kitchen ticket '${id}' updated to ${finalStatus}`,
      data: payload,
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

      // Check if any of the items being flagged have kitchen estimated servings set
      const estCheck = await client.query(
        `SELECT oi.id, oi.product_id, COALESCE(oi.product_name_snapshot, p.name) AS product_name, p.remaining_servings
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 AND (
           oi.id::text = ANY($2::text[])
           OR oi.product_id = ANY($2::text[])
           OR LOWER(oi.product_name_snapshot) = ANY(SELECT LOWER(x) FROM unnest($2::text[]) AS x)
         ) AND p.remaining_servings IS NOT NULL`,
        [id, itemIdsAsText]
      );

      if (estCheck.rows && estCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        const dishNames = estCheck.rows.map(r => r.product_name).join(', ');
        return res.status(400).json({
          success: false,
          code: 'ESTIMATED_SERVING_CANNOT_BE_OOS',
          message: `Cannot flag '${dishNames}' as out of stock because the kitchen already set an estimated serving for this dish.`,
        });
      }

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

      if (flagResult.rows && flagResult.rows.length > 0) {
        flaggedItems = flagResult.rows.map(r => ({
          id: r.id,
          productId: r.product_id,
          name: r.product_name_snapshot,
          price: parseFloat(r.unit_price),
          quantity: r.quantity,
        }));

        const prodIds = flaggedItems.map(r => r.productId).filter(Boolean);
        const prodNames = flaggedItems.map(r => r.name).filter(Boolean);
        if (prodIds.length > 0 || prodNames.length > 0) {
          await client.query(
            `UPDATE products SET is_available = FALSE, updated_at = NOW()
             WHERE id::text = ANY($1::text[])
                OR LOWER(name) = ANY(SELECT LOWER(x) FROM unnest($2::text[]) AS x)`,
            [prodIds, prodNames]
          );
        }
      }
      await client.query('COMMIT');
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

  if (Array.isArray(order.items)) {
    const hasEst = order.items.some((item, idx) => {
      const match = itemIds.includes(item.id) || itemIds.includes(String(item.id)) || itemIds.includes(idx) || itemIds.includes(String(idx));
      const serv = item.remaining_servings ?? item.remainingServings;
      return match && serv !== null && serv !== undefined;
    });
    if (hasEst) {
      return res.status(400).json({
        success: false,
        code: 'ESTIMATED_SERVING_CANNOT_BE_OOS',
        message: 'Cannot flag this item as out of stock because the kitchen already set an estimated serving for this dish.',
      });
    }
  }

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

  // Automatically broadcast catalog availability change to all clients
  if (flaggedItems.length > 0) {
    for (const item of flaggedItems) {
      if (item.productId) {
        emitOrderUpdate({
          type: 'PRODUCT_AVAILABILITY_CHANGED',
          productId: String(item.productId),
          isAvailable: false,
          timestamp: Date.now(),
        });
      }
    }
  }

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

    // Strictly enforce: orders requiring Kitchen quantity approval CANNOT be moved to cooking queue
    let currentStatus = null;
    let approvalStatus = null;
    let foundOrder = inMemoryOrders.get(id);
    if (!foundOrder) {
      for (const [k, v] of inMemoryOrders.entries()) {
        if (v.id === id || v.ref === id || k === id) {
          foundOrder = v;
          break;
        }
      }
    }
    if (foundOrder) {
      currentStatus = normalizeFlowStatus(foundOrder.status);
      approvalStatus = foundOrder.kitchen_approval_status || foundOrder.kitchenApprovalStatus;
    }

    try {
      const { rows } = await query(`SELECT status, kitchen_approval_status FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0) {
        currentStatus = normalizeFlowStatus(rows[0].status);
        approvalStatus = rows[0].kitchen_approval_status || approvalStatus;
      }
    } catch {}

    if (currentStatus === 'AWAITING_KITCHEN_APPROVAL' || approvalStatus === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Order requires Kitchen quantity approval before it can enter the kitchen preparation queue.',
      });
    }

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
      let rows;
      const updateRes = await query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [nextStatus, id]
      );
      rows = updateRes.rows;
      if (rows.length === 0) {
        const insertRes = await query(
          `INSERT INTO orders (id, order_type, status, created_at, updated_at) VALUES ($2, 'ONLINE', $1, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
           RETURNING *`,
          [nextStatus, id]
        );
        rows = insertRes.rows;
      }
      
      // Keep kitchen_orders table in sync
      let dbKitchenStatus = 'PENDING';
      if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(nextStatus)) dbKitchenStatus = 'IN_PROCESS';
      else if (['READY', 'COMPLETED', 'SERVED'].includes(nextStatus)) dbKitchenStatus = 'COMPLETED';
      else if (nextStatus === 'OUT_OF_STOCK') dbKitchenStatus = 'OUT_OF_STOCK';
      else if (nextStatus === 'CANCELLED') dbKitchenStatus = 'CANCELLED';

      await query(
        `INSERT INTO kitchen_orders (order_id, status, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [id, dbKitchenStatus]
      );

      if (rows.length > 0) {
        const existing = inMemoryOrders.get(id) || {};
        const enriched = {
          ...existing,
          ...rows[0],
          status: nextStatus,
          updated_at: new Date().toISOString(),
        };
        inMemoryOrders.set(id, enriched);
        updatedOrder = formatOrderResponse(enriched);
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

// GET /api/kitchen/approvals - Get orders requiring quantity approval
router.get('/kitchen/approvals', optionalAuth, async (req, res) => {
  try {
    let dbOrders = [];
    try {
      const { rows } = await query(`
        SELECT o.id, o.order_type, o.status, o.subtotal, o.tax AS vat, o.delivery_fee, o.total, o.notes,
               o.requires_kitchen_approval, o.kitchen_approval_status, o.created_at, o.updated_at,
               c.fullname AS customer_name, c.phone AS customer_phone,
               COALESCE(d.delivery_address, c.delivery_address) AS delivery_address,
               COALESCE(o.payment_method, 'ONLINE') AS payment_method,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'product_id', oi.product_id,
                     'name', oi.product_name_snapshot,
                     'quantity', oi.quantity,
                     'price', oi.unit_price,
                     'item_status', oi.item_status
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
        WHERE (UPPER(o.status) = 'AWAITING_KITCHEN_APPROVAL' OR UPPER(o.kitchen_approval_status) = 'PENDING')
          AND UPPER(COALESCE(o.kitchen_approval_status, '')) != 'APPROVED'
          AND UPPER(COALESCE(o.kitchen_approval_status, '')) != 'REJECTED'
          AND UPPER(o.status) NOT IN ('KITCHEN_REJECTED', 'CANCELLED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'APPROVED_BY_KITCHEN')
        GROUP BY o.id, c.fullname, c.phone, c.delivery_address, d.delivery_address
        ORDER BY o.created_at ASC
      `);
      dbOrders = rows;
    } catch (dbErr) {
      console.warn('DB note (kitchen approvals):', dbErr.message);
    }

    const mergedMap = new Map();
    dbOrders.forEach((row) => {
      mergedMap.set(row.id, formatOrderResponse(row));
    });

    inMemoryOrders.forEach((order, id) => {
      const norm = normalizeFlowStatus(order.status);
      const appSt = String(order.kitchen_approval_status || order.kitchenApprovalStatus || '').toUpperCase();
      if (appSt === 'APPROVED' || appSt === 'REJECTED') {
        return;
      }
      if (['KITCHEN_REJECTED', 'CANCELLED', 'GCASH_AUTHORIZED', 'PENDING_COD', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'APPROVED_BY_KITCHEN'].includes(norm)) {
        return;
      }

      const isPending = norm === 'AWAITING_KITCHEN_APPROVAL'
        || appSt === 'PENDING'
        || (order.requires_kitchen_approval === true && appSt !== 'APPROVED')
        || (order.requiresKitchenApproval === true && appSt !== 'APPROVED');

      if (isPending) {
        mergedMap.set(id, formatOrderResponse(order));
      }
    });

    const approvalOrders = Array.from(mergedMap.values());
    return res.status(200).json({
      success: true,
      count: approvalOrders.length,
      data: approvalOrders,
    });
  } catch (error) {
    console.error('Error fetching kitchen approval orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve kitchen approvals',
      error: error.message,
    });
  }
});

// PATCH /api/kitchen/orders/:id/approve-quantities - Kitchen approves quantity accommodation
router.patch('/kitchen/orders/:id/approve-quantities', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let order = inMemoryOrders.get(id);

    // Fetch DB record if available
    let dbOrder = null;
    try {
      const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0) dbOrder = rows[0];
    } catch {}

    if (!order && !dbOrder) {
      for (const [k, v] of inMemoryOrders.entries()) {
        if (
          String(k).toLowerCase() === String(id).toLowerCase() ||
          String(v?.ref || '').toLowerCase() === String(id).toLowerCase() ||
          String(v?.id || '').toLowerCase() === String(id).toLowerCase()
        ) {
          order = v;
          break;
        }
      }
    }

    const isPos = Boolean(
      order?.isPosOrder ||
      order?.is_pos_order ||
      String(id).startsWith('POS-') ||
      dbOrder?.order_type === 'ON_SITE' ||
      String(order?.orderType || order?.order_type || '').toUpperCase().includes('ON_SITE') ||
      String(order?.type || '').toUpperCase().includes('DINE') ||
      String(order?.type || '').toUpperCase().includes('TAKE')
    );
    const rawMethod = String(order?.payment_method || order?.paymentMethod || dbOrder?.payment_method || 'GCASH').toUpperCase();
    const isCod = rawMethod.includes('COD') || rawMethod === 'CASH';
    // Kitchen quantity approval automatically permits customer to pay without requiring assistant authorization
    // For POS on-site orders, routes to APPROVED_BY_KITCHEN so cashier can collect payment and print receipt
    const nextStatus = isPos ? 'APPROVED_BY_KITCHEN' : (isCod ? 'PENDING_COD' : 'GCASH_AUTHORIZED');

    if (!order && !dbOrder) {
      const fallbackRecord = {
        id,
        ref: id,
        status: nextStatus,
        gcashAuthorized: !isCod,
        gcash_authorized: !isCod,
        kitchenApprovalStatus: 'APPROVED',
        kitchen_approval_status: 'APPROVED',
        kitchen_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryOrders.set(id, fallbackRecord);
      emitOrderUpdate({ ...fallbackRecord, type: 'KITCHEN_QUANTITY_APPROVED' });
      return res.status(200).json({
        success: true,
        message: isPos
          ? `Quantities approved for POS Order #${id}. Cashier may now collect payment and print official receipt.`
          : `Quantities approved for Order #${id}. Customer is now automatically permitted to proceed to payment (${isCod ? 'COD Confirmation' : 'GCash'}).`,
        data: fallbackRecord,
      });
    }

    // Update in-memory order
    if (order) {
      order.status = nextStatus;
      order.gcashAuthorized = !isCod;
      order.gcash_authorized = !isCod;
      order.kitchenApprovalStatus = 'APPROVED';
      order.kitchen_approval_status = 'APPROVED';
      order.kitchen_approved_at = new Date().toISOString();
      order.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, order);
    }

    // Update DB record
    try {
      await query(
        `UPDATE orders
         SET status = $1,
             kitchen_approval_status = 'APPROVED',
             kitchen_approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [nextStatus, id]
      );
    } catch (dbErr) {
      console.warn('DB note (kitchen approve quantities):', dbErr.message);
    }

    const formatted = formatOrderResponse(order || { ...(dbOrder || {}), status: nextStatus, gcashAuthorized: !isCod, gcash_authorized: !isCod, kitchen_approval_status: 'APPROVED' });
    emitOrderUpdate({ ...formatted, type: 'KITCHEN_QUANTITY_APPROVED' });

    console.log(`[KITCHEN] Approved quantity standard for Order #${id} -> Routed to ${nextStatus} (Automatically permitted to pay)`);

    return res.status(200).json({
      success: true,
      message: isPos
        ? `Quantities approved for POS Order #${id}. Cashier may now collect payment and print official receipt.`
        : `Quantities approved for Order #${id}. Customer is now automatically permitted to proceed to payment (${isCod ? 'COD Confirmation' : 'GCash'}).`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error approving order quantities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve order quantities',
      error: error.message,
    });
  }
});

// PATCH /api/kitchen/orders/:id/reject-quantities - Kitchen declines order capacity
router.patch('/kitchen/orders/:id/reject-quantities', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    let order = inMemoryOrders.get(id);

    let dbOrder = null;
    try {
      const { rows } = await query(`SELECT * FROM orders WHERE id = $1`, [id]);
      if (rows.length > 0) dbOrder = rows[0];
    } catch {}

    if (!order && !dbOrder) {
      for (const [k, v] of inMemoryOrders.entries()) {
        if (
          String(k).toLowerCase() === String(id).toLowerCase() ||
          String(v?.ref || '').toLowerCase() === String(id).toLowerCase() ||
          String(v?.id || '').toLowerCase() === String(id).toLowerCase()
        ) {
          order = v;
          break;
        }
      }
    }

    const rejectionReason = reason || 'Order exceeds kitchen preparation capacity at this time.';

    if (!order && !dbOrder) {
      const fallbackRecord = {
        id,
        ref: id,
        status: 'KITCHEN_REJECTED',
        kitchenApprovalStatus: 'REJECTED',
        kitchen_approval_status: 'REJECTED',
        rejectionReason,
        kitchen_rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      inMemoryOrders.set(id, fallbackRecord);
      emitOrderUpdate({ ...fallbackRecord, type: 'KITCHEN_QUANTITY_REJECTED' });
      return res.status(200).json({
        success: true,
        message: `Order #${id} was declined due to kitchen capacity constraints.`,
        data: fallbackRecord,
      });
    }

    // Update in-memory order
    if (order) {
      order.status = 'KITCHEN_REJECTED';
      order.kitchenApprovalStatus = 'REJECTED';
      order.kitchen_approval_status = 'REJECTED';
      order.rejectionReason = rejectionReason;
      order.kitchen_rejected_at = new Date().toISOString();
      order.updated_at = new Date().toISOString();
      inMemoryOrders.set(id, order);
    }

    // Update DB record
    try {
      await query(
        `UPDATE orders
         SET status = 'KITCHEN_REJECTED',
             kitchen_approval_status = 'REJECTED',
             kitchen_rejected_at = NOW(),
             notes = COALESCE(NULLIF($2, ''), notes),
             updated_at = NOW()
         WHERE id = $1`,
        [id, `[DECLINED BY KITCHEN: ${rejectionReason}]`]
      );
    } catch (dbErr) {
      console.warn('DB note (kitchen reject quantities):', dbErr.message);
    }

    // Restore any deducted remaining servings if order is declined
    try {
      const pool = await getDbPool();
      const client = await pool.connect();
      try {
        await restoreOrderRemainingServings(client, id);
      } finally {
        client.release();
      }
    } catch (restoreErr) {
      console.warn('Note restoring servings on kitchen reject:', restoreErr.message);
    }

    const formatted = formatOrderResponse(order || { ...(dbOrder || {}), status: 'KITCHEN_REJECTED', kitchen_approval_status: 'REJECTED', rejectionReason });
    emitOrderUpdate({ ...formatted, type: 'KITCHEN_QUANTITY_REJECTED' });

    console.log(`[KITCHEN] Rejected Order #${id} capacity -> Status: KITCHEN_REJECTED`);

    return res.status(200).json({
      success: true,
      message: `Order #${id} was declined due to kitchen capacity constraints.`,
      data: formatted,
    });
  } catch (error) {
    console.error('Error rejecting order quantities:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to decline order',
      error: error.message,
    });
  }
});

export default router;

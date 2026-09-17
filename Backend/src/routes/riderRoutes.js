import { Router } from 'express';
import { query } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';

const router = Router();

// GET /api/rider/deliveries - Get active delivery jobs
router.get('/rider/deliveries', async (req, res) => {
  try {
    const sql = `
      SELECT o.id, o.order_type, o.status AS order_status, o.total, o.created_at,
             d.id AS delivery_id, d.delivery_address, COALESCE(d.status, 'PENDING') AS status,
             c.fullname AS customer_name, c.phone AS customer_phone,
             e.fullname AS rider_name, d.rider_id,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'menu_item_id', oi.product_id,
                   'product_id', oi.product_id,
                   'quantity', oi.quantity,
                   'unit_price', oi.unit_price,
                   'subtotal', oi.subtotal,
                   'name', COALESCE(oi.product_name_snapshot, p.name)
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) AS "items"
      FROM orders o
      LEFT JOIN deliveries d ON o.id = d.order_id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN employees e ON d.rider_id = e.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE UPPER(o.order_type) = 'ONLINE' OR d.id IS NOT NULL
      GROUP BY o.id, d.id, d.delivery_address, d.status, d.rider_id, c.fullname, c.phone, e.fullname
      ORDER BY o.created_at DESC
    `;
    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching rider deliveries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve delivery jobs',
      error: error.message,
    });
  }
});

// PATCH /api/rider/deliveries/:id/status - Update delivery status
router.patch('/rider/deliveries/:id/status', async (req, res) => {
  try {
    const { status, employeeId } = req.body;
    const { id } = req.params;

    const normalizedStatus = (status || '').toUpperCase();
    const validStatuses = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'ASSIGNED';

    let delSql = `
      INSERT INTO deliveries (order_id, delivery_address, status, rider_id, updated_at)
      VALUES ($1, 'Standard Delivery Address', $2, $3, NOW())
      ON CONFLICT (order_id) DO UPDATE SET
        status = EXCLUDED.status,
        rider_id = COALESCE(EXCLUDED.rider_id, deliveries.rider_id),
        updated_at = NOW()
      RETURNING *
    `;
    const { rows } = await query(delSql, [id, finalStatus, employeeId || null]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Delivery order '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Delivery '${id}' status updated to ${finalStatus}`,
      data: rows[0],
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update delivery status',
      error: error.message,
    });
  }
});

/**
 * Handles status updates triggered by the Rider role
 * Transitions: READY -> OUT_FOR_DELIVERY -> COMPLETED
 */
export async function handleRiderStatusUpdate(req, res) {
  try {
    const { id } = req.params;
    const { status, riderName } = req.body;

    const nextStatus = normalizeFlowStatus(status);
    let updatedOrder = null;

    if (inMemoryOrders.has(id)) {
      const existing = inMemoryOrders.get(id);
      existing.status = nextStatus;
      existing.updated_at = new Date().toISOString();
      if (riderName) existing.riderName = riderName;
      inMemoryOrders.set(id, existing);
      updatedOrder = formatOrderResponse(existing);
    }

    // Update PostgreSQL Database
    try {
      const { rows } = await query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [nextStatus, id]
      );
      
      // Update deliveries status in DB
      let dbDeliveryStatus = 'PENDING';
      if (nextStatus === 'OUT_FOR_DELIVERY') dbDeliveryStatus = 'IN_TRANSIT';
      else if (nextStatus === 'COMPLETED') dbDeliveryStatus = 'DELIVERED';

      await query(
        `UPDATE deliveries SET status = $1, updated_at = NOW() WHERE order_id = $2`,
        [dbDeliveryStatus, id]
      );

      if (rows.length > 0 && !updatedOrder) {
        updatedOrder = formatOrderResponse(rows[0]);
      }
    } catch (dbErr) {
      console.warn('DB update note (Rider Flow):', dbErr.message);
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

    console.log(`🏍️ [Rider Flow] Order ${id} -> Status: ${nextStatus}`);

    return res.status(200).json({
      success: true,
      message: `Order ${id} status updated to ${nextStatus} by Rider`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error in Rider status update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status in Rider flow',
      error: error.message,
    });
  }
}

/**
 * Remove order from memory and database
 */
export async function handleDeleteOrder(req, res) {
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
      console.warn('DB delete note (Rider Flow Cleanup):', dbErr.message);
    }

    console.log(`🗑️ [Rider Flow] Removed order ${id}`);

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
}

export default router;

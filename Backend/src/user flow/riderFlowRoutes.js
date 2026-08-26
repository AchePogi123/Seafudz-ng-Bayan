import { query } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';

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

import { query } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';

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

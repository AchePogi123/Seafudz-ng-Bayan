import { query } from '../config/db.js';
import { inMemoryOrders, normalizeFlowStatus, formatOrderResponse } from './sharedFlowStore.js';

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
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
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

    console.log(`🍳 [Kitchen Flow] Order ${id} -> Status: ${nextStatus}`);

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

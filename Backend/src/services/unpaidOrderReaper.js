/**
 * Gives ingredients back when an order is placed but never paid.
 *
 * Orders reserve stock the moment they are placed, so an abandoned pay-in-store or
 * GCash order would otherwise hold ingredients forever. This is OFF unless you set:
 *   UNPAID_ORDER_HOLD_MINUTES        minutes before an unpaid GCash order (no receipt yet) is cancelled
 *   PAY_IN_STORE_HOLD_MINUTES        minutes before a pay-in-store order is cancelled (default: same value x3)
 * Orders that already have a receipt waiting for the assistant are never touched.
 */
import { query } from '../config/db.js';
import { inMemoryOrders } from '../routes/sharedFlowStore.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';
import { releaseOrderStock, withTransaction } from './inventoryService.js';

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function cancelStaleOrders(gcashMinutes, storeMinutes) {
  const { rows } = await query(
    `SELECT o.id, o.status FROM orders o
      WHERE o.created_at IS NOT NULL
        AND (
          (o.status IN ('GCASH_AUTHORIZED', 'RECEIPT_REJECTED') AND o.created_at < NOW() - ($1 || ' minutes')::interval)
          OR (o.status IN ('PAY_IN_STORE', 'PENDING_STORE_PICKUP') AND o.created_at < NOW() - ($2 || ' minutes')::interval)
        )
        AND EXISTS (SELECT 1 FROM order_inventory_ledger l WHERE l.order_id = o.id AND l.state = 'RESERVED')
        AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'PAID')`,
    [String(gcashMinutes), String(storeMinutes)]
  );

  for (const { id } of rows) {
    try {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE orders SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, NOW()), updated_at = NOW() WHERE id = $1`,
          [id]
        );
        await client.query(`UPDATE kitchen_orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1`, [id]);
        await client.query(`UPDATE order_items SET item_status = 'CANCELLED' WHERE order_id = $1 AND item_status <> 'CANCELLED'`, [id]);
      });
      await releaseOrderStock(id, { reason: `Order ${id} expired unpaid`, performedBy: 'System' });
      const cached = inMemoryOrders.get(id);
      if (cached) {
        cached.status = 'CANCELLED';
        cached.updated_at = new Date().toISOString();
        inMemoryOrders.set(id, cached);
      }
      emitOrderUpdate({ id, status: 'CANCELLED', type: 'ORDER_UPDATE', timestamp: Date.now() });
      console.log(`[INVENTORY] Order ${id} expired unpaid; ingredients returned to stock.`);
    } catch (err) {
      console.error(`[INVENTORY] Could not expire order ${id}:`, err.message);
    }
  }
  return rows.length;
}

export function startUnpaidOrderReaper() {
  const gcash = Number(process.env.UNPAID_ORDER_HOLD_MINUTES);
  if (!Number.isFinite(gcash) || gcash <= 0) return null;
  const store = Number(process.env.PAY_IN_STORE_HOLD_MINUTES);
  const storeMinutes = Number.isFinite(store) && store > 0 ? store : gcash * 3;

  console.log(`[INVENTORY] Unpaid orders are released after ${gcash} min (GCash) / ${storeMinutes} min (pay in store).`);
  const timer = setInterval(() => {
    cancelStaleOrders(gcash, storeMinutes).catch((err) => console.error('[INVENTORY] Expiry check failed:', err.message));
  }, CHECK_EVERY_MS);
  timer.unref?.();
  return timer;
}

export { cancelStaleOrders };

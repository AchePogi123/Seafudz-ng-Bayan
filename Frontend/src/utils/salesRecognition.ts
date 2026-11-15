/**
 * Single source of truth for "which orders count as sales".
 *
 * A transaction is only recognised as revenue once it is actually finished and the
 * money is settled. Everything still moving through the flow (PENDING, CONFIRMED,
 * PREPARING, READY, OUT_FOR_DELIVERY, …) is work in progress, not income, and
 * everything that ended without a sale (CANCELLED, KITCHEN_REJECTED, …) never
 * becomes income at all.
 *
 * Mirrors `REVENUE_RECOGNIZED_STATUSES` in `Backend/src/routes/sharedFlowStore.js`.
 */
export const REVENUE_RECOGNIZED_STATUSES = ['COMPLETED', 'DELIVERED', 'SERVED'] as const

/** True when this order's total belongs in sales figures. */
export function isRevenueRecognized(status: unknown): boolean {
  const normalized = String(status ?? '').toUpperCase().trim()
  return (REVENUE_RECOGNIZED_STATUSES as readonly string[]).includes(normalized)
}

/** Any order-ish record, whichever field shape it happens to carry its status in. */
export interface OrderStatusCarrier {
  status?: unknown
  orderStatus?: unknown
  order_status?: unknown
}

/** Reads an order's status from whichever field shape the record happens to use. */
export function readOrderStatus(order: OrderStatusCarrier | null | undefined): string {
  if (!order) return ''
  const raw = order.status ?? order.orderStatus ?? order.order_status
  return String(raw ?? '').toUpperCase().trim()
}

/** True when the order record counts toward sales totals. */
export function countsAsSale(order: OrderStatusCarrier | null | undefined): boolean {
  return isRevenueRecognized(readOrderStatus(order))
}

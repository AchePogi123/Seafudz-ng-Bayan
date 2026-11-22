/**
 * Who actually gave the money back.
 *
 * Cancelling a paid order does not finish it. The food is off the menu, the kitchen ticket is
 * dead, but the customer's money is still in the restaurant's hands until a named member of staff
 * hands it over: the assistant transfers it back by GCash, or the cashier counts it out at the
 * counter. A sales report that shows such an order as merely "Cancelled" hides an open liability,
 * so every cancelled transaction carries its payout alongside it — its state, its amount, who
 * returned it, in what form, when, and the proof they recorded.
 *
 * Mirrors `summarizeRefunds` in `Backend/src/routes/sharedFlowStore.js`, which derives the same
 * three states from the authoritative `refunds` ledger.
 */

/** The three states a cancelled transaction's money can be in. */
export type RefundState =
  /** Nothing was ever owed: the order was cancelled before any money came in. */
  | 'NONE'
  /** Money is owed and still in the till — nobody has handed it back yet. */
  | 'PENDING'
  /** It was returned, by the person named, in the form recorded. */
  | 'COMPLETED'

export interface RefundAccountability {
  state: RefundState
  amount: number
  /** Name of the staff member who handed the money back, once it has been. */
  by?: string
  /** Their role at the time: assistant, cashier or admin. */
  byRole?: string
  /**
   * How it went back: CASH (over the counter, no screenshot to show), GCASH / MAYA (transferred,
   * so a screenshot or reference is the proof), or HYBRID when the order was split across both.
   */
  method?: string
  /** When the payout was recorded. */
  at?: string
  /** Screenshot of the GCash reversal, when there is one. */
  receipt?: string
  /** Typed reference number for the reversal, when there is one. */
  reference?: string
}

const str = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return undefined
}

/** True when this order ended without a sale, whichever way it got there. */
export function isCancelledOrder(status?: unknown): boolean {
  const s = String(status ?? '').toUpperCase().trim()
  return s === 'CANCELLED' || s === 'CANCEL_REQUESTED' || s === 'KITCHEN_REJECTED'
}

/**
 * Reads the refund payout off an order record, whichever field shape it arrived in — the REST
 * list sends snake_case columns, the realtime feed and local cache send the camelCase formatter's
 * output, and an order that still carries its raw `refunds` rows is read from those directly.
 */
export function readRefundAccountability(order: any): RefundAccountability {
  if (!order) return { state: 'NONE', amount: 0 }

  // Raw ledger rows win when present: they are what the backend itself summarises.
  const rows: any[] = Array.isArray(order.refunds) ? order.refunds.filter(Boolean) : []
  if (rows.length > 0) {
    const stamp = (r: any) => new Date(r.completed_at ?? r.completedAt ?? r.created_at ?? r.createdAt ?? 0).getTime()
    const of = (state: string) => rows
      .filter((r) => String(r.status ?? '').toUpperCase() === state)
      .sort((a, b) => stamp(b) - stamp(a))
    const completed = of('COMPLETED')
    const pending = of('PENDING')
    const chosen = completed[0] ?? pending[0]
    if (chosen) {
      const group = completed.length > 0 ? completed : pending
      const total = group.reduce((t, r) => t + (parseFloat(r.amount) || 0), 0)
      return {
        state: completed.length > 0 ? 'COMPLETED' : 'PENDING',
        amount: Math.round(total * 100) / 100,
        by: completed.length > 0 ? str(chosen.processed_by, chosen.processedBy) : undefined,
        byRole: completed.length > 0 ? str(chosen.processed_by_role, chosen.processedByRole) : undefined,
        method: str(chosen.refund_method, chosen.refundMethod),
        at: completed.length > 0 ? str(chosen.completed_at, chosen.completedAt) : undefined,
        receipt: str(chosen.refund_receipt, chosen.refundReceipt, order.refundReceipt, order.refund_receipt),
        reference: str(chosen.reference_number, chosen.referenceNumber, order.refundReference, order.refund_reference),
      }
    }
  }

  const rawState = String(order.refundStatus ?? order.refund_status ?? '').toUpperCase().trim()
  const state: RefundState = rawState === 'COMPLETED' || rawState === 'PENDING' ? rawState : 'NONE'
  const amountRaw = order.refundAmount ?? order.refund_amount
  const settled = state === 'COMPLETED'

  return {
    state,
    amount: Math.round((parseFloat(String(amountRaw ?? 0)) || 0) * 100) / 100,
    by: settled ? str(order.refundedBy, order.refunded_by) : undefined,
    byRole: settled ? str(order.refundedByRole, order.refunded_by_role) : undefined,
    method: str(order.refundMethod, order.refund_method),
    at: settled ? str(order.refundedAt, order.refunded_at) : undefined,
    receipt: str(order.refundReceipt, order.refund_receipt),
    reference: str(order.refundReference, order.refund_reference),
  }
}

/** "Assistant Mia Cruz", "Cashier", or undefined when the payout predates this record-keeping. */
export function refundActorLabel(refund: RefundAccountability): string | undefined {
  if (refund.state !== 'COMPLETED') return undefined
  const role = refund.byRole ? refund.byRole.charAt(0).toUpperCase() + refund.byRole.slice(1).toLowerCase() : undefined
  if (refund.by && role) return `${role} ${refund.by}`
  return refund.by || role
}

/** How the money went back, in words the register can print. */
export function refundMethodLabel(refund: RefundAccountability): string {
  const m = (refund.method || '').toUpperCase()
  if (m === 'CASH') return 'Cash over the counter'
  if (m === 'GCASH') return 'GCash transfer'
  if (m === 'MAYA') return 'Maya transfer'
  if (m === 'HYBRID') return 'Split — part cash, part transfer'
  return m ? m : 'Not recorded'
}

/** One line stating where this cancelled transaction's money stands. */
export function refundSummaryLine(refund: RefundAccountability): string {
  if (refund.state === 'NONE') return 'Cancelled before payment — nothing was owed'
  if (refund.state === 'PENDING') return 'Money not returned yet — still owed to the customer'
  const actor = refundActorLabel(refund)
  return actor ? `Returned by ${actor}` : 'Returned, but nobody is recorded as having paid it out'
}

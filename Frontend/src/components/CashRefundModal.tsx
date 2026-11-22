import React, { useEffect, useState } from 'react'

export interface CashRefundModalProps {
  isOpen: boolean
  orderId: string | null
  orderType?: string
  /** What the customer paid and is therefore owed back. */
  amount?: number
  /** The cashier on shift — a cash payout is only a record if it carries a name. */
  staffName?: string
  staffRole?: string
  isSubmitting?: boolean
  error?: string | null
  onClose: () => void
  onConfirm: (details: { note?: string }) => void
}

/**
 * Handing cash back over the counter.
 *
 * A cancelled order that was paid for is not finished: the money is still in the drawer and the
 * ingredients are still off the shelf. There is no screenshot to attach to a cash refund, so the
 * record is the named cashier stating that they counted it out — which is what closes the order,
 * puts the stock back, and appears against the transaction in the sales report.
 */
export const CashRefundModal: React.FC<CashRefundModalProps> = ({
  isOpen,
  orderId,
  orderType = 'On-Site Order',
  amount = 0,
  staffName,
  staffRole = 'cashier',
  isSubmitting = false,
  error = null,
  onClose,
  onConfirm,
}) => {
  const [handedBack, setHandedBack] = useState(false)
  const [note, setNote] = useState('')

  // Each order gets its own confirmation; never inherit the last one's tick.
  useEffect(() => {
    if (isOpen) {
      setHandedBack(false)
      setNote('')
    }
  }, [isOpen, orderId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !orderId) return null

  const peso = `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const roleLabel = staffRole ? staffRole.charAt(0).toUpperCase() + staffRole.slice(1).toLowerCase() : 'Staff'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-refund-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/65"
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden animate-fade-in">
        <div className="bg-amber-500 text-white px-5 py-4">
          <h3 id="cash-refund-title" className="text-base font-bold leading-tight">
            Return the customer's cash
          </h3>
          <p className="text-xs font-medium text-amber-50/90 mt-0.5">
            Order #{orderId} · {orderType}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Amount to hand back
            </span>
            <span className="text-3xl font-bold tracking-tight text-amber-950">{peso}</span>
          </div>

          <p className="text-xs font-medium leading-relaxed text-neutral-600">
            This order is cancelled but not closed. Count the cash out of the drawer and give it to
            the customer, then confirm below — that is what settles the transaction and puts the
            order's ingredients back into inventory.
          </p>

          <label className="flex items-start gap-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={handedBack}
              onChange={(e) => setHandedBack(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-600"
            />
            <span className="text-xs font-semibold text-neutral-800 leading-relaxed">
              I counted out {peso} and handed it back to the customer.
              {staffName ? (
                <span className="block mt-0.5 text-[11px] font-medium text-neutral-500">
                  Recorded against {roleLabel} {staffName}.
                </span>
              ) : (
                <span className="block mt-0.5 text-[11px] font-semibold text-rose-600">
                  No signed-in staff name found — sign in again so this payout can be attributed.
                </span>
              )}
            </span>
          </label>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
              Reference or note <span className="font-semibold normal-case text-neutral-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. drawer slip #12, customer signed"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Not yet
            </button>
            <button
              type="button"
              disabled={isSubmitting || !handedBack || !staffName}
              onClick={() => onConfirm({ note: note.trim() || undefined })}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-md shadow-amber-600/20 active:scale-95 cursor-pointer disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? 'Recording…' : 'Cash returned'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

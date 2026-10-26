import React from 'react'

export interface CancelConfirmModalProps {
  isOpen: boolean
  orderId: string | null
  orderType?: string
  total?: number
  onClose: () => void
  onConfirm: () => void
  isCancelling?: boolean
}

export const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  isOpen,
  orderId,
  orderType = 'On-Site Order',
  total,
  onClose,
  onConfirm,
  isCancelling = false,
}) => {
  if (!isOpen || !orderId) return null

  return (
    /* Minimal Pop Up Overlay - NO backdrop-blur to prevent lag */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/65"
    >
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 text-center space-y-4 animate-fade-in text-neutral-800">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl border border-rose-200 shadow-2xs">
          ⚠️
        </div>

        {/* Modal Titles */}
        <div>
          <h3
            id="cancel-modal-title"
            className="text-lg font-black text-neutral-900 tracking-tight"
          >
            Are you sure you want to cancel?
          </h3>
          <p className="text-xs text-neutral-500 font-medium mt-1 leading-relaxed">
            Cancelling order <strong className="text-neutral-800">#{orderId}</strong> will stop the kitchen ticket and mark this order as cancelled.
          </p>
        </div>

        {/* Order Details Pill */}
        <div className="py-2.5 px-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs font-semibold text-neutral-600 flex justify-between items-center">
          <span>{orderType}</span>
          {total !== undefined && (
            <span className="font-black text-neutral-900">
              ₱{Number(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={isCancelling}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            No, Keep Order
          </button>
          <button
            type="button"
            disabled={isCancelling}
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isCancelling ? (
              <>
                <span className="animate-spin text-xs">⏳</span>
                <span>Cancelling...</span>
              </>
            ) : (
              <>
                <span>❌</span>
                <span>Yes, Cancel</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import type { CartItem } from './OrderItemRow'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (cashReceived: string, change: number | null, paymentMethod: string) => void
  orderDetails: {
    table: string
    type: string
    total: number
    cartItems: CartItem[]
  } | null
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, onConfirm, orderDetails }) => {
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GCash' | 'Hybrid'>('Cash')
  const [cashReceived, setCashReceived] = useState<string>('')
  
  // Hybrid split inputs
  const [hybridCash, setHybridCash] = useState<string>('')
  const [hybridEwallet, setHybridEwallet] = useState<string>('')
  const [hybridWalletType, setHybridWalletType] = useState<'GCash' | 'Maya'>('GCash')

  const totalAmount = orderDetails ? Math.round(orderDetails.total) : 0

  // Reset inputs when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setCashReceived('')
        setHybridCash('')
        setHybridEwallet('')
        setHybridWalletType('GCash')
        setPaymentMethod('Cash')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Calculate change derived from cashReceived and totalAmount for pure Cash
  const change = useMemo(() => {
    if (paymentMethod === 'Cash') {
      const cash = parseFloat(cashReceived)
      if (!isNaN(cash) && cash >= totalAmount) {
        return cash - totalAmount
      }
    }
    return null
  }, [paymentMethod, cashReceived, totalAmount])

  // Hybrid split calculation
  const parsedHybridCash = parseFloat(hybridCash) || 0
  const parsedHybridEwallet = parseFloat(hybridEwallet) || 0
  const hybridTotalEntered = parsedHybridCash + parsedHybridEwallet
  const hybridBalanceRemaining = Math.max(0, totalAmount - hybridTotalEntered)
  const isHybridComplete = Math.abs(hybridTotalEntered - totalAmount) < 0.01

  if (!isOpen || !orderDetails) return null

  const handlePresetClick = (amount: number) => {
    setCashReceived(amount.toString())
  }

  const handleConfirm = () => {
    if (paymentMethod === 'Hybrid') {
      const hybridLabel = `Hybrid (Cash ₱${parsedHybridCash.toLocaleString()} + ${hybridWalletType} ₱${parsedHybridEwallet.toLocaleString()})`
      onConfirm(parsedHybridCash.toString(), 0, hybridLabel)
    } else {
      onConfirm(cashReceived, change, paymentMethod)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-neutral-100 flex flex-col relative animate-scale-up max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Check Icon Badge */}
        <div className="w-14 h-14 bg-emerald-100/70 rounded-full flex items-center justify-center mb-3 mx-auto mt-1">
          <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Header Title */}
        <h2 className="text-2xl font-black text-neutral-900 text-center tracking-tight">Order Confirmed!</h2>
        <p className="text-xs text-neutral-400 font-semibold mt-1 text-center">
          Order #A123 • {orderDetails.type}
        </p>

        {/* Payment Method Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-neutral-100/70 p-1.5 rounded-2xl my-5 border border-neutral-100">
          {(['Cash', 'GCash', 'Hybrid'] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`py-2 text-[11px] font-extrabold rounded-xl transition-all cursor-pointer ${
                paymentMethod === method
                  ? method === 'Hybrid'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-orange-500 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {method === 'Hybrid' ? 'Hybrid' : method}
            </button>
          ))}
        </div>

        {/* Hybrid Split Payment Box */}
        {paymentMethod === 'Hybrid' && (
          <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-purple-900 tracking-wider uppercase flex items-center gap-1.5">
                HYBRID SPLIT PAYMENT
              </h3>
              <span className="text-[11px] font-bold text-neutral-500">
                Target: <strong className="text-purple-700 font-black">₱{totalAmount.toLocaleString()}</strong>
              </span>
            </div>

            {/* Split Input Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Cash Portion */}
              <div>
                <label className="block text-[10px] font-bold text-purple-900/60 uppercase tracking-wider mb-1">
                  Cash Amount
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-neutral-400 font-bold text-xs">₱</span>
                  <input
                    type="number"
                    value={hybridCash}
                    onChange={(e) => setHybridCash(e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-2.5 py-2 text-xs font-black text-neutral-900 bg-white border border-purple-200 rounded-xl focus:outline-none focus:border-purple-600 transition-all placeholder-neutral-300"
                  />
                </div>
              </div>

              {/* E-Wallet Portion */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-purple-900/60 uppercase tracking-wider">
                    E-Wallet Amount
                  </label>
                  <select
                    value={hybridWalletType}
                    onChange={(e) => setHybridWalletType(e.target.value as 'GCash' | 'Maya')}
                    className="text-[10px] font-extrabold text-purple-700 bg-purple-100/80 px-1 py-0.5 rounded outline-none cursor-pointer"
                  >
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                  </select>
                </div>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-neutral-400 font-bold text-xs">₱</span>
                  <input
                    type="number"
                    value={hybridEwallet}
                    onChange={(e) => setHybridEwallet(e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-2.5 py-2 text-xs font-black text-neutral-900 bg-white border border-purple-200 rounded-xl focus:outline-none focus:border-purple-600 transition-all placeholder-neutral-300"
                  />
                </div>
              </div>
            </div>

            {/* Split Status indicator */}
            <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-neutral-600">
                Split Total: <strong>₱{hybridTotalEntered.toLocaleString()}</strong> / ₱{totalAmount.toLocaleString()}
              </span>
              {isHybridComplete ? (
                <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
                  Exactly balanced
                </span>
              ) : (
                <span className="text-[11px] font-black text-rose-600">
                  {hybridTotalEntered < totalAmount
                    ? `Remaining: ₱${hybridBalanceRemaining.toLocaleString()}`
                    : `Over by: ₱${(hybridTotalEntered - totalAmount).toLocaleString()}`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Cash Calculator Box */}
        {paymentMethod === 'Cash' && (
          <div className="bg-amber-50/40 border border-amber-100/90 rounded-2xl p-4 sm:p-4.5 mb-5 space-y-3.5">
            <h3 className="text-[11px] font-black text-amber-900 tracking-wider uppercase flex items-center gap-1.5">
              POS CASH CALCULATOR
            </h3>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  CASH RECEIVED
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-neutral-500 font-bold text-xs">₱</span>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-sm font-black text-neutral-900 bg-white border border-amber-200 rounded-xl focus:outline-none focus:border-orange-500 transition-all placeholder-neutral-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                  CHANGE DUE
                </label>
                <div className="bg-white border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400">₱</span>
                  <span className="text-sm font-black text-emerald-600">
                    {change !== null ? `₱${Math.round(change).toLocaleString()}` : '₱0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
                Quick:
              </span>
              {[
                totalAmount,
                Math.ceil(totalAmount / 50) * 50,
                Math.ceil(totalAmount / 100) * 100,
                Math.ceil(totalAmount / 500) * 500,
                Math.ceil(totalAmount / 1000) * 1000,
              ]
                .filter((v, i, a) => a.indexOf(v) === i && v >= totalAmount)
                .slice(0, 4)
                .map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetClick(amt)}
                    className="px-3 py-1.5 bg-white border border-neutral-200 hover:border-orange-500 rounded-xl text-xs font-bold text-neutral-700 transition-all hover:bg-orange-50/30 active:scale-95 cursor-pointer shadow-2xs"
                  >
                    ₱{amt}
                  </button>
                ))}
              </div>

            {/* Alert for Insufficient cash */}
            {cashReceived && change === null && parseFloat(cashReceived) < totalAmount && (
              <p className="text-[11px] font-bold text-red-600 flex items-center gap-1 pt-1">
                Cash received is less than total amount (₱{totalAmount.toLocaleString()})
              </p>
            )}
          </div>
        )}

        {/* Location & Details Card */}
        <div className="bg-neutral-50/90 rounded-2xl p-4 sm:p-4.5 w-full mb-4 border border-neutral-100 space-y-2.5">
          <div className="flex justify-between text-xs font-bold text-neutral-500">
            <span>Location</span>
            <span className="text-neutral-900 font-bold">{orderDetails.table}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-neutral-500">
            <span>Items Ordered</span>
            <span className="text-neutral-900 font-bold">
              {orderDetails.cartItems.reduce((acc, curr) => acc + curr.quantity, 0)} items
            </span>
          </div>
          <div className="pt-2.5 border-t border-neutral-200/60 flex justify-between items-center font-bold text-emerald-600">
            <span className="text-xs font-bold">Amount Paid</span>
            <span className="text-base font-black">₱{totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Items Breakdown List */}
        <div className="w-full max-h-[140px] overflow-y-auto mb-5 pr-1 space-y-2 custom-scrollbar border-b border-neutral-100 pb-3">
          {orderDetails.cartItems.map((cartItem) => (
            <div key={cartItem.item.id} className="flex justify-between items-center text-xs text-neutral-600 font-medium">
              <span className="truncate max-w-[220px]">
                {cartItem.item.name} <span className="font-bold text-neutral-400">x{cartItem.quantity}</span>
              </span>
              <span className="font-bold text-neutral-900">
                ₱{(cartItem.item.price * cartItem.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            type="button"
            className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3.5 px-4 rounded-2xl transition-all active:scale-98 cursor-pointer text-center text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              (paymentMethod === 'Cash' && cashReceived !== '' && parseFloat(cashReceived) < totalAmount) ||
              (paymentMethod === 'Hybrid' && !isHybridComplete)
            }
            className={`flex-2 text-white font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-98 cursor-pointer text-center text-sm shadow-md ${
              (paymentMethod === 'Cash' && cashReceived !== '' && parseFloat(cashReceived) < totalAmount) ||
              (paymentMethod === 'Hybrid' && !isHybridComplete)
                ? 'bg-neutral-300 cursor-not-allowed shadow-none'
                : paymentMethod === 'Hybrid'
                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25'
                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25'
            }`}
          >
            {paymentMethod === 'Hybrid' ? 'Confirm Hybrid & Print' : 'Confirm & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { OrderItemRow } from './OrderItemRow'
import type { CartItem } from './OrderItemRow'

interface OrderSummaryProps {
  cartItems: CartItem[]
  orderType: string
  setOrderType: (type: string) => void
  orderNotes: string
  setOrderNotes: (notes: string) => void
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onRemove: (itemId: string) => void
  onConfirmOrder: () => void
  onClose?: () => void
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  cartItems,
  orderType,
  setOrderType,
  orderNotes,
  setOrderNotes,
  onIncrement,
  onDecrement,
  onRemove,
  onConfirmOrder,
  onClose,
}) => {
  // Calculations
  const rawSubtotal = cartItems.reduce((acc, item) => acc + item.item.price * item.quantity, 0)
  const vatAmount = rawSubtotal * 0.12 // 12% VAT
  const total = rawSubtotal + vatAmount

  return (
    <aside className="bg-white rounded-2xl p-5 sm:p-6 text-neutral-900 flex flex-col h-full shadow-2xs border border-neutral-200/80 transition-all">
      {/* Header */}
      <div className="mb-4 sm:mb-5 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
            Order Summary
          </h2>
          <p className="text-xs text-neutral-400 font-medium mt-0.5">Terminal #01 • Order #A123</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-neutral-400 hover:text-neutral-700 bg-neutral-100 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close drawer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Selectors - Single Full Width Container */}
      <div className="mb-4 flex-shrink-0">
        <div>
          <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Type
          </label>
          <div className="relative">
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className="w-full bg-neutral-50 hover:bg-neutral-100/80 text-neutral-800 rounded-xl px-3 py-2 text-xs font-semibold appearance-none border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
            >
              <option value="Take Out">Take Out</option>
              <option value="Dine In">Dine In</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items List */}
      <div className="flex-1 flex flex-col min-h-0 mb-3">
        <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Items ({cartItems.reduce((a, b) => a + b.quantity, 0)})
          </label>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[120px]">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
              <svg className="w-7 h-7 text-neutral-300 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-xs text-neutral-400 font-medium select-none">Cart is empty</p>
            </div>
          ) : (
            cartItems.map((cartItem) => (
              <OrderItemRow
                key={cartItem.item.id}
                cartItem={cartItem}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                onRemove={onRemove}
              />
            ))
          )}
        </div>
      </div>

      {/* Always Visible Special Note Input */}
      <div className="mb-3 flex-shrink-0">
        <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
          Special Note / Kitchen Instruction
        </label>
        <textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          placeholder="e.g. Extra spicy, no garlic, less oil..."
          rows={2}
          className="w-full bg-neutral-50 hover:bg-neutral-100/80 text-neutral-800 rounded-xl p-2.5 text-xs font-medium border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
        />
      </div>

      {/* Pricing Summary Card & Confirm Button */}
      <div className="space-y-3 flex-shrink-0 pt-2 border-t border-neutral-100">
        <div className="space-y-1.5 text-xs font-medium text-neutral-500">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-neutral-700">₱{rawSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>VAT (12%)</span>
            <span className="font-semibold text-neutral-700">₱{Math.round(vatAmount).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between font-bold text-neutral-900 text-base pt-2 border-t border-neutral-100">
            <span>Total</span>
            <span className="text-lg text-orange-600">₱{Math.round(total).toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={onConfirmOrder}
          disabled={cartItems.length === 0}
          className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-5 rounded-xl transition-all shadow-2xs active:scale-[0.99] cursor-pointer text-center text-sm"
        >
          Confirm Order
        </button>
      </div>
    </aside>
  )
}
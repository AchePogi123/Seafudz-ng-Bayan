import React from 'react'
import type { MenuItem } from './MenuCard'

export interface CartItem {
  item: MenuItem
  quantity: number
}

interface OrderItemRowProps {
  cartItem: CartItem
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onRemove: (itemId: string) => void
}

export const OrderItemRow: React.FC<OrderItemRowProps> = ({
  cartItem,
  onIncrement,
  onDecrement,
  onRemove,
}) => {
  const { item, quantity } = cartItem

  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-neutral-100 group transition-all">
      {/* Item info (Image + Name + Unit Price) */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0 border border-neutral-200/60 flex items-center justify-center">
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f3f4f6'/><text y='62' x='20' font-size='45'>🍲</text></svg>";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-neutral-900 text-xs sm:text-sm truncate leading-tight" title={item.name}>
            {item.name}
          </p>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
            ₱{item.price.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Controls & Total Price & Remove Icon */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Quantity Controls (- 1 +) */}
        <div className="flex items-center bg-neutral-100 rounded-lg p-0.5 border border-neutral-200/60">
          <button
            onClick={() => onDecrement(item.id)}
            className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
            title="Decrease quantity"
          >
            -
          </button>
          <span className="w-4 text-center text-xs font-bold text-neutral-900 select-none">
            {quantity}
          </span>
          <button
            onClick={() => onIncrement(item.id)}
            className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
            title="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Total Calculated Price */}
        <span className="font-bold text-neutral-900 text-xs sm:text-sm text-right whitespace-nowrap min-w-[50px]">
          ₱{(item.price * quantity).toLocaleString()}
        </span>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(item.id)}
          className="text-neutral-300 hover:text-red-500 p-1 rounded transition-all cursor-pointer flex-shrink-0"
          title="Remove item"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

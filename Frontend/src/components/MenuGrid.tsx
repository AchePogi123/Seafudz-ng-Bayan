import React from 'react'
import { MenuCard, CLIENT_MENU_ITEMS } from './MenuCard'
import type { MenuItem } from './MenuCard'
import { useMenuAvailability } from '../utils/menuAvailability'
import { useMenuPrices } from '../utils/menuPriceManager'

interface MenuGridProps {
  items?: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  onToggleAvailability?: (item: MenuItem) => void
  showAvailabilityToggle?: boolean
  allowPriceEdit?: boolean
  onUpdatePrice?: (item: MenuItem, newPrice: number) => void
}

export const MenuGrid: React.FC<MenuGridProps> = ({
  items,
  onAddToCart,
  onToggleAvailability,
  showAvailabilityToggle = false,
  allowPriceEdit = false,
  onUpdatePrice,
}) => {
  const { isAvailable, toggleAvailability } = useMenuAvailability()
  const { getEffectivePrice, updatePrice } = useMenuPrices()

  // Use passed items if available; otherwise fallback to the client menu
  const rawItems = items && items.length > 0 ? items : CLIENT_MENU_ITEMS

  // Apply effective custom prices
  const displayItems = rawItems.map((item) => ({
    ...item,
    price: getEffectivePrice(item.id, item.price),
  }))

  const handleToggle = onToggleAvailability
    ? onToggleAvailability
    : (item: MenuItem) => {
      toggleAvailability(item.id)
    }

  const handlePriceUpdate = onUpdatePrice
    ? onUpdatePrice
    : (item: MenuItem, newPrice: number) => {
      updatePrice(item.id, newPrice)
    }

  if (!displayItems || displayItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-neutral-100 shadow-xs">
        <div className="text-5xl mb-4">🔍</div>
        <h3 className="text-base font-bold text-neutral-700">No dishes found</h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-[240px] text-center font-medium">
          We couldn't find anything matching your search query or selected category.
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[calc(100vh-230px)] min-h-[480px] overflow-y-auto pr-1.5 custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 pb-4">
        {displayItems.map((item) => {
          const available = isAvailable(item.id)
          return (
            <div key={item.id} className="h-full">
              <MenuCard
                item={item}
                onAddToCart={onAddToCart}
                isAvailable={available}
                onToggleAvailability={handleToggle}
                showAvailabilityToggle={showAvailabilityToggle}
                allowPriceEdit={allowPriceEdit}
                onUpdatePrice={handlePriceUpdate}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { CLIENT_CATEGORIES, CLIENT_MENU_ITEMS, type MenuItem } from './MenuCard'

export interface PosModifyOrderModalProps {
  isOpen: boolean
  order: any | null
  onClose: () => void
  onSave?: (updatedOrder: any) => void
  menuItems?: MenuItem[]
  isItemAvailable?: (id: string) => boolean
}

export interface EditableItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  item?: MenuItem
}

const KITCHEN_PROCESSING_STATUSES = [
  'PREPARING',
  'COOKING',
  'IN_PROCESS',
  'IN_PREPARATION',
  'READY',
  'PREPARED',
  'READY TO SERVE',
  'COMPLETED',
  'SERVED',
  'DELIVERED',
  'CANCELLED',
]

export const PosModifyOrderModal: React.FC<PosModifyOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onSave,
  menuItems = CLIENT_MENU_ITEMS,
  isItemAvailable = () => true,
}) => {
  const [orderType, setOrderType] = useState<'Dine In' | 'Take Out'>('Take Out')
  const [tableNumber, setTableNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])
  const [liveStatus, setLiveStatus] = useState('CONFIRMED')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Menu Search & Filter for adding dishes
  const [menuCategory, setMenuCategory] = useState('All Menu')
  const [menuSearch, setMenuSearch] = useState('')

  // State for changing an existing dish in the order
  const [changingItemIndex, setChangingItemIndex] = useState<number | null>(null)
  const [selectedReplacementId, setSelectedReplacementId] = useState<string>('')

  // Parse existing order details when modal opens or order changes
  useEffect(() => {
    if (!order || !isOpen) return

    const initialStatus = (order.status || 'CONFIRMED').toUpperCase()
    setLiveStatus(initialStatus)
    setErrorMessage(null)
    setIsSaving(false)
    setChangingItemIndex(null)

    // Dining type & table
    const rawType = (order.type || order.order_type || '').toLowerCase()
    const isDineIn = rawType.includes('dine')
    setOrderType(isDineIn ? 'Dine In' : 'Take Out')
    setTableNumber(order.table || order.table_name || '')

    // Notes
    setNotes(order.notes || '')

    // Parse items safely from cartItems or items
    const parsedItems: EditableItem[] = []
    if (Array.isArray(order.cartItems) && order.cartItems.length > 0) {
      order.cartItems.forEach((ci: any, idx: number) => {
        const pId = String(ci.item?.id || ci.productId || ci.product_id || ci.id || `item-${idx}`)
        const name = ci.item?.name || ci.name || ci.product_name_snapshot || 'Menu Dish'
        const price = Number(ci.item?.price || ci.unit_price || ci.price || 0)
        const qty = Math.max(1, Number(ci.quantity || 1))
        parsedItems.push({
          id: `${pId}-${idx}-${Date.now()}`,
          productId: pId,
          name,
          price,
          quantity: qty,
          item: ci.item,
        })
      })
    } else if (Array.isArray(order.items) && order.items.length > 0) {
      order.items.forEach((it: any, idx: number) => {
        const pId = String(it.product_id || it.productId || it.menu_item_id || it.id || `item-${idx}`)
        const name = it.name || it.product_name_snapshot || 'Menu Dish'
        const price = Number(it.unit_price || it.price || 0)
        const qty = Math.max(1, Number(it.quantity || 1))
        parsedItems.push({
          id: `${pId}-${idx}-${Date.now()}`,
          productId: pId,
          name,
          price,
          quantity: qty,
        })
      })
    } else if (typeof order.items === 'string' && order.items.trim()) {
      // Parse string format e.g. "Mixed Seafoods x2, Rice x1"
      const parts = order.items.split(',')
      parts.forEach((part: string, idx: number) => {
        const match = part.trim().match(/^(.*?)(?:\s+x(\d+))?$/)
        if (match) {
          const rawName = match[1].trim()
          const qty = match[2] ? parseInt(match[2], 10) : 1
          const matchedMenu = menuItems.find(
            (m) => m.name.toLowerCase() === rawName.toLowerCase()
          )
          parsedItems.push({
            id: `str-${idx}-${Date.now()}`,
            productId: matchedMenu ? matchedMenu.id : `legacy-${idx}`,
            name: matchedMenu ? matchedMenu.name : rawName,
            price: matchedMenu ? matchedMenu.price : 0,
            quantity: qty,
            item: matchedMenu,
          })
        }
      })
    }

    setItems(parsedItems)
  }, [order, isOpen, menuItems])

  // Real-time synchronization check: if kitchen starts preparing, update liveStatus immediately
  const checkLiveKitchenStatus = useCallback(() => {
    if (!order) return
    const orderId = order.id || order.ref
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const found = parsed.find((o: any) => o.id === orderId || o.ref === orderId)
        if (found && found.status) {
          const latestStatus = found.status.toUpperCase()
          setLiveStatus(latestStatus)
          if (KITCHEN_PROCESSING_STATUSES.includes(latestStatus)) {
            setErrorMessage(
              `Kitchen has started preparing this order (${latestStatus}). Modifications are locked.`
            )
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [order])

  useEffect(() => {
    if (!isOpen || !order) return
    checkLiveKitchenStatus()
    const unsubscribe = subscribeOrderSync(() => {
      checkLiveKitchenStatus()
    })
    return () => unsubscribe()
  }, [isOpen, order, checkLiveKitchenStatus])

  // Status check: Is the order still in queue or already processing?
  const isCookingOrLater = useMemo(() => {
    return KITCHEN_PROCESSING_STATUSES.includes((liveStatus || '').toUpperCase())
  }, [liveStatus])

  // Dynamic Totals calculation
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const vat = useMemo(() => {
    return Math.round(subtotal * 0.12 * 100) / 100
  }, [subtotal])

  const total = useMemo(() => {
    return Math.round(subtotal + vat)
  }, [subtotal, vat])

  const originalTotal = Number(order?.total || 0)
  const priceDifference = total - originalTotal

  // Filtered menu items for the "Add from Menu" browser
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(menuSearch.toLowerCase())
      const matchesCategory =
        menuCategory === 'All Menu' ||
        item.category.toLowerCase() === menuCategory.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [menuItems, menuSearch, menuCategory])

  // Quantity Steppers
  const handleQuantityIncrement = (index: number) => {
    if (isCookingOrLater) return
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, quantity: item.quantity + 1 } : item
      )
    )
  }

  const handleQuantityDecrement = (index: number) => {
    if (isCookingOrLater) return
    setItems((prev) =>
      prev
        .map((item, idx) => {
          if (idx !== index) return item
          if (item.quantity > 1) {
            return { ...item, quantity: item.quantity - 1 }
          }
          return null
        })
        .filter(Boolean) as EditableItem[]
    )
  }

  const handleRemoveItem = (index: number) => {
    if (isCookingOrLater) return
    if (changingItemIndex === index) {
      setChangingItemIndex(null)
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  // ADD DISH BASED ON MENU
  const handleAddDishFromMenu = (menuItem: MenuItem) => {
    if (isCookingOrLater) return

    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === menuItem.id)
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx
            ? { ...it, quantity: it.quantity + 1 }
            : it
        )
      }
      return [
        ...prev,
        {
          id: `${menuItem.id}-${Date.now()}`,
          productId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          item: menuItem,
        },
      ]
    })
  }

  // CHANGE EXISTING DISH TO ANOTHER DISH FROM MENU
  const startChangeDish = (index: number) => {
    if (isCookingOrLater) return
    setChangingItemIndex(index)
    // Default replacement to current or first available
    const current = items[index]
    setSelectedReplacementId(current ? current.productId : menuItems[0]?.id || '')
  }

  const applyChangeDish = (index: number) => {
    if (isCookingOrLater || !selectedReplacementId) return
    const replacement = menuItems.find((m) => m.id === selectedReplacementId)
    if (!replacement) return

    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it
        return {
          ...it,
          productId: replacement.id,
          name: replacement.name,
          price: replacement.price,
          item: replacement,
        }
      })
    )
    setChangingItemIndex(null)
  }

  // SAVE CHANGES AND UPDATE KITCHEN
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return

    // Live kitchen lock guard
    checkLiveKitchenStatus()
    if (isCookingOrLater) {
      setErrorMessage(
        'Cannot modify order: Kitchen is already preparing this order!'
      )
      return
    }

    if (items.length === 0) {
      setErrorMessage('Order must include at least one dish.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    const orderId = order.id || order.ref

    // Prepare updated cart items format
    const updatedCartItems = items.map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.name,
      unit_price: it.price,
      quantity: it.quantity,
      price: it.price,
      item: it.item || {
        id: it.productId,
        name: it.name,
        price: it.price,
      },
    }))

    const itemsSummary = items
      .map((it) => `${it.name} x${it.quantity}`)
      .join(', ')

    const updatedOrder = {
      ...order,
      id: orderId,
      ref: orderId,
      type: orderType,
      table: orderType === 'Dine In' ? (tableNumber.trim() || 'Dine In') : undefined,
      order_type: orderType === 'Dine In' ? 'DINE_IN' : 'TAKE_OUT',
      notes: notes.trim(),
      cartItems: updatedCartItems,
      items: updatedCartItems, // Store as array for kitchen ticket parsing
      itemsSummary,
      subtotal,
      vat,
      total,
      updated_at: new Date().toISOString(),
    }

    // 1. Sync to Backend API (PUT /orders/:id)
    try {
      const authHeaders = await getAuthHeaders()
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          ...updatedOrder,
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            unit_price: it.price,
          })),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.error === 'ORDER_PROCESSING' || res.status === 400) {
          setErrorMessage(
            data.message ||
              'Order is already cooking in the kitchen and can no longer be edited.'
          )
          setLiveStatus('PREPARING')
          setIsSaving(false)
          return
        }
        console.warn('Backend update order response note:', data)
      }
    } catch (err) {
      console.warn('Network note during order update:', err)
    }

    // 2. Persist in LocalStorage and trigger multi-screen sync (Kitchen & POS)
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) =>
          o.id === orderId || o.ref === orderId ? { ...o, ...updatedOrder } : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      notifyOrderSync()
    } catch (err) {
      console.warn('LocalStorage error during order update:', err)
    }

    setIsSaving(false)
    if (onSave) onSave(updatedOrder)
    onClose()
  }

  if (!isOpen || !order) return null

  const orderId = order.ref || order.id

  return (
    /* Minimal Pop Up Overlay - NO backdrop-blur to avoid lag */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modify-order-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/65"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[94vh] animate-fade-in text-neutral-800">
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✏️</span>
            <div>
              <h2
                id="modify-order-title"
                className="text-base sm:text-lg font-black text-neutral-900 tracking-tight"
              >
                Modify Order #{orderId}
              </h2>
              <p className="text-[11px] text-neutral-400 font-semibold">
                Cashier Terminal • Change or Add Dishes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                isCookingOrLater
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              ● {isCookingOrLater ? 'Cooking (Locked)' : 'In Kitchen Queue'}
            </span>

            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-xl hover:bg-neutral-100 transition-colors font-bold text-base cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Locked Notification Banner if order moved to cooking */}
          {isCookingOrLater && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-pulse">
              <span className="text-lg">🔒</span>
              <div>
                <p className="font-bold">
                  Order is already on processing in kitchen side ({liveStatus})
                </p>
                <p className="text-[11px] text-rose-600 mt-0.5">
                  Orders already being prepared/cooked in the kitchen can no longer be edited or modified.
                </p>
              </div>
            </div>
          )}

          {errorMessage && !isCookingOrLater && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dining Type & Table */}
          <div className="bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-100 space-y-2">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Dining Option
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isCookingOrLater}
                onClick={() => setOrderType('Take Out')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderType === 'Take Out'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                } ${isCookingOrLater ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                🥡 Take Out
              </button>
              <button
                type="button"
                disabled={isCookingOrLater}
                onClick={() => setOrderType('Dine In')}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  orderType === 'Dine In'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-100'
                } ${isCookingOrLater ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                🍽️ Dine In
              </button>
            </div>

            {orderType === 'Dine In' && (
              <div className="pt-1">
                <input
                  type="text"
                  disabled={isCookingOrLater}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Table number or name (e.g. Table 4)"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 placeholder:text-neutral-400"
                />
              </div>
            )}
          </div>

          {/* Current Ordered Dishes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span>
                <span>Current Order Dishes ({items.length})</span>
              </label>
              <span className="text-[10px] text-neutral-400 font-medium">
                Change dish, adjust qty, or remove
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs text-rose-700 font-bold">
                ⚠️ All dishes removed! Add dishes from the menu below before saving.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((it, idx) => (
                  <div
                    key={it.id || idx}
                    className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-extrabold text-neutral-900 truncate text-xs sm:text-sm">
                          {it.name}
                        </p>
                        <p className="text-[11px] text-neutral-400 font-semibold">
                          ₱{it.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Quantity Stepper */}
                        <div className="flex items-center bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            disabled={isCookingOrLater}
                            onClick={() => handleQuantityDecrement(idx)}
                            className="px-2.5 py-1 text-neutral-600 hover:bg-neutral-100 font-black text-xs cursor-pointer disabled:opacity-40"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="px-2 font-black text-neutral-900 text-xs min-w-[20px] text-center">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={isCookingOrLater}
                            onClick={() => handleQuantityIncrement(idx)}
                            className="px-2.5 py-1 text-neutral-600 hover:bg-neutral-100 font-black text-xs cursor-pointer disabled:opacity-40"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal */}
                        <span className="font-extrabold text-neutral-800 text-xs w-16 text-right">
                          ₱{(it.price * it.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>

                        {/* Change Dish Button */}
                        {!isCookingOrLater && (
                          <button
                            type="button"
                            onClick={() =>
                              changingItemIndex === idx
                                ? setChangingItemIndex(null)
                                : startChangeDish(idx)
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              changingItemIndex === idx
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                            }`}
                            title="Change this dish to another item from the menu"
                          >
                            🔄 Change
                          </button>
                        )}

                        {/* Remove Button */}
                        <button
                          type="button"
                          disabled={isCookingOrLater}
                          onClick={() => handleRemoveItem(idx)}
                          className="text-neutral-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer disabled:opacity-40"
                          title="Remove dish"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Inline Change Dish Dropdown if active for this item */}
                    {changingItemIndex === idx && !isCookingOrLater && (
                      <div className="bg-orange-50/70 p-2 rounded-xl border border-orange-200 space-y-1.5 animate-fade-in">
                        <label className="block text-[10px] font-bold text-orange-900 uppercase tracking-wider">
                          Change "{it.name}" to:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedReplacementId}
                            onChange={(e) => setSelectedReplacementId(e.target.value)}
                            className="flex-1 bg-white px-2.5 py-1.5 rounded-lg border border-orange-200 text-xs font-semibold text-neutral-800 focus:outline-none"
                          >
                            {menuItems.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (₱{m.price})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => applyChangeDish(idx)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-2xs"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => setChangingItemIndex(null)}
                            className="bg-neutral-200 text-neutral-700 font-bold px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ADD DISHES BASED ON MENU SECTION */}
          {!isCookingOrLater && (
            <div className="bg-neutral-50/80 p-3.5 rounded-2xl border border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase text-orange-700 tracking-wider flex items-center gap-1">
                  <span>➕</span>
                  <span>Add Dishes Based On Menu</span>
                </label>
                <span className="text-[10px] text-neutral-400 font-semibold">
                  Click "+ Add" to include in ticket
                </span>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
                {CLIENT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setMenuCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                      menuCategory === cat
                        ? 'bg-orange-500 text-white shadow-2xs'
                        : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Menu Input */}
              <div className="relative">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="🔍 Search dishes by name (e.g., shrimp, rice, drink)..."
                  className="w-full px-3 py-1.5 bg-white rounded-xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 placeholder:text-neutral-400"
                />
                {menuSearch && (
                  <button
                    type="button"
                    onClick={() => setMenuSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 font-bold text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Available Menu Dishes List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredMenuItems.map((menuItem) => {
                  const available = isItemAvailable(menuItem.id)
                  const alreadyInOrder = items.find((it) => it.productId === menuItem.id)

                  return (
                    <div
                      key={menuItem.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        !available
                          ? 'bg-neutral-100 border-neutral-200 opacity-60'
                          : alreadyInOrder
                          ? 'bg-orange-50/60 border-orange-200'
                          : 'bg-white border-neutral-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-neutral-900 truncate text-[11px]">
                          {menuItem.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-black text-orange-600 text-xs">
                            ₱{menuItem.price}
                          </span>
                          {!available && (
                            <span className="text-[9px] font-bold text-rose-600">
                              [Out of Stock]
                            </span>
                          )}
                          {alreadyInOrder && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 rounded">
                              x{alreadyInOrder.quantity} in order
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!available}
                        onClick={() => handleAddDishFromMenu(menuItem)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                          !available
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : alreadyInOrder
                            ? 'bg-orange-600 text-white shadow-2xs hover:bg-orange-700'
                            : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-500 hover:text-white'
                        }`}
                        title={available ? `Add ${menuItem.name} to order` : 'Item out of stock'}
                      >
                        {alreadyInOrder ? '+ Add More' : '+ Add'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Kitchen Notes */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Special Kitchen Instructions
            </label>
            <input
              type="text"
              disabled={isCookingOrLater}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Less spicy, no butter, separate sauce"
              className="w-full px-3 py-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 placeholder:text-neutral-400"
            />
          </div>

          {/* Order Summary & Pricing */}
          <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200/80 space-y-1 text-xs">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span className="font-bold text-neutral-800">
                ₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>VAT (12%)</span>
              <span className="font-bold text-neutral-800">
                ₱{vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1 border-t border-neutral-200 mt-1">
              <span className="font-black text-neutral-900">Updated Total:</span>
              <span className="font-black text-orange-600 text-base">
                ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Price Difference Indicator */}
            {priceDifference !== 0 && (
              <div
                className={`text-[11px] font-black pt-1 flex justify-between ${
                  priceDifference > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                <span>Balance Difference:</span>
                <span>
                  {priceDifference > 0
                    ? `+₱${priceDifference.toFixed(2)} (Collect balance)`
                    : `-₱${Math.abs(priceDifference).toFixed(2)} (Refund balance)`}
                </span>
              </div>
            )}
          </div>
        </form>

        {/* Minimal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-200/70 transition-all cursor-pointer"
          >
            Cancel
          </button>

          {isCookingOrLater ? (
            <button
              type="button"
              disabled
              className="bg-neutral-200 text-neutral-400 font-black px-5 py-2.5 rounded-xl text-xs cursor-not-allowed flex items-center gap-1.5"
            >
              <span>🔒</span> Kitchen Processing (Locked)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin text-xs">⏳</span>
                  <span>Updating Kitchen...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Save & Update Kitchen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

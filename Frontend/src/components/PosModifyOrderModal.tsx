import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { useMenuAvailability, applyProductServingsChange } from '../utils/menuAvailability'
import { CLIENT_CATEGORIES, CLIENT_MENU_ITEMS, type MenuItem } from './MenuCard'
import { checkProductQuantityStandards } from '../utils/bulkOrder'
import { NoticeModal } from './NoticeModal'

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
  const { isAvailable: liveIsAvailable, getRemainingServings } = useMenuAvailability()
  const effectiveIsAvailable = useCallback(
    (id: string) => isItemAvailable(id) && liveIsAvailable(id),
    [isItemAvailable, liveIsAvailable]
  )

  const [orderType, setOrderType] = useState<'Dine In' | 'Take Out'>('Take Out')
  const [tableNumber, setTableNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<EditableItem[]>([])

  const [noticeModal, setNoticeModal] = useState<{ title?: string; message: string } | null>(null)
  const showNotice = useCallback((message: string, title?: string) => {
    setNoticeModal({ message, title: title || 'Notice' })
  }, [])

  const bulkCheck = useMemo(() => {
    return checkProductQuantityStandards(
      items.map((it) => ({
        id: it.productId,
        productId: it.productId,
        name: it.name,
        category: (it as any).category || (it as any).item?.category,
        quantity: it.quantity,
        remaining_servings: getRemainingServings(it.productId),
        remainingServings: getRemainingServings(it.productId),
      }))
    )
  }, [items, getRemainingServings])
  const [liveStatus, setLiveStatus] = useState('CONFIRMED')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Additional Payment States (when customer adds or upgrades dishes)
  const [adjustmentPaymentMethod, setAdjustmentPaymentMethod] = useState<'Cash' | 'GCash' | 'Hybrid'>('Cash')
  const [adjCashReceived, setAdjCashReceived] = useState<string>('')
  const [adjGcashRef, setAdjGcashRef] = useState<string>('')
  const [adjHybridCash, setAdjHybridCash] = useState<string>('')
  const [adjHybridEwallet, setAdjHybridEwallet] = useState<string>('')
  const [adjHybridWalletType, setAdjHybridWalletType] = useState<'GCash' | 'Maya'>('GCash')
  const [adjHybridRef, setAdjHybridRef] = useState<string>('')

  // Refund / Excess States (when customer removes or downgrades dishes)
  const [refundMethod, setRefundMethod] = useState<'Cash' | 'GCash'>('Cash')
  const [refundRef, setRefundRef] = useState<string>('')

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

    // Reset Billing / Payment States
    setAdjustmentPaymentMethod('Cash')
    setAdjCashReceived('')
    setAdjGcashRef('')
    setAdjHybridCash('')
    setAdjHybridEwallet('')
    setAdjHybridWalletType('GCash')
    setAdjHybridRef('')
    setRefundMethod('Cash')
    setRefundRef('')

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

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Status check: Is the order still in queue or already processing?
  const isCookingOrLater = useMemo(() => {
    return KITCHEN_PROCESSING_STATUSES.includes((liveStatus || '').toUpperCase())
  }, [liveStatus])

  // Dynamic Totals calculation with 2-decimal precision (prevents rounding discrepancy)
  const subtotal = useMemo(() => {
    return Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  }, [items])

  const vat = useMemo(() => {
    return Math.round(subtotal * 0.12 * 100) / 100
  }, [subtotal])

  const total = useMemo(() => {
    return Math.round((subtotal + vat) * 100) / 100
  }, [subtotal, vat])

  // Original total / amount customer already paid
  const originalTotal = useMemo(() => {
    if (!order) return 0
    const raw = Number(order.total || order.grossConfirmedPaid || order.netConfirmedPaid || 0)
    return Math.round(raw * 100) / 100
  }, [order])

  const rawDifference = total - originalTotal
  const priceDifference = Math.abs(rawDifference) < 0.01 ? 0 : Math.round(rawDifference * 100) / 100
  const isAdditionalDue = priceDifference > 0.01
  const isRefundDue = priceDifference < -0.01
  const additionalDue = isAdditionalDue ? priceDifference : 0
  const excessToReturn = isRefundDue ? Math.abs(priceDifference) : 0

  // Cash change calculation for additional balance
  const adjChange = useMemo(() => {
    if (!isAdditionalDue || adjustmentPaymentMethod !== 'Cash') return null
    const cash = parseFloat(adjCashReceived)
    if (!isNaN(cash) && cash >= additionalDue) {
      return Math.round((cash - additionalDue) * 100) / 100
    }
    return null
  }, [isAdditionalDue, adjustmentPaymentMethod, adjCashReceived, additionalDue])

  // Hybrid split calculations for additional balance
  const parsedAdjHybridCash = parseFloat(adjHybridCash) || 0
  const parsedAdjHybridEwallet = parseFloat(adjHybridEwallet) || 0
  const adjHybridTotalEntered = Math.round((parsedAdjHybridCash + parsedAdjHybridEwallet) * 100) / 100
  const isAdjHybridComplete = Math.abs(adjHybridTotalEntered - additionalDue) < 0.01
  const adjHybridBalanceRemaining = Math.max(0, Math.round((additionalDue - adjHybridTotalEntered) * 100) / 100)

  // Validation: ensures payment adjustments are fulfilled before saving
  const isPaymentValid = useMemo(() => {
    if (Math.abs(priceDifference) <= 0.01) return true

    if (isAdditionalDue) {
      if (adjustmentPaymentMethod === 'Cash') {
        const cash = parseFloat(adjCashReceived)
        return Boolean(adjCashReceived.trim()) && !isNaN(cash) && cash >= additionalDue
      }
      if (adjustmentPaymentMethod === 'GCash') {
        return Boolean(adjGcashRef.trim())
      }
      if (adjustmentPaymentMethod === 'Hybrid') {
        return (
          Boolean(adjHybridCash.trim()) &&
          parsedAdjHybridCash > 0 &&
          Boolean(adjHybridEwallet.trim()) &&
          parsedAdjHybridEwallet > 0 &&
          isAdjHybridComplete &&
          Boolean(adjHybridRef.trim())
        )
      }
      return false
    }

    if (isRefundDue) {
      if (refundMethod === 'Cash') return true
      if (refundMethod === 'GCash') return Boolean(refundRef.trim())
      return false
    }

    return true
  }, [
    priceDifference,
    isAdditionalDue,
    isRefundDue,
    adjustmentPaymentMethod,
    adjCashReceived,
    additionalDue,
    adjGcashRef,
    isAdjHybridComplete,
    adjHybridRef,
    refundMethod,
    refundRef,
  ])

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
    const it = items[index]
    if (it) {
      const servingsLeft = getRemainingServings(it.productId)
      if (servingsLeft !== null && servingsLeft !== undefined && it.quantity >= servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${it.name}.`, 'Portion Limit Reached')
        return
      }
    }
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

    const servingsLeft = getRemainingServings(menuItem.id)
    if (servingsLeft !== null && servingsLeft !== undefined) {
      if (servingsLeft <= 0) {
        showNotice(`Sorry, "${menuItem.name}" is currently out of stock.`, 'Out of Stock')
        return
      }
      const existing = items.find((it) => it.productId === menuItem.id)
      if (existing && existing.quantity >= servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${menuItem.name}.`, 'Portion Limit Reached')
        return
      }
    }

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

    const servingsLeft = getRemainingServings(replacement.id)
    const currentQty = items[index]?.quantity || 1
    if (servingsLeft !== null && servingsLeft !== undefined) {
      if (servingsLeft <= 0) {
        showNotice(`Sorry, "${replacement.name}" is currently out of stock.`, 'Out of Stock')
        return
      }
      if (currentQty > servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${replacement.name}. Quantity adjusted to ${servingsLeft}.`, 'Portion Limit Reached')
      }
    }

    const finalQty = servingsLeft !== null && servingsLeft !== undefined && currentQty > servingsLeft
      ? servingsLeft
      : currentQty

    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== index) return it
        return {
          ...it,
          productId: replacement.id,
          name: replacement.name,
          price: replacement.price,
          quantity: finalQty,
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

    if (!isPaymentValid) {
      if (isAdditionalDue) {
        setErrorMessage('Please complete the payment details for the additional balance before saving.')
      } else if (isRefundDue) {
        setErrorMessage('Please provide the refund details before saving.')
      }
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    const orderId = order.id || order.ref

    // Determine adjustment record and payment method label
    let updatedPaymentMethod = order.paymentMethod || 'Paid (POS)'
    let finalPaymentReference = order.paymentReference || order.referenceNumber || null
    let adjustmentDetails: any = null

    if (isAdditionalDue) {
      if (adjustmentPaymentMethod === 'Cash') {
        const cashVal = parseFloat(adjCashReceived) || additionalDue
        const changeVal = adjChange || 0
        adjustmentDetails = {
          type: 'ADDITIONAL_PAYMENT',
          method: 'Cash',
          amount: additionalDue,
          cashReceived: cashVal,
          changeDue: changeVal,
          timestamp: new Date().toISOString(),
        }
        updatedPaymentMethod = order.paymentMethod ? `${order.paymentMethod} (+Cash ₱${additionalDue.toFixed(2)})` : `Cash (₱${total.toFixed(2)})`
      } else if (adjustmentPaymentMethod === 'GCash') {
        adjustmentDetails = {
          type: 'ADDITIONAL_PAYMENT',
          method: 'GCash',
          amount: additionalDue,
          referenceNumber: adjGcashRef.trim(),
          timestamp: new Date().toISOString(),
        }
        finalPaymentReference = adjGcashRef.trim()
        updatedPaymentMethod = order.paymentMethod ? `${order.paymentMethod} (+GCash ₱${additionalDue.toFixed(2)})` : `GCash (₱${total.toFixed(2)})`
      } else if (adjustmentPaymentMethod === 'Hybrid') {
        const hybridLabel = `Hybrid (Cash ₱${parsedAdjHybridCash.toFixed(2)} + ${adjHybridWalletType} ₱${parsedAdjHybridEwallet.toFixed(2)})`
        adjustmentDetails = {
          type: 'ADDITIONAL_PAYMENT',
          method: 'Hybrid',
          amount: additionalDue,
          cashAmount: parsedAdjHybridCash,
          ewalletAmount: parsedAdjHybridEwallet,
          ewalletType: adjHybridWalletType,
          referenceNumber: adjHybridRef.trim(),
          timestamp: new Date().toISOString(),
        }
        finalPaymentReference = adjHybridRef.trim()
        updatedPaymentMethod = order.paymentMethod ? `${order.paymentMethod} (+${hybridLabel})` : hybridLabel
      }
    } else if (isRefundDue) {
      adjustmentDetails = {
        type: 'REFUND_CHANGE',
        method: refundMethod,
        amount: excessToReturn,
        referenceNumber: refundMethod === 'GCash' ? refundRef.trim() : null,
        timestamp: new Date().toISOString(),
      }
      if (refundMethod === 'GCash' && refundRef.trim()) {
        finalPaymentReference = refundRef.trim()
      }
      updatedPaymentMethod = order.paymentMethod ? `${order.paymentMethod} (-Refund ₱${excessToReturn.toFixed(2)} ${refundMethod})` : order.paymentMethod
    }

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
      paymentMethod: updatedPaymentMethod,
      paymentReference: finalPaymentReference,
      referenceNumber: finalPaymentReference,
      adjustmentDetails,
      excessRefunded: isRefundDue ? excessToReturn : (order.excessRefunded || 0),
      additionalPaid: isAdditionalDue ? additionalDue : (order.additionalPaid || 0),
      status: bulkCheck.requiresApproval ? 'AWAITING_KITCHEN_APPROVAL' : (order.status || 'CONFIRMED'),
      requiresKitchenApproval: bulkCheck.requiresApproval,
      requires_kitchen_approval: bulkCheck.requiresApproval,
      kitchenApprovalStatus: bulkCheck.requiresApproval ? 'PENDING' : (order.kitchenApprovalStatus || 'NONE'),
      kitchen_approval_status: bulkCheck.requiresApproval ? 'PENDING' : (order.kitchen_approval_status || 'NONE'),
      is_bulk: bulkCheck.requiresApproval,
      isBulk: bulkCheck.requiresApproval,
      flaggedQuantityItems: bulkCheck.flaggedItems,
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
      } else {
        // Instantly sync updated product servings into frontend cache
        if (data && Array.isArray(data.updatedProducts)) {
          data.updatedProducts.forEach((p: any) => {
            applyProductServingsChange(
              String(p.id),
              p.remaining_servings !== null && p.remaining_servings !== undefined
                ? Number(p.remaining_servings)
                : null
            )
          })
        }
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
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/65"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[94vh] animate-fade-in text-neutral-800"
      >
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

          {bulkCheck.requiresApproval && !isCookingOrLater && (
            <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 p-3.5 rounded-2xl text-xs space-y-1.5 animate-fade-in text-center">
              <div className="flex items-center justify-center gap-1.5 font-extrabold text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Kitchen Review Required
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                This modified order contains items exceeding kitchen quantity standards. The Kitchen team must review and approve quantities before preparation can resume.
              </p>
              <div className="flex flex-wrap gap-1 justify-center pt-0.5">
                {bulkCheck.flaggedItems.map((fi, idx) => (
                  <span key={idx} className="bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {fi.name}: x{fi.quantity} (STD: {fi.standard})
                  </span>
                ))}
              </div>
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
                            {menuItems.map((m) => {
                              const sLeft = getRemainingServings(m.id)
                              const isAvail = effectiveIsAvailable(m.id) && (sLeft === null || sLeft === undefined || sLeft > 0)
                              return (
                                <option key={m.id} value={m.id} disabled={!isAvail}>
                                  {m.name} (₱{m.price}){sLeft !== null && sLeft !== undefined ? ` [${sLeft} left]` : ''}{!isAvail ? ' [Out of Stock]' : ''}
                                </option>
                              )
                            })}
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
                  const available = effectiveIsAvailable(menuItem.id)
                  const servingsLeft = getRemainingServings(menuItem.id)
                  const isOutOfServings = servingsLeft !== null && servingsLeft !== undefined && servingsLeft <= 0
                  const isDishAvailable = available && !isOutOfServings
                  const alreadyInOrder = items.find((it) => it.productId === menuItem.id)

                  return (
                    <div
                      key={menuItem.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        !isDishAvailable
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
                          {!isDishAvailable ? (
                            <span className="text-[9px] font-bold text-rose-600">
                              [Out of Stock]
                            </span>
                          ) : (
                            servingsLeft !== null && servingsLeft !== undefined && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1 py-0.5 rounded">
                                {servingsLeft} left
                              </span>
                            )
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
                        disabled={!isDishAvailable}
                        onClick={() => handleAddDishFromMenu(menuItem)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                          !isDishAvailable
                            ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                            : alreadyInOrder
                            ? 'bg-orange-600 text-white shadow-2xs hover:bg-orange-700'
                            : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-500 hover:text-white'
                        }`}
                        title={isDishAvailable ? `Add ${menuItem.name} to order` : 'Item out of stock'}
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
          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/80 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-500">
              <span>Original Amount Paid</span>
              <span className="font-bold text-neutral-800">
                ₱{originalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Updated Subtotal</span>
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
            <div className="flex justify-between items-center text-sm pt-1.5 border-t border-neutral-200 mt-1">
              <span className="font-black text-neutral-900">Updated Total:</span>
              <span className="font-black text-orange-600 text-base">
                ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Exact Match badge */}
            {priceDifference === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 mt-2">
                <span>✓</span>
                <span>Order total matches original payment (₱{total.toFixed(2)}). No billing adjustment required.</span>
              </div>
            )}
          </div>

          {/* BILLING ADJUSTMENT SECTION: ADDITIONAL PAYMENT REQUIRED */}
          {isAdditionalDue && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                    Billing Adjustment • Additional Payment Required
                  </span>
                  <div className="text-xl font-black text-amber-900 mt-0.5">
                    ₱{additionalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                    Customer added or upgraded items. Please collect balance before updating kitchen.
                  </p>
                </div>
                <span className="text-2xl p-2 bg-amber-100 rounded-xl">💳</span>
              </div>

              {/* 3-Way Payment Method Selector */}
              <div>
                <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                  Select Payment Method for Additional Balance
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-amber-100/60 p-1.5 rounded-xl border border-amber-200">
                  {(['Cash', 'GCash', 'Hybrid'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setAdjustmentPaymentMethod(method)}
                      className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                        adjustmentPaymentMethod === method
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-neutral-700 hover:text-neutral-900 hover:bg-white/50'
                      }`}
                    >
                      {method === 'Cash' && '💵 Cash'}
                      {method === 'GCash' && '📱 GCash'}
                      {method === 'Hybrid' && '⚖️ Hybrid'}
                    </button>
                  ))}
                </div>
              </div>

              {/* CASH INPUT & CHANGE CALCULATOR */}
              {adjustmentPaymentMethod === 'Cash' && (
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                        Cash Received
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-neutral-500 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          step="any"
                          value={adjCashReceived}
                          onChange={(e) => setAdjCashReceived(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 text-sm font-black text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                        Change Due
                      </label>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-400">₱</span>
                        <span className="text-sm font-black text-emerald-600">
                          {adjChange !== null ? Number(adjChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Cash Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">
                      Quick:
                    </span>
                    {[
                      additionalDue,
                      Math.ceil(additionalDue / 20) * 20,
                      Math.ceil(additionalDue / 50) * 50,
                      Math.ceil(additionalDue / 100) * 100,
                      Math.ceil(additionalDue / 500) * 500,
                    ]
                      .filter((v, i, a) => a.indexOf(v) === i && v >= additionalDue)
                      .slice(0, 4)
                      .map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAdjCashReceived(amt.toString())}
                          className="px-2.5 py-1 bg-white border border-neutral-200 hover:border-orange-500 rounded-lg text-xs font-bold text-neutral-700 transition-all cursor-pointer shadow-2xs hover:bg-orange-50"
                        >
                          ₱{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </button>
                      ))}
                  </div>

                  {!adjCashReceived.trim() && (
                    <p className="text-[11px] font-bold text-amber-600 pt-1">
                      * Please input received cash or tap a quick preset before saving.
                    </p>
                  )}
                  {adjCashReceived.trim() && adjChange === null && (
                    <p className="text-[11px] font-bold text-rose-600 pt-1">
                      * Cash received is less than balance due (₱{additionalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </p>
                  )}
                </div>
              )}

              {/* GCASH INPUT */}
              {adjustmentPaymentMethod === 'GCash' && (
                <div className="space-y-2 bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                    GCash Reference Number <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={adjGcashRef}
                    onChange={(e) => setAdjGcashRef(e.target.value)}
                    placeholder="e.g. 1002 4859 1234 or GCash Ref #"
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Verify that customer transferred the additional ₱{additionalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via GCash.
                  </p>
                </div>
              )}

              {/* HYBRID (SPLIT CASH + E-WALLET) */}
              {adjustmentPaymentMethod === 'Hybrid' && (
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cash Portion */}
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                        Cash Amount
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-neutral-400 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          step="any"
                          value={adjHybridCash}
                          onChange={(e) => setAdjHybridCash(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs font-black text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* E-Wallet Portion */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                          E-Wallet Amount
                        </label>
                        <select
                          value={adjHybridWalletType}
                          onChange={(e) => setAdjHybridWalletType(e.target.value as 'GCash' | 'Maya')}
                          className="text-[10px] font-extrabold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-1 py-0.5 rounded outline-none cursor-pointer"
                        >
                          <option value="GCash">GCash</option>
                          <option value="Maya">Maya</option>
                        </select>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-neutral-400 font-bold text-xs">₱</span>
                        <input
                          type="number"
                          step="any"
                          value={adjHybridEwallet}
                          onChange={(e) => setAdjHybridEwallet(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2.5 py-1.5 text-xs font-black text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* E-Wallet Reference Number */}
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
                      {adjHybridWalletType} Reference Number <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={adjHybridRef}
                      onChange={(e) => setAdjHybridRef(e.target.value)}
                      placeholder={`e.g. Enter ${adjHybridWalletType} reference #`}
                      className="w-full px-3 py-2 text-xs font-mono font-semibold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Split Status indicator */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-neutral-600">
                      Split Total: <strong>₱{adjHybridTotalEntered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> / ₱{additionalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {isAdjHybridComplete ? (
                      <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1">
                        ✓ Balanced
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-rose-600">
                        {adjHybridTotalEntered < additionalDue
                          ? `Remaining: ₱${adjHybridBalanceRemaining.toFixed(2)}`
                          : `Over by: ₱${(adjHybridTotalEntered - additionalDue).toFixed(2)}`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BILLING ADJUSTMENT SECTION: REFUND / CHANGE DUE */}
          {isRefundDue && (
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                    Billing Adjustment • Return Change / Refund
                  </span>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">
                    ₱{excessToReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    Customer downgraded or removed items. Cashier must return the excess to the customer.
                  </p>
                </div>
                <span className="text-2xl p-2 bg-emerald-100 rounded-xl">💸</span>
              </div>

              {/* Refund Method Selection */}
              <div>
                <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1.5">
                  Refund Method
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-emerald-100/60 p-1.5 rounded-xl border border-emerald-200">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('Cash')}
                    className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      refundMethod === 'Cash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-700 hover:text-neutral-900 hover:bg-white/50'
                    }`}
                  >
                    💵 Return Cash Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundMethod('GCash')}
                    className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                      refundMethod === 'GCash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-700 hover:text-neutral-900 hover:bg-white/50'
                    }`}
                  >
                    📱 Refund via GCash
                  </button>
                </div>
              </div>

              {refundMethod === 'Cash' ? (
                <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1 shadow-2xs">
                  <p className="font-extrabold flex items-center gap-1.5 text-emerald-800">
                    <span>💵</span> Action Required:
                  </p>
                  <p className="font-medium text-neutral-700">
                    Hand <strong>₱{excessToReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> in cash change to the customer upon saving.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
                  <label className="block text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                    GCash Refund Reference Number <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={refundRef}
                    onChange={(e) => setRefundRef(e.target.value)}
                    placeholder="Enter GCash reference number of sent refund"
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Provide the reference number from the GCash transfer sending ₱{excessToReturn.toFixed(2)} to the customer.
                  </p>
                </div>
              )}
            </div>
          )}
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
              disabled={isSaving || items.length === 0 || !isPaymentValid}
              className={`text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                isAdditionalDue
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : isRefundDue
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
              }`}
            >
              {isSaving ? (
                <>
                  <span className="animate-spin text-xs">⏳</span>
                  <span>Updating Kitchen...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>
                    {isAdditionalDue
                      ? `Collect ₱${additionalDue.toFixed(2)} & Save`
                      : isRefundDue
                      ? `Refund ₱${excessToReturn.toFixed(2)} & Save`
                      : 'Save & Update Kitchen'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Minimal Modern Notice Modal */}
      <NoticeModal
        isOpen={Boolean(noticeModal)}
        title={noticeModal?.title}
        message={noticeModal?.message || ''}
        onClose={() => setNoticeModal(null)}
      />
    </div>
  )
}

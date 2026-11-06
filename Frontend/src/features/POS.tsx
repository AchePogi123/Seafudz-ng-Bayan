import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { MenuGrid } from '../components/MenuGrid'
import { OrderSummary } from '../components/OrderSummary'
import { SuccessModal } from '../components/SuccessModal'
import { ReceiptModal, executeReceiptPrint, generateReceiptHtml } from './ReceiptModal'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import type { CartItem } from '../components/OrderItemRow'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { notifyOrderSync, subscribeOrderSync, subscribeProductCatalogSync } from '../utils/orderSync'
import { useMenuPrices } from '../utils/menuPriceManager'
import { NavbarCashier } from '../components/NavbarCashier'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { PosModifyOrderModal } from '../components/PosModifyOrderModal'
import { CancelConfirmModal } from '../components/CancelConfirmModal'
import { NoticeModal } from '../components/NoticeModal'
import { useProductImages } from '../utils/useProductImages'
import { useMenuAvailability } from '../utils/menuAvailability'
import { checkProductQuantityStandards, getProductQuantityStandard, type FlaggedQuantityItem } from '../utils/bulkOrder'

interface ParsedDishItem {
  name: string
  quantity: number
  price: number
}

export const parseOrderDishes = (ord: any): ParsedDishItem[] => {
  if (!ord) return []

  // 1. Array of cartItems
  if (Array.isArray(ord.cartItems) && ord.cartItems.length > 0) {
    return ord.cartItems.map((ci: any) => ({
      name: String(ci.item?.name || ci.name || ci.product_name_snapshot || 'Menu Dish'),
      quantity: Math.max(1, Number(ci.quantity || 1)),
      price: Number(ci.item?.price || ci.unit_price || ci.price || 0),
    }))
  }

  // 2. Array of items (from DB or state)
  if (Array.isArray(ord.items) && ord.items.length > 0) {
    return ord.items.map((it: any) => {
      if (typeof it === 'string') {
        const match = it.match(/^(.*?)(?:\s+x(\d+))?$/)
        return {
          name: match ? match[1].trim() : it.trim(),
          quantity: match && match[2] ? parseInt(match[2], 10) : 1,
          price: 0,
        }
      }
      return {
        name: String(it.name || it.product_name_snapshot || it.item?.name || 'Menu Dish'),
        quantity: Math.max(1, Number(it.quantity || 1)),
        price: Number(it.unit_price || it.price || 0),
      }
    })
  }

  // 3. Comma-separated string format e.g. "Mixed Seafoods x2, Rice x1"
  if (typeof ord.items === 'string' && ord.items.trim()) {
    return ord.items.split(',').map((part: string) => {
      const match = part.trim().match(/^(.*?)(?:\s+x(\d+))?$/)
      return {
        name: match ? match[1].trim() : part.trim(),
        quantity: match && match[2] ? parseInt(match[2], 10) : 1,
        price: 0,
      }
    })
  }

  return []
}

export const getOrderCartItems = (ord: any): CartItem[] => {
  return parseOrderDishes(ord).map((d, idx) => ({
    item: {
      id: `dish-${idx}`,
      name: d.name,
      description: '',
      price: d.price,
      category: 'Seafoods',
      image: '',
    },
    quantity: d.quantity,
  }))
}

export const POS: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const { getEffectivePrice, updatePrice } = useMenuPrices()
  const { isAvailable, getRemainingServings } = useMenuAvailability()

  const { menuItems, refresh: refreshMenuItems } = useProductImages()
  const [categories] = useState<string[]>(CLIENT_CATEGORIES)

  // Minimal Modern Notice Popup Modal State
  const [noticeModal, setNoticeModal] = useState<{ title?: string; message: string } | null>(null)
  const showNotice = useCallback((message: string, title?: string) => {
    setNoticeModal({ message, title: title || 'Notice' })
  }, [])

  // Listen for real-time menu catalog changes (e.g. deletion of a product by admin)
  useEffect(() => {
    return subscribeProductCatalogSync((detail) => {
      if (detail?.action === 'DELETE' && detail.productId) {
        setCartItems((prev) => {
          const matched = prev.find((ci) => ci.item.id === detail.productId)
          if (matched) {
            showNotice(`The item "${detail.productName || matched.item.name}" was just removed from the menu by the admin and has been removed from your current order.`, 'Item Removed')
            return prev.filter((ci) => ci.item.id !== detail.productId)
          }
          return prev
        })
      }
    })
  }, [showNotice])

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Menu')
  const [storedCartItems, setCartItems] = useState<CartItem[]>([])
  const cartItems = useMemo(() => {
    const imagesById = new Map(menuItems.map((item) => [item.id, item]))
    return storedCartItems.map((cartItem) => {
      const latest = imagesById.get(cartItem.item.id)
      return latest
        ? { ...cartItem, item: { ...cartItem.item, image: latest.image, bundledImage: latest.bundledImage } }
        : cartItem
    })
  }, [menuItems, storedCartItems])
  const hasUnavailableItems = cartItems.some((ci) => !isAvailable(ci.item.id))
  const [orderType, setOrderType] = useState('Take Out')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Quantity Standards (Bulk Check) for POS cart
  const cartItemsWithServings = useMemo(() => {
    return cartItems.map((ci) => {
      const servings = getRemainingServings(ci.item.id)
      return {
        ...ci,
        id: ci.item.id,
        productId: ci.item.id,
        name: ci.item.name,
        category: ci.item.category,
        quantity: ci.quantity,
        remaining_servings: servings,
        remainingServings: servings,
      }
    })
  }, [cartItems, getRemainingServings])

  const bulkCheck = useMemo(() => {
    return checkProductQuantityStandards(cartItemsWithServings)
  }, [cartItemsWithServings])

  // Approved bulk order awaiting cashier payment collection
  const [approvedOrderForPayment, setApprovedOrderForPayment] = useState<any | null>(null)

  // Sub-module navigation state: 'new_order' | 'processing_orders' | 'online_receipts' | 'store_pickups'
  const [activeSubModule, setActiveSubModule] = useState<'new_order' | 'processing_orders' | 'online_receipts' | 'store_pickups'>('new_order')
  const [posOrders, setPosOrders] = useState<any[]>([])
  const [posSearchQuery, setPosSearchQuery] = useState('')
  const [posStatusFilter, setPosStatusFilter] = useState<'all' | 'kitchen' | 'ready' | 'completed' | 'cancelled'>('all')
  const [posNotification, setPosNotification] = useState<string | null>(null)
  
  // Online Receipts State for Cashier
  const [onlineReceipts, setOnlineReceipts] = useState<any[]>([])
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('')
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'unprinted' | 'printed'>('unprinted')

  // Store Pickups State for Cashier
  const [pickupSearchQuery, setPickupSearchQuery] = useState('')
  const [pickupFilter, setPickupFilter] = useState<'all' | 'ready' | 'pending' | 'completed'>('all')
  const [pickupPage, setPickupPage] = useState<number>(1)
  const PICKUP_PAGE_SIZE = 10
  const [handoverModalOrder, setHandoverModalOrder] = useState<any | null>(null)
  const [cashTendered, setCashTendered] = useState<string>('')
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false)

  // Pagination states (10 transactions per page)
  const [onlinePage, setOnlinePage] = useState<number>(1)
  const [posPage, setPosPage] = useState<number>(1)
  const ONLINE_PAGE_SIZE = 10
  const POS_PAGE_SIZE = 10

  // Order Modification & Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingPosOrder, setEditingPosOrder] = useState<any | null>(null)
  const [modifyingPosOrder, setModifyingPosOrder] = useState<any | null>(null)
  const [orderToCancel, setOrderToCancel] = useState<any | null>(null)
  const [isCancellingOrder, setIsCancellingOrder] = useState(false)
  const [previewProofModalUrl, setPreviewProofModalUrl] = useState<string | null>(null)

  const handleDeletePosOrder = async (orderId: string) => {
    const confirmDelete = window.confirm(`⚠️ Admin Action: Are you sure you want to permanently delete POS Order #${orderId}? This will remove it from PostgreSQL DB and all role views.`)
    if (!confirmDelete) return

    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' }).catch(() => {})
    } catch {}

    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.filter((o: any) => o.id !== orderId && o.ref !== orderId)
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      notifyOrderSync()
    } catch {}

    fetchPosOrders()
    setPosNotification(`Order #${orderId} permanently deleted from DB by Admin.`)
  }

  const [lastOrderDetails, setLastOrderDetails] = useState<{
    orderId?: string
    table?: string
    type: string
    total: number
    subtotal?: number
    vat?: number
    deliveryFee?: number
    cartItems: CartItem[]
    notes?: string
    cashReceived?: string
    change?: number | null
    paymentMethod?: string
    paymentReference?: string
    customerName?: string
    phone?: string
    address?: string
    requiresApproval?: boolean
    flaggedItems?: FlaggedQuantityItem[]
  } | null>(null)

  const removeUnavailableItems = () => {
    const availableItems = storedCartItems.filter((ci) => isAvailable(ci.item.id))
    setCartItems(availableItems)
    setLastOrderDetails((prev) => prev
      ? {
          ...prev,
          cartItems: availableItems,
          total: Math.round(availableItems.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0) * 1.12),
        }
      : prev)
  }

  // Fetch On-Site POS Orders for Cashier Sub-Module
  const fetchPosOrders = useCallback(async () => {
    try {
      // 1. Read local storage
      let localOrders: any[] = []
      try {
        const stored = localStorage.getItem('seafudz_orders')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) localOrders = parsed
        }
      } catch {}

      // 2. Fetch from backend API for production synchronization
      let apiOrders: any[] = []
      try {
        const authHeaders = await getAuthHeaders()
        const res = await fetch(`${API_BASE_URL}/orders?limit=100`, { headers: authHeaders }).catch(() => null)
        if (res && res.ok) {
          const json = await res.json()
          if (json.success && Array.isArray(json.data)) {
            apiOrders = json.data
          }
        }
      } catch {}

      // 3. Merge by ID
      const orderMap = new Map<string, any>()
      apiOrders.forEach((o: any) => {
        const id = String(o.id || o.ref || '')
        if (id) orderMap.set(id, o)
      })
      localOrders.forEach((o: any) => {
        const id = String(o.id || o.ref || '')
        if (id) {
          const existing = orderMap.get(id) || {}
          orderMap.set(id, { ...existing, ...o })
        }
      })

      // STRICT FILTER: Only On-Site POS orders (Dine In & Take Out / isPosOrder / Walk-In)
      const onSiteOrders = Array.from(orderMap.values()).filter((o: any) => {
        const rawType = (o.type || o.order_type || '').toLowerCase()
        const isDelivery = rawType.includes('delivery') || Boolean(o.deliveryAddress && o.customer !== 'Walk-In')
        if (isDelivery) return false

        const isPos = Boolean(
          o.isPosOrder ||
          o.is_pos_order ||
          rawType.includes('dine') ||
          rawType.includes('take') ||
          o.customer === 'Walk-In' ||
          String(o.id || o.ref || '').startsWith('POS-')
        )
        return isPos
      })

      setPosOrders(onSiteOrders)
    } catch (e) {
      console.warn('Error reading POS orders:', e)
    }
  }, [])

  // Fetch Confirmed Online Orders for Cashier Online Receipts Tab
  const fetchOnlineReceipts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/cashier/online-receipts`).catch(() => null)
      let apiData: any[] = []
      if (res && res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          apiData = json.data
        }
      }

      // Load persistent printed receipts cache
      const printedSet = new Set<string>()
      try {
        const storedPrinted = JSON.parse(localStorage.getItem('seafudz_printed_receipts') || '[]')
        if (Array.isArray(storedPrinted)) {
          storedPrinted.forEach((id: string) => printedSet.add(String(id)))
        }
      } catch {}

      const localStr = localStorage.getItem('seafudz_orders')
      const localParsed = localStr ? JSON.parse(localStr) : []
      const onlineLocal = Array.isArray(localParsed)
        ? localParsed.filter((o: any) => {
            const idStr = String(o.id || o.ref || '')
            const typeStr = (o.type || o.order_type || '').toLowerCase()
            const isPos = Boolean(
              o.isPosOrder ||
              o.is_pos_order ||
              idStr.startsWith('POS-') ||
              typeStr.includes('dine') ||
              typeStr.includes('take') ||
              typeStr.includes('on_site') ||
              (o.customer === 'Walk-In' && !o.deliveryAddress)
            )
            // STRICT: Online receipts are exclusive ONLY to online delivery orders, not on-site POS
            if (isPos) return false

            const isOnline = typeStr.includes('online') || typeStr.includes('delivery') || idStr.startsWith('SFB-')
            const s = (o.status || '').toUpperCase()
            const isConfirmedOrLater = ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(s)
            return isOnline && isConfirmedOrLater
          })
        : []

      const mergedMap = new Map<string, any>()
      apiData.forEach((o) => {
        const idStr = String(o.id || o.ref || '')
        const typeStr = (o.type || o.order_type || o.orderType || '').toLowerCase()
        const isPos = Boolean(
          o.isPosOrder ||
          o.is_pos_order ||
          idStr.startsWith('POS-') ||
          typeStr.includes('dine') ||
          typeStr.includes('take') ||
          typeStr.includes('on_site') ||
          (o.customer === 'Walk-In' && !o.deliveryAddress)
        )
        if (o.id && !isPos) {
          const isPrinted = Boolean(
            printedSet.has(idStr) ||
            o.isReceiptPrinted ||
            (o.receiptStatus || '').toUpperCase() === 'PRINTED' ||
            (o.receipt_status || '').toUpperCase() === 'PRINTED'
          )
          mergedMap.set(String(o.id), {
            ...o,
            fulfillmentType: o.fulfillmentType || o.fulfillment_type || (typeStr.includes('pickup') ? 'PICKUP' : 'DELIVERY'),
            fulfillment_type: o.fulfillmentType || o.fulfillment_type || (typeStr.includes('pickup') ? 'PICKUP' : 'DELIVERY'),
            isReceiptPrinted: isPrinted,
            receiptStatus: isPrinted ? 'PRINTED' : 'UNPRINTED',
          })
        }
      })

      onlineLocal.forEach((o) => {
        const idStr = String(o.id || o.ref)
        const isPrinted = Boolean(
          printedSet.has(idStr) ||
          o.isReceiptPrinted ||
          (o.receiptStatus || '').toUpperCase() === 'PRINTED' ||
          (o.receipt_status || '').toUpperCase() === 'PRINTED'
        )
        const fType = o.fulfillmentType || o.fulfillment_type || ((o.type || '').toUpperCase().includes('PICKUP') ? 'PICKUP' : 'DELIVERY')
        if (!mergedMap.has(idStr)) {
          mergedMap.set(idStr, {
            id: idStr,
            ref: idStr,
            fulfillmentType: fType,
            fulfillment_type: fType,
            customerName: o.customer || o.customerName || 'Online Customer',
            phone: o.phone || '0917-000-0000',
            deliveryAddress: o.address || o.deliveryAddress || (fType === 'PICKUP' ? 'Store Counter (Pick-Up)' : 'Delivery Address'),
            paymentMethod: o.paymentMethod || 'GCash',
            receiptStatus: isPrinted ? 'PRINTED' : 'UNPRINTED',
            isReceiptPrinted: isPrinted,
            deliveryProof: o.deliveryProof || o.delivery_proof || undefined,
            status: (o.status || 'CONFIRMED').toUpperCase(),
            subtotal: o.subtotal || o.total || 0,
            vat: o.vat || 0,
            deliveryFee: fType === 'PICKUP' ? 0 : (o.deliveryFee ?? 50),
            total: o.total || 0,
            items: Array.isArray(o.cartItems)
              ? o.cartItems.map((ci: any) => ({
                  id: ci.item?.id || ci.productId,
                  name: ci.item?.name || ci.name || 'Seafood Dish',
                  quantity: ci.quantity || 1,
                  price: ci.item?.price || ci.unit_price || ci.price || 0,
                }))
              : Array.isArray(o.items)
              ? o.items
              : [],
            createdAt: o.dateTime || o.createdAt || new Date().toISOString(),
          })
        } else {
          const existing = mergedMap.get(idStr)
          if (o.deliveryProof || o.delivery_proof) {
            existing.deliveryProof = o.deliveryProof || o.delivery_proof
          }
          if (o.fulfillmentType || o.fulfillment_type) {
            existing.fulfillmentType = o.fulfillmentType || o.fulfillment_type
            existing.fulfillment_type = o.fulfillmentType || o.fulfillment_type
          }
          if (isPrinted) {
            existing.isReceiptPrinted = true
            existing.receiptStatus = 'PRINTED'
          }
        }
      })

      setOnlineReceipts(Array.from(mergedMap.values()))
    } catch (err) {
      console.warn('Error fetching online receipts:', err)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPosOrders()
      void fetchOnlineReceipts()
    }, 0)

    const unsubscribe = subscribeOrderSync(() => {
      fetchPosOrders()
      void fetchOnlineReceipts()
    })
    const interval = setInterval(() => {
      fetchPosOrders()
      void fetchOnlineReceipts()
    }, 2000)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchPosOrders, fetchOnlineReceipts])

  // Prompt cashier with modern confirmation pop-up to cancel an order
  const promptCancelPosOrder = (ord: any) => {
    const s = (ord.status || '').toUpperCase()
    const isCookingOrLater = ['PREPARING', 'COOKING', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(s)
    if (isCookingOrLater) {
      showNotice('This order is already being prepared/cooked in the kitchen and can no longer be cancelled.', 'Cancellation Unavailable')
      return
    }
    setOrderToCancel(ord)
  }

  // Action: Cashier confirms cancelling an on-site processing order
  const handleConfirmCancel = async () => {
    if (!orderToCancel) return
    const orderId = orderToCancel.id || orderToCancel.ref
    setIsCancellingOrder(true)

    try {
      const res = await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      const resData = await res.json().catch(() => ({}))
      if (!res.ok && resData.message) {
        showNotice(resData.message, 'Cancellation Failed')
        fetchPosOrders()
        setIsCancellingOrder(false)
        setOrderToCancel(null)
        return
      }
    } catch {}

    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) =>
          o.id === orderId || o.ref === orderId ? { ...o, status: 'CANCELLED' } : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      notifyOrderSync()
    } catch {}

    fetchPosOrders()
    setPosNotification(`POS Order #${orderId} has been cancelled successfully.`)
    setIsCancellingOrder(false)
    setOrderToCancel(null)
  }

  // Action: Cashier marks a ready on-site order as completed/served (ONLY enabled when kitchen marks it ready)
  const handleCompletePosOrder = async (orderId: string) => {
    const targetOrder = posOrders.find((o) => o.id === orderId || o.ref === orderId)
    if (targetOrder) {
      const s = (targetOrder.status || '').toUpperCase()
      const isReady = ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
      if (!isReady) {
        showNotice('Cannot mark order as served yet. Please wait for the kitchen to mark the order as Done / Ready.', 'Order Not Ready')
        return
      }
    }

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      }).catch(() => {})
    } catch {}

    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) =>
          o.id === orderId || o.ref === orderId ? { ...o, status: 'COMPLETED' } : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      notifyOrderSync()
    } catch {}

    fetchPosOrders()
    setPosNotification(`POS Order #${orderId} marked as Completed & Served!`)
  }

  const activeProcessingCount = useMemo(() => {
    return posOrders.filter((o) => {
      const s = (o.status || '').toUpperCase()
      return s !== 'COMPLETED' && s !== 'CANCELLED' && s !== 'SERVED'
    }).length
  }, [posOrders])

  const isPickupOrder = (o: any) => {
    const fType = String(o?.fulfillmentType || o?.fulfillment_type || o?.type || '').toUpperCase()
    return fType.includes('PICKUP')
  }

  const unprintedOnlineCount = useMemo(() => {
    return onlineReceipts.filter(
      (o) => !isPickupOrder(o) && !o.isReceiptPrinted && (o.receiptStatus || '').toUpperCase() !== 'PRINTED'
    ).length
  }, [onlineReceipts])

  const pendingPickupCount = useMemo(() => {
    return onlineReceipts.filter(
      (o) => isPickupOrder(o) && !['COMPLETED', 'CANCELLED'].includes((o.status || '').toUpperCase())
    ).length
  }, [onlineReceipts])

  const readyPickupCount = useMemo(() => {
    return onlineReceipts.filter(
      (o) => isPickupOrder(o) && (o.status || '').toUpperCase() === 'READY'
    ).length
  }, [onlineReceipts])

  const formatOrderTime = (rawDateStr?: string) => {
    if (!rawDateStr) return 'Today'
    const d = new Date(rawDateStr)
    if (!isNaN(d.getTime())) {
      const isToday = new Date().toDateString() === d.toDateString()
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (isToday) return timeStr
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`
    }
    return String(rawDateStr)
  }

  const parseOrderTimestamp = (o: any): number => {
    const val = o.createdAt || o.created_at || o.dateTime || o.timestamp
    if (!val) {
      const idStr = String(o.id || o.ref || '')
      const match = idStr.match(/\d{10,13}/)
      if (match) return parseInt(match[0], 10)
      return Infinity
    }
    if (typeof val === 'number') return val
    if (val instanceof Date) return val.getTime()
    const parsed = Date.parse(val)
    if (!isNaN(parsed)) return parsed
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.getTime()
    return Infinity
  }

  const filteredOnlineReceipts = useMemo(() => {
    // Exclude Pickup orders so this tab is exclusive to Delivery
    const deliveryOnly = onlineReceipts.filter((o) => !isPickupOrder(o))
    const filtered = deliveryOnly.filter((o) => {
      const isPrinted = Boolean(o.isReceiptPrinted || (o.receiptStatus || '').toUpperCase() === 'PRINTED')
      const matchesFilter =
        onlineFilter === 'all'
          ? true
          : onlineFilter === 'unprinted'
          ? !isPrinted
          : onlineFilter === 'printed'
          ? isPrinted
          : true

      if (!matchesFilter) return false

      if (!onlineSearchQuery.trim()) return true
      const q = onlineSearchQuery.toLowerCase()
      const ref = (o.id || o.ref || '').toLowerCase()
      const cust = (o.customerName || o.customer || '').toLowerCase()
      const phone = (o.phone || '').toLowerCase()
      return ref.includes(q) || cust.includes(q) || phone.includes(q)
    })

    // Strict FIFO sorting by creation timestamp (oldest first: Order #1 before Order #2)
    return filtered.sort((a, b) => {
      const timeA = parseOrderTimestamp(a)
      const timeB = parseOrderTimestamp(b)
      if (timeA !== timeB) return timeA - timeB
      return String(a.id || a.ref || '').localeCompare(String(b.id || b.ref || ''))
    })
  }, [onlineReceipts, onlineFilter, onlineSearchQuery])

  const filteredStorePickups = useMemo(() => {
    // Exclusive to Pickup orders
    const pickupOnly = onlineReceipts.filter((o) => isPickupOrder(o))
    const filtered = pickupOnly.filter((o) => {
      const s = (o.status || '').toUpperCase()
      const matchesFilter =
        pickupFilter === 'all'
          ? true
          : pickupFilter === 'ready'
          ? s === 'READY'
          : pickupFilter === 'pending'
          ? ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING'].includes(s)
          : pickupFilter === 'completed'
          ? ['COMPLETED', 'DELIVERED', 'SERVED'].includes(s)
          : true

      if (!matchesFilter) return false

      if (!pickupSearchQuery.trim()) return true
      const q = pickupSearchQuery.toLowerCase()
      const ref = (o.id || o.ref || '').toLowerCase()
      const cust = (o.customerName || o.customer || '').toLowerCase()
      const phone = (o.phone || '').toLowerCase()
      return ref.includes(q) || cust.includes(q) || phone.includes(q)
    })

    // FIFO sorting: oldest creation timestamp first
    return filtered.sort((a, b) => {
      const timeA = parseOrderTimestamp(a)
      const timeB = parseOrderTimestamp(b)
      if (timeA !== timeB) return timeA - timeB
      return String(a.id || a.ref || '').localeCompare(String(b.id || b.ref || ''))
    })
  }, [onlineReceipts, pickupFilter, pickupSearchQuery])

  const handlePrepareReceiptDetails = (order: any) => {
    const isPickup = isPickupOrder(order)
    const itemsList: CartItem[] = Array.isArray(order.items)
      ? order.items.map((i: any) => ({
          item: {
            id: String(i.id || i.productId || Math.random()),
            name: i.name || i.product_name_snapshot || 'Seafood Dish',
            price: parseFloat(i.price || i.unit_price || 0),
          },
          quantity: i.quantity || 1,
        }))
      : []

    const calcSubtotal = typeof order.subtotal === 'number'
      ? order.subtotal
      : itemsList.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)

    const calcVat = typeof order.vat === 'number' ? order.vat : Math.round(calcSubtotal * 0.12)
    const calcDeliveryFee = isPickup ? 0 : (typeof order.deliveryFee === 'number' ? order.deliveryFee : 50)
    const calcTotal = typeof order.total === 'number' ? order.total : Math.round(calcSubtotal + calcVat + calcDeliveryFee)
    const paymentRef = order.paymentReference || order.payment_reference || order.referenceNumber || order.reference_number || undefined

    return {
      orderId: order.id || order.ref,
      table: 'N/A',
      type: isPickup ? 'ONLINE / Store Pick-Up' : 'ONLINE / Delivery',
      total: calcTotal,
      subtotal: calcSubtotal,
      vat: calcVat,
      deliveryFee: calcDeliveryFee,
      cartItems: itemsList,
      paymentMethod: order.paymentMethod || (isPickup ? 'Pay in Store' : 'GCash'),
      paymentReference: paymentRef,
      customerName: order.customerName || order.customer || 'Online Customer',
      phone: order.phone || '0917-000-0000',
      address: isPickup ? 'Store Counter (Pick-Up)' : (order.deliveryAddress || order.address || 'Delivery Address'),
    }
  }

  const handlePickupHandover = async (order: any, cashTenderedVal?: number) => {
    const orderId = order.id || order.ref
    const statusNorm = (order.status || '').toUpperCase()
    if (statusNorm !== 'READY') {
      alert(`Cannot hand over this order yet. The kitchen is still preparing it (current status: ${statusNorm}). Please wait until the kitchen marks it as Ready.`)
      return
    }
    const isPayInStore = String(order.paymentMethod || '').toUpperCase().includes('STORE') || order.paymentMethod === 'PAY_IN_STORE' || order.paymentMethod === 'COD'

    try {
      setIsSubmittingHandover(true)
      await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/pickup-handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: currentUser?.id,
          paymentMethod: isPayInStore ? 'CASH' : 'GCASH',
          cashReceived: cashTenderedVal !== undefined ? cashTenderedVal : (order.total || 0),
        }),
      }).catch(() => null)

      // Update in LocalStorage
      try {
        const stored = localStorage.getItem('seafudz_orders')
        if (stored) {
          const parsed = JSON.parse(stored)
          const updated = parsed.map((o: any) =>
            o.id === orderId || o.ref === orderId
              ? { ...o, status: 'COMPLETED', paymentStatus: 'PAID', updatedAt: new Date().toISOString() }
              : o
          )
          localStorage.setItem('seafudz_orders', JSON.stringify(updated))
        }
      } catch {}

      setOnlineReceipts((prev) =>
        prev.map((o) =>
          o.id === orderId || o.ref === orderId
            ? { ...o, status: 'COMPLETED', paymentStatus: 'PAID' }
            : o
        )
      )

      notifyOrderSync()
      setHandoverModalOrder(null)
      setCashTendered('')
      setPosNotification(`Order #${orderId} marked as Picked Up & successfully handed over!`)
    } catch (err: any) {
      alert(`Failed to complete handover: ${err?.message || 'Network error'}`)
    } finally {
      setIsSubmittingHandover(false)
    }
  }

  const handleViewOnlineReceipt = (order: any) => {
    setLastOrderDetails(handlePrepareReceiptDetails(order))
    setIsReceiptModalOpen(true)
  }

  const markOrderAsPrinted = async (orderId: string) => {
    // 1. Immediately mark printed in local state so order moves out of Unprinted list to Printed tab
    setOnlineReceipts((prev) =>
      prev.map((o) =>
        o.id === orderId || o.ref === orderId
          ? { ...o, isReceiptPrinted: true, receiptStatus: 'PRINTED' }
          : o
      )
    )

    // 2. Persist to dedicated seafudz_printed_receipts array in localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('seafudz_printed_receipts') || '[]')
      const arr = Array.isArray(stored) ? stored : []
      if (!arr.includes(orderId)) {
        arr.push(orderId)
        localStorage.setItem('seafudz_printed_receipts', JSON.stringify(arr))
      }
    } catch {}

    // 3. Persist to seafudz_orders in localStorage if present
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) =>
          o.id === orderId || o.ref === orderId
            ? { ...o, isReceiptPrinted: true, receiptStatus: 'PRINTED' }
            : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
    } catch {}

    // 4. Update backend PostgreSQL DB & inMemoryOrders
    try {
      await fetch(`${API_BASE_URL}/cashier/online-receipts/${orderId}/print`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    } catch {}

    // 5. Notify cross-tab synchronization
    notifyOrderSync()
  }

  const handlePrintOnlineReceipt = async (order: any) => {
    const orderId = order.id || order.ref

    await markOrderAsPrinted(orderId)

    const details = handlePrepareReceiptDetails(order)
    setLastOrderDetails(details)
    setPosNotification(`Official Restaurant Receipt printed & recorded for Online Order #${orderId}`)

    // Immediately trigger native print prompt via hidden iframe
    const html = generateReceiptHtml(details)
    executeReceiptPrint(html)
  }

  const filteredPosOrders = useMemo(() => {
    return posOrders.filter((o) => {
      const s = (o.status || '').toUpperCase()
      const matchesFilter =
        posStatusFilter === 'all'
          ? true
          : posStatusFilter === 'kitchen'
          ? ['CONFIRMED', 'IN KITCHEN', 'PREPARING', 'COOKING', 'IN_PROCESS', 'AWAITING_KITCHEN_APPROVAL', 'APPROVED_BY_KITCHEN'].includes(s)
          : posStatusFilter === 'ready'
          ? ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
          : posStatusFilter === 'completed'
          ? ['COMPLETED', 'SERVED', 'DELIVERED'].includes(s)
          : posStatusFilter === 'cancelled'
          ? ['CANCELLED', 'KITCHEN_REJECTED'].includes(s)
          : true

      if (!matchesFilter) return false

      if (!posSearchQuery.trim()) return true
      const q = posSearchQuery.toLowerCase()
      const ref = (o.ref || o.id || '').toLowerCase()
      const dishesStr = parseOrderDishes(o).map((d) => d.name).join(' ').toLowerCase()
      const notes = (o.notes || '').toLowerCase()
      const type = (o.type || '').toLowerCase()
      return ref.includes(q) || dishesStr.includes(q) || notes.includes(q) || type.includes(q)
    })
  }, [posOrders, posStatusFilter, posSearchQuery])

  // Reset to page 1 on search / filter changes
  useEffect(() => {
    setOnlinePage(1)
  }, [onlineFilter, onlineSearchQuery])

  useEffect(() => {
    setPosPage(1)
  }, [posStatusFilter, posSearchQuery])

  useEffect(() => {
    setPickupPage(1)
  }, [pickupFilter, pickupSearchQuery])

  // Paginated Slices (10 transactions per page)
  const totalOnlinePages = Math.max(1, Math.ceil(filteredOnlineReceipts.length / ONLINE_PAGE_SIZE))
  const paginatedOnlineReceipts = useMemo(() => {
    const start = (onlinePage - 1) * ONLINE_PAGE_SIZE
    return filteredOnlineReceipts.slice(start, start + ONLINE_PAGE_SIZE)
  }, [filteredOnlineReceipts, onlinePage])

  const totalPosPages = Math.max(1, Math.ceil(filteredPosOrders.length / POS_PAGE_SIZE))
  const paginatedPosOrders = useMemo(() => {
    const start = (posPage - 1) * POS_PAGE_SIZE
    return filteredPosOrders.slice(start, start + POS_PAGE_SIZE)
  }, [filteredPosOrders, posPage])

  const totalPickupPages = Math.max(1, Math.ceil(filteredStorePickups.length / PICKUP_PAGE_SIZE))
  const paginatedStorePickups = useMemo(() => {
    const start = (pickupPage - 1) * PICKUP_PAGE_SIZE
    return filteredStorePickups.slice(start, start + PICKUP_PAGE_SIZE)
  }, [filteredStorePickups, pickupPage])

  useEffect(() => {
    if (onlinePage > totalOnlinePages) setOnlinePage(1)
  }, [onlinePage, totalOnlinePages])

  useEffect(() => {
    if (posPage > totalPosPages) setPosPage(1)
  }, [posPage, totalPosPages])

  useEffect(() => {
    if (pickupPage > totalPickupPages) setPickupPage(1)
  }, [pickupPage, totalPickupPages])

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    pageSize: number,
    onPageChange: (newPage: number) => void
  ) => {
    if (totalItems <= pageSize) return null

    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, totalItems)

    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }

    return (
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mt-3">
        <div className="text-neutral-500 font-bold">
          Showing <strong className="text-neutral-900">{startIndex + 1}</strong> to{' '}
          <strong className="text-neutral-900">{endIndex}</strong> of{' '}
          <strong className="text-neutral-900">{totalItems}</strong> transactions (Page {currentPage} of {totalPages})
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 font-extrabold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-1">
            {pages.map((p, i) =>
              typeof p === 'number' ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-8 h-8 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    currentPage === p
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {p}
                </button>
              ) : (
                <span key={i} className="px-1 text-neutral-400 font-bold">
                  …
                </span>
              )
            )}
          </div>

          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 font-extrabold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0)
  }, [cartItems])

  const totalCartPrice = useMemo(() => {
    const rawSubtotal = cartItems.reduce((acc, item) => {
      const basePrice = item.item.basePrice || Math.round((item.item.price / 1.12) * 100) / 100
      return acc + basePrice * item.quantity
    }, 0)
    return Math.round(rawSubtotal * 1.12)
  }, [cartItems])

  // Filters: Menu Display Price = Base Price + 12% VAT (same as customer side, e.g. 199 + 12% VAT = ₱223)
  const filteredItems = useMemo(() => {
    return menuItems
      .map((item) => {
        const basePrice = getEffectivePrice(item.id, item.price)
        return {
          ...item,
          basePrice,
          price: Math.round(basePrice * 1.12),
        }
      })
      .filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())

        const normSelected = selectedCategory.toLowerCase().replace(/[^a-z0-9]/g, '')
        const normItemCat = (item.category || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const matchesCategory =
          selectedCategory === 'All Menu' || normItemCat === normSelected

        return matchesSearch && matchesCategory
      })
  }, [menuItems, searchQuery, selectedCategory, getEffectivePrice])

  const handlePriceUpdate = (item: MenuItem, newPrice: number) => {
    const basePrice = Math.round((newPrice / 1.12) * 100) / 100
    updatePrice(item.id, basePrice)
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.item.id === item.id ? { ...ci, item: { ...ci.item, basePrice, price: newPrice } } : ci
      )
    )
  }

  const handleAddToCart = (item: MenuItem) => {
    if (!isAvailable(item.id)) return

    const servingsLeft = getRemainingServings(item.id)
    if (servingsLeft !== null && servingsLeft !== undefined) {
      if (servingsLeft <= 0) {
        showNotice(`Sorry, "${item.name}" is currently out of stock.`, 'Out of Stock')
        return
      }
      const existing = cartItems.find((ci) => ci.item.id === item.id)
      if (existing && existing.quantity >= servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${item.name}.`, 'Portion Limit Reached')
        return
      }
    }

    const basePrice = item.basePrice || getEffectivePrice(item.id, item.price)
    const effectiveItem: MenuItem = {
      ...item,
      basePrice,
      price: typeof item.basePrice === 'number' && item.price !== basePrice
        ? item.price
        : Math.round(basePrice * 1.12),
    }
    setCartItems((prevItems) => {
      const existing = prevItems.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prevItems.map((ci) =>
          ci.item.id === item.id ? { ...ci, item: effectiveItem, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prevItems, { item: effectiveItem, quantity: 1 }]
    })
  }

  const handleIncrement = (itemId: string) => {
    const servingsLeft = getRemainingServings(itemId)
    const ci = cartItems.find((c) => c.item.id === itemId)
    if (servingsLeft !== null && servingsLeft !== undefined && ci) {
      if (ci.quantity >= servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${ci.item.name}.`, 'Portion Limit Reached')
        return
      }
    }
    setCartItems((prevItems) =>
      prevItems.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci
      )
    )
  }

  const handleDecrement = (itemId: string) => {
    setCartItems((prevItems) =>
      prevItems
        .map((ci) =>
          ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci
        )
        .filter((ci) => ci.quantity > 0)
    )
  }

  const handleSetQuantity = (itemId: string, quantity: number) => {
    let finalQty = Math.max(1, quantity)
    const servingsLeft = getRemainingServings(itemId)
    const ci = cartItems.find((c) => c.item.id === itemId)
    if (servingsLeft !== null && servingsLeft !== undefined) {
      if (finalQty > servingsLeft) {
        showNotice(`Only ${servingsLeft} serving${servingsLeft === 1 ? '' : 's'} available for ${ci?.item?.name || 'this item'}.`, 'Portion Limit Reached')
        finalQty = servingsLeft
      }
    }
    setCartItems((prevItems) =>
      prevItems.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: finalQty } : ci
      )
    )
  }

  const handleRemove = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter((ci) => ci.item.id !== itemId))
  }

  const handleConfirmOrder = () => {
    if (cartItems.length === 0) return
    if (hasUnavailableItems) return

    const activeItemIds = new Set(menuItems.map((m) => m.id))
    const deletedInCart = cartItems.filter((ci) => !activeItemIds.has(ci.item.id))
    if (deletedInCart.length > 0) {
      const names = deletedInCart.map((ci) => ci.item.name).join(', ')
      showNotice(`The following item(s) are no longer on the menu: ${names}. They have been removed from the order.`, 'Items Unavailable')
      setCartItems((prev) => prev.filter((ci) => activeItemIds.has(ci.item.id)))
      return
    }

    const rawSubtotal = cartItems.reduce((acc, ci) => {
      const basePrice = ci.item.basePrice || Math.round((ci.item.price / 1.12) * 100) / 100
      return acc + basePrice * ci.quantity
    }, 0)
    const vat = rawSubtotal * 0.12
    const totalWithVat = Math.round(rawSubtotal + vat)

    setLastOrderDetails({
      table: 'N/A',
      type: orderType,
      customerName: customerName.trim(),
      subtotal: rawSubtotal,
      vat,
      total: totalWithVat,
      cartItems: [...cartItems],
      notes: orderNotes,
      requiresApproval: bulkCheck.requiresApproval,
      flaggedItems: bulkCheck.flaggedItems,
    })
    setIsMobileCartOpen(false)
    setIsSuccessModalOpen(true)
  }

  const handleCloseSuccessModal = () => {
    if (!approvedOrderForPayment) {
      setCartItems([])
      setOrderNotes('')
      setCustomerName('')
    }
    setApprovedOrderForPayment(null)
    setIsSuccessModalOpen(false)
    setLastOrderDetails(null)
  }

  const handleSubmitForKitchenApproval = async () => {
    if (cartItems.length === 0) return
    if (hasUnavailableItems) return

    const rawSubtotal = cartItems.reduce((acc, ci) => {
      const basePrice = ci.item.basePrice || Math.round((ci.item.price / 1.12) * 100) / 100
      return acc + basePrice * ci.quantity
    }, 0)
    const vat = rawSubtotal * 0.12
    const total = Math.round(rawSubtotal + vat)
    const orderId = `POS-${Date.now().toString().slice(-4)}`
    const finalCustomerName = customerName.trim()

    const posOrderPayload = {
      id: orderId,
      ref: orderId,
      customerName: finalCustomerName || undefined,
      customer_name: finalCustomerName || undefined,
      customer: finalCustomerName || '',
      name: finalCustomerName || '',
      isPosOrder: true,
      status: 'AWAITING_KITCHEN_APPROVAL',
      orderType: orderType === 'Dine In' ? 'DINE_IN' : 'TAKE_OUT',
      type: orderType,
      paymentMethod: 'Pending Kitchen Approval',
      paymentStatus: 'Unpaid',
      requiresKitchenApproval: true,
      requires_kitchen_approval: true,
      kitchenApprovalStatus: 'PENDING',
      kitchen_approval_status: 'PENDING',
      is_bulk: true,
      isBulk: true,
      flaggedQuantityItems: bulkCheck.flaggedItems,
      notes: orderNotes,
      subtotal: rawSubtotal,
      vat: Math.round(vat * 100) / 100,
      deliveryFee: 0,
      total,
      cartItems: cartItems.map((ci) => ({
        productId: ci.item.id,
        name: ci.item.name,
        unit_price: ci.item.price,
        quantity: ci.quantity,
        notes: orderNotes || null,
        item: ci.item,
      })),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(posOrderPayload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.message || 'Could not submit bulk order for Kitchen review.')
      }
    } catch (err) {
      console.error('POS order API error:', err)
      showNotice(err instanceof Error ? err.message : 'Could not submit bulk order for Kitchen review.', 'Order Error')
      return
    }

    const localOrderObj = {
      id: orderId,
      ref: orderId,
      dateTime: new Date().toLocaleString(),
      type: orderType,
      status: 'AWAITING_KITCHEN_APPROVAL',
      paymentStatus: 'Unpaid',
      customer: finalCustomerName,
      customerName: finalCustomerName,
      customer_name: finalCustomerName,
      name: finalCustomerName,
      isPosOrder: true,
      requiresKitchenApproval: true,
      requires_kitchen_approval: true,
      kitchenApprovalStatus: 'PENDING',
      kitchen_approval_status: 'PENDING',
      is_bulk: true,
      isBulk: true,
      flaggedQuantityItems: bulkCheck.flaggedItems,
      items: cartItems.map((ci) => `${ci.item.name} x${ci.quantity}`).join(', '),
      notes: orderNotes,
      total,
      paymentMethod: 'Pending Kitchen Approval',
      cartItems: [...cartItems],
    }

    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      localStorage.setItem('seafudz_orders', JSON.stringify([localOrderObj, ...existing]))
      notifyOrderSync()
    } catch (e) {
      console.warn('LocalStorage save warning:', e)
    }

    setCartItems([])
    setOrderNotes('')
    setCustomerName('')
    setIsSuccessModalOpen(false)
    setLastOrderDetails(null)
    setPosNotification(`⚠️ High-Quantity Order #${orderId} sent to Kitchen for Quantity Review! Payment will be collected once Kitchen approves.`)
    setTimeout(() => setPosNotification(null), 6000)
    setActiveSubModule('processing_orders')
    fetchPosOrders()
  }

  const handleOpenPaymentForApprovedOrder = (ord: any) => {
    const rawSubtotal = ord.subtotal || Math.round((ord.total / 1.12) * 100) / 100
    const vat = ord.vat || Math.round((ord.total - rawSubtotal) * 100) / 100
    const ordCust = ord.customerName || ord.customer_name || ord.customer || ord.name || ''
    const cleanCust = (ordCust === 'Walk-In' || ordCust === 'Walk-In Customer') ? '' : ordCust
    setCustomerName(cleanCust)
    setApprovedOrderForPayment(ord)
    setLastOrderDetails({
      orderId: ord.id || ord.ref,
      table: ord.table || 'N/A',
      type: ord.type || ord.orderType || 'Take Out',
      customerName: cleanCust,
      subtotal: rawSubtotal,
      vat,
      total: ord.total,
      cartItems: getOrderCartItems(ord),
      notes: ord.notes || '',
      requiresApproval: false, // Kitchen has ALREADY approved, so proceed to payment collection!
    })
    setIsSuccessModalOpen(true)
  }

  const handleConfirmPayment = async (
    cashReceived: string,
    change: number | null,
    paymentMethod: string,
    paymentReference?: string
  ) => {
    // 1. Handling Payment for an approved bulk order
    if (approvedOrderForPayment) {
      const orderId = approvedOrderForPayment.id || approvedOrderForPayment.ref
      const total = Math.round(approvedOrderForPayment.total)
      if (paymentMethod === 'Cash') {
        const parsed = parseFloat(cashReceived)
        if (!cashReceived.trim() || isNaN(parsed) || parsed < total) {
          showNotice('Please input the received cash amount before confirming this order.', 'Payment Required')
          return
        }
      }
      if (paymentMethod === 'GCash' && (!paymentReference || !paymentReference.trim())) {
        showNotice('GCash Reference Number is required to confirm this order.', 'Reference Required')
        return
      }
      if (paymentMethod.startsWith('Hybrid') && (!paymentReference || !paymentReference.trim())) {
        showNotice('Reference Number is required for Hybrid payment to confirm this order.', 'Reference Required')
        return
      }

      const updatePayload = {
        status: 'CONFIRMED',
        paymentStatus: 'Paid',
        paymentMethod,
        paymentReference: paymentReference || null,
        referenceNumber: paymentReference || null,
        kitchenApprovalStatus: 'APPROVED',
        kitchen_approval_status: 'APPROVED',
      }

      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(result.message || 'Could not update payment for this order.')
        }
      } catch (err) {
        console.error('Update payment error:', err)
        showNotice(err instanceof Error ? err.message : 'Could not update payment for this order.', 'Payment Failed')
        return
      }

      const rawName = customerName.trim() || approvedOrderForPayment.customerName || approvedOrderForPayment.customer_name || approvedOrderForPayment.customer || lastOrderDetails?.customerName || ''
      const finalCustName = (rawName === 'Walk-In' || rawName === 'Walk-In Customer') ? '' : rawName

      try {
        const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
        const updated = existing.map((o: any) => {
          if (o.id === orderId || o.ref === orderId) {
            return {
              ...o,
              customer: finalCustName,
              customerName: finalCustName,
              status: 'CONFIRMED',
              paymentStatus: 'Paid',
              paymentMethod,
              paymentReference: paymentReference || null,
              referenceNumber: paymentReference || null,
              kitchenApprovalStatus: 'APPROVED',
              kitchen_approval_status: 'APPROVED',
            }
          }
          return o
        })
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
        notifyOrderSync()
      } catch (e) {
        console.warn('LocalStorage save warning:', e)
      }

      const rawSub = approvedOrderForPayment.subtotal || Math.round((total / 1.12) * 100) / 100
      const vatVal = approvedOrderForPayment.vat || Math.round((total - rawSub) * 100) / 100
      setLastOrderDetails({
        orderId,
        table: approvedOrderForPayment.table || 'N/A',
        type: approvedOrderForPayment.type || approvedOrderForPayment.orderType || 'Take Out',
        customerName: finalCustName,
        subtotal: rawSub,
        vat: vatVal,
        total,
        cartItems: getOrderCartItems(approvedOrderForPayment),
        notes: approvedOrderForPayment.notes || '',
        cashReceived,
        change,
        paymentMethod,
        paymentReference,
      })

      setApprovedOrderForPayment(null)
      setIsSuccessModalOpen(false)
      setIsReceiptModalOpen(true)
      fetchPosOrders()
      return
    }
    if (hasUnavailableItems) {
      showNotice('An item in your cart was just marked Out of Stock by the kitchen. Remove unavailable items before payment.', 'Item Unavailable')
      return
    }

    const rawSubtotal = cartItems.reduce((acc, ci) => {
      const basePrice = ci.item.basePrice || Math.round((ci.item.price / 1.12) * 100) / 100
      return acc + basePrice * ci.quantity
    }, 0)
    const vat = rawSubtotal * 0.12
    const total = Math.round(rawSubtotal + vat)

    if (paymentMethod === 'Cash') {
      const parsed = parseFloat(cashReceived)
      if (!cashReceived.trim() || isNaN(parsed) || parsed < total) {
        showNotice('Please input the received cash amount before confirming this order.', 'Payment Required')
        return
      }
    }
    if (paymentMethod === 'GCash' && (!paymentReference || !paymentReference.trim())) {
      showNotice('GCash Reference Number is required to confirm this order.', 'Reference Required')
      return
    }
    if (paymentMethod.startsWith('Hybrid') && (!paymentReference || !paymentReference.trim())) {
      showNotice('Reference Number is required for Hybrid payment to confirm this order.', 'Reference Required')
      return
    }
    const activeItemIds = new Set(menuItems.map((m) => m.id))
    const deletedInCart = cartItems.filter((ci) => !activeItemIds.has(ci.item.id))
    if (deletedInCart.length > 0) {
      const names = deletedInCart.map((ci) => ci.item.name).join(', ')
      showNotice(`The following item(s) are no longer on the menu: ${names}. They have been removed from the order.`, 'Items Unavailable')
      setCartItems((prev) => prev.filter((ci) => activeItemIds.has(ci.item.id)))
      setIsSuccessModalOpen(false)
      return
    }
    const orderId = `POS-${Date.now().toString().slice(-4)}`
    const rawName = customerName.trim() || (lastOrderDetails?.customerName !== 'Walk-In' && lastOrderDetails?.customerName !== 'Walk-In Customer' ? lastOrderDetails?.customerName : '') || ''
    const finalCustName = (rawName === 'Walk-In' || rawName === 'Walk-In Customer') ? '' : rawName

    const posOrderPayload = {
      id: orderId,
      ref: orderId,
      customerName: finalCustName,
      customer_name: finalCustName,
      customer: finalCustName,
      name: finalCustName,
      isPosOrder: true,
      status: 'CONFIRMED',
      orderType: orderType === 'Dine In' ? 'DINE_IN' : 'TAKE_OUT',
      type: orderType,
      paymentMethod,
      paymentReference: paymentReference || null,
      referenceNumber: paymentReference || null,
      notes: orderNotes,
      subtotal: rawSubtotal,
      vat: Math.round(vat * 100) / 100,
      deliveryFee: 0,
      total,
      cartItems: cartItems.map((ci) => ({
        productId: ci.item.id,
        name: ci.item.name,
        unit_price: ci.item.price,
        quantity: ci.quantity,
        notes: orderNotes || null,
        item: ci.item
      })),
    }

    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(posOrderPayload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409 || result.error === 'ITEM_DELETED' || result.error === 'ITEM_OUT_OF_STOCK') {
          showNotice(result.message || 'An item in this order is no longer available or was removed from the menu.', 'Item Unavailable')
          void refreshMenuItems()
          setIsSuccessModalOpen(false)
          return
        }
        throw new Error(result.message || 'Could not create the POS order.')
      }
    } catch (err) {
      console.error('POS order API error:', err)
      showNotice(err instanceof Error ? err.message : 'Could not create the POS order. Please try again.', 'Order Error')
      return
    }

    // Direct User Flow: POS Cashier -> Kitchen (Bypasses Rider and Assistant)
    const localOrderObj = {
      id: orderId,
      ref: orderId,
      dateTime: new Date().toLocaleString(),
      type: orderType,
      status: 'CONFIRMED',
      paymentStatus: 'Paid',
      customer: finalCustName,
      customerName: finalCustName,
      customer_name: finalCustName,
      name: finalCustName,
      isPosOrder: true,
      items: cartItems.map((ci) => `${ci.item.name} x${ci.quantity}`).join(', '),
      notes: orderNotes,
      total,
      paymentMethod,
      paymentReference: paymentReference || null,
      referenceNumber: paymentReference || null,
      cartItems: [...cartItems],
    }

    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      localStorage.setItem('seafudz_orders', JSON.stringify([localOrderObj, ...existing]))
      notifyOrderSync()
    } catch (e) {
      console.warn('LocalStorage save warning:', e)
    }

    setLastOrderDetails({
      table: 'N/A',
      type: orderType,
      customerName: finalCustName,
      subtotal: rawSubtotal,
      vat,
      total,
      cartItems: [...cartItems],
      notes: orderNotes,
      cashReceived,
      change,
      paymentMethod,
      paymentReference,
    })

    setIsSuccessModalOpen(false)
    setIsReceiptModalOpen(true)
    fetchPosOrders()
  }

  const handleCloseReceiptModal = () => {
    setIsReceiptModalOpen(false)
    setCartItems([])
    setOrderNotes('')
    setCustomerName('')
    setOrderType('Take Out')
    setLastOrderDetails(null)
  }

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 transition-all duration-300 pb-24 lg:pb-6 font-sans">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarCashier searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {/* POS Sub-Module Switcher Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-2xs gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveSubModule('new_order')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                activeSubModule === 'new_order'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>🛒</span>
              <span>New Order (POS Register)</span>
            </button>
            <button
              onClick={() => setActiveSubModule('processing_orders')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative ${
                activeSubModule === 'processing_orders'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>📋</span>
              <span>On-Site Processing Orders</span>
              {activeProcessingCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeSubModule === 'processing_orders' ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                }`}>
                  {activeProcessingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubModule('online_receipts')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative ${
                activeSubModule === 'online_receipts'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>🧾</span>
              <span>Online Receipts</span>
              {unprintedOnlineCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeSubModule === 'online_receipts' ? 'bg-white text-orange-600' : 'bg-amber-500 text-white'
                }`}>
                  {unprintedOnlineCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubModule('store_pickups')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative ${
                activeSubModule === 'store_pickups'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <span>🛍️</span>
              <span>Store Pickups</span>
              {pendingPickupCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeSubModule === 'store_pickups' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
                }`}>
                  {pendingPickupCount}
                </span>
              )}
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsAdminCreateOpen(true)}
                className="px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm bg-neutral-900 hover:bg-black text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <span>➕</span>
                <span>Create Transaction (Admin)</span>
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400 font-semibold px-2 hidden md:block">
            Userflow: <strong className="text-neutral-700">Cashier Official Receipt Printing</strong>
          </div>
        </div>

        {posNotification && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-extrabold shadow-2xs">
            <span>{posNotification}</span>
            <button onClick={() => setPosNotification(null)} className="text-emerald-700 font-black cursor-pointer">✕</button>
          </div>
        )}

        {/* SUB-MODULE 1: NEW POS ORDER REGISTER */}
        {activeSubModule === 'new_order' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
            <main className="lg:col-span-3 flex flex-col gap-4 sm:gap-6">
              <CategoryTabs
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                categories={categories}
              />

              <section className="flex-grow">
                <MenuGrid
                  items={filteredItems}
                  onAddToCart={handleAddToCart}
                  allowPriceEdit={isAdmin}
                  onUpdatePrice={handlePriceUpdate}
                />
              </section>
            </main>

            <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-6 h-full">
              <OrderSummary
                cartItems={cartItems}
                orderType={orderType}
                setOrderType={setOrderType}
                customerName={customerName}
                setCustomerName={setCustomerName}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
                onSetQuantity={handleSetQuantity}
                onConfirmOrder={handleConfirmOrder}
                isItemAvailable={isAvailable}
                onRemoveUnavailable={removeUnavailableItems}
                requiresApproval={bulkCheck.requiresApproval}
                flaggedItems={bulkCheck.flaggedItems}
              />
            </div>
          </div>
        )}

        {/* SUB-MODULE 2: ON-SITE PROCESSING ORDERS TRACKER */}
        {activeSubModule === 'processing_orders' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                {[
                  { id: 'all', label: 'All On-Site Orders' },
                  { id: 'kitchen', label: '1. In Kitchen / Preparing' },
                  { id: 'ready', label: '2. Ready to Serve / Pickup' },
                  { id: 'completed', label: '3. Completed' },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPosStatusFilter(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                      posStatusFilter === tab.id
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  placeholder="Search POS Ref, Dish name, Notes..."
                  className="w-full pl-9 pr-8 py-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 transition-all placeholder:text-neutral-400"
                />
                {posSearchQuery && (
                  <button
                    onClick={() => setPosSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 font-bold text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Orders Row-by-Row List (Paginated: 10 per page) */}
            {filteredPosOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                <span className="text-3xl block mb-2">📋</span>
                <h3 className="font-bold text-neutral-700 text-base">No on-site orders found</h3>
                <p className="text-xs mt-1">
                  {posSearchQuery ? `No results matching "${posSearchQuery}"` : 'Orders submitted at the POS cashier terminal will appear here for kitchen tracking.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Column Header Guide */}
                <div className="hidden xl:grid xl:grid-cols-12 gap-4 px-5 py-2.5 bg-neutral-100/70 border border-neutral-200/60 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-wider items-center">
                  <div className="xl:col-span-3">Order Ref & Status</div>
                  <div className="xl:col-span-4">Ordered Dishes & Notes</div>
                  <div className="xl:col-span-2 text-right">Payment & Total</div>
                  <div className="xl:col-span-3 text-right">Actions / Controls</div>
                </div>

                {paginatedPosOrders.map((ord, idx) => {
                  const s = (ord.status || '').toUpperCase()
                  const appStatus = (ord.kitchen_approval_status || ord.kitchenApprovalStatus || '').toUpperCase()
                  const reqApp = ord.requires_kitchen_approval === true || ord.requiresKitchenApproval === true

                  const isAwaitingApproval = s === 'AWAITING_KITCHEN_APPROVAL' || (reqApp && appStatus === 'PENDING')
                  const isKitchenRejected = s === 'KITCHEN_REJECTED' || appStatus === 'REJECTED'
                  const isApprovedWaitingPayment = (s === 'APPROVED_BY_KITCHEN' || appStatus === 'APPROVED') && String(ord.paymentStatus || '').toLowerCase() !== 'paid' && s !== 'CONFIRMED'
                  const isCancelled = s === 'CANCELLED' || isKitchenRejected
                  const isCompleted = ['COMPLETED', 'SERVED', 'DELIVERED'].includes(s)
                  const isReady = ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
                  const isCooking = ['PREPARING', 'COOKING', 'IN_PROCESS'].includes(s)
                  const dishes = parseOrderDishes(ord)
                  const orderTotalNum = typeof ord.total === 'number' ? ord.total : parseFloat(String(ord.total || 0).replace(/[^0-9.-]+/g, '')) || 0
                  const globalIdx = (posPage - 1) * POS_PAGE_SIZE + idx + 1

                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200 hover:border-neutral-300 transition-all shadow-2xs hover:shadow-xs"
                    >
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
                        {/* Col 1: Order Ref, Type, Time, Status (xl:col-span-3) */}
                        <div className="xl:col-span-3 flex items-start gap-3">
                          <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 font-black text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">POS</span>
                            <span className="text-sm font-black leading-tight">#{globalIdx}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs sm:text-sm text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200 truncate" title={`REF: ${String(ord.ref || ord.id || 'N/A')}`}>
                                REF: {String(ord.ref || ord.id || 'N/A')}
                              </span>
                              {isAwaitingApproval ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border bg-amber-50 text-amber-900 border-amber-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  Awaiting Approval
                                </span>
                              ) : isKitchenRejected ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border bg-rose-50 text-rose-800 border-rose-300">
                                  ● Declined by Kitchen
                                </span>
                              ) : isApprovedWaitingPayment ? (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border bg-emerald-50 text-emerald-800 border-emerald-300">
                                  ✓ Approved by Kitchen
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                    isCancelled
                                      ? 'bg-neutral-100 text-neutral-600 border-neutral-300'
                                      : isCompleted
                                      ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                                      : isReady
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 animate-pulse'
                                      : isCooking
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}
                                >
                                  ● {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : isReady ? 'Ready' : isCooking ? 'Cooking' : 'In Kitchen'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500">
                              <span className="font-extrabold text-neutral-800">{String(ord.type || 'On-Site Order')}</span>
                              {(() => {
                                const cName = String(ord.customerName || ord.customer_name || ord.customer || ord.name || '').trim();
                                if (cName && cName !== 'Walk-In' && cName !== 'Walk-In Customer') {
                                  return (
                                    <>
                                      <span>•</span>
                                      <span className="font-bold text-neutral-700">{cName}</span>
                                    </>
                                  );
                                }
                                return null;
                              })()}
                              <span>•</span>
                              <span>Placed {String(ord.dateTime || 'Just now')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Col 2: Ordered Dishes & Notes (xl:col-span-4) */}
                        <div className="xl:col-span-4 space-y-1">
                          <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">
                            Ordered Dishes ({dishes.reduce((acc, d) => acc + (d.quantity || 1), 0)}):
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                            {dishes.length === 0 ? (
                              <span className="text-xs text-neutral-400 italic">No item details recorded</span>
                            ) : (
                              dishes.map((d, dIdx) => {
                                const std = getProductQuantityStandard(d.name)
                                const isFlaggedDish = d.quantity >= std
                                return (
                                  <span
                                    key={dIdx}
                                    className={`inline-flex items-center gap-1 border rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                      isFlaggedDish
                                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                                        : 'bg-neutral-100 border-neutral-200/70 text-neutral-700'
                                    }`}
                                  >
                                    <span className="truncate max-w-[130px]">{d.name}</span>
                                    {isFlaggedDish && (
                                      <span className="text-[9px] bg-red-600 text-white font-black px-1 rounded">
                                        STD: {std}
                                      </span>
                                    )}
                                    <span className="font-mono font-black text-neutral-900">x{d.quantity}</span>
                                    {d.price > 0 && (
                                      <span className="text-neutral-500 font-mono text-[10px]">
                                        (₱{(d.price * d.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                                      </span>
                                    )}
                                  </span>
                                )
                              })
                            )}
                          </div>
                          {ord.notes && (
                            <p className="text-neutral-600 text-[11px] font-medium truncate" title={String(ord.notes)}>
                              Note: "{String(ord.notes)}"
                            </p>
                          )}
                        </div>

                        {/* Col 3: Payment & Total Amount (xl:col-span-2) */}
                        <div className="xl:col-span-2 text-left xl:text-right space-y-0.5">
                          <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">
                            {String(ord.paymentMethod || 'Paid (POS)')}
                          </span>
                          <span className="text-base font-black font-mono text-neutral-900 block">
                            ₱{orderTotalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Col 4: Cashier Controls / Actions (xl:col-span-3) */}
                        <div className="xl:col-span-3 flex flex-col gap-1.5 justify-center">
                          {isAwaitingApproval ? (
                            <div className="flex items-center gap-2 flex-wrap xl:justify-end">
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 font-extrabold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Awaiting Kitchen Action
                              </span>
                              <button
                                type="button"
                                onClick={() => promptCancelPosOrder(ord)}
                                className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                              >
                                <span>❌</span> Cancel
                              </button>
                            </div>
                          ) : isKitchenRejected ? (
                            <div className="flex items-center gap-2 flex-wrap xl:justify-end">
                              <span className="bg-rose-50 text-rose-800 border border-rose-200 font-extrabold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1">
                                <span>❌</span> Declined by Kitchen
                              </span>
                              <button
                                type="button"
                                onClick={() => promptCancelPosOrder(ord)}
                                className="bg-white hover:bg-neutral-100 text-rose-700 border border-rose-300 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : isApprovedWaitingPayment ? (
                            <div className="flex items-center gap-2 flex-wrap xl:justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentForApprovedOrder(ord)}
                                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                              >
                                <span>💳</span> Collect Payment & Print
                              </button>
                              <button
                                type="button"
                                onClick={() => promptCancelPosOrder(ord)}
                                className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                              >
                                <span>❌</span> Cancel
                              </button>
                            </div>
                          ) : !isCancelled && !isCompleted ? (
                            <div className="flex items-center gap-2 flex-wrap xl:justify-end">
                              {!isCooking && !isReady ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setModifyingPosOrder(ord)}
                                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-2xs flex items-center gap-1"
                                  >
                                    <span>✏️</span> Modify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => promptCancelPosOrder(ord)}
                                    className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                                  >
                                    <span>❌</span> Cancel
                                  </button>
                                </>
                              ) : isCooking ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-neutral-100 text-neutral-500 border border-neutral-200 font-semibold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-not-allowed">
                                    <span>🔒</span> Locked
                                  </span>
                                  <span className="bg-blue-50 text-blue-700 border border-blue-200 font-extrabold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1">
                                    <span>🍳</span> Cooking
                                  </span>
                                </div>
                              ) : isReady ? (
                                <button
                                  type="button"
                                  onClick={() => handleCompletePosOrder(ord.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                                >
                                  <span>✅</span> Mark Served
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {isCancelled && !isKitchenRejected && (
                            <div className="text-left xl:text-right text-xs font-bold text-neutral-400 py-0.5">
                              <span className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-500 text-[11px]">
                                Order Cancelled
                              </span>
                            </div>
                          )}

                          {isCompleted && (
                            <div className="text-left xl:text-right text-xs font-bold text-neutral-500 py-0.5">
                              <span className="bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 text-[11px]">
                                Served & Completed
                              </span>
                            </div>
                          )}

                          {isAdmin && (
                            <div className="flex items-center justify-start xl:justify-end gap-1.5 pt-1 border-t border-neutral-100">
                              <button
                                type="button"
                                onClick={() => setEditingPosOrder(ord)}
                                className="text-neutral-500 hover:text-neutral-800 text-[11px] font-bold px-2 py-0.5 rounded hover:bg-neutral-100 cursor-pointer"
                              >
                                ✏️ Edit
                              </button>
                              <span className="text-neutral-300">•</span>
                              <button
                                type="button"
                                onClick={() => handleDeletePosOrder(ord.id)}
                                className="text-rose-600 hover:text-rose-800 text-[11px] font-bold px-2 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {renderPagination(posPage, totalPosPages, filteredPosOrders.length, POS_PAGE_SIZE, setPosPage)}
              </div>
            )}
          </div>
        )}

        {/* SUB-MODULE 3: ONLINE RECEIPTS VIEW */}
        {activeSubModule === 'online_receipts' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Filter Controls */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900 flex items-center gap-2">
                  <span>🧾</span> Confirmed Online Receipts
                </h2>
                <p className="text-xs text-neutral-500 font-medium">
                  View and print official restaurant receipts for online delivery & GCash/COD orders confirmed by Assistant
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={onlineSearchQuery}
                    onChange={(e) => setOnlineSearchQuery(e.target.value)}
                    placeholder="Search Ref / Customer / Phone..."
                    className="w-full bg-neutral-100 text-neutral-900 border border-neutral-300/80 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-orange-500/30"
                  />
                  {onlineSearchQuery && (
                    <button
                      onClick={() => setOnlineSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 text-xs font-black cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Switcher */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-300/60">
                  <button
                    type="button"
                    onClick={() => setOnlineFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      onlineFilter === 'all'
                        ? 'bg-white text-orange-600 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    All ({onlineReceipts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineFilter('unprinted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      onlineFilter === 'unprinted'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>🖨️</span> Unprinted ({unprintedOnlineCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnlineFilter('printed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      onlineFilter === 'printed'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>✅</span> Printed ({onlineReceipts.length - unprintedOnlineCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Orders Row-by-Row List (FIFO Queue) */}
            {filteredOnlineReceipts.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
                <div className="text-4xl">🧾</div>
                <h3 className="text-base font-black text-neutral-800">No Confirmed Online Receipts Found</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  {onlineSearchQuery
                    ? `No online orders matched search "${onlineSearchQuery}".`
                    : onlineFilter === 'unprinted'
                    ? 'All confirmed online orders have already had their official receipts printed.'
                    : 'Confirmed online orders from customers will appear here once approved by the Assistant.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Column Header Guide */}
                <div className="hidden xl:grid xl:grid-cols-12 gap-4 px-5 py-2.5 bg-neutral-100/70 border border-neutral-200/60 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-wider items-center">
                  <div className="xl:col-span-3">Queue & Order Ref</div>
                  <div className="xl:col-span-3">Customer & Delivery Info</div>
                  <div className="xl:col-span-3">Ordered Dishes</div>
                  <div className="xl:col-span-1 text-right">Total</div>
                  <div className="xl:col-span-2 text-right">Actions</div>
                </div>

                {paginatedOnlineReceipts.map((ord, idx) => {
                  const globalIdx = (onlinePage - 1) * ONLINE_PAGE_SIZE + idx + 1
                  const orderId = ord.id || ord.ref
                  const isPrinted = Boolean(ord.isReceiptPrinted || (ord.receiptStatus || '').toUpperCase() === 'PRINTED')
                  const items = Array.isArray(ord.items) ? ord.items : []
                  const statusNorm = (ord.status || 'CONFIRMED').toUpperCase()

                  return (
                    <div
                      key={orderId}
                      className="bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs" 
                    >
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
                        {/* Col 1: Queue Rank, ID, Time, Print Badge (col-span-3) */}
                        <div className="xl:col-span-3 flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 font-black text-xs bg-neutral-100 text-neutral-700 border border-neutral-200">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-85">FIFO</span>
                            <span className="text-sm font-black leading-tight">#{globalIdx}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs sm:text-sm text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200 max-w-[180px] sm:max-w-[200px] truncate" title={`#${orderId}`}>
                                #{orderId}
                              </span>
                              {isPrinted ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1">
                                  <span>✅</span> Printed
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1 animate-pulse">
                                  <span>🖨️</span> Unprinted
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-500">
                              <span>🕒 {formatOrderTime(ord.createdAt || ord.created_at || ord.dateTime)}</span>
                              <span>•</span>
                              <span className="text-orange-600 font-extrabold text-[10px] uppercase">{statusNorm}</span>
                            </div>
                          </div>
                        </div>

                        {/* Col 2: Customer, Phone, Address, Payment (col-span-3) */}
                        <div className="xl:col-span-3 space-y-0.5 text-xs">
                          <div className="font-extrabold text-neutral-900 flex items-center gap-1.5">
                            <span className="text-neutral-400">👤</span>
                            <span className="truncate">{ord.customerName || ord.customer || 'Online Customer'}</span>
                          </div>
                          <div className="text-neutral-500 font-semibold text-[11px] flex items-center gap-1.5">
                            <span className="text-neutral-400">📞</span>
                            <span>{ord.phone || 'N/A'}</span>
                            <span className="text-neutral-300">•</span>
                            <span className="text-orange-600 font-extrabold">{ord.paymentMethod || 'GCash'}</span>
                          </div>
                          {ord.deliveryAddress && (
                            <div className="text-neutral-400 text-[11px] font-medium truncate flex items-center gap-1.5" title={ord.deliveryAddress}>
                              <span className="text-neutral-400 shrink-0">📍</span>
                              <span className="truncate">{ord.deliveryAddress}</span>
                            </div>
                          )}
                          {ord.deliveryProof && (
                            <div className="pt-0.5">
                              <span
                                onClick={() => setPreviewProofModalUrl(ord.deliveryProof)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
                              >
                                <span>📷</span> Delivery Photo Verified
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Col 3: Ordered Items (col-span-3) */}
                        <div className="xl:col-span-3">
                          <div className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider mb-1">
                            Items ({items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0)}):
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                            {items.length === 0 ? (
                              <span className="text-xs text-neutral-400 italic">No item details</span>
                            ) : (
                              items.map((it: any, iIdx: number) => (
                                <span
                                  key={iIdx}
                                  className="inline-flex items-center gap-1 bg-neutral-100 border border-neutral-200/70 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-neutral-700"
                                >
                                  <span className="truncate max-w-[120px]">{it.name || it.product_name_snapshot || 'Dish'}</span>
                                  <span className="font-mono font-black text-orange-600">x{it.quantity || 1}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Col 4: Total Amount (col-span-1) */}
                        <div className="xl:col-span-1 text-left xl:text-right">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block xl:hidden">
                            Total:
                          </span>
                          <span className="text-base font-black font-mono text-neutral-900">
                            ₱{Number(ord.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Col 5: Actions (col-span-2) */}
                        <div className="xl:col-span-2 flex items-center justify-start xl:justify-end gap-2">
                          {ord.deliveryProof && (
                            <button
                              type="button"
                              onClick={() => setPreviewProofModalUrl(ord.deliveryProof)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-2xs text-center flex items-center gap-1"
                              title="View Rider Proof of Delivery Photo"
                            >
                              <span>📷</span> Proof
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleViewOnlineReceipt(ord)}
                            className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-2xs text-center flex items-center gap-1"
                          >
                            <span>👁️</span> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintOnlineReceipt(ord)}
                            className={`font-black px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 text-white ${
                              isPrinted
                                ? 'bg-neutral-700 hover:bg-neutral-800 shadow-neutral-500/20'
                                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                            }`}
                          >
                            <span>🖨️</span>
                            <span>{isPrinted ? 'Re-print' : 'Print Receipt'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {renderPagination(onlinePage, totalOnlinePages, filteredOnlineReceipts.length, ONLINE_PAGE_SIZE, setOnlinePage)}
              </div>
            )}
          </div>
        )}

        {/* SUB-MODULE 4: STORE PICKUPS */}
        {activeSubModule === 'store_pickups' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Filter Controls */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-neutral-900 flex items-center gap-2">
                  <span>🛍️</span> Online Store Pick-Up Orders
                </h2>
                <p className="text-xs text-neutral-500 font-medium">
                  Manage store pick-ups, collect counter cash payments, print receipts, and hand over completed orders
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={pickupSearchQuery}
                    onChange={(e) => setPickupSearchQuery(e.target.value)}
                    placeholder="Search Ref / Customer / Phone..."
                    className="w-full bg-neutral-100 text-neutral-900 border border-neutral-300/80 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {pickupSearchQuery && (
                    <button
                      onClick={() => setPickupSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700 text-xs font-black cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Switcher */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-300/60">
                  <button
                    type="button"
                    onClick={() => setPickupFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      pickupFilter === 'all'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    All ({onlineReceipts.filter(isPickupOrder).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickupFilter('ready')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      pickupFilter === 'ready'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>🛍️</span> Ready ({readyPickupCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickupFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      pickupFilter === 'pending'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>🍳</span> Cooking ({onlineReceipts.filter((o) => isPickupOrder(o) && ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING'].includes((o.status || '').toUpperCase())).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickupFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      pickupFilter === 'completed'
                        ? 'bg-neutral-800 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <span>✓</span> Picked Up ({onlineReceipts.filter((o) => isPickupOrder(o) && ['COMPLETED', 'DELIVERED', 'SERVED'].includes((o.status || '').toUpperCase())).length})
                  </button>
                </div>
              </div>
            </div>

            {/* Pickups Table / Cards */}
            {filteredStorePickups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center shadow-2xs">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-100">
                  🛍️
                </div>
                <h3 className="text-base font-extrabold text-neutral-800">No Store Pick-Up Orders Found</h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
                  When customers select "Store Pick-Up" during checkout, their orders will appear here for preparation tracking and handover.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="hidden xl:grid xl:grid-cols-12 gap-4 px-5 py-2.5 bg-neutral-100/70 border border-neutral-200/60 rounded-xl text-[10px] font-black text-neutral-500 uppercase tracking-wider items-center">
                  <div className="xl:col-span-3">Queue & Order Ref</div>
                  <div className="xl:col-span-3">Customer & Pick-Up Info</div>
                  <div className="xl:col-span-3">Ordered Dishes</div>
                  <div className="xl:col-span-1 text-right">Total Due</div>
                  <div className="xl:col-span-2 text-right">Actions</div>
                </div>

                {paginatedStorePickups.map((ord, idx) => {
                  const globalIdx = (pickupPage - 1) * PICKUP_PAGE_SIZE + idx + 1
                  const orderId = ord.id || ord.ref
                  const isPrinted = Boolean(ord.isReceiptPrinted || (ord.receiptStatus || '').toUpperCase() === 'PRINTED')
                  const items = Array.isArray(ord.items) ? ord.items : []
                  const statusNorm = (ord.status || 'CONFIRMED').toUpperCase()
                  const isCompleted = ['COMPLETED', 'DELIVERED', 'SERVED'].includes(statusNorm)
                  const isReady = statusNorm === 'READY'
                  const isPayInStore = String(ord.paymentMethod || '').toUpperCase().includes('STORE') || ord.paymentMethod === 'PAY_IN_STORE' || ord.paymentMethod === 'COD'

                  return (
                    <div
                      key={orderId}
                      className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs ${
                        isReady ? 'border-emerald-400 ring-2 ring-emerald-500/10' : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
                        {/* Col 1: Queue Rank, ID, Time, Print Badge (col-span-3) */}
                        <div className="xl:col-span-3 flex items-center gap-3">
                          <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 font-black text-xs ${
                            isReady
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                              : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                          }`}>
                            <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-85">PICKUP</span>
                            <span className="text-sm font-black leading-tight">#{globalIdx}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs sm:text-sm text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-lg border border-neutral-200 max-w-[180px] sm:max-w-[200px] truncate" title={`#${orderId}`}>
                                #{orderId}
                              </span>
                              {isPrinted ? (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1">
                                  <span>✅</span> Printed
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center gap-1">
                                  <span>🖨️</span> Unprinted
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-semibold flex items-center gap-2">
                              <span>🕒 {formatOrderTime(ord.createdAt || ord.dateTime)}</span>
                              <span className="text-neutral-300">•</span>
                              <span className="text-emerald-700 font-bold">Pick-Up Fee: ₱0.00</span>
                            </div>
                          </div>
                        </div>

                        {/* Col 2: Customer, Contact, Pick-Up Details & Status (col-span-3) */}
                        <div className="xl:col-span-3 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs sm:text-sm text-neutral-900 truncate">
                              {ord.customerName || ord.customer || 'Online Customer'}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500 font-bold">
                              📞 {ord.phone || '0917-000-0000'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Status Badge */}
                            {isReady ? (
                              <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1 shadow-xs animate-pulse">
                                <span>🛍️</span> READY FOR PICK-UP
                              </span>
                            ) : isCompleted ? (
                              <span className="bg-neutral-800 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1">
                                <span>✓</span> PICKED UP
                              </span>
                            ) : statusNorm === 'PREPARING' ? (
                              <span className="bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1">
                                <span>🍳</span> COOKING IN KITCHEN
                              </span>
                            ) : (
                              <span className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1">
                                <span>✓</span> CONFIRMED
                              </span>
                            )}

                            {/* Payment Badge */}
                            {isPayInStore ? (
                              isCompleted ? (
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-black">
                                  💵 Paid in Store
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full text-[9px] font-black">
                                  ⚠️ Collect ₱{Number(ord.total || 0).toFixed(2)} Cash
                                </span>
                              )
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-black">
                                ✅ Paid Online (GCash)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Col 3: Ordered Dishes (col-span-3) */}
                        <div className="xl:col-span-3">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block xl:hidden mb-1">
                            Dishes Ordered:
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {items.length === 0 ? (
                              <span className="text-xs text-neutral-400 italic">No dishes itemized</span>
                            ) : (
                              items.map((it: any, i: number) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 rounded-md text-[11px] font-bold text-neutral-800 transition-colors"
                                >
                                  <span className="truncate max-w-[120px]">{it.name || it.product_name_snapshot || 'Dish'}</span>
                                  <span className="font-mono font-black text-emerald-700">x{it.quantity || 1}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Col 4: Total Amount (col-span-1) */}
                        <div className="xl:col-span-1 text-left xl:text-right">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block xl:hidden">
                            Total Due:
                          </span>
                          <span className="text-base font-black font-mono text-neutral-900">
                            ₱{Number(ord.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Col 5: Actions (col-span-2) */}
                        <div className="xl:col-span-2 flex items-center justify-start xl:justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleViewOnlineReceipt(ord)}
                            className="bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-2xs text-center flex items-center gap-1"
                          >
                            <span>👁️</span> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintOnlineReceipt(ord)}
                            className={`font-black px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 text-white ${
                              isPrinted
                                ? 'bg-neutral-700 hover:bg-neutral-800 shadow-neutral-500/20'
                                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                            }`}
                          >
                            <span>🖨️</span>
                            <span>{isPrinted ? 'Re-print' : 'Print'}</span>
                          </button>

                          {/* Handover Action Button: Only allowed once kitchen marks order as READY */}
                          {!isCompleted ? (
                            isReady ? (
                              isPayInStore ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHandoverModalOrder(ord)
                                    setCashTendered(String(ord.total || ''))
                                  }}
                                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                                  title="Collect cash from customer and hand over order"
                                >
                                  <span>💵</span>
                                  <span>Collect & Hand Over</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSubmittingHandover}
                                  onClick={() => handlePickupHandover(ord)}
                                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                                  title="Mark as picked up by customer"
                                >
                                  <span>🛍️</span>
                                  <span>Mark as Picked Up</span>
                                </button>
                              )
                            ) : (
                              <span
                                className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                                title="Order is still being prepared in the kitchen. Handover and claiming are available once the kitchen marks it as Ready."
                              >
                                <span>🍳</span> Cooking in Kitchen
                              </span>
                            )
                          ) : (
                            <span className="text-xs font-bold text-neutral-400 bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-xl">
                              ✓ Claimed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {renderPagination(pickupPage, totalPickupPages, filteredStorePickups.length, PICKUP_PAGE_SIZE, setPickupPage)}
              </div>
            )}
          </div>
        )}
      </div>

      {cartItems.length > 0 && activeSubModule === 'new_order' && (
        <div className="fixed bottom-3 left-3 right-3 lg:hidden z-40">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg flex items-center justify-between transition-all active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
              </span>
              <span className="text-sm font-medium">View Order</span>
            </div>
            <span className="text-sm font-bold">
              ₱{totalCartPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </button>
        </div>
      )}

      {isMobileCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden flex flex-col justify-end p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-h-[85vh] h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up">
            <OrderSummary
              cartItems={cartItems}
              orderType={orderType}
              setOrderType={setOrderType}
              customerName={customerName}
              setCustomerName={setCustomerName}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onSetQuantity={handleSetQuantity}
              onConfirmOrder={handleConfirmOrder}
              isItemAvailable={isAvailable}
              onRemoveUnavailable={removeUnavailableItems}
              onClose={() => setIsMobileCartOpen(false)}
              requiresApproval={bulkCheck.requiresApproval}
              flaggedItems={bulkCheck.flaggedItems}
            />
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        onConfirm={handleConfirmPayment}
        onSubmitForApproval={handleSubmitForKitchenApproval}
        requiresApproval={lastOrderDetails?.requiresApproval ?? bulkCheck.requiresApproval}
        flaggedItems={lastOrderDetails?.flaggedItems ?? bulkCheck.flaggedItems}
        customerName={customerName}
        setCustomerName={setCustomerName}
        orderDetails={lastOrderDetails}
        hasUnavailableItems={hasUnavailableItems}
        isItemAvailable={isAvailable}
        onRemoveUnavailable={removeUnavailableItems}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={handleCloseReceiptModal}
        orderDetails={lastOrderDetails}
        onPrintSuccess={() => {
          if (lastOrderDetails?.orderId) {
            void markOrderAsPrinted(lastOrderDetails.orderId)
          }
        }}
      />

      {/* ADMIN CRUD MODALS */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={() => fetchPosOrders()}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingPosOrder)}
        transaction={editingPosOrder}
        onClose={() => setEditingPosOrder(null)}
        onSave={() => fetchPosOrders()}
      />

      {/* CASHIER MINIMAL MODIFY ORDER POPUP */}
      <PosModifyOrderModal
        isOpen={Boolean(modifyingPosOrder)}
        order={modifyingPosOrder}
        onClose={() => setModifyingPosOrder(null)}
        onSave={(updated) => {
          fetchPosOrders()
          setPosNotification(`Order #${updated.ref || updated.id} modified successfully!`)
        }}
        menuItems={menuItems}
        isItemAvailable={isAvailable}
      />

      {/* CASHIER CANCEL CONFIRMATION POPUP MODAL (NO BLUR, ZERO LAG) */}
      <CancelConfirmModal
        isOpen={Boolean(orderToCancel)}
        orderId={orderToCancel ? (orderToCancel.ref || orderToCancel.id) : null}
        orderType={orderToCancel?.type || 'On-Site Order'}
        total={orderToCancel?.total}
        onClose={() => setOrderToCancel(null)}
        onConfirm={handleConfirmCancel}
        isCancelling={isCancellingOrder}
      />

      {/* Proof of Delivery Image Preview Modal */}
      {previewProofModalUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewProofModalUrl(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 text-white border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-bold">Rider Proof of Delivery Photo</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-neutral-950 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={previewProofModalUrl}
                alt="Proof of Delivery Full Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-neutral-100 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 shadow-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Collection & Handover Modal for Pay-in-Store Pickups */}
      {handoverModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setHandoverModalOrder(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-amber-500 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  💵
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Collect Cash & Hand Over</h3>
                  <p className="text-xs text-amber-100 font-medium mt-0.5">
                    Store Pick-Up Order #{handoverModalOrder.id || handoverModalOrder.ref}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Customer</span>
                  <p className="text-sm font-black text-neutral-900">{handoverModalOrder.customerName || handoverModalOrder.customer || 'Online Customer'}</p>
                  <p className="text-xs text-neutral-500 font-mono font-bold mt-0.5">📞 {handoverModalOrder.phone || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Total Due</span>
                  <p className="text-xl font-black font-mono text-amber-600">
                    ₱{Number(handoverModalOrder.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Cash Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 block">
                  Cash Tendered (₱) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-base font-bold text-neutral-400">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    autoFocus
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder="Enter cash amount received"
                    className="w-full pl-8 pr-4 py-2.5 bg-neutral-50 text-neutral-900 border border-neutral-300 rounded-xl text-base font-black font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setCashTendered(String(handoverModalOrder.total || 0))}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                >
                  Exact
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('500')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                >
                  ₱500
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('1000')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                >
                  ₱1,000
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('2000')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-200 cursor-pointer transition-colors"
                >
                  ₱2,000
                </button>
              </div>

              {/* Change Calculation */}
              {Number(cashTendered) > 0 && (
                <div className={`rounded-xl p-3 border flex items-center justify-between ${
                  Number(cashTendered) >= Number(handoverModalOrder.total || 0)
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                  <span className="text-xs font-bold">
                    {Number(cashTendered) >= Number(handoverModalOrder.total || 0) ? 'Change to Return:' : 'Insufficient Amount:'}
                  </span>
                  <span className="text-base font-black font-mono">
                    ₱{Math.abs(Number(cashTendered) - Number(handoverModalOrder.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setHandoverModalOrder(null)}
                className="px-4 py-2.5 text-xs font-extrabold text-neutral-600 hover:text-neutral-800 bg-white border border-neutral-300 rounded-xl cursor-pointer hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingHandover || !cashTendered || Number(cashTendered) < Number(handoverModalOrder.total || 0)}
                onClick={() => handlePickupHandover(handoverModalOrder, Number(cashTendered))}
                className="px-5 py-2.5 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl cursor-pointer shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5"
              >
                {isSubmittingHandover ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Confirm Payment & Hand Over</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

export default POS
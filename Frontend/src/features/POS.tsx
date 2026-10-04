import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { MenuGrid } from '../components/MenuGrid'
import { OrderSummary } from '../components/OrderSummary'
import { SuccessModal } from '../components/SuccessModal'
import { ReceiptModal } from './ReceiptModal'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import type { CartItem } from '../components/OrderItemRow'
import { API_BASE_URL } from '../utils/api'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { useMenuPrices } from '../utils/menuPriceManager'
import { NavbarCashier } from '../components/NavbarCashier'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'

export const POS: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const { getEffectivePrice, updatePrice } = useMenuPrices()

  const [menuItems] = useState<MenuItem[]>(CLIENT_MENU_ITEMS)
  const [categories] = useState<string[]>(CLIENT_CATEGORIES)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Menu')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState('Take Out')
  const [orderNotes, setOrderNotes] = useState('')
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)

  // Sub-module navigation state: 'new_order' | 'processing_orders' | 'online_receipts'
  const [activeSubModule, setActiveSubModule] = useState<'new_order' | 'processing_orders' | 'online_receipts'>('new_order')
  const [posOrders, setPosOrders] = useState<any[]>([])
  const [posSearchQuery, setPosSearchQuery] = useState('')
  const [posStatusFilter, setPosStatusFilter] = useState<'all' | 'kitchen' | 'ready' | 'completed' | 'cancelled'>('all')
  const [posNotification, setPosNotification] = useState<string | null>(null)
  
  // Online Receipts State for Cashier
  const [onlineReceipts, setOnlineReceipts] = useState<any[]>([])
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('')
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'unprinted' | 'printed'>('unprinted')

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingPosOrder, setEditingPosOrder] = useState<any | null>(null)

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
    customerName?: string
    phone?: string
    address?: string
  } | null>(null)

  // Fetch On-Site POS Orders for Cashier Sub-Module
  const fetchPosOrders = useCallback(() => {
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (!stored) {
        setPosOrders([])
        return
      }
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return

      // STRICT FILTER: Only On-Site POS orders (Dine In & Take Out / isPosOrder / Walk-In)
      const onSiteOrders = parsed.filter((o: any) => {
        const rawType = (o.type || o.order_type || '').toLowerCase()
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

      const localStr = localStorage.getItem('seafudz_orders')
      const localParsed = localStr ? JSON.parse(localStr) : []
      const onlineLocal = Array.isArray(localParsed)
        ? localParsed.filter((o: any) => {
            const typeStr = (o.type || o.order_type || '').toLowerCase()
            const isOnline = typeStr.includes('online') || typeStr.includes('delivery') || Boolean(o.deliveryAddress || o.address || o.customer || o.customerName)
            const s = (o.status || '').toUpperCase()
            const isConfirmedOrLater = ['CONFIRMED', 'PREPARING', 'IN_PROCESS', 'COOKING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(s)
            return isOnline && isConfirmedOrLater
          })
        : []

      const mergedMap = new Map<string, any>()
      apiData.forEach((o) => {
        if (o.id) mergedMap.set(String(o.id), o)
      })

      onlineLocal.forEach((o) => {
        const idStr = String(o.id || o.ref)
        if (!mergedMap.has(idStr)) {
          mergedMap.set(idStr, {
            id: idStr,
            ref: idStr,
            customerName: o.customer || o.customerName || 'Online Customer',
            phone: o.phone || '0917-000-0000',
            deliveryAddress: o.address || o.deliveryAddress || 'Delivery Address',
            paymentMethod: o.paymentMethod || 'GCash',
            receiptStatus: o.receiptStatus || (o.isReceiptPrinted ? 'PRINTED' : 'UNPRINTED'),
            isReceiptPrinted: Boolean(o.isReceiptPrinted || o.receiptStatus === 'PRINTED'),
            status: (o.status || 'CONFIRMED').toUpperCase(),
            subtotal: o.subtotal || o.total || 0,
            vat: o.vat || 0,
            deliveryFee: o.deliveryFee || 50,
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
          if (o.isReceiptPrinted || o.receiptStatus === 'PRINTED') {
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
    }, 8000)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchPosOrders, fetchOnlineReceipts])

  // Action: Cashier cancels an on-site processing order (ONLY eligible when still in queue, not cooking)
  const handleCancelPosOrder = async (orderId: string) => {
    const targetOrder = posOrders.find((o) => o.id === orderId || o.ref === orderId)
    if (targetOrder) {
      const s = (targetOrder.status || '').toUpperCase()
      const isCookingOrLater = ['PREPARING', 'COOKING', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(s)
      if (isCookingOrLater) {
        alert('This order is already being prepared/cooked in the kitchen and can no longer be cancelled.')
        return
      }
    }

    const confirmCancel = window.confirm(`Are you sure you want to cancel POS Order #${orderId}?`)
    if (!confirmCancel) return

    try {
      const res = await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })

      const resData = await res.json().catch(() => ({}))
      if (!res.ok && resData.message) {
        alert(resData.message)
        fetchPosOrders()
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
  }

  // Action: Cashier marks a ready on-site order as completed/served (ONLY enabled when kitchen marks it ready)
  const handleCompletePosOrder = async (orderId: string) => {
    const targetOrder = posOrders.find((o) => o.id === orderId || o.ref === orderId)
    if (targetOrder) {
      const s = (targetOrder.status || '').toUpperCase()
      const isReady = ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
      if (!isReady) {
        alert('Cannot mark order as served yet. Please wait for the kitchen to mark the order as Done / Ready.')
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

  const unprintedOnlineCount = useMemo(() => {
    return onlineReceipts.filter(
      (o) => !o.isReceiptPrinted && (o.receiptStatus || '').toUpperCase() !== 'PRINTED'
    ).length
  }, [onlineReceipts])

  const formatOrderTime = (rawDateStr?: string) => {
    if (!rawDateStr) return 'Today'
    const d = new Date(rawDateStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return String(rawDateStr)
  }

  const parseOrderTimestamp = (o: any) => {
    const val = o.createdAt || o.created_at || o.dateTime
    if (!val) return 0
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.getTime()
    return 0
  }

  const filteredOnlineReceipts = useMemo(() => {
    const filtered = onlineReceipts.filter((o) => {
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

    // Strict FIFO sorting by creation timestamp (oldest first: Order A 10:01 AM before Order B 10:05 AM)
    return filtered.sort((a, b) => parseOrderTimestamp(a) - parseOrderTimestamp(b))
  }, [onlineReceipts, onlineFilter, onlineSearchQuery])

  const handlePrepareReceiptDetails = (order: any) => {
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
    const calcDeliveryFee = typeof order.deliveryFee === 'number' ? order.deliveryFee : 50
    const calcTotal = typeof order.total === 'number' ? order.total : Math.round(calcSubtotal + calcVat + calcDeliveryFee)

    return {
      orderId: order.id || order.ref,
      table: 'N/A',
      type: 'ONLINE / Delivery',
      total: calcTotal,
      subtotal: calcSubtotal,
      vat: calcVat,
      deliveryFee: calcDeliveryFee,
      cartItems: itemsList,
      paymentMethod: order.paymentMethod || 'GCash',
      customerName: order.customerName || order.customer || 'Online Customer',
      phone: order.phone || '0917-000-0000',
      address: order.deliveryAddress || order.address || 'Delivery Address',
    }
  }

  const handleViewOnlineReceipt = (order: any) => {
    setLastOrderDetails(handlePrepareReceiptDetails(order))
    setIsReceiptModalOpen(true)
  }

  const handlePrintOnlineReceipt = async (order: any) => {
    const orderId = order.id || order.ref

    // Immediately mark printed in local state so order moves out of Unprinted list to Printed tab
    setOnlineReceipts((prev) =>
      prev.map((o) =>
        o.id === orderId || o.ref === orderId
          ? { ...o, isReceiptPrinted: true, receiptStatus: 'PRINTED' }
          : o
      )
    )

    try {
      await fetch(`${API_BASE_URL}/cashier/online-receipts/${orderId}/print`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    } catch {}

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
      notifyOrderSync()
    } catch {}

    setLastOrderDetails(handlePrepareReceiptDetails(order))
    setIsReceiptModalOpen(true)
    setPosNotification(`Official Restaurant Receipt printed & recorded for Online Order #${orderId}`)
  }

  const filteredPosOrders = useMemo(() => {
    return posOrders.filter((o) => {
      const s = (o.status || '').toUpperCase()
      const matchesFilter =
        posStatusFilter === 'all'
          ? true
          : posStatusFilter === 'kitchen'
          ? ['CONFIRMED', 'IN KITCHEN', 'PREPARING', 'COOKING', 'IN_PROCESS'].includes(s)
          : posStatusFilter === 'ready'
          ? ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
          : posStatusFilter === 'completed'
          ? ['COMPLETED', 'SERVED', 'DELIVERED'].includes(s)
          : posStatusFilter === 'cancelled'
          ? s === 'CANCELLED'
          : true

      if (!matchesFilter) return false

      if (!posSearchQuery.trim()) return true
      const q = posSearchQuery.toLowerCase()
      const ref = (o.ref || o.id || '').toLowerCase()
      const items = String(o.items || '').toLowerCase()
      const notes = (o.notes || '').toLowerCase()
      const type = (o.type || '').toLowerCase()
      return ref.includes(q) || items.includes(q) || notes.includes(q) || type.includes(q)
    })
  }, [posOrders, posStatusFilter, posSearchQuery])

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0)
  }, [cartItems])

  const totalCartPrice = useMemo(() => {
    const rawSubtotal = cartItems.reduce((acc, item) => acc + item.item.price * item.quantity, 0)
    return Math.round(rawSubtotal * 1.12)
  }, [cartItems])

  const filteredItems = useMemo(() => {
    return menuItems
      .map((item) => ({
        ...item,
        price: getEffectivePrice(item.id, item.price),
      }))
      .filter((item) => {
        const matchesSearch =
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesCategory =
          selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()

        return matchesSearch && matchesCategory
      })
  }, [menuItems, searchQuery, selectedCategory, getEffectivePrice])

  const handlePriceUpdate = (item: MenuItem, newPrice: number) => {
    updatePrice(item.id, newPrice)
    setCartItems((prev) =>
      prev.map((ci) =>
        ci.item.id === item.id ? { ...ci, item: { ...ci.item, price: newPrice } } : ci
      )
    )
  }

  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((ci) => ci.item.id === item.id)
      if (existing) {
        return prevItems.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      }
      return [...prevItems, { item, quantity: 1 }]
    })
  }

  const handleIncrement = (itemId: string) => {
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

  const handleRemove = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter((ci) => ci.item.id !== itemId))
  }

  const handleConfirmOrder = () => {
    if (cartItems.length === 0) return

    const rawSubtotal = cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)
    const totalWithVat = Math.round(rawSubtotal * 1.12)

    setLastOrderDetails({
      table: 'N/A',
      type: orderType,
      total: totalWithVat,
      cartItems: [...cartItems],
      notes: orderNotes,
    })
    setIsMobileCartOpen(false)
    setIsSuccessModalOpen(true)
  }

  const handleCloseSuccessModal = () => {
    setCartItems([])
    setOrderNotes('')
    setIsSuccessModalOpen(false)
    setLastOrderDetails(null)
  }

  const handleConfirmPayment = async (cashReceived: string, change: number | null, paymentMethod: string) => {
    const rawSubtotal = cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)
    const vat = rawSubtotal * 0.12
    const total = Math.round(rawSubtotal + vat)
    const orderId = `POS-${Date.now().toString().slice(-4)}`

    const posOrderPayload = {
      id: orderId,
      ref: orderId,
      isPosOrder: true,
      status: 'CONFIRMED',
      orderType: orderType === 'Dine In' ? 'DINE_IN' : 'TAKE_OUT',
      type: orderType,
      paymentMethod,
      notes: orderNotes,
      subtotal: rawSubtotal,
      vat: Math.round(vat),
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
      await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(posOrderPayload),
      })
    } catch (err) {
      console.error('POS order API error:', err)
    }

    // Direct User Flow: POS Cashier -> Kitchen (Bypasses Rider and Assistant)
    const localOrderObj = {
      id: orderId,
      ref: orderId,
      dateTime: new Date().toLocaleString(),
      type: orderType,
      status: 'CONFIRMED',
      paymentStatus: 'Paid',
      customer: 'Walk-In',
      isPosOrder: true,
      items: cartItems.map((ci) => `${ci.item.name} x${ci.quantity}`).join(', '),
      notes: orderNotes,
      total,
      paymentMethod,
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
      total,
      cartItems: [...cartItems],
      notes: orderNotes,
      cashReceived,
      change,
      paymentMethod,
    })

    setIsSuccessModalOpen(false)
    setIsReceiptModalOpen(true)
    fetchPosOrders()
  }

  const handleCloseReceiptModal = () => {
    setIsReceiptModalOpen(false)
    setCartItems([])
    setOrderNotes('')
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
                  showAvailabilityToggle={true}
                  allowPriceEdit={true}
                  onUpdatePrice={handlePriceUpdate}
                />
              </section>
            </main>

            <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-6 h-full">
              <OrderSummary
                cartItems={cartItems}
                orderType={orderType}
                setOrderType={setOrderType}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
                onConfirmOrder={handleConfirmOrder}
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

            {/* Orders Grid */}
            {filteredPosOrders.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                <span className="text-3xl block mb-2">📋</span>
                <h3 className="font-bold text-neutral-700 text-base">No on-site orders found</h3>
                <p className="text-xs mt-1">
                  {posSearchQuery ? `No results matching "${posSearchQuery}"` : 'Orders submitted at the POS cashier terminal will appear here for kitchen tracking.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredPosOrders.map((ord) => {
                  const s = (ord.status || '').toUpperCase()
                  const isCancelled = s === 'CANCELLED'
                  const isCompleted = ['COMPLETED', 'SERVED', 'DELIVERED'].includes(s)
                  const isReady = ['READY', 'PREPARED', 'READY TO SERVE'].includes(s)
                  const isCooking = ['PREPARING', 'COOKING', 'IN_PROCESS'].includes(s)

                  return (
                    <div
                      key={ord.id}
                      className={`bg-white rounded-3xl p-5 border transition-all shadow-xs flex flex-col justify-between gap-4 ${
                        isCancelled
                          ? 'border-rose-200 bg-rose-50/20'
                          : isCompleted
                          ? 'border-neutral-200 bg-neutral-50/50'
                          : isReady
                          ? 'border-emerald-300 ring-2 ring-emerald-500/10'
                          : 'border-orange-200'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                          <div>
                            <span className="text-xs font-black uppercase text-orange-600 tracking-wider">
                              REF: {ord.ref || ord.id}
                            </span>
                            <h4 className="font-extrabold text-neutral-900 text-base mt-0.5">
                              {ord.type || 'On-Site Order'}
                            </h4>
                            <p className="text-[11px] text-neutral-400 font-medium">Placed {ord.dateTime || 'Just now'}</p>
                          </div>

                          {/* Status Badge */}
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                              isCancelled
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : isCompleted
                                ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                                : isReady
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 animate-pulse'
                                : isCooking
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            ● {isCancelled ? 'Cancelled' : isCompleted ? 'Completed' : isReady ? 'Ready to Serve' : isCooking ? 'Cooking in Kitchen' : 'In Kitchen Queue'}
                          </span>
                        </div>

                        {/* Items Breakdown */}
                        <div className="space-y-1 text-xs text-neutral-700 font-medium bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                          <p className="font-bold text-neutral-400 uppercase text-[10px] tracking-wider mb-1">Ordered Dishes:</p>
                          {Array.isArray(ord.cartItems) ? (
                            ord.cartItems.map((ci: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <span>{ci.item?.name || ci.name} <strong className="text-neutral-900">x{ci.quantity}</strong></span>
                                <span className="font-bold text-neutral-500">₱{((ci.item?.price || ci.price || 0) * ci.quantity).toLocaleString()}</span>
                              </div>
                            ))
                          ) : (
                            <p>{ord.items}</p>
                          )}

                          {ord.notes && (
                            <p className="text-orange-600 text-[11px] font-semibold pt-1 border-t border-neutral-200 mt-1">
                              Note: "{ord.notes}"
                            </p>
                          )}
                        </div>

                        {/* Total & Payment mode */}
                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="text-neutral-500 font-semibold">Payment: <strong className="text-neutral-800">{ord.paymentMethod || 'Paid (POS)'}</strong></span>
                          <span className="text-base font-black text-orange-600">₱{Number(ord.total || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Cashier Controls */}
                      <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2">
                        {!isCancelled && !isCompleted && (
                          <div className="flex gap-2 w-full">
                            {!isCooking && !isReady ? (
                              <button
                                type="button"
                                onClick={() => handleCancelPosOrder(ord.id)}
                                className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1"
                              >
                                <span>❌</span> Cancel Order
                              </button>
                            ) : (
                              <div className="flex-1 bg-neutral-100 text-neutral-500 font-bold py-2 rounded-xl text-[11px] text-center border border-neutral-200 flex items-center justify-center gap-1">
                                <span>🍳</span> Cooking in Kitchen
                              </div>
                            )}

                            {isReady ? (
                              <button
                                type="button"
                                onClick={() => handleCompletePosOrder(ord.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1"
                              >
                                <span>✅</span> Mark Served
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="flex-1 bg-neutral-100 text-neutral-400 font-extrabold py-2.5 rounded-xl text-xs cursor-not-allowed border border-neutral-200 opacity-70 flex items-center justify-center gap-1"
                                title="Kitchen has not marked this order as Done yet"
                              >
                                <span>🔒</span> Mark Served
                              </button>
                            )}
                          </div>
                        )}

                        {isCancelled && (
                          <div className="w-full text-center text-xs font-bold text-rose-700 bg-rose-50 py-2 rounded-xl border border-rose-200">
                            Order Cancelled
                          </div>
                        )}

                        {isCompleted && (
                          <div className="w-full text-center text-xs font-bold text-emerald-800 bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                            Order Served & Completed
                          </div>
                        )}

                        {isAdmin && (
                          <div className="pt-2 border-t border-amber-200/60 bg-amber-50/50 p-2 rounded-xl flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                              Admin Controls:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingPosOrder(ord)}
                                className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePosOrder(ord.id)}
                                className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1 rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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

            {/* Orders Cards Grid */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredOnlineReceipts.map((ord) => {
                  const orderId = ord.id || ord.ref
                  const isPrinted = Boolean(ord.isReceiptPrinted || (ord.receiptStatus || '').toUpperCase() === 'PRINTED')
                  const items = Array.isArray(ord.items) ? ord.items : []
                  const statusNorm = (ord.status || 'CONFIRMED').toUpperCase()

                  return (
                    <div
                      key={orderId}
                      className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4"
                    >
                      {/* Top Bar: Ref ID & Receipt Print Badge */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-sm text-neutral-900 tracking-wide font-mono bg-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-200">
                            #{orderId}
                          </span>

                          {/* Printed / Unprinted Badge */}
                          {isPrinted ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                              <span>✅</span> Receipt Printed
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 animate-pulse">
                              <span>🖨️</span> Unprinted
                            </span>
                          )}
                        </div>

                        {/* Order Type & Fulfillment Status Badges */}
                        <div className="flex items-center justify-between text-xs mb-3">
                          <span className="font-bold text-neutral-500 text-[11px]">
                            {formatOrderTime(ord.createdAt || ord.created_at || ord.dateTime)}
                          </span>
                          <span className="bg-orange-50 text-orange-700 border border-orange-200 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                            Status: {statusNorm}
                          </span>
                        </div>

                        {/* Customer Metadata Card */}
                        <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/70 space-y-1 text-xs mb-3">
                          <div className="flex justify-between items-center font-bold text-neutral-800">
                            <span className="text-neutral-500 text-[11px]">Customer:</span>
                            <span className="truncate max-w-[150px]">{ord.customerName || ord.customer || 'Online Customer'}</span>
                          </div>
                          <div className="flex justify-between items-center font-bold text-neutral-800">
                            <span className="text-neutral-500 text-[11px]">Phone:</span>
                            <span>{ord.phone || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center font-bold text-neutral-800">
                            <span className="text-neutral-500 text-[11px]">Payment:</span>
                            <span className="text-orange-600">{ord.paymentMethod || 'GCash'}</span>
                          </div>
                          {ord.deliveryAddress && (
                            <div className="text-[10px] text-neutral-600 pt-1 border-t border-neutral-200/60 font-medium">
                              <span className="font-bold text-neutral-500">Address: </span>
                              {ord.deliveryAddress}
                            </div>
                          )}
                        </div>

                        {/* Ordered Items Preview */}
                        <div className="space-y-1 mb-3 max-h-28 overflow-y-auto pr-1">
                          <div className="text-[10px] font-extrabold text-neutral-400 tracking-wider uppercase mb-1">
                            Items ({items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0)})
                          </div>
                          {items.map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs font-semibold text-neutral-700">
                              <span className="truncate">{it.name || it.product_name_snapshot || 'Seafood Item'}</span>
                              <span className="text-neutral-400 font-mono ml-2">
                                x{it.quantity || 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Section: Total & Actions */}
                      <div className="pt-3 border-t border-neutral-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-neutral-500">Total Amount:</span>
                          <span className="text-base font-black text-neutral-900 font-mono">
                            ₱{Math.round(ord.total || 0).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewOnlineReceipt(ord)}
                            className="flex-1 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer active:scale-95 shadow-2xs text-center"
                          >
                            👁️ View Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintOnlineReceipt(ord)}
                            className={`flex-1 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5 ${
                              isPrinted
                                ? 'bg-neutral-800 hover:bg-black'
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
              ₱{totalCartPrice.toLocaleString()}
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
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onRemove={handleRemove}
              onConfirmOrder={handleConfirmOrder}
              onClose={() => setIsMobileCartOpen(false)}
            />
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        onConfirm={handleConfirmPayment}
        orderDetails={lastOrderDetails}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={handleCloseReceiptModal}
        orderDetails={lastOrderDetails}
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
    </div>
  )
}

export default POS
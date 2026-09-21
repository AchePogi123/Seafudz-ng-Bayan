import React, { useState, useMemo, useEffect } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { MenuGrid } from '../components/MenuGrid'
import { OrderSummary } from '../components/OrderSummary'
import { SuccessModal } from '../components/SuccessModal'
import { ReceiptModal } from './ReceiptModal'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import type { CartItem } from '../components/OrderItemRow'
import { API_BASE_URL } from '../utils/api'
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

  // Sub-module navigation state: 'new_order' vs 'processing_orders'
  const [activeSubModule, setActiveSubModule] = useState<'new_order' | 'processing_orders'>('new_order')
  const [posOrders, setPosOrders] = useState<any[]>([])
  const [posSearchQuery, setPosSearchQuery] = useState('')
  const [posStatusFilter, setPosStatusFilter] = useState<'all' | 'kitchen' | 'ready' | 'completed' | 'cancelled'>('all')
  const [posNotification, setPosNotification] = useState<string | null>(null)
  
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
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    fetchPosOrders()
    setPosNotification(`Order #${orderId} permanently deleted from DB by Admin.`)
  }

  const [lastOrderDetails, setLastOrderDetails] = useState<{
    table: string
    type: string
    total: number
    cartItems: CartItem[]
    notes?: string
    cashReceived?: string
    change?: number | null
    paymentMethod?: string
  } | null>(null)

  // Fetch On-Site POS Orders for Cashier Sub-Module
  const fetchPosOrders = () => {
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
  }

  useEffect(() => {
    fetchPosOrders()
    const handleSync = () => fetchPosOrders()
    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)
    const interval = setInterval(fetchPosOrders, 5000)
    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
      clearInterval(interval)
    }
  }, [])

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
      window.dispatchEvent(new Event('seafudz_order_created'))
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
      window.dispatchEvent(new Event('seafudz_order_created'))
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
      window.dispatchEvent(new Event('seafudz_order_created'))
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
          <div className="flex items-center gap-2">
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
            Userflow: <strong className="text-neutral-700">POS Cashier ➔ Kitchen Display</strong> (Rider Excluded)
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
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { NavbarAssistant } from '../components/NavbarAssistant'
import { API_BASE_URL } from '../utils/api'
import { checkIfBulkOrder } from '../utils/bulkOrder'

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

export interface OnlineOrder {
  id: string
  ref: string
  customer: string
  phone: string
  address: string
  paymentMethod: string
  paymentReference?: string
  paymentReceipt?: string
  status: 'pending' | 'flagged' | 'pending_preparation' | 'preparing' | 'assigned' | 'confirmed' | 'ready' | 'out_for_delivery' | 'completed' | string
  items: OrderItem[]
  total: number
  createdAt: string
  correctionNote?: string
  riderId?: string
  assignedRiderName?: string
}

export interface Rider {
  id: string
  name: string
  status: 'Available' | 'Busy - 1 delivery active' | 'Offline'
  vehicle: string
  phone: string
}


export const AssistantRole: React.FC = () => {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'dispatch' | 'all'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  const validatePhone = (phoneStr: string): { isValid: boolean; cleaned: string } => {
    const cleaned = phoneStr.replace(/[^0-9+]/g, '')
    if (cleaned.startsWith('+639')) return { isValid: cleaned.length === 13, cleaned }
    if (cleaned.startsWith('09')) return { isValid: cleaned.length === 11, cleaned }
    return { isValid: false, cleaned }
  }

  const validateAddress = (addressStr: string): { isComplete: boolean; warningMsg?: string } => {
    const cleaned = addressStr.trim()
    if (cleaned.length === 0) return { isComplete: false, warningMsg: 'Address is missing.' }
    if (cleaned.length < 10) return { isComplete: false, warningMsg: 'Address details seem too short.' }
    return { isComplete: true }
  }

  const customerNameValid = selectedOrder ? selectedOrder.customer.trim().length > 0 : false
  const phoneValidation = selectedOrder ? validatePhone(selectedOrder.phone) : { isValid: false, cleaned: '' }
  const addressValidation = selectedOrder ? validateAddress(selectedOrder.address) : { isComplete: false, warningMsg: '' }

  const isFetchingRef = useRef(false)
  const lastFetchRef = useRef(0)

  // Fetch live orders from central backend & local store
  const fetchAssistantOrders = async (force?: boolean | unknown) => {
    if (isFetchingRef.current) return
    const isForce = typeof force === 'boolean' ? force : false
    const now = Date.now()
    if (!isForce && now - lastFetchRef.current < 2000) return

    isFetchingRef.current = true
    lastFetchRef.current = now

    try {
      const combinedMap = new Map<string, OnlineOrder>()

      // 1. Read from shared LocalStorage (Online Delivery Orders ONLY)
      try {
        const local = localStorage.getItem('seafudz_orders')
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) {
            parsed.forEach((o: any) => {
              const orderType = (o.type || o.order_type || '').toLowerCase()
              const isDelivery = orderType.includes('delivery') || orderType.includes('online') || Boolean(o.deliveryAddress || o.address || o.customer || o.customerName)
              if (!isDelivery) return // Ignore POS walk-in orders

              const rawStatus = (o.status || 'PENDING').toLowerCase()
              const id = o.id || o.ref
              const items: OrderItem[] = Array.isArray(o.cartItems)
                ? o.cartItems.map((ci: any) => ({
                  name: ci.item?.name || ci.name || 'Seafood Dish',
                  quantity: ci.quantity || 1,
                  price: ci.item?.price || ci.price || 0,
                }))
                : (o.items || '').split(',').map((part: string) => {
                  const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                  return {
                    name: match ? match[1].trim() : part.trim(),
                    quantity: match ? parseInt(match[2], 10) : 1,
                    price: 0,
                  }
                })

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address: o.address || 'Delivery Address',
                paymentMethod: o.paymentMethod || 'GCash',
                paymentReference: o.paymentReference || o.paymentRef,
                paymentReceipt: o.paymentReceipt || o.receiptImage || o.receipt,
                status: rawStatus,
                items,
                total: Number(o.total || 0),
                createdAt: o.dateTime || 'Just now',
                correctionNote: o.notes,
                riderId: o.riderId,
                assignedRiderName: o.assignedRiderName,
              })
            })
          }
        }
      } catch (e) {
        console.warn('LocalStorage error in AssistantRole:', e)
      }

      // 2. Read from backend API (Online Delivery Orders ONLY)
      try {
        const res = await fetch(`${API_BASE_URL}/user-flow/orders`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.data)) {
            data.data.forEach((o: any) => {
              const orderType = (o.order_type || o.type || '').toLowerCase()
              const isDelivery = orderType.includes('delivery') || orderType.includes('online') || Boolean(o.deliveryAddress || o.address || o.customer || o.customerName)
              if (!isDelivery) return // Ignore POS walk-in orders

              const id = o.id
              if (!combinedMap.has(id)) {
                combinedMap.set(id, {
                  id,
                  ref: id,
                  customer: o.customer || o.customerName || 'Online Customer',
                  phone: o.phone || '0917-000-0000',
                  address: o.address || o.deliveryAddress || 'Metro Manila Address',
                  paymentMethod: o.paymentMethod || 'GCash',
                  paymentReference: o.paymentReference || o.paymentRef,
                  paymentReceipt: o.paymentReceipt || o.receiptImage || o.receipt,
                  status: (o.status || 'PENDING').toLowerCase(),
                  items: o.items || [],
                  total: o.total || 0,
                  createdAt: o.createdAt || 'Just now',
                  correctionNote: o.notes,
                  riderId: o.riderId,
                  assignedRiderName: o.assignedRiderName,
                })
              }
            })
          }
        }
      } catch (err) { }

      setOrders(Array.from(combinedMap.values()))
    } finally {
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    void fetchAssistantOrders()

    const handleSync = () => {
      void fetchAssistantOrders(true)
    }

    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)

    const timer = setInterval(() => {
      void fetchAssistantOrders()
    }, 6000)

    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
      clearInterval(timer)
    }
  }, [])

  // PASS ORDER TO CASHIER & KITCHEN (CONFIRMED)
  const handleApproveSendToKitchen = async () => {
    if (!selectedOrderId || !selectedOrder) return

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
    } catch (err) { }

    // Update in LocalStorage for instant live broadcast to Cashier & Kitchen
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === selectedOrderId || o.ref === selectedOrderId
          ? { ...o, status: 'CONFIRMED', paymentStatus: 'Paid' }
          : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      // Also update active online customer order if matching
      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        if (activeObj && (activeObj.id === selectedOrderId || activeObj.ref === selectedOrderId)) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: 'CONFIRMED' }))
        }
      }

      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch { }

    setOrders((prev) =>
      prev.map((o) => (o.id === selectedOrderId ? { ...o, status: 'confirmed' } : o))
    )
    setSelectedOrderId(null)
    setNotification(`Order ${selectedOrder.ref} approved! Sent to Cashier & Kitchen!`)
  }

  const handleAuthorizeGCash = async (orderId: string) => {
    try {
      await fetch(`${API_BASE_URL}/assistant/orders/${orderId}/authorize-gcash`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {}

    try {
      const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updatedGlobal = globalOrders.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: 'GCASH_AUTHORIZED' } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))

      const activeOrderStr = localStorage.getItem('seafudz_active_online_order')
      if (activeOrderStr) {
        const activeObj = JSON.parse(activeOrderStr)
        if (activeObj.id === orderId || activeObj.ref === orderId) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: 'GCASH_AUTHORIZED' }))
        }
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    fetchAssistantOrders(true)
    setNotification(`GCash payment authorized for order #${orderId}! Customer can now pay and upload receipt.`)
  }

  const handleVerifyReceipt = async (orderId: string) => {
    try {
      await fetch(`${API_BASE_URL}/assistant/orders/${orderId}/verify-receipt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {}

    try {
      const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updatedGlobal = globalOrders.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: 'CONFIRMED', receiptStatus: 'APPROVED' } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))

      const activeOrderStr = localStorage.getItem('seafudz_active_online_order')
      if (activeOrderStr) {
        const activeObj = JSON.parse(activeOrderStr)
        if (activeObj.id === orderId || activeObj.ref === orderId) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: 'CONFIRMED' }))
        }
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    fetchAssistantOrders(true)
    setNotification(`Receipt verified & confirmed for order #${orderId}! Sent to Kitchen!`)
  }

  const handleRejectReceipt = async (orderId: string) => {
    const reason = prompt('Please state reason for rejecting payment receipt screenshot:', 'Invalid payment reference screenshot. Please upload a clear official GCash confirmation.')
    if (reason === null) return
    try {
      await fetch(`${API_BASE_URL}/assistant/orders/${orderId}/reject-receipt`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
    } catch {}

    try {
      const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updatedGlobal = globalOrders.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: 'RECEIPT_REJECTED', rejectionReason: reason } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))

      const activeOrderStr = localStorage.getItem('seafudz_active_online_order')
      if (activeOrderStr) {
        const activeObj = JSON.parse(activeOrderStr)
        if (activeObj.id === orderId || activeObj.ref === orderId) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: 'RECEIPT_REJECTED', rejectionReason: reason }))
        }
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    fetchAssistantOrders(true)
    setNotification(`Receipt rejected for order #${orderId}. Customer notified to re-upload.`)
  }

  const handleConfirmCOD = async (orderId: string) => {
    try {
      await fetch(`${API_BASE_URL}/assistant/orders/${orderId}/confirm-cod`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {}

    try {
      const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updatedGlobal = globalOrders.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: 'CONFIRMED' } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))

      const activeOrderStr = localStorage.getItem('seafudz_active_online_order')
      if (activeOrderStr) {
        const activeObj = JSON.parse(activeOrderStr)
        if (activeObj.id === orderId || activeObj.ref === orderId) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: 'CONFIRMED' }))
        }
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    fetchAssistantOrders(true)
    setNotification(`COD product availability confirmed for order #${orderId}! Sent to Kitchen!`)
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const s = (order.status || '').toLowerCase()
      const isConfirmedOrLater = ['confirmed', 'pending_preparation', 'preparing', 'ready', 'out_for_delivery', 'assigned', 'completed', 'cancelled'].includes(s)

      const matchesTab =
        activeTab === 'pending'
          ? !isConfirmedOrLater
          : activeTab === 'kitchen'
            ? s === 'confirmed' || s === 'pending_preparation' || s === 'preparing'
            : activeTab === 'dispatch'
              ? s === 'ready' || s === 'out_for_delivery' || s === 'assigned' || s === 'completed'
              : true

      if (!matchesTab) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        order.ref.toLowerCase().includes(q) ||
        order.customer.toLowerCase().includes(q) ||
        order.phone.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q) ||
        order.items.some((i) => i.name.toLowerCase().includes(q))
      )
    })
  }, [orders, activeTab, searchQuery])

  // Clear selected order if it's no longer present in filtered list
  useEffect(() => {
    if (selectedOrderId && !filteredOrders.some((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(null)
    }
  }, [filteredOrders, selectedOrderId])

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE))
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredOrders, currentPage, ITEMS_PER_PAGE])

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 transition-all duration-300 pb-24 lg:pb-6 text-neutral-900 font-sans">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        {/* Top Navbar */}
        <NavbarAssistant />

        {/* 4-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">

          {/* Left Column (3 Cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {notification && (
              <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm font-bold shadow-xs animate-in fade-in">
                <span>{notification}</span>
                <button onClick={() => setNotification(null)} className="text-orange-500 font-extrabold cursor-pointer">×</button>
              </div>
            )}

            {/* Search and Tabs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Pipeline Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-2xs overflow-x-auto">
                {[
                  { id: 'pending', label: '1. Pending Orders' },
                  { id: 'kitchen', label: '2. Sent to Kitchen' },
                  { id: 'dispatch', label: '3. Rider Dispatch' },
                  { id: 'all', label: 'All Orders' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                        ? 'bg-[#ff7b00] text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Bar (Same as Rider) */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer, ref, address..."
                  className="w-full pl-9 pr-8 py-2.5 bg-white rounded-2xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 shadow-2xs transition-all placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 font-bold text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Orders Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedOrders.length === 0 ? (
                <div className="col-span-2 bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                  <h3 className="font-bold text-neutral-700">No orders in this stage right now.</h3>
                  <p className="text-xs mt-1">
                    {searchQuery ? `No results matching "${searchQuery}"` : 'Online orders placed by customers will appear here immediately.'}
                  </p>
                </div>
              ) : (
                paginatedOrders.map((ord) => {
                  const isSelected = selectedOrderId === ord.id
                  const s = (ord.status || '').toLowerCase()

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md ${isSelected
                          ? 'border-[#ff7b00] ring-2 ring-orange-500/20'
                          : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-orange-600">REF: {ord.ref}</span>
                          <h4 className="text-base font-normal text-neutral-800 leading-tight mt-0.5">{ord.customer}</h4>
                          <p className="text-xs text-neutral-500 mt-0.5">{ord.phone}</p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${s === 'gcash_pending_approval'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                              : s === 'gcash_authorized'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : s === 'receipt_submitted'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : s === 'pending' || s === 'unconfirmed'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : s === 'confirmed' || s === 'preparing'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : s === 'ready'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                        >
                          ● {s === 'gcash_pending_approval' ? 'Requesting Payment' : s === 'gcash_authorized' ? 'Payment Authorized' : s === 'receipt_submitted' ? 'Receipt Submitted' : ord.status}
                        </span>
                      </div>

                      <div className="py-3 text-xs text-neutral-600 space-y-1">
                        <p className="truncate"><span className="font-medium text-neutral-700">{ord.address}</span></p>
                        <p className="truncate"><span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${ord.paymentMethod?.toLowerCase().includes('cod')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                            {ord.paymentMethod || 'GCash'}
                          </span>
                          {(checkIfBulkOrder(ord.items) || (ord as any).isBulk) && (
                            <span className={`text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${s === 'gcash_pending_approval' ? 'bg-amber-600' : 'bg-amber-500'}`}>
                              {s === 'gcash_pending_approval' ? 'BULK ORDER - REQUESTING FOR PAYMENT' : 'BULK ORDER'}
                            </span>
                          )}
                          {ord.paymentReceipt && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200" title="Receipt photo attached">Receipt</span>
                          )}
                        </div>
                        <span className="text-neutral-400 font-medium text-[11px]">{ord.createdAt}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredOrders.length > ITEMS_PER_PAGE && (
              <div className="bg-white px-5 py-3.5 rounded-2xl border border-neutral-200 shadow-2xs flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500">
                  Page <span className="text-neutral-900 font-black">{currentPage}</span> of{' '}
                  <span className="text-neutral-900 font-black">{totalPages}</span> ({filteredOrders.length} total orders)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    <span>⬅️</span> Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ff7b00] hover:bg-[#e66f00] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    Next <span>➡️</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Selected Order Management Details */}
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-neutral-200/80 shadow-xs space-y-6">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-neutral-100 pb-3">
              Order Verification & Dispatch
            </h3>

            {!selectedOrder ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                Select an order from the list to review and forward to Cashier & Kitchen.
              </div>
            ) : (
              <div className="space-y-5 text-xs text-slate-700">
                {/* Clean Order Header */}
                <div className="pb-4 border-b border-slate-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-slate-900 text-lg tracking-tight">{selectedOrder.ref}</span>
                    <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] tracking-wide uppercase bg-slate-100 text-slate-600">
                      {selectedOrder.paymentMethod || 'GCash'}
                    </span>
                  </div>
                  <p className="font-normal text-slate-800 text-sm pt-0.5">{selectedOrder.customer}</p>
                  <p className="text-slate-500 text-xs">{selectedOrder.phone}</p>
                  <p className="text-slate-500 text-xs mt-1 leading-relaxed">{selectedOrder.address}</p>
                </div>

                {/* Minimal Payment Details */}
                <div className="pb-4 border-b border-slate-100 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Payment Details</span>
                    <span className="font-extrabold text-slate-900 text-sm">₱{selectedOrder.total.toLocaleString()}</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Payment Mode:</span>
                      <span className="font-semibold text-slate-800">{selectedOrder.paymentMethod || 'GCash'} Transfer</span>
                    </div>
                    {selectedOrder.paymentReference && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Reference No:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {selectedOrder.paymentReference}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Receipt / Screenshot (Minimal) */}
                  {selectedOrder.paymentReceipt && (
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={selectedOrder.paymentReceipt}
                          alt="Receipt Preview"
                          onClick={() => setPreviewReceiptUrl(selectedOrder.paymentReceipt || null)}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-700">Receipt Attached</p>
                          <p className="text-[10px] text-slate-400">Click to view image</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptUrl(selectedOrder.paymentReceipt || null)}
                        className="px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  )}
                </div>

                {/* Minimal Checklist */}
                <div className="pb-2 space-y-2 text-[11px]">
                  <p className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Verification Checklist</p>
                  <div className="space-y-1">
                    <p className={customerNameValid ? 'text-emerald-600 font-medium flex items-center gap-1.5' : 'text-rose-600 font-medium flex items-center gap-1.5'}>
                      <span>{customerNameValid ? '✓' : '✗'}</span>
                      <span>{customerNameValid ? 'Customer name verified' : 'Missing customer name'}</span>
                    </p>
                    <p className={phoneValidation.isValid ? 'text-emerald-600 font-medium flex items-center gap-1.5' : 'text-rose-600 font-medium flex items-center gap-1.5'}>
                      <span>{phoneValidation.isValid ? '✓' : '✗'}</span>
                      <span>{phoneValidation.isValid ? 'Valid PH Mobile format' : 'Incomplete phone number'}</span>
                    </p>
                    <p className={addressValidation.isComplete ? 'text-emerald-600 font-medium flex items-center gap-1.5' : 'text-amber-600 font-medium flex items-center gap-1.5'}>
                      <span>{addressValidation.isComplete ? '✓' : '!'}</span>
                      <span>{addressValidation.isComplete ? 'Delivery address complete' : addressValidation.warningMsg}</span>
                    </p>
                    {(!selectedOrder.paymentMethod?.toLowerCase().includes('cod') && selectedOrder.status?.toUpperCase() !== 'PENDING_COD') && (
                      <p className={selectedOrder.paymentReceipt ? 'text-emerald-600 font-medium flex items-center gap-1.5' : 'text-rose-600 font-medium flex items-center gap-1.5'}>
                        <span>{selectedOrder.paymentReceipt ? '✓' : '✗'}</span>
                        <span>{selectedOrder.paymentReceipt ? 'GCash reference screenshot received' : 'Awaiting customer GCash screenshot'}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* BULK ORDER NOTICE IN DETAIL PANEL */}
                {(checkIfBulkOrder(selectedOrder.items) || (selectedOrder as any).isBulk) && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-amber-900 flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-xs uppercase">⚠️ Bulk Order</p>
                      <p className="text-[10px] text-amber-700">Requires staff verification</p>
                    </div>
                    <span className="bg-amber-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full uppercase">Bulk</span>
                  </div>
                )}

                {/* Pipeline Action Controls */}
                <div className="pt-2 space-y-3">
                  {(() => {
                    const st = (selectedOrder.status || '').toUpperCase()
                    const isConfirmedOrLater = ['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'ASSIGNED', 'COMPLETED'].includes(st)

                    if (isConfirmedOrLater) {
                      return (
                        <div className="w-full bg-emerald-50 text-emerald-800 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 border border-emerald-300 shadow-xs">
                          ✓ Confirmed & Sent to Kitchen ({st})
                        </div>
                      )
                    }

                    const isCOD = selectedOrder.paymentMethod?.toLowerCase().includes('cod') || st === 'PENDING_COD'
                    const hasReceipt = Boolean(selectedOrder.paymentReceipt || selectedOrder.paymentReference || st === 'RECEIPT_SUBMITTED')

                    // 1. COD Orders Flow
                    if (isCOD) {
                      return (
                        <button
                          onClick={() => handleConfirmCOD(selectedOrder.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
                        >
                          <span>✅ Confirm COD Order & Send to Kitchen</span>
                        </button>
                      )
                    }

                    // 2. GCash Bulk Order Needing Initial Authorization
                    if (st === 'GCASH_PENDING_APPROVAL') {
                      return (
                        <button
                          onClick={() => handleAuthorizeGCash(selectedOrder.id)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-500/20 active:scale-98"
                        >
                          Authorize GCash Payment (Allow Customer to Pay)
                        </button>
                      )
                    }

                    // 3. GCash Order WITH Reference Screenshot Submitted
                    if (hasReceipt) {
                      return (
                        <div className="space-y-3">
                          <div className="space-y-2 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-300">
                            <p className="font-extrabold text-xs text-emerald-950 text-center">Payment Receipt Screenshot Received</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVerifyReceipt(selectedOrder.id)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all shadow-xs active:scale-98"
                              >
                                Approve Receipt & Send to Kitchen
                              </button>
                              <button
                                onClick={() => handleRejectReceipt(selectedOrder.id)}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs cursor-pointer transition-all shadow-xs active:scale-98"
                              >
                                Reject (Invalid Image)
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => handleApproveSendToKitchen()}
                            className="w-full bg-[#ff7b00] hover:bg-[#e66f00] text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-orange-500/30 active:scale-98"
                          >
                            <span>✅ Confirm Order & Send to Kitchen</span>
                          </button>
                        </div>
                      )
                    }

                    // 4. GCash Order WITHOUT Reference Screenshot (Customer hasn't sent it yet)
                    return (
                      <div className="space-y-3">
                        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-center space-y-1">
                          <p className="font-extrabold text-xs text-amber-900 flex items-center justify-center gap-1.5">
                            <span>⏳</span> Awaiting GCash Reference Screenshot
                          </p>
                          <p className="text-[11px] text-amber-700 leading-normal">
                            The customer has not sent/uploaded their GCash transaction reference screenshot yet. Order cannot be confirmed until system detects receipt.
                          </p>
                        </div>
                        <button
                          disabled
                          className="w-full bg-slate-200 text-slate-400 font-extrabold py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300 opacity-80"
                        >
                          <span>🔒 Cannot Confirm (Awaiting Reference Screenshot)</span>
                        </button>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Receipt Image Preview Modal */}
      {previewReceiptUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-lg w-full shadow-2xl relative flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm text-neutral-800">Customer Payment Receipt</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="w-full max-h-[70vh] overflow-auto rounded-2xl bg-neutral-50 flex items-center justify-center p-2 border border-neutral-200">
              <img
                src={previewReceiptUrl}
                alt="Full Payment Receipt"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-xs"
              />
            </div>

            <div className="w-full flex items-center justify-between text-xs text-neutral-500 pt-1">
              <span>Verify transaction reference & amount</span>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="bg-neutral-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssistantRole
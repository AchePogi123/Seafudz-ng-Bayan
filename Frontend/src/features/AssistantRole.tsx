import React, { useState, useEffect, useMemo, useRef } from 'react'
import { NavbarAssistant } from '../components/NavbarAssistant'
import { API_BASE_URL } from '../utils/api'

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

const INITIAL_MOCK_RIDERS: Rider[] = [
  { id: 'r-1', name: 'Rider Alex Ramos', status: 'Available', vehicle: 'Yamaha NMAX (Plate 123-ABC)', phone: '09170001111' },
  { id: 'r-2', name: 'Dan Cruz', status: 'Available', vehicle: 'Honda Click 125i (Plate 456-DEF)', phone: '09180002222' },
  { id: 'r-3', name: 'Marky Santos', status: 'Busy - 1 delivery active', vehicle: 'Kawasaki Barako (Plate 789-GHI)', phone: '09200003333' },
]

export const AssistantRole: React.FC = () => {
  const [orders, setOrders] = useState<OnlineOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'kitchen' | 'dispatch' | 'all'>('pending')
  const [correctionNoteInput, setCorrectionNoteInput] = useState('')
  const [selectedRiderId, setSelectedRiderId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6
  const [riders] = useState<Rider[]>(INITIAL_MOCK_RIDERS)
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
              const orderType = (o.type || '').toLowerCase()
              const isDelivery = orderType.includes('delivery') || o.deliveryAddress || (o.address && o.address !== 'Dine In' && o.customer !== 'Walk-In')
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
              const isDelivery = orderType.includes('delivery') || o.deliveryAddress || o.address
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
      } catch (err) {}

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

  const handleFlagForCorrection = async () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!correctionNoteInput.trim()) {
      setNotification('⚠️ Please enter a correction note first.')
      return
    }

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FLAGGED', note: correctionNoteInput }),
      })
    } catch {}

    // Update in LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === selectedOrderId || o.ref === selectedOrderId
          ? { ...o, status: 'FLAGGED', notes: correctionNoteInput }
          : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderId ? { ...o, status: 'flagged', correctionNote: correctionNoteInput } : o
      )
    )
    setNotification(`🚩 Order ${selectedOrder.ref} flagged for correction.`)
    setCorrectionNoteInput('')
  }

  // PASS ORDER TO CASHIER & KITCHEN (CONFIRMED)
  const handleApproveSendToKitchen = async () => {
    if (!selectedOrderId || !selectedOrder) return

    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
    } catch (err) {}

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
    } catch {}

    setOrders((prev) =>
      prev.map((o) => (o.id === selectedOrderId ? { ...o, status: 'confirmed' } : o))
    )
    setNotification(`🍳 Order ${selectedOrder.ref} approved! Sent to Cashier & Kitchen!`)
  }

  // DISPATCH ORDER TO RIDER
  const handleAssignRider = async () => {
    if (!selectedOrderId || !selectedOrder) return
    if (!selectedRiderId) {
      setNotification('⚠️ Please select a rider to dispatch.')
      return
    }
    const rider = riders.find((r) => r.id === selectedRiderId)
    if (!rider) return

    // Update in backend API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OUT_FOR_DELIVERY', riderId: rider.id, assignedRiderName: rider.name }),
      })
    } catch {}

    // Update in LocalStorage for live rider sync
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === selectedOrderId || o.ref === selectedOrderId
          ? { ...o, status: 'OUT_FOR_DELIVERY', riderId: rider.id, assignedRiderName: rider.name }
          : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrderId
          ? { ...o, status: 'out_for_delivery', riderId: rider.id, assignedRiderName: rider.name }
          : o
      )
    )
    setNotification(`🛵 Order ${selectedOrder.ref} assigned kay ${rider.name}! Handed over for delivery.`)
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const s = (order.status || '').toLowerCase()
      const matchesTab =
        activeTab === 'pending'
          ? s === 'pending' || s === 'flagged' || s === 'pending_verification' || s === 'unconfirmed'
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
                  { id: 'pending', label: '1. Pending Orders', icon: '📝' },
                  { id: 'kitchen', label: '2. Sent to Kitchen', icon: '🍳' },
                  { id: 'dispatch', label: '3. Rider Dispatch', icon: '🛵' },
                  { id: 'all', label: 'All Orders', icon: '📦' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-[#ff7b00] text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Bar (Same as Rider) */}
              <div className="relative min-w-[240px]">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
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
                  <div className="text-3xl mb-2">📥</div>
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
                      className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-[#ff7b00] ring-2 ring-orange-500/20'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-orange-600">REF: {ord.ref}</span>
                          <h4 className="text-base font-normal text-neutral-800 leading-tight mt-0.5">{ord.customer}</h4>
                          <p className="text-xs text-neutral-500 mt-0.5">📞 {ord.phone}</p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            s === 'pending' || s === 'unconfirmed'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : s === 'confirmed' || s === 'preparing'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : s === 'ready'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          ● {ord.status}
                        </span>
                      </div>

                      <div className="py-3 text-xs text-neutral-600 space-y-1">
                        <p className="truncate">📍 <span className="font-medium text-neutral-700">{ord.address}</span></p>
                        <p className="truncate">🍤 <span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString()}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            ord.paymentMethod?.toLowerCase().includes('maya')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ord.paymentMethod || 'GCash'}
                          </span>
                          {ord.paymentReceipt && (
                            <span className="text-[10px]" title="Receipt photo attached">📸</span>
                          )}
                        </div>
                        <span className="text-neutral-400 font-medium text-[11px]">🕒 {ord.createdAt}</span>
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
                <p className="text-2xl mb-1">👈</p>
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
                      <span>{addressValidation.isComplete ? '✓' : '⚠'}</span>
                      <span>{addressValidation.isComplete ? 'Delivery address complete' : addressValidation.warningMsg}</span>
                    </p>
                  </div>
                </div>

                {/* Pipeline Action Button */}
                <div className="pt-2">
                  <button
                    onClick={handleApproveSendToKitchen}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm active:scale-98"
                  >
                    <span>🍳</span> Forward to Cashier & Kitchen
                  </button>
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
                <span className="text-xl">🧾</span>
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
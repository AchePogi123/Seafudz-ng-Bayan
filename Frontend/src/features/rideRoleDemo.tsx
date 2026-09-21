import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { NavbarRider } from '../components/Navbarrider'
import { API_BASE_URL } from '../utils/api'

interface DeliveryItem {
  name: string
  quantity: number
}

interface DeliveryOrder {
  id: string
  ref: string
  customer: string
  phone: string
  address: string
  items: DeliveryItem[]
  total: number
  status: 'Pending' | 'Preparing' | 'Ready' | 'Out for Delivery' | 'Completed' | string
  createdAt?: string
  paymentMethod?: string
}

export const RideRoleDemo: React.FC = () => {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null)
  const [activeTab, setActiveTab] = useState<'All' | 'Ready' | 'Out for Delivery' | 'Completed'>('All')
  const [notification, setNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('seafudz_rider_hidden_orders')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const ITEMS_PER_PAGE = 6
  const isFetchingRef = useRef(false)
  const lastFetchRef = useRef(0)

  // Fetch live delivery orders from LocalStorage + Backend API
  const fetchDeliveries = useCallback(async (force?: boolean | unknown) => {
    if (isFetchingRef.current) return
    const isForce = typeof force === 'boolean' ? force : false
    const now = Date.now()
    if (!isForce && now - lastFetchRef.current < 2000) return

    isFetchingRef.current = true
    lastFetchRef.current = now

    try {
      const combinedMap = new Map<string, DeliveryOrder>()

      let hiddenSet = new Set<string>()
      try {
        const saved = localStorage.getItem('seafudz_rider_hidden_orders')
        if (saved) hiddenSet = new Set(JSON.parse(saved))
      } catch {}

      // 1. Read from shared LocalStorage (Delivery Orders ONLY)
      try {
        const local = localStorage.getItem('seafudz_orders')
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) {
            parsed.forEach((o: any) => {
              // STRICT: Ignore POS Walk-in orders (Dine In & Take Out). ONLY online Delivery orders reflect to Rider!
              const orderType = (o.type || o.order_type || '').toLowerCase()
              const isDelivery = orderType.includes('delivery') || orderType.includes('online') || Boolean(o.deliveryAddress || o.address || o.customer || o.customerName)
              if (!isDelivery) return

              const id = o.id || o.ref
              if (hiddenSet.has(id) || hiddenSet.has(o.ref)) return

              const rawStatus = (o.status || '').toUpperCase()
              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return

              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') displayStatus = 'Out for Delivery'
              else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') displayStatus = 'Completed'
              else if (rawStatus === 'READY') displayStatus = 'Ready'
              else if (rawStatus === 'PREPARING' || rawStatus === 'CONFIRMED') displayStatus = 'Preparing'
              else return // Skip pending / unconfirmed orders in Rider UI

              const items: DeliveryItem[] = Array.isArray(o.cartItems)
                ? o.cartItems.map((ci: any) => ({
                    name: ci.item?.name || ci.name || 'Seafood Dish',
                    quantity: ci.quantity || 1,
                  }))
                : (o.items || '').split(',').map((part: string) => {
                    const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                    return {
                      name: match ? match[1].trim() : part.trim(),
                      quantity: match ? parseInt(match[2], 10) : 1,
                    }
                  })

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address: o.address || 'Delivery Address',
                items,
                total: Number(o.total || 0),
                status: displayStatus,
                createdAt: o.dateTime || 'Just now',
                paymentMethod: o.paymentMethod || 'GCash',
              })
            })
          }
        }
      } catch (e) {
        console.warn('Rider LocalStorage note:', e)
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
              if (!isDelivery) return

              const id = o.id
              if (hiddenSet.has(id)) return

              const rawStatus = (o.status || '').toUpperCase()
              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return
              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') displayStatus = 'Out for Delivery'
              else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') displayStatus = 'Completed'
              else if (rawStatus === 'READY') displayStatus = 'Ready'
              else if (rawStatus === 'PREPARING' || rawStatus === 'CONFIRMED') displayStatus = 'Preparing'
              else return // Skip pending / unconfirmed orders in Rider UI

              if (!combinedMap.has(id)) {
                combinedMap.set(id, {
                  id,
                  ref: id,
                  customer: o.customer || o.customerName || 'Online Customer',
                  phone: o.phone || '0917-000-0000',
                  address: o.address || o.deliveryAddress || 'Metro Manila Address',
                  items: o.items || [],
                  total: o.total || 0,
                  status: displayStatus,
                  createdAt: o.createdAt || new Date().toISOString(),
                  paymentMethod: o.paymentMethod || 'GCash',
                })
              }
            })
          }
        }
      } catch (err) {}

      setDeliveries(Array.from(combinedMap.values()))
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchDeliveries()

    const handleSync = () => {
      void fetchDeliveries(true)
    }

    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)

    const interval = setInterval(() => {
      void fetchDeliveries()
    }, 6000)

    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
      clearInterval(interval)
    }
  }, [fetchDeliveries])

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleHideOrder = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setHiddenOrderIds((prev) => {
      const next = new Set(prev)
      next.add(orderId)
      try {
        localStorage.setItem('seafudz_rider_hidden_orders', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    setSelectedOrder((prev) => (prev?.id === orderId ? null : prev))
    setNotification(`Order ${orderId} removed from Rider view (UI only).`)
  }

  // Rider updates status to Out for Delivery or Delivered/Completed
  const handleUpdateStatus = async (orderId: string, newStatus: 'Out for Delivery' | 'Completed') => {
    const apiStatus = newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'

    // Update in LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: apiStatus } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      // Also update active online customer order if matching
      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        if (activeObj && (activeObj.id === orderId || activeObj.ref === orderId)) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: apiStatus }))
        }
      }

      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    // Update in backend API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus }),
      })
    } catch {}

    setDeliveries((prev) =>
      prev.map((d) => (d.id === orderId ? { ...d, status: newStatus } : d))
    )

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus })
    }

    setNotification(`Order status updated to "${newStatus}"!`)
  }

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (hiddenOrderIds.has(d.id) || hiddenOrderIds.has(d.ref)) return false
      const matchesTab = activeTab === 'All' ? d.status !== 'Completed' : d.status.toLowerCase() === activeTab.toLowerCase()
      if (!matchesTab) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (d.ref || '').toLowerCase().includes(q) ||
        (d.customer || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q) ||
        (d.address || '').toLowerCase().includes(q)
      )
    })
  }, [deliveries, activeTab, searchQuery, hiddenOrderIds])

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE))
  const paginatedDeliveries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDeliveries.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredDeliveries, currentPage, ITEMS_PER_PAGE])

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 text-neutral-900 font-sans pb-24 lg:pb-6">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarRider />

        {notification && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm font-bold shadow-xs">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-emerald-500 font-extrabold cursor-pointer">×</button>
          </div>
        )}

        {/* 4-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {/* Main Delivery List (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Search and Tabs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-2xs overflow-x-auto">
                {(['All', 'Ready', 'Out for Delivery', 'Completed'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === tab
                        ? 'bg-[#ff7b00] text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{tab} Orders</span>
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer, ref, address..."
                  className="w-full pl-4 pr-8 py-2.5 bg-white rounded-2xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 shadow-2xs transition-all placeholder:text-neutral-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 font-bold text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Delivery Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedDeliveries.length === 0 ? (
                <div className="col-span-2 bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                  <h3 className="font-bold text-neutral-700">No delivery orders found.</h3>
                  <p className="text-xs mt-1">
                    {searchQuery ? `No results matching "${searchQuery}"` : 'Orders dispatched by Assistant will show up here live.'}
                  </p>
                </div>
              ) : (
                paginatedDeliveries.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'border-[#ff7b00] ring-2 ring-orange-500/20'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Ref: {ord.ref}</span>
                          <h4 className="text-base font-black text-neutral-800 leading-tight mt-0.5">{ord.customer}</h4>
                          <p className="text-xs text-neutral-500 mt-0.5">Phone: {ord.phone}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              ord.status === 'Ready'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : ord.status === 'Out for Delivery'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            ● {ord.status}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleHideOrder(ord.id, e)}
                            title="Remove from Rider UI (does not delete from DB)"
                            className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="py-3 text-xs text-neutral-600 space-y-1">
                        <p className="truncate"><span className="font-medium text-neutral-700">{ord.address}</span></p>
                        <p className="truncate"><span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                        <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString()}</span>
                        <span className="text-neutral-400 font-medium text-[11px]">{ord.createdAt}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredDeliveries.length > ITEMS_PER_PAGE && (
              <div className="bg-white px-5 py-3.5 rounded-2xl border border-neutral-200 shadow-2xs flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500">
                  Page <span className="text-neutral-900 font-black">{currentPage}</span> of{' '}
                  <span className="text-neutral-900 font-black">{totalPages}</span> ({filteredDeliveries.length} total orders)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ff7b00] hover:bg-[#e66f00] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Details Panel (1 col) */}
          <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-5">
            <h3 className="font-black text-base text-neutral-800 tracking-tight border-b border-neutral-100 pb-3">
              Rider Dispatch Details
            </h3>

            {!selectedOrder ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                Select an order from the list to view route and update delivery status.
              </div>
            ) : (
              <div className="space-y-4 text-xs font-medium text-neutral-700">
                <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-orange-600 text-sm">{selectedOrder.ref}</span>
                    <span className="bg-white px-2 py-0.5 rounded font-bold text-[10px] text-neutral-600 uppercase border border-orange-200">{selectedOrder.paymentMethod}</span>
                  </div>
                  <p className="font-bold text-neutral-800">{selectedOrder.customer}</p>
                  <p className="text-neutral-500">Phone: {selectedOrder.phone}</p>
                  <p className="text-neutral-600 mt-1">Address: {selectedOrder.address}</p>
                </div>

                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-1.5">
                  <p className="font-bold text-neutral-700">Items to Deliver:</p>
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{it.name}</span>
                      <span className="font-bold">x{it.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-extrabold text-orange-600">
                    <span>Collect Payment:</span>
                    <span>₱{selectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Rider Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  {selectedOrder.status !== 'Out for Delivery' && selectedOrder.status !== 'Completed' && (
                    <>
                      {selectedOrder.status !== 'Ready' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center space-y-1">
                          <p className="text-xs font-bold text-amber-800 flex items-center justify-center gap-1.5">
                            Cooking in Kitchen
                          </p>
                          <p className="text-[11px] text-amber-600">
                            Cannot start delivery yet. Please wait for the kitchen to mark the order as <strong>"Ready / Done"</strong>.
                          </p>
                          <button
                            disabled
                            className="w-full bg-neutral-200 text-neutral-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed mt-2"
                          >
                            Start Delivery (Waiting for Kitchen)
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(selectedOrder.id, 'Out for Delivery')}
                          className="w-full bg-[#ff7b00] hover:bg-[#e66f00] text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer transition-all hover:scale-101"
                        >
                          Start Delivery (Out for Delivery)
                        </button>
                      )}
                    </>
                  )}

                  {selectedOrder.status === 'Out for Delivery' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'Completed')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all hover:scale-101"
                    >
                      Mark as Delivered & Completed
                    </button>
                  )}

                  <button
                    onClick={() => handleHideOrder(selectedOrder.id)}
                    className="w-full bg-neutral-100 hover:bg-red-50 text-neutral-600 hover:text-red-700 font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-neutral-200 hover:border-red-200"
                  >
                    Remove Order from Rider View (UI only)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RideRoleDemo

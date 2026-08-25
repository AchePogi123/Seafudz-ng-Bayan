import React, { useState, useEffect } from 'react'
import { NavbarRider } from '../components/Navbarrider'

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

import { API_BASE_URL } from '../utils/api'

// Fallback initial delivery orders matching POS theme
const INITIAL_DELIVERIES: DeliveryOrder[] = [
  {
    id: 'ORD-1003',
    ref: 'ORD-1003',
    customer: 'Leonora Rivera',
    phone: '0915-777-6655',
    address: '88 Diamond Rd, Ortigas Center, Pasig City',
    items: [
      { name: 'Garlic Butter Crab Bucket', quantity: 1 },
      { name: 'Fresh Juice', quantity: 2 },
    ],
    total: 2800,
    status: 'Ready',
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
    paymentMethod: 'GCash',
  },
  {
    id: 'ORD-1004',
    ref: 'ORD-1004',
    customer: 'Juan dela Cruz',
    phone: '0917-123-4567',
    address: '123 Ocean St., Brgy. San Roque, Manila',
    items: [
      { name: 'Seafood Bilao Feast', quantity: 1 },
      { name: 'Spicy Shrimp', quantity: 1 },
    ],
    total: 3200,
    status: 'Out for Delivery',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    paymentMethod: 'Cash',
  },
]

export const RideRoleDemo: React.FC = () => {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>(INITIAL_DELIVERIES)
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null)
  const [activeTab, setActiveTab] = useState<'All' | 'Ready' | 'Out for Delivery' | 'Completed'>('All')
  const [notification, setNotification] = useState<string | null>(null)

  // Fetch live delivery orders from backend & localStorage
  const fetchDeliveries = async () => {
    let localOrdersRaw: Array<{
      id: string
      type?: string
      category?: string
      customer?: string
      phone?: string
      address?: string
      table?: string
      cartItems?: Array<{ item?: { name?: string }; name?: string; quantity?: number }>
      items?: Array<{ name: string; quantity: number }>
      total?: number
      status?: string
      createdAt?: string
      paymentMethod?: string
    }> = []
    try {
      localOrdersRaw = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
    } catch {
      /* ignore */
    }

    // Filter local delivery orders
    const localDeliveries = localOrdersRaw
      .filter((o) => o.type === 'Delivery' || o.category?.includes('Delivery'))
      .map((o) => ({
        id: o.id,
        ref: o.id,
        customer: o.customer || 'Customer',
        phone: o.phone || '0917-000-0000',
        address: o.address || o.table || 'Metro Manila Address',
        items: o.cartItems
          ? o.cartItems.map((ci) => ({
            name: ci.item?.name || ci.name || 'Seafood Dish',
            quantity: ci.quantity || 1,
          }))
          : o.items || [],
        total: o.total || 0,
        status: o.status || 'Pending',
        createdAt: o.createdAt || new Date().toISOString(),
        paymentMethod: o.paymentMethod || 'Cash',
      }))

    try {
      const res = await fetch(`${API_BASE_URL}/rider/deliveries`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.data) && data.data.length > 0) {
          const apiMap = new Map(data.data.map((raw: { id: string }) => [raw.id, raw]))
          localDeliveries.forEach((ld) => {
            if (!apiMap.has(ld.id)) apiMap.set(ld.id, ld)
          })

          const combined = Array.from(apiMap.values()).map((rawItem) => {
            const raw = rawItem as {
              id: string
              customer?: string
              phone?: string
              address?: string
              table?: string
              cartItems?: Array<{ item?: { name?: string }; name?: string; quantity?: number }>
              items?: Array<{ name: string; quantity: number }>
              total?: number
              status?: string
              createdAt?: string
              paymentMethod?: string
            }
            return {
              id: raw.id,
              ref: raw.id,
              customer: raw.customer || 'Customer',
              phone: raw.phone || '0917-888-9999',
              address: raw.address || raw.table || 'Delivery Location',
              items: raw.cartItems
                ? raw.cartItems.map((ci) => ({
                  name: ci.item?.name || ci.name || 'Food Item',
                  quantity: ci.quantity || 1,
                }))
                : raw.items || [],
              total: raw.total || 0,
              status: raw.status || 'Ready',
              createdAt: raw.createdAt || new Date().toISOString(),
              paymentMethod: raw.paymentMethod || 'Cash',
            }
          })

          setDeliveries(combined)
          return
        }
      }
    } catch (err) {
      console.warn('Backend connection unavailable, using local deliveries:', err)
    }

    if (localDeliveries.length > 0) {
      setDeliveries(localDeliveries)
    }
  }

  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchDeliveries()
    }, 0)
    const interval = setInterval(fetchDeliveries, 3000)
    const handleStorageEvent = () => void fetchDeliveries()
    window.addEventListener('storage', handleStorageEvent)
    window.addEventListener('seafudz_order_created', handleStorageEvent)

    return () => {
      clearTimeout(initTimer)
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageEvent)
      window.removeEventListener('seafudz_order_created', handleStorageEvent)
    }
  }, [])

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const updateDeliveryStatus = async (id: string, newStatus: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()

    setDeliveries((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    )

    if (selectedOrder?.id === id) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null))
    }

    // Update localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: { id: string; status: string }) =>
        o.id === id ? { ...o, status: newStatus } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
    } catch {
      /* ignore */
    }

    // Persist to Express Backend API
    try {
      await fetch(`${API_BASE_URL}/rider/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, riderName: 'Rider Alex' }),
      })
    } catch (err) {
      console.warn('Could not persist status to backend:', err)
    }

    if (newStatus === 'Out for Delivery') {
      setNotification(`Delivery started for Order #${id}! Status updated to Out for Delivery.`)
    } else if (newStatus === 'Completed') {
      setNotification(`Order #${id} marked as Delivered!`)
    }
  }

  // Filter deliveries based on active tab
  const filteredDeliveries = deliveries.filter((o) => {
    if (activeTab === 'Ready') return o.status === 'Ready'
    if (activeTab === 'Out for Delivery') return o.status === 'Out for Delivery'
    if (activeTab === 'Completed') return o.status === 'Completed' || o.status === 'Served'
    return true
  })

  const readyCount = deliveries.filter((o) => o.status === 'Ready').length
  const activeDeliveryCount = deliveries.filter((o) => o.status === 'Out for Delivery').length
  const completedCount = deliveries.filter((o) => o.status === 'Completed' || o.status === 'Served').length

  return (
    <div className="min-h-screen bg-[#faf9f6] p-3 sm:p-4 lg:p-6 transition-all duration-300 pb-16">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarRider />

        {/* Header Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white px-5 py-4 rounded-2xl border border-neutral-200/80 shadow-2xs gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-neutral-900 leading-tight">
                Rider Delivery Portal
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                Live dispatch updates & customer delivery tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-full border border-emerald-100">
              {readyCount} Ready for Pickup
            </span>
            <span className="bg-blue-50 text-blue-700 font-bold text-xs px-3 py-1.5 rounded-full border border-blue-100">
              {activeDeliveryCount} In Transit
            </span>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['All', 'Ready', 'Out for Delivery', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${activeTab === tab
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-100'
                }`}
            >
              {tab === 'All' && `All (${deliveries.length})`}
              {tab === 'Ready' && `Ready for Pickup (${readyCount})`}
              {tab === 'Out for Delivery' && `Out for Delivery (${activeDeliveryCount})`}
              {tab === 'Completed' && `Completed (${completedCount})`}
            </button>
          ))}
        </div>

        {/* Delivery Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDeliveries.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-12 border border-neutral-200/80 text-center text-neutral-400 select-none">
              <p className="font-bold text-neutral-700 text-sm">No delivery orders found</p>
              <p className="text-xs text-neutral-400 mt-1">
                New delivery orders placed at POS will show up here automatically.
              </p>
            </div>
          ) : (
            filteredDeliveries.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-white hover:bg-[#faf9f6] rounded-2xl p-5 border border-neutral-200/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  {/* Card Top Row */}
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-neutral-100">
                    <div>
                      <span className="font-extrabold text-neutral-900 text-base">#{order.ref}</span>
                      <div className="text-xs text-neutral-400 font-medium mt-0.5">{order.paymentMethod}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${order.status === 'Ready'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : order.status === 'Out for Delivery'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : order.status === 'Completed' || order.status === 'Served'
                              ? 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                    >
                      {order.status === 'Ready' && 'Ready for Pickup'}
                      {order.status === 'Out for Delivery' && 'Out for Delivery'}
                      {(order.status === 'Completed' || order.status === 'Served') && 'Delivered'}
                      {order.status === 'Pending' && 'Preparing'}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5 mb-4">
                    <div className="font-bold text-neutral-900 text-sm">
                      {order.customer}
                    </div>
                    <div className="text-xs text-neutral-500 font-medium">
                      {order.phone}
                    </div>
                    <div className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60 font-medium leading-snug mt-2">
                      {order.address}
                    </div>
                  </div>

                  {/* Items Preview List */}
                  <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                        <span>{item.name}</span>
                        <span className="bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total & Action Button */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-3">
                    <span className="text-neutral-400 font-semibold">Total Amount:</span>
                    <span className="font-black text-sm text-neutral-900">₱{order.total.toLocaleString()}</span>
                  </div>

                  {order.status === 'Ready' && (
                    <button
                      onClick={(e) => updateDeliveryStatus(order.id, 'Out for Delivery', e)}
                      className="w-full bg-[#ff7a00] hover:bg-[#e66e00] text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Start Delivery
                    </button>
                  )}

                  {order.status === 'Out for Delivery' && (
                    <button
                      onClick={(e) => updateDeliveryStatus(order.id, 'Completed', e)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Complete Delivery
                    </button>
                  )}

                  {(order.status === 'Completed' || order.status === 'Served') && (
                    <div className="w-full bg-neutral-100 text-neutral-500 font-bold py-2.5 rounded-xl text-xs text-center border border-neutral-200">
                      Delivered
                    </div>
                  )}

                  {order.status === 'Pending' && (
                    <div className="w-full bg-amber-50 text-amber-700 font-bold py-2.5 rounded-xl text-xs text-center border border-amber-200">
                      Kitchen Preparing...
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delivery Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80 animate-scale-up">
            <div className="p-5 bg-neutral-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Order #{selectedOrder.ref}</h3>
                <p className="text-xs opacity-80 mt-0.5">{selectedOrder.customer}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-sm leading-none transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Delivery Address</h4>
                <div className="bg-[#faf9f6] border border-neutral-200/80 rounded-xl p-3.5 text-xs text-neutral-800 font-semibold leading-relaxed">
                  {selectedOrder.address}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Contact Customer</h4>
                <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 flex justify-between items-center text-xs">
                  <span className="font-bold text-neutral-800">{selectedOrder.phone}</span>
                  <a
                    href={`tel:${selectedOrder.phone}`}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all"
                  >
                    Call Customer
                  </a>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Order Items</h4>
                <div className="bg-[#faf9f6] rounded-xl border border-neutral-200/80 p-3.5 divide-y divide-neutral-200/60">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 first:pt-0 last:pb-0 font-semibold text-neutral-800 text-xs sm:text-sm">
                      <span>{item.name}</span>
                      <span className="bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded text-xs font-bold">
                        x{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5">
                <span className="text-xs font-semibold text-neutral-500">Total Payable</span>
                <span className="text-base font-black text-neutral-900">₱{selectedOrder.total.toLocaleString()}</span>
              </div>

              <div className="flex gap-3 pt-1">
                {selectedOrder.status === 'Ready' && (
                  <button
                    onClick={(e) => updateDeliveryStatus(selectedOrder.id, 'Out for Delivery', e)}
                    className="w-full bg-[#ff7a00] hover:bg-[#e66e00] text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs shadow-2xs"
                  >
                    Accept & Start Delivery
                  </button>
                )}
                {selectedOrder.status === 'Out for Delivery' && (
                  <button
                    onClick={(e) => updateDeliveryStatus(selectedOrder.id, 'Completed', e)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all cursor-pointer text-xs shadow-2xs"
                  >
                    Mark as Delivered
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 rounded-xl transition-all cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-fade-in flex items-center border border-neutral-700 text-xs font-semibold">
          <span>{notification}</span>
        </div>
      )}
    </div>
  )
}

export default RideRoleDemo

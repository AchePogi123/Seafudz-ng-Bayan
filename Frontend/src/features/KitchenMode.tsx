import React, { useState, useEffect } from 'react'
import NavbarKitchen from '../components/NavbarKitchen'
import { API_BASE_URL } from '../utils/api'

interface OrderItem {
  name: string
  quantity: number
}

export interface KitchenOrder {
  id: string
  queue: string
  type: string
  category: string
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed' | string
  items: OrderItem[]
  notes?: string
  total?: number
  createdAt?: string
  paymentMethod?: string
  startTime?: number | null
  completedTimeElapsed?: string
}

interface RawCartItem {
  item?: { name?: string }
  name?: string
  quantity?: number
}

interface RawOrder {
  id: string
  type?: string
  table?: string
  status?: string
  notes?: string
  total?: number
  createdAt?: string
  paymentMethod?: string
  startTime?: number
  completedTimeElapsed?: string
  cartItems?: RawCartItem[]
  items?: Array<{ name: string; quantity: number }>
}

export const mapRawToKitchenOrder = (raw: RawOrder): KitchenOrder => {
  const items = raw.cartItems
    ? raw.cartItems.map((ci) => ({
      name: ci.item?.name || ci.name || 'Food Item',
      quantity: ci.quantity || 1,
    }))
    : raw.items || []

  return {
    id: raw.id,
    queue: raw.id,
    type: raw.type || 'Dine In',
    category: raw.table ? `${raw.type || 'Dine In'} - ${raw.table}` : 'Take Out',
    status: raw.status || 'Pending',
    items,
    notes: raw.notes || '',
    total: raw.total || 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    paymentMethod: raw.paymentMethod || 'Cash',
    startTime: raw.startTime || (raw.status === 'Preparing' ? Date.now() - 120000 : null),
    completedTimeElapsed: raw.completedTimeElapsed || (raw.status === 'Ready' ? '5:30sec' : undefined),
  }
}

export const KitchenMode: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Fetch live orders from backend API & user flow endpoint
  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user-flow/orders`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.data)) {
          const mappedOrders: KitchenOrder[] = data.data.map((o: {
            id: string
            status?: string
            items?: Array<{ name: string; quantity: number }>
            notes?: string
            total?: number
            createdAt?: string
            paymentMethod?: string
          }) => {
            const raw = (o.status || '').toUpperCase()
            let norm = 'Unconfirmed'
            if (raw === 'PREPARING' || raw === 'COOKING' || raw === 'IN_PROCESS') norm = 'Preparing'
            else if (raw === 'READY' || raw === 'PREPARED') norm = 'Ready'
            else if (raw === 'COMPLETED' || raw === 'SERVED' || raw === 'DELIVERED') norm = 'Completed'
            else if (raw === 'CONFIRMED' || raw === 'PENDING_PREPARATION' || raw === 'IN_KITCHEN' || raw === 'APPROVED') norm = 'Confirmed'
            else norm = 'Unconfirmed'

            return {
              id: o.id,
              queue: o.id,
              type: 'Delivery',
              category: 'Online Order',
              status: norm,
              items: o.items || [],
              notes: o.notes || '',
              total: o.total || 0,
              createdAt: o.createdAt || new Date().toISOString(),
              paymentMethod: o.paymentMethod || 'GCash',
              startTime: (raw === 'PREPARING' || raw === 'COOKING' || raw === 'IN_PROCESS') ? Date.now() - 60000 : null,
            }
          })

          setOrders(mappedOrders)
          return
        }
      }
    } catch (err) {
      console.warn('Backend connection note in KitchenMode:', err)
    }
  }

  // Initial load, polling
  useEffect(() => {
    const initTimer = setTimeout(() => {
      void fetchKitchenOrders()
    }, 0)
    const pollTimer = setInterval(fetchKitchenOrders, 2000)

    return () => {
      clearTimeout(initTimer)
      clearInterval(pollTimer)
    }
  }, [])

  // Keep a live ticker going for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  // Helper to format elapsed time
  const getPrepTimeDisplay = (order: KitchenOrder): string => {
    if (order.status === 'Pending' || order.status === 'waiting' || order.status === 'CONFIRMED') {
      return 'Waiting'
    }
    if (order.status === 'Ready' || order.status === 'Completed' || order.status === 'Served') {
      return order.completedTimeElapsed || '4:15sec'
    }
    if ((order.status === 'Preparing' || order.status === 'PREPARING' || order.status === 'preparing') && order.startTime) {
      const elapsedSeconds = Math.floor((now - order.startTime) / 1000)
      const mins = Math.floor(elapsedSeconds / 60)
      const secs = elapsedSeconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}sec`
    }
    return '--'
  }

  // Update order status handler
  const updateOrderStatus = async (id: string, newStatus: string) => {
    const normalizedTarget = newStatus.toUpperCase() === 'PREPARING' ? 'PREPARING' : (newStatus.toUpperCase() === 'READY' ? 'READY' : newStatus.toUpperCase())

    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== id) return order

        if (newStatus === 'Preparing' || newStatus === 'PREPARING') {
          return {
            ...order,
            status: 'Preparing',
            startTime: Date.now(),
          }
        }

        if (newStatus === 'Ready' || newStatus === 'READY') {
          return {
            ...order,
            status: 'Ready',
            completedTimeElapsed: '4:30sec',
          }
        }

        return { ...order, status: newStatus }
      })
    )

    // Persist to Express Backend User Flow API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedTarget }),
      })
      await fetchKitchenOrders()
    } catch (err) {
      console.warn('Could not persist status change to backend:', err)
    }
  }

  // Delete order handler
  const deleteOrder = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setOrders((prevOrders) => prevOrders.filter((o) => o.id !== id))
    if (selectedOrderId === id) setSelectedOrderId(null)

    // Delete from localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.filter((o: { id: string }) => o.id !== id)
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
    } catch {
      /* ignore */
    }

    // Delete from Backend API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${id}`, {
        method: 'DELETE',
      })
    } catch (err) {
      console.warn('Could not delete order on backend:', err)
    }
  }

  const handleStatusFromModal = (newStatus: string) => {
    if (selectedOrderId) {
      updateOrderStatus(selectedOrderId, newStatus)
      setSelectedOrderId(null)
    }
  }

  // Filter orders by status for Kanban columns & History table
  const queueOrders = orders.filter((o) => {
    const s = (o.status || '').toUpperCase()
    return s === 'CONFIRMED' || s === 'PENDING_PREPARATION' || s === 'IN_KITCHEN' || s === 'WAITING'
  })
  const processingOrders = orders.filter((o) => {
    const s = (o.status || '').toUpperCase()
    return s === 'PREPARING' || s === 'COOKING' || s === 'IN_PROCESS'
  })
  const doneOrders = orders.filter((o) => {
    const s = (o.status || '').toUpperCase()
    return s === 'READY' || s === 'PREPARED' || s === 'READY_FOR_PICKUP'
  })

  const [historyPage, setHistoryPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  const historyOrders = orders.filter((o) => {
    const s = (o.status || '').toUpperCase()
    return s === 'COMPLETED' || s === 'SERVED' || s === 'DELIVERED'
  })

  const totalPages = Math.max(1, Math.ceil(historyOrders.length / ITEMS_PER_PAGE))
  const startIndex = (historyPage - 1) * ITEMS_PER_PAGE
  const paginatedHistoryOrders = historyOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  return (
    <div className="min-h-screen bg-[#faf9f6] p-3 sm:p-4 lg:p-6 transition-all duration-300 pb-16">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarKitchen />

        {/* Top Header Action Bar with Upper Rightmost Order History Button */}
        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-neutral-900">Kitchen Display Board</h1>
            <span className="text-[11px] bg-orange-50 text-orange-700 font-bold px-2.5 py-0.5 rounded-full border border-orange-100 hidden xs:inline">
              Live Queue
            </span>
          </div>

          {/* Upper Rightmost Order History Icon Button */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff7a00] hover:bg-[#e66e00] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="View Order History"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Order History</span>
            {historyOrders.length > 0 && (
              <span className="bg-white text-[#ff7a00] font-black text-[10px] px-1.5 py-0.5 rounded-full">
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* 3-Column Kanban Board: Queue | Processing | Done */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">

          {/* Column 1: Queue (Waiting Orders) */}
          <section className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs flex flex-col min-h-[480px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span>
                Kitchen Queue
              </h2>
              <span className="bg-neutral-100 text-neutral-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                {queueOrders.length} Waiting
              </span>
            </div>

            <div className="flex-1 space-y-3">
              {queueOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none">
                  <p className="text-xs font-medium">No queued orders</p>
                </div>
              ) : (
                queueOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-neutral-200/80 transition-all duration-150 flex flex-col justify-between"
                  >
                    <div
                      onClick={() => setSelectedOrderId(order.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-neutral-200 text-neutral-700">
                            Queue
                          </span>
                          <button
                            type="button"
                            onClick={(e) => deleteOrder(order.id, e)}
                            className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-md transition-all cursor-pointer"
                            title="Delete order"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <span>{item.name}</span>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Special Request Note */}
                      <div className="mb-2.5 min-h-[30px] flex items-center">
                        {order.notes ? (
                          <p className="text-xs text-neutral-600 bg-neutral-100 px-2.5 py-1.5 rounded-lg font-normal w-full truncate">
                            Note: {order.notes}
                          </p>
                        ) : (
                          <div className="w-full"></div>
                        )}
                      </div>

                      {/* Standardized Prep Timer Row */}
                      <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-neutral-400 font-medium">Prep Timer:</span>
                        <span className="font-bold text-xs text-neutral-500">
                          Waiting
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Start Cooking
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Column 2: On Processing (Active Preparation) */}
          <section className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs flex flex-col min-h-[480px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
                On Processing
              </h2>
              <span className="bg-orange-50 text-orange-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                {processingOrders.length} Cooking
              </span>
            </div>

            <div className="flex-1 space-y-3">
              {processingOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none">
                  <p className="text-xs font-medium">No orders in preparation</p>
                </div>
              ) : (
                processingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-orange-200/80 transition-all duration-150 flex flex-col justify-between"
                  >
                    <div
                      onClick={() => setSelectedOrderId(order.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-orange-100 text-orange-800">
                            Cooking
                          </span>
                          <button
                            type="button"
                            onClick={(e) => deleteOrder(order.id, e)}
                            className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-md transition-all cursor-pointer"
                            title="Delete order"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <span>{item.name}</span>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Special Request Note */}
                      <div className="mb-2.5 min-h-[30px] flex items-center">
                        {order.notes ? (
                          <p className="text-xs text-neutral-600 bg-neutral-100 px-2.5 py-1.5 rounded-lg font-normal w-full truncate">
                            Note: {order.notes}
                          </p>
                        ) : (
                          <div className="w-full"></div>
                        )}
                      </div>

                      {/* Standardized Prep Timer Row */}
                      <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-neutral-400 font-medium">Prep Timer:</span>
                        <span className="font-bold text-xs text-orange-600">
                          {getPrepTimeDisplay(order)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'Ready')}
                      className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-2.5 rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Mark as Done
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Column 3: On Done (Completed Orders Ready for Customer) */}
          <section className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-2xs flex flex-col min-h-[480px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                On Done
              </h2>
              <span className="bg-emerald-50 text-emerald-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                {doneOrders.length} Ready
              </span>
            </div>

            <div className="flex-1 space-y-3">
              {doneOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none">
                  <p className="text-xs font-medium">No done orders waiting</p>
                </div>
              ) : (
                doneOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#faf9f6] rounded-xl p-4 border border-neutral-200/80 transition-all duration-150 flex flex-col justify-between"
                  >
                    <div
                      onClick={() => setSelectedOrderId(order.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-emerald-100 text-emerald-800">
                            Ready
                          </span>
                          <button
                            type="button"
                            onClick={(e) => deleteOrder(order.id, e)}
                            className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-md transition-all cursor-pointer"
                            title="Delete order"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-medium text-neutral-700">
                            <span>{item.name}</span>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Special Request Note */}
                      <div className="mb-2.5 min-h-[30px] flex items-center">
                        {order.notes ? (
                          <p className="text-xs text-neutral-600 bg-neutral-100 px-2.5 py-1.5 rounded-lg font-normal w-full truncate">
                            Note: {order.notes}
                          </p>
                        ) : (
                          <div className="w-full"></div>
                        )}
                      </div>

                      {/* Standardized Prep Timer Row */}
                      <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-neutral-400 font-medium">Total Prep Time:</span>
                        <span className="font-bold text-xs text-emerald-700">
                          {getPrepTimeDisplay(order)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'Completed')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                    >
                      Customer Received
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

      </div>

      {/* Order History Modal Dialog */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-neutral-100 flex flex-col animate-scale-up max-h-[92vh]">

            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-white border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                  Order History
                </h2>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Completed orders received by customers
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-full border border-emerald-100">
                  {historyOrders.length} Completed
                </span>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-700 flex items-center justify-center transition-all cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Order History Table */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-100 text-left">
                    <thead className="bg-neutral-50 text-xs uppercase font-extrabold tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-6 py-3.5">Reference #</th>
                        <th className="px-6 py-3.5">Date & Time</th>
                        <th className="px-6 py-3.5">Items</th>
                        <th className="px-6 py-3.5">Table / Category</th>
                        <th className="px-6 py-3.5">Total Amount</th>
                        <th className="px-6 py-3.5">Order Type</th>
                        <th className="px-6 py-3.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                      {paginatedHistoryOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-neutral-400">
                            <div className="font-bold text-neutral-600 text-sm">No completed order history yet.</div>
                            <div className="text-xs text-neutral-400 mt-0.5">
                              Orders marked as 'Customer Received' will appear in this history table.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedHistoryOrders.map((tx) => (
                          <tr key={tx.id} className="hover:bg-neutral-50/60 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-orange-600">{tx.queue}</td>
                            <td className="px-6 py-3.5 text-neutral-500 whitespace-nowrap">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now'}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-neutral-800">
                              {tx.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                            </td>
                            <td className="px-6 py-3.5 text-neutral-600 font-semibold">{tx.category}</td>
                            <td className="px-6 py-3.5 font-bold text-neutral-900">
                              ₱{(tx.total || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-3.5">
                              <span
                                className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${tx.type === 'Dine In'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : tx.type === 'Take Out'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-purple-50 text-purple-700 border border-purple-100'
                                  }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-6 py-3.5">
                              <button
                                type="button"
                                onClick={(e) => deleteOrder(tx.id, e)}
                                className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 border border-transparent hover:border-red-200"
                                title="Delete from history"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-neutral-50 px-6 py-3 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold text-neutral-500">
                  <div>
                    Showing{' '}
                    <span className="font-bold text-neutral-800">
                      {historyOrders.length === 0 ? 0 : startIndex + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-bold text-neutral-800">
                      {Math.min(startIndex + ITEMS_PER_PAGE, historyOrders.length)}
                    </span>{' '}
                    of <span className="font-bold text-neutral-800">{historyOrders.length}</span> orders
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-700 font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-bold text-neutral-700">
                      Page {historyPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                      disabled={historyPage >= totalPages}
                      className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-neutral-700 font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="bg-neutral-900 hover:bg-black text-white font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80 animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 bg-neutral-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Order #{selectedOrder.queue}</h3>
                <p className="text-xs font-normal opacity-80 mt-0.5">{selectedOrder.category}</p>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-sm leading-none transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">

              {/* Order Items */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5">Order Items</h4>
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

              {/* Special Requests / Notes */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Special Requests / Notes</h4>
                <div className="bg-neutral-100 border border-neutral-200/80 rounded-xl p-3.5 text-xs text-neutral-700 font-medium">
                  {selectedOrder.notes || 'No special requests/notes for this order.'}
                </div>
              </div>

              {/* Prep Timer */}
              <div className="flex justify-between items-center bg-[#faf9f6] border border-neutral-200/80 rounded-xl p-3.5">
                <span className="text-xs font-semibold text-neutral-500">Preparation Time</span>
                <span className={`text-sm font-bold ${selectedOrder.status === 'Preparing' ? 'text-orange-600' : 'text-neutral-600'
                  }`}>
                  {getPrepTimeDisplay(selectedOrder)}
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => handleStatusFromModal('Preparing')}
                  disabled={selectedOrder.status === 'Preparing'}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all cursor-pointer text-xs"
                >
                  Start Preparing
                </button>
                <button
                  onClick={() => handleStatusFromModal('Ready')}
                  className="w-full bg-neutral-900 hover:bg-black text-white font-semibold py-3 rounded-xl transition-all cursor-pointer text-xs"
                >
                  Mark as Ready
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={(e) => deleteOrder(selectedOrder.id, e)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl transition-all cursor-pointer text-xs border border-red-200 flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Order
                </button>
                <button
                  onClick={() => setSelectedOrderId(null)}
                  className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-2.5 rounded-xl transition-all cursor-pointer text-xs"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KitchenMode

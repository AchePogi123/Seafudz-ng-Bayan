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

export const KitchenMode: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Load orders from LocalStorage
  const getLocalOrders = (): KitchenOrder[] => {
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return parsed
        .filter((o: any) => {
          const rawStatus = (o.status || '').toUpperCase()
          const orderType = (o.type || '').toLowerCase()
          const isDelivery = orderType.includes('delivery') || o.deliveryAddress || (o.address && o.customer !== 'Walk-In')

          // If it is an online delivery order, it MUST NOT appear in kitchen while it is still PENDING / UNVERIFIED!
          // It will ONLY appear in kitchen after Assistant approves/sends it (CONFIRMED / PREPARING / READY / COMPLETED).
          if (isDelivery && (rawStatus === 'PENDING' || rawStatus === 'FLAGGED' || rawStatus === 'UNCONFIRMED')) {
            return false
          }

          return true
        })
        .map((o: any) => {
          const rawStatus = (o.status || '').toUpperCase()
          let mappedStatus = 'Confirmed'
          if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(rawStatus)) mappedStatus = 'Preparing'
          else if (['READY', 'PREPARED'].includes(rawStatus)) mappedStatus = 'Ready'
          else if (['COMPLETED', 'SERVED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'IN_TRANSIT'].includes(rawStatus)) mappedStatus = 'Completed'
          else mappedStatus = 'Confirmed'

          return {
            id: o.id || o.ref || `ORD-${Math.floor(Math.random() * 1000)}`,
            queue: o.id || o.ref || 'POS',
            type: o.type || 'Take Out',
            category: o.table ? `Dine In - ${o.table}` : (o.type || 'Take Out'),
            status: mappedStatus,
            items: (o.cartItems || []).map((ci: any) => ({
              name: ci.item?.name || ci.name || 'Food Item',
              quantity: ci.quantity || 1,
            })),
            notes: o.notes || '',
            createdAt: o.dateTime || new Date().toISOString(),
          }
        })
    } catch {
      return []
    }
  }

  // Fetch live tickets from backend API & merge with LocalStorage
  const fetchKitchenOrders = async () => {
    let fetchedApiOrders: KitchenOrder[] = []

    try {
      const res = await fetch(`${API_BASE_URL}/kitchen/orders`)
      if (res.ok) {
        const result = await res.json()
        if (Array.isArray(result.data)) {
          fetchedApiOrders = result.data
            .filter((o: any) => {
              const raw = (o.status || o.order_status || '').toUpperCase()
              const orderType = (o.order_type || o.type || '').toLowerCase()
              const isDelivery = orderType.includes('delivery') || o.deliveryAddress

              // Online delivery orders won't show in kitchen until verified & confirmed by Assistant
              if (isDelivery && (raw === 'PENDING' || raw === 'FLAGGED' || raw === 'UNCONFIRMED')) {
                return false
              }
              return true
            })
            .map((o: any) => {
              const raw = (o.status || o.order_status || '').toUpperCase()
              let norm = 'Confirmed'
              if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(raw)) norm = 'Preparing'
              else if (['READY', 'PREPARED'].includes(raw)) norm = 'Ready'
              else if (['COMPLETED', 'SERVED', 'DELIVERED', 'CUSTOMER RECEIVED', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'IN_TRANSIT'].includes(raw)) norm = 'Completed'
              else norm = 'Confirmed'

              return {
                id: o.id,
                queue: o.id,
                type: o.order_type || 'Take Out',
                category: o.table_name ? `Dine In - ${o.table_name}` : (o.order_type || 'Take Out'),
                status: norm,
                items: (o.items || []).map((item: any) => ({
                  name: item.name || item.product_name_snapshot || 'Food Item',
                  quantity: item.quantity || 1,
                })),
                notes: o.notes || '',
                createdAt: o.created_at || new Date().toISOString(),
              }
            })
        }
      }
    } catch (err) {
      console.warn('Backend connection note in KitchenMode:', err)
    }

    const fetchedLocalOrders = getLocalOrders()
    const mergedMap = new Map<string, KitchenOrder>()

    // Priority to local updates (most real-time for live interactions)
    fetchedLocalOrders.forEach((item) => {
      mergedMap.set(item.id, item)
    })

    // Merge API orders without duplicating already existing local tickets
    fetchedApiOrders.forEach((apiItem) => {
      const exists = Array.from(mergedMap.values()).some(
        (local) => local.id === apiItem.id || local.queue === apiItem.queue || local.queue === apiItem.id || local.id === apiItem.queue
      )
      if (!exists) {
        mergedMap.set(apiItem.id, apiItem)
      }
    })

    setOrders(Array.from(mergedMap.values()))
  }

  useEffect(() => {
    void fetchKitchenOrders()
    const pollTimer = setInterval(fetchKitchenOrders, 2000)

    const handleStorageEvent = () => void fetchKitchenOrders()
    window.addEventListener('seafudz_order_created', handleStorageEvent)

    return () => {
      clearInterval(pollTimer)
      window.removeEventListener('seafudz_order_created', handleStorageEvent)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  const getPrepTimeDisplay = (order: KitchenOrder): string => {
    if (order.status === 'Pending' || order.status === 'Confirmed' || order.status === 'CONFIRMED') {
      return 'Waiting'
    }
    if (order.status === 'Ready' || order.status === 'Completed') {
      return order.completedTimeElapsed || '4:15sec'
    }
    if (order.status === 'Preparing' && order.startTime) {
      const elapsedSeconds = Math.floor((now - order.startTime) / 1000)
      const mins = Math.floor(elapsedSeconds / 60)
      const secs = elapsedSeconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}sec`
    }
    return '--'
  }

  // Persistent Status Update Logic
  const updateOrderStatus = async (id: string, newStatus: string) => {
    const upperStatus = newStatus.toUpperCase()
    let normalizedTarget = 'PENDING'

    if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(upperStatus)) {
      normalizedTarget = 'IN_PROCESS'
    } else if (['READY', 'PREPARED'].includes(upperStatus)) {
      normalizedTarget = 'READY'
    } else if (['COMPLETED', 'SERVED', 'DELIVERED', 'CUSTOMER RECEIVED'].includes(upperStatus)) {
      normalizedTarget = 'COMPLETED'
    }

    // 1. Update React UI state immediately
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== id) return order
        if (newStatus === 'Preparing') return { ...order, status: 'Preparing', startTime: Date.now() }
        if (newStatus === 'Ready') return { ...order, status: 'Ready', completedTimeElapsed: '4:30sec' }
        if (newStatus === 'Completed') return { ...order, status: 'Completed' }
        return { ...order, status: newStatus }
      })
    )

    // 2. Persist update in LocalStorage so polling doesn't reset it
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) => {
        if (o.id === id || o.ref === id) {
          return { ...o, status: normalizedTarget === 'COMPLETED' ? 'Completed' : normalizedTarget }
        }
        return o
      })
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
    } catch {
      /* fallback silent */
    }

    // 3. Persist update in Express Backend API
    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedTarget }),
      })
    } catch {
      /* fallback silent */
    }
  }

  const deleteOrder = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setOrders((prev) => prev.filter((o) => o.id !== id))
    if (selectedOrderId === id) setSelectedOrderId(null)

    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.filter((o: any) => o.id !== id && o.ref !== id)
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
    } catch {
      /* ignore */
    }

    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${id}`, { method: 'DELETE' })
    } catch {
      /* fallback silent */
    }
  }

  const handleStatusFromModal = (newStatus: string) => {
    if (selectedOrderId) {
      updateOrderStatus(selectedOrderId, newStatus)
      setSelectedOrderId(null)
    }
  }

  const queueOrders = orders.filter((o) => {
    const s = (o.status || '').toUpperCase()
    return s === 'CONFIRMED' || s === 'PENDING_PREPARATION' || s === 'IN_KITCHEN' || s === 'WAITING' || s === 'UNCONFIRMED' || s === 'PENDING'
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

        <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-neutral-900">Kitchen Display Board</h1>
            <span className="text-[11px] bg-orange-50 text-orange-700 font-bold px-2.5 py-0.5 rounded-full border border-orange-100 hidden xs:inline">
              Live Queue
            </span>
          </div>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff7a00] hover:bg-[#e66e00] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="View Order History"
          >
            <span>Order History</span>
            {historyOrders.length > 0 && (
              <span className="bg-white text-[#ff7a00] font-black text-[10px] px-1.5 py-0.5 rounded-full">
                {historyOrders.length}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* Queue Column */}
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
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-neutral-200/80 transition-all flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteOrder(order.id, e)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded-md"
                        >
                          ✕
                        </button>
                      </div>

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

                      {order.notes ? (
                        <div className="bg-red-50 border border-red-200 text-red-800 font-bold text-xs p-2.5 rounded-xl mb-3 flex items-center gap-1.5">
                          <span className="text-base">🌶️</span>
                          <span>Note: {order.notes}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-400 italic mb-2">No special instructions</div>
                      )}
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
                    >
                      Start Cooking
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Processing Column */}
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
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-orange-200/80 transition-all flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteOrder(order.id, e)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded-md"
                        >
                          ✕
                        </button>
                      </div>

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

                      {order.notes && (
                        <div className="bg-red-50 border border-red-200 text-red-800 font-bold text-xs p-2.5 rounded-xl mb-2 flex items-center gap-1.5">
                          <span>🌶️</span>
                          <span>Note: {order.notes}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-neutral-400 font-medium">Prep Timer:</span>
                        <span className="font-bold text-xs text-orange-600">{getPrepTimeDisplay(order)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => updateOrderStatus(order.id, 'Ready')}
                      className="w-full bg-neutral-900 hover:bg-black text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
                    >
                      Mark as Done
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Done Column */}
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
                    className="bg-[#faf9f6] rounded-xl p-4 border border-neutral-200/80 transition-all flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteOrder(order.id, e)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded-md"
                        >
                          ✕
                        </button>
                      </div>

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
                    </div>

                    {order.type?.toLowerCase().includes('delivery') || order.category?.toLowerCase().includes('delivery') ? (
                      <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 font-bold py-2.5 rounded-lg text-xs text-center flex items-center justify-center gap-1.5">
                        <span>🛵</span> Ready for Rider Pickup
                      </div>
                    ) : (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Completed')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
                      >
                        Customer Received
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50">
          <div className="bg-white w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4.5 bg-white border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-neutral-900">Order History</h2>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-neutral-100 text-left">
                <thead className="bg-neutral-50 text-xs uppercase font-extrabold text-neutral-500">
                  <tr>
                    <th className="px-6 py-3.5">Reference #</th>
                    <th className="px-6 py-3.5">Date & Time</th>
                    <th className="px-6 py-3.5">Items</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {paginatedHistoryOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-400">
                        No completed order history yet.
                      </td>
                    </tr>
                  ) : (
                    paginatedHistoryOrders.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-6 py-3.5 font-bold text-orange-600">{tx.queue}</td>
                        <td className="px-6 py-3.5 text-neutral-500">{tx.createdAt}</td>
                        <td className="px-6 py-3.5 font-semibold text-neutral-800">
                          {tx.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                        </td>
                        <td className="px-6 py-3.5 text-neutral-600">{tx.category}</td>
                        <td className="px-6 py-3.5">
                          <button onClick={(e) => deleteOrder(tx.id, e)} className="text-red-600 font-bold">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-4 flex justify-between items-center text-xs">
                <span>
                  Page {historyPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-3 py-1 bg-neutral-100 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                    disabled={historyPage >= totalPages}
                    className="px-3 py-1 bg-neutral-100 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80">
            <div className="p-5 bg-neutral-900 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Order #{selectedOrder.queue}</h3>
              <button onClick={() => setSelectedOrderId(null)} className="text-white font-bold">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Order Items</h4>
                <div className="bg-[#faf9f6] rounded-xl border border-neutral-200/80 p-3.5">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 text-xs font-semibold">
                      <span>{item.name}</span>
                      <span className="bg-neutral-200 px-2 py-0.5 rounded font-bold">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Kitchen Special Instructions</h4>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-900">
                  {selectedOrder.notes || 'No special requests/notes provided for this order.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleStatusFromModal('Preparing')}
                  className="bg-orange-600 text-white py-2.5 rounded-xl text-xs font-bold"
                >
                  Start Preparing
                </button>
                <button
                  onClick={() => handleStatusFromModal('Ready')}
                  className="bg-neutral-900 text-white py-2.5 rounded-xl text-xs font-bold"
                >
                  Mark as Ready
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
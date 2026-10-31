import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser, isUuidString } from '../cryptography/cryptoSession'
import { normalizeStatus } from './OnlineCustomer'
import { subscribeOrderSync } from '../utils/orderSync'

interface OrderItem {
  id?: string | number
  name?: string
  product_name_snapshot?: string
  quantity: number
  price?: number
  unit_price?: number
  item_status?: string
  image?: string
  bundledImage?: string
  item?: {
    name?: string
    price?: number
    image?: string
  }
}

interface CustomerOrder {
  id: string
  ref?: string
  customerName?: string
  customer?: string
  phone?: string
  customer_phone?: string
  address?: string
  deliveryAddress?: string
  delivery_address?: string
  paymentMethod?: string
  payment_method?: string
  paymentReference?: string
  referenceNumber?: string
  paymentReceipt?: string
  refundReceipt?: string
  refundReference?: string
  notes?: string
  items: OrderItem[]
  subtotal?: number
  vat?: number
  deliveryFee?: number
  delivery_fee?: number
  total: number
  status: string
  gcashAuthorized?: boolean
  customerResolution?: string | null
  customerResolutionStatus?: string
  outOfStockItems?: any[]
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  riderName?: string
  riderPhone?: string
}

export const CustomerPurchases: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = getActiveUser()
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL')
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ORDERS_PER_PAGE = 6
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const customerDisplayName = useMemo(() => {
    if (!currentUser) return 'Guest'
    const name = currentUser.fullname || currentUser.username || ''
    if (name && !isUuidString(name)) return name
    if (currentUser.email) return currentUser.email.split('@')[0]
    return 'Customer'
  }, [currentUser])

  const getOrdersKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'seafudz_orders_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `seafudz_orders_${id}`
  }

  const getActiveOrderKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'seafudz_active_online_order_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `seafudz_active_online_order_${id}`
  }

  const getCartKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'sfb_customer_cart_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `sfb_customer_cart_${id}`
  }

  // Reorder items from completed order and redirect to billing
  const handleOrderAgain = (order: CustomerOrder) => {
    try {
      const user = getActiveUser()
      const cartKey = getCartKey(user)

      const reorderItems = (order.items || []).map((it, idx) => {
        const itemObj = (it.item || {}) as any
        const productId = it.id || (it as any).productId || (it as any).product_id || itemObj.id || `reorder-${idx}`
        const name = it.name || it.product_name_snapshot || itemObj.name || 'Seafood Dish'
        const price = Number(it.price ?? it.unit_price ?? itemObj.price ?? 0)
        const image = it.image || itemObj.image || it.bundledImage || ''

        return {
          item: {
            id: String(productId),
            name,
            price,
            image,
            category: (itemObj as any).category || 'Seafoods',
            description: (itemObj as any).description || '',
          },
          quantity: it.quantity || 1,
          specialNote: (it as any).specialNote || '',
        }
      })

      if (reorderItems.length > 0) {
        localStorage.setItem(cartKey, JSON.stringify(reorderItems))
        window.dispatchEvent(new Event('storage'))
      }

      // Clear any stale completed/cancelled active order so billing is ready for new order
      const activeKey = getActiveOrderKey(user)
      const existingActive = localStorage.getItem(activeKey)
      if (existingActive) {
        try {
          const parsed = JSON.parse(existingActive)
          if (['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED'].includes(normalizeStatus(parsed.status))) {
            localStorage.removeItem(activeKey)
          }
        } catch { }
      }
    } catch (err) {
      console.warn('Could not reorder items into cart:', err)
    }

    navigate('/customer?tab=billing')
  }

  // Load and merge customer orders from Backend API + Local Storage
  const fetchCustomerOrders = async () => {
    try {
      const mergedMap = new Map<string, CustomerOrder>()

      // 1. Load from User-scoped LocalStorage
      const userOrdersKey = getOrdersKey(currentUser)
      const activeOrderKey = getActiveOrderKey(currentUser)

      try {
        const localList = JSON.parse(localStorage.getItem(userOrdersKey) || '[]')
        if (Array.isArray(localList)) {
          localList.forEach((o) => {
            if (o && o.id) mergedMap.set(String(o.id), o)
          })
        }
      } catch { }

      try {
        const savedActive = localStorage.getItem(activeOrderKey)
        if (savedActive) {
          const activeObj = JSON.parse(savedActive)
          if (activeObj && activeObj.id) {
            mergedMap.set(String(activeObj.id), {
              ...mergedMap.get(String(activeObj.id)),
              ...activeObj,
            })
          }
        }
      } catch { }

      try {
        const globalList = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
        if (Array.isArray(globalList)) {
          globalList.forEach((o) => {
            if (!o || !o.id) return
            const nameMatch = currentUser?.fullname && (
              String(o.customerName || o.customer || '').toLowerCase() === currentUser.fullname.toLowerCase()
            )
            const phoneMatch = currentUser?.phone && (
              String(o.phone || o.customer_phone || '').trim() === currentUser.phone.trim()
            )
            if (nameMatch || phoneMatch || !currentUser) {
              if (!mergedMap.has(String(o.id))) {
                mergedMap.set(String(o.id), o)
              } else {
                mergedMap.set(String(o.id), { ...mergedMap.get(String(o.id)), ...o })
              }
            }
          })
        }
      } catch { }

      // 2. Fetch from Backend API
      try {
        const queryParams = new URLSearchParams()
        if (currentUser?.fullname && !isUuidString(currentUser.fullname)) {
          queryParams.set('customerName', currentUser.fullname)
        }
        if (currentUser?.id) {
          queryParams.set('customerId', currentUser.id)
        }
        if (currentUser?.phone) {
          queryParams.set('phone', currentUser.phone)
        }

        const res = await fetch(`${API_BASE_URL}/user-flow/orders?${queryParams.toString()}`)
        if (res.ok) {
          const json = await res.json()
          const backendList = json.data || json
          if (Array.isArray(backendList)) {
            backendList.forEach((order: any) => {
              if (!order || !order.id) return
              const id = String(order.id)
              const existing = (mergedMap.get(id) || {}) as any
              mergedMap.set(id, {
                ...existing,
                ...order,
                id,
                items: Array.isArray(order.items) && order.items.length > 0 ? order.items : existing.items || [],
                status: order.status || existing.status || 'PENDING',
              })
            })
          }
        }
      } catch (err) {
        console.warn('Backend fetch for customer orders had an issue, using local cached orders:', err)
      }

      const list = Array.from(mergedMap.values())
      // Sort newest orders first
      list.sort((a, b) => {
        const dateA = a.created_at || a.createdAt || ''
        const dateB = b.created_at || b.createdAt || ''
        if (dateA && dateB) {
          return new Date(dateB).getTime() - new Date(dateA).getTime()
        }
        return String(b.id).localeCompare(String(a.id))
      })

      setOrders(list)

      // If user had an active tracking modal open, update its state
      if (selectedOrder) {
        const updated = list.find((o) => String(o.id) === String(selectedOrder.id))
        if (updated) setSelectedOrder(updated)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomerOrders()
    const unsubscribe = subscribeOrderSync(() => {
      fetchCustomerOrders()
    })
    const interval = setInterval(fetchCustomerOrders, 3000)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'seafudz_orders' || e.key === 'seafudz_active_online_order' || (currentUser && e.key === getOrdersKey(currentUser))) {
        fetchCustomerOrders()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      unsubscribe()
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Filter orders by tab and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const norm = normalizeStatus(order.status)
      const isCancelled = norm === 'CANCELLED'
      const isCompleted = ['COMPLETED', 'DELIVERED', 'SERVED'].includes(norm)
      const isActive = !isCancelled && !isCompleted

      if (statusFilter === 'ACTIVE' && !isActive) return false
      if (statusFilter === 'COMPLETED' && !isCompleted) return false
      if (statusFilter === 'CANCELLED' && !isCancelled) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const idMatch = String(order.id).toLowerCase().includes(q)
        const notesMatch = String(order.notes || '').toLowerCase().includes(q)
        const refMatch = String(order.paymentReference || order.referenceNumber || '').toLowerCase().includes(q)
        const itemMatch = (order.items || []).some((i) => {
          const name = i.name || i.product_name_snapshot || i.item?.name || ''
          return name.toLowerCase().includes(q)
        })
        return idMatch || notesMatch || refMatch || itemMatch
      }

      return true
    })
  }, [orders, statusFilter, searchQuery])

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchQuery])

  // Pagination calculations (6 orders per page)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startItem = filteredOrders.length === 0 ? 0 : (safePage - 1) * ORDERS_PER_PAGE + 1
  const endItem = Math.min(safePage * ORDERS_PER_PAGE, filteredOrders.length)

  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * ORDERS_PER_PAGE
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE)
  }, [filteredOrders, safePage])

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | string)[] = [1]
    if (current > 3) {
      pages.push('...')
    }
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (current < total - 2) {
      pages.push('...')
    }
    pages.push(total)
    return pages
  }

  // Counts for filter pills
  const counts = useMemo(() => {
    let active = 0
    let completed = 0
    let cancelled = 0
    orders.forEach((o) => {
      const norm = normalizeStatus(o.status)
      if (norm === 'CANCELLED') cancelled++
      else if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(norm)) completed++
      else active++
    })
    return { all: orders.length, active, completed, cancelled }
  }, [orders])

  // Format order date
  const formatOrderDate = (order: CustomerOrder) => {
    const raw = order.created_at || order.createdAt
    if (!raw) return 'Recent Order'
    try {
      const d = new Date(raw)
      if (isNaN(d.getTime())) {
        return raw
      }
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return String(raw)
    }
  }

  // Visual status pill configuration
  const getStatusBadge = (rawStatus?: string) => {
    const norm = normalizeStatus(rawStatus)
    switch (norm) {
      case 'PENDING':
        return {
          label: 'Awaiting Verification',
          className: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/20',
          dotClass: 'bg-amber-500 animate-pulse',
        }
      case 'CONFIRMED':
        return {
          label: 'Order Confirmed',
          className: 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-400/20',
          dotClass: 'bg-blue-500',
        }
      case 'PREPARING':
        return {
          label: 'Kitchen Preparing',
          className: 'bg-orange-50 text-orange-800 border-orange-300 ring-1 ring-orange-400/30',
          dotClass: 'bg-orange-500 animate-ping',
        }
      case 'READY':
        return {
          label: 'Order Ready',
          className: 'bg-purple-50 text-purple-800 border-purple-300 ring-1 ring-purple-400/20',
          dotClass: 'bg-purple-500',
        }
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Out for Delivery',
          className: 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-1 ring-indigo-400/30',
          dotClass: 'bg-indigo-500 animate-pulse',
        }
      case 'COMPLETED':
        return {
          label: 'Order Delivered',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20',
          dotClass: 'bg-emerald-500',
        }
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          className: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/20',
          dotClass: 'bg-rose-500',
        }
      case 'OUT_OF_STOCK':
        return {
          label: 'Decision Needed',
          className: 'bg-amber-100 text-amber-900 border-amber-400 ring-1 ring-amber-500/20',
          dotClass: 'bg-amber-600 animate-bounce',
        }
      default:
        return {
          label: norm || 'Processing',
          className: 'bg-slate-50 text-slate-800 border-slate-300',
          dotClass: 'bg-slate-400',
        }
    }
  }

  // Open the order tracking view directly in the Customer menu
  const handleOpenInLiveMenu = (order: CustomerOrder) => {
    try {
      localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(order))
      localStorage.setItem('seafudz_active_online_order', JSON.stringify(order))
    } catch { }
    navigate(`/customer?orderId=${encodeURIComponent(order.id)}&tab=tracking`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf6f0] via-[#f7f2ea] to-[#f4ede3] text-neutral-800 flex flex-col font-sans">
      {/* Header with Navigation */}
      <div className="sticky top-0 z-50 p-2 sm:p-4 max-w-7xl mx-auto w-full">
        <NavbarCustomer />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Navigation Back to Menu */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/customer"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-neutral-600 hover:text-orange-600 transition-colors cursor-pointer group"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span>Back to Customer Menu</span>
          </Link>
        </div>

        {/* Filter Tabs & Search Controls */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Orders', count: counts.all },
              { id: 'ACTIVE', label: 'Active', count: counts.active },
              { id: 'COMPLETED', label: 'Completed', count: counts.completed },
              { id: 'CANCELLED', label: 'Cancelled', count: counts.cancelled },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  statusFilter === tab.id ? 'bg-white/30 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative max-w-md w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, dish name, notes..."
              className="w-full bg-neutral-50 border border-slate-200 rounded-xl px-9 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            <svg className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Orders Listing */}
        {loading && orders.length === 0 ? (
          <div className="bg-white/90 rounded-2xl p-12 text-center border border-slate-200/80 space-y-3">
            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-neutral-500">Loading your purchases...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white/90 rounded-3xl p-10 sm:p-14 text-center border border-slate-200/80 space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-2xl">
              🦐
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-neutral-800">No purchases found</h3>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                {searchQuery
                  ? `No orders matching "${searchQuery}". Try searching with a different term.`
                  : "You haven't placed any orders yet. Explore our freshly cooked seafood menu!"}
              </p>
            </div>
            <div>
              <Link
                to="/customer"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span>Browse Menu Dishes</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div id="orders-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedOrders.map((order) => {
              const badge = getStatusBadge(order.status)
              const itemsList = order.items || []
              const totalItems = itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0)

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 p-5 space-y-4 cursor-pointer hover:border-orange-300 flex flex-col justify-between group"
                >
                  {/* Top: Order ID & Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-neutral-900 text-base group-hover:text-orange-600 transition-colors">
                          #{order.id}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                          Delivery
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{formatOrderDate(order)}</p>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${badge.className}`}>
                      <span className={`w-2 h-2 rounded-full ${badge.dotClass}`} />
                      <span>{badge.label}</span>
                    </div>
                  </div>

                  {/* Middle: Items List Snapshot */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block">
                      Ordered Items ({totalItems} pcs)
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {itemsList.map((item, idx) => {
                        const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood Dish'
                        const price = item.price ?? item.unit_price ?? item.item?.price ?? 0
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs text-neutral-700 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100">
                            <span className="font-semibold truncate max-w-[240px]">
                              {item.quantity}× {name}
                            </span>
                            <span className="font-bold text-neutral-900 shrink-0">
                              ₱{(price * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bottom: Payment & Total + Action */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block">
                        {order.paymentMethod || 'Online'}
                      </span>
                      <span className="text-lg font-black text-orange-600">
                        ₱{Number(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {['COMPLETED', 'DELIVERED', 'SERVED'].includes(normalizeStatus(order.status)) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOrderAgain(order)
                          }}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          <span>Order Again</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenInLiveMenu(order)
                          }}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                          </svg>
                          <span>Track Status</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Bar (6 orders per page) */}
        {!loading && filteredOrders.length > 0 && (
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
            <div className="text-xs text-neutral-500 font-medium">
              Showing <strong className="font-extrabold text-neutral-800">{startItem}–{endItem}</strong> of{' '}
              <strong className="font-extrabold text-neutral-800">{filteredOrders.length}</strong> orders
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                {/* Previous Page Button */}
                <button
                  type="button"
                  onClick={() => {
                    const prev = Math.max(1, safePage - 1)
                    setCurrentPage(prev)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed bg-white border border-slate-200 text-neutral-700 hover:bg-neutral-50 active:scale-95 cursor-pointer shadow-2xs"
                  aria-label="Previous Page"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                  <span>Prev</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {getPageNumbers(safePage, totalPages).map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-xs text-neutral-400 font-bold">
                          ...
                        </span>
                      )
                    }
                    const pageNum = Number(p)
                    const isActive = pageNum === safePage
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setCurrentPage(pageNum)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30 ring-2 ring-orange-400/40'
                            : 'bg-white border border-slate-200 text-neutral-700 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                {/* Next Page Button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(totalPages, safePage + 1)
                    setCurrentPage(next)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed bg-white border border-slate-200 text-neutral-700 hover:bg-neutral-50 active:scale-95 cursor-pointer shadow-2xs"
                  aria-label="Next Page"
                >
                  <span>Next</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* ORDER TRACK STATUS MODAL (Shown when user clicks an order) */}
      {/* ======================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-neutral-950/65 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedOrder(null)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transform-gpu animate-in zoom-in-95 duration-200 border border-neutral-100 z-10">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
                  📦
                </div>
                <div>
                  <h3 className="font-extrabold text-neutral-900 text-base sm:text-lg leading-tight">
                    Order Tracking #{selectedOrder.id}
                  </h3>
                  <p className="text-[11px] text-neutral-400">Placed on {formatOrderDate(selectedOrder)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                  title="Close Tracking"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Order Status Badge & Alert */}
              {(() => {
                const norm = normalizeStatus(selectedOrder.status)
                const isCancelled = norm === 'CANCELLED'

                return (
                  <div className={`p-4 rounded-2xl border ${
                    isCancelled
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : norm === 'COMPLETED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-orange-50 border-orange-200 text-orange-950'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                          Current Status
                        </span>
                        <h4 className="font-extrabold text-base sm:text-lg mt-0.5">
                          {isCancelled
                            ? 'Order Cancelled'
                            : norm === 'COMPLETED'
                            ? 'Order Delivered & Completed'
                            : norm === 'OUT_FOR_DELIVERY'
                            ? 'Rider is Delivering Your Food!'
                            : norm === 'READY'
                            ? 'Order Packed & Ready for Pickup'
                            : norm === 'PREPARING'
                            ? 'Chef is Cooking Your Dishes'
                            : norm === 'CONFIRMED'
                            ? 'Order Confirmed in Kitchen Queue'
                            : 'Awaiting Assistant Verification'}
                        </h4>
                      </div>
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${getStatusBadge(selectedOrder.status).className}`}>
                        {getStatusBadge(selectedOrder.status).label}
                      </span>
                    </div>

                    {/* Progress Bar (Stepper) */}
                    {!isCancelled && (
                      <div className="pt-6 pb-2">
                        <div className="relative flex items-center justify-between w-full">
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-neutral-200 z-0 rounded-full" />
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-orange-500 transition-all duration-500 z-0 rounded-full"
                            style={{
                              width:
                                norm === 'PENDING'
                                  ? '0%'
                                  : norm === 'CONFIRMED'
                                  ? '20%'
                                  : norm === 'OUT_OF_STOCK'
                                  ? '30%'
                                  : norm === 'PREPARING'
                                  ? '45%'
                                  : norm === 'READY'
                                  ? '65%'
                                  : norm === 'OUT_FOR_DELIVERY'
                                  ? '85%'
                                  : '100%',
                            }}
                          />

                          {[
                            { key: 'PENDING', label: 'Placed', icon: '📝' },
                            { key: 'CONFIRMED', label: 'Confirmed', icon: '✓' },
                            { key: 'PREPARING', label: 'Cooking', icon: '🍳' },
                            { key: 'READY', label: 'Ready', icon: '📦' },
                            { key: 'OUT_FOR_DELIVERY', label: 'On Way', icon: '🛵' },
                            { key: 'COMPLETED', label: 'Delivered', icon: '🎉' },
                          ].map((step) => {
                            const statusOrder = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
                            const isCurrent = norm === step.key
                            const isDone = statusOrder.indexOf(norm) >= statusOrder.indexOf(step.key)

                            return (
                              <div key={step.key} className="flex flex-col items-center z-10 relative">
                                <div
                                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-black border-2 shadow-xs transition-all duration-300 ${
                                    isCurrent
                                      ? 'bg-orange-500 border-orange-500 text-white scale-110 ring-4 ring-orange-200'
                                      : isDone
                                      ? 'bg-orange-500 border-orange-500 text-white'
                                      : 'bg-white border-neutral-300 text-neutral-400'
                                  }`}
                                >
                                  {step.icon}
                                </div>
                                <span className={`text-[10px] sm:text-xs font-bold mt-1.5 text-center ${
                                  isCurrent ? 'text-orange-600 font-extrabold' : isDone ? 'text-neutral-800' : 'text-neutral-400'
                                }`}>
                                  {step.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Rider Information (if available) */}
              {selectedOrder.riderName && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-950 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-200 text-indigo-800 flex items-center justify-center text-lg">
                      🛵
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Assigned Delivery Rider</span>
                      <h5 className="font-extrabold text-sm">{selectedOrder.riderName}</h5>
                      {selectedOrder.riderPhone && (
                        <p className="text-xs text-indigo-700">{selectedOrder.riderPhone}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-extrabold bg-indigo-600 text-white px-3 py-1 rounded-full">
                    Active Rider
                  </span>
                </div>
              )}

              {/* Delivery Details */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-2 text-xs">
                <h5 className="font-extrabold text-neutral-800 text-sm">Delivery Destination</h5>
                <p className="text-neutral-600">
                  <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Recipient:</span>{' '}
                  {selectedOrder.customerName || selectedOrder.customer || customerDisplayName}
                </p>
                <p className="text-neutral-600">
                  <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Phone:</span>{' '}
                  {selectedOrder.phone || selectedOrder.customer_phone || 'Not provided'}
                </p>
                <p className="text-neutral-600 leading-relaxed">
                  <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Address:</span>{' '}
                  {selectedOrder.address || selectedOrder.deliveryAddress || selectedOrder.delivery_address || 'Delivery Address on file'}
                </p>
                {selectedOrder.notes && (
                  <p className="text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                    <span className="font-bold uppercase text-[10px] block">Instructions:</span>
                    {selectedOrder.notes}
                  </p>
                )}
              </div>

              {/* Payment Info & Screenshot Preview */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-neutral-800 text-sm">Payment Details</h5>
                  <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[11px]">
                    {selectedOrder.paymentMethod || 'Online'}
                  </span>
                </div>
                {(selectedOrder.paymentReference || selectedOrder.referenceNumber) && (
                  <p className="text-neutral-600">
                    <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Reference Number:</span>{' '}
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-800">
                      {selectedOrder.paymentReference || selectedOrder.referenceNumber}
                    </span>
                  </p>
                )}
                {selectedOrder.paymentReceipt && (
                  <div className="pt-1">
                    <span className="font-bold text-neutral-400 uppercase text-[10px] block mb-1.5">Submitted GCash Receipt:</span>
                    <img
                      src={selectedOrder.paymentReceipt}
                      alt="GCash Receipt Screenshot"
                      onClick={() => setPreviewImage(selectedOrder.paymentReceipt || null)}
                      className="w-20 h-20 object-cover rounded-xl border border-neutral-200 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity"
                    />
                  </div>
                )}
              </div>

              {/* Itemized Order Breakdown */}
              <div className="space-y-3">
                <h5 className="font-extrabold text-neutral-800 text-sm">Itemized Bill</h5>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white text-xs">
                  {(selectedOrder.items || []).map((item, idx) => {
                    const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood Dish'
                    const unitPrice = item.price ?? item.unit_price ?? item.item?.price ?? 0
                    const lineTotal = unitPrice * (item.quantity || 1)
                    return (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-neutral-800">{item.quantity}× {name}</span>
                          <span className="text-[11px] text-neutral-400 block">₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</span>
                        </div>
                        <span className="font-extrabold text-neutral-900">
                          ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Subtotal, VAT, Delivery Fee, Total */}
                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-1.5 text-xs text-neutral-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold text-neutral-800">
                      ₱{(selectedOrder.subtotal !== undefined ? Number(selectedOrder.subtotal) : Math.round(Number(selectedOrder.total || 0) / 1.12 - (selectedOrder.deliveryFee || 50))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-orange-600 font-medium">
                    <span>VAT (12%):</span>
                    <span className="font-bold">
                      ₱{(selectedOrder.vat !== undefined ? Number(selectedOrder.vat) : Math.round((Number(selectedOrder.total || 0) - (selectedOrder.deliveryFee || 50)) * 0.12 / 1.12)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span className="font-bold text-neutral-800">
                      ₱{Number(selectedOrder.deliveryFee ?? selectedOrder.delivery_fee ?? 50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-neutral-900 pt-2 border-t border-dashed border-neutral-200">
                    <span>Total Paid:</span>
                    <span className="text-orange-600">
                      ₱{Number(selectedOrder.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-extrabold text-xs hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Back to Orders List
              </button>

              {['COMPLETED', 'DELIVERED', 'SERVED'].includes(normalizeStatus(selectedOrder.status)) ? (
                <button
                  type="button"
                  onClick={() => handleOrderAgain(selectedOrder)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  <span>Order Again</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleOpenInLiveMenu(selectedOrder)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Open in Live Menu Tracking</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl">
            <img src={previewImage} alt="Payment Receipt Screenshot" className="max-h-[80vh] w-auto object-contain rounded-xl" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerPurchases

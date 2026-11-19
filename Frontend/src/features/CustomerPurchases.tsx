import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser, isUuidString, isEmployeeRole, getEmployeeWorkModule } from '../cryptography/cryptoSession'
import { normalizeStatus, blocksNewOrder } from './OnlineCustomer'
import {
  OrderIcon,
  Panel,
  PanelRows,
  InfoRow,
  StatusPill,
  OrderProgress,
  describeOrderStatus,
  type ProgressStep,
} from './customer/orderStatusUi'
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
  deliveryProof?: string
  delivery_proof?: string
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
  fulfillmentType?: string
  fulfillment_type?: string
  type?: string
}

const isPickupOrder = (order: CustomerOrder) =>
  String(order.fulfillmentType || order.fulfillment_type || order.type || '')
    .toUpperCase()
    .includes('PICKUP')

const stepsFor = (order: CustomerOrder): ProgressStep[] =>
  isPickupOrder(order)
    ? [
        { key: 'PENDING', label: 'Order placed', icon: 'receipt' },
        { key: 'CONFIRMED', label: 'Confirmed', icon: 'check' },
        { key: 'PREPARING', label: 'Preparing', icon: 'cooking' },
        { key: 'READY', label: 'Ready for pick-up', icon: 'bag' },
        { key: 'COMPLETED', label: 'Picked up', icon: 'check' },
      ]
    : [
        { key: 'PENDING', label: 'Order placed', icon: 'receipt' },
        { key: 'CONFIRMED', label: 'Confirmed', icon: 'check' },
        { key: 'PREPARING', label: 'Preparing', icon: 'cooking' },
        { key: 'READY', label: 'Ready', icon: 'bag' },
        { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: 'scooter' },
        { key: 'COMPLETED', label: 'Delivered', icon: 'check' },
      ]

const peso = (value: number) =>
  `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const CustomerPurchases: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = getActiveUser()

  useEffect(() => {
    if (currentUser && isEmployeeRole(currentUser.role)) {
      const work = getEmployeeWorkModule(currentUser.role);
      navigate(work?.route || '/pos', { replace: true });
    }
  }, [currentUser, navigate]);

  if (currentUser && isEmployeeRole(currentUser.role)) {
    const work = getEmployeeWorkModule(currentUser.role);
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-9 h-9 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
        <h2 className="text-base font-bold text-neutral-800">Redirecting to {work?.label || 'Staff Workspace'}…</h2>
        <p className="text-xs text-neutral-500 mt-1">Staff accounts cannot view customer purchases.</p>
      </div>
    );
  }

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PREPARING' | 'DELIVERY' | 'PENDING'>('ALL')
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
    // One order at a time: reordering while something is still in progress would only land the
    // customer on a checkout screen that refuses to submit, so send them to that order instead.
    const ongoing = activeOrders.find((o) => blocksNewOrder(o.status))
    if (ongoing) {
      alert(`You already have an ongoing order (#${ongoing.id}). You can order again once it has been delivered or picked up.`)
      navigate(`/customer?orderId=${encodeURIComponent(String(ongoing.id))}&tab=tracking`)
      return
    }

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
        const custName = (!isUuidString(currentUser?.fullname) ? currentUser?.fullname : null) ||
                         (!isUuidString(currentUser?.username) ? currentUser?.username : null)
        if (custName) {
          queryParams.set('customerName', custName)
        }
        if (currentUser?.phone) {
          queryParams.set('phone', currentUser.phone)
        }
        if (currentUser?.id && !isUuidString(currentUser.id)) {
          queryParams.set('customerId', currentUser.id)
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
              const authoritativeStatus = order.status || existing.status || 'PENDING'
              mergedMap.set(id, {
                ...existing,
                ...order,
                id,
                items: Array.isArray(order.items) && order.items.length > 0 ? order.items : existing.items || [],
                status: authoritativeStatus,
              })
            })

            // Sync updated authoritative statuses back into user-scoped LocalStorage
            try {
              const currentCached = JSON.parse(localStorage.getItem(userOrdersKey) || '[]')
              if (Array.isArray(currentCached) && currentCached.length > 0) {
                let cacheChanged = false
                const updatedCached = currentCached.map((co: any) => {
                  const match = backendList.find((bo: any) => String(bo.id) === String(co.id) || String(bo.ref) === String(co.ref))
                  if (match && match.status && match.status !== co.status) {
                    cacheChanged = true
                    return { ...co, status: match.status }
                  }
                  return co
                })
                if (cacheChanged) {
                  localStorage.setItem(userOrdersKey, JSON.stringify(updatedCached))
                }
              }

              const savedActiveStr = localStorage.getItem(activeOrderKey)
              if (savedActiveStr) {
                const parsedActive = JSON.parse(savedActiveStr)
                const match = backendList.find((bo: any) => String(bo.id) === String(parsedActive.id) || String(bo.ref) === String(parsedActive.ref))
                if (match && match.status && match.status !== parsedActive.status) {
                  if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(normalizeStatus(match.status))) {
                    localStorage.removeItem(activeOrderKey)
                  } else {
                    localStorage.setItem(activeOrderKey, JSON.stringify({ ...parsedActive, status: match.status }))
                  }
                }
              }
            } catch {}
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

  // Filter strictly for active ongoing orders (completed & cancelled orders are in Order History in Account Management)
  const activeOrders = useMemo(() => {
    return orders.filter((order) => {
      const norm = normalizeStatus(order.status)
      return !['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED'].includes(norm)
    })
  }, [orders])

  // Filter active orders by active stage tab and search query
  const filteredOrders = useMemo(() => {
    return activeOrders.filter((order) => {
      const norm = normalizeStatus(order.status)
      if (statusFilter === 'PREPARING' && !['CONFIRMED', 'PREPARING', 'READY'].includes(norm)) return false
      if (statusFilter === 'DELIVERY' && norm !== 'OUT_FOR_DELIVERY') return false
      if (statusFilter === 'PENDING' && ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(norm)) return false

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
  }, [activeOrders, statusFilter, searchQuery])

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

  // Counts for active ongoing filter pills
  const activeCounts = useMemo(() => {
    let kitchen = 0
    let delivery = 0
    let pending = 0
    activeOrders.forEach((o) => {
      const norm = normalizeStatus(o.status)
      if (norm === 'OUT_FOR_DELIVERY') delivery++
      else if (['CONFIRMED', 'PREPARING', 'READY'].includes(norm)) kitchen++
      else pending++
    })
    return { all: activeOrders.length, kitchen, delivery, pending }
  }, [activeOrders])

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

  /**
   * One status vocabulary for the whole customer app: the same words and the same tone the
   * tracking view uses, rather than a second set of labels invented for this list.
   */
  const statusOf = (order: CustomerOrder) =>
    describeOrderStatus(normalizeStatus(order.status), { isPickup: isPickupOrder(order) })

  // Open the order tracking view directly in the Customer menu
  const handleOpenInLiveMenu = (order: CustomerOrder) => {
    try {
      localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(order))
      localStorage.setItem('seafudz_active_online_order', JSON.stringify(order))
    } catch { }
    navigate(`/customer?orderId=${encodeURIComponent(order.id)}&tab=tracking`)
  }

  return (
    <div className="purchases-view flex min-h-screen flex-col bg-[#f8f6f4] font-sans text-neutral-800">
      <div className="sticky top-0 z-50 mx-auto w-full max-w-6xl p-2 sm:p-4">
        <NavbarCustomer />
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Where this screen sits: the menu behind it, finished orders beside it. */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <Link
            to="/customer"
            className="group inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
          >
            <OrderIcon name="arrowLeft" className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to menu</span>
          </Link>

          <Link
            to="/account?tab=orders"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900"
            title="Completed and cancelled orders"
          >
            <span>Order history</span>
            <OrderIcon name="arrowRight" className="h-3.5 w-3.5 text-neutral-400" />
          </Link>
        </div>

        <header className="px-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Orders in progress</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Everything you have ordered that is still being prepared or delivered. Finished orders live in your
            order history.
          </p>
        </header>

        {/* Filter and search, in the same bar language as the menu */}
        <div className="rounded-2xl border border-neutral-200 bg-white px-2.5 py-2.5">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                { id: 'ALL', label: 'All', count: activeCounts.all },
                { id: 'PREPARING', label: 'In the kitchen', count: activeCounts.kitchen },
                { id: 'DELIVERY', label: 'Out for delivery', count: activeCounts.delivery },
                { id: 'PENDING', label: 'Awaiting verification', count: activeCounts.pending },
              ].map((tab) => {
                const isSelected = statusFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as any)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      isSelected ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-xs tabular-nums ${isSelected ? 'text-white/70' : 'text-neutral-400'}`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="shrink-0 md:ml-auto md:w-64 lg:w-72">
              <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 transition-colors focus-within:border-orange-400 focus-within:bg-white">
                <svg className="h-4 w-4 shrink-0 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search orders or dishes"
                  aria-label="Search your orders"
                  className="w-full border-none bg-transparent text-sm text-neutral-900 placeholder-neutral-500 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="shrink-0 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-700"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Orders */}
        {loading && orders.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            <p className="mt-3 text-sm text-neutral-500">Loading your orders…</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <OrderIcon name="bag" className="h-5 w-5" />
            </div>
            <h2 className="mt-3.5 text-base font-semibold text-neutral-900">
              {searchQuery ? 'Nothing matches that search' : 'No orders in progress'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
              {searchQuery
                ? `No order in progress matches “${searchQuery}”. Try an order number or a dish name, or clear the search.`
                : 'Nothing is being prepared or delivered right now. Your finished orders are kept in your order history.'}
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-full cursor-pointer rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 sm:w-auto"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  to="/customer"
                  className="w-full rounded-xl bg-orange-500 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-orange-600 sm:w-auto"
                >
                  Browse the menu
                </Link>
              )}
              <Link
                to="/account?tab=orders"
                className="w-full rounded-xl border border-neutral-200 px-5 py-2.5 text-center text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 sm:w-auto"
              >
                Order history
              </Link>
            </div>
          </div>
        ) : (
          <div id="orders-cards-grid" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {paginatedOrders.map((order) => {
              const status = statusOf(order)
              const itemsList = order.items || []
              const totalItems = itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0)
              const shown = itemsList.slice(0, 3)
              const hidden = itemsList.length - shown.length

              return (
                <article
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
                >
                  {/* What the customer came for: where this order is, in words. */}
                  <div className="px-5 pb-4 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      <span className="shrink-0 pt-1 text-xs text-neutral-500">
                        {isPickupOrder(order) ? 'Pick-up' : 'Delivery'}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">{status.detail}</p>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      {formatOrderDate(order)} · {order.paymentMethod || 'Online'}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-neutral-500">
                      #{order.id}
                    </p>
                  </div>

                  {/* Dishes on hairlines — the old filled box around every line read as noise. */}
                  <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-5">
                    {shown.map((item, idx) => {
                      const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood dish'
                      const price = item.price ?? item.unit_price ?? item.item?.price ?? 0
                      return (
                        <div key={idx} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
                          <span className="min-w-0 truncate text-neutral-700">
                            <span className="tabular-nums text-neutral-500">{item.quantity}×</span> {name}
                          </span>
                          <span className="shrink-0 tabular-nums text-neutral-900">
                            {peso(price * (item.quantity || 1))}
                          </span>
                        </div>
                      )
                    })}
                    {hidden > 0 && (
                      <p className="py-2.5 text-xs text-neutral-500">
                        and {hidden} more {hidden === 1 ? 'dish' : 'dishes'}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-neutral-100 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-500">
                        Total · {totalItems} {totalItems === 1 ? 'item' : 'items'}
                      </p>
                      <p className="text-lg font-semibold tabular-nums text-neutral-900">{peso(order.total)}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedOrder(order)
                        }}
                        className="cursor-pointer rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenInLiveMenu(order)
                        }}
                        className="cursor-pointer rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                      >
                        Track status
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && (
          <div className="flex select-none flex-col items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row">
            <p className="text-xs text-neutral-500">
              Showing <span className="font-semibold tabular-nums text-neutral-900">{startItem}–{endItem}</span> of{' '}
              <span className="font-semibold tabular-nums text-neutral-900">{filteredOrders.length}</span> orders
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(Math.max(1, safePage - 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safePage === 1}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-neutral-200"
                  aria-label="Previous page"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>

                {getPageNumbers(safePage, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-neutral-400">
                        …
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
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums transition-colors ${
                        isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(Math.min(totalPages, safePage + 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={safePage === totalPages}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-default disabled:opacity-35 disabled:hover:border-neutral-200"
                  aria-label="Next page"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Order detail: the same panels, wording and tracker as the live tracking view, so the
          customer is not asked to learn this screen twice. */}
      {selectedOrder && (() => {
        const status = statusOf(selectedOrder)
        const pickup = isPickupOrder(selectedOrder)
        const steps = stepsFor(selectedOrder)
        const norm = normalizeStatus(selectedOrder.status)
        const currentIndex = steps.findIndex((step) => step.key === norm)
        const items = selectedOrder.items || []
        const itemCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0)
        const deliveryFee = pickup ? 0 : Number(selectedOrder.deliveryFee ?? selectedOrder.delivery_fee ?? 50)
        const subtotal =
          selectedOrder.subtotal !== undefined
            ? Number(selectedOrder.subtotal)
            : Math.round(Number(selectedOrder.total || 0) / 1.12 - deliveryFee)
        const vat =
          selectedOrder.vat !== undefined
            ? Number(selectedOrder.vat)
            : Math.round(((Number(selectedOrder.total || 0) - deliveryFee) * 0.12) / 1.12)
        const isFinished = ['COMPLETED', 'DELIVERED', 'SERVED'].includes(norm)
        const receipt = selectedOrder.paymentReceipt
        const proof = selectedOrder.deliveryProof || selectedOrder.delivery_proof

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 duration-200 animate-in fade-in sm:p-6">
            <div
              className="fixed inset-0 bg-neutral-950/55"
              onClick={() => setSelectedOrder(null)}
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Order ${selectedOrder.id}`}
              className="relative z-10 flex max-h-[92vh] w-full max-w-2xl transform-gpu flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 duration-200 animate-in zoom-in-95"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-neutral-900">Order details</h2>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-neutral-500">#{selectedOrder.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Close order details"
                  title="Close"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5 overflow-y-auto px-5 py-5">
                {/* Status, in a sentence, before any table of facts */}
                <div>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <p className="mt-2.5 text-sm leading-relaxed text-neutral-700">{status.detail}</p>
                  <p className="mt-1 text-xs text-neutral-500">Placed {formatOrderDate(selectedOrder)}</p>
                </div>

                {norm !== 'CANCELLED' && (
                  <div className="rounded-2xl border border-neutral-200 px-5 py-5">
                    <OrderProgress steps={steps} currentIndex={currentIndex} compact />
                  </div>
                )}

                <Panel title={pickup ? 'Pick-up & order details' : 'Delivery & order details'} meta={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
                  <dl>
                    <PanelRows>
                      <InfoRow label="Recipient">
                        {selectedOrder.customerName || selectedOrder.customer || customerDisplayName}
                      </InfoRow>
                      <InfoRow label="Phone" mono>
                        {selectedOrder.phone || selectedOrder.customer_phone || 'Not provided'}
                      </InfoRow>
                      {!pickup && (
                        <InfoRow label="Address" stacked>
                          {selectedOrder.address ||
                            selectedOrder.deliveryAddress ||
                            selectedOrder.delivery_address ||
                            'Address on file'}
                        </InfoRow>
                      )}
                      {selectedOrder.notes && (
                        <InfoRow label="Your instructions" stacked>
                          {selectedOrder.notes}
                        </InfoRow>
                      )}
                    </PanelRows>
                  </dl>
                </Panel>

                {selectedOrder.riderName && (
                  <Panel title="Your rider">
                    <dl>
                      <PanelRows>
                        <InfoRow label="Name">{selectedOrder.riderName}</InfoRow>
                        {selectedOrder.riderPhone && (
                          <InfoRow label="Phone" mono>
                            {selectedOrder.riderPhone}
                          </InfoRow>
                        )}
                      </PanelRows>
                    </dl>
                  </Panel>
                )}

                <Panel title="Payment" meta={selectedOrder.paymentMethod || 'Online'}>
                  <dl>
                    <PanelRows>
                      {(selectedOrder.paymentReference || selectedOrder.referenceNumber) && (
                        <InfoRow label="Reference number" mono>
                          {selectedOrder.paymentReference || selectedOrder.referenceNumber}
                        </InfoRow>
                      )}
                      {receipt && (
                        <InfoRow label="Receipt you sent" stacked>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(receipt)}
                            className="block cursor-pointer overflow-hidden rounded-xl border border-neutral-200 transition-opacity hover:opacity-85"
                            title="View full size"
                          >
                            <img src={receipt} alt="The payment receipt you submitted" className="h-20 w-20 object-cover" />
                          </button>
                        </InfoRow>
                      )}
                      {proof && (
                        <InfoRow label="Handover photo" stacked>
                          <button
                            type="button"
                            onClick={() => setPreviewImage(proof)}
                            className="block cursor-pointer overflow-hidden rounded-xl border border-neutral-200 transition-opacity hover:opacity-85"
                            title="View full size"
                          >
                            <img src={proof} alt="Photo taken by the rider at handover" className="h-20 w-20 object-cover" />
                          </button>
                        </InfoRow>
                      )}
                    </PanelRows>
                  </dl>
                </Panel>

                <Panel title="What you ordered" meta={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}>
                  <div className="divide-y divide-neutral-100 px-5">
                    {items.map((item, idx) => {
                      const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood dish'
                      const unitPrice = item.price ?? item.unit_price ?? item.item?.price ?? 0
                      return (
                        <div key={idx} className="flex items-baseline justify-between gap-5 py-3">
                          <div className="min-w-0">
                            <p className="text-sm text-neutral-900">
                              <span className="tabular-nums text-neutral-500">{item.quantity}×</span> {name}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-neutral-500">{peso(unitPrice)} each</p>
                          </div>
                          <p className="shrink-0 text-sm font-medium tabular-nums text-neutral-900">
                            {peso(unitPrice * (item.quantity || 1))}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  <dl className="border-t border-neutral-100">
                    <PanelRows>
                      <InfoRow label="Subtotal" mono>
                        {peso(subtotal)}
                      </InfoRow>
                      <InfoRow label="VAT (12%)" mono>
                        {peso(vat)}
                      </InfoRow>
                      <InfoRow label={pickup ? 'Pick-up' : 'Delivery fee'} mono>
                        {pickup ? 'No fee' : peso(deliveryFee)}
                      </InfoRow>
                      <InfoRow label="Total paid" className="font-semibold" mono>
                        {peso(selectedOrder.total)}
                      </InfoRow>
                    </PanelRows>
                  </dl>
                </Panel>
              </div>

              <div className="flex shrink-0 flex-col-reverse items-stretch gap-2.5 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="cursor-pointer rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Close
                </button>

                {isFinished ? (
                  <button
                    type="button"
                    onClick={() => handleOrderAgain(selectedOrder)}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Order again
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenInLiveMenu(selectedOrder)}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    Track status
                    <OrderIcon name="arrowRight" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Full-size image */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex cursor-pointer items-center justify-center bg-neutral-950/80 p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Full size image"
        >
          <div className="relative max-h-[85vh] max-w-xl rounded-2xl bg-white p-2 shadow-xl">
            <img src={previewImage} alt="Full size" className="max-h-[80vh] w-auto rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg"
              aria-label="Close image"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerPurchases

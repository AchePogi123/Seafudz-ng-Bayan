import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NavbarCashier from '../components/NavbarCashier'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal, type TransactionData } from '../components/AdminEditTransactionModal'

export interface OrderItemDetail {
  id?: string
  name: string
  quantity: number
  unit_price?: number
  subtotal?: number
}

export interface LiveTransaction {
  id: string
  ref: string
  dateTime: string
  items: string
  customer: string
  total: number
  type: string
  paymentMethod?: string
  status?: string
  itemsList?: OrderItemDetail[]
  customerPhone?: string
  customerAddress?: string
  subtotal?: number
  tax?: number
  deliveryFee?: number
}

interface SummaryData {
  totalOrders: number
  grossRevenue: number
  subtotalRevenue: number
  vatCollected: number
  averageOrderValue: number
  breakdown: {
    cash: { total: number; count: number }
    gcash: { total: number; count: number }
    maya: { total: number; count: number }
    hybrid: { total: number; count: number }
    cod: { total: number; count: number }
  }
}

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

const PAGE_SIZE = 10

type RawOrder = Record<string, unknown>

interface OrderPageResult {
  transactions: LiveTransaction[]
  totalMatchingCount: number
}

const isRawOrder = (value: unknown): value is RawOrder =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRawOrders = (value: unknown): RawOrder[] =>
  Array.isArray(value) ? value.filter(isRawOrder) : []

const readString = (...values: unknown[]): string | undefined => {
  const value = values.find((candidate) =>
    (typeof candidate === 'string' && candidate.trim()) || typeof candidate === 'number'
  )
  return value === undefined ? undefined : String(value)
}

const readNumber = (value: unknown, fallback = 0): number => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const summarizeItems = (items: unknown, fallback: string): string => {
  if (typeof items === 'string') return items
  const summaries = toRawOrders(items).map((item) => {
    const nestedItem = isRawOrder(item.item) ? item.item : {}
    const name = readString(item.name, item.product_name_snapshot, nestedItem.name) || 'Seafood'
    const quantity = readNumber(item.quantity, 1) || 1
    return `${name} x${quantity}`
  })
  return summaries.length ? summaries.join(', ') : fallback
}

const SalesReportCashier: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const location = useLocation()
  const navState = location.state as { channel?: string; tab?: TabType; payment?: string } | null

  const [activeTab, setActiveTab] = useState<TabType>(navState?.tab || 'Today')
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<LiveTransaction | null>(null)

  const [paymentFilter, setPaymentFilter] = useState<string>(navState?.payment || 'All')
  const [channelFilter, setChannelFilter] = useState<string>(navState?.channel || 'All')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMatchingCount, setTotalMatchingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalOrders: 0,
    grossRevenue: 0,
    subtotalRevenue: 0,
    vatCollected: 0,
    averageOrderValue: 0,
    breakdown: {
      cash: { total: 0, count: 0 },
      gcash: { total: 0, count: 0 },
      maya: { total: 0, count: 0 },
      hybrid: { total: 0, count: 0 },
      cod: { total: 0, count: 0 },
    },
  })

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const [previousLocationKey, setPreviousLocationKey] = useState(location.key)
  if (location.key !== previousLocationKey) {
    setPreviousLocationKey(location.key)
    if (navState?.channel) setChannelFilter(navState.channel)
    if (navState?.tab) setActiveTab(navState.tab)
    if (navState?.payment) setPaymentFilter(navState.payment)
  }

  // Lock body scroll when selectedTransaction modal is open
  useEffect(() => {
    if (selectedTransaction) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [selectedTransaction])

  const handleTabChange = (tab: TabType) => {
    setIsLoading(true)
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const handleChannelChange = (channel: string) => {
    setIsLoading(true)
    setChannelFilter(channel)
    setCurrentPage(1)
  }

  const handlePaymentChange = (pm: string) => {
    setIsLoading(true)
    setPaymentFilter(pm)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setIsLoading(true)
    setCurrentPage(page)
  }

  const formatOrderRow = useCallback((dbO: RawOrder): LiveTransaction => {
    const rawType = readString(dbO.order_type, dbO.type) || ''
    const normalizedType =
      rawType.toUpperCase() === 'ONLINE'
        ? 'Delivery'
        : rawType.toUpperCase() === 'ON_SITE'
          ? 'POS Order'
          : rawType || 'POS Order'

    const createdAt = dbO.created_at

    let itemsList: OrderItemDetail[] = []
    if (Array.isArray(dbO.items) && dbO.items.length > 0) {
      itemsList = dbO.items.map((i: any) => ({
        id: i.id || i.product_id,
        name: i.name || i.product_name_snapshot || i.snapshot_item_name || 'Dish',
        quantity: Number(i.quantity || 1),
        unit_price: i.unit_price ? Number(i.unit_price) : undefined,
        subtotal: i.subtotal ? Number(i.subtotal) : (i.unit_price ? Number(i.unit_price) * Number(i.quantity || 1) : undefined)
      }))
    }

    return {
      id: readString(dbO.id) || '',
      ref: readString(dbO.id) || '',
      dateTime: createdAt ? new Date(String(createdAt)).toLocaleString() : new Date().toLocaleString(),
      items: summarizeItems(dbO.items, 'Seafood Dish'),
      itemsList,
      customer: readString(dbO.customer_name) ||
        (normalizedType.toLowerCase().includes('delivery') ? 'Online Customer' : 'Walk-In Customer'),
      customerPhone: readString(dbO.customer_phone, dbO.phone) || undefined,
      customerAddress: readString(dbO.delivery_address, dbO.address) || undefined,
      type: normalizedType,
      total: readNumber(dbO.total),
      subtotal: dbO.subtotal !== undefined && dbO.subtotal !== null ? Number(dbO.subtotal) : undefined,
      tax: (dbO.tax !== undefined && dbO.tax !== null) ? Number(dbO.tax) : (dbO.vat !== undefined ? Number(dbO.vat) : undefined),
      deliveryFee: dbO.delivery_fee !== undefined && dbO.delivery_fee !== null ? Number(dbO.delivery_fee) : undefined,
      paymentMethod: readString(dbO.payment_method) || 'Cash',
      status: readString(dbO.status) || 'Completed',
    }
  }, [])

  const getOrderDate = (order: RawOrder | LiveTransaction): Date | null => {
    const value =
      ('created_at' in order ? order.created_at : undefined) ??
      ('createdAt' in order ? order.createdAt : undefined) ??
      ('dateTime' in order ? order.dateTime : undefined) ??
      ('date' in order ? order.date : undefined) ??
      null

    if (!value) return null
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) return parsed
    const num = Number(value)
    if (!isNaN(num)) {
      const d = new Date(num)
      if (!isNaN(d.getTime())) return d
    }
    return null
  }

  const checkIsInSelectedPeriod = useCallback((order: RawOrder | LiveTransaction, tab: TabType): boolean => {
    const orderDate = getOrderDate(order)
    if (!orderDate) return true

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (tab === 'Today') {
      return orderDate >= startOfToday && orderDate <= endOfToday
    }

    if (tab === 'This Week') {
      const startOfWeek = new Date(startOfToday)
      startOfWeek.setDate(startOfWeek.getDate() - 6)
      startOfWeek.setHours(0, 0, 0, 0)
      return orderDate >= startOfWeek
    }

    if (tab === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return orderDate >= startOfMonth
    }

    if (tab === 'This Year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return orderDate >= startOfYear
    }

    return true
  }, [])

  const fetchSummary = useCallback(async (): Promise<SummaryData | null> => {
    const orderMap = new Map<string, RawOrder>()
    try {
      try {
        const localRaw = localStorage.getItem('seafudz_orders')
        if (localRaw) {
          const localOrders: unknown = JSON.parse(localRaw)
          toRawOrders(localOrders)
            .filter((order) => checkIsInSelectedPeriod(order, activeTab))
            .forEach((order, index) => {
              const key = readString(order.id, order.ref) || `local-${index}`
              orderMap.set(key, order)
            })
        }
      } catch (localErr) {
        console.warn('Failed to read local orders for sales summary:', localErr)
      }

      try {
        const ordersRes = await fetch(
          `${API_BASE_URL}/orders?limit=200&offset=0&tab=${encodeURIComponent(activeTab)}`
        )
        if (ordersRes.ok) {
          const ordersJson: unknown = await ordersRes.json()
          const backendOrders = isRawOrder(ordersJson) ? toRawOrders(ordersJson.data) : []
          backendOrders
            .filter((order) => checkIsInSelectedPeriod(order, activeTab))
            .forEach((order, index) => {
              const key = readString(order.id, order.ref) || `backend-${index}`
              orderMap.set(key, order)
            })
        }
      } catch (ordersErr) {
        console.warn('Failed to fetch orders for sales summary:', ordersErr)
      }

      const orders = Array.from(orderMap.values())

      const breakdown = {
        cash: { total: 0, count: 0 },
        gcash: { total: 0, count: 0 },
        maya: { total: 0, count: 0 },
        hybrid: { total: 0, count: 0 },
        cod: { total: 0, count: 0 },
      }

      let grossRevenue = 0

      orders.forEach((order) => {
        const total = readNumber(
          order.total ?? order.totalAmount ?? order.grandTotal ?? order.amount
        )

        grossRevenue += total

        const payment = (readString(order.payment_method, order.paymentMethod, order.payment) || 'Cash').toLowerCase()

        if (payment.includes('hybrid') || payment.includes('split')) {
          breakdown.hybrid.total += total
          breakdown.hybrid.count += 1
        } else if (payment.includes('gcash')) {
          breakdown.gcash.total += total
          breakdown.gcash.count += 1
        } else if (payment.includes('maya')) {
          breakdown.maya.total += total
          breakdown.maya.count += 1
        } else if (payment.includes('cod')) {
          breakdown.cod.total += total
          breakdown.cod.count += 1
        } else {
          breakdown.cash.total += total
          breakdown.cash.count += 1
        }
      })

      return {
        totalOrders: orders.length,
        grossRevenue,
        subtotalRevenue: 0,
        vatCollected: 0,
        averageOrderValue: orders.length > 0 ? grossRevenue / orders.length : 0,
        breakdown,
      }
    } catch (err) {
      console.warn('Failed to calculate sales summary:', err)
      return null
    }
  }, [activeTab, checkIsInSelectedPeriod])

  const fetchOrdersPage = useCallback(async (): Promise<OrderPageResult> => {
    try {
      const orderMap = new Map<string, LiveTransaction>()

      try {
        const localRaw = localStorage.getItem('seafudz_orders')
        if (localRaw) {
          const parsed: unknown = JSON.parse(localRaw)
          toRawOrders(parsed).forEach((order, index) => {
            if (!checkIsInSelectedPeriod(order, activeTab)) return
            const tx: LiveTransaction = {
              id: readString(order.id, order.ref) || `local-${index}`,
              ref: readString(order.ref, order.id) || `local-${index}`,
              dateTime: readString(order.dateTime, order.createdAt) || new Date().toLocaleString(),
              type: readString(order.type, order.order_type) || 'POS Order',
              status: readString(order.status) || 'Completed',
              customer: readString(order.customerName, order.customer, order.customer_name) || 'Walk-In',
              items: summarizeItems(order.items, 'Seafood Dish'),
              total: readNumber(order.total),
              paymentMethod: readString(order.paymentMethod, order.payment_method) || 'Cash',
            }
            orderMap.set(tx.id, tx)
          })
        }
      } catch (e) {
        console.warn('Error reading local orders:', e)
      }

      try {
        const params = new URLSearchParams({
          limit: '1000',
          tab: activeTab,
        })
        const res = await fetch(`${API_BASE_URL}/orders?${params.toString()}`)
        if (res.ok) {
          const json: unknown = await res.json()
          const list = isRawOrder(json) ? toRawOrders(json.data) : []
          const formatted = list.map(formatOrderRow)
          formatted.forEach((dbO: LiveTransaction) => {
            if (checkIsInSelectedPeriod(dbO, activeTab)) {
              orderMap.set(dbO.id, dbO)
            }
          })
        }
      } catch (err) {
        console.warn('Backend offline', err)
      }

      let allMatching = Array.from(orderMap.values())

      // 3. Apply channel filter
      if (channelFilter !== 'All') {
        const isOnline = channelFilter === 'Online'
        allMatching = allMatching.filter((o) => {
          const t = (o.type || '').toLowerCase()
          const oIsOnline = t.includes('delivery') || t.includes('online')
          return isOnline ? oIsOnline : !oIsOnline
        })
      }

      // 4. Apply payment filter
      if (paymentFilter !== 'All') {
        const p = paymentFilter.toLowerCase()
        if (p === 'hybrid') {
          allMatching = allMatching.filter(
            (o) =>
              (o.paymentMethod || '').toLowerCase().includes('hybrid') ||
              (o.paymentMethod || '').toLowerCase().includes('split')
          )
        } else {
          allMatching = allMatching.filter((o) => (o.paymentMethod || '').toLowerCase().includes(p))
        }
      }

      // 5. Apply search query filter
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        allMatching = allMatching.filter(
          (o) =>
            (o.ref || '').toLowerCase().includes(q) ||
            (o.customer || '').toLowerCase().includes(q) ||
            (o.items || '').toLowerCase().includes(q)
        )
      }

      // Sort descending by date
      allMatching.sort((a, b) => {
        const dA = getOrderDate(a)?.getTime() || 0
        const dB = getOrderDate(b)?.getTime() || 0
        return dB - dA
      })

      const offset = (currentPage - 1) * PAGE_SIZE
      return {
        totalMatchingCount: allMatching.length,
        transactions: allMatching.slice(offset, offset + PAGE_SIZE),
      }
    } catch (err) {
      console.error('Failed to fetch page of orders:', err)
      return { totalMatchingCount: 0, transactions: [] }
    }
  }, [currentPage, activeTab, channelFilter, paymentFilter, debouncedSearch, formatOrderRow, checkIsInSelectedPeriod])

  useEffect(() => {
    let isCurrent = true
    void fetchSummary().then((summary) => {
      if (isCurrent && summary) setSummaryData(summary)
    })
    return () => {
      isCurrent = false
    }
  }, [fetchSummary])

  useEffect(() => {
    let isCurrent = true
    void fetchOrdersPage().then((page) => {
      if (!isCurrent) return
      setTotalMatchingCount(page.totalMatchingCount)
      setTransactions(page.transactions)
      setIsLoading(false)
    })
    return () => {
      isCurrent = false
    }
  }, [fetchOrdersPage])

  const refreshData = () => {
    setIsLoading(true)
    void fetchSummary().then((summary) => {
      if (summary) setSummaryData(summary)
    })
    void fetchOrdersPage().then((page) => {
      setTotalMatchingCount(page.totalMatchingCount)
      setTransactions(page.transactions)
      setIsLoading(false)
    })
  }

  const getOrderedItems = (items: string) => {
    if (!items) return []
    return items
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const totalPages = Math.max(1, Math.ceil(totalMatchingCount / PAGE_SIZE))
  const startItem = totalMatchingCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const endItem = Math.min(currentPage * PAGE_SIZE, totalMatchingCount)

  const getPaginationRange = () => {
    const delta = 1
    const range: (number | string)[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i)
      } else if (range[range.length - 1] !== '...') {
        range.push('...')
      }
    }
    return range
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans pb-16 antialiased">
      {/* Navigation Header */}
      <div className="p-4 sm:p-6 print:hidden">
        <NavbarCashier searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Top Section: Breadcrumb, Title & Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200/80 transition-all cursor-pointer group shrink-0"
              title="Go Back"
              aria-label="Back to Dashboard"
            >
              <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-wide uppercase">
                <span>Cashier Portal</span>
                <span>/</span>
                <span className="text-orange-600">Sales Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Sales Report Cashier
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
                Real-time database audit ledger, revenue analytics, and transaction records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAdminCreateOpen(true)}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Transaction</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                refreshData()
              }}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              title="Refresh data"
            >
              <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Orders</span>
            </button>


          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 print:hidden">
          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === tab
                  ? 'bg-orange-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Database Aggregated</span>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          {/* Total Revenue */}
          <div
            onClick={() => handlePaymentChange('All')}
            className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${paymentFilter === 'All'
              ? 'border-orange-500 ring-2 ring-orange-500/15'
              : 'border-slate-200/80 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue</span>
              <span className="text-base sm:text-lg font-extrabold text-orange-600">
                {summaryData.totalOrders.toLocaleString()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              ₱{summaryData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">Gross sales across all channels</p>
          </div>

          {/* Cash */}
          <div
            onClick={() => handlePaymentChange('Cash')}
            className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${paymentFilter === 'Cash'
              ? 'border-amber-500 ring-2 ring-amber-500/15'
              : 'border-slate-200/80 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Cash Volume</span>
              <span className="text-base sm:text-lg font-extrabold text-amber-600">
                {summaryData.breakdown.cash.count.toLocaleString()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              ₱{summaryData.breakdown.cash.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">Physical register payments</p>
          </div>

          {/* GCash */}
          <div
            onClick={() => handlePaymentChange('GCash')}
            className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${paymentFilter === 'GCash'
              ? 'border-blue-500 ring-2 ring-blue-500/15'
              : 'border-slate-200/80 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">GCash Volume</span>
              <span className="text-base sm:text-lg font-extrabold text-blue-600">
                {summaryData.breakdown.gcash.count.toLocaleString()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              ₱{summaryData.breakdown.gcash.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">Digital wallet & online orders</p>
          </div>

          {/* Hybrid / Split */}
          <div
            onClick={() => handlePaymentChange('Hybrid')}
            className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${paymentFilter === 'Hybrid'
              ? 'border-purple-500 ring-2 ring-purple-500/15'
              : 'border-slate-200/80 hover:border-slate-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">Split & Hybrid</span>
              <span className="text-base sm:text-lg font-extrabold text-purple-600">
                {summaryData.breakdown.hybrid.count.toLocaleString()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
              ₱{summaryData.breakdown.hybrid.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-normal">Mixed payment methods</p>
          </div>
        </div>

        {/* Main Content Area & Table */}
        <div id="print-area">
          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:shadow-none print:border print:rounded-none">
            {/* Filter Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
              <div>
                <h2 className="text-base font-bold text-slate-900">Transaction Register</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audited ledger records with 10 rows per page
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Channel Filter */}
                <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                  {[
                    { label: 'All Channels', val: 'All' },
                    { label: 'POS Walk-In', val: 'POS' },
                    { label: 'Online Delivery', val: 'Online' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => handleChannelChange(item.val)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${channelFilter === item.val
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Payment Filter */}
                <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                  {['All', 'Cash', 'GCash', 'Hybrid'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => handlePaymentChange(pm)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${paymentFilter === pm
                        ? 'bg-orange-500 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setIsLoading(true)
                      setSearchQuery(e.target.value)
                    }}
                    placeholder="Search order ID or customer..."
                    className="w-48 sm:w-60 bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer & Channel</th>
                    <th className="py-3 px-4">Ordered Items</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-normal text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <div className="inline-flex items-center gap-2 text-orange-600 font-medium">
                          <svg className="animate-spin h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span>Loading page {currentPage}...</span>
                        </div>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <p className="font-semibold text-slate-600">No transactions found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Transactions matching the selected period and filters will be displayed here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id || tx.ref} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {tx.ref || tx.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{tx.customer || 'Walk-In'}</div>
                          <div className="text-[11px] text-slate-400">{tx.type}</div>
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="text-left font-medium hover:underline cursor-pointer block max-w-sm text-xs text-slate-800"
                            title="Click to view details"
                          >
                            {getOrderedItems(tx.items).map((item, idx) => {
                              const match = item.match(/^(.*?)\s*x(\d+)$/i)
                              if (match) {
                                return (
                                  <span key={idx} className="inline-flex items-center gap-1.5 mr-2 mb-1 bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded-lg">
                                    <span className="text-slate-800 font-semibold">{match[1].trim()}</span>
                                    <span className="text-sm font-black text-orange-600">x{match[2]}</span>
                                  </span>
                                )
                              }
                              return (
                                <span key={idx} className="mr-2 text-xs font-semibold text-slate-800">
                                  {item}
                                </span>
                              )
                            })}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {tx.dateTime}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${(tx.paymentMethod || '').toLowerCase().includes('hybrid') ||
                              (tx.paymentMethod || '').toLowerCase().includes('split')
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/60'
                              : (tx.paymentMethod || '').toLowerCase().includes('gcash')
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : (tx.paymentMethod || '').toLowerCase().includes('maya')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${(tx.paymentMethod || '').toLowerCase().includes('hybrid') ||
                                (tx.paymentMethod || '').toLowerCase().includes('split')
                                ? 'bg-purple-500'
                                : (tx.paymentMethod || '').toLowerCase().includes('gcash')
                                  ? 'bg-blue-500'
                                  : (tx.paymentMethod || '').toLowerCase().includes('maya')
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                            ></span>
                            {tx.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          ₱{Number(tx.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {tx.status || 'Completed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="text-xs text-slate-500 font-medium">
                Showing <span className="font-semibold text-slate-800">{startItem}–{endItem}</span> of{' '}
                <span className="font-semibold text-slate-800">{totalMatchingCount.toLocaleString()}</span> orders
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Previous Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Prev</span>
                  </button>

                  {/* Page Number Pills */}
                  {getPaginationRange().map((pageItem, idx) => {
                    if (pageItem === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs font-medium text-slate-400">
                          …
                        </span>
                      )
                    }

                    const pageNum = Number(pageItem)
                    const isActive = currentPage === pageNum

                    return (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isActive
                          ? 'bg-orange-500 text-white shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                          }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  {/* Next Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <span>Next</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 antialiased animate-in fade-in duration-100"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 transform-gpu flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedTransaction.status?.toUpperCase() === 'CANCELLED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {selectedTransaction.status || 'Completed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {selectedTransaction.ref || selectedTransaction.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body with smooth scrolling */}
            <div className="p-6 overflow-y-auto overscroll-contain will-change-scroll space-y-4">
              {/* Customer & Delivery Information */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Customer & Delivery Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Customer Name</span>
                    <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                      {selectedTransaction.customer || 'Walk-In Customer'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Contact Phone</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {selectedTransaction.customerPhone || 'None recorded'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Delivery / Customer Address</span>
                    <span className="font-medium text-slate-800 mt-0.5 block leading-relaxed">
                      {selectedTransaction.customerAddress || (selectedTransaction.type?.toLowerCase().includes('delivery') ? 'No delivery address recorded' : 'In-Store / On-Site')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 text-xs">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Channel</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedTransaction.type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Method</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedTransaction.paymentMethod || 'Cash'}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Date & Time</span>
                  <span className="font-medium text-slate-700 mt-0.5 block text-[11px]">{selectedTransaction.dateTime}</span>
                </div>
              </div>

              {/* Ordered Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Ordered Items
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {(selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length)} item{((selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length) === 1 ? '' : 's')}
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedTransaction.itemsList && selectedTransaction.itemsList.length > 0 ? (
                    selectedTransaction.itemsList.map((item, idx) => (
                      <div
                        key={`item-${idx}`}
                        className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800 text-sm block truncate">{item.name}</span>
                          {item.unit_price !== undefined && (
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                            Qty: {item.quantity}
                          </span>
                          {item.subtotal !== undefined && (
                            <span className="font-mono font-bold text-slate-900 text-sm min-w-[70px] text-right">
                              ₱{Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    getOrderedItems(selectedTransaction.items).map((item, index) => {
                      const match = item.match(/^(.*?)\s*x(\d+)$/i)
                      const itemName = match ? match[1].trim() : item
                      const quantity = match ? match[2] : null

                      return (
                        <div
                          key={`${selectedTransaction.id}-item-${index}`}
                          className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-2.5 text-xs"
                        >
                          <span className="font-bold text-slate-800 text-sm">{itemName}</span>
                          {quantity && (
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                              Qty: {quantity}
                            </span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Financial Summary Breakdown */}
              <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-medium">
                    ₱{(selectedTransaction.subtotal !== undefined
                      ? Number(selectedTransaction.subtotal)
                      : Number(selectedTransaction.total || 0)
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>VAT / Tax (12%)</span>
                  <span className="font-mono font-medium">
                    ₱{(selectedTransaction.tax !== undefined ? Number(selectedTransaction.tax) : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {(selectedTransaction.deliveryFee !== undefined && Number(selectedTransaction.deliveryFee) > 0) && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span className="font-mono font-medium">
                      ₱{Number(selectedTransaction.deliveryFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-orange-200/70 flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">Order Total</span>
                  <span className="text-lg font-bold text-orange-600 font-mono">
                    ₱{Number(selectedTransaction.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer (Read-Only) */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Action Modals */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={refreshData}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingTransaction)}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={refreshData}
      />

    </div>
  )
}

export default SalesReportCashier

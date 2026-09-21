import React, { useState, useEffect, useCallback } from 'react'
import NavbarCashier from '../components/NavbarCashier'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'

export interface LiveTransaction {
  id: string
  ref: string
  dateTime: string
  items: string
  customer: string
  total: number
  type: 'Dine In' | 'Take Out' | 'Delivery' | string
  paymentMethod?: string
  status?: string
  notes?: string
  cartItems?: any[]
  cashReceived?: number | string
  change?: number
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

export const SalesReportCashier: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const [activeTab, setActiveTab] = useState<TabType>('Today')
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | 'Dine In' | 'Take Out' | 'Delivery'>('All')
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Cash' | 'GCash' | 'COD'>('All')

  // Selected transaction for inspecting official receipt modal
  const [selectedTransaction, setSelectedTransaction] = useState<LiveTransaction | null>(null)

  // Pagination state (10 per page)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMatchingCount, setTotalMatchingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
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
  const [editingTransaction, setEditingTransaction] = useState<LiveTransaction | null>(null)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Helper to format backend order row
  const formatOrderRow = useCallback((dbO: any): LiveTransaction => {
    const rawType = dbO.order_type || dbO.type || ''
    const normalizedType =
      rawType.toUpperCase() === 'ONLINE' || rawType === 'Delivery'
        ? 'Delivery'
        : rawType.toUpperCase() === 'ON_SITE'
        ? 'Dine In'
        : rawType || 'Dine In'

    let itemsSummary = 'Seafood Dish'
    let rawItemsList: any[] = []

    if (Array.isArray(dbO.items) && dbO.items.length > 0) {
      rawItemsList = dbO.items
      itemsSummary = dbO.items
        .map((i: any) => `${i.name || i.product_name_snapshot || 'Dish'} x${i.quantity || 1}`)
        .join(', ')
    } else if (typeof dbO.items === 'string') {
      itemsSummary = dbO.items
    }

    return {
      id: String(dbO.id),
      ref: String(dbO.id),
      dateTime: dbO.created_at ? new Date(dbO.created_at).toLocaleString() : new Date().toLocaleString(),
      items: itemsSummary,
      cartItems: rawItemsList,
      customer:
        dbO.customer_name ||
        (normalizedType === 'Delivery' ? 'Online Customer' : 'Walk-In Customer'),
      total: Number(dbO.total || 0),
      type: normalizedType,
      paymentMethod: dbO.payment_method || 'Cash',
      status: dbO.status || 'Completed',
      notes: dbO.notes || '',
    }
  }, [])

  // Fetch KPI summary from backend
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sales/summary?tab=${encodeURIComponent(activeTab)}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setSummaryData({
            totalOrders: json.data.totalOrders || 0,
            grossRevenue: json.data.grossRevenue || 0,
            subtotalRevenue: json.data.subtotalRevenue || 0,
            vatCollected: json.data.vatCollected || 0,
            averageOrderValue: json.data.averageOrderValue || 0,
            breakdown: json.data.breakdown || {
              cash: { total: 0, count: 0 },
              gcash: { total: 0, count: 0 },
              maya: { total: 0, count: 0 },
              hybrid: { total: 0, count: 0 },
              cod: { total: 0, count: 0 },
            },
          })
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cashier sales summary:', err)
    }
  }, [activeTab])

  // Fetch exact 10 orders for current page
  const fetchOrdersPage = useCallback(async () => {
    setIsLoading(true)
    try {
      const offset = (currentPage - 1) * PAGE_SIZE
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        tab: activeTab,
      })
      if (typeFilter !== 'All') params.append('type', typeFilter)
      if (paymentFilter !== 'All') params.append('payment', paymentFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)

      const res = await fetch(`${API_BASE_URL}/orders?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        const list = json.data || []
        const formatted = list.map(formatOrderRow)
        setTransactions(formatted)
        setTotalMatchingCount(typeof json.total === 'number' ? json.total : formatted.length)
      }
    } catch (err) {
      console.error('Failed to fetch 10 orders for cashier:', err)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, activeTab, typeFilter, paymentFilter, debouncedSearch, formatOrderRow])

  // Fetch KPI summary when activeTab changes
  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  // Fetch exact 10 orders when page or filters change
  useEffect(() => {
    void fetchOrdersPage()
  }, [fetchOrdersPage])

  // Auto-sync listener
  useEffect(() => {
    const handleSync = () => {
      void fetchSummary()
      void fetchOrdersPage()
    }

    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)

    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [fetchSummary, fetchOrdersPage])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const handleTypeChange = (type: 'All' | 'Dine In' | 'Take Out' | 'Delivery') => {
    setTypeFilter(type)
    setCurrentPage(1)
  }

  const handlePaymentChange = (pm: 'All' | 'Cash' | 'GCash' | 'COD') => {
    setPaymentFilter(pm)
    setCurrentPage(1)
  }

  // Helper to parse items string into list
  const getOrderedItems = (items: string) => {
    if (!items) return []
    return items
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const handleDeleteTransaction = async (id: string) => {
    const confirmDelete = window.confirm(
      `⚠️ Admin Action: Are you sure you want to permanently delete transaction #${id}? This will remove it from the PostgreSQL database and all role views.`
    )
    if (!confirmDelete) return

    try {
      await fetch(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}

    try {
      const local = localStorage.getItem('seafudz_orders')
      if (local) {
        const parsed = JSON.parse(local)
        const updated = parsed.filter((o: any) => o.id !== id && o.ref !== id)
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      window.dispatchEvent(new Event('seafudz_order_created'))
    } catch {}

    if (selectedTransaction?.id === id) setSelectedTransaction(null)
    void fetchSummary()
    void fetchOrdersPage()
  }

  // Calculate Pagination numbers
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
    <div className="min-h-screen bg-[#f8f6f4] text-neutral-900 font-sans p-3 sm:p-4 lg:p-6 transition-all duration-300 pb-24 lg:pb-6">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        {/* Integrated Cashier Navbar */}
        <NavbarCashier searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {/* Sales Register Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200/80 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900">
                Cashier Sales Register & Analytics
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-1">
              Live ledger displaying 10 orders per page for Walk-In POS and Online Delivery
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setIsAdminCreateOpen(true)}
                className="bg-[#ff7b00] hover:bg-[#e06c00] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-orange-500/20 active:scale-95 flex items-center gap-1.5"
              >
                <span>➕</span> Create Transaction
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Live Sync
            </span>
            <button
              onClick={() => {
                void fetchSummary()
                void fetchOrdersPage()
              }}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              ↻ Refresh Sales
            </button>
          </div>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[#ff7b00] text-white shadow-md shadow-orange-500/20'
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center text-xs font-bold text-neutral-600 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-200">
            Total Orders: <strong className="text-neutral-900 ml-1">{summaryData.totalOrders.toLocaleString()}</strong>
          </div>
        </div>

        {/* Analytics Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Total Revenue */}
          <div className="bg-white p-5 rounded-3xl shadow-2xs border border-neutral-200/80 space-y-1">
            <p className="text-[11px] uppercase font-black tracking-wider text-neutral-400">
              Total Sales Revenue
            </p>
            <div className="text-2xl sm:text-3xl font-black text-[#ff7b00]">
              ₱{summaryData.grossRevenue.toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              Exact revenue for {activeTab.toLowerCase()}
            </p>
          </div>

          {/* Orders Processed */}
          <div className="bg-white p-5 rounded-3xl shadow-2xs border border-neutral-200/80 space-y-1">
            <p className="text-[11px] uppercase font-black tracking-wider text-neutral-400">
              Completed Orders
            </p>
            <div className="text-2xl sm:text-3xl font-black text-neutral-800">
              {summaryData.totalOrders.toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              Verified paid transactions
            </p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white p-5 rounded-3xl shadow-2xs border border-neutral-200/80 space-y-1">
            <p className="text-[11px] uppercase font-black tracking-wider text-neutral-400">
              Average Transaction Value
            </p>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              ₱{summaryData.averageOrderValue.toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              Per order transaction average
            </p>
          </div>

          {/* Cash vs GCash Breakdown */}
          <div className="bg-white p-5 rounded-3xl shadow-2xs border border-neutral-200/80 space-y-1">
            <p className="text-[11px] uppercase font-black tracking-wider text-neutral-400">
              Cash vs GCash Total
            </p>
            <div className="text-sm font-bold text-slate-800 pt-1">
              ₱{summaryData.breakdown.cash.total.toLocaleString()} Cash / ₱{summaryData.breakdown.gcash.total.toLocaleString()} GCash
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              {summaryData.breakdown.cash.count} Cash • {summaryData.breakdown.gcash.count} GCash
            </p>
          </div>
        </div>

        {/* Filters Bar: Channel & Payment Mode */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-2xs">
          {/* Channel Filters */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold text-neutral-400 uppercase text-[10px]">Channel:</span>
            {(['All', 'Dine In', 'Take Out', 'Delivery'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  typeFilter === type
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Payment Method Filters */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-bold text-neutral-400 uppercase text-[10px]">Payment:</span>
            {(['All', 'Cash', 'GCash', 'COD'] as const).map((method) => (
              <button
                key={method}
                onClick={() => handlePaymentChange(method)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  paymentFilter === method
                    ? 'bg-orange-500 text-white shadow-2xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="bg-white rounded-3xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-neutral-800 flex items-center gap-2">
              <span>🧾 Live Transactions</span>
              <span className="text-xs font-bold bg-neutral-100 text-neutral-600 px-2.5 py-0.5 rounded-full">
                Page {currentPage} of {totalPages}
              </span>
            </h2>

            <span className="text-xs text-neutral-400 font-semibold">
              Period: <strong className="text-neutral-700">{activeTab}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-left text-xs font-medium">
              <thead className="bg-neutral-50 text-[11px] uppercase font-extrabold tracking-wider text-neutral-400">
                <tr>
                  <th className="px-6 py-4">Reference #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Ordered Items Summary</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Payment Method</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Receipt</th>
                  {isAdmin && <th className="px-6 py-4 text-center">Admin Actions</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="px-6 py-16 text-center text-orange-600">
                      <div className="flex items-center justify-center gap-2 font-bold">
                        <svg className="animate-spin h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        <span>Loading page {currentPage}...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 10 : 9} className="px-6 py-16 text-center text-neutral-400">
                      <span className="text-3xl block mb-2">📋</span>
                      <div className="font-bold text-neutral-700 text-base">No transactions recorded</div>
                      <div className="text-xs mt-1 text-neutral-400">
                        Completed sales placed at POS or by Online Customers will appear here automatically.
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isCancelled = (tx.status || '').toUpperCase() === 'CANCELLED'

                    return (
                      <tr key={tx.id} className="hover:bg-orange-50/40 transition-colors">
                        <td className="px-6 py-4 font-extrabold text-orange-600 uppercase tracking-wide">
                          {tx.ref}
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-bold text-neutral-800 block">
                            {tx.customer}
                          </span>
                        </td>

                        <td className="px-6 py-4 max-w-xs truncate text-neutral-700 font-medium">
                          {tx.items}
                        </td>

                        <td className="px-6 py-4 text-neutral-500 text-[11px] whitespace-nowrap">
                          {tx.dateTime}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap ${
                              tx.type === 'Delivery'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : tx.type === 'Dine In'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                              (tx.paymentMethod || '').toLowerCase().includes('gcash')
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : (tx.paymentMethod || '').toLowerCase().includes('cod')
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-neutral-100 text-neutral-800 border border-neutral-200'
                            }`}
                          >
                            {tx.paymentMethod || 'Cash'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right font-black text-base text-[#ff7b00]">
                          ₱{tx.total.toLocaleString()}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isCancelled
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {tx.status || 'Completed'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="bg-neutral-100 hover:bg-orange-500 hover:text-white text-neutral-700 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center gap-1 mx-auto"
                          >
                            <span>🧾</span> Receipt
                          </button>
                        </td>

                        {isAdmin && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingTransaction(tx)}
                                title="Edit Transaction (Admin)"
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-all border border-amber-200 cursor-pointer"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTransaction(tx.id)}
                                title="Delete Transaction (Admin)"
                                className="bg-red-600 hover:bg-red-700 text-red-600 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-all border border-red-200 cursor-pointer"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 1-10 PER PAGE PAGINATION CONTROLS */}
          <div className="pt-4 pb-4 px-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Showing 1-10 of N label */}
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
              <span className="bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200">
                Showing <strong className="text-orange-600">{startItem}–{endItem}</strong> of{' '}
                <strong className="text-neutral-900">{totalMatchingCount.toLocaleString()}</strong> orders
              </span>
              <span className="text-[11px] text-neutral-400 font-semibold">(10 per page)</span>
            </div>

            {/* Page navigation buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Prev Button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                >
                  <span>⬅️</span> Prev
                </button>

                {/* Numbered Page Buttons */}
                {getPaginationRange().map((pageItem, idx) => {
                  if (pageItem === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 text-xs font-black text-neutral-400">
                        …
                      </span>
                    )
                  }

                  const pageNum = Number(pageItem)
                  const isActive = currentPage === pageNum

                  return (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={isLoading}
                      className={`min-w-[34px] h-[34px] px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30 ring-2 ring-orange-400/30'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                >
                  Next <span>➡️</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OFFICIAL RECEIPT INSPECTION MODAL (POS Inspired Theme) */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧾</span>
                <h3 className="font-extrabold text-neutral-900 text-lg tracking-tight">
                  Transaction Receipt
                </h3>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Official Receipt Content */}
            <div className="p-5 space-y-4 text-xs font-mono text-neutral-800">
              <div className="text-center space-y-0.5 font-sans border-b border-dashed border-neutral-300 pb-4">
                <h4 className="font-black text-lg text-neutral-900 tracking-tight">SEAFOOD NG BAYAN</h4>
                <p className="text-[11px] text-neutral-500 font-medium">Point of Sale & Online Official Receipt</p>
                <p className="text-[11px] text-neutral-400 font-medium">Ref #{selectedTransaction.ref}</p>
                <p className="text-[10px] text-neutral-400 pt-1">{selectedTransaction.dateTime}</p>
              </div>

              {/* Order Info */}
              <div className="space-y-1 font-sans text-xs bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-semibold">Customer:</span>
                  <strong className="text-neutral-800">{selectedTransaction.customer}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-semibold">Channel Type:</span>
                  <strong className="text-orange-600">{selectedTransaction.type}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-semibold">Payment Mode:</span>
                  <strong className="text-neutral-800">{selectedTransaction.paymentMethod || 'Cash'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-semibold">Status:</span>
                  <strong className={selectedTransaction.status === 'CANCELLED' ? 'text-rose-600' : 'text-emerald-600'}>
                    {selectedTransaction.status || 'Completed'}
                  </strong>
                </div>
              </div>

              {/* Ordered Items Breakdown */}
              <div className="space-y-2 pt-2 border-t border-dashed border-neutral-300">
                <p className="font-bold font-sans text-[11px] uppercase tracking-wider text-neutral-400">
                  Itemized Order Breakdown:
                </p>

                <div className="space-y-1.5">
                  {getOrderedItems(selectedTransaction.items).map((itemStr, idx) => {
                    const match = itemStr.match(/^(.*?)\s*x(\d+)$/i)
                    const name = match ? match[1].trim() : itemStr
                    const qty = match ? parseInt(match[2], 10) : 1

                    return (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-neutral-800">{name} x{qty}</span>
                        <span className="font-bold text-neutral-600">Item Total</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="pt-3 border-t border-dashed border-neutral-300 space-y-1.5 font-sans">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal (Net of VAT):</span>
                  <span>₱{Math.round(selectedTransaction.total / 1.12).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>VAT (12%):</span>
                  <span>₱{Math.round((selectedTransaction.total / 1.12) * 0.12).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-neutral-900 pt-1 border-t border-neutral-200">
                  <span>Total Amount Paid:</span>
                  <span className="text-orange-600">₱{selectedTransaction.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-neutral-100 flex flex-wrap gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTransaction(selectedTransaction)
                      setSelectedTransaction(null)
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-extrabold py-2.5 rounded-2xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span> Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="px-5 bg-neutral-900 hover:bg-black text-white font-extrabold py-2.5 rounded-2xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CRUD MODALS */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={() => {
          void fetchSummary()
          void fetchOrdersPage()
        }}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingTransaction)}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={() => {
          void fetchSummary()
          void fetchOrdersPage()
        }}
      />
    </div>
  )
}

export default SalesReportCashier
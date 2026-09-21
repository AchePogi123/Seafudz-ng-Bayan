import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

export const SalesReportCashier: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const [activeTab, setActiveTab] = useState<TabType>('Today')
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All' | 'Dine In' | 'Take Out' | 'Delivery'>('All')
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Cash' | 'GCash' | 'COD'>('All')

  // Selected transaction for inspecting official receipt modal
  const [selectedTransaction, setSelectedTransaction] = useState<LiveTransaction | null>(null)
  
  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<LiveTransaction | null>(null)

  const isFetchingRef = useRef(false)
  const lastFetchRef = useRef(0)

  // Load Real Orders from LocalStorage and Backend API
  const loadOrders = useCallback(async (force?: boolean | unknown) => {
    if (isFetchingRef.current) return
    const isForce = typeof force === 'boolean' ? force : false
    const now = Date.now()
    if (!isForce && now - lastFetchRef.current < 2000) return

    isFetchingRef.current = true
    lastFetchRef.current = now

    try {
      let combined: LiveTransaction[] = []

      // 1. Read LocalStorage
      try {
        const local = localStorage.getItem('seafudz_orders')

        if (local) {
          const parsed = JSON.parse(local)

          if (Array.isArray(parsed)) {
            combined = parsed.map((o: any) => {
              let itemsSummary = 'Seafood Dish'
              let rawItemsList: any[] = []

              if (Array.isArray(o.cartItems)) {
                rawItemsList = o.cartItems
                itemsSummary = o.cartItems
                  .map((i: any) => `${i.name || i.item?.name || 'Seafood'} x${i.quantity || 1}`)
                  .join(', ')
              } else if (Array.isArray(o.items)) {
                rawItemsList = o.items
                itemsSummary = o.items
                  .map((i: any) => `${i.name || i.item?.name || 'Seafood'} x${i.quantity || 1}`)
                  .join(', ')
              } else if (typeof o.items === 'string') {
                itemsSummary = o.items
              }

              return {
                id: String(o.id || o.ref),
                ref: String(o.ref || o.id),
                dateTime: o.dateTime || o.createdAt || new Date().toLocaleString(),
                items: itemsSummary,
                cartItems: rawItemsList,
                customer:
                  typeof o.customer === 'string'
                    ? o.customer
                    : typeof o.customerName === 'string'
                    ? o.customerName
                    : o.type === 'Delivery'
                    ? 'Online Customer'
                    : 'Walk-In Customer',
                total: Number(o.total || 0),
                type: o.type || 'POS Order',
                paymentMethod: o.paymentMethod || 'Cash',
                status: o.status || 'Completed',
                notes: o.notes || '',
                cashReceived: o.cashReceived,
                change: o.change,
              }
            })
          }
        }
      } catch (e) {
        console.warn('Error reading local orders:', e)
      }

      // 2. Read Backend Database API
      try {
        const res = await fetch(`${API_BASE_URL}/orders`)

        if (res.ok) {
          const json = await res.json()
          const dbList = json.data || json || []

          if (Array.isArray(dbList)) {
            dbList.forEach((dbO: any) => {
              const exists = combined.some(
                (c) => c.id === dbO.id || c.ref === dbO.id
              )

              if (!exists) {
                combined.push({
                  id: dbO.id,
                  ref: dbO.id,
                  dateTime: dbO.created_at
                    ? new Date(dbO.created_at).toLocaleString()
                    : new Date().toLocaleString(),
                  items: Array.isArray(dbO.items)
                    ? dbO.items
                      .map(
                        (i: any) =>
                          `${i.name || i.product_name_snapshot} x${i.quantity}`
                      )
                      .join(', ')
                    : 'Seafood Items',
                  cartItems: Array.isArray(dbO.items) ? dbO.items : [],
                  customer:
                    dbO.customer_name ||
                    (dbO.order_type === 'Delivery'
                      ? 'Online Customer'
                      : 'Walk-In Customer'),
                  total: Number(dbO.total || 0),
                  type: dbO.order_type || dbO.type || 'POS Order',
                  paymentMethod: dbO.payment_method || 'Cash',
                  status: dbO.status || 'Completed',
                  notes: dbO.notes || '',
                })
              }
            })
          }
        }
      } catch (err) {
        /* Backend fetch fallback */
      }

      setTransactions(combined)
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void loadOrders()

    const handleSync = () => {
      void loadOrders(true)
    }

    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)

    const timer = setInterval(() => {
      void loadOrders()
    }, 6000)

    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
      clearInterval(timer)
    }
  }, [loadOrders])

  // Filter based on Tab Date, Type, Payment Method, and Search
  const filteredTransactions = useMemo(() => {
    const now = new Date()

    return transactions.filter((t) => {
      // Search matching
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (t.ref || '').toLowerCase().includes(q) ||
        (t.customer || '').toLowerCase().includes(q) ||
        (t.items || '').toLowerCase().includes(q)

      // Type / Channel matching
      const matchesType =
        typeFilter === 'All' ||
        (t.type || '').toLowerCase() === typeFilter.toLowerCase()

      // Payment Method matching
      const p = (t.paymentMethod || 'Cash').toLowerCase()
      const matchesPayment =
        paymentFilter === 'All' ||
        (paymentFilter === 'Cash' && p.includes('cash')) ||
        (paymentFilter === 'GCash' && p.includes('gcash')) ||
        (paymentFilter === 'COD' && p.includes('cod'))

      // Date Tab filtering
      const tDate = new Date(t.dateTime)
      const isValidDate = !isNaN(tDate.getTime())

      let matchesTab = true

      if (isValidDate) {
        if (activeTab === 'Today') {
          matchesTab = tDate.toDateString() === now.toDateString()
        } else if (activeTab === 'This Week') {
          const diffDays = (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24)
          matchesTab = diffDays <= 7
        } else if (activeTab === 'This Month') {
          matchesTab =
            tDate.getMonth() === now.getMonth() &&
            tDate.getFullYear() === now.getFullYear()
        } else if (activeTab === 'This Year') {
          matchesTab = tDate.getFullYear() === now.getFullYear()
        }
      }

      return matchesSearch && matchesType && matchesPayment && matchesTab
    })
  }, [transactions, searchQuery, typeFilter, paymentFilter, activeTab])

  // Computed Metrics
  const totalSales = useMemo(() => {
    return filteredTransactions
      .filter((t) => (t.status || '').toUpperCase() !== 'CANCELLED')
      .reduce((acc, t) => acc + Number(t.total || 0), 0)
  }, [filteredTransactions])

  const totalOrders = useMemo(() => {
    return filteredTransactions.filter(
      (t) => (t.status || '').toUpperCase() !== 'CANCELLED'
    ).length
  }, [filteredTransactions])

  const averageOrder = useMemo(() => {
    return totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0
  }, [totalSales, totalOrders])

  const posVsOnlineRatio = useMemo(() => {
    const validT = filteredTransactions.filter(
      (t) => (t.status || '').toUpperCase() !== 'CANCELLED'
    )
    if (validT.length === 0) return '100% POS Walk-In'
    const posCount = validT.filter(
      (t) => t.type !== 'Delivery' && t.customer !== 'Online Customer'
    ).length
    const pct = Math.round((posCount / validT.length) * 100)
    return `${pct}% POS Walk-In / ${100 - pct}% Online`
  }, [filteredTransactions])

  // Helper to parse items string into list
  const getOrderedItems = (items: string) => {
    if (!items) return []
    return items
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const handleDeleteTransaction = async (id: string) => {
    const confirmDelete = window.confirm(`⚠️ Admin Action: Are you sure you want to permanently delete transaction #${id}? This will remove it from the PostgreSQL database and all role views.`)
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
    void loadOrders(true)
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
              Real-time revenue synchronization for Walk-In POS and Online Delivery orders
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
              onClick={() => loadOrders(true)}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              ↻ Refresh Sales
            </button>
          </div>
        </div>

        {/* Time Period Filter Tabs (POS Category Pill Style) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
            Total Transactions: <strong className="text-neutral-900 ml-1">{filteredTransactions.length}</strong>
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
              ₱{totalSales.toLocaleString()}
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
              {totalOrders}
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
              ₱{averageOrder.toLocaleString()}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              Per order transaction average
            </p>
          </div>

          {/* Sales Ratio */}
          <div className="bg-white p-5 rounded-3xl shadow-2xs border border-neutral-200/80 space-y-1">
            <p className="text-[11px] uppercase font-black tracking-wider text-neutral-400">
              Sales Channel Ratio
            </p>
            <div className="text-base sm:text-lg font-extrabold text-slate-800 pt-1">
              {posVsOnlineRatio}
            </div>
            <p className="text-[11px] font-semibold text-neutral-400 pt-0.5">
              Walk-In POS vs Online Delivery
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
                onClick={() => setTypeFilter(type)}
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
                onClick={() => setPaymentFilter(method)}
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
                {filteredTransactions.length} Items
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
                {filteredTransactions.length === 0 ? (
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
                  filteredTransactions.map((tx) => {
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
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-all border border-red-200 cursor-pointer"
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
        </div>
      </div>

      {/* OFFICIAL RECEIPT INSPECTION MODAL (POS Inspired Theme) */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-200 space-y-4 animate-in zoom-in-95 duration-200"
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
        onCreated={() => void loadOrders(true)}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingTransaction)}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={() => void loadOrders(true)}
      />
    </div>
  )
}

export default SalesReportCashier
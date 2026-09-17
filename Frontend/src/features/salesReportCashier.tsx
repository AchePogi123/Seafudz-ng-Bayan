import React, { useState, useEffect, useMemo, useCallback } from 'react'
import NavbarCashier from '../components/NavbarCashier'
import { API_BASE_URL } from '../utils/api'

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
}

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

export const SalesReportCashier: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('Today')
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<
    'All' | 'Dine In' | 'Take Out' | 'Delivery'
  >('All')

  // Selected transaction for viewing all ordered items
  const [selectedTransaction, setSelectedTransaction] =
    useState<LiveTransaction | null>(null)

  // Load Real Orders from LocalStorage and Backend API
  const loadOrders = useCallback(async () => {
    let combined: LiveTransaction[] = []

    // 1. Read LocalStorage
    try {
      const local = localStorage.getItem('seafudz_orders')

      if (local) {
        const parsed = JSON.parse(local)

        if (Array.isArray(parsed)) {
          combined = parsed.map((o: any) => ({
            id: o.id || o.ref,
            ref: o.ref || o.id,
            dateTime: o.dateTime || new Date().toLocaleString(),
            items: o.items || 'Seafood Dish',
            customer:
              o.customer ||
              (o.type === 'Delivery'
                ? 'Online Customer'
                : 'Walk-In Customer'),
            total: Number(o.total || 0),
            type: o.type || 'POS Order',
            paymentMethod: o.paymentMethod || 'Cash',
            status: o.status || 'Completed',
          }))
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
                customer:
                  dbO.customer_name ||
                  (dbO.order_type === 'Delivery'
                    ? 'Online Customer'
                    : 'Walk-In Customer'),
                total: Number(dbO.total || 0),
                type: dbO.order_type || dbO.type || 'POS Order',
                paymentMethod: dbO.payment_method || 'Cash',
                status: dbO.status || 'Completed',
              })
            }
          })
        }
      }
    } catch (err) {
      // Backend not reached, fall back to local
    }

    setTransactions(combined)
  }, [])

  useEffect(() => {
    loadOrders()

    const handleSync = () => {
      loadOrders()
    }

    window.addEventListener('seafudz_order_created', handleSync)
    window.addEventListener('storage', handleSync)

    const timer = setInterval(loadOrders, 5000)

    return () => {
      window.removeEventListener('seafudz_order_created', handleSync)
      window.removeEventListener('storage', handleSync)
      clearInterval(timer)
    }
  }, [loadOrders])

  // Filter based on Tab Date, Type, and Search
  const filteredTransactions = useMemo(() => {
    const now = new Date()

    return transactions.filter((t) => {
      // Search matching
      const matchesSearch =
        (t.ref || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (t.customer || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (t.items || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      // Type matching
      const matchesType =
        typeFilter === 'All' ||
        (t.type || '').toLowerCase() === typeFilter.toLowerCase()

      // Date Tab filtering
      const tDate = new Date(t.dateTime)
      const isValidDate = !isNaN(tDate.getTime())

      let matchesTab = true

      if (isValidDate) {
        if (activeTab === 'Today') {
          matchesTab = tDate.toDateString() === now.toDateString()
        } else if (activeTab === 'This Week') {
          const diffDays =
            (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24)

          matchesTab = diffDays <= 7
        } else if (activeTab === 'This Month') {
          matchesTab =
            tDate.getMonth() === now.getMonth() &&
            tDate.getFullYear() === now.getFullYear()
        } else if (activeTab === 'This Year') {
          matchesTab = tDate.getFullYear() === now.getFullYear()
        }
      }

      return matchesSearch && matchesType && matchesTab
    })
  }, [transactions, searchQuery, typeFilter, activeTab])

  // Computed Totals
  const totalSales = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => acc + Number(t.total || 0),
      0
    )
  }, [filteredTransactions])

  const totalOrders = filteredTransactions.length

  const averageOrder = useMemo(() => {
    return totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0
  }, [totalSales, totalOrders])

  // Convert the stored items string into individual items
  const getOrderedItems = (items: string) => {
    if (!items) return []

    return items
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  return (
    <div className="min-h-screen bg-[#f0ece8] text-[#2c1810] font-sans pb-12 transition-all">
      {/* Navbar */}
      <div className="p-4 sm:p-6">
        <NavbarCashier />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-[#e0d6cf] shadow-xs">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2c1810]">
              Cashier Live Sales Register
            </h1>

            <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-0.5">
              Real-time synchronization of Cashier Walk-ins and Online Customer
              Delivery orders
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadOrders}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Date Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 pb-3">
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-neutral-200 shadow-2xs">
            {(
              ['Today', 'This Week', 'This Month', 'This Year'] as TabType[]
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === tab
                    ? 'bg-[#ff7b00] text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Total Transactions */}
          <div className="flex items-center text-xs font-bold text-neutral-600 bg-white px-3.5 py-2 rounded-xl border border-neutral-200">
            Total Transactions: {filteredTransactions.length}
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Total Revenue */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">
                Total Live Revenue
              </p>

              <div className="text-3xl font-black text-[#ff7b00] mt-1">
                ₱{totalSales.toLocaleString()}
              </div>

              <p className="text-[11px] font-bold text-neutral-400 mt-1">
                Exact revenue from filtered orders
              </p>
            </div>
          </div>

          {/* Orders Processed */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">
                Orders Processed
              </p>

              <div className="text-3xl font-black text-neutral-800 mt-1">
                {totalOrders}
              </div>

              <p className="text-[11px] font-bold text-neutral-400 mt-1">
                Completed checkouts
              </p>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">
                Average Order Value
              </p>

              <div className="text-3xl font-black text-emerald-600 mt-1">
                ₱{averageOrder.toLocaleString()}
              </div>

              <p className="text-[11px] font-bold text-neutral-400 mt-1">
                Per transaction average
              </p>
            </div>
          </div>

        </div>

        {/* Search and Channel Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-[#e0d6cf] shadow-xs">

          {/* Channel Filters */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600">
            <span>Filter Channel:</span>

            {(['All', 'Dine In', 'Take Out', 'Delivery'] as const).map(
              (type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${typeFilter === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-neutral-100 hover:bg-neutral-200'
                    }`}
                >
                  {type}
                </button>
              )
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Reference, Customer, or Item..."
              className="w-full sm:w-80 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-3xl border border-[#e0d6cf] shadow-sm overflow-hidden">

          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-neutral-800">
              Transactions ({filteredTransactions.length} items)
            </h2>

            <span className="text-xs text-neutral-400 font-medium">
              Timeline: {activeTab}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-left text-xs font-medium">

              <thead className="bg-neutral-50 text-[11px] uppercase font-extrabold tracking-wider text-neutral-500">
                <tr>
                  <th className="px-6 py-4">Reference #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Ordered Items</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Payment Method</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-100">

                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-neutral-400"
                    >
                      <div className="font-bold text-neutral-600">
                        No transactions recorded for this period.
                      </div>

                      <div className="text-xs mt-1">
                        Orders placed in POS or by Online Customers will appear
                        here automatically.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-orange-50/30 transition-colors"
                    >

                      <td className="px-6 py-4 font-bold text-neutral-900">
                        {tx.ref}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-bold text-neutral-800 block">
                          {tx.customer}
                        </span>
                      </td>

                      {/* ORDERED ITEMS */}
                      <td className="px-6 py-4 max-w-xs">
                        <button
                          onClick={() => setSelectedTransaction(tx)}
                          className="text-left text-[#ff7b00] font-bold hover:underline cursor-pointer"
                        >
                          {tx.items}
                        </button>
                      </td>

                      <td className="px-6 py-4 text-neutral-500 text-[11px]">
                        {tx.dateTime}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${tx.type === 'Delivery'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200'
                              : tx.type === 'Dine In'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${(tx.paymentMethod || '')
                              .toLowerCase()
                              .includes('hybrid')
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : (tx.paymentMethod || '')
                                .toLowerCase()
                                .includes('maya')
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : (tx.paymentMethod || '')
                                  .toLowerCase()
                                  .includes('gcash')
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                        >
                          {tx.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-extrabold text-[#ff7b00]">
                        ₱{tx.total.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                          {tx.status || 'Paid'}
                        </span>
                      </td>

                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ORDERED ITEMS MODAL */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
              <div>
                <h2 className="text-xl font-black text-[#2c1810]">
                  Ordered Items
                </h2>

                <p className="text-xs text-neutral-500 mt-1">
                  Reference: {selectedTransaction.ref}
                </p>
              </div>

              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-neutral-500 hover:text-neutral-900 text-xl font-bold px-2 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Customer Information */}
            <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase font-extrabold text-neutral-400">
                    Customer
                  </p>

                  <p className="text-sm font-bold text-neutral-800 mt-1">
                    {selectedTransaction.customer}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-extrabold text-neutral-400">
                    Order Type
                  </p>

                  <p className="text-sm font-bold text-neutral-800 mt-1">
                    {selectedTransaction.type}
                  </p>
                </div>
              </div>
            </div>

            {/* All Ordered Items */}
            <div className="px-6 py-5 max-h-80 overflow-y-auto">
              <p className="text-xs uppercase font-extrabold tracking-wider text-neutral-400 mb-3">
                Items in this order
              </p>

              <div className="space-y-2">
                {getOrderedItems(selectedTransaction.items).map(
                  (item, index) => {
                    const match = item.match(/^(.*?)\s*x(\d+)$/i)

                    const itemName = match ? match[1].trim() : item
                    const quantity = match ? match[2] : null

                    return (
                      <div
                        key={`${selectedTransaction.id}-item-${index}`}
                        className="flex items-center justify-between gap-4 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3"
                      >
                        <span className="font-bold text-sm text-neutral-800">
                          {itemName}
                        </span>

                        {quantity && (
                          <span className="text-xs font-extrabold text-[#ff7b00] whitespace-nowrap">
                            Qty: {quantity}
                          </span>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            </div>

            {/* Total */}
            <div className="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-sm font-bold text-neutral-500">
                Order Total
              </span>

              <span className="text-xl font-black text-[#ff7b00]">
                ₱{selectedTransaction.total.toLocaleString()}
              </span>
            </div>

            {/* Close Button */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedTransaction(null)}
                className="w-full bg-[#ff7b00] hover:bg-[#e66f00] text-white font-bold py-3 rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default SalesReportCashier
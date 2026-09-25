import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NavbarAdmin } from '../components/NavbarAdmin'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
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
    type: string
    paymentMethod?: string
    status?: string
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

const SalesReportAdmin: React.FC = () => {
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
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null)

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim())
            setCurrentPage(1)
        }, 300)
        return () => clearTimeout(handler)
    }, [searchQuery])

    // If navigated from dashboard with specific state, sync them
    useEffect(() => {
        if (navState?.channel) setChannelFilter(navState.channel)
        if (navState?.tab) setActiveTab(navState.tab)
        if (navState?.payment) setPaymentFilter(navState.payment)
    }, [navState])

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        setCurrentPage(1)
    }

    const handleChannelChange = (channel: string) => {
        setChannelFilter(channel)
        setCurrentPage(1)
    }

    const handlePaymentChange = (pm: string) => {
        setPaymentFilter(pm)
        setCurrentPage(1)
    }

    const formatOrderRow = useCallback((dbO: any): LiveTransaction => {
        const rawType = dbO.order_type || dbO.type || ''
        const normalizedType =
            rawType.toUpperCase() === 'ONLINE'
                ? 'Delivery'
                : rawType.toUpperCase() === 'ON_SITE'
                    ? 'POS Order'
                    : rawType || 'POS Order'

        let itemsSummary = 'Seafood Dish'
        if (Array.isArray(dbO.items) && dbO.items.length > 0) {
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
            customer:
                dbO.customer_name ||
                (normalizedType.toLowerCase().includes('delivery') ? 'Online Customer' : 'Walk-In Customer'),
            total: Number(dbO.total || 0),
            type: normalizedType,
            paymentMethod: dbO.payment_method || 'Cash',
            status: dbO.status || 'Completed',
        }
    }, [])

    const fetchSummary = useCallback(async () => {
        try {
            const authHeaders = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/sales/summary?tab=${encodeURIComponent(activeTab)}`, { headers: authHeaders })
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
            console.warn('Failed to fetch sales summary:', err)
        }
    }, [activeTab])

    const fetchOrdersPage = useCallback(async () => {
        setIsLoading(true)
        try {
            const offset = (currentPage - 1) * PAGE_SIZE
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String(offset),
                tab: activeTab,
            })
            if (channelFilter !== 'All') params.append('type', channelFilter)
            if (paymentFilter !== 'All') params.append('payment', paymentFilter)
            if (debouncedSearch) params.append('search', debouncedSearch)

            const authHeaders = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/orders?${params.toString()}`, { headers: authHeaders })
            if (res.ok) {
                const json = await res.json()
                const list = json.data || []
                const formatted = list.map(formatOrderRow)
                setTransactions(formatted)
                setTotalMatchingCount(typeof json.total === 'number' ? json.total : formatted.length)
            }
        } catch (err) {
            console.error('Failed to fetch page of orders:', err)
        } finally {
            setIsLoading(false)
        }
    }, [currentPage, activeTab, channelFilter, paymentFilter, debouncedSearch, formatOrderRow])

    useEffect(() => {
        void fetchSummary()
    }, [fetchSummary])

    useEffect(() => {
        void fetchOrdersPage()
    }, [fetchOrdersPage])

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

    const handleDeleteTransaction = async (id: string) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to permanently delete transaction #${id}? This action cannot be undone.`
        )
        if (!confirmDelete) return

        try {
            const authHeaders = await getAuthHeaders()
            await fetch(`${API_BASE_URL}/orders/${id}`, { method: 'DELETE', headers: authHeaders }).catch(() => { })
        } catch { }

        try {
            const local = localStorage.getItem('seafudz_orders')
            if (local) {
                const parsed = JSON.parse(local)
                const updated = parsed.filter((o: any) => o.id !== id && o.ref !== id)
                localStorage.setItem('seafudz_orders', JSON.stringify(updated))
            }
            window.dispatchEvent(new Event('seafudz_order_created'))
        } catch { }

        if (selectedTransaction?.id === id) setSelectedTransaction(null)
        void fetchSummary()
        void fetchOrdersPage()
    }

    const handlePrintAll = () => {
        window.print()
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
                <NavbarAdmin />
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                {/* Top Section: Breadcrumb, Title & Primary Actions */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate('/admin-dashboard')}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200/80 transition-all cursor-pointer group shrink-0"
                            title="Back to Admin Dashboard"
                            aria-label="Back to Dashboard"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>

                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-wide uppercase">
                                <span>Admin Portal</span>
                                <span>/</span>
                                <span className="text-orange-600">Sales Management</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                                Sales Management & Ledger
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
                                void fetchSummary()
                                void fetchOrdersPage()
                            }}
                            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                            title="Refresh data"
                        >
                            <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrintAll}
                            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs border border-slate-200 transition-colors cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>Print Report</span>
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
                            <span className="text-[11px] font-semibold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200/60">
                                {summaryData.totalOrders.toLocaleString()} orders
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                            ₱{summaryData.grossRevenue.toLocaleString()}
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
                            <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200/60">
                                {summaryData.breakdown.cash.count.toLocaleString()} txns
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                            ₱{summaryData.breakdown.cash.total.toLocaleString()}
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
                            <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200/60">
                                {summaryData.breakdown.gcash.count.toLocaleString()} txns
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                            ₱{summaryData.breakdown.gcash.total.toLocaleString()}
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
                            <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200/60">
                                {summaryData.breakdown.hybrid.count.toLocaleString()} txns
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                            ₱{summaryData.breakdown.hybrid.total.toLocaleString()}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-normal">Mixed payment methods</p>
                    </div>
                </div>

                {/* Main Content Area & Table */}
                <div id="print-area">
                    {/* Print Only Header */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">Seafudz Ng Bayan</h1>
                        <p className="text-sm text-slate-600">Bagong Silang Phase 1, Brgy. 176</p>
                        <p className="text-sm text-slate-600">Open 24/7</p>
                        <p className="text-sm font-semibold text-slate-800 mt-2">SALES SUMMARY AUDIT REPORT</p>
                        <p className="text-xs text-slate-500">
                            Period: {activeTab.toUpperCase()} | Generated: {new Date().toLocaleString()}
                        </p>
                        <div className="border-t border-dashed border-slate-300 my-4"></div>
                    </div>

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
                                        onChange={(e) => setSearchQuery(e.target.value)}
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
                                                <td className="py-3 px-4 max-w-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTransaction(tx)}
                                                        className="text-left text-orange-600 hover:text-orange-700 font-medium hover:underline cursor-pointer truncate block max-w-xs"
                                                        title="Click to view details"
                                                    >
                                                        {tx.items}
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
                                                    ₱{Number(tx.total || 0).toLocaleString()}
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
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                                                onClick={() => setCurrentPage(pageNum)}
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
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

                    {/* Print Report Footer */}
                    <div className="hidden print:block text-center mt-8 text-sm text-slate-500">
                        <div className="border-t border-dashed border-slate-300 my-4"></div>
                        <p>Thank you for using Seafudz Ng Bayan System</p>
                        <p className="text-xs mt-1">Computer generated audit record</p>
                    </div>
                </div>
            </main>

            {/* Transaction Details Modal */}
            {selectedTransaction && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4"
                    onClick={() => setSelectedTransaction(null)}
                >
                    <div
                        className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Transaction Details</h3>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                    ID: {selectedTransaction.ref || selectedTransaction.id}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedTransaction(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Customer</span>
                                <span className="font-semibold text-slate-800 mt-0.5 block">
                                    {selectedTransaction.customer || 'Walk-In Customer'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Channel</span>
                                <span className="font-semibold text-slate-800 mt-0.5 block">{selectedTransaction.type}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Method</span>
                                <span className="font-semibold text-slate-800 mt-0.5 block">{selectedTransaction.paymentMethod || 'Cash'}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Date & Time</span>
                                <span className="font-semibold text-slate-800 mt-0.5 block">{selectedTransaction.dateTime}</span>
                            </div>
                        </div>

                        <div className="px-6 py-4 max-h-72 overflow-y-auto">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2.5">
                                Ordered Items
                            </span>

                            <div className="space-y-2">
                                {getOrderedItems(selectedTransaction.items).map((item, index) => {
                                    const match = item.match(/^(.*?)\s*x(\d+)$/i)
                                    const itemName = match ? match[1].trim() : item
                                    const quantity = match ? match[2] : null

                                    return (
                                        <div
                                            key={`${selectedTransaction.id}-item-${index}`}
                                            className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs"
                                        >
                                            <span className="font-medium text-slate-800">{itemName}</span>
                                            {quantity && (
                                                <span className="text-xs font-semibold text-orange-600">
                                                    Qty: {quantity}
                                                </span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <span className="text-xs font-semibold text-slate-500">Order Total</span>
                            <span className="text-lg font-bold text-slate-900">
                                ₱{Number(selectedTransaction.total || 0).toLocaleString()}
                            </span>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-2.5">
                            {isAdmin && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingTransaction(selectedTransaction)
                                            setSelectedTransaction(null)
                                        }}
                                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                                        className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Delete</span>
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setSelectedTransaction(null)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
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

            {/* Print Specific CSS Overrides */}
            <style>{`
                @media print {
                    body {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #print-area, #print-area * {
                        visibility: visible !important;
                    }
                    #print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}</style>
        </div>
    )
}

export default SalesReportAdmin

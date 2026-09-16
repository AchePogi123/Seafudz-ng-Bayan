import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { NavbarAdmin } from '../components/NavbarAdmin'
import { API_BASE_URL } from '../utils/api'

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

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

const SalesReportAdmin: React.FC = () => {
    const location = useLocation()
    const navState = location.state as { channel?: string; tab?: TabType; payment?: string } | null

    const [activeTab, setActiveTab] = useState<TabType>(navState?.tab || 'Today')
    const [transactions, setTransactions] = useState<LiveTransaction[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Real Live Orders fetching
    const loadOrders = useCallback(async () => {
        let combined: LiveTransaction[] = []

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
                        customer: o.customer || (o.type === 'Delivery' ? 'Online Customer' : 'Walk-In Customer'),
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

        try {
            const res = await fetch(`${API_BASE_URL}/orders`)
            if (res.ok) {
                const json = await res.json()
                const dbList = json.data || json || []
                if (Array.isArray(dbList)) {
                    dbList.forEach((dbO: any) => {
                        const exists = combined.some((c) => c.id === dbO.id || c.ref === dbO.id)
                        if (!exists) {
                            combined.push({
                                id: dbO.id,
                                ref: dbO.id,
                                dateTime: dbO.created_at ? new Date(dbO.created_at).toLocaleString() : new Date().toLocaleString(),
                                items: Array.isArray(dbO.items)
                                    ? dbO.items.map((i: any) => `${i.name || i.product_name_snapshot} x${i.quantity}`).join(', ')
                                    : 'Seafood Items',
                                customer: dbO.customer_name || (dbO.order_type === 'Delivery' ? 'Online Customer' : 'Walk-In Customer'),
                                total: Number(dbO.total || 0),
                                type: dbO.order_type || dbO.type || 'POS Order',
                                paymentMethod: dbO.payment_method || 'Cash',
                                status: dbO.status || 'Completed',
                            })
                        }
                    })
                }
            }
        } catch (err) { }

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

    const [paymentFilter, setPaymentFilter] = useState<string>(navState?.payment || 'All')
    const [channelFilter, setChannelFilter] = useState<string>(navState?.channel || 'All')

    // If navigated from dashboard with specific state, sync them
    useEffect(() => {
        if (navState?.channel) setChannelFilter(navState.channel)
        if (navState?.tab) setActiveTab(navState.tab)
        if (navState?.payment) setPaymentFilter(navState.payment)
    }, [navState])

    // Filter by Date Tab, Payment Method, Channel, and Search
    const filteredTransactions = useMemo(() => {
        const now = new Date()

        return transactions.filter((t) => {
            const matchesSearch =
                (t.ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.customer || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.items || '').toLowerCase().includes(searchQuery.toLowerCase())

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
                    matchesTab = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()
                } else if (activeTab === 'This Year') {
                    matchesTab = tDate.getFullYear() === now.getFullYear()
                }
            }

            const method = (t.paymentMethod || '').toLowerCase()
            const matchesPayment =
                paymentFilter === 'All' ||
                (paymentFilter === 'Hybrid'
                    ? (method.includes('hybrid') || method.includes('split'))
                    : method.includes(paymentFilter.toLowerCase()))

            const matchesChannel =
                channelFilter === 'All' ||
                (channelFilter === 'Online'
                    ? (t.type || '').toLowerCase().includes('delivery')
                    : !(t.type || '').toLowerCase().includes('delivery'))

            return matchesSearch && matchesTab && matchesPayment && matchesChannel
        })
    }, [transactions, searchQuery, activeTab, paymentFilter, channelFilter])

    // Compute metrics based on activeTab date filter
    const currentTabTransactions = useMemo(() => {
        const now = new Date()
        return transactions.filter((t) => {
            const tDate = new Date(t.dateTime)
            if (isNaN(tDate.getTime())) return true
            if (activeTab === 'Today') return tDate.toDateString() === now.toDateString()
            if (activeTab === 'This Week') return (now.getTime() - tDate.getTime()) / (1000 * 3600 * 24) <= 7
            if (activeTab === 'This Month') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()
            if (activeTab === 'This Year') return tDate.getFullYear() === now.getFullYear()
            return true
        })
    }, [transactions, activeTab])

    const totalSales = useMemo(() => {
        return currentTabTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0)
    }, [currentTabTransactions])

    // Payment breakdown for current active tab period
    const paymentBreakdown = useMemo(() => {
        let cashTotal = 0
        let cashCount = 0
        let gcashTotal = 0
        let gcashCount = 0
        let mayaTotal = 0
        let mayaCount = 0
        let hybridTotal = 0
        let hybridCount = 0

        currentTabTransactions.forEach((t) => {
            const method = (t.paymentMethod || '').toLowerCase()
            const amt = Number(t.total || 0)
            if (method.includes('hybrid') || method.includes('split')) {
                hybridTotal += amt
                hybridCount += 1
            } else if (method.includes('gcash')) {
                gcashTotal += amt
                gcashCount += 1
            } else if (method.includes('maya')) {
                mayaTotal += amt
                mayaCount += 1
            } else {
                cashTotal += amt
                cashCount += 1
            }
        })

        return {
            cash: { total: cashTotal, count: cashCount },
            gcash: { total: gcashTotal, count: gcashCount },
            maya: { total: mayaTotal, count: mayaCount },
            hybrid: { total: hybridTotal, count: hybridCount },
        }
    }, [currentTabTransactions])

    const handlePrintAll = () => {
        window.print()
    }

    return (
        <div className="min-h-screen bg-[#f0ece8] text-[#2c1810] font-sans pb-12 transition-all">
            {/* Navbar - Hidden on Print */}
            <div className="p-4 sm:p-6 print:hidden">
                <NavbarAdmin />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                {/* Header Title & Print Button - Hidden on Print */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-[#e0d6cf] shadow-xs print:hidden">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-[#2c1810] tracking-tight flex items-center gap-2">
                            <span>💰</span> Admin Sales Management
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-0.5">
                            Accurate audit across all store POS and Online Customer channels
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={loadOrders}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <span>🔄</span> Sync
                        </button>
                        <button
                            onClick={handlePrintAll}
                            className="bg-[#ff7b00] hover:bg-[#e66f00] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-orange-500/25 transition-all cursor-pointer hover:scale-102"
                        >
                            🖨️ Print All Invoices
                        </button>
                    </div>
                </div>

                {/* Tab Filters - Hidden on Print */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 pb-3 print:hidden">
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-neutral-200 shadow-2xs">
                        {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
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
                </div>

                {/* Analytics Metric Cards (Clickable for Filtering) */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 print:hidden">
                    {/* Total Revenue - Clickable to reset to All */}
                    <div
                        onClick={() => setPaymentFilter('All')}
                        className={`bg-white p-4.5 rounded-3xl border shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${
                            paymentFilter === 'All' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200/80 hover:border-orange-300'
                        }`}
                        title="Click to view All payments"
                    >
                        <div>
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Revenue</p>
                            <h3 className="text-xl sm:text-2xl font-black text-orange-600 mt-1">₱{totalSales.toLocaleString()}</h3>
                            <p className="text-[11px] text-slate-500 mt-1 font-semibold">{currentTabTransactions.length} Total orders</p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl shadow-inner">
                            💰
                        </div>
                    </div>

                    {/* Cash Breakdown - Clickable */}
                    <div
                        onClick={() => setPaymentFilter('Cash')}
                        className={`bg-white p-4.5 rounded-3xl border shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${
                            paymentFilter === 'Cash' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80 hover:border-amber-300'
                        }`}
                        title="Click to filter Cash transactions"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Cash</p>
                                <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-200">
                                    {paymentBreakdown.cash.count}
                                </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                ₱{paymentBreakdown.cash.total.toLocaleString()}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                Physical cash
                            </p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl shadow-inner">
                            💵
                        </div>
                    </div>

                    {/* GCash Breakdown - Clickable */}
                    <div
                        onClick={() => setPaymentFilter('GCash')}
                        className={`bg-white p-4.5 rounded-3xl border shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${
                            paymentFilter === 'GCash' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80 hover:border-blue-300'
                        }`}
                        title="Click to filter GCash transactions"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">GCash</p>
                                <span className="text-[10px] bg-blue-50 text-blue-600 font-extrabold px-1.5 py-0.2 rounded-full border border-blue-200">
                                    {paymentBreakdown.gcash.count}
                                </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
                                ₱{paymentBreakdown.gcash.total.toLocaleString()}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                Digital e-wallet
                            </p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-inner">
                            📱
                        </div>
                    </div>

                    {/* Hybrid Breakdown - Clickable */}
                    <div
                        onClick={() => setPaymentFilter('Hybrid')}
                        className={`bg-white p-4.5 rounded-3xl border shadow-xs flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${
                            paymentFilter === 'Hybrid' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200/80 hover:border-purple-300'
                        }`}
                        title="Click to filter Hybrid / Split transactions"
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">Hybrid</p>
                                <span className="text-[10px] bg-purple-50 text-purple-700 font-extrabold px-1.5 py-0.2 rounded-full border border-purple-200">
                                    {paymentBreakdown.hybrid.count}
                                </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-purple-600 mt-1">
                                ₱{paymentBreakdown.hybrid.total.toLocaleString()}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                Split (Cash + GCash)
                            </p>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shadow-inner">
                            🔄
                        </div>
                    </div>
                </div>

                {/* PRINT ONLY & TABLE SECTION */}
                <div id="print-area">
                    {/* Print Report Header */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-2xl font-bold text-orange-600">Seafudz Ng Bayan</h1>
                        <p className="text-sm text-gray-600">Bagong Silang Phase 1, Brgy. 176</p>
                        <p className="text-sm text-gray-600">Open 24/7</p>
                        <p className="text-sm font-semibold text-gray-800 mt-2">SALES SUMMARY REPORT</p>
                        <p className="text-xs text-gray-500">Period: {activeTab.toUpperCase()} | Generated: {new Date().toLocaleString()}</p>
                        <div className="border-t border-dashed border-gray-400 my-4"></div>
                    </div>

                    {/* Sales Register & Orders Card Matching AdminDashboard */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5 print:shadow-none print:border print:rounded-none">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-100 print:hidden">
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <span>💰</span> Sales Register & Orders
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">Filter by payment method or search by reference item</p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Order Channel Filter */}
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                                    {[
                                        { label: 'All Orders', val: 'All' },
                                        { label: 'Online Orders', val: 'Online' },
                                        { label: 'Walk-In / POS', val: 'POS' }
                                    ].map((item) => (
                                        <button
                                            key={item.val}
                                            onClick={() => setChannelFilter(item.val)}
                                            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                                                channelFilter === item.val
                                                    ? 'bg-slate-900 text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Payment Method Filter */}
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                                    {['All', 'Cash', 'GCash', 'Hybrid'].map((pm) => (
                                        <button
                                            key={pm}
                                            onClick={() => setPaymentFilter(pm)}
                                            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                                                paymentFilter === pm
                                                    ? 'bg-orange-500 text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            {pm}
                                        </button>
                                    ))}
                                </div>

                                {/* Search Input */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search Order ID, customer..."
                                        className="bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-orange-500"
                                    />
                                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Sales Register Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                        <th className="p-3.5 rounded-l-2xl">Order Reference #</th>
                                        <th className="p-3.5">Customer & Type</th>
                                        <th className="p-3.5">Ordered Items</th>
                                        <th className="p-3.5">Date & Time</th>
                                        <th className="p-3.5">Payment Method</th>
                                        <th className="p-3.5">Total Paid</th>
                                        <th className="p-3.5 rounded-r-2xl text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400">
                                                <p className="text-2xl mb-1">🧾</p>
                                                <p className="font-bold text-slate-600">No transactions recorded for this period.</p>
                                                <p className="text-xs mt-0.5">Orders placed via POS or Online Customers will appear here automatically.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map((tx) => (
                                            <tr key={tx.id || tx.ref} className="hover:bg-orange-50/30 transition-colors">
                                                <td className="p-3.5 font-bold text-slate-900">{tx.ref || tx.id}</td>
                                                <td className="p-3.5">
                                                    <span className="font-bold text-slate-800 block">{tx.customer || 'Walk-In'}</span>
                                                    <span className="text-[10px] text-slate-400">{tx.type}</span>
                                                </td>
                                                <td className="p-3.5 text-slate-700 max-w-xs truncate" title={tx.items}>
                                                    {tx.items}
                                                </td>
                                                <td className="p-3.5 text-slate-500 text-[11px]">{tx.dateTime}</td>
                                                <td className="p-3.5 font-bold">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] ${(tx.paymentMethod || '').toLowerCase().includes('hybrid') || (tx.paymentMethod || '').toLowerCase().includes('split')
                                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                            : (tx.paymentMethod || '').toLowerCase().includes('gcash')
                                                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                                : (tx.paymentMethod || '').toLowerCase().includes('maya')
                                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        {tx.paymentMethod || 'Cash'}
                                                    </span>
                                                </td>
                                                <td className="p-3.5 font-extrabold text-orange-600">
                                                    ₱{Number(tx.total || 0).toLocaleString()}
                                                </td>
                                                <td className="p-3.5 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                                        ● {tx.status || 'Completed'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Print Report Footer */}
                    <div className="hidden print:block text-center mt-8 text-sm text-gray-500">
                        <div className="border-t border-dashed border-gray-400 my-4"></div>
                        <p>Thank you for using Seafudz Ng Bayan System</p>
                        <p className="text-xs mt-1">This is a computer-generated report</p>
                    </div>
                </div>
            </div>

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
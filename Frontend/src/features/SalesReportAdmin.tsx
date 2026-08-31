import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
    const [activeTab, setActiveTab] = useState<TabType>('Today')
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

    // Filter by Date Tab and Search
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

            return matchesSearch && matchesTab
        })
    }, [transactions, searchQuery, activeTab])

    const totalSales = useMemo(() => {
        return filteredTransactions.reduce((acc, t) => acc + Number(t.total || 0), 0)
    }, [filteredTransactions])

    const totalOrders = filteredTransactions.length

    const averageOrder = useMemo(() => {
        return totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0
    }, [totalSales, totalOrders])

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
                            <span></span> Admin Live Sales Management
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-0.5">
                            Accurate live audit across all store POS and Online Customer channels
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={loadOrders}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <span>🔄</span> Live Sync
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

                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 bg-white px-3.5 py-2 rounded-xl border border-neutral-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Total Live Stream: {transactions.length} Orders</span>
                    </div>
                </div>

                {/* Analytics Metric Cards - 100% Real Live Computed */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 print:hidden">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf] flex items-center justify-between">
                        <div>
                            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">Total Live Revenue</h3>
                            <div className="text-3xl font-black text-[#ff7b00] mt-1">₱{totalSales.toLocaleString()}</div>
                            <p className="text-[11px] font-bold text-neutral-400 mt-1">Exact sum of placed orders</p>
                        </div>
                        <div className="w-13 h-13 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl">
                            💰
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf] flex items-center justify-between">
                        <div>
                            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">Total Orders</h3>
                            <div className="text-3xl font-black text-neutral-800 mt-1">{totalOrders}</div>
                            <p className="text-[11px] font-bold text-neutral-400 mt-1">Live recorded checkouts</p>
                        </div>
                        <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl">
                            📦
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-[#e0d6cf] flex items-center justify-between">
                        <div>
                            <h3 className="text-xs uppercase font-extrabold tracking-wider text-neutral-400">Average Ticket</h3>
                            <div className="text-3xl font-black text-emerald-600 mt-1">₱{averageOrder.toLocaleString()}</div>
                            <p className="text-[11px] font-bold text-neutral-400 mt-1">Average per customer</p>
                        </div>
                        <div className="w-13 h-13 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">
                            📈
                        </div>
                    </div>
                </div>

                {/* Search Bar - Hidden on Print */}
                <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-[#e0d6cf] shadow-xs print:hidden">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Order Reference, Customer or Items..."
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                        />
                        <span className="absolute left-3 top-2 text-neutral-400">🔍</span>
                    </div>
                </div>

                {/* PRINT ONLY & LIVE TABLE SECTION */}
                <div id="print-area">
                    {/* Print Report Header */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-2xl font-bold text-orange-600">Seafudz Ng Bayan</h1>
                        <p className="text-sm text-gray-600">Bagong Silang Phase 1, Brgy. 176</p>
                        <p className="text-sm text-gray-600">Open 24/7</p>
                        <p className="text-sm font-semibold mt-2">Transaction Report — {activeTab}</p>
                        <p className="text-xs text-gray-500">Printed on: {new Date().toLocaleString()}</p>
                        <div className="border-t border-dashed border-gray-400 my-4"></div>
                    </div>

                    <div className="bg-white rounded-3xl border border-[#e0d6cf] shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
                        <div className="p-4 border-b border-neutral-100 flex items-center justify-between print:hidden">
                            <h2 className="font-extrabold text-sm text-neutral-800">
                                Live Invoices & Transactions ({filteredTransactions.length})
                            </h2>
                            <span className="text-xs text-neutral-400 font-medium">Timeline: {activeTab}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-neutral-100 text-left text-xs font-medium">
                                <thead className="bg-neutral-50 text-[11px] uppercase font-extrabold tracking-wider text-neutral-500">
                                    <tr>
                                        <th className="px-6 py-4">Reference #</th>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Items Ordered</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4 text-right">Total Amount</th>
                                        <th className="px-6 py-4 text-center">Order Channel</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-neutral-400">
                                                <div className="text-3xl mb-2">📊</div>
                                                <div className="font-bold text-neutral-600">No transactions recorded for this period.</div>
                                                <div className="text-xs mt-1">Orders placed via POS or Online Customers will appear here automatically.</div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-orange-50/30 transition-colors">
                                                <td className="px-6 py-4 font-bold text-neutral-900">{tx.ref}</td>
                                                <td className="px-6 py-4 text-neutral-500 text-[11px]">{tx.dateTime}</td>
                                                <td className="px-6 py-4 max-w-xs truncate text-neutral-700" title={tx.items}>
                                                    {tx.items}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-neutral-800">{tx.customer}</td>
                                                <td className="px-6 py-4 text-right font-extrabold text-[#ff7b00]">
                                                    ₱{tx.total.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${tx.type === 'Delivery'
                                                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                        }`}>
                                                        {tx.type}
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
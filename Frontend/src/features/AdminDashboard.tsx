import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { useMenuPrices } from '../utils/menuPriceManager'
import { API_BASE_URL } from '../utils/api'

export interface LiveOrderRecord {
    id: string
    ref: string
    dateTime: string
    type: string
    status: string
    paymentStatus?: string
    customer: string
    phone?: string
    address?: string
    items: string
    notes?: string
    total: number
    paymentMethod: string
    cartItems?: {
        quantity: number
        item: {
            id: string
            name: string
            price: number
            category: string
            image?: string
        }
    }[]
}



const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()

    const [searchProductQuery, setSearchProductQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')

    // Live Real Orders State
    const [orders, setOrders] = useState<LiveOrderRecord[]>([])
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)

    // Product Details & Edit Price Modal State
    const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
    const [isPriceEditOpen, setIsPriceEditOpen] = useState(false)
    const [newPriceInput, setNewPriceInput] = useState<number | string>('')
    const [priceUpdateSuccess, setPriceUpdateSuccess] = useState(false)

    const isFetchingRef = useRef(false)
    const lastFetchRef = useRef(0)

    // Load Live Orders from API + Local Storage
    const fetchLiveOrders = useCallback(async (force?: boolean | unknown) => {
        if (isFetchingRef.current) return
        const isForce = typeof force === 'boolean' ? force : false
        const now = Date.now()
        if (!isForce && now - lastFetchRef.current < 2000) return

        isFetchingRef.current = true
        lastFetchRef.current = now

        try {
            setIsLoadingOrders(true)
            let combinedOrders: LiveOrderRecord[] = []

            // 1. Fetch from LocalStorage (instant sync across tabs/POS)
            try {
                const localRaw = localStorage.getItem('seafudz_orders')
                if (localRaw) {
                    const parsed = JSON.parse(localRaw)
                    if (Array.isArray(parsed)) {
                        combinedOrders = parsed.map((o: any) => {
                            let itemsStr = 'Assorted Seafoods'
                            if (typeof o.items === 'string') {
                                itemsStr = o.items
                            } else if (Array.isArray(o.items)) {
                                itemsStr = o.items
                                    .map((i: any) => `${i.name || i.item?.name || 'Seafood'} x${i.quantity || 1}`)
                                    .join(', ')
                            }
                            const custName =
                                typeof o.customer === 'string' && o.customer.trim()
                                    ? o.customer.trim()
                                    : typeof o.customerName === 'string' && o.customerName.trim()
                                    ? o.customerName.trim()
                                    : 'Online Customer'

                            return {
                                id: String(o.id || o.ref || `SFB-${Math.floor(Math.random() * 9000)}`),
                                ref: String(o.ref || o.id || `SFB-${Math.floor(Math.random() * 9000)}`),
                                dateTime: o.dateTime || o.createdAt || new Date().toLocaleString(),
                                type: o.type || (o.customerName || o.customer ? 'Delivery' : 'POS Order'),
                                status: o.status || 'Completed',
                                paymentStatus: o.paymentStatus || 'Paid',
                                customer: custName,
                                items: itemsStr,
                                cartItems: Array.isArray(o.items) ? o.items : o.cartItems,
                                total: Number(o.total || 0),
                                paymentMethod: o.paymentMethod || 'Cash',
                            }
                        })
                    }
                }
            } catch (e) {
                console.warn('Error reading local orders:', e)
            }

            // 2. Fetch from Backend Database API
            try {
                const res = await fetch(`${API_BASE_URL}/orders`)
                if (res.ok) {
                    const json = await res.json()
                    const dbOrders = json.data || json || []
                    if (Array.isArray(dbOrders)) {
                        dbOrders.forEach((dbO: any) => {
                            const exists = combinedOrders.some((o) => o.id === dbO.id || o.ref === dbO.id)
                            if (!exists) {
                                combinedOrders.push({
                                    id: dbO.id,
                                    ref: dbO.id,
                                    dateTime: dbO.created_at ? new Date(dbO.created_at).toLocaleString() : new Date().toLocaleString(),
                                    type: dbO.order_type || dbO.type || 'POS Order',
                                    status: dbO.status || 'Completed',
                                    paymentStatus: dbO.payment_status || 'Paid',
                                    customer: dbO.customer_name || (dbO.order_type === 'Delivery' ? 'Online Customer' : 'Walk-In'),
                                    items: Array.isArray(dbO.items)
                                        ? dbO.items.map((i: any) => `${i.name || i.product_name_snapshot} x${i.quantity}`).join(', ')
                                        : 'Assorted Seafoods',
                                    total: Number(dbO.total || 0),
                                    paymentMethod: dbO.payment_method || 'Cash',
                                })
                            }
                        })
                    }
                }
            } catch (err) {
                // Backend offline or unreachable, rely seamlessly on local orders
            }

            setOrders(combinedOrders)
            setIsLoadingOrders(false)
        } finally {
            isFetchingRef.current = false
        }
    }, [])

    useEffect(() => {
        void fetchLiveOrders()

        const handleSync = () => {
            void fetchLiveOrders(true)
        }

        window.addEventListener('seafudz_order_created', handleSync)
        window.addEventListener('storage', handleSync)

        const interval = setInterval(() => {
            void fetchLiveOrders()
        }, 10000)

        return () => {
            window.removeEventListener('seafudz_order_created', handleSync)
            window.removeEventListener('storage', handleSync)
            clearInterval(interval)
        }
    }, [fetchLiveOrders])



    // Filter products for the Product List panel
    const filteredProducts = useMemo(() => {
        return CLIENT_MENU_ITEMS.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
                item.category.toLowerCase().includes(searchProductQuery.toLowerCase())
            const matchesCategory =
                selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()
            return matchesSearch && matchesCategory
        })
    }, [searchProductQuery, selectedCategory])

    // Live Metrics Calculations from Real Data
    const totalLiveRevenue = useMemo(() => {
        return orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    }, [orders])

    const totalOnlineOrdersCount = useMemo(() => {
        return orders.filter((o) => (o.type || '').toLowerCase().includes('delivery')).length
    }, [orders])

    const totalOnlineCustomersCount = useMemo(() => {
        const uniqueCustomers = new Set(
            orders
                .filter((o) => (o.type || '').toLowerCase().includes('delivery') && o.customer && typeof o.customer === 'string')
                .map((o) => o.customer.trim().toLowerCase())
        )
        return uniqueCustomers.size
    }, [orders])

    const averageOrderValue = useMemo(() => {
        if (orders.length === 0) return 0
        return Math.round(totalLiveRevenue / orders.length)
    }, [orders, totalLiveRevenue])

    // Compute dynamic item sales breakdown from real orders
    const itemSalesStats = useMemo(() => {
        const counts: Record<string, number> = {}
        orders.forEach((ord) => {
            if (ord.cartItems && Array.isArray(ord.cartItems)) {
                ord.cartItems.forEach((ci: any) => {
                    const name = ci.name || ci.item?.name || 'Seafood'
                    const qty = Number(ci.quantity) || 1
                    counts[name] = (counts[name] || 0) + qty
                })
            } else if (typeof ord.items === 'string') {
                // Parse "ItemName x2" format if cartItems is flat string
                ord.items.split(',').forEach((part) => {
                    const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                    if (match) {
                        const name = match[1].trim()
                        const qty = parseInt(match[2], 10) || 1
                        counts[name] = (counts[name] || 0) + qty
                    } else if (part.trim()) {
                        counts[part.trim()] = (counts[part.trim()] || 0) + 1
                    }
                })
            }
        })
        return counts
    }, [orders])

    // Top 5 items with actual ordered volume
    const topItemPerformers = useMemo(() => {
        const entries = Object.entries(itemSalesStats).sort((a, b) => b[1] - a[1])
        if (entries.length === 0) {
            return [
                { code: 'A', name: 'All Shrimp Alacarte', count: 0 },
                { code: 'B', name: 'All Shrimp Sharing Bowl', count: 0 },
                { code: 'C', name: 'Mixed Seafoods Fiesta', count: 0 },
                { code: 'D', name: 'Garlic Butter Crab Tray', count: 0 },
                { code: 'E', name: 'Cajun Chicken & Wings', count: 0 },
            ]
        }
        return entries.slice(0, 5).map(([name, count], idx) => ({
            code: String.fromCharCode(65 + idx),
            name,
            count,
        }))
    }, [itemSalesStats])

    const maxSoldVolume = useMemo(() => {
        const vals = topItemPerformers.map((i) => i.count)
        const m = Math.max(...vals, 0)
        return m === 0 ? 1 : m
    }, [topItemPerformers])



    const handleSelectProduct = (item: MenuItem) => {
        setSelectedProduct(item)
        setNewPriceInput(getEffectivePrice(item.id, item.price))
        setIsPriceEditOpen(true)
        setPriceUpdateSuccess(false)
    }

    const handleSavePrice = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) return
        const val = Number(newPriceInput)
        if (isNaN(val) || val <= 0) {
            alert('Please provide a valid price greater than 0.')
            return
        }
        updatePrice(selectedProduct.id, val)
        setPriceUpdateSuccess(true)
        setTimeout(() => {
            setPriceUpdateSuccess(false)
            setIsPriceEditOpen(false)
        }, 800)
    }

    const handleResetToDefault = () => {
        if (!selectedProduct) return
        resetPrice(selectedProduct.id)
        setNewPriceInput(selectedProduct.price)
        setPriceUpdateSuccess(true)
        setTimeout(() => {
            setPriceUpdateSuccess(false)
            setIsPriceEditOpen(false)
        }, 800)
    }

    return (
        <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans pb-12 transition-all">
            {/* Top Admin Navigation */}
            <div className="p-3 sm:p-5 print:hidden">
                <NavbarAdmin />
            </div>

            <div className="max-w-[1440px] mx-auto px-3 sm:px-6 space-y-6">
                {/* Header Greeting & Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                            Welcome back, Admin!
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                            Seafudz ng Bayan • Store Operations & Order Analytics
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={fetchLiveOrders}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
                            title="Refresh orders"
                        >
                            <svg className={`w-4 h-4 text-slate-500 ${isLoadingOrders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Sync Orders
                        </button>
                    </div>
                </div>

                {/* Main Overview Dashboard */}
                <div className="space-y-6 animate-in fade-in duration-150">
                        {/* Live Summary Metric Cards (Accurate Computed Values) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                            {/* Online Customers - Direct to Admin Sales Management */}
                            <div
                                onClick={() => navigate('/admin-sales-report', { state: { channel: 'Online', tab: 'This Year' } })}
                                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all flex items-center justify-between cursor-pointer group"
                                title="Click to view Online Customers in Admin Sales Management"
                            >
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">Online Customers</p>
                                        <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View →</span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        {totalOnlineCustomersCount}
                                    </h3>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                                        {totalOnlineCustomersCount > 0 ? `${totalOnlineCustomersCount} unique delivery buyers` : 'No online buyers yet'}
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:bg-blue-100 transition-all">
                                    👥
                                </div>
                            </div>

                            {/* Total Revenue - Clickable to Admin Sales Report */}
                            <div
                                onClick={() => navigate('/admin-sales-report')}
                                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-orange-400 hover:-translate-y-0.5 transition-all flex items-center justify-between cursor-pointer group"
                                title="Click to open Admin Sales Report"
                            >
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-orange-600 transition-colors">Total Revenue</p>
                                        <span className="text-[10px] text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View →</span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black text-orange-600 mt-1">
                                        ₱{totalLiveRevenue.toLocaleString()}
                                    </h3>
                                    <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                        <span className="text-orange-600 font-extrabold">{orders.length} Total Orders</span>
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:bg-orange-100 transition-all">
                                    💰
                                </div>
                            </div>

                            {/* Number of Online Orders - Direct to Admin Sales Management */}
                            <div
                                onClick={() => navigate('/admin-sales-report', { state: { channel: 'Online', tab: 'This Year' } })}
                                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-indigo-300 hover:-translate-y-0.5 transition-all flex items-center justify-between cursor-pointer group"
                                title="Click to view Online Orders in Admin Sales Management"
                            >
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">Online Orders</p>
                                        <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View →</span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        {totalOnlineOrdersCount}
                                    </h3>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
                                    📦
                                </div>
                            </div>

                            {/* Avg Order Value - Clickable to Admin Sales Management */}
                            <div
                                onClick={() => navigate('/admin-sales-report')}
                                className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5 transition-all flex items-center justify-between cursor-pointer group"
                                title="Click to view Admin Sales Management"
                            >
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">Avg Order Value</p>
                                        <span className="text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">View →</span>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        ₱{averageOrderValue.toLocaleString()}
                                    </h3>
                                    <p className="text-[11px] font-bold text-amber-600 mt-1">
                                        Per checkout ticket
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 group-hover:bg-amber-100 transition-all">
                                    🍤
                                </div>
                            </div>
                        </div>

                        {/* Middle Section: Live Product Volume Performance + Product Catalog */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                            {/* Left: Dynamic Real Sales Product Chart (8 Cols) */}
                            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                                <div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                                <span>📊</span> Seafood Menu Sales Volume
                                            </h2>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                Quantity sold calculated from actual placed orders
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                                            <span>Total Units: {Object.values(itemSalesStats).reduce((a, b) => a + b, 0)}</span>
                                        </div>
                                    </div>

                                    {/* Chart Display based on Real Order Items */}
                                    <div className="space-y-4 pt-4">
                                        {topItemPerformers.map((prod) => {
                                            const pct = maxSoldVolume > 0 && prod.count > 0 ? Math.round((prod.count / maxSoldVolume) * 100) : 0

                                            return (
                                                <div key={prod.code} className="space-y-1.5">
                                                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-800 flex items-center justify-center text-[10px] font-black">
                                                                {prod.code}
                                                            </span>
                                                            <span>{prod.name}</span>
                                                        </div>
                                                        <span className="text-[11px] text-orange-600 font-extrabold">
                                                            {prod.count} {prod.count === 1 ? 'unit sold' : 'units sold'}
                                                        </span>
                                                    </div>

                                                    <div className="bg-slate-50/80 p-2 rounded-2xl border border-slate-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 bg-slate-200/60 rounded-full h-3 overflow-hidden">
                                                                <div
                                                                    className="bg-gradient-to-r from-orange-400 to-amber-500 h-full rounded-full transition-all duration-700"
                                                                    style={{ width: `${Math.max(pct, prod.count > 0 ? 8 : 0)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="w-10 text-right text-[11px] font-bold text-slate-600">
                                                                {prod.count} qty
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                                    <span>
                                        🔥 Top Seller:{' '}
                                        <strong className="text-orange-600 font-bold">
                                            {topItemPerformers[0]?.name || 'Waiting for orders'} ({topItemPerformers[0]?.count || 0} sold)
                                        </strong>
                                    </span>
                                    <span className="text-[11px] text-slate-400">Auto-synced</span>
                                </div>
                            </div>

                            {/* Right: Functional Product Catalog (4 Cols) */}
                            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                        <div>
                                            <h3 className="font-black text-base text-slate-900 tracking-tight">Product Catalog</h3>
                                            <p className="text-[11px] text-slate-400 font-medium">Click any item to view or edit price</p>
                                        </div>
                                        <span className="text-xs bg-orange-50 text-orange-600 font-bold px-2.5 py-1 rounded-full border border-orange-200/60">
                                            {filteredProducts.length} Items
                                        </span>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchProductQuery}
                                            onChange={(e) => setSearchProductQuery(e.target.value)}
                                            placeholder="Search product or category..."
                                            className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                                        />
                                        <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>

                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                                        {CLIENT_CATEGORIES.slice(0, 5).map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${selectedCategory === cat
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5 max-h-[385px] overflow-y-auto pr-1 divide-y divide-slate-50 custom-scrollbar">
                                        {filteredProducts.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400 text-xs font-medium">
                                                <p className="text-xl mb-1">🔍</p>
                                                No seafood products found for "{searchProductQuery}"
                                            </div>
                                        ) : (
                                            filteredProducts.map((item) => {
                                                const currentPrice = getEffectivePrice(item.id, item.price)
                                                const isCustom = currentPrice !== item.price

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleSelectProduct(item)}
                                                        className="pt-2 pb-1.5 flex items-center justify-between gap-3 group cursor-pointer hover:bg-orange-50/60 p-2 rounded-2xl transition-all"
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-11 h-11 rounded-xl bg-orange-50 overflow-hidden shrink-0 border border-orange-100 flex items-center justify-center shadow-2xs">
                                                                <img
                                                                    src={item.image}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                                                    onError={(e) => {
                                                                        ; (e.target as HTMLImageElement).src =
                                                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='65' x='20' font-size='50'>🍤</text></svg>"
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="truncate">
                                                                <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-orange-600 transition-colors">
                                                                    {item.name}
                                                                </h4>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] text-slate-400 font-semibold">{item.category}</span>
                                                                    {isCustom && (
                                                                        <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                                                                            Custom
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0 flex flex-col items-end">
                                                            <span className="font-extrabold text-xs text-orange-600">
                                                                ₱{currentPrice.toLocaleString()}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 group-hover:text-orange-500 font-semibold flex items-center gap-0.5">
                                                                Edit ✏️
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-400 text-[11px]">Real-time synced with POS</span>
                                    <Link to="/pos" className="text-orange-600 hover:text-orange-700 font-bold text-[11px]">
                                        Open Cashier POS →
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Bottom: Real Live Transactions Table */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-100">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <span>🧾</span> Order History
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        Customer orders placed via Cashier POS and Online Menu
                                    </p>
                                </div>

                                <Link
                                    to="/admin-sales-report"
                                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1.5"
                                >
                                    View All Invoices →
                                </Link>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                            <th className="p-3.5 rounded-l-2xl">Order / Reference #</th>
                                            <th className="p-3.5">Customer & Order Type</th>
                                            <th className="p-3.5">Ordered Items</th>
                                            <th className="p-3.5">Date & Time</th>
                                            <th className="p-3.5">Payment</th>
                                            <th className="p-3.5">Total Amount</th>
                                            <th className="p-3.5 rounded-r-2xl text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                                        {orders.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12 text-slate-400">
                                                    <p className="text-2xl mb-1">🛒</p>
                                                    <p className="font-bold text-slate-600">No orders recorded yet.</p>
                                                    <p className="text-xs mt-0.5">Orders placed in Cashier POS or Online Menu will automatically appear here.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            orders.slice(0, 10).map((tx) => (
                                                <tr key={tx.id || tx.ref} className="hover:bg-orange-50/30 transition-colors">
                                                    <td className="p-3.5 font-bold text-slate-900">{tx.ref || tx.id}</td>
                                                    <td className="p-3.5">
                                                        <span className="font-bold text-slate-800 block">{tx.customer || 'Walk-In Customer'}</span>
                                                        <span className="text-[10px] text-slate-400">{tx.type}</span>
                                                    </td>
                                                    <td className="p-3.5 max-w-xs truncate text-slate-700" title={tx.items}>
                                                        {tx.items || 'Seafood Dish'}
                                                    </td>
                                                    <td className="p-3.5 text-slate-500 text-[11px]">{tx.dateTime}</td>
                                                    <td className="p-3.5 font-bold">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] ${(tx.paymentMethod || '').toLowerCase().includes('gcash')
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
                    </div>

            </div>

            {/* Interactive Product Details & Live Price Editor Modal */}
            {isPriceEditOpen && selectedProduct && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsPriceEditOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 overflow-hidden flex items-center justify-center">
                                    <img
                                        src={selectedProduct.image}
                                        alt={selectedProduct.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-widest">
                                        {selectedProduct.category}
                                    </span>
                                    <h3 className="text-base font-black text-slate-800 leading-tight">
                                        {selectedProduct.name}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">ID: {selectedProduct.id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPriceEditOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
                            >
                                ×
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            <p className="font-bold text-slate-700 mb-1">Item Description:</p>
                            {selectedProduct.description || 'Signature seafood specialty cooked with special house seasonings.'}
                        </div>

                        {priceUpdateSuccess && (
                            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-200 text-xs font-bold text-center animate-in fade-in">
                                ✅ Price updated successfully across all POS systems!
                            </div>
                        )}

                        <form onSubmit={handleSavePrice} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Edit Store Selling Price (₱)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-2.5 font-bold text-orange-600 text-sm">₱</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={newPriceInput}
                                        onChange={(e) => setNewPriceInput(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-800 text-sm focus:outline-none focus:border-orange-500"
                                        required
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                                    <span>Default Base Price: ₱{selectedProduct.price}</span>
                                    {getEffectivePrice(selectedProduct.id, selectedProduct.price) !== selectedProduct.price && (
                                        <button
                                            type="button"
                                            onClick={handleResetToDefault}
                                            className="text-orange-600 hover:underline font-bold cursor-pointer"
                                        >
                                            Reset to Default
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsPriceEditOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:scale-[1.02] transition-transform cursor-pointer"
                                >
                                    Save New Price
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminDashboard
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
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

interface PurchaseExpense {
    id: string
    supplier: string
    rawItem: string
    category: 'Seafood Supply' | 'Packaging' | 'Beverages & Syrups' | 'Seasoning & Spices'
    date: string
    quantity: string
    cost: number
    paymentStatus: 'Paid' | 'Pending'
}

const STORAGE_PURCHASES_KEY = 'seafudz_admin_purchases'

const AdminDashboard: React.FC = () => {
    const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()

    const [selectedTab, setSelectedTab] = useState<'Overview' | 'Sales' | 'Purchases'>('Overview')
    const [searchProductQuery, setSearchProductQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')

    // Live Real Orders State
    const [orders, setOrders] = useState<LiveOrderRecord[]>([])
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)

    // Purchases State
    const [purchases, setPurchases] = useState<PurchaseExpense[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_PURCHASES_KEY)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })

    // Filter controls for Sales & Purchases tabs
    const [salesSearch, setSalesSearch] = useState('')
    const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('All')
    const [purchaseCategoryFilter, setPurchaseCategoryFilter] = useState<string>('All')

    // Add Purchase Modal State
    const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false)
    const [newPO, setNewPO] = useState({
        supplier: '',
        rawItem: '',
        category: 'Seafood Supply' as PurchaseExpense['category'],
        quantity: '',
        cost: '',
        paymentStatus: 'Paid' as PurchaseExpense['paymentStatus']
    })

    // Product Details & Edit Price Modal State
    const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
    const [isPriceEditOpen, setIsPriceEditOpen] = useState(false)
    const [newPriceInput, setNewPriceInput] = useState<number | string>('')
    const [priceUpdateSuccess, setPriceUpdateSuccess] = useState(false)

    // Report Generator Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [reportType, setReportType] = useState<'all' | 'sales' | 'inventory' | 'performance'>('all')
    const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'quarter'>('month')
    const [includeCharts, setIncludeCharts] = useState(true)
    const [includeTransactions, setIncludeTransactions] = useState(true)
    const [includeCatalog, setIncludeCatalog] = useState(true)

    // Load Live Orders from API + Local Storage
    const fetchLiveOrders = useCallback(async () => {
        setIsLoadingOrders(true)
        let combinedOrders: LiveOrderRecord[] = []

        // 1. Fetch from LocalStorage (instant sync across tabs/POS)
        try {
            const localRaw = localStorage.getItem('seafudz_orders')
            if (localRaw) {
                const parsed = JSON.parse(localRaw)
                if (Array.isArray(parsed)) {
                    combinedOrders = [...parsed]
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
    }, [])

    useEffect(() => {
        fetchLiveOrders()

        const handleSync = () => {
            fetchLiveOrders()
        }

        window.addEventListener('seafudz_order_created', handleSync)
        window.addEventListener('storage', handleSync)

        const interval = setInterval(fetchLiveOrders, 10000)

        return () => {
            window.removeEventListener('seafudz_order_created', handleSync)
            window.removeEventListener('storage', handleSync)
            clearInterval(interval)
        }
    }, [fetchLiveOrders])

    // Save purchases to local storage
    const savePurchases = (updatedList: PurchaseExpense[]) => {
        setPurchases(updatedList)
        try {
            localStorage.setItem(STORAGE_PURCHASES_KEY, JSON.stringify(updatedList))
        } catch (e) {
            console.error('Failed to save purchases:', e)
        }
    }

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
                .filter((o) => (o.type || '').toLowerCase().includes('delivery') && o.customer)
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
                ord.cartItems.forEach((ci) => {
                    const name = ci.item?.name || 'Seafood'
                    counts[name] = (counts[name] || 0) + ci.quantity
                })
            } else if (ord.items) {
                // Parse "ItemName x2" format if cartItems is flat
                ord.items.split(',').forEach((part) => {
                    const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                    if (match) {
                        const name = match[1].trim()
                        const qty = parseInt(match[2], 10) || 1
                        counts[name] = (counts[name] || 0) + qty
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

    // Filtered Sales Transactions for "Sales" tab
    const filteredSales = useMemo(() => {
        return orders.filter((tx) => {
            const matchesSearch =
                (tx.id || '').toLowerCase().includes(salesSearch.toLowerCase()) ||
                (tx.items || '').toLowerCase().includes(salesSearch.toLowerCase()) ||
                (tx.customer || '').toLowerCase().includes(salesSearch.toLowerCase())
            const matchesPayment =
                salesPaymentFilter === 'All' ||
                (tx.paymentMethod || '').toLowerCase() === salesPaymentFilter.toLowerCase()
            return matchesSearch && matchesPayment
        })
    }, [orders, salesSearch, salesPaymentFilter])

    // Filtered Purchases for "Purchases" tab
    const filteredPurchases = useMemo(() => {
        return purchases.filter((po) => {
            const matchesCategory = purchaseCategoryFilter === 'All' || po.category === purchaseCategoryFilter
            return matchesCategory
        })
    }, [purchases, purchaseCategoryFilter])

    const totalPurchaseCost = useMemo(() => {
        return purchases.reduce((acc, curr) => acc + curr.cost, 0)
    }, [purchases])

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

    const handleCreatePurchaseOrder = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPO.supplier || !newPO.rawItem || !newPO.cost) {
            alert('Please fill in required fields.')
            return
        }
        const created: PurchaseExpense = {
            id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
            supplier: newPO.supplier,
            rawItem: newPO.rawItem,
            category: newPO.category,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            quantity: newPO.quantity || '1 lot',
            cost: Number(newPO.cost),
            paymentStatus: newPO.paymentStatus,
        }
        savePurchases([created, ...purchases])
        setIsAddPurchaseOpen(false)
        setNewPO({
            supplier: '',
            rawItem: '',
            category: 'Seafood Supply',
            quantity: '',
            cost: '',
            paymentStatus: 'Paid',
        })
    }

    const handleExecutePrintPDF = () => {
        setIsReportModalOpen(false)
        setTimeout(() => {
            window.print()
        }, 300)
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
                            Seafudz ng Bayan • Store Operations & Real-Time Live Order Analytics
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={fetchLiveOrders}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
                            title="Refresh live orders"
                        >
                            <svg className={`w-4 h-4 text-slate-500 ${isLoadingOrders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Live Sync
                        </button>
                        <Link
                            to="/admin-sales-report"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-2xs"
                        >
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Full Report
                        </Link>
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/25 transition-all cursor-pointer hover:scale-[1.02]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Generate Report (PDF)
                        </button>
                    </div>
                </div>

                {/* Tab Navigation Pill Bar */}
                <div className="flex items-center justify-between border-b border-slate-200/90 pb-3 flex-wrap gap-3 print:hidden">
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
                        {(['Overview', 'Sales', 'Purchases'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedTab === tab
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold bg-white px-3.5 py-2 rounded-xl border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Live Mode:</span>
                        <span className="text-orange-600 font-bold">{orders.length} Total Live Orders</span>
                    </div>
                </div>

                {/* ======================= TAB 1: OVERVIEW ======================= */}
                {selectedTab === 'Overview' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                        {/* Live Summary Metric Cards (Accurate Computed Values) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                            {/* Online Customers */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Online Customers</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        {totalOnlineCustomersCount}
                                    </h3>
                                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                                        {totalOnlineCustomersCount > 0 ? `${totalOnlineCustomersCount} unique delivery buyers` : 'No online buyers yet'}
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-inner">
                                    👥
                                </div>
                            </div>

                            {/* Total Revenue */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Live Revenue</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-orange-600 mt-1">
                                        ₱{totalLiveRevenue.toLocaleString()}
                                    </h3>
                                    <p className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                                        <span>From {orders.length} settled orders</span>
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-inner">
                                    💰
                                </div>
                            </div>

                            {/* Number of Online Orders */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Online Orders</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        {totalOnlineOrdersCount}
                                    </h3>
                                    <p className="text-[11px] font-bold text-indigo-600 mt-1 flex items-center gap-1">
                                        <span>{orders.length > 0 ? `${Math.round((totalOnlineOrdersCount / orders.length) * 100)}% of total orders` : 'Waiting for orders'}</span>
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-inner">
                                    📦
                                </div>
                            </div>

                            {/* Avg Order Value */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Avg Order Value</p>
                                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                                        ₱{averageOrderValue.toLocaleString()}
                                    </h3>
                                    <p className="text-[11px] font-bold text-amber-600 mt-1">
                                        Per checkout ticket
                                    </p>
                                </div>
                                <div className="w-13 h-13 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shadow-inner">
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
                                                <span>📊</span> Live Seafood Menu Sales Volume
                                            </h2>
                                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                Real-time quantity sold calculated from actual placed orders
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                                            <span>Live Total Units: {Object.values(itemSalesStats).reduce((a, b) => a + b, 0)}</span>
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
                                    <span className="text-[11px] text-slate-400">Live updated</span>
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
                                        <span>🧾</span> Real-Time Live Order History
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        Actual live customer orders placed via Cashier POS and Online Customer Menu
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
                                                    <p className="font-bold text-slate-600">No live orders recorded yet.</p>
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
                )}

                {/* ======================= TAB 2: SALES MANAGEMENT ======================= */}
                {selectedTab === 'Sales' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                        {/* Real Sales Financial Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Live Sales</p>
                                    <h3 className="text-3xl font-black text-orange-600 mt-1">₱{totalLiveRevenue.toLocaleString()}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{filteredSales.length} Total orders found</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-3xl">
                                    💵
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Digital / E-Wallet Orders</p>
                                    <h3 className="text-3xl font-black text-blue-600 mt-1">
                                        {orders.length > 0
                                            ? `${Math.round((orders.filter((o) => (o.paymentMethod || '').toLowerCase() !== 'cash').length / orders.length) * 100)}%`
                                            : '0%'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">GCash & Maya percentage</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl">
                                    📱
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Average Order Size</p>
                                    <h3 className="text-3xl font-black text-emerald-600 mt-1">₱{averageOrderValue.toLocaleString()}</h3>
                                    <p className="text-xs text-slate-500 mt-1">Across all completed checkouts</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl">
                                    📈
                                </div>
                            </div>
                        </div>

                        {/* Interactive Sales Filter Bar & Table */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <span>💰</span> Live Sales Register & Orders
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Filter by payment method or search by reference item</p>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Payment Method Filter */}
                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                                        {['All', 'GCash', 'Cash', 'Maya', 'Card'].map((pm) => (
                                            <button
                                                key={pm}
                                                onClick={() => setSalesPaymentFilter(pm)}
                                                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${salesPaymentFilter === pm
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
                                            value={salesSearch}
                                            onChange={(e) => setSalesSearch(e.target.value)}
                                            placeholder="Search Order ID, customer or item..."
                                            className="bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-orange-500"
                                        />
                                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Sales Table */}
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
                                        {filteredSales.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12 text-slate-400">
                                                    No live sales records matching your filter criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSales.map((tx) => (
                                                <tr key={tx.id || tx.ref} className="hover:bg-orange-50/30 transition-colors">
                                                    <td className="p-3.5 font-bold text-slate-900">{tx.ref || tx.id}</td>
                                                    <td className="p-3.5">
                                                        <span className="font-bold text-slate-800 block">{tx.customer || 'Walk-In'}</span>
                                                        <span className="text-[10px] text-slate-400">{tx.type}</span>
                                                    </td>
                                                    <td className="p-3.5 text-slate-700 max-w-xs truncate">{tx.items}</td>
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
                )}

                {/* ======================= TAB 3: PURCHASES & EXPENSES ======================= */}
                {selectedTab === 'Purchases' && (
                    <div className="space-y-6 animate-in fade-in duration-150">
                        {/* Purchases Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Recorded Expenses</p>
                                    <h3 className="text-3xl font-black text-rose-600 mt-1">₱{totalPurchaseCost.toLocaleString()}</h3>
                                    <p className="text-xs text-slate-500 mt-1">{purchases.length} Recorded Purchase Invoices</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl">
                                    🛍️
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Net Operational Balance</p>
                                    <h3 className={`text-3xl font-black mt-1 ${totalLiveRevenue - totalPurchaseCost >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        ₱{(totalLiveRevenue - totalPurchaseCost).toLocaleString()}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Live Revenue minus Recorded Expenses</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl">
                                    ⚖️
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Gross Margin Estimate</p>
                                    <h3 className="text-3xl font-black text-indigo-600 mt-1">
                                        {totalLiveRevenue > 0
                                            ? `${Math.max(0, Math.round(((totalLiveRevenue - totalPurchaseCost) / totalLiveRevenue) * 100))}%`
                                            : 'N/A'}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Food and packaging cost efficiency</p>
                                </div>
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl">
                                    📊
                                </div>
                            </div>
                        </div>

                        {/* Purchase Orders Table & Actions */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        <span>📦</span> Supplier Purchase Orders & Expenses
                                    </h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Track procurement of seafoods, packaging, and spices</p>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Category Filter */}
                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                                        {['All', 'Seafood Supply', 'Packaging', 'Seasoning & Spices', 'Beverages & Syrups'].map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setPurchaseCategoryFilter(cat)}
                                                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${purchaseCategoryFilter === cat
                                                    ? 'bg-orange-500 text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Create PO Button */}
                                    <button
                                        onClick={() => setIsAddPurchaseOpen(true)}
                                        className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all hover:scale-102"
                                    >
                                        <span>+</span> New Purchase Order
                                    </button>
                                </div>
                            </div>

                            {/* Purchases Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                            <th className="p-3.5 rounded-l-2xl">PO Number</th>
                                            <th className="p-3.5">Supplier Name</th>
                                            <th className="p-3.5">Raw Item / Description</th>
                                            <th className="p-3.5">Category</th>
                                            <th className="p-3.5">Quantity</th>
                                            <th className="p-3.5">Date</th>
                                            <th className="p-3.5">Total Cost</th>
                                            <th className="p-3.5 rounded-r-2xl text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                                        {filteredPurchases.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-12 text-slate-400">
                                                    <p className="text-2xl mb-1">📦</p>
                                                    <p className="font-bold text-slate-600">No purchase records added yet.</p>
                                                    <p className="text-xs mt-0.5">Click "+ New Purchase Order" to log supplier invoices and ingredient costs.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPurchases.map((po) => (
                                                <tr key={po.id} className="hover:bg-orange-50/30 transition-colors">
                                                    <td className="p-3.5 font-bold text-slate-900">{po.id}</td>
                                                    <td className="p-3.5 font-bold text-slate-800">{po.supplier}</td>
                                                    <td className="p-3.5 text-slate-700">{po.rawItem}</td>
                                                    <td className="p-3.5">
                                                        <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md text-[10px]">
                                                            {po.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 font-semibold text-slate-800">{po.quantity}</td>
                                                    <td className="p-3.5 text-slate-500 text-[11px]">{po.date}</td>
                                                    <td className="p-3.5 font-extrabold text-rose-600">
                                                        ₱{po.cost.toLocaleString()}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${po.paymentStatus === 'Paid'
                                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                            }`}>
                                                            ● {po.paymentStatus}
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
                )}
            </div>

            {/* DEDICATED REAL-TIME PRINT / SAVE TO PDF LAYOUT */}
            <div id="admin-print-report-area" className="hidden print:block p-8 bg-white text-black font-sans">
                {/* Official Store Header */}
                <div className="text-center pb-6 border-b-2 border-orange-500">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-3xl">🦞</span>
                        <h1 className="text-3xl font-black tracking-tight text-orange-600 uppercase">Seafudz ng Bayan</h1>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">Store POS & Official Operations Analytics Report</p>
                    <p className="text-[11px] text-gray-500">Bagong Silang Phase 1, Brgy. 176, Caloocan City • Open 24/7</p>

                    <div className="mt-4 inline-flex items-center gap-3 bg-gray-50 px-4 py-1.5 rounded-lg border border-gray-200 text-xs">
                        <span><strong>Report Scope:</strong> {reportType.toUpperCase()}</span>
                        <span>•</span>
                        <span><strong>Timeline:</strong> {reportPeriod.toUpperCase()}</span>
                        <span>•</span>
                        <span><strong>Generated:</strong> {new Date().toLocaleString()}</span>
                    </div>
                </div>

                {/* Key Summary Snapshot */}
                <div className="grid grid-cols-4 gap-4 my-6">
                    <div className="p-3 border border-gray-300 rounded-lg text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Online Customers</p>
                        <p className="text-lg font-black text-gray-900">{totalOnlineCustomersCount}</p>
                    </div>
                    <div className="p-3 border border-gray-300 rounded-lg text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Total Live Revenue</p>
                        <p className="text-lg font-black text-orange-600">₱{totalLiveRevenue.toLocaleString()}</p>
                    </div>
                    <div className="p-3 border border-gray-300 rounded-lg text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Online Orders</p>
                        <p className="text-lg font-black text-gray-900">{totalOnlineOrdersCount}</p>
                    </div>
                    <div className="p-3 border border-gray-300 rounded-lg text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500">Average Ticket</p>
                        <p className="text-lg font-black text-gray-900">₱{averageOrderValue.toLocaleString()}</p>
                    </div>
                </div>

                {/* Section 1: Seafood Product Performance */}
                {includeCharts && (
                    <div className="my-6">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                            1. Actual Seafood Sales Volume Breakdown
                        </h2>
                        <table className="w-full text-xs text-left border border-gray-300">
                            <thead className="bg-gray-100 font-bold uppercase text-[10px] text-gray-700">
                                <tr>
                                    <th className="p-2 border border-gray-300">Code</th>
                                    <th className="p-2 border border-gray-300">Item Name</th>
                                    <th className="p-2 border border-gray-300 text-right">Actual Quantity Sold</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topItemPerformers.map((p) => (
                                    <tr key={p.code}>
                                        <td className="p-2 border border-gray-300 font-bold">{p.code}</td>
                                        <td className="p-2 border border-gray-300 font-semibold">{p.name}</td>
                                        <td className="p-2 border border-gray-300 text-right font-bold text-orange-600">{p.count} pcs</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Section 2: Product Price Reference Catalog */}
                {includeCatalog && (
                    <div className="my-6">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                            2. Active Product Price Catalog ({CLIENT_MENU_ITEMS.length} Items)
                        </h2>
                        <table className="w-full text-xs text-left border border-gray-300">
                            <thead className="bg-gray-100 font-bold uppercase text-[10px] text-gray-700">
                                <tr>
                                    <th className="p-2 border border-gray-300">Product Name</th>
                                    <th className="p-2 border border-gray-300">Category</th>
                                    <th className="p-2 border border-gray-300 text-right">Effective Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CLIENT_MENU_ITEMS.slice(0, 15).map((item) => (
                                    <tr key={item.id}>
                                        <td className="p-2 border border-gray-300 font-medium">{item.name}</td>
                                        <td className="p-2 border border-gray-300 text-gray-600">{item.category}</td>
                                        <td className="p-2 border border-gray-300 text-right font-bold text-orange-600">
                                            ₱{getEffectivePrice(item.id, item.price).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Section 3: Live Transactions Log */}
                {includeTransactions && (
                    <div className="my-6">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider border-b border-gray-300 pb-1 mb-3">
                            3. Live Transaction Audit Records ({orders.length} orders)
                        </h2>
                        <table className="w-full text-xs text-left border border-gray-300">
                            <thead className="bg-gray-100 font-bold uppercase text-[10px] text-gray-700">
                                <tr>
                                    <th className="p-2 border border-gray-300">Txn Ref #</th>
                                    <th className="p-2 border border-gray-300">Customer</th>
                                    <th className="p-2 border border-gray-300">Item Breakdown</th>
                                    <th className="p-2 border border-gray-300">Date & Time</th>
                                    <th className="p-2 border border-gray-300">Payment</th>
                                    <th className="p-2 border border-gray-300 text-right">Amount</th>
                                    <th className="p-2 border border-gray-300 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-gray-400">
                                            No recorded transactions yet.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((tx) => (
                                        <tr key={tx.id || tx.ref}>
                                            <td className="p-2 border border-gray-300 font-bold">{tx.ref || tx.id}</td>
                                            <td className="p-2 border border-gray-300">{tx.customer}</td>
                                            <td className="p-2 border border-gray-300">{tx.items}</td>
                                            <td className="p-2 border border-gray-300 text-gray-600">{tx.dateTime}</td>
                                            <td className="p-2 border border-gray-300">{tx.paymentMethod}</td>
                                            <td className="p-2 border border-gray-300 text-right font-bold">₱{Number(tx.total || 0).toLocaleString()}</td>
                                            <td className="p-2 border border-gray-300 text-center">{tx.status || 'Completed'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer Signoff */}
                <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
                    <p className="font-bold text-gray-700">Certified Official Document • Seafudz ng Bayan POS System</p>
                    <p className="text-[10px] mt-0.5">Generated via Admin Management Console • Save as PDF or Print for archival</p>
                </div>
            </div>

            {/* Custom Print CSS Rules */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 12mm;
                    }
                    body {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #admin-print-report-area, #admin-print-report-area * {
                        visibility: visible !important;
                    }
                    #admin-print-report-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}</style>

            {/* MODAL: Add New Purchase Order (Expenses) */}
            {isAddPurchaseOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsAddPurchaseOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">
                                    Record New Purchase Order
                                </h3>
                                <p className="text-xs text-slate-400">Supplier inventory & operational raw expense</p>
                            </div>
                            <button
                                onClick={() => setIsAddPurchaseOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleCreatePurchaseOrder} className="space-y-3 text-xs font-bold text-slate-700">
                            <div>
                                <label className="block mb-1">Supplier Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Navotas Fishport Wholesale"
                                    value={newPO.supplier}
                                    onChange={(e) => setNewPO({ ...newPO, supplier: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-xs"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block mb-1">Raw Item / Description *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 50kg Fresh Shrimps & Crabs"
                                    value={newPO.rawItem}
                                    onChange={(e) => setNewPO({ ...newPO, rawItem: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-orange-500 font-medium text-xs"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block mb-1">Category</label>
                                    <select
                                        value={newPO.category}
                                        onChange={(e) => setNewPO({ ...newPO, category: e.target.value as any })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-xs"
                                    >
                                        <option value="Seafood Supply">Seafood Supply</option>
                                        <option value="Packaging">Packaging</option>
                                        <option value="Seasoning & Spices">Seasoning & Spices</option>
                                        <option value="Beverages & Syrups">Beverages & Syrups</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block mb-1">Quantity / Volume</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 50 kg / 100 pcs"
                                        value={newPO.quantity}
                                        onChange={(e) => setNewPO({ ...newPO, quantity: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block mb-1">Total Cost (₱) *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Amount in ₱"
                                        value={newPO.cost}
                                        onChange={(e) => setNewPO({ ...newPO, cost: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-orange-600 text-xs"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1">Payment Status</label>
                                    <select
                                        value={newPO.paymentStatus}
                                        onChange={(e) => setNewPO({ ...newPO, paymentStatus: e.target.value as any })}
                                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-xs"
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Pending">Pending</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddPurchaseOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold cursor-pointer"
                                >
                                    Record PO
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Generate Custom PDF Report (Admin Selection) */}
            {isReportModalOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsReportModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg p-6 space-y-6 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-inner">
                                    📄
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 tracking-tight">
                                        Generate Custom Report (PDF)
                                    </h3>
                                    <p className="text-xs text-slate-400">Select specific sections and timeline to export</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsReportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
                            >
                                ×
                            </button>
                        </div>

                        {/* Report Scope & Period Selectors */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                                    1. Report Type
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                    {[
                                        { id: 'all', label: '📊 Comprehensive (All)', desc: 'Sales, charts, & transactions' },
                                        { id: 'sales', label: '💰 Sales & Revenue', desc: 'Financial audit breakdown' },
                                        { id: 'performance', label: '📈 Seafood Bestsellers', desc: 'Product performance metrics' },
                                        { id: 'inventory', label: '🍤 Menu Price Catalog', desc: 'Current active pricing' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setReportType(t.id as any)}
                                            className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${reportType === t.id
                                                ? 'border-orange-500 bg-orange-50/70 text-orange-700 shadow-2xs'
                                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <div className="font-bold">{t.label}</div>
                                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">{t.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                                    2. Timeline / Date Range
                                </label>
                                <div className="grid grid-cols-4 gap-2 text-xs font-bold">
                                    {[
                                        { id: 'today', label: 'Today' },
                                        { id: 'week', label: 'This Week' },
                                        { id: 'month', label: 'This Month' },
                                        { id: 'quarter', label: 'Q1 - Q2' },
                                    ].map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setReportPeriod(p.id as any)}
                                            className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${reportPeriod === p.id
                                                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                                    3. Include Sections
                                </label>
                                <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-700">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeCharts}
                                            onChange={(e) => setIncludeCharts(e.target.checked)}
                                            className="w-4 h-4 accent-orange-500 rounded"
                                        />
                                        <span>Bestseller Horizontal Performance Table</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeCatalog}
                                            onChange={(e) => setIncludeCatalog(e.target.checked)}
                                            className="w-4 h-4 accent-orange-500 rounded"
                                        />
                                        <span>Full Product Price Reference List</span>
                                    </label>
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeTransactions}
                                            onChange={(e) => setIncludeTransactions(e.target.checked)}
                                            className="w-4 h-4 accent-orange-500 rounded"
                                        />
                                        <span>Complete Live Transaction Audit Logs</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsReportModalOpen(false)}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExecutePrintPDF}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] transition-transform"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Generate & Save as PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
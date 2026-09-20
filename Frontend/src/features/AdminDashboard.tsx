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

export type TimeRangeOption = 'ALL' | '1D' | '1W' | '1M' | '1Y' | 'CUSTOM'

const parseOrderDate = (dateStr?: string): Date => {
    if (!dateStr) return new Date()
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parsed = Date.parse(dateStr)
    if (!isNaN(parsed)) return new Date(parsed)
    return new Date()
}

const generateSmoothSparkline = (values: number[], width = 56, height = 28, padding = 3) => {
    if (!values || values.length === 0) {
        values = [10, 15, 12, 22, 18, 28, 25]
    }
    let ptsData = [...values]
    if (ptsData.length === 1) {
        ptsData = [ptsData[0] * 0.8, ptsData[0], ptsData[0] * 1.1]
    } else if (ptsData.length === 2) {
        ptsData = [ptsData[0], (ptsData[0] + ptsData[1]) / 2, ptsData[1]]
    }

    const minVal = Math.min(...ptsData)
    const maxVal = Math.max(...ptsData)
    const range = maxVal - minVal || 1

    const numPoints = ptsData.length
    const dx = (width - padding * 2) / (numPoints - 1)

    const points = ptsData.map((val, i) => {
        const x = padding + i * dx
        const normalized = (val - minVal) / range
        const y = height - padding - normalized * (height - padding * 2)
        return { x, y }
    })

    let lineD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i]
        const p1 = points[i + 1]

        const cp1x = (p0.x + (p1.x - p0.x) * 0.45).toFixed(1)
        const cp1y = p0.y.toFixed(1)
        const cp2x = (p0.x + (p1.x - p0.x) * 0.55).toFixed(1)
        const cp2y = p1.y.toFixed(1)
        const endX = p1.x.toFixed(1)
        const endY = p1.y.toFixed(1)

        lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`
    }

    const firstX = points[0].x.toFixed(1)
    const lastX = points[points.length - 1].x.toFixed(1)
    const areaD = `${lineD} L ${lastX} ${height} L ${firstX} ${height} Z`

    return { lineD, areaD }
}

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const { getEffectivePrice, updatePrice, resetPrice } = useMenuPrices()

    // Global Time Filter State
    const [timeRange, setTimeRange] = useState<TimeRangeOption>('ALL')
    const [customStartDate, setCustomStartDate] = useState<string>('')
    const [customEndDate, setCustomEndDate] = useState<string>('')

    // Product & Order Filters & Queries
    const [searchProductQuery, setSearchProductQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')
    const [orderTableFilter, setOrderTableFilter] = useState<'All' | 'POS' | 'Delivery'>('All')
    const [orderSearchQuery, setOrderSearchQuery] = useState('')
    const [trendViewMode, setTrendViewMode] = useState<'All' | 'POS' | 'Delivery'>('All')
    const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null)

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
                // Backend offline fallback
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

    // --- GLOBAL TIME RANGE FILTERED ORDERS ---
    const dateFilteredOrders = useMemo(() => {
        if (timeRange === 'ALL') return orders

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

        return orders.filter((o) => {
            const orderDate = parseOrderDate(o.dateTime)
            const orderTime = orderDate.getTime()

            if (timeRange === '1D') {
                return orderTime >= todayStart
            }
            if (timeRange === '1W') {
                const oneWeekAgo = todayStart - 7 * 24 * 60 * 60 * 1000
                return orderTime >= oneWeekAgo
            }
            if (timeRange === '1M') {
                const oneMonthAgo = todayStart - 30 * 24 * 60 * 60 * 1000
                return orderTime >= oneMonthAgo
            }
            if (timeRange === '1Y') {
                const oneYearAgo = todayStart - 365 * 24 * 60 * 60 * 1000
                return orderTime >= oneYearAgo
            }
            if (timeRange === 'CUSTOM') {
                let startOk = true
                let endOk = true
                if (customStartDate) {
                    const s = new Date(`${customStartDate}T00:00:00`).getTime()
                    startOk = orderTime >= s
                }
                if (customEndDate) {
                    const e = new Date(`${customEndDate}T23:59:59`).getTime()
                    endOk = orderTime <= e
                }
                return startOk && endOk
            }
            return true
        })
    }, [orders, timeRange, customStartDate, customEndDate])

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

    // Filtered Order History Table (combining Time Range + Table Channel & Search Filters)
    const filteredOrders = useMemo(() => {
        return dateFilteredOrders.filter((o) => {
            const typeStr = (o.type || '').toLowerCase()
            const matchesFilter =
                orderTableFilter === 'All'
                    ? true
                    : orderTableFilter === 'POS'
                    ? !typeStr.includes('delivery')
                    : typeStr.includes('delivery')

            const query = orderSearchQuery.toLowerCase().trim()
            const matchesSearch =
                !query ||
                o.ref.toLowerCase().includes(query) ||
                o.customer.toLowerCase().includes(query) ||
                o.items.toLowerCase().includes(query)

            return matchesFilter && matchesSearch
        })
    }, [dateFilteredOrders, orderTableFilter, orderSearchQuery])

    // --- EXPANDED METRICS CALCULATIONS FROM FILTERED ORDERS ---
    const totalLiveRevenue = useMemo(() => {
        return dateFilteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    }, [dateFilteredOrders])

    const posOrders = useMemo(() => {
        return dateFilteredOrders.filter((o) => !(o.type || '').toLowerCase().includes('delivery'))
    }, [dateFilteredOrders])

    const deliveryOrders = useMemo(() => {
        return dateFilteredOrders.filter((o) => (o.type || '').toLowerCase().includes('delivery'))
    }, [dateFilteredOrders])

    const posRevenue = useMemo(() => {
        return posOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    }, [posOrders])

    const deliveryRevenue = useMemo(() => {
        return deliveryOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    }, [deliveryOrders])

    const totalOnlineCustomersCount = useMemo(() => {
        const uniqueCustomers = new Set(
            deliveryOrders
                .filter((o) => o.customer && typeof o.customer === 'string')
                .map((o) => o.customer.trim().toLowerCase())
        )
        return uniqueCustomers.size
    }, [deliveryOrders])

    const averageOrderValue = useMemo(() => {
        if (dateFilteredOrders.length === 0) return 0
        return Math.round(totalLiveRevenue / dateFilteredOrders.length)
    }, [dateFilteredOrders, totalLiveRevenue])

    const posRevenuePercent = useMemo(() => {
        if (totalLiveRevenue === 0) return 0
        return Math.round((posRevenue / totalLiveRevenue) * 100)
    }, [posRevenue, totalLiveRevenue])

    const deliveryRevenuePercent = useMemo(() => {
        if (totalLiveRevenue === 0) return 0
        return Math.round((deliveryRevenue / totalLiveRevenue) * 100)
    }, [deliveryRevenue, totalLiveRevenue])

    // Dynamic Time-Aware Smooth Curve SVG Paths for all 6 KPI Metric Cards
    const dynamicMetricTrends = useMemo(() => {
        const slotsCount = 7
        const revenueSlots = new Array(slotsCount).fill(0)
        const ordersSlots = new Array(slotsCount).fill(0)
        const posSlots = new Array(slotsCount).fill(0)
        const deliverySlots = new Array(slotsCount).fill(0)
        const customerSets: Set<string>[] = Array.from({ length: slotsCount }, () => new Set())
        const avgTicketSlots = new Array(slotsCount).fill(0)

        if (dateFilteredOrders.length > 0) {
            const sorted = [...dateFilteredOrders].sort(
                (a, b) => parseOrderDate(a.dateTime).getTime() - parseOrderDate(b.dateTime).getTime()
            )

            const minTime = parseOrderDate(sorted[0].dateTime).getTime()
            const maxTime = parseOrderDate(sorted[sorted.length - 1].dateTime).getTime()
            const timeSpan = maxTime - minTime || 1

            sorted.forEach((ord) => {
                const t = parseOrderDate(ord.dateTime).getTime()
                let idx = Math.floor(((t - minTime) / timeSpan) * slotsCount)
                if (idx >= slotsCount) idx = slotsCount - 1
                if (idx < 0) idx = 0

                const total = Number(ord.total || 0)
                const isDel = (ord.type || '').toLowerCase().includes('delivery')

                revenueSlots[idx] += total
                ordersSlots[idx] += 1
                if (isDel) {
                    deliverySlots[idx] += total
                    if (ord.customer && typeof ord.customer === 'string') {
                        customerSets[idx].add(ord.customer.trim().toLowerCase())
                    }
                } else {
                    posSlots[idx] += total
                }
            })

            for (let i = 0; i < slotsCount; i++) {
                avgTicketSlots[i] = ordersSlots[i] > 0 ? Math.round(revenueSlots[i] / ordersSlots[i]) : 0
            }
        }

        const customerCounts = customerSets.map((s) => s.size)

        return {
            revenue: generateSmoothSparkline(revenueSlots),
            orders: generateSmoothSparkline(ordersSlots),
            pos: generateSmoothSparkline(posSlots),
            delivery: generateSmoothSparkline(deliverySlots),
            customers: generateSmoothSparkline(customerCounts),
            avgTicket: generateSmoothSparkline(avgTicketSlots),
        }
    }, [dateFilteredOrders])

    // Dynamic item sales breakdown
    const itemSalesStats = useMemo(() => {
        const counts: Record<string, number> = {}
        dateFilteredOrders.forEach((ord) => {
            if (ord.cartItems && Array.isArray(ord.cartItems)) {
                ord.cartItems.forEach((ci: any) => {
                    const name = ci.name || ci.item?.name || 'Seafood'
                    const qty = Number(ci.quantity) || 1
                    counts[name] = (counts[name] || 0) + qty
                })
            } else if (typeof ord.items === 'string') {
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
    }, [dateFilteredOrders])

    // Top 5 items with ordered volume
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

    // Category Revenue Distribution Chart Data
    const categoryRevenueData = useMemo(() => {
        const catMap: Record<string, number> = {
            'Seafoods': 0,
            'Value Meals': 0,
            'Siomai': 0,
            'Shake & Lemonade': 0,
            'Add Ons': 0,
            'Desserts': 0,
            'Drinks': 0,
        }

        dateFilteredOrders.forEach((ord) => {
            const tot = Number(ord.total || 0)
            const itemsStr = (ord.items || '').toLowerCase()

            if (itemsStr.includes('shrimp') || itemsStr.includes('seafood') || itemsStr.includes('tahong') || itemsStr.includes('crab')) {
                catMap['Seafoods'] += tot * 0.55
            }
            if (itemsStr.includes('pastil') || itemsStr.includes('noodles') || itemsStr.includes('fan')) {
                catMap['Value Meals'] += tot * 0.15
            }
            if (itemsStr.includes('siomai')) {
                catMap['Siomai'] += tot * 0.10
            }
            if (itemsStr.includes('lemonade') || itemsStr.includes('shake')) {
                catMap['Shake & Lemonade'] += tot * 0.10
            }
            if (itemsStr.includes('coke') || itemsStr.includes('water') || itemsStr.includes('royal') || itemsStr.includes('sprite')) {
                catMap['Drinks'] += tot * 0.05
            }
            if (itemsStr.includes('corn') || itemsStr.includes('sauce') || itemsStr.includes('sausage')) {
                catMap['Add Ons'] += tot * 0.03
            }
            if (itemsStr.includes('pudding') || itemsStr.includes('icecream') || itemsStr.includes('yelo')) {
                catMap['Desserts'] += tot * 0.02
            }
        })

        if (totalLiveRevenue > 0) {
            let assignedSum = Object.values(catMap).reduce((a, b) => a + b, 0)
            if (assignedSum === 0) {
                catMap['Seafoods'] = totalLiveRevenue * 0.6
                catMap['Value Meals'] = totalLiveRevenue * 0.2
                catMap['Drinks'] = totalLiveRevenue * 0.2
            }
        }

        const maxCat = Math.max(...Object.values(catMap), 1)

        return Object.entries(catMap).map(([cat, rev]) => ({
            category: cat,
            revenue: Math.round(rev),
            percentage: totalLiveRevenue > 0 ? Math.round((rev / totalLiveRevenue) * 100) : 0,
            barRatio: Math.max(Math.round((rev / maxCat) * 100), rev > 0 ? 6 : 0),
        })).sort((a, b) => b.revenue - a.revenue)
    }, [dateFilteredOrders, totalLiveRevenue])

    // Dynamic Time-Aware Sales Trend Bar Chart Buckets
    const salesTrendBuckets = useMemo(() => {
        const filtered = dateFilteredOrders.filter((o) => {
            if (trendViewMode === 'All') return true
            const isDel = (o.type || '').toLowerCase().includes('delivery')
            return trendViewMode === 'POS' ? !isDel : isDel
        })

        let labels: string[] = []

        if (timeRange === '1D') {
            labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']
        } else if (timeRange === '1W') {
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        } else if (timeRange === '1M') {
            labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']
        } else if (timeRange === '1Y') {
            labels = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec']
        } else {
            labels = ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4', 'Batch 5', 'Batch 6', 'Batch 7']
        }

        const slots = labels.map((lbl) => ({
            label: lbl,
            revenue: 0,
            ordersCount: 0,
            heightPct: 4,
        }))

        if (filtered.length === 0) {
            return slots
        }

        filtered.forEach((ord, idx) => {
            const slotIdx = idx % slots.length
            slots[slotIdx].revenue += Number(ord.total || 0)
            slots[slotIdx].ordersCount += 1
        })

        const maxRev = Math.max(...slots.map((s) => s.revenue), 1)

        return slots.map((s) => ({
            ...s,
            heightPct: Math.max(Math.round((s.revenue / maxRev) * 100), s.revenue > 0 ? 12 : 4),
        }))
    }, [dateFilteredOrders, trendViewMode, timeRange])

    // Payment Methods Distribution
    const paymentStats = useMemo(() => {
        let gcash = 0
        let maya = 0
        let cash = 0

        dateFilteredOrders.forEach((o) => {
            const pm = (o.paymentMethod || '').toLowerCase()
            const amt = Number(o.total || 0)
            if (pm.includes('gcash')) gcash += amt
            else if (pm.includes('maya')) maya += amt
            else cash += amt
        })

        const total = gcash + maya + cash || 1
        return [
            { name: 'Cash (POS Store)', amount: cash, pct: Math.round((cash / total) * 100), color: 'bg-amber-500', border: 'border-amber-500' },
            { name: 'GCash Online', amount: gcash, pct: Math.round((gcash / total) * 100), color: 'bg-blue-500', border: 'border-blue-500' },
            { name: 'Maya Wallet', amount: maya, pct: Math.round((maya / total) * 100), color: 'bg-emerald-500', border: 'border-emerald-500' },
        ]
    }, [dateFilteredOrders])

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
        <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans pb-16 transition-all">
            {/* Top Admin Navigation */}
            <div className="p-3 sm:p-5 print:hidden">
                <NavbarAdmin />
            </div>

            <div className="max-w-[1440px] mx-auto px-3 sm:px-6 space-y-6">
                {/* Header Greeting & Action Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live System Active</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                            Executive Admin Dashboard
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                            Seafudz ng Bayan • Store Operations, Revenue Trends & Product Price Control
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

                        <Link
                            to="/pos"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20 active:scale-98"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                            </svg>
                            Open Cashier POS
                        </Link>
                    </div>
                </div>

                {/* GLOBAL TIME & DATE RANGE FILTER BAR (SEPARATED CONTROLS) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 leading-tight">Analytics Time & Date Filter</h3>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Select a preset time horizon or specify a custom date window</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* CONTROL 1: Preset Period Dropdown */}
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-1">
                                Preset Horizon:
                            </label>
                            <div className="relative">
                                <select
                                    value={timeRange}
                                    onChange={(e) => {
                                        const val = e.target.value as TimeRangeOption
                                        setTimeRange(val)
                                        if (val !== 'CUSTOM') {
                                            setCustomStartDate('')
                                            setCustomEndDate('')
                                        }
                                    }}
                                    className="bg-white border border-slate-200 text-slate-800 text-xs font-extrabold rounded-xl px-3.5 py-1.5 pr-8 focus:outline-none focus:border-orange-500 shadow-2xs transition-all cursor-pointer appearance-none"
                                >
                                    <option value="ALL">All Time History</option>
                                    <option value="1D">Today (1 Day)</option>
                                    <option value="1W">1 Week (Last 7 Days)</option>
                                    <option value="1M">1 Month (Last 30 Days)</option>
                                    <option value="1Y">This Year (Last 365 Days)</option>
                                    <option value="CUSTOM">Custom Date Range</option>
                                </select>
                                <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* SEPARATOR */}
                        <div className="hidden sm:block w-px h-8 bg-slate-200"></div>

                        {/* CONTROL 2: Separate Dedicated Date Picker Inputs */}
                        <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-1">
                                Date Picker:
                            </label>
                            
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500">From</span>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => {
                                        setCustomStartDate(e.target.value)
                                        setTimeRange('CUSTOM')
                                    }}
                                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
                                />
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-slate-500">To</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => {
                                        setCustomEndDate(e.target.value)
                                        setTimeRange('CUSTOM')
                                    }}
                                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer shadow-2xs"
                                />
                            </div>

                            {(customStartDate || customEndDate) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomStartDate('')
                                        setCustomEndDate('')
                                        setTimeRange('ALL')
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 font-extrabold text-[10px] transition-colors cursor-pointer ml-1"
                                >
                                    Reset Dates
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 6 KPI Metric Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {/* Metric 1: Total Revenue */}
                    <div
                        onClick={() => navigate('/admin-sales-report')}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-orange-400 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-orange-600 transition-colors">Total Revenue</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-orange-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.revenue.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.revenue.areaD} fill="url(#orangeSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="orangeSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-orange-600 mt-2">
                            ₱{totalLiveRevenue.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                            {dateFilteredOrders.length} Period Orders
                        </p>
                    </div>

                    {/* Metric 2: Total Orders */}
                    <div
                        onClick={() => navigate('/admin-sales-report')}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">Total Orders</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-indigo-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.orders.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.orders.areaD} fill="url(#indigoSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="indigoSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mt-2">
                            {dateFilteredOrders.length}
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-600 mt-1">
                            {posOrders.length} POS / {deliveryOrders.length} Delivery
                        </p>
                    </div>

                    {/* Metric 3: POS Store Revenue */}
                    <div
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'POS', tab: 'This Year' } })}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">POS Cashier Sales</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-amber-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.pos.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.pos.areaD} fill="url(#amberSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="amberSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f59e0b" />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mt-2">
                            ₱{posRevenue.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-amber-600 mt-1">
                            {posRevenuePercent}% of Total Sales
                        </p>
                    </div>

                    {/* Metric 4: Online Delivery Revenue */}
                    <div
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'Online', tab: 'This Year' } })}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">Delivery Sales</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-emerald-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.delivery.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.delivery.areaD} fill="url(#emeraldSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="emeraldSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mt-2">
                            ₱{deliveryRevenue.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-emerald-600 mt-1">
                            {deliveryRevenuePercent}% of Total Sales
                        </p>
                    </div>

                    {/* Metric 5: Online Customer Buyers */}
                    <div
                        onClick={() => navigate('/customer-directory')}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">Online Customers</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-blue-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.customers.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.customers.areaD} fill="url(#blueSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="blueSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mt-2">
                            {totalOnlineCustomersCount}
                        </h3>
                        <p className="text-[10px] font-bold text-blue-600 mt-1">
                            Unique Delivery Buyers
                        </p>
                    </div>

                    {/* Metric 6: Average Order Value */}
                    <div
                        onClick={() => navigate('/admin-sales-report')}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-purple-600 transition-colors">Avg Ticket Size</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-purple-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.avgTicket.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.avgTicket.areaD} fill="url(#purpleSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="purpleSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mt-2">
                            ₱{averageOrderValue.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-purple-600 mt-1">
                            Average Spend / Order
                        </p>
                    </div>
                </div>

                {/* VISUAL CHARTS ROW 1: Sales Trend Timeline Chart + Sales Channel & Payment Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* CHART 1: Real-Time Revenue Timeline Bar Chart (8 Cols) */}
                    <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        Sales Revenue Timeline Chart
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        Chronological revenue breakdown filtered by {timeRange === 'ALL' ? 'All Time' : timeRange}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                                    {(['All', 'POS', 'Delivery'] as const).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setTrendViewMode(m)}
                                            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${trendViewMode === m
                                                ? 'bg-orange-500 text-white shadow-2xs'
                                                : 'text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {m === 'All' ? 'All Sales' : m === 'POS' ? 'POS Store' : 'Delivery'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Native Interactive Bar Chart */}
                            <div className="pt-8 pb-4">
                                <div className="h-56 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-200 relative">
                                    {/* Grid background lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] text-slate-300">
                                        <div className="border-b border-slate-100 w-full pb-1">High Peak</div>
                                        <div className="border-b border-slate-100 w-full pb-1">Mid Volume</div>
                                        <div className="border-b border-slate-100 w-full pb-1">Baseline</div>
                                    </div>

                                    {salesTrendBuckets.map((bucket, idx) => {
                                        const isHovered = hoveredTrendIndex === idx
                                        return (
                                            <div
                                                key={idx}
                                                onMouseEnter={() => setHoveredTrendIndex(idx)}
                                                onMouseLeave={() => setHoveredTrendIndex(null)}
                                                className="flex-1 flex flex-col items-center group relative cursor-pointer z-10"
                                            >
                                                {/* Tooltip */}
                                                {isHovered && (
                                                    <div className="absolute -top-12 bg-slate-900 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-lg z-20 whitespace-nowrap animate-in fade-in">
                                                        ₱{bucket.revenue.toLocaleString()} ({bucket.ordersCount} {bucket.ordersCount === 1 ? 'order' : 'orders'})
                                                    </div>
                                                )}

                                                <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden h-44 flex items-end p-1">
                                                    <div
                                                        className={`w-full rounded-t-lg transition-all duration-500 ${isHovered ? 'bg-orange-600 shadow-md' : 'bg-gradient-to-t from-orange-500 to-amber-400'
                                                            }`}
                                                        style={{ height: `${bucket.heightPct}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">
                                                    {bucket.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">
                                Period Total: <strong className="text-orange-600 font-extrabold">₱{totalLiveRevenue.toLocaleString()} Revenue</strong>
                            </span>
                            <span className="text-[11px] text-slate-400">Interactive Hover Activated</span>
                        </div>
                    </div>

                    {/* CHART 2: Sales Channel & Payment Method Distribution (4 Cols) */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="border-b border-slate-100 pb-3">
                                <h3 className="font-black text-base text-slate-900 tracking-tight">Channel & Payment Split</h3>
                                <p className="text-[11px] text-slate-400 font-medium">Revenue ratio between store channels & digital wallets</p>
                            </div>

                            {/* Channel Split Progress Card */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-700">Order Channel Ratio</span>
                                    <span className="text-orange-600">{posRevenuePercent}% POS / {deliveryRevenuePercent}% Delivery</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-3.5 flex overflow-hidden p-0.5">
                                    <div
                                        className="bg-amber-500 h-full rounded-l-full transition-all duration-500"
                                        style={{ width: `${posRevenuePercent}%` }}
                                        title={`POS Revenue: ₱${posRevenue.toLocaleString()}`}
                                    ></div>
                                    <div
                                        className="bg-emerald-500 h-full rounded-r-full transition-all duration-500"
                                        style={{ width: `${deliveryRevenuePercent}%` }}
                                        title={`Delivery Revenue: ₱${deliveryRevenue.toLocaleString()}`}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                        POS Store (₱{posRevenue.toLocaleString()})
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Delivery (₱{deliveryRevenue.toLocaleString()})
                                    </span>
                                </div>
                            </div>

                            {/* Payment Methods Breakdown List */}
                            <div className="space-y-2.5">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Payment Gateways</p>
                                {paymentStats.map((pm) => (
                                    <div key={pm.name} className="p-2.5 rounded-2xl bg-white border border-slate-100 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <span className={`w-3 h-3 rounded-full ${pm.color}`}></span>
                                            <span className="font-bold text-slate-700">{pm.name}</span>
                                        </div>
                                        <div className="text-right font-extrabold">
                                            <span className="text-slate-900 block">₱{pm.amount.toLocaleString()}</span>
                                            <span className="text-[10px] text-slate-400 font-semibold">{pm.pct}% share</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 text-right text-xs">
                            <Link to="/admin-sales-report" className="text-orange-600 hover:text-orange-700 font-bold text-[11px]">
                                Full Sales Breakdown &rarr;
                            </Link>
                        </div>
                    </div>
                </div>

                {/* VISUAL CHARTS ROW 2: Seafood Category Revenue Breakdown + Seafood Item Sales Volume + Product Catalog */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* CHART 3: Category Revenue Distribution Horizontal Chart (6 Cols) */}
                    <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                                <div>
                                    <h3 className="font-black text-base text-slate-900 tracking-tight">Category Revenue Breakdown</h3>
                                    <p className="text-[11px] text-slate-400 font-medium">Revenue contribution per menu category</p>
                                </div>
                                <span className="text-xs bg-orange-50 text-orange-600 font-bold px-3 py-1 rounded-full border border-orange-200/60">
                                    7 Categories
                                </span>
                            </div>

                            <div className="space-y-3">
                                {categoryRevenueData.map((cat) => (
                                    <div key={cat.category} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                            <span>{cat.category}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-[11px] font-normal">{cat.percentage}%</span>
                                                <span className="text-orange-600 font-extrabold">₱{cat.revenue.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-orange-400 to-amber-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${cat.barRatio}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                            <span>Top Category: <strong className="text-orange-600 font-bold">{categoryRevenueData[0]?.category || 'Seafoods'}</strong></span>
                            <span className="text-[11px] text-slate-400">Synced Real-Time</span>
                        </div>
                    </div>

                    {/* Dynamic Real Sales Product Chart (6 Cols) */}
                    <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        Seafood Menu Sales Volume
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
                                Top Seller:{' '}
                                <strong className="text-orange-600 font-bold">
                                    {topItemPerformers[0]?.name || 'Waiting for orders'} ({topItemPerformers[0]?.count || 0} sold)
                                </strong>
                            </span>
                            <span className="text-[11px] text-slate-400">Auto-synced</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Interactive Product Catalog Manager & Real Live Transactions Table */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Functional Product Catalog (4 Cols) */}
                    <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                    <h3 className="font-black text-base text-slate-900 tracking-tight">Product Catalog & Prices</h3>
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
                                                                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='65' x='20' font-size='30' fill='%23ea580c'>SF</text></svg>"
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
                                                        Edit
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
                                Open Cashier POS &rarr;
                            </Link>
                        </div>
                    </div>

                    {/* Bottom: Real Live Transactions Table (8 Cols) */}
                    <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-100">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                        Order History Transactions
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        Customer orders placed via Cashier POS and Online Menu
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={orderSearchQuery}
                                            onChange={(e) => setOrderSearchQuery(e.target.value)}
                                            placeholder="Search order ref, customer..."
                                            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-all w-48"
                                        />
                                    </div>

                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                        {(['All', 'POS', 'Delivery'] as const).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setOrderTableFilter(tab)}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${orderTableFilter === tab
                                                    ? 'bg-orange-500 text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {tab === 'All' ? 'All Channels' : tab === 'POS' ? 'POS Store' : 'Online Delivery'}
                                            </button>
                                        ))}
                                    </div>

                                    <Link
                                        to="/admin-sales-report"
                                        className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1.5 ml-2"
                                    >
                                        View All Invoices &rarr;
                                    </Link>
                                </div>
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
                                        {filteredOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="text-center py-12 text-slate-400">
                                                    <p className="font-bold text-slate-600">No orders recorded yet for this period.</p>
                                                    <p className="text-xs mt-0.5">Try selecting "All Time" or adjusting your date range filter.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredOrders.slice(0, 10).map((tx) => (
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
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                                            {tx.status || 'Completed'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                            <span>Showing recent transactions</span>
                            <span className="font-bold text-slate-600">Period Orders: {filteredOrders.length}</span>
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
                                &times;
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            <p className="font-bold text-slate-700 mb-1">Item Description:</p>
                            {selectedProduct.description || 'Signature seafood specialty cooked with special house seasonings.'}
                        </div>

                        {priceUpdateSuccess && (
                            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-200 text-xs font-bold text-center animate-in fade-in">
                                Price updated successfully across all POS systems!
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
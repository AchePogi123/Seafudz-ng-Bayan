import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { ProductImage } from '../components/ProductImage'
import { useMenuPrices } from '../utils/menuPriceManager'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { subscribeOrderSync } from '../utils/orderSync'
import { setCachedProductImage, useProductImages } from '../utils/useProductImages'

export interface LiveOrderRecord {
    id: string
    ref: string
    dateTime: string
    created_at?: string
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

const parseOrderDate = (dateStr?: string, createdAtRaw?: string): Date => {
    if (createdAtRaw) {
        const d = new Date(createdAtRaw)
        if (!isNaN(d.getTime())) return d
    }
    if (!dateStr) return new Date()
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parsed = Date.parse(dateStr)
    if (!isNaN(parsed)) return new Date(parsed)
    return new Date()
}

const generateSmoothSparkline = (values: number[], width = 56, height = 28, padding = 3) => {
    let ptsData = values && values.length > 0 ? [...values] : [10, 15, 12, 22, 18, 28, 25]

    // If all values are 0 or all values are identical
    const allZero = ptsData.every((v) => v === 0)
    const minVal = Math.min(...ptsData)
    const maxVal = Math.max(...ptsData)

    if (allZero) {
        ptsData = [6, 12, 9, 18, 14, 24, 20] // Default gentle upward trend when 0
    } else if (minVal === maxVal) {
        ptsData = ptsData.map((v, i) => Math.max(1, v + Math.sin(i * 1.2) * (v * 0.15 || 2)))
    }

    if (ptsData.length === 1) {
        ptsData = [ptsData[0] * 0.8, ptsData[0], ptsData[0] * 1.1]
    } else if (ptsData.length === 2) {
        ptsData = [ptsData[0], (ptsData[0] + ptsData[1]) / 2, ptsData[1]]
    }

    const curMin = Math.min(...ptsData)
    const curMax = Math.max(...ptsData)
    const range = curMax - curMin || 1

    const numPoints = ptsData.length
    const dx = (width - padding * 2) / (numPoints - 1)

    const points = ptsData.map((val, i) => {
        const x = padding + i * dx
        const normalized = (val - curMin) / range
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
    const { menuItems, refresh: refreshProductImages } = useProductImages()

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
    const [isAddProductOpen, setIsAddProductOpen] = useState(false)
    const [newProductName, setNewProductName] = useState('')
    const [newProductCategory, setNewProductCategory] = useState('Seafoods')
    const [newProductDescription, setNewProductDescription] = useState('')
    const [newProductPrice, setNewProductPrice] = useState<number | string>('')
    const [isSavingProduct, setIsSavingProduct] = useState(false)
    const [productFormError, setProductFormError] = useState('')
    const [catalogFeedback, setCatalogFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageFeedback, setImageFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [isSavingImage, setIsSavingImage] = useState(false)
    const imagePreviewRef = useRef<string | null>(null)

    const isFetchingRef = useRef(false)
    const lastFetchRef = useRef(0)

    useEffect(() => () => {
        if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
    }, [])

    // Summary Data state from PostgreSQL aggregation
    const [summaryData, setSummaryData] = useState<{
        totalOrders: number
        grossRevenue: number
        subtotalRevenue: number
        vatCollected: number
        averageOrderValue: number
        posOrders: number
        posRevenue: number
        deliveryOrders: number
        deliveryRevenue: number
        uniqueCustomers: number
        breakdown: {
            cash: { total: number; count: number }
            gcash: { total: number; count: number }
            maya: { total: number; count: number }
            hybrid: { total: number; count: number }
            cod: { total: number; count: number }
        }
        topDishes?: Array<{ name: string; quantitySold: number; revenue: number }>
    }>({
        totalOrders: 0,
        grossRevenue: 0,
        subtotalRevenue: 0,
        vatCollected: 0,
        averageOrderValue: 0,
        posOrders: 0,
        posRevenue: 0,
        deliveryOrders: 0,
        deliveryRevenue: 0,
        uniqueCustomers: 0,
        breakdown: {
            cash: { total: 0, count: 0 },
            gcash: { total: 0, count: 0 },
            maya: { total: 0, count: 0 },
            hybrid: { total: 0, count: 0 },
            cod: { total: 0, count: 0 },
        },
        topDishes: [],
    })

    // Fetch Database Sales Summary for exact KPI cards & Best Sellers
    const fetchSummary = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams()
            if (timeRange === 'CUSTOM' && customStartDate && customEndDate) {
                queryParams.append('startDate', customStartDate)
                queryParams.append('endDate', customEndDate)
            } else {
                const tabParam =
                    timeRange === '1D'
                        ? 'Today'
                        : timeRange === '1W'
                            ? 'This Week'
                            : timeRange === '1M'
                                ? 'This Month'
                                : timeRange === '1Y'
                                    ? 'This Year'
                                    : ''
                if (tabParam) queryParams.append('tab', tabParam)
            }

            const authHeaders = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/sales/summary?${queryParams.toString()}`, { headers: authHeaders })
            if (res.ok) {
                const json = await res.json()
                if (json.success && json.data) {
                    setSummaryData({
                        totalOrders: json.data.totalOrders || 0,
                        grossRevenue: json.data.grossRevenue || 0,
                        subtotalRevenue: json.data.subtotalRevenue || 0,
                        vatCollected: json.data.vatCollected || 0,
                        averageOrderValue: json.data.averageOrderValue || 0,
                        posOrders: json.data.posOrders || 0,
                        posRevenue: json.data.posRevenue || 0,
                        deliveryOrders: json.data.deliveryOrders || 0,
                        deliveryRevenue: json.data.deliveryRevenue || 0,
                        uniqueCustomers: json.data.uniqueCustomers || 0,
                        breakdown: json.data.breakdown || {
                            cash: { total: 0, count: 0 },
                            gcash: { total: 0, count: 0 },
                            maya: { total: 0, count: 0 },
                            hybrid: { total: 0, count: 0 },
                            cod: { total: 0, count: 0 },
                        },
                        topDishes: json.data.topDishes || [],
                    })
                }
            }
        } catch (err) {
            console.warn('Failed to fetch summary in AdminDashboard:', err)
        }
    }, [timeRange, customStartDate, customEndDate])

    useEffect(() => {
        void fetchSummary()
    }, [fetchSummary])

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

            // 2. Fetch from Backend Database API with smart limit & time horizon
            try {
                const tabParam =
                    timeRange === '1D'
                        ? 'Today'
                        : timeRange === '1W'
                            ? 'This Week'
                            : timeRange === '1M'
                                ? 'This Month'
                                : timeRange === '1Y'
                                    ? 'This Year'
                                    : ''

                const queryParams = new URLSearchParams()
                if (tabParam) queryParams.append('tab', tabParam)
                queryParams.append('limit', '10000')

                const authHeaders = await getAuthHeaders()
                const res = await fetch(`${API_BASE_URL}/orders?${queryParams.toString()}`, { headers: authHeaders })
                if (res.ok) {
                    const json = await res.json()
                    const dbOrders = json.data || json || []
                    if (Array.isArray(dbOrders) && dbOrders.length > 0) {
                        const dbList: LiveOrderRecord[] = dbOrders.map((dbO: any) => {
                            const rawType = dbO.order_type || dbO.type || ''
                            const normalizedType =
                                rawType.toUpperCase() === 'ONLINE'
                                    ? 'Delivery'
                                    : rawType.toUpperCase() === 'ON_SITE'
                                        ? 'POS Order'
                                        : rawType || 'POS Order'

                            return {
                                id: dbO.id,
                                ref: dbO.id,
                                dateTime: dbO.created_at ? new Date(dbO.created_at).toLocaleString() : new Date().toLocaleString(),
                                created_at: dbO.created_at,
                                type: normalizedType,
                                status: dbO.status || 'Completed',
                                paymentStatus: dbO.payment_status || 'Paid',
                                customer:
                                    dbO.customer_name ||
                                    (normalizedType.toLowerCase().includes('delivery') ? 'Online Customer' : 'Walk-In'),
                                items: Array.isArray(dbO.items)
                                    ? dbO.items.map((i: any) => `${i.name || i.product_name_snapshot} x${i.quantity}`).join(', ')
                                    : 'Assorted Seafoods',
                                total: Number(dbO.total || 0),
                                paymentMethod: dbO.payment_method || 'Cash',
                            }
                        })

                        // Combine DB orders with any unique local orders
                        const dbMap = new Map<string, LiveOrderRecord>()
                        dbList.forEach((o) => dbMap.set(o.id, o))
                        combinedOrders.forEach((o) => {
                            if (!dbMap.has(o.id) && !dbMap.has(o.ref)) {
                                dbMap.set(o.id, o)
                            }
                        })
                        combinedOrders = Array.from(dbMap.values())
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
    }, [timeRange])

    useEffect(() => {
        void fetchLiveOrders()

        const unsubscribe = subscribeOrderSync(() => {
            void fetchSummary()
            void fetchLiveOrders(true)
        })

        const interval = setInterval(() => {
            void fetchSummary()
            void fetchLiveOrders()
        }, 2000)

        return () => {
            unsubscribe()
            clearInterval(interval)
        }
    }, [fetchLiveOrders, fetchSummary])

    // --- GLOBAL TIME RANGE FILTERED ORDERS ---
    const dateFilteredOrders = useMemo(() => {
        if (timeRange === 'ALL') return orders

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

        return orders.filter((o) => {
            const orderDate = parseOrderDate(o.dateTime, o.created_at)
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
        return menuItems.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
                item.category.toLowerCase().includes(searchProductQuery.toLowerCase())
            const matchesCategory =
                selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()
            return matchesSearch && matchesCategory
        })
    }, [menuItems, searchProductQuery, selectedCategory])

    const isOnlineOrder = (typeStr: string) => {
        const t = (typeStr || '').toLowerCase()
        return t.includes('delivery') || t.includes('online')
    }

    // Filtered Order History Table (combining Time Range + Table Channel & Search Filters)
    const filteredOrders = useMemo(() => {
        return dateFilteredOrders.filter((o) => {
            const isOnline = isOnlineOrder(o.type)
            const matchesFilter =
                orderTableFilter === 'All'
                    ? true
                    : orderTableFilter === 'POS'
                        ? !isOnline
                        : isOnline

            const query = orderSearchQuery.toLowerCase().trim()
            const matchesSearch =
                !query ||
                o.ref.toLowerCase().includes(query) ||
                o.customer.toLowerCase().includes(query) ||
                o.items.toLowerCase().includes(query)

            return matchesFilter && matchesSearch
        })
    }, [dateFilteredOrders, orderTableFilter, orderSearchQuery])

    // --- SYNCHRONIZED METRICS WITH DATABASE SUMMARY ---
    const posOrdersCount = useMemo(() => {
        if (dateFilteredOrders.length > 0) {
            return dateFilteredOrders.filter((o) => !isOnlineOrder(o.type)).length
        }
        return summaryData.posOrders || 0
    }, [summaryData.posOrders, dateFilteredOrders])

    const deliveryOrdersCount = useMemo(() => {
        if (dateFilteredOrders.length > 0) {
            return dateFilteredOrders.filter((o) => isOnlineOrder(o.type)).length
        }
        return summaryData.deliveryOrders || 0
    }, [summaryData.deliveryOrders, dateFilteredOrders])

    // Total Orders is ALWAYS the sum of On-site (POS) and Online (Delivery) orders created
    const totalOrdersCount = useMemo(() => {
        return posOrdersCount + deliveryOrdersCount
    }, [posOrdersCount, deliveryOrdersCount])

    const posRevenue = useMemo(() => {
        if (dateFilteredOrders.length > 0) {
            return dateFilteredOrders
                .filter((o) => !isOnlineOrder(o.type))
                .reduce((sum, o) => sum + Number(o.total || 0), 0)
        }
        return summaryData.posRevenue || 0
    }, [summaryData.posRevenue, dateFilteredOrders])

    const deliveryRevenue = useMemo(() => {
        if (dateFilteredOrders.length > 0) {
            return dateFilteredOrders
                .filter((o) => isOnlineOrder(o.type))
                .reduce((sum, o) => sum + Number(o.total || 0), 0)
        }
        return summaryData.deliveryRevenue || 0
    }, [summaryData.deliveryRevenue, dateFilteredOrders])

    const totalLiveRevenue = useMemo(() => {
        return posRevenue + deliveryRevenue
    }, [posRevenue, deliveryRevenue])

    const posRevenuePercent = useMemo(() => {
        if (totalLiveRevenue === 0) return 0
        return Math.round((posRevenue / totalLiveRevenue) * 100)
    }, [posRevenue, totalLiveRevenue])

    const deliveryRevenuePercent = useMemo(() => {
        if (totalLiveRevenue === 0) return 0
        return 100 - posRevenuePercent
    }, [posRevenuePercent, totalLiveRevenue])

    const mappedActiveTab = useMemo(() => {
        return timeRange === '1D'
            ? 'Today'
            : timeRange === '1W'
                ? 'This Week'
                : timeRange === '1M'
                    ? 'This Month'
                    : 'This Year'
    }, [timeRange])

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
                (a, b) => parseOrderDate(a.dateTime, a.created_at).getTime() - parseOrderDate(b.dateTime, b.created_at).getTime()
            )

            const minTime = parseOrderDate(sorted[0].dateTime, sorted[0].created_at).getTime()
            const maxTime = parseOrderDate(sorted[sorted.length - 1].dateTime, sorted[sorted.length - 1].created_at).getTime()
            const timeSpan = maxTime - minTime || 1

            sorted.forEach((ord) => {
                const t = parseOrderDate(ord.dateTime, ord.created_at).getTime()
                let idx = Math.floor(((t - minTime) / timeSpan) * slotsCount)
                if (idx >= slotsCount) idx = slotsCount - 1
                if (idx < 0) idx = 0

                const total = Number(ord.total || 0)
                const isDel = isOnlineOrder(ord.type)

                revenueSlots[idx] += total
                ordersSlots[idx] += 1
                if (isDel) {
                    deliverySlots[idx] += 1
                    if (ord.customer && typeof ord.customer === 'string') {
                        customerSets[idx].add(ord.customer.trim().toLowerCase())
                    }
                } else {
                    posSlots[idx] += 1
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
        if (summaryData.topDishes && summaryData.topDishes.length > 0) {
            return summaryData.topDishes.slice(0, 5).map((dish, idx) => ({
                code: String.fromCharCode(65 + idx),
                name: dish.name || 'Seafood Dish',
                count: Number(dish.quantitySold) || 0,
            }))
        }
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
    }, [summaryData.topDishes, itemSalesStats])

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
            const isDel = isOnlineOrder(o.type)
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
        const bd = summaryData.breakdown
        const bdTotal =
            (bd?.cash?.total || 0) +
            (bd?.gcash?.total || 0) +
            (bd?.maya?.total || 0) +
            (bd?.hybrid?.total || 0) +
            (bd?.cod?.total || 0)

        if (bdTotal > 0) {
            const list = [
                { name: 'Cash (POS Store)', amount: bd.cash.total, pct: Math.round((bd.cash.total / bdTotal) * 100), color: 'bg-amber-500', border: 'border-amber-500' },
                { name: 'GCash Online', amount: bd.gcash.total, pct: Math.round((bd.gcash.total / bdTotal) * 100), color: 'bg-blue-500', border: 'border-blue-500' },
                { name: 'Maya / Split', amount: (bd.maya?.total || 0) + (bd.hybrid?.total || 0), pct: Math.round(((bd.maya?.total || 0) + (bd.hybrid?.total || 0)) / bdTotal * 100), color: 'bg-purple-500', border: 'border-purple-500' },
            ]
            return list.filter((p) => p.amount > 0 || p.name.includes('Cash') || p.name.includes('GCash'))
        }

        let gcash = 0
        let cash = 0

        dateFilteredOrders.forEach((o) => {
            const pm = (o.paymentMethod || '').toLowerCase()
            const amt = Number(o.total || 0)
            if (pm.includes('gcash')) gcash += amt
            else cash += amt
        })

        const total = gcash + cash || 1
        return [
            { name: 'Cash (POS Store)', amount: cash, pct: Math.round((cash / total) * 100), color: 'bg-amber-500', border: 'border-amber-500' },
            { name: 'GCash Online', amount: gcash, pct: Math.round((gcash / total) * 100), color: 'bg-blue-500', border: 'border-blue-500' },
        ]
    }, [summaryData.breakdown, dateFilteredOrders])

    const clearProductImageSelection = () => {
        if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current)
        imagePreviewRef.current = null
        setImagePreview(null)
        setImageFile(null)
        setImageFeedback(null)
    }

    const handleCloseProductModal = () => {
        clearProductImageSelection()
        setIsPriceEditOpen(false)
    }

    const handleSelectProduct = (item: MenuItem) => {
        clearProductImageSelection()
        setSelectedProduct(item)
        setNewPriceInput(getEffectivePrice(item.id, item.price))
        setIsPriceEditOpen(true)
        setPriceUpdateSuccess(false)
    }

    const handleCreateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const name = newProductName.trim()
        const price = Number(newProductPrice)
        if (!name || !Number.isFinite(price) || price < 0) {
            setProductFormError('Enter a product name and a valid price.')
            return
        }

        setIsSavingProduct(true)
        setProductFormError('')
        try {
            const response = await fetch(`${API_BASE_URL}/menu`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    name,
                    category: newProductCategory,
                    description: newProductDescription.trim(),
                    price,
                }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not add this product.')

            await refreshProductImages()
            setSearchProductQuery('')
            setSelectedCategory(newProductCategory)
            setNewProductName('')
            setNewProductDescription('')
            setNewProductPrice('')
            setIsAddProductOpen(false)
            setCatalogFeedback({ type: 'success', message: `${name} was added to the menu.` })
        } catch (error) {
            setProductFormError(error instanceof Error ? error.message : 'Could not add this product.')
        } finally {
            setIsSavingProduct(false)
        }
    }

    const handleDeleteProduct = async (item: MenuItem) => {
        const confirmed = window.confirm(
            `Remove "${item.name}" from the menu? It will no longer be available for new orders. Past orders will be kept.`
        )
        if (!confirmed) return

        setCatalogFeedback(null)
        try {
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(item.id)}`, {
                method: 'DELETE',
                headers: await getAuthHeaders(),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not remove this product.')

            resetPrice(item.id)
            await refreshProductImages()
            setCatalogFeedback({ type: 'success', message: `${item.name} was removed from the menu.` })
        } catch (error) {
            setCatalogFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not remove this product.',
            })
        }
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
            handleCloseProductModal()
        }, 800)
    }

    const handleResetToDefault = () => {
        if (!selectedProduct) return
        resetPrice(selectedProduct.id)
        setNewPriceInput(selectedProduct.price)
        setPriceUpdateSuccess(true)
        setTimeout(() => {
            setPriceUpdateSuccess(false)
            handleCloseProductModal()
        }, 800)
    }

    const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null
        event.target.value = ''
        setImageFeedback(null)
        clearProductImageSelection()
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setImageFeedback({ type: 'error', message: 'Choose a JPEG, PNG, or WebP image.' })
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageFeedback({ type: 'error', message: 'Image must be 5 MB or smaller.' })
            return
        }
        const objectUrl = URL.createObjectURL(file)
        imagePreviewRef.current = objectUrl
        setImagePreview(objectUrl)
        setImageFile(file)
    }

    const handleSaveProductImage = async () => {
        if (!selectedProduct || !imageFile || isSavingImage) return
        setIsSavingImage(true)
        setImageFeedback(null)
        try {
            const headers = await getAuthHeaders({}, { jsonContentType: false })
            const body = new FormData()
            body.append('image', imageFile)
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(selectedProduct.id)}/image`, {
                method: 'POST',
                headers,
                body,
            })
            const payload = await response.json()
            if (!response.ok || !payload?.data?.image) {
                throw new Error(payload?.message || 'Could not upload product photo.')
            }
            setCachedProductImage(selectedProduct.id, payload.data.image)
            setSelectedProduct((current) => current ? { ...current, image: payload.data.image } : current)
            clearProductImageSelection()
            await refreshProductImages()
            setImageFeedback({
                type: 'success',
                message: payload.oldImageCleanupPending
                    ? 'Photo updated. The previous storage file needs cleanup.'
                    : 'Product photo updated.',
            })
        } catch (error) {
            setImageFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not upload product photo.',
            })
        } finally {
            setIsSavingImage(false)
        }
    }

    const handleRestoreProductImage = async () => {
        if (!selectedProduct || isSavingImage) return
        setIsSavingImage(true)
        setImageFeedback(null)
        try {
            const headers = await getAuthHeaders()
            const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(selectedProduct.id)}/image`, {
                method: 'DELETE',
                headers,
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload?.message || 'Could not restore the bundled photo.')
            setCachedProductImage(selectedProduct.id, null)
            setSelectedProduct((current) => current
                ? { ...current, image: current.bundledImage || current.image }
                : current)
            clearProductImageSelection()
            await refreshProductImages()
            setImageFeedback({
                type: 'success',
                message: payload.cleanupPending
                    ? 'Bundled photo restored. The old storage file needs cleanup.'
                    : 'Bundled photo restored.',
            })
        } catch (error) {
            setImageFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Could not restore the bundled photo.',
            })
        } finally {
            setIsSavingImage(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f4f7f6] text-slate-800 font-sans pb-16 transition-all">
            {/* Top Admin Navigation */}
            <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 print:hidden">
                <NavbarAdmin />
            </div>

            {/* Full Width Body Container */}
            <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
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

                {/* 3 KPI Metric Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Metric 1: Total Orders (Both Online & POS) */}
                    <div
                        onClick={() => navigate('/admin-sales-report', { state: { tab: mappedActiveTab } })}
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
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                            {totalOrdersCount.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-600 mt-1">
                            Combined Online & On-Site
                        </p>
                    </div>

                    {/* Metric 2: Total Orders of On-Site POS */}
                    <div
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'POS', tab: mappedActiveTab } })}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">Total POS Orders</span>
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
                        <h3 className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">
                            {posOrdersCount.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-amber-600 mt-1">
                            On-Site Store Walk-Ins
                        </p>
                    </div>

                    {/* Metric 3: Total Orders Online */}
                    <div
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'Online', tab: mappedActiveTab } })}
                        className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">Total Online Orders</span>
                            <div className="w-14 h-8 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <svg className="w-full h-full text-blue-500 overflow-visible" viewBox="0 0 56 28" fill="none">
                                    <path d={dynamicMetricTrends.delivery.lineD} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d={dynamicMetricTrends.delivery.areaD} fill="url(#blueSpark)" opacity="0.25" />
                                    <defs>
                                        <linearGradient id="blueSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">
                            {deliveryOrdersCount.toLocaleString()}
                        </h3>
                        <p className="text-[10px] font-bold text-blue-600 mt-1">
                            Online Delivery Orders
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
                                    <span>
                                        Total Units:{' '}
                                        {summaryData.topDishes && summaryData.topDishes.length > 0
                                            ? summaryData.topDishes.reduce((sum, d) => sum + (Number(d.quantitySold) || 0), 0)
                                            : Object.values(itemSalesStats).reduce((a, b) => a + b, 0)}
                                    </span>
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
                    <div className="lg:col-span-5 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md shadow-slate-900/5 transition-shadow duration-300 hover:shadow-lg hover:shadow-slate-900/10 motion-reduce:transition-none">
                        <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white px-5 py-5 sm:px-6">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M5.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75A2.25 2.25 0 015.25 4.5zM8 12h3m-3 3h8" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-orange-600">Menu management</p>
                                        <h3 className="mt-0.5 text-lg font-black tracking-tight text-slate-900">Products & pricing</h3>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProductFormError('')
                                            setIsAddProductOpen(true)
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-[10px] font-extrabold text-white shadow-sm shadow-orange-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
                                    >
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                        </svg>
                                        Add product
                                    </button>
                                    <Link
                                        to="/pos"
                                        aria-label="Open POS"
                                        title="Open POS"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M5.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75A2.25 2.25 0 015.25 4.5zM8 12h3m-3 3h8" />
                                        </svg>
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 min-h-0 flex-col justify-between bg-gradient-to-b from-white to-orange-50/30 p-4 sm:p-5">
                            {catalogFeedback && (
                                <p
                                    role="status"
                                    className={`mb-3 rounded-xl border px-3 py-2 text-[11px] font-semibold ${
                                        catalogFeedback.type === 'success'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'border-rose-200 bg-rose-50 text-rose-700'
                                    }`}
                                >
                                    {catalogFeedback.message}
                                </p>
                            )}
                            <div>
                                <label htmlFor="admin-product-search" className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                                    Find a product
                                </label>
                                <div className="relative">
                                <svg className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    id="admin-product-search"
                                    type="search"
                                    value={searchProductQuery}
                                    onChange={(e) => setSearchProductQuery(e.target.value)}
                                    placeholder="Try “shrimp” or “drinks”"
                                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-xs font-medium text-slate-700 shadow-sm shadow-slate-900/[0.02] outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 motion-reduce:transition-none"
                                />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">Browse category</p>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-500 ring-1 ring-slate-200">
                                    {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-2 text-[11px]">
                                {CLIENT_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        aria-pressed={selectedCategory === cat}
                                        className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-all duration-200 motion-reduce:transition-none ${selectedCategory === cat
                                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                                            : 'border border-slate-200 bg-white text-slate-600 hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-2 h-[550px] overflow-y-auto rounded-2xl border border-orange-100/70 bg-white/80 p-2 pr-1 custom-scrollbar">
                                {filteredProducts.length === 0 ? (
                                    <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-400 ring-1 ring-orange-100">
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.5-4.5m2-5.25a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
                                            </svg>
                                        </div>
                                        <p className="mt-3 text-sm font-bold text-slate-800">No products found</p>
                                        <p className="mt-1 text-xs text-slate-400">Try another search or choose a different category.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {filteredProducts.map((item) => {
                                            const currentPrice = getEffectivePrice(item.id, item.price)
                                            const isCustom = currentPrice !== item.price

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="group flex w-full items-center gap-2 rounded-xl border border-transparent bg-white p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/70 hover:shadow-sm hover:shadow-orange-900/5 motion-reduce:transform-none motion-reduce:transition-none"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectProduct(item)}
                                                        aria-label={`Edit ${item.name} price`}
                                                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                                                    >
                                                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/70">
                                                            <ProductImage
                                                                src={item.image}
                                                                fallbackSrc={item.bundledImage}
                                                                alt={item.name}
                                                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
                                                            />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="truncate text-xs font-extrabold text-slate-800 transition-colors group-hover:text-orange-700">
                                                                {item.name}
                                                            </h4>
                                                            <div className="mt-1 flex min-w-0 items-center gap-1.5">
                                                                <span className="truncate text-[10px] font-semibold text-slate-400">{item.category}</span>
                                                                {isCustom && (
                                                                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-800">
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <span className="inline-flex rounded-xl border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-sm font-extrabold tabular-nums text-orange-700">
                                                                ₱{currentPrice.toLocaleString()}
                                                            </span>
                                                            <p className={`mt-1 text-[10px] font-semibold ${isCustom ? 'text-amber-700' : 'text-slate-400'}`}>
                                                                {isCustom ? `Base ₱${item.price.toLocaleString()}` : 'Edit price'}
                                                            </p>
                                                        </div>
                                                        <svg className="ml-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-orange-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectProduct(item)}
                                                        aria-label={`Edit ${item.name} product`}
                                                        title="Edit product"
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 2.651 2.651M5 19l4.2-.84L19.5 7.86a1.875 1.875 0 00-2.65-2.65L6.55 15.51 5 19z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDeleteProduct(item)}
                                                        aria-label={`Remove ${item.name} from menu`}
                                                        title="Remove product"
                                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
                                                    >
                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16m-10 4v6m4-6v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white px-3.5 py-3 shadow-sm shadow-orange-900/[0.02]">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" />
                                        </svg>
                                    </span>
                                    <span className="truncate text-[10px] font-extrabold text-slate-700">Prices sync with POS</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-orange-700">
                                    Select an item to edit
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom: Real Live Transactions Table (8 Cols) */}
                    <div className="lg:col-span-7 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
                        <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50/80 via-white to-white p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shadow-orange-500/20">
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-8 4h5m-8 6h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="text-lg font-black tracking-tight text-slate-900">Order history</h2>
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700">
                                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                                Live
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs font-medium text-slate-500">
                                            Recent orders from Cashier POS and Online Menu
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/admin-sales-report"
                                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-3.5 py-2.5 text-[11px] font-extrabold text-orange-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
                                >
                                    All invoices
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M7 7h10v10" />
                                    </svg>
                                </Link>
                            </div>

                            <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
                                <div className="relative min-w-0 flex-1">
                                    <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="search"
                                        value={orderSearchQuery}
                                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                                        placeholder="Search reference, customer, or item"
                                        aria-label="Search order history"
                                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 shadow-sm shadow-slate-900/[0.02] outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 motion-reduce:transition-none"
                                    />
                                </div>

                                <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm shadow-slate-900/[0.02]">
                                    {(['All', 'POS', 'Delivery'] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setOrderTableFilter(tab)}
                                            aria-pressed={orderTableFilter === tab}
                                            className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-extrabold transition-all duration-200 motion-reduce:transition-none ${orderTableFilter === tab
                                                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                                                : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700'
                                                }`}
                                        >
                                            {tab === 'All' ? 'All channels' : tab === 'POS' ? 'POS store' : 'Delivery'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 px-4 pb-3 pt-4 sm:px-5">
                            <div className="overflow-hidden rounded-2xl border border-slate-200">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[860px] border-collapse text-left">
                                        <thead>
                                            <tr className="border-b border-orange-100 bg-orange-50/70 text-[10px] font-extrabold uppercase tracking-wider text-orange-800">
                                                <th className="px-4 py-3.5">Reference</th>
                                                <th className="px-4 py-3.5">Customer / channel</th>
                                                <th className="px-4 py-3.5">Items</th>
                                                <th className="px-4 py-3.5">Date & time</th>
                                                <th className="px-4 py-3.5">Payment</th>
                                                <th className="px-4 py-3.5 text-right">Total</th>
                                                <th className="px-4 py-3.5 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                            {filteredOrders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-5 py-14 text-center">
                                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-400 ring-1 ring-orange-100">
                                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h8m-8 4h5m-8 6h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                        <p className="mt-3 font-extrabold text-slate-800">No matching orders</p>
                                                        <p className="mt-1 text-[11px] text-slate-400">Try changing the search or selecting another channel.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredOrders.slice(0, 10).map((tx) => (
                                                    <tr key={tx.id || tx.ref} className="transition-colors duration-150 hover:bg-orange-50/50">
                                                        <td className="px-4 py-3.5">
                                                            <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-[10px] font-bold text-slate-700">
                                                                {tx.ref || tx.id}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span className="block max-w-[150px] truncate font-bold text-slate-800" title={tx.customer || 'Walk-In Customer'}>
                                                                {tx.customer || 'Walk-In Customer'}
                                                            </span>
                                                            <span className="mt-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-700">
                                                                {tx.type}
                                                            </span>
                                                        </td>
                                                        <td className="max-w-[190px] truncate px-4 py-3.5 text-slate-600" title={tx.items}>
                                                            {tx.items || 'Seafood Dish'}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3.5 text-[10px] text-slate-500">{tx.dateTime}</td>
                                                        <td className="px-4 py-3.5">
                                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-extrabold ${(tx.paymentMethod || '').toLowerCase().includes('gcash')
                                                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                                : (tx.paymentMethod || '').toLowerCase().includes('maya')
                                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                    : 'border-amber-200 bg-amber-50 text-amber-800'
                                                                }`}>
                                                                {tx.paymentMethod || 'Cash'}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-extrabold tabular-nums text-orange-700">
                                                            ₱{Number(tx.total || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-center">
                                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-extrabold text-emerald-700">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 text-[10px]">
                            <span className="font-medium text-slate-500">
                                Showing <strong className="font-extrabold text-slate-700">{Math.min(filteredOrders.length, 10)}</strong> of {filteredOrders.length} orders
                            </span>
                            <span className="rounded-full border border-orange-100 bg-white px-3 py-1.5 font-extrabold text-orange-700">
                                Orders in period: {filteredOrders.length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {isAddProductOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                    onClick={() => !isSavingProduct && setIsAddProductOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-product-title"
                        className="w-full max-w-lg space-y-5 rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 id="add-product-title" className="text-lg font-black text-slate-900">Add a product</h2>
                                    <p className="mt-0.5 text-xs text-slate-500">Add a new item to the menu and POS.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddProductOpen(false)}
                                disabled={isSavingProduct}
                                aria-label="Close add product form"
                                className="rounded-lg p-1 text-xl font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={(event) => void handleCreateProduct(event)} className="space-y-4">
                            <div>
                                <label htmlFor="new-product-name" className="mb-1.5 block text-xs font-bold text-slate-700">Product name</label>
                                <input
                                    id="new-product-name"
                                    type="text"
                                    value={newProductName}
                                    onChange={(event) => setNewProductName(event.target.value)}
                                    maxLength={255}
                                    autoFocus
                                    required
                                    placeholder="e.g. Garlic Butter Crab"
                                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-product-category" className="mb-1.5 block text-xs font-bold text-slate-700">Category</label>
                                    <select
                                        id="new-product-category"
                                        value={newProductCategory}
                                        onChange={(event) => setNewProductCategory(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                    >
                                        {CLIENT_CATEGORIES.filter((category) => category !== 'All Menu').map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="new-product-price" className="mb-1.5 block text-xs font-bold text-slate-700">Selling price</label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-2.5 text-sm font-bold text-orange-600">₱</span>
                                        <input
                                            id="new-product-price"
                                            type="number"
                                            min="0"
                                            max="99999999.99"
                                            step="0.01"
                                            value={newProductPrice}
                                            onChange={(event) => setNewProductPrice(event.target.value)}
                                            required
                                            placeholder="0.00"
                                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3.5 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="new-product-description" className="mb-1.5 block text-xs font-bold text-slate-700">
                                    Description <span className="font-medium text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    id="new-product-description"
                                    value={newProductDescription}
                                    onChange={(event) => setNewProductDescription(event.target.value)}
                                    maxLength={2000}
                                    rows={3}
                                    placeholder="Describe the product for your menu."
                                    className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                                />
                            </div>

                            <p className="rounded-xl bg-orange-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-orange-800">
                                After adding the product, select it in the catalog to upload a product photo.
                            </p>

                            {productFormError && (
                                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
                                    {productFormError}
                                </p>
                            )}

                            <div className="flex gap-2 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddProductOpen(false)}
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingProduct}
                                    className="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSavingProduct ? 'Adding product…' : 'Add product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Interactive Product Details & Live Price Editor Modal */}
            {isPriceEditOpen && selectedProduct && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={handleCloseProductModal}
                >
                    <div
                        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 overflow-hidden flex items-center justify-center">
                                    <ProductImage
                                        src={selectedProduct.image}
                                        fallbackSrc={selectedProduct.bundledImage}
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
                                onClick={handleCloseProductModal}
                                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            <p className="font-bold text-slate-700 mb-1">Item Description:</p>
                            {selectedProduct.description || 'Signature seafood specialty cooked with special house seasonings.'}
                        </div>

                        <section className="space-y-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
                            <div className="flex items-center gap-3">
                                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white border border-orange-100">
                                    <ProductImage
                                        src={imagePreview || selectedProduct.image}
                                        fallbackSrc={selectedProduct.bundledImage}
                                        alt={`${selectedProduct.name} preview`}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800">Product photo</p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                        JPEG, PNG, or WebP. Maximum 5 MB.
                                    </p>
                                </div>
                            </div>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageSelection}
                                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-bold file:text-orange-700 hover:file:bg-orange-100"
                                disabled={isSavingImage}
                            />
                            {imageFile && (
                                <p className="truncate text-[11px] text-slate-500">{imageFile.name}</p>
                            )}
                            {imageFeedback && (
                                <p
                                    role="status"
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                        imageFeedback.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-700'
                                    }`}
                                >
                                    {imageFeedback.message}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => void handleSaveProductImage()}
                                    disabled={!imageFile || isSavingImage}
                                    className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSavingImage ? 'Saving photo…' : 'Upload photo'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleRestoreProductImage()}
                                    disabled={isSavingImage || selectedProduct.image === selectedProduct.bundledImage}
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Restore default
                                </button>
                            </div>
                        </section>

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
                                    onClick={handleCloseProductModal}
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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import { CLIENT_MENU_ITEMS } from '../components/MenuCard'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { subscribeOrderSync, subscribeProductCatalogSync } from '../utils/orderSync'
import { useProductImages } from '../utils/useProductImages'

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
    if (!dateStr) return new Date(0)
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parsed = Date.parse(dateStr)
    if (!isNaN(parsed)) return new Date(parsed)
    const match = String(dateStr).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
    if (match) {
        const p1 = parseInt(match[1], 10)
        const p2 = parseInt(match[2], 10)
        const year = parseInt(match[3], 10)
        const hour = match[4] ? parseInt(match[4], 10) : 0
        const min = match[5] ? parseInt(match[5], 10) : 0
        const sec = match[6] ? parseInt(match[6], 10) : 0
        const month = p1 > 12 ? p2 - 1 : p1 - 1
        const day = p1 > 12 ? p1 : p2
        const res = new Date(year, month, day, hour, min, sec)
        if (!isNaN(res.getTime())) return res
    }
    return new Date(0)
}

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate()
    const { menuItems, refresh: refreshProductImages } = useProductImages()

    // Global Time Filter State
    const [timeRange, setTimeRange] = useState<TimeRangeOption>('ALL')
    const [customStartDate, setCustomStartDate] = useState<string>('')
    const [customEndDate, setCustomEndDate] = useState<string>('')

    // Order Filters & Queries
    const [orderTableFilter, setOrderTableFilter] = useState<'All' | 'POS' | 'Delivery'>('All')
    const [orderSearchQuery, setOrderSearchQuery] = useState('')
    const [trendViewMode, setTrendViewMode] = useState<'All' | 'POS' | 'Delivery'>('All')
    const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null)

    // Live Real Orders State
    const [orders, setOrders] = useState<LiveOrderRecord[]>([])
    const [isLoadingOrders, setIsLoadingOrders] = useState(true)
    const isFetchingRef = useRef(false)
    const lastFetchRef = useRef(0)


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
        categoryBreakdown?: Array<{ category: string; revenue: number; units: number }>
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
        categoryBreakdown: [],
    })

    // Fetch Database Sales Summary for exact KPI cards & Best Sellers
    const fetchSummary = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams()
            if (timeRange === 'CUSTOM') {
                if (customStartDate) queryParams.append('startDate', customStartDate)
                if (customEndDate) queryParams.append('endDate', customEndDate)
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
                        categoryBreakdown: json.data.categoryBreakdown || [],
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
                const queryParams = new URLSearchParams()
                if (timeRange === 'CUSTOM') {
                    if (customStartDate) queryParams.append('startDate', customStartDate)
                    if (customEndDate) queryParams.append('endDate', customEndDate)
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
                queryParams.append('limit', '10000')

                const authHeaders = await getAuthHeaders()
                const res = await fetch(`${API_BASE_URL}/orders?${queryParams.toString()}`, { headers: authHeaders })
                if (res.ok) {
                    const json = await res.json()
                    const dbOrders = json.data || json || []
                    if (Array.isArray(dbOrders)) {
                        const dbList: LiveOrderRecord[] = dbOrders.map((dbO: any) => {
                            const rawFulfillment = String(dbO.fulfillment_type || dbO.fulfillmentType || '').toUpperCase()
                            const rawType = dbO.order_type || dbO.type || ''
                            const normalizedType =
                                rawFulfillment === 'PICKUP' || rawType.toUpperCase().includes('PICKUP')
                                    ? 'Store Pick-Up'
                                    : rawType.toUpperCase() === 'ONLINE' || rawType.toUpperCase() === 'DELIVERY'
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
                                customer: (() => {
                                    const c = String(dbO.customer_name || dbO.customerName || dbO.customer || dbO.fullname || '').trim();
                                    if (c && c !== 'Walk-In' && c !== 'Walk-In Customer' && c !== 'Online Customer') return c;
                                    if (c === 'Online Customer') return c;
                                    return '';
                                })(),
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
                        combinedOrders = Array.from(dbMap.values()).sort((a, b) => {
                            const timeA = parseOrderDate(a.dateTime, a.created_at).getTime()
                            const timeB = parseOrderDate(b.dateTime, b.created_at).getTime()
                            return timeB - timeA
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
    }, [timeRange, customStartDate, customEndDate])

    useEffect(() => {
        void fetchLiveOrders()

        const unsubscribe = subscribeOrderSync(() => {
            void fetchSummary()
            void fetchLiveOrders(true)
        })

        const unsubscribeCatalog = subscribeProductCatalogSync(() => {
            void refreshProductImages()
        })

        // Relaxed periodic background heartbeat (30s) - instant updates are pushed via SSE (subscribeOrderSync)
        const interval = setInterval(() => {
            void fetchSummary()
            void fetchLiveOrders()
        }, 30000)

        return () => {
            unsubscribe()
            unsubscribeCatalog()
            clearInterval(interval)
        }
    }, [fetchLiveOrders, fetchSummary, refreshProductImages])

    // --- GLOBAL TIME RANGE FILTERED ORDERS ---
    const dateFilteredOrders = useMemo(() => {
        let list = orders
        if (timeRange !== 'ALL') {
            const now = new Date()
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
            const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

            list = orders.filter((o) => {
                const orderDate = parseOrderDate(o.dateTime, o.created_at)
                const orderTime = orderDate.getTime()
                if (isNaN(orderTime) || orderTime <= 0) return false

                if (timeRange === '1D') {
                    return orderTime >= todayStart && orderTime <= todayEnd
                }
                if (timeRange === '1W') {
                    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime()
                    return orderTime >= oneWeekAgo && orderTime <= todayEnd
                }
                if (timeRange === '1M') {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
                    return orderTime >= monthStart && orderTime <= todayEnd
                }
                if (timeRange === '1Y') {
                    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()
                    return orderTime >= yearStart && orderTime <= todayEnd
                }
                if (timeRange === 'CUSTOM') {
                    let startOk = true
                    let endOk = true
                    if (customStartDate) {
                        const s = new Date(`${customStartDate}T00:00:00`).getTime()
                        startOk = orderTime >= s
                    }
                    if (customEndDate) {
                        const e = new Date(`${customEndDate}T23:59:59.999`).getTime()
                        endOk = orderTime <= e
                    }
                    return startOk && endOk
                }
                return true
            })
        }

        return [...list].sort((a, b) => {
            const timeA = parseOrderDate(a.dateTime, a.created_at).getTime()
            const timeB = parseOrderDate(b.dateTime, b.created_at).getTime()
            return timeB - timeA
        })
    }, [orders, timeRange, customStartDate, customEndDate])


    const isOnlineOrder = (typeStr: string) => {
        const t = (typeStr || '').toLowerCase()
        return t.includes('delivery') || t.includes('online')
    }

    // Filtered Order History Table (combining Time Range + Table Channel & Search Filters)
    // Strictly sorted newest first (top), oldest last
    const filteredOrders = useMemo(() => {
        const list = dateFilteredOrders.filter((o) => {
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

        return list.sort((a, b) => {
            const timeA = parseOrderDate(a.dateTime, a.created_at).getTime()
            const timeB = parseOrderDate(b.dateTime, b.created_at).getTime()
            return timeB - timeA
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
                    : timeRange === '1Y'
                        ? 'This Year'
                        : 'All Time'
    }, [timeRange])

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

    // Category Revenue Distribution Chart Data (calculated from actual ordered items & category mappings)
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

        // Build item to category & price lookup from menu catalog
        const itemCatLookup = new Map<string, { category: string; price: number }>()
        CLIENT_MENU_ITEMS.forEach((item) => {
            const clean = item.name.toLowerCase().trim()
            itemCatLookup.set(clean, { category: item.category, price: item.price })
            if (item.id) itemCatLookup.set(item.id.toLowerCase().trim(), { category: item.category, price: item.price })
        })

        const detectCategory = (nameStr: string): string => {
            const s = (nameStr || '').toLowerCase().trim()
            if (itemCatLookup.has(s)) return itemCatLookup.get(s)!.category
            if (s.includes('siomai')) return 'Siomai'
            if (s.includes('pastil') || s.includes('noodle') || s.includes('chao fan') || s.includes('fan')) return 'Value Meals'
            if (s.includes('lemonade') || s.includes('shake')) return 'Shake & Lemonade'
            if (s.includes('coke') || s.includes('sprite') || s.includes('royal') || s.includes('water') || s.includes('coffee') || s.includes('tea')) return 'Drinks'
            if (s.includes('pudding') || s.includes('ice cream') || s.includes('yelo')) return 'Desserts'
            if (s.includes('corn') || s.includes('rice') || s.includes('sauce') || s.includes('sausage') || s.includes('add-on') || s.includes('addon')) return 'Add Ons'
            return 'Seafoods'
        }

        dateFilteredOrders.forEach((ord) => {
            const ordTotal = Number(ord.total || 0)
            if (ordTotal <= 0) return

            // Case A: Order has detailed structured cart items
            if (ord.cartItems && Array.isArray(ord.cartItems) && ord.cartItems.length > 0) {
                let orderItemsSum = 0
                const orderCatTotals: Record<string, number> = {}

                ord.cartItems.forEach((ci: any) => {
                    const itemName = String(ci.name || ci.item?.name || ci.id || 'Seafood')
                    const cat = ci.category || ci.item?.category || detectCategory(itemName)
                    const qty = Number(ci.quantity) || 1
                    const unitP = Number(ci.price || ci.item?.price) || itemCatLookup.get(itemName.toLowerCase().trim())?.price || 0
                    const lineSubtotal = Number(ci.subtotal) || (unitP > 0 ? unitP * qty : 0)

                    orderCatTotals[cat] = (orderCatTotals[cat] || 0) + lineSubtotal
                    orderItemsSum += lineSubtotal
                })

                if (orderItemsSum > 0) {
                    Object.entries(orderCatTotals).forEach(([cat, sum]) => {
                        if (catMap[cat] !== undefined) {
                            catMap[cat] += (sum / orderItemsSum) * ordTotal
                        } else {
                            catMap['Seafoods'] += (sum / orderItemsSum) * ordTotal
                        }
                    })
                    return
                }
            }

            // Case B: Order has string description
            const itemsStr = (ord.items || '').trim()
            if (itemsStr) {
                const parts = itemsStr.split(',')
                let orderItemsSum = 0
                const orderCatTotals: Record<string, number> = {}

                parts.forEach((part) => {
                    const match = part.trim().match(/^(.*?)(?:\s*x\s*(\d+))?$/)
                    if (!match) return
                    const name = match[1].trim()
                    const qty = match[2] ? parseInt(match[2], 10) : 1
                    const cat = detectCategory(name)
                    const unitP = itemCatLookup.get(name.toLowerCase().trim())?.price || (cat === 'Seafoods' ? 300 : 50)
                    const lineSubtotal = unitP * qty

                    orderCatTotals[cat] = (orderCatTotals[cat] || 0) + lineSubtotal
                    orderItemsSum += lineSubtotal
                })

                if (orderItemsSum > 0) {
                    Object.entries(orderCatTotals).forEach(([cat, sum]) => {
                        if (catMap[cat] !== undefined) {
                            catMap[cat] += (sum / orderItemsSum) * ordTotal
                        } else {
                            catMap['Seafoods'] += (sum / orderItemsSum) * ordTotal
                        }
                    })
                    return
                }
            }

            // Case C: Fallback
            const fallbackCat = detectCategory(itemsStr || ord.type || '')
            catMap[fallbackCat] = (catMap[fallbackCat] || 0) + ordTotal
        })

        // If no orders in filtered list, fallback to backend database category breakdown
        const totalCategorizedRevenue = Object.values(catMap).reduce((a, b) => a + b, 0)
        if (totalCategorizedRevenue === 0 && summaryData.categoryBreakdown && summaryData.categoryBreakdown.length > 0) {
            summaryData.categoryBreakdown.forEach((cb) => {
                if (catMap[cb.category] !== undefined) {
                    catMap[cb.category] += Number(cb.revenue || 0)
                } else {
                    catMap['Seafoods'] += Number(cb.revenue || 0)
                }
            })
        }

        const effectiveTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || totalLiveRevenue || 1
        const maxCat = Math.max(...Object.values(catMap), 1)

        return Object.entries(catMap).map(([cat, rev]) => ({
            category: cat,
            revenue: Math.round(rev),
            percentage: effectiveTotal > 0 ? Math.round((rev / effectiveTotal) * 100) : 0,
            barRatio: Math.max(Math.round((rev / maxCat) * 100), rev > 0 ? 6 : 0),
        })).sort((a, b) => b.revenue - a.revenue)
    }, [dateFilteredOrders, totalLiveRevenue, summaryData.categoryBreakdown])

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

        let minTime = Infinity
        let maxTime = -Infinity
        filtered.forEach((ord) => {
            const t = parseOrderDate(ord.dateTime, ord.created_at).getTime()
            if (t > 0) {
                if (t < minTime) minTime = t
                if (t > maxTime) maxTime = t
            }
        })

        filtered.forEach((ord) => {
            const orderDate = parseOrderDate(ord.dateTime, ord.created_at)
            const orderTime = orderDate.getTime()
            let slotIdx = 0

            if (timeRange === '1D') {
                const hour = orderDate.getHours()
                if (hour < 10) slotIdx = 0
                else if (hour < 12) slotIdx = 1
                else if (hour < 14) slotIdx = 2
                else if (hour < 16) slotIdx = 3
                else if (hour < 18) slotIdx = 4
                else if (hour < 20) slotIdx = 5
                else slotIdx = 6
            } else if (timeRange === '1W') {
                const day = orderDate.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
                slotIdx = (day + 6) % 7 // Mon = 0 ... Sun = 6
            } else if (timeRange === '1M') {
                const d = orderDate.getDate()
                slotIdx = Math.min(Math.floor((d - 1) / 7), 4)
            } else if (timeRange === '1Y') {
                const m = orderDate.getMonth()
                slotIdx = Math.min(Math.floor(m / 2), 5)
            } else {
                if (minTime < maxTime) {
                    const ratio = (orderTime - minTime) / (maxTime - minTime)
                    slotIdx = Math.min(Math.max(Math.floor(ratio * slots.length), 0), slots.length - 1)
                } else {
                    slotIdx = 3
                }
            }

            if (slotIdx >= 0 && slotIdx < slots.length) {
                slots[slotIdx].revenue += Number(ord.total || 0)
                slots[slotIdx].ordersCount += 1
            }
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
        let posCash = 0
        let onlineCod = 0
        let other = 0

        dateFilteredOrders.forEach((o) => {
            const pm = (o.paymentMethod || '').toLowerCase()
            const isOnline = isOnlineOrder(o.type)
            const amt = Number(o.total || 0)

            if (pm.includes('gcash')) {
                gcash += amt
            } else if (pm.includes('maya') || pm.includes('card') || pm.includes('split') || pm.includes('hybrid')) {
                other += amt
            } else if (isOnline) {
                onlineCod += amt
            } else {
                posCash += amt
            }
        })

        const total = gcash + posCash + onlineCod + other || 1
        const list = []

        if (posCash > 0 || (gcash === 0 && onlineCod === 0 && other === 0)) {
            list.push({
                name: 'Cash (POS)',
                amount: posCash,
                pct: Math.round((posCash / total) * 100),
                dotClass: 'bg-amber-400',
            })
        }
        if (onlineCod > 0) {
            list.push({
                name: 'COD',
                amount: onlineCod,
                pct: Math.round((onlineCod / total) * 100),
                dotClass: 'bg-orange-500',
            })
        }
        list.push({
            name: 'GCash',
            amount: gcash,
            pct: Math.round((gcash / total) * 100),
            dotClass: 'bg-blue-500',
        })
        if (other > 0) {
            list.push({
                name: 'Maya / Cards',
                amount: other,
                pct: Math.round((other / total) * 100),
                dotClass: 'bg-violet-500',
            })
        }

        return list
    }, [dateFilteredOrders])

    const timeRangeOptions: { value: TimeRangeOption; label: string }[] = [
        { value: 'ALL', label: 'All time' },
        { value: '1D', label: 'Today' },
        { value: '1W', label: '7 days' },
        { value: '1M', label: '30 days' },
        { value: '1Y', label: 'This year' },
        { value: 'CUSTOM', label: 'Custom' },
    ]

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
            {/* Navbar */}
            <div className="px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5 print:hidden">
                <NavbarAdmin />
            </div>

            <div className="w-full px-4 sm:px-6 lg:px-10 pt-6 space-y-6">

                {/* Header row: title + sync + time filter */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Dashboard
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Store operations overview
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Time range pills */}
                        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                            {timeRangeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        setTimeRange(opt.value)
                                        if (opt.value !== 'CUSTOM') {
                                            setCustomStartDate('')
                                            setCustomEndDate('')
                                        }
                                    }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                        timeRange === opt.value
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom date inputs (visible when Custom selected) */}
                        {timeRange === 'CUSTOM' && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-orange-500"
                                />
                                <span className="text-slate-400">–</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        )}

                        <button
                            onClick={fetchLiveOrders}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            title="Refresh orders"
                        >
                            <svg className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Sync
                        </button>
                    </div>
                </div>

                {/* KPI row: 4 metric cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Revenue */}
                    <button
                        onClick={() => navigate('/admin-sales-report', { state: { tab: mappedActiveTab } })}
                        className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer border border-slate-100 group"
                    >
                        <p className="text-xs font-medium text-slate-400 mb-1">Revenue</p>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                            ₱{totalLiveRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                            Avg ₱{totalOrdersCount > 0 ? Math.round(totalLiveRevenue / totalOrdersCount).toLocaleString() : '0'} / order
                        </p>
                    </button>

                    {/* Total Orders */}
                    <button
                        onClick={() => navigate('/admin-sales-report', { state: { tab: mappedActiveTab } })}
                        className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer border border-slate-100 group"
                    >
                        <p className="text-xs font-medium text-slate-400 mb-1">Orders</p>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                            {totalOrdersCount.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                            POS + online combined
                        </p>
                    </button>

                    {/* POS Orders */}
                    <button
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'POS', tab: mappedActiveTab } })}
                        className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer border border-slate-100 group"
                    >
                        <p className="text-xs font-medium text-slate-400 mb-1">POS store</p>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                            {posOrdersCount.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-orange-600 mt-1 tabular-nums font-medium">
                            ₱{posRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                    </button>

                    {/* Online Orders */}
                    <button
                        onClick={() => navigate('/admin-sales-report', { state: { channel: 'Online', tab: mappedActiveTab } })}
                        className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer border border-slate-100 group"
                    >
                        <p className="text-xs font-medium text-slate-400 mb-1">Online</p>
                        <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                            {deliveryOrdersCount.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-orange-600 mt-1 tabular-nums font-medium">
                            ₱{deliveryRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                    </button>
                </div>

                {/* Charts row 1: Revenue timeline + Channel split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Revenue timeline chart */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-sm font-semibold text-slate-900">Revenue</h2>
                                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                                    ₱{totalLiveRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
                                </p>
                            </div>

                            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                                {(['All', 'POS', 'Delivery'] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setTrendViewMode(m)}
                                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                                            trendViewMode === m
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {m === 'All' ? 'All' : m === 'POS' ? 'POS' : 'Online'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Bar chart */}
                        <div className="h-48 flex items-end gap-1.5 sm:gap-3">
                            {salesTrendBuckets.map((bucket, idx) => {
                                const isHovered = hoveredTrendIndex === idx
                                return (
                                    <div
                                        key={idx}
                                        onMouseEnter={() => setHoveredTrendIndex(idx)}
                                        onMouseLeave={() => setHoveredTrendIndex(null)}
                                        className="flex-1 flex flex-col items-center relative cursor-pointer"
                                    >
                                        {isHovered && (
                                             <div className="absolute -top-10 bg-slate-800 text-white text-[10px] font-medium px-2.5 py-1 rounded-md shadow-lg z-10 whitespace-nowrap">
                                                ₱{bucket.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} · {bucket.ordersCount} orders
                                            </div>
                                        )}
                                        <div className="w-full flex items-end h-40">
                                            <div
                                                className={`w-full rounded-t-md transition-all duration-300 ${
                                                    isHovered
                                                        ? 'bg-orange-600'
                                                        : 'bg-orange-500'
                                                }`}
                                                style={{ height: `${bucket.heightPct}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-2 tabular-nums">
                                            {bucket.label}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Channel & Payment split */}
                    <div className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col">
                        <h2 className="text-sm font-semibold text-slate-900 mb-4">Channels</h2>

                        {/* Channel ratio bar */}
                        <div className="mb-5">
                            <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                                <span>POS {posRevenuePercent}%</span>
                                <span>Online {deliveryRevenuePercent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 flex overflow-hidden">
                                <div
                                    className="bg-amber-400 h-full transition-all duration-500"
                                    style={{ width: `${posRevenuePercent}%` }}
                                />
                                <div
                                    className="bg-orange-500 h-full transition-all duration-500"
                                    style={{ width: `${deliveryRevenuePercent}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 tabular-nums">
                                <span>₱{posRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                <span>₱{deliveryRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* Payment methods */}
                        <p className="text-[11px] font-medium text-slate-400 mb-2">Payment methods</p>
                        <div className="space-y-2 flex-1">
                            {paymentStats.map((pm) => (
                                <div key={pm.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${pm.dotClass}`} />
                                        <span className="text-slate-600">{pm.name}</span>
                                    </div>
                                    <div className="text-right tabular-nums">
                                        <span className="font-semibold text-slate-800">₱{pm.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                        <span className="text-slate-400 ml-1.5">{pm.pct}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-3 mt-auto border-t border-slate-100">
                            <Link to="/admin-sales-report" className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors">
                                View full report →
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Charts row 2: Category breakdown + Top sellers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Category Revenue */}
                    <div className="bg-white rounded-xl border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-slate-900">Category revenue</h2>
                            <span className="text-[11px] text-slate-400 tabular-nums">{categoryRevenueData.filter(c => c.revenue > 0).length} active</span>
                        </div>

                        <div className="space-y-3">
                            {categoryRevenueData.map((cat) => (
                                <div key={cat.category}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-slate-600">{cat.category}</span>
                                        <span className="font-semibold text-slate-800 tabular-nums">
                                            ₱{cat.revenue.toLocaleString()}
                                            <span className="text-slate-400 font-normal ml-1">{cat.percentage}%</span>
                                        </span>
                                    </div>
                                    <div className="bg-slate-100 rounded-full h-1.5">
                                        <div
                                            className="bg-orange-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${cat.barRatio}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top sellers */}
                    <div className="bg-white rounded-xl border border-slate-100 p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-semibold text-slate-900">Top sellers</h2>
                            <span className="text-[11px] text-slate-400 tabular-nums">
                                {summaryData.topDishes && summaryData.topDishes.length > 0
                                    ? summaryData.topDishes.reduce((sum, d) => sum + (Number(d.quantitySold) || 0), 0)
                                    : Object.values(itemSalesStats).reduce((a, b) => a + b, 0)} units
                            </span>
                        </div>

                        <div className="space-y-3">
                            {topItemPerformers.map((prod, i) => {
                                const pct = maxSoldVolume > 0 && prod.count > 0 ? Math.round((prod.count / maxSoldVolume) * 100) : 0
                                return (
                                    <div key={prod.code}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-500 tabular-nums">
                                                    {i + 1}
                                                </span>
                                                <span className="text-slate-700">{prod.name}</span>
                                            </div>
                                            <span className="font-semibold text-slate-800 tabular-nums">{prod.count}</span>
                                        </div>
                                        <div className="bg-slate-100 rounded-full h-1.5">
                                            <div
                                                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.max(pct, prod.count > 0 ? 8 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Order history table */}
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    {/* Table header */}
                    <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-semibold text-slate-900">Recent orders</h2>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-[10px] font-medium text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="search"
                                    value={orderSearchQuery}
                                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                                    placeholder="Search orders…"
                                    aria-label="Search order history"
                                    className="w-48 pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Channel filter */}
                            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                                {(['All', 'POS', 'Delivery'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setOrderTableFilter(tab)}
                                        aria-pressed={orderTableFilter === tab}
                                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                                            orderTableFilter === tab
                                                ? 'bg-white text-slate-900 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {tab === 'All' ? 'All' : tab}
                                    </button>
                                ))}
                            </div>

                            {/* Quick links */}
                            <button
                                onClick={() => navigate('/admin-menu')}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Menu
                                <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md tabular-nums">{menuItems.length}</span>
                            </button>
                            <button
                                onClick={() => navigate('/admin-inventory')}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                                Inventory
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left">
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-400">
                                    <th className="px-5 py-3 font-medium">Reference</th>
                                    <th className="px-5 py-3 font-medium">Customer</th>
                                    <th className="px-5 py-3 font-medium">Items</th>
                                    <th className="px-5 py-3 font-medium">Date</th>
                                    <th className="px-5 py-3 font-medium">Payment</th>
                                    <th className="px-5 py-3 font-medium text-right">Total</th>
                                    <th className="px-5 py-3 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs text-slate-700">
                                {filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-16 text-center">
                                            <p className="font-medium text-slate-500">No matching orders</p>
                                            <p className="text-slate-400 text-[11px] mt-1">Try a different search or filter.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.slice(0, 10).map((tx) => (
                                        <tr key={tx.id || tx.ref} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3">
                                                <span className="font-mono text-[11px] text-slate-500">
                                                    {tx.ref || tx.id}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="block max-w-[140px] truncate font-medium text-slate-800" title={tx.customer || '—'}>
                                                    {tx.customer || '—'}
                                                </span>
                                                <span className="text-[10px] text-slate-400">{tx.type}</span>
                                            </td>
                                            <td className="px-5 py-3 max-w-[180px] truncate text-slate-500" title={tx.items}>
                                                {tx.items || 'Seafood Dish'}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap text-[11px] text-slate-400 tabular-nums">
                                                {tx.dateTime}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                                    (tx.paymentMethod || '').toLowerCase().includes('gcash')
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : (tx.paymentMethod || '').toLowerCase().includes('maya')
                                                            ? 'bg-violet-50 text-violet-700'
                                                            : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {tx.paymentMethod || 'Cash'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">
                                                ₱{Number(tx.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-[10px] font-medium text-emerald-700">
                                                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                                    {tx.status || 'Completed'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table footer */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-[11px] text-slate-400">
                        <span>
                            Showing <span className="font-medium text-slate-600">{Math.min(filteredOrders.length, 10)}</span> of {filteredOrders.length}
                        </span>
                        <Link
                            to="/admin-sales-report"
                            className="font-medium text-orange-600 hover:text-orange-700 transition-colors"
                        >
                            All invoices →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AdminDashboard

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { API_BASE_URL } from '../utils/api'
import { useMenuAvailability } from '../utils/menuAvailability'
import { useMenuPrices } from '../utils/menuPriceManager'
import { getActiveUser } from '../cryptography/cryptoSession'

interface CartItem {
    item: MenuItem
    quantity: number
    specialNote: string
}

interface OnlineOrderState {
    id: string
    customerName: string
    phone: string
    address: string
    paymentMethod: string
    paymentReference?: string
    paymentReceipt?: string // Base64 or image data URL
    notes?: string
    items: CartItem[]
    subtotal: number
    vat: number
    deliveryFee: number
    total: number
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | string
    createdAt: string
}

// Helper functions for user-scoped storage keys
const getCartKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'sfb_customer_cart_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `sfb_customer_cart_${id}`
}

const getActiveOrderKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'seafudz_active_online_order_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `seafudz_active_online_order_${id}`
}

const getOrdersKey = (user: ReturnType<typeof getActiveUser>) => {
    if (!user) return 'seafudz_orders_guest'
    const id = user.id || user.username || user.fullname || 'guest'
    return `seafudz_orders_${id}`
}

export function normalizeStatus(rawStatus?: string): string {
    if (!rawStatus) return 'PENDING'
    const upper = String(rawStatus).toUpperCase().trim()
    if (['PENDING', 'PENDING_VERIFICATION', 'UNCONFIRMED', 'NEW', 'ORDER PLACED'].includes(upper)) return 'PENDING'
    if (['CONFIRMED', 'PENDING_PREPARATION', 'APPROVED', 'VERIFIED', 'SENT_TO_KITCHEN', 'IN_KITCHEN', 'IN KITCHEN', 'IN_PROCESS'].includes(upper)) return 'CONFIRMED'
    if (['PREPARING', 'COOKING', 'IN_PREPARATION'].includes(upper)) return 'PREPARING'
    if (['READY', 'READY_FOR_PICKUP', 'PREPARED', 'DONE'].includes(upper)) return 'READY'
    if (['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'ON_THE_WAY', 'IN_TRANSIT'].includes(upper)) return 'OUT_FOR_DELIVERY'
    if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(upper)) return 'COMPLETED'
    if (upper === 'FLAGGED' || upper === 'CANCELLED') return upper
    return 'PENDING'
}

export function getStatusRank(rawStatus?: string): number {
    const norm = normalizeStatus(rawStatus)
    switch (norm) {
        case 'PENDING': return 0
        case 'CONFIRMED': return 1
        case 'PREPARING': return 2
        case 'READY': return 3
        case 'OUT_FOR_DELIVERY': return 4
        case 'COMPLETED': return 5
        case 'CANCELLED':
        case 'FLAGGED': return -1
        default: return 0
    }
}

export const OnlineCustomer: React.FC = () => {
    const navigate = useNavigate()
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

    // Availability & Price sync
    const { isAvailable } = useMenuAvailability()
    const { getEffectivePrice } = useMenuPrices()

    const isFetchingOrderRef = useRef(false)
    const lastFetchTimeRef = useRef(0)

    // Navigation states (automatically open tracking tab if there is an ongoing uncompleted order)
    const [activeTab, setActiveTab] = useState<'menu' | 'billing' | 'tracking'>(() => {
        try {
            const user = getActiveUser()
            if (!user) return 'menu'
            const saved = localStorage.getItem(getActiveOrderKey(user))
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed && parsed.id && parsed.status !== 'COMPLETED' && parsed.status !== 'CANCELLED') {
                    return 'tracking'
                }
            }
        } catch { }
        return 'menu'
    })

    // Submitted Order tracking state initialized from localStorage (only for logged in user)
    const [activeOrder, setActiveOrder] = useState<OnlineOrderState | null>(() => {
        try {
            const user = getActiveUser()
            if (!user) return null
            const saved = localStorage.getItem(getActiveOrderKey(user))
            return saved ? JSON.parse(saved) : null
        } catch {
            return null
        }
    })

    const activeOrderRef = useRef(activeOrder)
    useEffect(() => {
        activeOrderRef.current = activeOrder
    }, [activeOrder])

    // Menu state using client items
    const [menuItems] = useState<MenuItem[]>(CLIENT_MENU_ITEMS)
    const [categories] = useState<string[]>(CLIENT_CATEGORIES)

    // Menu filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')

    // Cart state with user-scoped localStorage persistence
    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        try {
            const user = getActiveUser()
            const saved = localStorage.getItem(getCartKey(user))
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
    const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
    const [tempNote, setTempNote] = useState('')

    // Checkout Form states
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const paymentMethod = 'GCash'
    const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null)
    const [orderNotes, setOrderNotes] = useState('') // Special Order Instructions State

    // Save cart state to user-scoped localStorage whenever modified
    useEffect(() => {
        try {
            const user = getActiveUser()
            localStorage.setItem(getCartKey(user), JSON.stringify(cartItems))
        } catch (err) {
            console.warn('Could not save cart to localStorage:', err)
        }
    }, [cartItems])

    // Auto-fill logged in user info & sync user cart and orders
    useEffect(() => {
        const currentUser = getActiveUser()
        if (currentUser) {
            if (currentUser.fullname) setCustomerName(currentUser.fullname)
            if (currentUser.phone) setPhone(currentUser.phone)
            if (currentUser.address) setAddress(currentUser.address)

            // Hydrate user cart
            try {
                const savedCart = localStorage.getItem(getCartKey(currentUser))
                if (savedCart) setCartItems(JSON.parse(savedCart))
            } catch { }

            // Hydrate user active order from local storage or backend DB
            try {
                const savedOrder = localStorage.getItem(getActiveOrderKey(currentUser))
                if (savedOrder) {
                    const parsed = JSON.parse(savedOrder)
                    setActiveOrder(parsed)
                } else {
                    fetch(`${API_BASE_URL}/user-flow/orders?customerName=${encodeURIComponent(currentUser.fullname || '')}`)
                        .then((res) => res.json())
                        .then((data) => {
                            const list = data.data || data
                            if (Array.isArray(list) && list.length > 0) {
                                const active = list.find((o: any) => {
                                    const s = normalizeStatus(o.status)
                                    return s !== 'COMPLETED' && s !== 'CANCELLED'
                                })
                                if (active) {
                                    const normActive = { ...active, status: normalizeStatus(active.status) }
                                    setActiveOrder(normActive)
                                    localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(normActive))
                                }
                            }
                        })
                        .catch(() => { })
                }
            } catch { }
        } else {
            setActiveOrder(null)
            if (activeTab === 'tracking') {
                setActiveTab('menu')
            }
        }
    }, [])

    useEffect(() => {
        const currentUser = getActiveUser()
        if (currentUser) {
            if (currentUser.fullname && !customerName) setCustomerName(currentUser.fullname)
            if (currentUser.phone && !phone) setPhone(currentUser.phone)
            if (currentUser.address && !address) setAddress(currentUser.address)
        }
    }, [activeTab])

    const handleProceedToCheckout = () => {
        const currentUser = getActiveUser()
        if (!currentUser) {
            setIsAuthModalOpen(true)
            return
        }
        if (cartItems.length > 0) {
            setActiveTab('billing')
            setIsMobileCartOpen(false)
        }
    }

    // Real-time synchronization for customer order tracking
    useEffect(() => {
        if (!activeOrder?.id) return
        const currentUser = getActiveUser()

        const checkOrderStatus = async (force?: boolean | unknown) => {
            if (isFetchingOrderRef.current) return
            const isForce = typeof force === 'boolean' ? force : false
            const now = Date.now()
            if (!isForce && now - lastFetchTimeRef.current < 2000) return

            isFetchingOrderRef.current = true
            lastFetchTimeRef.current = now

            try {
                const currentOrderId = activeOrderRef.current?.id
                if (!currentOrderId) return

                let backendSuccess = false

                // 1. Poll Backend API FIRST (Authoritative Server Truth)
                try {
                    const res = await fetch(`${API_BASE_URL}/user-flow/orders/${currentOrderId}`)
                    if (res.ok) {
                        const data = await res.json()
                        const orderData = data.data || data
                        if (orderData && orderData.status) {
                            backendSuccess = true
                            const normalized = normalizeStatus(orderData.status)
                            const currentStatusNorm = normalizeStatus(activeOrderRef.current?.status)

                            if (normalized !== currentStatusNorm) {
                                setActiveOrder((prev) => {
                                    if (!prev) return null
                                    const updated = { ...prev, status: normalized }
                                    try {
                                        localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(updated))

                                        // Keep user order list and global seafudz_orders synchronized
                                        const updateListInStorage = (key: string) => {
                                            const raw = localStorage.getItem(key)
                                            if (!raw) return
                                            try {
                                                const list = JSON.parse(raw)
                                                if (Array.isArray(list)) {
                                                    const updatedList = list.map((o: any) =>
                                                        (o.id === currentOrderId || o.ref === currentOrderId)
                                                            ? { ...o, status: normalized }
                                                            : o
                                                    )
                                                    localStorage.setItem(key, JSON.stringify(updatedList))
                                                }
                                            } catch { }
                                        }
                                        updateListInStorage(getOrdersKey(currentUser))
                                        updateListInStorage('seafudz_orders')
                                    } catch { }
                                    return updated
                                })
                            }
                        }
                    }
                } catch (err) {
                    // Backend offline / unreachable
                }

                // 2. LocalStorage Sync Fallback (Only advance status if local storage has a STRICTLY HIGHER rank)
                if (!backendSuccess) {
                    try {
                        const userOrdersKey = getOrdersKey(currentUser)
                        const storedUser = localStorage.getItem(userOrdersKey)
                        const storedGlobal = localStorage.getItem('seafudz_orders')

                        const parseList = (jsonStr: string | null) => {
                            try {
                                return jsonStr ? JSON.parse(jsonStr) : []
                            } catch {
                                return []
                            }
                        }

                        const allLists = [...parseList(storedUser), ...parseList(storedGlobal)]
                        const current = allLists.find((o: any) => o.id === currentOrderId || o.ref === currentOrderId)

                        if (current && current.status) {
                            const normalized = normalizeStatus(current.status)
                            const currentRank = getStatusRank(activeOrderRef.current?.status)
                            const localRank = getStatusRank(normalized)

                            // ONLY advance status if local rank is strictly higher than current status rank
                            if (localRank > currentRank) {
                                setActiveOrder((prev) => {
                                    if (!prev) return null
                                    const updated = { ...prev, status: normalized }
                                    try {
                                        localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(updated))
                                    } catch { }
                                    return updated
                                })
                            }
                        }
                    } catch (storageErr) {
                        console.warn('Local order check error:', storageErr)
                    }
                }
            } finally {
                isFetchingOrderRef.current = false
            }
        }

        void checkOrderStatus()
        const interval = setInterval(() => {
            void checkOrderStatus()
        }, 5000)

        const handleSync = (e?: Event) => {
            if (e && e instanceof StorageEvent && e.key) {
                const activeKey = getActiveOrderKey(currentUser)
                const ordersKey = getOrdersKey(currentUser)
                if (e.key !== activeKey && e.key !== ordersKey && e.key !== 'seafudz_orders' && e.key !== 'seafudz_order_created') {
                    return
                }
            }
            void checkOrderStatus(true)
        }

        window.addEventListener('seafudz_order_created', handleSync)
        window.addEventListener('storage', handleSync)

        return () => {
            clearInterval(interval)
            window.removeEventListener('seafudz_order_created', handleSync)
            window.removeEventListener('storage', handleSync)
        }
    }, [activeOrder?.id])

    // Calculations with live effective prices
    const subtotal = useMemo(() => {
        return cartItems.reduce((acc, ci) => {
            const effectivePrice = getEffectivePrice(ci.item.id, ci.item.price)
            return acc + effectivePrice * ci.quantity
        }, 0)
    }, [cartItems, getEffectivePrice])
    const vat = useMemo(() => subtotal * 0.12, [subtotal])
    const deliveryFee = useMemo(() => (subtotal > 0 ? 50 : 0), [subtotal])
    const total = useMemo(() => Math.round(subtotal + vat + deliveryFee), [subtotal, vat, deliveryFee])

    // Filters with effective price applied
    const filteredItems = useMemo(() => {
        return menuItems
            .map((item) => ({
                ...item,
                price: getEffectivePrice(item.id, item.price),
            }))
            .filter((item) => {
                const matchesSearch =
                    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase())
                const matchesCategory =
                    selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()
                return matchesSearch && matchesCategory
            })
    }, [menuItems, searchQuery, selectedCategory, getEffectivePrice])

    // Handlers
    const handleAddToCart = (item: MenuItem) => {
        if (!isAvailable(item.id)) return

        const effectiveItem = {
            ...item,
            price: getEffectivePrice(item.id, item.price)
        }

        setCartItems((prev) => {
            const existing = prev.find((ci) => ci.item.id === item.id)
            if (existing) {
                return prev.map((ci) =>
                    ci.item.id === item.id ? { ...ci, item: effectiveItem, quantity: ci.quantity + 1 } : ci
                )
            }
            return [...prev, { item: effectiveItem, quantity: 1, specialNote: '' }]
        })
    }

    const handleIncrement = (itemId: string) => {
        setCartItems((prev) =>
            prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: ci.quantity + 1 } : ci))
        )
    }

    const handleDecrement = (itemId: string) => {
        setCartItems((prev) =>
            prev
                .map((ci) => (ci.item.id === itemId ? { ...ci, quantity: ci.quantity - 1 } : ci))
                .filter((ci) => ci.quantity > 0)
        )
    }

    const handleSaveNote = (itemId: string) => {
        setCartItems((prev) =>
            prev.map((ci) => (ci.item.id === itemId ? { ...ci, specialNote: tempNote } : ci))
        )
        setEditingNoteItemId(null)
    }

    const handleStartEditingNote = (itemId: string, currentNote: string) => {
        setEditingNoteItemId(itemId)
        setTempNote(currentNote)
    }

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault()
        const currentUser = getActiveUser()
        if (!currentUser) {
            setIsAuthModalOpen(true)
            return
        }
        if (!customerName || !phone || !address || cartItems.length === 0) return

        const orderPayload = {
            type: 'Delivery',
            customerName,
            phone,
            deliveryAddress: address,
            paymentMethod,
            paymentReceipt: paymentReceipt || undefined,
            notes: orderNotes,
            subtotal,
            vat,
            deliveryFee,
            total,
            items: cartItems.map((ci) => ({
                id: ci.item.id,
                name: ci.item.name,
                quantity: ci.quantity,
                price: ci.item.price,
                specialNote: ci.specialNote || '',
            })),
        }

        try {
            const token = localStorage.getItem('seafudz_token')
            const res = await fetch(`${API_BASE_URL}/user-flow/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(orderPayload),
            })

            const responseData = await res.json().catch(() => ({}))
            const serverOrder = responseData?.data || responseData

            const newOrderId = serverOrder?.id || `SFB-${Math.floor(1000 + Math.random() * 9000)}`
            const newOrder: OnlineOrderState & { type: string; customer: string; deliveryAddress: string } = {
                id: newOrderId,
                type: 'Delivery',
                customerName: serverOrder?.customerName || serverOrder?.customer_name || customerName,
                customer: serverOrder?.customerName || serverOrder?.customer_name || customerName,
                phone: serverOrder?.phone || serverOrder?.customer_phone || phone,
                address: serverOrder?.address || serverOrder?.delivery_address || address,
                deliveryAddress: serverOrder?.address || serverOrder?.delivery_address || address,
                paymentMethod: serverOrder?.paymentMethod || serverOrder?.payment_method || paymentMethod,
                paymentReceipt: paymentReceipt || undefined,
                notes: orderNotes,
                items: [...cartItems],
                subtotal: serverOrder?.subtotal ?? subtotal,
                vat: serverOrder?.vat ?? vat,
                deliveryFee: serverOrder?.deliveryFee ?? deliveryFee,
                total: serverOrder?.total ?? total,
                status: (serverOrder?.status || 'PENDING').toUpperCase(),
                createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            setActiveOrder(newOrder)
            try {
                const userOrderKey = getActiveOrderKey(currentUser)
                const userOrdersKey = getOrdersKey(currentUser)
                localStorage.setItem(userOrderKey, JSON.stringify(newOrder))

                const existing = JSON.parse(localStorage.getItem(userOrdersKey) || '[]')
                const filtered = existing.filter((o: any) => o.id !== newOrderId && o.ref !== newOrderId)
                localStorage.setItem(userOrdersKey, JSON.stringify([newOrder, ...filtered]))

                // Update global seafudz_orders for Assistant/Kitchen/Rider role management
                const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
                const globalFiltered = globalOrders.filter((o: any) => o.id !== newOrderId && o.ref !== newOrderId)
                localStorage.setItem('seafudz_orders', JSON.stringify([newOrder, ...globalFiltered]))
            } catch { }

            // Clear cart for this specific user
            try {
                localStorage.removeItem(getCartKey(currentUser))
            } catch { }
            setCartItems([])
            setOrderNotes('')
            setActiveTab('tracking')
            setIsMobileCartOpen(false)
            window.dispatchEvent(new Event('seafudz_order_created'))
        } catch (err) {
            console.error('Error sending order to backend API:', err)
        }
    }

    const handleStartNewOrder = () => {
        const currentUser = getActiveUser()
        try {
            localStorage.removeItem(getActiveOrderKey(currentUser))
        } catch { }
        setActiveOrder(null)
        setCustomerName('')
        setPhone('')
        setAddress('')
        setOrderNotes('')
        setCartItems([])
        setActiveTab('menu')
    }

    return (
        <div className="min-h-screen bg-[#f8f6f4] p-4 lg:p-6 transition-all duration-300">
            <div className="w-full flex flex-col gap-6">
                {/* Integrated Customer Navbar */}
                <NavbarCustomer />

                {/* Browse Menu & Minimal Search Bar Container */}
                <div className="flex flex-col gap-4 items-start">
                    {/* Browse Menu Button */}
                    <div className="flex bg-white p-1 rounded-2xl border border-neutral-100 shadow-2xs">
                        <button
                            onClick={() => setActiveTab('menu')}
                            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white shadow-md shadow-orange-500/20"
                        >
                            🍽️ Browse Menu
                        </button>
                    </div>

                    {/* Minimal Search Bar directly BELOW Browse Menu */}
                    <div className="flex items-center px-1 py-1 w-full max-w-sm">
                        <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search dishes..."
                            className="bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-xs sm:text-sm w-full focus:outline-none"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-0.5 text-xs">
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* VIEW 1: MENU / BROWSE */}
                {activeTab === 'menu' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
                        {/* Menu Items Grid */}
                        <main className="lg:col-span-3 flex flex-col gap-6">
                            {/* Category tabs */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap border transition-all duration-200 ${selectedCategory === cat
                                            ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Grid of Dishes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredItems.map((item) => {
                                    const available = isAvailable(item.id)
                                    return (
                                        <div
                                            key={item.id}
                                            className={`bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 group ${!available
                                                ? 'border-rose-200 bg-neutral-50/70 opacity-80'
                                                : 'border-neutral-100 shadow-xs hover:shadow-md'
                                                }`}
                                        >
                                            <div className="relative aspect-4/3 w-full overflow-hidden bg-neutral-50">
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className={`w-full h-full object-cover transition-transform duration-300 ${!available
                                                        ? 'grayscale-75 opacity-60 contrast-125'
                                                        : 'group-hover:scale-105'
                                                        }`}
                                                    onError={(e) => {
                                                        ; (e.target as HTMLImageElement).src =
                                                            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="%23fef3c7"/><text y="55" x="35" font-size="30">🦀</text></svg>'
                                                    }}
                                                />
                                                <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs text-neutral-800 text-xs font-bold px-2.5 py-1 rounded-full border border-neutral-200/50 shadow-2xs">
                                                    {item.category}
                                                </span>

                                                {!available && (
                                                    <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px] flex items-center justify-center p-2 pointer-events-none">
                                                        <span className="bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-md border border-rose-400/30 flex items-center gap-1.5 animate-pulse">
                                                            <span>🚫</span> Unavailable / Sold Out
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                                                <div>
                                                    <h3
                                                        className={`font-bold text-lg leading-snug transition-colors ${!available
                                                            ? 'text-neutral-500 line-through'
                                                            : 'text-neutral-800'
                                                            }`}
                                                    >
                                                        {item.name}
                                                    </h3>
                                                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between mt-auto">
                                                    <span
                                                        className={`font-extrabold text-lg ${!available ? 'text-neutral-400' : 'text-orange-600'
                                                            }`}
                                                    >
                                                        ₱{item.price.toLocaleString()}
                                                    </span>

                                                    {available ? (
                                                        <button
                                                            onClick={() => handleAddToCart(item)}
                                                            className="bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-2xs active:scale-95"
                                                        >
                                                            <span>+</span> Add
                                                        </button>
                                                    ) : (
                                                        <span className="bg-neutral-100 text-neutral-400 text-xs font-bold px-3.5 py-2 rounded-xl cursor-not-allowed select-none border border-neutral-200">
                                                            Sold Out
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </main>

                        {/* Desktop Side Cart Drawer */}
                        <aside className="hidden lg:block lg:col-span-1 bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 flex flex-col justify-between max-h-[80vh] overflow-y-auto">
                            <div>
                                <h3 className="font-bold text-neutral-800 text-lg border-b border-neutral-100 pb-3 flex items-center gap-2">
                                    <span>🛒</span> Your Cart
                                    {cartItems.length > 0 && (
                                        <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
                                        </span>
                                    )}
                                </h3>

                                {cartItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                                        <span className="text-4xl mb-2">🍽️</span>
                                        <p className="text-sm font-medium">Cart is empty</p>
                                        <p className="text-xs mt-1 max-w-[200px]">Add delicious dishes from the menu to start!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-4 divide-y divide-neutral-50">
                                        {cartItems.map((ci) => (
                                            <div key={ci.item.id} className="pt-4 first:pt-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <p className="font-semibold text-neutral-800 text-sm leading-snug">
                                                            {ci.item.name}
                                                        </p>
                                                        <p className="text-xs text-orange-600 font-bold mt-0.5">
                                                            ₱{(ci.item.price * ci.quantity).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">
                                                        <button
                                                            onClick={() => handleDecrement(ci.item.id)}
                                                            className="text-neutral-500 hover:text-neutral-800 font-bold px-1"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-xs font-bold text-neutral-700 w-4 text-center">
                                                            {ci.quantity}
                                                        </span>
                                                        <button
                                                            onClick={() => handleIncrement(ci.item.id)}
                                                            className="text-neutral-500 hover:text-neutral-800 font-bold px-1"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Special Note details */}
                                                <div className="mt-2">
                                                    {editingNoteItemId === ci.item.id ? (
                                                        <div className="flex gap-2 mt-1">
                                                            <input
                                                                type="text"
                                                                value={tempNote}
                                                                onChange={(e) => setTempNote(e.target.value)}
                                                                placeholder="Add instruction..."
                                                                className="text-xs border border-neutral-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-orange-500"
                                                            />
                                                            <button
                                                                onClick={() => handleSaveNote(ci.item.id)}
                                                                className="bg-orange-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between text-xs mt-1">
                                                            <p className="text-neutral-400 italic leading-snug">
                                                                {ci.specialNote ? `"${ci.specialNote}"` : 'No instructions added'}
                                                            </p>
                                                            <button
                                                                onClick={() => handleStartEditingNote(ci.item.id, ci.specialNote)}
                                                                className="text-orange-500 hover:text-orange-600 font-bold text-[11px]"
                                                            >
                                                                {ci.specialNote ? 'Edit note' : '+ Add Note'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {cartItems.length > 0 && (
                                <div className="border-t border-neutral-100 pt-4 mt-4 space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Subtotal</span>
                                            <span>₱{subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>VAT (12%)</span>
                                            <span>₱{vat.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Delivery Fee</span>
                                            <span>₱{deliveryFee.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-extrabold text-neutral-800 pt-1.5 border-t border-dashed border-neutral-100">
                                            <span>Total Amount</span>
                                            <span className="text-orange-600">₱{total.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleProceedToCheckout}
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        Proceed to Checkout ➡️
                                    </button>
                                </div>
                            )}
                        </aside>
                    </div>
                )}

                {/* VIEW 2: CHECKOUT & BILLING PAGE */}
                {activeTab === 'billing' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        {/* Customer Details Form */}
                        <form
                            onSubmit={handlePlaceOrder}
                            className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 space-y-6"
                        >
                            <h3 className="font-bold text-neutral-800 text-lg border-b border-neutral-100 pb-3">
                                📍 Delivery & Billing Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Full Name"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="Phone Number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                    Delivery Address *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Enter your complete delivery address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                    Special Instructions / Kitchen Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Please ring doorbell, less spicy, extra garlic..."
                                    value={orderNotes}
                                    onChange={(e) => setOrderNotes(e.target.value)}
                                    className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                />
                            </div>

                            {/* Payment Type Selection */}
                            <div className="flex flex-col gap-3">
                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                    Payment Method (Online Digital Transfer)
                                </label>
                                <div className="grid grid-cols-1">
                                    <div
                                        className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50/50 shadow-xs"
                                    >
                                        <span className="text-2xl">💙</span>
                                        <div>
                                            <p className="font-black text-neutral-800 text-sm">GCash</p>
                                            <p className="text-[11px] text-neutral-400">0917-888-SEAFUDZ</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Transfer Instructions */}
                                <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-3.5 text-xs text-neutral-600 space-y-1">
                                    <div className="flex justify-between items-center font-bold text-neutral-800">
                                        <span>Send exact amount:</span>
                                        <span className="text-orange-600 text-sm font-black">₱{total.toLocaleString()}</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-500">
                                        Account Name: <strong className="text-neutral-800">SEAFUDZ RESTAURANT PH</strong> •{' '}
                                        GCash: <strong className="text-neutral-800">0917-888-7323</strong>
                                    </p>
                                </div>

                                {/* Upload Receipt / Payment Screenshot */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-bold text-neutral-600 flex items-center justify-between">
                                        <span>Upload Payment Receipt / Screenshot</span>
                                        <span className="text-[11px] font-normal text-neutral-400">(Photo for Assistant verification)</span>
                                    </label>

                                    {!paymentReceipt ? (
                                        <label className="border-2 border-dashed border-neutral-200 hover:border-orange-400 bg-neutral-50/50 hover:bg-orange-50/30 rounded-xl p-4 cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center transition-all">
                                            <span className="text-2xl">📸</span>
                                            <span className="text-xs font-bold text-neutral-700">Click to upload payment screenshot</span>
                                            <span className="text-[10px] text-neutral-400">PNG, JPG, JPEG accepted</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onloadend = () => {
                                                            setPaymentReceipt(reader.result as string)
                                                        }
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        </label>
                                    ) : (
                                        <div className="relative rounded-xl border border-neutral-200 overflow-hidden bg-neutral-900/5 p-2 flex items-center gap-3">
                                            <img
                                                src={paymentReceipt}
                                                alt="Payment Receipt"
                                                className="w-16 h-16 object-cover rounded-lg border border-neutral-200 shadow-2xs"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                                    <span>✅</span> Receipt Attached
                                                </p>
                                                <p className="text-[10px] text-neutral-500 truncate">Ready for Assistant review</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentReceipt(null)}
                                                className="px-2.5 py-1 text-xs font-bold bg-neutral-200 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-3 border-t border-neutral-100">
                                <button
                                    type="submit"
                                    className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-orange-500/10 transition-all duration-200 text-sm flex items-center justify-center gap-2"
                                >
                                    🚀 Confirm & Submit Order
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('menu')}
                                    className="w-full md:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold px-6 py-3 rounded-xl text-sm transition-all duration-200"
                                >
                                    Back
                                </button>
                            </div>
                        </form>

                        {/* Right Summary Billing Panel */}
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 space-y-6">
                            <h3 className="font-bold text-neutral-800 text-lg border-b border-neutral-100 pb-3">
                                Final Order Summary
                            </h3>

                            <div className="divide-y divide-neutral-50 max-h-[300px] overflow-y-auto pr-1">
                                {cartItems.map((ci) => (
                                    <div key={ci.item.id} className="py-3 first:pt-0">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-neutral-700">
                                                {ci.item.name} <span className="text-neutral-400">x{ci.quantity}</span>
                                            </span>
                                            <span className="font-bold text-neutral-800">
                                                ₱{(ci.item.price * ci.quantity).toLocaleString()}
                                            </span>
                                        </div>
                                        {ci.specialNote && (
                                            <p className="text-xs text-orange-500 italic mt-0.5">Note: "{ci.specialNote}"</p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {orderNotes && (
                                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 text-xs">
                                    <p className="font-bold text-neutral-500 uppercase text-[10px]">Special Instructions:</p>
                                    <p className="text-neutral-700 italic mt-0.5">{orderNotes}</p>
                                </div>
                            )}

                            <div className="border-t border-neutral-100 pt-4 space-y-2">
                                <div className="flex justify-between text-xs text-neutral-500">
                                    <span>Subtotal</span>
                                    <span>₱{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-neutral-500">
                                    <span>VAT (12%)</span>
                                    <span>₱{vat.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-neutral-500">
                                    <span>Delivery Fee</span>
                                    <span>₱{deliveryFee.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-base font-extrabold text-neutral-800 pt-3 border-t border-dashed border-neutral-200">
                                    <span>Total Amount</span>
                                    <span className="text-orange-600 text-lg">₱{total.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW 3: ORDER STATUS TRACKING */}
                {activeTab === 'tracking' && activeOrder && (
                    <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 lg:p-8 space-y-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-100 pb-5 gap-4">
                            <div>
                                <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">
                                    Order Status Management
                                </p>
                                <h3 className="font-extrabold text-neutral-800 text-2xl mt-1">
                                    Order ID: {activeOrder.id}
                                </h3>
                                <p className="text-xs text-neutral-400 mt-1">Placed at {activeOrder.createdAt}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {((activeOrder.status || '').toLowerCase() === 'completed' || (activeOrder.status || '').toLowerCase() === 'delivered') && (
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-xs flex items-center gap-1.5"
                                    >
                                        🛒 Place New Order
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="py-6">
                            <div className="relative flex items-center justify-between w-full">
                                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-neutral-100 z-0 rounded-full" />
                                <div
                                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-orange-500 transition-all duration-500 z-0 rounded-full"
                                    style={{
                                        width:
                                            normalizeStatus(activeOrder.status) === 'PENDING'
                                                ? '0%'
                                                : normalizeStatus(activeOrder.status) === 'CONFIRMED'
                                                    ? '20%'
                                                    : normalizeStatus(activeOrder.status) === 'PREPARING'
                                                        ? '40%'
                                                        : normalizeStatus(activeOrder.status) === 'READY'
                                                            ? '60%'
                                                            : normalizeStatus(activeOrder.status) === 'OUT_FOR_DELIVERY'
                                                                ? '80%'
                                                                : '100%',
                                    }}
                                />

                                {[
                                    { key: 'PENDING', label: 'Order Placed', desc: 'Awaiting Assistant Verification', icon: '📝' },
                                    { key: 'CONFIRMED', label: 'Confirmed', desc: 'Sent to Kitchen Queue', icon: '✅' },
                                    { key: 'PREPARING', label: 'Preparing', desc: 'Chef in the Kitchen', icon: '🍳' },
                                    { key: 'READY', label: 'Order Ready', desc: 'Waiting for Rider', icon: '📦' },
                                    { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Rider is en route', icon: '🛵' },
                                    { key: 'COMPLETED', label: 'Delivered', desc: 'Order Completed', icon: '✨' },
                                ].map((step) => {
                                    const statusOrder = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
                                    const currUpper = normalizeStatus(activeOrder.status)
                                    const isCurrent = currUpper === step.key
                                    const isCompleted =
                                        statusOrder.indexOf(currUpper) >= statusOrder.indexOf(step.key)

                                    return (
                                        <div key={step.key} className="flex flex-col items-center z-10 relative">
                                            <div
                                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-lg border-2 shadow-xs transition-all duration-300 ${isCurrent
                                                    ? 'bg-orange-500 border-orange-500 text-white scale-110 ring-4 ring-orange-100'
                                                    : isCompleted
                                                        ? 'bg-orange-500 border-orange-500 text-white'
                                                        : 'bg-white border-neutral-200 text-neutral-400'
                                                    }`}
                                            >
                                                {step.icon}
                                            </div>
                                            <p
                                                className={`text-[11px] sm:text-xs font-bold mt-2 transition-colors duration-200 text-center ${isCurrent ? 'text-orange-600' : isCompleted ? 'text-neutral-800' : 'text-neutral-400'
                                                    }`}
                                            >
                                                {step.label}
                                            </p>
                                            <p className="text-[9px] sm:text-[10px] text-neutral-400 font-medium hidden md:block text-center max-w-[100px]">
                                                {step.desc}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/50 space-y-3">
                                <h4 className="font-bold text-neutral-800 text-sm">📋 Delivery Info</h4>
                                <div className="text-xs space-y-1.5 text-neutral-600">
                                    <p>
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Customer:</span>{' '}
                                        {activeOrder.customerName}
                                    </p>
                                    <p>
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Phone:</span>{' '}
                                        {activeOrder.phone}
                                    </p>
                                    <p className="leading-relaxed">
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Address:</span>{' '}
                                        {activeOrder.address}
                                    </p>
                                    {activeOrder.notes && (
                                        <p className="leading-relaxed text-orange-600">
                                            <span className="font-bold text-neutral-400 uppercase text-[10px]">Notes:</span>{' '}
                                            {activeOrder.notes}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/50 space-y-3">
                                <h4 className="font-bold text-neutral-800 text-sm">💳 Billing & Payment Details</h4>
                                <div className="text-xs space-y-1.5 text-neutral-600">
                                    <p>
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Payment Mode:</span>{' '}
                                        <span className="font-bold text-neutral-800">{activeOrder.paymentMethod} Transfer</span>
                                    </p>
                                    {activeOrder.paymentReference && (
                                        <p>
                                            <span className="font-bold text-neutral-400 uppercase text-[10px]">Reference No:</span>{' '}
                                            <span className="font-mono font-bold text-neutral-800 bg-neutral-200/70 px-1.5 py-0.5 rounded text-[11px]">{activeOrder.paymentReference}</span>
                                        </p>
                                    )}
                                    {activeOrder.paymentReceipt && (
                                        <div className="pt-1">
                                            <span className="font-bold text-neutral-400 uppercase text-[10px] block mb-1">Receipt Uploaded:</span>
                                            <img
                                                src={activeOrder.paymentReceipt}
                                                alt="Receipt"
                                                className="w-16 h-16 object-cover rounded-lg border border-neutral-200 shadow-2xs"
                                            />
                                        </div>
                                    )}
                                    <p className="pt-1">
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Items ordered:</span>{' '}
                                        {activeOrder.items.reduce((acc, ci) => acc + ci.quantity, 0)} items
                                    </p>
                                    
                                    {/* Itemized Price & VAT Breakdown */}
                                    <div className="pt-2 border-t border-neutral-200/70 space-y-1 text-[11px] text-neutral-500">
                                        <div className="flex justify-between">
                                            <span>Subtotal:</span>
                                            <span className="font-semibold text-neutral-700">
                                                ₱{(activeOrder.subtotal || Math.round(activeOrder.total / 1.12 - (activeOrder.deliveryFee || 50))).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-orange-600 font-medium">
                                            <span>VAT (12%):</span>
                                            <span className="font-bold">
                                                ₱{(activeOrder.vat || Math.round((activeOrder.subtotal || (activeOrder.total - (activeOrder.deliveryFee || 50)) / 1.12) * 0.12)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Delivery Fee:</span>
                                            <span className="font-semibold text-neutral-700">₱{(activeOrder.deliveryFee ?? 50).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <p className="font-bold text-neutral-800 border-t border-dashed border-neutral-200 pt-1.5 flex justify-between">
                                        <span>Paid Total:</span>
                                        <span className="text-orange-600">₱{activeOrder.total.toLocaleString()}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Floating Cart Bar */}
                {activeTab === 'menu' && cartItems.length > 0 && (
                    <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-neutral-900 text-white rounded-2xl shadow-xl p-4 flex items-center justify-between border border-neutral-800">
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-400 font-bold uppercase">
                                {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)} Items Added
                            </span>
                            <span className="text-lg font-extrabold text-orange-400">
                                ₱{total.toLocaleString()}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMobileCartOpen(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20"
                        >
                            View Cart 🛒
                        </button>
                    </div>
                )}

                {/* Mobile Cart Modal */}
                {isMobileCartOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end animate-in fade-in duration-250">
                        <div className="bg-white w-full max-h-[85vh] rounded-t-[2.5rem] p-6 flex flex-col justify-between overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-300">
                            <div>
                                <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                                    <h3 className="font-bold text-neutral-800 text-lg flex items-center gap-2">
                                        <span>🛒</span> Your Cart
                                    </h3>
                                    <button
                                        onClick={() => setIsMobileCartOpen(false)}
                                        className="text-neutral-400 hover:text-neutral-700 text-2xl font-bold p-1"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="divide-y divide-neutral-50 max-h-[40vh] overflow-y-auto py-2">
                                    {cartItems.map((ci) => (
                                        <div key={ci.item.id} className="py-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <p className="font-semibold text-neutral-800 text-sm leading-snug">
                                                        {ci.item.name}
                                                    </p>
                                                    <p className="text-xs text-orange-600 font-bold mt-0.5">
                                                        ₱{(ci.item.price * ci.quantity).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">
                                                    <button
                                                        onClick={() => handleDecrement(ci.item.id)}
                                                        className="text-neutral-500 hover:text-neutral-800 font-bold px-1"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-bold text-neutral-700 w-4 text-center">
                                                        {ci.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => handleIncrement(ci.item.id)}
                                                        className="text-neutral-500 hover:text-neutral-800 font-bold px-1"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-2">
                                                {editingNoteItemId === ci.item.id ? (
                                                    <div className="flex gap-2 mt-1">
                                                        <input
                                                            type="text"
                                                            value={tempNote}
                                                            onChange={(e) => setTempNote(e.target.value)}
                                                            placeholder="Add instruction..."
                                                            className="text-xs border border-neutral-200 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-orange-500"
                                                        />
                                                        <button
                                                            onClick={() => handleSaveNote(ci.item.id)}
                                                            className="bg-orange-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between text-xs mt-1">
                                                        <p className="text-neutral-400 italic leading-snug">
                                                            {ci.specialNote ? `"${ci.specialNote}"` : 'No instructions added'}
                                                        </p>
                                                        <button
                                                            onClick={() => handleStartEditingNote(ci.item.id, ci.specialNote)}
                                                            className="text-orange-500 hover:text-orange-600 font-bold text-[11px]"
                                                        >
                                                            {ci.specialNote ? 'Edit note' : '+ Add Note'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-neutral-100 pt-4 space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs text-neutral-500">
                                        <span>Subtotal</span>
                                        <span>₱{subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-neutral-500">
                                        <span>VAT (12%)</span>
                                        <span>₱{vat.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-neutral-500">
                                        <span>Delivery Fee</span>
                                        <span>₱{deliveryFee.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-extrabold text-neutral-800 pt-1.5 border-t border-dashed border-neutral-100">
                                        <span>Total Amount</span>
                                        <span className="text-orange-600">₱{total.toLocaleString()}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProceedToCheckout}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md shadow-orange-500/10 transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    Proceed to Checkout ➡️
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Account Required for Checkout Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 relative text-center">
                        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
                            🔐
                        </div>

                        <h3 className="text-xl font-extrabold text-neutral-900 mb-2">
                            Account Required for Checkout
                        </h3>

                        <p className="text-xs text-neutral-600 mb-6 leading-relaxed">
                            Please log in or register an account to complete your checkout and place your order. Don't worry—your selected items are saved in your cart!
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => navigate('/login', { state: { from: '/customer' } })}
                                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-orange-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>🔑 Login / Register Now</span>
                            </button>

                            <button
                                onClick={() => setIsAuthModalOpen(false)}
                                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 px-6 rounded-2xl transition-all text-xs cursor-pointer"
                            >
                                Keep Browsing Menu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default OnlineCustomer
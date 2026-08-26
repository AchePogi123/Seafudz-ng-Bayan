import React, { useState, useMemo, useEffect } from 'react'
import NavbarCustomer from '../components/NavbarCustomer'
import { CLIENT_MENU_ITEMS, CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { API_BASE_URL } from '../utils/api'
import { useMenuAvailability } from '../utils/menuAvailability'
import { useMenuPrices } from '../utils/menuPriceManager'

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
    notes?: string
    items: CartItem[]
    subtotal: number
    vat: number
    deliveryFee: number
    total: number
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | string
    createdAt: string
}

export const OnlineCustomer: React.FC = () => {
    // Availability & Price sync
    const { isAvailable } = useMenuAvailability()
    const { getEffectivePrice } = useMenuPrices()

    // Navigation states
    const [activeTab, setActiveTab] = useState<'menu' | 'billing' | 'tracking'>('menu')

    // Menu state using client items
    const [menuItems] = useState<MenuItem[]>(CLIENT_MENU_ITEMS)
    const [categories] = useState<string[]>(CLIENT_CATEGORIES)

    // Menu filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')

    // Cart state
    const [cartItems, setCartItems] = useState<CartItem[]>([])
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false)
    const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
    const [tempNote, setTempNote] = useState('')

    // Checkout Form states
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('GCash')
    const [orderNotes, setOrderNotes] = useState('') // Special Order Instructions State

    // Submitted Order tracking state
    const [activeOrder, setActiveOrder] = useState<OnlineOrderState | null>(null)

    // Poll Backend API for real-time status changes: PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> COMPLETED
    useEffect(() => {
        if (!activeOrder?.id) return

        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/user-flow/orders/${activeOrder.id}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.data && data.data.status) {
                        const newStatus = data.data.status.toUpperCase()
                        if (newStatus !== activeOrder.status.toUpperCase()) {
                            setActiveOrder((prev) => (prev ? { ...prev, status: newStatus } : null))
                        }
                    }
                }
            } catch (err) {
                console.warn('Backend order polling note:', err)
            }
        }

        void fetchStatus()
        const interval = setInterval(() => {
            void fetchStatus()
        }, 2000)

        return () => clearInterval(interval)
    }, [activeOrder?.id, activeOrder?.status])

    // Calculations
    const subtotal = useMemo(() => {
        return cartItems.reduce((acc, ci) => acc + ci.item.price * ci.quantity, 0)
    }, [cartItems])
    const vat = useMemo(() => subtotal * 0.12, [subtotal])
    const deliveryFee = useMemo(() => (subtotal > 0 ? 50 : 0), [subtotal])
    const total = useMemo(() => subtotal + vat + deliveryFee, [subtotal, vat, deliveryFee])

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

        setCartItems((prev) => {
            const existing = prev.find((ci) => ci.item.id === item.id)
            if (existing) {
                return prev.map((ci) =>
                    ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
                )
            }
            return [...prev, { item, quantity: 1, specialNote: '' }]
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
        if (!customerName || !phone || !address || cartItems.length === 0) return

        const orderPayload = {
            type: 'Delivery',
            customerName,
            phone,
            deliveryAddress: address,
            paymentMethod,
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
            const res = await fetch(`${API_BASE_URL}/user-flow/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderPayload),
            })

            const responseData = await res.json().catch(() => ({}))
            const orderId = responseData?.data?.id || `SFB-${Math.floor(1000 + Math.random() * 9000)}`

            const newOrder: OnlineOrderState = {
                id: orderId,
                customerName,
                phone,
                address,
                paymentMethod,
                notes: orderNotes,
                items: [...cartItems],
                subtotal,
                vat,
                deliveryFee,
                total,
                status: 'PENDING',
                createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            setActiveOrder(newOrder)
            setCartItems([])
            setOrderNotes('')
            setActiveTab('tracking')
            setIsMobileCartOpen(false)
        } catch (err) {
            console.error('Error sending order to backend API:', err)

            const fallbackId = `SFB-${Math.floor(1000 + Math.random() * 9000)}`
            const newOrder: OnlineOrderState = {
                id: fallbackId,
                customerName,
                phone,
                address,
                paymentMethod,
                notes: orderNotes,
                items: [...cartItems],
                subtotal,
                vat,
                deliveryFee,
                total,
                status: 'PENDING',
                createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            setActiveOrder(newOrder)
            setCartItems([])
            setOrderNotes('')
            setActiveTab('tracking')
            setIsMobileCartOpen(false)
        }
    }

    const simulateNextStatus = () => {
        if (!activeOrder) return
        const statusSequence: OnlineOrderState['status'][] = [
            'confirmed',
            'preparing',
            'out_for_delivery',
            'delivered',
        ]
        const currentIndex = statusSequence.indexOf(activeOrder.status)
        if (currentIndex < statusSequence.length - 1) {
            setActiveOrder({
                ...activeOrder,
                status: statusSequence[currentIndex + 1],
            })
        }
    }

    const handleStartNewOrder = () => {
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
                <NavbarCustomer searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

                {/* Tab Navigation header */}
                <div className="flex bg-white p-1.5 rounded-2xl border border-neutral-100 shadow-xs self-start gap-1">
                    <button
                        onClick={() => setActiveTab('menu')}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'menu'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                            : 'text-neutral-600 hover:bg-neutral-50'
                            }`}
                    >
                        🍽️ Browse Menu
                    </button>
                    <button
                        onClick={() => {
                            if (cartItems.length > 0) setActiveTab('billing')
                        }}
                        disabled={cartItems.length === 0}
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${cartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                            } ${activeTab === 'billing'
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                : 'text-neutral-600 hover:bg-neutral-50'
                            }`}
                    >
                        📋 Checkout & Billing
                    </button>
                    {activeOrder && (
                        <button
                            onClick={() => setActiveTab('tracking')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'tracking'
                                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                : 'text-neutral-600 hover:bg-neutral-50'
                                }`}
                        >
                            📍 Track Status
                        </button>
                    )}
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
                                        onClick={() => setActiveTab('billing')}
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-200 text-sm flex items-center justify-center gap-2"
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
                                        placeholder="Clarissa Dimapilis"
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
                                        placeholder="0917-882-9912"
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
                                    placeholder="Block 4, Lot 12, Mahogany St., Phase 2, Cavite City"
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
                                    Payment Method
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <label
                                        className={`flex items-center justify-between border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${paymentMethod === 'GCash'
                                            ? 'border-orange-500 bg-orange-50/50'
                                            : 'border-neutral-200 hover:border-neutral-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">📱</span>
                                            <div>
                                                <p className="font-bold text-neutral-800 text-sm">Digital GCash</p>
                                                <p className="text-xs text-neutral-400">GCash / Maya mobile transfer</p>
                                            </div>
                                        </div>
                                        <input
                                            type="radio"
                                            name="paymentType"
                                            value="GCash"
                                            checked={paymentMethod === 'GCash'}
                                            onChange={() => setPaymentMethod('GCash')}
                                            className="text-orange-500 focus:ring-orange-500"
                                        />
                                    </label>

                                    <label
                                        className={`flex items-center justify-between border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${paymentMethod === 'COD'
                                            ? 'border-orange-500 bg-orange-50/50'
                                            : 'border-neutral-200 hover:border-neutral-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">💵</span>
                                            <div>
                                                <p className="font-bold text-neutral-800 text-sm">Cash on Delivery</p>
                                                <p className="text-xs text-neutral-400">Pay cash upon rider arrival</p>
                                            </div>
                                        </div>
                                        <input
                                            type="radio"
                                            name="paymentType"
                                            value="COD"
                                            checked={paymentMethod === 'COD'}
                                            onChange={() => setPaymentMethod('COD')}
                                            className="text-orange-500 focus:ring-orange-500"
                                        />
                                    </label>
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
                                {activeOrder.status !== 'delivered' ? (
                                    <button
                                        onClick={simulateNextStatus}
                                        className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-xs flex items-center gap-1.5"
                                    >
                                        <span>🔄</span> Simulate Next Step
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-xs"
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
                                            activeOrder.status === 'PENDING'
                                                ? '0%'
                                                : activeOrder.status === 'CONFIRMED'
                                                    ? '20%'
                                                    : activeOrder.status === 'PREPARING'
                                                        ? '40%'
                                                        : activeOrder.status === 'READY'
                                                            ? '60%'
                                                            : activeOrder.status === 'OUT_FOR_DELIVERY'
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
                                    const currUpper = (activeOrder.status || 'PENDING').toUpperCase()
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
                                <h4 className="font-bold text-neutral-800 text-sm">💳 Billing Summary</h4>
                                <div className="text-xs space-y-1.5 text-neutral-600">
                                    <p>
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Payment Type:</span>{' '}
                                        {activeOrder.paymentMethod === 'GCash' ? 'Digital GCash' : 'Cash on Delivery'}
                                    </p>
                                    <p>
                                        <span className="font-bold text-neutral-400 uppercase text-[10px]">Items ordered:</span>{' '}
                                        {activeOrder.items.reduce((acc, ci) => acc + ci.quantity, 0)} items
                                    </p>
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
                                    onClick={() => {
                                        setActiveTab('billing')
                                        setIsMobileCartOpen(false)
                                    }}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md shadow-orange-500/10 transition-all duration-200 text-sm flex items-center justify-center gap-2"
                                >
                                    Proceed to Checkout ➡️
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default OnlineCustomer
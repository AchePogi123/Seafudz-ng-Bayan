import { HeroBoat } from '../components/HeroBoat'
import { DrawnWaves } from '../components/DrawnWaves'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { ProductImage } from '../components/ProductImage'
import { API_BASE_URL } from '../utils/api'
import { useMenuAvailability } from '../utils/menuAvailability'
import { useMenuPrices } from '../utils/menuPriceManager'
import { getActiveUser, saveActiveUser } from '../cryptography/cryptoSession'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { useProductImages } from '../utils/useProductImages'
import { reverseGeocodeCoordinates, fetchRoadDistances, type Coordinates } from '../utils/locationServices'
import {
    calculateDeliveryFee,
    geocodeAddress,
    SEAFUDZ_FLAGSHIP_STORE,
} from '../utils/riderDispatchAlgorithms'

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
    deliveryLatitude?: number | null
    deliveryLongitude?: number | null
    paymentMethod: string
    paymentReference?: string
    paymentReceipt?: string // Base64 or image data URL
    refundReceipt?: string
    refundReference?: string
    notes?: string
    items: CartItem[]
    subtotal: number
    vat: number
    deliveryFee: number
    total: number
    status: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'OUT_OF_STOCK' | 'CANCELLED' | string
    outOfStockItems?: any[]
    customerResolution?: 'REPLACE' | 'REFUND' | null
    customerResolutionStatus?: string
    customerReplacements?: any[]
    gcashAuthorized?: boolean
    gcash_authorized?: boolean
    financialStatus?: string
    grossConfirmedPaid?: number
    completedRefundAmount?: number
    netConfirmedPaid?: number
    excessAmount?: number
    additionalRequired?: number
    pendingRefundAmount?: number
    payments?: any[]
    refunds?: any[]
    additionalPaymentReceipt?: string
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

const getVerificationDismissalKey = (orderId: string | number) => `seafudz_gc_verification_dismissed_${String(orderId).trim()}`

const isVerificationModalDismissed = (orderId?: string | number) => {
    if (!orderId) return false
    try {
        const clean = String(orderId).trim()
        return localStorage.getItem(getVerificationDismissalKey(clean)) === 'true'
    } catch {
        return false
    }
}

const getOrderOutOfStockItems = (order: OnlineOrderState | null) => {
    if (!order) return []
    if (Array.isArray(order.outOfStockItems) && order.outOfStockItems.length > 0) return order.outOfStockItems

    return (order.items || []).map((entry: any, index) => {
        const item = entry.item || entry
        return {
            ...entry,
            id: entry.id ?? item.id ?? index,
            name: entry.name || entry.product_name_snapshot || item.name || 'Seafood Dish',
            price: entry.price ?? entry.unit_price ?? item.price ?? 0,
            quantity: entry.quantity || 1,
            item_status: entry.item_status || entry.itemStatus,
        }
    }).filter((item: any) => String(item.item_status || '').toUpperCase() === 'OUT_OF_STOCK')
}

export function normalizeStatus(rawStatus?: string): string {
    if (!rawStatus) return 'PENDING'
    const upper = String(rawStatus).toUpperCase().trim()
    if (['GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED', 'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'PENDING', 'PENDING_VERIFICATION', 'UNCONFIRMED', 'NEW', 'ORDER PLACED'].includes(upper)) return 'PENDING'
    if (['CONFIRMED', 'PENDING_PREPARATION', 'APPROVED', 'VERIFIED', 'SENT_TO_KITCHEN', 'IN_KITCHEN', 'IN KITCHEN', 'IN_PROCESS'].includes(upper)) return 'CONFIRMED'
    if (['PREPARING', 'COOKING', 'IN_PREPARATION'].includes(upper)) return 'PREPARING'
    if (['READY', 'READY_FOR_PICKUP', 'PREPARED', 'DONE'].includes(upper)) return 'READY'
    if (['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'ON_THE_WAY', 'IN_TRANSIT'].includes(upper)) return 'OUT_FOR_DELIVERY'
    if (['COMPLETED', 'DELIVERED', 'SERVED'].includes(upper)) return 'COMPLETED'
    if (upper === 'FLAGGED' || upper === 'CANCELLED' || upper === 'OUT_OF_STOCK') return upper
    return upper
}

export function getStatusRank(rawStatus?: string): number {
    const norm = normalizeStatus(rawStatus)
    switch (norm) {
        case 'GCASH_PENDING_APPROVAL': return 0
        case 'GCASH_AUTHORIZED': return 1
        case 'RECEIPT_SUBMITTED': return 2
        case 'PENDING':
        case 'PENDING_COD': return 0
        case 'RECEIPT_REJECTED': return 1
        case 'CONFIRMED': return 3
        case 'OUT_OF_STOCK': return 3.5
        case 'PREPARING': return 4
        case 'READY': return 5
        case 'OUT_FOR_DELIVERY': return 6
        case 'COMPLETED': return 7
        case 'CANCELLED':
        case 'FLAGGED': return -1
        default: return 0
    }
}


interface CartQuantityControlProps {
    quantity: number
    onIncrement: () => void
    onDecrement: () => void
    onSetQuantity: (quantity: number) => void
}

const CartQuantityControl: React.FC<CartQuantityControlProps> = ({
    quantity,
    onIncrement,
    onDecrement,
    onSetQuantity,
}) => {
    const [inputValue, setInputValue] = useState(String(quantity))

    useEffect(() => {
        setInputValue(String(quantity))
    }, [quantity])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Allow digits only or empty string so user can clear/backspace
        if (val === '' || /^[0-9]+$/.test(val)) {
            setInputValue(val)
            const num = parseInt(val, 10)
            if (!isNaN(num) && num > 0) {
                onSetQuantity(num)
            }
        }
    }

    const handleInputBlur = () => {
        const num = parseInt(inputValue, 10)
        if (isNaN(num) || num <= 0) {
            setInputValue('1')
            onSetQuantity(1)
        } else {
            setInputValue(String(num))
            onSetQuantity(num)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur()
        }
    }

    return (
        <div className="flex items-center bg-neutral-100 rounded-lg p-0.5 border border-neutral-200/60">
            <button
                type="button"
                onClick={onDecrement}
                className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
                title="Decrease quantity"
            >
                -
            </button>
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                aria-label="Quantity"
                className="w-8 text-center text-xs font-bold text-neutral-900 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded py-0.5 border-none select-all"
            />
            <button
                type="button"
                onClick={onIncrement}
                className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
                title="Increase quantity"
            >
                +
            </button>
        </div>
    )
}



interface CategorySwipeRowProps {
    id: string
    category: string
    items: (MenuItem & { basePrice?: number })[]
    renderProductCard: (item: MenuItem & { basePrice?: number }) => React.ReactNode
}

const CategorySwipeRow: React.FC<CategorySwipeRowProps> = ({
    id,
    category,
    items,
    renderProductCard,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [hasDragged, setHasDragged] = useState(false)
    const startXRef = useRef(0)
    const scrollLeftRef = useRef(0)

    const updateScrollState = () => {
        const el = scrollRef.current
        if (!el) return
        const { scrollLeft, scrollWidth, clientWidth } = el
        const hasOverflow = scrollWidth > clientWidth + 8
        if (!hasOverflow) {
            setCanScrollLeft(false)
            setCanScrollRight(false)
        } else {
            setCanScrollLeft(scrollLeft > 12)
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 12)
        }
    }

    useEffect(() => {
        updateScrollState()
        const el = scrollRef.current
        if (!el) return

        el.addEventListener('scroll', updateScrollState, { passive: true })
        window.addEventListener('resize', updateScrollState)
        const t1 = setTimeout(updateScrollState, 200)
        const t2 = setTimeout(updateScrollState, 600)

        return () => {
            el.removeEventListener('scroll', updateScrollState)
            window.removeEventListener('resize', updateScrollState)
            clearTimeout(t1)
            clearTimeout(t2)
        }
    }, [items])

    const handleScroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current
        if (!el) return
        const offset = direction === 'left' ? -Math.max(320, el.clientWidth * 0.75) : Math.max(320, el.clientWidth * 0.75)
        el.scrollBy({ left: offset, behavior: 'smooth' })
    }

    // Mouse drag-to-scroll handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        const el = scrollRef.current
        if (!el) return
        setIsDragging(true)
        setHasDragged(false)
        startXRef.current = e.pageX - el.offsetLeft
        scrollLeftRef.current = el.scrollLeft
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        const el = scrollRef.current
        if (!el) return
        e.preventDefault()
        const x = e.pageX - el.offsetLeft
        const walk = (x - startXRef.current) * 1.3
        if (Math.abs(walk) > 6) {
            setHasDragged(true)
        }
        el.scrollLeft = scrollLeftRef.current - walk
        updateScrollState()
    }

    const handleMouseUpOrLeave = () => {
        setIsDragging(false)
        setTimeout(() => setHasDragged(false), 50)
    }

    return (
        <section id={id} className="scroll-mt-24 select-none">
            {/* Header */}
            <div className="flex items-center justify-between mb-2.5 px-1">
                <h3 className="font-extrabold text-neutral-900 text-lg sm:text-xl tracking-tight">
                    {category}
                </h3>
            </div>

            {/* Carousel Container with Side-by-Side Floating Arrows on Desktop */}
            <div className="relative group/carousel">
                {/* Left Side Arrow (Desktop Only, nestled near the picture) */}
                {canScrollLeft && (
                    <button
                        type="button"
                        onClick={() => handleScroll('left')}
                        className="hidden md:flex absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200/90 shadow-md shadow-neutral-900/15 items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500 backdrop-blur-xs"
                        title="Scroll left"
                        aria-label="Scroll left"
                    >
                        <svg className="w-4.5 h-4.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                )}

                {/* Right Side Arrow (Desktop Only, nestled near the picture) */}
                {canScrollRight && (
                    <button
                        type="button"
                        onClick={() => handleScroll('right')}
                        className="hidden md:flex absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200/90 shadow-md shadow-neutral-900/15 items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500 backdrop-blur-xs"
                        title="Scroll right"
                        aria-label="Scroll right"
                    >
                        <svg className="w-4.5 h-4.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                    </button>
                )}

                {/* Swipeable & Mouse-Draggable Container */}
                <div
                    ref={scrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                    className={`flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${
                        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                    }`}
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {items.map((item) => (
                        <div
                            key={item.id}
                            onClickCapture={(e) => {
                                if (hasDragged) {
                                    e.stopPropagation()
                                    e.preventDefault()
                                }
                            }}
                        >
                            {renderProductCard(item)}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}


const getCategoryPillData = (cat: string) => {
    const lower = cat.toLowerCase()
    if (cat === 'All Menu' || cat === 'All') return { label: 'All' }
    if (lower.includes('seafood')) return { label: 'Seafoods' }
    if (lower.includes('value meal')) return { label: 'Value Meals' }
    if (lower.includes('siomai')) return { label: 'Siomai' }
    if (lower.includes('add on') || lower.includes('add-on')) return { label: 'Add Ons' }
    if (lower.includes('shake') || lower.includes('lemonade')) return { label: 'Shake & Lemonade' }
    if (lower.includes('dessert')) return { label: 'Desserts' }
    if (lower.includes('drink')) return { label: 'Drinks' }
    return { label: cat }
}

export const OnlineCustomer: React.FC = () => {
    const navigate = useNavigate()
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
    const currentUser = getActiveUser()
    const userProfileName = currentUser?.fullname || currentUser?.username || 'Guest'

    // Availability & Price sync
    const { isAvailable } = useMenuAvailability()
    const { getEffectivePrice } = useMenuPrices()

    const isFetchingOrderRef = useRef(false)
    const lastFetchTimeRef = useRef(0)

    // Navigation states (automatically open tracking tab if there is an ongoing uncompleted order)
    interface FlyingDeliveryItem {
    id: number
    startX: number
    startY: number
    targetX: number
    targetY: number
    image?: string
}

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

    const dismissVerificationModal = () => {
        const ids = [
            activeOrder?.id,
            (activeOrder as any)?.ref,
            activeOrderRef.current?.id,
            (activeOrderRef.current as any)?.ref
        ].filter(Boolean)

        ids.forEach((id) => {
            try {
                localStorage.setItem(getVerificationDismissalKey(String(id)), 'true')
            } catch (err) {
                console.warn('Could not save authorization popup dismissal:', err)
            }
        })
        setIsVerificationModalOpen(false)
        setIsWaitingModalOpen(false)
    }

    // Menu state using client items
    const { menuItems } = useProductImages()
    const [categories] = useState<string[]>(CLIENT_CATEGORIES)
    const outOfStockItems = useMemo(() => getOrderOutOfStockItems(activeOrder), [activeOrder])
// availableReplacementItems replaced by menu replacement mode

    // Menu filter states
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Menu')

    // Cart state with user-scoped localStorage persistence
    const [storedCartItems, setCartItems] = useState<CartItem[]>(() => {
        try {
            const user = getActiveUser()
            const saved = localStorage.getItem(getCartKey(user))
            return saved ? JSON.parse(saved) : []
        } catch {
            return []
        }
    })
    const cartItems = useMemo(() => {
        const imagesById = new Map(menuItems.map((item) => [item.id, item]))
        return storedCartItems.map((cartItem) => {
            const latest = imagesById.get(cartItem.item.id)
            return latest
                ? { ...cartItem, item: { ...cartItem.item, image: latest.image, bundledImage: latest.bundledImage } }
                : cartItem
        })
    }, [menuItems, storedCartItems])
    const unavailableCartItems = useMemo(
        () => cartItems.filter((ci) => !isAvailable(ci.item.id)),
        [cartItems, isAvailable]
    )
    const hasUnavailableCartItems = unavailableCartItems.length > 0
    const handleRemoveUnavailableItems = () => {
        setCartItems((prev) => prev.filter((ci) => isAvailable(ci.item.id)))
    }
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false)
    const [flyingItems, setFlyingItems] = useState<FlyingDeliveryItem[]>([])
    const [isCartBumping, setIsCartBumping] = useState(false)
    const cartIconRef = useRef<HTMLButtonElement | null>(null)

    const triggerDeliverAnimation = (e: React.MouseEvent, image?: string) => {
        let targetX = window.innerWidth - 65
        let targetY = 35
        if (cartIconRef.current) {
            const rect = cartIconRef.current.getBoundingClientRect()
            targetX = rect.left + rect.width / 2
            targetY = rect.top + rect.height / 2
        }

        const startX = e.clientX || window.innerWidth / 2
        const startY = e.clientY || window.innerHeight / 2

        const newItem: FlyingDeliveryItem = {
            id: Date.now() + Math.random(),
            startX,
            startY,
            targetX,
            targetY,
            image,
        }

        setFlyingItems((prev) => [...prev, newItem])

        setTimeout(() => {
            setIsCartBumping(true)
            setTimeout(() => setIsCartBumping(false), 450)
        }, 550)

        setTimeout(() => {
            setFlyingItems((prev) => prev.filter((item) => item.id !== newItem.id))
        }, 700)
    }
    const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null)
    const [tempNote, setTempNote] = useState('')

    // Checkout Form states
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('')
    const [address, setAddress] = useState('')
    const [addressCoordinates, setAddressCoordinates] = useState<Coordinates | null>(null)
    const [isFindingAddress, setIsFindingAddress] = useState(false)
    const [addressLookupMessage, setAddressLookupMessage] = useState('')
    const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | null>(null)
    const [isCalculatingDeliveryFee, setIsCalculatingDeliveryFee] = useState(false)
    const [deliveryDistanceMessage, setDeliveryDistanceMessage] = useState('')
    const [paymentMethod, setPaymentMethod] = useState<'GCash' | 'COD'>('GCash')
    const [paymentReceipt, _setPaymentReceipt] = useState<string | null>(null)
    const [orderNotes, setOrderNotes] = useState('') // Special Order Instructions State
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
    const [isWaitingModalOpen, setIsWaitingModalOpen] = useState(false)
    const [selectedReceiptPreview, setSelectedReceiptPreview] = useState<string | null>(null)
    const [previewScreenshotUrl, setPreviewScreenshotUrl] = useState<string | null>(null)
    const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false)
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
    const isSubmittingOrderRef = useRef(false)
    const pendingOrderSubmissionRef = useRef<{ fingerprint: string; id: string } | null>(null)
    const [isCancellingOrder, setIsCancellingOrder] = useState(false)
    // oos replacement inline select removed
    const [replacementSelections, setReplacementSelections] = useState<Record<string, any>>({})
    const [replacementTargetItem, setReplacementTargetItem] = useState<any | null>(null)
    const [additionalReceiptFile, setAdditionalReceiptFile] = useState<string | null>(null)
    const [additionalRefNumber, setAdditionalRefNumber] = useState<string>('')
    const [isSubmittingOosChoice, setIsSubmittingOosChoice] = useState(false)

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            setAddressLookupMessage('Location is not supported by this browser.')
            return
        }

        setIsFindingAddress(true)
        setAddressLookupMessage('')
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const currentCoordinates = { lat: coords.latitude, lng: coords.longitude }
                setAddressCoordinates(currentCoordinates)
                setDeliveryDistanceKm(null)
                setIsCalculatingDeliveryFee(true)
                setDeliveryDistanceMessage('')
                try {
                    const resolvedAddress = await reverseGeocodeCoordinates(currentCoordinates)
                    setAddress(resolvedAddress)
                    setAddressLookupMessage('Current location added. Please check the address and add unit or gate details if needed.')
                } catch (error) {
                    setAddress(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`)
                    setAddressLookupMessage(
                        `${error instanceof Error ? error.message : 'Could not find a readable address.'} Coordinates were added instead; add any helpful delivery details.`
                    )
                } finally {
                    setIsFindingAddress(false)
                }
            },
            (error) => {
                setIsFindingAddress(false)
                setAddressLookupMessage(
                    error.code === 1
                        ? 'Location permission was denied. Enter your delivery address manually.'
                        : 'Could not get your location. Check your device settings and try again.'
                )
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        )
    }

    const handleAdditionalReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setAdditionalReceiptFile(reader.result)
            }
        }
        reader.readAsDataURL(file)
    }

    // Save cart state to user-scoped localStorage whenever modified
    useEffect(() => {
        try {
            const user = getActiveUser()
            localStorage.setItem(getCartKey(user), JSON.stringify(cartItems))
        } catch (err) {
            console.warn('Could not save cart to localStorage:', err)
        }
    }, [cartItems])

    const fetchedProfileRef = useRef(false)

    // Helper to fetch latest profile credentials from database and update state + local active user
    const syncUserProfileFromDB = (user?: ReturnType<typeof getActiveUser>) => {
        const currentUser = user || getActiveUser()
        if (!currentUser) return

        // Instant local sync if values exist
        if (currentUser.fullname) setCustomerName(currentUser.fullname)
        if (currentUser.phone) setPhone(currentUser.phone)
        if (currentUser.address) setAddress(currentUser.address)

        if (fetchedProfileRef.current) return
        fetchedProfileRef.current = true

        const email = currentUser.email || ''
        const id = currentUser.id || ''
        if (!email && !id) return

        fetch(`${API_BASE_URL}/auth/me-profile?email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data) {
                    const dbUser = data.data
                    const dbName = dbUser.fullname || currentUser.fullname || ''
                    const dbPhone = dbUser.phone || currentUser.phone || ''
                    const dbAddress = dbUser.address || dbUser.delivery_address || currentUser.address || ''

                    if (dbName !== currentUser.fullname || dbPhone !== currentUser.phone || dbAddress !== currentUser.address) {
                        const updatedActive = {
                            ...currentUser,
                            fullname: dbName,
                            phone: dbPhone,
                            address: dbAddress,
                        }
                        saveActiveUser(updatedActive)
                    }

                    if (dbName) setCustomerName(dbName)
                    if (dbPhone) setPhone(dbPhone)
                    if (dbAddress) setAddress(dbAddress)
                }
            })
            .catch(() => { })
    }

    // Auto-fill logged in user info & sync user cart and orders
    useEffect(() => {
        const currentUser = getActiveUser()
        if (currentUser) {
            syncUserProfileFromDB(currentUser)

            // Hydrate user cart (and migrate guest cart if present)
            try {
                const guestCartKey = 'sfb_customer_cart_guest'
                const guestCart = localStorage.getItem(guestCartKey)
                const userCartKey = getCartKey(currentUser)
                const savedCart = localStorage.getItem(userCartKey)

                if (guestCart && guestCart !== '[]') {
                    let merged: CartItem[] = JSON.parse(guestCart)
                    if (savedCart && savedCart !== '[]') {
                        const existingUserCart: CartItem[] = JSON.parse(savedCart)
                        const itemMap = new Map<string, CartItem>()
                        existingUserCart.forEach((ci) => itemMap.set(ci.item.id, ci))
                        merged.forEach((ci) => {
                            if (itemMap.has(ci.item.id)) {
                                const curr = itemMap.get(ci.item.id)!
                                itemMap.set(ci.item.id, { ...curr, quantity: curr.quantity + ci.quantity })
                            } else {
                                itemMap.set(ci.item.id, ci)
                            }
                        })
                        merged = Array.from(itemMap.values())
                    }
                    localStorage.setItem(userCartKey, JSON.stringify(merged))
                    localStorage.removeItem(guestCartKey)
                    setCartItems(merged)
                } else if (savedCart) {
                    setCartItems(JSON.parse(savedCart))
                }
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

        const handleProfileSync = () => {
            syncUserProfileFromDB()
        }

        window.addEventListener('seafudz_profile_updated', handleProfileSync)
        window.addEventListener('storage', handleProfileSync)

        return () => {
            window.removeEventListener('seafudz_profile_updated', handleProfileSync)
            window.removeEventListener('storage', handleProfileSync)
        }
    }, [])

    useEffect(() => {
        syncUserProfileFromDB()
    }, [activeTab])

    const handleSubmitReceipt = async () => {
        if (!activeOrder || !selectedReceiptPreview || isSubmittingReceipt) return
        setIsSubmittingReceipt(true)
        try {
            await fetch(`${API_BASE_URL}/assistant/orders/${activeOrder.id}/upload-receipt`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentReceipt: selectedReceiptPreview }),
            })

            try {
                const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
                const updatedGlobal = globalOrders.map((o: any) =>
                    o.id === activeOrder.id || o.ref === activeOrder.id
                        ? { ...o, paymentReceipt: selectedReceiptPreview, status: 'RECEIPT_SUBMITTED' }
                        : o
                )
                localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))

                const currentUser = getActiveUser()
                const userOrderKey = getActiveOrderKey(currentUser)
                const activeObjStr = localStorage.getItem(userOrderKey)
                if (activeObjStr) {
                    const activeObj = JSON.parse(activeObjStr)
                    localStorage.setItem(userOrderKey, JSON.stringify({
                        ...activeObj,
                        paymentReceipt: selectedReceiptPreview,
                        status: 'RECEIPT_SUBMITTED'
                    }))
                }
                notifyOrderSync()
            } catch { }

            setActiveOrder((prev) => prev ? { ...prev, paymentReceipt: selectedReceiptPreview, status: 'RECEIPT_SUBMITTED' } : null)
            setSelectedReceiptPreview(null)
            setIsVerificationModalOpen(false)
            setActiveTab('tracking')
        } catch (err) {
            console.error('Error submitting payment receipt:', err)
        } finally {
            setIsSubmittingReceipt(false)
        }
    }

    const handleCancelOrder = async () => {
        if (!activeOrder || normalizeStatus(activeOrder.status) === 'OUT_OF_STOCK' || outOfStockItems.length > 0) return
        const confirmCancel = window.confirm(`Are you sure you want to cancel Order #${activeOrder.id}?`)
        if (!confirmCancel) return

        setIsCancellingOrder(true)
        try {
            const token = localStorage.getItem('seafudz_token') || localStorage.getItem('token') || localStorage.getItem('sfb_crypto_session_token')
            const res = await fetch(`${API_BASE_URL}/user-flow/orders/${activeOrder.id}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status: 'CANCELLED' }),
            })

            const resData = await res.json().catch(() => ({}))
            if (!res.ok) {
                alert(resData.message || 'Failed to cancel order.')
                setIsCancellingOrder(false)
                return
            }
        } catch (err: any) {
            console.error('Error sending cancel request:', err)
            alert(err?.message || 'Error sending cancel request')
            setIsCancellingOrder(false)
            return
        }

        const updatedOrder = { ...activeOrder, status: 'CANCELLED' }
        setActiveOrder(updatedOrder)

        try {
            const currentUser = getActiveUser()
            const userOrderKey = getActiveOrderKey(currentUser)
            const userOrdersKey = getOrdersKey(currentUser)
            localStorage.setItem(userOrderKey, JSON.stringify(updatedOrder))

            const existingUserOrders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]')
            const updatedUserOrders = existingUserOrders.map((o: any) =>
                (o.id === activeOrder.id || o.ref === activeOrder.id) ? updatedOrder : o
            )
            localStorage.setItem(userOrdersKey, JSON.stringify(updatedUserOrders))

            const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
            const updatedGlobalOrders = globalOrders.map((o: any) =>
                (o.id === activeOrder.id || o.ref === activeOrder.id) ? { ...o, status: 'CANCELLED' } : o
            )
            localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobalOrders))
        } catch { }

        notifyOrderSync()
        setIsCancellingOrder(false)
    }

    // Auto-navigate customer to Order Status tracking
    useEffect(() => {
        if (!activeOrder?.status) return
        const s = (activeOrder.status || '').toUpperCase()
        const norm = normalizeStatus(s)
        const isConfirmedOrLater = ['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(norm)
        const isCOD = activeOrder.paymentMethod === 'COD' || s === 'PENDING_COD'

        if (isConfirmedOrLater || s === 'RECEIPT_SUBMITTED' || isCOD) {
            dismissVerificationModal()
            setActiveTab('tracking')
        }
    }, [activeOrder?.status, activeOrder?.paymentMethod])

    const handleProceedToCheckout = () => {
        if (hasUnavailableCartItems) return
        const currentUser = getActiveUser()
        if (!currentUser) {
            setIsAuthModalOpen(true)
            return
        }
        syncUserProfileFromDB(currentUser)
        if (cartItems.length > 0) {
            setActiveTab('billing')
            setIsCartDrawerOpen(false)
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
                            const previousOrder = activeOrderRef.current
                            const rawStatus = String(orderData.status).toUpperCase()
                            const gcashAuthorized = Boolean(orderData.gcashAuthorized || orderData.gcash_authorized || rawStatus === 'GCASH_AUTHORIZED')
                            const customerResolution = Object.prototype.hasOwnProperty.call(orderData, 'customerResolution')
                                ? orderData.customerResolution
                                : orderData.customer_resolution ?? previousOrder?.customerResolution ?? null
                            const customerResolutionStatus = orderData.customerResolutionStatus || orderData.customer_resolution_status || previousOrder?.customerResolutionStatus || 'NONE'
                            const customerReplacements = Array.isArray(orderData.customerReplacements)
                                ? orderData.customerReplacements
                                : Array.isArray(orderData.customer_replacements)
                                    ? orderData.customer_replacements
                                    : previousOrder?.customerReplacements || []
                            const latestOutOfStockItems = Array.isArray(orderData.outOfStockItems)
                                ? orderData.outOfStockItems
                                : previousOrder?.outOfStockItems || []
                            const orderChanged = rawStatus !== String(previousOrder?.status || '').toUpperCase()
                                || gcashAuthorized !== Boolean(previousOrder?.gcashAuthorized || previousOrder?.gcash_authorized)
                                || customerResolution !== (previousOrder?.customerResolution || null)
                                || customerResolutionStatus !== (previousOrder?.customerResolutionStatus || 'NONE')
                                || Boolean(orderData.refundReceipt && orderData.refundReceipt !== previousOrder?.refundReceipt)
                                || JSON.stringify(customerReplacements) !== JSON.stringify(previousOrder?.customerReplacements || [])
                                || JSON.stringify(latestOutOfStockItems) !== JSON.stringify(previousOrder?.outOfStockItems || [])
                                || Number(orderData.total ?? previousOrder?.total) !== Number(previousOrder?.total)

                            const normStatus = normalizeStatus(rawStatus)
                            const isConfirmedOrLater = ['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(normStatus)

                            if (rawStatus === 'GCASH_AUTHORIZED' && !isConfirmedOrLater) {
                                setIsWaitingModalOpen(false)
                                if (!isVerificationModalDismissed(currentOrderId) && !isVerificationModalDismissed((orderData as any)?.ref)) {
                                    setIsVerificationModalOpen(true)
                                }
                            } else if (isConfirmedOrLater) {
                                setIsWaitingModalOpen(false)
                                setIsVerificationModalOpen(false)
                            }

                            if (orderChanged) {
                                setActiveOrder((prev) => {
                                    if (!prev) return null
                                    const updated = {
                                        ...prev,
                                        status: rawStatus,
                                        gcashAuthorized,
                                        outOfStockItems: latestOutOfStockItems,
                                        customerResolution,
                                        customerResolutionStatus,
                                        customerReplacements,
                                        ...(orderData.refundReceipt ? { refundReceipt: orderData.refundReceipt } : {}),
                                        ...(orderData.refundReference ? { refundReference: orderData.refundReference } : {}),
                                        subtotal: Number(orderData.subtotal ?? prev.subtotal),
                                        vat: Number(orderData.vat ?? prev.vat),
                                        deliveryFee: Number(orderData.deliveryFee ?? prev.deliveryFee),
                                        total: Number(orderData.total ?? prev.total),
                                    }
                                    try {
                                        localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(updated))
                                        localStorage.setItem('seafudz_active_online_order', JSON.stringify(updated))

                                        const updateListInStorage = (key: string) => {
                                            const raw = localStorage.getItem(key)
                                            if (!raw) return
                                            try {
                                                const list = JSON.parse(raw)
                                                if (Array.isArray(list)) {
                                                    const updatedList = list.map((o: any) =>
                                                        (o.id === currentOrderId || o.ref === currentOrderId) ? { ...o, ...updated } : o
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

                // 2. LocalStorage Sync Fallback (Only advance status if local storage has a STRICTLY HIGHER rank or changed sub-status)
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

                        // Merge orders prioritizing storedGlobal (latest staff/assistant changes) over storedUser
                        const globalList = parseList(storedGlobal)
                        const userList = parseList(storedUser)
                        const orderMap = new Map<string, any>()
                        userList.forEach((o: any) => {
                            if (o && (o.id || o.ref)) orderMap.set(String(o.id || o.ref), o)
                        })
                        globalList.forEach((o: any) => {
                            if (o && (o.id || o.ref)) {
                                const key = String(o.id || o.ref)
                                const existing = orderMap.get(key) || {}
                                orderMap.set(key, { ...existing, ...o })
                            }
                        })
                        const allLists = Array.from(orderMap.values())
                        const current = allLists.find((o: any) => String(o.id) === String(currentOrderId) || String(o.ref) === String(currentOrderId))

                        if (current && current.status) {
                            const rawStatus = String(current.status).toUpperCase()
                            const currentRawStatus = String(activeOrderRef.current?.status || '').toUpperCase()
                            const currentRank = getStatusRank(activeOrderRef.current?.status)
                            const localRank = getStatusRank(rawStatus)
                            const normStatus = normalizeStatus(rawStatus)
                            const isConfirmedOrLater = ['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(normStatus)

                            // Advance status only if local rank is strictly higher OR raw sub-status legitimately advanced without rank decrease
                            const shouldAdvance = localRank > currentRank || (rawStatus !== currentRawStatus && localRank >= currentRank)

                            if (shouldAdvance) {
                                if (rawStatus === 'GCASH_AUTHORIZED' && !isConfirmedOrLater) {
                                    setIsWaitingModalOpen(false)
                                    if (!isVerificationModalDismissed(currentOrderId) && !isVerificationModalDismissed(current.ref)) {
                                        setIsVerificationModalOpen(true)
                                    }
                                } else if (isConfirmedOrLater) {
                                    setIsWaitingModalOpen(false)
                                    setIsVerificationModalOpen(false)
                                }

                                setActiveOrder((prev) => {
                                    if (!prev) return null
                                    const updated = {
                                        ...prev,
                                        status: rawStatus,
                                        gcashAuthorized: Boolean(current.gcashAuthorized || rawStatus === 'GCASH_AUTHORIZED'),
                                        ...(current.paymentReceipt ? { paymentReceipt: current.paymentReceipt } : {}),
                                        ...(current.refundReceipt ? { refundReceipt: current.refundReceipt } : {}),
                                        ...(current.refundReference ? { refundReference: current.refundReference } : {}),
                                        ...(current.customerResolution ? { customerResolution: current.customerResolution } : {}),
                                        ...(current.customerResolutionStatus ? { customerResolutionStatus: current.customerResolutionStatus } : {}),
                                    }
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
        const unsubscribe = subscribeOrderSync(() => {
            void checkOrderStatus(true)
        })

        const interval = setInterval(() => {
            void checkOrderStatus()
        }, 8000)

        return () => {
            unsubscribe()
            clearInterval(interval)
        }
    }, [activeOrder?.id])

    // Calculations: Base Subtotal + 12% VAT + Detailed Delivery/Shipping Fee
    const subtotal = useMemo(() => {
        return cartItems.reduce((acc, ci) => {
            const basePrice = (ci.item as any).basePrice || getEffectivePrice(ci.item.id, ci.item.price)
            return acc + basePrice * ci.quantity
        }, 0)
    }, [cartItems, getEffectivePrice])
    // 12% VAT added on top of base subtotal
    const vat = useMemo(() => subtotal * 0.12, [subtotal])
    const deliveryDestination = useMemo(
        () => address.trim() ? addressCoordinates || geocodeAddress(address) : null,
        [address, addressCoordinates]
    )
    const deliveryLatitude = deliveryDestination?.lat
    const deliveryLongitude = deliveryDestination?.lng

    useEffect(() => {
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            if (deliveryLatitude === undefined || deliveryLongitude === undefined) {
                setDeliveryDistanceKm(null)
                setIsCalculatingDeliveryFee(false)
                setDeliveryDistanceMessage('')
                return
            }

            setIsCalculatingDeliveryFee(true)
            const destination = { lat: deliveryLatitude, lng: deliveryLongitude }
            const origin = SEAFUDZ_FLAGSHIP_STORE
            void fetchRoadDistances(origin, [{ id: 'checkout', coord: destination }], controller.signal)
                .then((distances) => {
                    if (controller.signal.aborted) return
                    const routeDistance = distances.get('checkout')
                    setDeliveryDistanceKm(routeDistance ?? null)
                    setDeliveryDistanceMessage(
                        routeDistance === undefined
                            ? 'Road distance unavailable. Please retry before placing the order.'
                            : routeDistance > 8
                                ? 'Delivery is available only within 8 km of the store.'
                                : ''
                    )
                    setIsCalculatingDeliveryFee(false)
                })
                .catch(() => {
                    if (controller.signal.aborted) return
                    setDeliveryDistanceKm(null)
                    setDeliveryDistanceMessage('Road distance unavailable. Please retry before placing the order.')
                    setIsCalculatingDeliveryFee(false)
                })
        }, 300)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [deliveryLatitude, deliveryLongitude])

    const deliveryFee = useMemo(
        () => {
            if (subtotal <= 0) return 0
            if (deliveryDistanceKm === null) return address.trim() ? null : 50
            return calculateDeliveryFee(deliveryDistanceKm)
        },
        [subtotal, deliveryDistanceKm, address]
    )
    const deliveryDistanceLabel = isCalculatingDeliveryFee
        ? 'Calculating distance…'
        : deliveryDistanceKm === null
            ? ''
            : `${deliveryDistanceKm.toFixed(1)} km`
    const total = useMemo(() => Math.round(subtotal + vat + (deliveryFee ?? 0)), [subtotal, vat, deliveryFee])



    const handleCategoryClick = (cat: string) => {
        setSelectedCategory(cat)
        if (cat === 'All Menu') {
            const el = document.getElementById('menu-display-area')
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } else {
            const secId = `category-section-${cat.replace(/\s+/g, '-').toLowerCase()}`
            const el = document.getElementById(secId)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
    }

    // Filters: Menu Display Price = Base Price + 12% VAT (e.g. 199 + 12% VAT = ₱223)
    const allEffectiveItems = useMemo(() => {
        return menuItems.map((item) => {
            const basePrice = getEffectivePrice(item.id, item.price)
            return {
                ...item,
                basePrice,
                price: Math.round(basePrice * 1.12),
            }
        })
    }, [menuItems, getEffectivePrice])

    const availableCategories = useMemo(() => {
        const set = new Set<string>()
        allEffectiveItems.forEach((item) => {
            if (item.category) set.add(item.category)
        })
        const ordered = CLIENT_CATEGORIES.filter((c) => c !== 'All Menu' && set.has(c))
        set.forEach((c) => {
            if (!ordered.includes(c)) ordered.push(c)
        })
        return ordered
    }, [allEffectiveItems])

    const filteredItems = useMemo(() => {
        return allEffectiveItems.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory =
                selectedCategory === 'All Menu' || item.category.toLowerCase() === selectedCategory.toLowerCase()
            return matchesSearch && matchesCategory
        })
    }, [allEffectiveItems, searchQuery, selectedCategory])

    // Handlers
    const handleAddToCart = (item: MenuItem, e?: React.MouseEvent) => {
        if (!isAvailable(item.id)) return

        if (e) {
            triggerDeliverAnimation(e, item.image || item.bundledImage)
        } else {
            setIsCartBumping(true)
            setTimeout(() => setIsCartBumping(false), 450)
        }

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

    const handleIncrement = (itemId: string, e?: React.MouseEvent) => {
        if (e) {
            const ci = cartItems.find((c) => c.item.id === itemId)
            triggerDeliverAnimation(e, ci?.item.image || ci?.item.bundledImage)
        } else {
            setIsCartBumping(true)
            setTimeout(() => setIsCartBumping(false), 450)
        }
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

    const handleSetQuantity = (itemId: string, quantity: number) => {
        setCartItems((prev) =>
            prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: Math.max(1, quantity) } : ci))
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
        if (e && e.preventDefault) e.preventDefault()
        if (isFindingAddress || isCalculatingDeliveryFee) {
            alert('Please wait while your location and delivery fee are calculated.')
            return
        }
        if (hasUnavailableCartItems) {
            alert('An item in your cart was just marked Out of Stock by the kitchen. Remove unavailable items before placing your order.')
            return
        }
        if (isSubmittingOrderRef.current) return

        let currentUser = getActiveUser()
        if (!currentUser) {
            const guestUser = {
                fullname: customerName.trim() || 'Online Customer',
                username: (customerName.trim() || 'customer').replace(/\s+/g, '.').toLowerCase(),
                email: `${(customerName.trim() || 'customer').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@seafudz.ph`,
                phone: phone.trim() || '0917-000-0000',
                address: address.trim() || 'Delivery Address',
                role: 'customer',
                sessionToken: `guest_${Date.now()}`
            }
            saveActiveUser(guestUser)
            currentUser = guestUser
        }

        if (!customerName.trim() || !phone.trim() || !address.trim() || cartItems.length === 0) {
            alert('Please fill out your Full Name, Phone Number, and Delivery Address before submitting your order.')
            return
        }
        if (deliveryDistanceKm === null || deliveryDistanceKm > 8 || deliveryFee === null) {
            alert(deliveryDistanceKm === null
                ? 'The road distance could not be verified. Please try again before ordering.'
                : 'Delivery is available only within 8 km of the store.')
            return
        }

        isSubmittingOrderRef.current = true
        setIsSubmittingOrder(true)

        try {
            const initialStatus = paymentMethod === 'COD' ? 'PENDING_COD' : 'GCASH_PENDING_APPROVAL'
            const orderPayload = {
                type: 'Delivery',
                customerName: customerName.trim(),
                phone: phone.trim(),
                deliveryAddress: address.trim(),
                deliveryLatitude: addressCoordinates?.lat,
                deliveryLongitude: addressCoordinates?.lng,
                paymentMethod,
                paymentReceipt: paymentReceipt || undefined,
                notes: orderNotes,
                subtotal,
                vat,
                deliveryFee,
                total,
                status: initialStatus,
                gcashAuthorized: false,
                gcash_authorized: false,
                items: cartItems.map((ci) => ({
                    id: ci.item.id,
                    name: ci.item.name,
                    quantity: ci.quantity,
                    price: (ci.item as any).basePrice || ci.item.price,
                    specialNote: ci.specialNote || '',
                })),
            }
            const fingerprint = JSON.stringify(orderPayload)
            let pendingSubmission = pendingOrderSubmissionRef.current
            if (!pendingSubmission || pendingSubmission.fingerprint !== fingerprint) {
                pendingSubmission = { fingerprint, id: `SFB-${crypto.randomUUID()}` }
                pendingOrderSubmissionRef.current = pendingSubmission
            }

            const token = localStorage.getItem('seafudz_token')
            const res = await fetch(`${API_BASE_URL}/user-flow/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ ...orderPayload, id: pendingSubmission.id }),
            })
            const responseData: any = await res.json().catch(() => ({}))
            if (!res.ok || responseData.success === false) {
                throw new Error(responseData.message || 'The order could not be submitted.')
            }

            const serverOrder = responseData?.data || responseData
            if (!serverOrder?.id) {
                throw new Error('The server did not confirm the order. Please try again.')
            }

            const newOrderId = serverOrder.id
            const newOrder: OnlineOrderState & { type: string; customer: string; deliveryAddress: string } = {
                id: newOrderId,
                type: 'Delivery',
                customerName: serverOrder?.customerName || serverOrder?.customer_name || customerName,
                customer: serverOrder?.customerName || serverOrder?.customer_name || customerName,
                phone: serverOrder?.phone || serverOrder?.customer_phone || phone,
                address: serverOrder?.address || serverOrder?.delivery_address || address,
                deliveryAddress: serverOrder?.address || serverOrder?.delivery_address || address,
                deliveryLatitude: serverOrder?.deliveryLatitude ?? addressCoordinates?.lat,
                deliveryLongitude: serverOrder?.deliveryLongitude ?? addressCoordinates?.lng,
                paymentMethod: serverOrder?.paymentMethod || serverOrder?.payment_method || paymentMethod,
                paymentReceipt: paymentReceipt || undefined,
                notes: orderNotes,
                items: [...cartItems],
                subtotal: serverOrder?.subtotal ?? subtotal,
                vat: serverOrder?.vat ?? vat,
                deliveryFee: serverOrder?.deliveryFee ?? deliveryFee,
                total: serverOrder?.total ?? total,
                status: (serverOrder?.status || initialStatus).toUpperCase(),
                gcashAuthorized: Boolean(serverOrder?.gcashAuthorized || serverOrder?.gcash_authorized),
                createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }

            pendingOrderSubmissionRef.current = null
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
            if (paymentMethod === 'COD') {
                setActiveTab('tracking')
                setIsVerificationModalOpen(false)
                setIsWaitingModalOpen(false)
            } else {
                setActiveTab('billing')
                setIsWaitingModalOpen(true)
                setIsVerificationModalOpen(false)
            }
            setIsCartDrawerOpen(false)
            notifyOrderSync()
        } catch (err) {
            console.error('Error sending order to backend API:', err)
            alert(err instanceof Error ? `Order not submitted: ${err.message}` : 'Order could not be submitted. Please try again.')
        } finally {
            isSubmittingOrderRef.current = false
            setIsSubmittingOrder(false)
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

    const handleSubmitOutOfStockChoice = async (resolution: 'REPLACE' | 'REFUND') => {
        if (!activeOrder || isSubmittingOosChoice) return
        if (resolution === 'REFUND' && !window.confirm(`Request a full refund for Order #${activeOrder.id}?`)) return

        const replacements: Array<{ oldItemId: string | number; newProductId: string; newName: string; newPrice: number }> = []
        if (resolution === 'REPLACE') {
            outOfStockItems.forEach((item: any, index: number) => {
                const oldItemId = item.id ?? index
                const sel = replacementSelections[String(oldItemId)]
                if (sel) {
                    replacements.push({
                        oldItemId,
                        newProductId: sel.productId || sel.id,
                        newName: sel.name,
                        newPrice: Number(sel.price || 0),
                    })
                }
            })

            if (outOfStockItems.length === 0 || replacements.length !== outOfStockItems.length) {
                alert('Choose an available replacement for every out-of-stock item from the menu.')
                return
            }
        }

        setIsSubmittingOosChoice(true)
        try {
            const token = localStorage.getItem('seafudz_token') || localStorage.getItem('token')
            const res = await fetch(`${API_BASE_URL}/user-flow/orders/${activeOrder.id}/out-of-stock-choice`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ resolution, replacements }),
            })
            const result = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(result.message || 'Unable to submit your choice.')

            if (resolution === 'REPLACE' && additionalReceiptFile) {
                try {
                    await fetch(`${API_BASE_URL}/user-flow/orders/${activeOrder.id}/additional-payment-receipt`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({
                            paymentReceipt: additionalReceiptFile,
                            referenceNumber: additionalRefNumber || undefined,
                        }),
                    })
                } catch (receiptErr) {
                    console.warn('Could not upload additional payment receipt:', receiptErr)
                }
            }

            const responseOrder = result.data || {}
            const updatedOrder = {
                ...activeOrder,
                status: responseOrder.status || activeOrder.status,
                total: responseOrder.total ?? activeOrder.total,
                subtotal: responseOrder.subtotal ?? activeOrder.subtotal,
                vat: responseOrder.vat ?? activeOrder.vat,
                financialStatus: responseOrder.financialStatus,
                netConfirmedPaid: responseOrder.netConfirmedPaid,
                grossConfirmedPaid: responseOrder.grossConfirmedPaid,
                excessAmount: responseOrder.excessAmount,
                additionalRequired: responseOrder.additionalRequired,
                pendingRefundAmount: responseOrder.pendingRefundAmount,
                outOfStockItems: responseOrder.outOfStockItems ?? outOfStockItems,
                customerResolution: responseOrder.customerResolution || resolution,
                customerResolutionStatus: responseOrder.customerResolutionStatus || 'PENDING_ASSISTANT',
                customerReplacements: responseOrder.customerReplacements || replacements,
                additionalPaymentReceipt: additionalReceiptFile || activeOrder.additionalPaymentReceipt,
            }
            const currentUser = getActiveUser()
            setActiveOrder(updatedOrder)
            
            setReplacementSelections({})
            setReplacementTargetItem(null)
            setAdditionalReceiptFile(null)

            try {
                localStorage.setItem(getActiveOrderKey(currentUser), JSON.stringify(updatedOrder))
                for (const key of [getOrdersKey(currentUser), 'seafudz_orders']) {
                    const stored = localStorage.getItem(key)
                    if (!stored) continue
                    const orders = JSON.parse(stored)
                    if (Array.isArray(orders)) {
                        localStorage.setItem(key, JSON.stringify(orders.map((order: any) =>
                            order.id === activeOrder.id || order.ref === activeOrder.id ? { ...order, ...updatedOrder } : order
                        )))
                    }
                }
                const globalActive = localStorage.getItem('seafudz_active_online_order')
                if (globalActive) {
                    try {
                        const parsed = JSON.parse(globalActive)
                        if (parsed.id === activeOrder.id || parsed.ref === activeOrder.id) {
                            localStorage.setItem('seafudz_active_online_order', JSON.stringify(updatedOrder))
                        }
                    } catch {}
                }
            } catch (err) {
                console.warn('Could not update active order in localStorage:', err)
            }
            notifyOrderSync()
        } catch (error) {
            console.error('Error submitting out-of-stock choice:', error)
            alert(error instanceof Error ? error.message : 'Unable to submit your choice right now.')
        } finally {
            setIsSubmittingOosChoice(false)
        }
    }

    const renderProductCard = (item: MenuItem & { basePrice?: number }) => {
        const available = isAvailable(item.id)
        const cartItem = cartItems.find((ci) => ci.item.id === item.id)
        return (
            <div
                key={item.id}
                className={`w-[calc(50vw-22px)] min-w-[150px] max-w-[185px] sm:w-[260px] sm:max-w-none shrink-0 snap-start bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-200 group ${
                    !available
                        ? 'border-rose-200 bg-neutral-50/70 opacity-80'
                        : 'border-neutral-100 shadow-2xs hover:shadow-md'
                }`}
            >
                <div className="relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-neutral-50">
                    <ProductImage
                        src={item.image}
                        fallbackSrc={item.bundledImage}
                        alt={item.name}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                            !available ? 'grayscale-75 opacity-60 contrast-125' : 'group-hover:scale-105'
                        }`}
                    />
                    <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white/95 backdrop-blur-xs text-neutral-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-neutral-200/50 shadow-2xs">
                        {item.category}
                    </span>

                    {!available && (
                        <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px] flex items-center justify-center p-2 pointer-events-none">
                            <span className="bg-rose-600 text-white font-extrabold text-[10px] sm:text-xs uppercase tracking-wider px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg shadow-md border border-rose-400/30 flex items-center gap-1.5 animate-pulse">
                                Sold Out
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-3 sm:p-5 flex-grow flex flex-col justify-between gap-2 sm:gap-3">
                    <div>
                        <h3
                            className={`font-bold text-xs sm:text-base leading-snug transition-colors line-clamp-1 ${
                                !available ? 'text-neutral-500 line-through' : 'text-neutral-800'
                            }`}
                            title={item.name}
                        >
                            {item.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-neutral-400 mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-2 min-h-0 sm:min-h-[32px]">
                            {item.description}
                        </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-neutral-100/70 gap-1">
                        <div>
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-neutral-400 block leading-tight">Price</span>
                            <span
                                className={`font-extrabold text-xs sm:text-lg leading-tight ${
                                    !available ? 'text-neutral-400' : 'text-orange-600'
                                }`}
                            >
                                ₱{item.price.toLocaleString()}
                            </span>
                        </div>

                        {available ? (
                            replacementTargetItem ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const itemKey = String(replacementTargetItem.id ?? 0)
                                        const effectivePrice = getEffectivePrice(item.id, item.price)
                                        setReplacementSelections((prev) => ({
                                            ...prev,
                                            [itemKey]: {
                                                productId: item.id,
                                                name: item.name,
                                                price: effectivePrice,
                                                image: item.image,
                                                category: item.category,
                                            },
                                        }))
                                        setReplacementTargetItem(null)
                                        setActiveTab('tracking')
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black flex items-center gap-1 transition-all duration-200 cursor-pointer shadow-md active:scale-95"
                                >
                                    <span>✓</span> Select
                                </button>
                            ) : cartItem ? (
                                <div className="flex items-center bg-neutral-100 rounded-lg p-0.5 border border-neutral-200/60 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => handleDecrement(item.id)}
                                        className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
                                        title="Decrease quantity"
                                    >
                                        -
                                    </button>
                                    <span className="w-5 sm:w-6 text-center text-xs font-bold text-neutral-900 select-none">
                                        {cartItem.quantity}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => handleIncrement(item.id, e)}
                                        className="w-5 h-5 rounded flex items-center justify-center text-neutral-600 hover:bg-white hover:text-neutral-900 active:scale-90 transition-all cursor-pointer font-bold text-xs"
                                        title="Increase quantity"
                                    >
                                        +
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => handleAddToCart(item, e)}
                                    className="p-1 sm:p-1.5 text-neutral-400 hover:text-neutral-700 active:scale-90 transition-all cursor-pointer flex items-center justify-center shrink-0 select-none"
                                    title={`Add ${item.name} to cart`}
                                    aria-label={`Add ${item.name} to cart`}
                                >
                                    <svg
                                        className="w-5 h-5 sm:w-6 sm:h-6 stroke-current"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                </button>
                            )
                        ) : (
                            <span className="bg-neutral-100 text-neutral-400 text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl cursor-not-allowed select-none border border-neutral-200">
                                Sold Out
                            </span>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f8f6f4] p-4 lg:p-6 transition-all duration-300">
            <div className="w-full flex flex-col gap-6">
                {/* Integrated Customer Navbar */}
                <NavbarCustomer
                    cartItemCount={cartItems.reduce((acc, ci) => acc + ci.quantity, 0)}
                    cartTotal={total}
                    onOpenCart={() => setIsCartDrawerOpen(true)}
                    isCartBumping={isCartBumping}
                    cartButtonRef={cartIconRef}
                />

                {/* VIEW 1: MENU / BROWSE */}
                {activeTab === 'menu' && (
                    <div className="w-full flex flex-col gap-6 items-start">
                        {/* Main Menu Area (Full Width, Right Aside Removed) */}
                        <main className="w-full flex flex-col gap-6">
                            {/* Sticky Replacement Banner */}
                            {replacementTargetItem && (
                                <div className="sticky top-4 z-40 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-amber-300/40 animate-in slide-in-from-top-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                                                Replacement Mode
                                            </span>
                                            <span className="text-xs text-amber-100 font-medium">Click "Select as Replacement" on any available dish</span>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-black tracking-tight">
                                            Replacing: <span className="underline decoration-amber-300 font-extrabold">{replacementTargetItem.name || replacementTargetItem.product_name_snapshot}</span>
                                            <span className="text-amber-200 font-bold text-sm ml-2">
                                                (₱{((replacementTargetItem.price || replacementTargetItem.unit_price || 0) * (replacementTargetItem.quantity || 1)).toLocaleString()})
                                            </span>
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReplacementTargetItem(null)
                                            setActiveTab('tracking')
                                        }}
                                        className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center active:scale-95"
                                    >
                                        ✕ Cancel & Return to Order
                                    </button>
                                </div>
                            )}
                            {/* Welcome Banner Card with Animated Boat (Now applied to both Desktop and Mobile) */}
                            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white p-5 sm:p-7 lg:p-8 shadow-lg shadow-orange-500/20 flex items-center justify-between">
                                <div className="relative z-10 max-w-[62%] sm:max-w-[70%] lg:max-w-[72%] space-y-2 lg:space-y-3">
                                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight text-white drop-shadow-xs">
                                        Welcome, {userProfileName}!
                                    </h2>
                                    <p className="text-xs sm:text-sm lg:text-base text-amber-50/95 font-medium leading-relaxed max-w-xl italic">
                                        “Fresh catch crafted with authentic coastal passion —<br />
                                        bringing the true taste of the ocean to Seafudz ng Bayan.”
                                    </p>
                                    {activeOrder && (
                                        <div className="pt-1 sm:pt-2 flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('tracking')}
                                                className="bg-black/20 hover:bg-black/30 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                                            >
                                                Track Order ({activeOrder.id})
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Animated Boat Scene on the right */}
                                <div className="relative z-10 shrink-0 w-32 h-24 sm:w-44 sm:h-32 md:w-52 md:h-38 lg:w-64 lg:h-48 flex items-center justify-center -mr-1 sm:mr-2">
                                    <HeroBoat className="w-full h-full" />
                                </div>


                                {/* Decorative Background Elements */}
                                <div className="absolute -right-8 -bottom-8 w-44 h-44 lg:w-60 lg:h-60 rounded-full bg-white/10 pointer-events-none blur-sm" />
                                <div className="absolute -top-10 right-1/4 w-36 h-36 lg:w-48 lg:h-48 rounded-full bg-white/10 pointer-events-none blur-xl" />

                                {/* Stylized Hand-Drawn Animated Ocean Waves (Vector Drawing Style) */}
                                <DrawnWaves className="absolute inset-x-0 bottom-0 h-14 sm:h-18 md:h-20 lg:h-24 z-0 text-amber-50" />
                            </div>

                            {/* Categories Section based directly on reference mockup */}
                            <div className="flex flex-col gap-3">
                                {/* Top Row: Categories Heading & (on narrower viewports) Search Bar going up */}
                                <div className="flex items-center justify-between gap-3 px-1">
                                    <h2 className="font-extrabold text-neutral-900 text-lg sm:text-xl shrink-0">Categories</h2>
                                    {/* Search input when screen is narrower (going up beside Categories, as shown in 2nd pic) */}
                                    <div className="xl:hidden relative flex-1 max-w-[210px] sm:max-w-xs">
                                        <div className="flex items-center px-3 py-1.5 sm:py-2 bg-white rounded-full border border-neutral-200/90 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xs">
                                            <svg className="w-4 h-4 text-neutral-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search dishes..."
                                                className="bg-transparent border-none outline-none text-neutral-800 placeholder-neutral-400 text-xs sm:text-sm w-full focus:outline-none"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery('')}
                                                    className="text-neutral-400 hover:text-neutral-600 p-0.5 text-xs cursor-pointer font-bold ml-1 shrink-0"
                                                    title="Clear search"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Row: Category Pills & (on wide screens like 1st pic) Search Bar aligned with pills */}
                                <div className="flex items-center justify-between gap-4">
                                    {/* Horizontal Scrollable Category Pills */}
                                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-w-0">
                                        {categories.map((cat) => {
                                            const { label } = getCategoryPillData(cat)
                                            const isSelected = selectedCategory === cat || (cat === 'All Menu' && selectedCategory === 'All Menu')
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => handleCategoryClick(cat)}
                                                    className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center whitespace-nowrap transition-all duration-150 cursor-pointer border ${
                                                        isSelected
                                                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30'
                                                            : 'bg-white text-neutral-800 border-neutral-200/90 hover:border-amber-400 hover:bg-amber-50/20'
                                                    }`}
                                                >
                                                    <span>{label}</span>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Search input aligned with category pills (wide screen view, as shown in 1st pic) */}
                                    <div className="hidden xl:block shrink-0 w-64 2xl:w-72">
                                        <div className="flex items-center px-3.5 py-2 sm:py-2.5 bg-white rounded-full border border-neutral-200/90 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xs">
                                            <svg className="w-4 h-4 text-neutral-400 mr-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search dishes..."
                                                className="bg-transparent border-none outline-none text-neutral-800 placeholder-neutral-400 text-xs sm:text-sm w-full focus:outline-none"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchQuery('')}
                                                    className="text-neutral-400 hover:text-neutral-600 p-0.5 text-xs cursor-pointer font-bold ml-1 shrink-0"
                                                    title="Clear search"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Per-Category Horizontal Swipeable Rows & Search */}
                            <div id="menu-display-area" className="flex flex-col gap-8">
                                {searchQuery.trim().length > 0 ? (
                                    /* When search query is active, show Search Results */
                                    filteredItems.length === 0 ? (
                                        <div className="bg-white rounded-2xl p-10 border border-neutral-100 text-center text-neutral-400">
                                            <div className="mx-auto w-10 h-10 mb-2 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg></div>
                                            <p className="font-bold text-neutral-700">No dishes found matching your search</p>
                                            <p className="text-xs text-neutral-400 mt-1">Try searching for other seafood favorites</p>
                                        </div>
                                    ) : (
                                        <CategorySwipeRow
                                            id="search-results-section"
                                            category={`Search Results for "${searchQuery}"`}
                                            items={filteredItems}
                                            renderProductCard={renderProductCard}
                                        />
                                    )
                                ) : (
                                    /* All categories displayed row-by-row; category tabs automatically scroll into view */
                                    availableCategories.map((cat) => {
                                        const catItems = allEffectiveItems.filter((i) => i.category.toLowerCase() === cat.toLowerCase())
                                        if (catItems.length === 0) return null

                                        return (
                                            <CategorySwipeRow
                                                key={cat}
                                                id={`category-section-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                                                category={cat}
                                                items={catItems}
                                                renderProductCard={renderProductCard}
                                            />
                                        )
                                    })
                                )}
                            </div>
                        </main>

                        
                    </div>
                )}

                {/* VIEW 2: CHECKOUT & BILLING PAGE */}
                {activeTab === 'billing' && (
                    <div className="flex flex-col gap-6">
                        {/* Active Verification Banner */}
                        {activeOrder && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-sm text-blue-950 uppercase tracking-wide">Active Order #{activeOrder.id} ({activeOrder.paymentMethod})</span>
                                    </div>
                                    <p className="text-xs text-blue-800 mt-1">
                                        Status: <strong className="font-extrabold text-blue-950">{activeOrder.status}</strong>
                                        {['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(normalizeStatus(activeOrder.status))
                                            ? ' — Confirmed & cooking in kitchen'
                                            : ' — Waiting for staff verification'}
                                    </p>
                                </div>
                                {['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(normalizeStatus(activeOrder.status)) ? (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('tracking')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-2"
                                    >
                                        <span>View Kitchen Tracking</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeOrder.id) {
                                                try {
                                                    localStorage.removeItem(getVerificationDismissalKey(activeOrder.id))
                                                    if ((activeOrder as any).ref) localStorage.removeItem(getVerificationDismissalKey((activeOrder as any).ref))
                                                } catch { }
                                            }
                                            setIsVerificationModalOpen(true)
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-2"
                                    >
                                        <span>Open Payment & Verification Popup</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                            {/* Customer Details Form */}
                            <form
                                onSubmit={handlePlaceOrder}
                                className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 space-y-6"
                            >
                                <h3 className="font-bold text-neutral-800 text-lg border-b border-neutral-100 pb-3">
                                    Delivery & Billing Details
                                </h3>
                                {hasUnavailableCartItems && (
                                    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
                                        <p className="font-extrabold">An item in your cart was just marked Out of Stock by the kitchen.</p>
                                        <button type="button" onClick={handleRemoveUnavailableItems} className="mt-2 rounded-lg bg-rose-600 px-3 py-2 font-bold text-white hover:bg-rose-700">
                                            Remove Unavailable Items
                                        </button>
                                    </div>
                                )}

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
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                            Delivery Address *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleUseCurrentLocation}
                                            disabled={isFindingAddress}
                                            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100 disabled:cursor-wait disabled:opacity-60"
                                        >
                                            {isFindingAddress ? 'Finding location…' : 'Use my current location'}
                                        </button>
                                        {addressCoordinates && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAddressCoordinates(null)
                                                    setDeliveryDistanceKm(null)
                                                    setIsCalculatingDeliveryFee(Boolean(address.trim()))
                                                    setAddressLookupMessage('GPS location pin removed. The rider will use the address text instead.')
                                                }}
                                                className="text-xs font-semibold text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                                            >
                                                Remove location pin
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        required
                                        rows={3}
                                        disabled={isFindingAddress}
                                        placeholder="Enter your complete delivery address"
                                        value={address}
                                        onChange={(e) => {
                                            setAddress(e.target.value)
                                            setAddressLookupMessage('')
                                            if (!addressCoordinates) {
                                                setDeliveryDistanceKm(null)
                                                setIsCalculatingDeliveryFee(Boolean(e.target.value.trim()))
                                                setDeliveryDistanceMessage('')
                                            }
                                        }}
                                        className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                    />
                                    {addressLookupMessage && (
                                        <p role="status" className="text-xs text-neutral-500">
                                            {addressLookupMessage}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-neutral-400">
                                        Address lookup uses OpenStreetMap. Please verify the address before ordering.
                                    </p>
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
                                        Select Payment Method
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* GCash Option */}
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('GCash')}
                                            className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${paymentMethod === 'GCash'
                                                ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-sm'
                                                : 'border-neutral-200 hover:border-neutral-300 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-black text-neutral-900 text-sm">GCash</span>
                                                <span className="text-[10px] font-extrabold bg-blue-500 text-white px-2 py-0.5 rounded-full">E-Wallet</span>
                                            </div>
                                            <p className="text-[11px] font-semibold text-blue-900/80 mt-2 leading-tight">
                                                Pay via GCash: Transfer payment and submit your receipt reference photo for assistant verification.
                                            </p>
                                        </button>

                                        {/* COD Option */}
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('COD')}
                                            className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${paymentMethod === 'COD'
                                                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm'
                                                : 'border-neutral-200 hover:border-neutral-300 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-black text-neutral-900 text-sm">Cash on Delivery</span>
                                                <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">COD</span>
                                            </div>
                                            <p className="text-[11px] font-semibold text-emerald-900/80 mt-2 leading-tight">
                                                Cash on Delivery requires staff product availability verification before order confirmation.
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-3 border-t border-neutral-100">
                                    <button
                                        type="submit"
                                        disabled={isSubmittingOrder || hasUnavailableCartItems}
                                        className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-orange-500/10 transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {isSubmittingOrder ? 'Submitting Order...' : 'Confirm & Submit Order'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('menu')}
                                        className="w-full md:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold px-6 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer"
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
                                        <div key={ci.item.id} className={`py-3 first:pt-0 ${isAvailable(ci.item.id) ? '' : 'rounded-lg bg-rose-50 px-2'}`}>
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-neutral-700">
                                                    {ci.item.name} <span className="text-neutral-400">x{ci.quantity}</span>
                                                </span>
                                                <span className="font-bold text-neutral-800">
                                                    ₱{(ci.item.price * ci.quantity).toLocaleString()}
                                                </span>
                                            </div>
                                            {!isAvailable(ci.item.id) && (
                                                <span className="mt-1 inline-flex rounded-full bg-rose-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">Out of Stock</span>
                                            )}
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
                                        <span>₱{vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-neutral-500">
                                        <span>Delivery Fee {deliveryDistanceLabel && `(${deliveryDistanceLabel})`}</span>
                                        <span>{deliveryFee === null ? 'Unavailable' : `₱${deliveryFee.toLocaleString()}`}</span>
                                    </div>
                                    {deliveryDistanceMessage && (
                                        <p role="status" className="text-[11px] text-amber-700">
                                            {deliveryDistanceMessage}
                                        </p>
                                    )}
                                    <div className="flex justify-between text-base font-extrabold text-neutral-800 pt-3 border-t border-dashed border-neutral-200">
                                        <span>Total Amount</span>
                                        <span className="text-orange-600 text-lg">₱{total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VIEW 3: ORDER STATUS TRACKING */}
                {activeTab === 'tracking' && activeOrder && (
                    <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl border border-neutral-100 shadow-xs p-6 lg:p-8 space-y-8">
                        <div className="border-b border-neutral-100 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">
                                    Order Status Management
                                </p>
                                <h3 className="font-extrabold text-neutral-800 text-2xl mt-1">
                                    Order ID: {activeOrder.id}
                                </h3>
                                <p className="text-xs text-neutral-400 mt-1">Placed at {activeOrder.createdAt}</p>
                            </div>

                            {/* CANCEL ORDER BUTTON (Eligible only when still in queue in kitchen, before PREPARING) */}
                            {(() => {
                                const rawSt = (activeOrder.status || '').toUpperCase()
                                const isCancelled = normalizeStatus(rawSt) === 'CANCELLED'
                                const isOutOfStock = normalizeStatus(rawSt) === 'OUT_OF_STOCK' || outOfStockItems.length > 0
                                const isPreparingOrLater = isOutOfStock || ['PREPARING', 'COOKING', 'IN_PREPARATION', 'IN_PROCESS', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(normalizeStatus(rawSt))

                                if (isCancelled) {
                                    return (
                                        <span className="bg-rose-100 text-rose-800 font-extrabold text-xs px-4 py-2 rounded-xl border border-rose-300">
                                            Order Cancelled
                                        </span>
                                    )
                                }

                                if (!isPreparingOrLater) {
                                    return (
                                        <button
                                            type="button"
                                            onClick={handleCancelOrder}
                                            disabled={isCancellingOrder}
                                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
                                        >
                                            {isCancellingOrder ? 'Cancelling...' : 'Cancel Order'}
                                        </button>
                                    )
                                }

                                return (
                                    <div className="text-right">
                                        <span className="bg-neutral-100 text-neutral-500 font-bold text-xs px-3 py-1.5 rounded-xl border border-neutral-200 inline-block">
                                            {isOutOfStock ? 'Out-of-Stock Decision Needed' : 'Kitchen Processing'}
                                        </span>
                                        <p className="text-[10px] text-neutral-400 mt-1">
                                            {isOutOfStock ? 'Choose a replacement or request a refund below.' : 'Cannot cancel once cooking starts'}
                                        </p>
                                    </div>
                                )
                            })()}
                        </div>

                        {/* GCash Verification Banners & Screenshot Upload */}
                        {activeOrder.status !== 'CANCELLED' && activeOrder.paymentMethod === 'GCash' && (
                            <div className="space-y-4">
                                {['GCASH_PENDING_APPROVAL', 'PENDING'].includes(activeOrder.status) && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 space-y-1">
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                            <span>Staff Verification Required</span>
                                        </div>
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            Your GCash payment requires verification from staff before payment authorization and order confirmation. Please wait for an assistant to authorize your transaction.
                                        </p>
                                    </div>
                                )}

                                {activeOrder.status === 'GCASH_AUTHORIZED' && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-sm text-emerald-800">GCash Payment Authorized by Staff</span>
                                            <span className="text-xs font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">Authorized</span>
                                        </div>
                                        <p className="text-xs text-emerald-700 leading-relaxed">
                                            Staff has authorized your payment. Please transfer <strong className="text-emerald-950 font-black">₱{activeOrder.total.toLocaleString()}</strong> to GCash <strong className="text-emerald-950 font-black">0917-888-7323</strong> and upload your payment screenshot below.
                                        </p>

                                        {/* Upload Screenshot Input */}
                                        <div className="pt-2">
                                            {selectedReceiptPreview ? (
                                                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-3 text-left">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">Preview Reference Picture</span>
                                                        <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">Ready to Submit</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-200">
                                                        <img src={selectedReceiptPreview} alt="Selected GCash Receipt" className="w-16 h-16 object-cover rounded-lg border border-emerald-300 shadow-2xs" />
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-bold text-neutral-800">GCash Payment Screenshot</p>
                                                            <label className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer block">
                                                                Change Selected Picture
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0]
                                                                        if (file) {
                                                                            const reader = new FileReader()
                                                                            reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                                            reader.readAsDataURL(file)
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={handleSubmitReceipt}
                                                            disabled={isSubmittingReceipt}
                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                                                        >
                                                            {isSubmittingReceipt ? 'Submitting...' : 'Submit Payment Receipt'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReceiptPreview(null)}
                                                            className="px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : !activeOrder.paymentReceipt ? (
                                                <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white rounded-xl p-4 cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center transition-all">
                                                    <span className="text-xs font-bold text-emerald-900">Click to select GCash Payment Screenshot</span>
                                                    <span className="text-[10px] text-emerald-600">Attach receipt photo for Assistant review</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) {
                                                                const reader = new FileReader()
                                                                reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                                reader.readAsDataURL(file)
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            ) : (
                                                <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <img src={activeOrder.paymentReceipt} alt="Receipt" className="w-12 h-12 object-cover rounded-lg border" />
                                                        <span className="text-xs font-bold text-emerald-900">Screenshot Uploaded (Pending Review)</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeOrder.status === 'RECEIPT_SUBMITTED' && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-900 space-y-1 text-left">
                                        <p className="font-bold text-sm">Payment Screenshot Uploaded</p>
                                        <p className="text-xs text-blue-700">Staff is currently inspecting your reference screenshot to verify payment.</p>
                                    </div>
                                )}

                                {activeOrder.status === 'RECEIPT_REJECTED' && (
                                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-rose-900 space-y-3 text-left">
                                        <p className="font-extrabold text-sm text-rose-800">Payment Receipt Rejected</p>
                                        <p className="text-xs text-rose-700 leading-relaxed">
                                            {(activeOrder as any).rejectionReason || 'Invalid payment receipt or reference image. Please upload a clear official GCash screenshot.'}
                                        </p>
                                        {selectedReceiptPreview ? (
                                            <div className="bg-white p-3 rounded-xl border border-rose-300 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <img src={selectedReceiptPreview} alt="New Screenshot Preview" className="w-14 h-14 object-cover rounded-lg border" />
                                                    <span className="text-xs font-bold text-neutral-800">New Screenshot Selected</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleSubmitReceipt}
                                                        disabled={isSubmittingReceipt}
                                                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-xs cursor-pointer"
                                                    >
                                                        {isSubmittingReceipt ? 'Re-submitting...' : 'Re-submit Valid GCash Screenshot'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedReceiptPreview(null)}
                                                        className="px-3 bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="inline-block bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-xs transition-colors">
                                                Re-upload Valid GCash Screenshot
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const reader = new FileReader()
                                                            reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COD Verification Banner */}
                        {activeOrder.paymentMethod === 'COD' && activeOrder.status === 'PENDING_COD' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 space-y-1">
                                <p className="font-bold text-sm">Cash on Delivery (COD) Selected</p>
                                <p className="text-xs text-emerald-700">
                                    Cash on Delivery requires staff product availability verification before order confirmation. Staff is checking item availability now...
                                </p>
                            </div>
                        )}

                        {/* Out of Stock Notice Banner */}
                        {normalizeStatus(activeOrder.status) === 'OUT_OF_STOCK' && (
                            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 sm:p-6 text-amber-950 shadow-md space-y-4 animate-in fade-in">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        
                                        <h4 className="text-base sm:text-lg font-black text-amber-900 tracking-tight">Item Unavailable in Kitchen</h4>
                                    </div>
                                    <p className="text-xs sm:text-sm text-amber-800 leading-relaxed font-medium">
                                        The kitchen flagged the following item(s) as out of stock. Choose an available replacement from our menu, or request a full refund.
                                    </p>
                                </div>

                                {(activeOrder.customerResolutionStatus || 'AWAITING_CUSTOMER').toUpperCase() === 'PENDING_ASSISTANT' ? (
                                    <div className="bg-amber-100/90 p-4 rounded-xl border border-amber-300 text-xs text-amber-900 space-y-2">
                                        <p className="font-extrabold text-sm">
                                            {activeOrder.customerResolution === 'REFUND'
                                                ? 'Full refund requested.'
                                                : 'Replacement choices submitted.'}
                                        </p>
                                        <p className="text-xs text-amber-800 font-medium">
                                            {activeOrder.customerResolution === 'REFUND'
                                                ? 'Our restaurant assistant is verifying and processing the refund to your account.'
                                                : 'Our restaurant assistant is reviewing your replacements and preparing them for the kitchen.'}
                                        </p>
                                        {Array.isArray(activeOrder.customerReplacements) && activeOrder.customerReplacements.length > 0 && (
                                            <div className="bg-white/80 p-3 rounded-lg border border-amber-200 text-xs space-y-1">
                                                <span className="font-bold text-neutral-800 block">Submitted Replacements:</span>
                                                {activeOrder.customerReplacements.map((r: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-neutral-700">
                                                        <span>{r.oldItemName} → <span className="font-bold">{r.newName}</span> (x{r.quantity || 1})</span>
                                                        <span className="font-bold">₱{(Number(r.newPrice || 0) * Number(r.quantity || 1)).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {activeOrder.excessAmount ? (
                                            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-900 text-xs flex justify-between items-center">
                                                <span className="font-bold">Excess Refund Due:</span>
                                                <span className="font-black">₱{Number(activeOrder.excessAmount).toLocaleString()}</span>
                                            </div>
                                        ) : null}
                                        {activeOrder.additionalRequired ? (
                                            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-xs flex justify-between items-center">
                                                <span className="font-bold">Additional Required:</span>
                                                <span className="font-black">₱{Number(activeOrder.additionalRequired).toLocaleString()}</span>
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (() => {
                                    const activeItems = (activeOrder.items || []).filter((i: any) =>
                                        !['OUT_OF_STOCK', 'REPLACED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase())
                                    )
                                    const activeSubtotal = activeItems.reduce((acc: number, i: any) =>
                                        acc + ((i.price || i.unit_price || 0) * (i.quantity || 1)), 0
                                    )
                                    const replacementsSubtotal = outOfStockItems.reduce((acc: number, item: any, idx: number) => {
                                        const sel = replacementSelections[String(item.id ?? idx)]
                                        return acc + ((sel?.price || 0) * (item.quantity || 1))
                                    }, 0)
                                    const projectedSubtotal = Math.round((activeSubtotal + replacementsSubtotal) * 100) / 100
                                    const projectedVat = Math.round(projectedSubtotal * 0.12 * 100) / 100
                                    const deliveryFee = Number(activeOrder.deliveryFee || 0)
                                    const projectedTotal = Math.round((projectedSubtotal + projectedVat + deliveryFee) * 100) / 100

                                    const isCOD = String(activeOrder.paymentMethod || '').toUpperCase().includes('COD')
                                        || String(activeOrder.status).toUpperCase() === 'PENDING_COD'

                                    const confirmedPaid = activeOrder.netConfirmedPaid !== undefined
                                        ? Number(activeOrder.netConfirmedPaid)
                                        : (!isCOD ? Number(activeOrder.total) : 0)

                                    const balanceDiff = Math.round((projectedTotal - confirmedPaid) * 100) / 100
                                    const excessAmount = balanceDiff < 0 ? Math.abs(balanceDiff) : 0
                                    const additionalRequired = balanceDiff > 0 ? balanceDiff : 0

                                    const allReplacementsSelected = outOfStockItems.length > 0 && outOfStockItems.every((item: any, idx: number) =>
                                        Boolean(replacementSelections[String(item.id ?? idx)])
                                    )

                                    return (
                                        <div className="space-y-4">
                                            {/* Unavailable Items and Selections */}
                                            <div className="space-y-2.5">
                                                {outOfStockItems.map((item: any, index: number) => {
                                                    const itemKey = String(item.id ?? index)
                                                    const selected = replacementSelections[itemKey]
                                                    const originalUnitPrice = Number(item.price || item.unit_price || 0)
                                                    const qty = Number(item.quantity) || 1

                                                    return (
                                                        <div key={itemKey} className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <span className="text-xs font-bold text-neutral-800">
                                                                        {item.name || item.product_name_snapshot} × {qty}
                                                                    </span>
                                                                    <p className="text-[11px] text-neutral-500">
                                                                        Original Subtotal: ₱{(originalUnitPrice * qty).toLocaleString()}
                                                                    </p>
                                                                </div>
                                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                                                    Out of Stock
                                                                </span>
                                                            </div>

                                                            {selected ? (
                                                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                                    <div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-emerald-600 font-black text-sm">✓</span>
                                                                            <span className="text-xs font-extrabold text-emerald-950">
                                                                                Replacement: {selected.name} × {qty}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                                                                            ₱{(selected.price * qty).toLocaleString()}
                                                                            {selected.price !== originalUnitPrice && (
                                                                                <span className="ml-1.5 font-bold">
                                                                                    ({selected.price > originalUnitPrice
                                                                                        ? `+₱${((selected.price - originalUnitPrice) * qty).toLocaleString()} difference`
                                                                                        : `-₱${((originalUnitPrice - selected.price) * qty).toLocaleString()} savings`})
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setReplacementTargetItem(item)
                                                                            setActiveTab('menu')
                                                                        }}
                                                                        className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-white hover:bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors self-start sm:self-auto"
                                                                    >
                                                                        Change Dish
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="pt-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setReplacementTargetItem(item)
                                                                            setActiveTab('menu')
                                                                        }}
                                                                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                                                                    >
                                                                        Choose Replacement from Menu
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Live Financial Breakdown Card (Shown when replacements selected) */}
                                            {allReplacementsSelected && (
                                                <div className="bg-white border-2 border-orange-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
                                                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                                                        <h5 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                                                            Order Recalculation Breakdown
                                                        </h5>
                                                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                            {isCOD ? 'Cash on Delivery (COD)' : 'GCash Online Payment'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1.5 text-xs">
                                                        <div className="flex justify-between text-neutral-600">
                                                            <span>Original Order Total:</span>
                                                            <span className="font-semibold text-neutral-800">₱{activeOrder.total.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between text-neutral-600">
                                                            <span>Recalculated Order Total:</span>
                                                            <span className="font-black text-neutral-900 text-sm">₱{projectedTotal.toLocaleString()}</span>
                                                        </div>
                                                        {!isCOD && (
                                                            <div className="flex justify-between text-neutral-600">
                                                                <span>Amount Already Paid (GCash):</span>
                                                                <span className="font-semibold text-emerald-700">₱{confirmedPaid.toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Financial Scenario Handling */}
                                                    {isCOD ? (
                                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 space-y-1">
                                                            <p className="font-black text-sm">Cash on Delivery Balance: ₱{projectedTotal.toLocaleString()}</p>
                                                            <p className="text-[11px] text-slate-600">
                                                                No advance online payment or refund required. Your delivery rider will collect the updated amount of ₱{projectedTotal.toLocaleString()} in cash upon delivery.
                                                            </p>
                                                        </div>
                                                    ) : excessAmount > 0 ? (
                                                        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-black text-emerald-900 text-xs sm:text-sm">Excess Refund Due:</span>
                                                                <span className="font-black text-lg text-emerald-700">₱{excessAmount.toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                                                                Your replacement selection is ₱{excessAmount.toLocaleString()} lower than your original payment. Our assistant will transfer this excess back to your GCash with official screenshot proof upon confirming your replacements.
                                                            </p>
                                                        </div>
                                                    ) : additionalRequired > 0 ? (
                                                        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-xs text-amber-950 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-black text-amber-900 text-xs sm:text-sm">Additional Payment Required:</span>
                                                                <span className="font-black text-lg text-amber-700">₱{additionalRequired.toLocaleString()}</span>
                                                            </div>
                                                            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                                                Your replacement dishes total ₱{additionalRequired.toLocaleString()} more than the amount originally paid. Please send ₱{additionalRequired.toLocaleString()} to our official GCash account and upload proof below.
                                                            </p>
                                                            <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs font-mono space-y-0.5">
                                                                <p className="font-black text-neutral-800">GCash Account: 0917-123-4567</p>
                                                                <p className="text-neutral-500 text-[10px]">Merchant Name: Seafudz ng Bayan</p>
                                                            </div>
                                                            <div className="space-y-1.5 bg-white p-3 rounded-xl border border-neutral-200">
                                                                <label className="block text-[11px] font-bold text-neutral-700">
                                                                    Attach Additional Payment Screenshot:
                                                                </label>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={handleAdditionalReceiptChange}
                                                                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                                                                />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Optional GCash Reference # (e.g. 1002 984 1234)"
                                                                    value={additionalRefNumber}
                                                                    onChange={(e) => setAdditionalRefNumber(e.target.value)}
                                                                    className="w-full text-xs px-3 py-2 border border-neutral-200 rounded-lg outline-none focus:border-orange-500 bg-neutral-50"
                                                                />
                                                                {additionalReceiptFile && (
                                                                    <p className="text-[10px] text-emerald-700 font-bold mt-1">✓ Proof screenshot attached</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-700">
                                                            <p className="font-bold">✓ Equal exchange (₱0 Difference). No extra payment or refund needed.</p>
                                                        </div>
                                                    )}

                                                    {/* Submit / Action Buttons */}
                                                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSubmitOutOfStockChoice('REFUND')}
                                                            disabled={isSubmittingOosChoice}
                                                            className="px-4 py-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-extrabold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                                        >
                                                            Request Full Refund Instead
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSubmitOutOfStockChoice('REPLACE')}
                                                            disabled={isSubmittingOosChoice || (!isCOD && additionalRequired > 0 && !additionalReceiptFile)}
                                                            className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
                                                        >
                                                            {isSubmittingOosChoice ? 'Submitting...' : 'Confirm Replacement Choices'}
                                                        </button>
                                                    </div>
                                                    {!isCOD && additionalRequired > 0 && !additionalReceiptFile && (
                                                        <p className="text-[11px] text-rose-600 text-center font-bold">
                                                            * Please attach proof of the additional ₱{additionalRequired.toLocaleString()} payment above.
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {!allReplacementsSelected && (
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSubmitOutOfStockChoice('REFUND')}
                                                        disabled={isSubmittingOosChoice}
                                                        className="w-full py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-extrabold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                                                    >
                                                        Request Full Refund for Order
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {activeOrder.customerResolution === 'REPLACE'
                            && activeOrder.customerResolutionStatus === 'COMPLETED'
                            && normalizeStatus(activeOrder.status) === 'CONFIRMED' && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-emerald-950 space-y-2">
                                    <h4 className="font-extrabold text-sm text-emerald-900">Replacement confirmed</h4>
                                    <p className="text-xs text-emerald-800">Your selected replacements were confirmed and the order has returned to the kitchen.</p>
                                    <div className="space-y-1 text-xs font-semibold">
                                        {(activeOrder.customerReplacements || []).map((replacement: any, index: number) => (
                                            <p key={`${replacement.oldItemId}-${index}`}>
                                                {replacement.oldItemName} → {replacement.newName} (x{replacement.quantity || 1})
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* Order Cancelled / Refunded Banner (Consolidated - Displayed Only Once) */}
                        {normalizeStatus(activeOrder.status) === 'CANCELLED' && (
                            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 sm:p-6 text-rose-950 shadow-md space-y-4 animate-in fade-in">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            
                                            <h4 className="text-base sm:text-lg font-black text-rose-900 tracking-tight">
                                                {activeOrder.customerResolution === 'REFUND' || activeOrder.refundReceipt
                                                    ? 'Order Cancelled & Refunded'
                                                    : 'Order Cancelled'}
                                            </h4>
                                        </div>
                                        <p className="text-xs sm:text-sm text-rose-800 leading-relaxed font-medium">
                                            {activeOrder.customerResolution === 'REFUND' || activeOrder.refundReceipt
                                                ? 'This order was cancelled due to stock unavailability. A 100% refund of your payment has been processed.'
                                                : 'This order was cancelled. No further kitchen preparation or payment will be processed.'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-sm shrink-0 cursor-pointer active:scale-95"
                                    >
                                        {activeOrder.customerResolution === 'REFUND' || activeOrder.refundReceipt
                                            ? 'Make Another Transaction'
                                            : 'Start New Order'}
                                    </button>
                                </div>

                                {/* Refund Transaction Screenshot Proof (Showing Refund Ref #) */}
                                {activeOrder.refundReceipt && (
                                    <div className="bg-white/95 rounded-xl border border-rose-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img
                                                src={activeOrder.refundReceipt}
                                                alt="Refund Transaction Proof"
                                                onClick={() => setPreviewScreenshotUrl(activeOrder.refundReceipt || null)}
                                                className="w-14 h-14 object-cover rounded-lg border border-neutral-300 cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-black text-neutral-900">Refund Transaction Proof</span>
                                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Proof Sent</span>
                                                </div>
                                                <p className="text-[11px] text-neutral-600 leading-snug mt-0.5">
                                                    Attached screenshot showing the refund transaction reference number.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewScreenshotUrl(activeOrder.refundReceipt || null)}
                                            className="px-3 py-1.5 text-xs font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0"
                                        >
                                            View Full Proof
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Order Complete Banner Prompt */}
                        {['COMPLETED', 'DELIVERED', 'SERVED'].includes(normalizeStatus(activeOrder.status)) && (
                            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4 border border-orange-400/30 animate-fade-in">
                                <div className="text-center md:text-left">
                                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">Order Complete!</h4>
                                    <p className="text-xs sm:text-sm text-orange-100 font-medium mt-0.5">
                                        Would you like to make another transaction?
                                    </p>
                                </div>
                                <button
                                    onClick={handleStartNewOrder}
                                    className="w-full md:w-auto bg-white hover:bg-orange-50 text-orange-600 font-extrabold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-sm shrink-0 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <span>Make Another Transaction</span>
                                </button>
                            </div>
                        )}

                        {/* Progress Bar */}
                        {normalizeStatus(activeOrder.status) !== 'CANCELLED' && (
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
                                                        : normalizeStatus(activeOrder.status) === 'OUT_OF_STOCK'
                                                            ? '30%'
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
                                        { key: 'PENDING', label: 'Order Placed', desc: 'Awaiting Assistant Verification' },
                                        { key: 'CONFIRMED', label: 'Confirmed', desc: 'Sent to Kitchen Queue' },
                                        { key: 'PREPARING', label: 'Preparing', desc: 'Chef in the Kitchen' },
                                        { key: 'READY', label: 'Order Ready', desc: 'Waiting for Rider' },
                                        { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Rider is en route' },
                                        { key: 'COMPLETED', label: 'Delivered', desc: 'Order Completed' },
                                    ].map((step) => {
                                        const statusOrder = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
                                        const currUpper = normalizeStatus(activeOrder.status)
                                        const isCurrent = currUpper === step.key
                                        const isCompleted =
                                            statusOrder.indexOf(currUpper) >= statusOrder.indexOf(step.key)

                                        return (
                                            <div key={step.key} className="flex flex-col items-center z-10 relative">
                                                <div
                                                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm font-extrabold border-2 shadow-xs transition-all duration-300 ${isCurrent
                                                        ? 'bg-orange-500 border-orange-500 text-white scale-110 ring-4 ring-orange-100'
                                                        : isCompleted
                                                            ? 'bg-orange-500 border-orange-500 text-white'
                                                            : 'bg-white border-neutral-200 text-neutral-400'
                                                        }`}
                                                >
                                                    ●
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
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="bg-neutral-50 rounded-2xl p-5 border border-neutral-200/50 space-y-3">
                                <h4 className="font-bold text-neutral-800 text-sm">Delivery Info</h4>
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
                                <h4 className="font-bold text-neutral-800 text-sm">Billing & Payment Details</h4>
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

                                    {/* Refund Transaction Screenshot Proof */}
                                    {activeOrder.refundReceipt && (
                                        <div className="pt-2 border-t border-rose-200">
                                            <span className="font-black text-rose-800 uppercase text-[10px] block mb-1 tracking-wider">
                                                Refund Transaction Proof:
                                            </span>
                                            <div className="bg-white p-2.5 rounded-xl border border-rose-200 flex items-center justify-between gap-3 shadow-2xs">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <img
                                                        src={activeOrder.refundReceipt}
                                                        alt="Refund Transaction Screenshot"
                                                        onClick={() => setPreviewScreenshotUrl(activeOrder.refundReceipt || null)}
                                                        className="w-12 h-12 object-cover rounded-lg border border-rose-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-neutral-800 truncate">Refund Reference Screenshot</p>
                                                        <p className="text-[10px] text-neutral-500">Shows refund transaction ref #</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewScreenshotUrl(activeOrder.refundReceipt || null)}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors shrink-0"
                                                >
                                                    View
                                                </button>
                                            </div>
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
                    <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-white text-neutral-900 rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-neutral-200/90 backdrop-blur-md">
                        <div className="flex flex-col">
                            <span className="text-xs text-neutral-500 font-bold uppercase tracking-wide">
                                {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)} Items Added
                            </span>
                            <span className="text-lg font-extrabold text-orange-600">
                                ₱{total.toLocaleString()}
                            </span>
                        </div>
                        <button
                            onClick={() => setIsCartDrawerOpen(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 cursor-pointer active:scale-95 transition-all"
                        >
                            View Cart
                        </button>
                    </div>
                )}

                {/* Centered Cart Modal Dialog (Middle View) */}
                {isCartDrawerOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
                            onClick={() => setIsCartDrawerOpen(false)}
                            aria-hidden="true"
                        />

                        {/* Centered Modal Card */}
                        <div className="relative w-full max-w-lg md:max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-neutral-100 z-10">
                            {/* Header */}
                            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-white z-10 shrink-0">
                                <div>
                                    <h3 className="font-extrabold text-neutral-800 text-lg leading-tight flex items-center gap-2">
                                        Your Cart
                                            {cartItems.length > 0 && (
                                                <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-2xs">
                                                    {cartItems.reduce((acc, ci) => acc + ci.quantity, 0)} items
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-xs text-neutral-400 font-medium">Review your fresh seafood items</p>
                                </div>
                                <button
                                    onClick={() => setIsCartDrawerOpen(false)}
                                    className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
                                    aria-label="Close cart"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Items List (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                                {cartItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-400">
                                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3 border border-amber-100">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                            </svg>
                                        </div>
                                        <p className="text-base font-extrabold text-neutral-800">Your cart is empty</p>
                                        <p className="text-xs text-neutral-400 mt-1 max-w-[240px]">Explore our mouthwatering seafood menu and start adding dishes!</p>
                                        <button
                                            type="button"
                                            onClick={() => setIsCartDrawerOpen(false)}
                                            className="mt-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                                        >
                                            Browse Menu
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3.5 divide-y divide-neutral-100">
                                        {cartItems.map((ci) => (
                                            <div
                                                key={ci.item.id}
                                                className={`pt-3.5 first:pt-0 ${
                                                    isAvailable(ci.item.id)
                                                        ? ''
                                                        : 'rounded-2xl border border-rose-300 bg-rose-50 p-3'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3.5">
                                                    {/* Item picture */}
                                                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100 shadow-2xs">
                                                        <ProductImage
                                                            src={ci.item.image}
                                                            fallbackSrc={ci.item.bundledImage}
                                                            alt={ci.item.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>

                                                    {/* Info & Quantity */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="font-bold text-neutral-800 text-sm sm:text-base leading-snug truncate">
                                                                {ci.item.name}
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setCartItems((prev) => prev.filter((c) => c.item.id !== ci.item.id))}
                                                                className="text-neutral-400 hover:text-rose-600 transition-colors p-1 cursor-pointer shrink-0 rounded-lg hover:bg-rose-50"
                                                                title="Remove item"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        {!isAvailable(ci.item.id) && (
                                                            <span className="mt-0.5 inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                                                                Out of Stock
                                                            </span>
                                                        )}
                                                        <div className="flex items-center justify-between mt-2.5">
                                                            <p className="text-sm text-orange-600 font-extrabold">
                                                                ₱{(ci.item.price * ci.quantity).toLocaleString()}
                                                            </p>
                                                            <CartQuantityControl
                                                                quantity={ci.quantity}
                                                                onIncrement={() => handleIncrement(ci.item.id)}
                                                                onDecrement={() => handleDecrement(ci.item.id)}
                                                                onSetQuantity={(q) => handleSetQuantity(ci.item.id, q)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Instruction Note */}
                                                <div className="mt-2.5 bg-neutral-50 rounded-xl p-2 sm:p-2.5">
                                                    {editingNoteItemId === ci.item.id ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={tempNote}
                                                                onChange={(e) => setTempNote(e.target.value)}
                                                                placeholder="e.g. less spicy, sauce on side..."
                                                                className="text-xs bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:border-orange-500"
                                                            />
                                                            <button
                                                                onClick={() => handleSaveNote(ci.item.id)}
                                                                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-600 transition-colors"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <p className="text-neutral-500 italic text-[11px] leading-tight truncate">
                                                                {ci.specialNote ? `"${ci.specialNote}"` : 'No special requests'}
                                                            </p>
                                                            <button
                                                                onClick={() => handleStartEditingNote(ci.item.id, ci.specialNote)}
                                                                className="text-orange-600 hover:text-orange-700 font-bold text-[11px] cursor-pointer shrink-0 ml-2"
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

                                {hasUnavailableCartItems && (
                                    <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 mt-3">
                                        <p className="font-extrabold">An item in your cart was just marked Out of Stock by the kitchen.</p>
                                        <button
                                            type="button"
                                            onClick={handleRemoveUnavailableItems}
                                            className="mt-2 rounded-xl bg-rose-600 px-3.5 py-1.5 font-bold text-white hover:bg-rose-700 text-xs cursor-pointer transition-colors"
                                        >
                                            Remove Unavailable Items
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer Summary & Checkout */}
                            {cartItems.length > 0 && (
                                <div className="border-t border-neutral-100 p-4 sm:p-5 bg-neutral-50/70 space-y-3.5 shrink-0">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Subtotal</span>
                                            <span className="font-semibold text-neutral-800">₱{subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>VAT (12%)</span>
                                            <span className="font-semibold text-neutral-800">₱{vat.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Delivery Fee {deliveryDistanceLabel && `(${deliveryDistanceLabel})`}</span>
                                            <span className="font-semibold text-neutral-800">{deliveryFee === null ? 'Unavailable' : `₱${deliveryFee.toLocaleString()}`}</span>
                                        </div>
                                        {deliveryDistanceMessage && (
                                            <p role="status" className="text-[11px] text-amber-700">
                                                {deliveryDistanceMessage}
                                            </p>
                                        )}
                                        <div className="flex justify-between text-base font-extrabold text-neutral-800 pt-2 border-t border-dashed border-neutral-200">
                                            <span>Total Amount</span>
                                            <span className="text-orange-600 font-black">₱{total.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsCartDrawerOpen(false)
                                            handleProceedToCheckout()
                                        }}
                                        disabled={hasUnavailableCartItems || cartItems.length === 0}
                                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all duration-200 text-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <span>Proceed to Checkout</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 1. WAITING FOR ASSISTANT AUTHORIZATION POPUP MODAL */}
            {isWaitingModalOpen && activeOrder && !['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(normalizeStatus(activeOrder.status)) && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 text-neutral-800 space-y-6 relative my-8 animate-in zoom-in-95 duration-200 text-center">
                        <button
                            onClick={() => setIsWaitingModalOpen(false)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
                        >
                            ✕
                        </button>

                        <div className="text-center space-y-1">
                            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-md shadow-amber-500/20 animate-pulse">
                                
                            </div>
                            <h3 className="font-extrabold text-neutral-900 text-xl tracking-tight pt-2">
                                Order #{activeOrder.id} Submitted
                            </h3>
                            <p className="text-xs font-semibold text-neutral-500">
                                Your order is currently waiting for staff verification.
                            </p>
                        </div>

                        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-center space-y-3">
                            <h4 className="font-extrabold text-amber-950 text-sm">Please Wait for Assistant Authorization</h4>
                            <p className="text-xs text-amber-800 leading-relaxed">
                                Your order has been sent to our Floor Assistant. Please wait while staff authorizes your payment request before transferring funds.
                            </p>
                            <div className="bg-white/90 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-900 font-medium leading-relaxed">
                                The GCash payment pop-up will automatically appear on your screen once an assistant approves your order.
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => setIsWaitingModalOpen(false)}
                                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
                            >
                                Keep Waiting in Billing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. AUTHORIZED GCASH PAYMENT POPUP MODAL (Pops up when assistant authorizes) */}
            {isVerificationModalOpen && activeOrder && !['CONFIRMED', 'PENDING_PREPARATION', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].includes(normalizeStatus(activeOrder.status)) && !isVerificationModalDismissed(activeOrder.id) && !isVerificationModalDismissed((activeOrder as any).ref) && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 text-neutral-800 space-y-6 relative my-8 animate-in zoom-in-95 duration-200">
                        {/* Close button */}
                        <button
                            onClick={dismissVerificationModal}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold flex items-center justify-center text-sm cursor-pointer transition-colors"
                        >
                            ✕
                        </button>

                        {/* Modal Header */}
                        <div className="text-center space-y-1">
                            <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-md shadow-orange-500/20">
                                
                            </div>
                            <h3 className="font-extrabold text-neutral-900 text-xl tracking-tight pt-2">
                                Order #{activeOrder.id} Submitted
                            </h3>
                            <p className="text-xs font-semibold text-neutral-500">
                                Your order is currently waiting for staff verification.
                            </p>
                        </div>

                        {/* GCASH VERIFICATION & PAYMENT POPUP MODAL */}
                        {activeOrder.paymentMethod === 'GCash' && (
                            <div className="space-y-4 text-left animate-in zoom-in-95 duration-200">
                                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-center animate-in fade-in duration-300">
                                    <span className="text-xs font-black text-emerald-950 flex items-center justify-center gap-1.5">
                                        GCash Payment Authorized by Assistant!
                                    </span>
                                </div>

                                {/* Store GCash Account Details Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">Store GCash Account</span>
                                        <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">Official Account</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-blue-950">
                                        <p><span className="text-blue-700 font-medium">Account Name:</span> <strong className="font-black text-sm text-neutral-900">SEAFUDZ RESTAURANT PH</strong></p>
                                        <p><span className="text-blue-700 font-medium">GCash Number:</span> <strong className="font-black text-base text-blue-700 tracking-wider">0917-888-7323</strong></p>
                                        <p><span className="text-blue-700 font-medium">Amount to Pay:</span> <strong className="font-black text-base text-orange-600">₱{activeOrder.total.toLocaleString()}</strong></p>
                                    </div>
                                </div>

                                {/* Reference Screenshot Selection Input */}
                                <div className="space-y-2 pt-1">
                                    <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                                        <span>Upload GCash Reference Picture / Screenshot</span>
                                        <span className="text-[11px] font-medium text-neutral-400">Proof of Payment</span>
                                    </label>

                                    {activeOrder.status === 'RECEIPT_REJECTED' && (
                                        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-xs text-rose-800 font-semibold space-y-1">
                                            <p className="font-extrabold text-rose-900">Reference Screenshot Rejected by Staff</p>
                                            <p className="text-[11px] text-rose-700 leading-relaxed">{(activeOrder as any).rejectionReason || 'Invalid reference picture. Please re-upload a clear official GCash confirmation screenshot.'}</p>
                                        </div>
                                    )}

                                    {activeOrder.status === 'RECEIPT_SUBMITTED' && !selectedReceiptPreview && (
                                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-blue-900 font-extrabold text-xs">
                                                Payment Screenshot Submitted
                                            </div>
                                            <p className="text-xs text-blue-800 leading-relaxed">
                                                Your reference screenshot was received by staff. Please wait in billing while an assistant verifies payment and confirms your order to the kitchen.
                                            </p>
                                        </div>
                                    )}

                                    {selectedReceiptPreview ? (
                                        <div className="bg-blue-50/80 border-2 border-blue-400 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200 text-left">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-blue-950 uppercase tracking-wider">Preview Reference Picture</span>
                                                <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">Ready to Submit</span>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-blue-200">
                                                <img src={selectedReceiptPreview} alt="Selected GCash Receipt" className="w-16 h-16 object-cover rounded-lg border border-blue-300 shadow-2xs" />
                                                <div className="space-y-1">
                                                    <p className="text-xs font-bold text-neutral-800">GCash Payment Screenshot</p>
                                                    <label className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer block">
                                                        Change Selected Picture
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0]
                                                                if (file) {
                                                                    const reader = new FileReader()
                                                                    reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                                    reader.readAsDataURL(file)
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleSubmitReceipt}
                                                    disabled={isSubmittingReceipt}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                                                >
                                                    {isSubmittingReceipt ? 'Submitting...' : 'Submit Payment Receipt'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedReceiptPreview(null)}
                                                    className="px-4 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : !activeOrder.paymentReceipt ? (
                                        <label className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/30 hover:bg-blue-50/80 rounded-2xl p-5 cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-all">
                                            
                                            <span className="text-xs font-bold text-neutral-800">Select & Place Payment Receipt Screenshot</span>
                                            <span className="text-[10px] text-neutral-500">Attach screenshot of your completed GCash transaction</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) {
                                                        const reader = new FileReader()
                                                        reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                        reader.readAsDataURL(file)
                                                    }
                                                }}
                                            />
                                        </label>
                                    ) : (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 text-left">
                                            <div className="flex items-center gap-3">
                                                <img src={activeOrder.paymentReceipt} alt="Reference Screenshot" className="w-16 h-16 object-cover rounded-xl border border-emerald-300 shadow-2xs" />
                                                <div>
                                                    <p className="text-xs font-black text-emerald-900">Reference Screenshot Placed</p>
                                                    <p className="text-[10px] text-emerald-700 font-semibold">Submitted for Staff Inspection</p>
                                                </div>
                                            </div>
                                            <label className="block w-full text-center bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold text-xs py-2 rounded-xl cursor-pointer transition-colors">
                                                Change Reference Picture
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            const reader = new FileReader()
                                                            reader.onloadend = () => setSelectedReceiptPreview(reader.result as string)
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* COD Verification Details */}
                        {activeOrder.paymentMethod === 'COD' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
                                <span className="text-xs font-black text-emerald-900 uppercase">Cash on Delivery Verification</span>
                                <p className="text-xs text-emerald-800 leading-relaxed">
                                    Cash on Delivery requires staff product availability verification before order confirmation. Staff is checking item availability now...
                                </p>
                            </div>
                        )}

                        {/* Confirmed / Sent to Kitchen Status */}
                        {['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes((activeOrder.status || '').toUpperCase()) && (
                            <div className="bg-emerald-500 text-white rounded-2xl p-4 text-center space-y-2 shadow-md">
                                <p className="font-extrabold text-sm">Order Confirmed & Approved by Staff!</p>
                                <p className="text-xs text-emerald-100">Your order is now being prepared in the kitchen.</p>
                                <button
                                    onClick={() => {
                                        dismissVerificationModal()
                                        setActiveTab('tracking')
                                    }}
                                    className="bg-white text-emerald-900 font-extrabold text-xs px-4 py-2 rounded-xl mt-2 cursor-pointer shadow-xs hover:bg-emerald-50 transition-all"
                                >
                                    View Kitchen & Delivery Tracker
                                </button>
                            </div>
                        )}

                        <div className="pt-2 flex gap-3">
                            <button
                                onClick={dismissVerificationModal}
                                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
                            >
                                Keep Waiting in Billing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Required for Checkout Modal */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-100 relative text-center">
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
                                <span>Login / Register Now</span>
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
            {/* Refund Transaction Proof Fullscreen Modal */}
            {previewScreenshotUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
                    onClick={() => setPreviewScreenshotUrl(null)}
                >
                    <div
                        className="relative max-w-xl w-full bg-white rounded-2xl p-4 space-y-3 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                            <div>
                                <h4 className="text-sm font-black text-neutral-800">Refund Transaction Proof</h4>
                                <p className="text-[11px] text-neutral-500">Screenshot showing refund transaction reference number</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewScreenshotUrl(null)}
                                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 cursor-pointer text-lg font-bold leading-none"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-neutral-900 rounded-xl p-2">
                            <img
                                src={previewScreenshotUrl}
                                alt="Refund Transaction Proof Full Screenshot"
                                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-md"
                            />
                        </div>
                        <div className="text-center pt-1">
                            <button
                                type="button"
                                onClick={() => setPreviewScreenshotUrl(null)}
                                className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
                    {/* Flying delivery animation elements */}
            {flyingItems.map((fi) => (
                <div
                    key={fi.id}
                    className="fixed z-[9999] pointer-events-none animate-deliver-flight"
                    style={
                        {
                            left: `${fi.startX}px`,
                            top: `${fi.startY}px`,
                            '--target-x': `${fi.targetX - fi.startX}px`,
                            '--target-y': `${fi.targetY - fi.startY}px`,
                        } as React.CSSProperties
                    }
                >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-2xl border-2 border-white flex items-center justify-center overflow-hidden ring-4 ring-amber-500/25">
                        {fi.image ? (
                            <img src={fi.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                            </svg>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default OnlineCustomer
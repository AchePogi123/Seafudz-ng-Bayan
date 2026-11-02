import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import NavbarCustomer from '../components/NavbarCustomer'
import NavbarAdmin from '../components/NavbarAdmin'
import NavbarAssistant from '../components/NavbarAssistant'
import NavbarCashier from '../components/NavbarCashier'
import NavbarKitchen from '../components/NavbarKitchen'
import NavbarRider from '../components/Navbarrider'
import { getActiveUser, saveActiveUser, isUuidString } from '../cryptography/cryptoSession'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { supabase } from '../utils/supabase'
import { normalizeStatus } from './OnlineCustomer'
import { subscribeOrderSync } from '../utils/orderSync'
import { reverseGeocodeCoordinates } from '../utils/locationServices'

interface OrderItem {
    id?: string | number
    name?: string
    product_name_snapshot?: string
    quantity: number
    price?: number
    unit_price?: number
    item_status?: string
    image?: string
    bundledImage?: string
    item?: {
        id?: string | number
        name?: string
        price?: number
        image?: string
        category?: string
        description?: string
    }
}

interface CustomerOrder {
    id: string
    ref?: string
    customerName?: string
    customer?: string
    phone?: string
    customer_phone?: string
    address?: string
    deliveryAddress?: string
    delivery_address?: string
    paymentMethod?: string
    payment_method?: string
    paymentReference?: string
    referenceNumber?: string
    paymentReceipt?: string
    refundReceipt?: string
    refundReference?: string
    notes?: string
    items: OrderItem[]
    subtotal?: number
    vat?: number
    deliveryFee?: number
    delivery_fee?: number
    total: number
    status: string
    gcashAuthorized?: boolean
    customerResolution?: string | null
    customerResolutionStatus?: string
    outOfStockItems?: any[]
    createdAt?: string
    created_at?: string
    updatedAt?: string
    updated_at?: string
    riderName?: string
    riderPhone?: string
}

interface UserProfile {
    fullName: string
    username: string
    phone: string
    email: string
    address: string
    avatar: string
    membershipTier: 'Gold' | 'Silver' | 'Bronze'
    points: number
    joinedDate: string
}

export const AccMan: React.FC = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const tabParam = searchParams.get('tab') || searchParams.get('section')

    // Navigation / Tab states (supports ?tab=orders directly)
    const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications' | 'orders'>(() => {
        if (tabParam === 'orders' || tabParam === 'history') return 'orders'
        if (tabParam === 'security') return 'security'
        if (tabParam === 'notifications') return 'notifications'
        return 'profile'
    })

    useEffect(() => {
        if (tabParam === 'orders' || tabParam === 'history') {
            setActiveSection('orders')
        } else if (tabParam === 'security') {
            setActiveSection('security')
        } else if (tabParam === 'notifications') {
            setActiveSection('notifications')
        } else if (tabParam === 'profile') {
            setActiveSection('profile')
        }
    }, [tabParam])

    const handleSelectSection = (sec: 'profile' | 'security' | 'notifications' | 'orders') => {
        setActiveSection(sec)
        if (sec === 'orders') {
            setSearchParams({ tab: 'orders' })
        } else if (sec === 'profile') {
            setSearchParams({})
        } else {
            setSearchParams({ tab: sec })
        }
    }

    // Profile picture upload states
    const avatarInputRef = useRef<HTMLInputElement | null>(null)
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

    // Helper to get stored avatar from user session or localStorage
    const getStoredAvatar = (user: ReturnType<typeof getActiveUser>) => {
        if (!user) return ''
        const key = user.id || user.email || user.username || 'user'
        try {
            return user.avatar || localStorage.getItem(`sfb_user_avatar_${key}`) || ''
        } catch {
            return user.avatar || ''
        }
    }

    const handleAvatarClick = () => {
        avatarInputRef.current?.click()
    }

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Please select an image file (PNG, JPG, WEBP).' })
            return
        }

        if (file.size > 8 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Image file size must be less than 8MB.' })
            return
        }

        setIsUploadingAvatar(true)
        const reader = new FileReader()
        reader.onload = (event) => {
            const rawDataUrl = event.target?.result as string
            if (!rawDataUrl) {
                setIsUploadingAvatar(false)
                return
            }

            // Downscale to max 400x400 via canvas to keep it lightweight, fast, and prevent storage overflow
            const img = new Image()
            img.onload = () => {
                const maxDim = 400
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round((height * maxDim) / width)
                        width = maxDim
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round((width * maxDim) / height)
                        height = maxDim
                    }
                }

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height)
                    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88)

                    // 1. Update React profile state
                    setProfile((prev) => ({ ...prev, avatar: optimizedDataUrl }))
                    setEditForm((prev) => ({ ...prev, avatar: optimizedDataUrl }))

                    // 2. Persist in active user session & localStorage
                    const active = getActiveUser()
                    if (active) {
                        const updated = { ...active, avatar: optimizedDataUrl }
                        saveActiveUser(updated)
                        const key = active.id || active.email || active.username || 'user'
                        try {
                            localStorage.setItem(`sfb_user_avatar_${key}`, optimizedDataUrl)
                        } catch { }
                    }

                    // 3. Dispatch events to notify other components (e.g., SidebarDrawer)
                    window.dispatchEvent(new Event('storage'))
                    window.dispatchEvent(new CustomEvent('sfb_avatar_changed', { detail: optimizedDataUrl }))

                    // 4. Background attempt to persist to backend profile
                    void (async () => {
                        try {
                            const authHeaders = await getAuthHeaders()
                            await fetch(`${API_BASE_URL}/auth/profile`, {
                                method: 'PUT',
                                headers: authHeaders,
                                body: JSON.stringify({
                                    id: active?.id,
                                    email: active?.email,
                                    avatar: optimizedDataUrl,
                                }),
                            })
                        } catch { }
                    })()

                    setMessage({ type: 'success', text: 'Profile picture updated successfully!' })
                    setIsUploadingAvatar(false)
                } else {
                    setIsUploadingAvatar(false)
                }
            }
            img.onerror = () => {
                setIsUploadingAvatar(false)
                setMessage({ type: 'error', text: 'Could not process selected image.' })
            }
            img.src = rawDataUrl
        }
        reader.onerror = () => {
            setIsUploadingAvatar(false)
            setMessage({ type: 'error', text: 'Error reading image file.' })
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    // Initial user profile data from session user or empty state
    const [profile, setProfile] = useState<UserProfile>(() => {
        const active = getActiveUser()
        const savedAvatar = getStoredAvatar(active)
        return {
            fullName: active?.fullname || '',
            username: active?.username || '',
            phone: active?.phone || '',
            email: active?.email || '',
            address: active?.address || '',
            avatar: savedAvatar || '',
            membershipTier: 'Bronze',
            points: 0,
            joinedDate: active ? 'Active' : '-',
        }
    })

    // Edit form states (shadow state to allow cancel/reset)
    const [editForm, setEditForm] = useState<UserProfile>({ ...profile })

    const fetchedProfileRef = useRef(false)

    useEffect(() => {
        const active = getActiveUser()
        if (active) {
            const savedAvatar = getStoredAvatar(active)
            const initial = {
                fullName: active.fullname || '',
                username: active.username || '',
                phone: active.phone || '',
                email: active.email || '',
                address: active.address || '',
                avatar: savedAvatar || '',
                membershipTier: 'Bronze' as const,
                points: 0,
                joinedDate: 'Active',
            }
            setProfile(initial)
            setEditForm(initial)

            if (fetchedProfileRef.current) return
            fetchedProfileRef.current = true

            // Fetch latest user profile from PostgreSQL DB
            const cleanEmail = active.email || ''
            const cleanId = active.id || ''
            const role = active.role || ''
            if (cleanEmail || cleanId) {
                fetch(`${API_BASE_URL}/auth/me-profile?email=${encodeURIComponent(cleanEmail)}&id=${encodeURIComponent(cleanId)}&role=${encodeURIComponent(role)}`)
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.success && data.data) {
                            const dbUser = data.data
                            const currentAvatar = dbUser.avatar || active.avatar || savedAvatar || ''
                            const updatedActive = {
                                ...active,
                                id: dbUser.id || active.id,
                                fullname: dbUser.fullname || dbUser.fullName || active.fullname,
                                username: dbUser.username || active.username,
                                phone: dbUser.phone || active.phone,
                                email: dbUser.email || active.email,
                                address: dbUser.address || dbUser.delivery_address || active.address,
                                avatar: currentAvatar,
                            }
                            if (
                                updatedActive.fullname !== active.fullname ||
                                updatedActive.username !== active.username ||
                                updatedActive.phone !== active.phone ||
                                updatedActive.email !== active.email ||
                                updatedActive.address !== active.address ||
                                updatedActive.avatar !== active.avatar
                            ) {
                                saveActiveUser(updatedActive)
                            }
                            const updated = {
                                fullName: updatedActive.fullname || '',
                                username: updatedActive.username || '',
                                phone: updatedActive.phone || '',
                                email: updatedActive.email || '',
                                address: updatedActive.address || '',
                                avatar: currentAvatar,
                                membershipTier: 'Bronze' as const,
                                points: 0,
                                joinedDate: 'Active',
                            }
                            setProfile(updated)
                            setEditForm(updated)
                        }
                    })
                    .catch(() => { })
            }
        }
    }, [])
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [isRelocating, setIsRelocating] = useState(false)
    const [relocateMessage, setRelocateMessage] = useState('')

    // Password fields (for Security tab)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Shopee-style Email Change Modal states
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
    const [newEmailInput, setNewEmailInput] = useState('')
    const [emailOtpInput, setEmailOtpInput] = useState('')
    const [isSendingOtp, setIsSendingOtp] = useState(false)
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
    const [otpCooldown, setOtpCooldown] = useState(0)
    const [otpSent, setOtpSent] = useState(false)
    const [emailModalError, setEmailModalError] = useState<string | null>(null)
    const [emailModalSuccess, setEmailModalSuccess] = useState<string | null>(null)

    // Cooldown countdown for 60-second Shopee resend timer
    useEffect(() => {
        if (otpCooldown <= 0) return
        const timer = setInterval(() => {
            setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0))
        }, 1000)
        return () => clearInterval(timer)
    }, [otpCooldown])

    // Notification states
    const [emailAlerts, setEmailAlerts] = useState(() => {
        try {
            const raw = localStorage.getItem('sfb_user_notifications')
            if (raw) return JSON.parse(raw).emailAlerts ?? true
        } catch { }
        return true
    })
    const [smsAlerts, setSmsAlerts] = useState(() => {
        try {
            const raw = localStorage.getItem('sfb_user_notifications')
            if (raw) return JSON.parse(raw).smsAlerts ?? true
        } catch { }
        return true
    })
    const [promoAlerts, setPromoAlerts] = useState(() => {
        try {
            const raw = localStorage.getItem('sfb_user_notifications')
            if (raw) return JSON.parse(raw).promoAlerts ?? false
        } catch { }
        return false
    })

    // Handlers
    const handleProfileChange = (field: keyof UserProfile, value: string) => {
        setEditForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleRelocate = () => {
        if (!navigator.geolocation) {
            setRelocateMessage('Geolocation is not supported by your browser.')
            return
        }

        setIsRelocating(true)
        setRelocateMessage('')

        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const currentCoordinates = { lat: coords.latitude, lng: coords.longitude }
                try {
                    const resolvedAddress = await reverseGeocodeCoordinates(currentCoordinates)
                    handleProfileChange('address', resolvedAddress)
                    setRelocateMessage('Location detected! Click "Save Profile Changes" to save it to database.')
                } catch (error) {
                    const fallback = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`
                    handleProfileChange('address', fallback)
                    setRelocateMessage(
                        `${error instanceof Error ? error.message : 'Could not resolve address.'} Coordinates were added instead. Click "Save Profile Changes" to save.`
                    )
                } finally {
                    setIsRelocating(false)
                }
            },
            (error) => {
                setIsRelocating(false)
                setRelocateMessage(
                    error.code === 1
                        ? 'Location permission was denied. You can enter your delivery address manually.'
                        : 'Could not get your location. Please check your device location settings.'
                )
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        )
    }

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setMessage(null)

        const currentActive = getActiveUser()

        try {
            const authHeaders = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({
                    id: currentActive?.id,
                    originalEmail: currentActive?.email,
                    fullname: editForm.fullName,
                    username: editForm.username,
                    phone: editForm.phone,
                    email: editForm.email,
                    address: editForm.address,
                    avatar: editForm.avatar || profile.avatar,
                    role: currentActive?.role || 'customer',
                }),
            })

            const responseData = await res.json().catch(() => ({}))

            if (res.ok && responseData.success) {
                const dbUser = responseData.data || {}
                const updatedFullName = dbUser.fullname || editForm.fullName
                const updatedUsername = dbUser.username || editForm.username
                const updatedPhone = dbUser.phone || editForm.phone
                const updatedEmail = dbUser.email || editForm.email
                const updatedAddress = dbUser.address || dbUser.delivery_address || editForm.address

                const finalProfile: UserProfile = {
                    ...editForm,
                    fullName: updatedFullName,
                    username: updatedUsername,
                    phone: updatedPhone,
                    email: updatedEmail,
                    address: updatedAddress,
                }

                setProfile(finalProfile)
                setEditForm(finalProfile)

                if (currentActive) {
                    saveActiveUser({
                        ...currentActive,
                        id: dbUser.id || currentActive.id,
                        fullname: updatedFullName,
                        username: updatedUsername,
                        phone: updatedPhone,
                        email: updatedEmail,
                        address: updatedAddress,
                    })
                }
                window.dispatchEvent(new Event('seafudz_profile_updated'))
                setRelocateMessage('')
                setMessage({ type: 'success', text: responseData.message || 'Personal details saved to database successfully!' })
            } else {
                const errorMsg = responseData.message || responseData.error || 'Failed to update personal details in database.'
                setMessage({ type: 'error', text: errorMsg })
            }
        } catch (err: any) {
            console.error('Error saving profile to database:', err)
            setMessage({ type: 'error', text: err?.message || 'Failed to connect to the server.' })
        } finally {
            setIsSaving(false)
            setTimeout(() => setMessage(null), 4000)
        }
    }

    const handleResetProfile = () => {
        setEditForm({ ...profile })
        setRelocateMessage('')
        setMessage(null)
    }

    const handleSaveSecurity = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters long.' })
            return
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' })
            return
        }
        setIsSaving(true)
        setMessage(null)

        try {
            const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                }),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                // Fallback to client-side Supabase Auth updateUser if backend fails
                const { error: sbErr } = await supabase.auth.updateUser({ password: newPassword })
                if (sbErr) {
                    throw new Error(data.message || sbErr.message || 'Failed to update password.')
                }
            }

            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setMessage({ type: 'success', text: 'Password updated successfully! You can now log in with your new password.' })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to change password. Please try logging in again.'
            setMessage({ type: 'error', text: msg })
        } finally {
            setIsSaving(false)
            setTimeout(() => setMessage(null), 5000)
        }
    }

    const handleSaveNotifications = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setMessage(null)

        try {
            const prefs = { emailAlerts, smsAlerts, promoAlerts }
            localStorage.setItem('sfb_user_notifications', JSON.stringify(prefs))
            setIsSaving(false)
            setMessage({ type: 'success', text: 'Notification preferences saved successfully!' })
        } catch {
            setIsSaving(false)
            setMessage({ type: 'success', text: 'Notification preferences updated!' })
        } finally {
            setTimeout(() => setMessage(null), 3000)
        }
    }

    // Shopee-Style Email Change Handlers
    const handleOpenEmailModal = () => {
        setNewEmailInput('')
        setEmailOtpInput('')
        setEmailModalError(null)
        setEmailModalSuccess(null)
        setOtpSent(false)
        setIsEmailModalOpen(true)
    }

    const handleCloseEmailModal = () => {
        setIsEmailModalOpen(false)
        setEmailModalError(null)
        setEmailModalSuccess(null)
    }

    const handleSendEmailCode = async () => {
        if (!newEmailInput.trim()) {
            setEmailModalError('Please enter a new email address.')
            return
        }
        const cleanEmail = newEmailInput.trim().toLowerCase()
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(cleanEmail)) {
            setEmailModalError('Please enter a valid email format (e.g. name@gmail.com).')
            return
        }
        if (cleanEmail === (profile.email || '').toLowerCase()) {
            setEmailModalError('New email must be different from your current email.')
            return
        }

        setIsSendingOtp(true)
        setEmailModalError(null)
        setEmailModalSuccess(null)

        try {
            const headers = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/auth/request-email-change`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ newEmail: cleanEmail }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to send verification code.')
            }

            setOtpSent(true)
            setOtpCooldown(60)
            setEmailModalSuccess(data.message || `Verification code sent to ${cleanEmail}. Check your Gmail inbox!`)
        } catch (err: any) {
            setEmailModalError(err?.message || 'Could not send verification code.')
        } finally {
            setIsSendingOtp(false)
        }
    }

    const handleConfirmEmailChange = async () => {
        if (!newEmailInput.trim() || emailOtpInput.length !== 6) {
            setEmailModalError('Please enter the 6-digit verification code.')
            return
        }

        setIsVerifyingOtp(true)
        setEmailModalError(null)
        setEmailModalSuccess(null)

        try {
            const headers = await getAuthHeaders()
            const cleanEmail = newEmailInput.trim().toLowerCase()
            const res = await fetch(`${API_BASE_URL}/auth/confirm-email-change`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ newEmail: cleanEmail, otp: emailOtpInput.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                const detailedError = data.error ? `${data.message} (${data.error})` : data.message
                throw new Error(detailedError || 'Verification failed. Please check the 6-digit code.')
            }

            setEmailModalSuccess('Email address changed successfully!')
            const currentActive = getActiveUser()
            if (currentActive) {
                saveActiveUser({
                    ...currentActive,
                    email: cleanEmail,
                })
            }
            if (data.sessionToken) {
                localStorage.setItem('seafudz_token', data.sessionToken)
            }

            setProfile((prev) => ({ ...prev, email: cleanEmail }))
            setEditForm((prev) => ({ ...prev, email: cleanEmail }))
            window.dispatchEvent(new Event('seafudz_profile_updated'))

            setMessage({
                type: 'success',
                text: `Your email address has been successfully changed to ${cleanEmail}!`,
            })

            setTimeout(() => {
                handleCloseEmailModal()
            }, 1200)
        } catch (err: any) {
            setEmailModalError(err?.message || 'Failed to confirm email change.')
        } finally {
            setIsVerifyingOtp(false)
        }
    }

    // Determine active role & employee status
    const activeUser = getActiveUser()
    const userRole = (activeUser?.role || 'customer').toLowerCase()
    const isEmployee = userRole !== 'customer'

    const renderNavbar = () => {
        switch (userRole) {
            case 'admin':
                return <NavbarAdmin />
            case 'assistant':
                return <NavbarAssistant />
            case 'cashier':
                return <NavbarCashier />
            case 'kitchen':
                return <NavbarKitchen />
            case 'rider':
                return <NavbarRider />
            default:
                return <NavbarCustomer />
        }
    }

    // Order History data & controls
    const [pastOrders, setPastOrders] = useState<CustomerOrder[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [historyFilter, setHistoryFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL')
    const [historySearch, setHistorySearch] = useState('')
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<CustomerOrder | null>(null)
    const [historyPreviewImage, setHistoryPreviewImage] = useState<string | null>(null)
    const [historyPage, setHistoryPage] = useState(1)
    const ORDERS_PER_PAGE = 6

    const getOrdersKey = (user: ReturnType<typeof getActiveUser>) => {
        if (!user) return 'seafudz_orders_guest'
        const id = user.id || user.username || user.fullname || 'guest'
        return `seafudz_orders_${id}`
    }

    const getActiveOrderKey = (user: ReturnType<typeof getActiveUser>) => {
        if (!user) return 'seafudz_active_online_order_guest'
        const id = user.id || user.username || user.fullname || 'guest'
        return `seafudz_active_online_order_${id}`
    }

    const getCartKey = (user: ReturnType<typeof getActiveUser>) => {
        if (!user) return 'sfb_customer_cart_guest'
        const id = user.id || user.username || user.fullname || 'guest'
        return `sfb_customer_cart_${id}`
    }

    // Reorder items from order history into cart and go to billing
    const handleOrderAgain = (order: CustomerOrder) => {
        try {
            const user = getActiveUser()
            const cartKey = getCartKey(user)

            const reorderItems = (order.items || []).map((it, idx) => {
                const itemObj = (it.item || {}) as any
                const productId = it.id || (it as any).productId || (it as any).product_id || itemObj.id || `reorder-${idx}`
                const name = it.name || it.product_name_snapshot || itemObj.name || 'Seafood Dish'
                const price = Number(it.price ?? it.unit_price ?? itemObj.price ?? 0)
                const image = it.image || itemObj.image || it.bundledImage || ''

                return {
                    item: {
                        id: String(productId),
                        name,
                        price,
                        image,
                        category: (itemObj as any).category || 'Seafoods',
                        description: (itemObj as any).description || '',
                    },
                    quantity: it.quantity || 1,
                    specialNote: (it as any).specialNote || '',
                }
            })

            if (reorderItems.length > 0) {
                localStorage.setItem(cartKey, JSON.stringify(reorderItems))
                window.dispatchEvent(new Event('storage'))
            }

            const activeKey = getActiveOrderKey(user)
            const existingActive = localStorage.getItem(activeKey)
            if (existingActive) {
                try {
                    const parsed = JSON.parse(existingActive)
                    if (['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED'].includes(normalizeStatus(parsed.status))) {
                        localStorage.removeItem(activeKey)
                    }
                } catch { }
            }
        } catch (err) {
            console.warn('Could not reorder items into cart:', err)
        }

        navigate('/customer?tab=billing')
    }

    const fetchPastOrders = async () => {
        try {
            setLoadingOrders(true)
            const currentUser = getActiveUser()
            const mergedMap = new Map<string, CustomerOrder>()

            // 1. User LocalStorage
            const userOrdersKey = getOrdersKey(currentUser)
            try {
                const localList = JSON.parse(localStorage.getItem(userOrdersKey) || '[]')
                if (Array.isArray(localList)) {
                    localList.forEach((o) => {
                        if (o && o.id) mergedMap.set(String(o.id), o)
                    })
                }
            } catch { }

            try {
                const globalList = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
                if (Array.isArray(globalList)) {
                    globalList.forEach((o) => {
                        if (!o || !o.id) return
                        const nameMatch = currentUser?.fullname && (
                            String(o.customerName || o.customer || '').toLowerCase() === currentUser.fullname.toLowerCase()
                        )
                        const phoneMatch = currentUser?.phone && (
                            String(o.phone || o.customer_phone || '').trim() === currentUser.phone.trim()
                        )
                        if (nameMatch || phoneMatch || !currentUser) {
                            if (!mergedMap.has(String(o.id))) {
                                mergedMap.set(String(o.id), o)
                            } else {
                                mergedMap.set(String(o.id), { ...mergedMap.get(String(o.id)), ...o })
                            }
                        }
                    })
                }
            } catch { }

            // 2. Fetch from Backend API
            try {
                const queryParams = new URLSearchParams()
                const custName = (!isUuidString(currentUser?.fullname) ? currentUser?.fullname : null) ||
                                 (!isUuidString(currentUser?.username) ? currentUser?.username : null)
                if (custName) queryParams.set('customerName', custName)
                if (currentUser?.phone) queryParams.set('phone', currentUser.phone)
                if (currentUser?.id && !isUuidString(currentUser.id)) queryParams.set('customerId', currentUser.id)

                const res = await fetch(`${API_BASE_URL}/user-flow/orders?${queryParams.toString()}`)
                if (res.ok) {
                    const json = await res.json()
                    const backendList = json.data || json
                    if (Array.isArray(backendList)) {
                        backendList.forEach((order: any) => {
                            if (!order || !order.id) return
                            const id = String(order.id)
                            const existing = (mergedMap.get(id) || {}) as any
                            const authoritativeStatus = order.status || existing.status || 'PENDING'
                            mergedMap.set(id, {
                                ...existing,
                                ...order,
                                id,
                                items: Array.isArray(order.items) && order.items.length > 0 ? order.items : existing.items || [],
                                status: authoritativeStatus,
                            })
                        })
                    }
                }
            } catch (err) {
                console.warn('Backend fetch for order history had an issue, using local cache:', err)
            }

            const allList = Array.from(mergedMap.values())
            // Filter strictly for completed, delivered, served, and cancelled past orders
            const pastOnly = allList.filter((o) => {
                const norm = normalizeStatus(o.status)
                return ['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED'].includes(norm)
            })

            // Sort newest orders first
            pastOnly.sort((a, b) => {
                const dateA = a.created_at || a.createdAt || ''
                const dateB = b.created_at || b.createdAt || ''
                if (dateA && dateB) {
                    return new Date(dateB).getTime() - new Date(dateA).getTime()
                }
                return String(b.id).localeCompare(String(a.id))
            })

            setPastOrders(pastOnly)

            if (selectedHistoryOrder) {
                const updated = pastOnly.find((o) => String(o.id) === String(selectedHistoryOrder.id))
                if (updated) setSelectedHistoryOrder(updated)
            }
        } finally {
            setLoadingOrders(false)
        }
    }

    useEffect(() => {
        fetchPastOrders()
        const unsubscribe = subscribeOrderSync(() => {
            fetchPastOrders()
        })
        const interval = setInterval(fetchPastOrders, 4000)
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'seafudz_orders' || e.key?.startsWith('seafudz_orders_')) {
                fetchPastOrders()
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => {
            unsubscribe()
            clearInterval(interval)
            window.removeEventListener('storage', handleStorage)
        }
    }, [])

    const filteredPastOrders = useMemo(() => {
        return pastOrders.filter((order) => {
            const norm = normalizeStatus(order.status)
            const isCancelled = norm === 'CANCELLED'
            const isCompleted = ['COMPLETED', 'DELIVERED', 'SERVED'].includes(norm)

            if (historyFilter === 'COMPLETED' && !isCompleted) return false
            if (historyFilter === 'CANCELLED' && !isCancelled) return false

            if (historySearch.trim()) {
                const q = historySearch.toLowerCase().trim()
                const idMatch = String(order.id).toLowerCase().includes(q)
                const notesMatch = String(order.notes || '').toLowerCase().includes(q)
                const refMatch = String(order.paymentReference || order.referenceNumber || '').toLowerCase().includes(q)
                const itemMatch = (order.items || []).some((i) => {
                    const name = i.name || i.product_name_snapshot || i.item?.name || ''
                    return name.toLowerCase().includes(q)
                })
                return idMatch || notesMatch || refMatch || itemMatch
            }

            return true
        })
    }, [pastOrders, historyFilter, historySearch])

    useEffect(() => {
        setHistoryPage(1)
    }, [historyFilter, historySearch])

    const pastCounts = useMemo(() => {
        let completed = 0
        let cancelled = 0
        pastOrders.forEach((o) => {
            const norm = normalizeStatus(o.status)
            if (norm === 'CANCELLED') cancelled++
            else completed++
        })
        return { all: pastOrders.length, completed, cancelled }
    }, [pastOrders])

    const totalHistoryPages = Math.max(1, Math.ceil(filteredPastOrders.length / ORDERS_PER_PAGE))
    const safeHistoryPage = Math.min(Math.max(1, historyPage), totalHistoryPages)
    const startHistoryItem = filteredPastOrders.length === 0 ? 0 : (safeHistoryPage - 1) * ORDERS_PER_PAGE + 1
    const endHistoryItem = Math.min(safeHistoryPage * ORDERS_PER_PAGE, filteredPastOrders.length)

    const paginatedPastOrders = useMemo(() => {
        const start = (safeHistoryPage - 1) * ORDERS_PER_PAGE
        return filteredPastOrders.slice(start, start + ORDERS_PER_PAGE)
    }, [filteredPastOrders, safeHistoryPage])

    const formatHistoryDate = (order: CustomerOrder) => {
        const raw = order.created_at || order.createdAt
        if (!raw) return 'Recent Order'
        try {
            const d = new Date(raw)
            if (isNaN(d.getTime())) return raw
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            })
        } catch {
            return String(raw)
        }
    }

    const getHistoryStatusBadge = (rawStatus?: string) => {
        const norm = normalizeStatus(rawStatus)
        if (norm === 'CANCELLED') {
            return {
                label: 'Cancelled',
                className: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-400/20',
                dotClass: 'bg-rose-500',
            }
        }
        return {
            label: norm === 'SERVED' ? 'Order Served' : 'Order Delivered',
            className: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20',
            dotClass: 'bg-emerald-500',
        }
    }

    const getHistoryPageNumbers = (current: number, total: number) => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1)
        }
        const pages: (number | string)[] = [1]
        if (current > 3) pages.push('...')
        const start = Math.max(2, current - 1)
        const end = Math.min(total - 1, current + 1)
        for (let i = start; i <= end; i++) {
            pages.push(i)
        }
        if (current < total - 2) pages.push('...')
        pages.push(total)
        return pages
    }

    return (
        <div className="min-h-screen bg-[#f8f6f4] p-4 lg:p-6 transition-all duration-300">
            <div className="w-full flex flex-col gap-6">

                {/* Custom-styled Navbar */}
                {renderNavbar()}

                {/* Main Dashboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                    {/* LEFT PANEL: User Card & Sub-nav */}
                    <aside className="lg:col-span-1 flex flex-col gap-6">

                        {/* Profile Summary Card */}
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-center flex flex-col items-center">
                            {/* Hidden file input for changing profile picture */}
                            <input
                                type="file"
                                ref={avatarInputRef}
                                onChange={handleAvatarChange}
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                className="hidden"
                            />

                            <div
                                className="relative group cursor-pointer"
                                onClick={handleAvatarClick}
                                title="Click to upload or change profile picture"
                            >
                                <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center text-3xl font-black text-orange-600 border-2 border-orange-500 shadow-md transition-transform group-hover:scale-105 duration-200 overflow-hidden relative">
                                    {profile.avatar && (profile.avatar.startsWith('data:image') || profile.avatar.startsWith('http') || profile.avatar.startsWith('blob:')) ? (
                                        <img
                                            src={profile.avatar}
                                            alt={profile.fullName || 'User Avatar'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>{(profile.fullName || profile.username || 'U').charAt(0).toUpperCase()}</span>
                                    )}

                                    {/* Hover overlay hint */}
                                    <div className="absolute inset-0 bg-black/45 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-2xs">
                                        Change
                                    </div>

                                    {isUploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleAvatarClick()
                                    }}
                                    className="absolute bottom-0 right-0 bg-neutral-900 text-white rounded-full p-2 border-2 border-white cursor-pointer hover:bg-orange-600 transition-all shadow-md active:scale-90"
                                    title="Upload new profile picture"
                                    aria-label="Change profile picture"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </div>

                            <h2 className="font-extrabold text-neutral-800 text-xl mt-4 leading-tight">
                                {profile.fullName || profile.username || 'User Profile'}
                            </h2>
                            <p className="text-xs text-neutral-400 font-semibold mt-1">
                                {profile.email || profile.phone || 'No contact details provided'}
                            </p>

                            {isEmployee && (
                                <div className="flex items-center gap-2 mt-3 px-3.5 py-1 bg-slate-800 text-white rounded-full text-xs font-black uppercase tracking-wider shadow-xs">
                                    {userRole}
                                </div>
                            )}
                        </div>

                        {/* Navigation Menu */}
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-2 flex flex-col gap-1">
                            <button
                                onClick={() => handleSelectSection('profile')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 cursor-pointer ${activeSection === 'profile'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Personal Profile
                            </button>
                            <button
                                onClick={() => handleSelectSection('security')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 cursor-pointer ${activeSection === 'security'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Password & Security
                            </button>
                            <button
                                onClick={() => handleSelectSection('notifications')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 cursor-pointer ${activeSection === 'notifications'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Notifications
                            </button>
                            {!isEmployee && (
                                <button
                                    onClick={() => handleSelectSection('orders')}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 cursor-pointer ${activeSection === 'orders'
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                        }`}
                                >
                                    <span>Order History</span>
                                    {pastOrders.length > 0 && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeSection === 'orders' ? 'bg-white/30 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                                            {pastOrders.length}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </aside>

                    {/* RIGHT PANEL: Form views based on Active Section */}
                    <main className="lg:col-span-3 bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 lg:p-8 min-h-[500px]">

                        {/* Interactive Status Messages */}
                        {message && (
                            <div className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 border ${message.type === 'success'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                                : 'bg-red-50 border-red-100 text-red-800'
                                }`}>
                                {message.text}
                            </div>
                        )}

                        {/* SECTION 1: PERSONAL PROFILE */}
                        {activeSection === 'profile' && (
                            <form onSubmit={handleSaveProfile} className="space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-neutral-800 text-xl">Personal Profile Details</h3>
                                    <p className="text-xs text-neutral-400 mt-1">Manage your account information and preferences</p>
                                </div>
                                <hr className="border-neutral-100" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.fullName}
                                            onChange={(e) => handleProfileChange('fullName', e.target.value)}
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Username</label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.username}
                                            onChange={(e) => handleProfileChange('username', e.target.value)}
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Phone Number</label>
                                        <input
                                            type="tel"
                                            required
                                            value={editForm.phone}
                                            onChange={(e) => handleProfileChange('phone', e.target.value)}
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5 md:col-span-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
                                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                Verified
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-1">
                                                <input
                                                    type="email"
                                                    readOnly
                                                    value={editForm.email || 'No email registered'}
                                                    className="w-full bg-neutral-50/80 text-neutral-700 font-medium border border-neutral-200 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed select-none"
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleOpenEmailModal}
                                                className="shrink-0 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 border border-orange-200 font-bold px-4 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-xs cursor-pointer"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Change
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 mt-0.5">
                                            To update your email like in Shopee, click <strong className="text-neutral-600">Change</strong> to receive a 6-digit confirmation code at your new Gmail.
                                        </p>
                                    </div>
                                    {!isEmployee && (
                                        <div className="flex flex-col gap-1.5 md:col-span-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                                    Delivery Address
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={handleRelocate}
                                                    disabled={isRelocating}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:border-neutral-300 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
                                                    title="Detect current location"
                                                >
                                                    <svg className={`w-3.5 h-3.5 text-neutral-500 ${isRelocating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                    {isRelocating ? 'Relocating…' : 'Relocate'}
                                                </button>
                                            </div>
                                            <textarea
                                                rows={3}
                                                value={editForm.address}
                                                placeholder={isRelocating ? 'Detecting your location...' : 'Enter your delivery address or click Relocate'}
                                                onChange={(e) => handleProfileChange('address', e.target.value)}
                                                className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                            />
                                            {relocateMessage && (
                                                <p className="text-xs text-neutral-500 mt-0.5">
                                                    {relocateMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 pt-6 border-t border-neutral-100">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-98 transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Profile Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetProfile}
                                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold px-6 py-3 rounded-xl text-sm transition-all duration-200"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* SECTION 2: SECURITY / PASSWORD */}
                        {activeSection === 'security' && (
                            <form onSubmit={handleSaveSecurity} className="space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-neutral-800 text-xl">Password & Security</h3>
                                    <p className="text-xs text-neutral-400 mt-1">Keep your account secure by updating your credentials</p>
                                </div>
                                <hr className="border-neutral-100" />

                                <div className="space-y-4 max-w-md">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Password</label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                required
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full border border-neutral-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 bg-transparent border-none cursor-pointer focus:outline-none transition-colors"
                                                aria-label="Toggle current password visibility"
                                            >
                                                {showCurrentPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                required
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full border border-neutral-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 bg-transparent border-none cursor-pointer focus:outline-none transition-colors"
                                                aria-label="Toggle new password visibility"
                                            >
                                                {showNewPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Confirm New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                required
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="••••••••"
                                                className="w-full border border-neutral-200 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 bg-transparent border-none cursor-pointer focus:outline-none transition-colors"
                                                aria-label="Toggle confirm new password visibility"
                                            >
                                                {showConfirmPassword ? (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.165-4.131a3 3 0 11-4.243-4.243M3 3l18 18" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-6 border-t border-neutral-100">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-98 transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* SECTION 3: NOTIFICATIONS */}
                        {activeSection === 'notifications' && (
                            <form onSubmit={handleSaveNotifications} className="space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-neutral-800 text-xl">Notification Preferences</h3>
                                    <p className="text-xs text-neutral-400 mt-1">Control how and when you receive order notifications and promotional alerts</p>
                                </div>
                                <hr className="border-neutral-100" />

                                <div className="space-y-4">
                                    <label className="flex items-start gap-3 p-4 border border-neutral-100 rounded-2xl hover:bg-neutral-50/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={emailAlerts}
                                            onChange={(e) => setEmailAlerts(e.target.checked)}
                                            className="mt-1 text-orange-500 focus:ring-orange-500 w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-bold text-sm text-neutral-800">Email Notifications</p>
                                            <p className="text-xs text-neutral-400">Receive order receipts, updates, and account activity confirmations.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 p-4 border border-neutral-100 rounded-2xl hover:bg-neutral-50/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={smsAlerts}
                                            onChange={(e) => setSmsAlerts(e.target.checked)}
                                            className="mt-1 text-orange-500 focus:ring-orange-500 w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-bold text-sm text-neutral-800">SMS / Mobile Updates</p>
                                            <p className="text-xs text-neutral-400">Get real-time SMS tracking updates on delivery status.</p>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 p-4 border border-neutral-100 rounded-2xl hover:bg-neutral-50/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={promoAlerts}
                                            onChange={(e) => setPromoAlerts(e.target.checked)}
                                            className="mt-1 text-orange-500 focus:ring-orange-500 w-4 h-4 rounded"
                                        />
                                        <div>
                                            <p className="font-bold text-sm text-neutral-800">Promotions & Discounts</p>
                                            <p className="text-xs text-neutral-400">Be first to know about weekend specials, free delivery vouchers, and birthday points multiplier events.</p>
                                        </div>
                                    </label>
                                </div>

                                <div className="flex items-center gap-3 pt-6 border-t border-neutral-100">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-98 transition-all duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Notification Preferences'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* SECTION 4: ORDER HISTORY (Contains full purchase history) */}
                        {activeSection === 'orders' && !isEmployee && (
                            <div className="space-y-6">
                                {/* Header with Active Orders Link */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-100">
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <h3 className="font-extrabold text-neutral-800 text-xl">Your Order History</h3>
                                            <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                                {pastOrders.length} {pastOrders.length === 1 ? 'order' : 'orders'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-400 mt-1">Review your past completed orders, receipts, and reorder favorites</p>
                                    </div>
                                    <Link
                                        to="/customer/purchases"
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200/80 px-3.5 py-2 rounded-xl transition-all self-start sm:self-auto cursor-pointer shadow-2xs group"
                                        title="View currently active ongoing orders"
                                    >
                                        <span>Track Active Orders</span>
                                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </Link>
                                </div>

                                {/* Filter Tabs & Search Controls */}
                                <div className="bg-neutral-50/80 rounded-2xl p-3 border border-neutral-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                                    {/* Tabs */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                                        {[
                                            { id: 'ALL', label: 'All Past Orders', count: pastCounts.all },
                                            { id: 'COMPLETED', label: 'Completed', count: pastCounts.completed },
                                            { id: 'CANCELLED', label: 'Cancelled', count: pastCounts.cancelled },
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setHistoryFilter(tab.id as any)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                                    historyFilter === tab.id
                                                        ? 'bg-orange-500 text-white shadow-xs shadow-orange-500/30'
                                                        : 'bg-white text-neutral-600 hover:bg-neutral-200/70 border border-neutral-200/60'
                                                }`}
                                            >
                                                <span>{tab.label}</span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                                    historyFilter === tab.id ? 'bg-white/30 text-white' : 'bg-neutral-100 text-neutral-600'
                                                }`}>
                                                    {tab.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Search Box */}
                                    <div className="relative max-w-sm w-full">
                                        <input
                                            type="text"
                                            value={historySearch}
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                            placeholder="Search by Order ID, dish name, notes..."
                                            className="w-full bg-white border border-neutral-200 rounded-xl px-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        />
                                        <svg className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                        </svg>
                                        {historySearch && (
                                            <button
                                                type="button"
                                                onClick={() => setHistorySearch('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Orders Grid */}
                                {loadingOrders && pastOrders.length === 0 ? (
                                    <div className="rounded-2xl p-12 text-center border border-neutral-100 space-y-3">
                                        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                        <p className="text-xs font-bold text-neutral-400">Loading your order history...</p>
                                    </div>
                                ) : filteredPastOrders.length === 0 ? (
                                    <div className="rounded-2xl p-10 text-center border border-neutral-100 space-y-4 bg-neutral-50/50">
                                        <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                                            📜
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-base font-extrabold text-neutral-800">No past orders found</h4>
                                            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                                                {historySearch
                                                    ? `No orders matching "${historySearch}".`
                                                    : "You don't have any past completed orders yet. Once your active orders are delivered, they will appear here."}
                                            </p>
                                        </div>
                                        <div>
                                            <Link
                                                to="/customer"
                                                className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                                            >
                                                <span>Browse Menu Dishes</span>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                                </svg>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {paginatedPastOrders.map((order) => {
                                            const badge = getHistoryStatusBadge(order.status)
                                            const itemsList = order.items || []
                                            const totalItems = itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0)

                                            return (
                                                <div
                                                    key={order.id}
                                                    onClick={() => setSelectedHistoryOrder(order)}
                                                    className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-5 space-y-4 cursor-pointer hover:border-orange-300 flex flex-col justify-between group"
                                                >
                                                    {/* Top: Order ID & Status */}
                                                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-neutral-900 text-sm group-hover:text-orange-600 transition-colors">
                                                                    #{order.id}
                                                                </span>
                                                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600">
                                                                    Delivery
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-neutral-400 mt-0.5">{formatHistoryDate(order)}</p>
                                                        </div>

                                                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black whitespace-nowrap ${badge.className}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                                            <span>{badge.label}</span>
                                                        </div>
                                                    </div>

                                                    {/* Middle: Ordered Items List Snapshot */}
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block">
                                                            Ordered Items ({totalItems} pcs)
                                                        </span>
                                                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                                            {itemsList.map((item, idx) => {
                                                                const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood Dish'
                                                                const price = item.price ?? item.unit_price ?? item.item?.price ?? 0
                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between text-xs text-neutral-700 bg-neutral-50 px-2 py-1 rounded-lg border border-neutral-100">
                                                                        <span className="font-semibold truncate max-w-[200px]">
                                                                            {item.quantity}× {name}
                                                                        </span>
                                                                        <span className="font-bold text-neutral-900 shrink-0 text-[11px]">
                                                                            ₱{(price * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Bottom: Payment, Total & Reorder Action */}
                                                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-3">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">
                                                                {order.paymentMethod || 'Online'}
                                                            </span>
                                                            <span className="text-base font-black text-orange-600">
                                                                ₱{Number(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleOrderAgain(order)
                                                                }}
                                                                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                                                </svg>
                                                                <span>Order Again</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Pagination Controls */}
                                {!loadingOrders && filteredPastOrders.length > 0 && (
                                    <div className="bg-neutral-50/80 rounded-2xl p-3 border border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
                                        <div className="text-xs text-neutral-500 font-medium">
                                            Showing <strong className="font-extrabold text-neutral-800">{startHistoryItem}–{endHistoryItem}</strong> of{' '}
                                            <strong className="font-extrabold text-neutral-800">{filteredPastOrders.length}</strong> orders
                                        </div>

                                        {totalHistoryPages > 1 && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                                    disabled={safeHistoryPage === 1}
                                                    className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer shadow-2xs"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                                    </svg>
                                                    <span>Prev</span>
                                                </button>

                                                <div className="flex items-center gap-1">
                                                    {getHistoryPageNumbers(safeHistoryPage, totalHistoryPages).map((p, idx) => {
                                                        if (p === '...') {
                                                            return (
                                                                <span key={`ell-${idx}`} className="px-1 text-xs text-neutral-400 font-bold">
                                                                    ...
                                                                </span>
                                                            )
                                                        }
                                                        const pageNum = Number(p)
                                                        const isActive = pageNum === safeHistoryPage
                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                type="button"
                                                                onClick={() => setHistoryPage(pageNum)}
                                                                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                                                    isActive
                                                                        ? 'bg-orange-500 text-white shadow-xs'
                                                                        : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-orange-50 hover:text-orange-600'
                                                                }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                                                    disabled={safeHistoryPage === totalHistoryPages}
                                                    className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer shadow-2xs"
                                                >
                                                    <span>Next</span>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                    </main>

                </div>

            </div>

            {/* ORDER HISTORY DETAILS MODAL */}
            {selectedHistoryOrder && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
                    <div
                        className="fixed inset-0 bg-neutral-950/65 backdrop-blur-xs transition-opacity"
                        onClick={() => setSelectedHistoryOrder(null)}
                        aria-hidden="true"
                    />

                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transform-gpu animate-in zoom-in-95 duration-200 border border-neutral-100 z-10">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
                                    📦
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-neutral-900 text-base sm:text-lg leading-tight">
                                        Order Details #{selectedHistoryOrder.id}
                                    </h3>
                                    <p className="text-[11px] text-neutral-400">Placed on {formatHistoryDate(selectedHistoryOrder)}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedHistoryOrder(null)}
                                className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto p-4 sm:p-6 space-y-5">
                            {/* Status Alert Banner */}
                            {(() => {
                                const norm = normalizeStatus(selectedHistoryOrder.status)
                                const isCancelled = norm === 'CANCELLED'
                                const badge = getHistoryStatusBadge(selectedHistoryOrder.status)

                                return (
                                    <div className={`p-4 rounded-2xl border ${
                                        isCancelled
                                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                    }`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider block opacity-75">
                                                    Status
                                                </span>
                                                <h4 className="font-extrabold text-base sm:text-lg mt-0.5">
                                                    {isCancelled ? 'Order Cancelled' : 'Order Delivered & Completed'}
                                                </h4>
                                            </div>
                                            <span className={`text-xs font-black px-3 py-1 rounded-full border ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Destination */}
                            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-2 text-xs">
                                <h5 className="font-extrabold text-neutral-800 text-sm">Delivery Destination</h5>
                                <p className="text-neutral-600">
                                    <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Recipient:</span>{' '}
                                    {selectedHistoryOrder.customerName || selectedHistoryOrder.customer || profile.fullName || 'Customer'}
                                </p>
                                <p className="text-neutral-600">
                                    <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Phone:</span>{' '}
                                    {selectedHistoryOrder.phone || selectedHistoryOrder.customer_phone || profile.phone || 'Not provided'}
                                </p>
                                <p className="text-neutral-600 leading-relaxed">
                                    <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Address:</span>{' '}
                                    {selectedHistoryOrder.address || selectedHistoryOrder.deliveryAddress || selectedHistoryOrder.delivery_address || profile.address || 'Address on file'}
                                </p>
                                {selectedHistoryOrder.notes && (
                                    <p className="text-orange-700 bg-orange-50 p-2 rounded-lg border border-orange-200">
                                        <span className="font-bold uppercase text-[10px] block">Special Instructions:</span>
                                        {selectedHistoryOrder.notes}
                                    </p>
                                )}
                            </div>

                            {/* Payment Info & Screenshot Preview */}
                            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-3 text-xs">
                                <div className="flex items-center justify-between">
                                    <h5 className="font-extrabold text-neutral-800 text-sm">Payment Details</h5>
                                    <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[11px]">
                                        {selectedHistoryOrder.paymentMethod || 'Online'}
                                    </span>
                                </div>
                                {(selectedHistoryOrder.paymentReference || selectedHistoryOrder.referenceNumber) && (
                                    <p className="text-neutral-600">
                                        <span className="font-bold text-neutral-400 uppercase text-[10px] mr-1">Reference Number:</span>{' '}
                                        <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-neutral-200 text-neutral-800">
                                            {selectedHistoryOrder.paymentReference || selectedHistoryOrder.referenceNumber}
                                        </span>
                                    </p>
                                )}
                                {selectedHistoryOrder.paymentReceipt && (
                                    <div className="pt-1">
                                        <span className="font-bold text-neutral-400 uppercase text-[10px] block mb-1.5">Submitted GCash Receipt:</span>
                                        <img
                                            src={selectedHistoryOrder.paymentReceipt}
                                            alt="Receipt Screenshot"
                                            onClick={() => setHistoryPreviewImage(selectedHistoryOrder.paymentReceipt || null)}
                                            className="w-20 h-20 object-cover rounded-xl border border-neutral-200 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Itemized Order Breakdown */}
                            <div className="space-y-3">
                                <h5 className="font-extrabold text-neutral-800 text-sm">Itemized Bill</h5>
                                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white text-xs">
                                    {(selectedHistoryOrder.items || []).map((item, idx) => {
                                        const name = item.name || item.product_name_snapshot || item.item?.name || 'Seafood Dish'
                                        const unitPrice = item.price ?? item.unit_price ?? item.item?.price ?? 0
                                        const lineTotal = unitPrice * (item.quantity || 1)
                                        return (
                                            <div key={idx} className="p-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <span className="font-bold text-neutral-800">{item.quantity}× {name}</span>
                                                    <span className="text-[11px] text-neutral-400 block">₱{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</span>
                                                </div>
                                                <span className="font-extrabold text-neutral-900">
                                                    ₱{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Financial Summary */}
                                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-1.5 text-xs text-neutral-600">
                                    <div className="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span className="font-bold text-neutral-800">
                                            ₱{(selectedHistoryOrder.subtotal !== undefined ? Number(selectedHistoryOrder.subtotal) : Math.round(Number(selectedHistoryOrder.total || 0) / 1.12 - (selectedHistoryOrder.deliveryFee || 50))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-orange-600 font-medium">
                                        <span>VAT (12%):</span>
                                        <span className="font-bold">
                                            ₱{(selectedHistoryOrder.vat !== undefined ? Number(selectedHistoryOrder.vat) : Math.round((Number(selectedHistoryOrder.total || 0) - (selectedHistoryOrder.deliveryFee || 50)) * 0.12 / 1.12)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Delivery Fee:</span>
                                        <span className="font-bold text-neutral-800">
                                            ₱{Number(selectedHistoryOrder.deliveryFee ?? selectedHistoryOrder.delivery_fee ?? 50).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-neutral-900 pt-2 border-t border-dashed border-neutral-200">
                                        <span>Total:</span>
                                        <span className="text-orange-600">
                                            ₱{Number(selectedHistoryOrder.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryOrder(null)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-extrabold text-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>

                            <button
                                type="button"
                                onClick={() => handleOrderAgain(selectedHistoryOrder)}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                <span>Order Again</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Zoom Preview Modal */}
            {historyPreviewImage && (
                <div
                    className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
                    onClick={() => setHistoryPreviewImage(null)}
                >
                    <div className="relative max-w-xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl">
                        <img src={historyPreviewImage} alt="Receipt Screenshot" className="max-h-[80vh] w-auto object-contain rounded-xl" />
                        <button
                            onClick={() => setHistoryPreviewImage(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center shadow-lg"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* SHOPEE-STYLE CHANGE EMAIL MODAL */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-100 p-6 md:p-8 flex flex-col gap-6 relative">
                        
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-xs">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-neutral-900 text-lg leading-tight">Change Email Address</h3>
                                    <p className="text-xs text-neutral-400 font-medium mt-0.5">Shopee-Style Secure Email Verification</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseEmailModal}
                                className="text-neutral-400 hover:text-neutral-600 p-1.5 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Alerts */}
                        {emailModalError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{emailModalError}</span>
                            </div>
                        )}
                        {emailModalSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{emailModalSuccess}</span>
                            </div>
                        )}

                        {/* Form Steps */}
                        <div className="flex flex-col gap-4">
                            
                            {/* Current Email Display */}
                            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 flex items-center justify-between text-xs">
                                <span className="text-neutral-400 font-medium">Current Email:</span>
                                <span className="font-bold text-neutral-700">{profile.email || 'None'}</span>
                            </div>

                            {/* Step 1: New Email Address */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                                    New Gmail Address
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="email"
                                        required
                                        placeholder="e.g. yourname@gmail.com"
                                        value={newEmailInput}
                                        onChange={(e) => setNewEmailInput(e.target.value)}
                                        disabled={isSendingOtp || otpCooldown > 0}
                                        className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors disabled:bg-neutral-50"
                                    />
                                    <button
                                        type="button"
                                        disabled={!newEmailInput.trim() || isSendingOtp || otpCooldown > 0}
                                        onClick={handleSendEmailCode}
                                        className="shrink-0 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-orange-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        {isSendingOtp ? (
                                            <>
                                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Sending...
                                            </>
                                        ) : otpCooldown > 0 ? (
                                            `Resend (${otpCooldown}s)`
                                        ) : otpSent ? (
                                            'Resend Code'
                                        ) : (
                                            'Send Code'
                                        )}
                                    </button>
                                </div>
                                <p className="text-[11px] text-neutral-400">
                                    {otpSent
                                        ? `A 6-digit code was sent to ${newEmailInput}. Check your inbox or spam.`
                                        : 'Click "Send Code" to receive the 6-digit verification code.'}
                                </p>
                            </div>

                            {/* Step 2: 6-Digit Verification Code */}
                            <div className="flex flex-col gap-1.5 pt-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wider">
                                        6-Digit Verification Code
                                    </label>
                                    {otpSent && (
                                        <span className="text-[11px] text-orange-600 font-bold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                            Code sent to Gmail
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="••••••"
                                    value={emailOtpInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '')
                                        setEmailOtpInput(val)
                                    }}
                                    className="w-full text-center font-mono text-2xl font-black tracking-[0.5em] text-neutral-800 border-2 border-neutral-200 focus:border-orange-500 focus:bg-orange-50/20 rounded-2xl py-3 transition-all outline-none"
                                />
                                <p className="text-[11px] text-neutral-400 text-center">
                                    Enter the 6-digit number received in your Gmail to finish.
                                </p>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleCloseEmailModal}
                                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isVerifyingOtp || emailOtpInput.length !== 6 || !newEmailInput.trim()}
                                onClick={handleConfirmEmailChange}
                                className="flex-1 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md shadow-orange-500/20 hover:shadow-orange-500/30 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                            >
                                {isVerifyingOtp ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Confirm & Update'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

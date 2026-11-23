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
import { normalizeStatus, blocksNewOrder } from './OnlineCustomer'
import { subscribeOrderSync } from '../utils/orderSync'
import { Badge, Button, Card, Field, Icon, Modal, Notice, SearchInput, Segmented } from './inventory/ui'
import './inventory/admin-inventory.css'

/**
 * One password field instead of three copies of the same sixty lines, each
 * carrying its own pair of inline eye SVGs.
 */
const PasswordField: React.FC<{
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
}> = ({ id, label, value, onChange, autoComplete, required }) => {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label} htmlFor={id} required={required}>
      <div className="inv-input-group">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="inv-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="inv-input-suffix"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} className="h-4 w-4" />
        </button>
      </div>
    </Field>
  )
}

const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'security', label: 'Password', icon: 'lock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'orders', label: 'Order history', icon: 'doc' },
] as const

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

    // Password fields (for Security tab)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    // Password visibility is owned by each <PasswordField />.

    // Email change: send a one-time code to the new address, then confirm it
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
    const [newEmailInput, setNewEmailInput] = useState('')
    const [emailOtpInput, setEmailOtpInput] = useState('')
    const [isSendingOtp, setIsSendingOtp] = useState(false)
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
    const [otpCooldown, setOtpCooldown] = useState(0)
    const [otpSent, setOtpSent] = useState(false)
    const [emailModalError, setEmailModalError] = useState<string | null>(null)
    const [emailModalSuccess, setEmailModalSuccess] = useState<string | null>(null)

    // 60-second cooldown before the code can be resent
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

    // Handlers
    const handleProfileChange = (field: keyof UserProfile, value: string) => {
        setEditForm((prev) => ({ ...prev, [field]: value }))
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
                setMessage({ type: 'success', text: responseData.message || 'Personal details saved to database successfully!' })
            } else {
                const errorMsg = responseData.error ? `${responseData.message || 'Failed to update profile'}: ${responseData.error}` : (responseData.message || 'Failed to update personal details in database.')
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
            const prefs = { emailAlerts }
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

    // Email change handlers
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

    const accountSubtitle =
        activeSection === 'security'
            ? 'Account Management · Password'
            : activeSection === 'notifications'
              ? 'Account Management · Notifications'
              : activeSection === 'orders'
                ? 'Account Management · Order History'
                : 'Account Management · Profile'

    const renderNavbar = () => {
        switch (userRole) {
            case 'admin':
                return <NavbarAdmin subtitle={accountSubtitle} />
            case 'assistant':
                return <NavbarAssistant subtitle={accountSubtitle} />
            case 'cashier':
                return <NavbarCashier subtitle={accountSubtitle} />
            case 'kitchen':
                return <NavbarKitchen subtitle={accountSubtitle} />
            case 'rider':
                return <NavbarRider subtitle={accountSubtitle} />
            default:
                return <NavbarCustomer subtitle={accountSubtitle} />
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
        // One order at a time. Checkout refuses a second order anyway, so catch it here and send
        // the customer to the one still in progress rather than to a checkout that cannot submit.
        try {
            const stored = localStorage.getItem(getActiveOrderKey(getActiveUser()))
            const ongoing = stored ? JSON.parse(stored) : null
            if (ongoing?.id && blocksNewOrder(ongoing.status)) {
                alert(`You already have an ongoing order (#${ongoing.id}). You can order again once it has been delivered or picked up.`)
                navigate(`/customer?orderId=${encodeURIComponent(String(ongoing.id))}&tab=tracking`)
                return
            }
        } catch { }

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
        <div className={`inv-scope min-h-screen pb-16 antialiased ${userRole === 'admin' ? 'pl-72 print:pl-0' : ''}`} style={{ background: 'var(--inv-bg)' }}>
            <div className="sticky top-0 z-40 print:hidden">
                {renderNavbar()}
            </div>

            <main className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
                <div className="inv-page-header">
                    <div className="min-w-0">
                        <h1 className="inv-page-title">Account</h1>
                        <p className="inv-page-sub">Your details, password and notification settings.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] items-start">

                    {/* ------------------------------------------- Sidebar */}
                    <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
                        <Card>
                            <div className="inv-card-body flex items-center gap-3.5">
                                <input
                                    type="file"
                                    ref={avatarInputRef}
                                    onChange={handleAvatarChange}
                                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={handleAvatarClick}
                                    className="sfb-avatar"
                                    title="Change your profile picture"
                                    aria-label="Change your profile picture"
                                >
                                    {profile.avatar &&
                                    (profile.avatar.startsWith('data:image') ||
                                        profile.avatar.startsWith('http') ||
                                        profile.avatar.startsWith('blob:')) ? (
                                        <img src={profile.avatar} alt="" />
                                    ) : (
                                        <span>{(profile.fullName || profile.username || 'U').charAt(0).toUpperCase()}</span>
                                    )}
                                    <span className="sfb-avatar-hint">
                                        {isUploadingAvatar ? <span className="inv-spinner" aria-hidden="true" /> : <Icon name="edit" className="h-4 w-4" />}
                                    </span>
                                </button>

                                <div className="min-w-0">
                                    <p className="inv-cell-primary truncate">
                                        {profile.fullName || profile.username || 'Your account'}
                                    </p>
                                    <p className="inv-cell-secondary truncate">
                                        {profile.email || profile.phone || 'No contact details yet'}
                                    </p>
                                    {isEmployee && (
                                        <span className="mt-1.5 inline-block">
                                            <Badge tone="neutral">{userRole}</Badge>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <nav className="inv-sidenav" aria-label="Account sections">
                                {ACCOUNT_SECTIONS.filter((sec) => sec.id !== 'orders' || !isEmployee).map((sec) => (
                                    <button
                                        key={sec.id}
                                        type="button"
                                        onClick={() => handleSelectSection(sec.id)}
                                        aria-current={activeSection === sec.id ? 'page' : undefined}
                                        className={activeSection === sec.id ? 'is-active' : undefined}
                                    >
                                        <Icon name={sec.icon} className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-left">{sec.label}</span>
                                        {sec.id === 'orders' && pastOrders.length > 0 && (
                                            <span className="inv-seg-count">{pastOrders.length}</span>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </Card>
                    </aside>

                    {/* ---------------------------------------- Form panel */}
                    <div className="space-y-4">
                        {message && (
                            <Notice tone={message.type === 'success' ? 'success' : 'danger'}>{message.text}</Notice>
                        )}

                        {/* SECTION 1: PERSONAL PROFILE */}
                        {activeSection === 'profile' && (
                            <Card>
                                <form onSubmit={handleSaveProfile}>
                                    <div className="inv-card-header">
                                        <div className="min-w-0">
                                            <h2 className="inv-card-title">Profile</h2>
                                            <p className="inv-card-desc">The details we use to reach you about your orders.</p>
                                        </div>
                                    </div>

                                    <div className="inv-card-body space-y-4">
                                        <div className="inv-grid-2">
                                            <Field label="Full name" htmlFor="acc-name" required>
                                                <input
                                                    id="acc-name"
                                                    type="text"
                                                    className="inv-input"
                                                    required
                                                    value={editForm.fullName}
                                                    onChange={(e) => handleProfileChange('fullName', e.target.value)}
                                                />
                                            </Field>
                                            <Field label="Username" htmlFor="acc-username" required>
                                                <input
                                                    id="acc-username"
                                                    type="text"
                                                    className="inv-input"
                                                    required
                                                    value={editForm.username}
                                                    onChange={(e) => handleProfileChange('username', e.target.value)}
                                                />
                                            </Field>
                                        </div>

                                        <Field label="Phone number" htmlFor="acc-phone" required>
                                            <input
                                                id="acc-phone"
                                                type="tel"
                                                className="inv-input"
                                                required
                                                value={editForm.phone}
                                                onChange={(e) => handleProfileChange('phone', e.target.value)}
                                            />
                                        </Field>

                                        <Field
                                            label="Email address"
                                            htmlFor="acc-email"
                                            hint="Changing this sends a 6-digit code to the new address to confirm it is yours."
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="acc-email"
                                                    type="email"
                                                    readOnly
                                                    disabled
                                                    className="inv-input"
                                                    value={editForm.email || 'No email registered'}
                                                />
                                                <Button variant="secondary" icon="edit" onClick={handleOpenEmailModal}>
                                                    Change
                                                </Button>
                                            </div>
                                        </Field>

                                        {!isEmployee && (
                                            <Field
                                                label="Delivery address"
                                                htmlFor="acc-address"
                                                hint="Please enter an address within 8 km of our Caloocan store. You confirm your exact Barangay / Delivery Area when you place an order."
                                            >
                                                <textarea
                                                    id="acc-address"
                                                    rows={3}
                                                    className="inv-textarea"
                                                    value={editForm.address}
                                                    placeholder="Where should we deliver?"
                                                    onChange={(e) => handleProfileChange('address', e.target.value)}
                                                />
                                                <div className="mt-2">
                                                    <span className="inv-cell-secondary">
                                                        We only deliver within 8 km of the Caloocan store.
                                                    </span>
                                                </div>
                                            </Field>
                                        )}
                                    </div>

                                    <div className="inv-card-footer">
                                        <Button variant="ghost" onClick={handleResetProfile}>
                                            Reset
                                        </Button>
                                        <Button type="submit" variant="primary" loading={isSaving}>
                                            {isSaving ? 'Saving…' : 'Save changes'}
                                        </Button>
                                    </div>
                                </form>
                            </Card>
                        )}

                        {/* SECTION 2: SECURITY / PASSWORD */}
                        {activeSection === 'security' && (
                            <Card>
                                <form onSubmit={handleSaveSecurity}>
                                    <div className="inv-card-header">
                                        <div className="min-w-0">
                                            <h2 className="inv-card-title">Password</h2>
                                            <p className="inv-card-desc">Confirm the password you use now, then set the new one.</p>
                                        </div>
                                    </div>

                                    <div className="inv-card-body max-w-md space-y-4">
                                        <PasswordField
                                            id="acc-current-password"
                                            label="Current password"
                                            value={currentPassword}
                                            onChange={setCurrentPassword}
                                            autoComplete="current-password"
                                            required
                                        />
                                        <PasswordField
                                            id="acc-new-password"
                                            label="New password"
                                            value={newPassword}
                                            onChange={setNewPassword}
                                            autoComplete="new-password"
                                            required
                                        />
                                        <PasswordField
                                            id="acc-confirm-password"
                                            label="Confirm new password"
                                            value={confirmPassword}
                                            onChange={setConfirmPassword}
                                            autoComplete="new-password"
                                            required
                                        />
                                    </div>

                                    <div className="inv-card-footer">
                                        <Button type="submit" variant="primary" className="ml-auto" loading={isSaving}>
                                            {isSaving ? 'Updating…' : 'Update password'}
                                        </Button>
                                    </div>
                                </form>
                            </Card>
                        )}

                        {/* SECTION 3: NOTIFICATIONS */}
                        {activeSection === 'notifications' && (
                            <Card>
                                <form onSubmit={handleSaveNotifications}>
                                    <div className="inv-card-header">
                                        <div className="min-w-0">
                                            <h2 className="inv-card-title">Notifications</h2>
                                            <p className="inv-card-desc">What we are allowed to email you about.</p>
                                        </div>
                                    </div>

                                    <div className="inv-card-body">
                                        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--inv-radius)] border border-[var(--inv-border)] p-3.5 transition-colors hover:bg-[var(--inv-surface-2)]">
                                            <input
                                                type="checkbox"
                                                className="inv-checkbox mt-0.5 shrink-0"
                                                checked={emailAlerts}
                                                onChange={(e) => setEmailAlerts(e.target.checked)}
                                            />
                                            <span className="min-w-0">
                                                <span className="inv-cell-primary block">Account emails</span>
                                                <span className="inv-cell-secondary block">
                                                    Verification codes and password changes only. Order updates stay in the app.
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    <div className="inv-card-footer">
                                        <Button type="submit" variant="primary" className="ml-auto" loading={isSaving}>
                                            {isSaving ? 'Saving…' : 'Save preferences'}
                                        </Button>
                                    </div>
                                </form>
                            </Card>
                        )}

                        {/* SECTION 4: ORDER HISTORY (Contains full purchase history) */}
                        {activeSection === 'orders' && !isEmployee && (
                            <Card>
                              <div className="inv-card-header">
                                <div className="min-w-0">
                                  <h2 className="inv-card-title">Order history</h2>
                                  <p className="inv-card-desc">Past orders, their receipts, and anything worth ordering again.</p>
                                </div>
                                <Link to="/customer/purchases" className="shrink-0">
                                  <Button variant="secondary" size="sm" icon="arrowRight">
                                    Track active orders
                                  </Button>
                                </Link>
                              </div>

                              <div className="inv-toolbar">
                                <Segmented
                                  options={[
                                    { value: 'ALL', label: 'All', count: pastCounts.all },
                                    { value: 'COMPLETED', label: 'Completed', count: pastCounts.completed },
                                    { value: 'CANCELLED', label: 'Cancelled', count: pastCounts.cancelled },
                                  ]}
                                  value={historyFilter}
                                  onChange={(v) => setHistoryFilter(v as typeof historyFilter)}
                                  label="Filter order history"
                                  size="sm"
                                />
                                <SearchInput
                                  value={historySearch}
                                  onChange={setHistorySearch}
                                  placeholder="Search order, dish or note"
                                  label="Search order history"
                                  className="sm:ml-auto sm:w-64"
                                />
                              </div>

                              <div className="inv-card-body space-y-5">

                                {/* Orders Grid */}
                                {loadingOrders && pastOrders.length === 0 ? (
                                    <div className="rounded-2xl p-12 text-center border border-neutral-100 space-y-3">
                                        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                        <p className="text-xs font-bold text-neutral-400">Loading your order history...</p>
                                    </div>
                                ) : filteredPastOrders.length === 0 ? (
                                    <div className="rounded-2xl p-10 text-center border border-neutral-100 space-y-4 bg-neutral-50/50">
                                        <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
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
                            </Card>
                        )}

                    </div>

                </div>

            </main>

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
                                                <Icon name="close" className="h-4 w-4" />
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
                                                <Icon name="close" className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* SHOPEE-STYLE CHANGE EMAIL MODAL */}
            <Modal
                open={isEmailModalOpen}
                onClose={handleCloseEmailModal}
                size="sm"
                title="Change email address"
                description={`We will send a 6-digit code to the new address to confirm it is yours. Current: ${profile.email || 'none on file'}`}
                footer={
                    <>
                        <Button variant="secondary" onClick={handleCloseEmailModal} disabled={isVerifyingOtp}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            loading={isVerifyingOtp}
                            disabled={isVerifyingOtp || emailOtpInput.length !== 6 || !newEmailInput.trim()}
                            onClick={handleConfirmEmailChange}
                        >
                            {isVerifyingOtp ? 'Checking…' : 'Confirm change'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    {emailModalError && <Notice tone="danger">{emailModalError}</Notice>}
                    {emailModalSuccess && <Notice tone="success">{emailModalSuccess}</Notice>}

                    <Field
                        label="New email address"
                        htmlFor="acc-new-email"
                        required
                        hint={
                            otpSent
                                ? `Code sent to ${newEmailInput}. Check your inbox, and the spam folder.`
                                : undefined
                        }
                    >
                        <div className="flex items-center gap-2">
                            <input
                                id="acc-new-email"
                                type="email"
                                required
                                className="inv-input"
                                placeholder="yourname@gmail.com"
                                value={newEmailInput}
                                onChange={(e) => setNewEmailInput(e.target.value)}
                                disabled={isSendingOtp || otpCooldown > 0}
                            />
                            <Button
                                variant="secondary"
                                loading={isSendingOtp}
                                disabled={!newEmailInput.trim() || isSendingOtp || otpCooldown > 0}
                                onClick={handleSendEmailCode}
                            >
                                {isSendingOtp
                                    ? 'Sending…'
                                    : otpCooldown > 0
                                    ? `Resend in ${otpCooldown}s`
                                    : otpSent
                                    ? 'Resend'
                                    : 'Send code'}
                            </Button>
                        </div>
                    </Field>

                    <Field label="6-digit code" htmlFor="acc-otp" required>
                        <input
                            id="acc-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="000000"
                            className="inv-input sfb-otp"
                            value={emailOtpInput}
                            onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, ''))}
                        />
                    </Field>
                </div>
            </Modal>

        </div>
    )
}

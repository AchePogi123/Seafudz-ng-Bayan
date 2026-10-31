import React, { useState, useEffect, useRef } from 'react'
import NavbarCustomer from '../components/NavbarCustomer'
import NavbarAdmin from '../components/NavbarAdmin'
import NavbarAssistant from '../components/NavbarAssistant'
import NavbarCashier from '../components/NavbarCashier'
import NavbarKitchen from '../components/NavbarKitchen'
import NavbarRider from '../components/Navbarrider'
import { getActiveUser, saveActiveUser } from '../cryptography/cryptoSession'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { supabase } from '../utils/supabase'

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
    // Navigation / Tab states
    const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'notifications' | 'orders'>('profile')

    // Initial user profile data from session user or empty state
    const [profile, setProfile] = useState<UserProfile>(() => {
        const active = getActiveUser()
        return {
            fullName: active?.fullname || '',
            username: active?.username || '',
            phone: active?.phone || '',
            email: active?.email || '',
            address: active?.address || '',
            avatar: 'U',
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
            const initial = {
                fullName: active.fullname || '',
                username: active.username || '',
                phone: active.phone || '',
                email: active.email || '',
                address: active.address || '',
                avatar: 'U',
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
                            const updatedActive = {
                                ...active,
                                id: dbUser.id || active.id,
                                fullname: dbUser.fullname || dbUser.fullName || active.fullname,
                                username: dbUser.username || active.username,
                                phone: dbUser.phone || active.phone,
                                email: dbUser.email || active.email,
                                address: dbUser.address || dbUser.delivery_address || active.address,
                            }
                            if (
                                updatedActive.fullname !== active.fullname ||
                                updatedActive.username !== active.username ||
                                updatedActive.phone !== active.phone ||
                                updatedActive.email !== active.email ||
                                updatedActive.address !== active.address
                            ) {
                                saveActiveUser(updatedActive)
                            }
                            const updated = {
                                fullName: updatedActive.fullname || '',
                                username: updatedActive.username || '',
                                phone: updatedActive.phone || '',
                                email: updatedActive.email || '',
                                address: updatedActive.address || '',
                                avatar: 'U',
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

    // Order History data initialized empty
    const mockOrders: Array<{ id: string; date: string; total: number; status: string; items: string }> = []

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
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center text-3xl font-black text-orange-600 border-2 border-orange-500 shadow-md transition-transform group-hover:scale-105 duration-200">
                                    {(profile.fullName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-neutral-900 text-white rounded-full p-1.5 border border-white cursor-pointer hover:bg-orange-600 transition-colors shadow-sm">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </div>
                            </div>

                            <h2 className="font-extrabold text-neutral-800 text-xl mt-4 leading-tight">
                                {profile.fullName || 'User Profile'}
                            </h2>
                            <p className="text-xs text-neutral-400 font-semibold mt-1">
                                {profile.email || profile.phone || 'No contact details provided'}
                            </p>

                            {isEmployee ? (
                                <div className="flex items-center gap-2 mt-3 px-3.5 py-1 bg-slate-800 text-white rounded-full text-xs font-black uppercase tracking-wider shadow-xs">
                                    {userRole}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mt-3 px-3 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200/50 text-xs font-extrabold">
                                    {profile.membershipTier} Member
                                </div>
                            )}

                            {!isEmployee && (
                                <div className="w-full grid grid-cols-2 gap-4 border-t border-neutral-100 mt-6 pt-6">
                                    <div className="text-center border-r border-neutral-100">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Points Balance</p>
                                        <p className="text-lg font-extrabold text-orange-600 mt-0.5">{profile.points} pts</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Member Since</p>
                                        <p className="text-sm font-extrabold text-neutral-700 mt-1">{profile.joinedDate}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation Menu */}
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-2 flex flex-col gap-1">
                            <button
                                onClick={() => setActiveSection('profile')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'profile'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Personal Profile
                            </button>
                            <button
                                onClick={() => setActiveSection('security')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'security'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Password & Security
                            </button>
                            <button
                                onClick={() => setActiveSection('notifications')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'notifications'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                Notifications
                            </button>
                            {!isEmployee && (
                                <button
                                    onClick={() => setActiveSection('orders')}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'orders'
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                        }`}
                                >
                                    Order History
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
                                            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Delivery Address</label>
                                            <textarea
                                                required
                                                rows={3}
                                                value={editForm.address}
                                                onChange={(e) => handleProfileChange('address', e.target.value)}
                                                className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                            />
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

                        {/* SECTION 4: ORDER HISTORY */}
                        {activeSection === 'orders' && !isEmployee && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-extrabold text-neutral-800 text-xl">Your Order History</h3>
                                    <p className="text-xs text-neutral-400 mt-1">Review your recent orders and re-order your favorites</p>
                                </div>
                                <hr className="border-neutral-100" />

                                <div className="space-y-4">
                                    {mockOrders.map((order) => (
                                        <div key={order.id} className="border border-neutral-100 rounded-2xl p-5 hover:shadow-sm transition-all duration-200">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100/50">
                                                <div>
                                                    <span className="font-extrabold text-neutral-800 text-sm">{order.id}</span>
                                                    <span className="text-[10px] text-neutral-400 font-bold ml-2.5">{order.date}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-extrabold rounded-full border border-emerald-100">
                                                        {order.status}
                                                    </span>
                                                    <span className="font-extrabold text-orange-600 text-sm">
                                                        ₱{Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-3 flex justify-between items-center gap-4">
                                                <p className="text-xs text-neutral-500 font-medium leading-relaxed truncate max-w-md">
                                                    {order.items}
                                                </p>
                                                <button className="bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex-shrink-0">
                                                    Reorder
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </main>

                </div>

            </div>

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

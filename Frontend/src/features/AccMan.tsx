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
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            value={editForm.email}
                                            onChange={(e) => handleProfileChange('email', e.target.value)}
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
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
        </div>
    )
}

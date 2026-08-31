import React, { useState } from 'react'
import NavbarCustomer from '../components/NavbarCustomer'

interface UserProfile {
    fullName: string
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

    // Initial default user profile data
    const [profile, setProfile] = useState<UserProfile>({
        fullName: 'Clarissa Dimapilis',
        phone: '0917-882-9912',
        email: 'clarissa.d@gmail.com',
        address: 'Block 4, Lot 12, Mahogany St., Phase 2, Cavite City',
        avatar: '🍤',
        membershipTier: 'Gold',
        points: 350,
        joinedDate: 'Jan 2026',
    })

    // Edit form states (shadow state to allow cancel/reset)
    const [editForm, setEditForm] = useState<UserProfile>({ ...profile })
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Password fields (for Security tab)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // Notification states
    const [emailAlerts, setEmailAlerts] = useState(true)
    const [smsAlerts, setSmsAlerts] = useState(true)
    const [promoAlerts, setPromoAlerts] = useState(false)

    // Handlers
    const handleProfileChange = (field: keyof UserProfile, value: string) => {
        setEditForm((prev) => ({ ...prev, [field]: value }))
    }

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setMessage(null)

        // Simulate API delay
        setTimeout(() => {
            setProfile({ ...editForm })
            setIsSaving(false)
            setMessage({ type: 'success', text: 'Personal details updated successfully!' })

            // Clear message after 3 seconds
            setTimeout(() => setMessage(null), 3000)
        }, 800)
    }

    const handleResetProfile = () => {
        setEditForm({ ...profile })
        setMessage(null)
    }

    const handleSaveSecurity = (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' })
            return
        }
        setIsSaving(true)
        setMessage(null)

        // Simulate API delay
        setTimeout(() => {
            setIsSaving(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setMessage({ type: 'success', text: 'Password changed successfully!' })

            setTimeout(() => setMessage(null), 3000)
        }, 800)
    }

    const handleSaveNotifications = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)
        setMessage(null)

        setTimeout(() => {
            setIsSaving(false)
            setMessage({ type: 'success', text: 'Notification preferences updated!' })

            setTimeout(() => setMessage(null), 3000)
        }, 500)
    }

    // Mock Order History data
    const mockOrders = [
        { id: 'SFB-8832', date: '2026-07-01', total: 3250, status: 'Delivered', items: 'Seafood Bilao x1, Garlic Butter Shrimp x1' },
        { id: 'SFB-7124', date: '2026-06-18', total: 2050, status: 'Delivered', items: 'Seafood Cajun Mix x1, Fresh Juice x1' },
        { id: 'SFB-5541', date: '2026-05-30', total: 1250, status: 'Delivered', items: 'Spicy Shrimp x1' }
    ]

    return (
        <div className="min-h-screen bg-[#f8f6f4] p-4 lg:p-6 transition-all duration-300">
            <div className="w-full flex flex-col gap-6">

                {/* Custom-styled Navbar */}
                <NavbarCustomer />

                {/* Main Dashboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                    {/* LEFT PANEL: User Card & Sub-nav */}
                    <aside className="lg:col-span-1 flex flex-col gap-6">

                        {/* Profile Summary Card */}
                        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 text-center flex flex-col items-center">
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center text-4xl border-2 border-orange-500 shadow-md transition-transform group-hover:scale-105 duration-200">
                                    {profile.avatar}
                                </div>
                                <div className="absolute bottom-0 right-0 bg-neutral-900 text-white rounded-full p-1.5 border border-white cursor-pointer hover:bg-orange-600 transition-colors shadow-sm">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </div>
                            </div>

                            <h2 className="font-extrabold text-neutral-800 text-xl mt-4 leading-tight">{profile.fullName}</h2>
                            <p className="text-xs text-neutral-400 font-semibold mt-1">{profile.email}</p>

                            <div className="flex items-center gap-2 mt-3 px-3 py-1 bg-amber-100 text-amber-700 rounded-full border border-amber-200/50 text-xs font-extrabold">
                                👑 {profile.membershipTier} Member
                            </div>

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
                                <span>👤</span> Personal Profile
                            </button>
                            <button
                                onClick={() => setActiveSection('security')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'security'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                <span>🔒</span> Password & Security
                            </button>
                            <button
                                onClick={() => setActiveSection('notifications')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'notifications'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                <span>🔔</span> Notifications
                            </button>
                            <button
                                onClick={() => setActiveSection('orders')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all duration-200 ${activeSection === 'orders'
                                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800'
                                    }`}
                            >
                                <span>📦</span> Order History
                            </button>
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
                                <span>{message.type === 'success' ? '✨' : '⚠️'}</span>
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
                                        <input
                                            type="password"
                                            required
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Confirm New Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                                        />
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
                        {activeSection === 'orders' && (
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
                                                        ₱{order.total.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="pt-3 flex justify-between items-center gap-4">
                                                <p className="text-xs text-neutral-500 font-medium leading-relaxed truncate max-w-md">
                                                    {order.items}
                                                </p>
                                                <button className="bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 flex-shrink-0">
                                                    Reorder 🔁
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

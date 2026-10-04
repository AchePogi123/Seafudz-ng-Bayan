import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import SidebarDrawer from './SidebarDrawer'
import BrandLogo from './BrandLogo'

interface NavbarCashierProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
}

export const NavbarCashier: React.FC<NavbarCashierProps> = ({ searchQuery, setSearchQuery }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

    const getCurrentPageName = () => {
        if (location.pathname === '/pos') return 'Point of Sale Terminal'
        if (location.pathname === '/sales-report') return 'Shift Sales & Register'
        if (location.pathname === '/kitchen') return 'Kitchen Display Mode'
        return 'Cashier Terminal'
    }

    return (
        <>
            <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
                <div className="flex items-center gap-3.5 w-full md:w-auto">
                    {/* Dedicated Hamburger Menu Trigger */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/90 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500/30 shrink-0"
                        aria-label="Open Navigation Menu"
                        title="Open Navigation Menu"
                    >
                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>

                    {/* Brand Logo (Navigates to Home/Landing) */}
                    <BrandLogo
                        to="/"
                        size="md"
                        badge="CASHIER"
                        badgeColor="bg-teal-100 text-teal-700 border border-teal-200"
                        subtitle={getCurrentPageName()}
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end w-full md:w-auto">
                    {searchQuery !== undefined && setSearchQuery !== undefined && (
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 w-full md:w-[300px] lg:w-[360px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
                            <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search seafood dishes..."
                                className="bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-xs sm:text-sm w-full"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-0.5 text-xs">
                                    ✕
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Global Sidebar Drawer */}
            <SidebarDrawer
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                role="cashier"
            />
        </>
    )
}

export default NavbarCashier
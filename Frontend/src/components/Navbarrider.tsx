import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import SidebarDrawer from './SidebarDrawer'
import BrandLogo from './BrandLogo'

export const NavbarRider: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

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
                        badge="RIDER"
                        badgeColor="bg-emerald-100 text-emerald-700 border border-emerald-200"
                        subtitle={location.pathname === '/rider' ? 'Rider Dispatch & Tracking' : 'Delivery Dispatch'}
                    />
                </div>
            </header>

            {/* Global Sidebar Drawer */}
            <SidebarDrawer
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                role="rider"
            />
        </>
    )
}

export default NavbarRider

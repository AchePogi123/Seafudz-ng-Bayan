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
                        className="p-1.5 text-slate-800 hover:text-orange-600 transition-colors cursor-pointer focus:outline-none shrink-0 flex items-center justify-center"
                        aria-label="Open Navigation Menu"
                        title="Open Navigation Menu"
                    >
                        <svg className="w-6.5 h-6.5 text-current" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
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

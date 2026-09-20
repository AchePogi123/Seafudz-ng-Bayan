import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import SidebarDrawer from './SidebarDrawer'

export const NavbarAdmin: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

    const getCurrentPageName = () => {
        if (location.pathname === '/admin-dashboard') return 'Admin Dashboard'
        if (location.pathname === '/admin-sales-report') return 'Admin Sales Report'
        if (location.pathname === '/users') return 'User Management'
        if (location.pathname === '/admin-customers') return 'Customer Directory'
        return 'Administrator Panel'
    }

    return (
        <>
            <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
                <div className="flex items-center justify-between gap-4 w-full md:w-auto">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex items-center gap-3 cursor-pointer select-none group text-left focus:outline-none rounded-xl p-1 -m-1 transition-all"
                    >
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-0.5 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
                            <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex items-center justify-center">
                                <img
                                    src="/src/assets/hero.png"
                                    alt="Seafood ng Bayan Logo"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        ; (e.target as HTMLImageElement).src =
                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='68' x='18' font-size='55'>🦞</text></svg>"
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-orange-600 transition-colors">
                                    Seafood ng Bayan
                                </h1>
                                <span className="text-black text-[11px] font-bold uppercase tracking-wider">
                                    ADMIN
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500">{getCurrentPageName()}</p>
                        </div>
                    </button>
                </div>
            </header>

            {/* Global Sidebar Drawer */}
            <SidebarDrawer
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                role="admin"
            />
        </>
    )
}

export default NavbarAdmin
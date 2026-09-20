import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import SidebarDrawer from './SidebarDrawer'

interface NavbarAssistantProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
}

export const NavbarAssistant: React.FC<NavbarAssistantProps> = ({ searchQuery, setSearchQuery }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

    return (
        <>
            <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
                <div className="flex items-center justify-between gap-4 w-full md:w-auto">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex items-center gap-3 cursor-pointer select-none group text-left focus:outline-none rounded-xl p-1 -m-1 transition-all"
                    >
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-0.5 shadow-md group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
                            <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex items-center justify-center">
                                <img
                                    src="/src/assets/hero.png"
                                    alt="Seafood ng Bayan Logo"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        ; (e.target as HTMLImageElement).src =
                                            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f8fafc'/><text y='65' x='35' font-size='45' font-weight='bold' fill='%23ea580c'>S</text></svg>"
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-slate-700 transition-colors">
                                    Seafood ng Bayan
                                </h1>
                                <span className="text-black text-[11px] font-bold uppercase tracking-wider">
                                    ASSISTANT
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500">
                                {location.pathname === '/assistant' ? 'Assistant Dashboard' : 'Assistant Portal'}
                            </p>
                        </div>
                    </button>
                </div>

                {/* Right side search bar */}
                <div className="flex items-center justify-end w-full md:w-auto">
                    {searchQuery !== undefined && setSearchQuery !== undefined && (
                        <div className="flex items-center px-1 py-1.5 w-full md:w-[260px] lg:w-[300px]">
                            <svg className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search customer, ref, address..."
                                className="bg-transparent border-none outline-none text-slate-700 placeholder-slate-400 text-xs w-full focus:outline-none"
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
                role="assistant"
            />
        </>
    )
}

export default NavbarAssistant

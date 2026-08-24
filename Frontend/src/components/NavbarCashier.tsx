import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface NavCashierLink {
    path: string
    label: string
    badge?: string
    icon: React.ReactNode
}

const CASHIER_LINKS: NavCashierLink[] = [
    {
        path: '/pos',
        label: 'Cashier POS',
        badge: 'POS',
        icon: (
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        )
    },
    {
        path: '/sales-report',
        label: 'Sales Report',
        icon: (
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        )
    },
    {
        path: '/kitchen',
        label: 'Kitchen Mode',
        badge: 'Live',
        icon: (
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        )
    }
]

interface NavbarCashierProps {
    searchQuery?: string
    setSearchQuery?: (query: string) => void
}

export const NavbarCashier: React.FC<NavbarCashierProps> = ({ searchQuery, setSearchQuery }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const getCurrentPageName = () => {
        const match = CASHIER_LINKS.find((link) => link.path === location.pathname)
        return match ? match.label : 'Cashier Portal'
    }

    const handleLogout = () => {
        localStorage.removeItem('seafudz_user')
        localStorage.removeItem('seafudz_token')
        setIsMenuOpen(false)
        navigate('/login')
    }

    return (
        <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
            <div className="flex items-center justify-between gap-4 w-full md:w-auto">
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 cursor-pointer select-none group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl p-1 -m-1 transition-all"
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold uppercase tracking-wider">
                                    Cashier
                                    <svg
                                        className={`w-3 h-3 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-500">{getCurrentPageName()}</p>
                        </div>
                    </button>

                    {isMenuOpen && (
                        <div className="absolute left-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50">
                            <div className="py-1.5">
                                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                                    Cashier Menu
                                </span>
                                {CASHIER_LINKS.map((link) => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${location.pathname === link.path
                                                ? 'bg-orange-50 text-orange-600 font-bold'
                                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            {link.icon}
                                            <span>{link.label}</span>
                                        </div>
                                        {link.badge && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                {link.badge}
                                            </span>
                                        )}
                                    </Link>
                                ))}
                            </div>

                            <div className="border-t border-slate-100 pt-1.5 mt-1">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span>Logout</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end w-full md:w-auto">
                {searchQuery !== undefined && setSearchQuery !== undefined ? (
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
                ) : (
                    <div className="hidden md:flex items-center">
                        <span className="text-teal-700 font-bold text-xs bg-teal-50 px-3.5 py-1.5 rounded-full border border-teal-200 flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                            </span>
                            Cashier Mode
                        </span>
                    </div>
                )}
            </div>
        </header>
    )
}

export default NavbarCashier
import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export const NavbarRider: React.FC = () => {
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

    const handleLogout = () => {
        localStorage.removeItem('seafudz_user')
        localStorage.removeItem('seafudz_token')
        sessionStorage.clear()
        setIsMenuOpen(false)
        navigate('/login')
    }

    return (
        <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
            <div className="flex items-center justify-between gap-4 w-full md:w-auto">
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-3 cursor-pointer select-none group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl p-1 -m-1 transition-all"
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-blue-600 transition-colors">
                                    Seafood ng Bayan
                                </h1>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                    Rider
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
                            <p className="text-xs font-medium text-slate-500">
                                {location.pathname === '/rider' ? 'Rider Dashboard' : 'Rider Portal'}
                            </p>
                        </div>
                    </button>

                    {isMenuOpen && (
                        <div className="absolute left-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50">
                            <div className="py-1.5">
                                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                                    Rider Menu
                                </span>

                                {/* Rider Dashboard */}
                                <Link
                                    to="/rider"
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                                        location.pathname === '/rider'
                                            ? 'bg-blue-50 text-blue-600 font-bold'
                                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                        <span>Rider Dashboard</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">
                                        Live
                                    </span>
                                </Link>
                            </div>

                            {/* Logout */}
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

            {/* Live badge */}
            <div className="hidden md:flex items-center">
                <span className="text-blue-700 font-bold text-xs bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                    </span>
                    Rider Mode
                </span>
            </div>
        </header>
    )
}

export default NavbarRider

import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface NavbarCustomerProps {
  searchQuery?: string
  setSearchQuery?: (query: string) => void
}

interface NavCustomerLink {
  path: string
  label: string
  icon: React.ReactNode
}

const CUSTOMER_LINKS: NavCustomerLink[] = [
  {
    path: '/customer-dashboard',
    label: 'Customer Dashboard',
    icon: (
      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    path: '/customer',
    label: 'Online Customer',
    icon: (
      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    path: '/account',
    label: 'Account Management',
    icon: (
      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }
]

export const NavbarCustomer: React.FC<NavbarCustomerProps> = ({ searchQuery, setSearchQuery }) => {
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
    const match = CUSTOMER_LINKS.find((link) => link.path === location.pathname)
    return match ? match.label : 'Customer Portal'
  }

  const handleLogout = () => {
    localStorage.removeItem('seafudz_user')
    localStorage.removeItem('seafudz_token')
    setIsMenuOpen(false)
    navigate('/login')
  }

  return (
    <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
      {/* Brand & Customer Menu */}
      <div className="flex items-center justify-between gap-4 w-full md:w-auto">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                  Customer
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
            <div className="absolute left-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="py-1.5">
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  Customer Menu
                </span>

                {CUSTOMER_LINKS.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${location.pathname === link.path
                        ? 'bg-orange-50 text-orange-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    {link.icon}
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-1.5 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
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

      {/* Optional Search Bar Input */}
      {setSearchQuery !== undefined && (
        <div className="flex-1 max-w-md mx-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      )}

      {/* Right Side Status */}
      <div className="hidden md:flex items-center gap-3">
        <span className="text-amber-800 font-bold text-xs bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Customer View
        </span>
      </div>
    </header>
  )
}

export default NavbarCustomer
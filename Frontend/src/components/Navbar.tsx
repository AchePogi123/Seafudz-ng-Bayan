import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getActiveUser, clearSession, getStoredSessionToken, hasRoutePermission, buildTokenizedUrl } from '../cryptography/cryptoSession'

interface NavbarProps {
  searchQuery?: string
  setSearchQuery?: (query: string) => void
}

interface NavRoleLink {
  path: string
  label: string
  category: 'Operational' | 'Customer' | 'Management'
  badge?: string
  icon: React.ReactNode
}

const NAV_ROLE_LINKS: NavRoleLink[] = [
  {
    path: '/customer',
    label: 'Online Customer',
    category: 'Customer',
    icon: (
      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    path: '/pos',
    label: 'Cashier POS',
    category: 'Operational',
    badge: 'POS',
    icon: (
      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    path: '/kitchen',
    label: 'Kitchen Display System',
    category: 'Operational',
    badge: 'Live',
    icon: (
      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    path: '/assistant',
    label: 'Assistant Mode',
    category: 'Operational',
    icon: (
      <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    path: '/rider',
    label: 'Rider Delivery Mode',
    category: 'Operational',
    icon: (
      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    )
  },
  {
    path: '/sales-report',
    label: 'Sales & Reports',
    category: 'Management',
    icon: (
      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    path: '/dashboard',
    label: 'Admin Dashboard',
    category: 'Management',
    badge: 'Admin',
    icon: (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  },
  {
    path: '/account',
    label: 'Account Settings',
    category: 'Management',
    icon: (
      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    path: '/about',
    label: 'About Seafood ng Bayan',
    category: 'Customer',
    icon: (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
]

export const Navbar: React.FC<NavbarProps> = ({ searchQuery, setSearchQuery }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const activeUser = getActiveUser()
  const sessionToken = getStoredSessionToken()
  const userRole = (activeUser?.role || 'customer').toLowerCase()

  // Filter links by RBAC role permissions
  const isLinkAllowed = (path: string) => hasRoutePermission(userRole, path)

  const operationalLinks = NAV_ROLE_LINKS.filter(
    (item) => item.category === 'Operational' && isLinkAllowed(item.path)
  )
  const customerLinks = NAV_ROLE_LINKS.filter(
    (item) => item.category === 'Customer' && isLinkAllowed(item.path)
  )
  const managementLinks = NAV_ROLE_LINKS.filter(
    (item) => item.category === 'Management' && isLinkAllowed(item.path)
  )

  // Close dropdown on click outside
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
    clearSession()
    navigate('/login')
  }

  const getCurrentRoleName = () => {
    const match = NAV_ROLE_LINKS.find((link) => link.path === location.pathname)
    return match ? match.label : 'Restaurant Navigator'
  }

  const getRoleBadgeStyle = (roleStr: string) => {
    switch (roleStr) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'cashier':
        return 'bg-teal-100 text-teal-700 border-teal-200'
      case 'kitchen':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'rider':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'assistant':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200'
      default:
        return 'bg-orange-100 text-orange-700 border-orange-200'
    }
  }

  return (
    <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
      
      {/* Brand & Navigator Dropdown Trigger */}
      <div className="flex items-center justify-between gap-4 w-full md:w-auto">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            className="flex items-center gap-3 cursor-pointer select-none group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl p-1 -m-1 transition-all"
          >
            {/* Logo */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 p-0.5 shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex items-center justify-center">
                <img
                  src="/src/assets/hero.png"
                  alt="Seafood ng Bayan Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='68' x='18' font-size='55'>🦞</text></svg>"
                  }}
                />
              </div>
            </div>

            {/* Brand Title & Mode indicator */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-orange-600 transition-colors">
                  Seafood ng Bayan
                </h1>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeStyle(userRole)}`}>
                  {userRole}
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
              <p className="text-xs font-medium text-slate-500">{getCurrentRoleName()}</p>
            </div>
          </button>

          {/* Categorized Role-Filtered Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute left-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-slate-100">
              
              {/* Active User Header */}
              {activeUser && (
                <div className="px-3 py-2.5 bg-slate-50 rounded-xl mb-1 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                      {activeUser.fullname || activeUser.username || 'User Profile'}
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${getRoleBadgeStyle(userRole)}`}>
                      {userRole}
                    </span>
                  </div>
                  {sessionToken && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-mono truncate" title={sessionToken}>
                      <span className="text-emerald-500 font-bold">Token:</span>
                      <span className="truncate">{sessionToken.slice(0, 16)}...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Operational Roles */}
              {operationalLinks.length > 0 && (
                <div className="py-1.5">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    Operational Roles
                  </span>
                  {operationalLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={buildTokenizedUrl(link.path, sessionToken || '')}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        location.pathname === link.path
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
              )}

              {/* Customer Portal */}
              {customerLinks.length > 0 && (
                <div className="py-1.5">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    Customer Portal
                  </span>
                  {customerLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={buildTokenizedUrl(link.path, sessionToken || '')}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        location.pathname === link.path
                          ? 'bg-orange-50 text-orange-600 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Management */}
              {managementLinks.length > 0 && (
                <div className="py-1.5">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    Management
                  </span>
                  {managementLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={buildTokenizedUrl(link.path, sessionToken || '')}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        location.pathname === link.path
                          ? 'bg-orange-50 text-orange-600 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Logout Action */}
              <div className="pt-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Log Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Quick Action Buttons */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-rose-50 hover:text-rose-600 active:scale-95 transition-all"
            aria-label="Logout"
            title="Log Out"
          >
            <svg className="w-4.5 h-4.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right Controls: Search Bar & Account Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end w-full md:w-auto">
        {searchQuery !== undefined && setSearchQuery !== undefined ? (
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 w-full md:w-[300px] lg:w-[360px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all duration-200">
            <svg
              className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search seafood dishes..."
              className="bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-xs sm:text-sm w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 text-xs mr-1"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center">
            <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-2 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Operational System Ready
            </span>
          </div>
        )}

        {/* Desktop Profile & Logout Controls */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <Link
            to={buildTokenizedUrl('/account', sessionToken || '')}
            className="h-9 px-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 text-slate-700 hover:bg-slate-200 hover:text-slate-900 active:scale-95 transition-all text-xs font-bold"
            title="Account Settings"
          >
            <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="truncate max-w-[90px]">{activeUser?.fullname || activeUser?.username || 'Profile'}</span>
          </Link>

          <button
            onClick={handleLogout}
            className="h-9 px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Log Out"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar

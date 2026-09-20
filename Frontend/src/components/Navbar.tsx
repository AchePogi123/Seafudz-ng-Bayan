import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUser } from '../cryptography/cryptoSession'
import SidebarDrawer from './SidebarDrawer'

interface NavbarProps {
  searchQuery?: string
  setSearchQuery?: (query: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({ searchQuery, setSearchQuery }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()

  const activeUser = getActiveUser()
  const userRole = (activeUser?.role || 'customer').toLowerCase()

  const getCurrentRoleName = () => {
    switch (location.pathname) {
      case '/customer': return 'Online Customer Menu'
      case '/pos': return 'Cashier Point of Sale'
      case '/kitchen': return 'Kitchen Display System'
      case '/assistant': return 'Order Assistant Panel'
      case '/rider': return 'Rider Delivery Dispatch'
      case '/sales-report': return 'Sales & Financial Reports'
      case '/dashboard': return 'Admin Management'
      case '/account': return 'Account Management'
      default: return 'Seafood ng Bayan'
    }
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
    <>
      <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all duration-200">
        
        {/* Brand & Navigator Dropdown Trigger */}
        <div className="flex items-center justify-between gap-4 w-full md:w-auto">
          <div className="relative">
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-haspopup="true"
              aria-expanded={isSidebarOpen}
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
                      ; (e.target as HTMLImageElement).src =
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='65' x='35' font-size='45' font-weight='bold' fill='%23ea580c'>S</text></svg>"
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
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">{getCurrentRoleName()}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Right Actions & Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end w-full md:w-auto">
          {searchQuery !== undefined && setSearchQuery !== undefined ? (
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 w-full md:w-[280px] lg:w-[320px] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
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

          {/* Side Panel Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs hover:border-slate-300"
            aria-label="Open Navigation Sidebar"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Side Panel</span>
          </button>
        </div>
      </header>

      {/* Global Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role={userRole}
      />
    </>
  )
}

export default Navbar

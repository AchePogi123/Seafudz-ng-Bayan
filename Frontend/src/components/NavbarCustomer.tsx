import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUser, saveActiveUser, isUuidString } from '../cryptography/cryptoSession'
import { API_BASE_URL } from '../utils/api'
import SidebarDrawer from './SidebarDrawer'
import BrandLogo from './BrandLogo'

export const NavbarCustomer: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const [activeUser, setActiveUser] = useState(() => getActiveUser())

  useEffect(() => {
    const user = getActiveUser()
    setActiveUser(user)

    if (user) {
      const email = user.email || ''
      const id = user.id || ''
      if (email || id) {
        fetch(`${API_BASE_URL}/auth/me-profile?email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data && data.data.fullname) {
              const dbName = data.data.fullname
              if (!isUuidString(dbName)) {
                const updated = {
                  ...user,
                  fullname: dbName,
                  phone: data.data.phone || user.phone,
                  address: data.data.address || data.data.delivery_address || user.address,
                }
                saveActiveUser(updated)
                setActiveUser(updated)
              }
            }
          })
          .catch(() => {})
      }
    }
  }, [location.pathname])

  const getCurrentPageName = () => {
    if (location.pathname === '/customer') return 'Online Customer Menu'
    if (location.pathname === '/account') return 'Account Management'
    return 'Customer Portal'
  }

  const getDisplayName = () => {
    if (!activeUser) return 'GUEST MENU'
    const name = activeUser.fullname || activeUser.username || activeUser.email || ''
    if (!name || isUuidString(name)) {
      return activeUser.email ? activeUser.email.split('@')[0] : 'CUSTOMER'
    }
    return name
  }

  return (
    <>
      <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-lg shadow-slate-200/40 flex items-center justify-between gap-4 transition-all duration-200">
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
            badge={getDisplayName()}
            badgeColor="bg-orange-100 text-orange-700 border border-orange-200"
            subtitle={getCurrentPageName()}
          />
        </div>
      </header>

      {/* Global Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        role="customer"
      />
    </>
  )
}

export default NavbarCustomer
import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUser, saveActiveUser, isUuidString } from '../cryptography/cryptoSession'
import { API_BASE_URL } from '../utils/api'
import SidebarDrawer from './SidebarDrawer'

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
      <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-slate-200/40 flex items-center justify-between gap-4 transition-all duration-200">
        {/* Brand & Customer Menu trigger */}
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
                      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23fff7ed'/><text y='65' x='35' font-size='45' font-weight='bold' fill='%23ea580c'>S</text></svg>"
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
                  {getDisplayName()}
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
        role="customer"
      />
    </>
  )
}

export default NavbarCustomer
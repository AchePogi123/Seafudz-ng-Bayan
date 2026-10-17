import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveUser, saveActiveUser, isUuidString } from '../cryptography/cryptoSession'
import { API_BASE_URL } from '../utils/api'
import SidebarDrawer from './SidebarDrawer'
import BrandLogo from './BrandLogo'

export interface NavbarCustomerProps {
  cartItemCount?: number
  cartTotal?: number
  onOpenCart?: () => void
  isCartBumping?: boolean
  cartButtonRef?: React.RefObject<HTMLButtonElement | null>
}

export const NavbarCustomer: React.FC<NavbarCustomerProps> = ({
  cartItemCount = 0,
  cartTotal: _cartTotal = 0,
  onOpenCart,
  isCartBumping = false,
  cartButtonRef,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()
  const [, setActiveUser] = useState(() => getActiveUser())
  const fetchedProfileRef = useRef(false)

  useEffect(() => {
    const user = getActiveUser()
    if (!user) return
    setActiveUser(user)

    if (fetchedProfileRef.current) return
    fetchedProfileRef.current = true

    const email = user.email || ''
    const id = user.id || ''
    if (email || id) {
      fetch(`${API_BASE_URL}/auth/me-profile?email=${encodeURIComponent(email)}&id=${encodeURIComponent(id)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data && data.data.fullname) {
            const dbName = data.data.fullname
            if (!isUuidString(dbName)) {
              const dbPhone = data.data.phone || user.phone
              const dbAddress = data.data.address || data.data.delivery_address || user.address
              if (dbName !== user.fullname || dbPhone !== user.phone || dbAddress !== user.address) {
                const updated = {
                  ...user,
                  fullname: dbName,
                  phone: dbPhone,
                  address: dbAddress,
                }
                saveActiveUser(updated)
                setActiveUser(updated)
              }
            }
          }
        })
        .catch(() => {})
    }
  }, [location.pathname])

  const getCurrentPageName = () => {
    if (location.pathname === '/customer') return 'Online Customer Menu'
    if (location.pathname === '/account') return 'Account Management'
    return 'Customer Portal'
  }

  return (
    <>
      <header className="relative z-40 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3 sm:p-3.5 shadow-lg shadow-slate-200/40 flex items-center justify-between gap-4 transition-all duration-200">
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
            subtitle={getCurrentPageName()}
          />
        </div>

        {/* Shopping Cart Button */}
        {onOpenCart && (
          <button
            ref={cartButtonRef}
            type="button"
            onClick={onOpenCart}
            aria-label={`Open Cart with ${cartItemCount} items`}
            title={cartItemCount > 0 ? `Cart (${cartItemCount} items)` : 'Cart'}
            className={`relative flex items-center justify-center p-2.5 sm:p-2.5 rounded-xl cursor-pointer transition-all duration-200 select-none shrink-0 ${
              cartItemCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25 active:scale-95'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            } ${isCartBumping ? 'animate-cart-bump ring-4 ring-amber-400/40' : ''}`}
          >
            <div className="relative flex items-center justify-center">
              <svg className="w-5.5 h-5.5 text-current" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-2.5 -right-2.5 bg-rose-600 text-white text-[10px] font-black min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </div>
          </button>
        )}
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

import React, { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
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
  const [isScrolled, setIsScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 60)
  const location = useLocation()
  const [, setActiveUser] = useState(() => getActiveUser())
  const fetchedProfileRef = useRef(false)
  const headerCartRef = useRef<HTMLButtonElement | null>(null)
  const floatingCartRef = useRef<HTMLButtonElement | null>(null)

  const updateCartButtonRef = (node: HTMLButtonElement | null, isFloating: boolean) => {
    if (isFloating) {
      floatingCartRef.current = node
    } else {
      headerCartRef.current = node
    }

    if (!cartButtonRef) return
    const shouldTargetThis = isFloating ? isScrolled : !isScrolled
    if (shouldTargetThis && node) {
      if (typeof cartButtonRef === 'function') {
        ;(cartButtonRef as (target: HTMLButtonElement | null) => void)(node)
      } else if ('current' in cartButtonRef) {
        ;(cartButtonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      }
    }
  }

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 60)
          ticking = false
        })
        ticking = true
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!cartButtonRef) return
    const activeNode = isScrolled ? floatingCartRef.current : headerCartRef.current
    if (activeNode) {
      if (typeof cartButtonRef === 'function') {
        ;(cartButtonRef as (target: HTMLButtonElement | null) => void)(activeNode)
      } else if ('current' in cartButtonRef) {
        ;(cartButtonRef as React.MutableRefObject<HTMLButtonElement | null>).current = activeNode
      }
    }
  }, [isScrolled, cartButtonRef])

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
    if (location.pathname === '/customer/purchases' || location.pathname === '/purchases') return 'Your Purchases'
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

        {/* Right Header Navigation: "Your Purchases" Text Button + Shopping Cart */}
        <div className="flex items-center gap-3 sm:gap-4 md:gap-5 shrink-0">
          {location.pathname !== '/customer/purchases' && location.pathname !== '/purchases' && (
            <Link
              to="/customer/purchases"
              className="text-sm sm:text-base font-bold transition-colors cursor-pointer select-none py-1 px-1 whitespace-nowrap text-neutral-700 hover:text-orange-600"
              title="View Your Purchases"
            >
              Your Purchases
            </Link>
          )}

          {/* Shopping Cart Button in Header */}
          {onOpenCart && (
            <button
              ref={(node) => updateCartButtonRef(node, false)}
              type="button"
              onClick={onOpenCart}
              aria-label={`Open Cart with ${cartItemCount} items`}
              title={cartItemCount > 0 ? `Cart (${cartItemCount} items)` : 'Cart'}
              className={`relative flex items-center justify-center p-2.5 sm:p-2.5 rounded-xl cursor-pointer select-none shrink-0 transition-all duration-300 ${
                isScrolled ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'
              } bg-orange-500 hover:bg-orange-600 text-white border border-orange-400/50 shadow-sm shadow-orange-500/30 active:scale-95 ${
                isCartBumping && !isScrolled ? 'animate-cart-bump ring-4 ring-orange-400/60' : ''
              }`}
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
        </div>
      </header>

      {/* Floating Animated Cart Button (Brings down to lower right when scrolled) */}
      {onOpenCart && (
        <button
          ref={(node) => updateCartButtonRef(node, true)}
          type="button"
          onClick={onOpenCart}
          aria-label={`Open Cart with ${cartItemCount} items`}
          title={cartItemCount > 0 ? `Cart (${cartItemCount} items)` : 'Cart'}
          className={`fixed z-50 flex items-center justify-center rounded-full cursor-pointer select-none bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-300/80 shadow-2xl shadow-orange-500/50 hover:shadow-orange-500/70 active:scale-95 w-16 h-16 sm:w-18 sm:h-18 lg:bottom-8 ${
            cartItemCount > 0 ? 'bottom-24' : 'bottom-6'
          } right-4 sm:right-8 ${
            isCartBumping && isScrolled ? 'animate-cart-bump ring-4 ring-orange-400/70' : ''
          }`}
          style={{
            transform: isScrolled
              ? 'translateY(0) scale(1)'
              : 'translateY(calc(-100vh + 110px)) scale(0.65)',
            opacity: isScrolled ? 1 : 0,
            pointerEvents: isScrolled ? 'auto' : 'none',
            transitionProperty: 'transform, opacity, bottom',
            transitionDuration: '550ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.35, 0.64, 1)',
          }}
        >
          <div className="relative flex items-center justify-center">
            <svg
              className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow-xs"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
              />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-3 -right-3 bg-rose-600 text-white text-xs font-black min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-in zoom-in-75">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </div>
        </button>
      )}

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

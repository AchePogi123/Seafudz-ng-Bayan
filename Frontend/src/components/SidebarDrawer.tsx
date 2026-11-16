import React, { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getActiveUser, clearSession, isUuidString } from '../cryptography/cryptoSession'
import BrandLogo from './BrandLogo'

interface SidebarDrawerProps {
  isOpen: boolean
  onClose: () => void
  role?: string
}

interface NavItem {
  path: string
  label: string
  category?: string
  badge?: string
  icon: React.ReactNode
}

/** Short role label shown beside the branch, so the panel always says who you are signed in as. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  rider: 'Rider',
  assistant: 'Assistant',
  customer: 'Customer',
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ isOpen, onClose, role }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = getActiveUser()
  const panelRef = useRef<HTMLElement>(null)

  const getDisplayName = () => {
    const name = currentUser?.fullname || currentUser?.username || ""
    if (name && !isUuidString(name)) return name
    if (currentUser?.email) return currentUser.email.split("@")[0]
    return activeRole
  }

  // Determine active role: Prioritize logged-in user role if available, otherwise fall back to role prop
  const activeRole = (currentUser?.role || role || 'customer').toLowerCase()

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Move focus into the panel when it opens, so keyboard and screen-reader users land inside it
  useEffect(() => {
    if (!isOpen) return
    const firstLink = panelRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')
    firstLink?.focus()
  }, [isOpen])

  // Escape closes; Tab is trapped inside the panel while it is open
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleLogout = () => {
    clearSession()
    onClose()
    navigate('/login')
  }

  // Navigation configurations per role
  const getNavSections = (): { sectionTitle?: string; items: NavItem[] }[] => {
    switch (activeRole) {
      case 'admin':
        return [
          {
            sectionTitle: 'ADMIN PORTAL',
            items: [
              {
                path: '/admin-dashboard',
                label: 'Admin Dashboard',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                )
              },
              {
                path: '/admin-inventory',
                label: 'Inventory Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )
              }
            ]
          },
          {
            sectionTitle: 'REPORTS & MANAGEMENT',
            items: [
              {
                path: '/admin-sales-report',
                label: 'Admin Sales Report',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )
              },
              {
                path: '/users',
                label: 'User Accounts (RBAC)',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 100 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Settings',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
              }
            ]
          }
        ]
      case 'cashier':
        return [
          {
            sectionTitle: 'CASHIER TERMINAL',
            items: [
              {
                path: '/pos',
                label: 'Point of Sale (POS)',
                badge: 'Active',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                path: '/sales-report',
                label: 'Sales Report',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ]
          }
        ]
      case 'kitchen':
        return [
          {
            sectionTitle: 'KITCHEN SYSTEM',
            items: [
              {
                path: '/kitchen',
                label: 'Kitchen Display System',
                badge: 'Live',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ]
          }
        ]
      case 'rider':
        return [
          {
            sectionTitle: 'RIDER PORTAL',
            items: [
              {
                path: '/rider',
                label: 'Deliveries & Orders',
                badge: 'Rider',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ]
          }
        ]
      case 'assistant':
        return [
          {
            sectionTitle: 'ASSISTANT MANAGER',
            items: [
              {
                path: '/assistant',
                label: 'Assistant Portal',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ]
          }
        ]
      default: // customer / guest
        return [
          {
            sectionTitle: 'CUSTOMER PORTAL',
            items: [
              {
                path: '/customer',
                label: 'Online Customer Menu',
                badge: 'Menu',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                )
              },
              {
                path: '/customer/purchases',
                label: 'Your Purchases',
                badge: 'Active',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                )
              },
              {
                path: '/account',
                label: 'Account Management',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ]
          }
        ]
    }
  }

  const roleLabel = ROLE_LABELS[activeRole] || 'Staff'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar Navigation"
        inert={!isOpen}
        className={`fixed top-0 left-0 bottom-0 z-50 flex w-[21rem] max-w-[86vw] flex-col border-r border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-[8px_0_48px_-16px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] transform-gpu will-change-transform motion-reduce:transition-none ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <BrandLogo
            to="/"
            onClick={onClose}
            size="md"
            subtitle="System Navigator"
          />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-[color,background-color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-700 active:scale-[0.94] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2"
            aria-label="Close Sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Branch / Shift Status Banner */}
        <div className="flex items-center justify-between gap-2 border-y border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-600">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="truncate">Caloocan Flagship Branch</span>
          </span>
          <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 ring-1 ring-inset ring-slate-200">
            {roleLabel}
          </span>
        </div>

        {/* Drawer Body - Navigation Links */}
        <nav className="sfb-drawer-scroll flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary">
          {getNavSections().map((section, idx) => (
            <div key={idx} className={idx === 0 ? 'space-y-1' : 'mt-7 space-y-1'}>
              {section.sectionTitle && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {section.sectionTitle}
                </p>
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none transition-[color,background-color,box-shadow] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 ${isActive
                        ? 'bg-orange-500 text-white shadow-[0_1px_2px_rgba(194,65,12,0.24),0_8px_18px_-8px_rgba(249,115,22,0.65)]'
                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                      }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200'
                          }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Drawer Footer - User Profile & Logout */}
        <div className="border-t border-slate-200/80 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 text-sm font-bold text-orange-600 ring-1 ring-inset ring-orange-200">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
                ) : currentUser?.fullname ? (
                  currentUser.fullname.charAt(0).toUpperCase()
                ) : (
                  'G'
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">
                  {getDisplayName()}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {currentUser?.email || currentUser?.username || 'Not logged in'}
                </p>
              </div>
            </div>

            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-[color,background-color,transform] duration-150 ease-out hover:bg-rose-50 hover:text-rose-600 active:scale-[0.94] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2"
                aria-label="Log out"
                title="Log out"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            ) : (
              <Link
                to="/login"
                state={{ from: location.pathname }}
                onClick={onClose}
                className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-[0_1px_2px_rgba(194,65,12,0.24)] transition-colors hover:bg-orange-600 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

export default SidebarDrawer

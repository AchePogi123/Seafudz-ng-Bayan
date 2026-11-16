import React, { useState } from 'react'
import SidebarDrawer from '../SidebarDrawer'
import BrandLogo from '../BrandLogo'

/**
 * Shared chrome for every role's navbar.
 *
 * The header card, the drawer trigger and the brand lockup are identical across
 * the customer, cashier, kitchen, rider, assistant and admin bars, so they live
 * here once. Each navbar supplies its own page title and right-hand actions.
 */

/* ------------------------------------------------------------------ */
/* Icon button                                                         */
/* ------------------------------------------------------------------ */

export interface NavIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger'
  children: React.ReactNode
}

/** 40px square control: a real hit target, a hover wash, and a visible focus ring. */
export const NavIconButton = React.forwardRef<HTMLButtonElement, NavIconButtonProps>(
  ({ label, tone = 'default', children, className = '', ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[color,background-color,transform] duration-150 ease-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.94] ${
        tone === 'danger'
          ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-rose-500/50'
          : 'text-slate-500 hover:bg-orange-50 hover:text-orange-600 focus-visible:ring-orange-500/50'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
)
NavIconButton.displayName = 'NavIconButton'

/* ------------------------------------------------------------------ */
/* Search field                                                        */
/* ------------------------------------------------------------------ */

export interface NavSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Tailwind width classes for the field at each breakpoint. */
  widthClass?: string
}

/** One search field for every bar that has one, so the control reads the same everywhere. */
export const NavSearch: React.FC<NavSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  widthClass = 'w-full md:w-[280px] lg:w-[320px]',
}) => (
  <div
    className={`group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-[background-color,border-color,box-shadow] duration-150 ease-out focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-500/10 ${widthClass}`}
  >
    <svg
      className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-focus-within:text-orange-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
)

/* ------------------------------------------------------------------ */
/* Status pill                                                         */
/* ------------------------------------------------------------------ */

export const NavStatusPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700">
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
    {children}
  </span>
)

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface NavShellProps {
  /** Role whose navigation the drawer should show. */
  role: string
  /** Page name shown under the wordmark. */
  subtitle: string
  /** Right-hand actions: search, cart, status pill. */
  children?: React.ReactNode
  /** Keeps the bar on one row at every width (used by the customer bar). */
  singleRow?: boolean
}

export const NavShell: React.FC<NavShellProps> = ({ role, subtitle, children, singleRow = false }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  return (
    <>
      <header
        className={`relative z-40 flex rounded-2xl border border-slate-200/70 bg-white/85 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:p-3 ${
          singleRow
            ? 'flex-row items-center justify-between gap-3'
            : 'flex-col items-stretch justify-between gap-3 md:flex-row md:items-center'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <NavIconButton
            ref={triggerRef}
            label="Open navigation menu"
            onClick={() => setIsSidebarOpen(true)}
            aria-expanded={isSidebarOpen}
            aria-haspopup="dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </NavIconButton>

          <span aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-slate-200/90 sm:block" />

          <BrandLogo to="/" size="md" subtitle={subtitle} />
        </div>

        {children && (
          <div
            className={`flex min-w-0 items-center gap-2.5 sm:gap-3 ${
              singleRow ? 'shrink-0' : 'w-full flex-col items-stretch justify-end sm:w-auto sm:flex-row sm:items-center'
            }`}
          >
            {children}
          </div>
        )}
      </header>

      <SidebarDrawer
        isOpen={isSidebarOpen}
        onClose={() => {
          setIsSidebarOpen(false)
          triggerRef.current?.focus()
        }}
        role={role}
      />
    </>
  )
}

export default NavShell

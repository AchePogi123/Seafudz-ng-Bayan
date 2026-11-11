/**
 * Inventory UI kit — the one place buttons, fields, dialogs, menus, badges,
 * tables, pagination and empty states are defined for the inventory module.
 * Styling lives in admin-inventory.css under the `inv-` prefix.
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { InventoryItemType, StockStatus } from './inventoryTypes'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/* ---------------------------------------------------------------- Icons */

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z',
  close: 'M6 6l12 12M18 6L6 18',
  edit: 'M16.86 3.49a2.1 2.1 0 013 2.97L8 18.32 4 19.5l1.18-4L16.86 3.49z',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3',
  dots: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  restock: 'M12 4v12m0 0l-4-4m4 4l4-4M5 20h14',
  usage: 'M12 20V8m0 0l-4 4m4-4l4 4M5 4h14',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  box: 'M21 8l-9-5-9 5m18 0l-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  doc: 'M8 3h6l5 5v11a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm6 0v5h5M9 13h6M9 17h6',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zm0 14a2 2 0 012-2h13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checkCircle: 'M9 12l2 2 4-4M12 21a9 9 0 100-18 9 9 0 000 18z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  alertCircle: 'M12 8v5m0 3h.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  info: 'M12 11v6m0-9h.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowLeft: 'M19 12H5m6-7l-7 7 7 7',
  arrowRight: 'M5 12h14m-6-7l7 7-7 7',
  building: 'M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16m0-10h2a2 2 0 012 2v8M8 7h4M8 11h4M8 15h4M2 21h20',
  history: 'M3 12a9 9 0 103-6.7L3 8m0-5v5h5M12 7v5l3 2',
  receive: 'M5 12.5l4.5 4.5L19 7.5',
  cart: 'M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 8H6.2M10 21h.01M17 21h.01',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z',
  refresh: 'M20 11a8 8 0 00-14.9-4M4 4v4h4m-4 5a8 8 0 0014.9 4M20 20v-4h-4',
  layers: 'M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5M3 16l9 5 9-5',
} as const

export type IconName = keyof typeof PATHS

export const Icon: React.FC<{ name: IconName; className?: string; strokeWidth?: number }> = ({
  name,
  className = 'h-4 w-4',
  strokeWidth = 1.8,
}) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    {PATHS[name].split(' M').map((d, i) => (
      <path key={i} d={i === 0 ? d : `M${d}`} />
    ))}
  </svg>
)

/* -------------------------------------------------------------- Buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: IconName
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, loading, className, children, type = 'button', disabled, ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx('inv-btn', `inv-btn--${variant}`, size === 'sm' && 'inv-btn--sm', className)}
      {...rest}
    >
      {loading ? <span className="inv-spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: 'default' | 'danger' }
> = ({ icon, label, tone = 'default', className, ...rest }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx('inv-icon-btn', tone === 'danger' && 'inv-icon-btn--danger', className)}
    {...rest}
  >
    <Icon name={icon} />
  </button>
)

/* --------------------------------------------------------------- Fields */

interface FieldProps {
  label: React.ReactNode
  htmlFor?: string
  required?: boolean
  optional?: boolean
  hint?: React.ReactNode
  error?: string
  className?: string
  children: React.ReactNode
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, required, optional, hint, error, className, children }) => (
  <div className={cx('inv-field', className)}>
    <label className="inv-label" htmlFor={htmlFor}>
      {label}
      {required && (
        <span className="inv-required" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span className="inv-optional">Optional</span>}
    </label>
    {children}
    {error ? (
      <p className="inv-field-error" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
        <Icon name="alertCircle" className="h-3.5 w-3.5 shrink-0" />
        {error}
      </p>
    ) : (
      hint && (
        <p className="inv-hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>
          {hint}
        </p>
      )
    )}
  </div>
)

/** aria props that wire an input to the Field's error/hint text */
export const fieldAria = (id: string, error?: string, hasHint?: boolean) => ({
  id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
})

export const SearchInput: React.FC<{
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}> = ({ value, onChange, placeholder, label, className }) => (
  <div className={cx('inv-search', className)}>
    <Icon name="search" className="inv-search-icon h-4 w-4" />
    <input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="inv-input"
    />
    {value && (
      <button type="button" className="inv-search-clear" aria-label="Clear search" onClick={() => onChange('')}>
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
)

/* ----------------------------------------------------- Segmented control */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: ReadonlyArray<{ value: T; label: string; count?: number }>
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cx('inv-seg', size === 'sm' && 'inv-seg--sm')} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="inv-seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- Badges */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'food' | 'pkg'

export const Badge: React.FC<{
  tone?: BadgeTone
  dot?: boolean
  className?: string
  title?: string
  children: React.ReactNode
}> = ({ tone = 'neutral', dot, className, title, children }) => (
  <span className={cx('inv-badge', `inv-badge--${tone}`, className)} title={title}>
    {dot && <span className="inv-badge-dot" aria-hidden="true" />}
    {children}
  </span>
)

export const STOCK_STATUS_META: Record<StockStatus, { label: string; tone: BadgeTone }> = {
  IN_STOCK: { label: 'In stock', tone: 'success' },
  LOW_STOCK: { label: 'Low stock', tone: 'warning' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
}

export const StockStatusBadge: React.FC<{ status: StockStatus }> = ({ status }) => {
  const meta = STOCK_STATUS_META[status] ?? STOCK_STATUS_META.IN_STOCK
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  )
}

export const TypeBadge: React.FC<{ itemType?: InventoryItemType }> = ({ itemType }) =>
  itemType === 'PACKAGING' ? <Badge tone="pkg">Packaging</Badge> : <Badge tone="food">Food</Badge>

/** "STOCK_RECEIVED" -> "Stock received" */
export const humanize = (value: string) => {
  const s = value.replace(/_/g, ' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const MOVEMENT_TONE: Record<string, BadgeTone> = {
  STOCK_RECEIVED: 'success',
  CONSUMPTION: 'info',
  WASTE: 'danger',
  ADJUSTMENT: 'warning',
  ORDER_RETURN: 'success',
}

/** Friendly names for ledger movement types (customer orders write CONSUMPTION / ORDER_RETURN). */
export const MOVEMENT_LABEL: Record<string, string> = {
  STOCK_RECEIVED: 'Stock received',
  CONSUMPTION: 'Used',
  WASTE: 'Waste',
  ADJUSTMENT: 'Correction',
  ORDER_RETURN: 'Returned from order',
}
export const movementLabel = (type: string) => MOVEMENT_LABEL[type] ?? humanize(type)

/* ------------------------------------------------------------ Formatting */

export const formatPeso = (n: number, decimals = 2) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

export const formatQty = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 3 })

export const formatDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: withTime ? undefined : 'numeric',
    hour: withTime ? 'numeric' : undefined,
    minute: withTime ? '2-digit' : undefined,
  })

/* ------------------------------------------------------------ Stock meter */

export const StockMeter: React.FC<{
  current: number
  min: number
  unit: string
  status: StockStatus
  compact?: boolean
}> = ({ current, min, unit, status, compact }) => {
  const scale = Math.max(min * 2, current, 1)
  const width = Math.min(100, (current / scale) * 100)
  const tick = Math.min(100, (min / scale) * 100)
  return (
    <div className={cx('inv-meter', compact && 'inv-meter--compact')}>
      <div
        className={cx(
          'inv-meter-track',
          status === 'LOW_STOCK' && 'is-low',
          status === 'OUT_OF_STOCK' && 'is-out'
        )}
        role="img"
        aria-label={`${formatQty(current)} ${unit} on hand, minimum ${formatQty(min)} ${unit}`}
      >
        <span className="inv-meter-fill" style={{ width: `${width}%` }} />
        {min > 0 && <span className="inv-meter-tick" style={{ left: `${tick}%` }} />}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Layout pieces */

export const SectionHeader: React.FC<{
  title: string
  description?: string
  actions?: React.ReactNode
}> = ({ title, description, actions }) => (
  <div className="inv-section-header">
    <div className="min-w-0">
      <h2 className="inv-section-title">{title}</h2>
      {description && <p className="inv-section-desc">{description}</p>}
    </div>
    {actions && <div className="inv-section-actions">{actions}</div>}
  </div>
)

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cx('inv-card', className)} {...rest} />
)

export const CardHeader: React.FC<{
  title: string
  description?: string
  actions?: React.ReactNode
  id?: string
}> = ({ title, description, actions, id }) => (
  <div className="inv-card-header">
    <div className="min-w-0">
      <h3 className="inv-card-title" id={id}>
        {title}
      </h3>
      {description && <p className="inv-card-desc">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
)

export const Toolbar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('inv-toolbar', className)}>{children}</div>
)

export const EmptyState: React.FC<{
  icon?: IconName
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
}> = ({ icon = 'box', title, description, action, compact }) => (
  <div className={cx('inv-empty', compact && 'inv-empty--compact')}>
    <div className="inv-empty-icon">
      <Icon name={icon} className="h-5 w-5" />
    </div>
    <p className="inv-empty-title">{title}</p>
    {description && <p className="inv-empty-desc">{description}</p>}
    {action && <div className="inv-empty-action">{action}</div>}
  </div>
)

export const Notice: React.FC<{ tone?: 'danger' | 'warning' | 'info' | 'success'; children: React.ReactNode }> = ({
  tone = 'info',
  children,
}) => (
  <div className={cx('inv-notice', `inv-notice--${tone}`)} role={tone === 'danger' ? 'alert' : undefined}>
    <Icon
      name={tone === 'success' ? 'checkCircle' : tone === 'info' ? 'info' : 'alertCircle'}
      className="mt-px h-4 w-4 shrink-0"
    />
    <div className="min-w-0">{children}</div>
  </div>
)

/* ----------------------------------------------------------- Pagination */

export const Pagination: React.FC<{
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
  noun?: string
}> = ({ page, pageSize, total, onChange, noun = 'items' }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) {
    return total > 0 ? (
      <div className="inv-pagination">
        <span>
          {total} {noun}
        </span>
      </div>
    ) : null
  }
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav className="inv-pagination" aria-label="Pagination">
      <span>
        <b>{from}</b>–<b>{to}</b> of <b>{total}</b> {noun}
      </span>
      <div className="flex items-center gap-1.5">
        <IconButton icon="chevronLeft" label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)} />
        <span className="inv-pagination-page" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <IconButton
          icon="chevronRight"
          label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </nav>
  )
}

/* ----------------------------------------------------------- Row menu */

export interface RowMenuItem {
  label: string
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

export const RowMenu: React.FC<{ items: RowMenuItem[]; label: string }> = ({ items, label }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) btnRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const menuH = menuRef.current?.offsetHeight ?? items.length * 36 + 12
    const menuW = 208
    const flipUp = r.bottom + menuH + 8 > window.innerHeight
    setPos({
      top: flipUp ? r.top - menuH - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8)),
    })
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    first?.focus()
  }, [open, items.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close(false)
    }
    const onScroll = () => close(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, close])

  const onMenuKey = (e: React.KeyboardEvent) => {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      buttons[(idx + 1) % buttons.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      buttons[(idx - 1 + buttons.length) % buttons.length]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inv-icon-btn"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="dots" strokeWidth={3} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="inv-menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
            onKeyDown={onMenuKey}
          >
            {items.map((item) => (
              <React.Fragment key={item.label}>
                {item.separatorBefore && <div className="inv-menu-sep" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cx('inv-menu-item', item.danger && 'is-danger')}
                  onClick={() => {
                    close(false)
                    item.onSelect()
                  }}
                >
                  {item.icon && <Icon name={item.icon} />}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

/* ------------------------------------------------------- Modal & drawer */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openOverlays = 0

function useOverlay(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    openOverlays += 1
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const auto = panel.querySelector<HTMLElement>('[data-autofocus]')
      const firstField = panel.querySelector<HTMLElement>(
        '.inv-dialog-body input:not([disabled]), .inv-dialog-body select:not([disabled]), .inv-dialog-body textarea:not([disabled])'
      )
      ;(auto || firstField || panel).focus()
    })

    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      // only the top-most overlay reacts
      const all = document.querySelectorAll('[data-inv-overlay]')
      if (all[all.length - 1] !== panel.closest('[data-inv-overlay]')) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      } else if (e.key === 'Tab') {
        const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      openOverlays -= 1
      if (openOverlays <= 0) document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, panelRef])
}

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** wrap body + footer in a <form> */
  onSubmit?: (e: React.FormEvent) => void
  role?: 'dialog' | 'alertdialog'
}

export const Modal: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  onSubmit,
  role = 'dialog',
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  useOverlay(open, onClose, panelRef)
  if (!open) return null

  const inner = (
    <>
      <div className="inv-dialog-body">{children}</div>
      {footer && <div className="inv-dialog-footer">{footer}</div>}
    </>
  )

  return createPortal(
    <div className="inv-scope inv-overlay" data-inv-overlay>
      <div className="inv-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx('inv-dialog', `inv-dialog--${size}`)}
      >
        <div className="inv-dialog-header">
          <div className="min-w-0">
            <h2 id={titleId} className="inv-dialog-title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="inv-dialog-desc">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </div>,
    document.body
  )
}

export const Drawer: React.FC<Omit<DialogProps, 'size' | 'onSubmit' | 'role'>> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useOverlay(open, onClose, panelRef)
  if (!open) return null
  return createPortal(
    <div className="inv-scope inv-overlay inv-overlay--drawer" data-inv-overlay>
      <div className="inv-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="inv-drawer"
      >
        <div className="inv-dialog-header">
          <div className="min-w-0">
            <h2 id={titleId} className="inv-dialog-title">
              {title}
            </h2>
            {description && <div className="inv-dialog-desc">{description}</div>}
          </div>
          <IconButton icon="close" label="Close details" onClick={onClose} />
        </div>
        <div className="inv-dialog-body">{children}</div>
        {footer && <div className="inv-dialog-footer">{footer}</div>}
      </aside>
    </div>,
    document.body
  )
}

/* ------------------------------------------------------------ Skeletons */

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <span className={cx('inv-skeleton', className)} style={style} aria-hidden="true" />
)

export const TabSkeleton: React.FC = () => (
  <div className="space-y-5" role="status" aria-label="Loading inventory section">
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <Skeleton className="h-9 w-36 rounded-lg" />
    </div>
    <div className="inv-card overflow-hidden">
      <div className="flex gap-3 border-b border-[var(--inv-border)] p-4">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-[var(--inv-border)] px-4 py-4 last:border-0">
          <Skeleton className="h-4 flex-[2]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
    <span className="sr-only">Loading…</span>
  </div>
)

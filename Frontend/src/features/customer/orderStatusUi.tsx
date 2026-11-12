/**
 * Order status presentation kit (online customer side).
 *
 * The tracking view used to draw each card with a dark gradient header bar, an emoji in a tile, and
 * a filled grey box around every single field. Three of those stacked read as heavy and crowded,
 * and the boxes-inside-boxes buried the one thing the customer came for: where their order is now.
 *
 * So: white cards, a quiet text heading on a hairline, and open label/value rows. Weight is spent
 * on the current step and the total, and nowhere else. One stroke-icon family throughout — emoji
 * render differently on every device and sit off the text baseline.
 */
import React from 'react'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

/* ------------------------------------------------------------------- icons */

const PATHS = {
  receipt: 'M7 3h10a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zm2 5h6M9 12h6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cooking: 'M5 11h14m-7-4V5m-6 6a6 6 0 0012 0M4 20h16',
  bag: 'M5 8h14l-1.1 11a1 1 0 01-1 .9H7.1a1 1 0 01-1-.9L5 8zm3.5 0V6.5a3.5 3.5 0 017 0V8',
  scooter: 'M5.5 19a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zm13 0a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM8.25 16.25h7.5M14.5 16.25L12.25 6.5H10m2.75 3.5H16l2 6.25',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zm0-13a2.5 2.5 0 110 5 2.5 2.5 0 010-5z',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 3h18M7 15h3',
  arrowLeft: 'M19 12H5m6-7l-7 7 7 7',
  arrowRight: 'M5 12h14m-6-7l7 7-7 7',
  info: 'M12 11v5m0-8h.01M12 21a9 9 0 100-18 9 9 0 000 18z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 17.6A2 2 0 004.1 20.6h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  camera: 'M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm9 10a4 4 0 100-8 4 4 0 000 8z',
} as const

export type OrderIconName = keyof typeof PATHS

export const OrderIcon: React.FC<{ name: OrderIconName; className?: string; strokeWidth?: number }> = ({
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

/* ------------------------------------------------------------------ panels */

/**
 * A white card with a quiet heading on a hairline. `meta` is the small right-aligned fact that
 * belongs to the heading (item count, status word) rather than to any single row inside.
 */
export const Panel: React.FC<{
  title: string
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}> = ({ title, meta, children, className }) => (
  <section className={cx('rounded-2xl border border-neutral-200 bg-white overflow-hidden', className)}>
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
      <h4 className="text-sm font-bold text-neutral-900">{title}</h4>
      {meta ? <div className="shrink-0 text-xs text-neutral-500">{meta}</div> : null}
    </div>
    {children}
  </section>
)

/** Rows inside a panel, separated by hairlines rather than each sitting in its own filled box. */
export const PanelRows: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('divide-y divide-neutral-100 px-5', className)}>{children}</div>
)

/**
 * One label/value row. The value is allowed to wrap; the label never does, so the pair stays
 * readable when an address or a long dish name runs on.
 */
export const InfoRow: React.FC<{
  label: string
  children: React.ReactNode
  mono?: boolean
  /** For values that run past a line — an address, a note. Reading them ragged-left is the problem. */
  stacked?: boolean
  className?: string
}> = ({ label, children, mono, stacked, className }) =>
  stacked ? (
    <div className={cx('py-3', className)}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={cx('mt-1 text-sm font-medium leading-relaxed text-neutral-900', mono && 'font-mono tabular-nums')}>
        {children}
      </dd>
    </div>
  ) : (
    <div className={cx('flex items-baseline justify-between gap-5 py-3', className)}>
      <dt className="shrink-0 text-xs text-neutral-500">{label}</dt>
      <dd className={cx('min-w-0 text-right text-sm font-semibold text-neutral-900', mono && 'font-mono tabular-nums')}>
        {children}
      </dd>
    </div>
  )

/** A quiet note inside a panel: tinted ground, text tinted from the same hue, never grey on colour. */
export const PanelNote: React.FC<{
  tone?: 'neutral' | 'brand' | 'positive'
  icon?: OrderIconName
  children: React.ReactNode
}> = ({ tone = 'neutral', icon, children }) => {
  const tones = {
    neutral: 'bg-neutral-50 text-neutral-700',
    brand: 'bg-orange-50 text-orange-900',
    positive: 'bg-emerald-50 text-emerald-900',
  } as const
  return (
    <div className={cx('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs leading-relaxed', tones[tone])}>
      {icon ? <OrderIcon name={icon} className="mt-px h-4 w-4 shrink-0 opacity-70" /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ status */

export type StatusTone = 'neutral' | 'brand' | 'positive' | 'warning' | 'critical'

const PILL_TONES: Record<StatusTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700',
  brand: 'bg-orange-100 text-orange-800',
  positive: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  critical: 'bg-rose-100 text-rose-800',
}

const DOT_TONES: Record<StatusTone, string> = {
  neutral: 'bg-neutral-400',
  brand: 'bg-orange-500',
  positive: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
}

/** Status is always a dot plus a word, so it never depends on colour alone. */
export const StatusPill: React.FC<{ tone?: StatusTone; children: React.ReactNode; className?: string }> = ({
  tone = 'neutral',
  children,
  className,
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
      PILL_TONES[tone],
      className
    )}
  >
    <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[tone])} />
    {children}
  </span>
)

/**
 * A full-width notice: cancellation, refund, payment, completion. One hairline border and a tinted
 * ground — no gradient bands, no pulsing. The tone carries the urgency.
 */
export const Notice: React.FC<{
  tone?: StatusTone
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}> = ({ tone = 'neutral', title, children, action }) => {
  const grounds: Record<StatusTone, string> = {
    neutral: 'border-neutral-200 bg-neutral-50',
    brand: 'border-orange-200 bg-orange-50',
    positive: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-rose-200 bg-rose-50',
  }
  const titles: Record<StatusTone, string> = {
    neutral: 'text-neutral-900',
    brand: 'text-orange-900',
    positive: 'text-emerald-900',
    warning: 'text-amber-900',
    critical: 'text-rose-900',
  }
  const bodies: Record<StatusTone, string> = {
    neutral: 'text-neutral-600',
    brand: 'text-orange-800',
    positive: 'text-emerald-800',
    warning: 'text-amber-800',
    critical: 'text-rose-800',
  }
  return (
    <div className={cx('flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between', grounds[tone])}>
      <div className="min-w-0">
        <p className={cx('text-sm font-bold', titles[tone])}>{title}</p>
        {children ? <div className={cx('mt-1 text-xs leading-relaxed', bodies[tone])}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/**
 * The order's state in the customer's words, for the line under the order number.
 *
 * The tracker shows the sequence; this says what it means right now. Written as plain sentences
 * rather than status codes, because "PENDING_STORE_PICKUP" tells a customer nothing about whether
 * they should be heading to the counter.
 */
export function describeOrderStatus(
  status: string,
  { isPickup, isOutOfStock, hasRefundProof }: { isPickup?: boolean; isOutOfStock?: boolean; hasRefundProof?: boolean } = {}
): { label: string; detail: string; tone: StatusTone } {
  if (isOutOfStock || status === 'OUT_OF_STOCK') {
    return {
      label: 'Needs your choice',
      detail: 'An item sold out. Pick a replacement or request a refund below.',
      tone: 'warning',
    }
  }
  switch (status) {
    case 'CANCEL_REQUESTED':
      return { label: 'Cancelling', detail: 'Your refund is being arranged by our assistant.', tone: 'warning' }
    case 'CANCELLED':
      return hasRefundProof
        ? { label: 'Cancelled', detail: 'This order was cancelled and refunded.', tone: 'neutral' }
        : { label: 'Cancelled', detail: 'This order was cancelled.', tone: 'critical' }
    case 'CONFIRMED':
      return { label: 'Confirmed', detail: 'Your payment is verified and the kitchen has your order.', tone: 'brand' }
    case 'PREPARING':
      return { label: 'Preparing', detail: 'Our kitchen is cooking your order now.', tone: 'brand' }
    case 'READY':
      return isPickup
        ? { label: 'Ready', detail: 'Your order is waiting at the counter.', tone: 'positive' }
        : { label: 'Ready', detail: 'Your order is packed and waiting for a rider.', tone: 'positive' }
    case 'OUT_FOR_DELIVERY':
      return { label: 'On the way', detail: 'Your rider is heading to your address.', tone: 'brand' }
    case 'COMPLETED':
      return isPickup
        ? { label: 'Picked up', detail: 'Thanks for ordering. Enjoy your meal!', tone: 'positive' }
        : { label: 'Delivered', detail: 'Thanks for ordering. Enjoy your meal!', tone: 'positive' }
    default:
      return { label: 'Order placed', detail: 'We are confirming your payment.', tone: 'neutral' }
  }
}

/* ----------------------------------------------------------------- tracker */

export type ProgressStep = { key: string; label: string; icon: OrderIconName }

/**
 * Where the order is, as a sequence.
 *
 * Done steps are a light brand tint, the current step is the one solid element on the screen, and
 * what is still ahead is an outline. Weight alone says which is which, so the colours are doing
 * confirmation rather than the whole job. Horizontal from `sm` up, a vertical list below it, where
 * six labels across a phone would either truncate or fall over.
 */
export const OrderProgress: React.FC<{ steps: ProgressStep[]; currentIndex: number }> = ({ steps, currentIndex }) => {
  const stateOf = (idx: number) => (idx === currentIndex ? 'current' : idx < currentIndex ? 'done' : 'upcoming')

  const marker = (state: string) =>
    cx(
      'flex items-center justify-center rounded-full transition-colors duration-300',
      state === 'current'
        ? 'bg-orange-500 text-white ring-4 ring-orange-100'
        : state === 'done'
          ? 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200'
          : 'bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200'
    )

  // Weight and colour both step down, and every step stays at or above 4.5:1 on the page ground —
  // a step the customer has not reached yet is quieter, not unreadable.
  const labelClass = (state: string) =>
    cx(
      'transition-colors duration-300',
      state === 'current'
        ? 'font-semibold text-neutral-900'
        : state === 'done'
          ? 'text-neutral-800'
          : 'text-neutral-600'
    )

  return (
    <div>
      {/* Horizontal, tablet and up */}
      <ol className="hidden sm:flex sm:items-start">
        {steps.map((step, idx) => {
          const state = stateOf(idx)
          const isLast = idx === steps.length - 1
          return (
            <li key={step.key} className={cx('flex items-start', !isLast && 'flex-1')}>
              <div className="flex w-20 shrink-0 flex-col items-center gap-2 lg:w-28">
                <span className={cx(marker(state), 'h-9 w-9 lg:h-10 lg:w-10')}>
                  <OrderIcon
                    name={state === 'done' ? 'check' : step.icon}
                    className="h-5 w-5"
                    strokeWidth={state === 'current' ? 2 : 1.8}
                  />
                </span>
                <span className={cx('text-center text-[11px] leading-tight lg:text-xs', labelClass(state))}>
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <span aria-hidden="true" className="mt-[18px] h-0.5 flex-1 rounded-full bg-neutral-200 lg:mt-5">
                  <span
                    className={cx(
                      'block h-full rounded-full bg-orange-200 transition-[width] duration-500 ease-out',
                      idx < currentIndex ? 'w-full' : 'w-0'
                    )}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Vertical, phone */}
      <ol className="sm:hidden">
        {steps.map((step, idx) => {
          const state = stateOf(idx)
          const isLast = idx === steps.length - 1
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cx(marker(state), 'h-8 w-8')}>
                  <OrderIcon name={state === 'done' ? 'check' : step.icon} className="h-[18px] w-[18px]" />
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'my-1 w-0.5 flex-1 rounded-full min-h-5',
                      idx < currentIndex ? 'bg-orange-200' : 'bg-neutral-200'
                    )}
                  />
                )}
              </div>
              <span className={cx('pb-5 pt-2 text-sm leading-none', labelClass(state))}>{step.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

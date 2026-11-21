/**
 * Staff-side icon set.
 *
 * The POS register, the processing tracker and the pick-up board used emoji for every affordance —
 * 🖨️ to print, 🗑️ to delete, 🕒 for a timestamp. Emoji render as a different glyph on every OS,
 * carry their own colour, sit off the text baseline, and cannot inherit a disabled or hover state,
 * so a bar of them reads as decoration rather than as controls.
 *
 * This is the same family the customer side draws (`features/customer/orderStatusUi.tsx`): one 24px
 * grid, one 1.8 stroke, round caps and joins, `currentColor` throughout — so an icon picks up the
 * colour of whatever control holds it, and a receipt looks the same to the cashier as to the
 * customer. The shared concepts are imported rather than redrawn.
 */
import React from 'react'
import { ORDER_ICON_PATHS } from '../features/customer/orderStatusUi'

/** Concepts the staff screens need that the customer flow never shows. */
const POS_PATHS = {
  cart: 'M3 4h2l2.4 11.1a1 1 0 001 .8h8.3a1 1 0 001-.8L19.5 8H6.2M9.5 20.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4zm7 0a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z',
  clipboard: 'M9 4.5H7.5a2 2 0 00-2 2v12a2 2 0 002 2h9a2 2 0 002-2v-12a2 2 0 00-2-2H15M9 4.5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-1zM8.5 11h7M8.5 14.5h4.5',
  printer: 'M7 9V4.5h10V9M7 17.5H5.5a1.5 1.5 0 01-1.5-1.5v-5a1.5 1.5 0 011.5-1.5h13A1.5 1.5 0 0120 11v5a1.5 1.5 0 01-1.5 1.5H17M7 14h10v5.5H7V14zm10.5-2.5h.01',
  trash: 'M4.5 7h15M9.5 7V5.5a1 1 0 011-1h3a1 1 0 011 1V7m2 0v12a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 016 19V7M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3zM14.5 7.5l2 2',
  plus: 'M12 5v14M5 12h14',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  lock: 'M6.5 10.5h11a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-7a1 1 0 011-1zm1.8 0V7.8a3.7 3.7 0 017.4 0v2.7M12 14.5v2',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.5V12l3 1.8',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0',
  phone: 'M7 3.5h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a1.5 1.5 0 01-1.6 1.5A16.5 16.5 0 015.5 5.1 1.5 1.5 0 017 3.5z',
  eye: 'M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12zm9.5 2.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2z',
  cash: 'M3.5 6.5h17a1 1 0 011 1v9a1 1 0 01-1 1h-17a1 1 0 01-1-1v-9a1 1 0 011-1zM12 15a3 3 0 100-6 3 3 0 000 6zM6 9.5h.01M18 14.5h.01',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4.2-4.2',
} as const

const PATHS = { ...ORDER_ICON_PATHS, ...POS_PATHS }

export type PosIconName = keyof typeof PATHS

export const PosIcon: React.FC<{
  name: PosIconName
  className?: string
  strokeWidth?: number
}> = ({ name, className = 'h-4 w-4', strokeWidth = 1.8 }) => (
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

export default PosIcon

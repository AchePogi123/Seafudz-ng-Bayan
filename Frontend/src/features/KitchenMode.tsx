import React, { useState, useEffect, useRef, useMemo } from 'react'
import NavbarKitchen from '../components/NavbarKitchen'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { useProductImages } from '../utils/useProductImages'
import KitchenStockPanel from '../components/KitchenStockPanel'
import { executeReceiptPrint } from './ReceiptModal'
import { Badge, Button, Icon } from './inventory/ui'
import './inventory/admin-inventory.css'

/**
 * How long a ticket has been cooking, in whole minutes.
 * Returns null for tickets that have not started.
 */
const elapsedMinutes = (order: { status?: string; startTime?: number | null }, now: number): number | null => {
  if (order.status !== 'Preparing' || !order.startTime) return null
  return Math.floor((now - order.startTime) / 60000)
}

/**
 * The age of a cooking ticket is the one thing a cook needs from across the
 * room, so it is the only element on the board that changes colour on its own.
 */
/**
 * Tickets arrive carrying a full order ref (`SFB-dc0999fb-69cb-…`), which is
 * unreadable as a headline. The board shows a short tail code a cook can call
 * across the kitchen; the full ref stays on the element and in the detail view.
 */
const ticketLabel = (ref: string): string => {
  const raw = String(ref || '').trim()
  if (!raw) return '—'
  if (/^\d{1,4}$/.test(raw)) return raw
  const tail = raw.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()
  return tail || raw.slice(0, 6).toUpperCase()
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  )

const formatFormalTimestamp = (dateInput?: string | Date): string => {
  const d = dateInput ? new Date(dateInput) : new Date()
  if (isNaN(d.getTime())) return String(dateInput || '—')
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Formal Kitchen Order Dispatch & Ownership Slip.
 *
 * Structured as an official kitchen pass manifest (rather than a cash register
 * sales receipt) containing complete ownership, reference, timestamp, and
 * itemized dish details.
 */
const generateKitchenSlipHtml = (order: KitchenOrder, sameCustomer?: SameCustomerMark): string => {
  const items = (order.items || []).filter(
    (item) =>
      !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(
        String(item.itemStatus || (item as any).item_status || '').toUpperCase()
      )
  )
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  const ownerName = (order.customer || '').trim() || 'Walk-In Customer'
  const ticketNo = ticketLabel(order.queue)
  const placedAt = order.createdAt ? formatFormalTimestamp(order.createdAt) : '—'
  const releasedAt = formatFormalTimestamp(new Date())
  const contactPhone = (order.customerPhone || '').trim()
  const notesText = (order.notes || '').trim()

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Kitchen Dispatch Slip - #${escapeHtml(ticketNo)} (${escapeHtml(ownerName)})</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      @media print {
        html, body {
          width: 80mm;
          margin: 0 !important;
          padding: 4px !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif;
        width: 288px;
        margin: 0 auto;
        padding: 8px;
        color: #0f172a;
        background: #ffffff;
        font-size: 11px;
        line-height: 1.4;
        font-variant-numeric: tabular-nums;
      }
      .manifest {
        border: 1.5px solid #0f172a;
        background: #ffffff;
      }
      .doc-header {
        background: #0f172a;
        color: #ffffff;
        padding: 10px 12px;
        text-align: center;
        border-bottom: 1.5px solid #0f172a;
      }
      .doc-title {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .doc-sub {
        margin: 2px 0 0;
        font-size: 10px;
        font-weight: 500;
        color: #cbd5e1;
      }
      .owner-grid {
        display: table;
        width: 100%;
        border-bottom: 1.5px solid #0f172a;
      }
      .owner-cell {
        display: table-cell;
        vertical-align: top;
        padding: 10px 12px;
      }
      .ticket-cell {
        display: table-cell;
        vertical-align: top;
        width: 92px;
        padding: 10px 12px;
        text-align: right;
        background: #f8fafc;
        border-left: 1px solid #cbd5e1;
      }
      .field-label {
        display: block;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #475569;
      }
      .owner-name {
        display: block;
        margin-top: 2px;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.2;
        color: #0f172a;
        word-break: break-word;
      }
      .owner-phone {
        display: block;
        margin-top: 3px;
        font-size: 10px;
        font-weight: 500;
        color: #334155;
      }
      .ticket-num {
        display: block;
        margin-top: 2px;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.15;
        color: #0f172a;
      }
      .companion-bar {
        padding: 7px 12px;
        background: #f8fafc;
        border-bottom: 1px solid #0f172a;
        font-size: 10px;
        font-weight: 600;
        color: #0f172a;
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
      .meta-table {
        width: 100%;
        border-collapse: collapse;
        border-bottom: 1.5px solid #0f172a;
      }
      .meta-table td {
        padding: 5px 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 10px;
        vertical-align: top;
      }
      .meta-table tr:last-child td {
        border-bottom: none;
      }
      .meta-key {
        width: 42%;
        font-weight: 600;
        color: #475569;
        white-space: nowrap;
      }
      .meta-val {
        width: 58%;
        font-weight: 600;
        color: #0f172a;
        text-align: right;
        word-break: break-all;
      }
      .items-table {
        width: 100%;
        border-collapse: collapse;
        border-bottom: 1.5px solid #0f172a;
      }
      .items-table th {
        background: #f8fafc;
        padding: 6px 12px;
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #334155;
        text-align: left;
        border-bottom: 1px solid #0f172a;
      }
      .items-table th.col-no {
        width: 26px;
        padding-right: 4px;
      }
      .items-table th.col-qty {
        width: 48px;
        text-align: right;
      }
      .items-table td {
        padding: 6px 12px;
        font-size: 11px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .items-table td.col-no {
        padding-right: 4px;
        color: #64748b;
        font-weight: 600;
      }
      .items-table td.col-item {
        font-weight: 600;
        color: #0f172a;
      }
      .items-table td.col-qty {
        text-align: right;
        font-weight: 700;
        color: #0f172a;
      }
      .items-table tfoot td {
        background: #f8fafc;
        padding: 6px 12px;
        font-size: 10px;
        font-weight: 700;
        color: #0f172a;
        border-top: 1px solid #0f172a;
        border-bottom: none;
      }
      .notes-block {
        padding: 8px 12px;
        border-bottom: 1.5px solid #0f172a;
      }
      .notes-body {
        margin-top: 3px;
        font-size: 11px;
        font-weight: 600;
        color: #0f172a;
        word-break: break-word;
      }
      .notes-empty {
        margin-top: 2px;
        font-size: 10px;
        font-weight: 500;
        color: #64748b;
      }
      .doc-footer {
        padding: 8px 12px;
        background: #f8fafc;
        text-align: center;
      }
      .doc-footer-title {
        font-size: 10px;
        font-weight: 700;
        color: #0f172a;
      }
      .doc-footer-sub {
        margin-top: 2px;
        font-size: 9px;
        font-weight: 500;
        color: #475569;
      }
    </style>
  </head>
  <body>
    <div class="manifest">
      <header class="doc-header">
        <h1 class="doc-title">Seafudz ng Bayan</h1>
        <p class="doc-sub">Kitchen Order Dispatch &amp; Ownership Slip &middot; Caloocan Hub</p>
      </header>

      <section class="owner-grid">
        <div class="owner-cell">
          <span class="field-label">Order Owner / Customer</span>
          <span class="owner-name">${escapeHtml(ownerName)}</span>
          ${contactPhone ? `<span class="owner-phone">Contact: ${escapeHtml(contactPhone)}</span>` : ''}
        </div>
        <div class="ticket-cell">
          <span class="field-label">Ticket No.</span>
          <span class="ticket-num">#${escapeHtml(ticketNo)}</span>
        </div>
      </section>

      ${sameCustomer
        ? `<div class="companion-bar">
             <span>Multi-Order Package ${sameCustomer.position} of ${sameCustomer.total}</span>
             <span>Companion: #${escapeHtml(sameCustomer.siblingIds.map(ticketLabel).join(', #'))}</span>
           </div>`
        : ''}

      <table class="meta-table">
        <tbody>
          <tr>
            <td class="meta-key">Order Reference</td>
            <td class="meta-val">${escapeHtml(order.queue)}</td>
          </tr>
          <tr>
            <td class="meta-key">Order Placed</td>
            <td class="meta-val">${escapeHtml(placedAt)}</td>
          </tr>
          <tr>
            <td class="meta-key">Dispatched At</td>
            <td class="meta-val">${escapeHtml(releasedAt)}</td>
          </tr>
        </tbody>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th class="col-no">#</th>
            <th>Prepared Dish Description</th>
            <th class="col-qty">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, idx) =>
                `<tr>
                  <td class="col-no">${idx + 1}</td>
                  <td class="col-item">${escapeHtml(item.name)}</td>
                  <td class="col-qty">${escapeHtml(item.quantity)}</td>
                </tr>`
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total Prepared (${items.length} ${items.length === 1 ? 'line item' : 'line items'})</td>
            <td class="col-qty">${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}</td>
          </tr>
        </tfoot>
      </table>

      <section class="notes-block">
        <span class="field-label">Kitchen &amp; Preparation Instructions</span>
        ${notesText
          ? `<div class="notes-body">${escapeHtml(notesText)}</div>`
          : `<div class="notes-empty">No special preparation instructions recorded.</div>`}
      </section>

      <footer class="doc-footer">
        <div class="doc-footer-title">Official Kitchen Pass &amp; Ownership Record</div>
        <div class="doc-footer-sub">Attach this dispatch manifest securely to the customer&#39;s order package.</div>
      </footer>
    </div>
  </body>
</html>`
}

const ageTone = (mins: number | null): 'calm' | 'warn' | 'late' => {
  if (mins === null) return 'calm'
  if (mins >= 20) return 'late'
  if (mins >= 12) return 'warn'
  return 'calm'
}

interface OrderItem {
  id?: number
  productId?: string
  name: string
  quantity: number
  price?: number
  itemStatus?: string
}

export interface KitchenOrder {
  id: string
  queue: string
  type: string
  category: string
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed' | string
  items: OrderItem[]
  customer?: string
  /** Who placed it, for spotting a customer with more than one ticket on the board. */
  customerId?: string
  customerPhone?: string
  notes?: string
  total?: number
  createdAt?: string
  paymentMethod?: string
  startTime?: number | null
  completedTimeElapsed?: string
}

/**
 * Identity key for "these two tickets are the same customer", or '' when the ticket cannot be
 * attributed to anyone. The account id is used when there is one, the phone number otherwise.
 *
 * The display name is deliberately NOT a fallback: the backend coalesces it to the literal
 * 'Customer' and this screen falls back to 'Online Customer' / 'Store Pick-Up Customer', so
 * matching on it would group unrelated people under the same marker. Same approach as the rider
 * board's companion matching in rideRoleDemo.tsx.
 */
const customerIdentityKey = (order: KitchenOrder): string => {
  const id = String(order.customerId || '').trim().toLowerCase()
  if (id) return `id:${id}`
  const digits = String(order.customerPhone || '').replace(/\D/g, '')
  return digits.length >= 7 ? `tel:${digits}` : ''
}

/** What a ticket needs to show about the customer's other live tickets. */
interface SameCustomerMark {
  position: number
  total: number
  siblingIds: string[]
}

/**
 * Finds the customers who have more than one ticket live on the board, and returns a per-order
 * marker. Deliberately does NOT reorder or group anything: the queue keeps its first-come order
 * and the tickets stay separate, they just carry a flag so the kitchen knows to bag them together.
 */
const findSameCustomerTickets = (orders: KitchenOrder[]): Map<string, SameCustomerMark> => {
  const byCustomer = new Map<string, KitchenOrder[]>()
  for (const order of orders) {
    const key = customerIdentityKey(order)
    if (!key) continue
    const bucket = byCustomer.get(key)
    if (bucket) bucket.push(order)
    else byCustomer.set(key, [order])
  }

  const marks = new Map<string, SameCustomerMark>()
  for (const group of byCustomer.values()) {
    if (group.length < 2) continue
    group.forEach((order, idx) => {
      marks.set(String(order.id), {
        position: idx + 1,
        total: group.length,
        siblingIds: group.filter((o) => o.id !== order.id).map((o) => String(o.id)),
      })
    })
  }
  return marks
}

interface TicketCardProps {
  order: KitchenOrder
  mode: 'queued' | 'cooking'
  now: number
  sameCustomer?: SameCustomerMark
  onSelectOrder: (orderId: string) => void
  onTicketAction: (order: KitchenOrder, mode: 'queued' | 'cooking') => void
}

const formatPrepTimeDisplay = (order: KitchenOrder, now: number) => {
  if (order.status === 'Preparing' && order.startTime) {
    const elapsedSec = Math.floor((now - order.startTime) / 1000)
    const mins = Math.floor(elapsedSec / 60)
    const secs = elapsedSec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }
  if (order.completedTimeElapsed) {
    return order.completedTimeElapsed
  }
  return '--'
}

/**
 * Top-level ticket card component.
 *
 * Kept outside KitchenMode so the 1-second timer tick (`now`) updates the timer
 * text in-place instead of unmounting and remounting the card and its action
 * button on every tick.
 */
const TicketCard: React.FC<TicketCardProps> = ({
  order,
  mode,
  now,
  sameCustomer,
  onSelectOrder,
  onTicketAction,
}) => {
  const mins = elapsedMinutes(order, now)
  const tone = ageTone(mins)
  const isPickup = String(order.category || order.type || '').toUpperCase().includes('PICKUP')
  const prepTime = formatPrepTimeDisplay(order, now)
  const liveItems = order.items.filter(
    (item) =>
      !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(
        String(item.itemStatus || (item as any).item_status || '').toUpperCase()
      )
  )

  return (
    <article className={`kds-ticket kds-ticket--${mode} kds-age-${tone}`}>
      <span className="kds-ticket-pin" aria-hidden="true">
        <span className="kds-ticket-pin-head" />
      </span>
      <button type="button" className="kds-ticket-body" onClick={() => onSelectOrder(order.id)}>
        <span className="kds-ticket-top">
          <span className="kds-ticket-no" title={`Order ${order.queue}`}>
            {ticketLabel(order.queue)}
          </span>
          {mode === 'cooking' ? (
            <span className="kds-timer" aria-label={`Cooking for ${prepTime}`}>
              {prepTime}
            </span>
          ) : (
            isPickup && <Badge tone="success">Pick-up</Badge>
          )}
        </span>

        <span className="kds-ticket-customer">
          {order.customer || 'Customer'}
          {mode === 'cooking' && isPickup && (
            <span className="ml-2 align-middle">
              <Badge tone="success">Pick-up</Badge>
            </span>
          )}
        </span>

        {sameCustomer && (
          <span className="kds-same-customer">
            <Badge
              tone="warning"
              dot
              title={`Same customer also has: ${sameCustomer.siblingIds.map(ticketLabel).join(', ')}`}
            >
              Same customer · {sameCustomer.position} of {sameCustomer.total}
            </Badge>
            <span className="kds-same-customer-refs">
              also {sameCustomer.siblingIds.map(ticketLabel).join(' · ')}
            </span>
          </span>
        )}

        <ul className="kds-items">
          {liveItems.map((item, idx) => (
            <li key={idx}>
              <span className="kds-item-qty">{item.quantity}×</span>
              <span className="kds-item-name">{item.name}</span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <span className="kds-note">
            <Icon name="alertCircle" className="h-5 w-5 shrink-0" />
            <span>{order.notes}</span>
          </span>
        )}
      </button>

      <div className="kds-actions">
        <button
          type="button"
          className={`kds-btn ${mode === 'queued' ? 'kds-btn--start' : 'kds-btn--done'}`}
          onClick={() => onTicketAction(order, mode)}
        >
          {mode === 'queued' ? 'Start cooking' : 'Mark done'}
        </button>
      </div>
    </article>
  )
}

export const KitchenMode: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const { menuItems } = useProductImages()

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [isStockPanelOpen, setIsStockPanelOpen] = useState<boolean>(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Out-of-Stock flagging states

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingKitchenOrder, setEditingKitchenOrder] = useState<any | null>(null)

  const handleDeleteKitchenOrder = async (orderId: string) => {
    const confirmDelete = window.confirm(`Admin Action: Are you sure you want to permanently delete Kitchen Order #${orderId}? This will remove it from the database.`)
    if (!confirmDelete) return

    try {
      await fetch(`${API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' }).catch(() => {})
    } catch {}

    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.filter((o: any) => o.id !== orderId && o.ref !== orderId)
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
      notifyOrderSync()
    } catch {}

    setOrders((prev) => prev.filter((o) => o.id !== orderId))
  }

  // Load orders from LocalStorage
  const getLocalOrders = (): KitchenOrder[] => {
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return parsed
        .filter((o: any) => {
          const rawStatus = (o.status || '').toUpperCase()
          const orderType = (o.type || o.order_type || '').toLowerCase()
          const isDelivery = orderType.includes('delivery') || o.deliveryAddress || o.customerName || (o.address && o.customer !== 'Walk-In') || o.paymentReceipt || (o.id && String(o.id).startsWith('SFB-'))

          // Online delivery orders MUST NOT appear in kitchen until verified & confirmed by Assistant (status becomes CONFIRMED)
          const unconfirmedStatuses = [
            'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
            'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
            'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'AWAITING_RECEIPT', 'CANCELLED'
          ]
          if (rawStatus === 'CANCELLED' || rawStatus === 'OUT_OF_STOCK' || (isDelivery && unconfirmedStatuses.includes(rawStatus))) {
            return false
          }

          return true
        })
        .map((o: any) => {
          const rawStatus = (o.status || '').toUpperCase()
          let mappedStatus = 'Confirmed'
          if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(rawStatus)) mappedStatus = 'Preparing'
          else if (['READY', 'PREPARED'].includes(rawStatus)) mappedStatus = 'Ready'
          else if (['COMPLETED', 'SERVED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'IN_TRANSIT'].includes(rawStatus)) mappedStatus = 'Completed'
          else if (['CONFIRMED', 'PENDING_PREPARATION', 'IN_KITCHEN'].includes(rawStatus)) mappedStatus = 'Confirmed'
          else mappedStatus = rawStatus

          const rawType = (o.type || o.order_type || 'Take Out').trim()
          const isPickupOrder = String(o.fulfillmentType || o.fulfillment_type || o.type || '').toUpperCase().includes('PICKUP')
          const isDeliveryOrder = !isPickupOrder && (rawType.toLowerCase().includes('delivery') || Boolean(o.address || o.deliveryAddress || (o.id && String(o.id).startsWith('SFB-'))))
          const rawCust = typeof o.customerName === 'string' && o.customerName.trim()
            ? o.customerName.trim()
            : typeof o.customer_name === 'string' && o.customer_name.trim()
            ? o.customer_name.trim()
            : typeof o.customer === 'string' && o.customer.trim() && o.customer !== 'Walk-In' && o.customer !== 'Walk-In Customer'
            ? o.customer.trim()
            : ''
          const customerName = rawCust || (isPickupOrder ? 'Store Pick-Up Customer' : (isDeliveryOrder ? 'Online Customer' : (rawType || 'On-Site Order')))
          const formatCategory = o.table ? `Dine In - ${o.table}` : (isPickupOrder ? 'Store Pick-Up' : (rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType))

          const calcTotal = parseFloat(o.total || 0)

          let parsedItems: OrderItem[] = []
          const replacements = Array.isArray(o.customerReplacements) ? o.customerReplacements : (Array.isArray(o.customer_replacements) ? o.customer_replacements : [])
          const isItemReplaced = (itemId: any, itemName: any, prodId: any) => {
            return replacements.some((r: any) =>
              (r.oldItemId !== undefined && String(r.oldItemId) === String(itemId)) ||
              (r.oldItemId !== undefined && String(r.oldItemId) === String(prodId)) ||
              (r.oldItemName && String(r.oldItemName).trim().toLowerCase() === String(itemName).trim().toLowerCase())
            )
          }

          if (Array.isArray(o.cartItems) && o.cartItems.length > 0) {
            parsedItems = o.cartItems
              .filter((ci: any) => {
                const st = String(ci.item_status || ci.itemStatus || '').toUpperCase()
                if (['REPLACED', 'REFUNDED', 'CANCELLED'].includes(st)) return false
                const name = ci.item?.name || ci.name || ci.product_name_snapshot || ''
                const id = ci.id || ci.item?.id
                const prodId = ci.productId || ci.product_id
                if (isItemReplaced(id, name, prodId)) return false
                return true
              })
              .map((ci: any) => ({
                id: ci.id,
                productId: ci.productId || ci.product_id || ci.item?.id || ci.id,
                name: ci.item?.name || ci.name || ci.product_name_snapshot || 'Food Item',
                quantity: Number(ci.quantity || 1),
                price: parseFloat(ci.item?.price || ci.unit_price || ci.price || 0),
                itemStatus: ci.item_status || ci.itemStatus || 'ACTIVE',
              }))
          } else if (Array.isArray(o.items) && o.items.length > 0) {
            parsedItems = o.items
              .filter((i: any) => {
                const st = String(i.item_status || i.itemStatus || '').toUpperCase()
                if (['REPLACED', 'REFUNDED', 'CANCELLED'].includes(st)) return false
                const name = i.name || i.product_name_snapshot || ''
                const id = i.id
                const prodId = i.productId || i.product_id
                if (isItemReplaced(id, name, prodId)) return false
                return true
              })
              .map((i: any) => ({
                id: i.id,
                productId: i.productId || i.product_id || i.item?.id || i.id,
                name: i.name || i.product_name_snapshot || 'Food Item',
                quantity: Number(i.quantity || 1),
                price: parseFloat(i.unit_price || i.price || 0),
                itemStatus: i.item_status || i.itemStatus || 'ACTIVE',
              }))
          } else if (typeof o.items === 'string' && o.items.trim()) {
            parsedItems = o.items.split(',').map((part: string, idx: number) => {
              const match = part.trim().match(/^(.*?)(?:\s+x(\d+))?$/)
              return {
                id: idx + 1,
                name: match ? match[1].trim() : part.trim(),
                quantity: match && match[2] ? parseInt(match[2], 10) : 1,
              }
            })
          }

          return {
            id: o.id || o.ref || `ORD-${Math.floor(Math.random() * 1000)}`,
            queue: o.id || o.ref || 'POS',
            type: rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType,
            category: formatCategory,
            status: mappedStatus,
            customer: customerName,
            customerId: o.customerId || o.customer_id || o.userId || undefined,
            customerPhone: o.phone || o.customerPhone || o.customer_phone || undefined,
            total: calcTotal,
            items: parsedItems,
            notes: o.notes || '',
            createdAt: o.dateTime || o.createdAt || new Date().toISOString(),
          }
        })
    } catch {
      return []
    }
  }

  const isFetchingRef = useRef(false)
  const inFlightStatusUpdatesRef = useRef<Map<string, { status: string; timestamp: number }>>(new Map())

  const KITCHEN_STATUS_ORDER: Record<string, number> = {
    'CONFIRMED': 1,
    'PREPARING': 2,
    'READY': 3,
    'COMPLETED': 4,
    'OUT OF STOCK': 5,
  }
  const lastFetchRef = useRef(0)

  // Fetch live tickets from backend API & merge with LocalStorage
  const fetchKitchenOrders = async (force?: boolean | unknown) => {
    if (isFetchingRef.current) return
    const isForce = typeof force === 'boolean' ? force : false
    const now = Date.now()
    if (!isForce && now - lastFetchRef.current < 2000) return

    isFetchingRef.current = true
    lastFetchRef.current = now

    try {
      let fetchedApiOrders: KitchenOrder[] = []

      try {
        const res = await fetch(`${API_BASE_URL}/kitchen/orders`)
        if (res.ok) {
          const result = await res.json()
          if (Array.isArray(result.data)) {
            fetchedApiOrders = result.data
              .filter((o: any) => {
                const raw = (o.status || o.order_status || '').toUpperCase()
                const orderType = (o.order_type || o.type || '').toLowerCase()
                const isDelivery = orderType.includes('delivery') || o.deliveryAddress || o.customerName || (o.address && o.customer !== 'Walk-In') || (o.id && String(o.id).startsWith('SFB-'))

                const unconfirmedStatuses = [
                  'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                  'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                  'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'AWAITING_RECEIPT', 'CANCELLED'
                ]
                if (raw === 'CANCELLED' || raw === 'OUT_OF_STOCK' || (isDelivery && unconfirmedStatuses.includes(raw))) {
                  return false
                }
                return true
              })
              .map((o: any) => {
                const raw = (o.status || o.order_status || '').toUpperCase()
                let norm = 'Confirmed'
                if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(raw)) norm = 'Preparing'
                else if (['READY', 'PREPARED'].includes(raw)) norm = 'Ready'
                else if (['COMPLETED', 'SERVED', 'DELIVERED', 'CUSTOMER RECEIVED', 'OUT_FOR_DELIVERY', 'OUT FOR DELIVERY', 'DISPATCHED', 'IN_TRANSIT'].includes(raw)) norm = 'Completed'
                else if (['CONFIRMED', 'PENDING_PREPARATION', 'IN_KITCHEN'].includes(raw)) norm = 'Confirmed'
                else norm = raw

                const rawType = (o.order_type || o.type || 'Take Out').trim()
                const isPickupOrder = String(o.fulfillmentType || o.fulfillment_type || o.type || '').toUpperCase().includes('PICKUP')
                const isDeliveryOrder = !isPickupOrder && (rawType.toLowerCase().includes('delivery') || Boolean(o.address || o.deliveryAddress || (o.id && String(o.id).startsWith('SFB-'))))
                const rawCust = typeof o.customerName === 'string' && o.customerName.trim()
                  ? o.customerName.trim()
                  : typeof o.customer_name === 'string' && o.customer_name.trim()
                  ? o.customer_name.trim()
                  : typeof o.customer === 'string' && o.customer.trim() && o.customer !== 'Walk-In' && o.customer !== 'Walk-In Customer'
                  ? o.customer.trim()
                  : ''
                const customerName = rawCust || (isPickupOrder ? 'Store Pick-Up Customer' : (isDeliveryOrder ? 'Online Customer' : (rawType || 'On-Site Order')))
                const formatCategory = o.table_name ? `Dine In - ${o.table_name}` : (isPickupOrder ? 'Store Pick-Up' : (rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType))

                const calcTotal = parseFloat(o.total || 0)

                return {
                  id: o.id,
                  queue: o.id,
                  type: rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType,
                  category: formatCategory,
                  status: norm,
                  customer: customerName,
                  customerId: o.customer_id || o.customerId || undefined,
                  customerPhone: o.customer_phone || o.customerPhone || undefined,
                  total: calcTotal,
                  items: (o.items || [])
                    .filter((item: any) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.item_status || item.itemStatus || '').toUpperCase()))
                    .map((item: any) => ({
                      id: item.id,
                      productId: item.product_id || item.productId,
                      name: item.name || item.product_name_snapshot || 'Food Item',
                      quantity: item.quantity || 1,
                      price: parseFloat(item.unit_price || item.price || 0),
                      itemStatus: item.item_status || item.itemStatus || 'ACTIVE',
                    })),
                  notes: o.notes || '',
                  createdAt: o.created_at || new Date().toISOString(),
                }
              })
          }
        }
      } catch (err) {
        console.warn('Backend connection note in KitchenMode:', err)
      }

      const fetchedLocalOrders = getLocalOrders()
      const mergedMap = new Map<string, KitchenOrder>()

      // 1. Load server tickets
      fetchedApiOrders.forEach((apiItem) => {
        const inFlight = inFlightStatusUpdatesRef.current.get(apiItem.id) || inFlightStatusUpdatesRef.current.get(apiItem.queue)
        if (inFlight) {
          if (Date.now() - inFlight.timestamp < 15000) {
            const apiRank = KITCHEN_STATUS_ORDER[apiItem.status.toUpperCase()] || 0
            const inFlightRank = KITCHEN_STATUS_ORDER[inFlight.status.toUpperCase()] || 0
            if (inFlightRank >= apiRank) {
              apiItem.status = inFlight.status
            }
          } else {
            inFlightStatusUpdatesRef.current.delete(apiItem.id)
            inFlightStatusUpdatesRef.current.delete(apiItem.queue)
          }
        }
        mergedMap.set(apiItem.id, apiItem)
      })

      // 2. Merge local orders: ensure newly modified orders reflect their latest dishes & notes in kitchen
      fetchedLocalOrders.forEach((localItem) => {
        const existingApi = Array.from(mergedMap.values()).find(
          (api) =>
            api.id === localItem.id ||
            api.queue === localItem.queue ||
            api.queue === localItem.id ||
            api.id === localItem.queue
        )
        if (!existingApi) {
          mergedMap.set(localItem.id, localItem)
        } else {
          // Monotonic progress check: preserve more advanced workflow state from local storage
          const localRank = KITCHEN_STATUS_ORDER[localItem.status.toUpperCase()] || 0
          const apiRank = KITCHEN_STATUS_ORDER[existingApi.status.toUpperCase()] || 0
          if (localRank > apiRank) {
            existingApi.status = localItem.status
          }
          if (localItem.startTime && !existingApi.startTime) {
            existingApi.startTime = localItem.startTime
          }
          if (localItem.completedTimeElapsed && !existingApi.completedTimeElapsed) {
            existingApi.completedTimeElapsed = localItem.completedTimeElapsed
          }

          // If local order has modified dishes or notes, only set items from local if API had no items
          if ((!existingApi.items || existingApi.items.length === 0) && Array.isArray(localItem.items) && localItem.items.length > 0) {
            existingApi.items = localItem.items
          }
          if (localItem.notes !== undefined && !existingApi.notes) {
            existingApi.notes = localItem.notes
          }
          if ((!existingApi.total || existingApi.total === 0) && localItem.total !== undefined && localItem.total > 0) {
            existingApi.total = localItem.total
          }
          if (localItem.category && !existingApi.category) {
            existingApi.category = localItem.category
          }
          if (localItem.customer && !existingApi.customer) {
            existingApi.customer = localItem.customer
          }
          // Identity, so a ticket the server could not attribute can still be matched to the
          // customer's other tickets on the board.
          if (localItem.customerId && !existingApi.customerId) {
            existingApi.customerId = localItem.customerId
          }
          if (localItem.customerPhone && !existingApi.customerPhone) {
            existingApi.customerPhone = localItem.customerPhone
          }
        }
      })

      const sanitizedOrders = Array.from(mergedMap.values()).map((ord) => ({
        ...ord,
        items: (ord.items || []).filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase())),
      }))

      setOrders((prevOrders) => {
        const prevMap = new Map(prevOrders.map((o) => [o.id, o]))
        return sanitizedOrders.map((ord) => {
          const prev = prevMap.get(ord.id) || prevMap.get(ord.queue)
          if (prev) {
            const prevRank = KITCHEN_STATUS_ORDER[prev.status.toUpperCase()] || 0
            const ordRank = KITCHEN_STATUS_ORDER[ord.status.toUpperCase()] || 0
            return {
              ...ord,
              status: prevRank > ordRank ? prev.status : ord.status,
              startTime: ord.startTime || prev.startTime,
              completedTimeElapsed: ord.completedTimeElapsed || prev.completedTimeElapsed,
            }
          }
          return ord
        })
      })
    } finally {
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    void fetchKitchenOrders()

    const unsubscribe = subscribeOrderSync(() => {
      void fetchKitchenOrders(true)
    })

    const pollTimer = setInterval(() => {
      void fetchKitchenOrders()
    }, 2000)

    return () => {
      unsubscribe()
      clearInterval(pollTimer)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  // Persistent Status Update Logic
  const updateOrderStatus = async (id: string, newStatus: string) => {
    const upperStatus = newStatus.toUpperCase()
    let normalizedTarget = 'CONFIRMED'

    if (['PREPARING', 'COOKING', 'IN_PROCESS'].includes(upperStatus)) {
      normalizedTarget = 'PREPARING'
    } else if (['READY', 'PREPARED'].includes(upperStatus)) {
      normalizedTarget = 'READY'
    } else if (['COMPLETED', 'SERVED', 'DELIVERED', 'CUSTOMER RECEIVED'].includes(upperStatus)) {
      normalizedTarget = 'COMPLETED'
    }

    // Record in-flight optimistic update to prevent stale backend polls from resetting status
    inFlightStatusUpdatesRef.current.set(id, { status: newStatus, timestamp: Date.now() })
    const targetOrder = orders.find((o) => o.id === id || o.queue === id)
    if (targetOrder?.queue) {
      inFlightStatusUpdatesRef.current.set(targetOrder.queue, { status: newStatus, timestamp: Date.now() })
    }

    // 1. Update React UI state immediately
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== id && order.queue !== id) return order
        if (newStatus === 'Preparing') return { ...order, status: 'Preparing', startTime: Date.now() }
        if (newStatus === 'Ready') return { ...order, status: 'Ready', completedTimeElapsed: '4:30sec' }
        if (newStatus === 'Completed') return { ...order, status: 'Completed' }
        return { ...order, status: newStatus }
      })
    )

    // 2. Persist update in LocalStorage so polling doesn't reset it
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      let found = false

      const updated = existing.map((o: any) => {
        if (o.id === id || o.ref === id) {
          found = true
          return { ...o, status: normalizedTarget }
        }
        return o
      })

      if (!found && targetOrder) {
        updated.unshift({
          id: targetOrder.id,
          ref: targetOrder.id,
          type: targetOrder.type || 'Delivery',
          category: targetOrder.category,
          status: normalizedTarget,
          items: targetOrder.items,
          notes: targetOrder.notes,
          dateTime: targetOrder.createdAt,
        })
      }

      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      // Also update active online customer order if matching
      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        if (activeObj && (activeObj.id === id || activeObj.ref === id)) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: normalizedTarget }))
        }
      }
    } catch {
      /* fallback silent */
    }

    // 3. Persist update in Express Backend API and notify sync only once completed
    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedTarget }),
      })
    } catch (err) {
      console.warn('[KITCHEN] Note on updating status with backend:', err)
    } finally {
      notifyOrderSync()
    }
  }



  const handleStatusFromModal = (newStatus: string) => {
    if (selectedOrderId) {
      const targetOrder = orders.find((o) => o.id === selectedOrderId || o.queue === selectedOrderId)
      const sameCustomer = sameCustomerMarks.get(String(selectedOrderId))
      void updateOrderStatus(selectedOrderId, newStatus)
      if (newStatus === 'Ready' && targetOrder) {
        executeReceiptPrint(generateKitchenSlipHtml(targetOrder, sameCustomer))
      }
      setSelectedOrderId(null)
    }
  }


  const queueOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || '').toUpperCase()
        return s === 'CONFIRMED' || s === 'PENDING_PREPARATION' || s === 'IN_KITCHEN' || s === 'WAITING' || s === 'UNCONFIRMED' || s === 'PENDING'
      }),
    [orders]
  )

  const processingOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || '').toUpperCase()
        return s === 'PREPARING' || s === 'COOKING' || s === 'IN_PROCESS'
      }),
    [orders]
  )

  /**
   * Which tickets on the board right now belong to a customer who has more than one.
   *
   * Scoped to the two live columns — a ticket that is already done is not something the kitchen
   * still has to bag together. Note this changes nothing about the order of either column.
   */
  const sameCustomerMarks = useMemo(
    () => findSameCustomerTickets([...queueOrders, ...processingOrders]),
    [queueOrders, processingOrders]
  )

  const formatRealWorldTime = (dateStr?: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const processedOrders = useMemo(() => {
    const today = new Date(now)
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()
    const currentDate = today.getDate()

    return orders
      .filter((o) => {
        const s = (o.status || '').toUpperCase()
        const isProcessed =
          s === 'READY' ||
          s === 'PREPARED' ||
          s === 'READY_FOR_PICKUP' ||
          s === 'COMPLETED' ||
          s === 'SERVED' ||
          s === 'DELIVERED' ||
          s === 'OUT_FOR_DELIVERY' ||
          s === 'CUSTOMER RECEIVED'
        if (!isProcessed) return false

        // Resets when the day ends: only include orders from today in real-world time
        const dateVal = o.createdAt
        if (!dateVal) return false
        const d = new Date(dateVal)
        if (isNaN(d.getTime())) return false

        return (
          d.getFullYear() === currentYear &&
          d.getMonth() === currentMonth &&
          d.getDate() === currentDate
        )
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime()
        const timeB = new Date(b.createdAt || 0).getTime()
        return timeB - timeA
      })
  }, [orders, now])

  /**
   * Marking a ticket done prints the slip that travels with the food, so the
   * cashier never has to ask whose order is on the pass.
   */
  const handleTicketAction = (order: KitchenOrder, mode: 'queued' | 'cooking') => {
    if (mode === 'queued') {
      void updateOrderStatus(order.id, 'Preparing')
      return
    }
    const sameCustomer = sameCustomerMarks.get(String(order.id))
    void updateOrderStatus(order.id, 'Ready')
    executeReceiptPrint(generateKitchenSlipHtml(order, sameCustomer))
  }

  return (
    <div className="inv-scope kds min-h-screen pb-6" style={{ background: 'var(--inv-bg)' }}>
      <div className="print:hidden">
        <NavbarKitchen />
      </div>

      <main className="w-full px-3 sm:px-4 lg:px-6 pt-4 space-y-4">
        <div className="kds-bar">
          <h1 className="kds-bar-title">Kitchen display</h1>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Button variant="secondary" icon="plus" onClick={() => setIsAdminCreateOpen(true)}>
                New ticket
              </Button>
            )}
            <Button variant="secondary" icon="box" onClick={() => setIsStockPanelOpen(true)}>
              Menu stock
            </Button>
            <Button variant="secondary" icon="history" onClick={() => setIsHistoryModalOpen(true)}>
              Done today
              {processedOrders.length > 0 && <span className="inv-seg-count">{processedOrders.length}</span>}
            </Button>
          </div>
        </div>

        <div className="kds-board">
          {/* ------------------------------------------------- Queue */}
          <section className="kds-col" aria-labelledby="kds-queue-heading">
            <header className="kds-col-head">
              <h2 id="kds-queue-heading">Waiting</h2>
              <span className="kds-count">{queueOrders.length}</span>
            </header>
            <div className="kds-col-scroll">
              {queueOrders.length === 0 ? (
                <p className="kds-empty">Nothing waiting. New tickets land here.</p>
              ) : (
                queueOrders.map((order) => (
                  <TicketCard
                    key={order.id}
                    order={order}
                    mode="queued"
                    now={now}
                    sameCustomer={sameCustomerMarks.get(String(order.id))}
                    onSelectOrder={setSelectedOrderId}
                    onTicketAction={handleTicketAction}
                  />
                ))
              )}
            </div>
          </section>

          {/* ---------------------------------------------- Cooking */}
          <section className="kds-col" aria-labelledby="kds-cooking-heading">
            <header className="kds-col-head">
              <h2 id="kds-cooking-heading">Cooking</h2>
              <span className="kds-count kds-count--live">{processingOrders.length}</span>
            </header>
            <div className="kds-col-scroll">
              {processingOrders.length === 0 ? (
                <p className="kds-empty">Nothing on the pass right now.</p>
              ) : (
                processingOrders.map((order) => (
                  <TicketCard
                    key={order.id}
                    order={order}
                    mode="cooking"
                    now={now}
                    sameCustomer={sameCustomerMarks.get(String(order.id))}
                    onSelectOrder={setSelectedOrderId}
                    onTicketAction={handleTicketAction}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Processed Orders Modal */}
      <KitchenStockPanel open={isStockPanelOpen} onClose={() => setIsStockPanelOpen(false)} menuItems={menuItems} />

      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4.5 bg-white border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-neutral-900">Processed order</h2>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                  Orders completed today in real-world time • Resets automatically at the end of the day
                </p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-bold transition-colors cursor-pointer"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 max-h-[75vh] scroll-smooth overscroll-contain transform-gpu [will-change:scroll-position] [contain:content]">
              <table className="min-w-full divide-y divide-neutral-100 text-left relative">
                <thead className="bg-neutral-50 text-xs uppercase font-extrabold text-neutral-500 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3.5 bg-neutral-50">Reference #</th>
                    <th className="px-6 py-3.5 bg-neutral-50">Customer</th>
                    <th className="px-6 py-3.5 bg-neutral-50">Date & Time</th>
                    <th className="px-6 py-3.5 bg-neutral-50">Items</th>
                    <th className="px-6 py-3.5 bg-neutral-50">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {processedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-400">
                        No processed orders for today yet.
                      </td>
                    </tr>
                  ) : (
                    processedOrders.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50/60">
                        <td className="px-6 py-3.5 font-bold text-orange-600">{tx.queue}</td>
                        <td className="px-6 py-3.5 font-semibold text-neutral-800">{tx.customer || '—'}</td>
                        <td className="px-6 py-3.5 text-neutral-500 whitespace-nowrap font-medium">
                          {formatRealWorldTime(tx.createdAt)}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-neutral-800">
                          {tx.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                        </td>
                        <td className="px-6 py-3.5 text-neutral-600">{tx.category}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-lg border border-neutral-200/80">
            <div className="p-5 bg-neutral-900 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Order #{selectedOrder.queue}</h3>
              <button onClick={() => setSelectedOrderId(null)} className="text-white font-bold">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedOrder.customer && (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Customer</h4>
                  <div className="text-sm font-semibold text-neutral-900">{selectedOrder.customer}</div>
                  {(() => {
                    const same = sameCustomerMarks.get(String(selectedOrder.id))
                    if (!same) return null
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone="warning" dot>
                          Order {same.position} of {same.total} for this customer
                        </Badge>
                        <span className="text-xs text-neutral-500">
                          Also on the board: {same.siblingIds.map(ticketLabel).join(' · ')}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Order Items</h4>
                <div className="bg-[var(--inv-surface-2)] rounded-xl border border-neutral-200/80 p-3.5">
                  {selectedOrder.items
                    .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                    .map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 text-xs font-semibold">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{item.name}</span>
                      </div>
                      <span className="bg-neutral-200 px-2 py-0.5 rounded font-bold shrink-0">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Kitchen Special Instructions</h4>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs font-bold text-red-900">
                  {selectedOrder.notes || 'No special requests/notes provided for this order.'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleStatusFromModal('Preparing')}
                  className="bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Start Preparing
                </button>
                <button
                  onClick={() => handleStatusFromModal('Ready')}
                  className="bg-neutral-900 hover:bg-black text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Mark as Ready
                </button>
              </div>

              {isAdmin && (
                <div className="pt-3 border-t border-amber-200 bg-amber-50 p-3.5 rounded-xl flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Admin Controls:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKitchenOrder(selectedOrder)
                        setSelectedOrderId(null)
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs cursor-pointer shadow-2xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteKitchenOrder(selectedOrder.id)
                        setSelectedOrderId(null)
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs cursor-pointer shadow-2xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CRUD MODALS */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={() => {
          const updated = getLocalOrders()
          setOrders(updated)
        }}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingKitchenOrder)}
        transaction={editingKitchenOrder}
        onClose={() => setEditingKitchenOrder(null)}
        onSave={() => {
          const updated = getLocalOrders()
          setOrders(updated)
        }}
      />
    </div>
  )
}

export default KitchenMode
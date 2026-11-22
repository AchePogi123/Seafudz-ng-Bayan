import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NavbarCashier from '../components/NavbarCashier'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { countsAsSale } from '../utils/salesRecognition'
import {
  isCancelledOrder,
  readRefundAccountability,
  refundActorLabel,
  refundMethodLabel,
  refundSummaryLine,
  type RefundAccountability,
} from '../utils/refundAccountability'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal, type TransactionData } from '../components/AdminEditTransactionModal'

export interface OrderItemDetail {
  id?: string
  name: string
  quantity: number
  unit_price?: number
  subtotal?: number
}

export interface LiveTransaction {
  id: string
  ref: string
  dateTime: string
  items: string
  customer: string
  total: number
  type: string
  paymentMethod?: string
  paymentReference?: string
  referenceNumber?: string
  paymentReceipt?: string
  deliveryProof?: string
  status?: string
  itemsList?: OrderItemDetail[]
  customerPhone?: string
  customerAddress?: string
  subtotal?: number
  tax?: number
  deliveryFee?: number
  riderCashReceived?: number
  riderName?: string
  /** Where this transaction's money stands if it was cancelled: see `refundAccountability`. */
  refund?: RefundAccountability
  cancelledAt?: string
}

interface SummaryData {
  totalOrders: number
  grossRevenue: number
  subtotalRevenue: number
  vatCollected: number
  averageOrderValue: number
  breakdown: {
    cash: { total: number; count: number }
    gcash: { total: number; count: number }
    maya: { total: number; count: number }
    hybrid: { total: number; count: number }
  }
  /**
   * Cancelled orders are not revenue, but a cancelled order that was paid for is money the till
   * is holding until somebody hands it back, so the shift report accounts for both halves.
   */
  cancellations: {
    count: number
    refundedCount: number
    refundedAmount: number
    awaitingCount: number
    awaitingAmount: number
  }
}

type TabType = 'Today' | 'This Week' | 'This Month' | 'This Year'

const PAGE_SIZE = 10

type RawOrder = Record<string, unknown>

interface OrderPageResult {
  transactions: LiveTransaction[]
  totalMatchingCount: number
}

const isRawOrder = (value: unknown): value is RawOrder =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRawOrders = (value: unknown): RawOrder[] =>
  Array.isArray(value) ? value.filter(isRawOrder) : []

const readString = (...values: unknown[]): string | undefined => {
  const value = values.find((candidate) =>
    (typeof candidate === 'string' && candidate.trim()) || typeof candidate === 'number'
  )
  return value === undefined ? undefined : String(value)
}

const readReferenceString = (...values: unknown[]): string | undefined => {
  const invalid = new Set(['', 'none', 'none recorded', 'null', 'undefined', 'n/a', 'na', 'none  recorded'])
  for (const candidate of values) {
    if (typeof candidate === 'number') return String(candidate)
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed && !invalid.has(trimmed.toLowerCase().replace(/\s+/g, ' '))) {
        return trimmed
      }
    }
  }
  return undefined
}

const readNumber = (value: unknown, fallback = 0): number => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const summarizeItems = (items: unknown, fallback: string): string => {
  if (typeof items === 'string') return items
  const summaries = toRawOrders(items).map((item) => {
    const nestedItem = isRawOrder(item.item) ? item.item : {}
    const name = readString(item.name, item.product_name_snapshot, nestedItem.name) || 'Seafood'
    const quantity = readNumber(item.quantity, 1) || 1
    return `${name} x${quantity}`
  })
  return summaries.length ? summaries.join(', ') : fallback
}

const SalesReportCashier: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const location = useLocation()
  const navState = location.state as { channel?: string; tab?: TabType; payment?: string } | null

  const [activeTab, setActiveTab] = useState<TabType>(navState?.tab || 'Today')
  const [transactions, setTransactions] = useState<LiveTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<LiveTransaction | null>(null)
  const [copiedRef, setCopiedRef] = useState(false)
  const [isEditingRef, setIsEditingRef] = useState(false)
  const [newRefInput, setNewRefInput] = useState('')
  const [isSavingRef, setIsSavingRef] = useState(false)
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null)

  useEffect(() => {
    setIsEditingRef(false)
    setNewRefInput(selectedTransaction?.paymentReference || selectedTransaction?.referenceNumber || '')
  }, [selectedTransaction?.id])

  const handleSaveInlineRef = async () => {
    if (!selectedTransaction) return
    const trimmed = newRefInput.trim()
    setIsSavingRef(true)
    try {
      await fetch(`${API_BASE_URL}/orders/${selectedTransaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedTransaction,
          paymentReference: trimmed || undefined,
          referenceNumber: trimmed || undefined,
        }),
      }).catch(() => {})

      try {
        const globalOrders = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
        const updatedGlobal = globalOrders.map((o: any) =>
          o.id === selectedTransaction.id || o.ref === selectedTransaction.id
            ? { ...o, paymentReference: trimmed || undefined, referenceNumber: trimmed || undefined }
            : o
        )
        localStorage.setItem('seafudz_orders', JSON.stringify(updatedGlobal))
      } catch {}

      const updatedTx = {
        ...selectedTransaction,
        paymentReference: trimmed || undefined,
        referenceNumber: trimmed || undefined,
      }
      setSelectedTransaction(updatedTx)
      setTransactions((prev) =>
        prev.map((t) => (t.id === selectedTransaction.id ? updatedTx : t))
      )
      setIsEditingRef(false)
    } catch (err) {
      console.warn('Error saving reference number:', err)
    } finally {
      setIsSavingRef(false)
    }
  }

  const [paymentFilter, setPaymentFilter] = useState<string>(navState?.payment || 'All')
  const [channelFilter, setChannelFilter] = useState<string>(navState?.channel || 'All')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMatchingCount, setTotalMatchingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalOrders: 0,
    grossRevenue: 0,
    subtotalRevenue: 0,
    vatCollected: 0,
    averageOrderValue: 0,
    breakdown: {
      cash: { total: 0, count: 0 },
      gcash: { total: 0, count: 0 },
      maya: { total: 0, count: 0 },
      hybrid: { total: 0, count: 0 },
    },
    cancellations: { count: 0, refundedCount: 0, refundedAmount: 0, awaitingCount: 0, awaitingAmount: 0 },
  })

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const [previousLocationKey, setPreviousLocationKey] = useState(location.key)
  if (location.key !== previousLocationKey) {
    setPreviousLocationKey(location.key)
    if (navState?.channel) setChannelFilter(navState.channel)
    if (navState?.tab) setActiveTab(navState.tab)
    if (navState?.payment) setPaymentFilter(navState.payment)
  }

  // Lock body scroll when selectedTransaction modal is open
  useEffect(() => {
    if (selectedTransaction) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [selectedTransaction])

  const handleTabChange = (tab: TabType) => {
    setIsLoading(true)
    setActiveTab(tab)
    setCurrentPage(1)
  }

  const handleChannelChange = (channel: string) => {
    setIsLoading(true)
    setChannelFilter(channel)
    setCurrentPage(1)
  }

  const handlePaymentChange = (pm: string) => {
    setIsLoading(true)
    setPaymentFilter(pm)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setIsLoading(true)
    setCurrentPage(page)
  }

  const formatOrderRow = useCallback((dbO: RawOrder): LiveTransaction => {
    const rawFulfillment = (readString((dbO as any).fulfillment_type, (dbO as any).fulfillmentType) || '').toUpperCase()
    const rawType = readString(dbO.order_type, dbO.type) || ''
    const normalizedType =
      rawFulfillment === 'PICKUP' || rawType.toUpperCase().includes('PICKUP')
        ? 'Store Pick-Up'
        : rawType.toUpperCase() === 'ONLINE' || rawType.toUpperCase() === 'DELIVERY'
          ? 'Delivery'
          : rawType.toUpperCase() === 'ON_SITE'
            ? 'POS Order'
            : rawType || 'POS Order'

    const createdAt = dbO.created_at

    let itemsList: OrderItemDetail[] = []
    if (Array.isArray(dbO.items) && dbO.items.length > 0) {
      itemsList = dbO.items.map((i: any) => ({
        id: i.id || i.product_id,
        name: i.name || i.product_name_snapshot || i.snapshot_item_name || 'Dish',
        quantity: Number(i.quantity || 1),
        unit_price: i.unit_price ? Number(i.unit_price) : undefined,
        subtotal: i.subtotal ? Number(i.subtotal) : (i.unit_price ? Number(i.unit_price) * Number(i.quantity || 1) : undefined)
      }))
    }

    return {
      id: readString(dbO.id) || '',
      ref: readString(dbO.id) || '',
      dateTime: createdAt ? new Date(String(createdAt)).toLocaleString() : new Date().toLocaleString(),
      items: summarizeItems(dbO.items, 'Seafood Dish'),
      itemsList,
      customer: (() => {
        const c = readString(dbO.customer_name, (dbO as any).customerName, (dbO as any).customer, (dbO as any).fullname);
        if (c && c !== 'Walk-In' && c !== 'Walk-In Customer' && c !== 'Online Customer') return c;
        if (c === 'Online Customer') return c;
        return '';
      })(),
      customerPhone: readString(dbO.customer_phone, dbO.phone) || undefined,
      customerAddress: readString(dbO.delivery_address, dbO.address) || undefined,
      type: normalizedType,
      total: readNumber(dbO.total),
      subtotal: dbO.subtotal !== undefined && dbO.subtotal !== null ? Number(dbO.subtotal) : undefined,
      tax: (dbO.tax !== undefined && dbO.tax !== null) ? Number(dbO.tax) : (dbO.vat !== undefined ? Number(dbO.vat) : undefined),
      deliveryFee: dbO.delivery_fee !== undefined && dbO.delivery_fee !== null ? Number(dbO.delivery_fee) : undefined,
      riderCashReceived: dbO.rider_cash_received !== undefined && dbO.rider_cash_received !== null
        ? Number(dbO.rider_cash_received)
        : (dbO.riderCashReceived !== undefined && dbO.riderCashReceived !== null ? Number(dbO.riderCashReceived) : undefined),
      riderName: (rawFulfillment === 'PICKUP' || rawType.toUpperCase().includes('PICKUP')) ? undefined : (readString(dbO.rider_name, dbO.riderName) || undefined),
      paymentMethod: readString(dbO.payment_method, dbO.paymentMethod) || 'Cash',
      paymentReference: readReferenceString(
        dbO.payment_reference,
        dbO.paymentReference,
        dbO.reference_number,
        dbO.referenceNumber,
        dbO.ref_number,
        dbO.gcash_reference,
        dbO.gcashReference,
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
      ),
      referenceNumber: readReferenceString(
        dbO.payment_reference,
        dbO.paymentReference,
        dbO.reference_number,
        dbO.referenceNumber,
        dbO.ref_number,
        dbO.gcash_reference,
        dbO.gcashReference,
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
      ),
      paymentReceipt: readString(
        dbO.payment_receipt,
        dbO.paymentReceipt,
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.payment_receipt || p.paymentReceipt)?.payment_receipt),
        (dbO.payments && Array.isArray(dbO.payments) && dbO.payments.slice().reverse().find((p: any) => p.payment_receipt || p.paymentReceipt)?.paymentReceipt)
      ),
      deliveryProof: readString(
        dbO.delivery_proof,
        dbO.deliveryProof,
        (dbO.deliveries && Array.isArray(dbO.deliveries) && dbO.deliveries.find((d: any) => d.delivery_proof || d.deliveryProof)?.delivery_proof),
        (dbO.deliveries && Array.isArray(dbO.deliveries) && dbO.deliveries.find((d: any) => d.delivery_proof || d.deliveryProof)?.deliveryProof)
      ),
      status: readString(dbO.status) || 'Completed',
      refund: readRefundAccountability(dbO),
      cancelledAt: readString(dbO.cancelled_at, dbO.cancelledAt),
    }
  }, [])

  const getOrderDate = (order: RawOrder | LiveTransaction): Date | null => {
    const value =
      ('created_at' in order ? order.created_at : undefined) ??
      ('createdAt' in order ? order.createdAt : undefined) ??
      ('dateTime' in order ? order.dateTime : undefined) ??
      ('date' in order ? order.date : undefined) ??
      null

    if (!value) return null
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value
    if (typeof value !== 'string' && typeof value !== 'number') return null
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) return parsed
    const num = Number(value)
    if (!isNaN(num)) {
      const d = new Date(num)
      if (!isNaN(d.getTime())) return d
    }
    return null
  }

  const checkIsInSelectedPeriod = useCallback((order: RawOrder | LiveTransaction, tab: TabType): boolean => {
    const orderDate = getOrderDate(order)
    if (!orderDate) return true

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (tab === 'Today') {
      return orderDate >= startOfToday && orderDate <= endOfToday
    }

    if (tab === 'This Week') {
      const startOfWeek = new Date(startOfToday)
      startOfWeek.setDate(startOfWeek.getDate() - 6)
      startOfWeek.setHours(0, 0, 0, 0)
      return orderDate >= startOfWeek
    }

    if (tab === 'This Month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return orderDate >= startOfMonth
    }

    if (tab === 'This Year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return orderDate >= startOfYear
    }

    return true
  }, [])

  const fetchSummary = useCallback(async (): Promise<SummaryData | null> => {
    const orderMap = new Map<string, RawOrder>()
    try {
      try {
        const localRaw = localStorage.getItem('seafudz_orders')
        if (localRaw) {
          const localOrders: unknown = JSON.parse(localRaw)
          toRawOrders(localOrders)
            .filter((order) => checkIsInSelectedPeriod(order, activeTab))
            .forEach((order, index) => {
              const key = readString(order.id, order.ref) || `local-${index}`
              orderMap.set(key, order)
            })
        }
      } catch (localErr) {
        console.warn('Failed to read local orders for sales summary:', localErr)
      }

      try {
        const authHeaders = await getAuthHeaders({}, { jsonContentType: false }).catch(() => ({}))
        let ordersRes = await fetch(
          `${API_BASE_URL}/orders?limit=200&offset=0&tab=${encodeURIComponent(activeTab)}`,
          { headers: authHeaders }
        )
        if (!ordersRes.ok) {
          ordersRes = await fetch(`${API_BASE_URL}/user-flow/orders?limit=200`).catch(() => ordersRes)
        }
        if (ordersRes.ok) {
          const ordersJson: unknown = await ordersRes.json()
          const backendOrders = isRawOrder(ordersJson) ? toRawOrders(ordersJson.data) : []
          backendOrders
            .filter((order) => checkIsInSelectedPeriod(order, activeTab))
            .forEach((order, index) => {
              const key = readString(order.id, order.ref) || `backend-${index}`
              orderMap.set(key, order)
            })
        }
      } catch (ordersErr) {
        console.warn('Failed to fetch orders for sales summary:', ordersErr)
      }

      const orders = Array.from(orderMap.values())

      const breakdown = {
        cash: { total: 0, count: 0 },
        gcash: { total: 0, count: 0 },
        maya: { total: 0, count: 0 },
        hybrid: { total: 0, count: 0 },
      }

      let grossRevenue = 0

      // A cancelled order is not a sale, but if it was paid for the money is owed until a named
      // member of staff returns it, so the shift has to be able to account for it either way.
      const cancellations = { count: 0, refundedCount: 0, refundedAmount: 0, awaitingCount: 0, awaitingAmount: 0 }
      orders.forEach((order) => {
        if (!isCancelledOrder(order.status ?? order.orderStatus ?? order.order_status)) return
        const refund = readRefundAccountability(order)
        cancellations.count += 1
        if (refund.state === 'COMPLETED') {
          cancellations.refundedCount += 1
          cancellations.refundedAmount += refund.amount
        } else if (refund.state === 'PENDING') {
          cancellations.awaitingCount += 1
          cancellations.awaitingAmount += refund.amount
        }
      })

      const settledOrders = orders.filter((order) => countsAsSale(order))

      settledOrders.forEach((order) => {
        const total = readNumber(
          order.total ?? order.totalAmount ?? order.grandTotal ?? order.amount
        )

        grossRevenue += total

        const payment = (readString(order.payment_method, order.paymentMethod, order.payment) || 'Cash').toLowerCase()

        if (payment.includes('hybrid') || payment.includes('split')) {
          breakdown.hybrid.total += total
          breakdown.hybrid.count += 1
        } else if (payment.includes('gcash')) {
          breakdown.gcash.total += total
          breakdown.gcash.count += 1
        } else if (payment.includes('maya')) {
          breakdown.maya.total += total
          breakdown.maya.count += 1
        } else {
          // A legacy row still labelled COD was cash that arrived at the door.

          breakdown.cash.total += total
          breakdown.cash.count += 1
        }
      })

      return {
        totalOrders: settledOrders.length,
        grossRevenue,
        subtotalRevenue: 0,
        vatCollected: 0,
        averageOrderValue: settledOrders.length > 0 ? grossRevenue / settledOrders.length : 0,
        breakdown,
        cancellations: {
          ...cancellations,
          refundedAmount: Math.round(cancellations.refundedAmount * 100) / 100,
          awaitingAmount: Math.round(cancellations.awaitingAmount * 100) / 100,
        },
      }
    } catch (err) {
      console.warn('Failed to calculate sales summary:', err)
      return null
    }
  }, [activeTab, checkIsInSelectedPeriod])

  const fetchOrdersPage = useCallback(async (): Promise<OrderPageResult> => {
    try {
      const orderMap = new Map<string, LiveTransaction>()

      try {
        const localRaw = localStorage.getItem('seafudz_orders')
        if (localRaw) {
          const parsed: unknown = JSON.parse(localRaw)
          toRawOrders(parsed).forEach((order, index) => {
            if (!checkIsInSelectedPeriod(order, activeTab)) return
            const tx: LiveTransaction = {
              id: readString(order.id, order.ref) || `local-${index}`,
              ref: readString(order.ref, order.id) || `local-${index}`,
              dateTime: readString(order.dateTime, order.createdAt) || new Date().toLocaleString(),
              type: readString(order.type, order.order_type) || 'POS Order',
              status: readString(order.status) || 'Completed',
              customer: (() => {
                const c = readString(order.customerName, order.customer, order.customer_name);
                if (c && c !== 'Walk-In' && c !== 'Walk-In Customer') return c;
                return '';
              })(),
              customerPhone: readString(order.phone, order.customerPhone) || undefined,
              customerAddress: readString(order.deliveryAddress, order.address, order.customerAddress) || undefined,
              items: summarizeItems(order.items, 'Seafood Dish'),
              total: readNumber(order.total),
              subtotal: order.subtotal !== undefined && order.subtotal !== null ? Number(order.subtotal) : undefined,
              tax: order.tax !== undefined && order.tax !== null ? Number(order.tax) : (order.vat !== undefined ? Number(order.vat) : undefined),
              deliveryFee: order.deliveryFee !== undefined && order.deliveryFee !== null ? Number(order.deliveryFee) : undefined,
              paymentMethod: readString(order.paymentMethod, order.payment_method) || 'Cash',
              paymentReference: readReferenceString(
                order.paymentReference,
                order.payment_reference,
                order.referenceNumber,
                order.reference_number,
                order.paymentRef,
                order.gcashReference,
                (order.payments && Array.isArray(order.payments) && order.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
                (order.payments && Array.isArray(order.payments) && order.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
              ),
              referenceNumber: readReferenceString(
                order.paymentReference,
                order.payment_reference,
                order.referenceNumber,
                order.reference_number,
                order.paymentRef,
                order.gcashReference,
                (order.payments && Array.isArray(order.payments) && order.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
                (order.payments && Array.isArray(order.payments) && order.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
              ),
              riderCashReceived: order.riderCashReceived !== undefined && order.riderCashReceived !== null
                ? Number(order.riderCashReceived)
                : (order.rider_cash_received !== undefined && order.rider_cash_received !== null ? Number(order.rider_cash_received) : undefined),
              riderName: readString(order.riderName, order.rider_name) || undefined,
              paymentReceipt: readString(order.paymentReceipt, order.payment_receipt) || undefined,
              deliveryProof: readString(order.deliveryProof, order.delivery_proof) || undefined,
              refund: readRefundAccountability(order),
              cancelledAt: readString(order.cancelled_at, order.cancelledAt),
            }
            orderMap.set(tx.id, tx)
          })
        }
      } catch (e) {
        console.warn('Error reading local orders:', e)
      }

      try {
        const authHeaders = await getAuthHeaders({}, { jsonContentType: false }).catch(() => ({}))
        const params = new URLSearchParams({
          limit: '1000',
          tab: activeTab,
        })
        let res = await fetch(`${API_BASE_URL}/orders?${params.toString()}`, {
          headers: authHeaders,
        })
        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/user-flow/orders?limit=1000`).catch(() => res)
        }
        if (res.ok) {
          const json: unknown = await res.json()
          const list = isRawOrder(json) ? toRawOrders(json.data) : []
          const formatted = list.map(formatOrderRow)
          formatted.forEach((dbO: LiveTransaction) => {
            if (checkIsInSelectedPeriod(dbO, activeTab)) {
              const existing = orderMap.get(dbO.id)
              orderMap.set(dbO.id, {
                ...existing,
                ...dbO,
                paymentReference: dbO.paymentReference || existing?.paymentReference,
                referenceNumber: dbO.referenceNumber || existing?.referenceNumber || dbO.paymentReference || existing?.paymentReference,
                paymentReceipt: dbO.paymentReceipt || existing?.paymentReceipt,
                deliveryProof: dbO.deliveryProof || existing?.deliveryProof,
                // The ledger's own view of the payout wins over a cached copy.
                refund: dbO.refund?.state !== 'NONE' ? dbO.refund : (existing?.refund ?? dbO.refund),
                cancelledAt: dbO.cancelledAt || existing?.cancelledAt,
              })
            }
          })
        }
      } catch (err) {
        console.warn('Backend offline', err)
      }

      let allMatching = Array.from(orderMap.values())

      // 3. Apply channel filter
      if (channelFilter !== 'All') {
        const isOnline = channelFilter === 'Online'
        allMatching = allMatching.filter((o) => {
          const t = (o.type || '').toLowerCase()
          const oIsOnline = t.includes('delivery') || t.includes('online')
          return isOnline ? oIsOnline : !oIsOnline
        })
      }

      // 4. Apply payment filter
      if (paymentFilter !== 'All') {
        const p = paymentFilter.toLowerCase()
        if (p === 'hybrid') {
          allMatching = allMatching.filter(
            (o) =>
              (o.paymentMethod || '').toLowerCase().includes('hybrid') ||
              (o.paymentMethod || '').toLowerCase().includes('split')
          )
        } else {
          allMatching = allMatching.filter((o) => (o.paymentMethod || '').toLowerCase().includes(p))
        }
      }

      // 5. Apply search query filter
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        allMatching = allMatching.filter(
          (o) =>
            (o.ref || '').toLowerCase().includes(q) ||
            (o.customer || '').toLowerCase().includes(q) ||
            (o.items || '').toLowerCase().includes(q) ||
            (o.paymentReference || '').toLowerCase().includes(q) ||
            (o.referenceNumber || '').toLowerCase().includes(q)
        )
      }

      // Sort descending by date
      allMatching.sort((a, b) => {
        const dA = getOrderDate(a)?.getTime() || 0
        const dB = getOrderDate(b)?.getTime() || 0
        return dB - dA
      })

      const offset = (currentPage - 1) * PAGE_SIZE
      return {
        totalMatchingCount: allMatching.length,
        transactions: allMatching.slice(offset, offset + PAGE_SIZE),
      }
    } catch (err) {
      console.error('Failed to fetch page of orders:', err)
      return { totalMatchingCount: 0, transactions: [] }
    }
  }, [currentPage, activeTab, channelFilter, paymentFilter, debouncedSearch, formatOrderRow, checkIsInSelectedPeriod])

  useEffect(() => {
    let isCurrent = true
    void fetchSummary().then((summary) => {
      if (isCurrent && summary) setSummaryData(summary)
    })
    return () => {
      isCurrent = false
    }
  }, [fetchSummary])

  useEffect(() => {
    let isCurrent = true
    void fetchOrdersPage().then((page) => {
      if (!isCurrent) return
      setTotalMatchingCount(page.totalMatchingCount)
      setTransactions(page.transactions)
      setIsLoading(false)
    })
    return () => {
      isCurrent = false
    }
  }, [fetchOrdersPage])

  const refreshData = () => {
    setIsLoading(true)
    void fetchSummary().then((summary) => {
      if (summary) setSummaryData(summary)
    })
    void fetchOrdersPage().then((page) => {
      setTotalMatchingCount(page.totalMatchingCount)
      setTransactions(page.transactions)
      setIsLoading(false)
    })
  }

  const getOrderedItems = (items: string) => {
    if (!items) return []
    return items
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const totalPages = Math.max(1, Math.ceil(totalMatchingCount / PAGE_SIZE))
  const startItem = totalMatchingCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const endItem = Math.min(currentPage * PAGE_SIZE, totalMatchingCount)

  const getPaginationRange = () => {
    const delta = 1
    const range: (number | string)[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i)
      } else if (range[range.length - 1] !== '...') {
        range.push('...')
      }
    }
    return range
  }

  const grossTotal = summaryData.grossRevenue > 0 ? summaryData.grossRevenue : 0
  const cashShare = grossTotal > 0 ? Math.round((summaryData.breakdown.cash.total / grossTotal) * 100) : 0
  const gcashShare = grossTotal > 0 ? Math.round((summaryData.breakdown.gcash.total / grossTotal) * 100) : 0
  const hybridShare = grossTotal > 0 ? Math.max(0, 100 - cashShare - gcashShare) : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16 antialiased">
      {/* Navigation Header — dish search omitted on sales report to avoid duplicate search inputs */}
      <div className="p-4 sm:p-6 print:hidden">
        <NavbarCashier />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Page Header: Title, Period Controls & Actions */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pt-1 print:hidden">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 transition-colors duration-150 ease-out cursor-pointer shrink-0"
              title="Back to POS terminal"
              aria-label="Back to POS terminal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span>Cashier register</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700">Shift settlement</span>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mt-0.5">
                Shift sales &amp; register
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
                Counter cash, digital payments, and refund reconciliation for {activeTab.toLowerCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Period Selector */}
            <div className="inline-flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl border border-slate-200/80">
              {(['Today', 'This Week', 'This Month', 'This Year'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-[background-color,color,box-shadow] duration-150 ease-out cursor-pointer ${
                    activeTab === tab
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAdminCreateOpen(true)}
                className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium px-3.5 py-2 rounded-xl text-xs transition-colors duration-150 ease-out cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>New transaction</span>
              </button>
            )}

            <button
              type="button"
              onClick={refreshData}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium px-3.5 py-2 rounded-xl text-xs border border-slate-200/80 transition-colors duration-150 ease-out cursor-pointer"
              title="Refresh shift ledger"
            >
              <svg className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Asymmetric Shift Summary Strip */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
          {/* Leading Metric: Gross Revenue + Proportional Payment Share Bar */}
          <div
            onClick={() => handlePaymentChange('All')}
            className={`lg:col-span-5 bg-white p-5 rounded-2xl border transition-[border-color,background-color] duration-150 ease-out cursor-pointer flex flex-col justify-between gap-4 ${
              paymentFilter === 'All'
                ? 'border-orange-500/80 bg-orange-50/15'
                : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">Gross revenue</span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {summaryData.totalOrders.toLocaleString()} {summaryData.totalOrders === 1 ? 'order' : 'orders'}
                  {summaryData.totalOrders > 0 && (
                    <span className="text-slate-400">
                      {' '}· Avg ₱{summaryData.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight tabular-nums">
                ₱{summaryData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Moment: Proportional Payment Share Bar */}
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
                {grossTotal > 0 ? (
                  <>
                    {summaryData.breakdown.cash.total > 0 && (
                      <div
                        style={{ width: `${Math.max(4, (summaryData.breakdown.cash.total / grossTotal) * 100)}%` }}
                        className="h-full bg-orange-500 transition-[width] duration-300 ease-out"
                        title={`Cash: ${cashShare}%`}
                      />
                    )}
                    {summaryData.breakdown.gcash.total > 0 && (
                      <div
                        style={{ width: `${Math.max(4, (summaryData.breakdown.gcash.total / grossTotal) * 100)}%` }}
                        className="h-full bg-slate-700 transition-[width] duration-300 ease-out"
                        title={`GCash: ${gcashShare}%`}
                      />
                    )}
                    {summaryData.breakdown.hybrid.total > 0 && (
                      <div
                        style={{ width: `${Math.max(4, (summaryData.breakdown.hybrid.total / grossTotal) * 100)}%` }}
                        className="h-full bg-slate-400 transition-[width] duration-300 ease-out"
                        title={`Split & hybrid: ${hybridShare}%`}
                      />
                    )}
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-100" />
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Recognized sales across all channels</span>
                <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    {cashShare}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    {gcashShare}%
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {hybridShare}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Rail Breakdown Ledger */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 overflow-hidden">
            {/* Cash */}
            <div
              onClick={() => handlePaymentChange('Cash')}
              className={`p-5 transition-colors duration-150 ease-out cursor-pointer flex flex-col justify-between gap-3 ${
                paymentFilter === 'Cash' ? 'bg-slate-100/80' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  Cash in till
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {summaryData.breakdown.cash.count.toLocaleString()}
                </span>
              </div>
              <div>
                <div className="text-2xl font-medium text-slate-900 tracking-tight tabular-nums">
                  ₱{summaryData.breakdown.cash.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">Counter &amp; pick-up cash</p>
              </div>
            </div>

            {/* GCash */}
            <div
              onClick={() => handlePaymentChange('GCash')}
              className={`p-5 transition-colors duration-150 ease-out cursor-pointer flex flex-col justify-between gap-3 ${
                paymentFilter === 'GCash' ? 'bg-slate-100/80' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  GCash
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {summaryData.breakdown.gcash.count.toLocaleString()}
                </span>
              </div>
              <div>
                <div className="text-2xl font-medium text-slate-900 tracking-tight tabular-nums">
                  ₱{summaryData.breakdown.gcash.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">Verified digital transfers</p>
              </div>
            </div>

            {/* Hybrid / Split */}
            <div
              onClick={() => handlePaymentChange('Hybrid')}
              className={`p-5 transition-colors duration-150 ease-out cursor-pointer flex flex-col justify-between gap-3 ${
                paymentFilter === 'Hybrid' ? 'bg-slate-100/80' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Split &amp; hybrid
                </span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {summaryData.breakdown.hybrid.count.toLocaleString()}
                </span>
              </div>
              <div>
                <div className="text-2xl font-medium text-slate-900 tracking-tight tabular-nums">
                  ₱{summaryData.breakdown.hybrid.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">Combined cash &amp; wallet</p>
              </div>
            </div>
          </div>
        </section>

        {/* Cancellations are the other half of the shift's money: an order that was paid for and
            then cancelled is a debt against the till until a named person hands it back. */}
        {summaryData.cancellations.count > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Cancellations &amp; money returned</h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {summaryData.cancellations.count} cancelled {summaryData.cancellations.count === 1 ? 'order' : 'orders'} this period — a
                  paid cancellation closes once the money is back with the customer
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Money returned</span>
                  <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                    {summaryData.cancellations.refundedCount.toLocaleString()}
                  </span>
                </div>
                <div className="text-2xl font-medium text-slate-900 mt-2 tracking-tight tabular-nums">
                  ₱{summaryData.cancellations.refundedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Paid back out by the cashier or assistant, each payout signed and traceable
                </p>
              </div>
              <div
                className={`rounded-xl border p-4 ${
                  summaryData.cancellations.awaitingCount > 0
                    ? 'border-amber-300/80 bg-amber-50/40'
                    : 'border-slate-200/80 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">Still owed</span>
                  <span className={`font-mono text-xs font-medium tabular-nums ${summaryData.cancellations.awaitingCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {summaryData.cancellations.awaitingCount.toLocaleString()}
                  </span>
                </div>
                <div className="text-2xl font-medium text-slate-900 mt-2 tracking-tight tabular-nums">
                  ₱{summaryData.cancellations.awaitingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {summaryData.cancellations.awaitingCount > 0
                    ? 'Cancelled but not refunded yet — stock stays reserved until settled'
                    : 'Every cancelled order in this period has been settled with the customer'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area & Table */}
        <div id="print-area">
          {/* Table Container Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden print:shadow-none print:border print:rounded-none">
            {/* Filter Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
              <div className="flex items-baseline gap-2.5">
                <h2 className="text-base font-semibold text-slate-900">Transactions</h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {totalMatchingCount.toLocaleString()} {totalMatchingCount === 1 ? 'record' : 'records'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Channel Filter */}
                <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 text-xs font-medium">
                  {[
                    { label: 'All channels', val: 'All' },
                    { label: 'POS walk-in', val: 'POS' },
                    { label: 'Online delivery', val: 'Online' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => handleChannelChange(item.val)}
                      className={`px-3 py-1.5 rounded-lg transition-[background-color,color,box-shadow] duration-150 ease-out cursor-pointer ${
                        channelFilter === item.val
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Payment Filter */}
                <div className="inline-flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 text-xs font-medium">
                  {['All', 'Cash', 'GCash', 'Hybrid'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => handlePaymentChange(pm)}
                      className={`px-3 py-1.5 rounded-lg transition-[background-color,color,box-shadow] duration-150 ease-out cursor-pointer ${
                        paymentFilter === pm
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setIsLoading(true)
                      setSearchQuery(e.target.value)
                    }}
                    placeholder="Search order ID or customer"
                    className="w-52 sm:w-64 bg-slate-50 border border-slate-200/80 rounded-xl pl-8 pr-3 py-1.5 text-xs font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-colors duration-150 ease-out"
                  />
                  <svg
                    className="w-4 h-4 text-slate-400 absolute left-2.5 top-2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-xs font-medium text-slate-500 border-b border-slate-200/80">
                    <th className="py-3 px-4 font-medium">Order ID</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium">Date &amp; time</th>
                    <th className="py-3 px-4 font-medium">Payment</th>
                    <th className="py-3 px-4 text-right font-medium">Total</th>
                    <th className="py-3 px-4 text-center font-medium">Status</th>
                    <th className="py-3 px-4 text-center font-medium print:hidden">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-normal text-slate-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        <div className="inline-flex items-center gap-2 text-slate-600 font-medium">
                          <svg className="animate-spin h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          <span className="tabular-nums">Loading page {currentPage}</span>
                        </div>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <p className="font-medium text-slate-700">No transactions for {activeTab.toLowerCase()}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Orders matching your channel and payment filters will appear here
                        </p>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id || tx.ref} className="hover:bg-slate-50/80 transition-colors duration-150 ease-out">
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          {tx.ref || tx.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{tx.customer || '—'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{tx.type}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="text-left cursor-pointer block max-w-sm text-xs text-slate-800 hover:text-orange-600 transition-colors duration-150 ease-out"
                            title="View transaction details"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              {getOrderedItems(tx.items).map((item, idx) => {
                                const match = item.match(/^(.*?)\s*x(\d+)$/i)
                                if (match) {
                                  return (
                                    <span key={idx} className="inline-flex items-baseline gap-1">
                                      <span className="font-mono text-xs text-slate-500 tabular-nums">{match[2]}×</span>
                                      <span className="text-slate-800 font-medium">{match[1].trim()}</span>
                                    </span>
                                  )
                                }
                                return (
                                  <span key={idx} className="text-xs font-medium text-slate-800">
                                    {item}
                                  </span>
                                )
                              })}
                            </div>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-xs tabular-nums whitespace-nowrap">
                          {tx.dateTime}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/70 text-xs font-medium">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                (tx.paymentMethod || '').toLowerCase().includes('hybrid') ||
                                (tx.paymentMethod || '').toLowerCase().includes('split')
                                  ? 'bg-slate-400'
                                  : (tx.paymentMethod || '').toLowerCase().includes('gcash') ||
                                      (tx.paymentMethod || '').toLowerCase().includes('maya')
                                    ? 'bg-slate-700'
                                    : 'bg-orange-500'
                              }`}
                            />
                            {tx.paymentMethod || 'Cash'}
                          </span>
                          {((tx.paymentMethod || '').toLowerCase().includes('gcash') ||
                            (tx.paymentMethod || '').toLowerCase().includes('hybrid')) &&
                            (tx.paymentReference || tx.referenceNumber) && (
                              <span
                                className="block font-mono text-[11px] text-slate-500 mt-1 truncate max-w-[140px] tabular-nums"
                                title={`Ref: ${tx.paymentReference || tx.referenceNumber}`}
                              >
                                #{tx.paymentReference || tx.referenceNumber}
                              </span>
                            )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          ₱{Number(tx.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                isCancelledOrder(tx.status)
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                              }`}
                            >
                              {tx.status || 'Completed'}
                            </span>
                            {/* A cancelled row says what became of the customer's money, not
                                merely that the order ended. */}
                            {isCancelledOrder(tx.status) && tx.refund && tx.refund.state !== 'NONE' && (
                              tx.refund.state === 'COMPLETED' ? (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                  title={refundSummaryLine(tx.refund)}
                                >
                                  Refunded{refundActorLabel(tx.refund) ? ` · ${refundActorLabel(tx.refund)}` : ''}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 tabular-nums"
                                  title="The customer has not been paid back yet"
                                >
                                  Owed ₱{tx.refund.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )
                            )}
                            {tx.deliveryProof && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-200/70 transition-colors duration-150 ease-out"
                                title="Proof of delivery attached"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewReceiptUrl(tx.deliveryProof || null)
                                }}
                              >
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                                <span>Proof</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors duration-150 ease-out cursor-pointer"
                            title={
                              tx.paymentReference || tx.referenceNumber
                                ? `View details (Ref: ${tx.paymentReference || tx.referenceNumber})`
                                : 'View details'
                            }
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="text-xs text-slate-500 tabular-nums">
                Showing <span className="font-medium text-slate-800">{startItem}–{endItem}</span> of{' '}
                <span className="font-medium text-slate-800">{totalMatchingCount.toLocaleString()}</span> orders
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Previous Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 ease-out"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Prev</span>
                  </button>

                  {/* Page Number Pills */}
                  {getPaginationRange().map((pageItem, idx) => {
                    if (pageItem === '...') {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs font-medium text-slate-400">
                          …
                        </span>
                      )
                    }

                    const pageNum = Number(pageItem)
                    const isActive = currentPage === pageNum

                    return (
                      <button
                        key={`page-${pageNum}`}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={isLoading}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium tabular-nums transition-colors duration-150 ease-out cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}

                  {/* Next Button */}
                  <button
                    type="button"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 ease-out"
                  >
                    <span>Next</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 antialiased"
          onClick={() => setSelectedTransaction(null)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/90 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/70 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-semibold text-slate-900">Transaction details</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                    selectedTransaction.status?.toUpperCase() === 'CANCELLED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                  }`}>
                    {selectedTransaction.status || 'Completed'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  {selectedTransaction.ref || selectedTransaction.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 ease-out cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto overscroll-contain space-y-4">
              {/* Customer & Delivery Information */}
              <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 text-xs space-y-3">
                <div className="text-xs font-medium text-slate-600">
                  Customer &amp; fulfillment
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-500 block">Customer name</span>
                    <span className="font-medium text-slate-900 mt-0.5 block text-sm">
                      {selectedTransaction.customer || (selectedTransaction as any).customerName || 'None recorded'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">Contact phone</span>
                    <span className="font-medium text-slate-800 mt-0.5 block tabular-nums">
                      {selectedTransaction.customerPhone || 'None recorded'}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-500 block">Fulfillment location</span>
                    <span className="font-normal text-slate-800 mt-0.5 block leading-relaxed">
                      {selectedTransaction.customerAddress || (selectedTransaction.type?.toLowerCase().includes('delivery') ? 'No delivery address recorded' : (selectedTransaction.type?.toLowerCase().includes('pick') ? 'Store pick-up counter' : 'In-store counter'))}
                    </span>
                  </div>

                  {selectedTransaction.riderName && !selectedTransaction.type?.toLowerCase().includes('pick') && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Assigned rider</span>
                      <span className="font-medium text-slate-800 bg-white px-2.5 py-0.5 rounded-md border border-slate-200/80 text-xs">
                        {selectedTransaction.riderName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Metadata Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/70 border border-slate-200/70 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-xs text-slate-500 block">Channel</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{selectedTransaction.type}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Payment method</span>
                  <span className="font-medium text-slate-900 mt-0.5 block">{selectedTransaction.paymentMethod || 'Cash'}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-xs text-slate-500 block">Date &amp; time</span>
                  <span className="font-normal text-slate-700 mt-0.5 block tabular-nums">{selectedTransaction.dateTime}</span>
                </div>
              </div>

              {/* Reference Number for GCash or Hybrid in View Details */}
              {((selectedTransaction.paymentMethod || '').toLowerCase().includes('gcash') ||
                (selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid') ||
                Boolean(selectedTransaction.paymentReference || selectedTransaction.referenceNumber)) && (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs text-slate-500 block">
                        {(selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid')
                          ? 'Hybrid payment reference'
                          : 'GCash reference number'}
                      </span>
                      {!isEditingRef ? (
                        <span className="font-mono font-medium text-slate-900 text-sm mt-0.5 block truncate tabular-nums">
                          {selectedTransaction.paymentReference || selectedTransaction.referenceNumber || 'None recorded'}
                        </span>
                      ) : null}
                    </div>

                    {!isEditingRef && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(selectedTransaction.paymentReference || selectedTransaction.referenceNumber) && (
                          <button
                            type="button"
                            onClick={() => {
                              const ref = selectedTransaction.paymentReference || selectedTransaction.referenceNumber || ''
                              navigator.clipboard?.writeText(ref)
                              setCopiedRef(true)
                              setTimeout(() => setCopiedRef(false), 2000)
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors duration-150 ease-out cursor-pointer flex items-center gap-1.5"
                            title="Copy reference number"
                          >
                            {copiedRef ? (
                              <>
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNewRefInput(selectedTransaction.paymentReference || selectedTransaction.referenceNumber || '')
                            setIsEditingRef(true)
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs transition-colors duration-150 ease-out cursor-pointer"
                        >
                          {selectedTransaction.paymentReference || selectedTransaction.referenceNumber ? 'Edit' : 'Add ref'}
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditingRef && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                      <input
                        type="text"
                        value={newRefInput}
                        onChange={(e) => setNewRefInput(e.target.value)}
                        placeholder="Enter reference number"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-slate-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveInlineRef}
                        disabled={isSavingRef}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs cursor-pointer transition-colors duration-150 ease-out"
                      >
                        {isSavingRef ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingRef(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-medium text-xs cursor-pointer transition-colors duration-150 ease-out"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cancelled transaction: where the customer's money ended up. */}
              {isCancelledOrder(selectedTransaction.status) && (() => {
                const refund = selectedTransaction.refund ?? { state: 'NONE' as const, amount: 0 }
                const settled = refund.state === 'COMPLETED'
                const owed = refund.state === 'PENDING'
                const actor = refundActorLabel(refund)
                const peso = (n: number) =>
                  `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

                return (
                  <div
                    className={`rounded-xl border p-4 space-y-3 ${
                      settled
                        ? 'border-slate-200/80 bg-slate-50/70'
                        : owed
                          ? 'border-amber-300/80 bg-amber-50/40'
                          : 'border-slate-200/80 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-900">Cancelled transaction</span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          settled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : owed
                              ? 'bg-amber-100/80 text-amber-800 border border-amber-300/70'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {settled ? 'Money returned' : owed ? 'Not returned yet' : 'Nothing owed'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{refundSummaryLine(refund)}</p>

                    {refund.state !== 'NONE' && (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <dt className="text-slate-500">
                            {settled ? 'Amount returned' : 'Amount owed'}
                          </dt>
                          <dd className="font-mono font-medium text-slate-900 mt-0.5 tabular-nums">{peso(refund.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Returned as</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">{refundMethodLabel(refund)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Handed back by</dt>
                          <dd className="font-medium text-slate-800 mt-0.5">
                            {actor || (settled ? 'Not recorded' : 'Nobody yet')}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">
                            {settled ? 'Returned on' : 'Cancelled on'}
                          </dt>
                          <dd className="font-medium text-slate-800 mt-0.5 tabular-nums">
                            {(() => {
                              const stamp = settled ? refund.at : selectedTransaction.cancelledAt
                              if (!stamp) return '—'
                              const d = new Date(stamp)
                              return isNaN(d.getTime()) ? '—' : d.toLocaleString()
                            })()}
                          </dd>
                        </div>
                      </dl>
                    )}

                    {refund.reference && (
                      <div className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                        <span className="text-xs text-slate-500 block">
                          Refund reference
                        </span>
                        <span className="font-mono text-xs font-medium text-slate-900 break-all tabular-nums">{refund.reference}</span>
                      </div>
                    )}

                    {refund.receipt ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <img
                            src={refund.receipt}
                            alt="Proof the refund was sent"
                            onClick={() => setPreviewReceiptUrl(refund.receipt || null)}
                            className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-200 object-cover transition-opacity hover:opacity-85"
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-medium text-slate-900">Refund proof</span>
                            <p className="truncate text-xs text-slate-500">
                              Screenshot of the payout to the customer
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptUrl(refund.receipt || null)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs cursor-pointer shrink-0 transition-colors duration-150 ease-out"
                        >
                          View image
                        </button>
                      </div>
                    ) : (
                      refund.state !== 'NONE' && (
                        <p className="text-xs text-slate-500">
                          {(refund.method || '').toUpperCase() === 'CASH'
                            ? 'Cash handed over the counter — the named cashier is the record'
                            : owed
                              ? 'No proof yet: nothing has been sent back'
                              : 'No screenshot was attached to this payout'}
                        </p>
                      )
                    )}
                  </div>
                )
              })()}

              {/* Payment Proof Receipt Screenshot Card */}
              {selectedTransaction.paymentReceipt && (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedTransaction.paymentReceipt}
                      alt="Payment proof"
                      onClick={() => setPreviewReceiptUrl(selectedTransaction.paymentReceipt || null)}
                      className="w-11 h-11 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-900 block">Payment proof</span>
                      <p className="text-xs text-slate-500 truncate">Customer digital payment confirmation</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewReceiptUrl(selectedTransaction.paymentReceipt || null)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer shrink-0 transition-colors duration-150 ease-out"
                  >
                    View image
                  </button>
                </div>
              )}

              {/* Delivery Proof Photo Card */}
              {selectedTransaction.deliveryProof && (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedTransaction.deliveryProof}
                      alt="Proof of delivery"
                      onClick={() => setPreviewReceiptUrl(selectedTransaction.deliveryProof || null)}
                      className="w-11 h-11 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-slate-900 block">Proof of delivery</span>
                      <p className="text-xs text-slate-500 truncate">Captured by rider upon completion</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewReceiptUrl(selectedTransaction.deliveryProof || null)}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer shrink-0 transition-colors duration-150 ease-out"
                  >
                    View image
                  </button>
                </div>
              )}

              {/* Ordered Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    Ordered items
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {(selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length)} {((selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length) === 1 ? 'item' : 'items')}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-200/60 overflow-hidden bg-white">
                  {selectedTransaction.itemsList && selectedTransaction.itemsList.length > 0 ? (
                    selectedTransaction.itemsList.map((item, idx) => (
                      <div
                        key={`item-${idx}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 flex items-baseline gap-2.5">
                          <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                            {item.quantity}×
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-slate-900 text-sm block truncate">{item.name}</span>
                            {item.unit_price !== undefined && (
                              <span className="text-xs text-slate-500 block tabular-nums">
                                ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                              </span>
                            )}
                          </div>
                        </div>
                        {item.subtotal !== undefined && (
                          <span className="font-mono font-medium text-slate-900 text-sm tabular-nums shrink-0 text-right">
                            ₱{Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    getOrderedItems(selectedTransaction.items).map((item, index) => {
                      const match = item.match(/^(.*?)\s*x(\d+)$/i)
                      const itemName = match ? match[1].trim() : item
                      const quantity = match ? match[2] : null

                      return (
                        <div
                          key={`${selectedTransaction.id}-item-${index}`}
                          className="flex items-center justify-between gap-4 px-4 py-2.5 text-xs"
                        >
                          <div className="flex items-baseline gap-2.5">
                            {quantity && (
                              <span className="font-mono text-xs text-slate-500 tabular-nums">
                                {quantity}×
                              </span>
                            )}
                            <span className="font-medium text-slate-900 text-sm">{itemName}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Financial Summary Breakdown */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Items subtotal</span>
                  <span className="font-mono font-normal tabular-nums">
                    ₱{(selectedTransaction.subtotal !== undefined
                      ? Number(selectedTransaction.subtotal)
                      : Number(selectedTransaction.total || 0)
                    ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>VAT (12%)</span>
                  <span className="font-mono font-normal tabular-nums">
                    ₱{(selectedTransaction.tax !== undefined ? Number(selectedTransaction.tax) : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {(selectedTransaction.deliveryFee !== undefined && Number(selectedTransaction.deliveryFee) > 0) && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Delivery fee</span>
                    <span className="font-mono font-normal tabular-nums">
                      ₱{Number(selectedTransaction.deliveryFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="font-medium text-slate-900 text-sm">Order total</span>
                  <span className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                    ₱{Number(selectedTransaction.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {selectedTransaction.riderCashReceived !== undefined && selectedTransaction.riderCashReceived !== null && (
                  <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                      <span>Rider cash received on delivery</span>
                      <span className="font-mono tabular-nums">
                        ₱{Number(selectedTransaction.riderCashReceived).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {Number(selectedTransaction.riderCashReceived) > Number(selectedTransaction.total || 0) && (
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Change given to customer</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          ₱{(Number(selectedTransaction.riderCashReceived) - Number(selectedTransaction.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {Number(selectedTransaction.riderCashReceived) < Number(selectedTransaction.total || 0) && (
                      <div className="flex items-center justify-between text-xs text-amber-800">
                        <span>Short payment balance</span>
                        <span className="font-mono tabular-nums">
                          ₱{(Number(selectedTransaction.total || 0) - Number(selectedTransaction.riderCashReceived)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200/70 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-medium rounded-xl text-xs transition-colors duration-150 ease-out cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Screenshot Full View Modal */}
      {previewReceiptUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div
            className="relative max-w-xl max-h-[90vh] bg-white rounded-2xl p-4 shadow-xl border border-slate-200 flex flex-col items-center gap-3 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200/70">
              <span className="text-xs font-medium text-slate-800">
                {selectedTransaction?.deliveryProof === previewReceiptUrl
                  ? 'Proof of delivery photo'
                  : 'Transaction proof screenshot'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer transition-colors duration-150 ease-out"
                aria-label="Close image preview"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <img
              src={previewReceiptUrl}
              alt="Transaction proof"
              className="max-h-[72vh] w-auto object-contain rounded-xl border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setPreviewReceiptUrl(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-colors duration-150 ease-out cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Admin Action Modals */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={refreshData}
      />

      <AdminEditTransactionModal
        isOpen={Boolean(editingTransaction)}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={refreshData}
      />

    </div>
  )
}

export default SalesReportCashier

import React, { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NavbarAdmin } from '../components/NavbarAdmin'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { subscribeOrderSync } from '../utils/orderSync'
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
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { AdminBackupModal } from '../components/AdminBackupModal'
import { AdminExportTransactionsModal } from '../components/AdminExportTransactionsModal'
import type { PeriodOption, ChannelOption } from '../components/AdminExportTransactionsModal'
import {
    Badge,
    Button,
    Modal,
    Card,
    CardHeader,
    EmptyState,
    Icon,
    IconButton,
    Pagination,
    SearchInput,
    Segmented,
    Toolbar,
    type BadgeTone,
} from './inventory/ui'
import './inventory/admin-inventory.css'

/**
 * Payment method is a category, not a health signal, so it borrows the kit's
 * category tones and leaves success / warning / danger free to mean status.
 */
const paymentTone = (method?: string): BadgeTone => {
    const m = (method || '').toLowerCase()
    if (m.includes('hybrid') || m.includes('split')) return 'pkg'
    if (m.includes('gcash') || m.includes('maya') || m.includes('wallet')) return 'info'
    return 'neutral'
}

/**
 * The register is an audit ledger: it carries cancelled, pending and in-flight
 * orders alongside finished ones, so the status pill has to tell them apart.
 */
const statusTone = (status?: string): BadgeTone => {
    const s = (status || '').toUpperCase()
    if (/(COMPLETED|DELIVERED|SERVED|PAID)/.test(s)) return 'success'
    if (/(CANCEL|REJECT|REFUND|FAIL|VOID)/.test(s)) return 'danger'
    if (/(PENDING|AWAIT|OUT_OF_STOCK|HOLD|UNPAID)/.test(s)) return 'warning'
    return 'info'
}

const statusLabel = (status?: string) => {
    const raw = (status || 'Completed').replace(/_/g, ' ').toLowerCase().trim()
    return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const humanizeChannel = (type?: string) => {
    const t = (type || '').toLowerCase()
    if (t.includes('online') || t.includes('delivery')) return 'Delivery'
    if (t.includes('pos') || t.includes('walk') || t.includes('on_site') || t.includes('on-site')) return 'Walk-in'
    return type || '—'
}

const peso = (n: number) =>
    `\u20B1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PERIOD_OPTIONS = [
    { value: 'Today', label: 'Today' },
    { value: 'This Week', label: 'This week' },
    { value: 'This Month', label: 'This month' },
    { value: 'This Year', label: 'This year' },
] as const

const CHANNEL_OPTIONS = [
    { value: 'All', label: 'All channels' },
    { value: 'POS', label: 'Walk-in' },
    { value: 'Online', label: 'Delivery' },
] as const

const PAYMENT_OPTIONS = [
    { value: 'All', label: 'All' },
    { value: 'Cash', label: 'Cash' },
    { value: 'GCash', label: 'GCash' },
    { value: 'Hybrid', label: 'Split' },
] as const

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
    created_at?: string
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
     * Cancelled orders are not revenue, but a cancelled order that was paid for is money the
     * restaurant is holding until somebody hands it back, so the register accounts for both
     * halves: what was returned, and what is still owed.
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

/**
 * The export dialog speaks the backend's period vocabulary; the page speaks the
 * tab labels. These two maps are the single translation between them, so an
 * export always covers exactly the range the report is showing.
 */
const EXPORT_PERIOD_BY_TAB: Record<TabType, PeriodOption> = {
    'Today': 'today',
    'This Week': 'week',
    'This Month': 'month',
    'This Year': 'year',
}

const EXPORT_CHANNEL_BY_FILTER: Record<string, ChannelOption> = {
    All: 'all',
    POS: 'pos',
    Online: 'online',
}

const PAGE_SIZE = 10

const readString = (...values: unknown[]): string | undefined => {
    for (const val of values) {
        if (typeof val === 'string' && val.trim().length > 0) return val.trim()
        if (typeof val === 'number') return String(val)
    }
    return undefined
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

const parseOrderDate = (dateStr?: string, createdAtRaw?: string): Date => {
    if (createdAtRaw) {
        const d = new Date(createdAtRaw)
        if (!isNaN(d.getTime())) return d
    }
    if (!dateStr) return new Date(0)
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    const parsed = Date.parse(dateStr)
    if (!isNaN(parsed)) return new Date(parsed)
    const match = String(dateStr).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
    if (match) {
        const p1 = parseInt(match[1], 10)
        const p2 = parseInt(match[2], 10)
        const year = parseInt(match[3], 10)
        const hour = match[4] ? parseInt(match[4], 10) : 0
        const min = match[5] ? parseInt(match[5], 10) : 0
        const sec = match[6] ? parseInt(match[6], 10) : 0
        const month = p1 > 12 ? p2 - 1 : p1 - 1
        const day = p1 > 12 ? p1 : p2
        const res = new Date(year, month, day, hour, min, sec)
        if (!isNaN(res.getTime())) return res
    }
    return new Date(0)
}

const SalesReportAdmin: React.FC = () => {
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
            const authHeaders = await getAuthHeaders()
            await fetch(`${API_BASE_URL}/orders/${selectedTransaction.id}`, {
                method: 'PUT',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
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
    const [isLoading, setIsLoading] = useState(false)
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
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false)
    const [isExportModalOpen, setIsExportModalOpen] = useState(false)

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim())
            setCurrentPage(1)
        }, 300)
        return () => clearTimeout(handler)
    }, [searchQuery])

    // If navigated from dashboard with specific state, sync them
    useEffect(() => {
        if (navState?.channel) setChannelFilter(navState.channel)
        if (navState?.tab) setActiveTab(navState.tab)
        if (navState?.payment) setPaymentFilter(navState.payment)
    }, [navState])

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
        setActiveTab(tab)
        setCurrentPage(1)
        // Reset metrics immediately so previous period numbers don't linger
        setSummaryData({
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
    }

    const handleChannelChange = (channel: string) => {
        setChannelFilter(channel)
        setCurrentPage(1)
    }

    const handlePaymentChange = (pm: string) => {
        setPaymentFilter(pm)
        setCurrentPage(1)
    }

    const formatOrderRow = useCallback((dbO: any): LiveTransaction => {
        const rawFulfillment = String(dbO.fulfillment_type || dbO.fulfillmentType || '').toUpperCase()
        const rawType = String(dbO.order_type || dbO.type || '')
        const normalizedType =
            rawFulfillment === 'PICKUP' || rawType.toUpperCase().includes('PICKUP')
                ? 'Store Pick-Up'
                : rawType.toUpperCase() === 'ONLINE' || rawType.toUpperCase() === 'DELIVERY'
                    ? 'Delivery'
                    : rawType.toUpperCase() === 'ON_SITE'
                        ? 'POS Order'
                        : rawType || 'POS Order'

        let itemsSummary = 'Seafood Dish'
        let itemsList: OrderItemDetail[] = []
        if (Array.isArray(dbO.items) && dbO.items.length > 0) {
            itemsList = dbO.items.map((i: any) => ({
                id: i.id || i.product_id,
                name: i.name || i.product_name_snapshot || i.snapshot_item_name || 'Dish',
                quantity: Number(i.quantity || 1),
                unit_price: i.unit_price ? Number(i.unit_price) : undefined,
                subtotal: i.subtotal ? Number(i.subtotal) : (i.unit_price ? Number(i.unit_price) * Number(i.quantity || 1) : undefined)
            }))
            itemsSummary = itemsList
                .map((i) => `${i.name} x${i.quantity}`)
                .join(', ')
        } else if (typeof dbO.items === 'string') {
            itemsSummary = dbO.items
        }

        return {
            id: String(dbO.id),
            ref: String(dbO.id),
            dateTime: dbO.created_at ? new Date(dbO.created_at).toLocaleString() : new Date().toLocaleString(),
            created_at: dbO.created_at,
            items: itemsSummary,
            itemsList,
            customer: (() => {
                const c = String(dbO.customer_name || dbO.customerName || dbO.customer || dbO.fullname || '').trim();
                if (c && c !== 'Walk-In' && c !== 'Walk-In Customer' && c !== 'Online Customer') return c;
                if (c === 'Online Customer') return c;
                return '';
            })(),
            customerPhone: dbO.customer_phone || dbO.phone || undefined,
            customerAddress: dbO.delivery_address || dbO.address || undefined,
            total: Number(dbO.total || 0),
            subtotal: dbO.subtotal !== undefined && dbO.subtotal !== null ? Number(dbO.subtotal) : undefined,
            tax: dbO.tax !== undefined && dbO.tax !== null ? Number(dbO.tax) : (dbO.vat !== undefined ? Number(dbO.vat) : undefined),
            deliveryFee: dbO.delivery_fee !== undefined && dbO.delivery_fee !== null ? Number(dbO.delivery_fee) : undefined,
            riderCashReceived: dbO.rider_cash_received !== undefined && dbO.rider_cash_received !== null
                ? Number(dbO.rider_cash_received)
                : (dbO.riderCashReceived !== undefined && dbO.riderCashReceived !== null ? Number(dbO.riderCashReceived) : undefined),
            riderName: (rawFulfillment === 'PICKUP' || rawType.toUpperCase().includes('PICKUP')) ? undefined : (dbO.rider_name || dbO.riderName || undefined),
            type: normalizedType,
            paymentMethod: dbO.payment_method || 'Cash',
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
            status: dbO.status || 'Completed',
            refund: readRefundAccountability(dbO),
            cancelledAt: readString(dbO.cancelled_at, dbO.cancelledAt),
        }
    }, [])

    const getOrderDate = (order: any): Date | null => {
        const rawCreated = order.created_at ?? order.createdAt ?? null
        const rawDate = order.dateTime ?? order.date ?? null
        const parsed = parseOrderDate(rawDate, rawCreated)
        return isNaN(parsed.getTime()) || parsed.getTime() <= 0 ? null : parsed
    }

    const checkIsInSelectedPeriod = useCallback((order: any, tab: TabType): boolean => {
        const orderDate = getOrderDate(order)
        if (!orderDate) return false

        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
        const targetTime = orderDate.getTime()

        if (tab === 'Today') {
            return targetTime >= startOfToday && targetTime <= endOfToday
        }

        if (tab === 'This Week') {
            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime()
            return targetTime >= startOfWeek && targetTime <= endOfToday
        }

        if (tab === 'This Month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()
            return targetTime >= startOfMonth && targetTime <= endOfToday
        }

        if (tab === 'This Year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime()
            return targetTime >= startOfYear && targetTime <= endOfToday
        }

        return true
    }, [])

    const fetchSummary = useCallback(async () => {
        try {
            const authHeaders = await getAuthHeaders()
            const res = await fetch(`${API_BASE_URL}/sales/summary?tab=${encodeURIComponent(activeTab)}`, { headers: authHeaders })
            if (res.ok) {
                const json = await res.json()
                if (json.success && json.data) {
                    const d = json.data
                    const b = d.breakdown || {}
                    const cashTotal = Number(b.cash?.total || 0)
                    const cashCount = Number(b.cash?.count || 0)
                    const gcashTotal = Number(b.gcash?.total || 0) + Number(b.maya?.total || 0)
                    const gcashCount = Number(b.gcash?.count || 0) + Number(b.maya?.count || 0)
                    const hybridTotal = Number(b.hybrid?.total || 0)
                    const hybridCount = Number(b.hybrid?.count || 0)

                    setSummaryData({
                        totalOrders: Number(d.totalOrders || 0),
                        grossRevenue: Number(d.grossRevenue || 0),
                        subtotalRevenue: Number(d.subtotalRevenue || 0),
                        vatCollected: Number(d.vatCollected || 0),
                        averageOrderValue: Number(d.averageOrderValue || 0),
                        breakdown: {
                            cash: { total: cashTotal, count: cashCount },
                            gcash: { total: gcashTotal, count: gcashCount },
                            maya: { total: Number(b.maya?.total || 0), count: Number(b.maya?.count || 0) },
                            hybrid: { total: hybridTotal, count: hybridCount },
                        },
                        cancellations: {
                            count: Number(d.cancellations?.count || 0),
                            refundedCount: Number(d.cancellations?.refundedCount || 0),
                            refundedAmount: Number(d.cancellations?.refundedAmount || 0),
                            awaitingCount: Number(d.cancellations?.awaitingRefundCount || 0),
                            awaitingAmount: Number(d.cancellations?.awaitingRefundAmount || 0),
                        },
                    })
                    return
                }
            }
        } catch (localErr) {
            console.warn('Failed to read sales summary API:', localErr)
        }

        try {
            const orderMap = new Map<string, any>()

            // 1. Include locally stored orders matching selected period
            try {
                const localRaw = localStorage.getItem('seafudz_orders')
                if (localRaw) {
                    const localOrders = JSON.parse(localRaw)
                    if (Array.isArray(localOrders)) {
                        localOrders
                            .filter((o: any) => checkIsInSelectedPeriod(o, activeTab))
                            .forEach((order: any, index: number) => {
                                const key = String(order.id ?? order.ref ?? `local-${index}`)
                                orderMap.set(key, order)
                            })
                    }
                }
            } catch (localErr) {
                console.warn('Failed to read local orders for sales summary:', localErr)
            }

            // 2. Fetch backend orders matching selected period
            try {
                const authHeaders = await getAuthHeaders()
                const ordersRes = await fetch(
                    `${API_BASE_URL}/orders?limit=10000&offset=0&tab=${encodeURIComponent(activeTab)}`,
                    { headers: authHeaders }
                )

                if (ordersRes.ok) {
                    const ordersJson = await ordersRes.json()
                    const backendOrders = Array.isArray(ordersJson.data) ? ordersJson.data : []
                    backendOrders
                        .filter((o: any) => checkIsInSelectedPeriod(o, activeTab))
                        .forEach((order: any, index: number) => {
                            const key = String(order.id ?? order.ref ?? `backend-${index}`)
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
            let validOrdersCount = 0
            const cancellations = { count: 0, refundedCount: 0, refundedAmount: 0, awaitingCount: 0, awaitingAmount: 0 }

            orders.forEach((order: any) => {
                // A cancelled order is not income, but it is not nothing either: if it was paid
                // for, the money is owed until a named member of staff hands it back.
                if (isCancelledOrder(order.status ?? order.orderStatus ?? order.order_status)) {
                    const refund = readRefundAccountability(order)
                    cancellations.count += 1
                    if (refund.state === 'COMPLETED') {
                        cancellations.refundedCount += 1
                        cancellations.refundedAmount += refund.amount
                    } else if (refund.state === 'PENDING') {
                        cancellations.awaitingCount += 1
                        cancellations.awaitingAmount += refund.amount
                    }
                }

                // Only finished transactions are income. Orders still moving through the
                // flow are work in progress, and cancelled / rejected ones never sold.
                if (!countsAsSale(order)) return

                const total = Number(
                    order.total ??
                    order.totalAmount ??
                    order.grandTotal ??
                    order.amount ??
                    0
                ) || 0

                grossRevenue += total
                validOrdersCount += 1

                const payment = String(
                    order.payment_method ??
                    order.paymentMethod ??
                    order.payment ??
                    'Cash'
                ).toLowerCase()

                if (payment.includes('hybrid') || payment.includes('split')) {
                    breakdown.hybrid.total += total
                    breakdown.hybrid.count += 1
                } else if (payment.includes('gcash') || payment.includes('online') || payment.includes('card') || payment.includes('maya')) {
                    breakdown.gcash.total += total
                    breakdown.gcash.count += 1
                } else {
                    // A legacy row still labelled COD was cash that arrived at the door.

                    breakdown.cash.total += total
                    breakdown.cash.count += 1
                }
            })

            setSummaryData({
                totalOrders: validOrdersCount,
                grossRevenue,
                subtotalRevenue: grossRevenue,
                vatCollected: 0,
                averageOrderValue: validOrdersCount > 0 ? grossRevenue / validOrdersCount : 0,
                breakdown,
                cancellations: {
                    ...cancellations,
                    refundedAmount: Math.round(cancellations.refundedAmount * 100) / 100,
                    awaitingAmount: Math.round(cancellations.awaitingAmount * 100) / 100,
                },
            })
        } catch (err) {
            console.warn('Failed to calculate sales summary:', err)
        }
    }, [activeTab, checkIsInSelectedPeriod])

    const fetchOrdersPage = useCallback(async () => {
        setIsLoading(true)
        try {
            const orderMap = new Map<string, LiveTransaction>()

            // 1. Read local orders matching period
            try {
                const localRaw = localStorage.getItem('seafudz_orders')
                if (localRaw) {
                    const parsed = JSON.parse(localRaw)
                    if (Array.isArray(parsed)) {
                        parsed.forEach((o: any, idx: number) => {
                            if (checkIsInSelectedPeriod(o, activeTab)) {
                                let itemsStr = 'Seafood Dish'
                                if (typeof o.items === 'string') {
                                    itemsStr = o.items
                                } else if (Array.isArray(o.items)) {
                                    itemsStr = o.items
                                        .map((i: any) => `${i.name || i.item?.name || 'Seafood'} x${i.quantity || 1}`)
                                        .join(', ')
                                }
                                const localFulfillment = String(o.fulfillmentType || o.fulfillment_type || '').toUpperCase()
                                const localTypeStr = String(o.type || o.order_type || '')
                                const txType = localFulfillment === 'PICKUP' || localTypeStr.toUpperCase().includes('PICKUP')
                                    ? 'Store Pick-Up'
                                    : (localTypeStr.toUpperCase() === 'ONLINE' || localTypeStr.toUpperCase() === 'DELIVERY')
                                        ? 'Delivery'
                                        : o.type || 'POS Order'

                                const tx: LiveTransaction = {
                                    id: String(o.id || o.ref || `local-${idx}`),
                                    ref: String(o.ref || o.id || `local-${idx}`),
                                    dateTime: o.dateTime || o.createdAt || new Date().toLocaleString(),
                                    type: txType,
                                    status: o.status || 'Completed',
                                    customer: (() => {
                                        const c = String(o.customerName || o.customer || o.customer_name || o.fullname || '').trim();
                                        if (c && c !== 'Walk-In' && c !== 'Walk-In Customer') return c;
                                        return '';
                                    })(),
                                    customerPhone: o.phone || o.customerPhone || undefined,
                                    customerAddress: o.deliveryAddress || o.address || o.customerAddress || undefined,
                                    items: itemsStr,
                                    total: Number(o.total || 0),
                                    subtotal: o.subtotal !== undefined ? Number(o.subtotal) : undefined,
                                    tax: o.tax !== undefined ? Number(o.tax) : (o.vat !== undefined ? Number(o.vat) : undefined),
                                    deliveryFee: o.deliveryFee !== undefined ? Number(o.deliveryFee) : undefined,
                                    paymentMethod: o.paymentMethod || 'Cash',
                                    paymentReference: readReferenceString(
                                        o.payment_reference,
                                        o.paymentReference,
                                        o.reference_number,
                                        o.referenceNumber,
                                        o.ref_number,
                                        o.gcash_reference,
                                        o.gcashReference,
                                        (o.payments && Array.isArray(o.payments) && o.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
                                        (o.payments && Array.isArray(o.payments) && o.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
                                    ),
                                    referenceNumber: readReferenceString(
                                        o.payment_reference,
                                        o.paymentReference,
                                        o.reference_number,
                                        o.referenceNumber,
                                        o.ref_number,
                                        o.gcash_reference,
                                        o.gcashReference,
                                        (o.payments && Array.isArray(o.payments) && o.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.reference_number),
                                        (o.payments && Array.isArray(o.payments) && o.payments.slice().reverse().find((p: any) => p.reference_number || p.referenceNumber)?.referenceNumber)
                                    ),
                                    riderCashReceived: o.riderCashReceived !== undefined && o.riderCashReceived !== null
                                        ? Number(o.riderCashReceived)
                                        : (o.rider_cash_received !== undefined && o.rider_cash_received !== null ? Number(o.rider_cash_received) : undefined),
                                    riderName: o.riderName || o.rider_name || undefined,
                                    paymentReceipt: readString(o.paymentReceipt, o.payment_receipt) || undefined,
                                    deliveryProof: readString(o.deliveryProof, o.delivery_proof) || undefined,
                                    refund: readRefundAccountability(o),
                                    cancelledAt: readString(o.cancelled_at, o.cancelledAt),
                                }
                                orderMap.set(tx.id, tx)
                            }
                        })
                    }
                }
            } catch (e) {
                console.warn('Error reading local orders:', e)
            }

            // 2. Fetch backend orders matching period
            try {
                const authHeaders = await getAuthHeaders()
                const params = new URLSearchParams({
                    limit: '10000',
                    tab: activeTab,
                })
                let res = await fetch(`${API_BASE_URL}/orders?${params.toString()}`, { headers: authHeaders })
                if (!res.ok) {
                    res = await fetch(`${API_BASE_URL}/user-flow/orders?limit=10000`).catch(() => res)
                }
                if (res.ok) {
                    const json = await res.json()
                    const list = json.data || []
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

            // Sort descending by date: newest transactions very first, oldest last
            allMatching.sort((a, b) => {
                const dA = parseOrderDate(a.dateTime, a.created_at).getTime()
                const dB = parseOrderDate(b.dateTime, b.created_at).getTime()
                return dB - dA
            })

            setTotalMatchingCount(allMatching.length)
            const offset = (currentPage - 1) * PAGE_SIZE
            setTransactions(allMatching.slice(offset, offset + PAGE_SIZE))
        } catch (err) {
            console.error('Failed to fetch page of orders:', err)
        } finally {
            setIsLoading(false)
        }
    }, [currentPage, activeTab, channelFilter, paymentFilter, debouncedSearch, formatOrderRow, checkIsInSelectedPeriod])

    useEffect(() => {
        void fetchSummary()
    }, [fetchSummary])

    useEffect(() => {
        void fetchOrdersPage()
    }, [fetchOrdersPage])

    useEffect(() => {
        const unsubscribe = subscribeOrderSync(() => {
            void fetchSummary()
            void fetchOrdersPage()
        })

        return () => {
            unsubscribe()
        }
    }, [fetchSummary, fetchOrdersPage])

    const handlePrintAll = () => {
        window.print()
    }

    const getOrderedItems = (items: string) => {
        if (!items) return []
        return items
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
    }

    const statCards = [
        {
            key: 'All',
            label: 'Total revenue',
            value: summaryData.grossRevenue,
            count: summaryData.totalOrders,
            note: 'Gross sales across all channels',
        },
        {
            key: 'Cash',
            label: 'Cash',
            value: summaryData.breakdown.cash.total,
            count: summaryData.breakdown.cash.count,
            note: 'Counter cash',
        },
        {
            key: 'GCash',
            label: 'GCash',
            value: summaryData.breakdown.gcash.total,
            count: summaryData.breakdown.gcash.count,
            note: 'Wallet and online orders',
        },
        {
            key: 'Hybrid',
            label: 'Split',
            value: summaryData.breakdown.hybrid.total,
            count: summaryData.breakdown.hybrid.count,
            note: 'Mixed payment methods',
        },
    ]

    const activePeriodLabel = PERIOD_OPTIONS.find((o) => o.value === activeTab)?.label ?? activeTab

    return (
        <div className="inv-scope min-h-screen pb-16 antialiased" style={{ background: 'var(--inv-bg)' }}>
            <div className="print:hidden">
                <NavbarAdmin />
            </div>

            <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 pt-6 space-y-6">
                <button type="button" onClick={() => navigate('/admin-dashboard')} className="inv-back cursor-pointer print:hidden">
                    <Icon name="arrowLeft" className="h-4 w-4" />
                    Admin dashboard
                </button>

                <div className="inv-page-header print:hidden">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="inv-page-title">Sales &amp; ledger</h1>
                            <span className="inv-location">
                                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Caloocan Flagship Hub
                            </span>
                        </div>
                        <p className="inv-page-sub">
                            {totalMatchingCount.toLocaleString()} {totalMatchingCount === 1 ? 'order' : 'orders'} · {activePeriodLabel.toLowerCase()}
                        </p>
                    </div>

                    <div className="inv-section-actions">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="refresh"
                            onClick={() => {
                                void fetchSummary()
                                void fetchOrdersPage()
                            }}
                            loading={isLoading}
                        >
                            Refresh
                        </Button>
                        <Button variant="secondary" size="sm" icon="print" onClick={handlePrintAll}>
                            Print
                        </Button>
                        {isAdmin && (
                            <>
                                <Button variant="secondary" size="sm" icon="layers" onClick={() => setIsBackupModalOpen(true)}>
                                    Backups
                                </Button>
                                <Button variant="primary" size="sm" icon="download" onClick={() => setIsExportModalOpen(true)}>
                                    Export PDF
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="print:hidden">
                    <Segmented
                        options={PERIOD_OPTIONS}
                        value={activeTab}
                        onChange={(v) => handleTabChange(v as TabType)}
                        label="Reporting period"
                    />
                </div>

                <div className="inv-stats print:hidden">
                    {statCards.map((card) => (
                        <button
                            key={card.key}
                            type="button"
                            onClick={() => handlePaymentChange(card.key)}
                            aria-pressed={paymentFilter === card.key}
                            className={`inv-stat${paymentFilter === card.key ? ' is-selected' : ''}`}
                        >
                            <div className="inv-stat-top">
                                <span className="inv-stat-label">{card.label}</span>
                                <span className="inv-stat-count">{card.count.toLocaleString()}</span>
                            </div>
                            <span className="inv-stat-value">{peso(card.value)}</span>
                            <span className="inv-stat-note">{card.note}</span>
                        </button>
                    ))}
                </div>

                {/* Cancellations are the other half of the day's money: an order that was paid for
                    and then cancelled is a debt until a named person hands the cash or the
                    transfer back, and that is exactly what the register has to be able to prove. */}
                {summaryData.cancellations.count > 0 && (
                    <Card className="print:hidden">
                        <CardHeader
                            title="Cancellations &amp; money returned"
                            description={`${summaryData.cancellations.count} cancelled ${summaryData.cancellations.count === 1 ? 'order' : 'orders'} ${activePeriodLabel.toLowerCase()} — a paid-for cancellation is only closed once staff have returned the money`}
                        />
                        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-emerald-900">Money returned</span>
                                    <Badge tone="success" dot>
                                        {summaryData.cancellations.refundedCount.toLocaleString()} settled
                                    </Badge>
                                </div>
                                <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-950">
                                    {peso(summaryData.cancellations.refundedAmount)}
                                </div>
                                <p className="mt-0.5 text-[13px] text-emerald-800/80">
                                    Paid back out by the assistant or the cashier, each payout signed and traceable.
                                </p>
                            </div>
                            <div
                                className={`rounded-2xl border p-3.5 ${
                                    summaryData.cancellations.awaitingCount > 0
                                        ? 'border-amber-300 bg-amber-50/70'
                                        : 'border-neutral-200 bg-neutral-50/70'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[13px] font-semibold text-neutral-800">Still owed</span>
                                    <Badge tone={summaryData.cancellations.awaitingCount > 0 ? 'warning' : 'neutral'} dot>
                                        {summaryData.cancellations.awaitingCount.toLocaleString()} waiting
                                    </Badge>
                                </div>
                                <div className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
                                    {peso(summaryData.cancellations.awaitingAmount)}
                                </div>
                                <p className="mt-0.5 text-[13px] text-neutral-500">
                                    {summaryData.cancellations.awaitingCount > 0
                                        ? 'Cancelled but not refunded yet. The stock stays reserved until the money is handed back.'
                                        : 'Every cancelled order in this period has been settled with the customer.'}
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

                <div id="print-area">
                    {/* Print Only Header */}
                    <div className="hidden print:block text-center mb-6">
                        <h1 className="text-2xl font-bold text-slate-900">Seafudz Ng Bayan</h1>
                        <p className="text-sm text-slate-600">Bagong Silang Phase 1, Brgy. 176</p>
                        <p className="text-sm text-slate-600">Open 24/7</p>
                        <p className="text-sm font-semibold text-slate-800 mt-2">SALES SUMMARY AUDIT REPORT</p>
                        <p className="text-xs text-slate-500">
                            Period: {activeTab.toUpperCase()} | Generated: {new Date().toLocaleString()}
                        </p>
                        <div className="border-t border-dashed border-slate-300 my-4"></div>
                    </div>

                    <Card>
                        <CardHeader
                            title="Transaction register"
                            description={`Audited ledger records for ${activePeriodLabel.toLowerCase()}`}
                        />

                        <Toolbar className="print:hidden">
                            <Segmented
                                options={CHANNEL_OPTIONS}
                                value={channelFilter}
                                onChange={handleChannelChange}
                                label="Channel"
                                size="sm"
                            />
                            <Segmented
                                options={PAYMENT_OPTIONS}
                                value={paymentFilter}
                                onChange={handlePaymentChange}
                                label="Payment method"
                                size="sm"
                            />
                            <SearchInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Search order or customer"
                                label="Search transactions"
                                className="sm:ml-auto sm:w-64"
                            />
                        </Toolbar>

                        <div className="inv-table-wrap">
                            <table className="inv-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Order</th>
                                        <th scope="col">Customer</th>
                                        <th scope="col">Items</th>
                                        <th scope="col">Date</th>
                                        <th scope="col">Payment</th>
                                        <th scope="col" className="is-num">Total</th>
                                        <th scope="col">Status</th>
                                        <th scope="col" className="is-actions print:hidden">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8}>
                                                <EmptyState
                                                    compact
                                                    icon="history"
                                                    title={`Loading page ${currentPage}…`}
                                                    description="Fetching audited ledger records."
                                                />
                                            </td>
                                        </tr>
                                    ) : transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8}>
                                                <EmptyState
                                                    icon="doc"
                                                    title="No transactions in this view"
                                                    description={`Nothing matches ${activePeriodLabel.toLowerCase()} with the current channel, payment and search filters.`}
                                                    action={
                                                        (channelFilter !== 'All' || paymentFilter !== 'All' || searchQuery) && (
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => {
                                                                    handleChannelChange('All')
                                                                    handlePaymentChange('All')
                                                                    setSearchQuery('')
                                                                }}
                                                            >
                                                                Clear filters
                                                            </Button>
                                                        )
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((tx) => {
                                            const items = getOrderedItems(tx.items)
                                            const reference = tx.paymentReference || tx.referenceNumber
                                            return (
                                                <tr key={tx.id || tx.ref}>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedTransaction(tx)}
                                                            className="inv-row-link"
                                                            title="View transaction details"
                                                        >
                                                            {tx.ref || tx.id}
                                                        </button>
                                                    </td>
                                                    <td>
                                                        <div className="inv-cell-primary">{tx.customer || '—'}</div>
                                                        <div className="inv-cell-secondary">{humanizeChannel(tx.type)}</div>
                                                    </td>
                                                    <td className="max-w-[22rem]">
                                                        {items.length === 0 ? (
                                                            <span className="inv-cell-secondary">—</span>
                                                        ) : (
                                                            <>
                                                                <div className="inv-cell-primary truncate" title={items.join(', ')}>
                                                                    {items.slice(0, 2).join(', ')}
                                                                </div>
                                                                {items.length > 2 && (
                                                                    <div className="inv-cell-secondary">+{items.length - 2} more</div>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="inv-cell-secondary whitespace-nowrap">{tx.dateTime}</td>
                                                    <td>
                                                        <Badge tone={paymentTone(tx.paymentMethod)} dot>
                                                            {tx.paymentMethod || 'Cash'}
                                                        </Badge>
                                                        {reference && (
                                                            <div className="inv-cell-secondary mt-1 truncate max-w-[9rem]" title={`Ref: ${reference}`}>
                                                                Ref {reference}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="is-num inv-cell-primary">{peso(tx.total)}</td>
                                                    <td>
                                                        <Badge tone={statusTone(tx.status)} dot>
                                                            {statusLabel(tx.status)}
                                                        </Badge>
                                                        {/* A cancelled row says what became of the
                                                            customer's money, not just that it ended. */}
                                                        {isCancelledOrder(tx.status) && tx.refund && tx.refund.state !== 'NONE' && (
                                                            <div className="mt-1">
                                                                {tx.refund.state === 'COMPLETED' ? (
                                                                    <Badge tone="success" title={refundSummaryLine(tx.refund)}>
                                                                        Refunded{refundActorLabel(tx.refund) ? ` · ${refundActorLabel(tx.refund)}` : ''}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge tone="warning" title="The customer has not been paid back yet.">
                                                                        Refund owed {peso(tx.refund.amount)}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="is-actions print:hidden">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {tx.deliveryProof && (
                                                                <IconButton
                                                                    icon="doc"
                                                                    label={`View delivery proof for ${tx.ref || tx.id}`}
                                                                    onClick={() => setPreviewReceiptUrl(tx.deliveryProof || null)}
                                                                />
                                                            )}
                                                            <IconButton
                                                                icon="eye"
                                                                label={`View details for ${tx.ref || tx.id}`}
                                                                onClick={() => setSelectedTransaction(tx)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="print:hidden">
                            <Pagination
                                page={currentPage}
                                pageSize={PAGE_SIZE}
                                total={totalMatchingCount}
                                onChange={setCurrentPage}
                                noun="orders"
                            />
                        </div>
                    </Card>

                    {/* Print Report Footer */}
                    <div className="hidden print:block text-center mt-8 text-sm text-slate-500">
                        <div className="border-t border-dashed border-slate-300 my-4"></div>
                        <p>Thank you for using Seafudz Ng Bayan System</p>
                        <p className="text-xs mt-1">Computer generated audit record</p>
                    </div>
                </div>
            </main>

            {/* Transaction Details Modal */}
            {selectedTransaction && (
                <Modal
                    open
                    onClose={() => setSelectedTransaction(null)}
                    size="lg"
                    title="Transaction details"
                    description={
                        <span className="flex flex-wrap items-center gap-2">
                            <span>Order {selectedTransaction.ref || selectedTransaction.id}</span>
                            <Badge tone={statusTone(selectedTransaction.status)} dot>
                                {statusLabel(selectedTransaction.status)}
                            </Badge>
                        </span>
                    }
                    footer={
                        <Button variant="secondary" onClick={() => setSelectedTransaction(null)}>
                            Close
                        </Button>
                    }
                >
                    <div className="space-y-4">
                            {/* Customer & Delivery Information */}
                            <div className="inv-subpanel p-4 text-xs space-y-3">
                                <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span>Customer & Delivery Details</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Customer Name</span>
                                        <span className="font-bold text-slate-900 mt-0.5 block text-sm">
                                            {selectedTransaction.customer || (selectedTransaction as any).customerName || 'None recorded'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Contact Phone</span>
                                        <span className="font-semibold text-slate-800 mt-0.5 block">
                                            {selectedTransaction.customerPhone || 'None recorded'}
                                        </span>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Delivery / Customer Address</span>
                                        <span className="font-medium text-slate-800 mt-0.5 block leading-relaxed">
                                            {selectedTransaction.customerAddress || (selectedTransaction.type?.toLowerCase().includes('delivery') ? 'No delivery address recorded' : (selectedTransaction.type?.toLowerCase().includes('pick') ? 'Store Pick-Up Counter' : 'In-Store / On-Site'))}
                                        </span>
                                    </div>

                                    {selectedTransaction.riderName && !selectedTransaction.type?.toLowerCase().includes('pick') && (
                                        <div className="sm:col-span-2">
                                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Assigned Delivery Rider</span>
                                            <span className="font-semibold text-slate-800 mt-0.5 block">
                                                {selectedTransaction.riderName}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Transaction Metadata Card */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 text-xs">
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Channel</span>
                                    <span className="font-bold text-slate-800 mt-0.5 block">{selectedTransaction.type}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Payment Method</span>
                                    <span className="font-bold text-slate-800 mt-0.5 block">{selectedTransaction.paymentMethod || 'Cash'}</span>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Date & Time</span>
                                    <span className="font-medium text-slate-700 mt-0.5 block text-[11px]">{selectedTransaction.dateTime}</span>
                                </div>
                            </div>

                            {/* Reference Number for GCash or Hybrid in View Details */}
                            {((selectedTransaction.paymentMethod || '').toLowerCase().includes('gcash') ||
                                (selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid') ||
                                Boolean(selectedTransaction.paymentReference || selectedTransaction.referenceNumber)) && (
                                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 flex flex-col gap-2.5 text-xs shadow-2xs">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                                                    {(selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid')
                                                        ? 'Hybrid Payment Reference'
                                                        : 'GCash Reference Number'}
                                                </span>
                                                {!isEditingRef ? (
                                                    <span className="font-mono font-black text-blue-950 text-xs sm:text-sm tracking-wide block truncate">
                                                        {selectedTransaction.paymentReference || selectedTransaction.referenceNumber || 'None recorded'}
                                                    </span>
                                                ) : null}
                                            </div>
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
                                                        className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                                        title="Copy Reference Number"
                                                    >
                                                        {copiedRef ? (
                                                            <>
                                                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                <span className="text-emerald-700">Copied!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                                                    className="px-2.5 py-1.5 rounded-lg bg-blue-100/80 hover:bg-blue-200/80 border border-blue-300 text-blue-900 font-bold text-[11px] transition-colors cursor-pointer"
                                                >
                                                    {selectedTransaction.paymentReference || selectedTransaction.referenceNumber ? 'Edit' : 'Add Ref #'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditingRef && (
                                        <div className="flex items-center gap-2 pt-1 border-t border-blue-200/80">
                                            <input
                                                type="text"
                                                value={newRefInput}
                                                onChange={(e) => setNewRefInput(e.target.value)}
                                                placeholder="Enter GCash / Hybrid Ref #"
                                                className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-xs font-mono font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSaveInlineRef}
                                                disabled={isSavingRef}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-2xs"
                                            >
                                                {isSavingRef ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingRef(false)}
                                                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cancelled transaction: where the customer's money ended up.
                                A cancellation is not finished when the order is marked cancelled —
                                it is finished when somebody has handed the money back, so this card
                                names that person, the form it went back in, and their proof. */}
                            {isCancelledOrder(selectedTransaction.status) && (() => {
                                const refund = selectedTransaction.refund ?? { state: 'NONE' as const, amount: 0 }
                                const settled = refund.state === 'COMPLETED'
                                const owed = refund.state === 'PENDING'
                                const actor = refundActorLabel(refund)
                                const tone = settled
                                    ? 'border-emerald-200 bg-emerald-50/70'
                                    : owed
                                        ? 'border-amber-300 bg-amber-50/70'
                                        : 'border-neutral-200 bg-neutral-50/70'

                                return (
                                    <div className={`rounded-2xl border p-3.5 space-y-2.5 ${tone}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-neutral-900">Cancelled transaction</span>
                                            <Badge tone={settled ? 'success' : owed ? 'warning' : 'neutral'} dot>
                                                {settled ? 'Money returned' : owed ? 'Money not returned yet' : 'Nothing was owed'}
                                            </Badge>
                                        </div>

                                        <p className="text-[13px] font-medium text-neutral-700">
                                            {refundSummaryLine(refund)}
                                        </p>

                                        {refund.state !== 'NONE' && (
                                            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                                                        {settled ? 'Amount returned' : 'Amount owed'}
                                                    </dt>
                                                    <dd className="font-bold text-neutral-900">{peso(refund.amount)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                                                        Returned as
                                                    </dt>
                                                    <dd className="font-semibold text-neutral-800">{refundMethodLabel(refund)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                                                        Handed back by
                                                    </dt>
                                                    <dd className="font-semibold text-neutral-800">
                                                        {actor || (settled ? 'Not recorded' : 'Nobody yet')}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                                                        {settled ? 'Returned on' : 'Cancelled on'}
                                                    </dt>
                                                    <dd className="font-semibold text-neutral-800">
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
                                            <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                                                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                                                    Refund reference
                                                </span>
                                                <span className="font-mono text-xs font-bold text-neutral-900 break-all">
                                                    {refund.reference}
                                                </span>
                                            </div>
                                        )}

                                        {refund.receipt ? (
                                            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <img
                                                        src={refund.receipt}
                                                        alt="Proof the refund was sent"
                                                        onClick={() => setPreviewReceiptUrl(refund.receipt || null)}
                                                        className="h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-neutral-300 object-cover shadow-2xs transition-opacity hover:opacity-85"
                                                    />
                                                    <div className="min-w-0">
                                                        <span className="block text-xs font-bold text-neutral-900">Refund proof</span>
                                                        <p className="truncate text-[11px] text-neutral-500">
                                                            Screenshot of the money going back to the customer
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setPreviewReceiptUrl(refund.receipt || null)}
                                                >
                                                    View picture
                                                </Button>
                                            </div>
                                        ) : (
                                            refund.state !== 'NONE' && (
                                                <p className="text-[11px] font-medium text-neutral-500">
                                                    {(refund.method || '').toUpperCase() === 'CASH'
                                                        ? 'Cash handed over the counter, so there is no screenshot — the named cashier is the record.'
                                                        : owed
                                                            ? 'No proof yet: nothing has been sent back.'
                                                            : 'No screenshot was attached to this payout.'}
                                                </p>
                                            )
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Payment Proof Receipt Screenshot Card */}
                            {selectedTransaction.paymentReceipt && (
                                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={selectedTransaction.paymentReceipt}
                                            alt="GCash Payment Proof"
                                            onClick={() => setPreviewReceiptUrl(selectedTransaction.paymentReceipt || null)}
                                            className="w-12 h-12 object-cover rounded-xl border border-emerald-300 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-emerald-950">Payment Proof Screenshot</span>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                                                    Attached
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-emerald-700/90 truncate">Customer submitted GCash confirmation screenshot</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewReceiptUrl(selectedTransaction.paymentReceipt || null)}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs shrink-0 transition-colors"
                                    >
                                        View Picture
                                    </button>
                                </div>
                            )}

                            {/* Delivery Proof Photo Card */}
                            {selectedTransaction.deliveryProof && (
                                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={selectedTransaction.deliveryProof}
                                            alt="Proof of Delivery"
                                            onClick={() => setPreviewReceiptUrl(selectedTransaction.deliveryProof || null)}
                                            className="w-12 h-12 object-cover rounded-xl border border-blue-300 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-950">Proof of Delivery Photo</span>
                                                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                                    Verified
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-blue-700/90 truncate">Captured by rider upon order completion</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewReceiptUrl(selectedTransaction.deliveryProof || null)}
                                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-2xs shrink-0 transition-colors"
                                    >
                                        View Picture
                                    </button>
                                </div>
                            )}

                            {/* Ordered Items List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Ordered Items
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium">
                                        {(selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length)} item{((selectedTransaction.itemsList?.length || getOrderedItems(selectedTransaction.items).length) === 1 ? '' : 's')}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {selectedTransaction.itemsList && selectedTransaction.itemsList.length > 0 ? (
                                        selectedTransaction.itemsList.map((item, idx) => (
                                            <div
                                                key={`item-${idx}`}
                                                className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-2.5 text-xs"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-bold text-slate-800 text-sm block truncate">{item.name}</span>
                                                    {item.unit_price !== undefined && (
                                                        <span className="text-[11px] text-slate-500 block mt-0.5">
                                                            ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                                                        Qty: {item.quantity}
                                                    </span>
                                                    {item.subtotal !== undefined && (
                                                        <span className="font-mono font-bold text-slate-900 text-sm min-w-[70px] text-right">
                                                            ₱{Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    )}
                                                </div>
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
                                                    className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-2.5 text-xs"
                                                >
                                                    <span className="font-bold text-slate-800 text-sm">{itemName}</span>
                                                    {quantity && (
                                                        <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                                                            Qty: {quantity}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Financial Summary Breakdown */}
                            <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 space-y-2 text-xs">
                                <div className="flex items-center justify-between text-slate-600">
                                    <span>Items Subtotal</span>
                                    <span className="font-mono font-medium">
                                        ₱{(selectedTransaction.subtotal !== undefined
                                            ? Number(selectedTransaction.subtotal)
                                            : Number(selectedTransaction.total || 0)
                                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-slate-600">
                                    <span>VAT / Tax (12%)</span>
                                    <span className="font-mono font-medium">
                                        ₱{(selectedTransaction.tax !== undefined ? Number(selectedTransaction.tax) : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {(selectedTransaction.deliveryFee !== undefined && Number(selectedTransaction.deliveryFee) > 0) && (
                                    <div className="flex items-center justify-between text-slate-600">
                                        <span>Delivery Fee</span>
                                        <span className="font-mono font-medium">
                                            ₱{Number(selectedTransaction.deliveryFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-orange-200/70 flex items-center justify-between">
                                    <span className="font-bold text-slate-900 text-sm">Order Total</span>
                                    <span className="text-lg font-bold text-orange-600 font-mono">
                                        ₱{Number(selectedTransaction.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {((selectedTransaction.paymentMethod || '').toLowerCase().includes('gcash') ||
                                    (selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid') ||
                                    Boolean(selectedTransaction.paymentReference || selectedTransaction.referenceNumber)) && (
                                    <div className="flex justify-between items-center text-blue-900 pt-2 border-t border-slate-200/80 font-semibold">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <span>
                                                {(selectedTransaction.paymentMethod || '').toLowerCase().includes('hybrid')
                                                    ? 'Hybrid Payment Reference:'
                                                    : 'GCash Reference Number:'}
                                            </span>
                                        </span>
                                        <span className="font-mono font-bold text-blue-950 text-xs">
                                            {selectedTransaction.paymentReference || selectedTransaction.referenceNumber || 'None recorded'}
                                        </span>
                                    </div>
                                )}

                                {selectedTransaction.riderCashReceived !== undefined && selectedTransaction.riderCashReceived !== null && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-emerald-300 bg-emerald-50/70 -mx-4 -mb-4 p-4 rounded-b-2xl space-y-1.5">
                                        <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>Rider Payment Received Upon Delivery:</span>
                                            </span>
                                            <span className="text-sm font-black text-emerald-700 font-mono">
                                                ₱{Number(selectedTransaction.riderCashReceived).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {Number(selectedTransaction.riderCashReceived) > Number(selectedTransaction.total || 0) && (
                                            <div className="flex items-center justify-between text-[11px] text-emerald-800/90 font-semibold pl-5">
                                                <span>Change Given to Customer:</span>
                                                <span className="font-mono text-emerald-950">
                                                    ₱{(Number(selectedTransaction.riderCashReceived) - Number(selectedTransaction.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                        {Number(selectedTransaction.riderCashReceived) < Number(selectedTransaction.total || 0) && (
                                            <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold pl-5">
                                                <span>Short Payment Balance:</span>
                                                <span className="font-mono text-amber-950">
                                                    ₱{(Number(selectedTransaction.total || 0) - Number(selectedTransaction.riderCashReceived)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                </Modal>
            )}

            {/* Proof Screenshot Full View Modal */}
            {previewReceiptUrl && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150"
                    onClick={() => setPreviewReceiptUrl(null)}
                >
                    <div
                        className="relative max-w-xl max-h-[90vh] bg-white rounded-3xl p-4 shadow-2xl flex flex-col items-center gap-3 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {selectedTransaction?.deliveryProof === previewReceiptUrl
                                    ? 'Rider Proof of Delivery Photo'
                                    : 'Transaction Proof Screenshot'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPreviewReceiptUrl(null)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
                            >
                                ✕
                            </button>
                        </div>
                        <img
                            src={previewReceiptUrl}
                            alt="Payment Proof Full"
                            className="max-h-[72vh] w-auto object-contain rounded-2xl border border-slate-200 shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(null)}
                            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
                onCreated={() => {
                    void fetchSummary()
                    void fetchOrdersPage()
                }}
            />

            <AdminEditTransactionModal
                isOpen={Boolean(editingTransaction)}
                transaction={editingTransaction}
                onClose={() => setEditingTransaction(null)}
                onSave={() => {
                    void fetchSummary()
                    void fetchOrdersPage()
                }}
            />

            <AdminBackupModal
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                isAdmin={isAdmin}
                onOpenExcelExport={() => setIsExportModalOpen(true)}
            />

            <AdminExportTransactionsModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                isAdmin={isAdmin}
                defaultPeriod={EXPORT_PERIOD_BY_TAB[activeTab]}
                defaultChannel={EXPORT_CHANNEL_BY_FILTER[channelFilter] ?? 'all'}
            />

            {/* Print Specific CSS Overrides */}
            <style>{`
                @media print {
                    body {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #print-area, #print-area * {
                        visibility: visible !important;
                    }
                    #print-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}</style>
        </div>
    )
}

export default SalesReportAdmin

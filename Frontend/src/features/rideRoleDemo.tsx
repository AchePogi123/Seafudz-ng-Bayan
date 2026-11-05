import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { NavbarRider } from '../components/Navbarrider'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { fetchRoadDistances } from '../utils/locationServices'
import {
  calculateDeliveryFee,
  geocodeAddress,
  METRO_MANILA_LOCATIONS,
  SEAFUDZ_FLAGSHIP_STORE,
  type DeliveryJob,
} from '../utils/riderDispatchAlgorithms'

function compressImageToBase64(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(e.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

const RIDER_START_LOCATION = SEAFUDZ_FLAGSHIP_STORE
const DEMO_ORDER_STATUS_KEY = 'seafudz_rider_demo_order_statuses'
const RIDER_DEMO_ORDERS: DeliveryJob[] = [
  {
    id: 'DEMO-RIDER-001',
    ref: 'DEMO-RIDER-001',
    customer: 'Demo Customer 1',
    phone: '09170000001',
    address: 'Bagong Silang, Caloocan',
    items: [{ name: 'Seafood Cajun Boil', quantity: 1 }],
    total: 799,
    status: 'Ready',
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    paymentMethod: 'COD',
    coord: METRO_MANILA_LOCATIONS['bagong silang'],
  },
  {
    id: 'DEMO-RIDER-001-B',
    ref: 'DEMO-RIDER-001-B',
    customer: 'Demo Customer 1',
    phone: '09170000001',
    address: 'Bagong Silang, Caloocan',
    items: [{ name: 'Butter Garlic Shrimp', quantity: 1 }],
    total: 499,
    status: 'Ready',
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    paymentMethod: 'GCash',
    coord: METRO_MANILA_LOCATIONS['bagong silang'],
  },
  {
    id: 'DEMO-RIDER-002',
    ref: 'DEMO-RIDER-002',
    customer: 'Demo Customer 2',
    phone: '09170000002',
    address: 'Caloocan North, Caloocan',
    items: [{ name: 'Mixed Seafood Bilao', quantity: 1 }],
    total: 1099,
    status: 'Ready',
    createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    paymentMethod: 'GCash',
    coord: METRO_MANILA_LOCATIONS['caloocan north'],
  },
  {
    id: 'DEMO-RIDER-003',
    ref: 'DEMO-RIDER-003',
    customer: 'Demo Customer 3',
    phone: '09170000003',
    address: 'Novaliches Bayan, Quezon City',
    items: [{ name: 'All Shrimp Tray', quantity: 1 }],
    total: 1199,
    status: 'Ready',
    createdAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    paymentMethod: 'COD',
    coord: METRO_MANILA_LOCATIONS.novaliches,
  },
]

export const isCodOrder = (order?: { paymentMethod?: string; [key: string]: any } | null): boolean => {
  if (!order) return false
  const method = String(order.paymentMethod || order.payment_method || '').toUpperCase().trim()
  return method.includes('COD') || method === 'CASH' || method.includes('DELIVERY')
}

export const getPaymentMethodDisplay = (paymentMethod?: string) => {
  const norm = String(paymentMethod || '').toUpperCase().trim()
  if (norm.includes('COD') || norm === 'CASH' || norm.includes('DELIVERY')) {
    return {
      type: 'COD' as const,
      label: 'Cash on Delivery (COD)',
      shortLabel: 'COD',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      pillClass: 'bg-amber-500 text-white',
      tagText: 'Collect Cash',
      icon: '💵',
    }
  }
  return {
    type: 'GCASH' as const,
    label: 'GCash (Paid Online)',
    shortLabel: 'GCash',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    pillClass: 'bg-emerald-600 text-white',
    tagText: 'Paid Online',
    icon: '📱',
  }
}

/**
 * Normalization helpers to identify companion orders placed by the same customer
 * sharing the same delivery address and matching active delivery status.
 */
export const normalizeAddressKey = (addr?: string): string => {
  return (addr || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const normalizeCustomerKey = (name?: string): string => {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export const normalizePhoneKey = (phone?: string): string => {
  return (phone || '').replace(/\D/g, '')
}

export const isOrderCompleted = (status?: string): boolean => {
  const s = String(status || '').toLowerCase().trim()
  return s === 'completed' || s === 'delivered' || s === 'served' || s === 'cancelled'
}

/**
 * Robust parser for order timestamps supporting:
 * - ISO strings (e.g., "2026-11-04T12:25:58.394Z")
 * - PostgreSQL timestamps (e.g., "2026-10-31 17:33:24.227264+00")
 * - Numeric epoch milliseconds or seconds
 * - Time strings without dates (e.g., "08:30 PM", "8:30:15 PM") resolved to current day
 * - 'Just now' resolved to Date.now()
 */
export const parseOrderTimestamp = (val?: string | number | null): number | null => {
  if (!val) return null
  if (typeof val === 'number') return isNaN(val) ? null : val
  const str = String(val).trim()
  if (!str) return null
  if (str.toLowerCase() === 'just now') return Date.now()

  // Epoch numeric string (10 to 13 digits)
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str)
    if (!isNaN(num)) return num < 10000000000 ? num * 1000 : num
  }

  const parsed = Date.parse(str)
  if (!isNaN(parsed)) return parsed

  // Time-only strings like "08:30 PM" or "8:30:15 PM"
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0
    const ampm = timeMatch[4]?.toUpperCase()
    if (ampm === 'PM' && hours < 12) hours += 12
    if (ampm === 'AM' && hours === 12) hours = 0
    const d = new Date()
    d.setHours(hours, minutes, seconds, 0)
    return d.getTime()
  }

  return null
}

export const areOrdersCompanion = (a: DeliveryJob, b: DeliveryJob): boolean => {
  if (a.id === b.id) return true

  const statusA = String(a.status || '').toLowerCase().trim()
  const statusB = String(b.status || '').toLowerCase().trim()

  // CRITICAL SPECIFICATION:
  // 1. Orders will ONLY combine if they both finish in the same time (both are 'ready').
  // 2. If the rider marks the first order as "start delivery" (out for delivery), the last order will remain in queue in rider's list and will NOT combine into the first order.
  // 3. Orders already 'out for delivery' will only stay combined if they were dispatched together on the same trip.
  if (statusA === 'ready' && statusB === 'ready') {
    // Both finished & ready at the store - valid to combine if customer, location, and name match!
  } else if (statusA === 'out for delivery' && statusB === 'out for delivery') {
    // Both are out for delivery - must have been dispatched together on the exact same trip
    if (!a.tripId || !b.tripId || a.tripId !== b.tripId) {
      return false
    }
  } else {
    // Any other combination (e.g., ready vs out for delivery, or preparing) NEVER combines!
    return false
  }

  // Timestamp check: STRICT RULE - Only combine orders placed contemporaneously (within 60 minutes of each other).
  // If either timestamp cannot be resolved, fail-safe to FALSE so historical/unverified orders NEVER combine.
  const timeA = parseOrderTimestamp(a.createdAt)
  const timeB = parseOrderTimestamp(b.createdAt)
  if (timeA === null || timeB === null) {
    return false
  }
  if (Math.abs(timeA - timeB) > 60 * 60 * 1000) {
    return false
  }

  // 1. User ID check (customerId / userId / phone as account identifier)
  const userA = String(a.customerId || a.userId || '').trim().toLowerCase()
  const userB = String(b.customerId || b.userId || '').trim().toLowerCase()
  const phoneA = normalizePhoneKey(a.phone)
  const phoneB = normalizePhoneKey(b.phone)
  const hasMatchingUserId = Boolean(userA && userB && userA === userB)
  const hasMatchingPhone = Boolean(phoneA.length >= 7 && phoneB.length >= 7 && phoneA === phoneB)
  const userMatches = hasMatchingUserId || hasMatchingPhone
  if (!userMatches) return false

  // 2. Location check (delivery address / coordinates)
  const addrA = normalizeAddressKey(a.address)
  const addrB = normalizeAddressKey(b.address)
  if (!addrA || !addrB) return false
  const addrMatches = addrA === addrB || addrA.includes(addrB) || addrB.includes(addrA)
  const coordMatches = Boolean(
    a.coord && b.coord &&
    Number.isFinite(a.coord.lat) && Number.isFinite(b.coord.lat) &&
    Math.abs(a.coord.lat - b.coord.lat) < 0.003 &&
    Math.abs(a.coord.lng - b.coord.lng) < 0.003
  )
  const locationMatches = addrMatches || coordMatches
  if (!locationMatches) return false

  // 3. Name check (customer name)
  const nameA = normalizeCustomerKey(a.customer)
  const nameB = normalizeCustomerKey(b.customer)
  const isGeneric = (n: string) =>
    !n || n === 'onlinecustomer' || n === 'walkin' || n === 'customer' || n === 'guest'
  const nameMatches = Boolean(
    (nameA && nameB && nameA === nameB && !isGeneric(nameA)) ||
    (hasMatchingUserId && isGeneric(nameA) && isGeneric(nameB))
  )
  if (!nameMatches) return false

  return true
}

export interface DeliveryBundle {
  bundleKey: string
  isBundle: boolean
  customer: string
  phone: string
  address: string
  status: string
  roadDistanceKm?: number
  orders: DeliveryJob[]
  totalCombinedAmount: number
  totalDeliveryFee: number
  codAmountToCollect: number
  onlineAmountPrepaid: number
  hasCod: boolean
  hasOnline: boolean
  isMixedPayment: boolean
  latestCreatedAt: string
  primaryOrder: DeliveryJob
  readyCount: number
  preparingCount: number
  allReady: boolean
  hasPreparing: boolean
  deliveryProof?: string
}

export function groupDeliveriesIntoBundles(deliveries: DeliveryJob[]): DeliveryBundle[] {
  const visited = new Set<string>()
  const bundles: DeliveryBundle[] = []

  for (let i = 0; i < deliveries.length; i++) {
    const current = deliveries[i]
    if (visited.has(current.id)) continue

    const group: DeliveryJob[] = [current]
    visited.add(current.id)

    // The ONLY orders that combine are those actively preparing or pending delivery!
    if (!isOrderCompleted(current.status)) {
      for (let j = i + 1; j < deliveries.length; j++) {
        const candidate = deliveries[j]
        if (visited.has(candidate.id)) continue
        if (isOrderCompleted(candidate.status)) continue

        const isCompanion = group.some((member) => areOrdersCompanion(member, candidate))
        if (isCompanion) {
          group.push(candidate)
          visited.add(candidate.id)
        }
      }
    }

    const primary = group[0]
    const isBundle = group.length > 1

    const totalCombinedAmount = group.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const totalDeliveryFee = group.reduce((sum, o) => sum + (Number(o.deliveryFee) || 0), 0)

    let codAmountToCollect = 0
    let onlineAmountPrepaid = 0
    let hasCod = false
    let hasOnline = false

    group.forEach((o) => {
      if (isCodOrder(o)) {
        hasCod = true
        codAmountToCollect += Number(o.total) || 0
      } else {
        hasOnline = true
        onlineAmountPrepaid += Number(o.total) || 0
      }
    })

    const isMixedPayment = hasCod && hasOnline
    const roadDistanceKm = group.find((o) => o.roadDistanceKm !== undefined)?.roadDistanceKm

    let latestTime = 0
    let latestCreatedAtStr = primary.createdAt || ''
    group.forEach((o) => {
      const t = parseOrderTimestamp(o.createdAt || '')
      if (t !== null && t > latestTime) {
        latestTime = t
        latestCreatedAtStr = o.createdAt || ''
      }
    })

    const readyCount = group.filter((o) => String(o.status).toLowerCase() === 'ready').length
    const outForDeliveryCount = group.filter((o) => String(o.status).toLowerCase() === 'out for delivery').length
    const allOutForDelivery = outForDeliveryCount === group.length
    const allReady = readyCount === group.length

    let bundleStatus = primary.status
    if (allOutForDelivery) {
      bundleStatus = 'Out for Delivery'
    } else {
      bundleStatus = 'Ready'
    }
    const hasPreparing = false
    const preparingCount = 0

    const bundleKey = group.map((o) => o.id).sort().join('___')

    bundles.push({
      bundleKey,
      isBundle,
      customer: primary.customer,
      phone: primary.phone,
      address: primary.address,
      status: bundleStatus,
      roadDistanceKm,
      orders: group,
      totalCombinedAmount,
      totalDeliveryFee,
      codAmountToCollect,
      onlineAmountPrepaid,
      hasCod,
      hasOnline,
      isMixedPayment,
      latestCreatedAt: latestCreatedAtStr,
      primaryOrder: primary,
      readyCount,
      preparingCount,
      allReady,
      hasPreparing,
      deliveryProof: group.find((o) => o.deliveryProof)?.deliveryProof,
    })
  }

  return bundles
}

export const RideRoleDemo: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const [rawDeliveries, setRawDeliveries] = useState<DeliveryJob[]>([])
  const [roadMetrics, setRoadMetrics] = useState<Map<string, number>>(() => new Map())
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const [routingUnavailable, setRoutingUnavailable] = useState(false)
  const [customerDetailsOrder, setCustomerDetailsOrder] = useState<DeliveryJob | null>(null)
  const [activeTab, setActiveTab] = useState<'Ready' | 'All' | 'Out for Delivery'>('Ready')
  const [notification, setNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'proximity' | 'newest'>('proximity')
  const [riderReceivedAmount, setRiderReceivedAmount] = useState<string>('')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [deliveryProofImage, setDeliveryProofImage] = useState<string | null>(null)
  const [deliveryProofError, setDeliveryProofError] = useState<string | null>(null)
  const [isProcessingDeliveryProof, setIsProcessingDeliveryProof] = useState<boolean>(false)
  const [previewProofModalUrl, setPreviewProofModalUrl] = useState<string | null>(null)

  useEffect(() => {
    setDeliveryProofImage(null)
    setDeliveryProofError(null)
    setRiderReceivedAmount('')
    setPaymentError(null)
  }, [customerDetailsOrder?.id])

  const riderLocation = RIDER_START_LOCATION

  // Admin CRUD Modal states
  const [editingRiderOrder, setEditingRiderOrder] = useState<any | null>(null)

  const handleDeleteRiderOrder = async (orderId: string) => {
    const isDemoOrder = import.meta.env.DEV && orderId.startsWith('DEMO-RIDER-')
    const confirmDelete = window.confirm(
      isDemoOrder
        ? `Remove demo order ${orderId} from the Rider view?`
        : `Are you sure you want to permanently delete Delivery #${orderId}? This will remove it from the database.`
    )
    if (!confirmDelete) return

    if (isDemoOrder) {
      setHiddenOrderIds((prev) => {
        const next = new Set(prev).add(orderId)
        try {
          localStorage.setItem('seafudz_rider_hidden_orders', JSON.stringify(Array.from(next)))
        } catch {}
        return next
      })
      if (customerDetailsOrder?.id === orderId) setCustomerDetailsOrder(null)
      setNotification(`Demo order ${orderId} removed from Rider view.`)
      return
    }

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

    if (customerDetailsOrder?.id === orderId) setCustomerDetailsOrder(null)
    void fetchDeliveries(true)
    setNotification(`Delivery #${orderId} deleted from DB by Admin.`)
  }

  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('seafudz_rider_hidden_orders')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const ITEMS_PER_PAGE = 6
  const isFetchingRef = useRef(false)
  const lastFetchRef = useRef(0)

  // Fetch live delivery orders from Backend API + LocalStorage
  const fetchDeliveries = useCallback(async (force?: boolean | unknown) => {
    if (isFetchingRef.current) return
    const isForce = typeof force === 'boolean' ? force : false
    const now = Date.now()
    if (!isForce && now - lastFetchRef.current < 2000) return

    isFetchingRef.current = true
    lastFetchRef.current = now

    try {
      const combinedMap = new Map<string, DeliveryJob>()

      let hiddenSet = new Set<string>()
      try {
        const saved = localStorage.getItem('seafudz_rider_hidden_orders')
        if (saved) hiddenSet = new Set(JSON.parse(saved))
      } catch {}

      let printedReceiptsSet = new Set<string>()
      try {
        const savedPrinted = localStorage.getItem('seafudz_printed_receipts')
        if (savedPrinted) printedReceiptsSet = new Set(JSON.parse(savedPrinted))
      } catch {}

      let tripMap: Record<string, string> = {}
      try {
        const savedTrips = localStorage.getItem('seafudz_rider_dispatch_trips')
        if (savedTrips) tripMap = JSON.parse(savedTrips)
      } catch {}

      let realOrdersCount = 0
      const finishedOrderIds = new Set<string>()

      // 1. Read from backend API FIRST (Online Delivery Orders ONLY - Central Truth)
      try {
        const res = await fetch(`${API_BASE_URL}/user-flow/orders`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.data)) {
            realOrdersCount = data.data.length
            data.data.forEach((o: any) => {
              const orderType = (o.order_type || o.type || '').toLowerCase()
              const isPos = Boolean(
                o.isPosOrder ||
                o.is_pos_order ||
                orderType.includes('dine') ||
                orderType.includes('take') ||
                o.customer === 'Walk-In' ||
                String(o.id || o.ref || '').startsWith('POS-')
              )
              if (isPos) return

              const id = o.id
              if (hiddenSet.has(id)) return

              const rawStatus = (o.status || '').toUpperCase()

              // Once an order is completed, delivered, served, or cancelled, record it as finished and exclude from active rider queue
              const finishedStatuses = ['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED', 'REJECTED']
              if (finishedStatuses.includes(rawStatus) || isOrderCompleted(rawStatus)) {
                if (id) finishedOrderIds.add(id)
                if (o.ref) finishedOrderIds.add(o.ref)
                return
              }

              // Age cutoff: Any food order created > 12 hours ago is historical and must never appear as an active delivery job
              const orderTs = parseOrderTimestamp(o.createdAt || o.created_at || o.dateTime)
              if (orderTs !== null && Date.now() - orderTs > 12 * 60 * 60 * 1000) {
                if (id) finishedOrderIds.add(id)
                if (o.ref) finishedOrderIds.add(o.ref)
                return
              }

              // Strict User Flow Requirement: Official restaurant receipt from POS Cashier MUST be printed
              // before the online delivery order reflects on the Rider dispatch queue.
              const isReceiptPrinted = Boolean(
                o.isReceiptPrinted === true ||
                o.is_receipt_printed === true ||
                o.receiptStatus === 'PRINTED' ||
                o.receipt_status === 'PRINTED' ||
                printedReceiptsSet.has(id) ||
                (o.ref && printedReceiptsSet.has(o.ref))
              )
              if (!isReceiptPrinted) return

              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT',
                'AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return

              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') {
                displayStatus = 'Out for Delivery'
              } else if (rawStatus === 'READY') {
                displayStatus = 'Ready'
              } else {
                // Must be marked as finished by kitchen (READY or OUT_FOR_DELIVERY) to appear on Rider board!
                return
              }

              const address = o.address || o.deliveryAddress || 'Monumento, Caloocan'
              const latitude = o.deliveryLatitude ?? o.delivery_latitude
              const longitude = o.deliveryLongitude ?? o.delivery_longitude
              const coord = latitude != null && longitude != null
                && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
                ? { lat: Number(latitude), lng: Number(longitude), label: address }
                : geocodeAddress(address)

              const riderCashRec = o.rider_cash_received != null
                ? Number(o.rider_cash_received)
                : (o.riderCashReceived != null ? Number(o.riderCashReceived) : undefined)

              const resolvedCreatedAt = o.createdAt || o.created_at || (o.dateTime && !isNaN(Date.parse(o.dateTime)) ? o.dateTime : new Date().toISOString())
              const tripId = tripMap[id] || (o.ref ? tripMap[o.ref] : undefined)

              combinedMap.set(id, {
                id,
                ref: id,
                customerId: o.customerId || o.customer_id || o.userId || undefined,
                userId: o.userId || o.customerId || o.customer_id || undefined,
                tripId,
                customer: o.customer || o.customerName || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items: (Array.isArray(o.items) ? o.items : []).filter((i: any) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase())),
                total: o.total || 0,
                deliveryFee: o.deliveryFee == null && o.delivery_fee == null
                  ? undefined
                  : Number(o.deliveryFee ?? o.delivery_fee),
                status: displayStatus,
                createdAt: resolvedCreatedAt,
                paymentMethod: o.paymentMethod || o.payment_method || (typeof o.payment === 'string' ? o.payment : undefined) || 'GCash',
                coord,
                riderCashReceived: riderCashRec,
                deliveryProof: o.deliveryProof || o.delivery_proof || undefined,
              })
            })
          }
        }
      } catch (err) {}

      // 2. Read from shared LocalStorage (overlay for orders not yet in backend API)
      try {
        const local = localStorage.getItem('seafudz_orders')
        if (local) {
          const parsed = JSON.parse(local)
          if (Array.isArray(parsed)) {
            // Sanitize localStorage: Mark any orders completed on backend as COMPLETED so they cannot resurrect
            let hasSanitized = false
            parsed.forEach((item: any) => {
              const iId = item.id || item.ref
              if (iId && finishedOrderIds.has(iId) && !isOrderCompleted(item.status)) {
                item.status = 'COMPLETED'
                hasSanitized = true
              }
            })
            if (hasSanitized) {
              try {
                localStorage.setItem('seafudz_orders', JSON.stringify(parsed))
              } catch {}
            }

            parsed.forEach((o: any) => {
              const orderType = (o.type || o.order_type || '').toLowerCase()
              const isPos = Boolean(
                o.isPosOrder ||
                o.is_pos_order ||
                orderType.includes('dine') ||
                orderType.includes('take') ||
                o.customer === 'Walk-In' ||
                String(o.id || o.ref || '').startsWith('POS-')
              )
              if (isPos) return

              const id = o.id || o.ref
              if (!id || hiddenSet.has(id) || (o.ref && hiddenSet.has(o.ref)) || combinedMap.has(id)) return

              // Strict guard: If backend marked this order as finished/completed/cancelled, skip it!
              if (finishedOrderIds.has(id) || (o.ref && finishedOrderIds.has(o.ref))) return

              // Age cutoff: Any food order created > 12 hours ago is historical and must never appear as an active delivery job
              const orderTs = parseOrderTimestamp(o.createdAt || o.created_at || o.dateTime)
              if (orderTs !== null && Date.now() - orderTs > 12 * 60 * 60 * 1000) {
                return
              }

              // Strict User Flow Requirement: Official restaurant receipt from POS Cashier MUST be printed
              // before the online delivery order reflects on the Rider dispatch queue.
              const isReceiptPrinted = Boolean(
                o.isReceiptPrinted === true ||
                o.is_receipt_printed === true ||
                o.receiptStatus === 'PRINTED' ||
                o.receipt_status === 'PRINTED' ||
                printedReceiptsSet.has(id) ||
                (o.ref && printedReceiptsSet.has(o.ref))
              )
              if (!isReceiptPrinted) return

              const rawStatus = (o.status || '').toUpperCase()
              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT',
                'AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return

              // Once an order is completed, delivered, served, or cancelled, it is gone from the rider side!
              const finishedStatuses = ['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED', 'REJECTED']
              if (finishedStatuses.includes(rawStatus) || isOrderCompleted(rawStatus)) return

              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') {
                displayStatus = 'Out for Delivery'
              } else if (rawStatus === 'READY') {
                displayStatus = 'Ready'
              } else {
                return
              }

              let items: Array<{ name: string; quantity: number }> = []
              if (Array.isArray(o.items) && o.items.length > 0) {
                items = o.items
                  .filter((i: any) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase()))
                  .map((i: any) => ({
                    name: i.name || i.product_name_snapshot || i.item?.name || 'Seafood Dish',
                    quantity: Number(i.quantity || 1),
                  }))
              } else if (Array.isArray(o.cartItems) && o.cartItems.length > 0) {
                items = o.cartItems
                  .filter((ci: any) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(ci.item_status || ci.itemStatus || '').toUpperCase()))
                  .map((ci: any) => ({
                    name: ci.item?.name || ci.name || ci.product_name_snapshot || 'Seafood Dish',
                    quantity: Number(ci.quantity || 1),
                  }))
              } else if (typeof o.items === 'string' && o.items.trim()) {
                items = o.items.split(',').map((part: string) => {
                  const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                  return {
                    name: match ? match[1].trim() : part.trim(),
                    quantity: match ? parseInt(match[2], 10) : 1,
                  }
                })
              }

              const address = o.address || 'Monumento, Caloocan'
              const latitude = o.deliveryLatitude ?? o.delivery_latitude
              const longitude = o.deliveryLongitude ?? o.delivery_longitude
              const coord = latitude != null && longitude != null
                && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
                ? { lat: Number(latitude), lng: Number(longitude), label: address }
                : geocodeAddress(address)

              const riderCashRec = o.rider_cash_received != null
                ? Number(o.rider_cash_received)
                : (o.riderCashReceived != null ? Number(o.riderCashReceived) : undefined)

              const resolvedCreatedAt = o.createdAt || o.created_at || (o.dateTime && !isNaN(Date.parse(o.dateTime)) ? o.dateTime : new Date().toISOString())
              const tripId = tripMap[id] || (o.ref ? tripMap[o.ref] : undefined)

              combinedMap.set(id, {
                id,
                ref: id,
                customerId: o.customerId || o.customer_id || o.userId || undefined,
                userId: o.userId || o.customerId || o.customer_id || undefined,
                tripId,
                customer: o.customer || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items,
                total: Number(o.total || 0),
                deliveryFee: o.deliveryFee == null && o.delivery_fee == null
                  ? undefined
                  : Number(o.deliveryFee ?? o.delivery_fee),
                status: displayStatus,
                createdAt: resolvedCreatedAt,
                paymentMethod: o.paymentMethod || o.payment_method || (typeof o.payment === 'string' ? o.payment : undefined) || 'GCash',
                coord,
                riderCashReceived: riderCashRec,
                deliveryProof: o.deliveryProof || o.delivery_proof || undefined,
              })
            })
          }
        }
      } catch (e) {
        console.warn('Rider LocalStorage note:', e)
      }

      // Only inject mock dev demo fixtures if there are NO real orders anywhere in the system
      if (import.meta.env.DEV && combinedMap.size === 0 && realOrdersCount === 0) {
        let demoStatuses: Record<string, DeliveryJob['status']> = {}
        try {
          demoStatuses = JSON.parse(localStorage.getItem(DEMO_ORDER_STATUS_KEY) || '{}')
        } catch {}
        RIDER_DEMO_ORDERS.forEach((order) => {
          if (!hiddenSet.has(order.id)) {
            combinedMap.set(order.id, { ...order, status: demoStatuses[order.id] || order.status })
          }
        })
      }

      setRawDeliveries(Array.from(combinedMap.values()))
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchDeliveries()

    const unsubscribe = subscribeOrderSync(() => {
      void fetchDeliveries(true)
    })

    const interval = setInterval(() => {
      void fetchDeliveries()
    }, 2000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchDeliveries])

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Hide bundle from UI
  const handleHideBundle = (bundle: DeliveryBundle, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setHiddenOrderIds((prev) => {
      const next = new Set(prev)
      bundle.orders.forEach((o) => {
        next.add(o.id)
        if (o.ref) next.add(o.ref)
      })
      try {
        localStorage.setItem('seafudz_rider_hidden_orders', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    if (customerDetailsOrder && bundle.orders.some((o) => o.id === customerDetailsOrder.id)) {
      setCustomerDetailsOrder(null)
    }
    setNotification(
      bundle.isBundle
        ? `Combined delivery (${bundle.orders.length} orders) removed from Rider view.`
        : `Order ${bundle.primaryOrder.ref} removed from Rider view.`
    )
  }

  // Unified status updater supporting batch updates for bundled companion orders
  const handleUpdateOrdersStatus = async (
    updates: Array<{ orderId: string; newStatus: 'Out for Delivery' | 'Completed'; moneyReceived?: number; deliveryProof?: string }>
  ) => {
    const updateMap = new Map(updates.map((u) => [u.orderId, u]))

    // Handle demo orders
    if (import.meta.env.DEV) {
      try {
        const statuses = JSON.parse(localStorage.getItem(DEMO_ORDER_STATUS_KEY) || '{}')
        updates.forEach((u) => {
          if (u.orderId.startsWith('DEMO-RIDER-')) {
            statuses[u.orderId] = u.newStatus
          }
        })
        localStorage.setItem(DEMO_ORDER_STATUS_KEY, JSON.stringify(statuses))
      } catch {}
    }

    const rawRider = currentUser?.fullname || currentUser?.username
    const riderName = (!rawRider || rawRider === 'Kuya Mark Reyes') ? 'Rider Alex Ramos' : rawRider
    const riderPhone = currentUser?.phone || '0917-888-9999'

    // Update in LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) => {
        const u = updateMap.get(o.id) || updateMap.get(o.ref)
        if (u) {
          const apiStatus = u.newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
          return {
            ...o,
            status: apiStatus,
            riderName,
            riderPhone,
            rider_name: riderName,
            rider_phone: riderPhone,
            riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : o.riderCashReceived,
            rider_cash_received: u.moneyReceived !== undefined ? u.moneyReceived : o.rider_cash_received,
            deliveryProof: u.deliveryProof || o.deliveryProof,
            delivery_proof: u.deliveryProof || o.delivery_proof,
          }
        }
        return o
      })
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        const u = activeObj ? (updateMap.get(activeObj.id) || updateMap.get(activeObj.ref)) : null
        if (u) {
          const apiStatus = u.newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
          localStorage.setItem(
            'seafudz_active_online_order',
            JSON.stringify({
              ...activeObj,
              status: apiStatus,
              riderName,
              riderPhone,
              rider_name: riderName,
              rider_phone: riderPhone,
              riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : activeObj.riderCashReceived,
              deliveryProof: u.deliveryProof || activeObj.deliveryProof,
              delivery_proof: u.deliveryProof || activeObj.delivery_proof,
            })
          )
        }
      }

      // Also scan and sync all customer-scoped keys in LocalStorage (seafudz_orders_* and seafudz_active_online_order_*)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('seafudz_orders_') || key.startsWith('seafudz_active_online_order_'))) {
          try {
            const raw = localStorage.getItem(key)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
              let changed = false
              const updatedList = parsed.map((o: any) => {
                const u = updateMap.get(o.id) || updateMap.get(o.ref)
                if (u) {
                  changed = true
                  const apiStatus = u.newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
                  return {
                    ...o,
                    status: apiStatus,
                    riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : o.riderCashReceived,
                    rider_cash_received: u.moneyReceived !== undefined ? u.moneyReceived : o.rider_cash_received,
                    deliveryProof: u.deliveryProof || o.deliveryProof,
                    delivery_proof: u.deliveryProof || o.delivery_proof,
                  }
                }
                return o
              })
              if (changed) localStorage.setItem(key, JSON.stringify(updatedList))
            } else if (parsed && typeof parsed === 'object') {
              const u = updateMap.get(parsed.id) || updateMap.get(parsed.ref)
              if (u) {
                const apiStatus = u.newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
                localStorage.setItem(key, JSON.stringify({
                  ...parsed,
                  status: apiStatus,
                  riderName,
                  riderPhone,
                  rider_name: riderName,
                  rider_phone: riderPhone,
                  riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : parsed.riderCashReceived,
                  rider_cash_received: u.moneyReceived !== undefined ? u.moneyReceived : parsed.rider_cash_received,
                  deliveryProof: u.deliveryProof || parsed.deliveryProof,
                  delivery_proof: u.deliveryProof || parsed.delivery_proof,
                }))
              }
            }
          } catch {}
        }
      }

      notifyOrderSync()
      window.dispatchEvent(new Event('storage'))
    } catch {}

    // Update in Backend API in parallel
    await Promise.all(
      updates.map(async (u) => {
        const apiStatus = u.newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'
        try {
          await fetch(`${API_BASE_URL}/user-flow/orders/${u.orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: apiStatus,
              riderCashReceived: u.moneyReceived,
              deliveryProof: u.deliveryProof,
              delivery_proof: u.deliveryProof,
              proofOfDelivery: u.deliveryProof,
              riderName,
              riderPhone,
              riderId: currentUser?.id || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            }),
          })
        } catch {}
      })
    )

    // Update state: completed orders are immediately cleared from rider view
    setRawDeliveries((prev) =>
      prev
        .filter((d) => {
          const u = updateMap.get(d.id) || updateMap.get(d.ref)
          if (u && isOrderCompleted(u.newStatus)) return false
          return !isOrderCompleted(d.status)
        })
        .map((d) => {
          const u = updateMap.get(d.id) || updateMap.get(d.ref)
          if (u) {
            return {
              ...d,
              status: u.newStatus,
              riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : d.riderCashReceived,
              deliveryProof: u.deliveryProof || d.deliveryProof,
            }
          }
          return d
        })
    )

    // Update active modal selected order if it was modified
    setCustomerDetailsOrder((prev) => {
      if (!prev) return null
      const u = updateMap.get(prev.id) || updateMap.get(prev.ref)
      if (u) {
        return {
          ...prev,
          status: u.newStatus,
          riderCashReceived: u.moneyReceived !== undefined ? u.moneyReceived : prev.riderCashReceived,
        }
      }
      return prev
    })
  }


  // Handle bundle start delivery
  const handleStartBundleDelivery = async (bundle: DeliveryBundle) => {
    setPaymentError(null)
    const tripId = `TRIP-${bundle.bundleKey}-${Date.now()}`
    try {
      const savedTrips = JSON.parse(localStorage.getItem('seafudz_rider_dispatch_trips') || '{}')
      bundle.orders.forEach((o) => {
        savedTrips[o.id] = tripId
        if (o.ref) savedTrips[o.ref] = tripId
      })
      localStorage.setItem('seafudz_rider_dispatch_trips', JSON.stringify(savedTrips))
    } catch {}

    const updates = bundle.orders.map((o) => ({
      orderId: o.id,
      newStatus: 'Out for Delivery' as const,
    }))
    await handleUpdateOrdersStatus(updates)
    setNotification(
      bundle.isBundle
        ? `Started combined delivery for ${bundle.orders.length} orders to ${bundle.customer}!`
        : `Started delivery for order #${bundle.primaryOrder.ref}!`
    )
  }

  // Handle dispatching only the packages that are currently Ready (when some are still cooking)
  const handleStartReadyPackagesOnly = async (bundle: DeliveryBundle) => {
    setPaymentError(null)
    const readyOrders = bundle.orders.filter((o) => String(o.status).toLowerCase() === 'ready')
    if (readyOrders.length === 0) return

    const updates = readyOrders.map((o) => ({
      orderId: o.id,
      newStatus: 'Out for Delivery' as const,
    }))
    await handleUpdateOrdersStatus(updates)
    setNotification(
      `Dispatched ${readyOrders.length} ready package(s) for ${bundle.customer}. Remaining cooking order(s) will be delivered once finished.`
    )
  }

  // Handle bundle complete delivery
  const handleCompleteBundleDelivery = async (bundle: DeliveryBundle) => {
    if (!deliveryProofImage) {
      setDeliveryProofError('Proof of delivery photo is required. Please capture or upload a photo showing the delivered items to complete delivery.')
      return
    }

    if (bundle.hasCod) {
      if (!riderReceivedAmount.trim() || isNaN(parseFloat(riderReceivedAmount))) {
        setPaymentError(`Please enter the COD cash amount received (or tap "Exact ₱${bundle.codAmountToCollect.toFixed(2)}").`)
        return
      }
      const parsed = parseFloat(riderReceivedAmount)
      if (parsed < 0) {
        setPaymentError('Payment amount cannot be negative.')
        return
      }
      if (parsed < bundle.codAmountToCollect) {
        setPaymentError(`Cash received (₱${parsed.toFixed(2)}) is less than total COD due (₱${bundle.codAmountToCollect.toFixed(2)}).`)
        return
      }
    }

    setPaymentError(null)
    setDeliveryProofError(null)
    const parsedReceived = bundle.hasCod ? parseFloat(riderReceivedAmount) : 0

    const codOrders = bundle.orders.filter((o) => isCodOrder(o))
    const updates = bundle.orders.map((order) => {
      if (isCodOrder(order)) {
        let allocated = parsedReceived
        if (codOrders.length > 1) {
          const ratio = order.total / (bundle.codAmountToCollect || 1)
          allocated = Math.round(parsedReceived * ratio * 100) / 100
        }
        return {
          orderId: order.id,
          newStatus: 'Completed' as const,
          moneyReceived: allocated,
          deliveryProof: deliveryProofImage,
        }
      }
      return {
        orderId: order.id,
        newStatus: 'Completed' as const,
        moneyReceived: 0,
        deliveryProof: deliveryProofImage,
      }
    })

    await handleUpdateOrdersStatus(updates)
    setDeliveryProofImage(null)
    setDeliveryProofError(null)
    try {
      const savedTrips = JSON.parse(localStorage.getItem('seafudz_rider_dispatch_trips') || '{}')
      bundle.orders.forEach((o) => {
        delete savedTrips[o.id]
        if (o.ref) delete savedTrips[o.ref]
      })
      localStorage.setItem('seafudz_rider_dispatch_trips', JSON.stringify(savedTrips))
    } catch {}
    // Close modal once order is delivered so it is cleared from rider's view
    setCustomerDetailsOrder(null)
    setNotification(
      bundle.isBundle
        ? `All ${bundle.orders.length} orders delivered to ${bundle.customer}! Delivery proof recorded.`
        : `Order #${bundle.primaryOrder.ref} delivered with proof photo!`
    )
  }

  const routeTargets = useMemo(
    () => rawDeliveries.map((delivery) => ({
      id: delivery.id,
      coord: delivery.coord || geocodeAddress(delivery.address),
    })),
    [rawDeliveries]
  )
  const routeQueryKey = JSON.stringify(routeTargets)

  useEffect(() => {
    const targets = JSON.parse(routeQueryKey) as Array<{ id: string; coord: DeliveryJob['coord'] }>
    const controller = new AbortController()
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null
        setRoadMetrics(new Map())
        setIsLoadingRoutes(targets.length > 0)
        return fetchRoadDistances(riderLocation, targets, controller.signal)
      })
      .then((distances) => {
        if (!distances || controller.signal.aborted) return
        setRoadMetrics(distances)
        setIsLoadingRoutes(false)
        setRoutingUnavailable(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.warn('Road distance lookup unavailable.', error)
        setIsLoadingRoutes(false)
        setRoutingUnavailable(true)
      })

    return () => controller.abort()
  }, [routeQueryKey, riderLocation])

  const pricedDeliveries = useMemo<DeliveryJob[]>(() => {
    return rawDeliveries.map((d) => {
      const coord = d.coord || geocodeAddress(d.address)
      const roadDistanceKm = roadMetrics.get(d.id)
      return {
        ...d,
        coord,
        roadDistanceKm,
        deliveryFee: d.deliveryFee ?? (roadDistanceKm === undefined
          ? 50
          : calculateDeliveryFee(roadDistanceKm)),
      }
    })
  }, [rawDeliveries, roadMetrics])

  // Group deliveries into bundles sharing customer + address + active status
  const bundledDeliveries = useMemo<DeliveryBundle[]>(() => {
    return groupDeliveriesIntoBundles(pricedDeliveries)
  }, [pricedDeliveries])

  // Filter & sort bundled deliveries
  const filteredBundles = useMemo(() => {
    const list = bundledDeliveries.filter((b) => {
      // Check if all orders in this bundle are hidden
      const allHidden = b.orders.every((o) => hiddenOrderIds.has(o.id) || hiddenOrderIds.has(o.ref))
      if (allHidden) return false

      const matchesTab = (() => {
        if (activeTab === 'All') {
          // "All" tab represents all active deliveries (Ready and Out for Delivery).
          // Once an order is completed, it is gone from the active rider board!
          return !isOrderCompleted(b.status)
        }
        if (activeTab === 'Ready') {
          return b.status.toLowerCase() === 'ready' || (b.isBundle && b.readyCount > 0)
        }
        if (activeTab === 'Out for Delivery') {
          return b.status.toLowerCase() === 'out for delivery'
        }
        if (activeTab === 'Completed') {
          return isOrderCompleted(b.status)
        }
        return false
      })()
      if (!matchesTab) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        b.customer.toLowerCase().includes(q) ||
        b.phone.toLowerCase().includes(q) ||
        b.address.toLowerCase().includes(q) ||
        b.orders.some(
          (o) =>
            (o.ref || '').toLowerCase().includes(q) ||
            (o.id || '').toLowerCase().includes(q) ||
            (o.paymentMethod || '').toLowerCase().includes(q) ||
            o.items.some((item) => item.name.toLowerCase().includes(q))
        )
      )
    })

    if (sortBy === 'proximity') {
      return list.sort((a, b) => (a.roadDistanceKm ?? Infinity) - (b.roadDistanceKm ?? Infinity))
    }
    return list.sort((a, b) => {
      const aTime = parseOrderTimestamp(a.latestCreatedAt || '') ?? 0
      const bTime = parseOrderTimestamp(b.latestCreatedAt || '') ?? 0
      return bTime - aTime
    })
  }, [bundledDeliveries, activeTab, searchQuery, hiddenOrderIds, sortBy])

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredBundles.length / ITEMS_PER_PAGE))
  const paginatedBundles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredBundles.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredBundles, currentPage, ITEMS_PER_PAGE])

  // Keep selected bundle in sync with updated metrics
  const activeBundle = useMemo<DeliveryBundle | null>(() => {
    if (!customerDetailsOrder) return null
    return (
      bundledDeliveries.find((b) =>
        b.orders.some((o) => o.id === customerDetailsOrder.id || o.ref === customerDetailsOrder.ref)
      ) || null
    )
  }, [customerDetailsOrder, bundledDeliveries])

  useEffect(() => {
    if (activeBundle?.hasCod) {
      const codOrderWithMoney = activeBundle.orders.find(
        (o) => isCodOrder(o) && o.riderCashReceived != null
      )
      if (codOrderWithMoney?.riderCashReceived != null) {
        setRiderReceivedAmount(String(codOrderWithMoney.riderCashReceived))
      } else {
        setRiderReceivedAmount('')
      }
    } else {
      setRiderReceivedAmount('')
    }
    setPaymentError(null)
  }, [activeBundle?.bundleKey, activeBundle?.status])

  return (
    <div className="min-h-screen bg-[#f8f6f4] p-3 sm:p-4 lg:p-4 text-neutral-900 font-sans pb-24 lg:pb-6">
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Standard Project Navigation Bar */}
        <NavbarRider />

        {notification && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm font-bold shadow-xs">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-emerald-500 font-extrabold cursor-pointer">×</button>
          </div>
        )}

        {/* Fixed delivery origin and delivery distance controls */}
        <div className="bg-white border border-neutral-200 p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-extrabold text-neutral-700">Delivery Origin: Barangay 176, Bagong Silang, Caloocan</span>

            <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">
              ({riderLocation.lat.toFixed(4)}, {riderLocation.lng.toFixed(4)})
            </span>
            {routingUnavailable && (
              <span role="status" className="text-amber-700">
                Road distance unavailable; stored or base fees are shown.
              </span>
            )}
            {isLoadingRoutes && (
              <span role="status" className="text-neutral-500">
                Calculating delivery distances…
              </span>
            )}
            <span className="text-[11px] text-neutral-400">₱50 under 3.9 km; ₱100 from 3.9 to 8 km</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-500">Sort By:</span>
            <button
              onClick={() => setSortBy('proximity')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                sortBy === 'proximity'
                  ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-2xs'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Nearest by Road Distance
            </button>
            <button
              onClick={() => setSortBy('newest')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                sortBy === 'newest'
                  ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-2xs'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Newest First
            </button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 items-start">
          <div className="flex flex-col gap-4">
            {/* Search and Tabs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-2xs overflow-x-auto">
                {(['Ready', 'All', 'Out for Delivery'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      activeTab === tab
                        ? 'bg-[#ff7b00] text-white shadow-xs'
                        : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{tab} Orders</span>
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 min-w-[240px]">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search customer, ref, address..."
                    className="w-full pl-9 pr-8 py-2.5 bg-white rounded-2xl border border-neutral-200 text-xs font-semibold focus:outline-none focus:border-orange-500 shadow-2xs transition-all placeholder:text-neutral-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 font-bold text-xs cursor-pointer"
                      aria-label="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid of Delivery Cards (Bundled & Single) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedBundles.length === 0 ? (
                <div className="col-span-2 bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                  <h3 className="font-bold text-neutral-700">No delivery orders found.</h3>
                  <p className="text-xs mt-1">
                    {searchQuery ? `No results matching "${searchQuery}"` : 'Orders dispatched by Assistant will show up here live.'}
                  </p>
                </div>
              ) : (
                paginatedBundles.map((bundle) => {
                  if (bundle.isBundle) {
                    // Render Unified Bundled Delivery Card (Multiple Orders for Same Customer)
                    return (
                      <div
                        key={bundle.bundleKey}
                        onClick={() => setCustomerDetailsOrder(bundle.primaryOrder)}
                        className="bg-gradient-to-br from-white via-white to-orange-50/30 rounded-3xl p-5 border-2 border-orange-300 transition-all shadow-sm hover:shadow-md hover:border-orange-400 cursor-pointer relative"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-orange-100 pb-3">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white shadow-2xs">
                                <span>📦</span>
                                <span>COMBINED DELIVERY ({bundle.orders.length} ORDERS)</span>
                              </span>
                              {bundle.isMixedPayment ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200">
                                  <span>🔀</span>
                                  <span>Mixed (GCash + COD)</span>
                                </span>
                              ) : bundle.hasCod ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  <span>💵</span>
                                  <span>COD ({bundle.orders.length} Orders)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span>📱</span>
                                  <span>GCash Paid Online</span>
                                </span>
                              )}
                            </div>
                            <h4 className="text-base font-black leading-tight mt-1.5 text-neutral-900">{bundle.customer}</h4>
                            <p className="text-xs text-neutral-500 mt-0.5">Phone: {bundle.phone}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                bundle.status === 'Ready'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : bundle.status === 'Out for Delivery'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : bundle.hasPreparing && bundle.readyCount > 0
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              ● {bundle.hasPreparing && bundle.readyCount > 0
                                ? `${bundle.readyCount} Ready • ${bundle.preparingCount} Cooking`
                                : bundle.status}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleHideBundle(bundle, e)}
                              title="Remove bundle from Rider UI"
                              className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Distance & Combined Delivery Fee */}
                        <div className="pt-2.5 pb-1 flex items-center justify-between text-xs">
                          <div className="inline-flex items-center gap-1.5 bg-orange-100/70 border border-orange-200 text-orange-900 font-extrabold px-2.5 py-1 rounded-lg text-[11px]">
                            <span>{bundle.roadDistanceKm === undefined ? 'Distance unavailable' : `${bundle.roadDistanceKm.toFixed(1)} km`}</span>
                            <span className="text-orange-300">•</span>
                            <span>
                              Combined Delivery Fee ₱{bundle.totalDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({bundle.orders.length}× separate orders)
                            </span>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="py-1 text-xs text-neutral-600">
                          <p className="truncate font-medium text-neutral-700">📍 {bundle.address}</p>
                        </div>

                        {/* Mini breakdown of companion packages */}
                        <div className="mt-1 mb-2 space-y-1.5 bg-white/70 p-2.5 rounded-2xl border border-orange-100">
                          {bundle.orders.map((ord, idx) => {
                            const ordIsCod = isCodOrder(ord)
                            return (
                              <div key={ord.id} className="flex items-center justify-between text-xs border-b border-neutral-100 last:border-b-0 pb-1 last:pb-0">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-[10px] font-black text-orange-600">#{idx + 1}</span>
                                  <span className="font-mono text-[10px] font-bold text-neutral-500 truncate max-w-[100px]">{ord.ref}</span>
                                  <span className="text-neutral-300">•</span>
                                  <span className="text-neutral-700 truncate max-w-[140px]">
                                    {ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                    ord.status === 'Ready'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : ord.status === 'Out for Delivery'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}>
                                    {ord.status === 'Ready' ? '✓ Ready' : ord.status === 'Out for Delivery' ? '🛵 Transit' : '🔥 Cooking'}
                                  </span>
                                  <span className="font-bold text-neutral-800 text-[11px]">₱{ord.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ordIsCod ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                    {ordIsCod ? 'COD' : 'GCash'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Footer Totals */}
                        <div className="flex items-center justify-between border-t border-orange-100 pt-2.5 text-xs font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-[#ff7b00] text-sm font-black">
                              ₱{bundle.totalCombinedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total
                            </span>
                            {bundle.isMixedPayment ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black">
                                Collect ₱{bundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} COD (1 Online, 1 COD)
                              </span>
                            ) : bundle.hasCod ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black">
                                Collect ₱{bundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cash
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                Prepaid Online (₱0 Cash)
                              </span>
                            )}
                          </div>
                          <span className="text-neutral-400 font-medium text-[11px]">{bundle.latestCreatedAt}</span>
                        </div>
                      </div>
                    )
                  }

                  // Render Single Delivery Card
                  const ord = bundle.primaryOrder
                  const isCod = isCodOrder(ord)
                  const payInfo = getPaymentMethodDisplay(ord.paymentMethod)
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setCustomerDetailsOrder(ord)}
                      className="bg-white rounded-3xl p-5 border border-neutral-200 transition-all shadow-xs hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Ref: {ord.ref}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${payInfo.badgeClass}`}>
                              <span>{payInfo.icon}</span>
                              <span>{payInfo.shortLabel}</span>
                            </span>
                          </div>
                          <h4 className="text-base font-black leading-tight mt-1 text-neutral-800">{ord.customer}</h4>
                          <p className="text-xs text-neutral-500 mt-0.5">Phone: {ord.phone}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              ord.status === 'Ready'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : ord.status === 'Out for Delivery'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            ● {ord.status}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleHideBundle(bundle, e)}
                            title="Remove from Rider UI"
                            className="p-1 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Delivery distance and fee */}
                      <div className="pt-2.5 pb-1 flex items-center justify-between text-xs">
                        <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 font-extrabold px-2.5 py-1 rounded-lg text-[11px]">
                          <span>{ord.roadDistanceKm === undefined ? 'Distance unavailable' : `${ord.roadDistanceKm.toFixed(1)} km`}</span>
                          <span className="text-orange-300">•</span>
                          <span>
                            {ord.deliveryFee === null
                              ? 'Outside 8 km delivery limit'
                              : `Delivery fee ₱${ord.deliveryFee?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                        </div>
                      </div>

                      <div className="py-2 text-xs text-neutral-600 space-y-1">
                        <p className="truncate"><span className="font-medium text-neutral-700">📍 {ord.address}</span></p>
                        <p className="truncate"><span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          {isCod ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold">
                              Collect Cash
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold">
                              Paid Online
                            </span>
                          )}
                        </div>
                        <span className="text-neutral-400 font-medium text-[11px]">{ord.createdAt}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredBundles.length > ITEMS_PER_PAGE && (
              <div className="bg-white px-5 py-3.5 rounded-2xl border border-neutral-200 shadow-2xs flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500">
                  Page <span className="text-neutral-900 font-black">{currentPage}</span> of{' '}
                  <span className="text-neutral-900 font-black">{totalPages}</span> ({filteredBundles.length} deliveries
                  {filteredBundles.some((b) => b.isBundle) ? ` • ${filteredBundles.reduce((acc, b) => acc + b.orders.length, 0)} total customer packages` : ''})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#ff7b00] hover:bg-[#e66f00] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL (Bundled & Single Deliveries) */}
      {activeBundle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCustomerDetailsOrder(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rider-customer-details-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-neutral-100 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeBundle.isBundle && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white shadow-2xs">
                      <span>📦</span> BUNDLED DELIVERY ({activeBundle.orders.length} ORDERS)
                    </span>
                  )}
                  {activeBundle.isMixedPayment && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                      <span>🔀</span> Split Payment (GCash + COD)
                    </span>
                  )}
                </div>
                <h2 id="rider-customer-details-title" className="text-lg font-black text-neutral-900 mt-1">
                  {activeBundle.customer}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {activeBundle.isBundle
                    ? `Combined transit for ${activeBundle.orders.length} orders to single destination`
                    : `Order ${activeBundle.primaryOrder.ref}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerDetailsOrder(null)}
                className="rounded-lg px-2 py-1 text-sm font-bold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 cursor-pointer"
                aria-label="Close customer details"
              >
                Close
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              {/* Customer Info */}
              <div>
                <p className="text-xs font-bold uppercase text-neutral-400">Phone</p>
                <p className="mt-0.5 text-neutral-800 font-semibold">{activeBundle.phone}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-neutral-400">Delivery Address</p>
                <p className="mt-0.5 text-neutral-800">{activeBundle.address}</p>
              </div>

              {/* Status and Overall Payment Mode */}
              <div className="flex items-center justify-between border-y border-neutral-100 py-2.5">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-400">Delivery Status</p>
                  <p className="mt-0.5 font-bold text-neutral-800">{activeBundle.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold uppercase text-neutral-400">Payment Summary</p>
                  <div className="mt-0.5 flex items-center gap-1.5 justify-end">
                    {activeBundle.isMixedPayment ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-800 border border-purple-200">
                        <span>🔀</span>
                        <span>Mixed (GCash + COD)</span>
                      </span>
                    ) : activeBundle.hasCod ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                        <span>💵</span>
                        <span>Cash on Delivery</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span>📱</span>
                        <span>Paid Online via GCash</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Road distance and Delivery Fee breakdown */}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-orange-50 p-3">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Road Distance</p>
                  <p className="mt-0.5 font-bold text-neutral-900">
                    {activeBundle.roadDistanceKm === undefined ? 'Unavailable' : `${activeBundle.roadDistanceKm.toFixed(1)} km`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Total Rider Delivery Fee</p>
                  <p className="mt-0.5 font-bold text-orange-700">
                    ₱{activeBundle.totalDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {activeBundle.isBundle && (
                    <span className="text-[10px] text-orange-600 block font-semibold">
                      ({activeBundle.orders.length} separate orders × ₱50.00 each)
                    </span>
                  )}
                </div>
              </div>

              {/* Itemized Packages Breakdown */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase text-neutral-500 tracking-wider">
                  {activeBundle.isBundle ? `Bundled Packages to Deliver (${activeBundle.orders.length} Orders)` : 'Order Items'}
                </p>
                {activeBundle.orders.map((ord, idx) => {
                  const ordIsCod = isCodOrder(ord)
                  const ordPayInfo = getPaymentMethodDisplay(ord.paymentMethod)
                  return (
                    <div key={ord.id} className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-neutral-200/60 pb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-orange-600 uppercase">Package #{idx + 1}</span>
                            <span className="text-[10px] font-mono font-bold text-neutral-500">{ord.ref}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              ord.status === 'Ready'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : ord.status === 'Out for Delivery'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            ● {ord.status === 'Ready' ? 'Ready for Pickup' : ord.status === 'Out for Delivery' ? 'In Transit' : 'Cooking in Kitchen'}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${ordPayInfo.badgeClass}`}>
                            <span>{ordPayInfo.icon}</span>
                            <span>{ordPayInfo.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <ul className="space-y-1 text-xs text-neutral-800">
                        {ord.items.map((item, itemIdx) => (
                          <li key={`${item.name}-${itemIdx}`} className="flex justify-between">
                            <span>{item.name}</span>
                            <span className="font-semibold">x{item.quantity}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Subtotal and Cash Rule */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/60 text-xs">
                        <span className="font-semibold">
                          {ordIsCod ? (
                            <span className="text-amber-800 font-bold flex items-center gap-1">
                              <span>💵</span> Cash to collect: ₱{ord.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <span>📱</span> Paid via GCash (₱0.00 cash to collect)
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-neutral-800">
                          ₱{ord.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Admin CRUD options for individual order */}
                      {isAdmin && !ord.id.startsWith('DEMO-RIDER-') && (
                        <div className="flex gap-2 pt-1 border-t border-neutral-200/60">
                          <button
                            type="button"
                            onClick={() => setEditingRiderOrder(ord)}
                            className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1 cursor-pointer"
                          >
                            Edit Package #{idx + 1}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRiderOrder(ord.id)}
                            className="text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-2.5 py-1 cursor-pointer"
                          >
                            Delete Package #{idx + 1}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Combined Financial Summary Box */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 space-y-2 shadow-xs">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-600 font-medium">Combined Orders Value:</span>
                  <span className="font-mono font-bold text-neutral-800">
                    ₱{activeBundle.totalCombinedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-600 font-medium">Total Delivery Fees Included:</span>
                  <span className="font-mono text-neutral-700">
                    ₱{activeBundle.totalDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {activeBundle.isMixedPayment && (
                  <>
                    <div className="flex justify-between items-center text-xs text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-xl">
                      <span className="font-bold">Prepaid Online (GCash):</span>
                      <span className="font-mono font-bold">
                        ₱{activeBundle.onlineAmountPrepaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-xl">
                      <span className="font-bold">Cash on Delivery (COD Due):</span>
                      <span className="font-mono font-bold">
                        ₱{activeBundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-800">Total Cash to Collect</p>
                    <p className="text-[10px] text-neutral-500">
                      {activeBundle.hasCod
                        ? activeBundle.isMixedPayment
                          ? 'Collect ONLY the COD portion upon handover.'
                          : 'Collect cash upon arrival.'
                        : 'Fully paid online (₱0.00 cash).'}
                    </p>
                  </div>
                  <span className={`font-mono font-black text-base ${activeBundle.hasCod ? 'text-[#ff7b00]' : 'text-emerald-700'}`}>
                    ₱{activeBundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Ready status note & actions: Rider has not started delivery yet */}
              {activeBundle.status === 'Ready' && (
                <div className="space-y-3 pt-1">
                  <div
                    className={`rounded-xl border p-3 text-xs flex items-center gap-2.5 ${
                      activeBundle.hasCod
                        ? 'border-amber-200 bg-amber-50/80 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 shrink-0 ${activeBundle.hasCod ? 'text-amber-600' : 'text-emerald-600'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {activeBundle.isBundle
                        ? `All ${activeBundle.orders.length} orders for ${activeBundle.customer} are prepared and packed at the store. Tap Start Delivery to begin combined transit.`
                        : `This order is ready for pickup at the store. Click Start Delivery to begin transit.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartBundleDelivery(activeBundle)}
                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>
                      Start Delivery {activeBundle.isBundle ? `(${activeBundle.orders.length} Orders Combined)` : ''}
                    </span>
                  </button>
                </div>
              )}

              {/* Preparing status: Either cooking in kitchen, or partially ready */}
              {activeBundle.status === 'Preparing' && (
                <div className="space-y-3 pt-1">
                  {activeBundle.readyCount > 0 ? (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-start gap-2.5">
                        <span className="text-base shrink-0">🍳</span>
                        <div>
                          <p className="font-bold text-amber-900">
                            Partial Ready ({activeBundle.readyCount} of {activeBundle.orders.length} Packages Ready)
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                            {activeBundle.readyCount} package is packed and ready for pickup at the counter, while {activeBundle.preparingCount} package is still cooking in the kitchen. You can wait for the kitchen to finish so both packages travel together, or dispatch the ready package now.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleStartReadyPackagesOnly(activeBundle)}
                        className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>
                          Dispatch Ready Package Only ({activeBundle.readyCount} Ready)
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-xs text-neutral-600 flex items-center gap-2.5">
                      <span className="text-lg shrink-0">⏳</span>
                      <span>The kitchen is currently cooking this customer's order. Once marked Ready by the kitchen, you can start delivery.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Out for Delivery status: Item is in transit / being delivered */}
              {activeBundle.status === 'Out for Delivery' && (
                <div className="space-y-3 pt-1">
                  {activeBundle.hasCod ? (
                    <>
                      {/* Mixed / COD Payment Instructions */}
                      <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 flex items-center gap-2.5">
                        <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>
                          {activeBundle.isMixedPayment
                            ? `Package is in transit. Hand over all ${activeBundle.orders.length} packages to ${activeBundle.customer}. Collect ₱${activeBundle.codAmountToCollect.toFixed(2)} cash for the COD package.`
                            : `Hand over all packages to the customer and collect cash payment.`}
                        </span>
                      </div>

                      {activeBundle.isMixedPayment && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50/90 p-3 text-xs text-purple-950 flex items-center gap-2">
                          <span className="text-base shrink-0">⚠️</span>
                          <span>
                            <strong>Mixed Payment Rule:</strong> 1 package is prepaid online via GCash (₱0.00 cash). Do not charge the customer for it. Only collect ₱{activeBundle.codAmountToCollect.toFixed(2)} in cash for the COD package.
                          </span>
                        </div>
                      )}

                      <div className={`rounded-2xl border ${paymentError ? 'border-red-400 bg-red-50/50' : 'border-amber-300 bg-amber-50/80'} p-3.5 space-y-2.5 shadow-xs transition-colors`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-amber-950">
                              Cash Received from Customer
                            </label>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-600 text-white shadow-2xs">
                              COD
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRiderReceivedAmount(String(activeBundle.codAmountToCollect))
                              setPaymentError(null)
                            }}
                            className="text-[10px] font-bold text-amber-800 bg-white border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                          >
                            Exact (₱{activeBundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                          </button>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 text-neutral-500 font-bold text-sm">₱</span>
                          <input
                            type="number"
                            step="any"
                            value={riderReceivedAmount}
                            onChange={(e) => {
                              setRiderReceivedAmount(e.target.value)
                              if (paymentError) setPaymentError(null)
                            }}
                            placeholder={String(activeBundle.codAmountToCollect)}
                            className={`w-full pl-8 pr-3 py-2.5 text-sm font-black text-neutral-900 bg-white border ${paymentError ? 'border-red-500 focus:border-red-600 ring-2 ring-red-200' : 'border-amber-300 focus:border-amber-600'} rounded-xl focus:outline-none transition-all placeholder-neutral-300 shadow-2xs`}
                          />
                        </div>
                        {paymentError && (
                          <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 pt-0.5">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{paymentError}</span>
                          </p>
                        )}
                        {riderReceivedAmount !== '' && !isNaN(parseFloat(riderReceivedAmount)) && (
                          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-amber-200 font-semibold">
                            <span className="text-neutral-600">
                              {parseFloat(riderReceivedAmount) >= activeBundle.codAmountToCollect ? 'Change due to customer:' : 'Short payment balance:'}
                            </span>
                            <span className={`font-mono font-black ${parseFloat(riderReceivedAmount) >= activeBundle.codAmountToCollect ? 'text-emerald-700 text-sm' : 'text-amber-600 text-sm'}`}>
                              {parseFloat(riderReceivedAmount) >= activeBundle.codAmountToCollect
                                ? `₱${(parseFloat(riderReceivedAmount) - activeBundle.codAmountToCollect).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `Short by ₱${(activeBundle.codAmountToCollect - parseFloat(riderReceivedAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* GCash / Online Payment: Customer prepaid online, no cash collection */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-950 flex items-center gap-2.5">
                        <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="font-bold">Customer paid online via GCash</p>
                          <p className="text-emerald-800 mt-0.5">
                            {activeBundle.isBundle
                              ? `All ${activeBundle.orders.length} packages are prepaid. Hand over the items to customer. No cash collection is needed.`
                              : `Order is out for delivery. Hand over the items to customer. No cash collection is needed.`}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-600">Payment Method:</span>
                          <span className="inline-flex items-center gap-1 font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] border border-emerald-200">
                            <span>📱</span> GCash (Prepaid Online)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-600">Combined Order Value:</span>
                          <span className="font-mono font-bold text-neutral-800">
                            ₱{activeBundle.totalCombinedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-neutral-100">
                          <span className="font-bold text-neutral-800">Cash to Collect from Customer:</span>
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            ₱0.00 (Prepaid Online)
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Required Proof of Delivery Photo Section */}
                  <div className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${deliveryProofError ? 'border-red-400 bg-red-50/50' : 'border-neutral-200 bg-neutral-50/70'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">📸</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                          Proof of Delivery Photo
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                          Required
                        </span>
                      </div>
                      {deliveryProofImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryProofImage(null)
                            setDeliveryProofError(null)
                          }}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    {deliveryProofImage ? (
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-neutral-200">
                        <img
                          src={deliveryProofImage}
                          alt="Delivery Proof"
                          onClick={() => setPreviewProofModalUrl(deliveryProofImage)}
                          className="w-16 h-16 object-cover rounded-lg border border-neutral-200 cursor-pointer hover:opacity-85 shadow-2xs shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                            <span>✓</span> Delivery Photo Attached
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">Tap image to zoom or tap Retake</p>
                          <label className="mt-1 inline-block text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer underline">
                            Retake Photo
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  setIsProcessingDeliveryProof(true)
                                  setDeliveryProofError(null)
                                  const base64 = await compressImageToBase64(file)
                                  setDeliveryProofImage(base64)
                                } catch {
                                  setDeliveryProofError('Failed to process image. Please try again.')
                                } finally {
                                  setIsProcessingDeliveryProof(false)
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 hover:border-emerald-500 rounded-xl p-4 cursor-pointer bg-white hover:bg-emerald-50/30 transition-all text-center group">
                        {isProcessingDeliveryProof ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                            <span className="animate-spin text-sm">⏳</span>
                            <span>Processing photo...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-full bg-neutral-100 group-hover:bg-emerald-100 text-neutral-600 group-hover:text-emerald-700 flex items-center justify-center text-lg mb-1.5 transition-colors">
                              📷
                            </div>
                            <span className="text-xs font-bold text-neutral-800 group-hover:text-emerald-700">
                              Take Photo / Upload Delivery Proof
                            </span>
                            <span className="text-[10px] text-neutral-400 mt-0.5">
                              Snap a photo of the handed-over package at customer's location
                            </span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            try {
                              setIsProcessingDeliveryProof(true)
                              setDeliveryProofError(null)
                              const base64 = await compressImageToBase64(file)
                              setDeliveryProofImage(base64)
                            } catch {
                              setDeliveryProofError('Failed to process image. Please try again.')
                            } finally {
                              setIsProcessingDeliveryProof(false)
                            }
                          }}
                        />
                      </label>
                    )}

                    {deliveryProofError && (
                      <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>{deliveryProofError}</span>
                      </p>
                    )}
                  </div>

                  {/* Complete Delivery Action Button */}
                  <button
                    type="button"
                    disabled={!deliveryProofImage || isProcessingDeliveryProof}
                    onClick={() => void handleCompleteBundleDelivery(activeBundle)}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition-all active:scale-98 text-center flex items-center justify-center gap-2 ${
                      !deliveryProofImage || isProcessingDeliveryProof
                        ? 'bg-neutral-300 cursor-not-allowed text-neutral-500 shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-md'
                    }`}
                    title={!deliveryProofImage ? 'Proof of delivery photo is required before marking delivered' : ''}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                      Mark {activeBundle.isBundle ? (activeBundle.hasCod ? `Both Delivered & Paid` : `Both Delivered`) : (activeBundle.hasCod ? `Delivered & Paid` : `Delivered`)}
                    </span>
                  </button>
                  {!deliveryProofImage && (
                    <p className="text-[11px] text-amber-700 text-center font-semibold flex items-center justify-center gap-1">
                      <span>⚠️</span>
                      <span>Attach delivery proof photo above to unlock completion</span>
                    </p>
                  )}
                </div>
              )}

              {/* Completed status summary */}
              {activeBundle.status === 'Completed' && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-bold text-neutral-800">
                    <span>Payment Mode:</span>
                    <span className="inline-flex items-center gap-1 font-black px-2.5 py-0.5 rounded-full text-[11px] bg-neutral-200 text-neutral-800">
                      {activeBundle.isMixedPayment ? 'Mixed (GCash + COD)' : activeBundle.hasCod ? 'Cash on Delivery' : 'GCash Paid Online'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Total Order Value:</span>
                    <span className="font-mono font-bold text-neutral-800">
                      ₱{activeBundle.totalCombinedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {activeBundle.hasCod ? (
                    <div className="flex justify-between items-center font-bold text-neutral-800">
                      <span>Cash Collected by Rider:</span>
                      <span className="font-mono text-emerald-700 text-sm font-black">
                        ₱{activeBundle.codAmountToCollect.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Cash Collected by Rider:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        ₱0.00 (Prepaid Online)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60">
                    <span>Delivery Status:</span>
                    <span className="font-bold text-emerald-600 uppercase">Delivered & Completed</span>
                  </div>

                  {(activeBundle.deliveryProof || deliveryProofImage) && (
                    <div className="pt-2 border-t border-neutral-200/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Proof of Delivery Photo:
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewProofModalUrl(activeBundle.deliveryProof || deliveryProofImage)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          View Full Image
                        </button>
                      </div>
                      <div
                        onClick={() => setPreviewProofModalUrl(activeBundle.deliveryProof || deliveryProofImage)}
                        className="relative w-full h-28 rounded-xl overflow-hidden border border-neutral-200 cursor-pointer group bg-neutral-900/5 hover:opacity-95 transition"
                      >
                        <img
                          src={activeBundle.deliveryProof || deliveryProofImage || ''}
                          alt="Delivery Proof"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <span className="bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                            🔍 Click to Zoom
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeBundle.status !== 'Ready' &&
                activeBundle.status !== 'Out for Delivery' &&
                activeBundle.status !== 'Completed' && (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-xl bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-500"
                  >
                    Waiting for Kitchen
                  </button>
                )}
            </div>
          </section>
        </div>
      )}

      {/* ADMIN CRUD MODALS */}
      <AdminEditTransactionModal
        isOpen={Boolean(editingRiderOrder)}
        transaction={editingRiderOrder}
        onClose={() => setEditingRiderOrder(null)}
        onSave={() => void fetchDeliveries(true)}
      />

      {/* Proof of Delivery Image Preview Modal */}
      {previewProofModalUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewProofModalUrl(null)}
        >
          <div 
            className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 text-white border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-sm font-bold">Proof of Delivery Photo</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-neutral-950 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img
                src={previewProofModalUrl}
                alt="Proof of Delivery Full Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-3 bg-neutral-100 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewProofModalUrl(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 shadow-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RideRoleDemo

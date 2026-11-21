import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { NavbarRider } from '../components/Navbarrider'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { StaffIcon } from '../components/PosIcon'
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
    paymentMethod: 'GCash',
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
    paymentMethod: 'GCash',
    coord: METRO_MANILA_LOCATIONS.novaliches,
  },
]

/**
 * Every delivery order is paid online before it is dispatched, so a rider never collects cash.
 * These two helpers encoded that as a per-order lookup; the redesigned screen states the rule
 * once for the whole shift instead, and nothing reads them any more.
 */

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

    const codAmountToCollect = 0
    const onlineAmountPrepaid = totalCombinedAmount
    const hasCod = false
    const hasOnline = true
    const isMixedPayment = false
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
  /**
   * Deliveries that have left the active board — handed over, cancelled, or aged out. The queue
   * drops them so a finished job cannot be started again; the rider still needs to look one up,
   * so they are kept here rather than thrown away.
   */
  const [pastDeliveries, setPastDeliveries] = useState<DeliveryJob[]>([])
  const [roadMetrics, setRoadMetrics] = useState<Map<string, number>>(() => new Map())
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const [routingUnavailable, setRoutingUnavailable] = useState(false)
  const [customerDetailsOrder, setCustomerDetailsOrder] = useState<DeliveryJob | null>(null)
  const [activeTab, setActiveTab] = useState<'Ready' | 'All' | 'Out for Delivery' | 'Past'>('Ready')
  const [notification, setNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'proximity' | 'newest'>('proximity')
  const [deliveryProofImage, setDeliveryProofImage] = useState<string | null>(null)
  const [deliveryProofError, setDeliveryProofError] = useState<string | null>(null)
  const [isProcessingDeliveryProof, setIsProcessingDeliveryProof] = useState<boolean>(false)
  const [previewProofModalUrl, setPreviewProofModalUrl] = useState<string | null>(null)

  useEffect(() => {
    setDeliveryProofImage(null)
    setDeliveryProofError(null)
  }, [customerDetailsOrder?.id])

  const riderLocation = RIDER_START_LOCATION

  // Admin CRUD Modal states
  const [editingRiderOrder, setEditingRiderOrder] = useState<any | null>(null)

  /**
   * Deleting a delivery used to live here, behind an admin check. It is gone: the rider board is
   * a view of work in progress, and destroying the order record from it would take the row the
   * kitchen, the cashier and the customer's own tracking all still read. Orders are cancelled
   * through the assistant flow, which leaves the record and its history intact.
   */


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
      const pastMap = new Map<string, DeliveryJob>()

      let printedReceiptsSet = new Set<string>()
      try {
        const savedPrinted = localStorage.getItem('seafudz_printed_receipts')
        if (savedPrinted) {
          const arr = JSON.parse(savedPrinted)
          if (Array.isArray(arr)) {
            printedReceiptsSet = new Set(arr.filter((x: any) => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim()))
          }
        }
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

              const rawStatus = (o.status || '').toUpperCase()

              /**
               * Build the rider's view of an order. Shared by the active queue and the archive so
               * a past delivery carries the same address, items and totals it had while it ran.
               */
              const toJob = (displayStatus: string): DeliveryJob => {
                const addr = o.address || o.deliveryAddress || 'Monumento, Caloocan'
                const lat = o.deliveryLatitude ?? o.delivery_latitude
                const lng = o.deliveryLongitude ?? o.delivery_longitude
                return {
                  id,
                  ref: id,
                  customerId: o.customerId || o.customer_id || o.userId || undefined,
                  userId: o.userId || o.customerId || o.customer_id || undefined,
                  tripId: tripMap[id] || (o.ref ? tripMap[o.ref] : undefined),
                  customer: o.customer || o.customerName || 'Online Customer',
                  phone: o.phone || '0917-000-0000',
                  address: addr,
                  items: (Array.isArray(o.items) ? o.items : []).filter(
                    (i: any) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(i.item_status || i.itemStatus || '').toUpperCase())
                  ),
                  total: o.total || 0,
                  deliveryFee:
                    o.deliveryFee == null && o.delivery_fee == null ? undefined : Number(o.deliveryFee ?? o.delivery_fee),
                  status: displayStatus,
                  createdAt:
                    o.createdAt || o.created_at || (o.dateTime && !isNaN(Date.parse(o.dateTime)) ? o.dateTime : new Date().toISOString()),
                  paymentMethod:
                    o.paymentMethod || o.payment_method || (typeof o.payment === 'string' ? o.payment : undefined) || 'GCash',
                  coord:
                    lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
                      ? { lat: Number(lat), lng: Number(lng), label: addr }
                      : geocodeAddress(addr),
                  riderCashReceived:
                    o.rider_cash_received != null
                      ? Number(o.rider_cash_received)
                      : o.riderCashReceived != null
                        ? Number(o.riderCashReceived)
                        : undefined,
                  deliveryProof: o.deliveryProof || o.delivery_proof || undefined,
                }
              }

              // Once an order is completed, delivered, served, or cancelled, record it as finished and exclude from active rider queue
              const finishedStatuses = ['COMPLETED', 'DELIVERED', 'SERVED', 'CANCELLED', 'REJECTED']
              if (finishedStatuses.includes(rawStatus) || isOrderCompleted(rawStatus)) {
                if (id) finishedOrderIds.add(id)
                if (o.ref) finishedOrderIds.add(o.ref)
                // Off the queue, but kept so the rider can look it up afterwards.
                if (id) pastMap.set(id, toJob(['CANCELLED', 'REJECTED'].includes(rawStatus) ? 'Cancelled' : 'Completed'))
                return
              }

              // Age cutoff: Any food order created > 12 hours ago is historical and must never appear as an active delivery job
              const orderTs = parseOrderTimestamp(o.createdAt || o.created_at || o.dateTime)
              if (orderTs !== null && Date.now() - orderTs > 12 * 60 * 60 * 1000) {
                if (id) finishedOrderIds.add(id)
                if (o.ref) finishedOrderIds.add(o.ref)
                // Aged out rather than delivered. It must not read "Completed" (nobody said it
                // arrived) nor "Ready" (it is not actionable any more), so it gets its own word.
                if (id) pastMap.set(id, toJob('Expired'))
                return
              }

              // Strict User Flow Requirement: Official restaurant receipt from POS Cashier MUST be printed
              // before the online delivery order reflects on the Rider dispatch queue.
              const hasPrintedId = Boolean(id && String(id).trim() && printedReceiptsSet.has(String(id).trim()))
              const hasPrintedRef = Boolean(o.ref && String(o.ref).trim() && printedReceiptsSet.has(String(o.ref).trim()))
              const isReceiptPrinted = Boolean(
                o.isReceiptPrinted === true ||
                o.is_receipt_printed === true ||
                String(o.receiptStatus || '').toUpperCase() === 'PRINTED' ||
                String(o.receipt_status || '').toUpperCase() === 'PRINTED' ||
                hasPrintedId ||
                hasPrintedRef
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
              if (!id || combinedMap.has(id)) return

              // Strict guard: If backend marked this order as finished/completed/cancelled, skip it!
              if (finishedOrderIds.has(id) || (o.ref && finishedOrderIds.has(o.ref))) return

              // Age cutoff: Any food order created > 12 hours ago is historical and must never appear as an active delivery job
              const orderTs = parseOrderTimestamp(o.createdAt || o.created_at || o.dateTime)
              if (orderTs !== null && Date.now() - orderTs > 12 * 60 * 60 * 1000) {
                return
              }

              // Strict User Flow Requirement: Official restaurant receipt from POS Cashier MUST be printed
              // before the online delivery order reflects on the Rider dispatch queue.
              const hasPrintedId = Boolean(id && String(id).trim() && printedReceiptsSet.has(String(id).trim()))
              const hasPrintedRef = Boolean(o.ref && String(o.ref).trim() && printedReceiptsSet.has(String(o.ref).trim()))
              const isReceiptPrinted = Boolean(
                o.isReceiptPrinted === true ||
                o.is_receipt_printed === true ||
                String(o.receiptStatus || '').toUpperCase() === 'PRINTED' ||
                String(o.receipt_status || '').toUpperCase() === 'PRINTED' ||
                hasPrintedId ||
                hasPrintedRef
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
          combinedMap.set(order.id, { ...order, status: demoStatuses[order.id] || order.status })
        })
      }

      setRawDeliveries(Array.from(combinedMap.values()))
      // Newest first: a rider looking something up wants the last drop, not the first.
      setPastDeliveries(
        Array.from(pastMap.values()).sort(
          (a, b) => (parseOrderTimestamp(b.createdAt || '') ?? 0) - (parseOrderTimestamp(a.createdAt || '') ?? 0)
        )
      )
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
  /**
   * Clearing a stop off the board used to live here. It is gone with the delete action: a rider
   * works the queue the assistant dispatched, and cannot decide a job is no longer theirs. Stops
   * leave the board one way only — by being delivered, cancelled, or ageing out — and all three
   * land in the Past tab rather than vanishing.
   */


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

    setDeliveryProofError(null)

    const updates = bundle.orders.map((order) => ({
      orderId: order.id,
      newStatus: 'Completed' as const,
      moneyReceived: 0,
      deliveryProof: deliveryProofImage,
    }))

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

  // Run through the same grouper for one shape of data downstream. In practice a finished
  // delivery always stands alone: `areOrdersCompanion` only ever combines ready-with-ready or
  // same-trip in-transit pairs, so nothing here matches.
  const pastBundles = useMemo<DeliveryBundle[]>(() => {
    return groupDeliveriesIntoBundles(pastDeliveries)
  }, [pastDeliveries])

  // Filter & sort bundled deliveries
  const filteredBundles = useMemo(() => {
    const source = activeTab === 'Past' ? pastBundles : bundledDeliveries
    const list = source.filter((b) => {
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
        if (activeTab === 'Past') {
          // The archive is already only finished work; nothing further to narrow.
          return true
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

    // Sorting past work by how near it is would be nonsense: it is already done, so the
    // archive is always newest first whatever the live board is sorted by.
    if (sortBy === 'proximity' && activeTab !== 'Past') {
      return list.sort((a, b) => (a.roadDistanceKm ?? Infinity) - (b.roadDistanceKm ?? Infinity))
    }
    return list.sort((a, b) => {
      const aTime = parseOrderTimestamp(a.latestCreatedAt || '') ?? 0
      const bTime = parseOrderTimestamp(b.latestCreatedAt || '') ?? 0
      return bTime - aTime
    })
  }, [bundledDeliveries, pastBundles, activeTab, searchQuery, sortBy])

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


  /**
   * The stop's state in one vocabulary, shared with the kitchen and customer views.
   * Tone carries meaning the same way it does everywhere else in the product:
   * emerald ready, amber waiting on the kitchen, indigo in motion, neutral done.
   */
  const stopState = (b: DeliveryBundle) => {
    if (b.status === 'Out for Delivery') return { label: 'On the way', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    if (b.status === 'Cancelled') return { label: 'Cancelled', tone: 'bg-neutral-100 text-neutral-500 border-neutral-300' }
    if (b.status === 'Expired') return { label: 'Closed, not delivered', tone: 'bg-neutral-100 text-neutral-500 border-neutral-300' }
    if (b.status === 'Completed') return { label: 'Delivered', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    if (b.status === 'Ready') return { label: 'Ready to pick up', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    if (b.hasPreparing && b.readyCount > 0)
      return { label: `${b.readyCount} of ${b.orders.length} ready`, tone: 'bg-amber-50 text-amber-800 border-amber-200' }
    return { label: 'Kitchen cooking', tone: 'bg-amber-50 text-amber-800 border-amber-200' }
  }

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  /**
   * The number on each tab has to agree with what that tab will actually show, so it is counted
   * with the same rules `filteredBundles` uses: hidden stops are dropped, "Ready" includes a
   * bundle with any packed package, and "All" means every stop still in play.
   */
  const tabCounts = useMemo(() => {
    const visible = bundledDeliveries
    return {
      Ready: visible.filter((b) => b.status.toLowerCase() === 'ready' || (b.isBundle && b.readyCount > 0)).length,
      All: visible.filter((b) => !isOrderCompleted(b.status)).length,
      'Out for Delivery': visible.filter((b) => b.status.toLowerCase() === 'out for delivery').length,
      Past: pastBundles.length,
    }
  }, [bundledDeliveries, pastBundles])

  return (
    <div className="rider-view min-h-screen bg-[#f8f6f4] p-4 font-sans text-neutral-900 lg:p-6">
      {/*
        The bar travels with the rider down a long list of stops and carries the page ground
        with it, so stop rows pass beneath an opaque band rather than through the gap above it.
      */}
      <div className="sticky top-0 z-50 -mx-4 -mt-4 mb-5 bg-[#f8f6f4] px-4 pb-3 pt-4 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <NavbarRider />
      </div>

      {/*
        One column, not a dashboard grid. This screen is read on a phone held in one hand at the
        roadside: the rider has one next stop, so the page is a worklist of stops, widest at a
        comfortable reading measure rather than spread across a monitor.
      */}
      <main className="mx-auto w-full max-w-3xl space-y-4">
        {notification && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            <span>{notification}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              aria-label="Dismiss"
              className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-1 text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <StaffIcon name="close" className="h-4 w-4" />
            </button>
          </div>
        )}

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Your stops</h1>
          <p className="text-sm leading-relaxed text-neutral-500">
            Everything dispatched to you, nearest first. Orders for the same address travel as one stop.
          </p>
        </header>

        {/*
          The facts that are true of every stop, stated once instead of repeated on each card.
          Every delivery is prepaid, so "collect no cash" is a standing rule of the shift — the old
          screen restated it fourteen times and buried what actually differs between stops.
        */}
        <section className="rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <StaffIcon name="cash" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">Collect no cash</p>
              <p className="text-[13px] leading-relaxed text-neutral-500">
                Every delivery is paid online before dispatch. Hand the packages over and take the photo.
              </p>
            </div>
          </div>

          <dl className="divide-y divide-neutral-100 px-4 sm:flex sm:divide-y-0 sm:divide-x">
            <div className="py-3 sm:flex-1 sm:pr-4">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                <StaffIcon name="pin" className="h-3 w-3" /> Leaving from
              </dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                Barangay 176, Bagong Silang, Caloocan
                <span className="ml-1.5 font-mono text-[11px] tabular-nums text-neutral-400">
                  {riderLocation.lat.toFixed(4)}, {riderLocation.lng.toFixed(4)}
                </span>
              </dd>
            </div>
            <div className="py-3 sm:flex-1 sm:pl-4">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Delivery fee</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-neutral-700">
                <span className="tabular-nums">₱50</span> under 3.9 km ·{' '}
                <span className="tabular-nums">₱100</span> from 3.9 to 8 km
              </dd>
            </div>
          </dl>

          {(isLoadingRoutes || routingUnavailable) && (
            <p
              role="status"
              className={`flex items-center gap-2 border-t border-neutral-100 px-4 py-2.5 text-[13px] ${
                routingUnavailable ? 'text-amber-700' : 'text-neutral-500'
              }`}
            >
              <StaffIcon name={routingUnavailable ? 'alert' : 'clock'} className="h-3.5 w-3.5 shrink-0" />
              {routingUnavailable
                ? 'Road distances are unavailable right now; stored or base fees are shown.'
                : 'Working out road distances…'}
            </p>
          )}
        </section>

        {/* Filter, search and order — the same bar language the rest of the staff app uses. */}
        <section className="space-y-2.5 rounded-2xl border border-neutral-200 bg-white p-2.5">
          <div className="flex items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['Ready', 'Out for Delivery', 'Past', 'All'] as const).map((tab) => {
              const isSelected = activeTab === tab
              const count = tabCounts[tab]
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                    isSelected ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <span>
                    {tab === 'Out for Delivery'
                      ? 'On the way'
                      : tab === 'Past'
                        ? 'Delivered'
                        : tab === 'Ready'
                          ? 'Ready'
                          : 'All'}
                  </span>
                  <span className={`text-[11px] tabular-nums ${isSelected ? 'text-white/70' : 'text-neutral-400'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-2 transition-colors focus-within:border-orange-400 focus-within:bg-white">
              <StaffIcon name="search" className="h-4 w-4 shrink-0 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search a name, address or reference"
                aria-label="Search your stops"
                className="w-full border-none bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="shrink-0 cursor-pointer text-neutral-400 transition-colors hover:text-neutral-700"
                >
                  <StaffIcon name="close" className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Distance only orders work still to be done, so the archive hides the control. */}
            <div className={`flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 p-1 ${activeTab === 'Past' ? 'hidden' : ''}`}>
              {([['proximity', 'Nearest'], ['newest', 'Newest']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortBy(key)}
                  aria-current={sortBy === key ? 'true' : undefined}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    sortBy === key ? 'bg-white text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* The stops themselves. One row per destination, however many packages it holds. */}
        {paginatedBundles.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-14 text-center">
            <StaffIcon name="scooter" className="mx-auto h-9 w-9 text-neutral-300" />
            <h2 className="mt-3.5 text-base font-semibold text-neutral-900">
              {searchQuery
                ? 'Nothing matches that search'
                : activeTab === 'Past'
                  ? 'Nothing delivered yet'
                  : 'No stops right now'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-neutral-500">
              {searchQuery
                ? `No stop matches “${searchQuery}”. Try a customer name, an address or an order reference.`
                : activeTab === 'Past'
                  ? 'Stops you have finished move here once they close.'
                  : 'Orders appear here the moment the assistant dispatches them.'}
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {paginatedBundles.map((bundle) => {
              const state = stopState(bundle)
              const shown = bundle.orders.slice(0, 3)
              const hidden = bundle.orders.length - shown.length
              const packageCount = bundle.orders.length
              return (
                <li key={bundle.bundleKey}>
                  <article
                    onClick={() => setCustomerDetailsOrder(bundle.primaryOrder)}
                    className="cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-[border-color,box-shadow] duration-150 ease-out hover:border-neutral-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.28)]"
                  >
                    <div className="px-4 pb-3.5 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${state.tone}`}>
                          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                          {state.label}
                        </span>

                        {/* How far: the number this list is sorted by, so it reads as a figure. */}
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">
                          {bundle.roadDistanceKm === undefined ? '— km' : `${bundle.roadDistanceKm.toFixed(1)} km`}
                        </span>
                      </div>

                      {/* Who to ask for, then where to go: the two things said at the gate. */}
                      <h3 className="mt-2.5 text-base font-bold leading-tight text-neutral-900">{bundle.customer}</h3>
                      <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-neutral-600">
                        <StaffIcon name="pin" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span>{bundle.address}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-500">
                        <StaffIcon name="phone" className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        <span className="font-mono tabular-nums">{bundle.phone}</span>
                      </p>
                    </div>

                    {/* What is in the bag. A bundle is just a stop with more lines. */}
                    <div className="divide-y divide-neutral-100 border-t border-neutral-100 px-4">
                      {shown.map((ord) => (
                        <div key={ord.id} className="flex items-baseline justify-between gap-4 py-2.5 text-[13px]">
                          <span className="min-w-0 truncate text-neutral-700">
                            {ord.items.map((i) => `${i.quantity}× ${i.name}`).join(', ') || 'Package'}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">{ord.ref}</span>
                        </div>
                      ))}
                      {hidden > 0 && (
                        <p className="py-2.5 text-[13px] text-neutral-500">
                          and {hidden} more {hidden === 1 ? 'package' : 'packages'}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
                      <p className="text-[13px] text-neutral-500">
                        {packageCount} {packageCount === 1 ? 'package' : 'packages'} ·{' '}
                        <span className="tabular-nums">{peso(bundle.totalCombinedAmount)}</span> prepaid
                      </p>
                      {/*
                        The whole row is clickable as a thumb convenience, but a row is not a
                        control: this button is the same action reachable by keyboard, and it
                        names the stop so it is not one of twelve identical "Open"s to a reader.
                      */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCustomerDetailsOrder(bundle.primaryOrder)
                        }}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                      >
                        Open<span className="sr-only"> the stop for {bundle.customer}</span>
                        <StaffIcon name="arrowRight" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ol>
        )}

        {filteredBundles.length > ITEMS_PER_PAGE && (
          <div className="flex select-none flex-col items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row">
            <p className="text-[13px] text-neutral-500">
              Page <span className="font-semibold tabular-nums text-neutral-900">{currentPage}</span> of{' '}
              <span className="font-semibold tabular-nums text-neutral-900">{totalPages}</span> ·{' '}
              <span className="tabular-nums">{filteredBundles.length}</span>{' '}
              {filteredBundles.length === 1 ? 'stop' : 'stops'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <StaffIcon name="arrowLeft" className="h-3.5 w-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200 px-3.5 py-2 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next <StaffIcon name="arrowRight" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* The stop, in full: where it goes, what is in it, and the one thing to do next. */}
      {activeBundle && (() => {
        const state = stopState(activeBundle)
        const proofShown = activeBundle.deliveryProof || deliveryProofImage
        const onProofPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            setIsProcessingDeliveryProof(true)
            setDeliveryProofError(null)
            const base64 = await compressImageToBase64(file)
            setDeliveryProofImage(base64)
          } catch {
            setDeliveryProofError('That photo could not be processed. Try taking it again.')
          } finally {
            setIsProcessingDeliveryProof(false)
          }
        }

        return (
          <div
            className="rider-scrim fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/55 p-0 sm:items-center sm:p-6"
            onClick={() => setCustomerDetailsOrder(null)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="rider-stop-title"
              onClick={(e) => e.stopPropagation()}
              className="rider-sheet flex max-h-[92vh] w-full max-w-lg transform-gpu flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 sm:rounded-2xl"
            >
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${state.tone}`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    {state.label}
                  </span>
                  <h2 id="rider-stop-title" className="mt-1.5 text-lg font-bold leading-tight text-neutral-900">
                    {activeBundle.customer}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {activeBundle.isBundle
                      ? `${activeBundle.orders.length} packages travelling to one address`
                      : `Order ${activeBundle.primaryOrder.ref}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerDetailsOrder(null)}
                  aria-label="Close stop details"
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <StaffIcon name="close" className="h-4 w-4" />
                </button>
              </header>

              <div className="rider-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {/* Where and who */}
                <dl className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <StaffIcon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Deliver to</dt>
                      <dd className="mt-0.5 text-sm leading-relaxed text-neutral-900">{activeBundle.address}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <StaffIcon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Phone</dt>
                      <dd className="mt-0.5 font-mono text-sm tabular-nums text-neutral-900">{activeBundle.phone}</dd>
                    </div>
                  </div>
                  <div className="flex gap-4 px-4 py-3">
                    <div className="flex-1">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Road distance</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
                        {activeBundle.roadDistanceKm === undefined ? 'Unavailable' : `${activeBundle.roadDistanceKm.toFixed(1)} km`}
                      </dd>
                    </div>
                    <div className="flex-1">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Delivery fee</dt>
                      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
                        {peso(activeBundle.totalDeliveryFee)}
                        {activeBundle.isBundle && (
                          <span className="ml-1 text-[11px] font-normal text-neutral-500">
                            ({activeBundle.orders.length} orders)
                          </span>
                        )}
                      </dd>
                    </div>
                  </div>
                </dl>

                {/* What to carry */}
                <section className="overflow-hidden rounded-2xl border border-neutral-200">
                  <h3 className="border-b border-neutral-100 px-4 py-3 text-sm font-bold text-neutral-900">
                    {activeBundle.isBundle ? `${activeBundle.orders.length} packages` : 'Package'}
                  </h3>
                  <div className="divide-y divide-neutral-100">
                    {activeBundle.orders.map((ord, idx) => {
                      const ordLabel =
                        ord.status === 'Ready' ? 'Ready' : ord.status === 'Out for Delivery' ? 'On the way' : 'Cooking'
                      const ordTone =
                        ord.status === 'Ready'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : ord.status === 'Out for Delivery'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      return (
                        <div key={ord.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-mono text-[11px] tabular-nums text-neutral-500">
                              {activeBundle.isBundle ? `${idx + 1} · ` : ''}{ord.ref}
                            </span>
                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ordTone}`}>
                              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                              {ordLabel}
                            </span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {ord.items.map((item, itemIdx) => (
                              <li key={`${item.name}-${itemIdx}`} className="flex items-baseline justify-between gap-4 text-[13px]">
                                <span className="min-w-0 text-neutral-700">
                                  <span className="tabular-nums text-neutral-500">{item.quantity}×</span> {item.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[13px] tabular-nums text-neutral-500">{peso(ord.total)} · paid online</p>

                          {/*
                            No delete here. Destroying an order from a delivery screen removes the
                            record the kitchen, the cashier and the customer all still rely on, and
                            a rider has no business doing it from the roadside. Correcting a
                            package stays available to an admin; removing one does not.
                          */}
                          {isAdmin && !ord.id.startsWith('DEMO-RIDER-') && activeTab !== 'Past' && (
                            <div className="mt-2.5">
                              <button
                                type="button"
                                onClick={() => setEditingRiderOrder(ord)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                              >
                                <StaffIcon name="edit" className="h-3 w-3" /> Edit
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-neutral-100 px-4 py-3">
                    <span className="text-[13px] text-neutral-500">Order value, already paid</span>
                    <span className="text-sm font-semibold tabular-nums text-neutral-900">
                      {peso(activeBundle.totalCombinedAmount)}
                    </span>
                  </div>
                </section>

                {/* The photo is the one thing the rider must produce, so it sits in the flow. */}
                {activeBundle.status === 'Out for Delivery' && (
                  <section
                    className={`overflow-hidden rounded-2xl border ${
                      deliveryProofError ? 'border-rose-300' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                        <StaffIcon name="camera" className="h-4 w-4 text-neutral-400" />
                        Handover photo
                      </h3>
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        Required
                      </span>
                    </div>

                    <div className="p-4">
                      {deliveryProofImage ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewProofModalUrl(deliveryProofImage)}
                            className="shrink-0 cursor-pointer overflow-hidden rounded-xl border border-neutral-200 transition-opacity hover:opacity-85"
                            title="View full size"
                          >
                            <img src={deliveryProofImage} alt="The handover photo you took" className="h-16 w-16 object-cover" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                              <StaffIcon name="check" className="h-3.5 w-3.5" /> Photo attached
                            </p>
                            <p className="mt-0.5 text-[13px] text-neutral-500">Tap it to zoom, or take it again.</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                                <StaffIcon name="camera" className="h-3.5 w-3.5" />
                                Take again
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onProofPicked} />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeliveryProofImage(null)
                                  setDeliveryProofError(null)
                                }}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                              >
                                <StaffIcon name="close" className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-4 py-7 text-center transition-colors hover:border-orange-400 hover:bg-orange-50/40">
                          {isProcessingDeliveryProof ? (
                            <span className="flex items-center gap-2 text-[13px] font-medium text-neutral-600">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                              Processing photo…
                            </span>
                          ) : (
                            <>
                              <StaffIcon name="camera" className="h-7 w-7 text-neutral-400" />
                              <span className="mt-2 text-sm font-semibold text-neutral-900">Take the handover photo</span>
                              <span className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">
                                Photograph the packages with the customer at the door.
                              </span>
                            </>
                          )}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onProofPicked} />
                        </label>
                      )}

                      {deliveryProofError && (
                        <p className="mt-3 flex items-start gap-1.5 text-[13px] font-medium text-rose-700">
                          <StaffIcon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{deliveryProofError}</span>
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* A finished stop keeps its evidence. */}
                {activeBundle.status === 'Completed' && proofShown && (
                  <section className="overflow-hidden rounded-2xl border border-neutral-200">
                    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                        <StaffIcon name="check" className="h-4 w-4 text-emerald-600" />
                        Handed over
                      </h3>
                      <button
                        type="button"
                        onClick={() => setPreviewProofModalUrl(proofShown)}
                        className="shrink-0 cursor-pointer text-[13px] font-semibold text-neutral-700 underline-offset-2 hover:underline"
                      >
                        View photo
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewProofModalUrl(proofShown)}
                      className="block w-full cursor-pointer transition-opacity hover:opacity-95"
                    >
                      <img src={proofShown} alt="Handover photo" className="h-32 w-full object-cover" />
                    </button>
                  </section>
                )}

                {/* What the kitchen is still holding, when it is holding anything. */}
                {activeBundle.status === 'Preparing' && (
                  <p className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
                    <StaffIcon name="cooking" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {activeBundle.readyCount > 0
                        ? `${activeBundle.readyCount} of ${activeBundle.orders.length} packages are packed at the counter; ${activeBundle.preparingCount} is still cooking. Wait and take them together, or dispatch what is ready now.`
                        : 'The kitchen is still cooking this order. You can start once it is marked ready.'}
                    </span>
                  </p>
                )}
              </div>

              {/*
                The action sits on the floor of the sheet, within thumb reach, and stays there
                while the detail above it scrolls. One action per state, never two competing.
              */}
              <footer className="shrink-0 border-t border-neutral-100 bg-white px-5 py-4">
                {activeBundle.status === 'Ready' ? (
                  <button
                    type="button"
                    onClick={() => void handleStartBundleDelivery(activeBundle)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    <StaffIcon name="scooter" className="h-4 w-4" />
                    Start delivery{activeBundle.isBundle ? ` · ${activeBundle.orders.length} packages` : ''}
                  </button>
                ) : activeBundle.status === 'Preparing' && activeBundle.readyCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleStartReadyPackagesOnly(activeBundle)}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
                  >
                    <StaffIcon name="scooter" className="h-4 w-4" />
                    Take the {activeBundle.readyCount} ready {activeBundle.readyCount === 1 ? 'package' : 'packages'} now
                  </button>
                ) : activeBundle.status === 'Out for Delivery' ? (
                  <>
                    <button
                      type="button"
                      disabled={!deliveryProofImage || isProcessingDeliveryProof}
                      onClick={() => void handleCompleteBundleDelivery(activeBundle)}
                      title={!deliveryProofImage ? 'Take the handover photo first' : undefined}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white transition-colors ${
                        !deliveryProofImage || isProcessingDeliveryProof
                          ? 'cursor-not-allowed bg-neutral-200 text-neutral-500'
                          : 'cursor-pointer bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <StaffIcon name="check" className="h-4 w-4" />
                      Mark {activeBundle.isBundle ? 'all packages' : 'this stop'} delivered
                    </button>
                    {!deliveryProofImage && (
                      <p className="mt-2 text-center text-[13px] text-neutral-500">
                        Take the handover photo above to finish this stop.
                      </p>
                    )}
                  </>
                ) : activeBundle.status === 'Completed' ? (
                  <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-500">
                    <StaffIcon name="check" className="h-4 w-4 text-emerald-600" />
                    Delivered — nothing left to do here.
                  </p>
                ) : activeBundle.status === 'Cancelled' ? (
                  <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-neutral-500">
                    <StaffIcon name="info" className="h-4 w-4 text-neutral-400" />
                    This order was cancelled. It was never handed over.
                  </p>
                ) : activeBundle.status === 'Expired' ? (
                  <p className="flex items-center justify-center gap-2 text-center text-[13px] font-medium text-neutral-500">
                    <StaffIcon name="info" className="h-4 w-4 shrink-0 text-neutral-400" />
                    Closed without a handover — it sat on the board longer than a shift.
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-neutral-200 px-5 py-3.5 text-sm font-semibold text-neutral-500"
                  >
                    <StaffIcon name="clock" className="h-4 w-4" />
                    Waiting for the kitchen
                  </button>
                )}
              </footer>
            </section>
          </div>
        )
      })()}

      {/* ADMIN CRUD MODALS */}
      <AdminEditTransactionModal
        isOpen={Boolean(editingRiderOrder)}
        transaction={editingRiderOrder}
        onClose={() => setEditingRiderOrder(null)}
        onSave={() => void fetchDeliveries(true)}
      />

      {/* Full-size handover photo */}
      {previewProofModalUrl && (
        <div
          className="fixed inset-0 z-60 flex cursor-pointer items-center justify-center bg-neutral-950/80 p-4"
          onClick={() => setPreviewProofModalUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Handover photo, full size"
        >
          <div className="relative max-h-[85vh] max-w-xl rounded-2xl bg-white p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <img src={previewProofModalUrl} alt="Handover photo, full size" className="max-h-[80vh] w-auto rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setPreviewProofModalUrl(null)}
              aria-label="Close photo"
              className="absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg"
            >
              <StaffIcon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default RideRoleDemo

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

export const RideRoleDemo: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const [rawDeliveries, setRawDeliveries] = useState<DeliveryJob[]>([])
  const [roadMetrics, setRoadMetrics] = useState<Map<string, number>>(() => new Map())
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false)
  const [routingUnavailable, setRoutingUnavailable] = useState(false)
  const [customerDetailsOrder, setCustomerDetailsOrder] = useState<DeliveryJob | null>(null)
  const [activeTab, setActiveTab] = useState<'All' | 'Ready' | 'Out for Delivery' | 'Completed'>('Ready')
  const [notification, setNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'proximity' | 'newest'>('proximity')
  const [riderReceivedAmount, setRiderReceivedAmount] = useState<string>('')
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const riderLocation = RIDER_START_LOCATION

  // Admin CRUD Modal states
  const [editingRiderOrder, setEditingRiderOrder] = useState<any | null>(null)

  const handleDeleteRiderOrder = async (orderId: string) => {
    const isDemoOrder = import.meta.env.DEV && orderId.startsWith('DEMO-RIDER-')
    const confirmDelete = window.confirm(isDemoOrder
      ? `Remove demo order ${orderId} from the Rider view?`
      : `Are you sure you want to permanently delete Delivery #${orderId}? This will remove it from the database.`)
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

      // 1. Read from backend API FIRST (Online Delivery Orders ONLY - Central Truth)
      try {
        const res = await fetch(`${API_BASE_URL}/user-flow/orders`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.data)) {
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
              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return
              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') displayStatus = 'Out for Delivery'
              else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') displayStatus = 'Completed'
              else if (rawStatus === 'READY') displayStatus = 'Ready'
              else if (rawStatus === 'PREPARING' || rawStatus === 'CONFIRMED') displayStatus = 'Preparing'
              else return

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

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || o.customerName || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items: o.items || [],
                total: o.total || 0,
                deliveryFee: o.deliveryFee == null && o.delivery_fee == null
                  ? undefined
                  : Number(o.deliveryFee ?? o.delivery_fee),
                status: displayStatus,
                createdAt: o.createdAt || new Date().toISOString(),
                paymentMethod: o.paymentMethod || 'GCash',
                coord,
                riderCashReceived: riderCashRec,
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
              if (!id || hiddenSet.has(id) || hiddenSet.has(o.ref) || combinedMap.has(id)) return

              const rawStatus = (o.status || '').toUpperCase()
              const unconfirmedStatuses = [
                'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT'
              ]
              if (unconfirmedStatuses.includes(rawStatus)) return

              let displayStatus = 'Ready'
              if (rawStatus === 'OUT_FOR_DELIVERY') displayStatus = 'Out for Delivery'
              else if (rawStatus === 'COMPLETED' || rawStatus === 'DELIVERED') displayStatus = 'Completed'
              else if (rawStatus === 'READY') displayStatus = 'Ready'
              else if (rawStatus === 'PREPARING' || rawStatus === 'CONFIRMED') displayStatus = 'Preparing'
              else return

              const items = Array.isArray(o.cartItems)
                ? o.cartItems.map((ci: any) => ({
                    name: ci.item?.name || ci.name || 'Seafood Dish',
                    quantity: ci.quantity || 1,
                  }))
                : (o.items || '').split(',').map((part: string) => {
                    const match = part.trim().match(/^(.*?)\s*x(\d+)$/)
                    return {
                      name: match ? match[1].trim() : part.trim(),
                      quantity: match ? parseInt(match[2], 10) : 1,
                    }
                  })

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

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items,
                total: Number(o.total || 0),
                deliveryFee: o.deliveryFee == null && o.delivery_fee == null
                  ? undefined
                  : Number(o.deliveryFee ?? o.delivery_fee),
                status: displayStatus,
                createdAt: o.dateTime || 'Just now',
                paymentMethod: o.paymentMethod || 'GCash',
                coord,
                riderCashReceived: riderCashRec,
              })
            })
          }
        }
      } catch (e) {
        console.warn('Rider LocalStorage note:', e)
      }

      if (import.meta.env.DEV) {
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

  const handleHideOrder = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setHiddenOrderIds((prev) => {
      const next = new Set(prev)
      next.add(orderId)
      try {
        localStorage.setItem('seafudz_rider_hidden_orders', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    setCustomerDetailsOrder((prev) => (prev?.id === orderId ? null : prev))
    setNotification(`Order ${orderId} removed from Rider view (UI only).`)
  }

  // Rider updates status to Out for Delivery or Delivered/Completed
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: 'Out for Delivery' | 'Completed',
    moneyReceived?: number
  ) => {
    const apiStatus = newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'

    if (import.meta.env.DEV && orderId.startsWith('DEMO-RIDER-')) {
      try {
        const statuses = JSON.parse(localStorage.getItem(DEMO_ORDER_STATUS_KEY) || '{}')
        localStorage.setItem(DEMO_ORDER_STATUS_KEY, JSON.stringify({ ...statuses, [orderId]: newStatus }))
      } catch {}
      setRawDeliveries((prev) =>
        prev.map((delivery) =>
          delivery.id === orderId
            ? { ...delivery, status: newStatus, riderCashReceived: moneyReceived !== undefined ? moneyReceived : delivery.riderCashReceived }
            : delivery
        )
      )
      setCustomerDetailsOrder((prev) =>
        prev?.id === orderId
          ? { ...prev, status: newStatus, riderCashReceived: moneyReceived !== undefined ? moneyReceived : prev.riderCashReceived }
          : prev
      )
      setNotification(`Order status updated to "${newStatus}".`)
      return
    }

    // Update in LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === orderId || o.ref === orderId
          ? {
              ...o,
              status: apiStatus,
              riderCashReceived: moneyReceived !== undefined ? moneyReceived : o.riderCashReceived,
              rider_cash_received: moneyReceived !== undefined ? moneyReceived : o.rider_cash_received,
            }
          : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        if (activeObj && (activeObj.id === orderId || activeObj.ref === orderId)) {
          localStorage.setItem(
            'seafudz_active_online_order',
            JSON.stringify({
              ...activeObj,
              status: apiStatus,
              riderCashReceived: moneyReceived !== undefined ? moneyReceived : activeObj.riderCashReceived,
            })
          )
        }
      }

      notifyOrderSync()
    } catch {}

    // Update in backend API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: apiStatus,
          riderCashReceived: moneyReceived,
          riderName: currentUser?.fullname || currentUser?.username || 'Rider',
        }),
      })
    } catch {}

    setRawDeliveries((prev) =>
      prev.map((d) =>
        d.id === orderId
          ? { ...d, status: newStatus, riderCashReceived: moneyReceived !== undefined ? moneyReceived : d.riderCashReceived }
          : d
      )
    )

    setCustomerDetailsOrder((prev) =>
      prev?.id === orderId
        ? { ...prev, status: newStatus, riderCashReceived: moneyReceived !== undefined ? moneyReceived : prev.riderCashReceived }
        : prev
    )

    setNotification(`Order status updated to "${newStatus}"!`)
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

  // Filter & sort deliveries
  const filteredDeliveries = useMemo(() => {
    const list = pricedDeliveries.filter((d) => {
      if (hiddenOrderIds.has(d.id) || hiddenOrderIds.has(d.ref)) return false
      const matchesTab = activeTab === 'All' ? d.status !== 'Completed' : d.status.toLowerCase() === activeTab.toLowerCase()
      if (!matchesTab) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (d.ref || '').toLowerCase().includes(q) ||
        (d.customer || '').toLowerCase().includes(q) ||
        (d.phone || '').toLowerCase().includes(q) ||
        (d.address || '').toLowerCase().includes(q)
      )
    })

    if (sortBy === 'proximity') {
      return list.sort((a, b) => (a.roadDistanceKm ?? Infinity) - (b.roadDistanceKm ?? Infinity))
    }
    return list.sort((a, b) => {
      const aTime = Date.parse(a.createdAt || '')
      const bTime = Date.parse(b.createdAt || '')
      if (!Number.isFinite(aTime)) return Number.isFinite(bTime) ? 1 : 0
      if (!Number.isFinite(bTime)) return -1
      return bTime - aTime
    })
  }, [pricedDeliveries, activeTab, searchQuery, hiddenOrderIds, sortBy])

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE))
  const paginatedDeliveries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredDeliveries.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredDeliveries, currentPage, ITEMS_PER_PAGE])

  // Keep selected order in sync with updated metrics
  const activeCustomerDetailsOrder = useMemo(() => {
    if (!customerDetailsOrder) return null
    return pricedDeliveries.find((d) => d.id === customerDetailsOrder.id) || customerDetailsOrder
  }, [customerDetailsOrder, pricedDeliveries])

  useEffect(() => {
    if (activeCustomerDetailsOrder?.riderCashReceived != null) {
      setRiderReceivedAmount(String(activeCustomerDetailsOrder.riderCashReceived))
    } else {
      setRiderReceivedAmount('')
    }
    setPaymentError(null)
  }, [activeCustomerDetailsOrder?.id, activeCustomerDetailsOrder?.riderCashReceived, activeCustomerDetailsOrder?.status])

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

        {/* 4-Column Layout */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 items-start">
          <div className="flex flex-col gap-4">
            {/* Search and Tabs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-2xs overflow-x-auto">
                {(['Ready', 'All', 'Out for Delivery', 'Completed'] as const).map((tab) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedDeliveries.length === 0 ? (
                  <div className="col-span-2 bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                    <h3 className="font-bold text-neutral-700">No delivery orders found.</h3>
                    <p className="text-xs mt-1">
                      {searchQuery ? `No results matching "${searchQuery}"` : 'Orders dispatched by Assistant will show up here live.'}
                    </p>
                  </div>
                ) : (
                  paginatedDeliveries.map((ord) => {
                    return (
                      <div
                        key={ord.id}
                        onClick={() => setCustomerDetailsOrder(ord)}
                        className="bg-white rounded-3xl p-5 border border-neutral-200 transition-all shadow-xs hover:shadow-md cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Ref: {ord.ref}</span>
                            <h4 className="text-base font-black leading-tight mt-0.5 text-neutral-800">{ord.customer}</h4>
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
                              onClick={(e) => handleHideOrder(ord.id, e)}
                              title="Remove from Rider UI (does not delete from DB)"
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
                          <p className="truncate"><span className="font-medium text-neutral-700">{ord.address}</span></p>
                          <p className="truncate"><span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                        </div>

                        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                          <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-neutral-400 font-medium text-[11px]">{ord.createdAt}</span>
                        </div>
                      </div>
                    )
                  })
                )}
            </div>

            {/* Pagination Controls */}
            {filteredDeliveries.length > ITEMS_PER_PAGE && (
              <div className="bg-white px-5 py-3.5 rounded-2xl border border-neutral-200 shadow-2xs flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500">
                  Page <span className="text-neutral-900 font-black">{currentPage}</span> of{' '}
                  <span className="text-neutral-900 font-black">{totalPages}</span> ({filteredDeliveries.length} total orders)
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

      {activeCustomerDetailsOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCustomerDetailsOrder(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="rider-customer-details-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-neutral-100 pb-3">
              <div>
                <h2 id="rider-customer-details-title" className="text-lg font-black text-neutral-900">
                  {activeCustomerDetailsOrder.customer}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">Order {activeCustomerDetailsOrder.ref}</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerDetailsOrder(null)}
                className="rounded-lg px-2 py-1 text-sm font-bold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                aria-label="Close customer details"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase text-neutral-400">Phone</p>
                <p className="mt-0.5 text-neutral-800">{activeCustomerDetailsOrder.phone}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-neutral-400">Delivery address</p>
                <p className="mt-0.5 text-neutral-800">{activeCustomerDetailsOrder.address}</p>
              </div>
              <p className="text-xs font-bold uppercase text-neutral-400">
                Status: <span className="text-neutral-700">{activeCustomerDetailsOrder.status}</span>
              </p>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-orange-50 p-3">
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Road distance</p>
                  <p className="mt-0.5 font-bold text-neutral-900">
                    {activeCustomerDetailsOrder.roadDistanceKm === undefined
                      ? 'Unavailable'
                      : `${activeCustomerDetailsOrder.roadDistanceKm.toFixed(1)} km`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-neutral-500">Total rider fee</p>
                  <p className="mt-0.5 font-bold text-orange-700">
                    {activeCustomerDetailsOrder.deliveryFee === null
                      ? 'Outside delivery range'
                      : `₱${activeCustomerDetailsOrder.deliveryFee?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-neutral-400">Items</p>
                <ul className="mt-1 space-y-1 text-neutral-800">
                  {activeCustomerDetailsOrder.items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                      <span>{item.name}</span>
                      <span className="font-semibold">x{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-3 font-bold">
                <span>Order total</span>
                <span className="font-mono text-base">₱{activeCustomerDetailsOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {/* Ready status note & actions: Rider has not started delivery yet */}
              {activeCustomerDetailsOrder.status === 'Ready' && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>This order is ready for pickup at the store. Click <strong>Start Delivery</strong> to begin transit. Payment will be collected from the customer upon final arrival.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentError(null)
                      void handleUpdateStatus(activeCustomerDetailsOrder.id, 'Out for Delivery')
                    }}
                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Start Delivery</span>
                  </button>
                </div>
              )}

              {/* Out for Delivery status: Item is in transit / being delivered. Rider collects payment upon handover before marking as delivered */}
              {activeCustomerDetailsOrder.status === 'Out for Delivery' && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Order is out for delivery. Once handed over to the customer, enter the amount received below before marking as delivered.</span>
                  </div>

                  <div className={`rounded-2xl border ${paymentError ? 'border-red-400 bg-red-50/50' : 'border-emerald-300 bg-emerald-50/80'} p-3.5 space-y-2.5 shadow-xs transition-colors`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                          Payment Received Upon Delivery
                        </label>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                          {activeCustomerDetailsOrder.paymentMethod || 'COD'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRiderReceivedAmount(String(activeCustomerDetailsOrder.total))
                          setPaymentError(null)
                        }}
                        className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer shadow-2xs"
                      >
                        Exact (₱{activeCustomerDetailsOrder.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
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
                        placeholder={String(activeCustomerDetailsOrder.total)}
                        className={`w-full pl-8 pr-3 py-2.5 text-sm font-black text-neutral-900 bg-white border ${paymentError ? 'border-red-500 focus:border-red-600 ring-2 ring-red-200' : 'border-emerald-300 focus:border-emerald-600'} rounded-xl focus:outline-none transition-all placeholder-neutral-300 shadow-2xs`}
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
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-200 font-semibold">
                        <span className="text-neutral-600">
                          {parseFloat(riderReceivedAmount) >= activeCustomerDetailsOrder.total ? 'Change due to customer:' : 'Short payment balance:'}
                        </span>
                        <span className={`font-mono font-black ${parseFloat(riderReceivedAmount) >= activeCustomerDetailsOrder.total ? 'text-emerald-700 text-sm' : 'text-amber-600 text-sm'}`}>
                          {parseFloat(riderReceivedAmount) >= activeCustomerDetailsOrder.total
                            ? `₱${(parseFloat(riderReceivedAmount) - activeCustomerDetailsOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `Short by ₱${(activeCustomerDetailsOrder.total - parseFloat(riderReceivedAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!riderReceivedAmount.trim() || isNaN(parseFloat(riderReceivedAmount))) {
                        setPaymentError('Please enter the payment amount received from customer (or tap "Exact").')
                        return
                      }
                      const parsed = parseFloat(riderReceivedAmount)
                      if (parsed < 0) {
                        setPaymentError('Payment amount cannot be negative.')
                        return
                      }
                      setPaymentError(null)
                      void handleUpdateStatus(activeCustomerDetailsOrder.id, 'Completed', parsed)
                    }}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Mark Delivered & Paid</span>
                  </button>
                </div>
              )}

              {activeCustomerDetailsOrder.status === 'Completed' && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-bold text-neutral-800">
                    <span>Payment Received by Rider:</span>
                    <span className="font-mono text-emerald-700 text-sm font-black">
                      ₱{Number(activeCustomerDetailsOrder.riderCashReceived ?? activeCustomerDetailsOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {activeCustomerDetailsOrder.riderCashReceived !== undefined && activeCustomerDetailsOrder.riderCashReceived > activeCustomerDetailsOrder.total && (
                    <div className="flex justify-between items-center text-[11px] text-neutral-500 font-semibold">
                      <span>Change Given to Customer:</span>
                      <span className="font-mono text-neutral-700">
                        ₱{(activeCustomerDetailsOrder.riderCashReceived - activeCustomerDetailsOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60">
                    <span>Delivery Status:</span>
                    <span className="font-bold text-emerald-600 uppercase">Delivered & Completed</span>
                  </div>
                </div>
              )}
              {activeCustomerDetailsOrder.status !== 'Ready'
                && activeCustomerDetailsOrder.status !== 'Out for Delivery'
                && activeCustomerDetailsOrder.status !== 'Completed' && (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-xl bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-500"
                  >
                    Waiting for Kitchen
                  </button>
                )}
              {isAdmin && !activeCustomerDetailsOrder.id.startsWith('DEMO-RIDER-') && (
                <div className="flex gap-2 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingRiderOrder(activeCustomerDetailsOrder)}
                    className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                  >
                    Edit Order
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteRiderOrder(activeCustomerDetailsOrder.id)}
                    className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Delete Order
                  </button>
                </div>
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
    </div>
  )
}

export default RideRoleDemo

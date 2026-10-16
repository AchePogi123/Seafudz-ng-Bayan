import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NavbarRider } from '../components/Navbarrider'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import {
  haversineDistanceKm,
  calculateRoadDistanceKm,
  calculateTravelMinutes,
  geocodeAddress,
  findSmartDeliveryBatches,
  SEAFUDZ_FLAGSHIP_STORE,
  METRO_MANILA_LOCATIONS,
  type GeoCoordinate,
  type DeliveryJob,
  type DeliveryBatch,
} from '../utils/riderDispatchAlgorithms'

/**
 * In-App Leaflet Radar Map Component
 * Renders the store, rider current GPS position, and customer dropoff pin
 * with an interactive connecting route trajectory. 100% client-side & API-free.
 */
const RiderRadarMap: React.FC<{
  riderLocation: GeoCoordinate
  storeLocation: GeoCoordinate
  destination: GeoCoordinate | null
}> = ({ riderLocation, storeLocation, destination }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [riderLocation.lat, riderLocation.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      layersRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    }

    const map = mapRef.current
    const layers = layersRef.current
    if (!map || !layers) return

    layers.clearLayers()

    // 1. Store Marker
    const storeIcon = L.divIcon({
      className: 'store-pin',
      html: `<div style="background:#ff7b00;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(255,123,0,0.4);border:2px solid white;font-size:14px;font-weight:bold;">🏪</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    })
    L.marker([storeLocation.lat, storeLocation.lng], { icon: storeIcon })
      .bindPopup(`<b>${storeLocation.label || 'Seafudz Flagship Store'}</b><br>Caloocan Main Branch`)
      .addTo(layers)

    // 2. Rider Current Location Marker
    const riderIcon = L.divIcon({
      className: 'rider-pin',
      html: `<div style="background:#0284c7;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 5px rgba(2,132,199,0.25);border:2px solid white;font-size:15px;">🏍️</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })
    L.marker([riderLocation.lat, riderLocation.lng], { icon: riderIcon })
      .bindPopup(`<b>Rider Current Position</b><br>${riderLocation.label || 'Current GPS'}`)
      .addTo(layers)

    const points: [number, number][] = [
      [storeLocation.lat, storeLocation.lng],
      [riderLocation.lat, riderLocation.lng],
    ]

    // 3. Customer Destination Marker & Route Line
    if (destination) {
      const destIcon = L.divIcon({
        className: 'dest-pin',
        html: `<div style="background:#059669;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(5,150,105,0.4);border:2px solid white;font-size:14px;">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      L.marker([destination.lat, destination.lng], { icon: destIcon })
        .bindPopup(`<b>Customer Destination</b><br>${destination.label || 'Delivery Stop'}`)
        .addTo(layers)

      points.push([destination.lat, destination.lng])

      // In-app dashed route polyline from Rider to Customer
      L.polyline(
        [
          [riderLocation.lat, riderLocation.lng],
          [destination.lat, destination.lng],
        ],
        {
          color: '#ff7b00',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
        }
      ).addTo(layers)
    }

    if (points.length > 1) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 16 })
    }

    setTimeout(() => {
      map.invalidateSize()
    }, 150)
  }, [riderLocation, storeLocation, destination])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} className="w-full h-44 sm:h-52 rounded-2xl overflow-hidden z-10 border border-neutral-200 shadow-inner" />
}

export const RideRoleDemo: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  const [rawDeliveries, setRawDeliveries] = useState<DeliveryJob[]>([])
  const [selectedOrder, setSelectedOrder] = useState<DeliveryJob | null>(null)
  const [activeTab, setActiveTab] = useState<'All' | 'Ready' | 'Out for Delivery' | 'Completed' | 'Smart Batches'>('Ready')
  const [notification, setNotification] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'proximity' | 'newest'>('proximity')

  // Rider GPS Position State
  const [locationMode, setLocationMode] = useState<'simulated' | 'device'>('simulated')
  const [selectedLandmark, setSelectedLandmark] = useState<string>('monumento')
  const [riderLocation, setRiderLocation] = useState<GeoCoordinate>(
    METRO_MANILA_LOCATIONS['monumento'] || SEAFUDZ_FLAGSHIP_STORE
  )

  // Handle GPS location selection
  useEffect(() => {
    if (locationMode === 'device' && 'geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setRiderLocation({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            label: 'Live Device GPS',
          })
        },
        (err) => {
          console.warn('Geolocation access failed:', err.message)
          setLocationMode('simulated')
          setNotification('Could not access device GPS. Switched to simulated landmark.')
        },
        { enableHighAccuracy: true }
      )
      return () => navigator.geolocation.clearWatch(watchId)
    } else if (locationMode === 'simulated') {
      const landmark = METRO_MANILA_LOCATIONS[selectedLandmark] || SEAFUDZ_FLAGSHIP_STORE
      setRiderLocation({
        lat: landmark.lat,
        lng: landmark.lng,
        label: landmark.label || selectedLandmark,
      })
    }
  }, [locationMode, selectedLandmark])

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingRiderOrder, setEditingRiderOrder] = useState<any | null>(null)

  const handleDeleteRiderOrder = async (orderId: string) => {
    const confirmDelete = window.confirm(`⚠️ Admin Action: Are you sure you want to permanently delete Delivery #${orderId}? This will remove it from the PostgreSQL DB.`)
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

    if (selectedOrder?.id === orderId) setSelectedOrder(null)
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
              const coord = geocodeAddress(address)

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || o.customerName || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items: o.items || [],
                total: o.total || 0,
                status: displayStatus,
                createdAt: o.createdAt || new Date().toISOString(),
                paymentMethod: o.paymentMethod || 'GCash',
                coord,
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
              const coord = geocodeAddress(address)

              combinedMap.set(id, {
                id,
                ref: id,
                customer: o.customer || 'Online Customer',
                phone: o.phone || '0917-000-0000',
                address,
                items,
                total: Number(o.total || 0),
                status: displayStatus,
                createdAt: o.dateTime || 'Just now',
                paymentMethod: o.paymentMethod || 'GCash',
                coord,
              })
            })
          }
        }
      } catch (e) {
        console.warn('Rider LocalStorage note:', e)
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
    setSelectedOrder((prev) => (prev?.id === orderId ? null : prev))
    setNotification(`Order ${orderId} removed from Rider view (UI only).`)
  }

  // Rider updates status to Out for Delivery or Delivered/Completed
  const handleUpdateStatus = async (orderId: string, newStatus: 'Out for Delivery' | 'Completed') => {
    const apiStatus = newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : 'COMPLETED'

    // Update in LocalStorage
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.map((o: any) =>
        o.id === orderId || o.ref === orderId ? { ...o, status: apiStatus } : o
      )
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))

      const savedActive = localStorage.getItem('seafudz_active_online_order')
      if (savedActive) {
        const activeObj = JSON.parse(savedActive)
        if (activeObj && (activeObj.id === orderId || activeObj.ref === orderId)) {
          localStorage.setItem('seafudz_active_online_order', JSON.stringify({ ...activeObj, status: apiStatus }))
        }
      }

      notifyOrderSync()
    } catch {}

    // Update in backend API
    try {
      await fetch(`${API_BASE_URL}/user-flow/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus }),
      })
    } catch {}

    setRawDeliveries((prev) =>
      prev.map((d) => (d.id === orderId ? { ...d, status: newStatus } : d))
    )

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus })
    }

    setNotification(`Order status updated to "${newStatus}"!`)
  }

  // Handle batch delivery start (Clarke-Wright batch accepted)
  const handleStartBatchDelivery = async (batch: DeliveryBatch) => {
    for (const order of batch.orders) {
      await handleUpdateStatus(order.id, 'Out for Delivery')
    }
    setNotification(`🚀 Smart Batch Started! 2 orders bundled. Est. savings: ${batch.savingsKm} km (${batch.savingsMinutes} mins).`)
  }

  // Enriched deliveries with live Haversine calculations & distance from current rider position
  const algorithmicDeliveries = useMemo<DeliveryJob[]>(() => {
    return rawDeliveries.map((d) => {
      const coord = d.coord || geocodeAddress(d.address)
      const straightDistanceKm = Number(haversineDistanceKm(riderLocation, coord).toFixed(2))
      const roadDistanceKm = calculateRoadDistanceKm(straightDistanceKm)
      const estimatedMinutes = calculateTravelMinutes(roadDistanceKm)
      return {
        ...d,
        coord,
        straightDistanceKm,
        roadDistanceKm,
        estimatedMinutes,
      }
    })
  }, [rawDeliveries, riderLocation])

  // Smart Batches calculated using Clarke-Wright Savings algorithm
  const smartBatches = useMemo<DeliveryBatch[]>(() => {
    return findSmartDeliveryBatches(algorithmicDeliveries, SEAFUDZ_FLAGSHIP_STORE, 3.2)
  }, [algorithmicDeliveries])

  // Filter & sort deliveries
  const filteredDeliveries = useMemo(() => {
    const list = algorithmicDeliveries.filter((d) => {
      if (hiddenOrderIds.has(d.id) || hiddenOrderIds.has(d.ref)) return false
      if (activeTab === 'Smart Batches') return false
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
      // Sort nearest to rider first using computed Haversine road km
      return list.sort((a, b) => (a.roadDistanceKm || 0) - (b.roadDistanceKm || 0))
    }
    return list
  }, [algorithmicDeliveries, activeTab, searchQuery, hiddenOrderIds, sortBy])

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
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null
    return algorithmicDeliveries.find((d) => d.id === selectedOrder.id) || selectedOrder
  }, [selectedOrder, algorithmicDeliveries])

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

        {/* Algorithm Radar & GPS Position Bar */}
        <div className="bg-white border border-neutral-200 p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-extrabold text-neutral-700">🏍️ Rider Location:</span>

            <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
              <button
                onClick={() => setLocationMode('simulated')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  locationMode === 'simulated' ? 'bg-[#ff7b00] text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                📍 Landmark
              </button>
              <button
                onClick={() => setLocationMode('device')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  locationMode === 'device' ? 'bg-emerald-600 text-white shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                🛰️ Live GPS
              </button>
            </div>

            {locationMode === 'simulated' && (
              <select
                value={selectedLandmark}
                onChange={(e) => setSelectedLandmark(e.target.value)}
                className="bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="monumento">Monumento Circle, Caloocan</option>
                <option value="grace park">Grace Park East, Caloocan</option>
                <option value="bagong barrio">Bagong Barrio, Caloocan</option>
                <option value="balintawak">Balintawak Cloverleaf, QC</option>
                <option value="potrero">Potrero, Malabon</option>
                <option value="valenzuela">Valenzuela City Hall</option>
                <option value="sm north">SM City North EDSA, QC</option>
              </select>
            )}

            <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">
              ({riderLocation.lat.toFixed(4)}°N, {riderLocation.lng.toFixed(4)}°E)
            </span>
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
              📍 Nearest First (Haversine)
            </button>
            <button
              onClick={() => setSortBy('newest')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                sortBy === 'newest'
                  ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-2xs'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              🕒 Newest First
            </button>
          </div>
        </div>

        {/* 4-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {/* Main Delivery List (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Search and Tabs Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-neutral-200 shadow-2xs overflow-x-auto">
                {(['Ready', 'All', 'Out for Delivery', 'Completed', 'Smart Batches'] as const).map((tab) => {
                  const isBatches = tab === 'Smart Batches'
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        activeTab === tab
                          ? isBatches
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[#ff7b00] text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                    >
                      {isBatches ? (
                        <>
                          <span>⚡ Smart Batches</span>
                          {smartBatches.length > 0 && (
                            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                              {smartBatches.length}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>{tab} Orders</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Search Bar & Admin Create Button */}
              <div className="flex items-center gap-2 min-w-[240px]">
                {isAdmin && (
                  <button
                    onClick={() => setIsAdminCreateOpen(true)}
                    className="px-4 py-2.5 rounded-2xl bg-[#ff7b00] hover:bg-[#e06c00] text-white font-extrabold text-xs transition-all cursor-pointer whitespace-nowrap shadow-md shadow-orange-500/20 active:scale-95"
                  >
                    ➕ Create Delivery
                  </button>
                )}
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
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* TAB CONTENT: Smart Batches View (Clarke-Wright Savings) */}
            {activeTab === 'Smart Batches' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="font-black text-emerald-900 text-sm">Grab & Foodpanda Multi-Drop Smart Batching</h4>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      Using the <strong>Clarke-Wright Savings Algorithm</strong>, candidate orders within <strong>3.2 km</strong> of each other are automatically grouped into a single combined run. Riders save fuel, eliminate backtracking, and double their delivery efficiency.
                    </p>
                  </div>
                </div>

                {smartBatches.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center text-neutral-400">
                    <h3 className="font-bold text-neutral-700">No overlapping delivery batches right now.</h3>
                    <p className="text-xs mt-1">
                      When 2 or more orders have nearby dropoffs (within 3.2 km), our spatial cluster algorithm will stack them here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {smartBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs hover:shadow-md transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                          <div>
                            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                              STACKED RUN • {batch.id}
                            </span>
                            <h4 className="font-black text-neutral-800 text-sm mt-0.5">2 Orders Combined</h4>
                          </div>
                          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-black">
                            ⚡ Saves {batch.savingsKm} km (~{batch.savingsMinutes} mins)
                          </span>
                        </div>

                        {/* Route Sequence Preview */}
                        <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-2 text-xs">
                          <p className="font-bold text-neutral-500 text-[10px] uppercase">Optimal Delivery Sequence (TSP):</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                              <span className="font-semibold text-neutral-800 truncate">{batch.optimizedSequence[0].customer}</span>
                              <span className="text-[10px] text-neutral-400 ml-auto shrink-0">{batch.optimizedSequence[0].address}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                              <span className="font-semibold text-neutral-800 truncate">{batch.optimizedSequence[1].customer}</span>
                              <span className="text-[10px] text-neutral-400 ml-auto shrink-0">{batch.optimizedSequence[1].address}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-neutral-500 font-medium">
                            Combined Distance: <strong className="text-neutral-800">{batch.totalRoadKm} km</strong> • <strong className="text-neutral-800">~{batch.estimatedMinutes} mins</strong>
                          </span>
                          <span className="font-black text-orange-600 text-sm">
                            ₱{(batch.orders[0].total + batch.orders[1].total).toLocaleString()}
                          </span>
                        </div>

                        <button
                          onClick={() => handleStartBatchDelivery(batch)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-98"
                        >
                          <span>🚀 Accept Stacked Batch (Deliver Both)</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB CONTENT: Standard Delivery Cards Grid with Haversine Metrics */
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
                    const isSelected = activeSelectedOrder?.id === ord.id

                    return (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                          isSelected
                            ? 'border-[#ff7b00] ring-2 ring-orange-500/20'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Ref: {ord.ref}</span>
                            <h4 className="text-base font-black text-neutral-800 leading-tight mt-0.5">{ord.customer}</h4>
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

                        {/* Algorithmic Proximity & ETA Badge */}
                        <div className="pt-2.5 pb-1 flex items-center justify-between text-xs">
                          <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 font-extrabold px-2.5 py-1 rounded-lg text-[11px]">
                            <span>📍 {ord.roadDistanceKm} km</span>
                            <span className="text-orange-300">•</span>
                            <span>⏱ ~{ord.estimatedMinutes} mins via motorcycle</span>
                          </div>
                        </div>

                        <div className="py-2 text-xs text-neutral-600 space-y-1">
                          <p className="truncate"><span className="font-medium text-neutral-700">📍 {ord.address}</span></p>
                          <p className="truncate"><span className="font-medium text-neutral-700">{ord.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}</span></p>
                        </div>

                        <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs font-bold">
                          <span className="text-[#ff7b00] text-sm">₱{ord.total.toLocaleString()}</span>
                          <span className="text-neutral-400 font-medium text-[11px]">{ord.createdAt}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Pagination Controls */}
            {activeTab !== 'Smart Batches' && filteredDeliveries.length > ITEMS_PER_PAGE && (
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

          {/* Right Details Panel (1 col) with Embedded In-App Leaflet Radar Map */}
          <div className="lg:col-span-1 bg-white p-5 rounded-3xl border border-neutral-200 shadow-xs space-y-4">
            <h3 className="font-black text-base text-neutral-800 tracking-tight border-b border-neutral-100 pb-3 flex items-center justify-between">
              <span>Rider Dispatch Details</span>
              {activeSelectedOrder && (
                <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {activeSelectedOrder.roadDistanceKm} km
                </span>
              )}
            </h3>

            {!activeSelectedOrder ? (
              <div className="space-y-4">
                <div className="text-center py-6 text-neutral-400 text-xs">
                  Select an order to inspect route geometry, travel ETA, and update delivery status.
                </div>
                {/* Fallback Radar Map showing Rider Position & Store */}
                <RiderRadarMap
                  riderLocation={riderLocation}
                  storeLocation={SEAFUDZ_FLAGSHIP_STORE}
                  destination={null}
                />
              </div>
            ) : (
              <div className="space-y-4 text-xs font-medium text-neutral-700">
                {/* In-App Interactive Radar Map with Route Trajectory */}
                <RiderRadarMap
                  riderLocation={riderLocation}
                  storeLocation={SEAFUDZ_FLAGSHIP_STORE}
                  destination={activeSelectedOrder.coord}
                />

                {/* Mathematical Haversine & ETA Breakdown */}
                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200 space-y-1.5 text-[11px]">
                  <p className="font-extrabold text-neutral-700 uppercase text-[10px] tracking-wider">Algorithmic Route Metrics:</p>
                  <div className="grid grid-cols-2 gap-2 text-neutral-600">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Great-Circle (Air):</span>
                      <strong className="text-neutral-800">{activeSelectedOrder.straightDistanceKm} km</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Urban Road (1.32x):</span>
                      <strong className="text-orange-600">{activeSelectedOrder.roadDistanceKm} km</strong>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-neutral-200/60 flex items-center justify-between font-bold text-neutral-700">
                    <span>Motorcycle Velocity ETA:</span>
                    <span className="text-emerald-700 font-black">~{activeSelectedOrder.estimatedMinutes} mins</span>
                  </div>
                </div>

                <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-orange-600 text-sm">{activeSelectedOrder.ref}</span>
                    <span className="bg-white px-2 py-0.5 rounded font-bold text-[10px] text-neutral-600 uppercase border border-orange-200">{activeSelectedOrder.paymentMethod}</span>
                  </div>
                  <p className="font-bold text-neutral-800">{activeSelectedOrder.customer}</p>
                  <p className="text-neutral-500">Phone: {activeSelectedOrder.phone}</p>
                  <p className="text-neutral-600 mt-1">Address: {activeSelectedOrder.address}</p>
                </div>

                <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100 space-y-1.5">
                  <p className="font-bold text-neutral-700">Items to Deliver:</p>
                  {activeSelectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{it.name}</span>
                      <span className="font-bold">x{it.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-1.5 flex justify-between font-extrabold text-orange-600">
                    <span>Collect Payment:</span>
                    <span>₱{activeSelectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Rider Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  {activeSelectedOrder.status !== 'Out for Delivery' && activeSelectedOrder.status !== 'Completed' && (
                    <>
                      {activeSelectedOrder.status !== 'Ready' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center space-y-1">
                          <p className="text-xs font-bold text-amber-800 flex items-center justify-center gap-1.5">
                            Cooking in Kitchen
                          </p>
                          <p className="text-[11px] text-amber-600">
                            Cannot start delivery yet. Please wait for the kitchen to mark the order as <strong>"Ready / Done"</strong>.
                          </p>
                          <button
                            disabled
                            className="w-full bg-neutral-200 text-neutral-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed mt-2"
                          >
                            Start Delivery (Waiting for Kitchen)
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(activeSelectedOrder.id, 'Out for Delivery')}
                          className="w-full bg-[#ff7b00] hover:bg-[#e66f00] text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 cursor-pointer transition-all hover:scale-101"
                        >
                          Start Delivery (Out for Delivery)
                        </button>
                      )}
                    </>
                  )}

                  {activeSelectedOrder.status === 'Out for Delivery' && (
                    <button
                      onClick={() => handleUpdateStatus(activeSelectedOrder.id, 'Completed')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all hover:scale-101"
                    >
                      Mark as Delivered & Completed
                    </button>
                  )}

                  <button
                    onClick={() => handleHideOrder(activeSelectedOrder.id)}
                    className="w-full bg-neutral-100 hover:bg-red-50 text-neutral-600 hover:text-red-700 font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-neutral-200 hover:border-red-200"
                  >
                    Remove Order from Rider View (UI only)
                  </button>

                  {isAdmin && (
                    <div className="pt-3 border-t border-amber-200 bg-amber-50 p-3.5 rounded-2xl space-y-2">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Admin Override Controls:</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingRiderOrder(activeSelectedOrder)}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
                        >
                          ✏️ Edit Delivery
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRiderOrder(activeSelectedOrder.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADMIN CRUD MODALS */}
      <AdminCreateTransactionModal
        isOpen={isAdminCreateOpen}
        onClose={() => setIsAdminCreateOpen(false)}
        onCreated={() => void fetchDeliveries(true)}
      />

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

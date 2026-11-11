import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import NavbarKitchen from '../components/NavbarKitchen'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { notifyOrderSync, subscribeOrderSync } from '../utils/orderSync'
import { useProductImages } from '../utils/useProductImages'
import { useMenuAvailability } from '../utils/menuAvailability'
import KitchenStockPanel from '../components/KitchenStockPanel'

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
  notes?: string
  total?: number
  createdAt?: string
  paymentMethod?: string
  startTime?: number | null
  completedTimeElapsed?: string
}

export const KitchenMode: React.FC = () => {
  const currentUser = getActiveUser()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'
  const { menuItems } = useProductImages()
  const { setAvailability } = useMenuAvailability()

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [isStockPanelOpen, setIsStockPanelOpen] = useState<boolean>(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Out-of-Stock flagging states
  const [outOfStockModalOrderId, setOutOfStockModalOrderId] = useState<string | null>(null)
  const [selectedOosItemIds, setSelectedOosItemIds] = useState<number[]>([])
  const [isSubmittingOos, setIsSubmittingOos] = useState(false)

  // Admin CRUD Modal states
  const [isAdminCreateOpen, setIsAdminCreateOpen] = useState(false)
  const [editingKitchenOrder, setEditingKitchenOrder] = useState<any | null>(null)

  const handleDeleteKitchenOrder = async (orderId: string) => {
    const confirmDelete = window.confirm(`⚠️ Admin Action: Are you sure you want to permanently delete Kitchen Order #${orderId}? This will remove it from the database.`)
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

  const getPrepTimeDisplay = (order: KitchenOrder) => {
    if (order.status === 'Preparing' && order.startTime) {
      const elapsedSec = Math.floor((now - order.startTime) / 1000)
      const mins = Math.floor(elapsedSec / 60)
      const secs = elapsedSec % 60
      return `${mins}:${secs < 10 ? '0' : ''}${secs}s`
    }
    if (order.completedTimeElapsed) {
      return order.completedTimeElapsed
    }
    return '--'
  }

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
      await Promise.allSettled([
        fetch(`${API_BASE_URL}/kitchen/orders/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: normalizedTarget }),
        }),
        fetch(`${API_BASE_URL}/user-flow/orders/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: normalizedTarget }),
        }),
      ])
    } catch (err) {
      console.warn('[KITCHEN] Note on updating status with backend:', err)
    } finally {
      notifyOrderSync()
    }
  }



  const handleStatusFromModal = (newStatus: string) => {
    if (selectedOrderId) {
      updateOrderStatus(selectedOrderId, newStatus)
      setSelectedOrderId(null)
    }
  }

  const outOfStockOrder = orders.find((o) => o.id === outOfStockModalOrderId)

  const canOrderBeFlaggedOos = useCallback((order: KitchenOrder): boolean => {
    const activeItems = (order.items || []).filter(
      (item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase())
    )
    return activeItems.length > 0
  }, [])

  // Out-of-stock flagging handler
  const handleFlagOutOfStock = async () => {
    if (!outOfStockModalOrderId || selectedOosItemIds.length === 0) return

    setIsSubmittingOos(true)

    try {
      const res = await fetch(`${API_BASE_URL}/kitchen/orders/${outOfStockModalOrderId}/flag-out-of-stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedOosItemIds }),
      })

      if (res.ok) {
        // Automatically mark flagged dishes as Out of Stock for all users
        const selectedProducts = outOfStockOrder?.items
          .filter((item, index) => selectedOosItemIds.includes(item.id || index + 1))
          .map((item) => item.productId || menuItems.find(
            (product) => product.name.toLowerCase() === item.name.toLowerCase()
          )?.id)
          .filter((productId): productId is string => Boolean(productId));

        if (selectedProducts && selectedProducts.length > 0) {
          void Promise.all(
            selectedProducts.map((productId) => setAvailability(productId, false))
          );
        }
        // Update local state immediately
        setOrders((prev) =>
          prev.map((o) =>
            o.id === outOfStockModalOrderId
              ? { ...o, status: 'Out of Stock' }
              : o
          )
        )

        // Update localStorage
        try {
          const flaggedOosItems = (outOfStockOrder?.items || []).filter((item, index) =>
            selectedOosItemIds.includes(item.id || index + 1)
          )
          const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
          const updated = existing.map((o: any) =>
            (o.id === outOfStockModalOrderId || o.ref === outOfStockModalOrderId)
              ? { ...o, status: 'OUT_OF_STOCK', outOfStockItems: flaggedOosItems.length > 0 ? flaggedOosItems : (outOfStockOrder?.items || []) }
              : o
          )
          localStorage.setItem('seafudz_orders', JSON.stringify(updated))
          notifyOrderSync()
        } catch {}
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.message || 'Failed to flag items as out of stock.')
      }
    } catch (err) {
      console.error('Error flagging out of stock:', err)
      alert('Network error. Please try again.')
    } finally {
      setIsSubmittingOos(false)
      setOutOfStockModalOrderId(null)
      setSelectedOosItemIds([])
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

  return (
    <div className="min-h-screen bg-[#faf9f6] p-3 sm:p-4 lg:p-6 transition-all duration-300 pb-16">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarKitchen />

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-extrabold text-neutral-900">Kitchen Display Board</h1>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsAdminCreateOpen(true)}
                className="bg-[#ff7a00] hover:bg-[#e66e00] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>➕</span> Create Ticket (Admin)
              </button>
            )}

            <button
              onClick={() => setIsStockPanelOpen(true)}
              className="flex items-center gap-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="See what the kitchen can still make"
            >
              Menu stock
            </button>

            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title="View Processed Orders"
            >
              <span>Processed order</span>
              {processedOrders.length > 0 && (
                <span className="bg-orange-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full">
                  {processedOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2 Sections Live Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          {/* Section 1: Queue Column */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs flex flex-col max-h-[600px] lg:max-h-[calc(100vh-190px)] lg:h-[calc(100vh-190px)] min-h-[440px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4 shrink-0">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400"></span>
                Kitchen Queue
              </h2>
              <span className="bg-neutral-100 text-neutral-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                {queueOrders.length} Waiting
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 overscroll-contain custom-scrollbar">
              {queueOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none">
                  <p className="text-xs font-medium">No queued orders</p>
                </div>
              ) : (
                queueOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-neutral-200/80 transition-all flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                            {String(order.category || order.type || '').toUpperCase().includes('PICKUP') && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🛍️ STORE PICK-UP
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-extrabold text-neutral-900 mt-0.5">
                            {order.customer || 'Customer'}
                          </div>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                      </div>

                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items
                          .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                          .map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{item.name}</span>
                            </div>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes ? (
                        <div className="bg-red-50 border border-red-200 text-red-800 font-bold text-xs p-2.5 rounded-xl mb-3 flex items-center gap-1.5">
                          <span>Note: {order.notes}</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-neutral-400 italic mb-2">No special instructions</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Preparing')}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
                      >
                        Start Cooking
                      </button>
                      {canOrderBeFlaggedOos(order) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setOutOfStockModalOrderId(order.id); setSelectedOosItemIds([]); }}
                          className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 px-3 rounded-lg text-xs cursor-pointer border border-red-200 transition-colors"
                          title="Flag items as out of stock"
                        >
                          ⚠️ OOS
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Processing Column */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-2xs flex flex-col max-h-[600px] lg:max-h-[calc(100vh-190px)] lg:h-[calc(100vh-190px)] min-h-[440px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 mb-4 shrink-0">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
                On Processing
              </h2>
              <span className="bg-orange-50 text-orange-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                {processingOrders.length} Cooking
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 overscroll-contain custom-scrollbar">
              {processingOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none">
                  <p className="text-xs font-medium">No orders in preparation</p>
                </div>
              ) : (
                processingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-[#faf9f6] hover:bg-neutral-100/80 rounded-xl p-4 border border-orange-200/80 transition-all flex flex-col justify-between"
                  >
                    <div onClick={() => setSelectedOrderId(order.id)} className="cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                            {String(order.category || order.type || '').toUpperCase().includes('PICKUP') && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🛍️ STORE PICK-UP
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-extrabold text-neutral-900 mt-0.5">
                            {order.customer || 'Customer'}
                          </div>
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                      </div>

                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items
                          .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                          .map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{item.name}</span>
                            </div>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0">
                              x{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="bg-red-50 border border-red-200 text-red-800 font-bold text-xs p-2.5 rounded-xl mb-2 flex items-center gap-1.5">
                          <span>Note: {order.notes}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs mb-3">
                        <span className="text-neutral-400 font-medium">Prep Timer:</span>
                        <span className="font-bold text-xs text-orange-600">{getPrepTimeDisplay(order)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => updateOrderStatus(order.id, 'Ready')}
                        className="flex-1 bg-neutral-900 hover:bg-black text-white font-bold py-2.5 rounded-lg text-xs cursor-pointer"
                      >
                        Mark as Done
                      </button>
                      {canOrderBeFlaggedOos(order) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setOutOfStockModalOrderId(order.id); setSelectedOosItemIds([]); }}
                          className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 px-3 rounded-lg text-xs cursor-pointer border border-red-200 transition-colors"
                          title="Flag items as out of stock"
                        >
                          ⚠️ OOS
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

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
                ✕
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
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedOrder.customer && (
                <div>
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Customer</h4>
                  <div className="text-sm font-semibold text-neutral-900">{selectedOrder.customer}</div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Order Items</h4>
                <div className="bg-[#faf9f6] rounded-xl border border-neutral-200/80 p-3.5">
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
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteKitchenOrder(selectedOrder.id)
                        setSelectedOrderId(null)
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs cursor-pointer shadow-2xs"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OUT OF STOCK MODAL */}
      {outOfStockModalOrderId && outOfStockOrder && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-red-200">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold">⚠️ Flag Out of Stock</h3>
                <p className="text-xs text-red-100 mt-0.5">Order #{outOfStockOrder.queue}</p>
              </div>
              <button
                onClick={() => { setOutOfStockModalOrderId(null); setSelectedOosItemIds([]); }}
                className="text-white font-bold w-8 h-8 rounded-full hover:bg-red-700 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-neutral-600 font-medium">
                Select which items are currently unavailable. The order will be paused and the assistant will be notified to coordinate with the customer.
              </p>

              <div className="space-y-2">
                {outOfStockOrder.items
                  .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                  .map((item, idx) => {
                  const itemId = item.id || idx + 1
                  const isSelected = selectedOosItemIds.includes(itemId)
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-red-50 border-red-300 ring-1 ring-red-200 cursor-pointer'
                          : 'bg-[#faf9f6] border-neutral-200 hover:border-neutral-300 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedOosItemIds((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== itemId)
                              : [...prev, itemId]
                          )
                        }}
                        className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-neutral-900">{item.name}</span>
                        </div>
                        {item.price ? (
                          <div className="text-[11px] text-neutral-500">₱{item.price?.toFixed(2)} × {item.quantity}</div>
                        ) : null}
                      </div>
                      <span className="bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded text-[11px] font-bold">
                        x{item.quantity}
                      </span>
                    </label>
                  )
                })}
              </div>



              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setOutOfStockModalOrderId(null); setSelectedOosItemIds([]); }}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFlagOutOfStock}
                  disabled={selectedOosItemIds.length === 0 || isSubmittingOos}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    selectedOosItemIds.length === 0 || isSubmittingOos
                      ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {isSubmittingOos ? 'Flagging...' : `Flag ${selectedOosItemIds.length} Item${selectedOosItemIds.length !== 1 ? 's' : ''} as Out of Stock`}
                </button>
              </div>
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
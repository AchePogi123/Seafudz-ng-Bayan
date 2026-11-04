import React, { useState, useEffect, useRef, useMemo } from 'react'
import NavbarKitchen from '../components/NavbarKitchen'
import { API_BASE_URL } from '../utils/api'
import { getActiveUser, getStoredSessionToken } from '../cryptography/cryptoSession'
import { AdminCreateTransactionModal } from '../components/AdminCreateTransactionModal'
import { AdminEditTransactionModal } from '../components/AdminEditTransactionModal'
import { notifyOrderSync, subscribeOrderSync, notifyProductCatalogSync } from '../utils/orderSync'
import { useProductImages } from '../utils/useProductImages'
import { useMenuAvailability, applyProductAvailabilityChange, applyProductServingsChange, PRODUCT_ALIASES } from '../utils/menuAvailability'
import { CLIENT_CATEGORIES } from '../components/MenuCard'
import { getProductQuantityStandard } from '../utils/bulkOrder'

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
  const canManageStock = ['kitchen', 'admin'].includes(currentUser?.role?.toLowerCase() || '')
  const { menuItems } = useProductImages()
  const { isAvailable, unavailableIds, setAvailability } = useMenuAvailability()

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false)
  const [now, setNow] = useState<number>(() => Date.now())

  // Out-of-Stock flagging states
  const [outOfStockModalOrderId, setOutOfStockModalOrderId] = useState<string | null>(null)
  const [selectedOosItemIds, setSelectedOosItemIds] = useState<number[]>([])
  const [isSubmittingOos, setIsSubmittingOos] = useState(false)
  const [isStockDrawerOpen, setIsStockDrawerOpen] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stockCategory, setStockCategory] = useState('All Menu')
  const [stockError, setStockError] = useState('')

  // Kitchen Quantity Standards & Approvals state
  const [approvalOrders, setApprovalOrders] = useState<any[]>([])
  const [isProcessingApproval, setIsProcessingApproval] = useState<string | null>(null)
  const [servingsMap, setServingsMap] = useState<Record<string, number | null>>({})
  const [servingsInputs, setServingsInputs] = useState<Record<string, string>>({})
  const [savingServingsId, setSavingServingsId] = useState<string | null>(null)
  const [servingsSuccessId, setServingsSuccessId] = useState<string | null>(null)

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

          // Critical: Orders awaiting kitchen quantity approval or rejected MUST NEVER appear in the cooking queue
          const isApprovalPending = rawStatus === 'AWAITING_KITCHEN_APPROVAL'
            || rawStatus === 'KITCHEN_REJECTED'
            || o.kitchen_approval_status === 'PENDING'
            || o.kitchenApprovalStatus === 'PENDING'
            || (o.requires_kitchen_approval === true && o.kitchen_approval_status !== 'APPROVED')
            || (o.requiresKitchenApproval === true && o.kitchenApprovalStatus !== 'APPROVED')

          if (isApprovalPending) {
            return false
          }

          // Online delivery orders MUST NOT appear in kitchen until verified & confirmed by Assistant (status becomes CONFIRMED)
          const unconfirmedStatuses = [
            'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
            'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
            'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT', 'CANCELLED',
            'AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED'
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

          const customerName = typeof o.customer === 'string' && o.customer.trim()
            ? o.customer.trim()
            : typeof o.customerName === 'string' && o.customerName.trim()
            ? o.customerName.trim()
            : undefined

          const rawType = (o.type || o.order_type || 'Take Out').trim()
          const formatCategory = o.table ? `Dine In - ${o.table}` : (rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType)

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

                // Critical: Orders awaiting kitchen quantity approval or rejected MUST NEVER appear in the cooking queue
                const isApprovalPending = raw === 'AWAITING_KITCHEN_APPROVAL'
                  || raw === 'KITCHEN_REJECTED'
                  || o.kitchen_approval_status === 'PENDING'
                  || o.kitchenApprovalStatus === 'PENDING'
                  || (o.requires_kitchen_approval === true && o.kitchen_approval_status !== 'APPROVED')
                  || (o.requiresKitchenApproval === true && o.kitchenApprovalStatus !== 'APPROVED')

                if (isApprovalPending) {
                  return false
                }

                const unconfirmedStatuses = [
                  'PENDING', 'FLAGGED', 'UNCONFIRMED', 'AWAITING_VERIFICATION', 'UNVERIFIED',
                  'NEW', 'ORDER PLACED', 'GCASH_PENDING_APPROVAL', 'GCASH_AUTHORIZED',
                  'RECEIPT_SUBMITTED', 'RECEIPT_REJECTED', 'PENDING_COD', 'AWAITING_RECEIPT', 'CANCELLED',
                  'AWAITING_KITCHEN_APPROVAL', 'KITCHEN_REJECTED'
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

                const customerName = typeof o.customer === 'string' && o.customer.trim()
                  ? o.customer.trim()
                  : typeof o.customerName === 'string' && o.customerName.trim()
                  ? o.customerName.trim()
                  : typeof o.customer_name === 'string' && o.customer_name.trim()
                  ? o.customer_name.trim()
                  : undefined

                const rawType = (o.order_type || o.type || 'Take Out').trim()
                const formatCategory = o.table_name ? `Dine In - ${o.table_name}` : (rawType.toLowerCase() === 'delivery' ? 'Online order' : rawType)

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
        }
      })

      const sanitizedOrders = Array.from(mergedMap.values()).map((ord) => ({
        ...ord,
        items: (ord.items || []).filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase())),
      }))
      setOrders(sanitizedOrders)
    } finally {
      isFetchingRef.current = false
    }
  }

  const normalizeOrderId = (val: any): string => {
    if (!val) return ''
    return String(val).replace(/^#/, '').trim().toLowerCase()
  }

  const fetchApprovals = async () => {
    try {
      let apiApprovals: any[] = []
      try {
        const res = await fetch(`${API_BASE_URL}/kitchen/approvals`)
        if (res.ok) {
          const json = await res.json()
          apiApprovals = Array.isArray(json.data) ? json.data : []
        }
      } catch (err) {
        console.warn('Backend note (kitchen approvals):', err)
      }

      // Gather IDs that are already APPROVED, REJECTED, or CONFIRMED/COOKING
      const approvedOrResolvedIds = new Set<string>()
      const localApprovals: any[] = []

      try {
        const stored = localStorage.getItem('seafudz_orders')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            parsed.forEach((o: any) => {
              const st = (o.status || '').toUpperCase()
              const appSt = (o.kitchen_approval_status || o.kitchenApprovalStatus || '').toUpperCase()
              const idClean = normalizeOrderId(o.id)
              const refClean = normalizeOrderId(o.ref)

              if (
                appSt === 'APPROVED' ||
                appSt === 'REJECTED' ||
                st === 'APPROVED_BY_KITCHEN' ||
                st === 'KITCHEN_REJECTED' ||
                st === 'GCASH_AUTHORIZED' ||
                st === 'PENDING_COD' ||
                st === 'CONFIRMED' ||
                st === 'PREPARING' ||
                st === 'COOKING' ||
                st === 'READY' ||
                st === 'COMPLETED'
              ) {
                if (idClean) approvedOrResolvedIds.add(idClean)
                if (refClean) approvedOrResolvedIds.add(refClean)
              } else if (st === 'AWAITING_KITCHEN_APPROVAL' || appSt === 'PENDING') {
                localApprovals.push(o)
              }
            })
          }
        }
      } catch {}

      // Filter out any orders that are already approved, rejected, or cooking
      const filteredApiApprovals = apiApprovals.filter((a: any) => {
        const idClean = normalizeOrderId(a.id)
        const refClean = normalizeOrderId(a.ref)
        const appSt = (a.kitchen_approval_status || a.kitchenApprovalStatus || '').toUpperCase()
        const st = (a.status || '').toUpperCase()

        if (appSt === 'APPROVED' || appSt === 'REJECTED') return false
        if (['KITCHEN_REJECTED', 'CANCELLED', 'CONFIRMED', 'PREPARING', 'COOKING', 'READY', 'COMPLETED', 'APPROVED_BY_KITCHEN'].includes(st)) return false
        if (idClean && approvedOrResolvedIds.has(idClean)) return false
        if (refClean && approvedOrResolvedIds.has(refClean)) return false
        return true
      })

      // Merge local approvals that are not yet in filteredApiApprovals
      const seen = new Set(filteredApiApprovals.map((a: any) => normalizeOrderId(a.id || a.ref)))
      for (const loc of localApprovals) {
        const locKey = normalizeOrderId(loc.id || loc.ref)
        if (locKey && !seen.has(locKey) && !approvedOrResolvedIds.has(locKey)) {
          filteredApiApprovals.push(loc)
          seen.add(locKey)
        }
      }

      setApprovalOrders(filteredApiApprovals)
    } catch (err) {
      console.warn('Error fetching kitchen approvals:', err)
    }
  }

  const fetchMenuServings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/menu`)
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.data)) {
          const map: Record<string, number | null> = {}
          const inputs: Record<string, string> = {}
          for (const item of json.data) {
            const servings = item.remaining_servings ?? null
            const strVal = item.remaining_servings != null ? String(item.remaining_servings) : ''
            map[item.id] = servings
            inputs[item.id] = strVal
            const aliasId = PRODUCT_ALIASES[item.id]
            if (aliasId) {
              map[aliasId] = servings
              inputs[aliasId] = strVal
            }
          }
          setServingsMap(map)
          setServingsInputs(inputs)
        }
      }
    } catch {}
  }

  const handleApproveQuantities = async (orderId: string) => {
    setIsProcessingApproval(orderId)
    const targetCleanId = normalizeOrderId(orderId)

    // 1. Optimistically remove from approvalOrders immediately
    setApprovalOrders((prev) =>
      prev.filter((o) => {
        const idClean = normalizeOrderId(o.id)
        const refClean = normalizeOrderId(o.ref)
        return idClean !== targetCleanId && refClean !== targetCleanId
      })
    )

    // 2. Update local storage seafudz_orders immediately
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) => {
          const idClean = normalizeOrderId(o.id)
          const refClean = normalizeOrderId(o.ref)
          if (idClean === targetCleanId || refClean === targetCleanId) {
            const isCod = String(o.paymentMethod || o.payment_method || '').toUpperCase().includes('COD')
            return {
              ...o,
              status: isCod ? 'PENDING_COD' : 'GCASH_AUTHORIZED',
              gcashAuthorized: !isCod,
              gcash_authorized: !isCod,
              kitchenApprovalStatus: 'APPROVED',
              kitchen_approval_status: 'APPROVED',
            }
          }
          return o
        })
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
    } catch {}

    // 3. Update active customer orders in localStorage
    try {
      const updateActiveItem = (key: string) => {
        const raw = localStorage.getItem(key)
        if (!raw) return
        try {
          const obj = JSON.parse(raw)
          const idClean = normalizeOrderId(obj.id)
          const refClean = normalizeOrderId(obj.ref)
          if (idClean === targetCleanId || refClean === targetCleanId) {
            const isCod = String(obj.paymentMethod || obj.payment_method || '').toUpperCase().includes('COD')
            obj.status = isCod ? 'PENDING_COD' : 'GCASH_AUTHORIZED'
            obj.gcashAuthorized = !isCod
            obj.gcash_authorized = !isCod
            obj.kitchenApprovalStatus = 'APPROVED'
            obj.kitchen_approval_status = 'APPROVED'
            localStorage.setItem(key, JSON.stringify(obj))
          }
        } catch {}
      }

      updateActiveItem('seafudz_active_online_order')
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('seafudz_active_online_order')) {
          updateActiveItem(k)
        }
      }
    } catch {}

    // 4. Notify backend API
    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${encodeURIComponent(orderId)}/approve-quantities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    } catch {}

    // 5. Synchronize and notify all listeners
    await fetchApprovals()
    await fetchKitchenOrders(true)
    notifyOrderSync()
    setIsProcessingApproval(null)
  }

  const handleRejectQuantities = async (orderId: string) => {
    const reason = window.prompt(
      'Provide a reason for declining this high-quantity order (optional):',
      'Order exceeds kitchen preparation capacity at this time.'
    )
    if (reason === null) return

    setIsProcessingApproval(orderId)
    const targetCleanId = normalizeOrderId(orderId)

    // 1. Optimistically remove from approvalOrders immediately
    setApprovalOrders((prev) =>
      prev.filter((o) => {
        const idClean = normalizeOrderId(o.id)
        const refClean = normalizeOrderId(o.ref)
        return idClean !== targetCleanId && refClean !== targetCleanId
      })
    )

    // 2. Update local storage seafudz_orders
    try {
      const stored = localStorage.getItem('seafudz_orders')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = parsed.map((o: any) => {
          const idClean = normalizeOrderId(o.id)
          const refClean = normalizeOrderId(o.ref)
          if (idClean === targetCleanId || refClean === targetCleanId) {
            return {
              ...o,
              status: 'KITCHEN_REJECTED',
              kitchenApprovalStatus: 'REJECTED',
              kitchen_approval_status: 'REJECTED',
              rejectionReason: reason,
            }
          }
          return o
        })
        localStorage.setItem('seafudz_orders', JSON.stringify(updated))
      }
    } catch {}

    // 3. Update active customer orders in localStorage
    try {
      const updateActiveItem = (key: string) => {
        const raw = localStorage.getItem(key)
        if (!raw) return
        try {
          const obj = JSON.parse(raw)
          const idClean = normalizeOrderId(obj.id)
          const refClean = normalizeOrderId(obj.ref)
          if (idClean === targetCleanId || refClean === targetCleanId) {
            obj.status = 'KITCHEN_REJECTED'
            obj.kitchenApprovalStatus = 'REJECTED'
            obj.kitchen_approval_status = 'REJECTED'
            obj.rejectionReason = reason
            localStorage.setItem(key, JSON.stringify(obj))
          }
        } catch {}
      }

      updateActiveItem('seafudz_active_online_order')
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('seafudz_active_online_order')) {
          updateActiveItem(k)
        }
      }
    } catch {}

    // 4. Notify backend API
    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${encodeURIComponent(orderId)}/reject-quantities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }).catch(() => {})
    } catch {}

    await fetchApprovals()
    await fetchKitchenOrders(true)
    notifyOrderSync()
    setIsProcessingApproval(null)
  }

  const handleSaveRemainingServings = async (productId: string) => {
    const rawVal = servingsInputs[productId]
    const numVal = rawVal === '' || rawVal === undefined ? null : parseInt(rawVal, 10)
    if (numVal !== null && (isNaN(numVal) || numVal < 0)) {
      alert('Please enter a valid non-negative number of servings, or leave blank for no limit.')
      return
    }

    setSavingServingsId(productId)
    try {
      const activeUser = getActiveUser()
      const isStaff = activeUser && ['kitchen', 'admin', 'cashier', 'assistant'].includes((activeUser.role || '').toLowerCase())
      const token = isStaff ? (activeUser.sessionToken || getStoredSessionToken()) : null

      const res = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(productId)}/remaining-servings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ remaining_servings: numVal }),
      })
      if (res.ok) {
        const json = await res.json()
        const newServings = json.data?.remaining_servings ?? null
        const aliasId = PRODUCT_ALIASES[productId]
        setServingsMap((prev) => {
          const next = { ...prev, [productId]: newServings }
          if (aliasId) next[aliasId] = newServings
          return next
        })
        setServingsInputs((prev) => {
          const next = { ...prev, [productId]: newServings != null ? String(newServings) : '' }
          if (aliasId) next[aliasId] = newServings != null ? String(newServings) : ''
          return next
        })
        applyProductServingsChange(productId, newServings)
        if (json.data?.is_available !== undefined) {
          applyProductAvailabilityChange(productId, Boolean(json.data.is_available))
        } else if (newServings !== null && newServings > 0) {
          applyProductAvailabilityChange(productId, true)
        }
        setServingsSuccessId(productId)
        setTimeout(() => setServingsSuccessId((prev) => (prev === productId ? null : prev)), 2000)
        notifyOrderSync()
        notifyProductCatalogSync()
      } else {
        const errJson = await res.json().catch(() => null)
        alert(errJson?.message || 'Could not update remaining servings.')
      }
    } catch {
      alert('Network error. Could not update remaining servings.')
    } finally {
      setSavingServingsId(null)
    }
  }

  useEffect(() => {
    void fetchKitchenOrders()
    void fetchApprovals()
    void fetchMenuServings()

    const unsubscribe = subscribeOrderSync(() => {
      void fetchKitchenOrders(true)
      void fetchApprovals()
      void fetchMenuServings()
    })

    const pollTimer = setInterval(() => {
      void fetchKitchenOrders()
      void fetchApprovals()
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

    // 1. Update React UI state immediately
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== id) return order
        if (newStatus === 'Preparing') return { ...order, status: 'Preparing', startTime: Date.now() }
        if (newStatus === 'Ready') return { ...order, status: 'Ready', completedTimeElapsed: '4:30sec' }
        if (newStatus === 'Completed') return { ...order, status: 'Completed' }
        return { ...order, status: newStatus }
      })
    )

    // 2. Persist update in LocalStorage so polling doesn't reset it
    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const targetOrder = orders.find((o) => o.id === id || o.queue === id)
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

      notifyOrderSync()
    } catch {
      /* fallback silent */
    }

    // 3. Persist update in Express Backend API
    try {
      const res1 = await fetch(`${API_BASE_URL}/kitchen/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedTarget }),
      })
      if (!res1.ok) {
        console.warn(`[KITCHEN] /kitchen/orders/${id}/status returned ${res1.status}`)
      }
      const res2 = await fetch(`${API_BASE_URL}/user-flow/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizedTarget }),
      })
      if (!res2.ok) {
        console.warn(`[KITCHEN] /user-flow/orders/${id}/status returned ${res2.status}`)
      }
    } catch (err) {
      console.warn('[KITCHEN] Note on updating status with backend:', err)
    }
  }

  const deleteOrder = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setOrders((prev) => prev.filter((o) => o.id !== id))
    if (selectedOrderId === id) setSelectedOrderId(null)

    try {
      const existing = JSON.parse(localStorage.getItem('seafudz_orders') || '[]')
      const updated = existing.filter((o: any) => o.id !== id && o.ref !== id)
      localStorage.setItem('seafudz_orders', JSON.stringify(updated))
    } catch {
      /* ignore */
    }

    try {
      await fetch(`${API_BASE_URL}/kitchen/orders/${id}`, { method: 'DELETE' })
    } catch {
      /* fallback silent */
    }
  }

  const handleStatusFromModal = (newStatus: string) => {
    if (selectedOrderId) {
      updateOrderStatus(selectedOrderId, newStatus)
      setSelectedOrderId(null)
    }
  }

  const outOfStockOrder = orders.find((o) => o.id === outOfStockModalOrderId)

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

  const filteredStockItems = useMemo(() => menuItems.filter((item) => {
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(stockSearch.toLowerCase())
    const normStockCat = stockCategory.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normItemCat = (item.category || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return matchesSearch && (stockCategory === 'All Menu' || normItemCat === normStockCat)
  }), [menuItems, stockSearch, stockCategory])

  const handleSetProductAvailability = async (productId: string, available: boolean) => {
    setStockError('')
    const aliasId = PRODUCT_ALIASES[productId]
    if (available) {
      setServingsMap((prev) => {
        const next = { ...prev, [productId]: null }
        if (aliasId) next[aliasId] = null
        return next
      })
      setServingsInputs((prev) => {
        const next = { ...prev, [productId]: '' }
        if (aliasId) next[aliasId] = ''
        return next
      })
    } else {
      setServingsMap((prev) => {
        const next = { ...prev, [productId]: 0 }
        if (aliasId) next[aliasId] = 0
        return next
      })
      setServingsInputs((prev) => {
        const next = { ...prev, [productId]: '0' }
        if (aliasId) next[aliasId] = '0'
        return next
      })
    }
    const updated = await setAvailability(productId, available)
    if (!updated) {
      setStockError('Could not update stock. Check your connection and kitchen/admin access.')
    } else {
      notifyOrderSync()
      notifyProductCatalogSync()
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

  const historyOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = (o.status || '').toUpperCase()
        return s === 'READY' || s === 'PREPARED' || s === 'READY_FOR_PICKUP' || s === 'COMPLETED' || s === 'SERVED' || s === 'DELIVERED' || s === 'OUT_FOR_DELIVERY'
      }),
    [orders]
  )

  return (
    <div className="min-h-screen bg-[#faf9f6] p-3 sm:p-4 lg:p-6 transition-all duration-300 pb-16">
      <div className="w-full flex flex-col gap-4 sm:gap-6">
        <NavbarKitchen />

        <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-extrabold text-neutral-900">Kitchen Display Board</h1>
            {approvalOrders.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                {approvalOrders.length} Awaiting Approval
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManageStock && (
              <button
                type="button"
                onClick={() => setIsStockDrawerOpen(true)}
                className="relative flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
              >
                <span>📋 Manage Item Stock</span>
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white">
                  {unavailableIds.length}
                </span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsAdminCreateOpen(true)}
                className="bg-[#ff7a00] hover:bg-[#e66e00] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span>➕</span> Create Ticket (Admin)
              </button>
            )}

            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title="View Order History"
            >
              <span>Order History</span>
              {historyOrders.length > 0 && (
                <span className="bg-orange-500 text-white font-black text-[10px] px-1.5 py-0.5 rounded-full">
                  {historyOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 3 Sections Live Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
          {/* Section 1: Large Orders Column */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-2xs flex flex-col max-h-[600px] lg:max-h-[calc(100vh-190px)] lg:h-[calc(100vh-190px)] min-h-[440px]">
            <div className="flex items-center justify-between pb-3.5 border-b border-amber-100 mb-4 shrink-0">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                Large Orders
              </h2>
              <span className="bg-amber-100 text-amber-800 font-semibold text-xs px-2.5 py-1 rounded-full">
                {approvalOrders.length} Awaiting
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 overscroll-contain custom-scrollbar">
              {approvalOrders.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-neutral-400 select-none text-center p-4">
                  <p className="text-xs font-medium">No large orders awaiting review</p>
                </div>
              ) : (
                approvalOrders.map((order) => {
                  const itemsList: any[] = Array.isArray(order.items)
                    ? order.items
                    : Array.isArray(order.cartItems)
                    ? order.cartItems
                    : typeof order.items === 'string'
                    ? JSON.parse(order.items || '[]')
                    : []
                  const flaggedList: any[] = Array.isArray(order.flagged_quantity_items)
                    ? order.flagged_quantity_items
                    : typeof order.flagged_quantity_items === 'string'
                    ? JSON.parse(order.flagged_quantity_items || '[]')
                    : []

                  const isProcessing = isProcessingApproval === order.id
                  const customerName = order.customer_name || order.customerName || order.customer || 'Customer'
                  const orderType = order.order_type || order.type || 'Delivery'
                  const paymentMethod = order.payment_method || order.paymentMethod || 'GCASH'

                  return (
                    <div
                      key={order.id}
                      className="bg-amber-50/40 hover:bg-amber-50/70 rounded-xl p-4 border border-amber-200 transition-all flex flex-col justify-between shadow-2xs"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="text-xs font-mono font-bold text-amber-900">
                              Order #{order.id}
                            </span>
                            <div className="text-sm font-extrabold text-neutral-900 mt-0.5">
                              {customerName}
                            </div>
                            <div className="text-[11px] text-neutral-500 font-medium">
                              {order.customer_phone ? `${order.customer_phone} • ` : ''}{orderType}
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {paymentMethod}
                          </span>
                        </div>

                        <div className="my-2.5 space-y-1.5 border-t border-b border-amber-200/60 py-2.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block mb-1">
                            Ordered Items & Standards
                          </span>
                          {itemsList.map((item: any, idx: number) => {
                            const std = getProductQuantityStandard(item.name || '')
                            const isFlagged = flaggedList.some(
                              (f: any) =>
                                (f.name && item.name && f.name.toLowerCase().trim() === item.name.toLowerCase().trim()) ||
                                (f.product_id && (f.product_id === item.productId || f.product_id === item.product_id))
                            ) || (std !== null && item.quantity >= std)

                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between text-xs p-1.5 rounded-lg ${
                                  isFlagged
                                    ? 'bg-amber-100/90 border border-amber-300 text-amber-950 font-bold'
                                    : 'text-neutral-700 font-medium'
                                }`}
                              >
                                <span className="truncate pr-2">{item.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isFlagged && (
                                    <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded">
                                      STD: {std ?? '—'}
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[11px] font-black ${
                                      isFlagged ? 'bg-amber-800 text-white' : 'bg-neutral-200 text-neutral-800'
                                    }`}
                                  >
                                    x{item.quantity}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {order.notes && (
                          <div className="bg-white/80 border border-amber-200 rounded-xl p-2 text-xs text-amber-900 mb-2.5">
                            <span className="font-bold">Note: </span>
                            {order.notes}
                          </div>
                        )}

                        <div className="text-right text-xs font-bold text-neutral-600 mb-3">
                          Total: <span className="text-neutral-900 font-black">₱{parseFloat(order.total || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-amber-200">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => void handleApproveQuantities(order.id || order.ref)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          {isProcessing ? 'Processing...' : '✓ Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => void handleRejectQuantities(order.id || order.ref)}
                          className="bg-rose-100 hover:bg-rose-200 disabled:opacity-50 text-rose-800 border border-rose-200 font-bold py-2.5 px-3 rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Section 2: Queue Column */}
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          </div>
                          {order.customer && (
                            <div className="text-xs font-bold text-neutral-800 mt-0.5">{order.customer}</div>
                          )}
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteOrder(order.id, e)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded-md"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items
                          .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                          .map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <span>{item.name}</span>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
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
                      <button
                        onClick={(e) => { e.stopPropagation(); setOutOfStockModalOrderId(order.id); setSelectedOosItemIds([]); }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 px-3 rounded-lg text-xs cursor-pointer border border-red-200 transition-colors"
                        title="Flag items as out of stock"
                      >
                        ⚠️ OOS
                      </button>
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 text-sm">Order #{order.queue}</span>
                          </div>
                          {order.customer && (
                            <div className="text-xs font-bold text-neutral-800 mt-0.5">{order.customer}</div>
                          )}
                          <div className="text-xs text-neutral-500 font-medium mt-0.5">{order.category}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => deleteOrder(order.id, e)}
                          className="text-neutral-400 hover:text-red-600 p-1 rounded-md"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1 py-2 border-t border-b border-neutral-200/60 mb-2.5">
                        {order.items
                          .filter((item) => !['REPLACED', 'REFUNDED', 'CANCELLED'].includes(String(item.itemStatus || (item as any).item_status || '').toUpperCase()))
                          .map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-semibold text-neutral-700">
                            <span>{item.name}</span>
                            <span className="bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded text-[11px] font-bold">
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
                      <button
                        onClick={(e) => { e.stopPropagation(); setOutOfStockModalOrderId(order.id); setSelectedOosItemIds([]); }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 px-3 rounded-lg text-xs cursor-pointer border border-red-200 transition-colors"
                        title="Flag items as out of stock"
                      >
                        ⚠️ OOS
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh]">
            <div className="px-6 py-4.5 bg-white border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-black text-neutral-900">Order History</h2>
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
                  {historyOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-400">
                        No completed order history yet.
                      </td>
                    </tr>
                  ) : (
                    historyOrders.map((tx) => (
                      <tr key={tx.id} className="hover:bg-neutral-50/60">
                        <td className="px-6 py-3.5 font-bold text-orange-600">{tx.queue}</td>
                        <td className="px-6 py-3.5 font-semibold text-neutral-800">{tx.customer || '—'}</td>
                        <td className="px-6 py-3.5 text-neutral-500">{tx.createdAt}</td>
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
                      <span>{item.name}</span>
                      <span className="bg-neutral-200 px-2 py-0.5 rounded font-bold">x{item.quantity}</span>
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

      {isStockDrawerOpen && canManageStock && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/60 transition-opacity">
          <section className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#f8f7f2] shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Kitchen stock control</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">86 Board</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Availability only. Product details remain Admin-managed.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStockDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200"
                aria-label="Close stock board"
              >
                ×
              </button>
            </header>

            <div className="space-y-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <input
                type="search"
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
                placeholder="Search dishes or categories"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {CLIENT_CATEGORIES.map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setStockCategory(category)}
                    className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-extrabold ${
                      stockCategory === category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {stockError && <p role="alert" className="text-xs font-bold text-rose-700">{stockError}</p>}
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4 sm:p-6 overscroll-contain">
              {filteredStockItems.map((item) => {
                const available = isAvailable(item.id)
                                return (
                  <article key={item.id} style={{ contain: "content" }} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border bg-white p-3 shadow-xs transition-colors duration-150 sm:gap-4 sm:p-4 ${available ? "border-slate-200" : "border-rose-300 bg-rose-50/20"}`}>
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                        <img src={item.image} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.category}</span>
                        <h3 className="truncate text-sm font-black text-slate-900 sm:text-base">{item.name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-wider ${available ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                            {available ? "🟢 IN STOCK" : "🔴 OUT OF STOCK"}
                          </span>
                          {servingsMap[item.id] !== undefined && servingsMap[item.id] !== null && (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              {servingsMap[item.id]} servings left
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-bold text-neutral-400">Servings:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="∞"
                            title="Remaining servings before automatic 86"
                            value={servingsInputs[item.id] ?? ''}
                            onChange={(e) => setServingsInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-16 px-1.5 py-1 text-xs border border-neutral-300 rounded-lg text-right font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={savingServingsId === item.id}
                          onClick={() => void handleSaveRemainingServings(item.id)}
                          className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer mt-3 disabled:opacity-50 disabled:cursor-not-allowed ${
                            servingsSuccessId === item.id
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                          }`}
                          title="Set remaining available servings"
                        >
                          {savingServingsId === item.id ? '...' : servingsSuccessId === item.id ? '✓' : 'Set'}
                        </button>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={available}
                        aria-label={`${available ? "Mark" : "Set"} ${item.name} ${available ? "out of stock" : "in stock"}`}
                        onClick={() => void handleSetProductAvailability(item.id, !available)}
                        className={`relative inline-flex h-9 w-[76px] shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none select-none shadow-inner active:scale-95 ${available ? "bg-emerald-600" : "bg-rose-600"}`}
                      >
                        <span className={`absolute text-[10px] font-black tracking-wider text-white transition-opacity duration-200 pointer-events-none select-none ${available ? "left-2.5 opacity-100" : "right-2.5 opacity-100"}`}>
                          {available ? "ON" : "86"}
                        </span>
                        <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${available ? "translate-x-[40px]" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </article>
                )
              })}
              {filteredStockItems.length === 0 && (
                <p className="py-10 text-center text-sm font-semibold text-slate-500">No dishes match this search.</p>
              )}
            </div>
          </section>
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
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-red-50 border-red-300 ring-1 ring-red-200'
                          : 'bg-[#faf9f6] border-neutral-200 hover:border-neutral-300'
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
                        className="w-4 h-4 rounded accent-red-600"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-neutral-900">{item.name}</div>
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
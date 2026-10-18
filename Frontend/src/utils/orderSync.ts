import { API_BASE_URL } from './api'
import { applyProductAvailabilityChange } from './menuAvailability'
import { refreshProductCatalog } from './useProductImages'

const SYNC_KEY = 'seafudz_order_sync_timestamp'
const CATALOG_SYNC_KEY = 'seafudz_catalog_sync_timestamp'

let channel: BroadcastChannel | null = null
let lastNotifyTime = 0
let sseSource: EventSource | null = null

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('seafudz_orders_channel')
  }
} catch {
  // BroadcastChannel not available
}

/**
 * Broadcasts product catalog add/delete/update across all tabs, windows, and SSE clients.
 * Instantly triggers refresh of menu catalog without page reload.
 */
export const notifyProductCatalogSync = (detail?: any) => {
  if (typeof window === 'undefined') return

  // 1. Dispatch custom event for local tab listeners
  try {
    window.dispatchEvent(new CustomEvent('seafudz_product_catalog_changed', { detail }))
  } catch {}

  // 2. Broadcast across tabs/windows via BroadcastChannel
  if (channel) {
    try {
      channel.postMessage({ type: 'CATALOG_SYNC', detail, timestamp: Date.now() })
    } catch {}
  }

  // 3. Update localStorage key to trigger 'storage' event across separate windows/tabs
  try {
    localStorage.setItem(CATALOG_SYNC_KEY, JSON.stringify({ detail, timestamp: Date.now() }))
  } catch {}

  // 4. Force re-fetch of menu catalog
  void refreshProductCatalog().catch(() => {})
}

/**
 * Triggers instant real-time sync event across all browser tabs, windows, and components.
 */
export const notifyOrderSync = () => {
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - lastNotifyTime < 50) return
  lastNotifyTime = now

  // 1. Dispatch local window custom event (instant 0ms execution for local tab)
  try {
    window.dispatchEvent(new Event('seafudz_order_created'))
  } catch {}

  // 2. Broadcast across tabs/windows via BroadcastChannel
  if (channel) {
    try {
      channel.postMessage({ type: 'ORDER_SYNC', timestamp: now })
    } catch {}
  }

  // 3. Update localStorage key to trigger 'storage' event across separate windows/tabs
  try {
    localStorage.setItem(SYNC_KEY, now.toString())
  } catch {}
}

/**
 * Connects to Express Server-Sent Events (SSE) stream for 0ms real-time server push
 */
const initSseConnection = () => {
  if (typeof window === 'undefined' || sseSource) return

  try {
    const sseUrl = `${API_BASE_URL}/events/orders`
    sseSource = new EventSource(sseUrl)

    sseSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'PRODUCT_AVAILABILITY_CHANGED' && data.productId != null) {
          applyProductAvailabilityChange(String(data.productId), Boolean(data.isAvailable))
          notifyProductCatalogSync(data)
          return
        }
        if (data?.type === 'PRODUCT_CATALOG_CHANGED') {
          notifyProductCatalogSync(data)
          return
        }
        if (data && (data.type === 'ORDER_UPDATE' || data.id || data.status)) {
          notifyOrderSync()
        }
      } catch {
        notifyOrderSync()
      }
    }

    sseSource.onerror = () => {
      if (sseSource) {
        sseSource.close()
        sseSource = null
      }
      // Retry SSE connection after 3 seconds
      setTimeout(initSseConnection, 3000)
    }
  } catch {
    // SSE initialization fallback
  }
}

// Auto-initialize SSE on client load
if (typeof window !== 'undefined') {
  initSseConnection()
}

/**
 * Subscribes to real-time product catalog changes (add, delete, photo update).
 */
export const subscribeProductCatalogSync = (callback: (detail: any) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  initSseConnection()

  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent
    callback(custom.detail || {})
  }

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === CATALOG_SYNC_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        void refreshProductCatalog().catch(() => {})
        callback(parsed?.detail || {})
      } catch {
        callback({})
      }
    }
  }

  window.addEventListener('seafudz_product_catalog_changed', handleLocalEvent)
  window.addEventListener('storage', handleStorageEvent)

  let messageHandler: ((e: MessageEvent) => void) | null = null
  if (channel) {
    messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'CATALOG_SYNC') {
        void refreshProductCatalog().catch(() => {})
        callback(e.data.detail || {})
      }
    }
    channel.addEventListener('message', messageHandler)
  }

  return () => {
    window.removeEventListener('seafudz_product_catalog_changed', handleLocalEvent)
    window.removeEventListener('storage', handleStorageEvent)
    if (channel && messageHandler) {
      channel.removeEventListener('message', messageHandler)
    }
  }
}

/**
 * Subscribes to real-time order sync events across tabs with zero-delay local response.
 */
export const subscribeOrderSync = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  // Ensure SSE is active
  initSseConnection()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const triggerCallback = (delay = 0) => {
    if (delay === 0) {
      if (debounceTimer) clearTimeout(debounceTimer)
      callback()
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      callback()
    }, delay)
  }

  const handleLocalEvent = () => triggerCallback(0) // Instant 0ms local response

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === SYNC_KEY || e.key === 'seafudz_order_sync_timestamp' || e.key === 'seafudz_order_created') {
      triggerCallback(0) // Instant 0ms cross-tab response
    }
    if (e.key === CATALOG_SYNC_KEY && e.newValue) {
      void refreshProductCatalog().catch(() => {})
    }
  }

  window.addEventListener('seafudz_order_created', handleLocalEvent)
  window.addEventListener('storage', handleStorageEvent)

  let messageHandler: ((e: MessageEvent) => void) | null = null
  if (channel) {
    messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ORDER_SYNC') {
        triggerCallback(0)
      }
      if (e.data && e.data.type === 'CATALOG_SYNC') {
        void refreshProductCatalog().catch(() => {})
      }
    }
    channel.addEventListener('message', messageHandler)
  }

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    window.removeEventListener('seafudz_order_created', handleLocalEvent)
    window.removeEventListener('storage', handleStorageEvent)
    if (channel && messageHandler) {
      channel.removeEventListener('message', messageHandler)
    }
  }
}

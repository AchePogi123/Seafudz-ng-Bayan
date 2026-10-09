import { API_BASE_URL } from './api'

const SYNC_KEY = 'seafudz_order_sync_timestamp'

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
  }

  window.addEventListener('seafudz_order_created', handleLocalEvent)
  window.addEventListener('storage', handleStorageEvent)

  let messageHandler: ((e: MessageEvent) => void) | null = null
  if (channel) {
    messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ORDER_SYNC') {
        triggerCallback(0)
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

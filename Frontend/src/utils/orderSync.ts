const SYNC_KEY = 'seafudz_order_sync_timestamp'

let channel: BroadcastChannel | null = null
let lastNotifyTime = 0

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('seafudz_orders_channel')
  }
} catch {
  // BroadcastChannel not available
}

/**
 * Triggers instant real-time sync event across all browser tabs and components.
 */
export const notifyOrderSync = () => {
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - lastNotifyTime < 100) return
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
 * Subscribes to real-time order sync events across tabs with zero-delay local response.
 */
export const subscribeOrderSync = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const triggerCallback = (delay = 50) => {
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
      triggerCallback(50) // 50ms ultra-fast cross-tab response
    }
  }

  window.addEventListener('seafudz_order_created', handleLocalEvent)
  window.addEventListener('storage', handleStorageEvent)

  let messageHandler: ((e: MessageEvent) => void) | null = null
  if (channel) {
    messageHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ORDER_SYNC') {
        triggerCallback(50)
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

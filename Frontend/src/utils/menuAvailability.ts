import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'sfb_unavailable_items'
const EVENT_NAME = 'sfb_availability_changed'

/**
 * Returns array of unavailable item IDs stored in localStorage
 */
export function getUnavailableItemIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) || []
  } catch (err) {
    console.warn('Error reading unavailable items:', err)
    return []
  }
}

/**
 * Checks if a specific item is available
 */
export function isItemAvailable(itemId: string): boolean {
  const list = getUnavailableItemIds()
  return !list.includes(itemId)
}

/**
 * Toggles an item's availability (Available <-> Unavailable)
 */
export function toggleItemAvailability(itemId: string): boolean {
  const currentList = getUnavailableItemIds()
  let nextList: string[]
  let isNowAvailable = false

  if (currentList.includes(itemId)) {
    // Make it available by removing from unavailable list
    nextList = currentList.filter((id) => id !== itemId)
    isNowAvailable = true
  } else {
    // Make it unavailable by adding to list
    nextList = [...currentList, itemId]
    isNowAvailable = false
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextList }))
    window.dispatchEvent(new Event('storage'))
  } catch (err) {
    console.error('Error saving unavailable items:', err)
  }

  return isNowAvailable
}

/**
 * Set item availability explicitly
 */
export function setItemAvailability(itemId: string, available: boolean): void {
  const currentList = getUnavailableItemIds()
  let nextList: string[]

  if (available) {
    nextList = currentList.filter((id) => id !== itemId)
  } else {
    if (!currentList.includes(itemId)) {
      nextList = [...currentList, itemId]
    } else {
      nextList = currentList
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextList }))
    window.dispatchEvent(new Event('storage'))
  } catch (err) {
    console.error('Error setting unavailable items:', err)
  }
}

/**
 * React hook to reactively listen to availability changes across tabs & components
 */
export function useMenuAvailability() {
  const [unavailableIds, setUnavailableIds] = useState<string[]>(() => getUnavailableItemIds())

  const sync = useCallback(() => {
    setUnavailableIds(getUnavailableItemIds())
  }, [])

  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>
      if (customEvent.detail) {
        setUnavailableIds(customEvent.detail)
      } else {
        sync()
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || !e.key) {
        sync()
      }
    }

    window.addEventListener(EVENT_NAME, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(EVENT_NAME, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [sync])

  const toggle = useCallback((itemId: string) => {
    return toggleItemAvailability(itemId)
  }, [])

  const checkIsAvailable = useCallback(
    (itemId: string) => {
      return !unavailableIds.includes(itemId)
    },
    [unavailableIds]
  )

  return {
    unavailableIds,
    toggleAvailability: toggle,
    isAvailable: checkIsAvailable,
  }
}

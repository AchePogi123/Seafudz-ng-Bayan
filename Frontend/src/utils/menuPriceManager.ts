import { useState, useEffect, useCallback } from 'react'

const PRICE_STORAGE_KEY = 'sfb_custom_prices'
const PRICE_EVENT_NAME = 'sfb_prices_changed'

export type CustomPriceMap = Record<string, number>

/**
 * Returns dictionary of custom price overrides from localStorage
 */
export function getCustomPrices(): CustomPriceMap {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) || {}
  } catch (err) {
    console.warn('Error reading custom prices:', err)
    return {}
  }
}

/**
 * Sets a custom price for a specific product
 */
export function setProductPrice(itemId: string, newPrice: number): void {
  const current = getCustomPrices()
  const updated: CustomPriceMap = {
    ...current,
    [itemId]: Math.max(0, Math.round(newPrice)),
  }

  try {
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(PRICE_EVENT_NAME, { detail: updated }))
    window.dispatchEvent(new Event('storage'))
  } catch (err) {
    console.error('Error saving custom price:', err)
  }
}

/**
 * Resets a product's price back to its default original price
 */
export function resetProductPrice(itemId: string): void {
  const current = getCustomPrices()
  const updated = { ...current }
  delete updated[itemId]

  try {
    localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent(PRICE_EVENT_NAME, { detail: updated }))
    window.dispatchEvent(new Event('storage'))
  } catch (err) {
    console.error('Error resetting custom price:', err)
  }
}

/**
 * React hook to reactively get and update custom product prices across components & tabs
 */
export function useMenuPrices() {
  const [customPrices, setCustomPrices] = useState<CustomPriceMap>(() => getCustomPrices())

  const sync = useCallback(() => {
    setCustomPrices(getCustomPrices())
  }, [])

  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<CustomPriceMap>
      if (customEvent.detail) {
        setCustomPrices(customEvent.detail)
      } else {
        sync()
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === PRICE_STORAGE_KEY || !e.key) {
        sync()
      }
    }

    window.addEventListener(PRICE_EVENT_NAME, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(PRICE_EVENT_NAME, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [sync])

  const getEffectivePrice = useCallback(
    (itemId: string, originalPrice: number) => {
      return customPrices[itemId] !== undefined ? customPrices[itemId] : originalPrice
    },
    [customPrices]
  )

  const updatePrice = useCallback((itemId: string, newPrice: number) => {
    setProductPrice(itemId, newPrice)
  }, [])

  const resetPrice = useCallback((itemId: string) => {
    resetProductPrice(itemId)
  }, [])

  return {
    customPrices,
    getEffectivePrice,
    updatePrice,
    resetPrice,
  }
}

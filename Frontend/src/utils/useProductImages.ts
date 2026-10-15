import { useCallback, useEffect, useState } from 'react'
import { CLIENT_MENU_ITEMS } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { API_BASE_URL } from './api'

const CACHE_KEY = 'sfb_product_images_v1'
const IMAGE_EVENT = 'sfb_product_images_changed'
const CACHE_TTL = 5 * 60 * 1000

let imageById: Record<string, string> = {}
let cachedAt = 0
let requestInFlight: Promise<Record<string, string>> | null = null
let lastFocusRefresh = 0

function readCachedImages() {
  if (typeof window === 'undefined') return
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cache && typeof cache === 'object' && typeof cache.images === 'object') {
      imageById = cache.images
      cachedAt = Number(cache.cachedAt) || 0
    }
  } catch {
    imageById = {}
  }
}

function mergeImages(items: MenuItem[]): MenuItem[] {
  return items.map((item) => {
    const bundledImage = item.bundledImage || item.image
    const remoteImage = imageById[item.id]
    return {
      ...item,
      image: remoteImage || bundledImage,
      bundledImage,
    }
  })
}

function publishImages(images: Record<string, string>) {
  imageById = images
  cachedAt = Date.now()
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ images, cachedAt }))
  } catch {
    // Keep the in-memory cache available when browser storage is full or disabled.
  }
  window.dispatchEvent(new Event(IMAGE_EVENT))
}

export function setCachedProductImage(productId: string, image: string | null) {
  const next = { ...imageById }
  if (image) next[productId] = image
  else delete next[productId]
  publishImages(next)
}

async function fetchProductImages(force: boolean): Promise<Record<string, string>> {
  if (requestInFlight) return requestInFlight
  if (!force && Date.now() - cachedAt < CACHE_TTL) return imageById

  requestInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/menu`)
    if (!response.ok) throw new Error(`Menu image request failed (${response.status}).`)
    const payload = await response.json()
    const next: Record<string, string> = {}
    if (Array.isArray(payload?.data)) {
      for (const product of payload.data) {
        if (typeof product?.id === 'string' && typeof product?.image === 'string' && product.image) {
          next[product.id] = product.image
        }
      }
    }
    publishImages(next)
    return next
  })()

  try {
    return await requestInFlight
  } finally {
    requestInFlight = null
  }
}

export function useProductImages() {
  const [items, setItems] = useState<MenuItem[]>(() => {
    if (typeof window !== 'undefined' && cachedAt === 0) readCachedImages()
    return mergeImages(CLIENT_MENU_ITEMS)
  })

  const refresh = useCallback(async () => {
    try {
      await fetchProductImages(true)
      const updated = mergeImages(CLIENT_MENU_ITEMS)
      setItems(updated)
      return updated
    } catch (error) {
      console.warn('Could not refresh product images:', error)
      return mergeImages(CLIENT_MENU_ITEMS)
    }
  }, [])

  useEffect(() => {
    const sync = () => setItems(mergeImages(CLIENT_MENU_ITEMS))
    const onFocus = () => {
      if (Date.now() - lastFocusRefresh < 20_000) return
      lastFocusRefresh = Date.now()
      void refresh()
    }

    window.addEventListener(IMAGE_EVENT, sync)
    window.addEventListener('focus', onFocus)
    void fetchProductImages(false).then(sync).catch(() => {})
    return () => {
      window.removeEventListener(IMAGE_EVENT, sync)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { menuItems: items, refresh }
}

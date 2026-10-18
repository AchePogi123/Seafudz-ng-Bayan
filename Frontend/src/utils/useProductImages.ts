import { useCallback, useEffect, useState } from 'react'
import { CLIENT_MENU_ITEMS } from '../components/MenuCard'
import type { MenuItem } from '../components/MenuCard'
import { API_BASE_URL } from './api'

const CACHE_KEY = 'sfb_product_images_v1'
const IMAGE_EVENT = 'sfb_product_images_changed'
const CATALOG_EVENT = 'sfb_product_catalog_changed'
const CACHE_TTL = 5 * 60 * 1000

let imageById: Record<string, string> = {}
let cachedAt = 0
let catalogFetchedAt = 0
let catalogItems: MenuItem[] = CLIENT_MENU_ITEMS
let requestInFlight: Promise<MenuItem[]> | null = null
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

function mergeImages(items: MenuItem[] = catalogItems): MenuItem[] {
  return items.map((item) => {
    const bundledImage = item.bundledImage || item.image
    const remoteImage = imageById[item.id]
    return {
      ...item,
      image: remoteImage || item.image || bundledImage,
      bundledImage,
    }
  })
}

function publishCatalog(items: MenuItem[]) {
  catalogItems = items
  catalogFetchedAt = Date.now()
  window.dispatchEvent(new CustomEvent(CATALOG_EVENT, { detail: items }))
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

export async function refreshProductCatalog(): Promise<MenuItem[]> {
  return fetchProductCatalog(true)
}

export function getCurrentCatalogItems(): MenuItem[] {
  return catalogItems
}

export function normalizeCategory(rawCategory: unknown, fallback: string = 'Other'): string {
  if (typeof rawCategory !== 'string' || !rawCategory.trim()) return fallback
  const c = rawCategory.trim()
  const lower = c.toLowerCase()
  if (lower === 'all menu' || lower === 'all') return 'All Menu'
  if (lower === 'seafoods' || lower === 'seafood' || lower.includes('seafood') || lower.includes('shrimp specials') || lower.includes('crabs & shellfish')) {
    return 'Seafoods'
  }
  if (lower === 'value meals' || lower === 'value meal' || lower === 'value meals & add-ons' || lower === 'value meals & addons') {
    return 'Value Meals'
  }
  if (lower === 'siomai') {
    return 'Siomai'
  }
  if (lower === 'add ons' || lower === 'add-ons' || lower === 'addons' || lower === 'sides') {
    return 'Add Ons'
  }
  if (lower === 'shake & lemonade' || lower === 'shakes & lemonade' || lower === 'shake and lemonade' || lower === 'shakes' || lower === 'lemonade') {
    return 'Shake & Lemonade'
  }
  if (lower === 'desserts' || lower === 'dessert') {
    return 'Desserts'
  }
  if (lower === 'drinks' || lower === 'drink' || lower === 'beverages' || lower === 'beverages & shakes') {
    return 'Drinks'
  }
  return c
}

export function resolveStandardCategory(dbCategory: unknown, canonicalCategory: string): string {
  if (typeof dbCategory !== 'string' || !dbCategory.trim()) return canonicalCategory
  const norm = normalizeCategory(dbCategory, canonicalCategory)
  if (dbCategory.includes('&') && !canonicalCategory.includes('&')) {
    return canonicalCategory
  }
  return norm
}

async function fetchProductCatalog(force: boolean): Promise<MenuItem[]> {
  if (requestInFlight) {
    if (!force) return requestInFlight
    const pendingRequest = requestInFlight
    await pendingRequest.catch(() => [])
    if (requestInFlight === pendingRequest) requestInFlight = null
    return fetchProductCatalog(true)
  }
  if (!force && Date.now() - catalogFetchedAt < CACHE_TTL) return catalogItems

  requestInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/menu`)
    if (!response.ok) throw new Error(`Menu request failed (${response.status}).`)
    const payload = await response.json()
    const products = Array.isArray(payload?.data) ? payload.data : []
    const productsById = new Map<string, Record<string, unknown>>()
    const nextImages: Record<string, string> = {}

    for (const product of products) {
      if (typeof product?.id !== 'string') continue
      productsById.set(product.id, product)
      if (typeof product.image === 'string' && product.image) nextImages[product.id] = product.image
    }

    const standardProductIds = new Set(CLIENT_MENU_ITEMS.map((item) => item.id))
    const customProducts = products
      .filter((product: Record<string, unknown>) => {
        const id = String(product?.id || '')
        return id.startsWith('custom-') || (!standardProductIds.has(id) && !/^item-\d+$/i.test(id))
      })
      .map((product: Record<string, unknown>): MenuItem => ({
        id: String(product.id),
        name: String(product.name || 'New product'),
        description: String(product.description || ''),
        price: Number(product.price) || 0,
        category: normalizeCategory(product.category, 'Other'),
        image: typeof product.image === 'string' ? product.image : '',
      }))

    const standardProducts = CLIENT_MENU_ITEMS
      .filter((item) => productsById.has(item.id))
      .map((item) => {
        const product = productsById.get(item.id)
        return {
          ...item,
          name: typeof product?.name === 'string' ? product.name : item.name,
          description: typeof product?.description === 'string' ? product.description : item.description,
          category: resolveStandardCategory(product?.category, item.category),
          price: product?.price !== undefined ? Number(product.price) : item.price,
        }
      })

    publishImages(nextImages)
    const updatedItems = mergeImages([...standardProducts, ...customProducts])
    publishCatalog(updatedItems)
    return updatedItems
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
    return mergeImages()
  })

  const refresh = useCallback(async () => {
    try {
      return await fetchProductCatalog(true)
    } catch (error) {
      console.warn('Could not refresh product catalog:', error)
      return mergeImages()
    }
  }, [])

  useEffect(() => {
    const sync = () => setItems(mergeImages())
    const onFocus = () => {
      if (Date.now() - lastFocusRefresh < 20_000) return
      lastFocusRefresh = Date.now()
      void refresh()
    }

    window.addEventListener(IMAGE_EVENT, sync)
    window.addEventListener(CATALOG_EVENT, sync)
    window.addEventListener('focus', onFocus)
    void fetchProductCatalog(false).catch(() => {})
    return () => {
      window.removeEventListener(IMAGE_EVENT, sync)
      window.removeEventListener(CATALOG_EVENT, sync)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { menuItems: items, refresh }
}

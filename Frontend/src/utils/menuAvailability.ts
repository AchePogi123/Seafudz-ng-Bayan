import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL, getAuthHeaders } from "./api"

const EVENT_NAME = "sfb_availability_changed"
const SERVINGS_EVENT_NAME = "sfb_servings_changed"

// Bi-directional alias map connecting slug-based menu IDs with legacy/seed item IDs
export const PRODUCT_ALIASES: Record<string, string> = {
  'all-shrimp-alacarte-199': 'item-005',
  'item-005': 'all-shrimp-alacarte-199',
  'all-shrimp-bowl-699': 'item-006',
  'item-006': 'all-shrimp-bowl-699',
  'all-shrimp-tray-1099': 'item-007',
  'item-007': 'all-shrimp-tray-1099',
  'mixed-seafoods-alacarte-99': 'item-001',
  'item-001': 'mixed-seafoods-alacarte-99',
  'mixed-seafoods-tub-189': 'item-002',
  'item-002': 'mixed-seafoods-tub-189',
  'mixed-seafoods-bowl-699': 'item-003',
  'item-003': 'mixed-seafoods-bowl-699',
  'mixed-seafoods-tray-1199': 'item-004',
  'item-004': 'mixed-seafoods-tray-1199',
  'chicken-pastil-35': 'item-009',
  'item-009': 'chicken-pastil-35',
  'fried-noodles-35': 'item-010',
  'item-010': 'fried-noodles-35',
  'chao-fan-35': 'item-008',
  'item-008': 'chao-fan-35',
  'pork-siomai-5': 'item-011',
  'item-011': 'pork-siomai-5',
  'beef-siomai-5': 'item-012',
  'item-012': 'beef-siomai-5',
  'chicken-siomai-5': 'item-013',
  'item-013': 'chicken-siomai-5',
  'sharksfin-siomai-5': 'item-014',
  'item-014': 'sharksfin-siomai-5',
  'japanese-siomai-6': 'item-015',
  'item-015': 'japanese-siomai-6',
  'rice-cup-20': 'item-032',
  'item-032': 'rice-cup-20',
  'corn-addon-20': 'item-033',
  'item-033': 'corn-addon-20',
  'icetea-glass-20': 'item-034',
  'item-034': 'icetea-glass-20',
  'shrimp-regular-addon-20': 'item-035',
  'item-035': 'shrimp-regular-addon-20',
  'shrimp-jumbo-addon-30': 'item-036',
  'item-036': 'shrimp-jumbo-addon-30',
  'tahong-addon-30': 'item-037',
  'item-037': 'tahong-addon-30',
  'special-sauce-addon-30': 'item-038',
  'item-038': 'special-sauce-addon-30',
  'sausage-addon-50': 'item-039',
  'item-039': 'sausage-addon-50',
  'icetea-pitcher-100': 'item-040',
  'item-040': 'icetea-pitcher-100',
  'banana-con-yelo-50': 'item-029',
  'item-029': 'banana-con-yelo-50',
  'ice-cream-50': 'item-030',
  'item-030': 'ice-cream-50',
  'mango-pudding-50': 'item-031',
  'item-031': 'mango-pudding-50',
  'mineral-water-15': 'item-016',
  'item-016': 'mineral-water-15',
  'coke-mismo-25': 'item-017',
  'item-017': 'coke-mismo-25',
  'sprite-mismo-25': 'item-018',
  'item-018': 'sprite-mismo-25',
  'royal-mismo-25': 'item-019',
  'item-019': 'royal-mismo-25',
  'black-coffee-30': 'item-020',
  'item-020': 'black-coffee-30',
  'coke-1-5l-110': 'item-021',
  'item-021': 'coke-1-5l-110',
  'sprite-1-5l-100': 'item-022',
  'item-022': 'sprite-1-5l-100',
  'royal-1-5l-100': 'item-023',
  'item-023': 'royal-1-5l-100',
  'lemonade-small-40': 'item-025',
  'item-025': 'lemonade-small-40',
  'lemonade-big-50': 'item-026',
  'item-026': 'lemonade-big-50',
  'cucumber-lemonade-small-40': 'item-027',
  'item-027': 'cucumber-lemonade-small-40',
  'cucumber-lemonade-big-50': 'item-028',
  'item-028': 'cucumber-lemonade-big-50',
}

const availabilityById: Record<string, boolean> = {}
const servingsById: Record<string, number | null> = {}
let availabilityRequest: Promise<void> | null = null
let availabilityRevision = 0

function publishAvailability(next: Record<string, boolean>) {
  let changed = false
  for (const [key, value] of Object.entries(next)) {
    if (availabilityById[key] !== value) {
      availabilityById[key] = value
      changed = true
    }
  }

  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...availabilityById } }))
  }
}

function publishServings(next?: Record<string, number | null>) {
  let changed = false
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (servingsById[key] !== value) {
        servingsById[key] = value
        changed = true
      }
    }
  }

  if (changed && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SERVINGS_EVENT_NAME, { detail: { ...servingsById } }))
  }
}

export function applyProductAvailabilityChange(productId: string, isAvailable: boolean) {
  const id = String(productId)
  const boolVal = Boolean(isAvailable)
  const aliasId = PRODUCT_ALIASES[id]

  const updates: Record<string, boolean> = {}
  if (availabilityById[id] !== boolVal) {
    updates[id] = boolVal
  }
  if (aliasId && availabilityById[aliasId] !== boolVal) {
    updates[aliasId] = boolVal
  }

  if (Object.keys(updates).length > 0) {
    availabilityRevision += 1
    publishAvailability(updates)
  }
}

export function applyProductServingsChange(productId: string, remainingServings: number | null) {
  const id = String(productId)
  const val = remainingServings !== null && remainingServings !== undefined ? Number(remainingServings) : null
  const aliasId = PRODUCT_ALIASES[id]

  // Automatic out of stock when servings reaches 0; restore when servings > 0 or null (unlimited)
  if (val === 0) {
    applyProductAvailabilityChange(id, false)
  } else {
    applyProductAvailabilityChange(id, true)
  }

  const updates: Record<string, number | null> = { [id]: val }
  if (aliasId) {
    updates[aliasId] = val
  }
  publishServings(updates)
}

export function getUnavailableItemIds(): string[] {
  return Object.entries(availabilityById)
    .filter(([, available]) => !available)
    .map(([id]) => id)
}

export function isItemAvailable(itemId: string): boolean {
  const id = String(itemId)
  const aliasId = PRODUCT_ALIASES[id]
  const avail = availabilityById[id] !== undefined ? availabilityById[id] : (aliasId ? availabilityById[aliasId] : undefined)
  return avail !== false
}

export function getItemRemainingServings(_itemId: string): number | null {
  return null
}

async function fetchAvailability() {
  if (availabilityRequest) return availabilityRequest

  availabilityRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/menu`)
      if (!response.ok) return
      const payload = await response.json()
      const next: Record<string, boolean> = {}
      if (Array.isArray(payload?.data)) {
        for (const product of payload.data) {
          if (product?.id != null) {
            const pid = String(product.id)
            if (typeof product.is_available === "boolean") {
              next[pid] = product.is_available
            }

            const aliasId = PRODUCT_ALIASES[pid]
            if (aliasId && typeof product.is_available === "boolean") {
              next[aliasId] = product.is_available
            }
          }
        }
      }
      publishAvailability(next)
    } catch (error) {
      console.warn("Could not load product availability:", error)
    }
  })()

  try {
    await availabilityRequest
  } finally {
    availabilityRequest = null
  }
}

export async function setItemAvailability(itemId: string, available: boolean): Promise<boolean> {
  const id = String(itemId)
  const previous = isItemAvailable(id)
  if (previous === available) {
    return true
  }

  // 1. Instant optimistic update (0ms local lag)
  applyProductAvailabilityChange(id, available)

  try {
    const rawUser = typeof window !== 'undefined' ? (sessionStorage.getItem('sfb_active_user_profile') || localStorage.getItem('sfb_active_user_profile')) : null
    let activeUser: any = null
    try { activeUser = rawUser ? JSON.parse(rawUser) : null } catch {}
    const isStaff = activeUser && ['kitchen', 'admin', 'cashier', 'assistant'].includes((activeUser.role || '').toLowerCase())

    let headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (isStaff) {
      headers = await getAuthHeaders()
    }

    const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(id)}/availability`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ is_available: available }),
    })
    if (!response.ok) {
      // Revert if rejected by server
      applyProductAvailabilityChange(id, previous)
      return false
    }
    return true
  } catch (error) {
    console.error("Could not update product availability:", error)
    applyProductAvailabilityChange(id, previous)
    return false
  }
}

export function toggleItemAvailability(itemId: string): Promise<boolean> {
  return setItemAvailability(itemId, !isItemAvailable(itemId))
}

export function useMenuAvailability() {
  const [availability, setAvailability] = useState<Record<string, boolean>>(() => availabilityById)
  const [servings, setServings] = useState<Record<string, number | null>>(() => servingsById)

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, boolean>> | undefined)?.detail
      setAvailability(detail || { ...availabilityById })
    }
    const syncServings = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, number | null>> | undefined)?.detail
      setServings(detail || { ...servingsById })
    }

    window.addEventListener(EVENT_NAME, sync)
    window.addEventListener(SERVINGS_EVENT_NAME, syncServings)
    void fetchAvailability()
    return () => {
      window.removeEventListener(EVENT_NAME, sync)
      window.removeEventListener(SERVINGS_EVENT_NAME, syncServings)
    }
  }, [])

  const toggle = useCallback((itemId: string) => {
    return toggleItemAvailability(itemId)
  }, [])

  const checkIsAvailable = useCallback(
    (itemId: string) => {
      const id = String(itemId)
      const aliasId = PRODUCT_ALIASES[id]
      const a = availability[id] !== undefined ? availability[id] : (aliasId ? availability[aliasId] : undefined)
      return a !== false
    },
    [availability]
  )

  const checkRemainingServings = useCallback(
    (_itemId: string) => {
      return null
    },
    []
  )

  return {
    availability,
    unavailableIds: Object.entries(availability).filter(([, available]) => !available).map(([id]) => id),
    remainingServings: servings,
    getRemainingServings: checkRemainingServings,
    toggleAvailability: toggle,
    isAvailable: checkIsAvailable,
    setAvailability: setItemAvailability,
  }
}

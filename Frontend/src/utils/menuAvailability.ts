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

export type MenuFulfillment = 'DINE_IN' | 'TAKE_OUT' | 'PICKUP' | 'DELIVERY'
type ServingsByFulfillment = Partial<Record<MenuFulfillment, number>>

const availabilityById: Record<string, boolean> = {}
/** Servings left per order type; null = no recipe, so not stock-limited. */
const servingsById: Record<string, ServingsByFulfillment | null> = {}
/** Which order type this screen is selling (customer: delivery/pickup, POS: dine-in/take-out). */
let activeFulfillment: MenuFulfillment = 'TAKE_OUT'
let availabilityRequest: Promise<void> | null = null
let refetchQueued = false
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

const sameServings = (a: ServingsByFulfillment | null | undefined, b: ServingsByFulfillment | null) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function publishServings(next?: Record<string, ServingsByFulfillment | null>, force = false) {
  let changed = force
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (!sameServings(servingsById[key], value)) {
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

/**
 * Applies servings pushed by the server after a stock change (only the products that use the
 * changed ingredients/packaging are included, so shared-ingredient dishes update together).
 */
export function applyInventoryServings(products: Record<string, { servings?: ServingsByFulfillment } | undefined>) {
  // Pass 1: each product's own figures, exactly as the server sent them.
  const own: Record<string, ServingsByFulfillment | null> = {}
  for (const [productId, entry] of Object.entries(products || {})) {
    own[productId] = entry?.servings ? { ...entry.servings } : null
  }

  // Pass 2: fill in from the alias, same rule as fetchAvailability — a product's own figure always
  // wins for itself, and the alias only fills a gap. Writing both keys in one pass would let
  // whichever of a slug/legacy pair came last overwrite the other.
  const updates: Record<string, ServingsByFulfillment | null> = {}
  for (const [productId, value] of Object.entries(own)) {
    const aliasId = PRODUCT_ALIASES[productId]
    updates[productId] = value ?? (aliasId ? own[aliasId] ?? null : null)
    if (aliasId && own[aliasId] === undefined) updates[aliasId] = value
  }
  publishServings(updates)
}

/** Tells the stock helpers which order type this screen is selling. */
export function setMenuFulfillment(fulfillment: MenuFulfillment) {
  if (activeFulfillment === fulfillment) return
  activeFulfillment = fulfillment
  publishServings(undefined, true)
}

export function getUnavailableItemIds(): string[] {
  return Object.entries(availabilityById)
    .filter(([, available]) => !available)
    .map(([id]) => id)
}

/** The kitchen's manual sold-out switch only (ignores inventory). */
export function isItemManuallyAvailable(itemId: string): boolean {
  const id = String(itemId)
  const aliasId = PRODUCT_ALIASES[id]
  const avail = availabilityById[id] !== undefined ? availabilityById[id] : (aliasId ? availabilityById[aliasId] : undefined)
  return avail !== false
}

function servingsFrom(
  table: Record<string, ServingsByFulfillment | null>,
  itemId: string,
  fulfillment: MenuFulfillment
): number | null {
  const id = String(itemId)
  const aliasId = PRODUCT_ALIASES[id]
  const entry = table[id] !== undefined ? table[id] : (aliasId ? table[aliasId] : undefined)
  if (!entry) return null
  const value = entry[fulfillment]
  return typeof value === 'number' ? value : null
}

/**
 * Servings left according to live inventory for an order type (defaults to this screen's type);
 * null means the dish has no recipe, so it is not stock-limited.
 */
export function getItemRemainingServings(itemId: string, fulfillment: MenuFulfillment = activeFulfillment): number | null {
  return servingsFrom(servingsById, itemId, fulfillment)
}

/** Orderable = not switched off by the kitchen AND inventory can still make at least one. */
export function isItemAvailable(itemId: string): boolean {
  if (!isItemManuallyAvailable(itemId)) return false
  const servings = getItemRemainingServings(itemId)
  return servings === null || servings > 0
}

/** Re-reads the menu so sold-out flags and servings left are current (used on stock-change events). */
export function refreshMenuAvailability(): Promise<void> {
  return fetchAvailability()
}

async function fetchAvailability(): Promise<void> {
  // A request already running was sent before the latest stock change: queue one more after it
  if (availabilityRequest) {
    refetchQueued = true
    return availabilityRequest
  }

  availabilityRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/menu`)
      if (!response.ok) return
      const payload = await response.json()
      // Pass 1: each product's own figures, exactly as the server sent them.
      const ownAvailability: Record<string, boolean> = {}
      const ownServings: Record<string, ServingsByFulfillment | null> = {}
      if (Array.isArray(payload?.data)) {
        for (const product of payload.data) {
          if (product?.id != null) {
            const pid = String(product.id)
            if (typeof product.is_available === "boolean") {
              ownAvailability[pid] = product.is_available
            }

            let servings: ServingsByFulfillment | null = null
            if (product.remaining_servings_by_fulfillment && typeof product.remaining_servings_by_fulfillment === 'object') {
              servings = { ...product.remaining_servings_by_fulfillment }
            } else if (product.remaining_servings !== null && product.remaining_servings !== undefined) {
              const n = Number(product.remaining_servings)
              if (Number.isFinite(n)) servings = { DINE_IN: n, TAKE_OUT: n, PICKUP: n, DELIVERY: n }
            }
            ownServings[pid] = servings
          }
        }
      }

      // Pass 2: fill in from the alias. The menu holds a slug row (mixed-seafoods-tub-189, which
      // carries the recipe) and a legacy duplicate (item-002, which has none and so reports no
      // servings). Writing both keys as each row is read let whichever row came last win, and the
      // legacy row's `null` wiped out the real count — the dish then never went Sold Out.
      // A product's own figure always wins for itself; the alias only fills a gap.
      const next: Record<string, boolean> = { ...ownAvailability }
      const nextServings: Record<string, ServingsByFulfillment | null> = {}
      for (const [pid, servings] of Object.entries(ownServings)) {
        const aliasId = PRODUCT_ALIASES[pid]
        const aliasServings = aliasId ? ownServings[aliasId] ?? null : null
        nextServings[pid] = servings ?? aliasServings
        if (aliasId && ownServings[aliasId] === undefined) {
          nextServings[aliasId] = servings
          if (next[aliasId] === undefined && ownAvailability[pid] !== undefined) next[aliasId] = ownAvailability[pid]
        }
      }

      publishAvailability(next)
      publishServings(nextServings)
    } catch (error) {
      console.warn("Could not load product availability:", error)
    }
  })()

  try {
    await availabilityRequest
  } finally {
    availabilityRequest = null
  }
  if (refetchQueued) {
    refetchQueued = false
    await fetchAvailability()
  }
}

export async function setItemAvailability(itemId: string, available: boolean): Promise<boolean> {
  const id = String(itemId)
  const previous = isItemManuallyAvailable(id)
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
  return setItemAvailability(itemId, !isItemManuallyAvailable(itemId))
}

export function useMenuAvailability() {
  const [availability, setAvailability] = useState<Record<string, boolean>>(() => availabilityById)
  const [servings, setServings] = useState<Record<string, ServingsByFulfillment | null>>(() => ({ ...servingsById }))
  const [fulfillment, setFulfillmentState] = useState<MenuFulfillment>(activeFulfillment)

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, boolean>> | undefined)?.detail
      setAvailability(detail || { ...availabilityById })
    }
    const syncServings = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, ServingsByFulfillment | null>> | undefined)?.detail
      setServings(detail || { ...servingsById })
      setFulfillmentState(activeFulfillment)
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

  const checkRemainingServings = useCallback(
    (itemId: string, forFulfillment?: MenuFulfillment) => servingsFrom(servings, itemId, forFulfillment ?? fulfillment),
    [servings, fulfillment]
  )

  const checkIsManuallyAvailable = useCallback(
    (itemId: string) => {
      const id = String(itemId)
      const aliasId = PRODUCT_ALIASES[id]
      const a = availability[id] !== undefined ? availability[id] : (aliasId ? availability[aliasId] : undefined)
      return a !== false
    },
    [availability]
  )

  const checkIsAvailable = useCallback(
    (itemId: string) => {
      if (!checkIsManuallyAvailable(itemId)) return false
      const left = checkRemainingServings(itemId)
      return left === null || left > 0
    },
    [checkIsManuallyAvailable, checkRemainingServings]
  )

  return {
    availability,
    unavailableIds: Object.entries(availability).filter(([, available]) => !available).map(([id]) => id),
    isManuallyAvailable: checkIsManuallyAvailable,
    remainingServings: servings,
    getRemainingServings: checkRemainingServings,
    toggleAvailability: toggle,
    isAvailable: checkIsAvailable,
    setAvailability: setItemAvailability,
  }
}

import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL, getAuthHeaders } from "./api"

const EVENT_NAME = "sfb_availability_changed"

let availabilityById: Record<string, boolean> = {}
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

export function applyProductAvailabilityChange(productId: string, isAvailable: boolean) {
  const id = String(productId)
  const boolVal = Boolean(isAvailable)
  // Deduplication guard: Never emit or loop if the value is already identical
  if (availabilityById[id] === boolVal) {
    return
  }

  availabilityRevision += 1
  publishAvailability({ [id]: boolVal })
}

export function getUnavailableItemIds(): string[] {
  return Object.entries(availabilityById)
    .filter(([, available]) => !available)
    .map(([id]) => id)
}

export function isItemAvailable(itemId: string): boolean {
  return availabilityById[String(itemId)] !== false
}

async function fetchAvailability() {
  if (availabilityRequest) return availabilityRequest

  availabilityRequest = (async () => {
    const revisionAtRequest = availabilityRevision
    try {
      const response = await fetch(`${API_BASE_URL}/menu`)
      if (!response.ok) return
      const payload = await response.json()
      const next: Record<string, boolean> = {}
      if (Array.isArray(payload?.data)) {
        for (const product of payload.data) {
          if (product?.id != null && typeof product.is_available === "boolean") {
            next[String(product.id)] = product.is_available
          }
        }
      }
      if (revisionAtRequest === availabilityRevision) {
        publishAvailability(next)
      }
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
  if (previous === available) return true

  // 1. Instant optimistic update (0ms local lag)
  applyProductAvailabilityChange(id, available)

  try {
    const response = await fetch(`${API_BASE_URL}/menu/${encodeURIComponent(id)}/availability`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
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

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = (event as CustomEvent<Record<string, boolean>> | undefined)?.detail
      setAvailability(detail || { ...availabilityById })
    }
    window.addEventListener(EVENT_NAME, sync)
    void fetchAvailability()
    return () => window.removeEventListener(EVENT_NAME, sync)
  }, [])

  const toggle = useCallback((itemId: string) => {
    return toggleItemAvailability(itemId)
  }, [])

  const checkIsAvailable = useCallback(
    (itemId: string) => availability[String(itemId)] !== false,
    [availability]
  )

  return {
    availability,
    unavailableIds: Object.entries(availability).filter(([, available]) => !available).map(([id]) => id),
    toggleAvailability: toggle,
    isAvailable: checkIsAvailable,
    setAvailability: setItemAvailability,
  }
}

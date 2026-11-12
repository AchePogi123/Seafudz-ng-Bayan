/**
 * Cart-level stock checking.
 *
 * The "servings left" on a menu card measures each dish on its own against the whole stockroom.
 * Two dishes made of the same shrimp therefore both report what the shrimp alone allows, and a
 * cart holding both can ask for more shrimp than exists — the per-item cap in `menuAvailability`
 * cannot see that, so the order was only refused at checkout.
 *
 * This asks the server to add the cart up as one order and say, per dish, how many of it the REST
 * of the cart still leaves room for. It runs debounced after a cart change rather than on every
 * tap, so adding an item stays instant: the per-item cap catches the obvious case immediately and
 * this trims what is left over a moment later. Nothing here reserves stock; the order itself still
 * does the authoritative check.
 */
import { useEffect, useRef } from 'react'
import { API_BASE_URL } from './api'
import type { MenuFulfillment } from './menuAvailability'

export type CartStockLine = { productId: string; quantity: number }

export type CartStockResult = {
  ok: boolean
  /** productId -> how many the rest of the cart leaves room for (null = not stock-limited) */
  products: Record<string, { maxQuantity: number | null; requested: number }>
  shortages: Array<{ ingredientId: string; name: string; unit?: string; needed: number; available: number }>
}

const EMPTY: CartStockResult = { ok: true, products: {}, shortages: [] }

/**
 * Asks the server what the cart as a whole can still be served.
 * Never throws and never blocks the cart: on any failure it reports "fine", because the order
 * endpoint re-checks before a single gram leaves stock.
 */
export async function checkCartStock(
  items: CartStockLine[],
  fulfillment: MenuFulfillment,
  signal?: AbortSignal
): Promise<CartStockResult> {
  const payload = items.filter((i) => i.productId && i.quantity > 0)
  if (payload.length === 0) return EMPTY
  try {
    const response = await fetch(`${API_BASE_URL}/menu/stock-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload, fulfillment }),
      signal,
    })
    if (!response.ok) return EMPTY
    const body = await response.json()
    const data = body?.data
    if (!data || typeof data !== 'object') return EMPTY
    return {
      ok: data.ok !== false,
      products: data.products && typeof data.products === 'object' ? data.products : {},
      shortages: Array.isArray(data.shortages) ? data.shortages : [],
    }
  } catch {
    // aborted, offline, or the server is not ready: let the cart stand
    return EMPTY
  }
}

/**
 * What a cart has to give up for everything in it to be servable.
 * Returns the lines to trim with the quantity each should come down to.
 */
export function cartOverages(
  items: CartStockLine[],
  result: CartStockResult
): Array<{ productId: string; from: number; to: number }> {
  const overages: Array<{ productId: string; from: number; to: number }> = []
  for (const line of items) {
    const entry = result.products[line.productId]
    const max = entry?.maxQuantity
    if (typeof max === 'number' && line.quantity > max) {
      overages.push({ productId: line.productId, from: line.quantity, to: Math.max(0, max) })
    }
  }
  return overages
}

/** "Only 2 of X can be made with what is left" / "X just sold out" — one sentence for a toast. */
export function overageMessage(name: string, to: number): string {
  return to > 0
    ? `Only ${to} of "${name}" can be made with the stock left — your cart has been adjusted.`
    : `"${name}" just ran out of stock and was removed from your cart.`
}

export type GuardedCartItem = { productId: string; name: string; quantity: number }

/**
 * Watches a cart and trims any line the rest of the cart has left no room for.
 *
 * Debounced, so typing a quantity or tapping "+" a few times costs one request, and re-run
 * whenever stock changes elsewhere (another till selling the same shrimp). `onTrim` is called
 * only when something actually has to come down — never on a cart that is fine.
 */
export function useCartStockGuard(
  items: GuardedCartItem[],
  fulfillment: MenuFulfillment,
  onTrim: (trims: Array<{ productId: string; name: string; from: number; to: number }>) => void,
  { delayMs = 400, enabled = true }: { delayMs?: number; enabled?: boolean } = {}
) {
  // kept in refs so the effect depends only on what the cart actually IS, not on new closures
  const onTrimRef = useRef(onTrim)
  const itemsRef = useRef(items)

  useEffect(() => {
    onTrimRef.current = onTrim
    itemsRef.current = items
  })

  const signature = items.map((i) => `${i.productId}:${i.quantity}`).join('|')

  useEffect(() => {
    if (!enabled || items.length === 0) return
    const controller = new AbortController()
    let cancelled = false

    const run = async () => {
      const current = itemsRef.current
      const result = await checkCartStock(current, fulfillment, controller.signal)
      if (cancelled) return
      const trims = cartOverages(current, result).map((o) => ({
        ...o,
        name: current.find((i) => i.productId === o.productId)?.name || o.productId,
      }))
      if (trims.length > 0) onTrimRef.current(trims)
    }

    const timer = setTimeout(run, delayMs)
    // another till or the kitchen moving stock changes what this cart can still have
    const onStockChange = () => {
      void run()
    }
    window.addEventListener('sfb_servings_changed', onStockChange)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
      window.removeEventListener('sfb_servings_changed', onStockChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, fulfillment, enabled, delayMs])
}

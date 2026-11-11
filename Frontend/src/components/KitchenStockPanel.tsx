import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, getAuthHeaders } from '../utils/api'
import { useMenuAvailability } from '../utils/menuAvailability'
import { subscribeOrderSync } from '../utils/orderSync'
import type { MenuItem } from './MenuCard'
import { LOW_SERVINGS_THRESHOLD } from './MenuCard'

interface IngredientAlert {
  id: string
  name: string
  itemType: 'FOOD' | 'PACKAGING'
  category: string
  unit: string
  currentStock: number
  minStockLevel: number
  status: 'LOW_STOCK' | 'OUT_OF_STOCK'
}

interface KitchenStockPanelProps {
  open: boolean
  onClose: () => void
  menuItems: MenuItem[]
}

const fmt = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 2 })

/**
 * What the kitchen can still make: servings left per dish (from live inventory),
 * the manual sold-out switch, and the ingredients that are running low.
 */
export const KitchenStockPanel: React.FC<KitchenStockPanelProps> = ({ open, onClose, menuItems }) => {
  const { getRemainingServings, isManuallyAvailable, toggleAvailability } = useMenuAvailability()
  const [alerts, setAlerts] = useState<IngredientAlert[]>([])
  const [alertsError, setAlertsError] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'ATTENTION'>('ATTENTION')
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/inventory/alerts`, { headers: await getAuthHeaders() })
        if (!res.ok) throw new Error(String(res.status))
        const json = await res.json()
        if (!cancelled) {
          setAlerts(Array.isArray(json.data) ? json.data : [])
          setAlertsError(false)
        }
      } catch {
        if (!cancelled) setAlertsError(true)
      }
    }
    void load()
    const unsubscribe = subscribeOrderSync(() => void load())
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menuItems
      .map((item) => {
        const left = getRemainingServings(item.id)
        const manual = isManuallyAvailable(item.id)
        const state: 'OFF' | 'OUT' | 'LOW' | 'OK' | 'UNTRACKED' = !manual
          ? 'OFF'
          : left === null
          ? 'UNTRACKED'
          : left === 0
          ? 'OUT'
          : left <= LOW_SERVINGS_THRESHOLD
          ? 'LOW'
          : 'OK'
        return { item, left, manual, state }
      })
      .filter((r) => (!q || r.item.name.toLowerCase().includes(q)) && (filter === 'ALL' || ['OFF', 'OUT', 'LOW'].includes(r.state)))
      .sort((a, b) => {
        const rank = { OUT: 0, OFF: 1, LOW: 2, OK: 3, UNTRACKED: 4 } as const
        return rank[a.state] - rank[b.state] || a.item.name.localeCompare(b.item.name)
      })
  }, [menuItems, search, filter, getRemainingServings, isManuallyAvailable])

  if (!open) return null

  const badge = (state: string, left: number | null) => {
    if (state === 'OFF') return <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-[11px] font-bold text-neutral-700">Switched off</span>
    if (state === 'OUT') return <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">Out of ingredients</span>
    if (state === 'LOW') return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">{left} left</span>
    if (state === 'OK') return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">{left} left</span>
    return <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-500">Not tracked</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kitchen-stock-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="kitchen-stock-title" className="text-lg font-extrabold text-neutral-900">Menu stock</h2>
            <p className="text-xs text-neutral-500">Servings left come from inventory and update as orders come in or are cancelled.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-bold text-neutral-600 hover:bg-neutral-100 cursor-pointer" aria-label="Close menu stock">
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_300px] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col border-b border-neutral-200 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes"
                aria-label="Search dishes"
                className="min-w-[160px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <div className="inline-flex rounded-lg bg-neutral-100 p-0.5" role="group" aria-label="Filter dishes">
                {(['ATTENTION', 'ALL'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer ${filter === f ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'}`}
                  >
                    {f === 'ALL' ? 'All dishes' : 'Needs attention'}
                  </button>
                ))}
              </div>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto px-5 pb-4">
              {rows.length === 0 ? (
                <li className="py-10 text-center text-sm text-neutral-500">
                  {filter === 'ATTENTION' ? 'Every dish can be made. Nothing needs attention.' : 'No dishes match your search.'}
                </li>
              ) : (
                rows.map(({ item, left, manual, state }) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-neutral-900">{item.name}</p>
                      <div className="mt-1">{badge(state, left)}</div>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-600">
                      <span>{manual ? 'On menu' : 'Switched off'}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        className="h-5 w-9 cursor-pointer accent-orange-500"
                        checked={manual}
                        disabled={pendingId === item.id}
                        aria-label={`${item.name} on menu`}
                        onChange={async () => {
                          setPendingId(item.id)
                          await toggleAvailability(item.id)
                          setPendingId(null)
                        }}
                      />
                    </label>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="min-h-0 overflow-y-auto px-5 py-4">
            <h3 className="text-sm font-extrabold text-neutral-900">Running low</h3>
            <p className="mb-3 text-xs text-neutral-500">Ingredients and packaging at or below their minimum.</p>
            {alertsError ? (
              <p className="text-sm text-neutral-500">Could not load ingredient levels right now.</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-neutral-500">Everything is above its minimum level.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.id} className="rounded-lg border border-neutral-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-neutral-900">{a.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${a.status === 'OUT_OF_STOCK' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'}`}
                      >
                        {a.status === 'OUT_OF_STOCK' ? 'Out' : 'Low'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {fmt(a.currentStock)} {a.unit} left · minimum {fmt(a.minStockLevel)} {a.unit}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default KitchenStockPanel

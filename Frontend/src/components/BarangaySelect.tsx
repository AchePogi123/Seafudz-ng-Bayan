import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    getDeliverableBarangaysByGroup,
    findDeliverableBarangayById,
    type DeliverableBarangay,
} from '../utils/deliveryCoverage'

type BarangaySelectVariant = 'warm' | 'warmCompact' | 'neutral'

interface BarangaySelectProps {
    id?: string
    value: string
    onChange: (barangayId: string) => void
    placeholder?: string
    disabled?: boolean
    variant?: BarangaySelectVariant
}

const VARIANT_STYLES: Record<BarangaySelectVariant, { trigger: string; search: string; text: string }> = {
    warm: {
        trigger:
            'w-full py-2.5 px-3.5 rounded-xl border border-[#eadfd7] bg-[#fcfaf8] hover:border-[#d8b9a5] focus:outline-none focus:border-[#FF6900] focus:bg-white focus:ring-4 focus:ring-[#FF6900]/10 transition-all',
        search:
            'w-full py-2 px-3 rounded-lg border border-[#eadfd7] bg-[#fcfaf8] text-sm focus:outline-none focus:border-[#FF6900] focus:bg-white',
        text: 'text-sm font-medium',
    },
    warmCompact: {
        trigger:
            'w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:border-[#FF6900] focus:ring-2 focus:ring-orange-500/10 transition-all',
        search:
            'w-full h-9 px-3 rounded-lg border border-neutral-200 bg-white text-xs focus:outline-none focus:border-[#FF6900]',
        text: 'text-xs font-medium',
    },
    neutral: {
        trigger:
            'w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-colors',
        search:
            'w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:outline-none focus:border-orange-500',
        text: 'text-sm',
    },
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const describeDistance = (b: DeliverableBarangay) =>
    b.distanceKm === 0 ? 'Store location' : `~${b.distanceKm.toFixed(1)} km`

/**
 * Searchable Barangay / Delivery Area picker.
 *
 * Only areas inside the store's 8 km radius are ever listed, so this control
 * doubles as the delivery-coverage gate: an out-of-range area cannot be chosen.
 * The search box filters by barangay name, city and district group, and matches
 * bare barangay numbers (typing "176" finds "Barangay 176 (Bagong Silang…)").
 */
export const BarangaySelect: React.FC<BarangaySelectProps> = ({
    id,
    value,
    onChange,
    placeholder = '-- Choose your Barangay / Delivery Area --',
    disabled = false,
    variant = 'neutral',
}) => {
    const styles = VARIANT_STYLES[variant]
    const groups = useMemo(() => getDeliverableBarangaysByGroup(), [])
    const selected = useMemo(() => findDeliverableBarangayById(value) ?? null, [value])

    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const [dropUp, setDropUp] = useState(false)

    const containerRef = useRef<HTMLDivElement | null>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const searchRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)

    const filteredGroups = useMemo(() => {
        const needle = normalize(query)
        const result: Array<[string, DeliverableBarangay[]]> = []

        for (const [groupName, barangays] of Object.entries(groups)) {
            const matches = !needle
                ? barangays
                : barangays.filter((b) => {
                      const haystack = normalize(`${b.name} ${b.city} ${b.cityGroup}`)
                      return needle.split(' ').every((token) => haystack.includes(token))
                  })
            if (matches.length > 0) result.push([groupName, matches])
        }

        return result
    }, [groups, query])

    // Flat list drives keyboard navigation across group boundaries.
    const flatOptions = useMemo(
        () => filteredGroups.flatMap(([, barangays]) => barangays),
        [filteredGroups]
    )

    useEffect(() => {
        setActiveIndex(0)
    }, [query])

    // Close on outside click.
    useEffect(() => {
        if (!isOpen) return
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
                setQuery('')
            }
        }
        document.addEventListener('mousedown', handlePointerDown)
        return () => document.removeEventListener('mousedown', handlePointerDown)
    }, [isOpen])

    // Focus the search box as soon as the panel opens.
    useEffect(() => {
        if (isOpen) searchRef.current?.focus()
    }, [isOpen])

    // Keep the highlighted option in view while arrowing through a long list.
    useEffect(() => {
        if (!isOpen) return
        const node = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
        node?.scrollIntoView({ block: 'nearest' })
    }, [activeIndex, isOpen])

    const PANEL_HEIGHT = 320

    const openPanel = () => {
        if (disabled) return
        // The registration card clips its overflow, so flip the panel upward
        // when there is not enough room below the trigger.
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect) {
            const spaceBelow = window.innerHeight - rect.bottom
            setDropUp(spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow)
        }
        setIsOpen(true)
        setQuery('')
    }

    const closePanel = () => {
        setIsOpen(false)
        setQuery('')
    }

    const commitSelection = (barangayId: string) => {
        onChange(barangayId)
        closePanel()
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            closePanel()
            return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!isOpen) {
                openPanel()
                return
            }
            if (flatOptions.length === 0) return
            setActiveIndex((prev) => {
                const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1
                if (next < 0) return flatOptions.length - 1
                if (next >= flatOptions.length) return 0
                return next
            })
            return
        }
        if (event.key === 'Enter') {
            if (!isOpen) {
                event.preventDefault()
                openPanel()
                return
            }
            const option = flatOptions[activeIndex]
            if (option) {
                event.preventDefault()
                commitSelection(option.id)
            }
        }
    }

    let optionIndex = -1

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                id={id}
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-required="true"
                disabled={disabled}
                onClick={() => (isOpen ? closePanel() : openPanel())}
                onKeyDown={handleKeyDown}
                className={`${styles.trigger} ${styles.text} flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
            >
                <span className={selected ? 'text-neutral-800 truncate' : 'text-neutral-400 truncate'}>
                    {selected ? `${selected.name} (${describeDistance(selected)})` : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className={`absolute z-50 w-full rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 ${
                        dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    }`}
                >
                    <div className="p-2 border-b border-neutral-100">
                        <div className="relative">
                            <svg
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                            </svg>
                            <input
                                ref={searchRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search barangay, city or area…"
                                aria-label="Search Barangay or Delivery Area"
                                className={`${styles.search} pl-8`}
                            />
                        </div>
                    </div>

                    <div ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
                        {flatOptions.length === 0 ? (
                            <p className="px-3 py-4 text-xs text-neutral-500 text-center leading-snug">
                                No delivery area matches “{query.trim()}”.
                                <br />
                                We only deliver within 8 km of our Caloocan store.
                            </p>
                        ) : (
                            filteredGroups.map(([groupName, barangays]) => (
                                <div key={groupName}>
                                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                        {groupName}
                                    </p>
                                    {barangays.map((b) => {
                                        optionIndex += 1
                                        const index = optionIndex
                                        const isActive = index === activeIndex
                                        const isSelected = b.id === value
                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                data-option-index={index}
                                                onMouseEnter={() => setActiveIndex(index)}
                                                onClick={() => commitSelection(b.id)}
                                                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                                                    isActive ? 'bg-orange-50 text-orange-900' : 'text-neutral-700'
                                                } ${isSelected ? 'font-bold' : 'font-medium'}`}
                                            >
                                                <span className="truncate">{b.name}</span>
                                                <span className="shrink-0 text-[10px] font-semibold text-neutral-400">
                                                    {describeDistance(b)}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default BarangaySelect

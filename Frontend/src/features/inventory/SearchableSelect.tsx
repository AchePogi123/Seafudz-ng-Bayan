import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './ui'

export interface SearchableOption {
  value: string
  label: string
  /** Shown under the label, e.g. a category or current stock. */
  hint?: string
  /** Pinned to the bottom and never filtered out, for actions like "not in the stockroom yet". */
  pinned?: boolean
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableOption[]
  placeholder: string
  /** Placeholder for the search box once the list is open. */
  searchPlaceholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
}

/**
 * A select that can be typed into.
 *
 * The stockroom runs to dozens of items, which is far too many to find in a native dropdown, so
 * the list filters as you type. It stays a single control: closed it reads exactly like the
 * `inv-select` it replaces, and it falls back to the same keyboard handling.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Search…',
  ariaLabel,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [rect, setRect] = useState<{
    top: number
    left: number
    width: number
    flip: boolean
    maxHeight: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) || null

  /**
   * The popup is rendered into <body>, because the rows it sits in are inside `.inv-lines`,
   * which clips its overflow, and inside a scrolling modal body. Anchoring it to the trigger's
   * viewport rect keeps it whole and above both.
   */
  const measure = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const GAP = 4
    const EDGE = 8
    const PREFERRED = 330

    const spaceBelow = window.innerHeight - r.bottom - GAP - EDGE
    const spaceAbove = r.top - GAP - EDGE
    // Open downward unless the other side genuinely has more room.
    const flip = spaceBelow < PREFERRED && spaceAbove > spaceBelow

    // When neither side fits the whole list, the list scrolls instead of running off screen.
    const available = Math.max(flip ? spaceAbove : spaceBelow, 160)

    setRect({
      top: flip ? r.top - GAP : r.bottom + GAP,
      left: Math.max(EDGE, Math.min(r.left, window.innerWidth - Math.max(r.width, 240) - EDGE)),
      width: Math.max(r.width, 240),
      flip,
      maxHeight: Math.min(PREFERRED, available),
    })
  }, [])

  /**
   * Pinned entries are actions, not results. They live in a footer that is always on screen,
   * rather than scrolling away at the end of a long list, which is exactly when a search that
   * found nothing needs them.
   */
  const pinned = useMemo(() => options.filter((o) => o.pinned), [options])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const results = options.filter((o) => !o.pinned)
    if (!q) return results
    return results.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ? o.hint.toLowerCase().includes(q) : false)
    )
  }, [options, query])

  // Close when the click lands outside, so the row behaves like any other dropdown.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      // The popup lives in a portal, so it is not inside rootRef — check it on its own.
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Measured before paint, so a reopened list never shows at its previous position.
  useLayoutEffect(() => {
    if (!open) return
    measure()
    const onReflow = () => measure()
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    setActiveIndex(Math.max(0, visible.findIndex((o) => o.value === value)))
    const id = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.children[activeIndex] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const commit = (option: SearchableOption) => {
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, visible.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const option = visible[activeIndex]
      if (option) commit(option)
    }
  }

  return (
    <div ref={rootRef} className={`inv-ssel ${className || ''}`}>
      <button
        type="button"
        className="inv-select inv-select--sm inv-ssel-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? undefined : 'inv-ssel-placeholder'}>{selected ? selected.label : placeholder}</span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            className={`inv-ssel-pop${rect.flip ? ' is-flipped' : ''}`}
            style={{ top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
            /* These pickers sit inside a <label>, and a click on a label is forwarded to its
               control, which would re-toggle the trigger the moment an option is chosen. */
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-ssel-search">
              <Icon name="search" className="inv-ssel-search-icon" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={`${ariaLabel} search`}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleKeyDown}
              />
              {query && (
                <button
                  type="button"
                  className="inv-ssel-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    setActiveIndex(0)
                    searchRef.current?.focus()
                  }}
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="inv-ssel-empty">
                <p className="inv-ssel-empty-title">No match for “{query}”</p>
                <p className="inv-ssel-empty-note">Check the spelling, or add it below.</p>
              </div>
            ) : (
              <ul className="inv-ssel-list" role="listbox" aria-label={ariaLabel} ref={listRef}>
                {visible.map((option, index) => {
                  const isSelected = option.value === value
                  return (
                    <li
                      key={option.value || `blank-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`inv-ssel-option${index === activeIndex ? ' is-active' : ''}${
                        isSelected ? ' is-selected' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(option)}
                    >
                      <span className="inv-ssel-check" aria-hidden="true">
                        {isSelected && <Icon name="check" className="h-3.5 w-3.5" />}
                      </span>
                      <span className="inv-ssel-label">{option.label}</span>
                      {option.hint && <span className="inv-ssel-hint">{option.hint}</span>}
                    </li>
                  )
                })}
              </ul>
            )}

            {pinned.length > 0 && (
              <div className="inv-ssel-foot">
                {pinned.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="inv-ssel-action"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(option)}
                  >
                    <Icon name="plus" className="h-3.5 w-3.5 shrink-0" />
                    <span>{option.label.replace(/^\+\s*/, '')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

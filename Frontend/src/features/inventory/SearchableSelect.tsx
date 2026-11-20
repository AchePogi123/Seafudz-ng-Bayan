import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value) || null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.pinned || o.label.toLowerCase().includes(q) || (o.hint ? o.hint.toLowerCase().includes(q) : false)
    )
  }, [options, query])

  // Close when the click lands outside, so the row behaves like any other dropdown.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

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

      {open && (
        <div
          className="inv-ssel-pop"
          /* These pickers sit inside a <label>, and a click on a label is forwarded to its
             control, which would re-toggle the trigger the moment an option is chosen. */
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inv-ssel-search">
            <Icon name="search" className="h-3.5 w-3.5 shrink-0 text-[var(--inv-text-3)]" />
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
          </div>
          {visible.length === 0 ? (
            <p className="inv-ssel-empty">No item matches “{query}”.</p>
          ) : (
            <ul className="inv-ssel-list" role="listbox" ref={listRef}>
              {visible.map((option, index) => (
                <li
                  key={option.value || `blank-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={`inv-ssel-option${index === activeIndex ? ' is-active' : ''}${
                    option.value === value ? ' is-selected' : ''
                  }${option.pinned ? ' is-pinned' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(option)}
                >
                  <span className="inv-ssel-label">{option.label}</span>
                  {option.hint && <span className="inv-ssel-hint">{option.hint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

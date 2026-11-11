import React, { useState, useMemo } from 'react'
import type { StockTransaction, TransactionType, Ingredient, InventoryItemType } from './inventoryTypes'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  MOVEMENT_TONE,
  Modal,
  Notice,
  Pagination,
  SearchInput,
  SectionHeader,
  Segmented,
  Toolbar,
  TypeBadge,
  cx,
  fieldAria,
  formatDate,
  formatQty,
  movementLabel,
} from './ui'

const PAGE_SIZE = 15

const FILTER_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'STOCK_RECEIVED', label: 'Stock received' },
  { value: 'CONSUMPTION', label: 'Used (orders and kitchen)' },
  { value: 'ORDER_RETURN', label: 'Returned from cancelled orders' },
  { value: 'WASTE', label: 'Waste or spoilage' },
  { value: 'ADJUSTMENT', label: 'Count correction' },
]

/** Types an admin can record by hand */
const MOVEMENT_OPTIONS: { value: TransactionType; label: string; hint: string }[] = [
  { value: 'STOCK_RECEIVED', label: 'Stock received', hint: 'Adds to stock.' },
  { value: 'CONSUMPTION', label: 'Kitchen usage', hint: 'Removes from stock.' },
  { value: 'WASTE', label: 'Waste or spoilage', hint: 'Removes from stock.' },
  { value: 'ADJUSTMENT', label: 'Count correction', hint: 'Use a negative number to reduce stock.' },
]

interface StockHistoryTabProps {
  transactions: StockTransaction[]
  ingredients: Ingredient[]
  onAddTransaction: (tx: Omit<StockTransaction, 'id' | 'timestamp' | 'referenceNo' | 'stockAfter'>) => void
}

export const StockHistoryTab: React.FC<StockHistoryTabProps> = ({
  transactions,
  ingredients,
  onAddTransaction,
}) => {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')
  const [selectedType, setSelectedType] = useState<'ALL' | TransactionType>('ALL')
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // Manual Transaction Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualIngredientId, setManualIngredientId] = useState('')
  const [manualType, setManualType] = useState<TransactionType>('ADJUSTMENT')
  const [manualQty, setManualQty] = useState<number | ''>('')
  const [manualReason, setManualReason] = useState('Stock Count Audit Reconciliation')
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({})

  // Separate Food and Packaging ingredients from catalog
  const foodIngredients = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD'),
    [ingredients]
  )
  const packagingIngredients = useMemo(
    () => ingredients.filter((i) => i.itemType === 'PACKAGING'),
    [ingredients]
  )

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.referenceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.performedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.reason || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType === 'ALL' || tx.type === selectedType
      const matchesItemType =
        itemTypeFilter === 'ALL' || (tx.itemType || 'FOOD') === itemTypeFilter

      let matchesDate = true
      if (dateFilter !== 'ALL') {
        const txDate = new Date(tx.timestamp).getTime()
        const now = new Date().getTime()
        if (dateFilter === 'TODAY') {
          matchesDate = now - txDate <= 86400000
        } else if (dateFilter === 'WEEK') {
          matchesDate = now - txDate <= 86400000 * 7
        } else if (dateFilter === 'MONTH') {
          matchesDate = now - txDate <= 86400000 * 30
        }
      }

      return matchesSearch && matchesType && matchesItemType && matchesDate
    })
  }, [transactions, searchQuery, selectedType, itemTypeFilter, dateFilter])

  // Pagination
  const sortedTransactions = useMemo(
    () => [...filteredTransactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filteredTransactions]
  )
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginatedTransactions = sortedTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActiveFilters =
    Boolean(searchQuery) || itemTypeFilter !== 'ALL' || selectedType !== 'ALL' || dateFilter !== 'ALL'
  const clearFilters = () => {
    setSearchQuery('')
    setItemTypeFilter('ALL')
    setSelectedType('ALL')
    setDateFilter('ALL')
    setCurrentPage(1)
  }

  const manualItem = ingredients.find((i) => i.id === manualIngredientId)
  const manualDelta = (() => {
    const qty = Number(manualQty)
    if (!qty) return 0
    if (manualType === 'CONSUMPTION' || manualType === 'WASTE') return -Math.abs(qty)
    if (manualType === 'STOCK_RECEIVED') return Math.abs(qty)
    return qty
  })()

  const handleOpenManualModal = () => {
    setManualIngredientId(ingredients[0]?.id || '')
    setManualType('ADJUSTMENT')
    setManualQty('')
    setManualReason('Physical Audit Count Reconciliation')
    setManualErrors({})
    setIsManualModalOpen(true)
  }

  const handleSaveManualTransaction = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    const qty = Number(manualQty)
    if (!manualIngredientId) errors.item = 'Choose the item this movement is for.'
    if (manualQty === '' || !qty) errors.qty = 'Enter a quantity other than 0.'
    else if (manualItem && manualItem.currentStock + manualDelta < 0)
      errors.qty = `Only ${formatQty(manualItem.currentStock)} ${manualItem.baseUnit} is on hand.`
    if (!manualReason.trim()) errors.reason = 'Add a short reason so the entry can be audited.'
    setManualErrors(errors)
    if (Object.keys(errors).length) {
      document.getElementById(`mv-${Object.keys(errors)[0]}`)?.focus()
      return
    }

    const ing = ingredients.find((i) => i.id === manualIngredientId)
    if (!ing) return

    // Positive delta for restock; negative for consumption or waste; signed for adjustment
    let delta = qty
    if (manualType === 'CONSUMPTION' || manualType === 'WASTE') {
      delta = -Math.abs(qty)
    } else if (manualType === 'STOCK_RECEIVED') {
      delta = Math.abs(qty)
    }

    onAddTransaction({
      ingredientId: ing.id,
      ingredientName: ing.name,
      itemType: ing.itemType || 'FOOD',
      category: ing.category,
      type: manualType,
      quantityDelta: delta,
      unit: ing.baseUnit,
      performedBy: 'Store Admin',
      reason: manualReason.trim(),
    })

    setIsManualModalOpen(false)
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Stock history"
        description="Every receipt, usage, waste and correction, newest first."
        actions={
          <Button variant="primary" icon="plus" onClick={handleOpenManualModal} disabled={ingredients.length === 0}>
            Record movement
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput
            label="Search stock history"
            placeholder="Search reference, item, person or reason"
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v)
              setCurrentPage(1)
            }}
          />
          <Segmented
            label="Item type"
            value={itemTypeFilter}
            onChange={(v) => {
              setItemTypeFilter(v)
              setCurrentPage(1)
            }}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'FOOD', label: 'Food' },
              { value: 'PACKAGING', label: 'Packaging' },
            ]}
          />
          <select
            aria-label="Movement type"
            className="inv-select w-full sm:w-auto"
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as 'ALL' | TransactionType)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">All movement types</option>
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Date range"
            className="inv-select w-full sm:w-auto"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value as 'ALL' | 'TODAY' | 'WEEK' | 'MONTH')
              setCurrentPage(1)
            }}
          >
            <option value="ALL">Any date</option>
            <option value="TODAY">Last 24 hours</option>
            <option value="WEEK">Last 7 days</option>
            <option value="MONTH">Last 30 days</option>
          </select>
        </Toolbar>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--inv-border)] bg-[var(--inv-surface-2)] px-4 py-2 text-[13px] text-[var(--inv-text-3)]">
            <span aria-live="polite">
              <b className="font-semibold text-[var(--inv-text)]">{sortedTransactions.length}</b> of {transactions.length}{' '}
              movements match
            </span>
            <button type="button" className="inv-link" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {paginatedTransactions.length === 0 ? (
          transactions.length === 0 ? (
            <EmptyState
              icon="history"
              title="No stock movements yet"
              description="Restocks, received purchase orders, kitchen usage and corrections will be listed here."
              action={
                ingredients.length > 0 && (
                  <Button variant="primary" icon="plus" onClick={handleOpenManualModal}>
                    Record movement
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="No matching movements"
              description="Try a wider date range or clear the filters."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Item</th>
                  <th scope="col">Movement</th>
                  <th scope="col" className="is-num">Change</th>
                  <th scope="col" className="is-num hidden sm:table-cell">Balance</th>
                  <th scope="col" className="hidden lg:table-cell">Reason</th>
                  <th scope="col" className="hidden md:table-cell">By</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => {
                  const isPositive = tx.quantityDelta > 0
                  return (
                    <tr key={tx.id}>
                      <td className="whitespace-nowrap">
                        <div className="text-[var(--inv-text)]">{formatDate(tx.timestamp, true)}</div>
                        <div className="inv-cell-secondary">{tx.referenceNo}</div>
                      </td>
                      <td className="max-w-[240px]">
                        <div className="inv-cell-primary truncate">{tx.ingredientName}</div>
                        <div className="inv-cell-secondary">
                          <TypeBadge itemType={tx.itemType} />
                        </div>
                      </td>
                      <td>
                        <Badge tone={MOVEMENT_TONE[tx.type] ?? 'neutral'}>{movementLabel(tx.type)}</Badge>
                      </td>
                      <td className="is-num">
                        <span className={cx('font-semibold', isPositive ? 'text-[var(--inv-success)]' : 'text-[var(--inv-danger)]')}>
                          {isPositive ? '+' : '−'}
                          {formatQty(Math.abs(tx.quantityDelta))} {tx.unit}
                        </span>
                      </td>
                      <td className="is-num hidden sm:table-cell">
                        {formatQty(tx.stockAfter)} {tx.unit}
                      </td>
                      <td className="hidden max-w-[280px] lg:table-cell">
                        <span className="line-clamp-2 text-[13px]" title={tx.reason || ''}>
                          {tx.reason || '—'}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap md:table-cell">{tx.performedBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sortedTransactions.length}
          onChange={setCurrentPage}
          noun="movements"
        />
      </Card>

      <Modal
        open={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Record stock movement"
        description="Log a receipt, kitchen usage, waste, or a correction after a physical count."
        onSubmit={handleSaveManualTransaction}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save movement
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Item" htmlFor="mv-item" required error={manualErrors.item}>
            <select
              {...fieldAria('mv-item', manualErrors.item)}
              className="inv-select"
              value={manualIngredientId}
              onChange={(e) => setManualIngredientId(e.target.value)}
            >
              <option value="">Choose an item</option>
              {foodIngredients.length > 0 && (
                <optgroup label="Food">
                  {foodIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {formatQty(i.currentStock)} {i.baseUnit}
                    </option>
                  ))}
                </optgroup>
              )}
              {packagingIngredients.length > 0 && (
                <optgroup label="Packaging">
                  {packagingIngredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {formatQty(i.currentStock)} {i.baseUnit}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>

          <Field
            label="Movement type"
            htmlFor="mv-type"
            hint={MOVEMENT_OPTIONS.find((o) => o.value === manualType)?.hint}
          >
            <select
              {...fieldAria('mv-type', undefined, true)}
              className="inv-select"
              value={manualType}
              onChange={(e) => setManualType(e.target.value as TransactionType)}
            >
              {MOVEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" htmlFor="mv-qty" required error={manualErrors.qty}>
            <div className="inv-input-group">
              <input
                {...fieldAria('mv-qty', manualErrors.qty)}
                type="number"
                inputMode="decimal"
                step="any"
                className="inv-input"
                placeholder="e.g. 50"
                value={manualQty}
                onChange={(e) => setManualQty(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="inv-input-suffix">{manualItem?.baseUnit || 'units'}</span>
            </div>
          </Field>

          {manualItem && manualDelta !== 0 && manualItem.currentStock + manualDelta >= 0 && (
            <Notice tone="info">
              {formatQty(manualItem.currentStock)} → <b>{formatQty(manualItem.currentStock + manualDelta)} {manualItem.baseUnit}</b>{' '}
              ({manualDelta > 0 ? '+' : '−'}
              {formatQty(Math.abs(manualDelta))})
            </Notice>
          )}

          <Field label="Reason" htmlFor="mv-reason" required error={manualErrors.reason}>
            <input
              {...fieldAria('mv-reason', manualErrors.reason)}
              type="text"
              className="inv-input"
              placeholder="e.g. Physical count found 2 kg less"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

export default StockHistoryTab

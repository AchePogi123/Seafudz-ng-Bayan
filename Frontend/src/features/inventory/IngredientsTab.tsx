import React, { useState, useMemo, useEffect } from 'react'
import type {
  Ingredient,
  IngredientCategory,
  MeasurementUnit,
  StockStatus,
  StockTransaction,
  Supplier,
  InventoryItemType,
  TransactionType,
} from './inventoryTypes'
import { FOOD_CATEGORIES, PACKAGING_CATEGORIES, MEASUREMENT_UNITS } from './inventoryTypes'
import InventoryConfirmModal from './InventoryConfirmModal'
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  MOVEMENT_TONE,
  Modal,
  Notice,
  Pagination,
  RowMenu,
  SearchInput,
  SectionHeader,
  Segmented,
  StockMeter,
  StockStatusBadge,
  Toolbar,
  TypeBadge,
  cx,
  fieldAria,
  formatDate,
  formatPeso,
  formatQty,
  movementLabel,
} from './ui'

interface IngredientsTabProps {
  ingredients: Ingredient[]
  suppliers: Supplier[]
  transactions?: StockTransaction[]
  initialStatus?: string
  onAddIngredient: (item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>) => void
  onEditIngredient: (item: Ingredient) => void
  onDeleteIngredient: (id: string) => void
  onAdjustStock: (
    id: string,
    delta: number,
    reason: string,
    details?: { seller?: string; purchaseDate?: string; movementType?: TransactionType }
  ) => void
}

type StatusFilter = 'ALL' | 'ATTENTION' | StockStatus
type SortKey = 'DEFAULT' | 'NAME' | 'LOWEST'

const STATUS_FILTERS: StatusFilter[] = ['ALL', 'ATTENTION', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']

/** Stock-out reasons and the ledger movement type each one records */
const DEDUCT_REASONS: { value: string; type: TransactionType }[] = [
  { value: 'Kitchen Consumption / Daily Usage', type: 'CONSUMPTION' },
  { value: 'Food Waste / Spoilage Deduction', type: 'WASTE' },
  { value: 'Packaging Damage / Defective Batch', type: 'WASTE' },
  { value: 'Kitchen Preparation Loss / Trim', type: 'WASTE' },
  { value: 'Physical Audit Count Reconciliation', type: 'ADJUSTMENT' },
  { value: 'Other Manual Adjustment', type: 'ADJUSTMENT' },
]

const PURCHASE_UNITS: { value: string; label: string }[] = [
  { value: 'kg', label: 'kg (kilograms)' },
  { value: 'g', label: 'g (grams)' },
  { value: 'L', label: 'L (liters)' },
  { value: 'ml', label: 'ml (milliliters)' },
  { value: 'pcs', label: 'pcs (pieces)' },
  { value: 'packs', label: 'packs' },
  { value: 'boxes', label: 'boxes' },
  { value: 'cans', label: 'cans' },
  { value: 'bottles', label: 'bottles' },
  { value: 'tins', label: 'tins' },
  { value: 'tub', label: 'tubs' },
  { value: 'sack', label: 'sacks' },
]

const PAGE_SIZE = 12

/** Converts a purchase quantity into the item's base unit where the units are related. */
function toBaseUnit(qty: number, purchaseUnit: string, baseUnit: string) {
  if (baseUnit === 'g' && purchaseUnit === 'kg') return qty * 1000
  if (baseUnit === 'kg' && purchaseUnit === 'g') return qty / 1000
  if (baseUnit === 'ml' && purchaseUnit === 'L') return qty * 1000
  if (baseUnit === 'L' && purchaseUnit === 'ml') return qty / 1000
  return qty
}

const today = () => new Date().toISOString().split('T')[0]

export const IngredientsTab: React.FC<IngredientsTabProps> = ({
  ingredients,
  suppliers,
  transactions = [],
  initialStatus,
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  onAdjustStock,
}) => {
  /* ------------------------------------------------------------ Filters */
  const normalizedInitial: StatusFilter = STATUS_FILTERS.includes(initialStatus as StatusFilter)
    ? (initialStatus as StatusFilter)
    : 'ALL'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<'ALL' | InventoryItemType>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(normalizedInitial)
  const [sortKey, setSortKey] = useState<SortKey>('DEFAULT')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setSelectedStatus(normalizedInitial)
    setCurrentPage(1)
  }, [normalizedInitial])

  /* -------------------------------------------------------- Overlays */
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [deletingIngredientId, setDeletingIngredientId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  /* ------------------------------------------------- Add / edit form */
  const [formItemType, setFormItemType] = useState<InventoryItemType>('FOOD')
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<IngredientCategory>('Seafoods')
  const [formBaseUnit, setFormBaseUnit] = useState<MeasurementUnit>('g')
  const [formCurrentStock, setFormCurrentStock] = useState<number | ''>('')
  const [formMinStock, setFormMinStock] = useState<number | ''>('')
  const [formReorderQty, setFormReorderQty] = useState<number | ''>('')
  const [formCost, setFormCost] = useState<number | ''>('')
  const [formSupplierId, setFormSupplierId] = useState<string>('')
  const [formStorageNotes, setFormStorageNotes] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [formTouched, setFormTouched] = useState(false)

  /* ------------------------------------------------ Stock movement form */
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [stockModalMode, setStockModalMode] = useState<'PURCHASE' | 'DEDUCT'>('PURCHASE')
  const [selectedStockItemId, setSelectedStockItemId] = useState<string>('')
  const [purchaseQty, setPurchaseQty] = useState<number | ''>('')
  const [purchaseUnit, setPurchaseUnit] = useState<string>('kg')
  const [sellerMarket, setSellerMarket] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState<string>(today)
  const [deductQty, setDeductQty] = useState<number | ''>('')
  const [deductReason, setDeductReason] = useState<string>(DEDUCT_REASONS[0].value)
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({})

  /* ------------------------------------------------------- Derived data */
  const foodCount = useMemo(() => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD').length, [ingredients])
  const packagingCount = ingredients.length - foodCount

  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; attention: number }>()
    ingredients.forEach((i) => {
      const cur = map.get(i.category) || { count: 0, attention: 0 }
      cur.count += 1
      if (i.status !== 'IN_STOCK') cur.attention += 1
      map.set(i.category, cur)
    })
    return map
  }, [ingredients])

  const availableCategories = useMemo(() => {
    if (selectedType === 'FOOD') return FOOD_CATEGORIES
    if (selectedType === 'PACKAGING') return PACKAGING_CATEGORIES
    return [...FOOD_CATEGORIES, ...PACKAGING_CATEGORIES]
  }, [selectedType])

  const filteredIngredients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = ingredients.filter((item) => {
      const itemType = item.itemType || 'FOOD'
      const matchesType = selectedType === 'ALL' || itemType === selectedType
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.storageNotes || '').toLowerCase().includes(q) ||
        (item.supplierName || '').toLowerCase().includes(q)
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ATTENTION' ? item.status !== 'IN_STOCK' : item.status === selectedStatus)
      return matchesType && matchesSearch && matchesCategory && matchesStatus
    })
    if (sortKey === 'NAME') return [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sortKey === 'LOWEST') {
      const ratio = (i: Ingredient) => (i.minStockLevel > 0 ? i.currentStock / i.minStockLevel : i.currentStock > 0 ? 99 : 0)
      return [...list].sort((a, b) => ratio(a) - ratio(b))
    }
    return list
  }, [ingredients, selectedType, searchQuery, selectedCategory, selectedStatus, sortKey])

  const totalPages = Math.max(1, Math.ceil(filteredIngredients.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginatedIngredients = filteredIngredients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const hasActiveFilters =
    Boolean(searchQuery) || selectedType !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedType('ALL')
    setSelectedCategory('ALL')
    setSelectedStatus('ALL')
    setCurrentPage(1)
  }

  const pickCategory = (type: 'ALL' | InventoryItemType, category: string) => {
    setSelectedType(type)
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const detailItem = useMemo(() => ingredients.find((i) => i.id === detailId) || null, [ingredients, detailId])
  const detailMovements = useMemo(
    () =>
      detailId
        ? transactions
            .filter((t) => t.ingredientId === detailId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 6)
        : [],
    [transactions, detailId]
  )

  /* ------------------------------------------------- Add / edit handlers */
  const resetForm = (itemType: InventoryItemType = 'FOOD') => {
    setFormItemType(itemType)
    setFormName('')
    setFormCategory(itemType === 'FOOD' ? 'Seafoods' : 'Trays, Bowls & Containers')
    setFormBaseUnit(itemType === 'FOOD' ? 'g' : 'pcs')
    setFormCurrentStock('')
    setFormMinStock('')
    setFormReorderQty('')
    setFormCost('')
    setFormSupplierId('')
    setFormStorageNotes('')
    setFormErrors({})
    setFormTouched(false)
  }

  const handleOpenAddModal = (defaultType?: InventoryItemType) => {
    const targetType = defaultType || (selectedType === 'PACKAGING' ? 'PACKAGING' : 'FOOD')
    resetForm(targetType)
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (item: Ingredient) => {
    setDetailId(null)
    setEditingIngredient(item)
    setFormItemType(item.itemType || 'FOOD')
    setFormName(item.name)
    setFormCategory(item.category)
    setFormBaseUnit(item.baseUnit)
    setFormCurrentStock(item.currentStock)
    setFormMinStock(item.minStockLevel)
    setFormReorderQty(item.preferredRestockQty)
    setFormCost(item.costPerUnit || '')
    setFormSupplierId(item.supplierId || '')
    setFormStorageNotes(item.storageNotes || '')
    setFormErrors({})
    setFormTouched(false)
  }

  const closeItemForm = () => {
    setIsAddModalOpen(false)
    setEditingIngredient(null)
  }

  const handleItemTypeSwitch = (type: InventoryItemType) => {
    if (formItemType === type) return
    setFormItemType(type)
    if (type === 'FOOD') {
      setFormCategory('Seafoods')
      setFormBaseUnit('g')
    } else {
      setFormCategory('Trays, Bowls & Containers')
      setFormBaseUnit('pcs')
    }
  }

  const computeFormErrors = () => {
    const errors: Record<string, string> = {}
    const noun = formItemType === 'FOOD' ? 'ingredient' : 'packaging item'
    if (!formName.trim()) errors.name = `Enter a name for this ${noun}.`
    else {
      const dupe = ingredients.find(
        (i) => i.name.trim().toLowerCase() === formName.trim().toLowerCase() && i.id !== editingIngredient?.id
      )
      if (dupe) errors.name = `"${dupe.name}" already exists in the catalog.`
    }
    if (formCurrentStock !== '' && Number(formCurrentStock) < 0) errors.currentStock = 'Stock cannot be negative.'
    if (formMinStock === '') errors.minStock = 'Enter the minimum level (0 is allowed).'
    else if (Number(formMinStock) < 0) errors.minStock = 'Minimum level cannot be negative.'
    if (formReorderQty === '') errors.reorderQty = 'Enter how much you usually reorder.'
    else if (Number(formReorderQty) <= 0) errors.reorderQty = 'Reorder quantity must be more than 0.'
    if (formCost !== '' && Number(formCost) < 0) errors.cost = 'Cost cannot be negative.'
    return errors
  }

  // Re-validate as the user types once they have tried to submit
  useEffect(() => {
    if (formTouched) setFormErrors(computeFormErrors())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formTouched, formName, formCurrentStock, formMinStock, formReorderQty, formCost, formItemType])

  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    setFormTouched(true)
    const errors = computeFormErrors()
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      const first = Object.keys(errors)[0]
      document.getElementById(`ing-${first}`)?.focus()
      return
    }

    const selectedSupplier = suppliers.find((s) => s.id === formSupplierId)

    if (editingIngredient) {
      const updatedStock = Number(formCurrentStock) || 0
      const minLevel = Number(formMinStock) || 0
      let computedStatus: StockStatus = 'IN_STOCK'
      if (updatedStock <= 0) computedStatus = 'OUT_OF_STOCK'
      else if (updatedStock <= minLevel) computedStatus = 'LOW_STOCK'

      onEditIngredient({
        ...editingIngredient,
        name: formName.trim(),
        itemType: formItemType,
        category: formCategory,
        baseUnit: formBaseUnit,
        currentStock: updatedStock,
        minStockLevel: minLevel,
        preferredRestockQty: Number(formReorderQty) || 0,
        costPerUnit: Number(formCost) || 0,
        supplierId: formSupplierId || undefined,
        supplierName: selectedSupplier ? selectedSupplier.name : undefined,
        storageNotes: formStorageNotes.trim() || undefined,
        status: computedStatus,
        updatedAt: new Date().toISOString(),
      })
      setEditingIngredient(null)
    } else {
      onAddIngredient({
        name: formName.trim(),
        itemType: formItemType,
        category: formCategory,
        baseUnit: formBaseUnit,
        currentStock: Number(formCurrentStock) || 0,
        minStockLevel: Number(formMinStock) || 0,
        preferredRestockQty: Number(formReorderQty) || 0,
        costPerUnit: Number(formCost) || 0,
        supplierId: formSupplierId || undefined,
        supplierName: selectedSupplier ? selectedSupplier.name : undefined,
        storageNotes: formStorageNotes.trim() || undefined,
      })
      setIsAddModalOpen(false)
    }
    resetForm()
  }

  /* ---------------------------------------------- Stock movement handlers */
  const handleOpenStockModal = (item?: Ingredient, mode: 'PURCHASE' | 'DEDUCT' = 'PURCHASE') => {
    const targetItem = item || (ingredients.length > 0 ? ingredients[0] : null)
    if (targetItem) {
      setSelectedStockItemId(targetItem.id)
      setPurchaseUnit(targetItem.baseUnit === 'g' ? 'kg' : targetItem.baseUnit)
      setSellerMarket(targetItem.supplierName || '')
    } else {
      setSelectedStockItemId('')
      setPurchaseUnit('kg')
      setSellerMarket('')
    }
    setPurchaseQty('')
    setDeductQty('')
    setPurchaseDate(today())
    setStockModalMode(mode)
    setDeductReason(DEDUCT_REASONS[0].value)
    setStockErrors({})
    setDetailId(null)
    setIsStockModalOpen(true)
  }

  const selectedStockItem = useMemo(
    () => ingredients.find((i) => i.id === selectedStockItemId) || null,
    [ingredients, selectedStockItemId]
  )

  const purchaseDelta =
    selectedStockItem && Number(purchaseQty) > 0
      ? toBaseUnit(Number(purchaseQty), purchaseUnit, selectedStockItem.baseUnit)
      : 0
  const unitsConvert = selectedStockItem
    ? toBaseUnit(1, purchaseUnit, selectedStockItem.baseUnit) !== 1
    : false
  const unitsMismatch =
    selectedStockItem && !unitsConvert && purchaseUnit !== selectedStockItem.baseUnit

  const handleConfirmStockModal = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!selectedStockItem) {
      setStockErrors({ item: 'Choose the item this movement is for.' })
      return
    }

    if (stockModalMode === 'PURCHASE') {
      const qVal = Number(purchaseQty)
      if (purchaseQty === '' || isNaN(qVal) || qVal <= 0) errors.purchaseQty = 'Enter a quantity greater than 0.'
      if (!purchaseUnit) errors.purchaseUnit = 'Choose the unit you bought in.'
      if (!purchaseDate) errors.purchaseDate = 'Enter the purchase date.'
      else if (purchaseDate > today()) errors.purchaseDate = 'Purchase date cannot be in the future.'
      setStockErrors(errors)
      if (Object.keys(errors).length) return

      const finalDelta = toBaseUnit(qVal, purchaseUnit, selectedStockItem.baseUnit)
      const conversionNote = unitsConvert
        ? ` (${qVal} ${purchaseUnit} converted to ${finalDelta.toLocaleString()} ${selectedStockItem.baseUnit})`
        : ''
      const sellerNote = sellerMarket.trim() ? ` from ${sellerMarket.trim()}` : ''
      const reasonText = `Purchased ${qVal} ${purchaseUnit}${conversionNote}${sellerNote} • Date: ${purchaseDate}`

      onAdjustStock(selectedStockItem.id, finalDelta, reasonText, {
        seller: sellerMarket.trim() || undefined,
        purchaseDate,
        movementType: 'STOCK_RECEIVED',
      })
    } else {
      const dVal = Number(deductQty)
      if (deductQty === '' || isNaN(dVal) || dVal <= 0) errors.deductQty = 'Enter a quantity greater than 0.'
      else if (selectedStockItem.currentStock - dVal < 0)
        errors.deductQty = `Only ${formatQty(selectedStockItem.currentStock)} ${selectedStockItem.baseUnit} is on hand.`
      setStockErrors(errors)
      if (Object.keys(errors).length) return

      const reasonMeta = DEDUCT_REASONS.find((r) => r.value === deductReason)
      onAdjustStock(
        selectedStockItem.id,
        -dVal,
        `Stock Deduction: ${deductReason} (-${dVal} ${selectedStockItem.baseUnit})`,
        { movementType: reasonMeta?.type ?? 'ADJUSTMENT' }
      )
    }
    setIsStockModalOpen(false)
  }

  /* ------------------------------------------------------------- Render */
  const formUnit = formBaseUnit

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Items"
        description="Food ingredients and packaging materials, with live stock levels."
        actions={
          <>
            <Button
              variant="secondary"
              icon="restock"
              onClick={() => handleOpenStockModal()}
              disabled={ingredients.length === 0}
            >
              Record stock
            </Button>
            <Button variant="primary" icon="plus" onClick={() => handleOpenAddModal()}>
              Add item
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Category navigation */}
        <Card className="hidden lg:block lg:sticky lg:top-4">
          <nav className="inv-cat-list" aria-label="Categories">
            <button
              type="button"
              className="inv-cat"
              aria-pressed={selectedType === 'ALL' && selectedCategory === 'ALL'}
              onClick={() => pickCategory('ALL', 'ALL')}
            >
              <span>All items</span>
              <span className="inv-cat-count">{ingredients.length}</span>
            </button>
            {(
              [
                { type: 'FOOD' as const, label: 'Food', total: foodCount, cats: FOOD_CATEGORIES },
                { type: 'PACKAGING' as const, label: 'Packaging', total: packagingCount, cats: PACKAGING_CATEGORIES },
              ]
            ).map((group) => (
              <React.Fragment key={group.type}>
                <button
                  type="button"
                  className="inv-cat mt-2 font-semibold"
                  aria-pressed={selectedType === group.type && selectedCategory === 'ALL'}
                  onClick={() => pickCategory(group.type, 'ALL')}
                >
                  <span>{group.label}</span>
                  <span className="inv-cat-count">{group.total}</span>
                </button>
                {group.cats.map((cat) => {
                  const stat = categoryStats.get(cat)
                  if (!stat) return null
                  return (
                    <button
                      key={cat}
                      type="button"
                      className="inv-cat pl-5"
                      aria-pressed={selectedCategory === cat}
                      onClick={() => pickCategory(group.type, cat)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{cat}</span>
                        {stat.attention > 0 && (
                          <span className="inv-cat-alert" title={`${stat.attention} need attention`} />
                        )}
                      </span>
                      <span className="inv-cat-count">{stat.count}</span>
                    </button>
                  )
                })}
              </React.Fragment>
            ))}
          </nav>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <Toolbar>
            <SearchInput
              label="Search items"
              placeholder="Search by name, supplier or storage note"
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v)
                setCurrentPage(1)
              }}
            />
            <div className="lg:hidden">
              <Segmented
                label="Item type"
                value={selectedType}
                onChange={(v) => pickCategory(v, 'ALL')}
                options={[
                  { value: 'ALL', label: 'All' },
                  { value: 'FOOD', label: 'Food' },
                  { value: 'PACKAGING', label: 'Packaging' },
                ]}
              />
            </div>
            <select
              aria-label="Category"
              className="inv-select w-full sm:w-auto lg:hidden"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="ALL">All categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({categoryStats.get(cat)?.count ?? 0})
                </option>
              ))}
            </select>
            <select
              aria-label="Stock status"
              className="inv-select w-full sm:w-auto"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as StatusFilter)
                setCurrentPage(1)
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="ATTENTION">Needs attention</option>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </select>
            <select
              aria-label="Sort"
              className="inv-select w-full sm:w-auto"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="DEFAULT">Sort: Recently added</option>
              <option value="NAME">Sort: Name A–Z</option>
              <option value="LOWEST">Sort: Lowest stock first</option>
            </select>
          </Toolbar>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--inv-border)] bg-[var(--inv-surface-2)] px-4 py-2 text-[13px] text-[var(--inv-text-3)]">
              <span aria-live="polite">
                Showing <b className="font-semibold text-[var(--inv-text)]">{filteredIngredients.length}</b> of{' '}
                {ingredients.length} items
                {selectedCategory !== 'ALL' && <> in {selectedCategory}</>}
              </span>
              <button type="button" className="inv-link" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}

          {paginatedIngredients.length === 0 ? (
            ingredients.length === 0 ? (
              <EmptyState
                icon="box"
                title="No items yet"
                description="Add your first food ingredient or packaging material to start tracking stock."
                action={
                  <>
                    <Button variant="primary" icon="plus" onClick={() => handleOpenAddModal('FOOD')}>
                      Add food ingredient
                    </Button>
                    <Button variant="secondary" onClick={() => handleOpenAddModal('PACKAGING')}>
                      Add packaging
                    </Button>
                  </>
                }
              />
            ) : (
              <EmptyState
                icon="search"
                title="No matching items"
                description="Try a different search term or clear the filters to see all items."
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
                    <th scope="col">Item</th>
                    <th scope="col" className="hidden md:table-cell">Type</th>
                    <th scope="col" className="is-num">On hand</th>
                    <th scope="col" className="hidden xl:table-cell">Level</th>
                    <th scope="col" className="is-num hidden sm:table-cell">Minimum</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="is-actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedIngredients.map((item) => (
                    <tr
                      key={item.id}
                      className={cx(
                        item.status === 'LOW_STOCK' && 'is-attention',
                        item.status === 'OUT_OF_STOCK' && 'is-critical'
                      )}
                    >
                      <td className="max-w-[280px]">
                        <button type="button" className="inv-row-link block max-w-full truncate" onClick={() => setDetailId(item.id)}>
                          {item.name}
                        </button>
                        <div className="inv-cell-secondary truncate">
                          {item.category}
                          {item.supplierName && <> · {item.supplierName}</>}
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <TypeBadge itemType={item.itemType} />
                      </td>
                      <td className="is-num">
                        <span className="font-semibold text-[var(--inv-text)]">{formatQty(item.currentStock)}</span>{' '}
                        <span className="text-[var(--inv-text-3)]">{item.baseUnit}</span>
                      </td>
                      <td className="hidden xl:table-cell">
                        <StockMeter
                          compact
                          current={item.currentStock}
                          min={item.minStockLevel}
                          unit={item.baseUnit}
                          status={item.status}
                        />
                      </td>
                      <td className="is-num hidden text-[var(--inv-text-3)] sm:table-cell">
                        {formatQty(item.minStockLevel)} {item.baseUnit}
                      </td>
                      <td>
                        <StockStatusBadge status={item.status} />
                      </td>
                      <td className="is-actions">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon="restock"
                            className="hidden sm:inline-flex"
                            onClick={() => handleOpenStockModal(item, 'PURCHASE')}
                            aria-label={`Restock ${item.name}`}
                          >
                            Restock
                          </Button>
                          <RowMenu
                            label={`More actions for ${item.name}`}
                            items={[
                              { label: 'View details', icon: 'eye', onSelect: () => setDetailId(item.id) },
                              { label: 'Edit item', icon: 'edit', onSelect: () => handleOpenEditModal(item) },
                              { label: 'Restock', icon: 'restock', onSelect: () => handleOpenStockModal(item, 'PURCHASE') },
                              { label: 'Record usage or loss', icon: 'usage', onSelect: () => handleOpenStockModal(item, 'DEDUCT') },
                              {
                                label: 'Delete item',
                                icon: 'trash',
                                danger: true,
                                separatorBefore: true,
                                onSelect: () => setDeletingIngredientId(item.id),
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filteredIngredients.length}
            onChange={setCurrentPage}
            noun="items"
          />
        </Card>
      </div>

      {/* Item details drawer */}
      <Drawer
        open={Boolean(detailItem)}
        onClose={() => setDetailId(null)}
        title={detailItem?.name ?? ''}
        description={
          detailItem && (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <TypeBadge itemType={detailItem.itemType} />
              <StockStatusBadge status={detailItem.status} />
            </span>
          )
        }
        footer={
          detailItem && (
            <>
              <Button
                variant="danger-ghost"
                icon="trash"
                className="mr-auto"
                onClick={() => {
                  setDeletingIngredientId(detailItem.id)
                }}
              >
                Delete
              </Button>
              <Button variant="secondary" icon="edit" onClick={() => handleOpenEditModal(detailItem)}>
                Edit
              </Button>
              <Button variant="primary" icon="restock" onClick={() => handleOpenStockModal(detailItem, 'PURCHASE')}>
                Restock
              </Button>
            </>
          )
        }
      >
        {detailItem && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--inv-border)] p-4">
              <p className="text-[13px] text-[var(--inv-text-3)]">On hand</p>
              <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-[var(--inv-text)]">
                {formatQty(detailItem.currentStock)}{' '}
                <span className="text-base font-medium text-[var(--inv-text-3)]">{detailItem.baseUnit}</span>
              </p>
              <div className="mt-3">
                <StockMeter
                  current={detailItem.currentStock}
                  min={detailItem.minStockLevel}
                  unit={detailItem.baseUnit}
                  status={detailItem.status}
                />
              </div>
              <p className="mt-2 text-[13px] text-[var(--inv-text-3)]">
                Minimum {formatQty(detailItem.minStockLevel)} {detailItem.baseUnit}
                {detailItem.status !== 'IN_STOCK' && (
                  <>
                    {' '}
                    · suggested reorder {formatQty(detailItem.preferredRestockQty)} {detailItem.baseUnit}
                  </>
                )}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" icon="usage" onClick={() => handleOpenStockModal(detailItem, 'DEDUCT')}>
                  Record usage
                </Button>
              </div>
            </div>

            <dl className="inv-dl">
              <div>
                <dt>Category</dt>
                <dd>{detailItem.category}</dd>
              </div>
              <div>
                <dt>Base unit</dt>
                <dd>{detailItem.baseUnit}</dd>
              </div>
              <div>
                <dt>Reorder quantity</dt>
                <dd>
                  {formatQty(detailItem.preferredRestockQty)} {detailItem.baseUnit}
                </dd>
              </div>
              <div>
                <dt>Unit cost</dt>
                <dd>{detailItem.costPerUnit ? formatPeso(detailItem.costPerUnit) : '—'}</dd>
              </div>
              <div>
                <dt>Stock value</dt>
                <dd>{formatPeso(detailItem.currentStock * (detailItem.costPerUnit || 0))}</dd>
              </div>
              <div>
                <dt>Supplier</dt>
                <dd>{detailItem.supplierName || '—'}</dd>
              </div>
              <div>
                <dt>Last restocked</dt>
                <dd>{detailItem.lastRestockedAt ? formatDate(detailItem.lastRestockedAt) : '—'}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(detailItem.updatedAt)}</dd>
              </div>
            </dl>

            {detailItem.storageNotes && (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold text-[var(--inv-text)]">Storage notes</h3>
                <p className="text-sm leading-relaxed text-[var(--inv-text-2)]">{detailItem.storageNotes}</p>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--inv-text)]">Recent movements</h3>
              {detailMovements.length === 0 ? (
                <p className="text-sm text-[var(--inv-text-3)]">No stock movements recorded for this item yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--inv-border)] rounded-xl border border-[var(--inv-border)]">
                  {detailMovements.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <Badge tone={MOVEMENT_TONE[tx.type] ?? 'neutral'}>{movementLabel(tx.type)}</Badge>
                        <p className="mt-1 text-[13px] text-[var(--inv-text-3)]">{formatDate(tx.timestamp, true)}</p>
                      </div>
                      <span
                        className={cx(
                          'shrink-0 text-sm font-semibold',
                          tx.quantityDelta > 0 ? 'text-[var(--inv-success)]' : 'text-[var(--inv-text)]'
                        )}
                      >
                        {tx.quantityDelta > 0 ? '+' : '−'}
                        {formatQty(Math.abs(tx.quantityDelta))} {tx.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Add / edit item */}
      <Modal
        open={isAddModalOpen || Boolean(editingIngredient)}
        onClose={closeItemForm}
        size="lg"
        title={editingIngredient ? `Edit ${editingIngredient.name}` : 'Add item'}
        description={
          editingIngredient
            ? 'Update details, stock levels and supplier.'
            : 'Register a food ingredient or packaging material.'
        }
        onSubmit={handleSaveIngredient}
        footer={
          <>
            <Button variant="secondary" onClick={closeItemForm}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingIngredient ? 'Save changes' : formItemType === 'PACKAGING' ? 'Add packaging' : 'Add ingredient'}
            </Button>
          </>
        }
      >
        <div className="inv-form-section">
          <p className="inv-form-section-title" id="ing-type-label">
            Item type
          </p>
          <div className="inv-choice-group" role="radiogroup" aria-labelledby="ing-type-label">
            {(
              [
                { value: 'FOOD', title: 'Food ingredient', desc: 'Seafood, produce, sauces, dairy' },
                { value: 'PACKAGING', title: 'Packaging material', desc: 'Trays, bowls, bags, cutlery, stickers' },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={formItemType === o.value}
                className="inv-choice"
                onClick={() => handleItemTypeSwitch(o.value)}
              >
                <span className="inv-choice-title">{o.title}</span>
                <span className="inv-choice-desc">{o.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="inv-form-section space-y-4">
          <p className="inv-form-section-title">Details</p>
          <Field label="Name" htmlFor="ing-name" required error={formErrors.name}>
            <input
              {...fieldAria('ing-name', formErrors.name)}
              type="text"
              className="inv-input"
              autoComplete="off"
              placeholder={formItemType === 'FOOD' ? 'e.g. Fresh white shrimp' : 'e.g. Paper bowl 500 ml'}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </Field>
          <div className="inv-grid-2">
            <Field label="Category" htmlFor="ing-category" required>
              <select
                id="ing-category"
                className="inv-select"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as IngredientCategory)}
              >
                {(formItemType === 'FOOD' ? FOOD_CATEGORIES : PACKAGING_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Base unit"
              htmlFor="ing-unit"
              required
              hint="The unit stock is counted in."
            >
              <select
                {...fieldAria('ing-unit', undefined, true)}
                className="inv-select"
                value={formBaseUnit}
                onChange={(e) => setFormBaseUnit(e.target.value as MeasurementUnit)}
              >
                {MEASUREMENT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="inv-form-section space-y-4">
          <p className="inv-form-section-title">Stock levels</p>
          <div className="inv-grid-2">
            <Field
              label={editingIngredient ? 'Current stock' : 'Opening stock'}
              htmlFor="ing-currentStock"
              optional={!editingIngredient}
              error={formErrors.currentStock}
              hint={editingIngredient ? 'To log a restock or usage, use Restock instead.' : 'Leave empty to start at 0.'}
            >
              <div className="inv-input-group">
                <input
                  {...fieldAria('ing-currentStock', formErrors.currentStock, true)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="inv-input"
                  placeholder="0"
                  value={formCurrentStock}
                  onChange={(e) => setFormCurrentStock(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="inv-input-suffix">{formUnit}</span>
              </div>
            </Field>
            <div className="hidden sm:block" />
            <Field
              label="Minimum level"
              htmlFor="ing-minStock"
              required
              error={formErrors.minStock}
              hint="Marked as low stock at or below this."
            >
              <div className="inv-input-group">
                <input
                  {...fieldAria('ing-minStock', formErrors.minStock, true)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="inv-input"
                  placeholder={formItemType === 'PACKAGING' ? '50' : '1000'}
                  value={formMinStock}
                  onChange={(e) => setFormMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="inv-input-suffix">{formUnit}</span>
              </div>
            </Field>
            <Field
              label="Reorder quantity"
              htmlFor="ing-reorderQty"
              required
              error={formErrors.reorderQty}
              hint="How much you usually buy at once."
            >
              <div className="inv-input-group">
                <input
                  {...fieldAria('ing-reorderQty', formErrors.reorderQty, true)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  className="inv-input"
                  placeholder={formItemType === 'PACKAGING' ? '200' : '5000'}
                  value={formReorderQty}
                  onChange={(e) => setFormReorderQty(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="inv-input-suffix">{formUnit}</span>
              </div>
            </Field>
          </div>
          <Field
            label="Unit cost"
            htmlFor="ing-cost"
            optional
            error={formErrors.cost}
            hint={`Price per ${formUnit}. Used for stock value, recipe cost and waste reports.`}
          >
            <div className="inv-input-group">
              <span className="inv-input-prefix">₱</span>
              <input
                {...fieldAria('ing-cost', formErrors.cost, true)}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className="inv-input has-prefix"
                placeholder="0.00"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </Field>
        </div>

        <div className="inv-form-section space-y-4">
          <p className="inv-form-section-title">Supplier and storage</p>
          <Field label="Preferred supplier" htmlFor="ing-supplier" optional>
            <select
              id="ing-supplier"
              className="inv-select"
              value={formSupplierId}
              onChange={(e) => setFormSupplierId(e.target.value)}
            >
              <option value="">No preferred supplier</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Storage and handling notes" htmlFor="ing-notes" optional>
            <textarea
              id="ing-notes"
              rows={2}
              className="inv-textarea"
              placeholder={
                formItemType === 'FOOD'
                  ? 'e.g. Keep in walk-in freezer at -18°C. Shelf life 14 days.'
                  : 'e.g. Dry packaging rack, cartons of 500 pcs.'
              }
              value={formStorageNotes}
              onChange={(e) => setFormStorageNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* Restock / usage */}
      <Modal
        open={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title={stockModalMode === 'PURCHASE' ? 'Restock item' : 'Record usage or loss'}
        description={
          stockModalMode === 'PURCHASE'
            ? 'Add newly purchased stock to the balance.'
            : 'Remove stock used in the kitchen, wasted, or corrected after a count.'
        }
        onSubmit={handleConfirmStockModal}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsStockModalOpen(false)}>
              Cancel
            </Button>
            <Button variant={stockModalMode === 'PURCHASE' ? 'primary' : 'danger'} type="submit">
              {stockModalMode === 'PURCHASE' ? 'Add to stock' : 'Remove from stock'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Segmented
            label="Movement direction"
            value={stockModalMode}
            onChange={(m) => {
              setStockModalMode(m)
              setStockErrors({})
            }}
            options={[
              { value: 'PURCHASE', label: 'Stock in' },
              { value: 'DEDUCT', label: 'Stock out' },
            ]}
          />

          <Field label="Item" htmlFor="stk-item" required error={stockErrors.item}>
            <select
              {...fieldAria('stk-item', stockErrors.item)}
              className="inv-select"
              value={selectedStockItemId}
              onChange={(e) => {
                const newId = e.target.value
                setSelectedStockItemId(newId)
                const found = ingredients.find((i) => i.id === newId)
                if (found) {
                  setPurchaseUnit(found.baseUnit === 'g' ? 'kg' : found.baseUnit)
                  if (!sellerMarket && found.supplierName) setSellerMarket(found.supplierName)
                }
              }}
            >
              <option value="" disabled>
                Choose an item
              </option>
              <optgroup label="Food">
                {ingredients
                  .filter((i) => (i.itemType || 'FOOD') === 'FOOD')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Packaging">
                {ingredients
                  .filter((i) => i.itemType === 'PACKAGING')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </Field>

          {selectedStockItem && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--inv-surface-2)] px-3.5 py-2.5 text-sm">
              <span className="text-[var(--inv-text-3)]">On hand now</span>
              <span className="flex items-center gap-2">
                <b className="font-semibold text-[var(--inv-text)]">
                  {formatQty(selectedStockItem.currentStock)} {selectedStockItem.baseUnit}
                </b>
                <StockStatusBadge status={selectedStockItem.status} />
              </span>
            </div>
          )}

          {stockModalMode === 'PURCHASE' ? (
            <>
              <div className="inv-grid-2">
                <Field label="Quantity bought" htmlFor="stk-purchaseQty" required error={stockErrors.purchaseQty}>
                  <input
                    {...fieldAria('stk-purchaseQty', stockErrors.purchaseQty)}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="inv-input"
                    placeholder="e.g. 5"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </Field>
                <Field label="Unit" htmlFor="stk-purchaseUnit" required error={stockErrors.purchaseUnit}>
                  <select
                    {...fieldAria('stk-purchaseUnit', stockErrors.purchaseUnit)}
                    className="inv-select"
                    value={purchaseUnit}
                    onChange={(e) => setPurchaseUnit(e.target.value)}
                  >
                    {selectedStockItem && !PURCHASE_UNITS.some((u) => u.value === selectedStockItem.baseUnit) && (
                      <option value={selectedStockItem.baseUnit}>{selectedStockItem.baseUnit}</option>
                    )}
                    {PURCHASE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {selectedStockItem && purchaseDelta > 0 && (
                <Notice tone={unitsMismatch ? 'warning' : 'success'}>
                  {unitsConvert ? (
                    <>
                      {formatQty(Number(purchaseQty))} {purchaseUnit} = <b>{formatQty(purchaseDelta)} {selectedStockItem.baseUnit}</b>.
                      New balance: <b>{formatQty(selectedStockItem.currentStock + purchaseDelta)} {selectedStockItem.baseUnit}</b>
                    </>
                  ) : unitsMismatch ? (
                    <>
                      This item is counted in <b>{selectedStockItem.baseUnit}</b>. {formatQty(purchaseDelta)} will be
                      added as {selectedStockItem.baseUnit}, so check the unit before saving.
                    </>
                  ) : (
                    <>
                      New balance: <b>{formatQty(selectedStockItem.currentStock + purchaseDelta)} {selectedStockItem.baseUnit}</b>
                    </>
                  )}
                </Notice>
              )}

              <div className="inv-grid-2">
                <Field label="Supplier or market" htmlFor="stk-seller" optional>
                  <input
                    id="stk-seller"
                    type="text"
                    className="inv-input"
                    placeholder="e.g. Navotas Fish Port"
                    value={sellerMarket}
                    onChange={(e) => setSellerMarket(e.target.value)}
                    list="seller-market-list"
                  />
                  <datalist id="seller-market-list">
                    <option value="Navotas Fish Port" />
                    <option value="Balintawak Central Wholesale Produce" />
                    <option value="Metro Pack & Green Disposables" />
                    <option value="Golden Dairy & Oil Trading" />
                    <option value="Local Wet Market" />
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Purchase date" htmlFor="stk-purchaseDate" required error={stockErrors.purchaseDate}>
                  <input
                    {...fieldAria('stk-purchaseDate', stockErrors.purchaseDate)}
                    type="date"
                    max={today()}
                    className="inv-input"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Reason" htmlFor="stk-reason" required>
                <select
                  id="stk-reason"
                  className="inv-select"
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                >
                  {DEDUCT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity" htmlFor="stk-deductQty" required error={stockErrors.deductQty}>
                <div className="inv-input-group">
                  <input
                    {...fieldAria('stk-deductQty', stockErrors.deductQty)}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    className="inv-input"
                    placeholder="0"
                    value={deductQty}
                    onChange={(e) => setDeductQty(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="inv-input-suffix">{selectedStockItem?.baseUnit ?? 'units'}</span>
                </div>
              </Field>
              {selectedStockItem && Number(deductQty) > 0 && Number(deductQty) <= selectedStockItem.currentStock && (
                <Notice tone={selectedStockItem.currentStock - Number(deductQty) <= selectedStockItem.minStockLevel ? 'warning' : 'info'}>
                  New balance:{' '}
                  <b>
                    {formatQty(selectedStockItem.currentStock - Number(deductQty))} {selectedStockItem.baseUnit}
                  </b>
                  {selectedStockItem.currentStock - Number(deductQty) <= selectedStockItem.minStockLevel &&
                    ' — this will put the item at or below its minimum level.'}
                </Notice>
              )}
            </>
          )}
        </div>
      </Modal>

      <InventoryConfirmModal
        isOpen={Boolean(deletingIngredientId)}
        title="Delete this item?"
        message={`${
          ingredients.find((i) => i.id === deletingIngredientId)?.name ?? 'This item'
        } will be removed from the catalog along with its stock history. Items used in a recipe can't be deleted until they're removed from it.`}
        confirmText="Delete item"
        isDestructive
        onConfirm={() => {
          if (deletingIngredientId) {
            onDeleteIngredient(deletingIngredientId)
            if (detailId === deletingIngredientId) setDetailId(null)
            setDeletingIngredientId(null)
          }
        }}
        onCancel={() => setDeletingIngredientId(null)}
      />
    </div>
  )
}

export default IngredientsTab

import React, { useEffect, useState, useMemo } from 'react'
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Supplier,
  Ingredient,
  MeasurementUnit,
  InventoryItemType,
  IngredientCategory,
} from './inventoryTypes'
import { MEASUREMENT_UNITS } from './inventoryTypes'
import { describeConversion, toBaseUnit, unitsMismatch } from './unitConversion'
import InventoryConfirmModal from './InventoryConfirmModal'
import { SearchableSelect } from './SearchableSelect'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FilterSelect,
  Icon,
  IconButton,
  Modal,
  Notice,
  Pagination,
  RowMenu,
  SearchInput,
  SectionHeader,
  Segmented,
  Toolbar,
  TypeBadge,
  fieldAria,
  formatDate,
  formatLeadTime,
  formatQty,
  type BadgeTone,
} from './ui'

const PAGE_SIZE = 10

const PO_STATUS: Record<PurchaseOrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PARTIALLY_RECEIVED: { label: 'Partly received', tone: 'info' },
  FULLY_RECEIVED: { label: 'Received', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}

const canReceive = (po: PurchaseOrder) => po.status === 'PENDING' || po.status === 'PARTIALLY_RECEIVED'

interface PurchasesReceivingTabProps {
  purchaseOrders: PurchaseOrder[]
  suppliers: Supplier[]
  ingredients: Ingredient[]
  /** Arriving from the Suppliers tab: show only this vendor's orders. */
  initialSupplierId?: string
  /** Keep ?supplier= in step with the picker, so the filtered board stays linkable. */
  onSupplierFilterChange?: (supplierId?: string) => void
  onCreatePO: (po: Omit<PurchaseOrder, 'id' | 'createdAt'>) => void
  onReceiveStock: (
    poId: string,
    receivedItems: {
      itemId: string
      ingredientId: string
      receivedQty: number
      unit: MeasurementUnit
      batchNumber?: string
      expirationDate?: string
    }[],
    isFullyReceived: boolean,
    notes?: string
  ) => void
  onCancelPO: (poId: string) => void
}

export const PurchasesReceivingTab: React.FC<PurchasesReceivingTabProps> = ({
  purchaseOrders,
  suppliers,
  ingredients,
  initialSupplierId,
  onSupplierFilterChange,
  onCreatePO,
  onReceiveStock,
  onCancelPO,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatus>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')
  const [supplierFilter, setSupplierFilter] = useState<string>(initialSupplierId || 'ALL')
  const [currentPage, setCurrentPage] = useState(1)

  // A supplier link from the Suppliers tab narrows the board to that vendor
  useEffect(() => {
    setSupplierFilter(initialSupplierId || 'ALL')
    setCurrentPage(1)
  }, [initialSupplierId])

  // A ?supplier= pointing at a deleted vendor must not hide every order
  const filteredSupplier = suppliers.find((sup) => sup.id === supplierFilter)
  const activeSupplier = filteredSupplier ? supplierFilter : 'ALL'
  const applySupplierFilter = (supplierId: string) => {
    setSupplierFilter(supplierId)
    setCurrentPage(1)
    onSupplierFilterChange?.(supplierId === 'ALL' ? undefined : supplierId)
  }
  const clearSupplierFilter = () => applySupplierFilter('ALL')

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null)
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null)
  const [cancellingPOId, setCancellingPOId] = useState<string | null>(null)

  // Create PO Form State
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poExpectedDate, setPoExpectedDate] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<
    Array<{
      ingredientId: string
      ingredientName: string
      itemType: InventoryItemType
      category: IngredientCategory
      orderedQuantity: number
      /** The unit the user is typing in; converted to the item's base unit on submit. */
      unit: MeasurementUnit
      baseUnit: MeasurementUnit
    }>
  >([])
  const [poFormErrors, setPoFormErrors] = useState<Record<string, string>>({})
  /** Lines dropped by the last supplier change, so the re-scoping is never silent. */
  const [droppedLineCount, setDroppedLineCount] = useState(0)

  // Receive Stock Form State
  const [receiveItemInputs, setReceiveItemInputs] = useState<
    Record<
      string,
      {
        receivedQty: number
        batchNumber: string
        expirationDate: string
      }
    >
  >({})
  const [receiveNotes, setReceiveNotes] = useState('')
  const [receiveError, setReceiveError] = useState('')

  /**
   * What a given supplier is allowed to be ordered from.
   *
   * A supplier already records the kinds of goods it sells, so choosing the supplier is what
   * decides the line pickers' contents: the seafood vendor offers seafood, and ordering trays
   * from them is not a mistake worth letting anyone make.
   *
   * A supplier with no categories on file is treated as unrestricted rather than unusable — an
   * untagged vendor should not silently block every order placed with it.
   */
  const itemsForSupplier = (supplierId: string): Ingredient[] => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (!supplier) return []
    const allowed = new Set<IngredientCategory>(supplier.categoriesSupplied || [])
    if (allowed.size === 0) return ingredients
    return ingredients.filter((ing) => allowed.has(ing.category))
  }

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === poSupplierId) || null,
    [suppliers, poSupplierId]
  )
  const supplierItems = useMemo(
    () => itemsForSupplier(poSupplierId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ingredients, suppliers, poSupplierId]
  )

  // Separate Food vs Packaging within what this supplier carries
  const itemSelectOptions = useMemo(
    () => [
      ...supplierItems
        .filter((i) => (i.itemType || 'FOOD') === 'FOOD')
        .map((ing) => ({
          value: ing.id,
          label: ing.name,
          group: 'Food',
          hint: `${formatQty(ing.currentStock)} ${ing.baseUnit}`,
        })),
      ...supplierItems
        .filter((i) => i.itemType === 'PACKAGING')
        .map((pkg) => ({
          value: pkg.id,
          label: pkg.name,
          group: 'Packaging',
          hint: `${formatQty(pkg.currentStock)} ${pkg.baseUnit}`,
        })),
    ],
    [supplierItems]
  )

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.items.some((it) => it.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter
      const matchesType =
        typeFilter === 'ALL' ||
        po.items.some((it) => (it.itemType || 'FOOD') === typeFilter)
      const matchesSupplier = activeSupplier === 'ALL' || po.supplierId === activeSupplier

      return matchesSearch && matchesStatus && matchesType && matchesSupplier
    })
  }, [purchaseOrders, searchQuery, statusFilter, typeFilter, activeSupplier])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPOs.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginatedPOs = filteredPOs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const scopedPOs = useMemo(
    () => (activeSupplier === 'ALL' ? purchaseOrders : purchaseOrders.filter((p) => p.supplierId === activeSupplier)),
    [purchaseOrders, activeSupplier]
  )
  const countBy = (st: PurchaseOrderStatus) => scopedPOs.filter((p) => p.status === st).length

  // Reset Create PO Form
  const resetCreatePOForm = () => {
    const supplierId = filteredSupplier?.id || suppliers[0]?.id || ''
    setPoSupplierId(supplierId)
    setPoExpectedDate('')
    setPoNotes('')
    setDroppedLineCount(0)
    const defaultIng = itemsForSupplier(supplierId)[0]
    if (defaultIng) {
      setPoItems([
        {
          ingredientId: defaultIng.id,
          ingredientName: defaultIng.name,
          itemType: defaultIng.itemType || 'FOOD',
          category: defaultIng.category,
          orderedQuantity: defaultIng.preferredRestockQty || (defaultIng.itemType === 'PACKAGING' ? 200 : 10),
          unit: defaultIng.baseUnit,
          baseUnit: defaultIng.baseUnit,
        },
      ])
    } else {
      setPoItems([])
    }
    setPoFormErrors({})
  }

  const handleOpenCreateModal = () => {
    resetCreatePOForm()
    setIsCreateModalOpen(true)
  }

  /**
   * Switching supplier re-scopes the order. Lines the new supplier cannot fill are dropped
   * rather than left to fail at submit, and the count is surfaced so the change is visible.
   */
  const handleSupplierChange = (supplierId: string) => {
    const allowedIds = new Set(itemsForSupplier(supplierId).map((i) => i.id))
    const kept = poItems.filter((line) => allowedIds.has(line.ingredientId))
    setPoSupplierId(supplierId)
    setDroppedLineCount(poItems.length - kept.length)
    setPoItems(kept)
    setPoFormErrors({})
  }

  // Add Item Line in Create PO
  const handleAddLineItem = () => {
    const defaultIng = supplierItems[0]
    const itemType = defaultIng?.itemType || 'FOOD'
    setPoItems((prev) => [
      ...prev,
      {
        ingredientId: defaultIng?.id || '',
        ingredientName: defaultIng?.name || 'Raw Material / Packaging',
        itemType,
        category: defaultIng?.category || 'Seafoods',
        orderedQuantity: itemType === 'PACKAGING' ? 100 : 5,
        unit: defaultIng?.baseUnit || (itemType === 'PACKAGING' ? 'pcs' : 'kg'),
        baseUnit: defaultIng?.baseUnit || (itemType === 'PACKAGING' ? 'pcs' : 'kg'),
      },
    ])
  }

  // Remove Item Line
  const handleRemoveLineItem = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Update Item Line
  const handleItemLineChange = (
    index: number,
    field: 'ingredientId' | 'orderedQuantity' | 'unit',
    value: string | number
  ) => {
    setPoItems((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'ingredientId') {
        const ing = ingredients.find((i) => i.id === value)
        row.ingredientId = String(value)
        row.ingredientName = ing ? ing.name : 'Unknown'
        row.itemType = ing?.itemType || 'FOOD'
        row.category = ing?.category || 'Seafoods'
        row.unit = ing ? ing.baseUnit : 'pcs'
        row.baseUnit = ing ? ing.baseUnit : 'pcs'
      } else if (field === 'orderedQuantity') {
        row.orderedQuantity = Math.max(0, Number(value) || 0)
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      }

      updated[index] = row
      return updated
    })
  }

  // Submit PO
  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!poSupplierId) errors.supplier = 'Choose the supplier for this order.'
    if (poItems.length === 0) errors.lines = 'Add at least one item to order.'
    else if (poItems.some((it) => !it.ingredientId)) errors.lines = 'Choose an item on every line, or remove empty lines.'
    else if (poItems.some((it) => !(it.orderedQuantity > 0))) errors.lines = 'Every line needs a quantity greater than 0.'
    else if (poItems.some((it) => !supplierItems.some((ing) => ing.id === it.ingredientId)))
      errors.lines = `${selectedSupplier?.name || 'This supplier'} does not supply every item on this order. Remove the ones they cannot fill.`
    else if (poItems.some((it) => unitsMismatch(it.unit, it.baseUnit)))
      errors.lines = 'A line is ordered in a unit that cannot be converted into how that item is stocked. Pick a matching unit.'
    if (poExpectedDate && poExpectedDate < new Date().toISOString().split('T')[0])
      errors.expected = 'Expected delivery cannot be in the past.'
    setPoFormErrors(errors)
    if (Object.keys(errors).length) return

    const supplier = suppliers.find((s) => s.id === poSupplierId)
    const nextPoNum = `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, '0')}`

    const finalItems: PurchaseOrderItem[] = poItems.map((item, idx) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId)
      return {
        id: `poi-${Date.now()}-${idx}`,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        itemType: ing?.itemType || item.itemType || 'FOOD',
        category: ing?.category || item.category || 'Seafoods',
        // Stock is held in the item's base unit, so the line is converted before it is saved.
        orderedQuantity: toBaseUnit(item.orderedQuantity, item.unit, item.baseUnit),
        receivedQuantity: 0,
        unit: item.baseUnit,
      }
    })

    onCreatePO({
      poNumber: nextPoNum,
      supplierId: poSupplierId,
      supplierName: supplier ? supplier.name : 'General Supplier',
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: poExpectedDate || new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'PENDING',
      items: finalItems,
      notes: poNotes.trim(),
    })

    setIsCreateModalOpen(false)
  }

  // Open Receive Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    setReceivingPO(po)
    const initialInputs: Record<string, { receivedQty: number; batchNumber: string; expirationDate: string }> = {}
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity)
      const isPackaging = item.itemType === 'PACKAGING'
      initialInputs[item.id] = {
        receivedQty: remaining,
        batchNumber: isPackaging ? `PKG-${Date.now().toString().slice(-4)}` : `LOT-${Date.now().toString().slice(-4)}`,
        expirationDate: isPackaging
          ? new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0]
          : new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      }
    })
    setReceiveItemInputs(initialInputs)
    setReceiveNotes('Delivered in clean, undamaged condition with intact packaging seals.')
    setReceiveError('')
  }

  // Confirm Receiving
  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault()
    if (!receivingPO) return
    const anyReceived = receivingPO.items.some((item) => (Number(receiveItemInputs[item.id]?.receivedQty) || 0) > 0)
    if (!anyReceived) {
      setReceiveError('Enter a delivered quantity for at least one item.')
      return
    }

    let allFulfilled = true
    const receivedPayload = receivingPO.items.map((item) => {
      const input = receiveItemInputs[item.id]
      const deltaReceived = input ? Number(input.receivedQty) || 0 : 0
      const totalNewReceived = item.receivedQuantity + deltaReceived
      if (totalNewReceived < item.orderedQuantity) {
        allFulfilled = false
      }
      return {
        itemId: item.id,
        ingredientId: item.ingredientId,
        receivedQty: deltaReceived,
        unit: item.unit,
        batchNumber: input?.batchNumber,
        expirationDate: input?.expirationDate,
      }
    })

    onReceiveStock(receivingPO.id, receivedPayload, allFulfilled, receiveNotes)
    setReceivingPO(null)
  }

  const cancellingPO = purchaseOrders.find((po) => po.id === cancellingPOId)

  const lineCols = 'sm:grid-cols-[minmax(0,1fr)_112px_96px_32px]'

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Purchasing"
        description={
          filteredSupplier
            ? `Orders placed with ${filteredSupplier.name}, and deliveries received from them.`
            : 'Order from suppliers and receive deliveries into stock.'
        }
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={handleOpenCreateModal}
            disabled={suppliers.length === 0 || ingredients.length === 0}
            title={suppliers.length === 0 ? 'Add a supplier first' : undefined}
          >
            New purchase order
          </Button>
        }
      />

      {filteredSupplier && (
        <Notice tone="info">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span>
              Showing orders from <strong>{filteredSupplier.name}</strong> ·{' '}
              {scopedPOs.length === 0
                ? 'no orders yet'
                : `${scopedPOs.length} ${scopedPOs.length === 1 ? 'order' : 'orders'} on record`}
              {filteredSupplier.leadTimeHours ? ` · ${formatLeadTime(filteredSupplier.leadTimeHours)} lead time` : ''}
              {filteredSupplier.contactPerson ? ` · ${filteredSupplier.contactPerson}` : ''}
              {filteredSupplier.contactNumber ? ` · ${filteredSupplier.contactNumber}` : ''}
            </span>
            <Button variant="ghost" size="sm" icon="close" onClick={clearSupplierFilter}>
              Show all suppliers
            </Button>
          </div>
        </Notice>
      )}

      <Card className="overflow-hidden">
        <Toolbar>
          <SearchInput
            label="Search purchase orders"
            placeholder="Search PO number, supplier or item"
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v)
              setCurrentPage(1)
            }}
          />
          <div className="inv-filters">
            <FilterSelect
              label="Supplier"
              value={activeSupplier}
              neutralValue="ALL"
              onChange={(v) => applySupplierFilter(v)}
              options={[
                { value: 'ALL', label: 'All' },
                ...suppliers.map((sup) => ({
                  value: sup.id,
                  label: `${sup.name}${sup.status === 'INACTIVE' ? ' (inactive)' : ''}`,
                })),
              ]}
            />
            <FilterSelect<'ALL' | InventoryItemType>
              label="Type"
              value={typeFilter}
              neutralValue="ALL"
              onChange={(v) => {
                setTypeFilter(v)
                setCurrentPage(1)
              }}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'FOOD', label: 'Food' },
                { value: 'PACKAGING', label: 'Packaging' },
              ]}
            />
            {(Boolean(searchQuery) || statusFilter !== 'ALL' || typeFilter !== 'ALL' || activeSupplier !== 'ALL') && (
              <button
                type="button"
                className="inv-filter-reset"
                onClick={() => {
                  setSearchQuery('')
                  setStatusFilter('ALL')
                  setTypeFilter('ALL')
                  clearSupplierFilter()
                }}
              >
                <Icon name="close" className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            <span className="inv-filters-sep" aria-hidden="true" />
            <Segmented
              label="Order status"
              size="sm"
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v)
                setCurrentPage(1)
              }}
              options={[
                { value: 'ALL', label: 'All', count: scopedPOs.length },
                { value: 'PENDING', label: 'Pending', count: countBy('PENDING') },
                { value: 'PARTIALLY_RECEIVED', label: 'Partial', count: countBy('PARTIALLY_RECEIVED') },
                { value: 'FULLY_RECEIVED', label: 'Received', count: countBy('FULLY_RECEIVED') },
              ]}
            />
          </div>
        </Toolbar>

        {paginatedPOs.length === 0 ? (
          purchaseOrders.length === 0 ? (
            <EmptyState
              icon="cart"
              title="No purchase orders yet"
              description={
                suppliers.length === 0
                  ? 'Add a supplier first, then create a purchase order when stock runs low.'
                  : 'When items run low, create a purchase order and receive it here when it arrives.'
              }
              action={
                suppliers.length > 0 &&
                ingredients.length > 0 && (
                  <Button variant="primary" icon="plus" onClick={handleOpenCreateModal}>
                    New purchase order
                  </Button>
                )
              }
            />
          ) : filteredSupplier && scopedPOs.length === 0 ? (
            <EmptyState
              icon="cart"
              title={`No orders from ${filteredSupplier.name} yet`}
              description="Nothing has been ordered from this supplier. Create the first purchase order, or go back to every supplier's orders."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {ingredients.length > 0 && (
                    <Button variant="primary" icon="plus" onClick={handleOpenCreateModal}>
                      New purchase order
                    </Button>
                  )}
                  <Button variant="secondary" onClick={clearSupplierFilter}>
                    Show all suppliers
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="No matching orders"
              description="Try a different status, item type or search term."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setStatusFilter('ALL')
                    setTypeFilter('ALL')
                    clearSupplierFilter()
                  }}
                >
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
                  <th scope="col">Order</th>
                  <th scope="col" className="hidden md:table-cell">Supplier</th>
                  <th scope="col" className="hidden lg:table-cell">Items</th>
                  <th scope="col" className="hidden sm:table-cell">Expected</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPOs.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <button type="button" className="inv-row-link" onClick={() => setViewingPO(po)}>
                        {po.poNumber}
                      </button>
                      <div className="inv-cell-secondary">Ordered {formatDate(po.orderDate)}</div>
                    </td>
                    <td className="hidden max-w-[220px] truncate text-[var(--inv-text)] md:table-cell">{po.supplierName}</td>
                    <td className="hidden max-w-[260px] lg:table-cell">
                      <div className="text-[var(--inv-text)]">
                        {po.items.length} {po.items.length === 1 ? 'item' : 'items'}
                      </div>
                      <div className="inv-cell-secondary truncate">
                        {po.items.map((i) => i.ingredientName).join(', ')}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap sm:table-cell">{formatDate(po.expectedDeliveryDate)}</td>
                    <td>
                      <Badge tone={PO_STATUS[po.status].tone} dot>
                        {PO_STATUS[po.status].label}
                      </Badge>
                    </td>
                    <td className="is-actions">
                      <div className="flex items-center justify-end gap-1">
                        {canReceive(po) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon="receive"
                            onClick={() => handleOpenReceiveModal(po)}
                            aria-label={`Receive ${po.poNumber}`}
                          >
                            Receive
                          </Button>
                        )}
                        <RowMenu
                          label={`Actions for ${po.poNumber}`}
                          items={[
                            { label: 'View order', icon: 'eye', onSelect: () => setViewingPO(po) },
                            {
                              label: 'Receive delivery',
                              icon: 'receive',
                              disabled: !canReceive(po),
                              onSelect: () => handleOpenReceiveModal(po),
                            },
                            {
                              label: 'Cancel order',
                              icon: 'close',
                              danger: true,
                              separatorBefore: true,
                              disabled: po.status !== 'PENDING',
                              onSelect: () => setCancellingPOId(po.id),
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

        <Pagination page={page} pageSize={PAGE_SIZE} total={filteredPOs.length} onChange={setCurrentPage} noun="orders" />
      </Card>

      {/* Create PO */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="xl"
        title="New purchase order"
        description="Choose a supplier and the items to order."
        onSubmit={handleSubmitPO}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create order
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="inv-grid-2">
            <Field label="Supplier" htmlFor="po-supplier" required error={poFormErrors.supplier}>
              <select
                {...fieldAria('po-supplier', poFormErrors.supplier)}
                className="inv-select"
                value={poSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
              >
                <option value="">Choose a supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.status === 'INACTIVE' ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Expected delivery"
              htmlFor="po-expected"
              optional
              error={poFormErrors.expected}
              hint="Defaults to 2 days from today."
            >
              <input
                {...fieldAria('po-expected', poFormErrors.expected, true)}
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="inv-input"
                value={poExpectedDate}
                onChange={(e) => setPoExpectedDate(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="inv-label">
                Items to order<span className="inv-required" aria-hidden="true">*</span>
              </p>
              <Button
                size="sm"
                variant="ghost"
                icon="plus"
                onClick={handleAddLineItem}
                disabled={supplierItems.length === 0}
              >
                Add line
              </Button>
            </div>

            {/* The supplier decides what can go on the order, so say so where the choosing happens. */}
            {selectedSupplier && (selectedSupplier.categoriesSupplied?.length ?? 0) > 0 && (
              <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--inv-text-3)]">
                <span>{selectedSupplier.name} supplies</span>
                {selectedSupplier.categoriesSupplied.map((cat) => (
                  <Badge key={cat} tone="neutral">
                    {cat}
                  </Badge>
                ))}
              </p>
            )}
            {droppedLineCount > 0 && (
              <div className="mb-3">
                <Notice tone="warning">
                  {droppedLineCount === 1 ? '1 line was removed' : `${droppedLineCount} lines were removed`} because{' '}
                  {selectedSupplier?.name || 'this supplier'} does not supply{' '}
                  {droppedLineCount === 1 ? 'that item' : 'those items'}.
                </Notice>
              </div>
            )}
            {poFormErrors.lines && (
              <div className="mb-3">
                <Notice tone="danger">{poFormErrors.lines}</Notice>
              </div>
            )}
            {poItems.length === 0 ? (
              <EmptyState
                compact
                icon="cart"
                title={
                  !selectedSupplier
                    ? 'Choose a supplier first'
                    : supplierItems.length === 0
                      ? `Nothing in the stockroom matches what ${selectedSupplier.name} supplies`
                      : 'No items on this order'
                }
                description={
                  !selectedSupplier
                    ? 'The supplier decides which items this order can contain.'
                    : supplierItems.length === 0
                      ? 'Add an item in one of their categories, or widen what this supplier supplies.'
                      : undefined
                }
                action={
                  supplierItems.length > 0 ? (
                    <Button size="sm" variant="secondary" icon="plus" onClick={handleAddLineItem}>
                      Add line
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="inv-lines">
                <div className={`inv-line-head ${lineCols}`}>
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Unit</span>
                  <span />
                </div>
                {poItems.map((item, idx) => (
                  <div key={idx} className={`inv-line grid-cols-2 ${lineCols}`}>
                    <label className="col-span-2 sm:col-span-1">
                      <span className="inv-line-label">Item</span>
                      <SearchableSelect
                        ariaLabel={`Item ${idx + 1}`}
                        value={item.ingredientId}
                        onChange={(next) => handleItemLineChange(idx, 'ingredientId', next)}
                        placeholder="Choose an item"
                        searchPlaceholder="Search items…"
                        options={itemSelectOptions}
                        disabled={!selectedSupplier}
                      />
                    </label>
                    <label>
                      <span className="inv-line-label">Quantity</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        className="inv-input inv-input--sm"
                        value={item.orderedQuantity}
                        onChange={(e) => handleItemLineChange(idx, 'orderedQuantity', e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="inv-line-label">Unit</span>
                      <select
                        className="inv-select inv-select--sm"
                        value={item.unit}
                        onChange={(e) => handleItemLineChange(idx, 'unit', e.target.value)}
                      >
                        {MEASUREMENT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex justify-end">
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label={`Remove ${item.ingredientName || 'line'}`}
                        onClick={() => handleRemoveLineItem(idx)}
                      />
                    </div>
                    {(() => {
                      const converted = describeConversion(item.orderedQuantity, item.unit, item.baseUnit)
                      const mismatched = unitsMismatch(item.unit, item.baseUnit)
                      if (!converted && !mismatched) return null
                      return (
                        <p
                          className={`col-span-2 -mt-1 text-xs sm:col-span-4 ${
                            mismatched ? 'text-[var(--inv-danger)]' : 'text-[var(--inv-text-3)]'
                          }`}
                        >
                          {mismatched
                            ? `${item.unit} cannot be converted to ${item.baseUnit}, how this item is stocked.`
                            : `${converted} · stocked in ${item.baseUnit}`}
                        </p>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Delivery notes" htmlFor="po-notes" optional>
            <textarea
              id="po-notes"
              rows={2}
              className="inv-textarea"
              placeholder="e.g. Deliver before 10 AM"
              value={poNotes}
              onChange={(e) => setPoNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* Receive */}
      <Modal
        open={Boolean(receivingPO)}
        onClose={() => setReceivingPO(null)}
        size="lg"
        title={receivingPO ? `Receive ${receivingPO.poNumber}` : 'Receive delivery'}
        description={
          receivingPO && <>From {receivingPO.supplierName}. Enter what actually arrived; partial deliveries are fine.</>
        }
        onSubmit={handleConfirmReceive}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceivingPO(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" icon="receive">
              Add to stock
            </Button>
          </>
        }
      >
        {receivingPO && (
          <div className="space-y-5">
            {receiveError && <Notice tone="danger">{receiveError}</Notice>}
            <div className="inv-lines">
              {receivingPO.items.map((item) => {
                const isPackaging = item.itemType === 'PACKAGING'
                const remaining = Math.max(0, item.orderedQuantity - item.receivedQuantity)
                const input = receiveItemInputs[item.id] || {
                  receivedQty: remaining,
                  batchNumber: '',
                  expirationDate: '',
                }
                const over = input.receivedQty > remaining
                return (
                  <div key={item.id} className="space-y-3 border-b border-[var(--inv-border)] p-4 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--inv-text)]">{item.ingredientName}</span>
                        <TypeBadge itemType={item.itemType} />
                      </div>
                      <span className="text-[13px] text-[var(--inv-text-3)]">
                        Ordered {formatQty(item.orderedQuantity)} · received {formatQty(item.receivedQuantity)} ·{' '}
                        <b className="font-semibold text-[var(--inv-text)]">
                          {formatQty(remaining)} {item.unit} to go
                        </b>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Field
                        label="Delivered now"
                        htmlFor={`rcv-qty-${item.id}`}
                        hint={over ? 'More than the remaining quantity. Check before saving.' : undefined}
                      >
                        <div className="inv-input-group">
                          <input
                            {...fieldAria(`rcv-qty-${item.id}`, undefined, over)}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            className="inv-input"
                            value={input.receivedQty}
                            onChange={(e) =>
                              setReceiveItemInputs((prev) => ({
                                ...prev,
                                [item.id]: { ...input, receivedQty: Number(e.target.value) || 0 },
                              }))
                            }
                          />
                          <span className="inv-input-suffix">{item.unit}</span>
                        </div>
                      </Field>
                      <Field label={isPackaging ? 'Carton / batch no.' : 'Batch / lot no.'} htmlFor={`rcv-batch-${item.id}`} optional>
                        <input
                          id={`rcv-batch-${item.id}`}
                          type="text"
                          className="inv-input"
                          placeholder={isPackaging ? 'PKG-2026-01' : 'LOT-2026-01'}
                          value={input.batchNumber}
                          onChange={(e) =>
                            setReceiveItemInputs((prev) => ({
                              ...prev,
                              [item.id]: { ...input, batchNumber: e.target.value },
                            }))
                          }
                        />
                      </Field>
                      <Field label={isPackaging ? 'Inspection date' : 'Expiry date'} htmlFor={`rcv-exp-${item.id}`} optional>
                        <input
                          id={`rcv-exp-${item.id}`}
                          type="date"
                          className="inv-input"
                          value={input.expirationDate}
                          onChange={(e) =>
                            setReceiveItemInputs((prev) => ({
                              ...prev,
                              [item.id]: { ...input, expirationDate: e.target.value },
                            }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                )
              })}
            </div>
            <Field label="Inspection notes" htmlFor="rcv-notes" optional>
              <input
                id="rcv-notes"
                type="text"
                className="inv-input"
                placeholder="e.g. Temperature checked at -18°C, seals intact"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* View */}
      <Modal
        open={Boolean(viewingPO)}
        onClose={() => setViewingPO(null)}
        size="lg"
        title={viewingPO?.poNumber ?? ''}
        description={viewingPO?.supplierName}
        footer={
          viewingPO && (
            <>
              <Button variant="secondary" onClick={() => setViewingPO(null)}>
                Close
              </Button>
              {canReceive(viewingPO) && (
                <Button
                  variant="primary"
                  icon="receive"
                  onClick={() => {
                    const po = viewingPO
                    setViewingPO(null)
                    handleOpenReceiveModal(po)
                  }}
                >
                  Receive delivery
                </Button>
              )}
            </>
          )
        }
      >
        {viewingPO && (
          <div className="space-y-5">
            <dl className="inv-dl sm:grid-cols-3">
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={PO_STATUS[viewingPO.status].tone} dot>
                    {PO_STATUS[viewingPO.status].label}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt>Ordered</dt>
                <dd>{formatDate(viewingPO.orderDate)}</dd>
              </div>
              <div>
                <dt>Expected</dt>
                <dd>{formatDate(viewingPO.expectedDeliveryDate)}</dd>
              </div>
              {viewingPO.receivedAt && (
                <div>
                  <dt>Last received</dt>
                  <dd>
                    {formatDate(viewingPO.receivedAt)}
                    {viewingPO.receivedBy && <> · {viewingPO.receivedBy}</>}
                  </dd>
                </div>
              )}
            </dl>
            <div className="inv-lines">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="is-num">Ordered</th>
                    <th scope="col" className="is-num">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPO.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="inv-cell-primary">{it.ingredientName}</div>
                        {it.batchNumber && <div className="inv-cell-secondary">{it.batchNumber}</div>}
                      </td>
                      <td className="is-num">
                        {formatQty(it.orderedQuantity)} {it.unit}
                      </td>
                      <td className="is-num">
                        {formatQty(it.receivedQuantity)} {it.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewingPO.notes && (
              <p className="text-sm text-[var(--inv-text-2)]">
                <span className="font-medium text-[var(--inv-text)]">Notes: </span>
                {viewingPO.notes}
              </p>
            )}
          </div>
        )}
      </Modal>

      <InventoryConfirmModal
        isOpen={Boolean(cancellingPOId)}
        title={`Cancel ${cancellingPO?.poNumber ?? 'this order'}?`}
        message="The order will be marked cancelled and nothing will be added to stock. This can't be undone."
        confirmText="Cancel order"
        cancelText="Keep order"
        isDestructive
        onConfirm={() => {
          if (cancellingPOId) {
            onCancelPO(cancellingPOId)
            setCancellingPOId(null)
          }
        }}
        onCancel={() => setCancellingPOId(null)}
      />
    </div>
  )
}

export default PurchasesReceivingTab

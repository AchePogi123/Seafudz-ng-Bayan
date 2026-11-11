import React, { useState, useMemo } from 'react'
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
import InventoryConfirmModal from './InventoryConfirmModal'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
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
  formatPeso,
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
  onCreatePO,
  onReceiveStock,
  onCancelPO,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatus>('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')
  const [currentPage, setCurrentPage] = useState(1)

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
      unit: MeasurementUnit
      unitCost: number
      totalCost: number
    }>
  >([])
  const [poFormErrors, setPoFormErrors] = useState<Record<string, string>>({})

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

  // Separate Food vs Packaging in the catalog
  const foodIngredients = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD'),
    [ingredients]
  )
  const packagingIngredients = useMemo(
    () => ingredients.filter((i) => i.itemType === 'PACKAGING'),
    [ingredients]
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

      return matchesSearch && matchesStatus && matchesType
    })
  }, [purchaseOrders, searchQuery, statusFilter, typeFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPOs.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginatedPOs = filteredPOs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const countBy = (st: PurchaseOrderStatus) => purchaseOrders.filter((p) => p.status === st).length

  // Reset Create PO Form
  const resetCreatePOForm = () => {
    setPoSupplierId(suppliers[0]?.id || '')
    setPoExpectedDate('')
    setPoNotes('')
    const defaultIng = ingredients[0]
    if (defaultIng) {
      setPoItems([
        {
          ingredientId: defaultIng.id,
          ingredientName: defaultIng.name,
          itemType: defaultIng.itemType || 'FOOD',
          category: defaultIng.category,
          orderedQuantity: defaultIng.preferredRestockQty || (defaultIng.itemType === 'PACKAGING' ? 200 : 10),
          unit: defaultIng.baseUnit,
          unitCost: defaultIng.costPerUnit || 10,
          totalCost: (defaultIng.preferredRestockQty || 10) * (defaultIng.costPerUnit || 10),
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

  // Add Item Line in Create PO
  const handleAddLineItem = () => {
    const defaultIng = ingredients[0]
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
        unitCost: defaultIng?.costPerUnit || 0,
        totalCost: (itemType === 'PACKAGING' ? 100 : 5) * (defaultIng?.costPerUnit || 0),
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
    field: 'ingredientId' | 'orderedQuantity' | 'unitCost' | 'unit',
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
        row.unitCost = ing ? ing.costPerUnit : 0
        row.totalCost = row.orderedQuantity * row.unitCost
      } else if (field === 'orderedQuantity') {
        const qty = Math.max(0, Number(value) || 0)
        row.orderedQuantity = qty
        row.totalCost = qty * row.unitCost
      } else if (field === 'unitCost') {
        const cost = Math.max(0, Number(value) || 0)
        row.unitCost = cost
        row.totalCost = row.orderedQuantity * cost
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      }

      updated[index] = row
      return updated
    })
  }

  const totalPOCost = useMemo(() => {
    return poItems.reduce((sum, item) => sum + item.totalCost, 0)
  }, [poItems])

  // Submit PO
  const handleSubmitPO = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!poSupplierId) errors.supplier = 'Choose the supplier for this order.'
    if (poItems.length === 0) errors.lines = 'Add at least one item to order.'
    else if (poItems.some((it) => !it.ingredientId)) errors.lines = 'Choose an item on every line, or remove empty lines.'
    else if (poItems.some((it) => !(it.orderedQuantity > 0))) errors.lines = 'Every line needs a quantity greater than 0.'
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
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: 0,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
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
      totalAmount: totalPOCost,
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

  const lineCols = 'sm:grid-cols-[minmax(0,1fr)_96px_88px_116px_104px_32px]'

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Purchasing"
        description="Order from suppliers and receive deliveries into stock."
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
          <Segmented
            label="Order status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setCurrentPage(1)
            }}
            options={[
              { value: 'ALL', label: 'All', count: purchaseOrders.length },
              { value: 'PENDING', label: 'Pending', count: countBy('PENDING') },
              { value: 'PARTIALLY_RECEIVED', label: 'Partial', count: countBy('PARTIALLY_RECEIVED') },
              { value: 'FULLY_RECEIVED', label: 'Received', count: countBy('FULLY_RECEIVED') },
            ]}
          />
          <select
            aria-label="Item type"
            className="inv-select w-full sm:w-auto"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'ALL' | InventoryItemType)
              setCurrentPage(1)
            }}
          >
            <option value="ALL">Food and packaging</option>
            <option value="FOOD">Contains food</option>
            <option value="PACKAGING">Contains packaging</option>
          </select>
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
                  <th scope="col" className="is-num">Total</th>
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
                    <td className="is-num font-semibold text-[var(--inv-text)]">{formatPeso(po.totalAmount)}</td>
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
        description="Choose a supplier and the items to order. Prices default to each item's last unit cost."
        onSubmit={handleSubmitPO}
        footer={
          <>
            <span className="mr-auto text-sm text-[var(--inv-text-3)]">
              Total <b className="ml-1 text-base font-semibold text-[var(--inv-text)]">{formatPeso(totalPOCost)}</b>
            </span>
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
                onChange={(e) => setPoSupplierId(e.target.value)}
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
              <Button size="sm" variant="ghost" icon="plus" onClick={handleAddLineItem}>
                Add line
              </Button>
            </div>
            {poFormErrors.lines && (
              <div className="mb-3">
                <Notice tone="danger">{poFormErrors.lines}</Notice>
              </div>
            )}
            {poItems.length === 0 ? (
              <EmptyState
                compact
                icon="cart"
                title="No items on this order"
                action={
                  <Button size="sm" variant="secondary" icon="plus" onClick={handleAddLineItem}>
                    Add line
                  </Button>
                }
              />
            ) : (
              <div className="inv-lines">
                <div className={`inv-line-head ${lineCols}`}>
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Unit</span>
                  <span>Unit cost</span>
                  <span className="text-right">Line total</span>
                  <span />
                </div>
                {poItems.map((item, idx) => (
                  <div key={idx} className={`inv-line grid-cols-2 ${lineCols}`}>
                    <label className="col-span-2 sm:col-span-1">
                      <span className="inv-line-label">Item</span>
                      <select
                        className="inv-select inv-select--sm"
                        value={item.ingredientId}
                        onChange={(e) => handleItemLineChange(idx, 'ingredientId', e.target.value)}
                      >
                        <option value="">Choose an item</option>
                        {foodIngredients.length > 0 && (
                          <optgroup label="Food">
                            {foodIngredients.map((ing) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {packagingIngredients.length > 0 && (
                          <optgroup label="Packaging">
                            {packagingIngredients.map((pkg) => (
                              <option key={pkg.id} value={pkg.id}>
                                {pkg.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
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
                    <label>
                      <span className="inv-line-label">Unit cost</span>
                      <span className="inv-input-group">
                        <span className="inv-input-prefix">₱</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          className="inv-input inv-input--sm has-prefix"
                          value={item.unitCost}
                          onChange={(e) => handleItemLineChange(idx, 'unitCost', e.target.value)}
                        />
                      </span>
                    </label>
                    <div className="text-right text-sm font-semibold text-[var(--inv-text)]">
                      <span className="inv-line-label sm:hidden">Line total</span>
                      {formatPeso(item.totalCost)}
                    </div>
                    <div className="flex justify-end">
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label={`Remove ${item.ingredientName || 'line'}`}
                        onClick={() => handleRemoveLineItem(idx)}
                      />
                    </div>
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
                    <th scope="col" className="is-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingPO.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="inv-cell-primary">{it.ingredientName}</div>
                        <div className="inv-cell-secondary">
                          {formatPeso(it.unitCost)} / {it.unit}
                          {it.batchNumber && <> · {it.batchNumber}</>}
                        </div>
                      </td>
                      <td className="is-num">
                        {formatQty(it.orderedQuantity)} {it.unit}
                      </td>
                      <td className="is-num">
                        {formatQty(it.receivedQuantity)} {it.unit}
                      </td>
                      <td className="is-num font-semibold text-[var(--inv-text)]">{formatPeso(it.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--inv-border)] pt-4">
              <span className="text-sm text-[var(--inv-text-3)]">Order total</span>
              <span className="text-lg font-semibold text-[var(--inv-text)]">{formatPeso(viewingPO.totalAmount)}</span>
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

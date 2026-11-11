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
  const itemsPerPage = 8

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
  const [poFormErrors, setPoFormErrors] = useState<string>('')

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
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage) || 1
  const paginatedPOs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredPOs.slice(start, start + itemsPerPage)
  }, [filteredPOs, currentPage])

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
    setPoFormErrors('')
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
    if (!poSupplierId) {
      setPoFormErrors('Please select an authorized supplier.')
      return
    }
    if (poItems.length === 0) {
      setPoFormErrors('Please add at least one line item (food ingredient or packaging material).')
      return
    }

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
  }

  // Confirm Receiving
  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault()
    if (!receivingPO) return

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

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROLS & STATS */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Purchasing & Inbound Goods Receiving
            </h2>
            <p className="text-xs text-slate-500">
              Procure food ingredients and packaging materials (food trays, takeout bags, cutlery sets, stickers) with batch tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Purchase Order
          </button>
        </div>

        {/* Status Filters and Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { label: 'All Orders', value: 'ALL', count: purchaseOrders.length },
                {
                  label: 'Pending',
                  value: 'PENDING',
                  count: purchaseOrders.filter((p) => p.status === 'PENDING').length,
                },
                {
                  label: 'Partially Received',
                  value: 'PARTIALLY_RECEIVED',
                  count: purchaseOrders.filter((p) => p.status === 'PARTIALLY_RECEIVED').length,
                },
                {
                  label: 'Fully Received',
                  value: 'FULLY_RECEIVED',
                  count: purchaseOrders.filter((p) => p.status === 'FULLY_RECEIVED').length,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value)
                  setCurrentPage(1)
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.value
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                    statusFilter === tab.value ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Type Filter & Search Bar */}
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as 'ALL' | InventoryItemType)
                setCurrentPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All PO Items</option>
              <option value="FOOD">Food Items Only</option>
              <option value="PACKAGING">Packaging Items Only</option>
            </select>

            <div className="relative w-full sm:w-64">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search PO # or vendor..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. PURCHASE ORDERS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {paginatedPOs.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center flex flex-col items-center justify-center px-4">
            <div className="h-16 w-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Purchase Records Found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {purchaseOrders.length === 0
                ? 'No purchase orders have been created yet. When food ingredients or packaging materials run low, generate a PO to replenish inventory.'
                : 'No purchase orders match your active search, item type, or status filters.'}
            </p>
            {purchaseOrders.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
              >
                + Create First Purchase Order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Expected Delivery</th>
                  <th className="py-3 px-4">Line Items</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedPOs.map((po) => {
                  const hasFood = po.items.some((i) => (i.itemType || 'FOOD') === 'FOOD')
                  const hasPkg = po.items.some((i) => i.itemType === 'PACKAGING')

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{po.poNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{po.supplierName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {hasFood && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                              Food
                            </span>
                          )}
                          {hasPkg && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Packaging
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(po.orderDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {new Date(po.expectedDeliveryDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-semibold">{po.items.length} items</span>{' '}
                        <span className="text-[11px] text-slate-400">
                          ({po.items.map((i) => i.ingredientName).slice(0, 2).join(', ')}
                          {po.items.length > 2 ? '...' : ''})
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        ₱{po.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            po.status === 'FULLY_RECEIVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : po.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {po.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingPO(po)}
                            className="p-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {po.status !== 'FULLY_RECEIVED' && po.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveModal(po)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors cursor-pointer shadow-xs"
                              title="Receive Goods"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Receive</span>
                            </button>
                          )}

                          {po.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => setCancellingPOId(po.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Cancel PO"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {filteredPOs.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold">
                {Math.min(currentPage * itemsPerPage, filteredPOs.length)}
              </span>{' '}
              of <span className="font-bold">{filteredPOs.length}</span> orders
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. CREATE PURCHASE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Draft Inbound Purchase Order</h3>
                  <p className="text-[11px] text-slate-500">
                    Procure food ingredients and packaging materials with vendor pricing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="mt-4 space-y-4">
              {poFormErrors && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                  {poFormErrors}
                </div>
              )}

              {/* Supplier & Expected Delivery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Select Supplier <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.contactPerson})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Line Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Ordered Materials (Food & Packaging) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                  >
                    + Add Item Line
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {poItems.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                      No items in this purchase order. Click "+ Add Item Line".
                    </div>
                  ) : (
                    poItems.map((item, idx) => {
                      const isPackaging = item.itemType === 'PACKAGING'
                      return (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="w-full sm:flex-1 flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                isPackaging
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-orange-50 text-orange-700 border border-orange-200'
                              }`}
                            >
                              {isPackaging ? 'Packaging' : 'Food'}
                            </span>
                            <select
                              value={item.ingredientId}
                              onChange={(e) => handleItemLineChange(idx, 'ingredientId', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none font-medium"
                            >
                              <option value="">-- Select Material / Item --</option>
                              {foodIngredients.length > 0 && (
                                <optgroup label="Food Ingredients">
                                  {foodIngredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.baseUnit})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {packagingIngredients.length > 0 && (
                                <optgroup label="Packaging Materials">
                                  {packagingIngredients.map((pkg) => (
                                    <option key={pkg.id} value={pkg.id}>
                                      {pkg.name} ({pkg.baseUnit})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>

                          <div className="w-full sm:w-24">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              placeholder="Qty"
                              value={item.orderedQuantity}
                              onChange={(e) => handleItemLineChange(idx, 'orderedQuantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                            />
                          </div>

                          <div className="w-full sm:w-20">
                            <select
                              value={item.unit}
                              onChange={(e) => handleItemLineChange(idx, 'unit', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none font-bold"
                            >
                              {MEASUREMENT_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-full sm:w-28">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="₱ Unit Cost"
                              value={item.unitCost}
                              onChange={(e) => handleItemLineChange(idx, 'unitCost', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                            />
                          </div>

                          <div className="w-full sm:w-28 text-right font-extrabold text-xs text-slate-800">
                            ₱{item.totalCost.toFixed(2)}
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Total & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Order Delivery Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Deliver before 10 AM, require sturdy boxes for takeout trays."
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Calculated Total PO Amount
                  </span>
                  <span className="text-xl font-black text-slate-900">₱{totalPOCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 cursor-pointer"
                >
                  Confirm & Submit PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. STOCK RECEIVING INTERFACE MODAL */}
      {receivingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setReceivingPO(null)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Goods Receiving & Stock Intake</h3>
                  <p className="text-[11px] text-slate-500">
                    {receivingPO.poNumber} • Vendor: {receivingPO.supplierName}
                  </p>
                </div>
              </div>
              <button onClick={() => setReceivingPO(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Confirm actual physically received quantities, assign batch lot / carton numbers, and log expiration or inspection dates.
              </p>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {receivingPO.items.map((item) => {
                  const isPackaging = item.itemType === 'PACKAGING'
                  const input = receiveItemInputs[item.id] || {
                    receivedQty: item.orderedQuantity - item.receivedQuantity,
                    batchNumber: '',
                    expirationDate: '',
                  }
                  return (
                    <div key={item.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isPackaging
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-orange-50 text-orange-700 border border-orange-200'
                            }`}
                          >
                            {isPackaging ? 'Packaging' : 'Food'}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{item.ingredientName}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          Ordered: <span className="font-bold text-slate-800">{item.orderedQuantity} {item.unit}</span> (Prev: {item.receivedQuantity} {item.unit})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Delivered Qty ({item.unit})
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={input.receivedQty}
                            onChange={(e) =>
                              setReceiveItemInputs((prev) => ({
                                ...prev,
                                [item.id]: { ...input, receivedQty: Number(e.target.value) || 0 },
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            {isPackaging ? 'Carton / Batch #' : 'Batch / Lot #'}
                          </label>
                          <input
                            type="text"
                            placeholder={isPackaging ? 'PKG-2026-01' : 'LOT-2026-01'}
                            value={input.batchNumber}
                            onChange={(e) =>
                              setReceiveItemInputs((prev) => ({
                                ...prev,
                                [item.id]: { ...input, batchNumber: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            {isPackaging ? 'Inspection / Shelf Date' : 'Expiration Date'}
                          </label>
                          <input
                            type="date"
                            value={input.expirationDate}
                            onChange={(e) =>
                              setReceiveItemInputs((prev) => ({
                                ...prev,
                                [item.id]: { ...input, expirationDate: e.target.value },
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Intake Inspection Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Temperature checked at -18°C, cartons sealed and verified."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReceivingPO(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 cursor-pointer"
                >
                  Confirm & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. VIEW PO DETAILS MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingPO(null)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewingPO.poNumber}</h3>
                <p className="text-xs text-slate-500">Supplier: {viewingPO.supplierName}</p>
              </div>
              <button onClick={() => setViewingPO(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Order Date</span>
                  <span className="font-semibold text-slate-800">{new Date(viewingPO.orderDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                  <span className="font-bold text-slate-800">{viewingPO.status.replace('_', ' ')}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Item Breakdown</h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {viewingPO.items.map((it) => {
                    const isPackaging = it.itemType === 'PACKAGING'
                    return (
                      <div key={it.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                                isPackaging ? 'bg-indigo-50 text-indigo-700' : 'bg-orange-50 text-orange-700'
                              }`}
                            >
                              {isPackaging ? 'Packaging' : 'Food'}
                            </span>
                            <span className="font-bold text-slate-800 block">{it.ingredientName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            Ordered: {it.orderedQuantity} {it.unit} • Received: {it.receivedQuantity} {it.unit}
                          </span>
                        </div>
                        <div className="text-right font-extrabold text-slate-900">
                          ₱{it.totalCost.toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-600">Total Purchase Value:</span>
                <span className="text-base font-black text-slate-900">₱{viewingPO.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CANCEL CONFIRMATION MODAL */}
      <InventoryConfirmModal
        isOpen={Boolean(cancellingPOId)}
        title="Cancel Purchase Order"
        message="Are you sure you want to cancel this purchase order? The supplier will not deliver these goods and no stock will be received."
        confirmText="Cancel Order"
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

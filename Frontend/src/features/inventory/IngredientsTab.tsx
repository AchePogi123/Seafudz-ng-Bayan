import React, { useState, useMemo } from 'react'
import type {
  Ingredient,
  IngredientCategory,
  MeasurementUnit,
  StockStatus,
  Supplier,
  InventoryItemType,
} from './inventoryTypes'
import {
  FOOD_CATEGORIES,
  PACKAGING_CATEGORIES,
  MEASUREMENT_UNITS,
} from './inventoryTypes'
import InventoryConfirmModal from './InventoryConfirmModal'

interface IngredientsTabProps {
  ingredients: Ingredient[]
  suppliers: Supplier[]
  onAddIngredient: (item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>) => void
  onEditIngredient: (item: Ingredient) => void
  onDeleteIngredient: (id: string) => void
  onAdjustStock: (
    id: string,
    delta: number,
    reason: string,
    details?: { seller?: string; purchaseDate?: string }
  ) => void
}

export const IngredientsTab: React.FC<IngredientsTabProps> = ({
  ingredients,
  suppliers,
  onAddIngredient,
  onEditIngredient,
  onDeleteIngredient,
  onAdjustStock,
}) => {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<'ALL' | InventoryItemType>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [deletingIngredientId, setDeletingIngredientId] = useState<string | null>(null)

  // Form Fields for Add / Edit
  const [formItemType, setFormItemType] = useState<InventoryItemType>('FOOD')
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<IngredientCategory>('Seafoods')
  const [formBaseUnit, setFormBaseUnit] = useState<MeasurementUnit>('g')
  const [formCurrentStock, setFormCurrentStock] = useState<number | ''>('')
  const [formMinStock, setFormMinStock] = useState<number | ''>('')
  const [formReorderQty, setFormReorderQty] = useState<number | ''>('')
  const [formSupplierId, setFormSupplierId] = useState<string>('')
  const [formStorageNotes, setFormStorageNotes] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Revised Manual Add Stock / Purchase Intake / Adjustment Modal State
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [stockModalMode, setStockModalMode] = useState<'PURCHASE' | 'DEDUCT'>('PURCHASE')
  const [selectedStockItemId, setSelectedStockItemId] = useState<string>('')
  const [purchaseQty, setPurchaseQty] = useState<number | ''>('')
  const [purchaseUnit, setPurchaseUnit] = useState<string>('kg')
  const [sellerMarket, setSellerMarket] = useState<string>('')
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [deductQty, setDeductQty] = useState<number | ''>('')
  const [deductReason, setDeductReason] = useState<string>('Physical Audit Count Reconciliation')
  const [stockModalError, setStockModalError] = useState<string>('')

  // Item counts
  const foodCount = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD').length,
    [ingredients]
  )
  const packagingCount = useMemo(
    () => ingredients.filter((i) => i.itemType === 'PACKAGING').length,
    [ingredients]
  )

  // Available categories based on selectedType
  const availableCategories = useMemo(() => {
    if (selectedType === 'FOOD') return FOOD_CATEGORIES
    if (selectedType === 'PACKAGING') return PACKAGING_CATEGORIES
    return [...FOOD_CATEGORIES, ...PACKAGING_CATEGORIES]
  }, [selectedType])

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      const itemType = item.itemType || 'FOOD'
      const matchesType = selectedType === 'ALL' || itemType === selectedType
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.storageNotes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
      const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus
      return matchesType && matchesSearch && matchesCategory && matchesStatus
    })
  }, [ingredients, selectedType, searchQuery, selectedCategory, selectedStatus])

  // Pagination
  const totalPages = Math.ceil(filteredIngredients.length / itemsPerPage) || 1
  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredIngredients.slice(start, start + itemsPerPage)
  }, [filteredIngredients, currentPage])

  // Handlers
  const resetForm = (itemType: InventoryItemType = 'FOOD') => {
    setFormItemType(itemType)
    setFormName('')
    setFormCategory(itemType === 'FOOD' ? 'Seafoods' : 'Trays, Bowls & Containers')
    setFormBaseUnit(itemType === 'FOOD' ? 'g' : 'pcs')
    setFormCurrentStock('')
    setFormMinStock('')
    setFormReorderQty('')
    setFormSupplierId('')
    setFormStorageNotes('')
    setFormErrors({})
  }

  const handleOpenAddModal = (defaultType?: InventoryItemType) => {
    const targetType = defaultType || (selectedType === 'PACKAGING' ? 'PACKAGING' : 'FOOD')
    resetForm(targetType)
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (item: Ingredient) => {
    const itemType = item.itemType || 'FOOD'
    setEditingIngredient(item)
    setFormItemType(itemType)
    setFormName(item.name)
    setFormCategory(item.category)
    setFormBaseUnit(item.baseUnit)
    setFormCurrentStock(item.currentStock)
    setFormMinStock(item.minStockLevel)
    setFormReorderQty(item.preferredRestockQty)
    setFormSupplierId(item.supplierId || '')
    setFormStorageNotes(item.storageNotes || '')
    setFormErrors({})
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

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formName.trim()) {
      errors.name = `${formItemType === 'FOOD' ? 'Ingredient' : 'Packaging'} name is required`
    }
    if (formMinStock === '' || Number(formMinStock) < 0) {
      errors.minStock = 'Valid minimum stock threshold is required'
    }
    if (formReorderQty === '' || Number(formReorderQty) <= 0) {
      errors.reorderQty = 'Reorder quantity must be > 0'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveIngredient = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

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
        costPerUnit: editingIngredient.costPerUnit || 0,
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
        costPerUnit: 0,
        supplierId: formSupplierId || undefined,
        supplierName: selectedSupplier ? selectedSupplier.name : undefined,
        storageNotes: formStorageNotes.trim() || undefined,
      })
      setIsAddModalOpen(false)
    }
    resetForm()
  }

  // Helper for Opening Revised Manual Purchase Intake / Stock Modal
  const handleOpenStockModal = (item?: Ingredient) => {
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
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setStockModalMode('PURCHASE')
    setDeductReason('Physical Audit Count Reconciliation')
    setStockModalError('')
    setIsStockModalOpen(true)
  }

  const selectedStockItem = useMemo(
    () => ingredients.find((i) => i.id === selectedStockItemId) || null,
    [ingredients, selectedStockItemId]
  )

  const handleConfirmStockModal = (e: React.FormEvent) => {
    e.preventDefault()
    setStockModalError('')

    if (!selectedStockItem) {
      setStockModalError('Please select an inventory item.')
      return
    }

    if (stockModalMode === 'PURCHASE') {
      const qVal = Number(purchaseQty)
      if (!purchaseQty || isNaN(qVal) || qVal <= 0) {
        setStockModalError('Please specify a valid quantity purchased greater than zero.')
        return
      }
      if (!purchaseUnit) {
        setStockModalError('Please select a purchase unit.')
        return
      }
      if (!purchaseDate) {
        setStockModalError('Please specify the purchase date.')
        return
      }

      // Conversion logic: if item base unit is 'g' and purchase unit is 'kg', convert kg -> g (* 1000)
      const isKgToG = selectedStockItem.baseUnit === 'g' && purchaseUnit === 'kg'
      const isGToKg = selectedStockItem.baseUnit === 'kg' && purchaseUnit === 'g'
      const isLToMl = selectedStockItem.baseUnit === 'ml' && purchaseUnit === 'L'
      const isMlToL = selectedStockItem.baseUnit === 'L' && purchaseUnit === 'ml'

      let finalDelta = qVal
      if (isKgToG) {
        finalDelta = qVal * 1000
      } else if (isGToKg) {
        finalDelta = qVal / 1000
      } else if (isLToMl) {
        finalDelta = qVal * 1000
      } else if (isMlToL) {
        finalDelta = qVal / 1000
      }

      const conversionNote = isKgToG
        ? ` (${qVal} kg converted to ${finalDelta.toLocaleString()} g)`
        : ''
      const sellerNote = sellerMarket.trim() ? ` from ${sellerMarket.trim()}` : ''
      const reasonText = `Purchased ${qVal} ${purchaseUnit}${conversionNote}${sellerNote} • Date: ${purchaseDate}`

      onAdjustStock(selectedStockItem.id, finalDelta, reasonText, {
        seller: sellerMarket.trim() || undefined,
        purchaseDate,
      })

      setIsStockModalOpen(false)
    } else {
      // DEDUCT mode
      const dVal = Number(deductQty)
      if (!deductQty || isNaN(dVal) || dVal <= 0) {
        setStockModalError('Please specify a valid deduction quantity greater than zero.')
        return
      }
      if (selectedStockItem.currentStock - dVal < 0) {
        setStockModalError(
          `Cannot deduct more than current stock (${selectedStockItem.currentStock.toLocaleString()} ${selectedStockItem.baseUnit}).`
        )
        return
      }

      onAdjustStock(
        selectedStockItem.id,
        -dVal,
        `Stock Deduction: ${deductReason} (-${dVal} ${selectedStockItem.baseUnit})`
      )

      setIsStockModalOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP CONTROLS & FILTER BAR */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Raw Materials & Packaging Catalog
            </h2>
            <p className="text-xs text-slate-500">
              Manage restaurant food ingredients and packaging materials (trays, bowls, takeout bags, cutlery, stickers) using unified inventory tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleOpenStockModal()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-orange-500 bg-orange-50 px-3.5 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-all cursor-pointer shadow-2xs"
            >
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Record Purchase / Stock In</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal('FOOD')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add Food Ingredient</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal('PACKAGING')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <span>+ Add Packaging</span>
            </button>
          </div>
        </div>

        {/* Inventory Category / Type Segmented Pill Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setSelectedType('ALL')
              setSelectedCategory('ALL')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>All Inventory</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                selectedType === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {ingredients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedType('FOOD')
              setSelectedCategory('ALL')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'FOOD'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>Food Ingredients</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                selectedType === 'FOOD' ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {foodCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedType('PACKAGING')
              setSelectedCategory('ALL')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === 'PACKAGING'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>Packaging Materials</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                selectedType === 'PACKAGING' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {packagingCount}
            </span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
          <div className="relative sm:col-span-1 lg:col-span-2">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={
                selectedType === 'PACKAGING'
                  ? 'Search packaging (e.g. tray, bowl, bag, cutlery, sticker)...'
                  : 'Search ingredient or packaging by name or supplier...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">
                {selectedType === 'ALL'
                  ? `All Categories (${ingredients.length})`
                  : selectedType === 'FOOD'
                  ? `All Food Categories (${foodCount})`
                  : `All Packaging Categories (${packagingCount})`}
              </option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({ingredients.filter((i) => i.category === cat).length})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock Alert</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. INGREDIENTS TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {paginatedIngredients.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center flex flex-col items-center justify-center px-4">
            <div
              className={`h-16 w-16 rounded-3xl flex items-center justify-center mb-4 ${
                selectedType === 'PACKAGING'
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-orange-50 text-orange-500'
              }`}
            >
              {selectedType === 'PACKAGING' ? (
                <span className="text-sm font-bold uppercase tracking-wide">Packaging</span>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {ingredients.length === 0
                ? 'Your Inventory Catalog is Currently Empty'
                : selectedType === 'PACKAGING'
                ? 'No Packaging Materials Found'
                : selectedType === 'FOOD'
                ? 'No Food Ingredients Found'
                : 'No Matching Items Found'}
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md">
              {ingredients.length === 0
                ? 'Register food ingredients (proteins, produce, sauces) or packaging materials (food trays, plates, bowls, cups, lids, straws, plastic bags, spoons, forks, tissue, and sealing stickers) to configure your kitchen and takeout BOM.'
                : selectedType === 'PACKAGING' && packagingCount === 0
                ? 'No packaging materials have been registered yet. Add packaging items such as food trays, bowls, takeout bags, cutlery sets, and stickers to prepare for fulfillment BOM tracking.'
                : 'No items match your active filters. Try adjusting your search query, type filter, or category selection.'}
            </p>
            {ingredients.length === 0 && (
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('FOOD')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
                >
                  + Add Food Ingredient
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal('PACKAGING')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer"
                >
                  + Add Packaging Material
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Current Stock</th>
                  <th className="py-3 px-4">Min. Threshold</th>
                  <th className="py-3 px-4">Reorder Qty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedIngredients.map((item) => {
                  const itemType = item.itemType || 'FOOD'
                  const isPackaging = itemType === 'PACKAGING'
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{item.name}</span>
                          </div>
                          {item.supplierName && (
                            <p className="text-[10px] text-slate-400 font-normal">
                              Supplied by {item.supplierName}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isPackaging
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}
                        >
                          <span>{isPackaging ? 'Packaging' : 'Food'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {item.currentStock.toLocaleString()} {item.baseUnit}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.minStockLevel.toLocaleString()} {item.baseUnit}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {item.preferredRestockQty.toLocaleString()} {item.baseUnit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'IN_STOCK'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'LOW_STOCK'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'IN_STOCK'
                                ? 'bg-emerald-500'
                                : item.status === 'LOW_STOCK'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenStockModal(item)}
                            className="p-1 text-slate-500 hover:text-orange-600 transition-colors cursor-pointer"
                            title="Record Purchase / Stock In"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingIngredientId(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
        {filteredIngredients.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold">
                {Math.min(currentPage * itemsPerPage, filteredIngredients.length)}
              </span>{' '}
              of <span className="font-bold">{filteredIngredients.length}</span> items
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

      {/* 3. ADD / EDIT INGREDIENT / PACKAGING MODAL */}
      {(isAddModalOpen || editingIngredient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setIsAddModalOpen(false)
              setEditingIngredient(null)
            }}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                    formItemType === 'PACKAGING'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  {formItemType === 'PACKAGING' ? (
                    <span className="text-sm font-bold uppercase tracking-wide">Packaging</span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingIngredient
                      ? `Edit ${formItemType === 'PACKAGING' ? 'Packaging Material' : 'Ingredient'}`
                      : `Register New ${formItemType === 'PACKAGING' ? 'Packaging Material' : 'Ingredient'}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure base units, stock thresholds, and replenishment costs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false)
                  setEditingIngredient(null)
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="mt-4 space-y-4">
              {/* Category / Type Selector (Food vs Packaging) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Inventory Classification <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleItemTypeSwitch('FOOD')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      formItemType === 'FOOD'
                        ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <p className="text-xs leading-none">Food Ingredient</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Seafoods, produce, dairy, sauces</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleItemTypeSwitch('PACKAGING')}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      formItemType === 'PACKAGING'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-950 font-bold ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <p className="text-xs leading-none">Packaging Material</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Trays, bowls, bags, cutlery, stickers</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {formItemType === 'FOOD' ? 'Ingredient Name' : 'Packaging Item Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    formItemType === 'FOOD'
                      ? 'e.g. Fresh White Shrimp, Cajun Butter, Jasmine Rice'
                      : 'e.g. Food Tray 3-Compartment, Paper Bowl 500ml, Plastic Bag (Medium), Spoon & Fork Set'
                  }
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                    formErrors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                  }`}
                />
                {formErrors.name && <p className="mt-1 text-[11px] text-rose-500">{formErrors.name}</p>}
              </div>

              {/* Category & Base Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as IngredientCategory)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  >
                    {(formItemType === 'FOOD' ? FOOD_CATEGORIES : PACKAGING_CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Base Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formBaseUnit}
                    onChange={(e) => setFormBaseUnit(e.target.value as MeasurementUnit)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                  >
                    {MEASUREMENT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Current Stock */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Initial Stock ({formBaseUnit})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={formCurrentStock}
                  onChange={(e) => setFormCurrentStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Minimum Stock & Reorder Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Min Stock Threshold ({formBaseUnit}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={formItemType === 'PACKAGING' ? 'e.g. 50' : 'e.g. 1000'}
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                      formErrors.minStock ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                    }`}
                  />
                  {formErrors.minStock && <p className="mt-1 text-[11px] text-rose-500">{formErrors.minStock}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Preferred Reorder Qty ({formBaseUnit}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder={formItemType === 'PACKAGING' ? 'e.g. 200' : 'e.g. 5000'}
                    value={formReorderQty}
                    onChange={(e) => setFormReorderQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-xs focus:outline-none ${
                      formErrors.reorderQty ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 focus:border-orange-500'
                    }`}
                  />
                  {formErrors.reorderQty && <p className="mt-1 text-[11px] text-rose-500">{formErrors.reorderQty}</p>}
                </div>
              </div>

              {/* Preferred Supplier */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Preferred Supplier</label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                >
                  <option value="">None / Multiple Suppliers</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.contactPerson})
                    </option>
                  ))}
                </select>
              </div>

              {/* Storage Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Storage & Handling Notes</label>
                <textarea
                  rows={2}
                  placeholder={
                    formItemType === 'FOOD'
                      ? 'e.g. Keep in walk-in freezer at -18°C. Shelf life 14 days.'
                      : 'e.g. Dry packaging rack, cartons of 500 pcs, keep dry and clean.'
                  }
                  value={formStorageNotes}
                  onChange={(e) => setFormStorageNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setEditingIngredient(null)
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                    formItemType === 'PACKAGING'
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                      : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                  }`}
                >
                  {editingIngredient
                    ? 'Save Changes'
                    : formItemType === 'PACKAGING'
                    ? 'Register Packaging'
                    : 'Register Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. REVISED MANUAL PURCHASE INTAKE & STOCK ADJUSTMENT MODAL */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsStockModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {stockModalMode === 'PURCHASE' ? 'Record Purchase / Stock In' : 'Adjust Stock Count'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stockModalMode === 'PURCHASE'
                    ? 'Manually log newly purchased ingredients or packaging intake.'
                    : 'Record wastage, spoilage or reconciliation adjustments.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfirmStockModal} className="mt-4 space-y-4">
              {stockModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                  {stockModalError}
                </div>
              )}

              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStockModalMode('PURCHASE')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    stockModalMode === 'PURCHASE'
                      ? 'bg-white text-orange-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  + Add Purchased Stock
                </button>
                <button
                  type="button"
                  onClick={() => setStockModalMode('DEDUCT')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    stockModalMode === 'DEDUCT'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  - Deduct / Spoilage / Trim
                </button>
              </div>

              {/* 1. Inventory Item (* Mandatory) */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Inventory Item <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedStockItemId}
                  onChange={(e) => {
                    const newId = e.target.value
                    setSelectedStockItemId(newId)
                    const found = ingredients.find((i) => i.id === newId)
                    if (found) {
                      setPurchaseUnit(found.baseUnit === 'g' ? 'kg' : found.baseUnit)
                      if (!sellerMarket && found.supplierName) {
                        setSellerMarket(found.supplierName)
                      }
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                >
                  <option value="" disabled>-- Select Inventory Item --</option>
                  {ingredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.itemType === 'PACKAGING' ? 'Packaging' : 'Food'}) — On Hand: {item.currentStock.toLocaleString()} {item.baseUnit}
                    </option>
                  ))}
                </select>
                {selectedStockItem && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Current stock level: <strong className="text-slate-800">{selectedStockItem.currentStock.toLocaleString()} {selectedStockItem.baseUnit}</strong> (Min: {selectedStockItem.minStockLevel} {selectedStockItem.baseUnit})
                  </p>
                )}
              </div>

              {stockModalMode === 'PURCHASE' ? (
                <>
                  {/* 2. Quantity Purchased & Purchase Unit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Quantity Purchased <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder="e.g. 5 or 2.5"
                        value={purchaseQty}
                        onChange={(e) => setPurchaseQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700">
                        Purchase Unit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={purchaseUnit}
                        onChange={(e) => setPurchaseUnit(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                      >
                        <option value="kg">kg (Kilograms) - Converts to g</option>
                        <option value="g">g (Grams)</option>
                        <option value="pcs">pcs (Pieces)</option>
                        <option value="packs">packs (Packs)</option>
                        <option value="boxes">boxes (Boxes)</option>
                        <option value="cans">cans (Cans)</option>
                        <option value="bottles">bottles (Bottles)</option>
                        <option value="L">L (Liters) - Converts to ml</option>
                        <option value="ml">ml (Milliliters)</option>
                        <option value="tins">tins (Tins)</option>
                        <option value="tub">tub (Tubs)</option>
                        <option value="sack">sack (Sacks)</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. Automatic Conversion Card */}
                  {selectedStockItem && Number(purchaseQty) > 0 && selectedStockItem.baseUnit === 'g' && purchaseUnit === 'kg' && (
                    <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-orange-900">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">⚖️</span>
                          <span>Automatic Unit Conversion (kg ➔ grams)</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-orange-200/80 text-[10px] font-extrabold text-orange-900">
                          1 kg = 1,000 g
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-slate-600">Quantity received:</span>
                        <span className="font-bold text-slate-800">
                          {Number(purchaseQty)} kg = <span className="text-orange-700 text-sm font-extrabold">{(Number(purchaseQty) * 1000).toLocaleString()} grams</span>
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-[11px] text-slate-500 pt-1 border-t border-orange-200/60">
                        <span>New balance after intake:</span>
                        <span>
                          {selectedStockItem.currentStock.toLocaleString()} g + {(Number(purchaseQty) * 1000).toLocaleString()} g ={' '}
                          <strong className="text-emerald-700 font-bold">
                            {(selectedStockItem.currentStock + Number(purchaseQty) * 1000).toLocaleString()} grams
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedStockItem && Number(purchaseQty) > 0 && !(selectedStockItem.baseUnit === 'g' && purchaseUnit === 'kg') && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                      <span>Stock to be added:</span>
                      <span className="font-bold text-slate-900">
                        +{Number(purchaseQty).toLocaleString()} {purchaseUnit}
                        <span className="text-[11px] font-normal text-slate-500 ml-1.5">
                          (New Total: {(selectedStockItem.currentStock + Number(purchaseQty)).toLocaleString()} {selectedStockItem.baseUnit})
                        </span>
                      </span>
                    </div>
                  )}

                  {/* 4. Seller / Market (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Seller / Market <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Navotas Fish Port, Balintawak Market, Wet Market"
                      value={sellerMarket}
                      onChange={(e) => setSellerMarket(e.target.value)}
                      list="seller-market-list"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
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
                  </div>

                  {/* 5. Purchase Date (* Mandatory) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Purchase Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Deduct Fields */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Deduction Quantity ({selectedStockItem?.baseUnit || 'units'}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="0"
                      value={deductQty}
                      onChange={(e) => setDeductQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Reason for Adjustment
                    </label>
                    <select
                      value={deductReason}
                      onChange={(e) => setDeductReason(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                    >
                      <option value="Physical Audit Count Reconciliation">Physical Audit Count Reconciliation</option>
                      <option value="Food Waste / Spoilage Deduction">Food Waste / Spoilage Deduction</option>
                      <option value="Packaging Damage / Defective Batch">Packaging Damage / Defective Batch</option>
                      <option value="Kitchen Preparation Loss / Trim">Kitchen Preparation Loss / Trim</option>
                      <option value="Other Manual Adjustment">Other Manual Adjustment</option>
                    </select>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                    stockModalMode === 'PURCHASE'
                      ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {stockModalMode === 'PURCHASE' ? '+ Confirm Purchase & Add Stock' : 'Confirm Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. DELETE CONFIRMATION MODAL */}
      <InventoryConfirmModal
        isOpen={Boolean(deletingIngredientId)}
        title="Remove Item from Catalog"
        message="Are you sure you want to delete this inventory item? Any product recipes linked to it will need to be reconfigured."
        confirmText="Delete Item"
        isDestructive
        onConfirm={() => {
          if (deletingIngredientId) {
            onDeleteIngredient(deletingIngredientId)
            setDeletingIngredientId(null)
          }
        }}
        onCancel={() => setDeletingIngredientId(null)}
      />
    </div>
  )
}

export default IngredientsTab

import React, { useState, useMemo } from 'react'
import type { StockTransaction, TransactionType, Ingredient, InventoryItemType } from './inventoryTypes'

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
  const itemsPerPage = 10

  // Manual Transaction Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [manualIngredientId, setManualIngredientId] = useState('')
  const [manualType, setManualType] = useState<TransactionType>('ADJUSTMENT')
  const [manualQty, setManualQty] = useState<number | ''>('')
  const [manualReason, setManualReason] = useState('Stock Count Audit Reconciliation')
  const [manualError, setManualError] = useState('')

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
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTransactions.slice(start, start + itemsPerPage)
  }, [filteredTransactions, currentPage])

  const handleOpenManualModal = () => {
    setManualIngredientId(ingredients[0]?.id || '')
    setManualType('ADJUSTMENT')
    setManualQty('')
    setManualReason('Physical Audit Count Reconciliation')
    setManualError('')
    setIsManualModalOpen(true)
  }

  const handleSaveManualTransaction = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualIngredientId) {
      setManualError('Select an ingredient or packaging item.')
      return
    }
    const qty = Number(manualQty)
    if (!qty || qty === 0) {
      setManualError('Enter a valid non-zero quantity.')
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
    <div className="space-y-6">
      {/* 1. TOP CONTROLS & FILTER BAR */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Inventory Stock Movement Ledger
            </h2>
            <p className="text-xs text-slate-500">
              Immutable audit trail recording raw food ingredient intake, fulfillment packaging consumption, kitchen waste, and count adjustments.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenManualModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Record Manual Entry
          </button>
        </div>

        {/* Classification Tabs: All, Food, Packaging */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setItemTypeFilter('ALL')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              itemTypeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>All Movements</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                itemTypeFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {transactions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setItemTypeFilter('FOOD')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              itemTypeFilter === 'FOOD'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Food Movements</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                itemTypeFilter === 'FOOD' ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {transactions.filter((t) => (t.itemType || 'FOOD') === 'FOOD').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setItemTypeFilter('PACKAGING')
              setCurrentPage(1)
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              itemTypeFilter === 'PACKAGING'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Packaging Movements</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                itemTypeFilter === 'PACKAGING' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {transactions.filter((t) => t.itemType === 'PACKAGING').length}
            </span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
          <div className="relative sm:col-span-1 lg:col-span-2">
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
              placeholder="Search reference #, item, actor, or reason..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as 'ALL' | TransactionType)
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="STOCK_RECEIVED">Stock Received (Intake / PO)</option>
              <option value="CONSUMPTION">Consumption (Orders & Prep)</option>
              <option value="WASTE">Waste, Crushed & Spoilage</option>
              <option value="ADJUSTMENT">Manual Stock Reconciliation</option>
            </select>
          </div>

          <div>
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as 'ALL' | 'TODAY' | 'WEEK' | 'MONTH')
                setCurrentPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All Recorded Dates</option>
              <option value="TODAY">Last 24 Hours</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. LEDGER TABLE */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {paginatedTransactions.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center flex flex-col items-center justify-center px-4">
            <div className="h-16 w-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Stock Movements Logged</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {transactions.length === 0
                ? 'Your stock history is empty. Record a manual movement or receive a purchase order to see entries here.'
                : 'No stock transactions match your current search, item type, or transaction type filters.'}
            </p>
            {transactions.length === 0 && (
              <button
                type="button"
                onClick={handleOpenManualModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
              >
                + Record Manual Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4">Delta Quantity</th>
                  <th className="py-3 px-4">Stock Balance After</th>
                  <th className="py-3 px-4">Logged By</th>
                  <th className="py-3 px-4">Audit Reason & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedTransactions.map((tx) => {
                  const isPositive = tx.quantityDelta > 0
                  const isPackaging = tx.itemType === 'PACKAGING'

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(tx.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                        {tx.referenceNo}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {tx.ingredientName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isPackaging
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}
                        >
                          <span>{isPackaging ? 'Packaging' : 'Food'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.type === 'STOCK_RECEIVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.type === 'CONSUMPTION'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : tx.type === 'WASTE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black">
                        <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                          {isPositive ? `+${tx.quantityDelta}` : tx.quantityDelta} {tx.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {tx.stockAfter} {tx.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {tx.performedBy}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={tx.reason || ''}>
                        {tx.reason || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {filteredTransactions.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-bold">
                {Math.min(currentPage * itemsPerPage, filteredTransactions.length)}
              </span>{' '}
              of <span className="font-bold">{filteredTransactions.length}</span> ledger movements
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

      {/* 3. RECORD MANUAL ENTRY MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsManualModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Record Stock Movement</h3>
              </div>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveManualTransaction} className="mt-4 space-y-4">
              {manualError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                  {manualError}
                </div>
              )}

              {/* Item selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Select Item (Food or Packaging) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={manualIngredientId}
                  onChange={(e) => setManualIngredientId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                >
                  <option value="">-- Choose Item --</option>
                  {foodIngredients.length > 0 && (
                    <optgroup label="Food Ingredients">
                      {foodIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Current: {i.currentStock} {i.baseUnit})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {packagingIngredients.length > 0 && (
                    <optgroup label="Packaging Materials">
                      {packagingIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} (Current: {i.currentStock} {i.baseUnit})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Movement Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Movement Nature</label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as TransactionType)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                >
                  <option value="STOCK_RECEIVED">Stock Received (Manual Restock Intake)</option>
                  <option value="CONSUMPTION">Consumption (Kitchen Prep / Fulfillment)</option>
                  <option value="WASTE">Waste (Crushed packaging, food spoilage)</option>
                  <option value="ADJUSTMENT">Manual Reconciliation (Physical Audit)</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Quantity ({ingredients.find((i) => i.id === manualIngredientId)?.baseUnit || 'units'})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  placeholder="e.g. 50"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Audit Justification</label>
                <input
                  type="text"
                  placeholder="e.g. Physical inventory count discrepancy, damaged packaging box"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-600 cursor-pointer"
                >
                  Post Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockHistoryTab

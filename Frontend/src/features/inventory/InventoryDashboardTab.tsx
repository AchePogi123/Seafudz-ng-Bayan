import React, { useState, useMemo } from 'react'
import type {
  Ingredient,
  PurchaseOrder,
  StockTransaction,
  InventoryKPISummary,
  InventoryItemType,
} from './inventoryTypes'

interface InventoryDashboardTabProps {
  ingredients: Ingredient[]
  purchaseOrders: PurchaseOrder[]
  transactions: StockTransaction[]
  onNavigateTab: (tabId: string) => void
  onOpenAddIngredient: (defaultType?: InventoryItemType) => void
  onOpenCreatePO: () => void
}

export const InventoryDashboardTab: React.FC<InventoryDashboardTabProps> = ({
  ingredients,
  purchaseOrders,
  transactions,
  onNavigateTab,
  onOpenAddIngredient,
  onOpenCreatePO,
}) => {
  // Alert type filter
  const [alertTypeFilter, setAlertTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')

  // Compute Comprehensive KPIs
  const summary: InventoryKPISummary = useMemo(() => {
    const foodItems = ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD')
    const packagingItems = ingredients.filter((i) => i.itemType === 'PACKAGING')

    const foodValuation = foodItems.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0)
    const packagingValuation = packagingItems.reduce((sum, item) => sum + item.currentStock * item.costPerUnit, 0)

    return {
      totalIngredients: ingredients.length,
      totalFoodItems: foodItems.length,
      totalPackagingItems: packagingItems.length,
      availableStockCount: ingredients.filter((i) => i.status === 'IN_STOCK').length,
      lowStockCount: ingredients.filter((i) => i.status === 'LOW_STOCK').length,
      lowStockFoodCount: foodItems.filter((i) => i.status === 'LOW_STOCK').length,
      lowStockPackagingCount: packagingItems.filter((i) => i.status === 'LOW_STOCK').length,
      outOfStockCount: ingredients.filter((i) => i.status === 'OUT_OF_STOCK').length,
      pendingPurchasesCount: purchaseOrders.filter((po) => po.status === 'PENDING').length,
      totalValuation: foodValuation + packagingValuation,
      foodValuation,
      packagingValuation,
    }
  }, [ingredients, purchaseOrders])

  // Low stock and out of stock items
  const allAlertItems = useMemo(() => {
    return ingredients.filter(
      (i) => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK'
    )
  }, [ingredients])

  const filteredAlertItems = useMemo(() => {
    if (alertTypeFilter === 'ALL') return allAlertItems
    return allAlertItems.filter((i) => (i.itemType || 'FOOD') === alertTypeFilter)
  }, [allAlertItems, alertTypeFilter])

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [transactions])

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY CARDS (5 Metric Cards Matching AdminDashboard) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total Catalog Size */}
        <div className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-slate-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Total Catalog</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {summary.totalIngredients}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tracked materials & packaging
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-orange-600 font-medium">{summary.totalFoodItems} Food</span>
            <span className="text-slate-500">{summary.totalPackagingItems} Packaging</span>
          </div>
        </div>

        {/* Available Stock */}
        <div className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-slate-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">In Stock</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {summary.availableStockCount}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1 tabular-nums font-medium">
              {summary.totalIngredients > 0
                ? `${Math.round((summary.availableStockCount / summary.totalIngredients) * 100)}% of catalog`
                : 'Above reorder buffer'}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Health</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Optimal
            </span>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-slate-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Low Stock</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${summary.lowStockCount > 0 ? 'text-amber-500' : 'text-slate-900'}`}>
              {summary.lowStockCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Below reorder threshold
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-amber-600 font-medium">{summary.lowStockFoodCount} Food</span>
            <span className="text-slate-500">{summary.lowStockPackagingCount} Pkg</span>
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-slate-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Out of Stock</p>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${summary.outOfStockCount > 0 ? 'text-rose-500' : 'text-slate-900'}`}>
              {summary.outOfStockCount}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Depleted inventory items
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Replenishment</span>
            <span className={`font-medium ${summary.outOfStockCount > 0 ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
              {summary.outOfStockCount > 0 ? 'Action required' : 'Clear'}
            </span>
          </div>
        </div>

        {/* Inbound POs & Valuation */}
        <div className="text-left bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-slate-100 flex flex-col justify-between col-span-2 md:col-span-1">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Stock Valuation</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              ₱{summary.totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-orange-600 mt-1 tabular-nums font-medium">
              Asset on-hand value
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-slate-500">Food: ₱{summary.foodValuation.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
            <span className="text-slate-400">Pkg: ₱{summary.packagingValuation.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTIONS BAR */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operations & Quick Actions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Quickly manage raw materials, receive purchase orders, and audit BOM recipes</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAddIngredient('FOOD')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Food ingredient
          </button>
          <button
            type="button"
            onClick={() => onOpenAddIngredient('PACKAGING')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/80 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Packaging
          </button>
          <button
            type="button"
            onClick={onOpenCreatePO}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Purchases & receiving
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('recipes')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Recipes (BOM)
          </button>
        </div>
      </div>

      {/* 3. TWO-COLUMN OVERVIEW: LOW-STOCK ALERTS & RECENT MOVEMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low-Stock Alerts Section */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Low-Stock & Depletion Alerts</h3>
                <p className="text-xs text-slate-400 mt-0.5">Materials & packaging nearing or below minimum buffer</p>
              </div>

              {/* Alert Classification Pill Filter matching AdminDashboard */}
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
                {(['ALL', 'FOOD', 'PACKAGING'] as const).map((filter) => {
                  const isActive = alertTypeFilter === filter
                  const label = filter === 'ALL' ? `All (${allAlertItems.length})` : filter === 'FOOD' ? 'Food' : 'Packaging'
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAlertTypeFilter(filter)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4">
              {filteredAlertItems.length === 0 ? (
                /* Empty state when no low stock */
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800">
                    {allAlertItems.length === 0 && ingredients.length === 0
                      ? 'Your catalog is ready to get started'
                      : allAlertItems.length === 0
                      ? 'No Low Stock Alerts'
                      : `No Low Stock in ${alertTypeFilter === 'FOOD' ? 'Food Ingredients' : 'Packaging Materials'}`}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                    {ingredients.length === 0
                      ? 'Add food ingredients or packaging to start tracking current quantities and minimum stock levels.'
                      : 'All registered inventory items are at or above their configured minimum thresholds.'}
                  </p>
                  {ingredients.length === 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenAddIngredient('FOOD')}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition-colors"
                      >
                        Add food ingredient
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAddIngredient('PACKAGING')}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Add packaging
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {filteredAlertItems.map((item) => {
                    const isPackaging = item.itemType === 'PACKAGING'
                    const stockScale = Math.max(item.minStockLevel * 1.5, item.currentStock, 1)
                    const stockWidth = Math.min(100, (item.currentStock / stockScale) * 100)
                    const minimumTick = Math.min(100, (item.minStockLevel / stockScale) * 100)
                    return (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                isPackaging
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-orange-50 text-orange-700'
                              }`}
                            >
                              {isPackaging ? 'Packaging' : 'Food'}
                            </span>
                            <p className="text-xs font-semibold text-slate-800 truncate">{item.name}</p>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                            Min: {item.minStockLevel} {item.baseUnit} · Reorder: {item.preferredRestockQty} {item.baseUnit}
                          </p>
                        </div>
                        <div className="stock-comparison shrink-0">
                          <span className="stock-quantity tabular-nums">
                            {item.currentStock.toLocaleString()} {item.baseUnit}
                          </span>
                          <div
                            className={`stock-level-mark ${item.status === 'OUT_OF_STOCK' ? 'is-empty' : 'is-low'}`}
                            role="img"
                            aria-label={`Current stock ${item.currentStock} ${item.baseUnit}; minimum ${item.minStockLevel} ${item.baseUnit}`}
                          >
                            <span className="stock-level-fill" style={{ width: `${stockWidth}%` }} />
                            <span className="stock-minimum-tick" style={{ left: `${minimumTick}%` }} />
                          </div>
                          <span
                            className={`stock-status ${
                              item.status === 'OUT_OF_STOCK' ? 'is-depleted' : 'is-low'
                            }`}
                          >
                            {item.status === 'OUT_OF_STOCK' ? 'Out of stock' : 'Low stock'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400">Review low & depleted items before placing PO</span>
            <button
              onClick={onOpenCreatePO}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
            >
              Order replenishment →
            </button>
          </div>
        </div>

        {/* Recent Stock Movements Section */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Recent Stock Movements</h3>
                <p className="text-xs text-slate-400 mt-0.5">Recorded receipts, consumption, and adjustments</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
              >
                View ledger →
              </button>
            </div>

            <div className="mt-4">
              {recentTransactions.length === 0 ? (
                /* Empty state when no movements */
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800">No Recent Stock Movements</h4>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-xs">
                    Received purchase orders and recorded stock adjustments will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {recentTransactions.map((tx) => {
                    const isPackaging = tx.itemType === 'PACKAGING'
                    return (
                      <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                isPackaging
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-orange-50 text-orange-700'
                              }`}
                            >
                              {isPackaging ? 'Packaging' : 'Food'}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate">{tx.ingredientName}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                tx.type === 'STOCK_RECEIVED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : tx.type === 'CONSUMPTION'
                                  ? 'bg-blue-50 text-blue-700'
                                  : tx.type === 'WASTE'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {tx.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                            {new Date(tx.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}{' '}
                            · by {tx.performedBy}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              tx.quantityDelta > 0 ? 'text-emerald-600' : 'text-slate-700'
                            }`}
                          >
                            {tx.quantityDelta > 0 ? `+${tx.quantityDelta}` : tx.quantityDelta} {tx.unit}
                          </span>
                          <p className="text-[10px] text-slate-400 tabular-nums">Bal: {tx.stockAfter} {tx.unit}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400">Tracked in chronological audit trail</span>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
            >
              Full transaction log →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InventoryDashboardTab

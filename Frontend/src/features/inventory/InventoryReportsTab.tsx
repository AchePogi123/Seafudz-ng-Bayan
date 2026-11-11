import React, { useState, useMemo } from 'react'
import type { Ingredient, PurchaseOrder, StockTransaction, InventoryItemType } from './inventoryTypes'

interface InventoryReportsTabProps {
  ingredients: Ingredient[]
  purchaseOrders: PurchaseOrder[]
  transactions: StockTransaction[]
  onExportReport: (type: 'EXCEL' | 'PDF') => void
}

export const InventoryReportsTab: React.FC<InventoryReportsTabProps> = ({
  ingredients,
  purchaseOrders,
  transactions,
  onExportReport,
}) => {
  const [activeReportSubTab, setActiveReportSubTab] = useState<
    'CONSUMPTION' | 'PURCHASING' | 'WASTE' | 'VALUATION'
  >('CONSUMPTION')

  const [dateHorizon, setDateHorizon] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH')
  const [reportTypeFilter, setReportTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')

  // Financial Computations
  const foodItems = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD'),
    [ingredients]
  )
  const packagingItems = useMemo(
    () => ingredients.filter((i) => i.itemType === 'PACKAGING'),
    [ingredients]
  )

  const foodValuation = useMemo(
    () => foodItems.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0),
    [foodItems]
  )
  const packagingValuation = useMemo(
    () => packagingItems.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0),
    [packagingItems]
  )
  const totalValuation = foodValuation + packagingValuation
  const selectedValuation =
    reportTypeFilter === 'FOOD'
      ? foodValuation
      : reportTypeFilter === 'PACKAGING'
      ? packagingValuation
      : totalValuation

  const reportStart = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (dateHorizon === 'WEEK') start.setDate(start.getDate() - 6)
    if (dateHorizon === 'MONTH') start.setDate(start.getDate() - 29)
    if (dateHorizon === 'YEAR') {
      start.setMonth(0, 1)
    }
    return start
  }, [dateHorizon])

  const consumptionTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const isConsumption = transaction.type === 'CONSUMPTION'
        const isInRange =
          new Date(transaction.timestamp).getTime() >= reportStart.getTime() &&
          new Date(transaction.timestamp).getTime() <= new Date().getTime()
        const matchesClassification =
          reportTypeFilter === 'ALL' ||
          (transaction.itemType || 'FOOD') === reportTypeFilter
        return isConsumption && isInRange && matchesClassification
      }),
    [transactions, reportStart, reportTypeFilter]
  )

  const consumptionBuckets = useMemo(() => {
    const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3600000)
    const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
    const formatDay = (date: Date) =>
      date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    const buckets: { label: string; start: Date; end: Date }[] = []

    if (dateHorizon === 'TODAY') {
      for (let hour = 0; hour < 24; hour += 4) {
        const start = new Date(reportStart)
        start.setHours(hour)
        const end = addHours(start, 4)
        buckets.push({
          label: start.toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true }),
          start,
          end,
        })
      }
    } else if (dateHorizon === 'WEEK') {
      for (let day = 0; day < 7; day += 1) {
        const start = addDays(reportStart, day)
        buckets.push({
          label: start.toLocaleDateString('en-PH', { weekday: 'short' }),
          start,
          end: addDays(start, 1),
        })
      }
    } else if (dateHorizon === 'MONTH') {
      for (let period = 0; period < 6; period += 1) {
        const start = addDays(reportStart, period * 5)
        const end = addDays(start, 5)
        buckets.push({
          label: `${formatDay(start)}–${formatDay(addDays(end, -1))}`,
          start,
          end,
        })
      }
    } else {
      const year = reportStart.getFullYear()
      for (let month = 0; month < 12; month += 1) {
        buckets.push({
          label: new Date(year, month, 1).toLocaleDateString('en-PH', { month: 'short' }),
          start: new Date(year, month, 1),
          end: new Date(year, month + 1, 1),
        })
      }
    }

    return buckets.map((bucket) => ({
      ...bucket,
      count: consumptionTransactions.filter((transaction) => {
        const timestamp = new Date(transaction.timestamp).getTime()
        return timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime()
      }).length,
    }))
  }, [dateHorizon, reportStart, consumptionTransactions])

  const topConsumedItems = useMemo(() => {
    const totals = new Map<
      string,
      {
        id: string
        name: string
        itemType: InventoryItemType
        unit: string
        quantity: number
        movementCount: number
      }
    >()

    consumptionTransactions.forEach((transaction) => {
      const current = totals.get(transaction.ingredientId) || {
        id: transaction.ingredientId,
        name: transaction.ingredientName,
        itemType: transaction.itemType || 'FOOD',
        unit: transaction.unit,
        quantity: 0,
        movementCount: 0,
      }
      current.quantity += Math.abs(transaction.quantityDelta)
      current.movementCount += 1
      totals.set(transaction.ingredientId, current)
    })

    return Array.from(totals.values())
      .sort((a, b) => b.movementCount - a.movementCount)
      .slice(0, 4)
  }, [consumptionTransactions])

  // Waste transactions
  const wasteTxs = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = t.type === 'WASTE'
      const isInRange = new Date(t.timestamp).getTime() >= reportStart.getTime()
      const matchesClassification =
        reportTypeFilter === 'ALL' || (t.itemType || 'FOOD') === reportTypeFilter
      return matchesType && isInRange && matchesClassification
    })
  }, [transactions, reportStart, reportTypeFilter])

  const totalWasteLoss = useMemo(() => {
    return wasteTxs.reduce((sum, t) => {
      const ing = ingredients.find((i) => i.id === t.ingredientId)
      const cost = ing ? ing.costPerUnit : 0
      return sum + Math.abs(t.quantityDelta) * cost
    }, 0)
  }, [wasteTxs, ingredients])

  const wasteBreakdown = useMemo(() => {
    const totals = new Map<
      string,
      { reason: string; itemType: InventoryItemType; count: number; loss: number }
    >()
    wasteTxs.forEach((transaction) => {
      const reason = transaction.reason?.trim() || 'No reason specified'
      const itemType = transaction.itemType || 'FOOD'
      const key = `${itemType}:${reason}`
      const current = totals.get(key) || { reason, itemType, count: 0, loss: 0 }
      const ingredient = ingredients.find((item) => item.id === transaction.ingredientId)
      current.count += 1
      current.loss += Math.abs(transaction.quantityDelta) * (ingredient?.costPerUnit || 0)
      totals.set(key, current)
    })
    return Array.from(totals.values()).sort((a, b) => b.count - a.count)
  }, [wasteTxs, ingredients])

  // Procurement spend
  const activePOs = useMemo(() => {
    return purchaseOrders.filter((po) => po.status !== 'CANCELLED')
  }, [purchaseOrders])

  const purchaseOrdersInPeriod = useMemo(
    () =>
      activePOs.filter((po) => new Date(po.orderDate).getTime() >= reportStart.getTime()),
    [activePOs, reportStart]
  )

  const totalFoodSpend = useMemo(() => {
    return purchaseOrdersInPeriod.reduce((sum, po) => {
      const foodLines = po.items.filter((it) => (it.itemType || 'FOOD') === 'FOOD')
      return sum + foodLines.reduce((lineSum, it) => lineSum + it.totalCost, 0)
    }, 0)
  }, [purchaseOrdersInPeriod])

  const totalPackagingSpend = useMemo(() => {
    return purchaseOrdersInPeriod.reduce((sum, po) => {
      const pkgLines = po.items.filter((it) => it.itemType === 'PACKAGING')
      return sum + pkgLines.reduce((lineSum, it) => lineSum + it.totalCost, 0)
    }, 0)
  }, [purchaseOrdersInPeriod])

  const totalPurchasesSpend = totalFoodSpend + totalPackagingSpend
  const pendingOrdersCount = purchaseOrders.filter((po) => po.status === 'PENDING').length
  const supplierPurchaseSummary = useMemo(() => {
    const totals = new Map<string, { amount: number; orders: number }>()
    purchaseOrdersInPeriod.forEach((order) => {
      const current = totals.get(order.supplierName) || { amount: 0, orders: 0 }
      current.amount += order.totalAmount
      current.orders += 1
      totals.set(order.supplierName, current)
    })
    return Array.from(totals.entries())
      .map(([supplierName, total]) => ({ supplierName, ...total }))
      .sort((a, b) => b.amount - a.amount)
  }, [purchaseOrdersInPeriod])

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & EXPORT ACTIONS */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Inventory Reports</h2>
          <p className="text-xs text-slate-500">
            Review recorded stock consumption, purchases, waste and current stock valuation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon toggle */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs">
            {(
              [
                { label: 'Today', value: 'TODAY' },
                { label: 'This Week', value: 'WEEK' },
                { label: 'This Month', value: 'MONTH' },
                { label: 'This Year', value: 'YEAR' },
              ] as const
            ).map((h) => (
              <button
                key={h.value}
                type="button"
                onClick={() => setDateHorizon(h.value)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  dateHorizon === h.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onExportReport('EXCEL')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => onExportReport('PDF')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print PDF
          </button>
        </div>
      </div>

      {/* 2. SUB-REPORT NAVIGATION TABS & INVENTORY CLASSIFICATION FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 gap-3">
        <div className="flex border-b sm:border-b-0 border-slate-200 gap-6 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveReportSubTab('CONSUMPTION')}
            aria-pressed={activeReportSubTab === 'CONSUMPTION'}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px shrink-0 ${
              activeReportSubTab === 'CONSUMPTION'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Material Consumption
          </button>
          <button
            type="button"
            onClick={() => setActiveReportSubTab('PURCHASING')}
            aria-pressed={activeReportSubTab === 'PURCHASING'}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px shrink-0 ${
              activeReportSubTab === 'PURCHASING'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Purchasing & Procurement
          </button>
          <button
            type="button"
            onClick={() => setActiveReportSubTab('WASTE')}
            aria-pressed={activeReportSubTab === 'WASTE'}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px shrink-0 ${
              activeReportSubTab === 'WASTE'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Waste & Shrinkage
          </button>
          <button
            type="button"
            onClick={() => setActiveReportSubTab('VALUATION')}
            aria-pressed={activeReportSubTab === 'VALUATION'}
            className={`pb-3 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px shrink-0 ${
              activeReportSubTab === 'VALUATION'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Stock Valuation & Reorder
          </button>
        </div>

        {/* Classification Filter */}
        <div className="flex items-center gap-1.5 pb-2 sm:pb-0">
          <button
            type="button"
            onClick={() => setReportTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportTypeFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Inventory
          </button>
          <button
            type="button"
            onClick={() => setReportTypeFilter('FOOD')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportTypeFilter === 'FOOD'
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Food
          </button>
          <button
            type="button"
            onClick={() => setReportTypeFilter('PACKAGING')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              reportTypeFilter === 'PACKAGING'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Packaging
          </button>
        </div>
      </div>

      {/* 3. REPORT VIEWS */}
      {activeReportSubTab === 'CONSUMPTION' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {reportTypeFilter === 'PACKAGING'
                        ? 'Packaging consumption'
                        : reportTypeFilter === 'FOOD'
                        ? 'Food ingredient consumption'
                        : 'Recorded stock consumption'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Number of recorded consumption movements for the selected period
                    </p>
                  </div>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                    {dateHorizon}
                  </span>
                </div>

                <div className="min-h-56 mt-4 flex items-end border-b border-slate-200 pb-2">
                  {consumptionTransactions.length === 0 ? (
                    <p className="w-full py-12 text-center text-sm text-slate-500">
                      No consumption movements recorded for this period.
                    </p>
                  ) : (
                    <div className="w-full flex items-end justify-between gap-2 sm:gap-4">
                      {consumptionBuckets.map((bucket) => {
                        const maxCount = Math.max(...consumptionBuckets.map((entry) => entry.count), 1)
                        const barHeight = bucket.count === 0 ? 0 : Math.max(4, (bucket.count / maxCount) * 144)
                        return (
                          <div
                            key={bucket.label}
                            className="flex flex-1 flex-col items-center justify-end gap-2"
                            aria-label={`${bucket.label}: ${bucket.count} movements`}
                          >
                            <span className="text-[11px] font-semibold text-slate-700">
                              {bucket.count || ''}
                            </span>
                            <div
                              className={`w-full max-w-10 rounded-t-sm ${
                                reportTypeFilter === 'PACKAGING' ? 'bg-indigo-600' : 'bg-orange-500'
                              }`}
                              style={{ height: `${barHeight}px` }}
                            />
                            <span className="text-[10px] font-medium text-slate-500">{bucket.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-3 text-xs text-slate-600">
                <span>Recorded movements</span>
                <span className="font-semibold text-slate-800">{consumptionTransactions.length}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
                  Items with most recorded movements
                </h3>
                {topConsumedItems.length === 0 ? (
                  <p className="mt-4 py-8 text-sm text-slate-500">
                    No consumption records in this period.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="inventory-compact-table w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2 pr-3">Item</th>
                          <th className="py-2 px-2 text-right">Moves</th>
                          <th className="py-2 pl-2 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {topConsumedItems.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 pr-3">
                              <span className="font-semibold text-slate-800">{item.name}</span>
                              <span className="block text-[10px] text-slate-500">
                                {item.itemType === 'PACKAGING' ? 'Packaging' : 'Food'}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right text-slate-600">{item.movementCount}</td>
                            <td className="py-3 pl-2 text-right font-semibold text-slate-800">
                              {item.quantity.toLocaleString()} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
                Quantities are summed from recorded consumption movements.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeReportSubTab === 'PURCHASING' && (
        <div className="space-y-6">
          <div className="inventory-kpi-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Spend</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                ₱{totalPurchasesSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Non-cancelled purchase orders</p>
            </div>
            <div className="p-5 rounded-2xl border border-orange-200 bg-orange-50/30 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Food Spend</span>
              <p className="text-2xl font-black text-orange-950 mt-1">
                ₱{totalFoodSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Food ingredient line items</p>
            </div>
            <div className="p-5 rounded-2xl border border-indigo-200 bg-indigo-50/30 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Packaging Spend</span>
              <p className="text-2xl font-black text-indigo-950 mt-1">
                ₱{totalPackagingSpend.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Trays, bags, cutlery, stickers</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending purchase orders</span>
              <p className="text-2xl font-black text-slate-900 mt-1">{pendingOrdersCount}</p>
              <p className="text-xs text-slate-500 mt-1">Awaiting receipt</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Spend by supplier</h3>
            {supplierPurchaseSummary.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No purchase orders are available to summarize.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-3 py-3">Supplier</th>
                      <th className="px-3 py-3 text-right">Orders</th>
                      <th className="px-3 py-3 text-right">Order value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {supplierPurchaseSummary.map((supplier) => (
                      <tr key={supplier.supplierName}>
                        <td className="px-3 py-3 font-semibold text-slate-800">{supplier.supplierName}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{supplier.orders}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">
                          ₱{supplier.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeReportSubTab === 'WASTE' && (
        <div className="space-y-6">
          <div className="inventory-kpi-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {reportTypeFilter === 'PACKAGING'
                  ? 'Total Packaging Loss'
                  : reportTypeFilter === 'FOOD'
                  ? 'Total Food Waste Loss'
                  : 'Total Waste & Shrinkage Loss'}
              </span>
              <p className="text-2xl font-black text-rose-600 mt-1">
                ₱{totalWasteLoss.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">Recorded shrinkage, damages & spoilage</p>
            </div>
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loss Ratio</span>
              <p className="text-2xl font-black text-slate-900 mt-1">
                {selectedValuation > 0
                  ? `${((totalWasteLoss / selectedValuation) * 100).toFixed(1)}%`
                  : '0.0%'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Waste value vs selected stock valuation</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Recorded waste reasons</h3>
            <p className="text-xs text-slate-500 mb-6">
              Reasons recorded with stock waste movements
            </p>

            {wasteBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No waste transactions are recorded for this selection.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-3 py-3">Recorded reason</th>
                      <th className="px-3 py-3">Classification</th>
                      <th className="px-3 py-3 text-right">Movements</th>
                      <th className="px-3 py-3 text-right">Estimated value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {wasteBreakdown.map((item) => (
                      <tr key={`${item.itemType}:${item.reason}`}>
                        <td className="px-3 py-3 font-semibold text-slate-800">{item.reason}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {item.itemType === 'PACKAGING' ? 'Packaging' : 'Food'}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">{item.count}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">
                          ₱{item.loss.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeReportSubTab === 'VALUATION' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Total branch inventory valuation</h3>
              <p className="text-3xl font-black text-slate-900 mt-1">
                ₱{totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                  <span>Food Ingredients:</span> ₱{foodValuation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  <span>Packaging Materials:</span> ₱{packagingValuation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                Caloocan Flagship Valuation
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Reorder Urgency Summary</h3>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {ingredients.filter((i) => {
                const isBelow = i.currentStock <= i.minStockLevel
                const matchesType =
                  reportTypeFilter === 'ALL' || (i.itemType || 'FOOD') === reportTypeFilter
                return isBelow && matchesType
              }).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No items currently require urgent replenishment.
                </div>
              ) : (
                ingredients
                  .filter((i) => {
                    const isBelow = i.currentStock <= i.minStockLevel
                    const matchesType =
                      reportTypeFilter === 'ALL' || (i.itemType || 'FOOD') === reportTypeFilter
                    return isBelow && matchesType
                  })
                  .map((item) => {
                    const isPackaging = item.itemType === 'PACKAGING'
                    return (
                      <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              isPackaging
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-orange-50 text-orange-700 border border-orange-200'
                            }`}
                          >
                            {isPackaging ? 'Packaging' : 'Food'}
                          </span>
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className="text-[10px] text-slate-400">
                            Min: {item.minStockLevel} {item.baseUnit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-amber-600">
                            {item.currentStock} {item.baseUnit} left
                          </span>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventoryReportsTab

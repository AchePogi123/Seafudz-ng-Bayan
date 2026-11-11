import React, { useState, useMemo } from 'react'
import type { Ingredient, PurchaseOrder, StockTransaction, InventoryItemType } from './inventoryTypes'
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Segmented,
  StockStatusBadge,
  TypeBadge,
  formatPeso,
  formatQty,
} from './ui'

const Metric: React.FC<{ label: string; value: string; note?: string; tone?: 'danger' }> = ({ label, value, note, tone }) => (
  <div className="inv-stat">
    <span className="inv-stat-label">{label}</span>
    <span className="inv-stat-value" style={tone === 'danger' ? { color: 'var(--inv-danger)' } : undefined}>
      {value}
    </span>
    {note && <span className="inv-stat-note">{note}</span>}
  </div>
)

const HORIZON_LABEL = { TODAY: 'today', WEEK: 'the last 7 days', MONTH: 'the last 30 days', YEAR: 'this year' } as const

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

    // Stock given back by cancelled orders is not real usage
    transactions.forEach((transaction) => {
      if (transaction.type !== 'ORDER_RETURN') return
      if (new Date(transaction.timestamp).getTime() < reportStart.getTime()) return
      if (reportTypeFilter !== 'ALL' && (transaction.itemType || 'FOOD') !== reportTypeFilter) return
      const current = totals.get(transaction.ingredientId)
      if (current) current.quantity = Math.max(0, current.quantity - Math.abs(transaction.quantityDelta))
    })

    return Array.from(totals.values())
      .sort((a, b) => b.movementCount - a.movementCount)
      .slice(0, 4)
  }, [consumptionTransactions, transactions, reportStart, reportTypeFilter])

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

  const reorderItems = ingredients
    .filter((i) => i.currentStock <= i.minStockLevel)
    .filter((i) => reportTypeFilter === 'ALL' || (i.itemType || 'FOOD') === reportTypeFilter)
    .sort((a, b) => a.currentStock / Math.max(a.minStockLevel, 1) - b.currentStock / Math.max(b.minStockLevel, 1))

  const maxBucket = Math.max(...consumptionBuckets.map((b) => b.count), 1)
  const period = HORIZON_LABEL[dateHorizon]

  return (
    <div className="space-y-5">
      <div className="inv-section-header">
        <div className="min-w-0">
          <h2 className="inv-section-title">Reports</h2>
          <p className="inv-section-desc">Usage, purchasing, waste and stock value for {period}.</p>
        </div>
        <div className="inv-section-actions">
          <Button variant="secondary" icon="download" onClick={() => onExportReport('EXCEL')}>
            Export Excel
          </Button>
          <Button variant="secondary" icon="print" onClick={() => onExportReport('PDF')}>
            Print PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented
          label="Report"
          value={activeReportSubTab}
          onChange={setActiveReportSubTab}
          options={[
            { value: 'CONSUMPTION', label: 'Usage' },
            { value: 'PURCHASING', label: 'Purchasing' },
            { value: 'WASTE', label: 'Waste' },
            { value: 'VALUATION', label: 'Stock value & reorder' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label="Item type"
            value={reportTypeFilter}
            onChange={setReportTypeFilter}
            options={[
              { value: 'ALL', label: 'All items' },
              { value: 'FOOD', label: 'Food' },
              { value: 'PACKAGING', label: 'Packaging' },
            ]}
          />
          {activeReportSubTab !== 'VALUATION' && (
            <select
              aria-label="Period"
              className="inv-select inv-select--sm w-auto"
              value={dateHorizon}
              onChange={(e) => setDateHorizon(e.target.value as typeof dateHorizon)}
            >
              <option value="TODAY">Today</option>
              <option value="WEEK">Last 7 days</option>
              <option value="MONTH">Last 30 days</option>
              <option value="YEAR">This year</option>
            </select>
          )}
        </div>
      </div>

      {activeReportSubTab === 'CONSUMPTION' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Usage movements"
              description={`Recorded usage entries over ${period}`}
              actions={
                <span className="text-sm text-[var(--inv-text-3)]">
                  <b className="font-semibold text-[var(--inv-text)]">{consumptionTransactions.length}</b> total
                </span>
              }
            />
            <div className="inv-card-body">
              {consumptionTransactions.length === 0 ? (
                <EmptyState
                  compact
                  icon="history"
                  title="No usage recorded in this period"
                  description="Usage appears here when stock is recorded as kitchen usage."
                />
              ) : (
                <div className="flex h-56 items-end gap-2 sm:gap-4" role="list" aria-label="Usage movements by period">
                  {consumptionBuckets.map((bucket) => (
                    <div
                      key={bucket.label}
                      role="listitem"
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                      aria-label={`${bucket.label}: ${bucket.count} movements`}
                    >
                      <span className="text-xs font-medium text-[var(--inv-text-2)]">{bucket.count || ''}</span>
                      <div
                        className="w-full max-w-10 rounded-t-md bg-[var(--inv-brand)] opacity-85 transition-opacity group-hover:opacity-100"
                        style={{ height: `${bucket.count === 0 ? 2 : Math.max(6, (bucket.count / maxBucket) * 170)}px` }}
                      />
                      <span className="text-center text-[11px] leading-tight text-[var(--inv-text-3)]">{bucket.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Most used items" description="By number of usage entries" />
            {topConsumedItems.length === 0 ? (
              <EmptyState compact icon="box" title="Nothing to rank yet" />
            ) : (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="is-num">Entries</th>
                    <th scope="col" className="is-num">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {topConsumedItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="inv-cell-primary">{item.name}</div>
                        <div className="inv-cell-secondary">
                          <TypeBadge itemType={item.itemType} />
                        </div>
                      </td>
                      <td className="is-num">{item.movementCount}</td>
                      <td className="is-num font-semibold text-[var(--inv-text)]">
                        {formatQty(item.quantity)} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {activeReportSubTab === 'PURCHASING' && (
        <div className="space-y-5">
          <div className="inv-stats">
            <Metric label="Total spend" value={formatPeso(totalPurchasesSpend)} note="Excludes cancelled orders" />
            <Metric label="Food" value={formatPeso(totalFoodSpend)} note="Food ingredient lines" />
            <Metric label="Packaging" value={formatPeso(totalPackagingSpend)} note="Packaging lines" />
            <Metric label="Pending orders" value={String(pendingOrdersCount)} note="Awaiting delivery" />
          </div>
          <Card>
            <CardHeader title="Spend by supplier" description={`Orders placed over ${period}`} />
            {supplierPurchaseSummary.length === 0 ? (
              <EmptyState compact icon="cart" title="No purchase orders in this period" />
            ) : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th scope="col">Supplier</th>
                      <th scope="col" className="is-num">Orders</th>
                      <th scope="col" className="is-num">Order value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierPurchaseSummary.map((supplier) => (
                      <tr key={supplier.supplierName}>
                        <td className="inv-cell-primary">{supplier.supplierName}</td>
                        <td className="is-num">{supplier.orders}</td>
                        <td className="is-num font-semibold text-[var(--inv-text)]">{formatPeso(supplier.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeReportSubTab === 'WASTE' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric
              label={
                reportTypeFilter === 'PACKAGING'
                  ? 'Packaging loss'
                  : reportTypeFilter === 'FOOD'
                  ? 'Food waste loss'
                  : 'Waste and shrinkage loss'
              }
              value={formatPeso(totalWasteLoss)}
              note="Estimated from unit cost"
              tone={totalWasteLoss > 0 ? 'danger' : undefined}
            />
            <Metric
              label="Loss ratio"
              value={selectedValuation > 0 ? `${((totalWasteLoss / selectedValuation) * 100).toFixed(1)}%` : '0.0%'}
              note="Waste value vs. current stock value"
            />
          </div>
          <Card>
            <CardHeader title="Waste by reason" description="Reasons recorded with waste entries" />
            {wasteBreakdown.length === 0 ? (
              <EmptyState compact icon="checkCircle" title="No waste recorded in this period" />
            ) : (
              <div className="inv-table-wrap">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th scope="col">Reason</th>
                      <th scope="col">Type</th>
                      <th scope="col" className="is-num">Entries</th>
                      <th scope="col" className="is-num">Est. value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wasteBreakdown.map((item) => (
                      <tr key={`${item.itemType}:${item.reason}`}>
                        <td className="max-w-[360px] text-[var(--inv-text)]">{item.reason}</td>
                        <td>
                          <TypeBadge itemType={item.itemType} />
                        </td>
                        <td className="is-num">{item.count}</td>
                        <td className="is-num font-semibold text-[var(--inv-text)]">{formatPeso(item.loss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeReportSubTab === 'VALUATION' && (
        <div className="space-y-5">
          <div className="inv-stats">
            <Metric label="Total stock value" value={formatPeso(totalValuation)} note="Caloocan Flagship Hub" />
            <Metric label="Food" value={formatPeso(foodValuation)} note={`${foodItems.length} items`} />
            <Metric label="Packaging" value={formatPeso(packagingValuation)} note={`${packagingItems.length} items`} />
            <Metric label="To reorder" value={String(reorderItems.length)} note="At or below minimum" />
          </div>
          <Card>
            <CardHeader title="Reorder list" description="Lowest relative to minimum first" />
            {reorderItems.length === 0 ? (
              <EmptyState compact icon="checkCircle" title="Nothing needs reordering" description="All items are above their minimum levels." />
            ) : (
              <div className="inv-table-wrap max-h-[480px] overflow-y-auto">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" className="is-num">On hand</th>
                      <th scope="col" className="is-num hidden sm:table-cell">Minimum</th>
                      <th scope="col" className="is-num hidden md:table-cell">Suggested order</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="inv-cell-primary">{item.name}</div>
                          <div className="inv-cell-secondary">
                            <TypeBadge itemType={item.itemType} />
                          </div>
                        </td>
                        <td className="is-num font-semibold text-[var(--inv-text)]">
                          {formatQty(item.currentStock)} {item.baseUnit}
                        </td>
                        <td className="is-num hidden sm:table-cell">
                          {formatQty(item.minStockLevel)} {item.baseUnit}
                        </td>
                        <td className="is-num hidden md:table-cell">
                          {formatQty(item.preferredRestockQty)} {item.baseUnit}
                        </td>
                        <td>
                          <StockStatusBadge status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default InventoryReportsTab

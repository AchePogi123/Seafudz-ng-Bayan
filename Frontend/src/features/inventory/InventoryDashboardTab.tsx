import React, { useState, useMemo } from 'react'
import type { Ingredient, PurchaseOrder, StockTransaction, InventoryItemType } from './inventoryTypes'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Icon,
  MOVEMENT_TONE,
  Segmented,
  StockMeter,
  StockStatusBadge,
  TypeBadge,
  cx,
  formatDate,
  formatPeso,
  formatQty,
  movementLabel,
  type IconName,
} from './ui'

interface InventoryDashboardTabProps {
  ingredients: Ingredient[]
  purchaseOrders: PurchaseOrder[]
  transactions: StockTransaction[]
  onNavigateTab: (tabId: string, params?: Record<string, string>) => void
  onOpenAddIngredient: (defaultType?: InventoryItemType) => void
  onOpenCreatePO: () => void
}

const ATTENTION_LIMIT = 8

export const InventoryDashboardTab: React.FC<InventoryDashboardTabProps> = ({
  ingredients,
  purchaseOrders,
  transactions,
  onNavigateTab,
  onOpenAddIngredient,
  onOpenCreatePO,
}) => {
  const [alertTypeFilter, setAlertTypeFilter] = useState<'ALL' | InventoryItemType>('ALL')

  const summary = useMemo(() => {
    const food = ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD')
    const pkg = ingredients.filter((i) => i.itemType === 'PACKAGING')
    const foodValuation = food.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0)
    const packagingValuation = pkg.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0)
    return {
      total: ingredients.length,
      food: food.length,
      packaging: pkg.length,
      inStock: ingredients.filter((i) => i.status === 'IN_STOCK').length,
      low: ingredients.filter((i) => i.status === 'LOW_STOCK').length,
      out: ingredients.filter((i) => i.status === 'OUT_OF_STOCK').length,
      pendingPOs: purchaseOrders.filter((po) => po.status === 'PENDING').length,
      foodValuation,
      packagingValuation,
      totalValuation: foodValuation + packagingValuation,
    }
  }, [ingredients, purchaseOrders])

  // Out of stock first, then the lowest relative to minimum
  const attentionItems = useMemo(
    () =>
      ingredients
        .filter((i) => i.status === 'LOW_STOCK' || i.status === 'OUT_OF_STOCK')
        .filter((i) => alertTypeFilter === 'ALL' || (i.itemType || 'FOOD') === alertTypeFilter)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'OUT_OF_STOCK' ? -1 : 1
          const ra = a.minStockLevel > 0 ? a.currentStock / a.minStockLevel : 1
          const rb = b.minStockLevel > 0 ? b.currentStock / b.minStockLevel : 1
          return ra - rb
        }),
    [ingredients, alertTypeFilter]
  )

  const attentionTotal = summary.low + summary.out

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6),
    [transactions]
  )

  const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 100) : 0)

  const stats: Array<{
    label: string
    value: number
    note: string
    icon: IconName
    tone?: 'success' | 'warning' | 'danger'
    status?: string
  }> = [
    {
      label: 'Total items',
      value: summary.total,
      note: `${summary.food} food · ${summary.packaging} packaging`,
      icon: 'layers',
    },
    {
      label: 'In stock',
      value: summary.inStock,
      note: summary.total > 0 ? `${pct(summary.inStock)}% of catalog` : 'No items yet',
      icon: 'checkCircle',
      tone: 'success',
      status: 'IN_STOCK',
    },
    {
      label: 'Low stock',
      value: summary.low,
      note: 'At or below minimum level',
      icon: 'alert',
      tone: 'warning',
      status: 'LOW_STOCK',
    },
    {
      label: 'Out of stock',
      value: summary.out,
      note: summary.out > 0 ? 'Restock needed' : 'Nothing depleted',
      icon: 'alertCircle',
      tone: 'danger',
      status: 'OUT_OF_STOCK',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="inv-stats">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            className={cx('inv-stat', s.tone && `inv-stat--${s.tone}`, s.value > 0 && 'is-active')}
            onClick={() => onNavigateTab('ingredients', s.status ? { status: s.status } : undefined)}
            aria-label={`${s.label}: ${s.value}. View items`}
          >
            <span className="inv-stat-top">
              <span className="inv-stat-label">{s.label}</span>
              <span className="inv-stat-icon">
                <Icon name={s.icon} className="h-4 w-4" />
              </span>
            </span>
            <span className="inv-stat-value">{s.value}</span>
            <span className="inv-stat-note">{s.note}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Needs attention */}
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader
            id="inv-attention-title"
            title="Needs attention"
            description={
              attentionTotal > 0
                ? `${attentionTotal} ${attentionTotal === 1 ? 'item is' : 'items are'} at or below the minimum level`
                : 'Items that drop to their minimum level appear here'
            }
            actions={
              attentionTotal > 0 && (
                <Segmented
                  size="sm"
                  label="Filter by item type"
                  value={alertTypeFilter}
                  onChange={setAlertTypeFilter}
                  options={[
                    { value: 'ALL', label: 'All' },
                    { value: 'FOOD', label: 'Food' },
                    { value: 'PACKAGING', label: 'Packaging' },
                  ]}
                />
              )
            }
          />

          {attentionItems.length === 0 ? (
            ingredients.length === 0 ? (
              <EmptyState
                icon="box"
                title="Your catalog is empty"
                description="Add food ingredients or packaging to start tracking quantities and minimum stock levels."
                action={
                  <>
                    <Button variant="primary" icon="arrowRight" onClick={() => onOpenAddIngredient('FOOD')}>
                      Go to Items
                    </Button>
                  </>
                }
              />
            ) : (
              <EmptyState
                icon="checkCircle"
                title={attentionTotal === 0 ? 'Everything is stocked' : 'Nothing to show for this filter'}
                description={
                  attentionTotal === 0
                    ? 'All items are above their minimum stock levels.'
                    : `No ${alertTypeFilter === 'FOOD' ? 'food ingredients' : 'packaging materials'} need attention right now.`
                }
              />
            )
          ) : (
            <div className="inv-table-wrap max-h-[420px] overflow-y-auto">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="is-num">On hand</th>
                    <th scope="col" className="hidden md:table-cell">Level</th>
                    <th scope="col" className="is-num hidden sm:table-cell">Minimum</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attentionItems.slice(0, ATTENTION_LIMIT).map((item) => (
                    <tr key={item.id} className={item.status === 'OUT_OF_STOCK' ? 'is-critical' : 'is-attention'}>
                      <td>
                        <div className="inv-cell-primary">{item.name}</div>
                        <div className="inv-cell-secondary flex items-center gap-2">
                          <TypeBadge itemType={item.itemType} />
                          <span className="truncate">{item.category}</span>
                        </div>
                      </td>
                      <td className="is-num">
                        <span className="font-semibold text-[var(--inv-text)]">{formatQty(item.currentStock)}</span>{' '}
                        <span className="text-[var(--inv-text-3)]">{item.baseUnit}</span>
                      </td>
                      <td className="hidden md:table-cell">
                        <StockMeter
                          current={item.currentStock}
                          min={item.minStockLevel}
                          unit={item.baseUnit}
                          status={item.status}
                        />
                      </td>
                      <td className="is-num hidden sm:table-cell">
                        {formatQty(item.minStockLevel)} {item.baseUnit}
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

          {attentionTotal > 0 && (
            <div className="inv-card-footer mt-auto">
              <button
                type="button"
                className="inv-link"
                onClick={() => onNavigateTab('ingredients', { status: 'LOW_STOCK' })}
              >
                {attentionItems.length > ATTENTION_LIMIT
                  ? `View all ${attentionItems.length} items`
                  : 'Open in Items'}
                <Icon name="arrowRight" className="h-3.5 w-3.5" />
              </button>
              <Button variant="secondary" size="sm" icon="cart" onClick={onOpenCreatePO}>
                Create purchase order
              </Button>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          {/* Stock health */}
          <Card>
            <CardHeader title="Stock health" description="Share of catalog by stock status" />
            <div className="inv-card-body space-y-4">
              {summary.total > 0 ? (
                <>
                  <div
                    className="inv-health-bar"
                    role="img"
                    aria-label={`${summary.inStock} in stock, ${summary.low} low, ${summary.out} out of stock`}
                  >
                    {summary.inStock > 0 && <span className="inv-health-seg is-ok" style={{ flexGrow: summary.inStock }} />}
                    {summary.low > 0 && <span className="inv-health-seg is-low" style={{ flexGrow: summary.low }} />}
                    {summary.out > 0 && <span className="inv-health-seg is-out" style={{ flexGrow: summary.out }} />}
                  </div>
                  <ul className="space-y-2 text-sm">
                    {[
                      { label: 'In stock', n: summary.inStock, color: 'var(--inv-success-fill)' },
                      { label: 'Low stock', n: summary.low, color: 'var(--inv-warning-fill)' },
                      { label: 'Out of stock', n: summary.out, color: 'var(--inv-danger-fill)' },
                    ].map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[var(--inv-text-2)]">
                          <span className="inv-legend-dot" style={{ background: row.color }} aria-hidden="true" />
                          {row.label}
                        </span>
                        <span className="text-[var(--inv-text-3)]">
                          <b className="font-semibold text-[var(--inv-text)]">{row.n}</b> · {pct(row.n)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[var(--inv-text-3)]">No items tracked yet.</p>
              )}
              <dl className="space-y-1.5 border-t border-[var(--inv-border)] pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--inv-text-3)]">Stock value</dt>
                  <dd className="font-semibold text-[var(--inv-text)]">{formatPeso(summary.totalValuation, 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--inv-text-3)]">Food</dt>
                  <dd className="text-[var(--inv-text-2)]">{formatPeso(summary.foodValuation, 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--inv-text-3)]">Packaging</dt>
                  <dd className="text-[var(--inv-text-2)]">{formatPeso(summary.packagingValuation, 0)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          {/* Shortcuts */}
          <Card>
            <CardHeader title="Shortcuts" />
            <div className="grid gap-1 p-2">
              {(
                [
                  { label: 'Items and restocking', icon: 'box', onClick: () => onOpenAddIngredient('FOOD') },
                  {
                    label: 'Purchase orders',
                    icon: 'cart',
                    onClick: onOpenCreatePO,
                    meta: summary.pendingPOs > 0 ? `${summary.pendingPOs} pending` : undefined,
                  },
                  { label: 'Recipes', icon: 'book', onClick: () => onNavigateTab('recipes') },
                  { label: 'Stock history', icon: 'history', onClick: () => onNavigateTab('history') },
                ] as Array<{ label: string; icon: IconName; onClick: () => void; meta?: string }>
              ).map((a) => (
                <button key={a.label} type="button" onClick={a.onClick} className="inv-cat">
                  <span className="flex items-center gap-3">
                    <Icon name={a.icon} className="h-4 w-4 text-[var(--inv-text-3)]" />
                    {a.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {a.meta && <Badge tone="warning">{a.meta}</Badge>}
                    <Icon name="chevronRight" className="h-4 w-4 text-[var(--inv-text-3)]" />
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader
          title="Recent activity"
          description="Latest receipts, usage and adjustments"
          actions={
            <button type="button" className="inv-link" onClick={() => onNavigateTab('history')}>
              View all
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </button>
          }
        />
        {recentTransactions.length === 0 ? (
          <EmptyState
            compact
            icon="history"
            title="No stock movements yet"
            description="Restocks, usage and adjustments will be listed here as they are recorded."
          />
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="is-num">Change</th>
                  <th scope="col" className="is-num hidden sm:table-cell">Balance</th>
                  <th scope="col" className="hidden md:table-cell">When</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div className="inv-cell-primary">{tx.ingredientName}</div>
                      <div className="inv-cell-secondary">{tx.performedBy}</div>
                    </td>
                    <td>
                      <Badge tone={MOVEMENT_TONE[tx.type] ?? 'neutral'}>{movementLabel(tx.type)}</Badge>
                    </td>
                    <td className="is-num">
                      <span
                        className={cx(
                          'font-semibold',
                          tx.quantityDelta > 0 ? 'text-[var(--inv-success)]' : 'text-[var(--inv-text)]'
                        )}
                      >
                        {tx.quantityDelta > 0 ? '+' : '−'}
                        {formatQty(Math.abs(tx.quantityDelta))} {tx.unit}
                      </span>
                    </td>
                    <td className="is-num hidden sm:table-cell">
                      {formatQty(tx.stockAfter)} {tx.unit}
                    </td>
                    <td className="hidden whitespace-nowrap md:table-cell">{formatDate(tx.timestamp, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default InventoryDashboardTab

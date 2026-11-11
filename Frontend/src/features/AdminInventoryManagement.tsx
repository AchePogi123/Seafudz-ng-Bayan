import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import NavbarAdmin from '../components/NavbarAdmin'
import type {
  Ingredient,
  ProductRecipe,
  Supplier,
  PurchaseOrder,
  StockTransaction,
  MeasurementUnit,
  TransactionType,
} from './inventory/inventoryTypes'
import InventoryConfirmModal from './inventory/InventoryConfirmModal'
import { Icon, Button, TabSkeleton, Notice } from './inventory/ui'
import InventoryToast, { type ToastMessage } from './inventory/InventoryToast'
import {
  ACTUAL_INGREDIENTS,
  ACTUAL_RECIPES,
  ACTUAL_SUPPLIERS,
  loadStoredIngredients,
  loadStoredRecipes,
  loadStoredSuppliers,
  loadStoredTransactions,
  clearStoredInventory,
} from './inventory/actualInventoryData'
import { inventoryApi } from './inventory/inventoryApi'
import { subscribeOrderSync } from '../utils/orderSync'
import './inventory/admin-inventory.css'

// Each section loads on demand; the skeleton covers the first fetch of its chunk.
const InventoryDashboardTab = lazy(() => import('./inventory/InventoryDashboardTab'))
const IngredientsTab = lazy(() => import('./inventory/IngredientsTab'))
const RecipesBOMTab = lazy(() => import('./inventory/RecipesBOMTab'))
const SuppliersTab = lazy(() => import('./inventory/SuppliersTab'))
const PurchasesReceivingTab = lazy(() => import('./inventory/PurchasesReceivingTab'))
const StockHistoryTab = lazy(() => import('./inventory/StockHistoryTab'))
const InventoryReportsTab = lazy(() => import('./inventory/InventoryReportsTab'))

const INVENTORY_TABS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'ingredients', label: 'Items' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'purchases', label: 'Purchasing' },
  { id: 'history', label: 'Stock History' },
  { id: 'reports', label: 'Reports' },
] as const

type InventoryTabId = (typeof INVENTORY_TABS)[number]['id']

/** True when this browser still holds inventory edits from before the server took over. */
function findLegacyBrowserInventory() {
  try {
    const ingredients = loadStoredIngredients()
    const baseline = new Map(ACTUAL_INGREDIENTS.map((i) => [i.id, i]))
    const edited =
      ingredients.length !== baseline.size ||
      ingredients.some((i) => {
        const b = baseline.get(i.id)
        return !b || b.currentStock !== i.currentStock || b.minStockLevel !== i.minStockLevel || b.costPerUnit !== i.costPerUnit || b.name !== i.name
      }) ||
      loadStoredSuppliers().length !== ACTUAL_SUPPLIERS.length ||
      loadStoredRecipes().length !== ACTUAL_RECIPES.length ||
      loadStoredTransactions().length > 0
    return edited
  } catch {
    return false
  }
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

export const AdminInventoryManagement: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Active Tab: dashboard, ingredients, recipes, suppliers, purchases, history, reports
  const requestedTab = searchParams.get('tab')
  const currentTab: InventoryTabId = INVENTORY_TABS.some((t) => t.id === requestedTab)
    ? (requestedTab as InventoryTabId)
    : 'dashboard'

  // Inventory lives on the server so every screen (customer, POS, kitchen) sees the same stock
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<ProductRecipe[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadErrorText, setLoadErrorText] = useState('')
  const [legacyData, setLegacyData] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const loadedOnce = useRef(false)

  // Toast Notification System
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    // keep the stack short so notices never cover the work area
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const applyState = useCallback((state: Awaited<ReturnType<typeof inventoryApi.getState>>) => {
    setIngredients(state.ingredients)
    setRecipes(state.recipes)
    setSuppliers(state.suppliers)
    setPurchaseOrders(state.purchaseOrders)
    setTransactions(state.transactions)
  }, [])

  const loadInventory = useCallback(
    async (silent = false) => {
      if (!silent) setLoadState('loading')
      try {
        applyState(await inventoryApi.getState())
        setLoadState('ready')
        if (!loadedOnce.current) {
          loadedOnce.current = true
          setLegacyData(findLegacyBrowserInventory())
        }
      } catch (err) {
        // a failed background refresh must not wipe a screen that already works
        if (!silent || !loadedOnce.current) {
          setLoadErrorText(errorMessage(err, 'Could not load inventory.'))
          setLoadState('error')
        }
      }
    },
    [applyState]
  )

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  // Orders placed or cancelled elsewhere change stock: pick that up without a manual refresh
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = subscribeOrderSync(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void loadInventory(true), 1200)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [loadInventory])

  // Handle Tab Switch
  const handleTabChange = (tabId: string, params?: Record<string, string>) => {
    setSearchParams({ tab: tabId, ...params })
  }
  const statusParam = searchParams.get('status') || undefined

  // Snap to the canonical tab when the URL carries an unknown ?tab= value
  useEffect(() => {
    if (requestedTab && requestedTab !== currentTab) {
      setSearchParams({ tab: currentTab }, { replace: true })
    }
  }, [requestedTab, currentTab, setSearchParams])

  const fail = (title: string, err: unknown) =>
    addToast({ type: 'error', title, description: errorMessage(err, 'Something went wrong. Please try again.') })

  // Reload baseline (official catalog + recipes)
  const [isBaselineConfirmOpen, setIsBaselineConfirmOpen] = useState(false)
  const handleRestoreActualBaseline = async () => {
    setIsBaselineConfirmOpen(false)
    try {
      applyState(
        await inventoryApi.replaceAll({
          ingredients: ACTUAL_INGREDIENTS,
          recipes: ACTUAL_RECIPES,
          suppliers: ACTUAL_SUPPLIERS,
        })
      )
      addToast({
        type: 'success',
        title: 'Baseline data restored',
        description: `${ACTUAL_RECIPES.length} menu recipes, ${ACTUAL_INGREDIENTS.length} ingredients and packaging items, and standard units reloaded from official specification.`,
      })
    } catch (err) {
      fail('Could not reload the baseline', err)
    }
  }

  // One-time move of edits that only existed in this browser
  const handleImportLegacy = async () => {
    setIsImporting(true)
    try {
      applyState(
        await inventoryApi.replaceAll({
          ingredients: loadStoredIngredients(),
          recipes: loadStoredRecipes(),
          suppliers: loadStoredSuppliers(),
        })
      )
      clearStoredInventory()
      setLegacyData(false)
      addToast({ type: 'success', title: 'Browser inventory saved to the server' })
    } catch (err) {
      fail('Could not import this browser’s inventory', err)
    } finally {
      setIsImporting(false)
    }
  }

  const handleDiscardLegacy = () => {
    clearStoredInventory()
    setLegacyData(false)
  }

  // --- Handlers: Ingredients & Packaging ---
  const upsertIngredient = (ing: Ingredient) =>
    setIngredients((prev) => (prev.some((i) => i.id === ing.id) ? prev.map((i) => (i.id === ing.id ? ing : i)) : [ing, ...prev]))
  const prependTransactions = (txs: (StockTransaction | null | undefined)[]) => {
    const list = txs.filter(Boolean) as StockTransaction[]
    if (list.length > 0) setTransactions((prev) => [...list, ...prev])
  }

  const handleAddIngredient = async (item: Omit<Ingredient, 'id' | 'updatedAt' | 'status'>) => {
    try {
      const { ingredient, transaction } = await inventoryApi.createIngredient(item)
      upsertIngredient(ingredient)
      prependTransactions([transaction])
      addToast({
        type: 'success',
        title: item.itemType === 'PACKAGING' ? 'Packaging Material Registered' : 'Ingredient Registered',
        description: `"${item.name}" has been added to the catalog.`,
      })
    } catch (err) {
      fail('Could not add the item', err)
    }
  }

  const handleEditIngredient = async (updated: Ingredient) => {
    try {
      const { ingredient, transaction } = await inventoryApi.updateIngredient(updated)
      upsertIngredient(ingredient)
      prependTransactions([transaction])
      addToast({
        type: 'success',
        title: updated.itemType === 'PACKAGING' ? 'Packaging Material Updated' : 'Ingredient Updated',
        description: `Changes to "${updated.name}" have been saved.`,
      })
    } catch (err) {
      fail('Could not save changes', err)
    }
  }

  const handleDeleteIngredient = async (id: string) => {
    const target = ingredients.find((i) => i.id === id)
    try {
      await inventoryApi.deleteIngredient(id)
      setIngredients((prev) => prev.filter((item) => item.id !== id))
      setTransactions((prev) => prev.filter((t) => t.ingredientId !== id))
      addToast({
        type: 'info',
        title: 'Item Removed',
        description: target ? `"${target.name}" was deleted from the catalog.` : 'Item deleted.',
      })
    } catch (err) {
      fail('Could not delete the item', err)
    }
  }

  const handleAdjustStock = async (
    id: string,
    delta: number,
    reason: string,
    details?: { seller?: string; purchaseDate?: string; movementType?: TransactionType }
  ) => {
    try {
      const { ingredient, transaction } = await inventoryApi.recordMovement({
        ingredientId: id,
        delta,
        type: details?.movementType,
        reason,
        seller: details?.seller,
        purchaseDate: details?.purchaseDate,
      })
      upsertIngredient(ingredient)
      prependTransactions([transaction])
      addToast({
        type: 'success',
        title: delta > 0 ? 'Stock Intake Recorded' : 'Stock Adjusted',
        description:
          delta > 0
            ? `Added +${delta.toLocaleString()} ${ingredient.baseUnit} to ${ingredient.name}.`
            : `Deducted ${Math.abs(delta).toLocaleString()} ${ingredient.baseUnit} from ${ingredient.name}.`,
      })
    } catch (err) {
      fail('Could not update stock', err)
    }
  }

  // --- Handlers: Recipes ---
  const handleSaveRecipe = async (recipe: ProductRecipe) => {
    try {
      const saved = await inventoryApi.saveRecipe(recipe)
      setRecipes((prev) => [saved, ...prev.filter((r) => r.productId !== saved.productId)])
      addToast({
        type: 'success',
        title: 'Recipe (BOM) Saved',
        description: `Food portions and packaging requirements configured for "${recipe.productName}".`,
      })
    } catch (err) {
      fail('Could not save the recipe', err)
    }
  }

  const handleDeleteRecipe = async (productId: string) => {
    try {
      await inventoryApi.deleteRecipe(productId)
      setRecipes((prev) => prev.filter((r) => r.productId !== productId))
      addToast({
        type: 'info',
        title: 'Recipe Configuration Cleared',
        description: 'Raw consumption tracking unlinked for this menu item.',
      })
    } catch (err) {
      fail('Could not remove the recipe', err)
    }
  }

  // --- Handlers: Suppliers ---
  const handleAddSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
    try {
      const created = await inventoryApi.createSupplier(supplier)
      setSuppliers((prev) => [created, ...prev])
      addToast({
        type: 'success',
        title: 'Supplier Registered',
        description: `"${supplier.name}" added to authorized vendor list.`,
      })
    } catch (err) {
      fail('Could not add the supplier', err)
    }
  }

  const handleEditSupplier = async (supplier: Supplier) => {
    try {
      const saved = await inventoryApi.updateSupplier(supplier)
      setSuppliers((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      addToast({
        type: 'success',
        title: 'Supplier Updated',
        description: `Contact and delivery details for "${supplier.name}" saved.`,
      })
    } catch (err) {
      fail('Could not save the supplier', err)
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    const target = suppliers.find((s) => s.id === id)
    try {
      await inventoryApi.deleteSupplier(id)
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
      addToast({
        type: 'info',
        title: 'Supplier Removed',
        description: target ? `"${target.name}" removed from vendor directory.` : 'Supplier deleted.',
      })
    } catch (err) {
      fail('Could not delete the supplier', err)
    }
  }

  // --- Handlers: Purchases & Receiving ---
  const handleCreatePO = async (po: Omit<PurchaseOrder, 'id' | 'createdAt'>) => {
    try {
      const created = await inventoryApi.createPurchaseOrder(po)
      setPurchaseOrders((prev) => [created, ...prev])
      addToast({
        type: 'success',
        title: 'Purchase Order Created',
        description: `${created.poNumber} has been submitted with total value ₱${created.totalAmount.toFixed(2)}.`,
      })
    } catch (err) {
      fail('Could not create the purchase order', err)
    }
  }

  const handleReceiveStock = async (
    poId: string,
    receivedItems: {
      itemId: string
      ingredientId: string
      receivedQty: number
      unit: MeasurementUnit
      batchNumber?: string
      expirationDate?: string
    }[],
    _isFullyReceived: boolean,
    notes?: string
  ) => {
    try {
      const result = await inventoryApi.receivePurchaseOrder(poId, { items: receivedItems, notes })
      setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? result.purchaseOrder : p)))
      result.ingredients.forEach(upsertIngredient)
      prependTransactions([...result.transactions].reverse())
      addToast({
        type: 'success',
        title: 'Inbound Stock Intake Confirmed',
        description: 'Delivered items successfully received and added to physical inventory balance.',
      })
    } catch (err) {
      fail('Could not receive the delivery', err)
    }
  }

  const handleCancelPO = async (poId: string) => {
    try {
      const cancelled = await inventoryApi.cancelPurchaseOrder(poId)
      setPurchaseOrders((prev) => prev.map((po) => (po.id === poId ? cancelled : po)))
      addToast({
        type: 'info',
        title: 'Purchase Order Cancelled',
        description: 'Order marked as cancelled. No inventory was updated.',
      })
    } catch (err) {
      fail('Could not cancel the order', err)
    }
  }

  // --- Handlers: Stock History & Audit ---
  const handleAddTransaction = async (
    tx: Omit<StockTransaction, 'id' | 'timestamp' | 'referenceNo' | 'stockAfter'>
  ) => {
    try {
      const { ingredient, transaction } = await inventoryApi.recordMovement({
        ingredientId: tx.ingredientId,
        delta: tx.quantityDelta,
        type: tx.type,
        reason: tx.reason,
      })
      upsertIngredient(ingredient)
      prependTransactions([transaction])
      addToast({
        type: 'success',
        title: 'Stock Movement Logged',
        description: `${tx.type.replace(/_/g, ' ').toLowerCase()} of ${Math.abs(tx.quantityDelta)} ${tx.unit} committed to ledger.`,
      })
    } catch (err) {
      fail('Could not record the movement', err)
    }
  }

  // --- Handlers: Reports ---
  const handleExportReport = (type: 'EXCEL' | 'PDF') => {
    addToast({
      type: 'success',
      title: `${type === 'EXCEL' ? 'Excel Spreadsheet' : 'PDF Document'} Generated`,
      description: 'Inventory audit export compiled successfully for download.',
    })
  }

  const lowCount = ingredients.filter((i) => i.status === 'LOW_STOCK').length
  const outCount = ingredients.filter((i) => i.status === 'OUT_OF_STOCK').length
  const pendingPOs = purchaseOrders.filter((po) => po.status === 'PENDING').length

  const tabCounts: Partial<Record<InventoryTabId, number>> = {
    ingredients: lowCount + outCount,
    purchases: pendingPOs,
  }
  const tabCountLabel: Partial<Record<InventoryTabId, string>> = {
    ingredients: 'need attention',
    purchases: 'pending',
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-800 pb-16 font-sans">
      <div className="px-4 sm:px-6 lg:px-10 pt-4 sm:pt-5 print:hidden">
        <NavbarAdmin />
      </div>

      <main className="admin-inventory-workspace mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10 pt-6 space-y-6">
        <header className="space-y-5">
          <button type="button" onClick={() => navigate('/admin-dashboard')} className="inv-back cursor-pointer">
            <Icon name="arrowLeft" className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="inv-page-header">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="inv-page-title">Inventory</h1>
                <span className="inv-location">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Caloocan Flagship Hub
                </span>
              </div>
              <p className="inv-page-sub">
                {loadState === 'ready' ? `${ingredients.length} items tracked · ${recipes.length} recipes configured` : 'Loading inventory…'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={() => setIsBaselineConfirmOpen(true)}
              title="Reset inventory catalog and recipes to the official baseline"
            >
              Reload baseline
            </Button>
          </div>

          <nav className="inv-tabs no-scrollbar" aria-label="Inventory sections">
            {INVENTORY_TABS.map((tab) => {
              const isActive = currentTab === tab.id
              const count = tabCounts[tab.id]
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  id={`inventory-tab-${tab.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  className="inv-tab"
                >
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span className="inv-tab-count">
                      {count}
                      <span className="sr-only"> {tabCountLabel[tab.id]}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </header>

        <section
          key={currentTab}
          id="inventory-tab-panel"
          className="inv-panel-enter min-w-0 outline-none"
          aria-labelledby={`inventory-tab-${currentTab}`}
        >
          {legacyData && loadState === 'ready' && (
            <div className="mb-5">
              <Notice tone="warning">
                <p className="font-semibold">This browser has inventory saved from before the server took over.</p>
                <p className="mt-0.5 text-sm">
                  Save it to the server to replace the shared inventory with it, or discard it. Stock history from this browser can’t be moved.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" loading={isImporting} onClick={handleImportLegacy}>
                    Save to server
                  </Button>
                  <Button size="sm" variant="secondary" disabled={isImporting} onClick={handleDiscardLegacy}>
                    Discard
                  </Button>
                </div>
              </Notice>
            </div>
          )}

          {loadState === 'loading' && <TabSkeleton />}

          {loadState === 'error' && (
            <div className="inv-card">
              <div className="inv-empty">
                <div className="inv-empty-icon">
                  <Icon name="alertCircle" className="h-5 w-5" />
                </div>
                <p className="inv-empty-title">Inventory couldn’t be loaded</p>
                <p className="inv-empty-desc">{loadErrorText}</p>
                <div className="inv-empty-action">
                  <Button variant="primary" icon="refresh" onClick={() => void loadInventory()}>
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Suspense fallback={<TabSkeleton />}>
            {loadState === 'ready' && currentTab === 'dashboard' && (
              <InventoryDashboardTab
                ingredients={ingredients}
                purchaseOrders={purchaseOrders}
                transactions={transactions}
                onNavigateTab={handleTabChange}
                onOpenAddIngredient={() => handleTabChange('ingredients')}
                onOpenCreatePO={() => handleTabChange('purchases')}
              />
            )}

            {loadState === 'ready' && currentTab === 'ingredients' && (
              <IngredientsTab
                ingredients={ingredients}
                suppliers={suppliers}
                transactions={transactions}
                initialStatus={statusParam}
                onAddIngredient={handleAddIngredient}
                onEditIngredient={handleEditIngredient}
                onDeleteIngredient={handleDeleteIngredient}
                onAdjustStock={handleAdjustStock}
              />
            )}

            {loadState === 'ready' && currentTab === 'recipes' && (
              <RecipesBOMTab
                ingredients={ingredients}
                recipes={recipes}
                onSaveRecipe={handleSaveRecipe}
                onDeleteRecipe={handleDeleteRecipe}
              />
            )}

            {loadState === 'ready' && currentTab === 'suppliers' && (
              <SuppliersTab
                suppliers={suppliers}
                onAddSupplier={handleAddSupplier}
                onEditSupplier={handleEditSupplier}
                onDeleteSupplier={handleDeleteSupplier}
              />
            )}

            {loadState === 'ready' && currentTab === 'purchases' && (
              <PurchasesReceivingTab
                purchaseOrders={purchaseOrders}
                suppliers={suppliers}
                ingredients={ingredients}
                onCreatePO={handleCreatePO}
                onReceiveStock={handleReceiveStock}
                onCancelPO={handleCancelPO}
              />
            )}

            {loadState === 'ready' && currentTab === 'history' && (
              <StockHistoryTab
                transactions={transactions}
                ingredients={ingredients}
                onAddTransaction={handleAddTransaction}
              />
            )}

            {loadState === 'ready' && currentTab === 'reports' && (
              <InventoryReportsTab
                ingredients={ingredients}
                purchaseOrders={purchaseOrders}
                transactions={transactions}
                onExportReport={handleExportReport}
              />
            )}
          </Suspense>
        </section>
      </main>

      <InventoryConfirmModal
        isOpen={isBaselineConfirmOpen}
        title="Reload baseline data?"
        message="This resets every inventory item, recipe and supplier to the official baseline values. Changes you made here will be replaced. Stock history is kept."
        confirmText="Reload baseline"
        isDestructive
        onConfirm={handleRestoreActualBaseline}
        onCancel={() => setIsBaselineConfirmOpen(false)}
      />

      <InventoryToast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default AdminInventoryManagement

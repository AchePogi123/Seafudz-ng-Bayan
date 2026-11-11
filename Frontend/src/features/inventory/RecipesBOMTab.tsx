import React, { useState, useMemo } from 'react'
import type {
  Ingredient,
  ProductRecipe,
  RecipeIngredient,
  PackagingRequirement,
  MeasurementUnit,
  FulfillmentType,
  PackagingScope,
  PackagingCategory,
} from './inventoryTypes'
import { MEASUREMENT_UNITS } from './inventoryTypes'
import { CLIENT_MENU_ITEMS, type MenuItem } from '../../components/MenuCard'
import InventoryConfirmModal from './InventoryConfirmModal'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Notice,
  SearchInput,
  SectionHeader,
  Segmented,
  cx,
  formatQty,
  type BadgeTone,
} from './ui'

const servingsTone = (n: number): BadgeTone => (n > 20 ? 'success' : n > 0 ? 'warning' : 'danger')

interface RecipesBOMTabProps {
  ingredients: Ingredient[]
  recipes: ProductRecipe[]
  onSaveRecipe: (recipe: ProductRecipe) => void
  onDeleteRecipe: (productId: string) => void
}

export interface IngredientYieldDetail {
  ingredientId: string
  ingredientName: string
  portionQuantity: number
  portionUnit: string
  stockAvailable: number
  stockUnit: string
  servingsPossible: number
  isLimiting: boolean
  hasStock: boolean
}

export interface RecipeServingEstimate {
  totalEstimatedServings: number
  limitingIngredient: IngredientYieldDetail | null
  ingredientsDetail: IngredientYieldDetail[]
}

/**
 * Computes exact estimated servings by matching each recipe ingredient
 * against the real-time stock in the inventory catalog.
 * The bottleneck (lowest yield) determines the product's total servings.
 */
export function computeRecipeServingEstimate(
  recipeIngredients: RecipeIngredient[],
  catalogIngredients: Ingredient[]
): RecipeServingEstimate {
  if (!recipeIngredients || recipeIngredients.length === 0) {
    return {
      totalEstimatedServings: 0,
      limitingIngredient: null,
      ingredientsDetail: [],
    }
  }

  const details: IngredientYieldDetail[] = recipeIngredients.map((item) => {
    const inv = catalogIngredients.find(
      (ci) => ci.id === item.ingredientId || ci.name.trim().toLowerCase() === item.ingredientName.trim().toLowerCase()
    )

    const stock = inv ? Number(inv.currentStock) || 0 : 0
    const stockUnit = inv ? inv.baseUnit : item.unit
    const portion = Number(item.portionQuantity) || 0

    let convertedStock = stock
    if (inv && inv.baseUnit === 'kg' && item.unit === 'g') {
      convertedStock = stock * 1000
    } else if (inv && inv.baseUnit === 'g' && item.unit === 'kg') {
      convertedStock = stock / 1000
    }

    const possible = portion > 0 ? Math.floor(convertedStock / portion) : 0

    return {
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      portionQuantity: portion,
      portionUnit: item.unit,
      stockAvailable: stock,
      stockUnit,
      servingsPossible: Math.max(0, possible),
      isLimiting: false,
      hasStock: Boolean(inv && stock > 0),
    }
  })

  const minPossible = details.length > 0 ? Math.min(...details.map((d) => d.servingsPossible)) : 0
  const totalEstimatedServings = Math.max(0, minPossible)

  let limiting: IngredientYieldDetail | null = null
  details.forEach((d) => {
    if (d.servingsPossible === minPossible && !limiting) {
      d.isLimiting = true
      limiting = d
    }
  })

  return {
    totalEstimatedServings,
    limitingIngredient: limiting,
    ingredientsDetail: details,
  }
}

const FULFILLMENT_OPTIONS: { label: string; value: FulfillmentType }[] = [
  { label: 'Takeout & pickup', value: 'TAKEOUT' },
  { label: 'Delivery', value: 'DELIVERY' },
  { label: 'Takeout, delivery & pickup', value: 'ALL' },
  { label: 'Dine-in (special)', value: 'DINE_IN' },
]
const channelLabel = (v: FulfillmentType) => FULFILLMENT_OPTIONS.find((f) => f.value === v)?.label ?? v

export const RecipesBOMTab: React.FC<RecipesBOMTabProps> = ({
  ingredients,
  recipes,
  onSaveRecipe,
  onDeleteRecipe,
}) => {
  // Menu selection & filters
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductCategory, setSelectedProductCategory] = useState('ALL')
  const [selectedProductId, setSelectedProductId] = useState<string>(CLIENT_MENU_ITEMS[0]?.id || '')

  // Recipe Editor Draft State
  const [isEditing, setIsEditing] = useState(false)
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([])
  const [draftPackaging, setDraftPackaging] = useState<PackagingRequirement[]>([])
  const [draftInstructions, setDraftInstructions] = useState('')
  const [formError, setFormError] = useState('')
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [setupFilter, setSetupFilter] = useState<'ALL' | 'CONFIGURED' | 'MISSING'>('ALL')
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)

  // Separate Food and Packaging ingredients from inventory catalog
  const foodIngredients = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD'),
    [ingredients]
  )
  const packagingMaterials = useMemo(
    () => ingredients.filter((i) => i.itemType === 'PACKAGING'),
    [ingredients]
  )

  // Current active product
  const activeProduct = useMemo<MenuItem | undefined>(() => {
    return CLIENT_MENU_ITEMS.find((p) => p.id === selectedProductId)
  }, [selectedProductId])

  // Current active recipe
  const activeRecipe = useMemo<ProductRecipe | undefined>(() => {
    return recipes.find((r) => r.productId === selectedProductId)
  }, [recipes, selectedProductId])

  // Live estimated servings for the active configured recipe
  const activeServingEstimate = useMemo(() => {
    if (!activeRecipe?.ingredients?.length) return null
    return computeRecipeServingEstimate(activeRecipe.ingredients, ingredients)
  }, [activeRecipe, ingredients])

  // Live estimated servings for draft ingredients while editing
  const draftServingEstimate = useMemo(() => {
    if (!draftIngredients.length) return null
    return computeRecipeServingEstimate(draftIngredients, ingredients)
  }, [draftIngredients, ingredients])

  // Map of product ID -> estimated servings for the left sidebar
  const productServingsMap = useMemo(() => {
    const map: Record<string, number> = {}
    recipes.forEach((r) => {
      if (r.isConfigured && r.ingredients?.length) {
        const est = computeRecipeServingEstimate(r.ingredients, ingredients)
        map[r.productId] = est.totalEstimatedServings
      }
    })
    return map
  }, [recipes, ingredients])

  // Filter products for left sidebar
  const filteredProducts = useMemo(() => {
    return CLIENT_MENU_ITEMS.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        item.category.toLowerCase().includes(productSearch.toLowerCase())
      const matchesCat = selectedProductCategory === 'ALL' || item.category === selectedProductCategory
      const configured = recipes.some((r) => r.productId === item.id && r.isConfigured)
      const matchesSetup =
        setupFilter === 'ALL' || (setupFilter === 'CONFIGURED' ? configured : !configured)
      return matchesSearch && matchesCat && matchesSetup
    })
  }, [productSearch, selectedProductCategory, setupFilter, recipes])

  const configuredCount = useMemo(
    () => CLIENT_MENU_ITEMS.filter((p) => recipes.some((r) => r.productId === p.id && r.isConfigured)).length,
    [recipes]
  )

  const selectProduct = (id: string) => {
    if (id === selectedProductId) return
    if (isEditing) {
      setPendingProductId(id)
      return
    }
    setSelectedProductId(id)
  }

  // Categories list
  const productCategories = useMemo(() => {
    return Array.from(new Set(CLIENT_MENU_ITEMS.map((i) => i.category)))
  }, [])

  // Start configuring / editing
  const handleStartConfiguring = () => {
    if (activeRecipe) {
      setDraftIngredients(activeRecipe.ingredients.map((item) => ({ ...item })))
      setDraftPackaging((activeRecipe.packagingRequirements || []).map((item) => ({ ...item })))
      setDraftInstructions(activeRecipe.preparationInstructions || '')
    } else {
      const defaultFood = foodIngredients[0] || ingredients[0]
      setDraftIngredients(
        defaultFood
          ? [
              {
                ingredientId: defaultFood.id,
                ingredientName: defaultFood.name,
                portionQuantity: 100,
                unit: defaultFood.baseUnit,
                estimatedCost: defaultFood.costPerUnit ? defaultFood.costPerUnit * 100 : 0,
              },
            ]
          : []
      )

      // Initial packaging draft is blank as per clean state requirement
      setDraftPackaging([])
      setDraftInstructions('')
    }
    setFormError('')
    setIsEditing(true)
  }

  // --- Food Ingredient Handlers ---
  const handleAddIngredientRow = () => {
    const defaultIng = foodIngredients[0] || ingredients[0]
    setDraftIngredients((prev) => [
      ...prev,
      {
        ingredientId: defaultIng?.id || '',
        ingredientName: defaultIng?.name || 'Raw Ingredient',
        portionQuantity: 50,
        unit: defaultIng?.baseUnit || 'g',
        estimatedCost: defaultIng?.costPerUnit ? defaultIng.costPerUnit * 50 : 0,
      },
    ])
  }

  const handleRemoveIngredientRow = (index: number) => {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFoodRowChange = (
    index: number,
    field: keyof RecipeIngredient,
    value: string | number
  ) => {
    setDraftIngredients((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'ingredientId') {
        const ing = ingredients.find((i) => i.id === value)
        row.ingredientId = String(value)
        row.ingredientName = ing ? ing.name : 'Unknown Ingredient'
        row.unit = ing ? ing.baseUnit : 'g'
        row.estimatedCost = ing ? ing.costPerUnit * row.portionQuantity : 0
      } else if (field === 'portionQuantity') {
        const qty = Math.max(0, Number(value) || 0)
        row.portionQuantity = qty
        const ing = ingredients.find((i) => i.id === row.ingredientId)
        row.estimatedCost = ing ? ing.costPerUnit * qty : 0
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      }

      updated[index] = row
      return updated
    })
  }

  // --- Packaging Requirement Handlers ---
  const handleAddPackagingRow = () => {
    const defaultPkg = packagingMaterials[0]
    const newReq: PackagingRequirement = {
      id: `pkg-req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      packagingId: defaultPkg?.id || '',
      packagingName: defaultPkg?.name || 'Packaging Material',
      category: (defaultPkg?.category as PackagingCategory) || 'Trays, Bowls & Containers',
      quantity: 1,
      unit: defaultPkg?.baseUnit || 'pcs',
      fulfillmentType: 'TAKEOUT',
      scope: 'PER_ITEM',
      sharedCapacity: 1,
      estimatedCost: defaultPkg?.costPerUnit || 0,
    }
    setDraftPackaging((prev) => [...prev, newReq])
  }

  const handleRemovePackagingRow = (index: number) => {
    setDraftPackaging((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePackagingRowChange = (
    index: number,
    field: keyof PackagingRequirement,
    value: string | number
  ) => {
    setDraftPackaging((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'packagingId') {
        const pkg = ingredients.find((i) => i.id === value)
        row.packagingId = String(value)
        row.packagingName = pkg ? pkg.name : 'Packaging Material'
        row.category = (pkg?.category as PackagingCategory) || 'Trays, Bowls & Containers'
        row.unit = pkg ? pkg.baseUnit : 'pcs'
        const costPerUnit = pkg ? pkg.costPerUnit : 0
        const divisor = row.scope === 'SHARED_ORDER' && row.sharedCapacity ? row.sharedCapacity : 1
        row.estimatedCost = (costPerUnit * row.quantity) / Math.max(1, divisor)
      } else if (field === 'quantity') {
        const qty = Math.max(0.1, Number(value) || 1)
        row.quantity = qty
        const pkg = ingredients.find((i) => i.id === row.packagingId)
        const costPerUnit = pkg ? pkg.costPerUnit : 0
        const divisor = row.scope === 'SHARED_ORDER' && row.sharedCapacity ? row.sharedCapacity : 1
        row.estimatedCost = (costPerUnit * qty) / Math.max(1, divisor)
      } else if (field === 'fulfillmentType') {
        row.fulfillmentType = value as FulfillmentType
      } else if (field === 'scope') {
        row.scope = value as PackagingScope
        if (value === 'SHARED_ORDER' && !row.sharedCapacity) {
          row.sharedCapacity = 3 // default capacity e.g. 1 bag holds up to 3 items
        }
        const pkg = ingredients.find((i) => i.id === row.packagingId)
        const costPerUnit = pkg ? pkg.costPerUnit : 0
        const divisor = value === 'SHARED_ORDER' && row.sharedCapacity ? row.sharedCapacity : 1
        row.estimatedCost = (costPerUnit * row.quantity) / Math.max(1, divisor)
      } else if (field === 'sharedCapacity') {
        const cap = Math.max(1, Number(value) || 1)
        row.sharedCapacity = cap
        const pkg = ingredients.find((i) => i.id === row.packagingId)
        const costPerUnit = pkg ? pkg.costPerUnit : 0
        row.estimatedCost = (costPerUnit * row.quantity) / cap
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      } else if (field === 'notes') {
        row.notes = String(value)
      }

      updated[index] = row
      return updated
    })
  }

  // --- Financial Calculations ---
  const draftTotalFoodCost = useMemo(() => {
    return draftIngredients.reduce((sum, ing) => sum + (ing.estimatedCost || 0), 0)
  }, [draftIngredients])

  const draftTotalPackagingCost = useMemo(() => {
    return draftPackaging.reduce((sum, pkg) => sum + (pkg.estimatedCost || 0), 0)
  }, [draftPackaging])

  const draftTotalRawCost = useMemo(() => {
    return draftTotalFoodCost + draftTotalPackagingCost
  }, [draftTotalFoodCost, draftTotalPackagingCost])

  const draftMargin = useMemo(() => {
    if (!activeProduct || activeProduct.price <= 0) return 0
    const profit = activeProduct.price - draftTotalRawCost
    return Math.max(0, Math.round((profit / activeProduct.price) * 100))
  }, [activeProduct, draftTotalRawCost])

  // Save recipe
  const handleSaveRecipe = () => {
    if (!activeProduct) return
    if (draftIngredients.length === 0) {
      setFormError('Add at least one ingredient with its portion per serving.')
      return
    }
    if (draftIngredients.some((r) => !r.ingredientId)) {
      setFormError('Choose an ingredient on every line, or remove the empty line.')
      return
    }
    if (draftIngredients.some((r) => !(Number(r.portionQuantity) > 0))) {
      setFormError('Every ingredient needs a portion greater than 0.')
      return
    }
    if (draftPackaging.some((r) => !r.packagingId)) {
      setFormError('Choose a packaging item on every packaging line, or remove it.')
      return
    }

    const recipe: ProductRecipe = {
      productId: activeProduct.id,
      productName: activeProduct.name,
      productCategory: activeProduct.category,
      productPrice: activeProduct.price,
      productImage: activeProduct.image,
      yieldServings: 1,
      ingredients: draftIngredients,
      packagingRequirements: draftPackaging,
      preparationInstructions: draftInstructions.trim(),
      totalFoodCost: draftTotalFoodCost,
      totalPackagingCost: draftTotalPackagingCost,
      totalRawCost: draftTotalRawCost,
      grossMarginPercent: draftMargin,
      isConfigured: true,
      updatedAt: new Date().toISOString(),
    }

    onSaveRecipe(recipe)
    setIsEditing(false)
    setFormError('')
  }

  const estimate = isEditing ? draftServingEstimate : activeServingEstimate
  const foodLineCols = 'sm:grid-cols-[minmax(0,1fr)_112px_96px_32px]'
  const pkgLineCols = 'sm:grid-cols-[minmax(0,1fr)_88px_88px_minmax(0,170px)_minmax(0,150px)_32px]'

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Recipes"
        description="Ingredient portions and takeout packaging for each menu item. Used to estimate how many servings you can make."
        actions={
          <span className="text-sm text-[var(--inv-text-3)]">
            <b className="font-semibold text-[var(--inv-text)]">{configuredCount}</b> of {CLIENT_MENU_ITEMS.length} set up
          </span>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Menu items */}
        <Card className="flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="space-y-2.5 border-b border-[var(--inv-border)] p-3">
            <SearchInput label="Search menu items" placeholder="Search menu items" value={productSearch} onChange={setProductSearch} />
            <div className="flex gap-2">
              <select
                aria-label="Menu category"
                className="inv-select inv-select--sm flex-1"
                value={selectedProductCategory}
                onChange={(e) => setSelectedProductCategory(e.target.value)}
              >
                <option value="ALL">All categories</option>
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <Segmented
              size="sm"
              label="Recipe setup"
              value={setupFilter}
              onChange={setSetupFilter}
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'CONFIGURED', label: 'Set up' },
                { value: 'MISSING', label: 'Not set up' },
              ]}
            />
          </div>
          <div className="max-h-[420px] min-h-0 flex-1 overflow-y-auto p-2 lg:max-h-none">
            {filteredProducts.length === 0 ? (
              <EmptyState compact icon="search" title="No menu items match" />
            ) : (
              filteredProducts.map((p) => {
                const configured = recipes.some((r) => r.productId === p.id && r.isConfigured)
                const servings = productServingsMap[p.id]
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="inv-product"
                    aria-current={p.id === selectedProductId}
                    onClick={() => selectProduct(p.id)}
                  >
                    <img src={p.image} alt="" loading="lazy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--inv-text)]">{p.name}</span>
                      <span className="block truncate text-[13px] text-[var(--inv-text-3)]">
                        ₱{p.price.toFixed(2)} · {p.category}
                      </span>
                    </span>
                    {configured ? (
                      servings !== undefined ? (
                        <Badge tone={servingsTone(servings)} title={`About ${servings} servings can be made from current stock`}>
                          {servings} srv
                        </Badge>
                      ) : (
                        <Badge tone="success">Set up</Badge>
                      )
                    ) : (
                      <Badge>Not set up</Badge>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </Card>

        {/* Recipe */}
        <Card className="min-h-[480px]">
          {!activeProduct ? (
            <EmptyState icon="book" title="Choose a menu item" description="Select a dish on the left to view or set up its recipe." />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--inv-border)] p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <img
                    src={activeProduct.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl bg-[#f2f4f7] object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-[var(--inv-text)]">{activeProduct.name}</h3>
                    <p className="text-sm text-[var(--inv-text-3)]">
                      {activeProduct.category} · ₱{activeProduct.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    {activeRecipe?.isConfigured ? (
                      <>
                        <Button variant="primary" icon="edit" onClick={handleStartConfiguring}>
                          Edit recipe
                        </Button>
                        <IconButton
                          icon="trash"
                          tone="danger"
                          label="Remove recipe"
                          onClick={() => setIsConfirmDeleteOpen(true)}
                        />
                      </>
                    ) : (
                      <Button variant="primary" icon="plus" onClick={handleStartConfiguring}>
                        Set up recipe
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Yield summary */}
              {estimate && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--inv-border)] bg-[var(--inv-surface-2)] px-5 py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-[var(--inv-text-3)]">Can make about</span>
                    <Badge tone={servingsTone(estimate.totalEstimatedServings)}>
                      {estimate.totalEstimatedServings} {estimate.totalEstimatedServings === 1 ? 'serving' : 'servings'}
                    </Badge>
                  </span>
                  {estimate.limitingIngredient && (
                    <span className="text-[var(--inv-text-3)]">
                      Limited by <b className="font-medium text-[var(--inv-text)]">{estimate.limitingIngredient.ingredientName}</b>
                    </span>
                  )}
                </div>
              )}

              {isEditing ? (
                <div className="space-y-7 p-5">
                  {formError && <Notice tone="danger">{formError}</Notice>}

                  {/* Ingredients editor */}
                  <section aria-labelledby="rcp-ing-title">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h4 id="rcp-ing-title" className="text-[15px] font-semibold text-[var(--inv-text)]">
                          Ingredients per serving
                        </h4>
                        <p className="text-[13px] text-[var(--inv-text-3)]">How much of each ingredient one serving uses.</p>
                      </div>
                      <Button size="sm" variant="ghost" icon="plus" onClick={handleAddIngredientRow}>
                        Add ingredient
                      </Button>
                    </div>
                    {draftIngredients.length === 0 ? (
                      <EmptyState
                        compact
                        icon="box"
                        title="No ingredients yet"
                        action={
                          <Button size="sm" variant="secondary" icon="plus" onClick={handleAddIngredientRow}>
                            Add ingredient
                          </Button>
                        }
                      />
                    ) : (
                      <div className="inv-lines">
                        <div className={`inv-line-head ${foodLineCols}`}>
                          <span>Ingredient</span>
                          <span>Portion</span>
                          <span>Unit</span>
                          <span />
                        </div>
                        {draftIngredients.map((row, idx) => {
                          const detail = draftServingEstimate?.ingredientsDetail.find(
                            (d) => d.ingredientId === row.ingredientId || d.ingredientName === row.ingredientName
                          )
                          return (
                            <div key={idx} className={`inv-line grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] ${foodLineCols}`}>
                              <label className="col-span-3 sm:col-span-1">
                                <span className="inv-line-label">Ingredient</span>
                                <select
                                  className="inv-select inv-select--sm"
                                  value={row.ingredientId}
                                  onChange={(e) => handleFoodRowChange(idx, 'ingredientId', e.target.value)}
                                >
                                  <option value="">Choose an ingredient</option>
                                  {(foodIngredients.length > 0 ? foodIngredients : ingredients).map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="inv-line-label">Portion</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="any"
                                  className="inv-input inv-input--sm"
                                  value={row.portionQuantity}
                                  onChange={(e) => handleFoodRowChange(idx, 'portionQuantity', e.target.value)}
                                />
                              </label>
                              <label>
                                <span className="inv-line-label">Unit</span>
                                <select
                                  className="inv-select inv-select--sm"
                                  value={row.unit}
                                  onChange={(e) => handleFoodRowChange(idx, 'unit', e.target.value)}
                                >
                                  {MEASUREMENT_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="flex items-end justify-end self-end sm:items-center sm:self-center">
                                <IconButton
                                  icon="trash"
                                  tone="danger"
                                  label={`Remove ${row.ingredientName || 'ingredient'}`}
                                  onClick={() => handleRemoveIngredientRow(idx)}
                                />
                              </div>
                              {detail && row.ingredientId && (
                                <div className="inv-line-meta">
                                  <span>
                                    In stock{' '}
                                    <b className="font-medium text-[var(--inv-text-2)]">
                                      {formatQty(detail.stockAvailable)} {detail.stockUnit}
                                    </b>
                                  </span>
                                  <span>
                                    Enough for{' '}
                                    <b className="font-medium text-[var(--inv-text-2)]">{detail.servingsPossible} servings</b>
                                  </span>
                                  {!detail.hasStock ? (
                                    <Badge tone="danger">Out of stock</Badge>
                                  ) : (
                                    detail.isLimiting && <Badge tone="warning">Limits servings</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  {/* Packaging editor */}
                  <section aria-labelledby="rcp-pkg-title">
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <h4 id="rcp-pkg-title" className="text-[15px] font-semibold text-[var(--inv-text)]">
                          Packaging
                        </h4>
                        <p className="text-[13px] text-[var(--inv-text-3)]">
                          Used for takeout, delivery and pickup. Dine-in uses reusable tableware.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="plus"
                        onClick={handleAddPackagingRow}
                        disabled={packagingMaterials.length === 0}
                        title={packagingMaterials.length === 0 ? 'Add packaging items first' : undefined}
                      >
                        Add packaging
                      </Button>
                    </div>
                    {draftPackaging.length === 0 ? (
                      <EmptyState
                        compact
                        icon="box"
                        title="No packaging linked"
                        description="Optional. Link trays, bowls, bags or cutlery used when this dish leaves the restaurant."
                      />
                    ) : (
                      <div className="inv-lines">
                        <div className={`inv-line-head ${pkgLineCols}`}>
                          <span>Packaging item</span>
                          <span>Qty</span>
                          <span>Unit</span>
                          <span>Used for</span>
                          <span>Rule</span>
                          <span />
                        </div>
                        {draftPackaging.map((row, idx) => (
                          <div key={row.id || idx} className={`inv-line grid-cols-2 ${pkgLineCols}`}>
                            <label className="col-span-2 sm:col-span-1">
                              <span className="inv-line-label">Packaging item</span>
                              <select
                                className="inv-select inv-select--sm"
                                value={row.packagingId}
                                onChange={(e) => handlePackagingRowChange(idx, 'packagingId', e.target.value)}
                              >
                                <option value="">Choose packaging</option>
                                {(packagingMaterials.length > 0 ? packagingMaterials : ingredients).map((pkg) => (
                                  <option key={pkg.id} value={pkg.id}>
                                    {pkg.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="inv-line-label">Qty</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="any"
                                className="inv-input inv-input--sm"
                                value={row.quantity}
                                onChange={(e) => handlePackagingRowChange(idx, 'quantity', e.target.value)}
                              />
                            </label>
                            <label>
                              <span className="inv-line-label">Unit</span>
                              <select
                                className="inv-select inv-select--sm"
                                value={row.unit}
                                onChange={(e) => handlePackagingRowChange(idx, 'unit', e.target.value)}
                              >
                                {MEASUREMENT_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="inv-line-label">Used for</span>
                              <select
                                className="inv-select inv-select--sm"
                                value={row.fulfillmentType}
                                onChange={(e) => handlePackagingRowChange(idx, 'fulfillmentType', e.target.value)}
                              >
                                {FULFILLMENT_OPTIONS.map((f) => (
                                  <option key={f.value} value={f.value}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span className="inv-line-label">Rule</span>
                              <select
                                className="inv-select inv-select--sm"
                                value={row.scope}
                                onChange={(e) => handlePackagingRowChange(idx, 'scope', e.target.value)}
                              >
                                <option value="PER_ITEM">Per dish</option>
                                <option value="SHARED_ORDER">Shared per order</option>
                              </select>
                            </label>
                            <div className="col-span-2 flex justify-end sm:col-span-1">
                              <IconButton
                                icon="trash"
                                tone="danger"
                                label={`Remove ${row.packagingName || 'packaging'}`}
                                onClick={() => handleRemovePackagingRow(idx)}
                              />
                            </div>
                            {row.scope === 'SHARED_ORDER' && (
                              <div className="inv-line-meta">
                                <label className="flex items-center gap-2" htmlFor={`rcp-cap-${idx}`}>
                                  1 {row.unit} holds up to
                                </label>
                                <input
                                  id={`rcp-cap-${idx}`}
                                  type="number"
                                  inputMode="numeric"
                                  min="1"
                                  className="inv-input inv-input--sm w-20"
                                  value={row.sharedCapacity || 3}
                                  onChange={(e) => handlePackagingRowChange(idx, 'sharedCapacity', e.target.value)}
                                />
                                <span>dishes</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="inv-field">
                    <label className="inv-label" htmlFor="rcp-notes">
                      Prep and packing notes <span className="inv-optional">Optional</span>
                    </label>
                    <textarea
                      id="rcp-notes"
                      rows={3}
                      className="inv-textarea"
                      placeholder="e.g. Sauté garlic in butter until golden, add shrimp for 3 minutes. For takeout, use the 3-compartment tray."
                      value={draftInstructions}
                      onChange={(e) => setDraftInstructions(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--inv-border)] pt-5">
                    <Button variant="secondary" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSaveRecipe}>
                      Save recipe
                    </Button>
                  </div>
                </div>
              ) : activeRecipe && activeRecipe.isConfigured ? (
                <div className="space-y-6 p-5">
                  <section aria-labelledby="rcp-view-ing">
                    <h4 id="rcp-view-ing" className="mb-3 text-[15px] font-semibold text-[var(--inv-text)]">
                      Ingredients per serving
                    </h4>
                    <div className="inv-lines">
                      <table className="inv-table">
                        <thead>
                          <tr>
                            <th scope="col">Ingredient</th>
                            <th scope="col" className="is-num">Per serving</th>
                            <th scope="col" className="is-num hidden sm:table-cell">In stock</th>
                            <th scope="col" className="is-num">Enough for</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeRecipe.ingredients.map((ing, i) => {
                            const detail = activeServingEstimate?.ingredientsDetail.find(
                              (d) => d.ingredientId === ing.ingredientId || d.ingredientName === ing.ingredientName
                            )
                            return (
                              <tr key={i} className={cx(detail && !detail.hasStock && 'is-critical', detail?.isLimiting && detail.hasStock && 'is-attention')}>
                                <td>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inv-cell-primary">{ing.ingredientName}</span>
                                    {detail && !detail.hasStock ? (
                                      <Badge tone="danger">Out of stock</Badge>
                                    ) : (
                                      detail?.isLimiting && <Badge tone="warning">Limits servings</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="is-num font-semibold text-[var(--inv-text)]">
                                  {formatQty(ing.portionQuantity)} {ing.unit}
                                </td>
                                <td className="is-num hidden sm:table-cell">
                                  {detail ? `${formatQty(detail.stockAvailable)} ${detail.stockUnit}` : '—'}
                                </td>
                                <td className="is-num">{detail ? `${detail.servingsPossible} servings` : '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section aria-labelledby="rcp-view-pkg">
                    <div className="mb-3">
                      <h4 id="rcp-view-pkg" className="text-[15px] font-semibold text-[var(--inv-text)]">
                        Packaging
                      </h4>
                      <p className="text-[13px] text-[var(--inv-text-3)]">
                        Used for takeout, delivery and pickup. Dine-in uses reusable tableware.
                      </p>
                    </div>
                    {!activeRecipe.packagingRequirements || activeRecipe.packagingRequirements.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[var(--inv-border-strong)] px-4 py-5 text-center text-sm text-[var(--inv-text-3)]">
                        No packaging linked. Use Edit recipe to add takeout or delivery packaging.
                      </p>
                    ) : (
                      <div className="inv-lines">
                        <table className="inv-table">
                          <thead>
                            <tr>
                              <th scope="col">Packaging item</th>
                              <th scope="col">Used for</th>
                              <th scope="col" className="is-num">Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeRecipe.packagingRequirements.map((pkg, i) => (
                              <tr key={pkg.id || i}>
                                <td className="inv-cell-primary">{pkg.packagingName}</td>
                                <td>
                                  <Badge>{channelLabel(pkg.fulfillmentType)}</Badge>
                                </td>
                                <td className="is-num">
                                  <span className="font-semibold text-[var(--inv-text)]">
                                    {formatQty(pkg.quantity)} {pkg.unit}
                                  </span>
                                  <div className="inv-cell-secondary">
                                    {pkg.scope === 'SHARED_ORDER' ? `per ${pkg.sharedCapacity || 3} dishes` : 'per dish'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {activeRecipe.preparationInstructions && (
                    <section>
                      <h4 className="mb-1.5 text-[15px] font-semibold text-[var(--inv-text)]">Prep and packing notes</h4>
                      <p className="max-w-[70ch] text-sm leading-relaxed text-[var(--inv-text-2)]">
                        {activeRecipe.preparationInstructions}
                      </p>
                    </section>
                  )}
                </div>
              ) : (
                <EmptyState
                  icon="book"
                  title="No recipe yet"
                  description={`Add the ingredients and packaging used for one serving of ${activeProduct.name} to estimate how many you can make.`}
                  action={
                    <Button variant="primary" icon="plus" onClick={handleStartConfiguring}>
                      Set up recipe
                    </Button>
                  }
                />
              )}
            </>
          )}
        </Card>
      </div>

      <InventoryConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="Remove this recipe?"
        message={`The ingredient and packaging setup for ${activeProduct?.name ?? 'this item'} will be removed, and servings can no longer be estimated for it.`}
        confirmText="Remove recipe"
        isDestructive
        onConfirm={() => {
          if (activeProduct) {
            onDeleteRecipe(activeProduct.id)
            setIsConfirmDeleteOpen(false)
          }
        }}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />

      <InventoryConfirmModal
        isOpen={Boolean(pendingProductId)}
        title="Discard unsaved changes?"
        message="You're editing this recipe. Switching to another menu item will discard the changes you haven't saved."
        confirmText="Discard changes"
        cancelText="Keep editing"
        isDestructive
        onConfirm={() => {
          if (pendingProductId) {
            setIsEditing(false)
            setFormError('')
            setSelectedProductId(pendingProductId)
          }
          setPendingProductId(null)
        }}
        onCancel={() => setPendingProductId(null)}
      />
    </div>
  )
}

export default RecipesBOMTab

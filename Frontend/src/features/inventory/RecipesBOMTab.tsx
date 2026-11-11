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
  { label: 'Takeout & Pickup Only', value: 'TAKEOUT' },
  { label: 'Delivery Only', value: 'DELIVERY' },
  { label: 'Takeout, Delivery & Pickup', value: 'ALL' },
  { label: 'Dine-In (Reusable Ware / Special)', value: 'DINE_IN' },
]

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
      return matchesSearch && matchesCat
    })
  }, [productSearch, selectedProductCategory])

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
      setFormError('Please add at least one food ingredient portion to this recipe.')
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

  return (
    <div className="space-y-6">
      {/* 1. SECTION HEADER */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Product Recipes & Bill of Materials (BOM)
            </h2>
            <p className="text-xs text-slate-500">
              Configure food ingredient portions and packaging materials (trays, takeout bags, cutlery sets) per fulfillment channel (Dine-in, Takeout, Delivery).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              {recipes.length} of {CLIENT_MENU_ITEMS.length} dishes configured
            </span>
          </div>
        </div>
      </div>

      {/* 2. SPLIT LAYOUT: PRODUCTS PICKER (LEFT) + RECIPE DETAILS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Menu Product Picker (4 Cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col h-[740px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
            <div className="relative">
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
                placeholder="Search menu product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <select
              value={selectedProductCategory}
              onChange={(e) => setSelectedProductCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">All Categories ({CLIENT_MENU_ITEMS.length})</option>
              {productCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredProducts.map((p) => {
              const currentRecipe = recipes.find((r) => r.productId === p.id && r.isConfigured)
              const hasRecipe = Boolean(currentRecipe)
              const hasPackaging = Boolean(currentRecipe?.packagingRequirements?.length)
              const isSelected = p.id === selectedProductId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(p.id)
                    setIsEditing(false)
                  }}
                  className={`w-full text-left p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-orange-50/50 ring-1 ring-inset ring-orange-500' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="h-11 w-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-orange-900' : 'text-slate-800'}`}>
                      {p.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      ₱{p.price.toFixed(2)} • {p.category}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {hasRecipe ? (
                      <>
                        <div className="flex items-center gap-1">
                          {productServingsMap[p.id] !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                productServingsMap[p.id] > 20
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : productServingsMap[p.id] > 0
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                              title={`${productServingsMap[p.id]} estimated servings based on current inventory stock`}
                            >
                              ~{productServingsMap[p.id]} {productServingsMap[p.id] === 1 ? 'srv' : 'srvs'}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Configured
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                        No Recipe
                      </span>
                    )}
                    {hasPackaging && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700">
                        {currentRecipe?.packagingRequirements.length} packaging items
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Column: Recipe View & Editor (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs min-h-[740px] flex flex-col justify-between">
          {activeProduct ? (
            <div className="space-y-6">
              {/* Product Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 shadow-xs">
                    <img
                      src={activeProduct.image}
                      alt={activeProduct.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                        {activeProduct.category}
                      </span>
                      {activeRecipe?.isConfigured && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ Recipe Active
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">{activeProduct.name}</h3>
                    <div className="flex flex-wrap items-center gap-2.5 mt-1 text-xs">
                      <p className="text-slate-500 font-semibold">Retail Price: ₱{activeProduct.price.toFixed(2)}</p>
                      {activeServingEstimate && (
                        <>
                          <span className="text-slate-300">•</span>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-900 border border-orange-200">
                            <span>🥣 Est. Servings in Stock:</span>
                            <span className="font-extrabold text-orange-950">
                              {activeServingEstimate.totalEstimatedServings}{' '}
                              {activeServingEstimate.totalEstimatedServings === 1 ? 'serving' : 'servings'}
                            </span>
                          </div>
                          {activeServingEstimate.limitingIngredient && (
                            <span className="text-[11px] text-slate-400">
                              (Bottleneck: <strong className="text-slate-600 font-semibold">{activeServingEstimate.limitingIngredient.ingredientName}</strong>)
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2">
                    {activeRecipe?.isConfigured ? (
                      <>
                        <button
                          type="button"
                          onClick={handleStartConfiguring}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit Recipe
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmDeleteOpen(true)}
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Reset / Remove Recipe"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartConfiguring}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Configure Recipe (BOM)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Recipe Body */}
              {isEditing ? (
                /* Recipe Edit Form */
                <div className="space-y-6">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                      {formError}
                    </div>
                  )}

                  {/* SECTION 1: FOOD INGREDIENTS */}
                  <div className="rounded-2xl border border-slate-200/90 p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            1. Food Ingredients (Per 1 Serving)
                          </h4>
                          {draftServingEstimate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                              <span>Estimated Yield:</span>
                              <span className="font-extrabold text-orange-950">
                                ~{draftServingEstimate.totalEstimatedServings} servings
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Specify raw food portions (grams, pieces) used when the kitchen cooks this dish.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddIngredientRow}
                        className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                      >
                        + Add Food Portion
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {draftIngredients.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400">
                          No food ingredients added. Click "+ Add Food Portion" above.
                        </div>
                      ) : (
                        draftIngredients.map((row, idx) => {
                          const detail = draftServingEstimate?.ingredientsDetail.find(
                            (d) => d.ingredientId === row.ingredientId || d.ingredientName === row.ingredientName
                          )
                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                                {/* Food Ingredient Select */}
                                <div className="w-full sm:flex-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                    Food Ingredient
                                  </label>
                                  <select
                                    value={row.ingredientId}
                                    onChange={(e) => handleFoodRowChange(idx, 'ingredientId', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                                  >
                                    <option value="">-- Choose Food Ingredient --</option>
                                    {(foodIngredients.length > 0 ? foodIngredients : ingredients).map((ing) => (
                                      <option key={ing.id} value={ing.id}>
                                        {ing.name} ({ing.baseUnit})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Portion Quantity */}
                                <div className="w-full sm:w-28">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Portion</label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={row.portionQuantity}
                                    onChange={(e) => handleFoodRowChange(idx, 'portionQuantity', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                                  />
                                </div>

                                {/* Unit */}
                                <div className="w-full sm:w-24">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                                  <select
                                    value={row.unit}
                                    onChange={(e) => handleFoodRowChange(idx, 'unit', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-none"
                                  >
                                    {MEASUREMENT_UNITS.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Remove Button */}
                                <div className="sm:pt-4 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredientRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Remove Ingredient"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Inventory stock matching row */}
                              {detail && (
                                <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                                  <div className="flex items-center gap-1.5">
                                    <span>Stock in Inventory:</span>
                                    <strong className="text-slate-800 font-bold">
                                      {detail.stockAvailable.toLocaleString()} {detail.stockUnit}
                                    </strong>
                                    {detail.isLimiting && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                        Bottleneck
                                      </span>
                                    )}
                                    {!detail.hasStock && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                        Out of stock
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <span>Yields: </span>
                                    <strong
                                      className={
                                        detail.isLimiting
                                          ? 'text-amber-800 font-bold'
                                          : detail.servingsPossible === 0
                                          ? 'text-rose-600 font-bold'
                                          : 'text-slate-800 font-semibold'
                                      }
                                    >
                                      {detail.servingsPossible} servings
                                    </strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Section 2: Packaging Materials */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-4">
                    <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Packaging Materials & Disposables
                          </h4>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Takeout · Delivery · Pickup
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Consumed on off-premise orders only. In-house Dine-In counter orders bypass packaging.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddPackagingRow}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer shrink-0 ml-3"
                      >
                        + Add Packaging
                      </button>
                    </div>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {draftPackaging.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                          <p className="font-medium text-slate-600">No Packaging Linked</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Click "+ Add Packaging" to link food trays, bowls, takeout bags, or cutlery.
                          </p>
                        </div>
                      ) : (
                        draftPackaging.map((row, idx) => (
                          <div
                            key={row.id || idx}
                            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                              {/* Packaging Material Select */}
                              <div className="sm:col-span-5">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase">
                                  Packaging Material
                                </label>
                                <select
                                  value={row.packagingId}
                                  onChange={(e) => handlePackagingRowChange(idx, 'packagingId', e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                                >
                                  <option value="">-- Select Packaging Item --</option>
                                  {(packagingMaterials.length > 0 ? packagingMaterials : ingredients).map((pkg) => (
                                    <option key={pkg.id} value={pkg.id}>
                                      {pkg.name} ({pkg.category})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Fulfillment Channel */}
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase">
                                  Fulfillment Channel
                                </label>
                                <select
                                  value={row.fulfillmentType}
                                  onChange={(e) => handlePackagingRowChange(idx, 'fulfillmentType', e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                                >
                                  {FULFILLMENT_OPTIONS.map((f) => (
                                    <option key={f.value} value={f.value}>
                                      {f.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Requirement Scope */}
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-600 uppercase">
                                  Scope
                                </label>
                                <select
                                  value={row.scope}
                                  onChange={(e) => handlePackagingRowChange(idx, 'scope', e.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                                >
                                  <option value="PER_ITEM">Per Item (1:1)</option>
                                  <option value="SHARED_ORDER">Shared Order-Level</option>
                                </select>
                              </div>

                              {/* Remove Button */}
                              <div className="sm:col-span-1 flex justify-end sm:pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePackagingRow(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Remove Packaging"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Sub-row: Quantity, Unit, Shared Capacity, and Notes */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1 border-t border-slate-100">
                              <div className="sm:col-span-3 flex items-center gap-2">
                                <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={row.quantity}
                                    onChange={(e) => handlePackagingRowChange(idx, 'quantity', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                                  />
                                </div>
                                <div className="w-20">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                                  <select
                                    value={row.unit}
                                    onChange={(e) => handlePackagingRowChange(idx, 'unit', e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                                  >
                                    {MEASUREMENT_UNITS.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {row.scope === 'SHARED_ORDER' ? (
                                <div className="sm:col-span-9">
                                  <label className="block text-[10px] font-bold text-indigo-700 uppercase">
                                    Shared Packaging Capacity (1 unit holds up to N items)
                                  </label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="number"
                                      min="1"
                                      value={row.sharedCapacity || 3}
                                      onChange={(e) => handlePackagingRowChange(idx, 'sharedCapacity', e.target.value)}
                                      className="w-20 rounded-lg border border-indigo-300 bg-indigo-50/50 px-2 py-1 text-xs text-indigo-950 font-bold focus:border-indigo-500 focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-500">
                                      dishes per 1 {row.unit} (Takeout / Delivery / Pickup only)
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="sm:col-span-9">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                                    Usage Scope
                                  </label>
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    1 unit consumed per individual dish portion (Takeout / Delivery / Pickup only)
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Prep Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Kitchen Prep Instructions & Notes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Sauté garlic and butter until golden, add clean shrimp for 3 mins. For takeout, place inside 3-compartment food tray and seal with branded sticker."
                      value={draftInstructions}
                      onChange={(e) => setDraftInstructions(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  {/* Operational Recipe Summary */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-2.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-700">
                        Est. Yield
                      </span>
                      <p className="text-sm font-black text-orange-950 mt-0.5 tabular-nums">
                        {draftServingEstimate ? `${draftServingEstimate.totalEstimatedServings} servings` : '—'}
                      </p>
                      {draftServingEstimate?.limitingIngredient && (
                        <p className="text-[10px] text-amber-800 font-medium truncate mt-0.5" title={`Bottleneck: ${draftServingEstimate.limitingIngredient.ingredientName}`}>
                          Bottleneck: {draftServingEstimate.limitingIngredient.ingredientName}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Food Ingredients
                      </span>
                      <p className="text-sm font-extrabold text-slate-900">
                        {draftIngredients.filter((r) => r.ingredientId).length} portions
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        Takeout / Delivery Pkg
                      </span>
                      <p className="text-sm font-extrabold text-indigo-700">
                        {draftPackaging.filter((r) => r.packagingId).length} items
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Dine-In Tableware
                      </span>
                      <p className="text-sm font-extrabold text-emerald-700">
                        0 pkg (Reusable)
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Retail Price
                      </span>
                      <p className="text-sm font-extrabold text-slate-900">₱{activeProduct.price.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRecipe}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 cursor-pointer"
                    >
                      Save Recipe (BOM)
                    </button>
                  </div>
                </div>
              ) : activeRecipe && activeRecipe.isConfigured ? (
                /* Configured Recipe Display */
                <div className="space-y-5">
                  {/* Food Section */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Food Ingredients (Per 1 Serving)
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeServingEstimate && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200">
                            <span>📦 Yield:</span>
                            <span className="font-extrabold text-orange-950">
                              {activeServingEstimate.totalEstimatedServings}{' '}
                              {activeServingEstimate.totalEstimatedServings === 1 ? 'serving' : 'servings'}
                            </span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{activeRecipe.ingredients.length} Ingredients</span>
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {activeRecipe.ingredients.map((ing, i) => {
                        const detail = activeServingEstimate?.ingredientsDetail.find(
                          (d) => d.ingredientId === ing.ingredientId || d.ingredientName === ing.ingredientName
                        )
                        return (
                          <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  detail?.isLimiting ? 'bg-amber-500' : 'bg-orange-500'
                                }`}
                              ></span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 truncate">{ing.ingredientName}</span>
                                  {detail?.isLimiting && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                      Stock Bottleneck
                                    </span>
                                  )}
                                  {detail && !detail.hasStock && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                                      Depleted / 0 g
                                    </span>
                                  )}
                                </div>
                                {detail && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Current Stock in Inventory:{' '}
                                    <strong className="text-slate-700 font-bold">
                                      {detail.stockAvailable.toLocaleString()} {detail.stockUnit}
                                    </strong>{' '}
                                    • Yields:{' '}
                                    <strong
                                      className={
                                        detail.isLimiting
                                          ? 'text-amber-800 font-bold'
                                          : detail.servingsPossible === 0
                                          ? 'text-rose-600 font-bold'
                                          : 'text-slate-700 font-semibold'
                                      }
                                    >
                                      {detail.servingsPossible} {detail.servingsPossible === 1 ? 'serving' : 'servings'}
                                    </strong>
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-extrabold text-slate-900 tabular-nums">
                                {ing.portionQuantity} {ing.unit}
                              </span>
                              <span className="text-[10px] text-slate-400 block">per serving</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Packaging Section */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                    <div className="flex items-start justify-between mb-3 pb-2.5 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Packaging Materials & Disposables
                          </h4>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            Takeout · Delivery · Pickup
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Deducted on off-premise orders only. In-house Dine-In orders use reusable tableware.
                        </p>
                      </div>
                      <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0 ml-3">
                        {activeRecipe.packagingRequirements?.length || 0} items
                      </span>
                    </div>

                    {!activeRecipe.packagingRequirements || activeRecipe.packagingRequirements.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No packaging requirements configured. Click "Edit Recipe" to link takeout or delivery packaging.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {activeRecipe.packagingRequirements.map((pkg, i) => {
                          const channelLabel =
                            pkg.fulfillmentType === 'TAKEOUT'
                              ? 'Takeout'
                              : pkg.fulfillmentType === 'DELIVERY'
                              ? 'Delivery'
                              : pkg.fulfillmentType === 'DINE_IN'
                              ? 'Dine-In'
                              : 'Takeout, Delivery & Pickup'

                          return (
                            <div key={pkg.id || i} className="py-2.5 flex items-center justify-between text-xs gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0"></span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-slate-800 truncate">{pkg.packagingName}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                                    {channelLabel}
                                  </span>
                                  {pkg.scope === 'SHARED_ORDER' && (
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      (1 per {pkg.sharedCapacity || 3} items)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-semibold text-slate-900 tabular-nums">
                                  {pkg.quantity} {pkg.unit}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Automated inventory deduction at order dispatch</span>
                      <span>Dine-In: 0 packaging deducted</span>
                    </div>
                  </div>

                  {activeRecipe.preparationInstructions && (
                    <div className="rounded-xl border border-slate-200/70 p-3.5 bg-white text-xs">
                      <span className="font-bold text-slate-700 block mb-1">Chef & Packing Notes:</span>
                      <p className="text-slate-600">{activeRecipe.preparationInstructions}</p>
                    </div>
                  )}

                  {/* Operational Recipe Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3.5">
                      <span className="text-[10px] font-black text-orange-700 uppercase tracking-wider">
                        Est. Servings in Stock
                      </span>
                      <p className="text-base font-extrabold text-orange-950 mt-1 tabular-nums">
                        {activeServingEstimate?.totalEstimatedServings ?? 0} servings
                      </p>
                      <p className="text-[10px] text-amber-800 font-medium truncate mt-0.5" title={activeServingEstimate?.limitingIngredient ? `Limited by ${activeServingEstimate.limitingIngredient.ingredientName}` : 'All ingredients stocked'}>
                        {activeServingEstimate?.limitingIngredient
                          ? `Limited by ${activeServingEstimate.limitingIngredient.ingredientName}`
                          : 'All ingredients stocked'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Food Ingredients</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">
                        {activeRecipe.ingredients.length} items
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Takeout & Delivery</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">
                        {activeRecipe.packagingRequirements?.length || 0} items
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dine-In Tableware</span>
                      <p className="text-sm font-semibold text-emerald-700 mt-1">
                        Reusable (0 deducted)
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retail Price</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">
                        ₱{activeProduct.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state when no recipe configured */
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No Recipe (BOM) Configured Yet</h4>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm">
                    "{activeProduct.name}" does not have a recipe configured. Set up raw food portions and packaging requirements for Dine-in, Takeout, and Delivery.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartConfiguring}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all cursor-pointer"
                  >
                    + Configure Recipe & Packaging
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs">Select a product to view its recipe.</div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Seafudz Dual Bill of Materials Engine (Food + Fulfillment Packaging)</span>
            <span>Channel & Order-Bundle Deductions</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <InventoryConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="Remove Recipe Configuration"
        message="Are you sure you want to delete this product's recipe? Automatic food and packaging inventory deduction will be disabled for this item until a new recipe is configured."
        confirmText="Remove Recipe"
        isDestructive
        onConfirm={() => {
          if (activeProduct) {
            onDeleteRecipe(activeProduct.id)
            setIsConfirmDeleteOpen(false)
          }
        }}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  )
}

export default RecipesBOMTab

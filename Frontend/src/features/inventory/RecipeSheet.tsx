/**
 * One dish's recipe, as a sheet over the menu list.
 *
 * Recipes used to be a tab of their own with its own dish picker, which meant two lists of the
 * same dishes and two places to look for the same dish. The catalog list on Menu & Recipes is now
 * the only picker: a row opens this sheet, and the recipe is read or edited right there.
 */
import React, { useMemo, useState } from 'react'
import type {
  FulfillmentType,
  Ingredient,
  MeasurementUnit,
  PackagingCategory,
  PackagingRequirement,
  PackagingScope,
  ProductRecipe,
  RecipeIngredient,
} from './inventoryTypes'
import { FULFILLMENT_OPTIONS, MEASUREMENT_UNITS, fulfillmentLabel } from './inventoryTypes'
import { computeRecipeServingEstimate, servingsTone } from './recipeYield'
import { SearchableSelect } from './SearchableSelect'
import InventoryConfirmModal from './InventoryConfirmModal'
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  Notice,
  cx,
  formatQty,
} from './ui'

/** The little the sheet needs to know about the dish itself. */
export interface RecipeSheetProduct {
  id: string
  name: string
  category: string
  price: number
  image?: string
}

interface RecipeSheetProps {
  /**
   * The dish whose recipe this is. The sheet holds a draft of the recipe, so the caller mounts it
   * per dish (`key={dish.id}`) rather than feeding a new dish into a mounted sheet — a half-typed
   * portion then cannot survive into another dish's recipe.
   */
  product: RecipeSheetProduct
  recipe?: ProductRecipe
  ingredients: Ingredient[]
  /** 'edit' opens straight into the editor — what "Set up recipe" on an unlinked dish does. */
  initialMode?: 'view' | 'edit'
  onClose: () => void
  onSaveRecipe: (recipe: ProductRecipe) => Promise<boolean> | boolean | void
  onDeleteRecipe: (productId: string) => void
  /** Opens a stock item on the Items tab, so "out of stock" leads straight to restocking it. */
  onOpenStockItem: (stockItemId: string | undefined, name: string) => void
}

const foodLineCols = 'sm:grid-cols-[minmax(0,1fr)_112px_96px_32px]'
const pkgLineCols = 'sm:grid-cols-[minmax(0,1fr)_88px_88px_minmax(0,170px)_minmax(0,150px)_32px]'

interface RecipeDraft {
  ingredients: RecipeIngredient[]
  packaging: PackagingRequirement[]
  instructions: string
}

/** The saved recipe as an editable draft, or one sensible starter line when there is none yet. */
function buildDraft(recipe: ProductRecipe | undefined, ingredients: Ingredient[]): RecipeDraft {
  if (recipe?.isConfigured) {
    return {
      ingredients: recipe.ingredients.map((item) => ({ ...item })),
      packaging: (recipe.packagingRequirements || []).map((item) => ({ ...item })),
      instructions: recipe.preparationInstructions || '',
    }
  }
  const defaultFood = ingredients.find((i) => (i.itemType || 'FOOD') === 'FOOD') || ingredients[0]
  return {
    ingredients: defaultFood
      ? [
          {
            ingredientId: defaultFood.id,
            ingredientName: defaultFood.name,
            portionQuantity: 100,
            unit: defaultFood.baseUnit,
          },
        ]
      : [],
    packaging: [],
    instructions: '',
  }
}

export const RecipeSheet: React.FC<RecipeSheetProps> = ({
  product,
  recipe,
  ingredients,
  initialMode = 'view',
  onClose,
  onSaveRecipe,
  onDeleteRecipe,
  onOpenStockItem,
}) => {
  // The draft is seeded once, from the recipe as it stood when the sheet opened: a stock movement
  // elsewhere refreshes the yield figures below without touching what is being typed.
  const [initialDraft] = useState<RecipeDraft>(() => buildDraft(recipe, ingredients))
  const [isEditing, setIsEditing] = useState(initialMode === 'edit')
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>(initialDraft.ingredients)
  const [draftPackaging, setDraftPackaging] = useState<PackagingRequirement[]>(initialDraft.packaging)
  const [draftInstructions, setDraftInstructions] = useState(initialDraft.instructions)
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)

  const foodIngredients = useMemo(
    () => ingredients.filter((i) => (i.itemType || 'FOOD') === 'FOOD'),
    [ingredients]
  )
  const packagingMaterials = useMemo(() => ingredients.filter((i) => i.itemType === 'PACKAGING'), [ingredients])

  /** Throws the draft away and starts again from the saved recipe. */
  const resetDraft = () => {
    const fresh = buildDraft(recipe, ingredients)
    setDraftIngredients(fresh.ingredients)
    setDraftPackaging(fresh.packaging)
    setDraftInstructions(fresh.instructions)
    setFormError('')
  }

  const savedEstimate = useMemo(
    () => (recipe?.ingredients?.length ? computeRecipeServingEstimate(recipe.ingredients, ingredients) : null),
    [recipe, ingredients]
  )
  const draftEstimate = useMemo(
    () => (draftIngredients.length ? computeRecipeServingEstimate(draftIngredients, ingredients) : null),
    [draftIngredients, ingredients]
  )
  const estimate = isEditing ? draftEstimate : savedEstimate

  /* ------------------------------------------------------- Ingredient lines */

  const handleAddIngredientRow = () => {
    const defaultIng = foodIngredients[0] || ingredients[0]
    setFormError('')
    setDraftIngredients((prev) => [
      ...prev,
      {
        ingredientId: defaultIng?.id || '',
        ingredientName: defaultIng?.name || 'Raw Ingredient',
        portionQuantity: 50,
        unit: defaultIng?.baseUnit || 'g',
      },
    ])
  }

  const handleRemoveIngredientRow = (index: number) => {
    setFormError('')
    setDraftIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFoodRowChange = (index: number, field: keyof RecipeIngredient, value: string | number) => {
    setFormError('')
    setDraftIngredients((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'ingredientId') {
        const ing = ingredients.find((i) => i.id === value)
        row.ingredientId = String(value)
        row.ingredientName = ing ? ing.name : 'Unknown Ingredient'
        row.unit = ing ? ing.baseUnit : 'g'
      } else if (field === 'portionQuantity') {
        row.portionQuantity = Math.max(0, Number(value) || 0)
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      }

      updated[index] = row
      return updated
    })
  }

  /* --------------------------------------------------------- Packaging lines */

  const handleAddPackagingRow = () => {
    const defaultPkg = packagingMaterials[0]
    setFormError('')
    setDraftPackaging((prev) => [
      ...prev,
      {
        id: `pkg-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        packagingId: defaultPkg?.id || '',
        packagingName: defaultPkg?.name || 'Packaging Material',
        category: (defaultPkg?.category as PackagingCategory) || 'Trays, Bowls & Containers',
        quantity: 1,
        unit: defaultPkg?.baseUnit || 'pcs',
        fulfillmentType: 'TAKEOUT',
        scope: 'PER_ITEM',
        sharedCapacity: 1,
      },
    ])
  }

  const handleRemovePackagingRow = (index: number) => {
    setFormError('')
    setDraftPackaging((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePackagingRowChange = (
    index: number,
    field: keyof PackagingRequirement,
    value: string | number
  ) => {
    setFormError('')
    setDraftPackaging((prev) => {
      const updated = [...prev]
      const row = { ...updated[index] }

      if (field === 'packagingId') {
        const pkg = ingredients.find((i) => i.id === value)
        row.packagingId = String(value)
        row.packagingName = pkg ? pkg.name : 'Packaging Material'
        row.category = (pkg?.category as PackagingCategory) || 'Trays, Bowls & Containers'
        row.unit = pkg ? pkg.baseUnit : 'pcs'
      } else if (field === 'quantity') {
        row.quantity = Math.max(0.1, Number(value) || 1)
      } else if (field === 'fulfillmentType') {
        row.fulfillmentType = value as FulfillmentType
      } else if (field === 'scope') {
        row.scope = value as PackagingScope
        if (value === 'SHARED_ORDER' && !row.sharedCapacity) {
          row.sharedCapacity = 3 // e.g. 1 bag holds up to 3 dishes
        }
      } else if (field === 'sharedCapacity') {
        row.sharedCapacity = Math.max(1, Number(value) || 1)
      } else if (field === 'unit') {
        row.unit = value as MeasurementUnit
      } else if (field === 'notes') {
        row.notes = String(value)
      }

      updated[index] = row
      return updated
    })
  }

  /* ------------------------------------------------------------------- Save */

  // A recipe says what a dish is made of and how much of it, nothing more: the stockroom holds no
  // unit prices, so there is no food cost, packaging cost or margin to work out here.
  const handleSave = async () => {
    if (!product) return
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

    setIsSaving(true)
    try {
      const saved = await onSaveRecipe({
        productId: product.id,
        productName: product.name,
        productCategory: product.category,
        productPrice: product.price,
        productImage: product.image,
        yieldServings: 1,
        ingredients: draftIngredients,
        packagingRequirements: draftPackaging,
        preparationInstructions: draftInstructions.trim(),
        isConfigured: true,
        updatedAt: new Date().toISOString(),
      })
      if (saved === false) return
      setFormError('')
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const isConfigured = Boolean(recipe?.isConfigured)

  return (
    <>
      <Modal
        open
        onClose={() => {
          if (isSaving) return
          onClose()
        }}
        size="xl"
        title={isEditing ? `${isConfigured ? 'Edit' : 'Set up'} recipe — ${product.name}` : `Recipe — ${product.name}`}
        description={
          <span className="inv-recipe-sheet-sub">
            <span>
              {product.category} · ₱{product.price.toFixed(2)}
            </span>
            {estimate && (
              <span className="inv-recipe-sheet-yield">
                <span>Can make about</span>
                <Badge tone={servingsTone(estimate.totalEstimatedServings)}>
                  {estimate.totalEstimatedServings} {estimate.totalEstimatedServings === 1 ? 'serving' : 'servings'}
                </Badge>
                {estimate.limitingIngredient && (
                  <span>
                    limited by{' '}
                    <button
                      type="button"
                      className="inv-row-link inv-row-link--hint"
                      onClick={() =>
                        onOpenStockItem(
                          estimate.limitingIngredient?.ingredientId,
                          estimate.limitingIngredient?.ingredientName || ''
                        )
                      }
                      title={`Open ${estimate.limitingIngredient.ingredientName} in Items`}
                    >
                      {estimate.limitingIngredient.ingredientName}
                    </button>
                  </span>
                )}
              </span>
            )}
          </span>
        }
        footer={
          isEditing ? (
            <>
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={() => {
                  if (isConfigured) {
                    resetDraft()
                    setIsEditing(false)
                  } else {
                    onClose()
                  }
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={isSaving} onClick={() => void handleSave()}>
                {isSaving ? 'Saving' : 'Save recipe'}
              </Button>
            </>
          ) : (
            <>
              {isConfigured && (
                <Button variant="ghost" icon="trash" onClick={() => setIsConfirmDeleteOpen(true)}>
                  Remove recipe
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                icon={isConfigured ? 'edit' : 'plus'}
                onClick={() => {
                  resetDraft()
                  setIsEditing(true)
                }}
              >
                {isConfigured ? 'Edit recipe' : 'Set up recipe'}
              </Button>
            </>
          )
        }
      >
        {isEditing ? (
          <div className="space-y-7">
            {formError && <Notice tone="danger">{formError}</Notice>}

            {/* Ingredients editor */}
            <section aria-labelledby="rcp-ing-title">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h4 id="rcp-ing-title" className="text-[15px] font-semibold text-[var(--inv-text)]">
                    Ingredients per serving
                  </h4>
                  <p className="text-[13px] text-[var(--inv-text-3)]">
                    How much of each ingredient one serving uses.
                  </p>
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
                    const detail = draftEstimate?.ingredientsDetail.find(
                      (d) => d.ingredientId === row.ingredientId || d.ingredientName === row.ingredientName
                    )
                    return (
                      <div
                        key={idx}
                        className={`inv-line grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] ${foodLineCols}`}
                      >
                        <label className="col-span-3 sm:col-span-1">
                          <span className="inv-line-label">Ingredient</span>
                          <SearchableSelect
                            ariaLabel={`Ingredient ${idx + 1}`}
                            value={row.ingredientId}
                            onChange={(next) => handleFoodRowChange(idx, 'ingredientId', next)}
                            placeholder="Choose an ingredient"
                            searchPlaceholder="Search the stockroom…"
                            options={(foodIngredients.length > 0 ? foodIngredients : ingredients).map((ing) => ({
                              value: ing.id,
                              label: ing.name,
                              hint: `${formatQty(ing.currentStock)} ${ing.baseUnit}`,
                            }))}
                          />
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
                              <b className="font-medium text-[var(--inv-text-2)]">
                                {detail.servingsPossible} servings
                              </b>
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
                        <SearchableSelect
                          ariaLabel={`Packaging item ${idx + 1}`}
                          value={row.packagingId}
                          onChange={(next) => handlePackagingRowChange(idx, 'packagingId', next)}
                          placeholder="Choose packaging"
                          searchPlaceholder="Search packaging…"
                          options={(packagingMaterials.length > 0 ? packagingMaterials : ingredients).map((pkg) => ({
                            value: pkg.id,
                            label: pkg.name,
                            hint: `${formatQty(pkg.currentStock)} ${pkg.baseUnit}`,
                          }))}
                        />
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
          </div>
        ) : recipe && recipe.isConfigured ? (
          <div className="space-y-6">
            <section aria-labelledby="rcp-view-ing">
              <h4 id="rcp-view-ing" className="mb-3 text-[15px] font-semibold text-[var(--inv-text)]">
                Ingredients per serving
              </h4>
              <div className="inv-lines">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th scope="col">Ingredient</th>
                      <th scope="col" className="is-num">
                        Per serving
                      </th>
                      <th scope="col" className="is-num hidden sm:table-cell">
                        In stock
                      </th>
                      <th scope="col" className="is-num">
                        Enough for
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.ingredients.map((ing, i) => {
                      const detail = savedEstimate?.ingredientsDetail.find(
                        (d) => d.ingredientId === ing.ingredientId || d.ingredientName === ing.ingredientName
                      )
                      return (
                        <tr
                          key={i}
                          className={cx(
                            detail && !detail.hasStock && 'is-critical',
                            detail?.isLimiting && detail.hasStock && 'is-attention'
                          )}
                        >
                          <td>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="inv-row-link inv-row-link--hint"
                                onClick={() => onOpenStockItem(ing.ingredientId, ing.ingredientName)}
                                title={`Open ${ing.ingredientName} in Items`}
                              >
                                {ing.ingredientName}
                              </button>
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
              {!recipe.packagingRequirements || recipe.packagingRequirements.length === 0 ? (
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
                        <th scope="col" className="is-num">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.packagingRequirements.map((pkg, i) => (
                        <tr key={pkg.id || i}>
                          <td>
                            <button
                              type="button"
                              className="inv-row-link inv-row-link--hint"
                              onClick={() => onOpenStockItem(pkg.packagingId, pkg.packagingName)}
                              title={`Open ${pkg.packagingName} in Items`}
                            >
                              {pkg.packagingName}
                            </button>
                          </td>
                          <td>
                            <Badge>{fulfillmentLabel(pkg.fulfillmentType)}</Badge>
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

            {recipe.preparationInstructions && (
              <section>
                <h4 className="mb-1.5 text-[15px] font-semibold text-[var(--inv-text)]">Prep and packing notes</h4>
                <p className="max-w-[70ch] text-sm leading-relaxed text-[var(--inv-text-2)]">
                  {recipe.preparationInstructions}
                </p>
              </section>
            )}
          </div>
        ) : (
          <EmptyState
            icon="book"
            title="No recipe yet"
            description={`Add the ingredients and packaging used for one serving of ${product.name} to estimate how many you can make. Until it has a recipe, stock can never sell this dish out.`}
            action={
              <Button
                variant="primary"
                icon="plus"
                onClick={() => {
                  resetDraft()
                  setIsEditing(true)
                }}
              >
                Set up recipe
              </Button>
            }
          />
        )}
      </Modal>

      <InventoryConfirmModal
        isOpen={isConfirmDeleteOpen}
        title="Remove this recipe?"
        message={`The ingredient and packaging setup for ${product.name} will be removed, and servings can no longer be estimated for it.`}
        confirmText="Remove recipe"
        isDestructive
        onConfirm={() => {
          onDeleteRecipe(product.id)
          setIsConfirmDeleteOpen(false)
          onClose()
        }}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </>
  )
}

export default RecipeSheet

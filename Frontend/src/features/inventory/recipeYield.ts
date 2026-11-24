/**
 * How many servings of a dish the stockroom can still make.
 *
 * A recipe ties a dish to stock, so this is the one number that answers "can we still sell it?".
 * It lives apart from the screens that show it because the dish list, the recipe sheet and the
 * recipe editor all have to agree on it.
 */
import type { Ingredient, RecipeIngredient } from './inventoryTypes'
import type { BadgeTone } from './ui'

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

export const servingsTone = (n: number): BadgeTone => (n > 20 ? 'success' : n > 0 ? 'warning' : 'danger')

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

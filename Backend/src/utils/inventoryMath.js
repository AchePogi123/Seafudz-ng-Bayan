/**
 * Pure inventory maths (no database access) so it can be unit tested.
 *
 * Terms
 *  - recipe:    { productId, ingredients: [{ ingredientId, portion, unit }],
 *                 packaging: [{ packagingId, quantity, unit, fulfillmentType, scope, sharedCapacity }] }
 *  - fulfillment: 'DELIVERY' | 'PICKUP' | 'TAKE_OUT' | 'DINE_IN'
 */

const WEIGHT = { g: 1, kg: 1000 };
const VOLUME = { ml: 1, L: 1000, l: 1000 };

/** Converts qty from one unit to another when they are related (g/kg, ml/L); otherwise returns qty unchanged. */
export function convertQty(qty, fromUnit, toUnit) {
  const n = Number(qty) || 0;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return n;
  if (WEIGHT[fromUnit] && WEIGHT[toUnit]) return (n * WEIGHT[fromUnit]) / WEIGHT[toUnit];
  if (VOLUME[fromUnit] && VOLUME[toUnit]) return (n * VOLUME[fromUnit]) / VOLUME[toUnit];
  return n;
}

/** Normalises the many spellings used by the POS / customer app into one of four fulfillment values. */
export function normalizeFulfillment(...candidates) {
  for (const raw of candidates) {
    if (raw === undefined || raw === null) continue;
    const v = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!v) continue;
    if (v.includes('DINE')) return 'DINE_IN';
    if (v.includes('PICK')) return 'PICKUP';
    if (v.includes('TAKE')) return 'TAKE_OUT';
    if (v.includes('DELIVER')) return 'DELIVERY';
  }
  return 'TAKE_OUT';
}

/**
 * Which recipe packaging rows apply to an order.
 *  TAKEOUT  -> pickup, take-out and delivery (everything that leaves the table)
 *  DELIVERY -> delivery only
 *  DINE_IN  -> dine-in only
 *  ALL      -> every order type
 */
export function packagingApplies(rowFulfillment, fulfillment) {
  const row = String(rowFulfillment || 'TAKEOUT').toUpperCase();
  if (row === 'ALL') return true;
  if (row === 'DINE_IN') return fulfillment === 'DINE_IN';
  if (row === 'DELIVERY') return fulfillment === 'DELIVERY';
  return fulfillment !== 'DINE_IN';
}

const round = (n) => Math.round(n * 10000) / 10000;

/**
 * Works out what an order uses.
 * @param {Array<{orderItemId?: number|string|null, productId: string, quantity: number}>} items
 * @param {Map<string, object>} recipes productId -> recipe (only configured recipes)
 * @param {Map<string, {baseUnit: string, itemType: string}>} ingredientMeta ingredientId -> meta
 * @returns {Array<{orderItemId: *, productId: string|null, ingredientId: string, itemType: string, quantity: number}>}
 */
export function computeRequirementLines({ items, recipes, ingredientMeta, fulfillment }) {
  const lines = [];
  const shared = new Map(); // packagingId -> { dishes, quantity, capacity, unit }

  for (const item of items) {
    const recipe = recipes.get(item.productId);
    const qty = Number(item.quantity) || 0;
    if (!recipe || qty <= 0) continue;

    for (const ing of recipe.ingredients || []) {
      const meta = ingredientMeta.get(ing.ingredientId);
      if (!meta) continue;
      const perServing = convertQty(ing.portion, ing.unit, meta.baseUnit);
      const total = round(perServing * qty);
      if (total > 0) {
        lines.push({
          orderItemId: item.orderItemId ?? null,
          productId: item.productId,
          ingredientId: ing.ingredientId,
          itemType: meta.itemType || 'FOOD',
          quantity: total,
        });
      }
    }

    for (const pkg of recipe.packaging || []) {
      if (!packagingApplies(pkg.fulfillmentType, fulfillment)) continue;
      const meta = ingredientMeta.get(pkg.packagingId);
      if (!meta) continue;
      const perUnit = convertQty(pkg.quantity, pkg.unit, meta.baseUnit);
      if (String(pkg.scope).toUpperCase() === 'SHARED_ORDER') {
        const entry = shared.get(pkg.packagingId) || { dishes: 0, quantity: perUnit, capacity: 1 };
        entry.dishes += qty;
        entry.capacity = Math.max(entry.capacity, Number(pkg.sharedCapacity) || 1);
        shared.set(pkg.packagingId, entry);
      } else {
        const total = round(perUnit * qty);
        if (total > 0) {
          lines.push({
            orderItemId: item.orderItemId ?? null,
            productId: item.productId,
            ingredientId: pkg.packagingId,
            itemType: meta.itemType || 'PACKAGING',
            quantity: total,
          });
        }
      }
    }
  }

  for (const [packagingId, entry] of shared) {
    const meta = ingredientMeta.get(packagingId);
    const total = round(Math.ceil(entry.dishes / entry.capacity) * entry.quantity);
    if (total > 0) {
      lines.push({
        orderItemId: null,
        productId: null,
        ingredientId: packagingId,
        itemType: meta?.itemType || 'PACKAGING',
        quantity: total,
      });
    }
  }

  return lines;
}

/** Sums lines per ingredient. */
export function aggregateLines(lines) {
  const totals = new Map();
  for (const l of lines) totals.set(l.ingredientId, round((totals.get(l.ingredientId) || 0) + l.quantity));
  return totals;
}

/**
 * What ONE serving of a dish needs, summed per stock item and expressed in that item's base unit.
 *
 * Summing first matters: the same item can appear on more than one recipe line (a sauce that is
 * both an ingredient and a dipping cup's filling, or two packaging rows for the same box). Dividing
 * stock by each line on its own and taking the smallest answer would say a dish needing 2 trays per
 * serving can be made 5 times from 5 trays. The per-item total is the honest figure.
 *
 * @param {object} recipe
 * @param {Map<string, {baseUnit: string, stock: number, name: string}>} stockById
 * @param {string|null} fulfillment order type whose packaging counts; null = food only
 * @returns {{ needs: Map<string, number>, missing: string[] }} missing = recipe items not in the catalog
 */
export function computePerServingNeeds(recipe, stockById, fulfillment = null) {
  const needs = new Map();
  const missing = [];
  const add = (id, qty) => {
    if (qty > 0) needs.set(id, round((needs.get(id) || 0) + qty));
  };

  for (const ing of recipe.ingredients || []) {
    const stock = stockById.get(ing.ingredientId);
    if (!stock) {
      missing.push(ing.ingredientName || ing.ingredientId);
      continue;
    }
    add(ing.ingredientId, convertQty(ing.portion, ing.unit, stock.baseUnit));
  }

  if (fulfillment) {
    for (const pkg of recipe.packaging || []) {
      if (!packagingApplies(pkg.fulfillmentType, fulfillment)) continue;
      const stock = stockById.get(pkg.packagingId);
      if (!stock) {
        missing.push(pkg.packagingName || pkg.packagingId);
        continue;
      }
      const perUnit = convertQty(pkg.quantity, pkg.unit, stock.baseUnit);
      // Shared packaging counts its per-dish share (1 bag for 3 dishes = 1/3 bag each)
      const shared = String(pkg.scope).toUpperCase() === 'SHARED_ORDER';
      add(pkg.packagingId, shared ? perUnit / Math.max(1, Number(pkg.sharedCapacity) || 1) : perUnit);
    }
  }

  return { needs, missing };
}

/**
 * How many servings a per-serving requirement allows, given the stock on hand.
 * `available` overrides the catalog stock for items it names (used to hold back the stock that
 * placed-but-unpaid orders are already counting on).
 * @returns {{ servings: number|null, limitedBy: string|null }} null servings = nothing limits it
 */
function servingsFromNeeds({ needs, missing }, stockById, available) {
  if (missing.length > 0) return { servings: 0, limitedBy: missing[0] };
  let min = Infinity;
  let limitedBy = null;
  for (const [id, perServing] of needs) {
    const stock = stockById.get(id);
    const onHand = available?.has(id) ? available.get(id) : Number(stock?.stock) || 0;
    const possible = Math.floor(onHand / perServing + 1e-9);
    if (possible < min) {
      min = possible;
      limitedBy = stock?.name || id;
    }
  }
  if (!Number.isFinite(min)) return { servings: null, limitedBy: null };
  return { servings: Math.max(0, min), limitedBy };
}

/**
 * How many servings the food ingredients allow.
 * @param {object} recipe
 * @param {Map<string, {baseUnit: string, stock: number, name: string}>} stockById
 * @param {Map<string, number>} [available] stock to use instead of the catalog figure, per item
 * @returns {{ servings: number, limitedBy: string|null }}
 */
export function computeServings(recipe, stockById, available) {
  return servingsFromNeeds(computePerServingNeeds(recipe, stockById, null), stockById, available);
}

export const FULFILLMENTS = ['DINE_IN', 'TAKE_OUT', 'PICKUP', 'DELIVERY'];

/**
 * Servings for one order type: the limiting item across the whole BOM —
 * food ingredients plus the packaging that order type actually uses
 * (same rules as packagingApplies / computeRequirementLines).
 * @param {Map<string, number>} [available] stock to use instead of the catalog figure, per item
 * @returns {{ servings: number|null, limitedBy: string|null }} null servings = nothing to limit it
 */
export function computeServingsForFulfillment(recipe, stockById, fulfillment, available) {
  return servingsFromNeeds(computePerServingNeeds(recipe, stockById, fulfillment), stockById, available);
}

export function stockStatus(stock, min) {
  if (stock <= 0) return 'OUT_OF_STOCK';
  if (stock <= min) return 'LOW_STOCK';
  return 'IN_STOCK';
}

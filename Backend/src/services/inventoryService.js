/**
 * Inventory <-> order integration.
 *
 * Rules (decided with the owner):
 *  - Ingredients are deducted the moment an order is placed (reserveForOrder).
 *  - Cancelling before the kitchen starts returns everything.
 *  - Cancelling after the kitchen started: food is written off as waste,
 *    packaging goes back to stock.
 *  - Once an order is served / delivered its stock is CONSUMED: nothing can return it.
 *  - Everything an order took is recorded in order_inventory_ledger, so a return
 *    is exact and can only happen once per row.
 *
 * All functions that take a `client` run inside the caller's transaction.
 */
import { randomUUID } from 'crypto';
import { getDbPool, query as dbQuery } from '../config/db.js';
import { emitOrderUpdate } from '../utils/realtimeEvents.js';
import {
  computeRequirementLines,
  aggregateLines,
  computeServings,
  computeServingsForFulfillment,
  FULFILLMENTS,
  normalizeFulfillment,
  stockStatus,
} from '../utils/inventoryMath.js';

export { normalizeFulfillment };

const INFO = '[INVENTORY]';

export class InsufficientStockError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'InsufficientStockError';
    this.statusCode = 409;
    this.code = 'INSUFFICIENT_STOCK';
    this.details = details;
  }
}

const txId = () => `itx-${randomUUID()}`;

/**
 * Runs a statement that is nice-to-have (e.g. a column added by a later migration).
 * A failure inside a Postgres transaction aborts the whole transaction, so the statement
 * runs under a savepoint: if it fails, only it is undone and the order carries on.
 */
async function optionalStatement(client, sql, params) {
  await client.query('SAVEPOINT inv_optional');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT inv_optional');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT inv_optional');
    console.warn(`${INFO} Optional update skipped (${err.code || ''}): ${err.message}`);
  }
}
const refFor = (prefix, orderId) => `${prefix}-${String(orderId)}`.slice(0, 50);
const round4 = (n) => Math.round(n * 10000) / 10000;

/** True when the inventory tables exist (older databases that have not migrated yet). */
let inventoryReady = null;
async function hasInventoryTables(client) {
  if (inventoryReady === true) return true;
  try {
    const { rows } = await client.query(
      `SELECT to_regclass('public.order_inventory_ledger') AS l, to_regclass('public.inventory_ingredients') AS i`
    );
    inventoryReady = Boolean(rows[0]?.l && rows[0]?.i);
  } catch {
    inventoryReady = false;
  }
  return inventoryReady;
}

/** Loads recipes for the given menu items, resolving legacy ids / missing ids by product name. */
async function loadRecipesForItems(client, items) {
  const ids = new Set();
  const names = new Set();
  for (const it of items) {
    if (it.productId) ids.add(String(it.productId));
    if (it.name) names.add(String(it.name).toLowerCase());
  }

  // name -> product ids (covers legacy item-0xx and null product_id rows)
  const byName = new Map();
  if (names.size > 0) {
    const { rows } = await client.query(
      `SELECT id::text AS id, LOWER(name) AS name FROM products WHERE LOWER(name) = ANY($1::text[])`,
      [[...names]]
    );
    for (const r of rows) {
      byName.set(r.name, [...(byName.get(r.name) || []), r.id]);
      ids.add(r.id);
    }
  }

  const recipes = new Map();
  if (ids.size === 0) return { recipes, resolve: () => null };

  const idList = [...ids];
  const rec = await client.query(
    `SELECT product_id FROM product_recipes WHERE product_id = ANY($1::text[]) AND is_configured = TRUE`,
    [idList]
  );
  const ings = await client.query(
    `SELECT product_id, ingredient_id, ingredient_name, portion_quantity, unit
     FROM recipe_ingredients WHERE product_id = ANY($1::text[])`,
    [idList]
  );
  const pkgs = await client.query(
    `SELECT product_id, packaging_id, quantity, unit, fulfillment_type, scope, shared_capacity
     FROM recipe_packaging WHERE product_id = ANY($1::text[])`,
    [idList]
  );

  for (const r of rec.rows) recipes.set(r.product_id, { productId: r.product_id, ingredients: [], packaging: [] });
  for (const r of ings.rows) {
    recipes.get(r.product_id)?.ingredients.push({
      ingredientId: r.ingredient_id,
      ingredientName: r.ingredient_name,
      portion: Number(r.portion_quantity),
      unit: r.unit,
    });
  }
  for (const r of pkgs.rows) {
    recipes.get(r.product_id)?.packaging.push({
      packagingId: r.packaging_id,
      quantity: Number(r.quantity),
      unit: r.unit,
      fulfillmentType: r.fulfillment_type,
      scope: r.scope,
      sharedCapacity: r.shared_capacity ? Number(r.shared_capacity) : 1,
    });
  }

  const resolve = (item) => {
    const direct = item.productId && recipes.has(String(item.productId)) ? String(item.productId) : null;
    if (direct) return direct;
    const candidates = byName.get(String(item.name || '').toLowerCase()) || [];
    return candidates.find((c) => recipes.has(c)) || null;
  };
  return { recipes, resolve };
}

/** Normalises the many item shapes used by the order routes. */
function toOrderItems(rawItems) {
  return (rawItems || []).map((it) => ({
    orderItemId: it.orderItemId ?? it.order_item_id ?? (typeof it.id === 'number' ? it.id : null),
    productId: it.product_id || it.productId || it.item?.id || null,
    name: it.name || it.product_name_snapshot || it.item?.name || '',
    quantity: Number(it.quantity) || 1,
  }));
}

async function loadIngredientsLocked(client, ids) {
  if (ids.length === 0) return new Map();
  const { rows } = await client.query(
    `SELECT id, name, base_unit, item_type, current_stock, min_stock_level, category
     FROM inventory_ingredients WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
    [ids]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * What an order still holds: its dishes (with quantities) and its shared packaging.
 * Used when dishes are added to an existing order, so packaging that is shared by the
 * whole order (one bag per N dishes) is counted once for the order, not once per call.
 */
async function loadOrderHoldings(client, orderId) {
  const dishes = await client.query(
    `SELECT l.order_item_id, l.product_id, MAX(oi.quantity) AS quantity
       FROM order_inventory_ledger l
       JOIN order_items oi ON oi.id = l.order_item_id
      WHERE l.order_id = $1 AND l.state = 'RESERVED'
        AND l.order_item_id IS NOT NULL AND l.product_id IS NOT NULL
      GROUP BY l.order_item_id, l.product_id`,
    [String(orderId)]
  );
  // shared lines are the ones that belong to the order as a whole (no dish on them)
  const shared = await client.query(
    `SELECT ingredient_id, SUM(quantity) AS quantity
       FROM order_inventory_ledger
      WHERE order_id = $1 AND state = 'RESERVED' AND product_id IS NULL
      GROUP BY ingredient_id`,
    [String(orderId)]
  );
  return {
    heldItems: dishes.rows.map((r) => ({
      orderItemId: r.order_item_id,
      productId: r.product_id,
      name: '',
      quantity: Number(r.quantity) || 1,
    })),
    heldShared: new Map(shared.rows.map((r) => [r.ingredient_id, Number(r.quantity)])),
  };
}

async function writeStock(client, ing, newStock) {
  const status = stockStatus(newStock, Number(ing.min_stock_level) || 0);
  await client.query(
    `UPDATE inventory_ingredients SET current_stock = $2, status = $3, updated_at = NOW() WHERE id = $1`,
    [ing.id, newStock, status]
  );
  ing.current_stock = newStock;
}

async function logMovement(client, ing, { orderId, type, delta, stockAfter, reason, performedBy, refPrefix }) {
  await client.query(
    `INSERT INTO inventory_transactions
       (id, reference_no, ingredient_id, ingredient_name, item_type, category, type,
        quantity_delta, unit, stock_after, performed_by, reason, order_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      txId(),
      refFor(refPrefix, orderId),
      ing.id,
      ing.name,
      ing.item_type,
      ing.category || 'Uncategorized',
      type,
      delta,
      ing.base_unit,
      stockAfter,
      performedBy || 'System',
      reason,
      String(orderId),
    ]
  );
}

/**
 * Takes the ingredients an order needs out of stock.
 * Throws InsufficientStockError (409) when anything is short; the caller's transaction should roll back.
 * Idempotent: if the order already holds a reservation, nothing happens (use `append` to add new items).
 */
export async function reserveForOrder(client, orderId, rawItems, fulfillmentInput, opts = {}) {
  if (!(await hasInventoryTables(client))) return { reserved: false, reason: 'NO_INVENTORY_TABLES' };

  if (!opts.append) {
    const existing = await client.query(
      `SELECT 1 FROM order_inventory_ledger WHERE order_id = $1 AND state = 'RESERVED' LIMIT 1`,
      [String(orderId)]
    );
    if (existing.rows.length > 0) return { reserved: false, reason: 'ALREADY_RESERVED' };
  }

  const items = toOrderItems(rawItems);
  const fulfillment = normalizeFulfillment(fulfillmentInput);
  // Adding dishes to an order: the dishes it already holds matter for shared packaging
  const { heldItems, heldShared } = opts.append
    ? await loadOrderHoldings(client, orderId)
    : { heldItems: [], heldShared: new Map() };
  const { recipes, resolve } = await loadRecipesForItems(client, [...items, ...heldItems]);
  const resolvedItems = items
    .map((it) => ({ ...it, productId: resolve(it) }))
    .filter((it) => it.productId);
  if (resolvedItems.length === 0) return { reserved: false, reason: 'NO_RECIPES' };
  const resolvedHeld = heldItems.filter((it) => recipes.has(it.productId));

  if (!opts.append) {
    // A fresh reservation: remember the order type, and clear any "kitchen started" mark left by
    // an earlier order that used the same id (the POS re-uses its short order numbers).
    await optionalStatement(
      client,
      `UPDATE orders SET inventory_fulfillment = $2, inventory_prep_started_at = NULL WHERE id = $1`,
      [String(orderId), fulfillment]
    );
  }

  // All ingredient metadata (food + packaging) used by these recipes
  const ingredientIds = new Set();
  for (const it of [...resolvedItems, ...resolvedHeld]) {
    const r = recipes.get(it.productId);
    r.ingredients.forEach((i) => ingredientIds.add(i.ingredientId));
    r.packaging.forEach((p) => ingredientIds.add(p.packagingId));
  }
  const locked = await loadIngredientsLocked(client, [...ingredientIds].sort());
  const ingredientMeta = new Map(
    [...locked.values()].map((r) => [r.id, { baseUnit: r.base_unit, itemType: r.item_type }])
  );

  let lines = computeRequirementLines({ items: resolvedItems, recipes, ingredientMeta, fulfillment });
  if (opts.append) {
    // Shared packaging is worked out for the whole order; only take what it does not hold yet
    const wholeOrder = computeRequirementLines({
      items: [...resolvedHeld, ...resolvedItems],
      recipes,
      ingredientMeta,
      fulfillment,
    });
    lines = lines.filter((l) => l.productId !== null);
    for (const l of wholeOrder.filter((x) => x.productId === null)) {
      const extra = round4(l.quantity - (heldShared.get(l.ingredientId) || 0));
      if (extra > 0) lines.push({ ...l, quantity: extra });
    }
  }
  if (lines.length === 0) return { reserved: false, reason: 'NOTHING_TO_RESERVE' };
  const totals = aggregateLines(lines);

  // Verify stock
  const shortages = [];
  for (const [ingredientId, needed] of totals) {
    const ing = locked.get(ingredientId);
    const available = Number(ing?.current_stock) || 0;
    if (!ing || available + 1e-9 < needed) {
      shortages.push({ ingredientId, name: ing?.name || ingredientId, unit: ing?.base_unit, needed, available });
    }
  }
  if (shortages.length > 0) {
    const shortIds = new Set(shortages.map((s) => s.ingredientId));
    const stockById = new Map(
      [...locked.values()].map((r) => [r.id, { baseUnit: r.base_unit, stock: Number(r.current_stock), name: r.name }])
    );
    const affected = [];
    for (const it of resolvedItems) {
      const r = recipes.get(it.productId);
      const usesShort = r.ingredients.some((i) => shortIds.has(i.ingredientId)) || r.packaging.some((p) => shortIds.has(p.packagingId));
      if (!usesShort) continue;
      const { servings } = computeServings(r, stockById);
      affected.push({ name: it.name || it.productId, productId: it.productId, remaining: servings ?? 0 });
    }
    const first = affected[0];
    const message = first
      ? first.remaining > 0
        ? `Not enough stock for "${first.name}" — only ${first.remaining} left.`
        : `"${first.name}" is sold out.`
      : `Not enough "${shortages[0].name}" in stock to prepare this order.`;
    throw new InsufficientStockError(message, { shortages, items: affected });
  }

  // Apply
  for (const [ingredientId, needed] of totals) {
    const ing = locked.get(ingredientId);
    const newStock = Math.round((Number(ing.current_stock) - needed) * 10000) / 10000;
    await writeStock(client, ing, newStock);
    await logMovement(client, ing, {
      orderId,
      type: 'CONSUMPTION',
      delta: -needed,
      stockAfter: newStock,
      reason: `Order ${orderId} placed`,
      performedBy: opts.performedBy,
      refPrefix: 'ORD',
    });
  }
  for (const l of lines) {
    await client.query(
      `INSERT INTO order_inventory_ledger (order_id, order_item_id, product_id, ingredient_id, item_type, quantity)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [String(orderId), l.orderItemId, l.productId, l.ingredientId, l.itemType, l.quantity]
    );
  }

  return { reserved: true, ingredientIds: [...totals.keys()] };
}

async function releaseRows(client, rows, orderId, { wasteFood, reason, performedBy }) {
  if (rows.length === 0) return { released: 0, wasted: 0, ingredientIds: [] };
  const ids = [...new Set(rows.map((r) => r.ingredient_id))].sort();
  const locked = await loadIngredientsLocked(client, ids);

  const returnTotals = new Map();
  const wasteTotals = new Map();
  for (const r of rows) {
    const qty = Number(r.quantity);
    const isWaste = wasteFood && r.item_type === 'FOOD';
    const bucket = isWaste ? wasteTotals : returnTotals;
    bucket.set(r.ingredient_id, (bucket.get(r.ingredient_id) || 0) + qty);
  }

  for (const [ingredientId, qty] of returnTotals) {
    const ing = locked.get(ingredientId);
    if (!ing) continue;
    const newStock = Math.round((Number(ing.current_stock) + qty) * 10000) / 10000;
    await writeStock(client, ing, newStock);
    await logMovement(client, ing, {
      orderId,
      type: 'ORDER_RETURN',
      delta: qty,
      stockAfter: newStock,
      reason,
      performedBy,
      refPrefix: 'RET',
    });
  }

  // Food that was already cooked stays deducted; its usage is re-booked as waste.
  // Only the quantity really written off is re-booked: an order that was edited or had
  // dishes returned earlier has older usage entries that those returns already cancel out.
  for (const [ingredientId, wasted] of wasteTotals) {
    const wasteReason = `${reason} — prepared food written off`;
    const used = await client.query(
      `SELECT id, quantity_delta FROM inventory_transactions
        WHERE order_id = $1 AND ingredient_id = $2 AND type = 'CONSUMPTION'
        ORDER BY timestamp DESC, id DESC`,
      [String(orderId), ingredientId]
    );
    let left = round4(wasted);
    const rebook = [];
    for (const u of used.rows) {
      const qty = Math.abs(Number(u.quantity_delta));
      if (left <= 0) break;
      if (qty > left + 1e-9) continue; // larger than what is left to write off: keep it as usage
      rebook.push(u.id);
      left = round4(left - qty);
    }
    if (rebook.length > 0) {
      await client.query(
        `UPDATE inventory_transactions SET type = 'WASTE', reason = $2 WHERE id = ANY($1::text[])`,
        [rebook, wasteReason]
      );
    }
    const ing = locked.get(ingredientId);
    if (left > 0 && ing) {
      // The rest is part of a bigger usage entry: reverse that part, then record it as waste.
      // Stock on hand does not move; the history still adds up.
      const onHand = Number(ing.current_stock);
      await logMovement(client, ing, {
        orderId,
        type: 'ORDER_RETURN',
        delta: left,
        stockAfter: round4(onHand + left),
        reason: `${reason} — usage re-booked as waste`,
        performedBy,
        refPrefix: 'RET',
      });
      await logMovement(client, ing, {
        orderId,
        type: 'WASTE',
        delta: -left,
        stockAfter: onHand,
        reason: wasteReason,
        performedBy,
        refPrefix: 'WST',
      });
    }
  }

  const rowIds = rows.map((r) => r.id);
  const wastedIds = rows.filter((r) => wasteFood && r.item_type === 'FOOD').map((r) => r.id);
  const returnedIds = rowIds.filter((id) => !wastedIds.includes(id));
  if (returnedIds.length > 0) {
    await client.query(
      `UPDATE order_inventory_ledger SET state = 'RETURNED', released_at = NOW() WHERE id = ANY($1::bigint[])`,
      [returnedIds]
    );
  }
  if (wastedIds.length > 0) {
    await client.query(
      `UPDATE order_inventory_ledger SET state = 'WASTED', released_at = NOW() WHERE id = ANY($1::bigint[])`,
      [wastedIds]
    );
  }
  return { released: returnedIds.length, wasted: wastedIds.length, ingredientIds: ids };
}

/** Returns an order's reserved stock. Food is written off if the kitchen had already started. */
export async function returnForOrder(client, orderId, opts = {}) {
  if (!(await hasInventoryTables(client))) return { released: 0, wasted: 0 };
  const open = await client.query(
    `SELECT id, ingredient_id, item_type, quantity FROM order_inventory_ledger
     WHERE order_id = $1 AND state = 'RESERVED' ORDER BY id FOR UPDATE`,
    [String(orderId)]
  );
  if (open.rows.length === 0) return { released: 0, wasted: 0 };

  let wasteFood = opts.wasteFood;
  if (wasteFood === undefined || opts.skipIfCompleted) {
    const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [String(orderId)]);
    // A finished order was served: its ingredients are genuinely used, nothing to return.
    if (opts.skipIfCompleted && rows[0]?.status === 'COMPLETED') {
      await markConsumed(client, orderId); // close it, so it is not mistaken for an open order later
      return { released: 0, wasted: 0 };
    }
    if (wasteFood === undefined) wasteFood = Boolean(rows[0]?.inventory_prep_started_at);
  }
  return releaseRows(client, open.rows, orderId, {
    wasteFood,
    reason: opts.reason || `Order ${orderId} cancelled`,
    performedBy: opts.performedBy,
  });
}

/** Returns stock for specific order items (kitchen out-of-stock flag, replaced items). */
export async function returnForItems(client, orderId, orderItemIds, opts = {}) {
  if (!(await hasInventoryTables(client)) || !orderItemIds?.length) return { released: 0, wasted: 0 };
  const open = await client.query(
    `SELECT id, ingredient_id, item_type, quantity FROM order_inventory_ledger
     WHERE order_id = $1 AND state = 'RESERVED' AND order_item_id = ANY($2::bigint[]) ORDER BY id FOR UPDATE`,
    [String(orderId), orderItemIds.map(Number).filter(Number.isFinite)]
  );
  return releaseRows(client, open.rows, orderId, {
    wasteFood: false,
    reason: opts.reason || `Items removed from order ${orderId}`,
    performedBy: opts.performedBy,
  });
}

/** The channel an order was reserved under (falls back to the order's own fulfillment type). */
export async function getOrderFulfillment(client, orderId) {
  const { rows } = await client.query(`SELECT * FROM orders WHERE id = $1`, [String(orderId)]);
  const r = rows[0] || {};
  return normalizeFulfillment(r.inventory_fulfillment, r.fulfillment_type);
}

export async function markPrepStarted(client, orderId) {
  await optionalStatement(
    client,
    `UPDATE orders SET inventory_prep_started_at = COALESCE(inventory_prep_started_at, NOW()) WHERE id = $1`,
    [String(orderId)]
  );
}

/**
 * The order was served / delivered: what it took is used for good.
 * Its ledger rows become CONSUMED, so a later void, delete or reset can never put the food or
 * packaging back, and the order no longer counts as one that is holding stock.
 * (Optional statement: databases that have not run migration 036 keep the old behaviour.)
 */
export async function markConsumed(client, orderId) {
  await optionalStatement(
    client,
    `UPDATE order_inventory_ledger SET state = 'CONSUMED', released_at = NOW()
      WHERE order_id = $1 AND state = 'RESERVED'`,
    [String(orderId)]
  );
}

/**
 * Locks, in one ordered pass, every stock item a change to an order will touch: what the
 * order holds now plus what the new items need. Editing an order gives stock back and then
 * takes stock; taking those row locks in two separate passes can deadlock with another order
 * placed at the same moment (each waits for an ingredient the other already locked).
 * Call it before returnForOrder + reserveForOrder inside the same transaction.
 */
export async function lockStockForOrderChange(client, orderId, rawItems = []) {
  if (!(await hasInventoryTables(client))) return;
  // same order as returnForOrder: the order's own ledger rows first, then the ingredients
  const held = await client.query(
    `SELECT ingredient_id FROM order_inventory_ledger
      WHERE order_id = $1 AND state = 'RESERVED' ORDER BY id FOR UPDATE`,
    [String(orderId)]
  );
  const ids = new Set(held.rows.map((r) => r.ingredient_id));
  const items = toOrderItems(rawItems);
  if (items.length > 0) {
    const { recipes, resolve } = await loadRecipesForItems(client, items);
    for (const it of items) {
      const recipe = recipes.get(resolve(it));
      if (!recipe) continue;
      recipe.ingredients.forEach((i) => ids.add(i.ingredientId));
      recipe.packaging.forEach((p) => ids.add(p.packagingId));
    }
  }
  await loadIngredientsLocked(client, [...ids].sort());
}

/** Runs fn(client) in its own transaction. */
export async function withTransaction(fn) {
  const pool = await getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Keeps inventory in step with an order status change. Safe to call repeatedly (idempotent) and never throws:
 * an inventory problem must not block a kitchen or cashier action.
 */
export async function syncInventoryForStatus(orderId, status, opts = {}) {
  const s = String(status || '').toUpperCase();
  const served = ['COMPLETED', 'DELIVERED', 'SERVED'].includes(s);
  const started = served || ['PREPARING', 'COOKING', 'READY', 'OUT_FOR_DELIVERY'].includes(s);
  const cancelled = ['CANCELLED', 'CANCEL_REQUESTED', 'KITCHEN_REJECTED'].includes(s);
  if (!started && !cancelled) return null;
  try {
    const result = await withTransaction(async (client) => {
      if (!(await hasInventoryTables(client))) return null;
      if (started) {
        await markPrepStarted(client, orderId);
        if (served) await markConsumed(client, orderId);
        return null;
      }
      return returnForOrder(client, orderId, opts);
    });
    if (result && (result.released > 0 || result.wasted > 0)) broadcastInventoryChange(result.ingredientIds);
    return result;
  } catch (err) {
    console.error(`${INFO} Could not sync inventory for order ${orderId} (${status}):`, err.message);
    return null;
  }
}

/** Convenience: return stock for a cancelled / deleted order inside its own transaction. */
export async function releaseOrderStock(orderId, opts = {}) {
  try {
    const result = await withTransaction((client) => returnForOrder(client, orderId, opts));
    if (result && (result.released > 0 || result.wasted > 0)) broadcastInventoryChange(result.ingredientIds);
    return result;
  } catch (err) {
    console.error(`${INFO} Could not return stock for order ${orderId}:`, err.message);
    return null;
  }
}

/**
 * Recalculates "servings left" from live stock (read-only: never deducts anything).
 *  - no filter: every configured recipe (used by GET /menu)
 *  - ingredientIds: only products whose BOM (food or packaging) references one of them
 * Each product gets a value per order type, because packaging differs between dine-in,
 * take-out/pickup and delivery. The smallest-capacity item in the BOM is the limit.
 *
 * @returns {Promise<Map<string, { servings: Record<string, number>, limitedBy: Record<string, string|null> }>>}
 */
export async function computeProductServings(queryable, { ingredientIds } = {}) {
  let productFilter = null;
  if (ingredientIds) {
    if (ingredientIds.length === 0) return new Map();
    const { rows } = await queryable.query(
      `SELECT product_id FROM recipe_ingredients WHERE ingredient_id = ANY($1::text[])
       UNION
       SELECT product_id FROM recipe_packaging WHERE packaging_id = ANY($1::text[])`,
      [ingredientIds]
    );
    productFilter = rows.map((r) => r.product_id);
    if (productFilter.length === 0) return new Map();
  }

  const where = productFilter ? 'AND product_id = ANY($1::text[])' : '';
  const params = productFilter ? [productFilter] : [];
  const rec = await queryable.query(`SELECT product_id FROM product_recipes WHERE is_configured = TRUE ${where}`, params);
  if (rec.rows.length === 0) return new Map();
  const ids = rec.rows.map((r) => r.product_id);

  const ings = await queryable.query(
    `SELECT product_id, ingredient_id, ingredient_name, portion_quantity, unit
       FROM recipe_ingredients WHERE product_id = ANY($1::text[])`,
    [ids]
  );
  let pkgs = { rows: [] };
  try {
    pkgs = await queryable.query(
      `SELECT product_id, packaging_id, packaging_name, quantity, unit, fulfillment_type, scope, shared_capacity
         FROM recipe_packaging WHERE product_id = ANY($1::text[])`,
      [ids]
    );
  } catch (err) {
    if (err.code !== '42703') throw err; // shared_capacity missing on an old database: ignore packaging
  }

  const neededStock = [...new Set([...ings.rows.map((r) => r.ingredient_id), ...pkgs.rows.map((r) => r.packaging_id)])];
  const stock = await queryable.query(
    `SELECT id, name, base_unit, current_stock FROM inventory_ingredients WHERE id = ANY($1::text[])`,
    [neededStock]
  );
  const stockById = new Map(stock.rows.map((r) => [r.id, { baseUnit: r.base_unit, stock: Number(r.current_stock), name: r.name }]));

  const recipes = new Map(ids.map((id) => [id, { productId: id, ingredients: [], packaging: [] }]));
  for (const r of ings.rows) {
    recipes.get(r.product_id)?.ingredients.push({
      ingredientId: r.ingredient_id,
      ingredientName: r.ingredient_name,
      portion: Number(r.portion_quantity),
      unit: r.unit,
    });
  }
  for (const r of pkgs.rows) {
    recipes.get(r.product_id)?.packaging.push({
      packagingId: r.packaging_id,
      packagingName: r.packaging_name,
      quantity: Number(r.quantity),
      unit: r.unit,
      fulfillmentType: r.fulfillment_type,
      scope: r.scope,
      sharedCapacity: r.shared_capacity ? Number(r.shared_capacity) : 1,
    });
  }

  const out = new Map();
  for (const [productId, recipe] of recipes) {
    if (recipe.ingredients.length === 0 && recipe.packaging.length === 0) continue;
    const servings = {};
    const limitedBy = {};
    for (const f of FULFILLMENTS) {
      const r = computeServingsForFulfillment(recipe, stockById, f);
      if (r.servings === null) continue;
      servings[f] = r.servings;
      limitedBy[f] = r.limitedBy;
    }
    if (Object.keys(servings).length > 0) out.set(productId, { servings, limitedBy });
  }
  return out;
}

/** Every product's servings (GET /menu). Returns an empty map if inventory tables are missing. */
export async function getMenuServings(queryable) {
  try {
    return await computeProductServings(queryable);
  } catch (err) {
    if (err.code !== '42P01') console.error(`${INFO} Could not compute menu servings:`, err.message);
    return new Map();
  }
}

/** Serialises computeProductServings output for API responses / events. */
export function servingsPayload(entry) {
  return { servings: entry.servings, limitedBy: entry.limitedBy };
}

const pendingIngredientIds = new Set();
let pendingFullRefresh = false;
let broadcastTimer = null;

/**
 * Tells every open screen that stock changed (debounced, after the transaction committed).
 * With ingredient ids, only the products that use those items are recalculated and their
 * new servings are pushed in the event, so screens update without re-reading the whole menu.
 * Without ids, screens are told to re-read the menu.
 */
export function broadcastInventoryChange(ingredientIds) {
  if (Array.isArray(ingredientIds)) ingredientIds.forEach((id) => pendingIngredientIds.add(String(id)));
  else pendingFullRefresh = true;
  if (broadcastTimer) return;

  broadcastTimer = setTimeout(async () => {
    broadcastTimer = null;
    const ids = [...pendingIngredientIds];
    const full = pendingFullRefresh;
    pendingIngredientIds.clear();
    pendingFullRefresh = false;

    if (full || ids.length === 0) {
      emitOrderUpdate({ type: 'INVENTORY_CHANGED', full: true, timestamp: Date.now() });
      return;
    }
    try {
      const affected = await computeProductServings({ query: dbQuery }, { ingredientIds: ids });
      const products = {};
      for (const [productId, entry] of affected) products[productId] = servingsPayload(entry);
      emitOrderUpdate({ type: 'INVENTORY_CHANGED', ingredientIds: ids, products, timestamp: Date.now() });
    } catch (err) {
      console.error(`${INFO} Could not recalculate affected products:`, err.message);
      emitOrderUpdate({ type: 'INVENTORY_CHANGED', full: true, timestamp: Date.now() });
    }
  }, 150);
}

/**
 * Used when all transactions are wiped: what open orders still hold goes back to stock, then the
 * ledger is cleared. Orders that were already served keep what they used.
 */
export async function returnAllReservedStock(client) {
  if (!(await hasInventoryTables(client))) return 0;
  const { rows } = await client.query(
    `SELECT DISTINCT l.order_id
       FROM order_inventory_ledger l
       LEFT JOIN orders o ON o.id = l.order_id
      WHERE l.state = 'RESERVED' AND COALESCE(o.status, '') <> 'COMPLETED'`
  );
  for (const r of rows) {
    await returnForOrder(client, r.order_id, { wasteFood: false, reason: 'Transactions reset', performedBy: 'System' });
  }
  await client.query(`TRUNCATE TABLE order_inventory_ledger RESTART IDENTITY`);
  return rows.length;
}

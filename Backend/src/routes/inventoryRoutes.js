/**
 * Admin inventory API. The admin screen used to keep everything in the browser;
 * this makes inventory shared and durable, and lets orders consume the same stock.
 *
 * Response shapes match Frontend/src/features/inventory/inventoryTypes.ts (camelCase).
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { withTransaction, broadcastInventoryChange } from '../services/inventoryService.js';
import { stockStatus } from '../utils/inventoryMath.js';

const router = Router();
const guard = [requireAuth, requireRole(['admin'])];

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const iso = (v) => (v ? new Date(v).toISOString() : undefined);
const shortId = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;
const actor = (req) => req.user?.fullname || req.user?.name || req.user?.username || 'Store Admin';

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* ------------------------------------------------------------- mappers */

const mapIngredient = (r) => ({
  id: r.id,
  name: r.name,
  sku: r.sku || undefined,
  itemType: r.item_type,
  category: r.category,
  baseUnit: r.base_unit,
  currentStock: num(r.current_stock),
  minStockLevel: num(r.min_stock_level),
  preferredRestockQty: num(r.preferred_restock_qty),
  costPerUnit: num(r.cost_per_unit),
  supplierId: r.supplier_id || undefined,
  supplierName: r.supplier_name || undefined,
  storageNotes: r.storage_notes || undefined,
  status: r.status,
  lastRestockedAt: iso(r.last_restocked_at),
  updatedAt: iso(r.updated_at),
});

const mapSupplier = (r) => ({
  id: r.id,
  name: r.name,
  contactPerson: r.contact_person || '',
  contactNumber: r.contact_number || '',
  email: r.email || '',
  address: r.address || '',
  categoriesSupplied: r.categories_supplied || [],
  leadTimeDays: num(r.lead_time_days, 1),
  notes: r.notes || undefined,
  status: r.status,
  createdAt: iso(r.created_at),
});

const mapTransaction = (r) => ({
  id: r.id,
  referenceNo: r.reference_no,
  timestamp: iso(r.timestamp),
  ingredientId: r.ingredient_id,
  ingredientName: r.ingredient_name,
  itemType: r.item_type,
  category: r.category,
  type: r.type,
  quantityDelta: num(r.quantity_delta),
  unit: r.unit,
  stockAfter: num(r.stock_after),
  performedBy: r.performed_by || '',
  reason: r.reason || undefined,
  orderId: r.order_id || undefined,
});

function buildPurchaseOrders(poRows, itemRows) {
  const byPo = new Map();
  for (const i of itemRows) {
    const list = byPo.get(i.purchase_order_id) || [];
    list.push({
      id: i.id,
      ingredientId: i.ingredient_id,
      ingredientName: i.ingredient_name,
      itemType: i.item_type,
      category: i.category,
      orderedQuantity: num(i.ordered_quantity),
      receivedQuantity: num(i.received_quantity),
      unit: i.unit,
      unitCost: num(i.unit_cost),
      totalCost: num(i.total_cost),
      batchNumber: i.batch_number || undefined,
      expirationDate: i.expiration_date ? new Date(i.expiration_date).toISOString().split('T')[0] : undefined,
    });
    byPo.set(i.purchase_order_id, list);
  }
  return poRows.map((p) => ({
    id: p.id,
    poNumber: p.po_number,
    supplierId: p.supplier_id || '',
    supplierName: p.supplier_name,
    orderDate: iso(p.order_date),
    expectedDeliveryDate: iso(p.expected_delivery_date),
    status: p.status,
    items: byPo.get(p.id) || [],
    totalAmount: num(p.total_amount),
    notes: p.notes || undefined,
    receivedAt: iso(p.received_at),
    receivedBy: p.received_by || undefined,
    createdAt: iso(p.created_at),
  }));
}

function buildRecipes(recipeRows, ingRows, pkgRows) {
  const ings = new Map();
  for (const r of ingRows) {
    const list = ings.get(r.product_id) || [];
    list.push({
      ingredientId: r.ingredient_id,
      ingredientName: r.ingredient_name,
      portionQuantity: num(r.portion_quantity),
      unit: r.unit,
      estimatedCost: num(r.estimated_cost),
    });
    ings.set(r.product_id, list);
  }
  const pkgs = new Map();
  for (const r of pkgRows) {
    const list = pkgs.get(r.product_id) || [];
    list.push({
      id: r.id,
      packagingId: r.packaging_id,
      packagingName: r.packaging_name,
      category: r.category,
      quantity: num(r.quantity, 1),
      unit: r.unit,
      fulfillmentType: r.fulfillment_type,
      scope: r.scope,
      sharedCapacity: r.shared_capacity ? num(r.shared_capacity) : undefined,
      estimatedCost: num(r.estimated_cost),
      notes: r.notes || undefined,
    });
    pkgs.set(r.product_id, list);
  }
  return recipeRows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    productCategory: r.product_category || '',
    productPrice: num(r.product_price),
    yieldServings: num(r.yield_servings, 1),
    ingredients: ings.get(r.product_id) || [],
    packagingRequirements: pkgs.get(r.product_id) || [],
    preparationInstructions: r.preparation_instructions || undefined,
    totalFoodCost: num(r.total_food_cost),
    totalPackagingCost: num(r.total_packaging_cost),
    totalRawCost: num(r.total_raw_cost),
    grossMarginPercent: num(r.gross_margin_percent),
    isConfigured: Boolean(r.is_configured),
    updatedAt: iso(r.updated_at),
  }));
}

async function loadState(q) {
  const [ing, sup, rec, ri, rp, tx, po, poi] = [
    await q.query(`SELECT * FROM inventory_ingredients ORDER BY updated_at DESC, name`),
    await q.query(`SELECT * FROM inventory_suppliers ORDER BY created_at DESC, name`),
    await q.query(`SELECT * FROM product_recipes ORDER BY product_name`),
    await q.query(`SELECT * FROM recipe_ingredients ORDER BY id`),
    await q.query(`SELECT * FROM recipe_packaging ORDER BY id`),
    await q.query(`SELECT * FROM inventory_transactions ORDER BY timestamp DESC LIMIT 1000`),
    await q.query(`SELECT * FROM inventory_purchase_orders ORDER BY created_at DESC`),
    await q.query(`SELECT * FROM inventory_purchase_order_items`),
  ];
  return {
    ingredients: ing.rows.map(mapIngredient),
    suppliers: sup.rows.map(mapSupplier),
    recipes: buildRecipes(rec.rows, ri.rows, rp.rows),
    transactions: tx.rows.map(mapTransaction),
    purchaseOrders: buildPurchaseOrders(po.rows, poi.rows),
  };
}

/* ------------------------------------------------------------- helpers */

async function lockIngredient(client, id) {
  const { rows } = await client.query(`SELECT * FROM inventory_ingredients WHERE id = $1 FOR UPDATE`, [id]);
  if (rows.length === 0) throw new HttpError(404, 'Item not found.', 'NOT_FOUND');
  return rows[0];
}

async function applyMovement(client, ing, { delta, type, reason, performedBy, refPrefix = 'MAN', timestamp, restocked, orderId = null }) {
  const newStock = Math.round((num(ing.current_stock) + delta) * 10000) / 10000;
  if (newStock < 0) {
    throw new HttpError(
      400,
      `Only ${num(ing.current_stock).toLocaleString()} ${ing.base_unit} of "${ing.name}" is on hand.`,
      'INSUFFICIENT_STOCK'
    );
  }
  const status = stockStatus(newStock, num(ing.min_stock_level));
  const { rows } = await client.query(
    `UPDATE inventory_ingredients
        SET current_stock = $2, status = $3, updated_at = NOW(),
            last_restocked_at = CASE WHEN $4 THEN NOW() ELSE last_restocked_at END
      WHERE id = $1 RETURNING *`,
    [ing.id, newStock, status, Boolean(restocked)]
  );
  const txRow = await client.query(
    `INSERT INTO inventory_transactions
       (id, reference_no, ingredient_id, ingredient_name, item_type, category, type,
        quantity_delta, unit, stock_after, performed_by, reason, order_id, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14, NOW()))
     RETURNING *`,
    [
      `itx-${randomUUID()}`,
      `${refPrefix}-${Date.now().toString().slice(-6)}`,
      ing.id,
      ing.name,
      ing.item_type,
      ing.category || 'Uncategorized',
      type,
      delta,
      ing.base_unit,
      newStock,
      performedBy,
      reason || null,
      orderId,
      timestamp || null,
    ]
  );
  return { ingredient: rows[0], transaction: txRow.rows[0] };
}

function validateIngredientBody(b) {
  const name = String(b.name || '').trim();
  if (!name) throw new HttpError(400, 'Name is required.', 'VALIDATION');
  if (!['FOOD', 'PACKAGING'].includes(b.itemType)) throw new HttpError(400, 'Item type must be FOOD or PACKAGING.', 'VALIDATION');
  if (!b.baseUnit) throw new HttpError(400, 'Base unit is required.', 'VALIDATION');
  for (const [key, label] of [
    ['currentStock', 'Stock'],
    ['minStockLevel', 'Minimum level'],
    ['preferredRestockQty', 'Reorder quantity'],
    ['costPerUnit', 'Unit cost'],
  ]) {
    if (b[key] !== undefined && b[key] !== null && num(b[key], NaN) < 0) {
      throw new HttpError(400, `${label} cannot be negative.`, 'VALIDATION');
    }
  }
  return name;
}

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, error: err.code, message: err.message });
    }
    if (err.code === '23505') return res.status(409).json({ success: false, error: 'DUPLICATE', message: 'That record already exists.' });
    if (err.code === '23503') return res.status(400).json({ success: false, error: 'INVALID_REFERENCE', message: 'A referenced item no longer exists.' });
    if (err.code === '42P01') return res.status(503).json({ success: false, error: 'INVENTORY_NOT_READY', message: 'Inventory tables are not available yet. Run the database migrations.' });
    console.error('[INVENTORY API]', err);
    return res.status(500).json({ success: false, message: 'Inventory request failed.', error: err.message });
  }
};

/* -------------------------------------------------------------- routes */

// Read-only list of what is running low, for the kitchen / cashier screens
router.get('/inventory/alerts', requireAuth, requireRole(['admin', 'kitchen', 'cashier', 'assistant']), wrap(async (_req, res) => {
  const data = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, name, item_type, category, base_unit, current_stock, min_stock_level, status
         FROM inventory_ingredients
        WHERE status IN ('LOW_STOCK', 'OUT_OF_STOCK')
        ORDER BY (status = 'OUT_OF_STOCK') DESC, current_stock / NULLIF(min_stock_level, 0) ASC NULLS FIRST, name`
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      itemType: r.item_type,
      category: r.category,
      unit: r.base_unit,
      currentStock: num(r.current_stock),
      minStockLevel: num(r.min_stock_level),
      status: r.status,
    }));
  });
  res.json({ success: true, data });
}));

router.get('/inventory/state', ...guard, wrap(async (_req, res) => {
  const data = await withTransaction((client) => loadState(client));
  res.json({ success: true, data });
}));

// --- Ingredients & packaging
router.post('/inventory/ingredients', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const name = validateIngredientBody(b);
  const id = shortId(b.itemType === 'PACKAGING' ? 'pkg' : 'ing');
  const out = await withTransaction(async (client) => {
    const dupe = await client.query(`SELECT 1 FROM inventory_ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1`, [name]);
    if (dupe.rows.length) throw new HttpError(409, `"${name}" already exists in the catalog.`, 'DUPLICATE');
    const stock = num(b.currentStock);
    const min = num(b.minStockLevel);
    const { rows } = await client.query(
      `INSERT INTO inventory_ingredients
         (id, name, sku, item_type, category, base_unit, current_stock, min_stock_level, preferred_restock_qty,
          cost_per_unit, supplier_id, supplier_name, storage_notes, status, last_restocked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        id, name, b.sku || null, b.itemType, b.category || 'Other', b.baseUnit, stock, min,
        num(b.preferredRestockQty), num(b.costPerUnit), b.supplierId || null, b.supplierName || null,
        b.storageNotes || null, stockStatus(stock, min), stock > 0 ? new Date() : null,
      ]
    );
    let transaction = null;
    if (stock > 0) {
      const t = await client.query(
        `INSERT INTO inventory_transactions
           (id, reference_no, ingredient_id, ingredient_name, item_type, category, type, quantity_delta, unit, stock_after, performed_by, reason)
         VALUES ($1,$2,$3,$4,$5,$6,'STOCK_RECEIVED',$7,$8,$7,$9,$10) RETURNING *`,
        [
          `itx-${randomUUID()}`, `INTAKE-${Date.now().toString().slice(-6)}`, id, name, b.itemType,
          b.category || 'Other', stock, b.baseUnit, actor(req), 'Opening stock on registration',
        ]
      );
      transaction = t.rows[0];
    }
    return { ingredient: rows[0], transaction };
  });
  broadcastInventoryChange();
  res.status(201).json({
    success: true,
    data: { ingredient: mapIngredient(out.ingredient), transaction: out.transaction ? mapTransaction(out.transaction) : null },
  });
}));

router.put('/inventory/ingredients/:id', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const name = validateIngredientBody(b);
  const out = await withTransaction(async (client) => {
    const current = await lockIngredient(client, req.params.id);
    const dupe = await client.query(
      `SELECT 1 FROM inventory_ingredients WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [name, current.id]
    );
    if (dupe.rows.length) throw new HttpError(409, `"${name}" already exists in the catalog.`, 'DUPLICATE');

    const min = num(b.minStockLevel);
    await client.query(
      `UPDATE inventory_ingredients SET
         name=$2, item_type=$3, category=$4, base_unit=$5, min_stock_level=$6, preferred_restock_qty=$7,
         cost_per_unit=$8, supplier_id=$9, supplier_name=$10, storage_notes=$11, updated_at=NOW()
       WHERE id=$1`,
      [
        current.id, name, b.itemType, b.category || current.category, b.baseUnit, min, num(b.preferredRestockQty),
        num(b.costPerUnit), b.supplierId || null, b.supplierName || null, b.storageNotes || null,
      ]
    );
    // Changing the counted stock is recorded as a correction so history always adds up
    let transaction = null;
    const target = b.currentStock === undefined ? num(current.current_stock) : num(b.currentStock);
    const delta = Math.round((target - num(current.current_stock)) * 10000) / 10000;
    const refreshed = (await client.query(`SELECT * FROM inventory_ingredients WHERE id = $1`, [current.id])).rows[0];
    if (delta !== 0) {
      const moved = await applyMovement(client, refreshed, {
        delta, type: 'ADJUSTMENT', reason: 'Stock corrected while editing the item', performedBy: actor(req), refPrefix: 'ADJ',
      });
      transaction = moved.transaction;
      return { ingredient: moved.ingredient, transaction };
    }
    const status = stockStatus(num(refreshed.current_stock), min);
    const final = await client.query(`UPDATE inventory_ingredients SET status = $2 WHERE id = $1 RETURNING *`, [current.id, status]);
    return { ingredient: final.rows[0], transaction };
  });
  broadcastInventoryChange();
  res.json({
    success: true,
    data: { ingredient: mapIngredient(out.ingredient), transaction: out.transaction ? mapTransaction(out.transaction) : null },
  });
}));

router.delete('/inventory/ingredients/:id', ...guard, wrap(async (req, res) => {
  await withTransaction(async (client) => {
    const ing = await lockIngredient(client, req.params.id);
    const used = await client.query(
      `SELECT r.product_name FROM product_recipes r
        WHERE r.product_id IN (SELECT product_id FROM recipe_ingredients WHERE ingredient_id = $1
                               UNION SELECT product_id FROM recipe_packaging WHERE packaging_id = $1)
        LIMIT 5`,
      [ing.id]
    );
    if (used.rows.length > 0) {
      throw new HttpError(
        409,
        `"${ing.name}" is used in recipes (${used.rows.map((r) => r.product_name).join(', ')}). Remove it from those recipes first.`,
        'IN_USE'
      );
    }
    const open = await client.query(
      `SELECT 1 FROM order_inventory_ledger WHERE ingredient_id = $1 AND state = 'RESERVED' LIMIT 1`,
      [ing.id]
    );
    if (open.rows.length > 0) throw new HttpError(409, `"${ing.name}" is reserved by open orders.`, 'IN_USE');
    await client.query(`DELETE FROM inventory_ingredients WHERE id = $1`, [ing.id]);
  });
  broadcastInventoryChange();
  res.json({ success: true });
}));

// --- Stock movements (restock, usage, waste, count corrections)
router.post('/inventory/movements', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const delta = num(b.delta, NaN);
  if (!Number.isFinite(delta) || delta === 0) throw new HttpError(400, 'Quantity must be a number other than 0.', 'VALIDATION');
  const type = ['STOCK_RECEIVED', 'CONSUMPTION', 'WASTE', 'ADJUSTMENT'].includes(b.type)
    ? b.type
    : delta > 0 ? 'STOCK_RECEIVED' : 'ADJUSTMENT';
  const out = await withTransaction(async (client) => {
    const ing = await lockIngredient(client, b.ingredientId);
    const stamp = b.purchaseDate ? new Date(`${b.purchaseDate}T12:00:00`) : null;
    const moved = await applyMovement(client, ing, {
      delta,
      type,
      reason: b.reason,
      performedBy: actor(req),
      refPrefix: delta < 0 ? 'ADJ' : 'RCV',
      timestamp: stamp,
      restocked: delta > 0,
    });
    if (b.seller) {
      // remember where this stock came from
      const upd = await client.query(
        `UPDATE inventory_ingredients SET supplier_name = $2 WHERE id = $1 RETURNING *`,
        [ing.id, String(b.seller).slice(0, 150)]
      );
      moved.ingredient = upd.rows[0];
    }
    return moved;
  });
  broadcastInventoryChange();
  res.status(201).json({
    success: true,
    data: { ingredient: mapIngredient(out.ingredient), transaction: mapTransaction(out.transaction) },
  });
}));

// --- Suppliers
function validateSupplier(b) {
  const name = String(b.name || '').trim();
  if (!name) throw new HttpError(400, 'Supplier name is required.', 'VALIDATION');
  return name;
}

router.post('/inventory/suppliers', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const name = validateSupplier(b);
  const { rows } = await withTransaction((client) =>
    client.query(
      `INSERT INTO inventory_suppliers (id, name, contact_person, contact_number, email, address, categories_supplied, lead_time_days, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [shortId('sup'), name, b.contactPerson || null, b.contactNumber || null, b.email || null, b.address || null,
       b.categoriesSupplied || [], Math.max(1, num(b.leadTimeDays, 1)), b.notes || null, b.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE']
    )
  );
  res.status(201).json({ success: true, data: mapSupplier(rows[0]) });
}));

router.put('/inventory/suppliers/:id', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const name = validateSupplier(b);
  const { rows } = await withTransaction((client) =>
    client.query(
      `UPDATE inventory_suppliers SET name=$2, contact_person=$3, contact_number=$4, email=$5, address=$6,
         categories_supplied=$7, lead_time_days=$8, notes=$9, status=$10 WHERE id=$1 RETURNING *`,
      [req.params.id, name, b.contactPerson || null, b.contactNumber || null, b.email || null, b.address || null,
       b.categoriesSupplied || [], Math.max(1, num(b.leadTimeDays, 1)), b.notes || null, b.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE']
    )
  );
  if (rows.length === 0) throw new HttpError(404, 'Supplier not found.', 'NOT_FOUND');
  res.json({ success: true, data: mapSupplier(rows[0]) });
}));

router.delete('/inventory/suppliers/:id', ...guard, wrap(async (req, res) => {
  await withTransaction((client) => client.query(`DELETE FROM inventory_suppliers WHERE id = $1`, [req.params.id]));
  res.json({ success: true });
}));

// --- Recipes
router.put('/inventory/recipes/:productId', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const productId = req.params.productId;
  if (!Array.isArray(b.ingredients) || b.ingredients.length === 0) {
    throw new HttpError(400, 'A recipe needs at least one ingredient.', 'VALIDATION');
  }

  // merge repeated ingredients (same unit) so the unique key holds
  const merged = new Map();
  for (const i of b.ingredients) {
    if (!i.ingredientId) throw new HttpError(400, 'Choose an ingredient on every line.', 'VALIDATION');
    const portion = num(i.portionQuantity);
    if (!(portion > 0)) throw new HttpError(400, `Portion for "${i.ingredientName || i.ingredientId}" must be greater than 0.`, 'VALIDATION');
    const prev = merged.get(i.ingredientId);
    if (prev) {
      if (prev.unit !== i.unit) throw new HttpError(400, `"${i.ingredientName}" is listed twice with different units.`, 'VALIDATION');
      prev.portionQuantity += portion;
      prev.estimatedCost = num(prev.estimatedCost) + num(i.estimatedCost);
    } else {
      merged.set(i.ingredientId, { ...i, portionQuantity: portion });
    }
  }

  const result = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO product_recipes
         (product_id, product_name, product_category, product_price, yield_servings, preparation_instructions,
          total_food_cost, total_packaging_cost, total_raw_cost, gross_margin_percent, is_configured, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,NOW())
       ON CONFLICT (product_id) DO UPDATE SET
         product_name=EXCLUDED.product_name, product_category=EXCLUDED.product_category, product_price=EXCLUDED.product_price,
         yield_servings=EXCLUDED.yield_servings, preparation_instructions=EXCLUDED.preparation_instructions,
         total_food_cost=EXCLUDED.total_food_cost, total_packaging_cost=EXCLUDED.total_packaging_cost,
         total_raw_cost=EXCLUDED.total_raw_cost, gross_margin_percent=EXCLUDED.gross_margin_percent,
         is_configured=TRUE, updated_at=NOW()`,
      [productId, b.productName || productId, b.productCategory || null, num(b.productPrice), Math.max(1, num(b.yieldServings, 1)),
       b.preparationInstructions || null, num(b.totalFoodCost), num(b.totalPackagingCost), num(b.totalRawCost), num(b.grossMarginPercent)]
    );
    await client.query(`DELETE FROM recipe_ingredients WHERE product_id = $1`, [productId]);
    await client.query(`DELETE FROM recipe_packaging WHERE product_id = $1`, [productId]);
    for (const i of merged.values()) {
      await client.query(
        `INSERT INTO recipe_ingredients (product_id, ingredient_id, ingredient_name, portion_quantity, unit, estimated_cost)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [productId, i.ingredientId, i.ingredientName || i.ingredientId, i.portionQuantity, i.unit, num(i.estimatedCost)]
      );
    }
    for (const p of b.packagingRequirements || []) {
      if (!p.packagingId) throw new HttpError(400, 'Choose a packaging item on every packaging line.', 'VALIDATION');
      await client.query(
        `INSERT INTO recipe_packaging
           (id, product_id, packaging_id, packaging_name, category, quantity, unit, fulfillment_type, scope, shared_capacity, estimated_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          String(p.id || shortId('prq')).slice(0, 50), productId, p.packagingId, p.packagingName || p.packagingId,
          p.category || null, num(p.quantity, 1), p.unit, p.fulfillmentType || 'TAKEOUT', p.scope || 'PER_ITEM',
          p.scope === 'SHARED_ORDER' ? Math.max(1, num(p.sharedCapacity, 1)) : null, num(p.estimatedCost), p.notes || null,
        ]
      );
    }
    const state = await loadState(client);
    return state.recipes.find((r) => r.productId === productId);
  });
  broadcastInventoryChange();
  res.json({ success: true, data: result });
}));

router.delete('/inventory/recipes/:productId', ...guard, wrap(async (req, res) => {
  await withTransaction((client) => client.query(`DELETE FROM product_recipes WHERE product_id = $1`, [req.params.productId]));
  broadcastInventoryChange();
  res.json({ success: true });
}));

// --- Purchase orders
router.post('/inventory/purchase-orders', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.supplierId) throw new HttpError(400, 'Choose a supplier.', 'VALIDATION');
  if (!Array.isArray(b.items) || b.items.length === 0) throw new HttpError(400, 'Add at least one item.', 'VALIDATION');
  const po = await withTransaction(async (client) => {
    const sup = await client.query(`SELECT name FROM inventory_suppliers WHERE id = $1`, [b.supplierId]);
    if (sup.rows.length === 0) throw new HttpError(400, 'That supplier no longer exists.', 'VALIDATION');
    const { rows: countRows } = await client.query(`SELECT COUNT(*)::int AS n FROM inventory_purchase_orders WHERE po_number LIKE $1`, [`PO-${new Date().getFullYear()}-%`]);
    const poNumber = `PO-${new Date().getFullYear()}-${String(countRows[0].n + 1).padStart(3, '0')}`;
    const id = shortId('po');
    const total = b.items.reduce((s, i) => s + num(i.orderedQuantity) * num(i.unitCost), 0);
    await client.query(
      `INSERT INTO inventory_purchase_orders (id, po_number, supplier_id, supplier_name, expected_delivery_date, status, total_amount, notes)
       VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7)`,
      [id, poNumber, b.supplierId, sup.rows[0].name, b.expectedDeliveryDate || new Date(Date.now() + 2 * 86400000), total, b.notes || null]
    );
    for (const i of b.items) {
      if (!i.ingredientId || !(num(i.orderedQuantity) > 0)) throw new HttpError(400, 'Every line needs an item and a quantity above 0.', 'VALIDATION');
      await client.query(
        `INSERT INTO inventory_purchase_order_items
           (id, purchase_order_id, ingredient_id, ingredient_name, item_type, category, ordered_quantity, unit, unit_cost, total_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [shortId('poi'), id, i.ingredientId, i.ingredientName || i.ingredientId, i.itemType || 'FOOD', i.category || null,
         num(i.orderedQuantity), i.unit, num(i.unitCost), num(i.orderedQuantity) * num(i.unitCost)]
      );
    }
    const state = await loadState(client);
    return state.purchaseOrders.find((p) => p.id === id);
  });
  res.status(201).json({ success: true, data: po });
}));

router.post('/inventory/purchase-orders/:id/receive', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  const received = Array.isArray(b.items) ? b.items : [];
  const out = await withTransaction(async (client) => {
    const po = (await client.query(`SELECT * FROM inventory_purchase_orders WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!po) throw new HttpError(404, 'Purchase order not found.', 'NOT_FOUND');
    if (['FULLY_RECEIVED', 'CANCELLED'].includes(po.status)) throw new HttpError(409, 'This order is already closed.', 'CLOSED');

    const newTx = [];
    const ingredientIds = [...new Set(received.filter((r) => num(r.receivedQty) > 0).map((r) => r.ingredientId))].sort();
    const locked = new Map();
    for (const id of ingredientIds) locked.set(id, await lockIngredient(client, id));

    for (const r of received) {
      const qty = num(r.receivedQty);
      if (!(qty > 0)) continue;
      await client.query(
        `UPDATE inventory_purchase_order_items
            SET received_quantity = received_quantity + $3,
                batch_number = COALESCE($4, batch_number),
                expiration_date = COALESCE($5, expiration_date)
          WHERE id = $1 AND purchase_order_id = $2`,
        [r.itemId, po.id, qty, r.batchNumber || null, r.expirationDate || null]
      );
      const moved = await applyMovement(client, locked.get(r.ingredientId), {
        delta: qty,
        type: 'STOCK_RECEIVED',
        reason: `Goods received against ${po.po_number}. Batch: ${r.batchNumber || 'N/A'}${b.notes ? ` • ${b.notes}` : ''}`,
        performedBy: actor(req),
        refPrefix: 'RCV',
        restocked: true,
      });
      locked.set(r.ingredientId, moved.ingredient);
      newTx.push(moved.transaction);
    }

    const left = await client.query(
      `SELECT 1 FROM inventory_purchase_order_items WHERE purchase_order_id = $1 AND received_quantity < ordered_quantity LIMIT 1`,
      [po.id]
    );
    await client.query(
      `UPDATE inventory_purchase_orders SET status = $2, received_at = NOW(), received_by = $3 WHERE id = $1`,
      [po.id, left.rows.length === 0 ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED', actor(req)]
    );
    const state = await loadState(client);
    return {
      purchaseOrder: state.purchaseOrders.find((p) => p.id === po.id),
      ingredients: state.ingredients.filter((i) => locked.has(i.id)),
      transactions: newTx.map(mapTransaction),
    };
  });
  broadcastInventoryChange();
  res.json({ success: true, data: out });
}));

router.post('/inventory/purchase-orders/:id/cancel', ...guard, wrap(async (req, res) => {
  const po = await withTransaction(async (client) => {
    const cur = (await client.query(`SELECT status FROM inventory_purchase_orders WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
    if (!cur) throw new HttpError(404, 'Purchase order not found.', 'NOT_FOUND');
    if (cur.status !== 'PENDING') throw new HttpError(409, 'Only pending orders can be cancelled.', 'CLOSED');
    await client.query(`UPDATE inventory_purchase_orders SET status = 'CANCELLED' WHERE id = $1`, [req.params.id]);
    const state = await loadState(client);
    return state.purchaseOrders.find((p) => p.id === req.params.id);
  });
  res.json({ success: true, data: po });
}));

// --- Bulk replace (baseline reload + one-time import of browser data)
router.post('/inventory/replace-all', ...guard, wrap(async (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.ingredients) || !Array.isArray(b.recipes) || !Array.isArray(b.suppliers)) {
    throw new HttpError(400, 'ingredients, recipes and suppliers are required.', 'VALIDATION');
  }
  const data = await withTransaction(async (client) => {
    const open = await client.query(`SELECT 1 FROM order_inventory_ledger WHERE state = 'RESERVED' LIMIT 1`);
    if (open.rows.length > 0) {
      throw new HttpError(409, 'Open orders are holding stock right now. Finish or cancel them before replacing inventory.', 'IN_USE');
    }
    await client.query(`DELETE FROM product_recipes`);

    const supplierIds = b.suppliers.map((x) => x.id);
    await client.query(`DELETE FROM inventory_suppliers WHERE NOT (id = ANY($1::text[]))`, [supplierIds]);
    for (const s of b.suppliers) {
      await client.query(
        `INSERT INTO inventory_suppliers (id, name, contact_person, contact_number, email, address, categories_supplied, lead_time_days, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, contact_person=EXCLUDED.contact_person, contact_number=EXCLUDED.contact_number,
           email=EXCLUDED.email, address=EXCLUDED.address, categories_supplied=EXCLUDED.categories_supplied,
           lead_time_days=EXCLUDED.lead_time_days, notes=EXCLUDED.notes, status=EXCLUDED.status`,
        [s.id, s.name, s.contactPerson || null, s.contactNumber || null, s.email || null, s.address || null,
         s.categoriesSupplied || [], num(s.leadTimeDays, 1), s.notes || null, s.status || 'ACTIVE']
      );
    }
    // Items are upserted (not deleted) so their stock history survives a baseline reload
    const ingredientIds = b.ingredients.map((x) => x.id);
    await client.query(`DELETE FROM inventory_ingredients WHERE NOT (id = ANY($1::text[]))`, [ingredientIds]);
    for (const i of b.ingredients) {
      await client.query(
        `INSERT INTO inventory_ingredients (id, name, sku, item_type, category, base_unit, current_stock, min_stock_level,
           preferred_restock_qty, cost_per_unit, supplier_id, supplier_name, storage_notes, status, last_restocked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, sku=EXCLUDED.sku, item_type=EXCLUDED.item_type, category=EXCLUDED.category,
           base_unit=EXCLUDED.base_unit, current_stock=EXCLUDED.current_stock, min_stock_level=EXCLUDED.min_stock_level,
           preferred_restock_qty=EXCLUDED.preferred_restock_qty, cost_per_unit=EXCLUDED.cost_per_unit, supplier_id=EXCLUDED.supplier_id,
           supplier_name=EXCLUDED.supplier_name, storage_notes=EXCLUDED.storage_notes, status=EXCLUDED.status,
           last_restocked_at=EXCLUDED.last_restocked_at, updated_at=NOW()`,
        [i.id, i.name, i.sku || null, i.itemType || 'FOOD', i.category, i.baseUnit, num(i.currentStock), num(i.minStockLevel),
         num(i.preferredRestockQty), num(i.costPerUnit),
         b.suppliers.some((s) => s.id === i.supplierId) ? i.supplierId : null, i.supplierName || null, i.storageNotes || null,
         stockStatus(num(i.currentStock), num(i.minStockLevel)), i.lastRestockedAt || null]
      );
    }
    const ids = new Set(b.ingredients.map((i) => i.id));
    for (const r of b.recipes) {
      if (!r.ingredients?.length || !r.ingredients.every((x) => ids.has(x.ingredientId))) continue; // skip recipes pointing at missing items
      await client.query(
        `INSERT INTO product_recipes (product_id, product_name, product_category, product_price, yield_servings, preparation_instructions,
           total_food_cost, total_packaging_cost, total_raw_cost, gross_margin_percent, is_configured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [r.productId, r.productName, r.productCategory || null, num(r.productPrice), num(r.yieldServings, 1), r.preparationInstructions || null,
         num(r.totalFoodCost), num(r.totalPackagingCost), num(r.totalRawCost), num(r.grossMarginPercent), r.isConfigured !== false]
      );
      const seen = new Set();
      for (const x of r.ingredients) {
        if (seen.has(x.ingredientId)) continue;
        seen.add(x.ingredientId);
        await client.query(
          `INSERT INTO recipe_ingredients (product_id, ingredient_id, ingredient_name, portion_quantity, unit, estimated_cost) VALUES ($1,$2,$3,$4,$5,$6)`,
          [r.productId, x.ingredientId, x.ingredientName, num(x.portionQuantity), x.unit, num(x.estimatedCost)]
        );
      }
      for (const p of r.packagingRequirements || []) {
        if (!ids.has(p.packagingId)) continue;
        await client.query(
          `INSERT INTO recipe_packaging (id, product_id, packaging_id, packaging_name, category, quantity, unit, fulfillment_type, scope, shared_capacity, estimated_cost, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [String(p.id || shortId('prq')).slice(0, 50), r.productId, p.packagingId, p.packagingName, p.category || null, num(p.quantity, 1), p.unit,
           p.fulfillmentType || 'TAKEOUT', p.scope || 'PER_ITEM', p.scope === 'SHARED_ORDER' ? num(p.sharedCapacity, 1) : null, num(p.estimatedCost), p.notes || null]
        );
      }
    }
    return loadState(client);
  });
  broadcastInventoryChange();
  res.json({ success: true, data });
}));

export default router;

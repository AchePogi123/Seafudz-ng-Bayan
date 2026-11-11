/**
 * Admin inventory API smoke tests (needs the same disposable database as inventoryOrderFlow.test.js).
 *   INVENTORY_TEST_DATABASE_URL=... node --test --test-concurrency=1 src/test/inventoryAdminApi.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import pg from 'pg';

const url = process.env.INVENTORY_TEST_DATABASE_URL;
const skip = url ? false : 'set INVENTORY_TEST_DATABASE_URL to run';
if (url) process.env.DATABASE_URL = url;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let server;
let base;
let pool;

async function api(method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

test.before(async () => {
  if (!url) return;
  pool = new pg.Pool({ connectionString: url, max: 2 });
  const { default: inventoryRoutes } = await import('../routes/inventoryRoutes.js');
  const app = express();
  app.use(express.json());
  app.use('/api', inventoryRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (!url) return;
  await pool.query(`DELETE FROM inventory_purchase_orders WHERE notes = 'ADMIN-API-TEST'`);
  await pool.query(`DELETE FROM inventory_ingredients WHERE name LIKE 'ZZ Test %'`);
  await pool.query(`DELETE FROM inventory_suppliers WHERE name = 'ZZ Test Supplier'`);
  await new Promise((r) => server?.close(r));
  await pool.end();
  setTimeout(() => process.exit(0), 100).unref();
});

test('state returns catalog, recipes and suppliers in the shapes the screen expects', { skip }, async () => {
  const { status, json } = await api('GET', '/inventory/state');
  assert.equal(status, 200);
  const d = json.data;
  assert.ok(d.ingredients.length > 50);
  assert.ok(d.recipes.length >= 41);
  assert.ok(d.recipes.some((r) => r.packagingRequirements.length > 0));
  const ing = d.ingredients[0];
  for (const key of ['id', 'name', 'itemType', 'baseUnit', 'currentStock', 'minStockLevel', 'status']) assert.ok(key in ing, key);
});

test('create, restock, use, and delete an item; duplicates and overdraw are refused', { skip }, async () => {
  const body = { name: 'ZZ Test Salt', itemType: 'FOOD', category: 'Seasonings & Sauces', baseUnit: 'g', currentStock: 100, minStockLevel: 20, preferredRestockQty: 500, costPerUnit: 0.5 };
  const created = await api('POST', '/inventory/ingredients', body);
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const id = created.json.data.ingredient.id;
  assert.equal(created.json.data.ingredient.costPerUnit, 0.5);
  assert.ok(created.json.data.transaction, 'opening stock is logged');

  assert.equal((await api('POST', '/inventory/ingredients', body)).status, 409, 'duplicate name');

  const restock = await api('POST', '/inventory/movements', { ingredientId: id, delta: 50, type: 'STOCK_RECEIVED', reason: 'test' });
  assert.equal(restock.json.data.ingredient.currentStock, 150);

  const use = await api('POST', '/inventory/movements', { ingredientId: id, delta: -140, type: 'CONSUMPTION', reason: 'test' });
  assert.equal(use.json.data.ingredient.currentStock, 10);
  assert.equal(use.json.data.ingredient.status, 'LOW_STOCK');

  const over = await api('POST', '/inventory/movements', { ingredientId: id, delta: -999, type: 'WASTE' });
  assert.equal(over.status, 400);
  assert.match(over.json.message, /on hand/);

  assert.equal((await api('DELETE', `/inventory/ingredients/${id}`)).status, 200);
});

test('an item used in a recipe cannot be deleted', { skip }, async () => {
  const { rows } = await pool.query(`SELECT ingredient_id FROM recipe_ingredients LIMIT 1`);
  const r = await api('DELETE', `/inventory/ingredients/${rows[0].ingredient_id}`);
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'IN_USE');
});

test('purchase order: create, receive part then the rest, stock and history follow', { skip }, async () => {
  const sup = await api('POST', '/inventory/suppliers', { name: 'ZZ Test Supplier', contactPerson: 'T', contactNumber: '0917', address: 'x', categoriesSupplied: [], leadTimeDays: 2, status: 'ACTIVE' });
  assert.equal(sup.status, 201);
  const ing = await api('POST', '/inventory/ingredients', { name: 'ZZ Test Pepper', itemType: 'FOOD', category: 'Seasonings & Sauces', baseUnit: 'g', currentStock: 0, minStockLevel: 10, preferredRestockQty: 100, costPerUnit: 1 });
  const ingId = ing.json.data.ingredient.id;

  const po = await api('POST', '/inventory/purchase-orders', {
    supplierId: sup.json.data.id,
    notes: 'ADMIN-API-TEST',
    items: [{ ingredientId: ingId, ingredientName: 'ZZ Test Pepper', itemType: 'FOOD', category: 'Seasonings & Sauces', orderedQuantity: 100, unit: 'g', unitCost: 1 }],
  });
  assert.equal(po.status, 201, JSON.stringify(po.json));
  assert.match(po.json.data.poNumber, /^PO-\d{4}-\d{3}$/);
  const item = po.json.data.items[0];

  const part = await api('POST', `/inventory/purchase-orders/${po.json.data.id}/receive`, { items: [{ itemId: item.id, ingredientId: ingId, receivedQty: 40, unit: 'g' }] });
  assert.equal(part.json.data.purchaseOrder.status, 'PARTIALLY_RECEIVED');
  assert.equal(part.json.data.ingredients[0].currentStock, 40);

  const rest = await api('POST', `/inventory/purchase-orders/${po.json.data.id}/receive`, { items: [{ itemId: item.id, ingredientId: ingId, receivedQty: 60, unit: 'g' }] });
  assert.equal(rest.json.data.purchaseOrder.status, 'FULLY_RECEIVED');
  assert.equal(rest.json.data.ingredients[0].currentStock, 100);
  assert.equal((await api('POST', `/inventory/purchase-orders/${po.json.data.id}/receive`, { items: [] })).status, 409, 'closed orders stay closed');
});

test('saving a recipe replaces its ingredients and merges repeated lines', { skip }, async () => {
  const state = (await api('GET', '/inventory/state')).json.data;
  const recipe = state.recipes[0];
  const first = recipe.ingredients[0];
  const saved = await api('PUT', `/inventory/recipes/${recipe.productId}`, {
    ...recipe,
    ingredients: [first, { ...first, portionQuantity: 10 }],
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.json));
  assert.equal(saved.json.data.ingredients.length, 1);
  assert.equal(saved.json.data.ingredients[0].portionQuantity, first.portionQuantity + 10);
  // put it back
  await api('PUT', `/inventory/recipes/${recipe.productId}`, recipe);
});

test('replace-all (baseline reload / import) keeps stock history and rejects while orders hold stock', { skip }, async () => {
  // real open orders in the copied database legitimately block replace-all; park them for this test
  const parked = (await pool.query(`UPDATE order_inventory_ledger SET state = 'RETURNED' WHERE state = 'RESERVED' RETURNING id`)).rows.map((r) => r.id);
  try {
  const before = (await api('GET', '/inventory/state')).json.data;
  const txBefore = (await pool.query(`SELECT count(*)::int AS n FROM inventory_transactions`)).rows[0].n;
  const snapshot = { ingredients: before.ingredients, recipes: before.recipes, suppliers: before.suppliers };

  const res = await api('POST', '/inventory/replace-all', snapshot);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.data.ingredients.length, before.ingredients.length);
  assert.equal(res.json.data.recipes.length, before.recipes.length);
  assert.equal(res.json.data.recipes.reduce((n, r) => n + r.packagingRequirements.length, 0), before.recipes.reduce((n, r) => n + r.packagingRequirements.length, 0));
  const txAfter = (await pool.query(`SELECT count(*)::int AS n FROM inventory_transactions`)).rows[0].n;
  assert.equal(txAfter, txBefore, 'history survives');

  await pool.query(`INSERT INTO order_inventory_ledger (order_id, ingredient_id, quantity) SELECT 'ADMIN-HOLD', id, 1 FROM inventory_ingredients LIMIT 1`);
  try {
    const blocked = await api('POST', '/inventory/replace-all', snapshot);
    assert.equal(blocked.status, 409);
  } finally {
    await pool.query(`DELETE FROM order_inventory_ledger WHERE order_id = 'ADMIN-HOLD'`);
  }
  } finally {
    if (parked.length) await pool.query(`UPDATE order_inventory_ledger SET state = 'RESERVED' WHERE id = ANY($1::bigint[])`, [parked]);
  }
});

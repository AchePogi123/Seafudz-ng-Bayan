/**
 * Integration tests for the order <-> inventory rules.
 * Needs a disposable Postgres with every migration applied:
 *   INVENTORY_TEST_DATABASE_URL=... node --test --test-concurrency=1 src/test/inventoryService.test.js src/test/inventoryOrderFlow.test.js   (they share one database, so run them one at a time)
 * Every test runs inside a transaction that is rolled back, so no data is left behind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {
  reserveForOrder,
  returnForOrder,
  returnForItems,
  markPrepStarted,
  getMenuServings,
  computeProductServings,
} from '../services/inventoryService.js';

const url = process.env.INVENTORY_TEST_DATABASE_URL;
const skip = url ? false : 'set INVENTORY_TEST_DATABASE_URL to run';

const PRODUCT = 'all-shrimp-alacarte-199';
const ITEM = [{ product_id: PRODUCT, name: 'All Shrimp Alacarte', quantity: 2, orderItemId: 9001 }];

let pool;
test.before(() => {
  if (url) pool = new pg.Pool({ connectionString: url, max: 2 });
});
test.after(async () => {
  await pool?.end();
});

async function inTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

async function stockOf(client) {
  const { rows } = await client.query(
    `SELECT i.id, i.item_type, i.current_stock::float AS stock
       FROM inventory_ingredients i
      WHERE i.id IN (
        SELECT ingredient_id FROM recipe_ingredients WHERE product_id = $1
        UNION SELECT packaging_id FROM recipe_packaging WHERE product_id = $1)`,
    [PRODUCT]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function makeOrder(client, id) {
  await client.query(
    `INSERT INTO orders (id, order_type, status, subtotal, tax, total) VALUES ($1,'ON_SITE','CONFIRMED',0,0,0)`,
    [id]
  );
}

test('placing an order takes ingredients and packaging out of stock', { skip }, () =>
  inTx(async (client) => {
    const before = await stockOf(client);
    const res = await reserveForOrder(client, 'T-1', ITEM, 'TAKE_OUT');
    assert.equal(res.reserved, true);
    const after = await stockOf(client);
    const changed = [...before.values()].filter((b) => after.get(b.id).stock < b.stock);
    assert.ok(changed.some((c) => c.item_type === 'FOOD'), 'food was deducted');
    assert.ok(changed.some((c) => c.item_type === 'PACKAGING'), 'takeout packaging was deducted');
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM order_inventory_ledger WHERE order_id='T-1' AND state='RESERVED'`);
    assert.ok(rows[0].n > 0);
  }));

test('dine-in uses food but no takeout packaging', { skip }, () =>
  inTx(async (client) => {
    const before = await stockOf(client);
    await reserveForOrder(client, 'T-2', ITEM, 'DINE_IN');
    const after = await stockOf(client);
    for (const b of before.values()) {
      if (b.item_type === 'PACKAGING') assert.equal(after.get(b.id).stock, b.stock);
    }
  }));

test('reserving twice for the same order does not double deduct', { skip }, () =>
  inTx(async (client) => {
    await reserveForOrder(client, 'T-3', ITEM, 'TAKE_OUT');
    const once = await stockOf(client);
    const again = await reserveForOrder(client, 'T-3', ITEM, 'TAKE_OUT');
    assert.equal(again.reason, 'ALREADY_RESERVED');
    const twice = await stockOf(client);
    for (const [id, v] of once) assert.equal(twice.get(id).stock, v.stock);
  }));

test('cancelling before the kitchen starts returns everything, exactly once', { skip }, () =>
  inTx(async (client) => {
    await makeOrder(client, 'T-4');
    const before = await stockOf(client);
    await reserveForOrder(client, 'T-4', ITEM, 'TAKE_OUT');
    const r1 = await returnForOrder(client, 'T-4');
    assert.ok(r1.released > 0);
    assert.equal(r1.wasted, 0);
    const restored = await stockOf(client);
    for (const [id, v] of before) assert.ok(Math.abs(restored.get(id).stock - v.stock) < 1e-6, `${id} restored`);
    const r2 = await returnForOrder(client, 'T-4');
    assert.equal(r2.released, 0, 'second cancel is a no-op');
    const again = await stockOf(client);
    for (const [id, v] of before) assert.ok(Math.abs(again.get(id).stock - v.stock) < 1e-6);
  }));

test('cancelling after preparing started writes food off but returns packaging', { skip }, () =>
  inTx(async (client) => {
    await makeOrder(client, 'T-5');
    const before = await stockOf(client);
    await reserveForOrder(client, 'T-5', ITEM, 'TAKE_OUT');
    await markPrepStarted(client, 'T-5');
    const res = await returnForOrder(client, 'T-5');
    assert.ok(res.wasted > 0, 'food written off');
    assert.ok(res.released > 0, 'packaging returned');
    const after = await stockOf(client);
    for (const b of before.values()) {
      if (b.item_type === 'PACKAGING') assert.ok(Math.abs(after.get(b.id).stock - b.stock) < 1e-6);
      else assert.ok(after.get(b.id).stock <= b.stock);
    }
    const waste = await client.query(`SELECT count(*)::int AS n FROM inventory_transactions WHERE order_id='T-5' AND type='WASTE'`);
    assert.ok(waste.rows[0].n > 0, 'usage reclassified as waste');
  }));

test('an order that needs more than is in stock is rejected with INSUFFICIENT_STOCK', { skip }, () =>
  inTx(async (client) => {
    const { rows } = await client.query(
      `SELECT ingredient_id FROM recipe_ingredients WHERE product_id = $1 ORDER BY portion_quantity DESC LIMIT 1`,
      [PRODUCT]
    );
    await client.query(`UPDATE inventory_ingredients SET current_stock = 1 WHERE id = $1`, [rows[0].ingredient_id]);
    await assert.rejects(
      () => reserveForOrder(client, 'T-6', [{ product_id: PRODUCT, name: 'All Shrimp Alacarte', quantity: 1 }], 'TAKE_OUT'),
      (err) => err.code === 'INSUFFICIENT_STOCK' && err.statusCode === 409 && /All Shrimp Alacarte/.test(err.message)
    );
    const ledger = await client.query(`SELECT count(*)::int AS n FROM order_inventory_ledger WHERE order_id='T-6'`);
    assert.equal(ledger.rows[0].n, 0, 'nothing reserved when short');
  }));

test('returning specific items only releases those items', { skip }, () =>
  inTx(async (client) => {
    await makeOrder(client, 'T-7');
    await reserveForOrder(client, 'T-7', ITEM, 'DINE_IN');
    const res = await returnForItems(client, 'T-7', [9001]);
    assert.ok(res.released > 0);
    const open = await client.query(`SELECT count(*)::int AS n FROM order_inventory_ledger WHERE order_id='T-7' AND state='RESERVED'`);
    assert.equal(open.rows[0].n, 0);
  }));

test('menu servings reflect stock and drop to 0 when an ingredient runs out', { skip }, () =>
  inTx(async (client) => {
    const before = (await getMenuServings(client)).get(PRODUCT);
    assert.ok(before && before.servings.DINE_IN > 0);
    const { rows } = await client.query(`SELECT ingredient_id FROM recipe_ingredients WHERE product_id = $1 LIMIT 1`, [PRODUCT]);
    await client.query(`UPDATE inventory_ingredients SET current_stock = 0 WHERE id = $1`, [rows[0].ingredient_id]);
    const after = (await getMenuServings(client)).get(PRODUCT);
    for (const f of ['DINE_IN', 'TAKE_OUT', 'PICKUP', 'DELIVERY']) assert.equal(after.servings[f], 0);
  }));

// --- Shared ingredients / packaging ---------------------------------------------------------

async function productsUsing(client, ingredientId, table = 'recipe_ingredients', col = 'ingredient_id') {
  const { rows } = await client.query(`SELECT product_id FROM ${table} WHERE ${col} = $1`, [ingredientId]);
  return rows.map((r) => r.product_id);
}

test('ordering one dish recalculates every other dish that shares its ingredients', { skip }, () =>
  inTx(async (client) => {
    const sharers = await productsUsing(client, 'ing-shrimp-fresh');
    assert.ok(sharers.length >= 3, 'fixture: several dishes share fresh shrimp');
    // make shrimp the limiting ingredient so every sharer's number must move
    await client.query(`UPDATE inventory_ingredients SET current_stock = 3000 WHERE id = 'ing-shrimp-fresh'`);
    const before = await getMenuServings(client);

    await reserveForOrder(client, 'T-SH-1', [{ product_id: PRODUCT, name: 'All Shrimp Alacarte', quantity: 4 }], 'DINE_IN'); // 4 x 150 g
    const after = await getMenuServings(client);

    for (const id of sharers) {
      const portion = Number((await client.query(
        `SELECT portion_quantity FROM recipe_ingredients WHERE product_id=$1 AND ingredient_id='ing-shrimp-fresh'`, [id])).rows[0].portion_quantity);
      const expectedCap = Math.floor(2400 / portion);
      assert.ok(after.get(id).servings.DINE_IN <= expectedCap, `${id} capped by remaining shrimp`);
      assert.ok(after.get(id).servings.DINE_IN <= before.get(id).servings.DINE_IN, `${id} did not go up`);
    }
    // the shrimp-limited dishes all dropped, not just the one that was ordered
    const dropped = sharers.filter((id) => after.get(id).servings.DINE_IN < before.get(id).servings.DINE_IN);
    assert.ok(dropped.length >= 3, `dropped: ${dropped.join(', ')}`);
    assert.ok(dropped.includes('all-shrimp-bowl-699') || dropped.includes('mixed-seafoods-bowl-699'));
  }));

test('other dishes are only recalculated, never deducted', { skip }, () =>
  inTx(async (client) => {
    await reserveForOrder(client, 'T-SH-2', [{ product_id: PRODUCT, name: 'All Shrimp Alacarte', quantity: 1 }], 'DINE_IN');
    const ledger = await client.query(`SELECT DISTINCT product_id FROM order_inventory_ledger WHERE order_id='T-SH-2'`);
    assert.deepEqual(ledger.rows.map((r) => r.product_id), [PRODUCT]);
  }));

test('shared packaging: using the last trays sells out every take-out dish that needs a tray', { skip }, () =>
  inTx(async (client) => {
    const { rows } = await client.query(
      `SELECT packaging_id FROM recipe_packaging WHERE product_id = $1 AND fulfillment_type IN ('TAKEOUT','ALL') LIMIT 1`, [PRODUCT]);
    const tray = rows[0].packaging_id;
    const sharers = await productsUsing(client, tray, 'recipe_packaging', 'packaging_id');
    assert.ok(sharers.length >= 2, 'fixture: packaging shared by several dishes');
    await client.query(`UPDATE inventory_ingredients SET current_stock = 1 WHERE id = $1`, [tray]);

    await reserveForOrder(client, 'T-SH-3', [{ product_id: PRODUCT, name: 'All Shrimp Alacarte', quantity: 1 }], 'TAKE_OUT');
    const after = await computeProductServings(client, { ingredientIds: [tray] });
    for (const id of sharers) {
      assert.equal(after.get(id).servings.TAKE_OUT, 0, `${id} sold out for take-out`);
      assert.equal(after.get(id).servings.DELIVERY, 0, `${id} sold out for delivery`);
      assert.ok(after.get(id).servings.DINE_IN > 0, `${id} still available for dine-in`);
    }
  }));

test('targeted recalculation only touches products that use the changed items', { skip }, () =>
  inTx(async (client) => {
    const targeted = await computeProductServings(client, { ingredientIds: ['ing-shrimp-fresh'] });
    const sharers = new Set(await productsUsing(client, 'ing-shrimp-fresh'));
    assert.ok(targeted.size > 0);
    for (const id of targeted.keys()) assert.ok(sharers.has(id), `${id} uses fresh shrimp`);
    const all = await computeProductServings(client);
    assert.ok(all.size > targeted.size);
    assert.equal((await computeProductServings(client, { ingredientIds: [] })).size, 0);
  }));

/**
 * End-to-end (HTTP) test of: order placed -> stock consumed -> cancelled -> stock returned.
 * Needs a DISPOSABLE Postgres with every migration applied (it commits real rows):
 *   INVENTORY_TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/sfb_test node --test src/test/inventoryOrderFlow.test.js
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

const PRODUCT = 'all-shrimp-alacarte-199';
const NAME = 'All Shrimp Alacarte';

let server;
let base;
let pool;
let snapshot;

async function api(method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

const posOrder = (id, quantity = 1, orderType = 'TAKE_OUT') => ({
  id,
  orderType,
  paymentMethod: 'Cash',
  status: 'CONFIRMED',
  isPosOrder: true,
  cartItems: [{ productId: PRODUCT, name: NAME, quantity, item: { id: PRODUCT, name: NAME, price: 199 } }],
});

async function stockMap() {
  const { rows } = await pool.query(
    `SELECT id, item_type, current_stock::float AS stock FROM inventory_ingredients
      WHERE id IN (SELECT ingredient_id FROM recipe_ingredients WHERE product_id=$1
                   UNION SELECT packaging_id FROM recipe_packaging WHERE product_id=$1)`,
    [PRODUCT]
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function servingsFromMenu(id = PRODUCT) {
  const { json } = await api('GET', '/menu');
  return json.data.find((p) => p.id === id)?.remaining_servings;
}

test.before(async () => {
  if (!url) return;
  pool = new pg.Pool({ connectionString: url, max: 3 });
  const [{ default: orderRoutes }, { default: userFlowRoutes }, { default: kitchenRoutes }, { default: menuRoutes }] =
    await Promise.all([
      import('../routes/orderRoutes.js'),
      import('../routes/userFlowRoutes.js'),
      import('../routes/kitchenRoutes.js'),
      import('../routes/menuRoutes.js'),
    ]);
  const app = express();
  app.use(express.json());
  app.use('/api', menuRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', kitchenRoutes);
  app.use('/api', userFlowRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  snapshot = await stockMap();
});

test.after(async () => {
  if (!url) return;
  for (const [id, v] of snapshot) {
    await pool.query(`UPDATE inventory_ingredients SET current_stock=$2, status='IN_STOCK' WHERE id=$1`, [id, v.stock]);
  }
  await pool.query(`DELETE FROM order_inventory_ledger WHERE order_id LIKE 'E2E-%'`);
  await pool.query(`DELETE FROM inventory_transactions WHERE order_id LIKE 'E2E-%'`);
  for (const t of ['order_items', 'kitchen_orders', 'payments', 'deliveries']) {
    await pool.query(`DELETE FROM ${t} WHERE order_id LIKE 'E2E-%'`);
  }
  await pool.query(`DELETE FROM orders WHERE id LIKE 'E2E-%'`);
  await new Promise((r) => server?.close(r));
  await pool.end();
  setTimeout(() => process.exit(0), 100).unref();
});

test('menu exposes servings left', { skip }, async () => {
  const s = await servingsFromMenu();
  assert.equal(typeof s, 'number');
  assert.ok(s > 0);
});

test('placing an order consumes stock and lowers the servings shown on the menu', { skip }, async () => {
  const before = await stockMap();
  const servingsBefore = await servingsFromMenu();
  const r = await api('POST', '/orders', posOrder('E2E-1', 2));
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const after = await stockMap();
  const dropped = [...before.values()].filter((b) => after.get(b.id).stock < b.stock);
  assert.ok(dropped.some((d) => d.item_type === 'FOOD'));
  assert.ok(dropped.some((d) => d.item_type === 'PACKAGING'));
  const servingsAfter = await servingsFromMenu();
  assert.ok(servingsAfter < servingsBefore, `servings ${servingsBefore} -> ${servingsAfter}`);
});

test('cancelling before the kitchen starts gives everything back', { skip }, async () => {
  const before = await stockMap();
  const placed = await api('POST', '/orders', posOrder('E2E-2', 1, 'DINE_IN'));
  assert.equal(placed.status, 201, JSON.stringify(placed.json));
  const mid = await stockMap();
  assert.ok([...before.values()].some((b) => mid.get(b.id).stock < b.stock));

  const cancelled = await api('PATCH', '/user-flow/orders/E2E-2/cancel', { status: 'CANCELLED' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
  const after = await stockMap();
  for (const [id, v] of before) assert.ok(Math.abs(after.get(id).stock - v.stock) < 1e-6, `${id} restored`);

  // cancelling again must not add stock twice
  await api('PATCH', '/user-flow/orders/E2E-2/cancel', { status: 'CANCELLED' });
  const again = await stockMap();
  for (const [id, v] of before) assert.ok(Math.abs(again.get(id).stock - v.stock) < 1e-6);
});

test('cancelling after cooking started writes food off but returns packaging', { skip }, async () => {
  const before = await stockMap();
  assert.equal((await api('POST', '/orders', posOrder('E2E-3', 1))).status, 201);
  assert.equal((await api('PATCH', '/kitchen/orders/E2E-3/status', { status: 'PREPARING' })).status, 200);
  const cancel = await api('PATCH', '/user-flow/orders/E2E-3/cancel', { status: 'CANCELLED' });
  assert.equal(cancel.status, 400, 'customer-side cancel is blocked once preparing');

  // an admin forcing the status to CANCELLED still settles the stock correctly
  assert.equal((await api('PATCH', '/orders/E2E-3/status', { status: 'CANCELLED' })).status, 200);
  const after = await stockMap();
  for (const b of before.values()) {
    if (b.item_type === 'PACKAGING') assert.ok(Math.abs(after.get(b.id).stock - b.stock) < 1e-6, 'packaging returned');
  }
  assert.ok([...before.values()].some((b) => b.item_type === 'FOOD' && after.get(b.id).stock < b.stock), 'food stays written off');
  const waste = await pool.query(`SELECT count(*)::int AS n FROM inventory_transactions WHERE order_id='E2E-3' AND type='WASTE'`);
  assert.ok(waste.rows[0].n > 0);
});

async function restoreStock() {
  for (const [id, v] of snapshot) {
    await pool.query(`UPDATE inventory_ingredients SET current_stock=$2, status='IN_STOCK' WHERE id=$1`, [id, v.stock]);
  }
}

test('an order the kitchen cannot cover is rejected with a clear message', { skip }, async () => {
  // the largest portion in the recipe (without ORDER BY the row picked depends on table layout,
  // and 10 units of a spice that needs 1.2 per dish would still cover the order)
  const { rows } = await pool.query(
    `SELECT ingredient_id FROM recipe_ingredients WHERE product_id=$1 ORDER BY portion_quantity DESC LIMIT 1`,
    [PRODUCT]
  );
  await pool.query(`UPDATE inventory_ingredients SET current_stock = 10 WHERE id=$1`, [rows[0].ingredient_id]);
  const before = await stockMap();
  const r = await api('POST', '/orders', posOrder('E2E-4', 1));
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.error, 'INSUFFICIENT_STOCK');
  assert.match(r.json.message, /All Shrimp Alacarte/);
  const after = await stockMap();
  for (const [id, v] of before) assert.equal(after.get(id).stock, v.stock, 'nothing deducted on rejection');
  const exists = await pool.query(`SELECT 1 FROM orders WHERE id='E2E-4'`);
  assert.equal(exists.rows.length, 0, 'order was not created');
  assert.equal(await servingsFromMenu(), 0);
  await restoreStock();
});

test('online customer order: nothing consumed until the payment is verified, returned when cancelled', { skip }, async () => {
  const before = await stockMap();
  const placed = await api('POST', '/user-flow/orders', {
    id: 'E2E-5',
    customerName: 'Test Customer',
    phone: '09171234567',
    deliveryAddress: '123 Test St, Caloocan',
    paymentMethod: 'Pay in Store',
    fulfillmentType: 'PICKUP',
    type: 'Store Pick-Up',
    orderType: 'ONLINE',
    items: [{ id: PRODUCT, name: NAME, quantity: 2, price: 199 }],
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.json));

  // The customer has only confirmed a cart: the ingredients are still on the shelf.
  const unpaid = await stockMap();
  for (const [id, v] of before) assert.equal(unpaid.get(id).stock, v.stock, `${id} untouched while unpaid`);

  // The customer pays at the counter and the order is confirmed: now the stock moves.
  // (A GCash order moves it earlier, when the reference / receipt is submitted.)
  const confirmed = await api('PATCH', '/user-flow/orders/E2E-5/status', { status: 'CONFIRMED' });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.json));
  const mid = await stockMap();
  assert.ok([...before.values()].some((b) => mid.get(b.id).stock < b.stock), 'stock consumed');
  const pkg = [...before.values()].filter((b) => b.item_type === 'PACKAGING');
  assert.ok(pkg.some((b) => mid.get(b.id).stock < b.stock), 'pickup uses takeout packaging');

  const cancel = await api('PATCH', '/user-flow/orders/E2E-5/cancel', { status: 'CANCELLED' });
  assert.equal(cancel.status, 200, JSON.stringify(cancel.json));
  const after = await stockMap();
  for (const [id, v] of before) assert.ok(Math.abs(after.get(id).stock - v.stock) < 1e-6, `${id} restored`);
});

test('online customer order that cannot be covered returns 409 and creates nothing', { skip }, async () => {
  const before = await stockMap();
  const r = await api('POST', '/user-flow/orders', {
    id: 'E2E-6',
    customerName: 'Test Customer',
    phone: '09171234567',
    paymentMethod: 'Pay in Store',
    fulfillmentType: 'PICKUP',
    type: 'Store Pick-Up',
    orderType: 'ONLINE',
    items: [{ id: PRODUCT, name: NAME, quantity: 500, price: 199 }],
  });
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.error, 'INSUFFICIENT_STOCK');
  const after = await stockMap();
  for (const [id, v] of before) assert.equal(after.get(id).stock, v.stock);
  const exists = await pool.query(`SELECT 1 FROM orders WHERE id='E2E-6'`);
  assert.equal(exists.rows.length, 0);
});

test('unpaid orders past the hold time are cancelled and anything they hold is returned', { skip }, async () => {
  const { cancelStaleOrders } = await import('../services/unpaidOrderReaper.js');
  // expire whatever is already stale in this database first, so the comparison below
  // only sees the order this test creates
  await cancelStaleOrders(60, 180);
  const before = await stockMap();
  const placed = await api('POST', '/user-flow/orders', {
    id: 'E2E-7',
    customerName: 'Test Customer',
    phone: '09171234567',
    paymentMethod: 'Pay in Store',
    fulfillmentType: 'PICKUP',
    type: 'Store Pick-Up',
    orderType: 'ONLINE',
    items: [{ id: PRODUCT, name: NAME, quantity: 1, price: 199 }],
  });
  assert.equal(placed.status, 201, JSON.stringify(placed.json));
  await pool.query(`UPDATE orders SET created_at = NOW() - INTERVAL '5 hours' WHERE id='E2E-7'`);

  const n = await cancelStaleOrders(60, 180);
  assert.ok(n >= 1);
  const status = await pool.query(`SELECT status FROM orders WHERE id='E2E-7'`);
  assert.equal(status.rows[0].status, 'CANCELLED');
  const after = await stockMap();
  for (const [id, v] of before) assert.ok(Math.abs(after.get(id).stock - v.stock) < 1e-6, `${id} restored`);
});

test('the menu and the live event both reflect a shared ingredient after another dish is ordered', { skip }, async () => {
  const { realtimeEmitter } = await import('../utils/realtimeEvents.js');
  await pool.query(`UPDATE inventory_ingredients SET current_stock = 3000 WHERE id = 'ing-shrimp-fresh'`);
  const bowlBefore = await servingsFromMenu('all-shrimp-bowl-699');

  // Stock broadcasts are debounced (150 ms): let the previous test's one go out first,
  // otherwise it can be mistaken for the event of the order placed below.
  await new Promise((r) => setTimeout(r, 300));

  const event = new Promise((resolve) => {
    const onUpdate = (e) => {
      if (e?.type === 'INVENTORY_CHANGED' && e.products) {
        realtimeEmitter.off('order_update', onUpdate);
        resolve(e);
      }
    };
    realtimeEmitter.on('order_update', onUpdate);
  });
  assert.equal((await api('POST', '/orders', posOrder('E2E-8', 4))).status, 201); // 4 x All Shrimp Alacarte
  const e = await event;

  assert.ok(e.ingredientIds.includes('ing-shrimp-fresh'));
  assert.ok(e.products['all-shrimp-bowl-699'], 'bowl (shares shrimp) is in the pushed update');
  assert.ok(e.products['mixed-seafoods-tub-189'], 'mixed seafood (shares shrimp) is in the pushed update');
  const bowlAfter = await servingsFromMenu('all-shrimp-bowl-699');
  assert.ok(bowlAfter < bowlBefore, `bowl ${bowlBefore} -> ${bowlAfter}`);
  assert.equal(e.products['all-shrimp-bowl-699'].servings.TAKE_OUT, bowlAfter);
  await restoreStock();
  await pool.query(`UPDATE inventory_ingredients SET current_stock = $1 WHERE id = 'ing-shrimp-fresh'`, [snapshot.get('ing-shrimp-fresh').stock]);
});

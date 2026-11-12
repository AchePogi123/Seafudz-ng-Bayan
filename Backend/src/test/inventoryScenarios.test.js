/**
 * Inventory scenario tests (HTTP level: real commits, real concurrent requests).
 *
 * Needs a DISPOSABLE Postgres with every migration applied (it commits and deletes rows):
 *   INVENTORY_TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/sfb_test \
 *     node --test --test-concurrency=1 src/test/inventoryScenarios.test.js
 *
 * It builds its own small catalog (ids starting with zzt- / ZZT-) so every expected number is
 * exact and nothing depends on the seeded menu. Everything it creates is removed afterwards.
 *
 *   Dish                 Food per serving                      Packaging
 *   Shrimp Ala Carte     150 g shrimp, 5 g garlic, 50 g butter take-out: 1 tray + shared bag (3 dishes/bag)
 *                                                              dine-in: 1 liner, delivery: +1 seal
 *   Shrimp Bowl          300 g shrimp, 10 g garlic, 100 g butter take-out: 1 tray + shared bag
 *   Shrimp Party Tray    800 g shrimp, 250 g butter            take-out: 2 trays + shared bag
 *   Rice Cup             200 g rice                            none
 *   Lemonade             22.5 ml juice (juice is stocked in L) none
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

/* ------------------------------------------------------------------ fixtures */

const ING = {
  shrimp: { id: 'zzt-shrimp', name: 'ZZT Shrimp', type: 'FOOD', unit: 'g', stock: 6000, min: 300 },
  garlic: { id: 'zzt-garlic', name: 'ZZT Garlic', type: 'FOOD', unit: 'g', stock: 500, min: 50 },
  butter: { id: 'zzt-butter', name: 'ZZT Butter', type: 'FOOD', unit: 'g', stock: 4000, min: 200 },
  rice: { id: 'zzt-rice', name: 'ZZT Rice', type: 'FOOD', unit: 'g', stock: 5000, min: 200 },
  juice: { id: 'zzt-juice', name: 'ZZT Juice', type: 'FOOD', unit: 'L', stock: 4, min: 0 },
  tray: { id: 'zzt-tray', name: 'ZZT Tray', type: 'PACKAGING', unit: 'pcs', stock: 100, min: 5 },
  bag: { id: 'zzt-bag', name: 'ZZT Bag', type: 'PACKAGING', unit: 'pcs', stock: 50, min: 5 },
  liner: { id: 'zzt-liner', name: 'ZZT Liner', type: 'PACKAGING', unit: 'pcs', stock: 40, min: 5 },
  seal: { id: 'zzt-seal', name: 'ZZT Seal', type: 'PACKAGING', unit: 'pcs', stock: 30, min: 5 },
};

const takeoutPkg = (trays) => [
  { ing: 'tray', qty: trays, fulfillment: 'TAKEOUT', scope: 'PER_ITEM' },
  { ing: 'bag', qty: 1, fulfillment: 'TAKEOUT', scope: 'SHARED_ORDER', capacity: 3 },
];

const DISH = {
  alacarte: {
    id: 'zzt-shrimp-alacarte',
    name: 'ZZT Shrimp Ala Carte',
    price: 199,
    food: [['shrimp', 150, 'g'], ['garlic', 5, 'g'], ['butter', 50, 'g']],
    packaging: [
      ...takeoutPkg(1),
      { ing: 'liner', qty: 1, fulfillment: 'DINE_IN', scope: 'PER_ITEM' },
      { ing: 'seal', qty: 1, fulfillment: 'DELIVERY', scope: 'PER_ITEM' },
    ],
  },
  bowl: {
    id: 'zzt-shrimp-bowl',
    name: 'ZZT Shrimp Bowl',
    price: 699,
    food: [['shrimp', 300, 'g'], ['garlic', 10, 'g'], ['butter', 100, 'g']],
    packaging: takeoutPkg(1),
  },
  party: {
    id: 'zzt-shrimp-party-tray',
    name: 'ZZT Shrimp Party Tray',
    price: 1099,
    food: [['shrimp', 800, 'g'], ['butter', 250, 'g']],
    packaging: takeoutPkg(2),
  },
  rice: { id: 'zzt-rice-cup', name: 'ZZT Rice Cup', price: 20, food: [['rice', 200, 'g']], packaging: [] },
  lemonade: { id: 'zzt-lemonade', name: 'ZZT Lemonade', price: 40, food: [['juice', 22.5, 'ml']], packaging: [] },
};

const ALL_ING_IDS = Object.values(ING).map((i) => i.id);
const BASE = Object.fromEntries(Object.entries(ING).map(([k, v]) => [k, v.stock]));

let server;
let base;
let pool;
let seq = 0;
const nextId = (tag) => `ZZT-${tag}-${++seq}`;

/* ------------------------------------------------------------------- helpers */

async function api(method, path, body) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** Current stock of every fixture item, keyed like ING ({ shrimp: 6000, ... }). */
async function stocks() {
  const { rows } = await pool.query(
    `SELECT id, current_stock::float8 AS stock FROM inventory_ingredients WHERE id = ANY($1::text[])`,
    [ALL_ING_IDS]
  );
  const byId = new Map(rows.map((r) => [r.id, r.stock]));
  return Object.fromEntries(Object.entries(ING).map(([k, v]) => [k, byId.get(v.id)]));
}

/** Asserts stock equals `from` adjusted by `delta` ({ shrimp: -150 }); every other item must be untouched. */
async function assertStock(from, delta = {}, label = '') {
  const now = await stocks();
  for (const key of Object.keys(ING)) {
    const expected = Math.round((from[key] + (delta[key] || 0)) * 10000) / 10000;
    assert.equal(now[key], expected, `${label} ${key}: expected ${expected}, found ${now[key]}`);
  }
  return now;
}

async function setStock(key, value) {
  await pool.query(
    `UPDATE inventory_ingredients SET current_stock = $2::numeric,
            status = CASE WHEN $2::numeric <= 0 THEN 'OUT_OF_STOCK' WHEN $2::numeric <= min_stock_level THEN 'LOW_STOCK' ELSE 'IN_STOCK' END
      WHERE id = $1`,
    [ING[key].id, value]
  );
}

/** Servings per order type for a fixture dish, as the menu reports them. */
async function servings(dishKey) {
  const { json } = await api('GET', '/menu');
  const row = json.data.find((p) => p.id === DISH[dishKey].id);
  assert.ok(row, `${dishKey} is on the menu`);
  return row.remaining_servings_by_fulfillment;
}

const cart = (lines) =>
  lines.map(([dishKey, quantity]) => {
    const d = DISH[dishKey];
    return { productId: d.id, name: d.name, unit_price: d.price, quantity, item: { id: d.id, name: d.name, price: d.price } };
  });

/** A POS order exactly as the cashier screen sends it. */
function posOrder(id, lines, orderType = 'DINE_IN') {
  return api('POST', '/orders', {
    id,
    ref: id,
    isPosOrder: true,
    status: 'CONFIRMED',
    orderType,
    type: orderType === 'DINE_IN' ? 'Dine In' : 'Take Out',
    paymentMethod: 'Cash',
    cartItems: cart(lines),
  });
}

/** An online order as the customer app sends it (DELIVERY pays by GCash, PICKUP pays in store). */
function onlineOrder(id, lines, fulfillmentType = 'DELIVERY') {
  return api('POST', '/user-flow/orders', {
    id,
    phone: '0917-000-0000',
    deliveryAddress: '123 Test St, Caloocan',
    paymentMethod: fulfillmentType === 'PICKUP' ? 'Pay in Store' : 'GCash',
    fulfillmentType,
    type: fulfillmentType === 'PICKUP' ? 'Store Pick-Up' : 'Delivery',
    orderType: 'ONLINE',
    items: lines.map(([dishKey, quantity]) => ({ id: DISH[dishKey].id, name: DISH[dishKey].name, quantity, price: DISH[dishKey].price })),
  });
}

const cancel = (id) => api('PATCH', `/user-flow/orders/${id}/cancel`, { status: 'CANCELLED' });
const kitchenStatus = (id, status) => api('PATCH', `/kitchen/orders/${id}/status`, { status });

/** Walks an order through the kitchen to served / delivered. */
async function complete(id) {
  assert.equal((await kitchenStatus(id, 'PREPARING')).status, 200);
  assert.equal((await kitchenStatus(id, 'READY')).status, 200);
  assert.equal((await api('PATCH', `/user-flow/orders/${id}/status`, { status: 'COMPLETED' })).status, 200);
}

async function ledger(orderId) {
  const { rows } = await pool.query(
    `SELECT ingredient_id, product_id, order_item_id, quantity::float8 AS quantity, state
       FROM order_inventory_ledger WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  return rows;
}

async function movements(orderId) {
  const { rows } = await pool.query(
    `SELECT ingredient_id, type, quantity_delta::float8 AS delta, stock_after::float8 AS stock_after
       FROM inventory_transactions WHERE order_id = $1 ORDER BY timestamp, id`,
    [orderId]
  );
  return rows;
}

const sumBy = (rows, pick, filter = () => true) =>
  Math.round(rows.filter(filter).reduce((n, r) => n + pick(r), 0) * 10000) / 10000;

async function orderStatus(id) {
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [id]);
  return rows[0]?.status ?? null;
}

async function orderItemId(orderId, dishKey) {
  const { rows } = await pool.query(
    `SELECT id FROM order_items WHERE order_id = $1 AND product_id = $2 ORDER BY id LIMIT 1`,
    [orderId, DISH[dishKey].id]
  );
  return rows[0]?.id;
}

async function cleanupOrders() {
  await pool.query(`DELETE FROM order_inventory_ledger WHERE order_id LIKE 'ZZT-%'`);
  await pool.query(`DELETE FROM inventory_transactions WHERE order_id LIKE 'ZZT-%' OR ingredient_id = ANY($1::text[])`, [ALL_ING_IDS]);
  for (const t of ['refunds', 'order_items', 'kitchen_orders', 'payments', 'deliveries']) {
    await pool.query(`DELETE FROM ${t} WHERE order_id LIKE 'ZZT-%'`);
  }
  await pool.query(`DELETE FROM orders WHERE id LIKE 'ZZT-%'`);
}

async function resetFixtures() {
  await cleanupOrders();
  for (const [key, ing] of Object.entries(ING)) await setStock(key, ing.stock);
  await pool.query(`UPDATE products SET is_available = TRUE WHERE id LIKE 'zzt-%'`);
}

async function createFixtures() {
  const { rows } = await pool.query(`SELECT id FROM categories ORDER BY id LIMIT 1`);
  const categoryId = rows[0].id;
  for (const ing of Object.values(ING)) {
    await pool.query(
      `INSERT INTO inventory_ingredients (id, name, item_type, category, base_unit, current_stock, min_stock_level, status)
       VALUES ($1,$2,$3,'ZZT Test',$4,$5,$6,'IN_STOCK')
       ON CONFLICT (id) DO UPDATE SET base_unit = EXCLUDED.base_unit, current_stock = EXCLUDED.current_stock,
         min_stock_level = EXCLUDED.min_stock_level, item_type = EXCLUDED.item_type, status = 'IN_STOCK'`,
      [ing.id, ing.name, ing.type, ing.unit, ing.stock, ing.min]
    );
  }
  for (const d of Object.values(DISH)) {
    await pool.query(
      `INSERT INTO products (id, category_id, name, price) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET is_available = TRUE, is_active = TRUE`,
      [d.id, categoryId, d.name, d.price]
    );
    await pool.query(
      `INSERT INTO product_recipes (product_id, product_name, product_price, is_configured) VALUES ($1,$2,$3,TRUE)
       ON CONFLICT (product_id) DO UPDATE SET is_configured = TRUE`,
      [d.id, d.name, d.price]
    );
    await pool.query(`DELETE FROM recipe_ingredients WHERE product_id = $1`, [d.id]);
    await pool.query(`DELETE FROM recipe_packaging WHERE product_id = $1`, [d.id]);
    for (const [key, portion, unit] of d.food) {
      await pool.query(
        `INSERT INTO recipe_ingredients (product_id, ingredient_id, ingredient_name, portion_quantity, unit) VALUES ($1,$2,$3,$4,$5)`,
        [d.id, ING[key].id, ING[key].name, portion, unit]
      );
    }
    for (const [i, p] of d.packaging.entries()) {
      await pool.query(
        `INSERT INTO recipe_packaging (id, product_id, packaging_id, packaging_name, quantity, unit, fulfillment_type, scope, shared_capacity)
         VALUES ($1,$2,$3,$4,$5,'pcs',$6,$7,$8)`,
        [`${d.id}-p${i}`.slice(0, 50), d.id, ING[p.ing].id, ING[p.ing].name, p.qty, p.fulfillment, p.scope, p.capacity || null]
      );
    }
  }
}

async function removeFixtures() {
  await cleanupOrders();
  await pool.query(`DELETE FROM inventory_purchase_orders WHERE notes = 'ZZT-SCENARIO'`);
  await pool.query(`DELETE FROM product_recipes WHERE product_id LIKE 'zzt-%'`);
  await pool.query(`DELETE FROM inventory_ingredients WHERE id LIKE 'zzt-%'`);
  await pool.query(`DELETE FROM products WHERE id LIKE 'zzt-%'`);
}

test.before(async () => {
  if (!url) return;
  pool = new pg.Pool({ connectionString: url, max: 4 });
  await removeFixtures();
  await createFixtures();
  const names = ['menuRoutes', 'orderRoutes', 'kitchenRoutes', 'riderRoutes', 'assistantRoutes', 'userFlowRoutes', 'inventoryRoutes'];
  const app = express();
  app.use(express.json());
  for (const name of names) app.use('/api', (await import(`../routes/${name}.js`)).default); // same order as server.js
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  if (url) await resetFixtures();
});

test.after(async () => {
  if (!url) return;
  await new Promise((r) => setTimeout(r, 250)); // let the debounced stock broadcast finish
  await removeFixtures();
  await new Promise((r) => server?.close(r));
  await pool.end();
  setTimeout(() => process.exit(0), 100).unref();
});

/* ============================================================ the scenarios */

test('fixture sanity: servings are limited by the scarcest item in each recipe', { skip }, async () => {
  assert.deepEqual(await servings('alacarte'), { DINE_IN: 40, TAKE_OUT: 40, PICKUP: 40, DELIVERY: 30 });
  assert.deepEqual(await servings('bowl'), { DINE_IN: 20, TAKE_OUT: 20, PICKUP: 20, DELIVERY: 20 });
  assert.deepEqual(await servings('party'), { DINE_IN: 7, TAKE_OUT: 7, PICKUP: 7, DELIVERY: 7 });
  assert.deepEqual(await servings('rice'), { DINE_IN: 25, TAKE_OUT: 25, PICKUP: 25, DELIVERY: 25 });
  assert.equal((await servings('lemonade')).DINE_IN, 177); // 4 L / 22.5 ml

  // garlic becomes the scarcest ingredient: it (not shrimp) now sets the number
  await setStock('garlic', 52);
  assert.equal((await servings('alacarte')).DINE_IN, 10); // 52 / 5
  assert.equal((await servings('bowl')).DINE_IN, 5); // 52 / 10
  assert.equal((await servings('party')).DINE_IN, 7); // no garlic in this recipe
});

test('scenario 1: an order deducts every ingredient in the recipe, the right amount, and nothing else', { skip }, async () => {
  const before = await stocks();
  const id = nextId('S1');
  const res = await posOrder(id, [['alacarte', 1]], 'DINE_IN');
  assert.equal(res.status, 201, JSON.stringify(res.json));

  await assertStock(before, { shrimp: -150, garlic: -5, butter: -50, liner: -1 }, 'after order');

  const rows = await ledger(id);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.state === 'RESERVED' && r.product_id === DISH.alacarte.id));

  const now = await stocks();
  const tx = await movements(id);
  assert.equal(tx.length, 4, 'one stock movement per ingredient');
  for (const [key, delta] of [['shrimp', -150], ['garlic', -5], ['butter', -50], ['liner', -1]]) {
    const row = tx.find((t) => t.ingredient_id === ING[key].id);
    assert.ok(row, `${key} movement recorded`);
    assert.equal(row.type, 'CONSUMPTION');
    assert.equal(row.delta, delta);
    assert.equal(row.stock_after, now[key], `${key} stock_after matches the stock on hand`);
  }
});

test('scenario 2: shared ingredients are deducted once and every dish that uses them is recalculated', { skip }, async () => {
  const before = await stocks();
  const id = nextId('S2');
  assert.equal((await posOrder(id, [['alacarte', 4]], 'DINE_IN')).status, 201);

  // shrimp left the building once: 4 x 150 g
  await assertStock(before, { shrimp: -600, garlic: -20, butter: -200, liner: -4 }, 'after order');
  assert.deepEqual([...new Set((await ledger(id)).map((r) => r.product_id))], [DISH.alacarte.id], 'only the ordered dish holds stock');

  // every dish sharing shrimp / garlic / butter moved; unrelated dishes did not
  assert.deepEqual(await servings('alacarte'), { DINE_IN: 36, TAKE_OUT: 36, PICKUP: 36, DELIVERY: 30 });
  assert.equal((await servings('bowl')).DINE_IN, 18); // 5400 / 300
  assert.equal((await servings('party')).DINE_IN, 6); // 5400 / 800
  assert.equal((await servings('rice')).DINE_IN, 25);
  assert.equal((await servings('lemonade')).DINE_IN, 177);
});

test('scenario 3: cancelling an order restores exactly what it took', { skip }, async () => {
  const before = await stocks();
  const servingsBefore = await servings('bowl');
  const id = nextId('S3');
  assert.equal((await posOrder(id, [['alacarte', 2], ['bowl', 1]], 'TAKE_OUT')).status, 201);
  await assertStock(before, { shrimp: -600, garlic: -20, butter: -200, tray: -3, bag: -1 }, 'after order');

  const res = await cancel(id);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  await assertStock(before, {}, 'after cancel');
  assert.deepEqual(await servings('bowl'), servingsBefore);
  assert.equal(await orderStatus(id), 'CANCELLED');

  const rows = await ledger(id);
  assert.ok(rows.length > 0 && rows.every((r) => r.state === 'RETURNED'));
  const tx = await movements(id);
  for (const ingId of new Set(tx.map((t) => t.ingredient_id))) {
    assert.equal(sumBy(tx, (t) => t.delta, (t) => t.ingredient_id === ingId), 0, `${ingId} movements net to zero`);
  }
  assert.equal(tx.filter((t) => t.type === 'ORDER_RETURN').length, 5, 'one return movement per item taken');
});

test('scenario 4: cancelling twice, or from several screens at once, restores stock only once', { skip }, async () => {
  const before = await stocks();

  // (a) the same request repeated
  const a = nextId('S4a');
  assert.equal((await posOrder(a, [['alacarte', 2]], 'TAKE_OUT')).status, 201);
  assert.equal((await cancel(a)).status, 200);
  assert.equal((await cancel(a)).status, 200);
  await assertStock(before, {}, 'after cancelling twice');
  assert.equal((await movements(a)).filter((t) => t.type === 'ORDER_RETURN').length, 5, 'shrimp, garlic, butter, tray, bag: once each');

  // (b) every cancel route at the same moment
  const b = nextId('S4b');
  assert.equal((await posOrder(b, [['alacarte', 2], ['party', 1]], 'TAKE_OUT')).status, 201);
  await assertStock(before, { shrimp: -1100, garlic: -10, butter: -350, tray: -4, bag: -1 }, 'after second order');
  await Promise.all([
    cancel(b),
    cancel(b),
    api('POST', `/user-flow/orders/${b}/request-cancellation`, {}),
    api('PATCH', `/user-flow/orders/${b}/status`, { status: 'CANCELLED' }),
    kitchenStatus(b, 'CANCELLED'),
    api('PATCH', `/orders/${b}/status`, { status: 'CANCELLED' }),
    api('DELETE', `/kitchen/orders/${b}`),
  ]);
  await assertStock(before, {}, 'after concurrent cancels');
  assert.equal(await orderStatus(b), 'CANCELLED');
  const rows = await ledger(b);
  assert.ok(rows.every((r) => r.state === 'RETURNED'), 'nothing left reserved');
  assert.equal((await movements(b)).filter((t) => t.type === 'ORDER_RETURN').length, 5, 'each item returned exactly once');
});

test('scenario 5: a depleted ingredient sells out the dishes that need it and no others', { skip }, async () => {
  // use up garlic through the admin screen (waste), leaving less than one portion
  const waste = await api('POST', '/inventory/movements', { ingredientId: ING.garlic.id, delta: -496, type: 'WASTE', reason: 'ZZT spoilage' });
  assert.equal(waste.status, 201, JSON.stringify(waste.json));
  assert.equal(waste.json.data.ingredient.currentStock, 4);

  for (const f of ['DINE_IN', 'TAKE_OUT', 'PICKUP', 'DELIVERY']) {
    assert.equal((await servings('alacarte'))[f], 0, `ala carte ${f}`);
    assert.equal((await servings('bowl'))[f], 0, `bowl ${f}`);
  }
  assert.equal((await servings('party')).DINE_IN, 7, 'the tray has no garlic, so it is still on');
  assert.equal((await servings('rice')).DINE_IN, 25);

  const refused = await posOrder(nextId('S5'), [['alacarte', 1]]);
  assert.equal(refused.status, 409);
  assert.equal(refused.json.error, 'INSUFFICIENT_STOCK');
  assert.equal((await posOrder(nextId('S5'), [['party', 1]])).status, 201, 'unaffected dish can still be ordered');

  // nothing ever goes below zero
  await setStock('shrimp', 0);
  for (const dish of ['alacarte', 'bowl', 'party']) {
    for (const n of Object.values(await servings(dish))) assert.equal(n, 0);
  }
  const over = await api('POST', '/inventory/movements', { ingredientId: ING.garlic.id, delta: -5, type: 'WASTE' });
  assert.equal(over.status, 400, 'stock cannot be pushed below zero');
  assert.equal((await stocks()).garlic, 4);
});

test('scenario 6: an order that cannot be covered is refused and leaves nothing half-deducted', { skip }, async () => {
  await setStock('shrimp', 400);
  const before = await stocks();

  // rice is fine, the two bowls (600 g shrimp) are not: the whole order must be refused
  const id = nextId('S6');
  const res = await posOrder(id, [['rice', 1], ['bowl', 2]], 'TAKE_OUT');
  assert.equal(res.status, 409, JSON.stringify(res.json));
  assert.equal(res.json.error, 'INSUFFICIENT_STOCK');
  assert.match(res.json.message, /ZZT Shrimp Bowl/);
  const short = res.json.details.shortages.find((s) => s.ingredientId === ING.shrimp.id);
  assert.equal(short.needed, 600);
  assert.equal(short.available, 400);

  await assertStock(before, {}, 'after refused POS order');
  assert.equal(await orderStatus(id), null, 'order was not created');
  assert.equal((await ledger(id)).length, 0);
  assert.equal((await movements(id)).length, 0);

  const online = nextId('S6');
  const res2 = await onlineOrder(online, [['rice', 1], ['bowl', 2]], 'DELIVERY');
  assert.equal(res2.status, 409, JSON.stringify(res2.json));
  assert.equal(res2.json.error, 'INSUFFICIENT_STOCK');
  await assertStock(before, {}, 'after refused online order');
  assert.equal(await orderStatus(online), null);

  // exactly what is left can still be sold
  assert.equal((await posOrder(nextId('S6'), [['bowl', 1]], 'DINE_IN')).status, 201);
  assert.equal((await stocks()).shrimp, 100);
});

test('scenario 7: quantities scale the deduction and the cancellation gives the same total back', { skip }, async () => {
  const before = await stocks();
  const id = nextId('S7');
  assert.equal((await posOrder(id, [['alacarte', 7]], 'TAKE_OUT')).status, 201);
  // 7 dishes: 7 trays, and 3 shared bags (3 dishes per bag)
  await assertStock(before, { shrimp: -1050, garlic: -35, butter: -350, tray: -7, bag: -3 }, 'after order');
  assert.equal((await servings('alacarte')).TAKE_OUT, 33); // 4950 / 150
  assert.equal((await servings('bowl')).TAKE_OUT, 16); // 4950 / 300

  assert.equal((await cancel(id)).status, 200);
  await assertStock(before, {}, 'after cancel');
  assert.equal((await servings('alacarte')).TAKE_OUT, 40);
});

test('scenario 8: restocking brings sold-out dishes back', { skip }, async () => {
  await setStock('garlic', 0);
  assert.equal((await servings('alacarte')).DINE_IN, 0);
  assert.equal((await servings('bowl')).DINE_IN, 0);

  const restock = await api('POST', '/inventory/movements', { ingredientId: ING.garlic.id, delta: 250, type: 'STOCK_RECEIVED', reason: 'ZZT delivery' });
  assert.equal(restock.status, 201, JSON.stringify(restock.json));
  assert.equal(restock.json.data.ingredient.currentStock, 250);
  assert.equal(restock.json.data.ingredient.status, 'IN_STOCK');
  assert.equal(restock.json.data.transaction.type, 'STOCK_RECEIVED');
  assert.equal(restock.json.data.transaction.quantityDelta, 250);
  assert.equal(restock.json.data.transaction.stockAfter, 250);

  assert.equal((await servings('alacarte')).DINE_IN, 40); // garlic allows 50, shrimp/liner 40
  assert.equal((await servings('bowl')).DINE_IN, 20); // garlic allows 25, shrimp 20
  assert.equal((await posOrder(nextId('S8'), [['alacarte', 1]])).status, 201);

  // receiving a purchase order is the other way stock comes in
  const { rows } = await pool.query(`SELECT id FROM inventory_suppliers LIMIT 1`);
  const po = await api('POST', '/inventory/purchase-orders', {
    supplierId: rows[0].id,
    notes: 'ZZT-SCENARIO',
    items: [{ ingredientId: ING.shrimp.id, ingredientName: ING.shrimp.name, itemType: 'FOOD', orderedQuantity: 2000, unit: 'g', unitCost: 0.4 }],
  });
  assert.equal(po.status, 201, JSON.stringify(po.json));
  const shrimpBefore = (await stocks()).shrimp;
  const received = await api('POST', `/inventory/purchase-orders/${po.json.data.id}/receive`, {
    items: [{ itemId: po.json.data.items[0].id, ingredientId: ING.shrimp.id, receivedQty: 2000, unit: 'g' }],
  });
  assert.equal(received.status, 200, JSON.stringify(received.json));
  assert.equal((await stocks()).shrimp, shrimpBefore + 2000);
  assert.equal((await servings('party')).DINE_IN, 9); // (5850 + 2000) / 800
});

test('scenario 9: orders racing for the same ingredient cannot oversell it', { skip }, async () => {
  // two orders, each needing all of the remaining shrimp
  await setStock('shrimp', 300);
  let results = await Promise.all([posOrder(nextId('S9'), [['alacarte', 2]]), posOrder(nextId('S9'), [['alacarte', 2]])]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await stocks()).shrimp, 0);

  // eight at once, stock for exactly three
  await resetFixtures();
  await setStock('shrimp', 450);
  results = await Promise.all(Array.from({ length: 8 }, () => posOrder(nextId('S9'), [['alacarte', 1]])));
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  let now = await stocks();
  assert.equal(now.shrimp, 0);
  assert.equal(now.garlic, BASE.garlic - 15);
  assert.equal(now.liner, BASE.liner - 3);

  // different dishes, POS and online, sharing one ingredient: 1000 g covers the tray or two bowls, not both
  await resetFixtures();
  await setStock('shrimp', 1000);
  results = await Promise.all([
    posOrder(nextId('S9'), [['party', 1]], 'TAKE_OUT'),
    onlineOrder(nextId('S9'), [['bowl', 2]], 'DELIVERY'),
    posOrder(nextId('S9'), [['party', 1]], 'DINE_IN'),
  ]);
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(results.filter((r) => r.status === 409).length, 3 - ok);
  now = await stocks();
  assert.ok(now.shrimp >= 0, 'never negative');
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0)::float8 AS held FROM order_inventory_ledger
      WHERE order_id LIKE 'ZZT-S9-%' AND ingredient_id = $1 AND state = 'RESERVED'`,
    [ING.shrimp.id]
  );
  assert.equal(rows[0].held + now.shrimp, 1000, 'what orders hold plus what is left is what there was');
  assert.ok(ok >= 1);
});

test('scenario 9b: the same order submitted twice at once is only deducted once', { skip }, async () => {
  const before = await stocks();
  const id = nextId('S9dup');
  const results = await Promise.all([posOrder(id, [['alacarte', 2]], 'DINE_IN'), posOrder(id, [['alacarte', 2]], 'DINE_IN')]);
  assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.json)));
  await assertStock(before, { shrimp: -300, garlic: -10, butter: -100, liner: -2 }, 'after duplicate submit');
});

test('scenario 10: packaging follows the order type, shared packaging is counted per order', { skip }, async () => {
  const before = await stocks();
  const food = { shrimp: -150, garlic: -5, butter: -50 };

  assert.equal((await posOrder(nextId('S10'), [['alacarte', 1]], 'DINE_IN')).status, 201);
  let now = await assertStock(before, { ...food, liner: -1 }, 'dine-in');

  assert.equal((await posOrder(nextId('S10'), [['alacarte', 1]], 'TAKE_OUT')).status, 201);
  now = await assertStock(now, { ...food, tray: -1, bag: -1 }, 'take-out');

  assert.equal((await onlineOrder(nextId('S10'), [['alacarte', 1]], 'PICKUP')).status, 201);
  now = await assertStock(now, { ...food, tray: -1, bag: -1 }, 'pick-up');

  assert.equal((await onlineOrder(nextId('S10'), [['alacarte', 1]], 'DELIVERY')).status, 201);
  now = await assertStock(now, { ...food, tray: -1, bag: -1, seal: -1 }, 'delivery');

  // four dishes on two lines share bags: ceil(4 / 3) = 2, not one per dish or per line
  const shared = nextId('S10');
  assert.equal((await posOrder(shared, [['alacarte', 2], ['bowl', 2]], 'TAKE_OUT')).status, 201);
  await assertStock(now, { shrimp: -900, garlic: -30, butter: -300, tray: -4, bag: -2 }, 'shared bag');
  const bagRows = (await ledger(shared)).filter((r) => r.ingredient_id === ING.bag.id);
  assert.equal(bagRows.length, 1, 'one shared line for the whole order');
  assert.equal(bagRows[0].quantity, 2);
});

test('scenario 10b: running out of packaging only stops the order types that need it', { skip }, async () => {
  await setStock('tray', 0);
  assert.deepEqual(await servings('alacarte'), { DINE_IN: 40, TAKE_OUT: 0, PICKUP: 0, DELIVERY: 0 });
  assert.deepEqual(await servings('bowl'), { DINE_IN: 20, TAKE_OUT: 0, PICKUP: 0, DELIVERY: 0 });
  assert.equal((await servings('rice')).TAKE_OUT, 25, 'a dish with no packaging is unaffected');

  const takeOut = await posOrder(nextId('S10b'), [['alacarte', 1]], 'TAKE_OUT');
  assert.equal(takeOut.status, 409);
  assert.equal(takeOut.json.details.shortages[0].ingredientId, ING.tray.id);
  assert.equal((await posOrder(nextId('S10b'), [['alacarte', 1]], 'DINE_IN')).status, 201, 'dine-in does not need a tray');

  // and the other way round: no dine-in liners does not block take-out
  await resetFixtures();
  await setStock('liner', 0);
  assert.equal((await servings('alacarte')).DINE_IN, 0);
  assert.equal((await servings('alacarte')).TAKE_OUT, 40);
  assert.equal((await posOrder(nextId('S10b'), [['alacarte', 1]], 'TAKE_OUT')).status, 201);
  assert.equal((await posOrder(nextId('S10b'), [['alacarte', 1]], 'DINE_IN')).status, 409);
});

/* ================================================= order lifecycle + inventory */

test('editing an order swaps its stock exactly, and an edit that cannot be covered changes nothing', { skip }, async () => {
  const before = await stocks();
  const id = nextId('EDIT');
  assert.equal((await posOrder(id, [['alacarte', 2]], 'TAKE_OUT')).status, 201);

  const toItems = (lines) => lines.map(([k, quantity]) => ({ productId: DISH[k].id, name: DISH[k].name, quantity, price: DISH[k].price }));
  const edit = await api('PUT', `/orders/${id}`, { status: 'CONFIRMED', items: toItems([['alacarte', 1], ['rice', 2]]) });
  assert.equal(edit.status, 200, JSON.stringify(edit.json));
  const afterEdit = await assertStock(before, { shrimp: -150, garlic: -5, butter: -50, rice: -400, tray: -1, bag: -1 }, 'after edit');

  await setStock('shrimp', 100); // less than the extra 300 g the next edit needs
  const afterShort = await stocks();
  const refused = await api('PUT', `/orders/${id}`, { status: 'CONFIRMED', items: toItems([['alacarte', 3]]) });
  assert.equal(refused.status, 409, JSON.stringify(refused.json));
  assert.equal(refused.json.error, 'INSUFFICIENT_STOCK');
  await assertStock(afterShort, {}, 'after refused edit');
  const { rows } = await pool.query(`SELECT product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY id`, [id]);
  assert.deepEqual(rows.map((r) => [r.product_id, r.quantity]), [[DISH.alacarte.id, 1], [DISH.rice.id, 2]], 'items untouched');

  await setStock('shrimp', afterEdit.shrimp);
  assert.equal((await cancel(id)).status, 200);
  await assertStock(before, {}, 'after cancelling the edited order');
});

test('cancelling after the kitchen started: food is written off, packaging returns, waste is recorded exactly', { skip }, async () => {
  const before = await stocks();
  const id = nextId('WASTE');
  assert.equal((await posOrder(id, [['alacarte', 2]], 'TAKE_OUT')).status, 201);
  // cashier corrects the order to one dish before the kitchen starts
  const edit = await api('PUT', `/orders/${id}`, {
    status: 'CONFIRMED',
    items: [{ productId: DISH.alacarte.id, name: DISH.alacarte.name, quantity: 1, price: DISH.alacarte.price }],
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.json));
  assert.equal((await kitchenStatus(id, 'PREPARING')).status, 200);
  assert.equal((await cancel(id)).status, 400, 'customer / cashier cancel is blocked once cooking');
  assert.equal((await api('PATCH', `/orders/${id}/status`, { status: 'CANCELLED' })).status, 200);

  // one dish was cooked and binned: its food stays gone, its tray and bag come back
  await assertStock(before, { shrimp: -150, garlic: -5, butter: -50 }, 'after late cancel');

  const tx = await movements(id);
  const waste = (key) => sumBy(tx, (t) => t.delta, (t) => t.type === 'WASTE' && t.ingredient_id === ING[key].id);
  assert.equal(waste('shrimp'), -150, 'waste equals what was actually written off');
  assert.equal(waste('garlic'), -5);
  assert.equal(waste('butter'), -50);
  assert.equal(waste('tray'), 0, 'packaging is not waste');
  // and the history still adds up to the change in stock
  assert.equal(sumBy(tx, (t) => t.delta, (t) => t.ingredient_id === ING.shrimp.id), -150);
  assert.equal(sumBy(tx, (t) => t.delta, (t) => t.ingredient_id === ING.tray.id), 0);
});

test('a served order keeps its stock consumed: late cancel, delete and re-cancel never give it back', { skip }, async () => {
  const before = await stocks();
  const used = { shrimp: -150, garlic: -5, butter: -50, tray: -1, bag: -1 };

  const id = nextId('DONE');
  assert.equal((await posOrder(id, [['alacarte', 1]], 'TAKE_OUT')).status, 201);
  await complete(id);
  await assertStock(before, used, 'after serving');
  assert.ok((await ledger(id)).every((r) => r.state === 'CONSUMED'), 'served stock is closed as consumed');

  // an admin correcting the record of a served order does not move stock
  const fix = await api('PUT', `/orders/${id}`, {
    adminOverride: true,
    items: [{ productId: DISH.alacarte.id, name: DISH.alacarte.name, quantity: 3, price: DISH.alacarte.price }],
  });
  assert.equal(fix.status, 200, JSON.stringify(fix.json));
  await assertStock(before, used, 'after correcting a served order');

  // an admin voiding the finished order must not put the tray and bag back on the shelf
  assert.equal((await api('PATCH', `/orders/${id}/status`, { status: 'CANCELLED' })).status, 200);
  await assertStock(before, used, 'after voiding a served order');
  await cancel(id);
  await assertStock(before, used, 'after cancelling it again');
  const tx = await movements(id);
  assert.equal(tx.filter((t) => t.type === 'ORDER_RETURN').length, 0);
  assert.equal(tx.filter((t) => t.type === 'WASTE').length, 0, 'served food is usage, not waste');

  // deleting a served order: stock stays, and it no longer counts as holding stock
  const del = nextId('DONE');
  assert.equal((await posOrder(del, [['alacarte', 1]], 'TAKE_OUT')).status, 201);
  await complete(del);
  assert.equal((await api('DELETE', `/orders/${del}`)).status, 200);
  await assertStock(before, { shrimp: -300, garlic: -10, butter: -100, tray: -2, bag: -2 }, 'after deleting a served order');
  assert.equal((await ledger(del)).filter((r) => r.state === 'RESERVED').length, 0, 'no reservation left behind');
});

test('served orders do not block the admin from reloading inventory, open orders still do', { skip }, async () => {
  const id = nextId('RELOAD');
  assert.equal((await posOrder(id, [['rice', 1]], 'DINE_IN')).status, 201);
  await complete(id);

  // park anything other tests / a copied database left open, so only our served order is in play
  const parked = (await pool.query(
    `UPDATE order_inventory_ledger SET state = 'RETURNED' WHERE state = 'RESERVED' AND order_id <> $1 RETURNING id`, [id]
  )).rows.map((r) => r.id);
  try {
    const state = (await api('GET', '/inventory/state')).json.data;
    const snapshot = { ingredients: state.ingredients, recipes: state.recipes, suppliers: state.suppliers };
    const ok = await api('POST', '/inventory/replace-all', snapshot);
    assert.equal(ok.status, 200, JSON.stringify(ok.json?.message));

    const open = nextId('RELOAD');
    assert.equal((await posOrder(open, [['rice', 1]], 'DINE_IN')).status, 201);
    assert.equal((await api('POST', '/inventory/replace-all', snapshot)).status, 409, 'an open order still blocks it');
    assert.equal((await cancel(open)).status, 200);
  } finally {
    if (parked.length) await pool.query(`UPDATE order_inventory_ledger SET state = 'RESERVED' WHERE id = ANY($1::bigint[])`, [parked]);
  }
});

test('wiping transactions returns stock held by open orders, not stock that was already served', { skip }, async () => {
  const { returnAllReservedStock } = await import('../services/inventoryService.js');
  const before = await stocks();
  const served = nextId('WIPE');
  const open = nextId('WIPE');
  assert.equal((await posOrder(served, [['bowl', 1]], 'DINE_IN')).status, 201);
  await complete(served);
  assert.equal((await posOrder(open, [['party', 1]], 'DINE_IN')).status, 201);
  await assertStock(before, { shrimp: -1100, garlic: -10, butter: -350 }, 'before wipe');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await returnAllReservedStock(client);
    const { rows } = await client.query(
      `SELECT id, current_stock::float8 AS stock FROM inventory_ingredients WHERE id = ANY($1::text[])`,
      [[ING.shrimp.id, ING.garlic.id, ING.butter.id]]
    );
    const s = new Map(rows.map((r) => [r.id, r.stock]));
    // the open party tray (800 g shrimp, 250 g butter) comes back; the served bowl stays used
    assert.equal(s.get(ING.shrimp.id), before.shrimp - 300);
    assert.equal(s.get(ING.garlic.id), before.garlic - 10);
    assert.equal(s.get(ING.butter.id), before.butter - 100);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('re-using the id of a finished order still deducts the new order', { skip }, async () => {
  // the POS numbers orders POS-0000..9999, so ids do come round again
  const before = await stocks();
  const id = nextId('REUSE');
  assert.equal((await posOrder(id, [['rice', 1]], 'DINE_IN')).status, 201);
  await complete(id);
  assert.equal((await posOrder(id, [['rice', 2]], 'DINE_IN')).status, 201);
  await assertStock(before, { rice: -600 }, 'after the id was used again');

  // the new order has not reached the kitchen: cancelling it returns its rice (the first one stays used)
  assert.equal((await cancel(id)).status, 200);
  await assertStock(before, { rice: -200 }, 'after cancelling the second order');
});

test('transactions recorded by the admin: a cancelled one takes no stock, a completed one is consumed', { skip }, async () => {
  const before = await stocks();
  // the admin "create transaction" form sends item names only, and the final status
  const record = (id, status) =>
    api('POST', '/orders', {
      id,
      ref: id,
      isPosOrder: true,
      status,
      orderType: 'TAKE OUT',
      type: 'Take Out',
      paymentMethod: 'Cash',
      paymentStatus: 'PAID',
      cartItems: [{ name: DISH.rice.name, quantity: 2, price: 20, item: { name: DISH.rice.name, price: 20 } }],
    });

  const cancelled = nextId('ADMIN');
  assert.equal((await record(cancelled, 'CANCELLED')).status, 201);
  await assertStock(before, {}, 'after recording a cancelled transaction');
  assert.equal((await ledger(cancelled)).length, 0);

  const done = nextId('ADMIN');
  assert.equal((await record(done, 'COMPLETED')).status, 201);
  await assertStock(before, { rice: -400 }, 'after recording a completed transaction');
  assert.ok((await ledger(done)).every((r) => r.state === 'CONSUMED'));
  await cancel(done);
  await api('PATCH', `/orders/${done}/status`, { status: 'CANCELLED' });
  await assertStock(before, { rice: -400 }, 'a completed sale cannot be returned to stock');
});

test('handing a pick-up order to the customer consumes its stock', { skip }, async () => {
  const before = await stocks();
  const used = { shrimp: -150, garlic: -5, butter: -50, tray: -1, bag: -1 };
  const id = nextId('PICKUP');
  assert.equal((await onlineOrder(id, [['alacarte', 1]], 'PICKUP')).status, 201);
  assert.equal((await kitchenStatus(id, 'PREPARING')).status, 200);
  assert.equal((await kitchenStatus(id, 'READY')).status, 200);
  const handover = await api('POST', `/orders/${id}/pickup-handover`, { paymentMethod: 'Cash' });
  assert.equal(handover.status, 200, JSON.stringify(handover.json));
  assert.equal(await orderStatus(id), 'COMPLETED');
  assert.ok((await ledger(id)).every((r) => r.state === 'CONSUMED'));

  await api('PATCH', `/orders/${id}/status`, { status: 'CANCELLED' });
  await assertStock(before, used, 'after voiding the handed-over order');
});

test('an order edit and a new order for the same ingredients at the same moment both go through', { skip }, async () => {
  const before = await stocks();
  const rounds = 12;
  for (let i = 0; i < rounds; i += 1) {
    const id = nextId('RACE');
    assert.equal((await posOrder(id, [['rice', 1]], 'DINE_IN')).status, 201);
    // the edit gives rice back and takes shrimp/garlic/butter; the new order takes all four
    const [edit, fresh] = await Promise.all([
      api('PUT', `/orders/${id}`, {
        status: 'CONFIRMED',
        items: [{ productId: DISH.alacarte.id, name: DISH.alacarte.name, quantity: 1, price: DISH.alacarte.price }],
      }),
      posOrder(nextId('RACE'), [['alacarte', 1], ['rice', 1]], 'DINE_IN'),
    ]);
    assert.equal(edit.status, 200, `round ${i}: ${JSON.stringify(edit.json)}`);
    assert.equal(fresh.status, 201, `round ${i}: ${JSON.stringify(fresh.json)}`);
  }
  // every edit and every new order was really saved: 2 ala cartes and 1 rice cup per round
  await assertStock(before, {
    shrimp: -300 * rounds, garlic: -10 * rounds, butter: -100 * rounds, liner: -2 * rounds, rice: -200 * rounds,
  }, 'after the races');
});

test('kitchen declining a large order returns the stock it was holding', { skip }, async () => {
  const before = await stocks();
  const id = nextId('DECLINE');
  assert.equal((await onlineOrder(id, [['party', 2]], 'DELIVERY')).status, 201);
  await assertStock(before, { shrimp: -1600, butter: -500, tray: -4, bag: -1 }, 'after order');

  const res = await api('PATCH', `/kitchen/orders/${id}/reject-quantities`, { reason: 'ZZT too large' });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(await orderStatus(id), 'KITCHEN_REJECTED');
  await assertStock(before, {}, 'after the kitchen declined');
  await api('PATCH', `/kitchen/orders/${id}/reject-quantities`, { reason: 'again' });
  await assertStock(before, {}, 'after declining twice');
});

test('out-of-stock replacement: the removed dish is returned, the new one deducted, the shared bag not doubled', { skip }, async () => {
  const before = await stocks();
  const id = nextId('SWAP');
  assert.equal((await onlineOrder(id, [['alacarte', 1], ['bowl', 1]], 'DELIVERY')).status, 201);
  await assertStock(before, { shrimp: -450, garlic: -15, butter: -150, tray: -2, bag: -1, seal: -1 }, 'after order');

  const bowlItem = await orderItemId(id, 'bowl');
  const flag = await api('PATCH', `/kitchen/orders/${id}/flag-out-of-stock`, { itemIds: [bowlItem] });
  assert.equal(flag.status, 200, JSON.stringify(flag.json));
  await assertStock(before, { shrimp: -150, garlic: -5, butter: -50, tray: -1, bag: -1, seal: -1 }, 'after the kitchen flagged the bowl');

  const choice = await api('PATCH', `/user-flow/orders/${id}/out-of-stock-choice`, {
    resolution: 'REPLACE',
    replacements: [{ oldItemId: bowlItem, newProductId: DISH.party.id, newName: DISH.party.name, newPrice: DISH.party.price }],
  });
  assert.equal(choice.status, 200, JSON.stringify(choice.json));
  const resolve = await api('PATCH', `/assistant/orders/${id}/resolve-out-of-stock`, { resolution: 'REPLACE' });
  assert.equal(resolve.status, 200, JSON.stringify(resolve.json));

  // ala carte + party tray: 2 dishes still fit the one bag the order already has
  await assertStock(before, { shrimp: -950, garlic: -5, butter: -300, tray: -3, bag: -1, seal: -1 }, 'after replacement');

  assert.equal((await cancel(id)).status, 200);
  await assertStock(before, {}, 'after cancelling the replaced order');
});

/* ============================================================ record keeping */

test('stock kept in kg / L with recipes in g / ml is deducted and restored exactly', { skip }, async () => {
  const before = await stocks(); // 4 L of juice, 22.5 ml per lemonade
  const first = nextId('UNIT');
  assert.equal((await posOrder(first, [['lemonade', 1]])).status, 201);
  await assertStock(before, { juice: -0.0225 }, 'after one lemonade');
  assert.equal((await movements(first))[0].delta, -0.0225);
  assert.equal((await cancel(first)).status, 200);
  await assertStock(before, {}, 'after cancelling it');

  for (let i = 0; i < 3; i += 1) {
    const id = nextId('UNIT');
    assert.equal((await posOrder(id, [['lemonade', 1]])).status, 201);
    assert.equal((await cancel(id)).status, 200);
  }
  await assertStock(before, {}, 'after three order + cancel cycles');

  for (let i = 0; i < 4; i += 1) assert.equal((await posOrder(nextId('UNIT'), [['lemonade', 1]])).status, 201);
  await assertStock(before, { juice: -0.09 }, 'after four lemonades');
});

test('every stock change has a movement record and the history always adds up to the stock on hand', { skip }, async () => {
  const before = await stocks();
  const move = (key, delta, type) => api('POST', '/inventory/movements', { ingredientId: ING[key].id, delta, type, reason: `ZZT ${type}` });

  const a = nextId('LOG');
  assert.equal((await posOrder(a, [['alacarte', 3], ['rice', 2]], 'TAKE_OUT')).status, 201);
  assert.equal((await move('shrimp', 500, 'STOCK_RECEIVED')).status, 201);
  assert.equal((await move('garlic', -20, 'WASTE')).status, 201);
  assert.equal((await move('butter', -15.5, 'ADJUSTMENT')).status, 201);
  assert.equal((await move('rice', 40, 'ADJUSTMENT')).status, 201);
  assert.equal((await move('tray', -2, 'CONSUMPTION')).status, 201);
  const b = nextId('LOG');
  assert.equal((await onlineOrder(b, [['bowl', 1], ['lemonade', 2]], 'DELIVERY')).status, 201);
  assert.equal((await cancel(a)).status, 200);
  assert.equal((await kitchenStatus(b, 'PREPARING')).status, 200);
  assert.equal((await api('PATCH', `/orders/${b}/status`, { status: 'CANCELLED' })).status, 200);

  // counting the shelf and correcting the number is also a recorded movement
  const state = (await api('GET', '/inventory/state')).json.data;
  const seal = state.ingredients.find((i) => i.id === ING.seal.id);
  const edited = await api('PUT', `/inventory/ingredients/${seal.id}`, { ...seal, currentStock: 27 });
  assert.equal(edited.status, 200, JSON.stringify(edited.json));
  assert.equal(edited.json.data.transaction.type, 'ADJUSTMENT');
  assert.equal(edited.json.data.transaction.quantityDelta, -3);

  const now = await stocks();
  const { rows } = await pool.query(
    `SELECT ingredient_id, SUM(quantity_delta)::float8 AS total,
            (ARRAY_AGG(stock_after ORDER BY timestamp DESC, id DESC))[1]::float8 AS last_after
       FROM inventory_transactions WHERE ingredient_id = ANY($1::text[]) GROUP BY ingredient_id`,
    [ALL_ING_IDS]
  );
  const log = new Map(rows.map((r) => [r.ingredient_id, r]));
  for (const [key, ing] of Object.entries(ING)) {
    const entry = log.get(ing.id);
    const moved = Math.round((now[key] - before[key]) * 10000) / 10000;
    assert.equal(Math.round((entry?.total || 0) * 10000) / 10000, moved, `${key}: movements add up to the change in stock`);
    if (entry) assert.equal(entry.last_after, now[key], `${key}: latest stock_after is the stock on hand`);
  }
  // spot-check the end state: order a returned in full; order b's food written off, its packaging returned
  await assertStock(before, {
    shrimp: 500 - 300, garlic: -20 - 10, butter: -15.5 - 100, rice: 40, juice: -0.045, tray: -2, seal: -3,
  }, 'end state');
});

test('manual movements must move stock in the direction their type says', { skip }, async () => {
  const before = await stocks();
  const bad = [
    { delta: 50, type: 'WASTE' },
    { delta: 50, type: 'CONSUMPTION' },
    { delta: -50, type: 'STOCK_RECEIVED' },
  ];
  for (const m of bad) {
    const res = await api('POST', '/inventory/movements', { ingredientId: ING.garlic.id, ...m, reason: 'ZZT wrong sign' });
    assert.equal(res.status, 400, `${m.type} ${m.delta} should be refused: ${JSON.stringify(res.json)}`);
  }
  await assertStock(before, {}, 'after refused movements');
});

test('receiving a purchase order only adds stock for lines that are on that order', { skip }, async () => {
  const { rows } = await pool.query(`SELECT id FROM inventory_suppliers LIMIT 1`);
  const po = await api('POST', '/inventory/purchase-orders', {
    supplierId: rows[0].id,
    notes: 'ZZT-SCENARIO',
    items: [{ ingredientId: ING.shrimp.id, ingredientName: ING.shrimp.name, itemType: 'FOOD', orderedQuantity: 1000, unit: 'g', unitCost: 0.4 }],
  });
  assert.equal(po.status, 201, JSON.stringify(po.json));
  const line = po.json.data.items[0];
  const before = await stocks();
  const receive = (items) => api('POST', `/inventory/purchase-orders/${po.json.data.id}/receive`, { items });

  const unknownLine = await receive([{ itemId: 'poi-does-not-exist', ingredientId: ING.shrimp.id, receivedQty: 500, unit: 'g' }]);
  assert.equal(unknownLine.status, 400, JSON.stringify(unknownLine.json));
  const wrongItem = await receive([{ itemId: line.id, ingredientId: ING.garlic.id, receivedQty: 500, unit: 'g' }]);
  assert.equal(wrongItem.status, 400, JSON.stringify(wrongItem.json));
  await assertStock(before, {}, 'after refused receipts');

  const ok = await receive([{ itemId: line.id, ingredientId: ING.shrimp.id, receivedQty: 1000, unit: 'g' }]);
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.data.purchaseOrder.status, 'FULLY_RECEIVED');
  await assertStock(before, { shrimp: 1000 }, 'after a valid receipt');
});

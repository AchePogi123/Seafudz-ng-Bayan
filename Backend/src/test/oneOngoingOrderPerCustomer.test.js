/**
 * An online customer may only have ONE order on the go, and every online order is prepaid by
 * GCash — paying at the store counter was removed.
 *
 * Needs a DISPOSABLE Postgres with every migration applied (it commits real rows):
 *   INVENTORY_TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/sfb_test \
 *     node --test --test-concurrency=1 src/test/oneOngoingOrderPerCustomer.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import pg from 'pg';

const url = process.env.INVENTORY_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set INVENTORY_TEST_DATABASE_URL to run';
if (url) process.env.DATABASE_URL = url;
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const PRODUCT = 'all-shrimp-alacarte-199';
const NAME = 'All Shrimp Alacarte';

let server;
let base;
let pool;
let inMemoryOrders;

/** Unique per run, so this never collides with a row an earlier run or a real customer left. */
const stamp = Date.now();
const CUSTOMER = {
  customerName: `One Order Tester ${stamp}`,
  email: `one.order.${stamp}@test.seafudz.ph`,
  phone: `0917-${String(stamp).slice(-7, -4)}-${String(stamp).slice(-4)}`,
};
const OTHER_CUSTOMER = {
  customerName: `Other Tester ${stamp}`,
  email: `other.${stamp}@test.seafudz.ph`,
  phone: `0918-${String(stamp).slice(-7, -4)}-${String(stamp).slice(-4)}`,
};

const createdOrderIds = new Set();

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

/** Places an online order the way the customer app does. */
function place(id, { who = CUSTOMER, fulfillmentType = 'DELIVERY', paymentMethod = 'GCash' } = {}) {
  createdOrderIds.add(id);
  return api('POST', '/user-flow/orders', {
    id,
    ...who,
    fulfillmentType,
    paymentMethod,
    deliveryAddress: '123 Test St, Caloocan',
    orderType: 'ONLINE',
    items: [{ id: PRODUCT, name: NAME, quantity: 1, price: 199 }],
  });
}

test.before(async () => {
  if (!url) return;
  pool = new pg.Pool({ connectionString: url, max: 3 });
  const [{ default: orderRoutes }, { default: userFlowRoutes }, { default: assistantRoutes }, shared] =
    await Promise.all([
      import('../routes/orderRoutes.js'),
      import('../routes/userFlowRoutes.js'),
      import('../routes/assistantRoutes.js'),
      import('../routes/sharedFlowStore.js'),
    ]);
  inMemoryOrders = shared.inMemoryOrders;
  const app = express();
  app.use(express.json());
  app.use('/api', orderRoutes);
  app.use('/api', assistantRoutes);
  app.use('/api', userFlowRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (!url) return;
  const ids = [...createdOrderIds];
  ids.forEach((id) => inMemoryOrders?.delete(id));
  await pool.query(`DELETE FROM order_inventory_ledger WHERE order_id = ANY($1::text[])`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM inventory_transactions WHERE order_id = ANY($1::text[])`, [ids]).catch(() => {});
  for (const t of ['order_items', 'kitchen_orders', 'payments', 'deliveries', 'refunds']) {
    await pool.query(`DELETE FROM ${t} WHERE order_id = ANY($1::text[])`, [ids]).catch(() => {});
  }
  await pool.query(`DELETE FROM orders WHERE id = ANY($1::text[])`, [ids]).catch(() => {});
  await pool.query(`DELETE FROM customers WHERE email IN ($1, $2)`, [CUSTOMER.email, OTHER_CUSTOMER.email]).catch(() => {});
  await new Promise((r) => server?.close(r));
  await pool.end();
  setTimeout(() => process.exit(0), 100).unref();
});

test('an online pick-up can no longer be placed to be paid at the counter', { skip }, async () => {
  for (const paymentMethod of ['Pay in Store', 'PAY_IN_STORE', 'Cash at counter']) {
    const r = await place(`ONE-STORE-${stamp}`, { fulfillmentType: 'PICKUP', paymentMethod });
    assert.equal(r.status, 400, `${paymentMethod} must be refused: ${JSON.stringify(r.json)}`);
    assert.equal(r.json.error, 'PAY_IN_STORE_REMOVED');
    const exists = await pool.query(`SELECT 1 FROM orders WHERE id = $1`, [`ONE-STORE-${stamp}`]);
    assert.equal(exists.rows.length, 0, 'nothing may be created for a refused pay-at-counter order');
  }
});

test('an online pick-up placed with GCash is prepaid, exactly like a delivery', { skip }, async () => {
  const id = `ONE-PICKUP-${stamp}`;
  const r = await place(id, { fulfillmentType: 'PICKUP' });
  assert.equal(r.status, 201, JSON.stringify(r.json));

  const { rows } = await pool.query(`SELECT status, payment_method FROM orders WHERE id = $1`, [id]);
  assert.equal(rows[0].status, 'GCASH_AUTHORIZED');
  assert.equal(rows[0].payment_method, 'GCash');

  const pay = await pool.query(`SELECT payment_method, status FROM payments WHERE order_id = $1`, [id]);
  assert.equal(pay.rows[0].payment_method, 'GCASH');
  assert.equal(pay.rows[0].status, 'PENDING', 'the money is not in yet; the assistant still verifies it');

  // Clear the slot for the tests below.
  await api('PATCH', `/user-flow/orders/${id}/status`, { status: 'COMPLETED' });
});

test('a second order is refused while the first is still on the go', { skip }, async () => {
  const first = `ONE-FIRST-${stamp}`;
  const second = `ONE-SECOND-${stamp}`;

  assert.equal((await place(first)).status, 201);

  const blocked = await place(second);
  assert.equal(blocked.status, 409, JSON.stringify(blocked.json));
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
  assert.equal(blocked.json.data.id, first, 'the customer is told which order is blocking them');

  const exists = await pool.query(`SELECT 1 FROM orders WHERE id = $1`, [second]);
  assert.equal(exists.rows.length, 0, 'the refused order must not be half-created');
});

test('the block holds all the way through the kitchen, and lifts on delivery', { skip }, async () => {
  const first = `ONE-FIRST-${stamp}`;
  const second = `ONE-SECOND-${stamp}`;

  // Walk the first order through every stage it passes before the customer has it.
  for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']) {
    await pool.query(`UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, [first, status]);
    const cached = inMemoryOrders.get(first);
    if (cached) { cached.status = status; inMemoryOrders.set(first, cached); }

    const blocked = await place(second);
    assert.equal(blocked.status, 409, `a new order must still be refused at ${status}`);
    assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
  }

  // Delivered: the slot is free again.
  await pool.query(`UPDATE orders SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [first]);
  const cached = inMemoryOrders.get(first);
  if (cached) { cached.status = 'COMPLETED'; inMemoryOrders.set(first, cached); }

  const allowed = await place(second);
  assert.equal(allowed.status, 201, `a finished order must free the customer: ${JSON.stringify(allowed.json)}`);
});

test('a cancellation frees the customer even while the refund is still being arranged', { skip }, async () => {
  const paid = `ONE-CANCEL-${stamp}`;
  const next = `ONE-AFTER-CANCEL-${stamp}`;

  // Clear the slot left by the previous test, then place an order and pay for it.
  await pool.query(`UPDATE orders SET status = 'COMPLETED' WHERE id = $1`, [`ONE-SECOND-${stamp}`]);
  const prev = inMemoryOrders.get(`ONE-SECOND-${stamp}`);
  if (prev) { prev.status = 'COMPLETED'; inMemoryOrders.set(`ONE-SECOND-${stamp}`, prev); }

  assert.equal((await place(paid)).status, 201);
  const receipt = await api('PATCH', `/assistant/orders/${paid}/upload-receipt`, {
    paymentReference: `GC-${paid}`,
    paymentReceipt: 'data:image/png;base64,ZmFrZQ==',
  });
  assert.equal(receipt.status, 200, JSON.stringify(receipt.json));

  // A paid order cancels into CANCEL_REQUESTED, because the assistant still owes a refund.
  const cancelled = await api('PATCH', `/user-flow/orders/${paid}/cancel`, { status: 'CANCELLED' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [paid]);
  assert.equal(rows[0].status, 'CANCEL_REQUESTED');

  // The order will never be cooked or delivered, so it must not keep the customer out of the store.
  const allowed = await place(next);
  assert.equal(allowed.status, 201, `a cancellation request must free the slot: ${JSON.stringify(allowed.json)}`);
});

test('the rule is per customer, and a cashier POS ticket is exempt', { skip }, async () => {
  // ONE-AFTER-CANCEL is still on the go for CUSTOMER; a different person is unaffected.
  const other = `ONE-OTHER-${stamp}`;
  assert.equal((await place(other, { who: OTHER_CUSTOMER })).status, 201, 'another customer may still order');

  // A POS ticket is the cashier's, rung up and paid at the counter, so it is never blocked.
  const posId = `POS-ONE-${stamp}`;
  createdOrderIds.add(posId);
  const pos = await api('POST', '/user-flow/orders', {
    id: posId,
    ...CUSTOMER,
    isPosOrder: true,
    orderType: 'TAKE_OUT',
    status: 'CONFIRMED',
    paymentMethod: 'Cash',
    cartItems: [{ productId: PRODUCT, name: NAME, quantity: 1, item: { id: PRODUCT, name: NAME, price: 199 } }],
  });
  assert.equal(pos.status, 201, `a POS ticket must not be blocked: ${JSON.stringify(pos.json)}`);
});

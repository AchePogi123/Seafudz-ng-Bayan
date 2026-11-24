/**
 * An online customer may only have ONE UNSETTLED order at a time: one placed but not yet paid for
 * and verified by the assistant. Once the assistant confirms the GCash receipt the money is in,
 * the kitchen ticket is cut, and the customer may order again — with no cap on how many confirmed
 * orders they have cooking. Every online order is prepaid by GCash; paying at the counter was
 * removed.
 *
 * Also covers the POS exemption, which is only honoured for a request authenticated as counter
 * staff — the request body alone cannot claim it.
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
import { generateSessionHashToken } from '../cryptography/hashToken.js';

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

/** A real signed session for a cashier, so the POS exemption can be tested as staff would use it. */
const CASHIER_TOKEN = generateSessionHashToken({
  userId: `cashier-${stamp}`,
  email: `cashier.${stamp}@test.seafudz.ph`,
  role: 'cashier',
}).sessionToken;

const createdOrderIds = new Set();

async function api(method, path, body, { token } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

/** The customer sends their GCash reference and screenshot: RECEIPT_SUBMITTED. */
function payFor(id) {
  return api('PATCH', `/assistant/orders/${id}/upload-receipt`, {
    paymentReference: `GC-${id}`,
    paymentReceipt: 'data:image/png;base64,ZmFrZQ==',
  });
}

/** The assistant approves the proof: CONFIRMED, payment PAID, kitchen ticket cut. */
function verify(id) {
  return api('PATCH', `/assistant/orders/${id}/verify-receipt`, { paymentReference: `GC-${id}` });
}

/** Walks an order all the way to CONFIRMED, the point that frees the customer. */
async function settle(id) {
  assert.equal((await payFor(id)).status, 200, `could not pay for ${id}`);
  const v = await verify(id);
  assert.equal(v.status, 200, `could not verify ${id}: ${JSON.stringify(v.json)}`);
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [id]);
  assert.equal(rows[0].status, 'CONFIRMED');
}

/** Forces a status in both the table and the in-memory cache, for stages with no simple endpoint. */
async function forceStatus(id, status) {
  await pool.query(`UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status]);
  const cached = inMemoryOrders.get(id);
  if (cached) { cached.status = status; inMemoryOrders.set(id, cached); }
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

test('a second order is refused while the first is still unpaid', { skip }, async () => {
  const first = `ONE-UNPAID-${stamp}`;
  const second = `ONE-BLOCKED-${stamp}`;

  assert.equal((await place(first)).status, 201);

  const blocked = await place(second);
  assert.equal(blocked.status, 409, JSON.stringify(blocked.json));
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
  assert.equal(blocked.json.data.id, first, 'the customer is told which order is blocking them');

  const exists = await pool.query(`SELECT 1 FROM orders WHERE id = $1`, [second]);
  assert.equal(exists.rows.length, 0, 'the refused order must not be half-created');
});

test('paying is not enough: the block holds until the assistant has verified it', { skip }, async () => {
  const first = `ONE-UNPAID-${stamp}`;

  // The customer has sent the money, but nobody has checked the proof yet.
  assert.equal((await payFor(first)).status, 200);
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [first]);
  assert.equal(rows[0].status, 'RECEIPT_SUBMITTED');

  const blocked = await place(`ONE-BLOCKED-SUBMITTED-${stamp}`);
  assert.equal(blocked.status, 409, `must still be refused while awaiting the assistant: ${JSON.stringify(blocked.json)}`);
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
});

test('a rejected receipt still blocks: the customer owes a new one', { skip }, async () => {
  const first = `ONE-UNPAID-${stamp}`;

  const rejected = await api('PATCH', `/assistant/orders/${first}/reject-receipt`, { reason: 'Blurry screenshot' });
  assert.equal(rejected.status, 200, JSON.stringify(rejected.json));
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [first]);
  assert.equal(rows[0].status, 'RECEIPT_REJECTED');

  const blocked = await place(`ONE-BLOCKED-REJECTED-${stamp}`);
  assert.equal(blocked.status, 409, `a rejected receipt must still block: ${JSON.stringify(blocked.json)}`);
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
});

test('the assistant confirming the order frees the customer immediately', { skip }, async () => {
  const first = `ONE-UNPAID-${stamp}`;
  const second = `ONE-AFTER-CONFIRM-${stamp}`;

  await settle(first);

  const allowed = await place(second);
  assert.equal(allowed.status, 201, `a confirmed order must not block: ${JSON.stringify(allowed.json)}`);
});

test('a confirmed order keeps the customer free right through to delivery', { skip }, async () => {
  const confirmed = `ONE-UNPAID-${stamp}`;      // already CONFIRMED above
  const unsettled = `ONE-AFTER-CONFIRM-${stamp}`; // placed above, still unpaid

  // Clear the unsettled one so only the confirmed order is in play.
  await settle(unsettled);

  for (const status of ['PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']) {
    await forceStatus(confirmed, status);
    const id = `ONE-STAGE-${status}-${stamp}`;
    const allowed = await place(id);
    assert.equal(allowed.status, 201, `a new order must be allowed while an order sits at ${status}: ${JSON.stringify(allowed.json)}`);
    // Settle it so it does not block the next pass of the loop.
    await settle(id);
  }
});

test('there is no cap on confirmed orders, but only one may be unsettled', { skip }, async () => {
  const ids = [`ONE-CAP-A-${stamp}`, `ONE-CAP-B-${stamp}`, `ONE-CAP-C-${stamp}`];

  for (const id of ids) {
    const r = await place(id);
    assert.equal(r.status, 201, `stacking confirmed orders must be allowed: ${JSON.stringify(r.json)}`);
    await settle(id);
  }

  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM orders WHERE id = ANY($1::text[]) AND status = 'CONFIRMED'`,
    [ids]
  );
  assert.equal(rows[0].n, 3, 'all three must be live and confirmed at once');

  // One unsettled order is still one too many.
  const fourth = `ONE-CAP-D-${stamp}`;
  assert.equal((await place(fourth)).status, 201);
  const blocked = await place(`ONE-CAP-E-${stamp}`);
  assert.equal(blocked.status, 409, JSON.stringify(blocked.json));
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');
  await settle(fourth);
});

test('an order parked OUT_OF_STOCK blocks, because the kitchen is waiting on the customer', { skip }, async () => {
  const stuck = `ONE-OOS-${stamp}`;
  assert.equal((await place(stuck)).status, 201);
  await settle(stuck);

  // The kitchen cannot cook a dish and parks the order on the customer's decision.
  await forceStatus(stuck, 'OUT_OF_STOCK');

  const blocked = await place(`ONE-OOS-BLOCKED-${stamp}`);
  assert.equal(blocked.status, 409, `OUT_OF_STOCK must block: ${JSON.stringify(blocked.json)}`);
  assert.equal(blocked.json.error, 'ACTIVE_ORDER_EXISTS');

  await forceStatus(stuck, 'COMPLETED');
});

test('a cancellation frees the customer even while the refund is still being arranged', { skip }, async () => {
  const paid = `ONE-CANCEL-${stamp}`;
  const next = `ONE-AFTER-CANCEL-${stamp}`;

  assert.equal((await place(paid)).status, 201);
  assert.equal((await payFor(paid)).status, 200);

  // A paid order cancels into CANCEL_REQUESTED, because the assistant still owes a refund.
  const cancelled = await api('PATCH', `/user-flow/orders/${paid}/cancel`, { status: 'CANCELLED' });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
  const { rows } = await pool.query(`SELECT status FROM orders WHERE id = $1`, [paid]);
  assert.equal(rows[0].status, 'CANCEL_REQUESTED');

  // The order will never be cooked or delivered, so it must not keep the customer out of the store.
  const allowed = await place(next);
  assert.equal(allowed.status, 201, `a cancellation request must free the customer: ${JSON.stringify(allowed.json)}`);
});

test('the rule is per customer', { skip }, async () => {
  // ONE-AFTER-CANCEL is still unsettled for CUSTOMER; a different person is unaffected.
  const other = `ONE-OTHER-${stamp}`;
  assert.equal((await place(other, { who: OTHER_CUSTOMER })).status, 201, 'another customer may still order');
});

test('a POS ticket is exempt, but only for a signed-in cashier', { skip }, async () => {
  // CUSTOMER still has ONE-AFTER-CANCEL unsettled at this point, so the rule is live.
  const posBody = (id, extra) => ({
    id,
    ...CUSTOMER,
    status: 'CONFIRMED',
    paymentMethod: 'Cash',
    cartItems: [{ productId: PRODUCT, name: NAME, quantity: 1, item: { id: PRODUCT, name: NAME, price: 199 } }],
    ...extra,
  });

  // Anybody can post these fields, so on their own they must not buy the exemption.
  const claims = [
    ['isPosOrder flag', `ONE-POSFLAG-${stamp}`, { isPosOrder: true, orderType: 'ONLINE' }],
    ['POS- id prefix', `POS-ONE-${stamp}`, { orderType: 'ONLINE' }],
    ['TAKE_OUT order type', `ONE-TAKEOUT-${stamp}`, { orderType: 'TAKE_OUT' }],
  ];
  for (const [what, id, extra] of claims) {
    createdOrderIds.add(id);
    const r = await api('POST', '/user-flow/orders', posBody(id, extra));
    assert.equal(r.status, 403, `${what} must not be honoured unauthenticated: ${JSON.stringify(r.json)}`);
    assert.equal(r.json.error, 'POS_REQUIRES_STAFF');
    const exists = await pool.query(`SELECT 1 FROM orders WHERE id = $1`, [id]);
    assert.equal(exists.rows.length, 0, `nothing may be created for a refused POS claim (${what})`);
  }

  // Signed in as a cashier, the same ticket goes through and is not blocked by the customer's
  // unsettled online order: it is rung up and paid at the counter.
  const staffId = `POS-STAFF-${stamp}`;
  createdOrderIds.add(staffId);
  const pos = await api('POST', '/user-flow/orders', posBody(staffId, { isPosOrder: true, orderType: 'TAKE_OUT' }), { token: CASHIER_TOKEN });
  assert.equal(pos.status, 201, `a cashier's POS ticket must not be blocked: ${JSON.stringify(pos.json)}`);
  const { rows } = await pool.query(`SELECT order_type FROM orders WHERE id = $1`, [staffId]);
  assert.equal(rows[0].order_type, 'ON_SITE');
});

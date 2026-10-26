import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import orderRoutes from '../routes/orderRoutes.js';
import { inMemoryOrders } from '../routes/sharedFlowStore.js';

test('Backend PUT /orders/:id kitchen processing enforcement', async (t) => {
  const app = express();
  app.use(express.json());
  // Mock auth middleware injects cashier user
  app.use((req, res, next) => {
    req.user = { id: 'test-cashier-id', role: 'cashier', fullname: 'Test Cashier' };
    next();
  });
  app.use('/api', orderRoutes);

  const testServer = app.listen(0);
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(() => {
    testServer.close();
  });

  await t.test('Cashier CAN modify an order while still in kitchen queue (CONFIRMED)', async () => {
    const orderId = `TEST-QUEUE-${Date.now()}`;
    inMemoryOrders.set(orderId, {
      id: orderId,
      status: 'CONFIRMED',
      total: 100,
      items: [{ name: 'Rice', quantity: 1, price: 20 }],
    });

    const res = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Extra spoon',
        total: 120,
        items: [{ name: 'Rice', quantity: 2, price: 20 }],
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(inMemoryOrders.get(orderId).notes, 'Extra spoon');
  });

  await t.test('Cashier CANNOT modify an order once kitchen is processing (PREPARING)', async () => {
    const orderId = `TEST-COOKING-${Date.now()}`;
    inMemoryOrders.set(orderId, {
      id: orderId,
      status: 'PREPARING',
      total: 200,
      items: [{ name: 'Shrimp', quantity: 1, price: 200 }],
    });

    const res = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Add more chili',
        total: 250,
      }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'ORDER_PROCESSING');
    assert.match(json.message, /already being processed or prepared in the kitchen/i);
  });

  await t.test('Cashier CANNOT modify an order once kitchen marks READY or COMPLETED', async () => {
    const orderId = `TEST-READY-${Date.now()}`;
    inMemoryOrders.set(orderId, {
      id: orderId,
      status: 'READY',
      total: 200,
    });

    const res = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Trying to change',
      }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'ORDER_PROCESSING');
  });
});

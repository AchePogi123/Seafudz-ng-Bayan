import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import orderRoutes from '../routes/orderRoutes.js';
import { inMemoryOrders } from '../routes/sharedFlowStore.js';
import { getDbPool } from '../config/db.js';

test('Online Receipts Exclusivity Test', async (t) => {
  const app = express();
  app.use(express.json());
  // Mock cashier user
  app.use((req, res, next) => {
    req.user = { id: 'test-cashier', role: 'cashier', fullname: 'Test Cashier' };
    next();
  });
  app.use('/api', orderRoutes);

  const testServer = app.listen(0);
  const port = testServer.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  t.after(async () => {
    testServer.close();
    const p = await getDbPool();
    if (p) await p.end();
  });

  await t.test('GET /cashier/online-receipts excludes on-site POS transactions', async () => {
    // 1. Seed on-site POS order
    const posId = `POS-TEST-${Date.now()}`;
    inMemoryOrders.set(posId, {
      id: posId,
      ref: posId,
      orderType: 'ON_SITE',
      type: 'Take Out',
      customer: 'Walk-In',
      status: 'CONFIRMED',
      total: 500,
      isPosOrder: true,
      items: [{ name: 'Mixed Seafoods', quantity: 1, price: 500 }],
    });

    // 2. Seed online delivery order
    const onlineId = `SFB-TEST-${Date.now()}`;
    inMemoryOrders.set(onlineId, {
      id: onlineId,
      ref: onlineId,
      orderType: 'ONLINE',
      type: 'Delivery',
      customer: 'Online Customer Maria',
      deliveryAddress: '123 Coastal Ave, Bayan',
      status: 'CONFIRMED',
      total: 1200,
      items: [{ name: 'All Shrimp Party Tray', quantity: 1, price: 1200 }],
    });

    const res = await fetch(`${baseUrl}/cashier/online-receipts`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const receivedIds = json.data.map((o) => o.id);
    assert.equal(receivedIds.includes(posId), false, 'POS transaction MUST NOT be present in online receipts');
    assert.equal(receivedIds.includes(onlineId), true, 'Online order MUST be present in online receipts');
  });
});

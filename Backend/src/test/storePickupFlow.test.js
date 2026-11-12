import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { query, getDbPool } from '../config/db.js';
import orderRoutes from '../routes/orderRoutes.js';
import riderRoutes from '../routes/riderRoutes.js';
import userFlowRoutes from '../routes/userFlowRoutes.js';
import { inMemoryOrders } from '../routes/sharedFlowStore.js';

test('Online Store Pick-Up end-to-end integration flow', async (t) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'test-cashier', role: 'cashier', fullname: 'Test Cashier' };
    next();
  });
  app.use('/api', userFlowRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', riderRoutes);

  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  const testPickupOrderId = `SFB-TEST-PICKUP-${Date.now()}`;
  const testDeliveryOrderId = `SFB-TEST-DELIV-${Date.now()}`;

  t.after(async () => {
    try {
      server.close();
      inMemoryOrders.delete(testPickupOrderId);
      inMemoryOrders.delete(testDeliveryOrderId);
      // These orders took real ingredients out of inventory. Put back exactly what they took and
      // remove their stock history, otherwise every test run permanently lowers the stock of
      // whichever database .env points at and leaves reservations with no order behind.
      try {
        const ids = [testPickupOrderId, testDeliveryOrderId];
        await query(
          `UPDATE inventory_ingredients i
              SET current_stock = i.current_stock - m.delta,
                  status = CASE WHEN i.current_stock - m.delta <= 0 THEN 'OUT_OF_STOCK'
                                WHEN i.current_stock - m.delta <= i.min_stock_level THEN 'LOW_STOCK'
                                ELSE 'IN_STOCK' END
             FROM (SELECT ingredient_id, SUM(quantity_delta) AS delta
                     FROM inventory_transactions WHERE order_id = ANY($1::text[]) GROUP BY ingredient_id) m
            WHERE m.ingredient_id = i.id`,
          [ids]
        );
        await query(`DELETE FROM inventory_transactions WHERE order_id = ANY($1::text[])`, [ids]);
        await query(`DELETE FROM order_inventory_ledger WHERE order_id = ANY($1::text[])`, [ids]);
      } catch (invErr) {
        if (invErr.code !== '42P01') console.error('Inventory cleanup note:', invErr.message); // 42P01: no inventory tables
      }
      await query(`DELETE FROM payments WHERE order_id IN ($1, $2)`, [testPickupOrderId, testDeliveryOrderId]);
      await query(`DELETE FROM deliveries WHERE order_id IN ($1, $2)`, [testPickupOrderId, testDeliveryOrderId]);
      await query(`DELETE FROM order_items WHERE order_id IN ($1, $2)`, [testPickupOrderId, testDeliveryOrderId]);
      await query(`DELETE FROM orders WHERE id IN ($1, $2)`, [testPickupOrderId, testDeliveryOrderId]);
      const pool = await getDbPool();
      if (pool) {
        await pool.end();
      }
    } catch (err) {
      console.error('Error in t.after:', err);
    }
  });

  await t.test('1. Customer places Store Pick-Up order: fee is 0 and no delivery record created', async () => {
    const res = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testPickupOrderId,
        customerName: 'Maria Santos',
        phone: '0917-123-4567',
        fulfillmentType: 'PICKUP',
        paymentMethod: 'PAY_IN_STORE',
        items: [
          {
            name: 'All Shrimp Bowl',
            quantity: 1,
            price: 699,
          },
        ],
        subtotal: 699,
        vat: 83.88,
        deliveryFee: 0,
        total: 782.88,
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.fulfillmentType, 'PICKUP');
    assert.equal(Number(json.data.deliveryFee), 0);

    // Verify in PostgreSQL database
    const dbRes = await query(`SELECT fulfillment_type, delivery_fee FROM orders WHERE id = $1`, [testPickupOrderId]);
    assert.equal(dbRes.rows.length, 1);
    assert.equal(dbRes.rows[0].fulfillment_type, 'PICKUP');
    assert.equal(Number(dbRes.rows[0].delivery_fee), 0);

    // Verify deliveries table DOES NOT have a record for this pickup order
    const delivRes = await query(`SELECT id FROM deliveries WHERE order_id = $1`, [testPickupOrderId]);
    assert.equal(delivRes.rows.length, 0, 'Store pickup orders must NOT create records in deliveries table');
  });

  await t.test('2. Customer places normal Delivery order: fee > 0 and delivery record created', async () => {
    const res = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testDeliveryOrderId,
        customerName: 'Juan Dela Cruz',
        phone: '0918-987-6543',
        fulfillmentType: 'DELIVERY',
        address: '123 Caloocan St, Metro Manila',
        deliveryLatitude: 14.65,
        deliveryLongitude: 120.98,
        paymentMethod: 'GCash',
        items: [
          {
            name: 'All Shrimp Bowl',
            quantity: 1,
            price: 699,
          },
        ],
        subtotal: 699,
        vat: 83.88,
        deliveryFee: 50,
        total: 832.88,
      }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.fulfillmentType, 'DELIVERY');
    assert.equal(Number(json.data.deliveryFee), 50);

    // Verify deliveries table DOES have a record for this delivery order
    const delivRes = await query(`SELECT id FROM deliveries WHERE order_id = $1`, [testDeliveryOrderId]);
    assert.equal(delivRes.rows.length, 1, 'Delivery orders must create a record in deliveries table');
  });

  await t.test('3. Rider deliveries endpoint excludes Store Pick-Up orders', async () => {
    const res = await fetch(`${baseUrl}/rider/deliveries`);
    assert.equal(res.status, 200);
    const json = await res.json();
    const deliveries = json.data || json;

    const hasPickupOrder = deliveries.some((d) => d.id === testPickupOrderId || d.orderId === testPickupOrderId);
    assert.equal(hasPickupOrder, false, 'Riders must never see Store Pick-Up orders');
  });

  await t.test('4. Cashier online receipts endpoint includes Store Pick-Up order with fulfillment_type', async () => {
    // Advance pickup order to CONFIRMED
    await query(`UPDATE orders SET status = 'CONFIRMED' WHERE id = $1`, [testPickupOrderId]);
    if (inMemoryOrders.has(testPickupOrderId)) {
      const mem = inMemoryOrders.get(testPickupOrderId);
      mem.status = 'CONFIRMED';
      inMemoryOrders.set(testPickupOrderId, mem);
    }

    const res = await fetch(`${baseUrl}/cashier/online-receipts`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    const foundPickup = json.data.find((o) => o.id === testPickupOrderId);
    assert.ok(foundPickup, 'Pickup order must appear in cashier online-receipts endpoint');
    assert.equal(foundPickup.fulfillmentType, 'PICKUP');
  });

  await t.test('5. Cashier hands over pickup order and collects cash: status COMPLETED and payment PAID', async () => {
    // 5a. Handover attempt while still CONFIRMED/cooking must fail with 400
    const prematureRes = await fetch(`${baseUrl}/orders/${testPickupOrderId}/pickup-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: 'CASH', cashReceived: 1000 }),
    });
    assert.equal(prematureRes.status, 400, 'Handover must be blocked before kitchen marks order as READY');

    // 5b. Advance pickup order to READY (Kitchen completes cooking)
    await query(`UPDATE orders SET status = 'READY' WHERE id = $1`, [testPickupOrderId]);
    if (inMemoryOrders.has(testPickupOrderId)) {
      const mem = inMemoryOrders.get(testPickupOrderId);
      mem.status = 'READY';
      inMemoryOrders.set(testPickupOrderId, mem);
    }

    const res = await fetch(`${baseUrl}/orders/${testPickupOrderId}/pickup-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod: 'CASH',
        cashReceived: 1000,
      }),
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.status, 'COMPLETED');

    // Verify in PostgreSQL database
    const dbOrder = await query(`SELECT status FROM orders WHERE id = $1`, [testPickupOrderId]);
    assert.equal(dbOrder.rows[0].status, 'COMPLETED');

    const dbPayment = await query(`SELECT status, payment_method, amount FROM payments WHERE order_id = $1`, [testPickupOrderId]);
    assert.equal(dbPayment.rows.length, 1);
    assert.equal(dbPayment.rows[0].status, 'PAID');
    assert.equal(Number(dbPayment.rows[0].amount), 782.88);
  });
});

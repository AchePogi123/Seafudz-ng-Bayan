import dotenv from 'dotenv';
dotenv.config({ path: 'Backend/.env' });
import express from 'express';
import kitchenRoutes from '../src/routes/kitchenRoutes.js';
import assistantRoutes from '../src/routes/assistantRoutes.js';
import userFlowRoutes from '../src/routes/userFlowRoutes.js';
import menuRoutes from '../src/routes/menuRoutes.js';
import { inMemoryOrders } from '../src/routes/sharedFlowStore.js';
import { query } from '../src/config/db.js';

const app = express();
app.use(express.json());
app.use('/api', kitchenRoutes);
app.use('/api', assistantRoutes);
app.use('/api', userFlowRoutes);
app.use('/api', menuRoutes);

async function runTests() {
  console.log('\n--- STARTING SIMPLIFIED ORDER FLOW TESTS (NO QUANTITY LIMITS) ---\n');

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    inMemoryOrders.clear();
    try {
      await query(`DELETE FROM orders WHERE id IN ('SFB-LOW-01', 'SFB-HIGH-01', 'SFB-CAT-01')`);
    } catch {}

    // ==========================================
    // TEST 1: Normal quantity order (4 Mini Seafood)
    // ==========================================
    console.log('--- TEST 1: Normal quantity order (4 Mini Seafood) ---');
    const lowOrderRes = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SFB-LOW-01',
        customerName: 'Low Qty Customer',
        phone: '0917-111-2222',
        deliveryAddress: '123 Ocean Drive, Manila',
        paymentMethod: 'GCash',
        items: [
          { id: 'mixed-seafoods-alacarte-99', name: 'Mixed Seafoods Alacarte (Mini)', quantity: 4, price: 99 }
        ]
      })
    });

    const lowOrderJson = await lowOrderRes.json();
    if (!lowOrderRes.ok) {
      throw new Error(`Test 1 failed: ${JSON.stringify(lowOrderJson)}`);
    }

    const lowOrder = lowOrderJson.data;
    console.log(`[PASS] Order created: ID = ${lowOrder.id}, status = ${lowOrder.status}`);
    if (lowOrder.status !== 'GCASH_AUTHORIZED') {
      throw new Error(`Expected GCASH_AUTHORIZED, got ${lowOrder.status}`);
    }
    if (lowOrder.requiresKitchenApproval !== false) {
      throw new Error(`Expected requiresKitchenApproval = false, got ${lowOrder.requiresKitchenApproval}`);
    }

    // ==========================================
    // TEST 2: High quantity order (25 Mini Seafood) - NO QUANTITY LIMIT / NO AWAITING_KITCHEN_APPROVAL
    // ==========================================
    console.log('\n--- TEST 2: High quantity order (25 Mini Seafood - Quantity Limit Removed) ---');
    const highOrderRes = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SFB-HIGH-01',
        customerName: 'High Qty Customer',
        phone: '0917-333-4444',
        deliveryAddress: '456 Bay Boulevard, Pasay',
        paymentMethod: 'GCash',
        items: [
          { id: 'mixed-seafoods-alacarte-99', name: 'Mixed Seafoods Alacarte (Mini)', quantity: 25, price: 99 }
        ]
      })
    });

    const highOrderJson = await highOrderRes.json();
    if (!highOrderRes.ok) {
      throw new Error(`Test 2 failed: ${JSON.stringify(highOrderJson)}`);
    }

    const highOrder = highOrderJson.data;
    console.log(`[PASS] High-qty order created: ID = ${highOrder.id}, status = ${highOrder.status}`);
    if (highOrder.status !== 'GCASH_AUTHORIZED') {
      throw new Error(`Expected GCASH_AUTHORIZED (quantity limits removed), got ${highOrder.status}`);
    }
    if (highOrder.requiresKitchenApproval !== false) {
      throw new Error(`Expected requiresKitchenApproval = false, got ${highOrder.requiresKitchenApproval}`);
    }

    // ==========================================
    // TEST 3: Kitchen approvals endpoint returns empty (No large orders column)
    // ==========================================
    console.log('\n--- TEST 3: Kitchen Approvals Endpoint Returns 0 ---');
    const apprRes = await fetch(`${baseUrl}/kitchen/approvals`);
    const apprJson = await apprRes.json();
    console.log(`[PASS] /kitchen/approvals count: ${apprJson.count} (expected 0)`);
    if (apprJson.count !== 0 || apprJson.data?.length !== 0) {
      throw new Error(`Expected 0 approvals, got ${apprJson.count}`);
    }

    // ==========================================
    // TEST 4: Customer uploads payment receipt & Assistant confirms
    // ==========================================
    console.log('\n--- TEST 4: Receipt Upload & Assistant Confirmation ---');
    const uploadRes = await fetch(`${baseUrl}/assistant/orders/SFB-HIGH-01/upload-receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReceipt: 'data:image/png;base64,mockReceipt', referenceNumber: '999888777666' })
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Upload receipt failed: ${JSON.stringify(uploadJson)}`);
    console.log(`[PASS] Uploaded receipt: status = ${uploadJson.data.status}`);
    if (uploadJson.data.status !== 'RECEIPT_SUBMITTED') throw new Error('Expected status RECEIPT_SUBMITTED');

    const verifyRes = await fetch(`${baseUrl}/assistant/orders/SFB-HIGH-01/verify-receipt`, { method: 'PATCH' });
    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(`Verify receipt failed: ${JSON.stringify(verifyJson)}`);
    console.log(`[PASS] Assistant verified receipt: status = ${verifyJson.data.status}`);
    if (verifyJson.data.status !== 'CONFIRMED') throw new Error('Expected status CONFIRMED');

    // ==========================================
    // TEST 5: Confirmed order appears in Kitchen Queue and transitions to PREPARING
    // ==========================================
    console.log('\n--- TEST 5: Kitchen Cooking Queue ---');
    const kitchenRes = await fetch(`${baseUrl}/kitchen/orders`);
    const kitchenJson = await kitchenRes.json();
    const inKitchen = (kitchenJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] Order in kitchen queue? ${inKitchen} (expected true)`);
    if (!inKitchen) throw new Error('Confirmed order MUST appear in kitchen cooking queue');

    const prepRes = await fetch(`${baseUrl}/kitchen/orders/SFB-HIGH-01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const prepJson = await prepRes.json();
    if (!prepRes.ok) throw new Error(`Kitchen status update failed: ${JSON.stringify(prepJson)}`);
    console.log(`[PASS] Order transitioned to PREPARING successfully`);

    console.log('\n================================================');
    console.log('✅ ALL TESTS PASSED: QUANTITY LIMITS & LARGE ORDERS REMOVED!');
    console.log('================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

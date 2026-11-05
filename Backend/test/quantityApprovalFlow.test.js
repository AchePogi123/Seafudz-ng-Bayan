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
  console.log('\n--- STARTING QUANTITY APPROVAL & AUTOMATIC PAYMENT FLOW TESTS ---\n');

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // Clear in-memory orders and existing test DB records
    inMemoryOrders.clear();
    try {
      await query(`DELETE FROM orders WHERE id IN ('SFB-LOW-01', 'SFB-HIGH-01', 'SFB-COD-01', 'SFB-EST-01')`);
      await query(`UPDATE products SET is_available = true WHERE name ILIKE '%Chicken Pastil%' OR name ILIKE '%Mixed Seafoods%'`);
    } catch {}

    // ==========================================
    // SCENARIO 1: ORDER BELOW STANDARDS (4 Mini Seafood)
    // ==========================================
    console.log('--- TEST 1: Order Below Quantity Standard (4 Mini Seafood) ---');
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
      throw new Error(`Scenario 1: Order placement failed with status ${lowOrderRes.status}: ${JSON.stringify(lowOrderJson)}`);
    }

    const lowOrder = lowOrderJson.data;
    console.log(`[PASS] Order created with ID: ${lowOrder.id}, status: ${lowOrder.status}`);
    // Below standard order MUST automatically permit customer to pay immediately (GCASH_AUTHORIZED)
    if (lowOrder.status !== 'GCASH_AUTHORIZED') {
      throw new Error(`Scenario 1: Expected status GCASH_AUTHORIZED (automatically permitted to pay), got ${lowOrder.status}`);
    }
    if (lowOrder.requiresKitchenApproval !== false) {
      throw new Error(`Scenario 1: Expected requiresKitchenApproval = false, got ${lowOrder.requiresKitchenApproval}`);
    }
    if (!lowOrder.gcashAuthorized) {
      throw new Error(`Scenario 1: Expected gcashAuthorized = true, got ${lowOrder.gcashAuthorized}`);
    }

    // Check it does NOT appear in kitchen approvals
    const lowApprRes = await fetch(`${baseUrl}/kitchen/approvals`);
    const lowApprJson = await lowApprRes.json();
    const lowInAppr = (lowApprJson.data || []).some(o => o.id === 'SFB-LOW-01');
    console.log(`[PASS] Low order in kitchen approvals? ${lowInAppr} (expected false)`);
    if (lowInAppr) throw new Error('Low order should not appear in kitchen approvals');

    // Check it does NOT appear in kitchen cooking queue before confirmation
    const lowKitchenRes = await fetch(`${baseUrl}/kitchen/orders`);
    const lowKitchenJson = await lowKitchenRes.json();
    const lowInKitchen = (lowKitchenJson.data || []).some(o => o.id === 'SFB-LOW-01');
    console.log(`[PASS] Low order in kitchen cooking queue before confirmation? ${lowInKitchen} (expected false)`);
    if (lowInKitchen) throw new Error('Unconfirmed delivery order should not appear in kitchen queue');

    // Customer uploads payment receipt proof immediately (without needing assistant authorization)
    const uploadRes = await fetch(`${baseUrl}/assistant/orders/SFB-LOW-01/upload-receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReceipt: 'data:image/png;base64,mockReceipt', referenceNumber: '123456789012' })
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Customer upload receipt failed: ${JSON.stringify(uploadJson)}`);
    console.log(`[PASS] Customer uploaded receipt proof: status = ${uploadJson.data.status}`);
    if (uploadJson.data.status !== 'RECEIPT_SUBMITTED') throw new Error('Expected status RECEIPT_SUBMITTED');

    // Assistant verifies receipt -> CONFIRMED
    const verifyRes = await fetch(`${baseUrl}/assistant/orders/SFB-LOW-01/verify-receipt`, { method: 'PATCH' });
    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(`Verify receipt failed: ${JSON.stringify(verifyJson)}`);
    console.log(`[PASS] Assistant verified receipt: status = ${verifyJson.data.status}`);
    if (verifyJson.data.status !== 'CONFIRMED') throw new Error('Expected CONFIRMED status');

    // Now it MUST appear in kitchen cooking queue
    const kitchenQueueRes = await fetch(`${baseUrl}/kitchen/orders`);
    const kitchenQueueJson = await kitchenQueueRes.json();
    const inKitchenQueue = (kitchenQueueJson.data || []).some(o => o.id === 'SFB-LOW-01');
    console.log(`[PASS] Confirmed order in kitchen cooking queue? ${inKitchenQueue} (expected true)`);
    if (!inKitchenQueue) throw new Error('Confirmed order MUST appear in kitchen queue');

    // Kitchen starts cooking -> PREPARING
    const prepRes = await fetch(`${baseUrl}/kitchen/orders/SFB-LOW-01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const prepJson = await prepRes.json();
    if (!prepRes.ok) throw new Error(`Kitchen prep failed: ${JSON.stringify(prepJson)}`);
    console.log(`[PASS] Kitchen moved order to PREPARING: status = ${prepJson.data.status}\n`);


    // ==========================================
    // SCENARIO 2: ORDER REACHING STANDARDS (5 Mini Seafood)
    // ==========================================
    console.log('--- TEST 2: Order Reaching Quantity Standard (5 Mini Seafood) ---');
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
          { id: 'mixed-seafoods-alacarte-99', name: 'Mixed Seafoods Alacarte (Mini)', quantity: 5, price: 99 }
        ]
      })
    });

    const highOrderJson = await highOrderRes.json();
    if (!highOrderRes.ok) {
      throw new Error(`Scenario 2: Order placement failed with status ${highOrderRes.status}: ${JSON.stringify(highOrderJson)}`);
    }

    const highOrder = highOrderJson.data;
    console.log(`[PASS] High-qty order created with ID: ${highOrder.id}, status: ${highOrder.status}`);
    // High-qty order MUST wait for kitchen approval before payment is permitted
    if (highOrder.status !== 'AWAITING_KITCHEN_APPROVAL') {
      throw new Error(`Scenario 2: Expected status AWAITING_KITCHEN_APPROVAL, got ${highOrder.status}`);
    }
    if (highOrder.requiresKitchenApproval !== true) {
      throw new Error(`Scenario 2: Expected requiresKitchenApproval = true, got ${highOrder.requiresKitchenApproval}`);
    }
    if (highOrder.kitchenApprovalStatus !== 'PENDING') {
      throw new Error(`Scenario 2: Expected kitchenApprovalStatus = PENDING, got ${highOrder.kitchenApprovalStatus}`);
    }

    // 1. MUST appear in dedicated Kitchen approvals
    const highApprRes = await fetch(`${baseUrl}/kitchen/approvals`);
    const highApprJson = await highApprRes.json();
    const highInAppr = (highApprJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] High order in kitchen approvals list? ${highInAppr} (expected true)`);
    if (!highInAppr) throw new Error('High-qty order MUST appear in /kitchen/approvals');

    // 2. MUST NOT appear in normal Kitchen cooking queue
    const highKitchenRes = await fetch(`${baseUrl}/kitchen/orders`);
    const highKitchenJson = await highKitchenRes.json();
    const highInKitchen = (highKitchenJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] High order in normal kitchen cooking queue? ${highInKitchen} (expected false)`);
    if (highInKitchen) throw new Error('Awaiting kitchen approval order MUST NOT appear in cooking queue!');

    // 3. BACKEND RESTRICTION: Kitchen MUST NOT be able to move unapproved order to PREPARING
    console.log('--- Testing Backend Restriction: Kitchen attempts to move unapproved order to PREPARING ---');
    const bypassAttemptRes = await fetch(`${baseUrl}/kitchen/orders/SFB-HIGH-01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const bypassJson = await bypassAttemptRes.json();
    console.log(`[PASS] Kitchen status update response status code: ${bypassAttemptRes.status} (expected 400)`);
    if (bypassAttemptRes.status !== 400) {
      throw new Error(`Backend allowed Kitchen to move unapproved order to PREPARING! Status code: ${bypassAttemptRes.status}`);
    }

    // 4. BACKEND RESTRICTION: Payment actions blocked while awaiting kitchen approval
    console.log('--- Testing Backend Restriction: Payment actions blocked while awaiting kitchen approval ---');
    const uploadAttemptRes = await fetch(`${baseUrl}/assistant/orders/SFB-HIGH-01/upload-receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReceipt: 'data:image/png;base64,mockReceipt' })
    });
    console.log(`[PASS] Customer receipt upload blocked with status: ${uploadAttemptRes.status} (expected 409)`);
    if (uploadAttemptRes.status !== 409) throw new Error('Receipt upload must be blocked while awaiting kitchen approval');

    // 5. Kitchen approves quantities -> AUTOMATICALLY PERMITS CUSTOMER TO PAY
    console.log('--- Kitchen Approves Order Quantities ---');
    const kitchenApproveRes = await fetch(`${baseUrl}/kitchen/orders/SFB-HIGH-01/approve-quantities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    const kitchenApproveJson = await kitchenApproveRes.json();
    if (!kitchenApproveRes.ok) {
      throw new Error(`Kitchen approval failed: ${JSON.stringify(kitchenApproveJson)}`);
    }
    console.log(`[PASS] Kitchen approved quantities: new status = ${kitchenApproveJson.data.status} (automatically permitted to pay)`);
    if (kitchenApproveJson.data.status !== 'GCASH_AUTHORIZED') {
      throw new Error(`Expected GCASH_AUTHORIZED after kitchen approval, got ${kitchenApproveJson.data.status}`);
    }
    if (!kitchenApproveJson.data.gcashAuthorized) {
      throw new Error(`Expected gcashAuthorized = true after kitchen approval`);
    }

    // 6. Order is now removed from Kitchen approvals
    const apprAfterRes = await fetch(`${baseUrl}/kitchen/approvals`);
    const apprAfterJson = await apprAfterRes.json();
    const inApprAfter = (apprAfterJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] Order removed from kitchen approvals? ${!inApprAfter} (expected true)`);
    if (inApprAfter) throw new Error('Approved order should be removed from kitchen approvals');

    // 7. Order is STILL NOT in cooking queue (must complete payment & confirmation first!)
    const kitchenQueueBeforePay = await fetch(`${baseUrl}/kitchen/orders`);
    const queueBeforePayJson = await kitchenQueueBeforePay.json();
    const inQueueBeforePay = (queueBeforePayJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] In cooking queue before payment verification? ${inQueueBeforePay} (expected false)`);
    if (inQueueBeforePay) throw new Error('Order should not enter cooking queue before payment verification');

    // 8. Customer transfers funds and uploads receipt (NO ASSISTANT AUTHORIZATION NEEDED)
    console.log('--- Customer Submits Payment Proof & Assistant Verifies ---');
    const uploadPostAppr = await fetch(`${baseUrl}/assistant/orders/SFB-HIGH-01/upload-receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentReceipt: 'data:image/png;base64,mockReceiptHigh', referenceNumber: '999888777666' })
    });
    const uploadPostApprJson = await uploadPostAppr.json();
    if (!uploadPostAppr.ok) throw new Error('Customer receipt upload should succeed after kitchen approval');
    console.log(`[PASS] Customer uploaded receipt proof: status = ${uploadPostApprJson.data.status}`);

    const verifyPostAppr = await fetch(`${baseUrl}/assistant/orders/SFB-HIGH-01/verify-receipt`, { method: 'PATCH' });
    const verifyPostApprJson = await verifyPostAppr.json();
    if (!verifyPostAppr.ok) throw new Error('Assistant verify should succeed');
    console.log(`[PASS] Assistant verified receipt: status = ${verifyPostApprJson.data.status}`);
    if (verifyPostApprJson.data.status !== 'CONFIRMED') throw new Error('Expected CONFIRMED status');

    // 9. NOW the order enters the cooking queue!
    const finalKitchenRes = await fetch(`${baseUrl}/kitchen/orders`);
    const finalKitchenJson = await finalKitchenRes.json();
    const inFinalKitchen = (finalKitchenJson.data || []).some(o => o.id === 'SFB-HIGH-01');
    console.log(`[PASS] Order now present in kitchen cooking queue? ${inFinalKitchen} (expected true)`);
    if (!inFinalKitchen) throw new Error('Confirmed order MUST now appear in kitchen cooking queue');

    // 10. Kitchen can now start cooking
    const finalPrepRes = await fetch(`${baseUrl}/kitchen/orders/SFB-HIGH-01/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const finalPrepJson = await finalPrepRes.json();
    if (!finalPrepRes.ok) throw new Error(`Kitchen prep failed: ${JSON.stringify(finalPrepJson)}`);
    console.log(`[PASS] Kitchen moved order to PREPARING: status = ${finalPrepJson.data.status}\n`);


    // ==========================================
    // SCENARIO 3: COD ORDER REACHING STANDARDS (10 Chicken Pastil)
    // ==========================================
    console.log('--- TEST 3: COD Order Reaching Quantity Standard (10 Chicken Pastil) ---');
    const codOrderRes = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SFB-COD-01',
        customerName: 'COD Customer',
        phone: '0917-555-6666',
        deliveryAddress: '789 Sunset Blvd, Paranaque',
        paymentMethod: 'COD',
        items: [
          { id: 'chicken-pastil-35', name: 'Chicken Pastil', quantity: 10, price: 35 }
        ]
      })
    });

    const codOrderJson = await codOrderRes.json();
    if (!codOrderRes.ok) throw new Error(`Scenario 3 placement failed: ${JSON.stringify(codOrderJson)}`);
    const codOrder = codOrderJson.data;
    console.log(`[PASS] COD High-qty order created with ID: ${codOrder.id}, status: ${codOrder.status}`);
    if (codOrder.status !== 'AWAITING_KITCHEN_APPROVAL') {
      throw new Error(`Scenario 3: Expected AWAITING_KITCHEN_APPROVAL, got ${codOrder.status}`);
    }

    // Assistant attempt to confirm COD must be blocked
    const codBlockRes = await fetch(`${baseUrl}/assistant/orders/SFB-COD-01/confirm-cod`, { method: 'PATCH' });
    console.log(`[PASS] Assistant COD confirmation blocked before kitchen approval: status = ${codBlockRes.status} (expected 409)`);
    if (codBlockRes.status !== 409) throw new Error('COD confirmation must be blocked while awaiting kitchen approval');

    // Kitchen approves quantities
    const codKitchenApprove = await fetch(`${baseUrl}/kitchen/orders/SFB-COD-01/approve-quantities`, { method: 'PATCH' });
    const codKitchenApproveJson = await codKitchenApprove.json();
    if (!codKitchenApprove.ok) throw new Error('Kitchen approval failed for COD');
    console.log(`[PASS] Kitchen approved COD order quantities: new status = ${codKitchenApproveJson.data.status} (expected PENDING_COD)`);
    if (codKitchenApproveJson.data.status !== 'PENDING_COD') {
      throw new Error(`Expected PENDING_COD after kitchen approval, got ${codKitchenApproveJson.data.status}`);
    }

    // Assistant confirms COD -> CONFIRMED
    const codConfirmRes = await fetch(`${baseUrl}/assistant/orders/SFB-COD-01/confirm-cod`, { method: 'PATCH' });
    const codConfirmJson = await codConfirmRes.json();
    if (!codConfirmRes.ok) throw new Error('Assistant confirm COD failed');
    console.log(`[PASS] Assistant confirmed COD: status = ${codConfirmJson.data.status}`);
    if (codConfirmJson.data.status !== 'CONFIRMED') throw new Error('Expected CONFIRMED status');

    // Now appears in kitchen cooking queue
    const codQueueRes = await fetch(`${baseUrl}/kitchen/orders`);
    const codQueueJson = await codQueueRes.json();
    const inCodQueue = (codQueueJson.data || []).some(o => o.id === 'SFB-COD-01');
    console.log(`[PASS] Confirmed COD order now in kitchen cooking queue? ${inCodQueue} (expected true)`);
    if (!inCodQueue) throw new Error('Confirmed COD order must appear in kitchen queue');

    // ==========================================
    // SCENARIO 4: HIGH-QTY ORDER WITH ESTIMATED SERVINGS (BYPASS KITCHEN APPROVAL)
    // ==========================================
    console.log('\n--- TEST 4: High-Qty Order With Estimated Servings (Bypass Kitchen Approval) ---');
    // Kitchen sets estimated servings = 5 for All Shrimp Alacarte
    const setServingsRes = await fetch(`${baseUrl}/menu/item-005/remaining-servings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remaining_servings: 5 }),
    });
    const setServingsJson = await setServingsRes.json();
    console.log(`[PASS] Kitchen configured remaining servings = 5: ok = ${setServingsRes.ok}`);

    // Customer places order of 5 All Shrimp Alacarte (reaching standard of 5)
    const bypassOrderRes = await fetch(`${baseUrl}/user-flow/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SFB-EST-01',
        customerName: 'Pre-Approved Customer',
        phone: '0917-555-6666',
        deliveryAddress: '789 Ocean Drive, Pasay',
        paymentMethod: 'GCash',
        items: [
          { id: 'item-005', product_id: 'item-005', name: 'All Shrimp Alacarte', quantity: 5, price: 199, remaining_servings: 5 }
        ]
      })
    });
    const bypassOrderJson = await bypassOrderRes.json();
    if (!bypassOrderRes.ok) throw new Error(`Scenario 4: Order placement failed: ${JSON.stringify(bypassOrderJson)}`);
    const bypassOrder = bypassOrderJson.data;

    console.log(`[PASS] Order with estimated servings created: ID = ${bypassOrder.id}, status = ${bypassOrder.status}`);
    // High-qty order with estimated servings MUST bypass kitchen approval directly to GCASH_AUTHORIZED
    if (bypassOrder.status !== 'GCASH_AUTHORIZED') {
      throw new Error(`Scenario 4: Expected status GCASH_AUTHORIZED, got ${bypassOrder.status}`);
    }
    if (bypassOrder.requiresKitchenApproval !== false) {
      throw new Error(`Scenario 4: Expected requiresKitchenApproval = false, got ${bypassOrder.requiresKitchenApproval}`);
    }

    // Must NOT appear in kitchen approvals list
    const estApprRes = await fetch(`${baseUrl}/kitchen/approvals`);
    const estApprJson = await estApprRes.json();
    const estInAppr = (estApprJson.data || []).some(o => o.id === 'SFB-EST-01');
    console.log(`[PASS] Pre-approved order in kitchen approvals list? ${estInAppr} (expected false)`);
    if (estInAppr) throw new Error('Order with estimated servings must NOT appear in kitchen approvals');

    // Customer submits payment proof directly
    const estReceiptRes = await fetch(`${baseUrl}/assistant/orders/SFB-EST-01/upload-receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referenceNumber: 'GCASH-EST-9999', paymentReceipt: 'receipt-proof.jpg' })
    });
    const estReceiptJson = await estReceiptRes.json();
    console.log(`[PASS] Customer submitted payment proof directly: status = ${estReceiptJson.data.status}`);
    if (estReceiptJson.data.status !== 'RECEIPT_SUBMITTED') throw new Error('Expected RECEIPT_SUBMITTED');

    // Assistant verifies receipt directly -> CONFIRMED
    const estVerifyRes = await fetch(`${baseUrl}/assistant/orders/SFB-EST-01/verify-receipt`, { method: 'PATCH' });
    const estVerifyJson = await estVerifyRes.json();
    console.log(`[PASS] Assistant verified receipt: status = ${estVerifyJson.data.status}`);
    if (estVerifyJson.data.status !== 'CONFIRMED') throw new Error('Expected CONFIRMED');


    // ==========================================
    // SCENARIO 5: KITCHEN IMMEDIATE RESTOCK FROM 0 (86 TO ON)
    // ==========================================
    console.log('\n--- TEST 5: Kitchen Immediate Restock From 0 Servings (86 to ON) ---');
    // After 5 servings were ordered, item-005 dropped to 0 servings and became 86 (out of stock)
    // Kitchen flips switch back to ON
    const restockRes = await fetch(`${baseUrl}/menu/item-005/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_available: true }),
    });
    const restockJson = await restockRes.json();
    console.log(`[PASS] Kitchen toggled switch back ON: is_available = ${restockJson.data?.is_available}, remaining_servings = ${restockJson.data?.remaining_servings}`);
    if (restockJson.data?.is_available !== true) throw new Error('Expected is_available = true after toggle ON');
    if (restockJson.data?.remaining_servings !== null) throw new Error('Expected remaining_servings = null after toggle ON from 0');

    // Kitchen sets new batch of 10 servings
    const newServingsRes = await fetch(`${baseUrl}/menu/item-005/remaining-servings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remaining_servings: 10 }),
    });
    const newServingsJson = await newServingsRes.json();
    console.log(`[PASS] Kitchen set new servings = 10: is_available = ${newServingsJson.data?.is_available}, remaining_servings = ${newServingsJson.data?.remaining_servings}`);
    if (newServingsJson.data?.is_available !== true) throw new Error('Expected is_available = true after setting 10 servings');
    if (newServingsJson.data?.remaining_servings !== 10) throw new Error('Expected remaining_servings = 10');

    console.log('\n>>> ALL INTEGRATION TESTS PASSED SUCCESSFULLY! <<<\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});

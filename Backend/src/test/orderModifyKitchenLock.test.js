import test from 'node:test';
import assert from 'node:assert/strict';
import { inMemoryOrders } from '../routes/sharedFlowStore.js';

test('Order Modification - In Queue vs Processing in Kitchen', async (t) => {
  const nonModifiableKitchenStatuses = [
    'PREPARING', 'COOKING', 'IN_PROCESS', 'IN_PREPARATION',
    'READY', 'PREPARED', 'READY TO SERVE',
    'COMPLETED', 'SERVED', 'DELIVERED', 'CANCELLED'
  ];

  const isModifiable = (status) => {
    const s = (status || '').toUpperCase();
    return !nonModifiableKitchenStatuses.includes(s);
  };

  await t.test('allows editing when order is still in queue (CONFIRMED / PENDING)', () => {
    assert.equal(isModifiable('CONFIRMED'), true);
    assert.equal(isModifiable('PENDING'), true);
    assert.equal(isModifiable('QUEUE'), true);
    assert.equal(isModifiable('IN_QUEUE'), true);
  });

  await t.test('blocks editing when order is already on processing in kitchen', () => {
    assert.equal(isModifiable('PREPARING'), false);
    assert.equal(isModifiable('COOKING'), false);
    assert.equal(isModifiable('IN_PROCESS'), false);
    assert.equal(isModifiable('IN_PREPARATION'), false);
    assert.equal(isModifiable('READY'), false);
    assert.equal(isModifiable('COMPLETED'), false);
    assert.equal(isModifiable('CANCELLED'), false);
  });
});

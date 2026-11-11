import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertQty,
  normalizeFulfillment,
  packagingApplies,
  computeRequirementLines,
  aggregateLines,
  computeServings,
  stockStatus,
  computeServingsForFulfillment,
} from '../utils/inventoryMath.js';

const meta = new Map([
  ['shrimp', { baseUnit: 'g', itemType: 'FOOD' }],
  ['oil', { baseUnit: 'ml', itemType: 'FOOD' }],
  ['tray', { baseUnit: 'pcs', itemType: 'PACKAGING' }],
  ['bag', { baseUnit: 'pcs', itemType: 'PACKAGING' }],
]);

const recipe = (extra = {}) => ({
  productId: 'dish',
  ingredients: [
    { ingredientId: 'shrimp', portion: 0.15, unit: 'kg' },
    { ingredientId: 'oil', portion: 0.01, unit: 'L' },
  ],
  packaging: [
    { packagingId: 'tray', quantity: 1, unit: 'pcs', fulfillmentType: 'TAKEOUT', scope: 'PER_ITEM' },
    { packagingId: 'bag', quantity: 1, unit: 'pcs', fulfillmentType: 'ALL', scope: 'SHARED_ORDER', sharedCapacity: 3 },
  ],
  ...extra,
});

test('convertQty converts related units and leaves others alone', () => {
  assert.equal(convertQty(2, 'kg', 'g'), 2000);
  assert.equal(convertQty(500, 'g', 'kg'), 0.5);
  assert.equal(convertQty(1, 'L', 'ml'), 1000);
  assert.equal(convertQty(3, 'pcs', 'g'), 3);
});

test('normalizeFulfillment understands POS and customer wording', () => {
  assert.equal(normalizeFulfillment('Dine In'), 'DINE_IN');
  assert.equal(normalizeFulfillment('DINE_IN'), 'DINE_IN');
  assert.equal(normalizeFulfillment('Take Out'), 'TAKE_OUT');
  assert.equal(normalizeFulfillment('Store Pick-Up'), 'PICKUP');
  assert.equal(normalizeFulfillment(undefined, 'Delivery'), 'DELIVERY');
});

test('packagingApplies maps recipe channels to order types', () => {
  assert.equal(packagingApplies('TAKEOUT', 'DELIVERY'), true);
  assert.equal(packagingApplies('TAKEOUT', 'PICKUP'), true);
  assert.equal(packagingApplies('TAKEOUT', 'DINE_IN'), false);
  assert.equal(packagingApplies('DELIVERY', 'PICKUP'), false);
  assert.equal(packagingApplies('DINE_IN', 'DINE_IN'), true);
  assert.equal(packagingApplies('ALL', 'DINE_IN'), true);
});

test('food and per-item packaging scale with quantity; units are converted', () => {
  const lines = computeRequirementLines({
    items: [{ orderItemId: 1, productId: 'dish', quantity: 2 }],
    recipes: new Map([['dish', recipe()]]),
    ingredientMeta: meta,
    fulfillment: 'TAKE_OUT',
  });
  const totals = aggregateLines(lines);
  assert.equal(totals.get('shrimp'), 300);
  assert.equal(totals.get('oil'), 20);
  assert.equal(totals.get('tray'), 2);
});

test('shared packaging is rounded up per order, not per dish', () => {
  const items = [
    { orderItemId: 1, productId: 'dish', quantity: 2 },
    { orderItemId: 2, productId: 'dish', quantity: 2 },
  ];
  const lines = computeRequirementLines({
    items,
    recipes: new Map([['dish', recipe()]]),
    ingredientMeta: meta,
    fulfillment: 'DELIVERY',
  });
  const bag = lines.find((l) => l.ingredientId === 'bag');
  assert.equal(bag.quantity, 2); // 4 dishes / 3 per bag -> 2 bags
  assert.equal(bag.orderItemId, null);
});

test('dine-in skips takeout packaging but still uses food', () => {
  const totals = aggregateLines(
    computeRequirementLines({
      items: [{ orderItemId: 1, productId: 'dish', quantity: 1 }],
      recipes: new Map([['dish', recipe()]]),
      ingredientMeta: meta,
      fulfillment: 'DINE_IN',
    })
  );
  assert.equal(totals.get('shrimp'), 150);
  assert.equal(totals.has('tray'), false);
  assert.equal(totals.get('bag'), 1); // ALL applies to dine-in
});

test('items without a recipe are not limited', () => {
  const lines = computeRequirementLines({
    items: [{ orderItemId: 1, productId: 'mystery', quantity: 5 }],
    recipes: new Map(),
    ingredientMeta: meta,
    fulfillment: 'TAKE_OUT',
  });
  assert.deepEqual(lines, []);
});

test('computeServings finds the limiting ingredient across units', () => {
  const stock = new Map([
    ['shrimp', { baseUnit: 'g', stock: 460, name: 'Shrimp' }],
    ['oil', { baseUnit: 'ml', stock: 5000, name: 'Oil' }],
  ]);
  const r = computeServings(recipe(), stock);
  assert.equal(r.servings, 3); // 460 / 150
  assert.equal(r.limitedBy, 'Shrimp');
});

test('computeServings is 0 when an ingredient is missing from stock', () => {
  const r = computeServings(recipe(), new Map([['oil', { baseUnit: 'ml', stock: 100, name: 'Oil' }]]));
  assert.equal(r.servings, 0);
});

test('stockStatus thresholds', () => {
  assert.equal(stockStatus(0, 10), 'OUT_OF_STOCK');
  assert.equal(stockStatus(10, 10), 'LOW_STOCK');
  assert.equal(stockStatus(11, 10), 'IN_STOCK');
});

test('servings per order type include the packaging that order type uses', () => {
  const stock = new Map([
    ['shrimp', { baseUnit: 'g', stock: 1500, name: 'Shrimp' }],
    ['oil', { baseUnit: 'ml', stock: 5000, name: 'Oil' }],
    ['tray', { baseUnit: 'pcs', stock: 2, name: 'Tray' }],
    ['bag', { baseUnit: 'pcs', stock: 3, name: 'Bag' }],
  ]);
  // food alone allows 10; take-out also needs 1 tray each (2 left) and 1/3 bag (9 dishes)
  const takeOut = computeServingsForFulfillment(recipe(), stock, 'TAKE_OUT');
  assert.equal(takeOut.servings, 2);
  assert.equal(takeOut.limitedBy, 'Tray');
  // dine-in skips the TAKEOUT tray, still uses the ALL bag (3 bags x 3 dishes = 9)
  const dineIn = computeServingsForFulfillment(recipe(), stock, 'DINE_IN');
  assert.equal(dineIn.servings, 9);
  assert.equal(dineIn.limitedBy, 'Bag');
});

test('no packaging left makes off-premise orders 0 even with food in stock', () => {
  const stock = new Map([
    ['shrimp', { baseUnit: 'g', stock: 1500, name: 'Shrimp' }],
    ['oil', { baseUnit: 'ml', stock: 5000, name: 'Oil' }],
    ['tray', { baseUnit: 'pcs', stock: 0, name: 'Tray' }],
    ['bag', { baseUnit: 'pcs', stock: 30, name: 'Bag' }],
  ]);
  assert.equal(computeServingsForFulfillment(recipe(), stock, 'DELIVERY').servings, 0);
  assert.equal(computeServingsForFulfillment(recipe(), stock, 'DINE_IN').servings, 10);
});

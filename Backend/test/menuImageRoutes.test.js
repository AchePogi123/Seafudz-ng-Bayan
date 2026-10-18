import test from 'node:test';
import assert from 'node:assert/strict';
import { requireActiveAdmin } from '../src/middleware/authMiddleware.js';
import menuRoutes from '../src/routes/menuRoutes.js';
import orderRoutes, { assertItemsAvailable } from '../src/routes/orderRoutes.js';
import {
  isManagedProductImagePath,
} from '../src/config/productImageStorage.js';
import { validateAndNormalizeProductImage } from '../src/utils/validateProductImage.js';
import sharp from 'sharp';

function invokeGuard(user, authIsSynthetic = false) {
  const req = { user, authIsSynthetic };
  let passed = false;
  let statusCode;
  let body;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  requireActiveAdmin(req, res, () => { passed = true; });
  return { passed, statusCode, body };
}

test('image write authorization accepts only active Admin employees', () => {
  assert.equal(invokeGuard({ type: 'employee', role: 'admin', is_active: true }).passed, true);
  assert.equal(invokeGuard({ type: 'employee', role: 'admin', is_active: false }).statusCode, 403);
  assert.equal(invokeGuard({ type: 'employee', role: 'cashier', is_active: true }).statusCode, 403);
  assert.equal(invokeGuard({ type: 'customer', role: 'admin', is_active: true }).statusCode, 403);
  assert.equal(invokeGuard({ type: 'employee', role: 'admin', is_active: true }, true).statusCode, 403);
  assert.equal(invokeGuard(null).statusCode, 401);
});

test('managed storage paths are restricted to the product-image namespace', () => {
  assert.equal(isManagedProductImagePath('products/all-shrimp-alacarte-199/00000000-0000-0000-0000-000000000000.webp'), true);
  assert.equal(isManagedProductImagePath('products/all-shrimp-alacarte-199/initial.jpg'), true);
  assert.equal(isManagedProductImagePath('../other-bucket/file.jpg'), false);
  assert.equal(isManagedProductImagePath('products/other/initial.svg'), false);
});

test('image routes run authentication and active Admin authorization before parsing uploads', () => {
  const postRoute = menuRoutes.stack.find((layer) => layer.route?.path === '/menu/:id/image' && layer.route.methods.post);
  const deleteRoute = menuRoutes.stack.find((layer) => layer.route?.path === '/menu/:id/image' && layer.route.methods.delete);
  assert.deepEqual(
    postRoute.route.stack.slice(0, 3).map((layer) => layer.handle.name),
    ['requireAuth', 'requireActiveAdmin', 'parseImageUpload'],
  );
  assert.deepEqual(
    deleteRoute.route.stack.slice(0, 2).map((layer) => layer.handle.name),
    ['requireAuth', 'requireActiveAdmin'],
  );
});

test('product catalog mutations require authentication and active Admin authorization', () => {
  const createRoute = menuRoutes.stack.find((layer) =>
    layer.route?.path === '/menu' && layer.route.methods.post
  );
  const archiveRoute = menuRoutes.stack.find((layer) =>
    layer.route?.path === '/menu/:id' && layer.route.methods.delete
  );
  assert.deepEqual(
    createRoute.route.stack.slice(0, 2).map((layer) => layer.handle.name),
    ['requireAuth', 'requireActiveAdmin'],
  );
  assert.deepEqual(
    archiveRoute.route.stack.slice(0, 2).map((layer) => layer.handle.name),
    ['requireAuth', 'requireActiveAdmin'],
  );
});

test('availability route requires authenticated Kitchen or Admin role checks', () => {
  const route = menuRoutes.stack.find((layer) =>
    layer.route?.path === '/menu/:id/availability' && layer.route.methods.patch
  );
  assert.equal(route.route.stack[0].handle.name, 'requireAuth');
  const guard = route.route.stack[1].handle;
  const checkRole = (role) => {
    let passed = false;
    let statusCode;
    guard({ user: { role } }, { status(code) { statusCode = code; return this; }, json() {} }, () => { passed = true; });
    return { passed, statusCode };
  };
  assert.equal(checkRole('kitchen').passed, true);
  assert.equal(checkRole('admin').passed, true);
  assert.equal(checkRole('cashier').statusCode, 403);
  assert.equal(checkRole('assistant').statusCode, 403);
});

test('POS order creation remains authenticated and role restricted', () => {
  const route = orderRoutes.stack.find((layer) => layer.route?.path === '/orders' && layer.route.methods.post);
  assert.equal(route.route.stack[0].handle.name, 'requireAuth');
  let passed = false;
  const res = { status() { return this; }, json() {} };
  route.route.stack[1].handle({ user: { role: 'kitchen' } }, res, () => { passed = true; });
  assert.equal(passed, false);
});

test('order availability validation locks products and rejects missing or unavailable items with 409', async () => {
  let queryText = '';
  const client = {
    async query(sql) {
      queryText = sql;
      return { rows: [{ id: 'shrimp', name: 'Shrimp', is_available: false }] };
    },
  };

  await assert.rejects(
    () => assertItemsAvailable(client, [{ productId: 'shrimp', name: 'Shrimp' }]),
    (error) => error.code === 'ITEM_OUT_OF_STOCK'
      && error.statusCode === 409
      && error.message === 'Item "Shrimp" is currently out of stock.'
  );
  assert.match(queryText, /FOR SHARE/);
});

test('order availability validation accepts only confirmed available catalog rows', async () => {
  const client = {
    async query() {
      return { rows: [{ id: 'shrimp', name: 'Shrimp', is_available: true, is_active: true }] };
    },
  };
  await assert.doesNotReject(() => assertItemsAvailable(client, [{ productId: 'shrimp', name: 'Shrimp' }]));
  await assert.rejects(
    () => assertItemsAvailable(client, [{ productId: 'missing', name: 'Missing Dish' }]),
    (error) => error.code === 'ITEM_OUT_OF_STOCK' && error.statusCode === 409
  );
});

test('order availability validation rejects deleted products with ITEM_DELETED 409', async () => {
  const client = {
    async query() {
      return { rows: [{ id: 'shrimp', name: 'Shrimp', is_available: false, is_active: false }] };
    },
  };
  await assert.rejects(
    () => assertItemsAvailable(client, [{ productId: 'shrimp', name: 'Shrimp' }]),
    (error) => error.code === 'ITEM_DELETED'
      && error.statusCode === 409
      && error.message === 'Item "Shrimp" has been removed from the menu and can no longer be ordered.'
  );
});

test('uploaded image bytes must decode as an allowed image format', async () => {
  const validPng = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#ff8800' },
  }).png().toBuffer();
  const normalized = await validateAndNormalizeProductImage(validPng);
  assert.equal(normalized.contentType, 'image/png');
  assert.equal(normalized.extension, 'png');
  await assert.rejects(() => validateAndNormalizeProductImage(Buffer.from('not an image')));
});

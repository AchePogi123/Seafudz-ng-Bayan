import test from 'node:test';
import assert from 'node:assert/strict';
import { requireActiveAdmin } from '../src/middleware/authMiddleware.js';
import menuRoutes from '../src/routes/menuRoutes.js';
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

test('uploaded image bytes must decode as an allowed image format', async () => {
  const validPng = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#ff8800' },
  }).png().toBuffer();
  const normalized = await validateAndNormalizeProductImage(validPng);
  assert.equal(normalized.contentType, 'image/png');
  assert.equal(normalized.extension, 'png');
  await assert.rejects(() => validateAndNormalizeProductImage(Buffer.from('not an image')));
});

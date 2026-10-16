import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import authRoutes from '../src/routes/authRoutes.js';
import { hashPassword, verifyPassword } from '../src/cryptography/passwordHash.js';
import {
  createStaffActivationToken,
  hashStaffActivationToken,
  isValidStaffActivationToken,
  isStaffLoginEligible,
  isValidStaffUsername,
  STAFF_ACTIVATION_TTL_MS,
} from '../src/cryptography/staffActivation.js';

test('staff activation tokens are unique, opaque, hashed, and expire after 72 hours', () => {
  const beforeCreate = Date.now();
  const first = createStaffActivationToken();
  const afterCreate = Date.now();
  const second = createStaffActivationToken();
  assert.equal(first.token.length, 43);
  assert.notEqual(first.token, second.token);
  assert.equal(isValidStaffActivationToken(first.token), true);
  assert.equal(isValidStaffActivationToken('too-short'), false);
  assert.equal(first.tokenHash, hashStaffActivationToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.ok(first.expiresAt.getTime() >= beforeCreate + STAFF_ACTIVATION_TTL_MS);
  assert.ok(first.expiresAt.getTime() <= afterCreate + STAFF_ACTIVATION_TTL_MS);
});

test('staff usernames enforce the activation username policy', () => {
  assert.equal(isValidStaffUsername('M.Santos'), true);
  assert.equal(isValidStaffUsername('staff_user-1'), true);
  assert.equal(isValidStaffUsername('ab'), false);
  assert.equal(isValidStaffUsername('bad username'), false);
  assert.equal(isValidStaffUsername('x'.repeat(33)), false);
});

test('pending or inactive staff accounts are rejected by login eligibility', () => {
  assert.equal(isStaffLoginEligible({ activation_status: 'pending', is_active: false }), false);
  assert.equal(isStaffLoginEligible({ activation_status: 'inactive', is_active: false }), false);
  assert.equal(isStaffLoginEligible({ activation_status: 'active', is_active: true }), true);
  assert.equal(isStaffLoginEligible({ role: 'cashier' }), true);
});

test('passwords use salted scrypt hashes and continue verifying legacy hashes', async () => {
  const password = 'a-long-test-password-123';
  const stored = await hashPassword(password);
  assert.match(stored, /^scrypt\$/);
  assert.notEqual(stored, password);
  assert.equal(await verifyPassword(password, stored), true);
  assert.equal(await verifyPassword('wrong-password', stored), false);

  const legacy = crypto.createHash('sha256').update(password + 'seafudz_salt_2026').digest('hex');
  assert.equal(await verifyPassword(password, legacy), true);
});

test('staff management routes require an active authenticated Admin', () => {
  for (const [path, method] of [
    ['/users', 'get'],
    ['/users', 'post'],
    ['/users/:id/toggle-status', 'patch'],
    ['/users/:id', 'put'],
    ['/users/:id/resend-activation', 'post'],
    ['/users/:id', 'delete'],
  ]) {
    const route = authRoutes.stack.find((layer) =>
      layer.route?.path === path && layer.route.methods[method]
    );
    assert.ok(route);
    assert.deepEqual(
      route.route.stack.slice(0, 2).map((layer) => layer.handle.name),
      ['requireAuth', 'requireActiveAdmin'],
    );
  }
});

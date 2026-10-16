import crypto from 'node:crypto';

export const STAFF_ACTIVATION_TTL_MS = 72 * 60 * 60 * 1000;

export function createStaffActivationToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashStaffActivationToken(token),
    expiresAt: new Date(Date.now() + STAFF_ACTIVATION_TTL_MS),
  };
}

export function hashStaffActivationToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function isValidStaffActivationToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function isValidStaffUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(username);
}

export function isStaffLoginEligible(employee) {
  return employee?.is_active !== false && employee?.activation_status !== 'pending';
}

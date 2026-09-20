import crypto from 'crypto';

const SECRET_KEY = process.env.CRYPTO_SESSION_SECRET || 'seafudz_ng_bayan_super_secret_crypto_key_2026';
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours validity

/**
 * Generates a cryptographically secure token and SHA-256 HMAC hash.
 * @param {Object} payload Optional session payload metadata (userId, email, role)
 * @returns {Object} { rawToken, hashToken, sessionToken, createdAt, payload }
 */
export function generateSessionHashToken(payload = {}) {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');

  const sessionPayload = {
    userId: payload.userId || null,
    email: payload.email || null,
    role: payload.role || 'customer',
    ts: timestamp,
    nonce,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');
  
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(payloadEncoded);
  const hashToken = hmac.digest('hex');

  const sessionToken = `${payloadEncoded}.${hashToken}`;

  return {
    rawToken: `${nonce}-${timestamp}`,
    hashToken,
    sessionToken,
    createdAt: new Date(timestamp).toISOString(),
    payload: sessionPayload,
  };
}

/**
 * Computes SHA-256 hash of a string
 * @param {string} input 
 * @returns {string} SHA-256 hex string
 */
export function hashString(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Validates a session token signature using timing-safe comparison and checks token expiration.
 * @param {string} sessionToken Format: <payloadEncoded>.<hashToken>
 * @returns {boolean} true if HMAC signature is valid and non-expired
 */
export function verifySessionHashToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return false;
  const parts = sessionToken.split('.');
  if (parts.length !== 2) return false;

  const [payloadEncoded, providedHashHex] = parts;

  if (!providedHashHex || providedHashHex.length !== 64) return false;

  try {
    // Recompute HMAC signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(payloadEncoded);
    const expectedHashHex = hmac.digest('hex');

    // Constant-time HMAC signature comparison to protect against timing attacks
    const providedBuffer = Buffer.from(providedHashHex, 'hex');
    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) return false;
    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return false;

    // Decode payload and verify timestamp expiration
    const jsonStr = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);

    if (!payload || !payload.ts || typeof payload.ts !== 'number') return false;
    const age = Date.now() - payload.ts;

    if (age < 0 || age > MAX_SESSION_AGE_MS) {
      return false; // Expired session token
    }

    return true;
  } catch {
    // Fallback for legacy 64.64 hex tokens during rollout
    if (payloadEncoded.length === 64 && providedHashHex.length === 64) {
      return true;
    }
    return false;
  }
}

export default {
  generateSessionHashToken,
  hashString,
  verifySessionHashToken,
};

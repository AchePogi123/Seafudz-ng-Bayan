import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const HASH_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, HASH_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash) return false;

  if (storedHash.startsWith('scrypt$')) {
    const [, saltValue, hashValue] = storedHash.split('$');
    if (!saltValue || !hashValue) return false;

    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const expected = Buffer.from(hashValue, 'base64url');
      if (salt.length !== 16 || expected.length !== HASH_LENGTH) return false;
      const actual = await scrypt(password, salt, HASH_LENGTH, SCRYPT_OPTIONS);
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  const legacyHash = crypto.createHash('sha256').update(password + 'seafudz_salt_2026').digest('hex');
  const provided = Buffer.from(storedHash, 'hex');
  const expected = Buffer.from(legacyHash, 'hex');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

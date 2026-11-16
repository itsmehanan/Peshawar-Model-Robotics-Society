/**
 * Credential handling.
 *
 * Passwords use scrypt (built into Node, no native module to compile) with a
 * per-password random salt and a versioned string format so parameters can be
 * raised later without invalidating existing accounts.
 *
 *   scrypt$N$r$p$<salt-b64>$<hash-b64>
 *
 * Session tokens are 32 random bytes; only their SHA-256 hash is stored, so a
 * database leak cannot be replayed as a live session.
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), derived.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  try {
    const derived = await scrypt(String(password), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
export const uuid = () => crypto.randomUUID();

/** Constant-time-ish comparison for short secrets such as invite codes. */
export function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/** Simple in-memory throttle: enough to stop credential stuffing on one node. */
const attempts = new Map();
export function throttle(key, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.start > windowMs) {
    attempts.set(key, { count: 1, start: now });
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((entry.start + windowMs - now) / 1000) };
  }
  return { allowed: true, remaining: limit - entry.count };
}
export function clearThrottle(key) {
  attempts.delete(key);
}

/**
 * Shared HTTP plumbing: error handling, session cookies, guards, audit trail.
 */
import { query, q1, transaction } from './db.js';
import { hashToken, uuid } from './security.js';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = extra.code || 'error';
    this.fields = extra.fields || {};
    this.extra = extra;
  }
}

export const fail = (status, message, extra) => {
  throw new HttpError(status, message, extra);
};

/** Wrap async handlers so rejected promises reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const COOKIES = { student: 'orbit_sid', admin: 'orbit_admin' };

export function setSessionCookie(res, kind, token, days) {
  const name = COOKIES[kind];
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append(
    'Set-Cookie',
    `${name}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(days * 86400)}${secure}`,
  );
}

export function clearSessionCookie(res, kind) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIES[kind]}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

export async function createSession(res, { kind, studentId = null, adminId = null, token, days = 30, userAgent = '' }) {
  await query(
    `INSERT INTO sessions (id, token_hash, student_id, admin_id, kind, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + ($7 || ' days')::interval)`,
    [uuid(), hashToken(token), studentId, adminId, kind, String(userAgent).slice(0, 180), String(days)],
  );
  setSessionCookie(res, kind, token, days);
}

export async function destroySession(req, res, kind) {
  const token = readCookie(req, COOKIES[kind]);
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  clearSessionCookie(res, kind);
}

/** Resolve the signed-in student, or null. Cleans up expired rows lazily. */
export async function currentStudent(req) {
  const token = readCookie(req, COOKIES.student);
  if (!token) return null;
  const row = await q1(
    `SELECT s.* FROM sessions se
     JOIN students s ON s.id = se.student_id
     WHERE se.token_hash = $1 AND se.kind = 'student' AND se.expires_at > now()`,
    [hashToken(token)],
  );
  return row;
}

export async function currentAdmin(req) {
  const token = readCookie(req, COOKIES.admin);
  if (!token) return null;
  return q1(
    `SELECT a.id, a.email, a.name FROM sessions se
     JOIN admin_users a ON a.id = se.admin_id
     WHERE se.token_hash = $1 AND se.kind = 'admin' AND se.expires_at > now()`,
    [hashToken(token)],
  );
}

export function requireStudent(student) {
  if (!student) fail(401, 'Please sign in to continue.', { code: 'unauthenticated' });
  return student;
}

export function requireAdmin(admin) {
  if (!admin) fail(401, 'Administrator sign-in required.', { code: 'unauthenticated' });
  return admin;
}

export async function audit(actorKind, actorId, action, detail = {}) {
  try {
    await query('INSERT INTO audit_log (id, actor_kind, actor_id, action, detail) VALUES ($1,$2,$3,$4,$5)', [
      uuid(),
      actorKind,
      String(actorId ?? ''),
      action,
      JSON.stringify(detail),
    ]);
  } catch {
    /* auditing must never break the request */
  }
}

export async function cleanupSessions() {
  await query("DELETE FROM sessions WHERE expires_at < now() - interval '1 day'");
}

/** Express error middleware. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  res.status(status).json({
    ok: false,
    error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    code: err.code || 'error',
    fields: err.fields || {},
  });
}

export { transaction };

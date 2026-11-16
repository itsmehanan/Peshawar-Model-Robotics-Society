/**
 * One-time database bootstrap, shared by both hosts.
 *
 *   - creates the schema (idempotent `CREATE TABLE IF NOT EXISTS`)
 *   - seeds first-boot content when the tables are empty
 *   - creates the bootstrap administrator when no admin exists yet
 *
 * Safe to call on every cold start: every step is guarded, so the steady-state
 * cost is two cheap counts.
 */
import crypto from 'node:crypto';

import { initDb, query, q1 } from './db.js';
import { hashPassword, uuid } from './security.js';

/**
 * Create the first administrator if the table is empty.
 *
 * On a serverless host there is no writable disk, so the generated password is
 * only printed to the build/runtime log — set ADMIN_EMAIL and ADMIN_PASSWORD as
 * environment variables so the account is created with a password you know.
 */
export async function ensureAdmin(cfg) {
  const existing = await q1('SELECT count(*)::int AS n FROM admin_users');
  if (existing.n > 0) return null;

  let password = cfg.adminPassword;
  let generated = false;
  if (!password || password === 'change-me-before-you-deploy') {
    password = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }
  await query('INSERT INTO admin_users (id, email, name, password_hash) VALUES ($1,$2,$3,$4)', [
    uuid(),
    cfg.adminEmail.toLowerCase(),
    cfg.adminName,
    await hashPassword(password),
  ]);

  console.log(
    [
      '',
      '────────────────────────────────────────────────────────────',
      '  Administrator account created',
      `  email:    ${cfg.adminEmail}`,
      `  password: ${password}`,
      generated ? '  (generated once — set ADMIN_PASSWORD to control it)' : '',
      '────────────────────────────────────────────────────────────',
      '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return { email: cfg.adminEmail, password, generated };
}

let ready = null;

/** Initialise the database exactly once per process / warm function instance. */
export function bootstrap(cfg) {
  if (!ready) {
    ready = (async () => {
      await initDb(cfg);
      await ensureAdmin(cfg);
    })();
    // A failed boot must be retryable rather than cached forever.
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

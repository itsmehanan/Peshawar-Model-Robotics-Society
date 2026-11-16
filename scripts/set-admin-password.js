#!/usr/bin/env node
/**
 * Set (or reset) the administrator password from the command line.
 *
 *   npm run admin:set-password -- --email organizer@example.com --password "NewPass123"
 *
 * Useful when the bootstrap password is lost, and in deployment pipelines where
 * the first-boot credentials are not visible in the logs.
 */
import { loadEnv, config } from '../server/config.js';
loadEnv();

import { initDb, query, q1 } from '../server/db.js';
import { hashPassword, uuid } from '../server/security.js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, index, all) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), all[index + 1]?.startsWith('--') ? '' : all[index + 1] ?? '']);
    return acc;
  }, []),
);

const cfg = config();
const email = (args.email || cfg.adminEmail).toLowerCase();
const password = args.password || '';

if (password.length < 8) {
  console.error('Provide --password with at least 8 characters (letters and numbers).');
  process.exit(1);
}

await initDb(cfg);
const existing = await q1('SELECT id FROM admin_users WHERE lower(email) = $1', [email]);
const hash = await hashPassword(password);

if (existing) {
  await query('UPDATE admin_users SET password_hash = $1 WHERE id = $2', [hash, existing.id]);
  await query("DELETE FROM sessions WHERE admin_id = $1 AND kind = 'admin'", [existing.id]);
  console.log(`Password updated for ${email}. All admin sessions were signed out.`);
} else {
  await query('INSERT INTO admin_users (id, email, name, password_hash) VALUES ($1,$2,$3,$4)', [
    uuid(),
    email,
    args.name || cfg.adminName,
    hash,
  ]);
  console.log(`Administrator ${email} created.`);
}
process.exit(0);

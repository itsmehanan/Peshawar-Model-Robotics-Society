/**
 * Settings are stored one JSON document per section so branding, event,
 * registration, contact and social configuration can be edited independently
 * and read in a single round trip by the public site.
 */
import { query } from './db.js';

const cache = new Map();
let cacheStamp = 0;

export async function getSettings() {
  const { rows } = await query('SELECT key, value, updated_at FROM settings');
  const stamp = rows.reduce((acc, r) => Math.max(acc, new Date(r.updated_at).getTime()), 0);
  if (stamp === cacheStamp && cache.size) return Object.fromEntries(cache);
  cache.clear();
  cacheStamp = stamp;
  for (const row of rows) cache.set(row.key, row.value);
  return Object.fromEntries(cache);
}

export async function getSection(key) {
  const settings = await getSettings();
  return settings[key] ?? {};
}

export async function putSection(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
  cacheStamp = 0;
  cache.clear();
  return value;
}

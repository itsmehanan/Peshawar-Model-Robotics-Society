import fs from 'node:fs';
import path from 'node:path';

/** Minimal .env reader — avoids a dependency and keeps deployment portable. */
export function loadEnv(file = '.env') {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function config() {
  return {
    port: Number(process.env.PORT || 3000),
    dataDir: process.env.DATA_DIR || './data',
    databaseUrl: process.env.DATABASE_URL || '',
    databaseSsl: String(process.env.DATABASE_SSL || '').toLowerCase() === 'true',
    adminEmail: process.env.ADMIN_EMAIL || 'admin-003',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    adminName: process.env.ADMIN_NAME || 'Event Organizer',
    sessionDays: Number(process.env.SESSION_DAYS || 30),
    trustProxy: process.env.TRUST_PROXY ?? '',
    production: process.env.NODE_ENV === 'production',
  };
}

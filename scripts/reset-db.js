#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY — drop every table and re-seed default content.
 *
 *   npm run db:reset
 *
 * Refuses to run when NODE_ENV=production or when DATABASE_URL points at a
 * hosted database, so it cannot be triggered accidentally against real data.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';

import { loadEnv, config } from '../server/config.js';
loadEnv();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to reset: NODE_ENV is production.');
  process.exit(1);
}

const cfg = config();
if (/^postgres(ql)?:\/\//i.test(cfg.databaseUrl || '')) {
  console.error('Refusing to reset a hosted DATABASE_URL. Drop and recreate it with your provider instead.');
  process.exit(1);
}

const target = path.resolve(process.cwd(), cfg.dataDir, 'pglite');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Delete the embedded database at ${target} and re-seed? Type "reset" to continue: `);
rl.close();
if (answer.trim() !== 'reset') {
  console.log('Cancelled.');
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
console.log('Removed. Run `npm start` to create a fresh database with default content.');

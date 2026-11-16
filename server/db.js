/**
 * Database access layer.
 *
 * Two interchangeable drivers sit behind one tiny `query()`/`transaction()` API:
 *   - PGlite  : embedded PostgreSQL (default; zero external services)
 *   - node-pg : any hosted PostgreSQL, e.g. Supabase
 *
 * Choosing a driver is done purely through DATABASE_URL, so the exact same
 * schema, SQL and application code run in development and production.
 */
import fs from 'node:fs';
import path from 'node:path';

const isPostgresUrl = (url) => /^postgres(ql)?:\/\//i.test(url || '');

let driver = null;

async function createPglite(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  return {
    kind: 'pglite',
    async exec(sql) {
      await db.exec(sql);
    },
    async query(sql, params = []) {
      const result = await db.query(sql, params);
      return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
    },
    async transaction(fn) {
      return db.transaction(async (tx) => {
        const client = {
          async query(sql, params = []) {
            const result = await tx.query(sql, params);
            return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
          },
        };
        return fn(client);
      });
    },
    async close() {
      await db.close();
    },
  };
}

async function createPostgres(url, ssl) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX || 5),
  });
  return {
    kind: 'postgres',
    async exec(sql) {
      await pool.query(sql);
    },
    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async query(sql, params = []) {
            const r = await client.query(sql, params);
            return { rows: r.rows, rowCount: r.rowCount ?? 0 };
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function initDb(config) {
  if (driver) return driver;
  if (isPostgresUrl(config.databaseUrl)) {
    driver = await createPostgres(config.databaseUrl, config.databaseSsl);
  } else {
    driver = await createPglite(config.dataDir);
  }
  await migrate();
  return driver;
}

export function getDb() {
  if (!driver) throw new Error('Database not initialised');
  return driver;
}

export const query = (sql, params) => getDb().query(sql, params);
export const transaction = (fn) => getDb().transaction(fn);
export const q1 = async (sql, params) => (await query(sql, params)).rows[0] ?? null;

/* ------------------------------------------------------------------------ */
/* Schema                                                                    */
/* ------------------------------------------------------------------------ */

import { SCHEMA } from './schema.js';
import { seedDatabase } from './seed.js';

async function migrate() {
  await driver.exec(SCHEMA);
  await seedDatabase(driver);
}

export function dataRoot(config) {
  return path.resolve(process.cwd(), config.dataDir || './data');
}

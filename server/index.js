/**
 * PMRS — long-running server (local development, VPS, Docker).
 *
 *   npm start          → http://localhost:3000
 *
 * Architecture: Express + a single SQL database (embedded PostgreSQL by default,
 * any hosted PostgreSQL when DATABASE_URL is set), server-rendered static shell
 * with a progressively-enhanced client app, and cookie sessions on the server.
 *
 * This file only handles *hosting concerns* — the database bootstrap, the
 * bootstrap administrator, session cleanup and the listening socket. The
 * application itself lives in server/app.js so the identical code can also run
 * as a serverless function (see api/index.js).
 */
import { loadEnv, config } from './config.js';
loadEnv();

import { app, prepare } from './app.js';
import { cleanupSessions } from './http.js';

const cfg = config();

export async function start() {
  // prepare() creates the schema, seeds content and bootstraps the admin.
  await prepare();
  await cleanupSessions();
  setInterval(() => cleanupSessions().catch(() => {}), 6 * 60 * 60 * 1000).unref?.();

  const server = app.listen(cfg.port, '0.0.0.0', () => {
    const dbKind = cfg.databaseUrl ? 'postgres' : 'embedded postgres (pglite)';
    console.log(`PMRS ready on http://localhost:${cfg.port}  ·  database: ${dbKind}`);
  });
  server.on('error', (err) => {
    console.error('[server]', err.message);
    process.exitCode = 1;
  });
  return server;
}

if (process.argv[1] && process.argv[1].endsWith('server/index.js')) {
  start().catch((error) => {
    console.error('Failed to start:', error);
    process.exit(1);
  });
}

export { app };

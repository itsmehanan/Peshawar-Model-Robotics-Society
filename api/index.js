/**
 * Vercel serverless entry point.
 *
 * Every request — pages, API and static assets — arrives here and is handed to
 * the same Express app the long-running server uses. Two things are specific to
 * this host:
 *
 *   1. There is no writable disk, so a hosted PostgreSQL (DATABASE_URL) is
 *      required. The embedded PGlite driver would try to write to ./data and
 *      must never be selected in production.
 *   2. Cold starts must not pay for the schema check on every invocation, so
 *      `prepare()` is remembered on the module scope (Vercel reuses warm
 *      containers) and the promise is shared by concurrent requests.
 *
 * vercel.json routes /assets and /fonts to the CDN first, so those never reach
 * this function.
 */
import { app, prepare } from '../server/app.js';

let booting = null;

export async function boot() {
  if (!booting) {
    booting = (async () => {
      if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '')) {
        throw new Error(
          'DATABASE_URL is not set. A serverless deployment has no writable disk, ' +
            'so the embedded PGlite database cannot be used. Set DATABASE_URL to a hosted ' +
            'PostgreSQL connection string (Supabase, Neon, RDS, …).',
        );
      }
      await prepare();
    })();
    // A failed boot must be retryable on the next request, not cached forever.
    booting.catch(() => {
      booting = null;
    });
  }
  return booting;
}

export default async function handler(req, res) {
  try {
    await boot();
  } catch (error) {
    console.error('[boot]', error.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<!doctype html><title>Configuration required</title>` +
        `<body style="background:#0a0a0b;color:#f5f4f1;font:16px/1.5 system-ui;padding:12vh 8vw">` +
        `<h1 style="font-size:2rem;letter-spacing:-.03em">Database not configured</h1>` +
        `<p style="color:#a8a7a2;max-width:52ch">This deployment has no database connection. ` +
        `Set the <code>DATABASE_URL</code> environment variable to a hosted PostgreSQL instance and redeploy.</p>` +
        `</body>`,
    );
    return;
  }
  return app(req, res);
}

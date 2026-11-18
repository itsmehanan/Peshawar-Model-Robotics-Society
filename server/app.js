/**
 * The Express application itself, with no knowledge of *how* it is hosted.
 *
 * Two entry points consume this module:
 *   - server/index.js  → long-running Node process (`npm start`, Docker, VPS)
 *   - api/index.js     → a single serverless function (Vercel)
 *
 * Keeping the app host-agnostic is what lets the same routes, SQL and security
 * headers run in both places. The only difference is that a serverless host has
 * no writable disk, so it must be given a hosted Postgres URL (DATABASE_URL).
 */
import express from 'express';
import path from 'node:path';

import { config } from './config.js';
import { bootstrap } from './bootstrap.js';
import { errorHandler } from './http.js';
import { publicRouter, categoryRows, articleRows, faqRows, announcementRows, publicCounts } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { studentRouter } from './routes/student.js';
import { adminRouter } from './routes/admin.js';
import { renderDocument } from './render.js';
import { getSettings } from './settings.js';
import { query } from './db.js';
import { THEME_BOOT_HASH } from './theme-boot.js';

const app = express();

const cfg = config();
if (cfg.trustProxy !== '') app.set('trust proxy', Number(cfg.trustProxy) || 1);
app.disable('x-powered-by');

/* ---------------------------------------------------------------- */
/* Security headers                                                  */
/* ---------------------------------------------------------------- */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      `script-src 'self' https://cdn.jsdelivr.net ${THEME_BOOT_HASH}`,
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  });
  if (cfg.production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '3mb' }));

/**
 * CSRF defence in depth. Sessions are SameSite=Lax cookies, and on top of that
 * any state-changing request must be JSON with a same-origin `Origin`. A plain
 * HTML form post (the classic CSRF vector) can do neither.
 */
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers.host;
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return res.status(403).json({ ok: false, error: 'Invalid origin.', code: 'csrf' });
    }
    if (originHost !== host) {
      return res.status(403).json({ ok: false, error: 'Cross-site request blocked.', code: 'csrf' });
    }
  }
  // DELETE calls frequently carry no body at all; only insist on JSON when a
  // body is actually present.
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ ok: false, error: 'Expected a JSON request body.', code: 'unsupported_media' });
  }
  return next();
});

/* ---------------------------------------------------------------- */
/* API                                                               */
/* ---------------------------------------------------------------- */
/** Liveness probe. Registered before the routers so it is never shadowed. */
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, database: cfg.databaseUrl ? 'postgres' : 'pglite', uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, error: 'Database unavailable.' });
  }
});

app.use('/api', publicRouter);
app.use('/api', authRouter);
app.use('/api', studentRouter);
app.use('/api', adminRouter);
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Unknown endpoint.', code: 'not_found' }));

/* ---------------------------------------------------------------- */
/* Static assets + app shell                                         */
/* ---------------------------------------------------------------- */
const publicDir = path.resolve(process.cwd(), 'public');
app.use(
  '/assets',
  express.static(path.join(publicDir, 'assets'), {
    // No immutable long-cache: the app is a single module graph, so one stale
    // file (for example an old pages/admin.js) silently breaks a panel. ETags
    // still give us cheap revalidation.
    maxAge: 0,
    etag: true,
    lastModified: true,
    index: false,
    setHeaders(res) {
      res.set('Cache-Control', 'no-cache, must-revalidate');
    },
  }),
);
app.use(
  '/fonts',
  express.static(path.join(publicDir, 'fonts'), { maxAge: '1y', immutable: true, index: false }),
);

app.get(['/favicon.ico', '/favicon.svg'], async (req, res, next) => {
  try {
    const { rows } = await query("SELECT value FROM settings WHERE key='site'");
    const favicon = rows[0]?.value?.faviconUrl;
    if (!favicon) return next();
    if (favicon.startsWith('/api/assets/')) return res.redirect(302, favicon);
    if (favicon.startsWith('data:')) {
      const [, mime, b64] = /^data:(.+?);base64,(.*)$/.exec(favicon) || [];
      if (mime && b64) {
        res.type(mime);
        return res.send(Buffer.from(b64, 'base64'));
      }
    }
    return res.redirect(302, favicon);
  } catch {
    next();
  }
});

app.get(/^\/(?!api|assets|fonts).*/, async (req, res) => {
  try {
    // Content is embedded in the document so the first paint does not depend on
    // a second round trip; the client still revalidates on boot.
    const settings = await getSettings();
    // The embedded copy is the *complete* public payload, not just the chrome.
    // A cold load therefore paints the real page even if the follow-up
    // /api/content request is slow, blocked or fails — the header, the field
    // cards, the journal teasers and the FAQs are all there from byte one.
    const [categories, articles, faqs, announcements, counts] = await Promise.all([
      categoryRows(),
      articleRows(),
      faqRows(),
      announcementRows(),
      publicCounts(),
    ]);
    const content = {
      site: settings.site,
      event: settings.event,
      registration: settings.registration,
      contact: settings.contact,
      socials: (settings.socials || []).filter((s) => s.enabled && s.url),
      footer: settings.footer,
      categories,
      articles,
      faqs,
      announcements,
      counts,
    };
    res.type('html').send(await renderDocument(content));
  } catch (error) {
    console.error('[render]', error);
    res.status(500).type('html').send('<!doctype html><title>PMRS</title><p>Server error. Please refresh.</p>');
  }
});

app.use(errorHandler);

/** Initialise the database (schema, seed, bootstrap admin) exactly once. */
export const prepare = () => bootstrap(cfg);

export { app, cfg };

/**
 * Public, unauthenticated read API. Nothing here exposes personal data: only
 * aggregate counts and the fields a team leader deliberately shares.
 */
import { Router } from 'express';
import { query } from '../db.js';
import { getSettings } from '../settings.js';
import { wrap } from '../http.js';

export const publicRouter = Router();

const CATEGORY_FIELDS = `id, name, symbol, summary, rules, accent, image_url AS "imageUrl", sort_order AS "sortOrder"`;

export const categoryRows = async ({ activeOnly = true } = {}) =>
  (await query(`SELECT ${CATEGORY_FIELDS} FROM categories ${activeOnly ? 'WHERE is_active' : ''} ORDER BY sort_order, name`)).rows;

export const articleRows = async ({ publishedOnly = true } = {}) =>
  (
    await query(
      `SELECT id, title, slug, label, excerpt, body, image_url AS "imageUrl",
              read_minutes AS "readMinutes", is_published AS "isPublished",
              sort_order AS "sortOrder", created_at AS "createdAt"
       FROM articles ${publishedOnly ? 'WHERE is_published' : ''}
       ORDER BY sort_order, created_at DESC`,
    )
  ).rows;

export const announcementRows = async ({ activeOnly = true } = {}) =>
  (
    await query(
      `SELECT id, title, body, level, link_label AS "linkLabel", link_url AS "linkUrl", is_active AS "isActive",
              created_at AS "createdAt"
       FROM announcements
       ${activeOnly ? `WHERE is_active
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at > now())` : ''}
       ORDER BY created_at DESC LIMIT 6`,
    )
  ).rows;

export const faqRows = async ({ activeOnly = true } = {}) =>
  (
    await query(
      `SELECT id, question, answer, sort_order AS "sortOrder", is_active AS "isActive"
       FROM faqs ${activeOnly ? 'WHERE is_active' : ''} ORDER BY sort_order, created_at`,
    )
  ).rows;

/** Everything the landing page needs, in one request. */
publicRouter.get(
  '/content',
  wrap(async (req, res) => {
    const settings = await getSettings();
    const [categories, articles, faqs, announcements, counts] = await Promise.all([
      categoryRows(),
      articleRows(),
      faqRows(),
      announcementRows(),
      (async () =>
        query(
          `SELECT
             (SELECT count(*)::int FROM students WHERE status <> 'withdrawn') AS students,
             (SELECT count(*)::int FROM teams) AS teams,
             (SELECT coalesce(sum(max_members),0)::int FROM teams) AS seats`,
        )
      )(),
    ]);
    res.set('Cache-Control', 'no-cache');
    res.json({
      ok: true,
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
      counts: counts.rows[0],
    });
  }),
);

/** Team discovery for the join flow — deliberately minimal, code-gated. */
publicRouter.get(
  '/teams',
  wrap(async (req, res) => {
    const school = String(req.query.school || '').trim();
    const categoryId = String(req.query.category || '').trim();
    const params = [];
    const where = [];
    if (school) {
      params.push(school.toLowerCase());
      where.push(`lower(t.school) = $${params.length}`);
    }
    if (categoryId) {
      params.push(categoryId);
      where.push(`t.category_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT t.id, t.name, t.school, t.category_id AS "categoryId", t.max_members AS "maxMembers",
              count(s.id)::int AS "memberCount"
       FROM teams t LEFT JOIN students s ON s.team_id = t.id AND s.status <> 'withdrawn'
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       GROUP BY t.id
       ORDER BY t.name
       LIMIT 60`,
      params,
    );
    res.json({
      ok: true,
      teams: rows.map((t) => ({ ...t, seatsLeft: Math.max(0, t.maxMembers - t.memberCount) })),
    });
  }),
);

/** Serve uploaded branding assets from the database. */
publicRouter.get(
  '/assets/:id',
  wrap(async (req, res) => {
    const { rows } = await query('SELECT mime, data FROM assets WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).end();
    res.set('Content-Type', rows[0].mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(rows[0].data);
  }),
);

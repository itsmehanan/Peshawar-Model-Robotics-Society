/**
 * Administrator API. Every route here is behind requireAdmin; there is no
 * client-side password, no shared secret in the bundle and no way to reach
 * these handlers without a server-issued session cookie.
 */
import { Router } from 'express';
import { transaction, query, q1 } from '../db.js';
import { getSettings, putSection } from '../settings.js';
import { uuid, hashPassword, verifyPassword } from '../security.js';
import { ValidationError, str, multiline, url as vUrl, int, bool, slug as vSlug, email as vEmail, oneOf, password as vPassword, phone as vPhone } from '../validation.js';
import { wrap, fail, currentAdmin, requireAdmin, audit } from '../http.js';
import { loadTeam, loadStudent } from '../serializers.js';
import { categoryRows, articleRows, faqRows } from './public.js';
import { DEFAULT_SETTINGS } from '../seed.js';

export const adminRouter = Router();

/**
 * Cheap session check used by the client as a heartbeat. The control room is a
 * long-lived screen: tabs get restored, laptops sleep, sessions expire. Without
 * this the first failing section render silently swapped the whole panel for
 * the sign-in form, which looked like "I logged in and got kicked out".
 */
adminRouter.get(
  '/admin/session',
  wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store, must-revalidate');
    const admin = await currentAdmin(req);
    if (!admin) return res.status(401).json({ ok: false, error: 'Session expired.', code: 'unauthenticated' });
    res.json({ ok: true, admin });
  }),
);

adminRouter.use('/admin', wrap(async (req, res, next) => {
  const admin = await currentAdmin(req);
  requireAdmin(admin);
  req.admin = admin;
  next();
}));

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

adminRouter.get(
  '/admin/overview',
  wrap(async (req, res) => {
    const [counts, perCategory, recent, requests, activity] = await Promise.all([
      query(`SELECT
        (SELECT count(*)::int FROM students WHERE status <> 'withdrawn') AS students,
        (SELECT count(*)::int FROM teams) AS teams,
        (SELECT count(*)::int FROM category_requests WHERE status='pending') AS pending_requests,
        (SELECT count(*)::int FROM students WHERE created_at > now() - interval '7 days') AS new_week,
        (SELECT coalesce(sum(max_members),0)::int FROM teams) AS seats`),
      query(`SELECT c.id, c.name, count(s.id)::int AS students, count(DISTINCT s.team_id)::int AS teams
             FROM categories c LEFT JOIN students s ON s.category_id = c.id AND s.status <> 'withdrawn'
             GROUP BY c.id, c.name, c.sort_order ORDER BY c.sort_order`),
      query(`SELECT id, name, school, class_name AS "className", category_id AS "categoryId", created_at AS "createdAt"
             FROM students ORDER BY created_at DESC LIMIT 6`),
      query(`SELECT r.*, st.name AS "studentName", st.school FROM category_requests r
             JOIN students st ON st.id = r.student_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 8`),
      query(`SELECT action, actor_kind AS "actorKind", created_at AS "createdAt", detail FROM audit_log
             ORDER BY created_at DESC LIMIT 12`),
    ]);
    res.json({
      ok: true,
      counts: counts.rows[0],
      perCategory: perCategory.rows,
      recent: recent.rows,
      pendingRequests: requests.rows,
      activity: activity.rows,
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Students & teams                                                    */
/* ------------------------------------------------------------------ */

adminRouter.get(
  '/admin/students',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const teamState = String(req.query.team || '').trim();
    const params = [];
    const where = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(lower(s.name) LIKE $${params.length} OR lower(s.email) LIKE $${params.length}
        OR lower(s.school) LIKE $${params.length} OR lower(s.class_name) LIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      where.push(`s.category_id = $${params.length}`);
    }
    if (teamState === 'solo') where.push('s.team_id IS NULL');
    if (teamState === 'team') where.push('s.team_id IS NOT NULL');

    const { rows } = await query(
      `SELECT s.id, s.name, s.email, s.class_name AS "className", s.school, s.phone,
              s.category_id AS "categoryId", s.team_id AS "teamId", s.status, s.role,
              s.project_title AS "projectTitle", s.created_at AS "createdAt",
              c.name AS "categoryName", t.name AS "teamName"
       FROM students s
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN teams t ON t.id = s.team_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY s.created_at DESC`,
      params,
    );
    res.json({ ok: true, students: rows });
  }),
);

adminRouter.patch(
  '/admin/students/:id',
  wrap(async (req, res) => {
    const body = req.body || {};
    const existing = await q1('SELECT * FROM students WHERE id=$1', [req.params.id]);
    if (!existing) fail(404, 'Student not found.');

    const name = str(body.name ?? existing.name, { min: 2, max: 90, field: 'Name', required: true });
    const className = str(body.className ?? existing.class_name, { max: 40, field: 'Class' });
    const school = str(body.school ?? existing.school, { min: 2, max: 120, field: 'School', required: true });
    const phoneValue = vPhone(body.phone ?? existing.phone);
    const categoryId = str(body.categoryId ?? existing.category_id, { field: 'Category', required: true });
    const status = oneOf(body.status ?? existing.status, ['confirmed', 'pending', 'withdrawn'], 'status');
    const teamId = body.teamId === undefined ? existing.team_id : body.teamId || null;

    await transaction(async (tx) => {
      if (teamId) {
        const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [teamId])).rows[0];
        if (!team) throw new ValidationError('That team does not exist.', { teamId: 'missing' });
        const { rows } = await tx.query("SELECT count(*)::int AS n FROM students WHERE team_id=$1 AND status<>'withdrawn' AND id<>$2", [teamId, existing.id]);
        if (rows[0].n >= team.max_members) throw new ValidationError('That team is full.', { teamId: 'full' });
        if (team.category_id !== categoryId) {
          throw new ValidationError('The team belongs to a different category — change the team category first.', { categoryId: 'team_mismatch' });
        }
        if (team.school.toLowerCase() !== school.toLowerCase()) {
          throw new ValidationError('The team belongs to a different school.', { school: 'team_mismatch' });
        }
      }
      await tx.query(
        `UPDATE students SET name=$1, class_name=$2, school=$3, phone=$4, category_id=$5, status=$6,
                team_id=$7, role=CASE WHEN $7::uuid IS NULL THEN 'solo'
                  WHEN role='leader' THEN 'leader' ELSE 'member' END, updated_at=now()
         WHERE id=$8`,
        [name, className, school, phoneValue, categoryId, status, teamId, existing.id],
      );
      if (teamId) {
        const team = (await tx.query('SELECT * FROM teams WHERE id=$1', [teamId])).rows[0];
        if (!team.leader_id) await tx.query("UPDATE teams SET leader_id=$1 WHERE id=$2", [existing.id, teamId]);
        if (team.leader_id === existing.id) await tx.query("UPDATE students SET role='leader' WHERE id=$1", [existing.id]);
      }
      // Approving implicitly resolves any open request for this student.
      if (categoryId !== existing.category_id) {
        await tx.query(
          "UPDATE category_requests SET status='approved', resolved_at=now(), admin_note=coalesce(nullif(admin_note,''),'Applied by an administrator') WHERE student_id=$1 AND status='pending'",
          [existing.id],
        );
      }
    });

    await audit('admin', req.admin.id, 'student.update', { studentId: existing.id });
    res.json({ ok: true, student: await loadStudent(existing.id) });
  }),
);

adminRouter.delete(
  '/admin/students/:id',
  wrap(async (req, res) => {
    await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!student) fail(404, 'Student not found.');
      if (student.team_id) {
        const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0];
        if (team) {
          const { rows } = await tx.query(
            "SELECT id FROM students WHERE team_id=$1 AND id<>$2 AND status<>'withdrawn' ORDER BY created_at LIMIT 1",
            [team.id, student.id],
          );
          if (team.leader_id === student.id && rows.length) {
            await tx.query("UPDATE students SET role='leader' WHERE id=$1", [rows[0].id]);
            await tx.query('UPDATE teams SET leader_id=$1 WHERE id=$2', [rows[0].id, team.id]);
          } else if (team.leader_id === student.id) {
            await tx.query('DELETE FROM teams WHERE id=$1', [team.id]);
          }
        }
      }
      await tx.query('DELETE FROM students WHERE id=$1', [student.id]);
    });
    await audit('admin', req.admin.id, 'student.delete', { studentId: req.params.id });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/admin/teams',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT t.id, t.name, t.school, t.category_id AS "categoryId", t.max_members AS "maxMembers",
              t.leader_id AS "leaderId", t.created_at AS "createdAt", c.name AS "categoryName",
              (SELECT count(*)::int FROM students s WHERE s.team_id=t.id AND s.status<>'withdrawn') AS "memberCount",
              (SELECT name FROM students WHERE id=t.leader_id) AS "leaderName"
       FROM teams t LEFT JOIN categories c ON c.id=t.category_id ORDER BY t.created_at DESC`,
    );
    res.json({ ok: true, teams: rows });
  }),
);

adminRouter.patch(
  '/admin/teams/:id',
  wrap(async (req, res) => {
    const body = req.body || {};
    await transaction(async (tx) => {
      const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!team) fail(404, 'Team not found.');
      const name = str(body.name ?? team.name, { min: 2, max: 60, field: 'Team name', required: true });
      const categoryId = str(body.categoryId ?? team.category_id, { field: 'Category', required: true });
      const maxMembers = int(body.maxMembers ?? team.max_members, { min: 2, max: 8, field: 'Team size' });
      const { rows } = await tx.query("SELECT count(*)::int AS n FROM students WHERE team_id=$1 AND status<>'withdrawn'", [team.id]);
      if (maxMembers < rows[0].n) throw new ValidationError(`Team already has ${rows[0].n} members.`, { maxMembers: 'below_member_count' });

      await tx.query('UPDATE teams SET name=$1, category_id=$2, max_members=$3, updated_at=now() WHERE id=$4', [
        name,
        categoryId,
        maxMembers,
        team.id,
      ]);
      if (categoryId !== team.category_id) {
        await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE team_id=$2', [categoryId, team.id]);
      }
      if (body.passcode) {
        const passcode = String(body.passcode);
        if (passcode.length < 6) throw new ValidationError('Passcode must be at least 6 characters.', { passcode: 'too_short' });
        await tx.query('UPDATE teams SET passcode_hash=$1 WHERE id=$2', [await hashPassword(passcode), team.id]);
      }
    });
    await audit('admin', req.admin.id, 'team.update', { teamId: req.params.id });
    res.json({ ok: true, team: await loadTeam(req.params.id) });
  }),
);

adminRouter.delete(
  '/admin/teams/:id',
  wrap(async (req, res) => {
    await transaction(async (tx) => {
      const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!team) fail(404, 'Team not found.');
      await tx.query("UPDATE students SET team_id=NULL, role='solo' WHERE team_id=$1", [team.id]);
      await tx.query('DELETE FROM teams WHERE id=$1', [team.id]);
    });
    await audit('admin', req.admin.id, 'team.delete', { teamId: req.params.id });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Category change requests                                            */
/* ------------------------------------------------------------------ */

adminRouter.get(
  '/admin/category-requests',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT r.id, r.status, r.reason, r.admin_note AS "adminNote", r.created_at AS "createdAt",
              r.from_category AS "fromCategory", r.to_category AS "toCategory",
              s.id AS "studentId", s.name AS "studentName", s.school, s.team_id AS "teamId",
              (SELECT count(*)::int FROM students x WHERE x.team_id=s.team_id AND x.status<>'withdrawn') AS "teamSize"
       FROM category_requests r JOIN students s ON s.id=r.student_id
       ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 100`,
    );
    res.json({ ok: true, requests: rows });
  }),
);

adminRouter.post(
  '/admin/category-requests/:id',
  wrap(async (req, res) => {
    const action = oneOf(req.body?.action, ['approve', 'reject'], 'action');
    const note = str(req.body?.note, { max: 300, field: 'Note' });
    await transaction(async (tx) => {
      const { rows } = await tx.query(
        `SELECT r.*, s.team_id, s.role FROM category_requests r JOIN students s ON s.id=r.student_id
         WHERE r.id=$1 FOR UPDATE`,
        [req.params.id],
      );
      const request = rows[0];
      if (!request) fail(404, 'Request not found.');
      if (request.status !== 'pending') fail(409, 'That request was already handled.');

      if (action === 'approve') {
        await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE id=$2', [
          request.to_category,
          request.student_id,
        ]);

        // A leader's move applies to the whole team: a team cannot be split
        // across fields, because its exhibition table is judged as one entry.
        if (request.team_id && request.role === 'leader') {
          await tx.query('UPDATE teams SET category_id=$1, updated_at=now() WHERE id=$2', [
            request.to_category,
            request.team_id,
          ]);
          await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE team_id=$2', [
            request.to_category,
            request.team_id,
          ]);
          await tx.query(
            `UPDATE category_requests
             SET status='approved', resolved_at=now(), admin_note='Applied with the team category move'
             WHERE status='pending' AND id<>$1
               AND student_id IN (SELECT id FROM students WHERE team_id=$2)`,
            [request.id, request.team_id],
          );
        }
      }

      await tx.query('UPDATE category_requests SET status=$1, admin_note=$2, resolved_at=now() WHERE id=$3', [
        action === 'approve' ? 'approved' : 'rejected',
        note,
        request.id,
      ]);
    });
    await audit('admin', req.admin.id, `category.${action}`, { requestId: req.params.id });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Content: categories, articles, FAQs                                 */
/* ------------------------------------------------------------------ */

adminRouter.get(
  '/admin/categories',
  wrap(async (req, res) => {
    res.json({ ok: true, categories: await categoryRows({ activeOnly: false }) });
  }),
);

adminRouter.post(
  '/admin/categories',
  wrap(async (req, res) => {
    const body = req.body || {};
    const id = vSlug(body.id || body.name, 'id');
    const name = str(body.name, { min: 2, max: 60, field: 'Name', required: true });
    const symbol = str(body.symbol || '◇', { max: 4, field: 'Symbol' }) || '◇';
    const summary = str(body.summary, { max: 180, field: 'Summary', required: true });
    const details = multiline(body.details, { max: 4000, field: 'Details' });
    const rules = multiline(body.rules, { max: 2000, field: 'Rules' });
    const exists = await q1('SELECT id FROM categories WHERE id=$1', [id]);
    if (exists) throw new ValidationError('A category with that link already exists.', { id: 'taken' });
    const { rows } = await query('SELECT coalesce(max(sort_order),0)+1 AS next FROM categories');
    await query(
      `INSERT INTO categories (id, name, symbol, summary, details, rules, accent, image_url, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, name, symbol, summary, details, rules, str(body.accent, { max: 20, field: 'Accent' }), vUrl(body.imageUrl), rows[0].next, body.isActive === false ? false : true],
    );
    await audit('admin', req.admin.id, 'category.create', { id });
    res.status(201).json({ ok: true, categories: await categoryRows({ activeOnly: false }) });
  }),
);

adminRouter.patch(
  '/admin/categories/:id',
  wrap(async (req, res) => {
    const existing = await q1('SELECT * FROM categories WHERE id=$1', [req.params.id]);
    if (!existing) fail(404, 'Category not found.');
    const body = req.body || {};
    await query(
      `UPDATE categories SET name=$1, symbol=$2, summary=$3, details=$4, rules=$5, accent=$6,
              image_url=$7, is_active=$8, sort_order=$9 WHERE id=$10`,
      [
        str(body.name ?? existing.name, { min: 2, max: 60, field: 'Name', required: true }),
        str(body.symbol ?? existing.symbol, { max: 4, field: 'Symbol' }) || '◇',
        str(body.summary ?? existing.summary, { max: 180, field: 'Summary' }),
        multiline(body.details ?? existing.details, { max: 4000, field: 'Details' }),
        multiline(body.rules ?? existing.rules, { max: 2000, field: 'Rules' }),
        str(body.accent ?? existing.accent, { max: 20, field: 'Accent' }),
        vUrl(body.imageUrl ?? existing.image_url),
        body.isActive === undefined ? existing.is_active : bool(body.isActive),
        int(body.sortOrder ?? existing.sort_order, { min: 0, max: 999, field: 'Order' }),
        existing.id,
      ],
    );
    await audit('admin', req.admin.id, 'category.update', { id: existing.id });
    res.json({ ok: true, categories: await categoryRows({ activeOnly: false }) });
  }),
);

adminRouter.delete(
  '/admin/categories/:id',
  wrap(async (req, res) => {
    const used = await q1(
      `SELECT (SELECT count(*)::int FROM students WHERE category_id=$1) AS students,
              (SELECT count(*)::int FROM teams WHERE category_id=$1) AS teams`,
      [req.params.id],
    );
    if (used.students || used.teams) {
      fail(409, 'This field has registrations. Deactivate it instead of deleting it.', { code: 'in_use' });
    }
    await query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    await audit('admin', req.admin.id, 'category.delete', { id: req.params.id });
    res.json({ ok: true, categories: await categoryRows({ activeOnly: false }) });
  }),
);

adminRouter.get('/admin/articles', wrap(async (req, res) => {
  res.json({ ok: true, articles: await articleRows({ publishedOnly: false }), faqs: await faqRows({ activeOnly: false }) });
}));

adminRouter.post(
  '/admin/articles',
  wrap(async (req, res) => {
    const body = req.body || {};
    const title = str(body.title, { min: 3, max: 140, field: 'Title', required: true });
    const id = uuid();
    let slugValue = vSlug(body.slug || title);
    const clash = await q1('SELECT id FROM articles WHERE slug=$1', [slugValue]);
    if (clash) slugValue = `${slugValue}-${id.slice(0, 4)}`;
    const { rows } = await query('SELECT coalesce(max(sort_order),0)+1 AS next FROM articles');
    await query(
      `INSERT INTO articles (id, title, slug, label, excerpt, body, image_url, read_minutes, is_published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        title,
        slugValue,
        str(body.label || 'Journal', { max: 40, field: 'Label' }),
        str(body.excerpt, { max: 260, field: 'Excerpt' }),
        multiline(body.body, { max: 20000, field: 'Body' }),
        vUrl(body.imageUrl),
        int(body.readMinutes ?? 4, { min: 1, max: 60, field: 'Read time' }),
        body.isPublished === false ? false : true,
        rows[0].next,
      ],
    );
    await audit('admin', req.admin.id, 'article.create', { id });
    res.status(201).json({ ok: true, articles: await articleRows({ publishedOnly: false }) });
  }),
);

adminRouter.patch(
  '/admin/articles/:id',
  wrap(async (req, res) => {
    const existing = await q1('SELECT * FROM articles WHERE id=$1', [req.params.id]);
    if (!existing) fail(404, 'Article not found.');
    const body = req.body || {};
    await query(
      `UPDATE articles SET title=$1, label=$2, excerpt=$3, body=$4, image_url=$5,
              read_minutes=$6, is_published=$7, sort_order=$8, updated_at=now() WHERE id=$9`,
      [
        str(body.title ?? existing.title, { min: 3, max: 140, field: 'Title', required: true }),
        str(body.label ?? existing.label, { max: 40, field: 'Label' }),
        str(body.excerpt ?? existing.excerpt, { max: 260, field: 'Excerpt' }),
        multiline(body.body ?? existing.body, { max: 20000, field: 'Body' }),
        vUrl(body.imageUrl ?? existing.image_url),
        int(body.readMinutes ?? existing.read_minutes, { min: 1, max: 60, field: 'Read time' }),
        body.isPublished === undefined ? existing.is_published : bool(body.isPublished),
        int(body.sortOrder ?? existing.sort_order, { min: 0, max: 9999, field: 'Order' }),
        existing.id,
      ],
    );
    await audit('admin', req.admin.id, 'article.update', { id: existing.id });
    res.json({ ok: true, articles: await articleRows({ publishedOnly: false }) });
  }),
);

adminRouter.delete(
  '/admin/articles/:id',
  wrap(async (req, res) => {
    await query('DELETE FROM articles WHERE id=$1', [req.params.id]);
    res.json({ ok: true, articles: await articleRows({ publishedOnly: false }) });
  }),
);

adminRouter.post(
  '/admin/faqs',
  wrap(async (req, res) => {
    const question = str(req.body?.question, { min: 4, max: 200, field: 'Question', required: true });
    const answer = multiline(req.body?.answer, { max: 2000, field: 'Answer' });
    if (!answer) throw new ValidationError('Answer is required.', { answer: 'required' });
    const { rows } = await query('SELECT coalesce(max(sort_order),0)+1 AS next FROM faqs');
    await query('INSERT INTO faqs (id, question, answer, sort_order) VALUES ($1,$2,$3,$4)', [uuid(), question, answer, rows[0].next]);
    res.status(201).json({ ok: true, faqs: await faqRows({ activeOnly: false }) });
  }),
);

adminRouter.patch(
  '/admin/faqs/:id',
  wrap(async (req, res) => {
    const existing = await q1('SELECT * FROM faqs WHERE id=$1', [req.params.id]);
    if (!existing) fail(404, 'Question not found.');
    await query('UPDATE faqs SET question=$1, answer=$2, is_active=$3, sort_order=$4 WHERE id=$5', [
      str(req.body?.question ?? existing.question, { min: 4, max: 200, field: 'Question', required: true }),
      multiline(req.body?.answer ?? existing.answer, { max: 2000, field: 'Answer' }),
      req.body?.isActive === undefined ? existing.is_active : bool(req.body.isActive),
      int(req.body?.sortOrder ?? existing.sort_order, { min: 0, max: 999, field: 'Order' }),
      existing.id,
    ]);
    res.json({ ok: true, faqs: await faqRows({ activeOnly: false }) });
  }),
);

adminRouter.delete('/admin/faqs/:id', wrap(async (req, res) => {
  await query('DELETE FROM faqs WHERE id=$1', [req.params.id]);
  res.json({ ok: true, faqs: await faqRows({ activeOnly: false }) });
}));

/* ------------------------------------------------------------------ */
/* Settings: site, event, registration, contact, socials, footer       */
/* ------------------------------------------------------------------ */

adminRouter.get('/admin/settings', wrap(async (req, res) => {
  res.json({ ok: true, settings: await getSettings(), defaults: DEFAULT_SETTINGS });
}));

adminRouter.put(
  '/admin/settings/:section',
  wrap(async (req, res) => {
    const section = oneOf(req.params.section, Object.keys(DEFAULT_SETTINGS), 'section');
    const body = req.body || {};
    const current = (await getSettings())[section] || {};
    let value;

    if (section === 'site') {
      value = {
        ...current,
        name: str(body.name, { min: 1, max: 40, field: 'Site name', required: true }),
        fullName: str(body.fullName, { min: 2, max: 80, field: 'Full name', required: true }),
        tagline: str(body.tagline, { max: 160, field: 'Tagline' }),
        description: multiline(body.description, { max: 600, field: 'Description' }),
        metaDescription: multiline(body.metaDescription, { max: 300, field: 'Meta description' }),
        logoMark: str(body.logoMark || 'O', { max: 3, field: 'Logo mark' }),
        logoUrl: vUrl(body.logoUrl),
        faviconUrl: vUrl(body.faviconUrl),
        footerNote: str(body.footerNote, { max: 200, field: 'Footer note' }),
      };
    } else if (section === 'event') {
      const stats = Array.isArray(body.stats)
        ? body.stats.slice(0, 4).map((s) => ({
            value: str(s?.value, { max: 12, field: 'Stat value' }),
            label: str(s?.label, { max: 40, field: 'Stat label' }),
          }))
        : current.stats;
      value = {
        ...current,
        headline: str(body.headline, { min: 4, max: 120, field: 'Headline', required: true }),
        kicker: str(body.kicker, { max: 60, field: 'Kicker' }),
        intro: multiline(body.intro, { max: 900, field: 'Intro' }),
        dateLabel: str(body.dateLabel, { max: 80, field: 'Date label' }),
        dateISO: /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO || '') ? body.dateISO : '',
        doorsLabel: str(body.doorsLabel, { max: 120, field: 'Schedule' }),
        venue: str(body.venue, { max: 120, field: 'Venue' }),
        city: str(body.city, { max: 80, field: 'City' }),
        address: str(body.address, { max: 200, field: 'Address' }),
        mapUrl: vUrl(body.mapUrl),
        heroImageUrl: vUrl(body.heroImageUrl),
        aboutTitle: str(body.aboutTitle, { max: 140, field: 'About title' }),
        aboutBody: multiline(body.aboutBody, { max: 4000, field: 'About body' }),
        stats,
      };
    } else if (section === 'registration') {
      const sizes = Array.isArray(body.allowedSizes)
        ? body.allowedSizes.map((n) => int(n, { min: 2, max: 8, field: 'Team size' })).slice(0, 7)
        : current.allowedSizes;
      const unique = [...new Set(sizes)].sort((a, b) => a - b);
      value = {
        ...current,
        open: bool(body.open),
        allowTeamCreation: body.allowTeamCreation === undefined ? current.allowTeamCreation !== false : bool(body.allowTeamCreation),
        closedTitle: str(body.closedTitle, { max: 120, field: 'Closed title' }),
        closedMessage: multiline(body.closedMessage, { max: 600, field: 'Closed message' }),
        deadlineLabel: str(body.deadlineLabel, { max: 120, field: 'Deadline label' }),
        maxMembers: int(body.maxMembers, { min: 2, max: 8, field: 'Default team size' }),
        minMembers: int(body.minMembers, { min: 2, max: 8, field: 'Minimum team size' }),
        allowedSizes: unique.length ? unique : [2, 3, 4, 5, 6],
        requireSchoolMatch: bool(body.requireSchoolMatch),
        categoryChangeMode: oneOf(body.categoryChangeMode || 'request', ['request', 'open', 'locked'], 'category change mode'),
      };
      if (value.minMembers > value.maxMembers) {
        throw new ValidationError('Minimum team size cannot exceed the default size.', { minMembers: 'invalid' });
      }
    } else if (section === 'contact') {
      value = {
        ...current,
        email: body.email ? vEmail(body.email) : '',
        phone: vPhone(body.phone),
        whatsapp: vPhone(body.whatsapp),
        organizerName: str(body.organizerName, { max: 80, field: 'Organiser name' }),
        organizerRole: str(body.organizerRole, { max: 80, field: 'Organiser role' }),
        organiserBody: multiline(body.organiserBody, { max: 600, field: 'Contact blurb' }),
        address: str(body.address, { max: 200, field: 'Address' }),
        hours: str(body.hours, { max: 80, field: 'Hours' }),
      };
    } else if (section === 'socials') {
      const list = Array.isArray(body.socials) ? body.socials.slice(0, 10) : [];
      value = list.map((s) => ({
        platform: oneOf(String(s?.platform || '').toLowerCase(), ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin', 'x', 'whatsapp'], 'platform'),
        label: str(s?.label, { max: 40, field: 'Label' }),
        handle: str(s?.handle, { max: 60, field: 'Handle' }),
        url: vUrl(s?.url),
        enabled: bool(s?.enabled) && Boolean(String(s?.url || '').trim()),
      }));
    } else if (section === 'footer') {
      value = {
        ...current,
        credit: str(body.credit, { max: 120, field: 'Credit' }),
        copyright: str(body.copyright, { max: 120, field: 'Copyright' }),
      };
    } else {
      value = body;
    }

    await putSection(section, value);
    await audit('admin', req.admin.id, `settings.${section}`);
    res.json({ ok: true, settings: await getSettings() });
  }),
);

/* ------------------------------------------------------------------ */
/* Branding uploads (stored in the database, served from /api/assets)  */
/* ------------------------------------------------------------------ */

adminRouter.post(
  '/admin/assets',
  wrap(async (req, res) => {
    const dataUrl = String(req.body?.dataUrl || '');
    const match = /^data:(image\/(png|jpeg|webp|svg\+xml|x-icon));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match) throw new ValidationError('Upload a PNG, JPEG, WebP or SVG image.', { file: 'invalid' });
    const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
    if (buffer.length > 1.5 * 1024 * 1024) throw new ValidationError('Image must be smaller than 1.5 MB.', { file: 'too_large' });
    const id = uuid();
    await query('INSERT INTO assets (id, mime, size, data) VALUES ($1,$2,$3,$4)', [id, match[1], buffer.length, buffer]);
    res.status(201).json({ ok: true, url: `/api/assets/${id}` });
  }),
);

/* ------------------------------------------------------------------ */
/* Account & exports                                                   */
/* ------------------------------------------------------------------ */

adminRouter.post(
  '/admin/password',
  wrap(async (req, res) => {
    const row = await q1('SELECT password_hash FROM admin_users WHERE id=$1', [req.admin.id]);
    if (!(await verifyPassword(String(req.body?.currentPassword || ''), row.password_hash))) {
      throw new ValidationError('Current password is incorrect.', { currentPassword: 'incorrect' });
    }
    const next = vPassword(req.body?.newPassword);
    await query('UPDATE admin_users SET password_hash=$1 WHERE id=$2', [await hashPassword(next), req.admin.id]);
    await query("DELETE FROM sessions WHERE admin_id=$1 AND kind='admin'", [req.admin.id]);
    await audit('admin', req.admin.id, 'admin.password');
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/admin/export/registrations.csv',
  wrap(async (req, res) => {
    const students = (await query(
      `SELECT s.name, s.email, s.phone, s.class_name, s.school, c.name AS category_name,
              t.name AS team_name, s.role, s.status, s.project_title, s.created_at
       FROM students s LEFT JOIN categories c ON c.id=s.category_id LEFT JOIN teams t ON t.id=s.team_id
       ORDER BY s.created_at`,
    )).rows;
    const header = ['Name', 'Email', 'Phone', 'Class', 'School', 'Category', 'Team', 'Role', 'Status', 'Project', 'Registered'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...students.map((s) => [
      s.name, s.email, s.phone, s.class_name, s.school, s.category_name, s.team_name, s.role, s.status,
      s.project_title, new Date(s.created_at).toISOString(),
    ])].map((row) => row.map(escape).join(',')).join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="orbit-registrations-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\ufeff${csv}`);
  }),
);

adminRouter.get(
  '/admin/export/teams.csv',
  wrap(async (req, res) => {
    const teams = (await query(
      `SELECT t.name, t.school, c.name AS category, t.max_members,
              (SELECT count(*)::int FROM students s WHERE s.team_id=t.id AND s.status<>'withdrawn') AS member_count,
              (SELECT name FROM students WHERE id=t.leader_id) AS leader,
              (SELECT string_agg(name, ' / ' ORDER BY created_at) FROM students WHERE team_id=t.id AND status<>'withdrawn') AS members
       FROM teams t LEFT JOIN categories c ON c.id=t.category_id ORDER BY t.name`,
    )).rows;
    const header = ['Team', 'School', 'Category', 'Members', 'Capacity', 'Leader', 'Member names'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [header, ...teams.map((t) => [t.name, t.school, t.category, t.member_count, t.max_members, t.leader, t.members])]
      .map((row) => row.map(escape).join(',')).join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="orbit-teams-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\ufeff${csv}`);
  }),
);

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

adminRouter.get(
  '/admin/announcements',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT id, title, body, level, link_label AS "linkLabel", link_url AS "linkUrl",
              is_active AS "isActive", starts_at AS "startsAt", ends_at AS "endsAt", created_at AS "createdAt"
       FROM announcements ORDER BY created_at DESC`,
    );
    res.json({ ok: true, announcements: rows });
  }),
);

adminRouter.post(
  '/admin/announcements',
  wrap(async (req, res) => {
    const body = req.body || {};
    const title = str(body.title, { min: 3, max: 120, field: 'Title', required: true });
    const text = multiline(body.body, { max: 800, field: 'Message' });
    const level = oneOf(body.level || 'info', ['info', 'important', 'success'], 'level');
    await query(
      `INSERT INTO announcements (id, title, body, level, link_label, link_url, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuid(), title, text, level, str(body.linkLabel, { max: 40, field: 'Link label' }), vUrl(body.linkUrl), body.isActive !== false],
    );
    await audit('admin', req.admin.id, 'announcement.create');
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/admin/announcements/:id',
  wrap(async (req, res) => {
    const existing = await q1('SELECT * FROM announcements WHERE id=$1', [req.params.id]);
    if (!existing) fail(404, 'Announcement not found.');
    const body = req.body || {};
    await query(
      `UPDATE announcements SET title=$1, body=$2, level=$3, link_label=$4, link_url=$5, is_active=$6 WHERE id=$7`,
      [
        str(body.title ?? existing.title, { min: 3, max: 120, field: 'Title', required: true }),
        multiline(body.body ?? existing.body, { max: 800, field: 'Message' }),
        oneOf(body.level ?? existing.level, ['info', 'important', 'success'], 'level'),
        str(body.linkLabel ?? existing.link_label, { max: 40, field: 'Link label' }),
        vUrl(body.linkUrl ?? existing.link_url),
        body.isActive === undefined ? existing.is_active : body.isActive === true || body.isActive === 'true',
        existing.id,
      ],
    );
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/admin/announcements/:id',
  wrap(async (req, res) => {
    await query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  }),
);

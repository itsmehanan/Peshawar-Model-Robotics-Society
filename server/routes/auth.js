/**
 * Accounts: registration, sign-in, sign-out, current session.
 *
 * The old prototype lost registrations because everything lived in
 * localStorage and because team joining validated only after mutating state.
 * Here every registration is one transaction: the team row is locked, all
 * rules are checked, and either every write lands or none do.
 */
import { Router } from 'express';
import { transaction, query, q1 } from '../db.js';
import { getSettings } from '../settings.js';
import { hashPassword, verifyPassword, newToken, uuid, throttle, clearThrottle } from '../security.js';
import { ValidationError, email as vEmail, password as vPassword, phone as vPhone, str, oneOf, int, bool } from '../validation.js';
import {
  readCookie,
  headerToken,
  COOKIES,
  wrap,
  fail,
  currentStudent,
  currentAdmin,
  createSession,
  destroySession,
  audit,
  requireStudent,
  requireAdmin,
  HttpError,
} from '../http.js';
import { loadStudent } from '../serializers.js';

export const authRouter = Router();

const PUBLIC_TEAM_FIELDS = `t.id, t.name, t.school, t.category_id AS "categoryId", t.max_members AS "maxMembers"`;

async function teamWithMembers(tx, teamId) {
  const { rows } = await tx.query(
    `SELECT ${PUBLIC_TEAM_FIELDS}, t.leader_id AS "leaderId",
            (SELECT count(*)::int FROM students WHERE team_id = t.id AND status <> 'withdrawn') AS "memberCount"
     FROM teams t WHERE t.id = $1`,
    [teamId],
  );
  return rows[0] || null;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

authRouter.post(
  '/register',
  wrap(async (req, res) => {
    const settings = await getSettings();
    const registration = settings.registration || {};
    if (!registration.open) fail(403, registration.closedMessage || 'Registration is currently closed.', { code: 'closed' });

    const body = req.body || {};
    const name = str(body.name, { min: 2, max: 90, field: 'Full name', required: true });
    const className = str(body.className, { min: 1, max: 40, field: 'Class', required: true });
    const school = str(body.school, { min: 2, max: 120, field: 'School', required: true });
    const emailValue = vEmail(body.email);
    const phoneValue = vPhone(body.phone);
    const passwordValue = vPassword(body.password);
    const categoryId = str(body.categoryId, { field: 'Category', required: true });
    const teamMode = oneOf(body.teamMode || 'create', ['create', 'join', 'none'], 'team option');

    const category = await q1('SELECT id, name FROM categories WHERE id = $1 AND is_active', [categoryId]);
    if (!category) throw new ValidationError('Choose an active exhibition category.', { categoryId: 'invalid' });

    const passwordHash = await hashPassword(passwordValue);

    const result = await transaction(async (tx) => {
      const existing = await tx.query('SELECT id FROM students WHERE lower(email) = $1', [emailValue]);
      if (existing.rows.length) {
        throw new HttpError(409, 'An account already exists for this email. Sign in instead.', {
          code: 'email_taken',
          fields: { email: 'taken' },
        });
      }

      const studentId = uuid();
      let teamId = null;
      let role = 'solo';

      if (teamMode === 'create') {
        const teamName = str(body.teamName, { min: 2, max: 60, field: 'Team name', required: true });
        const passcode = str(body.teamCode, { min: 6, max: 40, field: 'Team passcode', required: true });
        const maxMembers = int(body.maxMembers ?? registration.maxMembers ?? 4, {
          min: 2,
          max: 8,
          field: 'Team size',
        });
        if (maxMembers < (registration.minMembers ?? 2)) {
          throw new ValidationError(`Teams must allow at least ${registration.minMembers} members.`, { maxMembers: 'too_small' });
        }
        if (Array.isArray(registration.allowedSizes) && !registration.allowedSizes.includes(maxMembers)) {
          throw new ValidationError('Choose one of the allowed team sizes.', { maxMembers: 'invalid' });
        }

        const clash = await tx.query('SELECT id FROM teams WHERE lower(school) = lower($1) AND lower(name) = lower($2)', [
          school,
          teamName,
        ]);
        if (clash.rows.length) {
          throw new HttpError(409, 'A team with this name already exists at your school.', {
            code: 'team_name_taken',
            fields: { teamName: 'taken' },
          });
        }

        teamId = uuid();
        await tx.query(
          `INSERT INTO teams (id, name, school, category_id, max_members, passcode_hash, leader_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [teamId, teamName, school, categoryId, maxMembers, await hashPassword(passcode), studentId],
        );
        role = 'leader';
      } else if (teamMode === 'join') {
        const joinTeamId = str(body.joinTeamId, { field: 'Team', required: true });
        const joinCode = str(body.joinCode, { field: 'Team passcode', required: true });

        const { rows } = await tx.query(
          `SELECT t.id, t.name, t.school, t.category_id, t.max_members, t.passcode_hash,
                  (SELECT count(*)::int FROM students s WHERE s.team_id = t.id AND s.status <> 'withdrawn') AS member_count
           FROM teams t WHERE t.id = $1 FOR UPDATE`,
          [joinTeamId],
        );
        const team = rows[0];
        if (!team) throw new ValidationError('That team no longer exists.', { joinTeamId: 'missing' });
        if (registration.requireSchoolMatch !== false && team.school.toLowerCase() !== school.toLowerCase()) {
          throw new ValidationError('You can only join a team from your own school.', { joinTeamId: 'school_mismatch' });
        }
        if (team.category_id !== categoryId) {
          throw new ValidationError('Choose the same category as the team you are joining.', { categoryId: 'team_mismatch' });
        }
        if (team.member_count >= team.max_members) {
          throw new HttpError(409, 'This team is already full.', { code: 'team_full', fields: { joinTeamId: 'full' } });
        }
        if (!(await verifyPassword(joinCode, team.passcode_hash))) {
          throw new HttpError(403, 'That team passcode is incorrect.', {
            code: 'bad_passcode',
            fields: { joinCode: 'incorrect' },
          });
        }
        teamId = team.id;
        role = 'member';
      }

      await tx.query(
        `INSERT INTO students (id, email, password_hash, name, class_name, school, phone, category_id, team_id, role, project_title)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          studentId,
          emailValue,
          passwordHash,
          name,
          className,
          school,
          phoneValue,
          categoryId,
          teamId,
          role,
          str(body.projectTitle, { max: 120, field: 'Project title' }),
        ],
      );

      return { studentId, teamId };
    });

    const token = newToken();
    await createSession(res, {
      kind: 'student',
      studentId: result.studentId,
      token,
      days: Number(process.env.SESSION_DAYS || 30),
      userAgent: req.headers['user-agent'],
    });
    await audit('student', result.studentId, 'register', { categoryId, teamMode, teamId: result.teamId });

    res.status(201).json({
      ok: true,
      student: await loadStudent(result.studentId),
      admin: null,
      sessionToken: token,
    });
  }),
);

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const key = `student:${req.ip}`;
    const gate = throttle(key, 10, 10 * 60 * 1000);
    if (!gate.allowed) fail(429, `Too many attempts. Try again in ${gate.retryAfter} seconds.`, { code: 'throttled' });

    const emailValue = vEmail(req.body?.email);
    const passwordValue = String(req.body?.password || '');
    if (!passwordValue) throw new ValidationError('Enter your password.', { password: 'required' });

    const student = await q1('SELECT id, password_hash FROM students WHERE lower(email) = $1', [emailValue]);
    const valid = student ? await verifyPassword(passwordValue, student.password_hash) : false;
    if (!valid) fail(401, 'Email or password is incorrect.', { code: 'bad_credentials' });
    clearThrottle(key);

    const token = newToken();
    await createSession(res, {
      kind: 'student',
      studentId: student.id,
      token,
      days: Number(process.env.SESSION_DAYS || 30),
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true, student: await loadStudent(student.id), admin: null, sessionToken: token });
  }),
);

authRouter.post(
  '/logout',
  wrap(async (req, res) => {
    await destroySession(req, res, 'student');
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/admin/login',
  wrap(async (req, res) => {
    const key = `admin:${req.ip}`;
    const gate = throttle(key, 5, 15 * 60 * 1000);
    if (!gate.allowed) fail(429, `Too many attempts. Try again in ${gate.retryAfter} seconds.`, { code: 'throttled' });

    const emailValue = vEmail(req.body?.email);
    const passwordValue = String(req.body?.password || '');
    const admin = await q1('SELECT id, password_hash FROM admin_users WHERE lower(email) = $1', [emailValue]);
    const valid = admin ? await verifyPassword(passwordValue, admin.password_hash) : false;
    if (!valid) fail(401, 'Email or password is incorrect.', { code: 'bad_credentials' });
    clearThrottle(key);

    await query('UPDATE admin_users SET last_login_at = now() WHERE id = $1', [admin.id]);
    const token = newToken();
    await createSession(res, {
      kind: 'admin',
      adminId: admin.id,
      token,
      days: 7,
      userAgent: req.headers['user-agent'],
    });
    await audit('admin', admin.id, 'sign_in');
    // Read the row back rather than re-resolving the session: the cookie is only
    // present on the *next* request.
    const profile = await q1('SELECT id, email, name FROM admin_users WHERE id = $1', [admin.id]);
    res.json({ ok: true, admin: profile, student: null, sessionToken: token, sessionDays: 7 });
  }),
);

authRouter.post(
  '/admin/logout',
  wrap(async (req, res) => {
    await destroySession(req, res, 'admin');
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  wrap(async (req, res) => {
    // Session state must never be served from a cache — a stale copy here is
    // what makes a signed-in admin bounce back to the login screen.
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('Vary', 'Cookie');
    const [student, admin] = await Promise.all([currentStudent(req), currentAdmin(req)]);
    const settings = await getSettings();
    res.json({
      ok: true,
      student: student ? await loadStudent(student.id) : null,
      admin: admin || null,
      registration: settings.registration || {},
    });
  }),
);

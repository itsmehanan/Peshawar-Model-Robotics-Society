/**
 * The signed-in student's own data: profile, team, category changes, password.
 *
 * Every mutation re-reads the row inside the transaction and re-checks the
 * rules that the action depends on, so two students acting at once (joining the
 * last seat, changing a team's category) cannot leave inconsistent data.
 */
import { Router } from 'express';
import { transaction, query, q1 } from '../db.js';
import { getSettings } from '../settings.js';
import { hashPassword, verifyPassword, uuid, newToken, hashToken } from '../security.js';
import { ValidationError, str, phone as vPhone, email as vEmail, password as vPassword, int, oneOf } from '../validation.js';
import { wrap, fail, currentStudent, requireStudent, audit, HttpError, readCookie, COOKIES } from '../http.js';
import { loadStudent, loadTeam } from '../serializers.js';

export const studentRouter = Router();

const asStudent = wrap(async (req, res, next) => {
  const student = await currentStudent(req);
  if (!student) fail(401, 'Please sign in to continue.', { code: 'unauthenticated' });
  req.student = student;
  next();
});

studentRouter.use('/student', asStudent);

/* ---------------------------------------------------------------- */
/* Profile                                                           */
/* ---------------------------------------------------------------- */

studentRouter.patch(
  '/student/profile',
  wrap(async (req, res) => {
    const body = req.body || {};
    const name = str(body.name, { min: 2, max: 90, field: 'Full name', required: true });
    const className = str(body.className, { min: 1, max: 40, field: 'Class', required: true });
    const school = str(body.school, { min: 2, max: 120, field: 'School', required: true });
    const phone = vPhone(body.phone);
    const projectTitle = str(body.projectTitle, { max: 120, field: 'Project title' });
    const emailValue = vEmail(body.email);

    await transaction(async (tx) => {
      const current = (await tx.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [req.student.id])).rows[0];
      if (!current) fail(401, 'Your account no longer exists.');

      if (emailValue !== current.email) {
        const taken = await tx.query('SELECT id FROM students WHERE lower(email) = $1 AND id <> $2', [emailValue, current.id]);
        if (taken.rows.length) {
          throw new HttpError(409, 'That email is already used by another account.', {
            code: 'email_taken',
            fields: { email: 'taken' },
          });
        }
      }

      const { rows: teamRows } = await tx.query('SELECT * FROM teams WHERE id = $1', [current.team_id]);
      const team = teamRows[0];
      if (team && team.school.toLowerCase() !== school.toLowerCase()) {
        // A team is a school team; changing school while on one would silently
        // create a mixed-school team, so this is refused with a clear reason.
        throw new ValidationError(
          'You are on a team at your current school. Leave the team before changing your school.',
          { school: 'locked_by_team' },
        );
      }
      if (team) {
        const clash = await tx.query('SELECT id FROM teams WHERE lower(school) = lower($1) AND id <> $2', [school, team.id]);
        if (clash.rows.length) throw new ValidationError('School update conflicts with your team.', { school: 'conflict' });
      }

      await tx.query(
        `UPDATE students SET name=$1, class_name=$2, school=$3, phone=$4, project_title=$5, email=$6, updated_at=now()
         WHERE id=$7`,
        [name, className, school, phone, projectTitle, emailValue, current.id],
      );

      // Keep the denormalised school on the team in sync when a leader is the
      // only member involved; members cannot disagree because of the check above.
      if (team) {
        await tx.query('UPDATE teams SET school=$1, updated_at=now() WHERE id=$2', [school, team.id]);
      }
    });

    await audit('student', req.student.id, 'profile.update');
    res.json({ ok: true, student: await loadStudent(req.student.id) });
  }),
);

studentRouter.post(
  '/student/password',
  wrap(async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = vPassword(req.body?.newPassword);
    const row = await q1('SELECT password_hash FROM students WHERE id = $1', [req.student.id]);
    if (!(await verifyPassword(currentPassword, row.password_hash))) {
      throw new ValidationError('Your current password is incorrect.', { currentPassword: 'incorrect' });
    }
    await query('UPDATE students SET password_hash=$1, updated_at=now() WHERE id=$2', [
      await hashPassword(newPassword),
      req.student.id,
    ]);
    // Invalidate every other session: a password change should sign out devices.
    const keep = hashToken(readCookie(req, COOKIES.student) || '');
    await query("DELETE FROM sessions WHERE student_id=$1 AND kind='student' AND token_hash <> $2", [
      req.student.id,
      keep,
    ]);
    await audit('student', req.student.id, 'password.change');
    res.json({ ok: true });
  }),
);

/* ---------------------------------------------------------------- */
/* Category changes                                                  */
/* ---------------------------------------------------------------- */

studentRouter.post(
  '/student/category',
  wrap(async (req, res) => {
    const settings = await getSettings();
    const registration = settings.registration || {};
    const categoryId = str(req.body?.categoryId, { field: 'Category', required: true });
    const reason = str(req.body?.reason, { max: 500, field: 'Reason' });

    const category = await q1('SELECT id FROM categories WHERE id=$1 AND is_active', [categoryId]);
    if (!category) throw new ValidationError('Choose an active category.', { categoryId: 'invalid' });

    const message = await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      if (student.category_id === categoryId) throw new ValidationError('That is already your category.', { categoryId: 'same' });

      const team =
        (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0] || null;

      if (!team) {
        // Solo students change instantly; nothing else references their field.
        await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE id=$2', [categoryId, student.id]);
        return 'Your field has been updated.';
      }

      if (registration.categoryChangeMode === 'open' && student.role === 'leader') {
        await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE id=$2', [categoryId, student.id]);
        await tx.query('UPDATE teams SET category_id=$1, updated_at=now() WHERE id=$2', [categoryId, team.id]);
        await tx.query('UPDATE students SET category_id=$1, updated_at=now() WHERE team_id=$2', [categoryId, team.id]);
        return 'Your team’s field has been updated for every member.';
      }

      const pending = await tx.query(
        "SELECT id FROM category_requests WHERE student_id=$1 AND status='pending'",
        [student.id],
      );
      if (pending.rows.length) throw new HttpError(409, 'You already have a pending category request.', { code: 'pending_exists' });

      await tx.query(
        `INSERT INTO category_requests (id, student_id, from_category, to_category, reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [uuid(), student.id, student.category_id, categoryId, reason],
      );
      return student.role === 'leader'
        ? 'Request sent. Approving it will move your whole team to the new field.'
        : 'Request sent to the organisers. Your team leader is notified in the team view.';
    });

    await audit('student', req.student.id, 'category.request', { categoryId });
    res.json({ ok: true, message, student: await loadStudent(req.student.id) });
  }),
);

studentRouter.delete(
  '/student/category-request/:id',
  wrap(async (req, res) => {
    const result = await query(
      "DELETE FROM category_requests WHERE id=$1 AND student_id=$2 AND status='pending'",
      [req.params.id, req.student.id],
    );
    if (!result.rowCount) fail(404, 'That request no longer exists.');
    res.json({ ok: true, student: await loadStudent(req.student.id) });
  }),
);

/* ---------------------------------------------------------------- */
/* Team                                                              */
/* ---------------------------------------------------------------- */

studentRouter.post(
  '/student/team',
  wrap(async (req, res) => {
    const settings = await getSettings();
    const registration = settings.registration || {};
    const mode = oneOf(req.body?.mode, ['create', 'join'], 'action');

    const message = await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      if (student.team_id) throw new HttpError(409, 'You are already on a team. Leave it first.', { code: 'already_on_team' });

      if (mode === 'create') {
        if (registration.allowTeamCreation === false) fail(403, 'Team creation is currently closed.');
        const teamName = str(req.body.teamName, { min: 2, max: 60, field: 'Team name', required: true });
        const passcode = str(req.body.teamCode, { min: 6, max: 40, field: 'Team passcode', required: true });
        const maxMembers = int(req.body.maxMembers ?? registration.maxMembers ?? 4, { min: 2, max: 8, field: 'Team size' });

        const clash = await tx.query('SELECT id FROM teams WHERE lower(school)=lower($1) AND lower(name)=lower($2)', [
          student.school,
          teamName,
        ]);
        if (clash.rows.length) throw new HttpError(409, 'A team with that name already exists at your school.', { code: 'team_name_taken', fields: { teamName: 'taken' } });

        const teamId = uuid();
        await tx.query(
          `INSERT INTO teams (id, name, school, category_id, max_members, passcode_hash, leader_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [teamId, teamName, student.school, student.category_id, maxMembers, await hashPassword(passcode), student.id],
        );
        await tx.query("UPDATE students SET team_id=$1, role='leader', updated_at=now() WHERE id=$2", [teamId, student.id]);
        return `Team “${teamName}” is live. Share the passcode with your teammates.`;
      }

      const joinTeamId = str(req.body.teamId, { field: 'Team', required: true });
      const joinCode = str(req.body.joinCode, { field: 'Team passcode', required: true });
      const { rows } = await tx.query(
        `SELECT t.*, (SELECT count(*)::int FROM students s WHERE s.team_id=t.id AND s.status<>'withdrawn') AS member_count
         FROM teams t WHERE t.id=$1 FOR UPDATE`,
        [joinTeamId],
      );
      const team = rows[0];
      if (!team) throw new ValidationError('That team no longer exists.', { teamId: 'missing' });
      if (registration.requireSchoolMatch !== false && team.school.toLowerCase() !== student.school.toLowerCase()) {
        throw new ValidationError('You can only join a team from your own school.', { teamId: 'school_mismatch' });
      }
      if (team.category_id !== student.category_id) {
        throw new ValidationError('Change your field to match the team before joining.', { teamId: 'category_mismatch' });
      }
      if (team.member_count >= team.max_members) throw new HttpError(409, 'That team is full.', { code: 'team_full' });
      if (!(await verifyPassword(joinCode, team.passcode_hash))) {
        throw new HttpError(403, 'That team passcode is incorrect.', { code: 'bad_passcode', fields: { joinCode: 'incorrect' } });
      }
      await tx.query("UPDATE students SET team_id=$1, role='member', updated_at=now() WHERE id=$2", [team.id, student.id]);
      return `You joined “${team.name}”.`;
    });

    await audit('student', req.student.id, 'team.join', { mode });
    res.json({ ok: true, message, student: await loadStudent(req.student.id) });
  }),
);

studentRouter.patch(
  '/student/team',
  wrap(async (req, res) => {
    const settings = await getSettings();
    const message = await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      if (!student.team_id) fail(404, 'You are not on a team.');
      const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0];
      if (!team) fail(404, 'Your team no longer exists.');
      if (team.leader_id !== student.id) fail(403, 'Only the team leader can edit team details.');

      const name = str(req.body?.name ?? team.name, { min: 2, max: 60, field: 'Team name', required: true });
      const maxMembers = int(req.body?.maxMembers ?? team.max_members, { min: 2, max: 8, field: 'Team size' });
      const passcode = String(req.body?.passcode || '').trim();

      const { rows: countRows } = await tx.query(
        "SELECT count(*)::int AS n FROM students WHERE team_id=$1 AND status<>'withdrawn'",
        [team.id],
      );
      const memberCount = countRows[0].n;
      if (maxMembers < memberCount) {
        throw new ValidationError(`You already have ${memberCount} members — remove someone before shrinking the team.`, {
          maxMembers: 'below_member_count',
        });
      }

      if (name.toLowerCase() !== team.name.toLowerCase()) {
        const clash = await tx.query('SELECT id FROM teams WHERE lower(school)=lower($1) AND lower(name)=lower($2) AND id<>$3', [
          team.school,
          name,
          team.id,
        ]);
        if (clash.rows.length) throw new HttpError(409, 'Another team at your school already uses that name.', { code: 'team_name_taken' });
      }

      if (passcode) {
        if (passcode.length < 6) throw new ValidationError('Team passcode needs at least 6 characters.', { passcode: 'too_short' });
        await tx.query('UPDATE teams SET passcode_hash=$1 WHERE id=$2', [await hashPassword(passcode), team.id]);
      }

      if (req.body?.school) {
        const school = str(req.body.school, { min: 2, max: 120, field: 'School', required: true });
        if (school.toLowerCase() !== team.school.toLowerCase()) {
          if (settings.registration?.requireSchoolMatch !== false) {
            const mix = await tx.query(
              'SELECT id FROM students WHERE team_id=$1 AND lower(school)<>lower($2)',
              [team.id, school],
            );
            if (mix.rows.length) throw new ValidationError('Team members are registered under a different school.', { school: 'members_mismatch' });
          }
          await tx.query('UPDATE teams SET school=$1 WHERE id=$2', [school, team.id]);
          await tx.query('UPDATE students SET school=$1 WHERE team_id=$2', [school, team.id]);
        }
      }

      await tx.query('UPDATE teams SET name=$1, max_members=$2, updated_at=now() WHERE id=$3', [name, maxMembers, team.id]);
      return 'Team details saved.';
    });

    await audit('student', req.student.id, 'team.update');
    res.json({ ok: true, message, student: await loadStudent(req.student.id) });
  }),
);

studentRouter.post(
  '/student/team/remove',
  wrap(async (req, res) => {
    const targetId = str(req.body?.studentId, { field: 'Member', required: true });
    const message = await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      const team = student.team_id
        ? (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0]
        : null;
      if (!team || team.leader_id !== student.id) fail(403, 'Only the team leader can remove members.');
      if (targetId === student.id) throw new ValidationError('Leaders must hand over leadership before leaving.');
      const { rowCount } = await tx.query("UPDATE students SET team_id=NULL, role='solo', updated_at=now() WHERE id=$1 AND team_id=$2", [
        targetId,
        team.id,
      ]);
      if (!rowCount) fail(404, 'That student is not on your team.');
      return 'Member removed from the team.';
    });
    await audit('student', req.student.id, 'team.remove', { targetId });
    res.json({ ok: true, message, student: await loadStudent(req.student.id) });
  }),
);

studentRouter.post(
  '/student/team/transfer',
  wrap(async (req, res) => {
    const targetId = str(req.body?.studentId, { field: 'Member', required: true });
    await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      const team = student.team_id
        ? (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0]
        : null;
      if (!team || team.leader_id !== student.id) fail(403, 'Only the team leader can transfer leadership.');
      const target = (await tx.query('SELECT * FROM students WHERE id=$1 AND team_id=$2', [targetId, team.id])).rows[0];
      if (!target) fail(404, 'That student is not on your team.');
      await tx.query("UPDATE students SET role='member' WHERE id=$1", [student.id]);
      await tx.query("UPDATE students SET role='leader' WHERE id=$1", [target.id]);
      await tx.query('UPDATE teams SET leader_id=$1, updated_at=now() WHERE id=$2', [target.id, team.id]);
    });
    await audit('student', req.student.id, 'team.transfer', { targetId });
    res.json({ ok: true, message: 'Team leadership transferred.', student: await loadStudent(req.student.id) });
  }),
);

studentRouter.delete(
  '/student/team',
  wrap(async (req, res) => {
    const message = await transaction(async (tx) => {
      const student = (await tx.query('SELECT * FROM students WHERE id=$1 FOR UPDATE', [req.student.id])).rows[0];
      if (!student.team_id) fail(404, 'You are not on a team.');
      const team = (await tx.query('SELECT * FROM teams WHERE id=$1 FOR UPDATE', [student.team_id])).rows[0];
      if (!team) fail(404, 'That team no longer exists.');
      const { rows } = await tx.query(
        "SELECT count(*)::int AS n FROM students WHERE team_id=$1 AND status<>'withdrawn'",
        [team.id],
      );
      if (team.leader_id === student.id) {
        const others = rows[0].n - 1;
        if (others > 0) {
          throw new ValidationError(
            'Hand leadership to a teammate before leaving, so the team is not left without an owner.',
            { team: 'hand_over_first' },
          );
        }
        // Sole member: the team is theirs to close.
        await tx.query('DELETE FROM teams WHERE id=$1', [team.id]);
        await tx.query("UPDATE students SET team_id=NULL, role='solo' WHERE id=$1", [student.id]);
        return 'Your team was closed because you were its only member.';
      }
      await tx.query("UPDATE students SET team_id=NULL, role='solo' WHERE id=$1", [student.id]);
      return 'You left the team. You can create or join another one.';
    });
    await audit('student', req.student.id, 'team.leave');
    res.json({ ok: true, message, student: await loadStudent(req.student.id) });
  }),
);

/** Team view for members (no passcode hash exposed, ever). */
studentRouter.get(
  '/student/team',
  wrap(async (req, res) => {
    if (!req.student.team_id) return res.json({ ok: true, team: null });
    res.json({ ok: true, team: await loadTeam(req.student.team_id) });
  }),
);

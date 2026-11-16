/**
 * Serialisation helpers. Every student payload includes their team, teammates
 * and pending requests so the dashboard can render from one response and the
 * browser never has to stitch records together itself.
 */
import { q1, query } from './db.js';
import { categoryRows } from './routes/public.js';

export async function loadStudent(id) {
  const student = await q1(
    `SELECT id, email, name, class_name AS "className", school, phone,
            category_id AS "categoryId", team_id AS "teamId", status, role,
            project_title AS "projectTitle", notes, created_at AS "createdAt",
            updated_at AS "updatedAt"
     FROM students WHERE id = $1`,
    [id],
  );
  if (!student) return null;

  const [categories, team, request] = await Promise.all([
    categoryRows(),
    student.teamId ? loadTeam(student.teamId, { includePasscodeHolder: false }) : null,
    q1(
      `SELECT id, from_category AS "fromCategory", to_category AS "toCategory",
              status, admin_note AS "adminNote", reason, created_at AS "createdAt"
       FROM category_requests WHERE student_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    ),
  ]);

  return {
    id: student.id,
    email: student.email,
    name: student.name,
    className: student.className,
    school: student.school,
    phone: student.phone,
    categoryId: student.categoryId,
    teamId: student.teamId,
    status: student.status,
    role: student.role,
    projectTitle: student.projectTitle,
    notes: student.notes,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    category: categories.find((c) => c.id === student.categoryId) || null,
    team,
    pendingRequest: request || null,
  };
}

export async function loadTeam(teamId, { includePasscodeHolder = false } = {}) {
  const team = await q1(
    `SELECT id, name, school, category_id AS "categoryId", max_members AS "maxMembers",
            leader_id AS "leaderId", created_at AS "createdAt"
     FROM teams WHERE id = $1`,
    [teamId],
  );
  if (!team) return null;
  const { rows: members } = await query(
    `SELECT id, name, class_name AS "className", email, role, created_at AS "joinedAt"
     FROM students
     WHERE team_id = $1 AND status <> 'withdrawn'
     ORDER BY (role = 'leader') DESC, created_at`,
    [teamId],
  );
  const categories = await categoryRows();
  return {
    ...team,
    category: categories.find((c) => c.id === team.categoryId) || null,
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      className: m.className,
      email: m.email,
      role: m.role,
      isLeader: m.id === team.leaderId,
    })),
    memberCount: members.length,
    seatsLeft: Math.max(0, team.maxMembers - members.length),
    isFull: members.length >= team.maxMembers,
  };
}

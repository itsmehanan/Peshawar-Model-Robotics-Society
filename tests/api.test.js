/**
 * End-to-end API tests. Run with `npm test` (server must not already be running
 * on PORT). Each test drives the real HTTP surface against a throwaway database
 * in ./data-test so production data is never touched.
 *
 * These cover the bugs called out in the brief:
 *   - duplicate registrations and duplicate emails
 *   - team capacity races, wrong passcodes, cross-school joins
 *   - field mismatches when joining a team
 *   - category changes and approval fan-out
 *   - admin auth, registration toggling, exports
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data-test');
fs.rmSync(DATA_DIR, { recursive: true, force: true });

process.env.DATA_DIR = DATA_DIR;
// Set TEST_DATABASE_URL to run this suite against a real hosted PostgreSQL
// (the exact driver production uses) instead of the embedded one.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = '3999';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'Sup3rSecretPass';

const { start } = await import('../server/index.js');
const server = await start();
const BASE = `http://127.0.0.1:3999`;

/* --------------------------------------------------------------- helpers */
function makeClient() {
  const jar = new Map();
  const request = async function request(method, url, body) {
    const headers = { Accept: 'application/json', Origin: BASE };
    if (jar.size) headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${BASE}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const idx = pair.indexOf('=');
      const key = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!value) jar.delete(key);
      else jar.set(key, value);
    }
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: response.status, body: json, headers: response.headers };
  };
  request.jar = jar;
  return request;
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✗ ${name}\n    ${error.message}`);
  }
}

const client = makeClient();
const admin = makeClient();
const team = (n) => ({ name: `Student ${n}`, className: 'Grade 9', school: 'Test High School' });

/* ----------------------------------------------------------------- tests */
console.log('\nPublic content');

await test('content endpoint returns site, categories and faqs', async () => {
  const { status, body } = await client('GET', '/api/content');
  assert.equal(status, 200);
  assert.ok(body.site.name.length > 0);
  assert.equal(body.categories.length, 4);
  assert.ok(body.categories[0].details !== undefined, 'public fields include the saved full brief');
  assert.ok(Array.isArray(body.categories[0].images), 'public fields include the image gallery');
  assert.ok(body.faqs.length >= 3);
});

await test('unknown API path is a JSON 404', async () => {
  const { status, body } = await client('GET', '/api/nope');
  assert.equal(status, 404);
  assert.equal(body.ok, false);
});

await test('student cannot read admin endpoints', async () => {
  const { status } = await client('GET', '/api/admin/students');
  assert.equal(status, 401);
});

console.log('\nRegistration');

let leaderCookieStudent;
let leaderTeamId;

await test('registers a team leader and sets a session cookie', async () => {
  const { status, body } = await client('POST', '/api/register', {
    ...team(1),
    email: 'leader@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'create',
    teamName: 'Circuit Breakers',
    teamCode: 'breaker-code',
    maxMembers: 3,
  });
  assert.equal(status, 201, JSON.stringify(body));
  assert.equal(body.student.role, 'leader');
  assert.equal(body.student.team.name, 'Circuit Breakers');
  leaderTeamId = body.student.teamId;
  leaderCookieStudent = body.student.id;
});

await test('rejects a duplicate email', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(2),
    email: 'leader@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'none',
  });
  assert.equal(status, 409);
  assert.equal(body.code, 'email_taken');
});

await test('rejects a weak password server-side', async () => {
  const other = makeClient();
  const { status } = await other('POST', '/api/register', {
    ...team(3),
    email: 'weak@test.local',
    password: 'short',
    categoryId: 'robotics',
    teamMode: 'none',
  });
  assert.equal(status, 422);
});

await test('rejects a team name already used at the same school', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(4),
    email: 'dup@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'create',
    teamName: 'circuit breakers',
    teamCode: 'another-code',
    maxMembers: 4,
  });
  assert.equal(status, 409);
  assert.equal(body.code, 'team_name_taken');
});

await test('join fails with a wrong passcode', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(5),
    email: 'wrongcode@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'not-the-code',
  });
  assert.equal(status, 403);
  assert.equal(body.code, 'bad_passcode');
});

await test('join fails when the field does not match the team', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(6),
    email: 'wrongfield@test.local',
    password: 'password123',
    categoryId: 'science',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'breaker-code',
  });
  assert.equal(status, 422);
  assert.ok(body.fields.categoryId);
});

await test('join fails from a different school', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    name: 'Other School Kid',
    className: 'Grade 8',
    school: 'Different School',
    email: 'otherschool@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'breaker-code',
  });
  assert.equal(status, 422);
  assert.ok(body.fields.joinTeamId);
});

await test('two teammates can join with the right code', async () => {
  for (const n of [7, 8]) {
    const other = makeClient();
    const { status, body } = await other('POST', '/api/register', {
      ...team(n),
      email: `member${n}@test.local`,
      password: 'password123',
      categoryId: 'robotics',
      teamMode: 'join',
      joinTeamId: leaderTeamId,
      joinCode: 'breaker-code',
    });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(body.student.team.memberCount, n === 7 ? 2 : 3);
  }
});

await test('a decorated school name still matches its own team', async () => {
  // Students write their school name however they like. An exact lower() compare
  // blocked the join and then told them they were not from their own school,
  // which left no way forward at all.
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(11),
    email: 'decorated@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'breaker-code',
    // same school as the leader, written the way a student would
    school: 'The Test High School (Main Campus)',
  });
  // The team is full at this point, which proves the school check passed: the
  // request reached the capacity rule instead of being rejected before it.
  assert.equal(status, 409);
  assert.equal(body.code, 'team_full');
});

await test('a genuinely different school is still refused, naming both', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(12),
    email: 'otherschool@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'breaker-code',
    school: 'Warsak Model School',
  });
  assert.equal(status, 422);
  assert.match(body.error, /Warsak Model School/, 'the error names the team school');
});

await test('a full team refuses further joins (capacity enforced server-side)', async () => {
  const other = makeClient();
  const { status, body } = await other('POST', '/api/register', {
    ...team(9),
    email: 'overflow@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: leaderTeamId,
    joinCode: 'breaker-code',
  });
  assert.equal(status, 409);
  assert.equal(body.code, 'team_full');
});

await test('team discovery lists real seat counts and hides nothing sensitive', async () => {
  const { status, body } = await client(
    'GET',
    `/api/teams?school=${encodeURIComponent('Test High School')}&category=robotics`,
  );
  assert.equal(status, 200);
  const found = body.teams.find((t) => t.id === leaderTeamId);
  assert.ok(found);
  assert.equal(found.memberCount, 3);
  assert.equal(found.seatsLeft, 0);
  assert.equal(found.passcode_hash, undefined);
});

console.log('\nAccounts & dashboard');

await test('signing in returns the full registration state', async () => {
  const session = makeClient();
  const { status, body } = await session('POST', '/api/login', {
    email: 'leader@test.local',
    password: 'password123',
  });
  assert.equal(status, 200);
  assert.equal(body.student.team.name, 'Circuit Breakers');
  assert.equal(body.student.team.memberCount, 3);
  const me = await session('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.student.id, leaderCookieStudent);
});

await test('wrong password is rejected', async () => {
  const session = makeClient();
  const { status } = await session('POST', '/api/login', { email: 'leader@test.local', password: 'nope12345' });
  assert.equal(status, 401);
});

await test('profile updates persist across a new session', async () => {
  const result = await client('PATCH', '/api/student/profile', {
    name: 'Student One',
    className: 'Grade 10',
    school: 'Test High School',
    phone: '+92 300 1234567',
    email: 'leader@test.local',
    projectTitle: 'Line-following rover',
  });
  assert.equal(result.status, 200);
  const fresh = makeClient();
  await fresh('POST', '/api/login', { email: 'leader@test.local', password: 'password123' });
  const me = await fresh('GET', '/api/me');
  assert.equal(me.body.student.className, 'Grade 10');
  assert.equal(me.body.student.projectTitle, 'Line-following rover');
});

await test('school cannot change while on a team', async () => {
  const { status, body } = await client('PATCH', '/api/student/profile', {
    name: 'Student One',
    className: 'Grade 10',
    school: 'Another School',
    email: 'leader@test.local',
  });
  assert.equal(status, 422);
  assert.ok(body.fields.school);
});

await test('only the leader can edit team details', async () => {
  const member = makeClient();
  await member('POST', '/api/login', { email: 'member7@test.local', password: 'password123' });
  const { status } = await member('PATCH', '/api/student/team', { name: 'Hijacked', maxMembers: 4 });
  assert.equal(status, 403);
});

await test('leader can rename the team and shrink capacity to member count', async () => {
  const { status, body } = await client('PATCH', '/api/student/team', { name: 'Circuit Breakers II', maxMembers: 3 });
  assert.equal(status, 200);
  assert.equal(body.student.team.name, 'Circuit Breakers II');
});

await test('leader cannot shrink below the current member count', async () => {
  const { status, body } = await client('PATCH', '/api/student/team', { name: 'Circuit Breakers II', maxMembers: 2 });
  assert.equal(status, 422);
  assert.ok(body.fields.maxMembers);
});

await test('category change while on a team creates a pending request', async () => {
  const { status, body } = await client('POST', '/api/student/category', {
    categoryId: 'engineering',
    reason: 'Our build is a bridge model',
  });
  assert.equal(status, 200);
  assert.ok(body.student.pendingRequest);
  assert.equal(body.student.pendingRequest.toCategory, 'engineering');
  assert.equal(body.student.categoryId, 'robotics', 'field must not change before approval');
});

console.log('\nAdmin');

await test('admin login rejects a wrong password', async () => {
  const { status } = await admin('POST', '/api/admin/login', { email: 'admin@test.local', password: 'wrong' });
  assert.equal(status, 401);
});

await test('admin can sign in', async () => {
  const { status, body } = await admin('POST', '/api/admin/login', {
    email: 'admin@test.local',
    password: 'Sup3rSecretPass',
  });
  assert.equal(status, 200);
  assert.equal(body.admin.email, 'admin@test.local');

  const me = await admin('GET', '/api/admin/overview');
  assert.equal(me.status, 200, 'session cookie must authenticate the next request');
});

await test('overview reflects real counts', async () => {
  const { status, body } = await admin('GET', '/api/admin/overview');
  assert.equal(status, 200);
  // 3 members joined the team; the 4th (overflow) was rejected, so 3 exist.
  assert.equal(body.counts.students, 3);
  assert.equal(body.counts.teams, 1);
  assert.equal(body.counts.pending_requests, 1);
});

await test('approving a leader request moves the whole team', async () => {
  const list = await admin('GET', '/api/admin/category-requests');
  const pending = list.body.requests.find((r) => r.status === 'pending');
  assert.ok(pending);
  const result = await admin('POST', `/api/admin/category-requests/${pending.id}`, { action: 'approve' });
  assert.equal(result.status, 200);

  const teams = await admin('GET', '/api/admin/teams');
  const t = teams.body.teams.find((x) => x.id === leaderTeamId);
  assert.equal(t.categoryId, 'engineering');

  const me = await client('GET', '/api/me');
  assert.equal(me.body.student.categoryId, 'engineering');
  assert.equal(me.body.student.pendingRequest, null);
});

await test('registration can be closed and re-opened', async () => {
  const current = await admin('GET', '/api/admin/settings');
  const registration = { ...current.body.settings.registration, open: false };
  const saved = await admin('PUT', '/api/admin/settings/registration', registration);
  assert.equal(saved.status, 200);

  const other = makeClient();
  const blocked = await other('POST', '/api/register', {
    ...team(10),
    email: 'closed@test.local',
    password: 'password123',
    categoryId: 'science',
    teamMode: 'none',
  });
  assert.equal(blocked.status, 403);

  await admin('PUT', '/api/admin/settings/registration', { ...registration, open: true });
});

await test('uploaded logos and campus settings save to the public content payload', async () => {
  const current = await admin('GET', '/api/admin/settings');
  const uploaded = await admin('POST', '/api/admin/assets', {
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/FZ0AAAAASUVORK5CYII=',
  });
  assert.equal(uploaded.status, 201);
  assert.ok(uploaded.body.url.startsWith('/api/assets/'));
  const site = {
    ...current.body.settings.site,
    name: 'PMRSDC TEST',
    campusName: 'Dalazak Campus',
    logoMarkDarkUrl: uploaded.body.url,
    logoMarkLightUrl: '/assets/pmrs-logo-light.jpg',
  };
  const saved = await admin('PUT', '/api/admin/settings/site', site);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const content = await client('GET', '/api/content');
  assert.equal(content.body.site.name, 'PMRSDC TEST');
  assert.equal(content.body.site.logoMarkDarkUrl, uploaded.body.url);
  assert.equal(content.body.site.logoMarkLightUrl, '/assets/pmrs-logo-light.jpg');
});

await test('csv export is gated and returns CSV for admins', async () => {
  const anonymous = await fetch(`${BASE}/api/admin/export/registrations.csv`, { headers: { Origin: BASE } });
  assert.equal(anonymous.status, 401, 'export must require admin auth');

  const cookie = [...admin.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const authed = await fetch(`${BASE}/api/admin/export/registrations.csv`, { headers: { Cookie: cookie } });
  assert.equal(authed.status, 200);
  assert.match(authed.headers.get('content-type'), /text\/csv/);
  const csv = await authed.text();
  assert.match(csv, /"Name","Email","Phone","Class","School"/);
  assert.match(csv, /member7@test.local/);
});

await test('deleting a student promotes the next member to leader', async () => {
  const students = await admin('GET', '/api/admin/students');
  const leader = students.body.students.find((s) => s.id === leaderCookieStudent);
  const del = await admin('DELETE', `/api/admin/students/${leader.id}`);
  assert.equal(del.status, 200);
  const teams = await admin('GET', '/api/admin/teams');
  const t = teams.body.teams.find((x) => x.id === leaderTeamId);
  assert.notEqual(t.leaderId, leaderCookieStudent);
  assert.ok(t.leaderId, 'a new leader must be assigned');
});

await test('admin can create and delete an FAQ', async () => {
  const created = await admin('POST', '/api/admin/faqs', { question: 'Is this tested?', answer: 'Yes, end to end.' });
  assert.equal(created.status, 201);
  const faq = created.body.faqs.find((f) => f.question === 'Is this tested?');
  assert.ok(faq);
  await admin('DELETE', `/api/admin/faqs/${faq.id}`);
});

await test('a category with registrations cannot be deleted', async () => {
  // The team was approved into "engineering" above, so that is where students live now.
  const { status, body } = await admin('DELETE', '/api/admin/categories/engineering');
  assert.equal(status, 409);
  assert.equal(body.code, 'in_use');
});

await test('an unused category can be deleted', async () => {
  const created = await admin('POST', '/api/admin/categories', {
    name: 'Test Field',
    symbol: '◎',
    summary: 'A temporary field for the test suite.',
    details: 'The full brief is stored and returned to public pages.',
    imageUrl: '/assets/pmrs-logo-dark.jpg',
    images: ['/assets/pmrs-logo-light.jpg'],
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const content = await client('GET', '/api/content');
  const field = content.body.categories.find((item) => item.id === 'test-field');
  assert.equal(field.details, 'The full brief is stored and returned to public pages.');
  assert.equal(field.imageUrl, '/assets/pmrs-logo-dark.jpg');
  assert.deepEqual(field.images, ['/assets/pmrs-logo-light.jpg']);
  const { status } = await admin('DELETE', '/api/admin/categories/test-field');
  assert.equal(status, 200);
});

await test('unknown settings section is rejected', async () => {
  const { status } = await admin('PUT', '/api/admin/settings/passwords', { anything: true });
  assert.equal(status, 422);
});

await test('signing out clears the admin session', async () => {
  await admin('POST', '/api/admin/logout');
  const { status } = await admin('GET', '/api/admin/overview');
  assert.equal(status, 401);
});

/* ------------------------------------------------------------------ */
/* Session transport                                                   */
/* ------------------------------------------------------------------ */
console.log('\nsession transport');

await test('a session token works without cookies (embedded/iframe context)', async () => {
  // The app runs inside cross-site frames in previews and school portals, where
  // browsers drop SameSite cookies. That produced "sign in, get bounced back".
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: 'admin@test.local', password: 'Sup3rSecretPass' }),
  });
  assert.equal(login.status, 200);
  const body = await login.json();
  assert.ok(body.sessionToken, 'login must return a replayable session token');

  // Deliberately send no Cookie header at all.
  const me = await fetch(`${BASE}/api/me`, { headers: { Origin: BASE, 'X-Admin-Token': body.sessionToken } });
  const meBody = await me.json();
  assert.equal(me.status, 200);
  assert.ok(meBody.admin, 'admin session must resolve from the header alone');
  assert.equal(meBody.admin.email, 'admin@test.local');

  const overview = await fetch(`${BASE}/api/admin/overview`, {
    headers: { Origin: BASE, 'X-Admin-Token': body.sessionToken },
  });
  assert.equal(overview.status, 200, 'admin API must accept the header token');

  // An admin token must not open student-scoped routes.
  const studentScope = await fetch(`${BASE}/api/student/team`, {
    headers: { Origin: BASE, 'X-Admin-Token': body.sessionToken },
  });
  assert.equal(studentScope.status, 401, 'an admin token must not open student routes');
});

await test('a forged session header is rejected', async () => {
  const res = await fetch(`${BASE}/api/me`, { headers: { Origin: BASE, 'X-Admin-Token': 'x'.repeat(40) } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.admin, null, 'unknown tokens must not authenticate');
});

await test('/api/me is never cached', async () => {
  const res = await fetch(`${BASE}/api/me`);
  assert.match(String(res.headers.get('cache-control')), /no-store/);
  assert.match(String(res.headers.get('vary')), /Cookie/i);
});

await test('the app shell embeds the full public content, not just the chrome', async () => {
  const html = await (await fetch(`${BASE}/`, { headers: { Origin: BASE } })).text();
  const match = /<script type="application\/json" id="boot-content">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'boot payload must be present');
  const payload = JSON.parse(match[1]);
  assert.ok(payload.site.name, 'site branding');
  assert.ok(Array.isArray(payload.categories) && payload.categories.length >= 4, 'field cards');
  assert.ok(Array.isArray(payload.articles), 'journal teasers');
  assert.ok(Array.isArray(payload.faqs), 'faqs');
  assert.ok(Array.isArray(payload.announcements), 'announcements');
  assert.ok(payload.counts && typeof payload.counts.students === 'number', 'counters');
});

await test('application scripts are not served immutable', async () => {
  const res = await fetch(`${BASE}/assets/js/main.js`);
  assert.equal(res.status, 200);
  assert.doesNotMatch(String(res.headers.get('cache-control')), /immutable/);
});

await test('an administrator can sign in with a short ID, not only an email', async () => {
  // "ADMIN-003" is not an email address. Requiring one at the login step rejected
  // the credential before it was ever checked, which locked out the organiser.
  const { query } = await import('../server/db.js');
  const { hashPassword, uuid } = await import('../server/security.js');
  await query('INSERT INTO admin_users (id, email, name, password_hash) VALUES ($1,$2,$3,$4)', [
    uuid(), 'admin-003', 'HUSNAIN', await hashPassword('Husnain12345'),
  ]);

  const ok = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: 'admin-003', password: 'Husnain12345' }),
  });
  assert.equal(ok.status, 200, 'the ID must authenticate');
  const signedIn = await ok.json();
  assert.equal(signedIn.admin.email, 'admin-003');

  // Case and whitespace should not matter, and a wrong password is still refused
  // with the same generic message (never "that email is invalid").
  const padded = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: '  ADMIN-003 ', password: 'wrongpassword1' }),
  });
  assert.equal(padded.status, 401);
  const body = await padded.json();
  assert.equal(body.code, 'bad_credentials');
  assert.doesNotMatch(body.error, /valid email/i);
});

await test('the deployment health check answers before the API 404 does', async () => {
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.database, /^(postgres|pglite)$/);
  // and the catch-all still rejects genuinely unknown endpoints
  const unknown = await fetch(`${BASE}/api/definitely-not-a-route`);
  assert.equal(unknown.status, 404);
});

await test('a malformed asset id is a 404, not a server error', async () => {
  // Postgres rejects a non-uuid against a uuid column, which used to surface as a
  // 500 for any guessed /api/assets/<junk> URL.
  for (const id of ['not-a-uuid', '00000000-0000-0000-0000-000000000000', '../server']) {
    const res = await fetch(`${BASE}/api/assets/${encodeURIComponent(id)}`);
    assert.equal(res.status, 404, `${id} should be 404, got ${res.status}`);
  }
});

console.log('\nTeam permissions');

// These were audited by hand against a live server; the point of pinning them
// here is that a permission check is only worth having if it is asserted. A
// future refactor of the team routes should fail this block, not a user.
const permLeader = makeClient();
const permMember = makeClient();
const permOutsider = makeClient();
let permTeamId;
let permMemberId;

await test('permission fixture: a leader and a member in one team', async () => {
  const created = await permLeader('POST', '/api/register', {
    ...team(21),
    email: 'perm-lead@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'create',
    teamName: 'Permission Team',
    teamCode: 'perm-code',
    maxMembers: 3,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  permTeamId = created.body.student.teamId;

  const joined = await permMember('POST', '/api/register', {
    ...team(22),
    email: 'perm-member@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'join',
    joinTeamId: permTeamId,
    joinCode: 'perm-code',
  });
  assert.equal(joined.status, 201, JSON.stringify(joined.body));
  permMemberId = joined.body.student.id;

  const outsider = await permOutsider('POST', '/api/register', {
    ...team(23),
    email: 'perm-outsider@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'create',
    teamName: 'Outsider Team',
    teamCode: 'out-code',
    maxMembers: 3,
  });
  assert.equal(outsider.status, 201, JSON.stringify(outsider.body));
});

await test('only the leader may edit team details', async () => {
  const asMember = await permMember('PATCH', '/api/student/team', { name: 'Hijacked' });
  assert.equal(asMember.status, 403);
  const asLeader = await permLeader('PATCH', '/api/student/team', { name: 'Renamed Team' });
  assert.equal(asLeader.status, 200);
});

await test('editing a team can only ever touch your own team', async () => {
  // The endpoint takes no team id at all: it resolves the caller's own team from
  // the session. That is why an outsider gets 200 here -- they are editing their
  // OWN team, which is correct. The assertion that matters is the next one.
  const asOutsider = await permOutsider('PATCH', '/api/student/team', { name: 'Outsider Renamed' });
  assert.equal(asOutsider.status, 200);

  const mine = await permLeader('GET', '/api/me');
  assert.equal(mine.status, 200);
  assert.equal(mine.body.student.team.name, 'Renamed Team', "the leader's team is untouched");
});

await test('only the leader may remove a member', async () => {
  const asMember = await permMember('POST', '/api/student/team/remove', { studentId: permMemberId });
  assert.equal(asMember.status, 403, 'a member cannot remove anyone');
  const leaderAsTarget = await permMember('POST', '/api/student/team/remove', { studentId: 'someone-else' });
  assert.equal(leaderAsTarget.status, 403);
});

await test('an outsider cannot remove another team\'s member', async () => {
  // 404 rather than 403 on purpose: it must not confirm that the id exists.
  const res = await permOutsider('POST', '/api/student/team/remove', { studentId: permMemberId });
  assert.equal(res.status, 404);
});

await test('the leader can remove a member, who then loses team access', async () => {
  const res = await permLeader('POST', '/api/student/team/remove', { studentId: permMemberId });
  assert.equal(res.status, 200);

  const after = await permMember('PATCH', '/api/student/team', { name: 'x' });
  assert.equal(after.status, 404, 'a removed member is no longer on a team');
});

await test('a student cannot reach the admin surface', async () => {
  assert.equal((await permLeader('GET', '/api/admin/students')).status, 401);
  assert.equal((await permLeader('PUT', '/api/admin/settings/site', { name: 'X' })).status, 401);
});

console.log('\nField changes and profile edits');

await test('a student with no team switches field immediately', async () => {
  const solo = makeClient();
  const created = await solo('POST', '/api/register', {
    ...team(31),
    email: 'solo-field@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'none',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const changed = await solo('POST', '/api/student/category', { categoryId: 'science' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.student.categoryId, 'science', 'the change is applied straight away');
});

await test('a student on a team gets a request instead of a silent move', async () => {
  // The field belongs to the whole team, so one member cannot move it alone: the
  // answer must say a request was made, not that the field changed.
  const lead = makeClient();
  const created = await lead('POST', '/api/register', {
    ...team(32),
    email: 'field-lead@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'create',
    teamName: 'Field Request Team',
    teamCode: 'field-code',
    maxMembers: 3,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  const res = await lead('POST', '/api/student/category', { categoryId: 'engineering' });
  assert.equal(res.status, 200);
  assert.match(res.body.message, /request/i);
  assert.equal(res.body.student.categoryId, 'robotics', 'the field has not moved yet');
});

await test('unknown and unchanged fields are rejected', async () => {
  const solo = makeClient();
  await solo('POST', '/api/register', {
    ...team(33),
    email: 'field-guard@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'none',
  });
  const bogus = await solo('POST', '/api/student/category', { categoryId: 'nonsense' });
  assert.equal(bogus.status, 422);
  const same = await solo('POST', '/api/student/category', { categoryId: 'robotics' });
  assert.equal(same.status, 422);
});

await test('a profile edit persists and is revalidated', async () => {
  const solo = makeClient();
  await solo('POST', '/api/register', {
    ...team(34),
    email: 'profile-edit@test.local',
    password: 'password123',
    categoryId: 'robotics',
    teamMode: 'none',
  });
  const blankName = await solo('PATCH', '/api/student/profile', {
    name: '',
    className: 'Grade 10',
    school: 'Test High School',
    phone: '03001234567',
    email: 'profile-edit@test.local',
  });
  assert.equal(blankName.status, 422, 'an empty name is not saved');

  const edited = await solo('PATCH', '/api/student/profile', {
    name: 'Renamed Student',
    className: 'Grade 10',
    school: 'Test High School',
    phone: '03009999999',
    email: 'profile-edit@test.local',
    projectTitle: 'A working prototype',
  });
  assert.equal(edited.status, 200, JSON.stringify(edited.body));
  assert.equal(edited.body.student.name, 'Renamed Student');
  assert.equal(edited.body.student.className, 'Grade 10');
});

/* --------------------------------------------------------------- report */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);

await new Promise((resolve) => server.close(resolve));
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.exit(failed.length ? 1 : 0);

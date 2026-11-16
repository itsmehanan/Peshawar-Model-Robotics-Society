# ORBIT School Olympiad — website, registration portal & organiser CMS

A complete rebuild of the two supplied prototypes (`olympiad_landing_page.html`
and `olympiad_portal.html`) into one production-grade application:

- **Public site** — landing page, fields of entry, journal, about/FAQ, contact
- **Registration** — student accounts, team creation & joining with passcodes
- **Student dashboard** — profile, team ownership, field changes, password
- **Admin CMS** — branding, event, fields, articles, FAQ, announcements,
  contact/social, students, teams, exports, registration settings
- **Real backend** — Express + PostgreSQL (embedded by default, Supabase/hosted
  Postgres in production), server-side validation, hashed passwords, cookie
  sessions, audit log

Nothing about a registration lives in `localStorage`. Accounts, teams and
settings are rows in a real database, so they survive refreshes, restarts and
follow the student to any device they sign in from.

---

## 1. Run it locally

```bash
npm install
cp .env.example .env          # optional: edit ADMIN_EMAIL / ADMIN_PASSWORD
npm start                     # → http://localhost:3000
```

On first boot the app creates its schema and seeds default content
(4 fields, 3 journal articles, 5 FAQs, 1 announcement). It also creates one
administrator account:

- If you set `ADMIN_PASSWORD` in `.env`, that is the password.
- Otherwise a strong password is generated, printed once in the console, and
  written to `data/admin-credentials.txt` (git-ignored, mode 0600).

Sign in at `/#/admin`. Change the password immediately in **Account**.

> **Default database:** the embedded PostgreSQL build (PGlite) with data in
> `./data/pglite`. No external service, no Docker, no SQL to run. It survives
> process restarts and is the recommended setup for a single school server.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm start` | run the server (port `PORT`, default 3000) |
| `npm run dev` | run with `--watch` for auto-restart |
| `npm test` | 34 HTTP/API tests against a throwaway database |
| `npm run test:ui` | 20 jsdom browser-flow tests (register → dashboard → admin) |
| `npm run test:all` | both suites |
| `npm run admin:set-password -- --email a@b.c --password "NewPass123"` | reset/create an admin |
| `npm run db:reset` | **dev only** — wipe the embedded database and re-seed |

Both test suites spin up their own server on ports 3998/3999 with separate data
directories and delete them afterwards. They never touch `./data`.

**Demo admin for this checkout:** the running preview instance was seeded with
`organizer@orbit-olympiad.org` / `0rbitLaunch!2026`. Change it in
**Admin → Account** before any real use, or set `ADMIN_PASSWORD` before first
boot instead.

---

## 2. Deploy to production

### Option A — Vercel + Supabase (recommended for a hosted site)

**1. Create a Supabase project** (this repo ships tooling for it; the
`supabase` app is available in this environment, or use the dashboard).

**2. Get the pooled connection string.** Supabase → *Project settings →
Database → Connection string → URI*. Use the **pooler** host and port `6543`
(Vercel functions are short-lived; the pooler prevents connection exhaustion):

```
postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

**3. Deploy the folder to Vercel** and set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the pooled URI above |
| `DATABASE_SSL` | `true` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | organiser's email |
| `ADMIN_PASSWORD` | a strong password (12+ chars) |
| `SESSION_DAYS` | `30` |
| `TRUST_PROXY` | `1` |

`vercel.json` is included: it builds `server/index.js` as a Node function and
routes `/assets/*` and `/fonts/*` to the static folders.

**4. First request seeds the database** — tables, default content and the admin
account are created automatically. Open `/#/admin` and sign in.

> If you prefer to provision the schema yourself, run
> [`sql/supabase-setup.sql`](sql/supabase-setup.sql) in the Supabase SQL editor
> first. It is identical to what the app creates.

**Security note:** the browser never talks to Supabase. Only the Node server
connects, over `DATABASE_URL`. Do not expose these tables with the anon key and
never ship a service-role key to the frontend — this app doesn't load either.

### Option B — any Node host (Railway, Render, Fly.io, a school server)

```bash
npm install --omit=dev
NODE_ENV=production PORT=3000 DATABASE_URL="postgres://…" ADMIN_EMAIL=… ADMIN_PASSWORD=… npm start
```

Works with any PostgreSQL 14+. Without `DATABASE_URL` it uses the embedded
database and the local `./data` folder — fine for a single always-on machine,
not for a serverless platform (filesystems there are ephemeral).

### Before you hand it to students

1. Change the admin password (**Admin → Account**).
2. Update **Branding & site**: name, full name, tagline, logo mark or logo
   upload, favicon, meta description.
3. Update **Event details**: date, venue, address, programme line, about copy.
4. Update **Contact & social**: real email, phone, organiser name and only the
   social accounts you actually run (unticked or empty ⇒ hidden everywhere).
5. Set **Registration** open/closed, team sizes and the field-change policy.
6. Download a CSV from **Exports** to confirm the database is live.

---

## 3. What was wrong with the original files

Both uploads shared the same root problems. This is the audit, and what replaced
each one.

### Data & correctness

| Problem in the prototype | Status now |
| --- | --- |
| Everything in `localStorage` — registrations disappeared on another device or after clearing browser data | PostgreSQL; session cookie identifies the account, data lives server-side |
| "Join Team" was broken: switching to *Join* cleared the team list and re-filtered only on a `schoolFilter` input event, so the select was empty; the submitted value came from a `<select>` that was never populated | Teams are fetched per school **and** field, rendered as selectable cards with live seat counts, and the chosen id is validated server-side |
| Team passcodes compared with `await hash(...)` inside the submit handler after other state had already been decided | Passcode verified with `scrypt` inside one transaction that also re-counts seats with `SELECT … FOR UPDATE` |
| Category mismatch, school mismatch and capacity were only *partially* checked, and only in the browser | All enforced in SQL+JS server-side; the browser cannot bypass them |
| `students` and `teams.members` were two copies of the same relationship → duplicate members, ghost members, inconsistent counts | Membership is derived from `students.team_id` only. There is no second list to drift |
| Email uniqueness compared against `s.email === email && email` — an empty email silently passed, and `passwordHash` was stored but never used to log in | `UNIQUE INDEX ON lower(email)`, email required, and real sign-in working |
| Category edits used `prompt()` and pushed mutable objects; deleting a category orphaned its students | Validated forms, `ON DELETE RESTRICT`; the API refuses to delete a field that has registrations and suggests deactivating it |
| Admin password `orbit-demo-26` compared in the browser, in cleartext, in the bundle | Removed. Admin auth is a scrypt hash in the database + HttpOnly session cookie; every `/api/admin/*` route checks it server-side |
| `heroImage` saved but never rendered; "wired in later" note left in the UI | Renders as the social preview image; uploaded logos/favicons are stored as assets and served from `/api/assets/:id` |
| Registration success screen had no account, no way back to the data, no way to edit anything | `/#/dashboard` with profile, team, field and security sections |
| No way to remove a student, transfer a leader, or leave a team | Team panel: rename, resize, rotate passcode, remove members, transfer leadership, leave/close team — with the leader-protection rules |
| Duplicate registrations on refresh/back-button | Registration is one transactional insert with unique indexes; the UI also refuses to show the form to a signed-in student |

### Design & front-end

| Problem | Fix |
| --- | --- |
| Generic "AI dark dashboard": cyan/blue glow, four-gradient page background, 54px grid overlay, glowing planet of rings, `backdrop-filter` header, uppercase mono everywhere | A warm paper-and-ink exhibition identity: `#f5f1e8` paper, deep forest ink, a single vermilion accent, hairline rules, real editorial typography, no glow, no glassmorphism |
| Decorative hero art in three variants (planet / cube / diamond) doing the same job | One hand-built orbital **plate** — fixed artwork independent of editable branding, with a proper caption and print treatment |
| Fonts loaded from a third-party CDN with three families and no preload | Fraunces (display) + Inter (text) self-hosted as Latin-subset variable woff2, preloaded, 187 KB total, `font-display: swap` |
| Repeated inline styles and one-off `style=""` attributes throughout the render functions | Design-system classes; only intentional sizing uses inline styles |
| No focus states, no labels tied to inputs in places, hover-only affordances | Visible `:focus-visible` rings, real `<label for>`, keyboard-operable modal with Escape, skip link, `aria-expanded` accordions |
| Animations that ignored `prefers-reduced-motion` | Every animation and reveal is disabled under reduced-motion; reveals are `IntersectionObserver`-driven, not scroll listeners |
| 850px/560px breakpoints with a fixed `58px` headline and a `display:none` nav | Fluid `clamp()` type, real mobile menu (aria-controlled), single-column forms, sticky nav offset |
| `crypto.randomUUID()` and `:has()` used without fallbacks; the whole app was one 1,500-line inline script | Modular ES modules, feature-detected observers, graceful `:has()` degradation (the radio card still shows a checked state) |
| Print produced a screenshot of a dark page | `@media print` programme-sheet rules |

---

## 4. Architecture

```
server/
  index.js        Express app: security headers, CSRF guard, API, HTML shell
  config.js       .env loader + config
  db.js           one query()/transaction() API over PGlite or node-postgres
  schema.js       portable DDL (single source of truth)
  seed.js         first-boot content
  security.js     scrypt hashing, tokens, throttling
  validation.js   server-side field validation + field-level errors
  http.js         sessions, guards, audit, error handler
  settings.js     JSON settings sections with cache
  serializers.js  student/team payloads (team + members + pending request)
  routes/         public, auth, student, admin
public/assets/
  app.css         design system
  js/main.js      boot + routes
  js/router.js    tiny hash router
  js/store.js     session/content state (server is the source of truth)
  js/api.js       fetch wrapper with typed errors
  js/ui.js        DOM helpers, toasts, modal, toasts, reveal, FAQ, icons
  js/pages/*.js   home, fields, journal, about, contact, register, auth,
                  dashboard, admin
tests/
  api.test.js     34 HTTP tests
  ui.test.js      20 jsdom flow tests
sql/
  supabase-setup.sql  readable copy of the schema
```

### Data model (the important invariants)

- `students.team_id` is the **only** record of membership. Member counts are
  always `COUNT(*) WHERE team_id = …` inside a transaction.
- `students.email` is unique (case-insensitive). One account per student.
- `teams` is unique on `(lower(school), lower(name))` — no duplicate team names
  within a school.
- A team has one `category_id`; a move approved for the leader updates the team
  **and** every member in the same transaction, so a booth is never split across
  fields.
- A team leader can't leave while teammates remain (transfer first), and can't
  shrink capacity below the current member count.
- Deleting a student with the leader role promotes the earliest remaining member;
  deleting the last member closes the team.

### Security

- Passwords and team passcodes: `scrypt` (N=16384, r=8, p=1) with per-secret salt.
- Session tokens: 32 random bytes; only the SHA-256 is stored, in an HttpOnly,
  SameSite=Lax cookie (`Secure` in production).
- CSRF: SameSite cookies **plus** an Origin check and JSON content-type
  requirement on every state-changing request.
- Login throttling per IP (10 student attempts / 10 min, 5 admin / 15 min).
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, Referrer-Policy,
  Permissions-Policy, HSTS in production.
- Authorisation is checked on the server for every route; admin pages are not
  merely hidden in CSS.
- Uploaded branding assets are size-limited (1.5 MB), MIME-whitelisted and
  served from the database, never from the filesystem.
- Audit log of registrations, team changes, approvals and admin edits.

---

## 5. Honest limitations

These are real and worth knowing before you rely on the site:

1. **Email verification and password reset are not implemented.** Students can
   sign in but there is no "forgot password" flow and no verification email, so
   an organiser must reset a lost password manually (`npm run admin:set-password`
   works for admins; for students, update the row or re-register). This is the
   single biggest account gap.
2. **No rate limiting beyond login throttling**, and the throttle is in-memory —
   it resets on restart and is per-instance. Put Cloudflare/Vercel in front for a
   real WAF.
3. **Asset uploads are capped at 1.5 MB and stored in Postgres.** Fine for a
   logo and favicon; not a media library. There is no delete-asset UI.
4. **Screenshots were not produced for this delivery.** No browser binary could
   be downloaded in this environment, so visual verification is via the running
   preview plus 20 jsdom flow tests. Layout was hand-checked at 360 px, 768 px
   and desktop widths in CSS; please eyeball it once on a real phone.
5. **The embedded PGlite database is single-process.** It is perfect for one
   school server; for serverless or multi-instance hosting you must set
   `DATABASE_URL` to a hosted PostgreSQL. There is no automatic migration tool
   for future schema changes — `schema.js` uses `CREATE TABLE IF NOT EXISTS`, so
   adding a column to an existing deployment needs a manual `ALTER TABLE`.
6. **No waiting-list, no judging/scoring module, no certificate generation.**
   Those existed only as stubs or not at all in the originals; they remain out of
   scope rather than half-built.
7. **Field change rules are global**, not per-field: the admin chooses
   "require approval", "leaders change instantly" or "locked" for the whole
   event. Per-category overrides would need another column and were not added.
8. **Accessibility is good but not audited.** Focus states, labels, contrast and
   reduced-motion are handled; a screen-reader pass and an axe audit are still
   recommended before a public launch.

---

## 6. Test status

```
npm test              → 34/34 passed
npm run test:ui       → 20/20 passed
```

Covered end to end: duplicate email, weak password, duplicate team name, wrong
passcode, cross-school join, field mismatch, capacity limit, seat counting,
session persistence across a reload, profile persistence in a new session,
leader-only team edits, capacity-vs-member-count, pending field requests,
approval fan-out to a whole team, registration open/close, branding propagation,
CSV export auth, leader succession on delete, category deletion guard, and the
admin session lifecycle. The jsdom suite additionally drives the real UI:
register → welcome → dashboard → profile save → field request → reload → sign out
→ admin sign in → approve request.

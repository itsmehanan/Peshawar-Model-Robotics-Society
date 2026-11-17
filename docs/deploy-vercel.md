# Deployed: peshawarmodelroboticssociety.vercel.app

**Status: live in production.** Last verified against the real deployment, not a
local build.

| | |
| --- | --- |
| Site | <https://peshawarmodelroboticssociety.vercel.app> |
| Health | <https://peshawarmodelroboticssociety.vercel.app/api/health> → `{"ok":true,"database":"postgres"}` |
| Vercel project | `peshawarmodelroboticssociety` (team HANAX) |
| Region | `bom1` — Mumbai, the closest Vercel region to Peshawar |
| Repository | `itsmehanan/Peshawar-Model-Robotics-Society`, branch `main` (auto-deploys) |
| Database | Supabase project `pmrs-olympiad`, PostgreSQL 17.12, `ap-south-1` |

## How it runs

The site is one serverless function, `api/index.js`, wrapped around the same
Express app the local server uses. There is no build step and no framework
preset.

```
/assets/*  → CDN (public/assets/*)      static, no-cache + ETag
/fonts/*   → CDN (public/fonts/*)       immutable, 1 year
everything else → api/index.js          pages + JSON API
```

The database is Supabase, reached over the transaction pooler on port 6543. The
function keeps a one-connection pool with `allowExitOnIdle`, so instances can
exit cleanly and the pooler is not exhausted.

## Environment variables (set on Vercel, production + preview)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase pooler URI (secret) |
| `DATABASE_SSL` | `true` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | `admin-003` (the sign-in ID, not an email) |
| `ADMIN_PASSWORD` | bootstrap password — **change it after signing in** |
| `ADMIN_NAME` | `HUSNAIN` |

## Signing in as an administrator

Go to `/#/admin` and sign in with the administrator ID and password:

| Field | Value |
| --- | --- |
| Administrator ID | `ADMIN-003` |
| Password | the `ADMIN_PASSWORD` environment variable |

The ID field accepts an identifier **or** an email address, case-insensitively,
so `ADMIN-003` and `admin-003` are the same account. There is no minimum length
and no `@` requirement — the identifier is compared against the stored value and
the password is checked only if it matches.

Set or reset it from a shell with database access:

```bash
npm run admin:set-password -- --email admin-003 --password "NewPassword123"
```

**What `ADMIN_EMAIL` actually does:** it is only used to create the first
administrator, and only when the `admin_users` table is empty. It never overwrites
an existing row, so changing it does not change an existing password — use the
command above, or **Admin → Account**, for that. Because the column is named
`email` and is checked by `lower(email)`, a short ID is stored there verbatim;
that is intentional, and the login lookup does not run the email validator.

## Deploying a change

**Automatic.** The project's production branch is `main`, and the GitHub
integration has "create deployments" enabled. Push or merge to `main` and Vercel
builds and promotes it to https://peshawarmodelroboticssociety.vercel.app on its
own — there is no manual step, and no token needed.

```bash
git push origin HEAD:main        # or merge a PR into main
```

Pushes to any other branch build a **preview** deployment (staged, not promoted),
which is what you want for review before it reaches the live domain.

Check what is live without opening the dashboard:

```bash
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_s9Bjhh5seR9SnLgcDRtch2nDRjqb&teamId=team_clprO4Bp2auNOJCw91hFa9vG&target=production&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

`readyState: READY` with `readySubstate: PROMOTED` means the domain is serving it.

### If auto-deploy ever stops

The usual cause is `main` falling behind the work: a long-lived branch that is
never merged keeps building previews while the domain stays on an older commit.
Merge it. If that is not it, check **Project → Settings → Git** and confirm the
Production Branch is still `main` and that the GitHub connection is healthy.

## What the first deploy caught

Shipping to a real host found four defects that local tests could not:

1. `includeFiles` was an array — Vercel rejects that with a 400 before building.
   It must be a single glob string (`{server,public}/**`).
2. `/api/*` returned Vercel's 404. A plain serverless file is mounted only at its
   own path; it does not get Next-style `/api/*` prefix routing, and the
   catch-all rewrite was excluding `api`. Only `assets`, `fonts` and the
   function's own path are excluded now.
3. Field-card artwork 404'd on every non-WebP browser: the helper appended
   `-sm.png` to a path that already ended in `.png`. A browser test now fetches
   every `<picture>` URL and fails on any non-200.
4. `/api/assets/<junk>` returned 500 rather than 404, because Postgres rejects a
   non-uuid against a uuid column.

Each is covered by a test, so they cannot come back silently.

## Before you advertise the link

- **Change the admin password** and confirm **Admin → Registration** is in the
  state you want.
- Fill in the parts only the society knows: exhibition date and venue, contact
  phone/email, and the real Instagram, Facebook, YouTube and TikTok URLs.
  Unconfigured platforms stay hidden, so nothing dead is published.
- `.vercel.app` is Vercel's domain, not the society's. For a permanent address,
  add a custom domain the society owns in **Project → Settings → Domains**. A
  differently named project such as `pmrs.vercel.app` cannot serve this
  deployment — that would be a project rename, and the rename is not
  recommended while the current address is being shared.

## Known limits of this deployment

- Hobby plan, single region, 30 s function limit. Fine for a school event; not
  sized for a registration stampede at the deadline.
- The Supabase free tier pauses inactive projects. Check the URL a few days
  before the event so a cold database is not a surprise on the day.
- Login throttling is in memory, so it is per function instance rather than
  global. Real credential stuffing would not be rate-limited across instances.
- No email verification or password reset — see `README.md` → *Honest
  limitations*.

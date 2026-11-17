# Deployed: peshawarmodelroboticssociety.vercel.app

**Status: live in production.** Last verified against the real deployment, not a
local build.

| | |
| --- | --- |
| Site | <https://peshawarmodelroboticssociety.vercel.app> |
| Health | <https://peshawarmodelroboticssociety.vercel.app/api/health> → `{"ok":true,"database":"postgres"}` |
| Vercel project | `peshawarmodelroboticssociety` (team HANAX) |
| Region | `bom1` — Mumbai, the closest Vercel region to Peshawar |
| Repository | `itsmehanan/Peshawar-Model-Robotics-Society`, branch `arena/79190411-peshawar-model-robotics-societ` |
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
| `ADMIN_EMAIL` | `organizer@peshawarmodelroboticssociety.org` |
| `ADMIN_PASSWORD` | bootstrap password — **change it after signing in** |
| `ADMIN_NAME` | `Event Organizer` |

## Signing in as an administrator

Go to `/#/admin` and use `ADMIN_EMAIL` with the bootstrap password. To change the
password, sign in and use **Admin → Account**, or run:

```bash
npm run admin:set-password
```

## Deploying a change

Pushes to the session branch do not auto-promote to the domain (the project's
production branch is `main`). Either:

- merge the branch into `main` and let Vercel build it, or
- deploy the commit explicitly:

```bash
curl -X POST https://api.vercel.com/v13/deployments \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"peshawarmodelroboticssociety","project":"prj_s9Bjhh5seR9SnLgcDRtch2nDRjqb",
       "target":"production","gitSource":{"type":"github","repoId":1460206921,"ref":"<sha>"}}' \
  -G -d teamId=team_clprO4Bp2auNOJCw91hFa9vG
```

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

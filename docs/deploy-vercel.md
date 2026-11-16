# Deploy this site to Vercel

Everything is prepared. The project `peshawarmodelroboticssociety` already
exists in your Vercel account (team **HANAX**) with its production environment
variables set, and the PostgreSQL database is already provisioned and its schema
applied. **All that is left is the build itself**, and that build needs a GitHub
connection that the automation in this session does not have.

---

## Why one manual step is needed

The app is a Node/Express server, so Vercel has to build it from the repository.
Vercel can only read the repository through a **GitHub Login Connection** on your
Vercel account. That connection is not set up, so Vercel refuses to link
`itsmehanan/Peshawar-Model-Robotics-Society`:

```
400 — Failed to link itsmehanan/Peshawar-Model-Robotics-Society.
You need to add a Login Connection to your GitHub account first.
```

Deploying the files directly is also not possible from here: this app ships
about 1.5 MB of rendered artwork and font binaries, and the deployment API
expects those files to be uploaded as part of the request.

## Option 1 — connect GitHub, then click Deploy (2 minutes, recommended)

1. In Vercel: **Settings → (your avatar) → Account → Integrations** or
   [vercel.com/account/login-connections](https://vercel.com/account/login-connections)
   → connect **GitHub** and grant access to
   `itsmehanan/Peshawar-Model-Robotics-Society`.
2. Open the existing project
   [vercel.com/hanax/peshawarmodelroboticssociety](https://vercel.com/hanax/peshawarmodelroboticssociety).
3. **Settings → Git → Connect Git Repository** → choose the repository, and set
   the **Production Branch** to
   `arena/79190411-peshawar-model-robotics-societ`
   (or merge that branch into `main` first and use `main`).
4. **Deployments → Deploy** (or just push a commit; the branch will build).

No build command is needed: `vercel.json` sets `framework: null`, uses
`npm ci --omit=dev` and routes everything to `api/index.js`.

## Option 2 — deploy from your own machine

```bash
git clone https://github.com/itsmehanan/Peshawar-Model-Robotics-Society.git
cd Peshawar-Model-Robotics-Society
git checkout arena/79190411-peshawar-model-robotics-societ

npm i -g vercel
vercel login
vercel link            # chooses your existing peshawarmodelroboticssociety project
vercel --prod
```

`vercel link` will reuse the environment variables that are already set, so you
do not need to type the database URL again.

---

## The domain

The Vercel project name gives you:

```
https://peshawarmodelroboticssociety.vercel.app
```

`pmrs.vercel.app` is a differently named project, so it cannot serve this
deployment. Once the domain is live and the site is verified, it is a single
rename (**Project → Settings → General → Name**, or `vercel domains`) to move to
`pmrs`. Confirm the domain with the society before advertising either address:
`.vercel.app` is Vercel's domain, not a domain the society owns. A custom domain
(such as `pmrs.org.pk`) added through **Project → Settings → Domains** is the
right long-term home.

## Environment variables already configured

| Variable | Status |
| --- | --- |
| `DATABASE_URL` | set — Supabase pooler, Mumbai (`ap-south-1`), port 6543 |
| `DATABASE_SSL` | `true` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | `organizer@peshawarmodelroboticssociety.org` |
| `ADMIN_PASSWORD` | set — **change it after signing in** (Admin → Account) |
| `ADMIN_NAME` | `Event Organizer` |

The database (project `pmrs-olympiad`, PostgreSQL 17.12) is live and all 12
tables are applied. First request fills in the default content and the admin
account.

## After the first deploy — three checks

```bash
curl -s https://peshawarmodelroboticssociety.vercel.app/api/health
# {"ok":true,"database":"postgres",...}

curl -sI https://peshawarmodelroboticssociety.vercel.app/ | head -3
# 200, text/html

curl -sI https://peshawarmodelroboticssociety.vercel.app/assets/art/hero.webp | head -3
# 200, image/webp
```

Then sign in at `/#/admin`, and fill in the parts only the society knows:
the exhibition date and venue, the contact phone/email, the real Instagram,
Facebook, YouTube and TikTok URLs (unconfigured platforms stay hidden), and the
event description.

> **Before advertising the link:** set a real `ADMIN_PASSWORD` (never the one
> shown above), and check that Admin → Registration is showing the state you
> want — open for entries, or closed.

# Deploying WakudOS

The app is a standard Next.js 14 app, deployable anywhere that runs Node 20. Below are the two recommended paths.

## Prerequisites (one-time)

1. **A Supabase project you own** — create it, then run `supabase/setup.sql` in its SQL Editor (see `supabase/README.md`). Note your **Project URL** and **anon public key** from Settings → API.
2. **A GitHub repo** — push this folder (see "Putting it on GitHub" below).

## Environment variables

Set these in your host's dashboard (never commit real values — `.env*.local` is gitignored):

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | **Server-only secret.** Add later for SharePoint sync. Leave unset for now. |

## Option A — Vercel (recommended for Next.js)

1. Go to **vercel.com** → **Add New → Project** → import your GitHub repo.
2. Framework preset auto-detects **Next.js** — no build settings to change.
3. Under **Environment Variables**, add the two `NEXT_PUBLIC_*` values above.
4. **Deploy.** You get a live `*.vercel.app` URL; every push to `main` redeploys.

## Option B — Render

1. Go to **render.com** → **New → Blueprint** and point it at your repo (it reads `render.yaml`).
2. In the service's **Environment**, fill in the env vars (they're declared in `render.yaml` with `sync: false`).
3. **Create** → Render builds and hosts at a `*.onrender.com` URL.

## Putting it on GitHub

From this folder:

```bash
git init
git add .
git commit -m "Initial WakudOS Next.js app"
git branch -M main
git remote add origin https://github.com/<you>/wakud-os.git
git push -u origin main
```

(`node_modules`, `.next`, and `.env*.local` are already gitignored.)

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase values
npm run dev                          # http://localhost:3000
```

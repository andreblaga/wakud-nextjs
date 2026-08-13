# Moving Wakud Plant Command to your own Supabase account

This guide switches the app from the old, unknown Supabase project to a fresh one **you** own. No coding required — it's mostly copy-paste. Set aside about 20 minutes.

You'll touch two places:
- **supabase.com** — the website where your database lives (steps 1–5)
- **The app's `.env` file** — already prepared for you, you just paste two values (step 6)

When you finish, the old account is fully disconnected.

---

## Step 1 — Create your Supabase account & project

1. Go to **https://supabase.com** and sign up (use a company email you control — e.g. your own).
2. Click **New project**.
3. Give it a name (e.g. `wakud-plant-command`), set a strong **database password** (save it somewhere safe), and pick the region closest to Oman (e.g. *Central EU* or *Asia – Mumbai/Singapore*).
4. Click **Create new project** and wait ~2 minutes for it to provision.

> **Tip:** The free tier is fine to start. Note that free projects *pause* after ~1 week of no activity — this is almost certainly what happened to the old one. Opening the dashboard un-pauses it. For production, the Pro plan avoids pausing.

---

## Step 2 — Build the database structure

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file **`setup.sql`** (in this folder), copy **everything**, and paste it into the editor.
3. Click **Run**.
4. You should see *"Success. No rows returned"* (a few green NOTICE lines are normal). This creates all 23 tables, the security rules, and the document storage bucket.

> If you ever need to start over, you can re-run `setup.sql` safely — it won't duplicate anything.

---

## Step 3 — Create your users

1. Go to **Authentication** (left sidebar) → **Users** → **Add user** → **Create new user**.
2. Create one user per person who needs access. Enter their email + a temporary password, and tick **Auto Confirm User** so they can log in immediately.
3. Suggested starting set (use your real emails):
   - a General Manager
   - an Operations user
   - a Sales user
   - a Finance user

You can create just one (a GM) to start and add the rest later.

---

## Step 4 — Give each user a role

The app shows different things based on role (GM sees everything; others see their area).

1. Open **`assign-roles.sql`** (in this folder).
2. Edit the four email/role lines to match the users you just created. Valid roles: `gm`, `operations`, `sales`, `finance`.
3. In **SQL Editor** → New query, paste it, and **Run**.
4. The query prints a table at the bottom confirming who has which role.

---

## Step 5 — Get your connection details

1. Go to **Project Settings** (gear icon) → **API**.
2. Copy these three values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Project ID / Reference ID** (the `abcd1234` part — also under *General*)
   - **Project API key → `anon` `public`** (a long string starting with `eyJ...`)

> The `anon` key is safe to put in the app. **Never** copy the `service_role` key into the app — that one is a master key and must stay secret.

---

## Step 6 — Point the app at your project

The app's connection file (`Wakud Plant Command/.env`) is already set up with blanks. Either edit it yourself or send me the three values and I'll drop them in.

To do it yourself, open `Wakud Plant Command/.env` and replace the placeholders:

```
VITE_SUPABASE_PROJECT_ID="<your Project ID>"
VITE_SUPABASE_PUBLISHABLE_KEY="<your anon public key>"
VITE_SUPABASE_URL="https://<your Project ID>.supabase.co"
```

Save the file.

---

## Step 7 — Run the app

From the `Wakud Plant Command` folder (a developer or I can run these):

```
npm install      # first time only
npm run dev
```

Open the address it prints (usually `http://localhost:8080`), log in with one of the users you created, and you'll see the dashboard — now reading from **your** database, which starts empty and ready for real data.

---

## Step 8 — Load your real data

Once you can log in, there are two ways to get live data in:

- **Type it into the app** — add deals, contracts, production plans, etc. through the screens.
- **Bulk import** — use the CSV templates in the `data-templates/` folder. Fill them in, then either import them via Supabase's **Table Editor → Insert → Import data from CSV**, or hand them to me and I'll load them.

See `data-templates/README.md` for which columns mean what.

---

## Quick reference — what's in this folder

| File | What it does |
|------|--------------|
| `setup.sql` | Builds the entire database structure. Run **first**, once, in the SQL Editor. |
| `grant-privileges.sql` | Table permissions for the API roles — without it every query fails `42501`. |
| `phase3-audit-log-policy.sql` | Lets the app write change records to the audit log. |
| `phase4-tasks.sql` | The To-Do board table. |
| `phase4-discussions.sql` | Chat channels + messages (and turns on Realtime). |
| `roles-admin-viewer.sql` | Allows the `admin` and `executive_viewer` roles. |
| `roles-rls.sql` | **Security lock-down.** Per-role write rules, no signed-out access. Run **last**, before real data. |
| `assign-roles.sql` | Gives your users their roles. Run after creating users. |
| `SETUP-CHECKLIST.md` | This guide. |
| `data-templates/` | Blank CSV templates for importing real data. |

Run order: `setup` → `grant-privileges` → `phase3-audit-log-policy` → `phase4-tasks` → `phase4-discussions` → `roles-admin-viewer` → `roles-rls` → `assign-roles`. All are safe to re-run.

## If something goes wrong

- **"relation already exists" / NOTICE lines when running `setup.sql`** — harmless, ignore.
- **Login fails** — check the user is *confirmed* (Step 3) and the `.env` values match exactly (no extra spaces/quotes).
- **App loads but everything is empty** — that's expected on a fresh project until you add data (Step 8).
- **Dashboard shows old demo numbers** — those came from `seed.ts` placeholder data in the code, not your database. Flag it and I'll remove them so the app shows only live data.

# WakudOS — next steps runbook

_Written 2026-08-19. Do the steps in order; the numbering is dependency order, not priority order. Each step says who does it and how long it should take. **[Andre]** = you, in a browser or a terminal. **[CC]** = paste the prompt into Claude Code. **[Team]** = someone else at Wakud._

Where a step needs Claude Code, the prompt is in a fenced block — paste it verbatim.

---

## STATUS — updated 2026-08-19

**Steps 0 – 5 are DONE. The sync is live and carrying real data.**

| Step | State |
|---|---|
| 0 · Line endings | ✅ `27cb78b` — churn gone; placing `.gitattributes` was enough, no renormalize needed |
| 1 · Commit Phase 5 | ✅ `897388e`, pushed |
| 2 · Migration | ✅ run + verified, including a functional double-upsert test of the ON CONFLICT target |
| 3 · Regenerate types | ✅ `8bec02d` |
| 3c · Units on Inventory | ✅ `c96b113` — `lib/units.ts`, unit-aware reorder |
| 3d · `safety_stock_unit` + tests | ✅ `197e964` — Vitest, 16 tests, mutation-checked |
| 4 · Vercel env vars | ✅ all seven present (five Production-only by design — secrets deliberately kept out of Preview) |
| 5 · Run the sync | ✅ **three successful runs**, two local + one from production |
| 9 · Documents page | ✅ `2d94548` — server-filtered, paginated, 8,186 files |
| — · Global search | ✅ `4a24b84` — TopBar box was decoration; now real, RLS-scoped, injection-tested |
| — · Production derivation | ⏳ code written and verified; **migration `phase5c` not yet run** |
| 5c · Read-only detail views | ✅ `/deals/[id]`, `/contracts/[id]`, `/production/[id]`, `/finance/invoices/[id]` + a `/contracts` index; search now links to records, not lists |
| 5d · Archive, not delete | ⏳ code written and verified; **migration `phase5d-archive.sql` not yet run — run it before deploying** |
| 5e · Feedback module | ✅ `/feedback` — submissions, threaded replies over Realtime, triage, task conversion, notifications. Migration `phase6-feedback.sql` already run; types regenerated |

**First sync results, verified against the database:** 8,186 documents across all 16 top-level folders (5.8 GB, bytes stay in SharePoint) · 108 `stock_levels` rows, 9 products × 12 months, 96 KL + 12 Kg · 0 errors · **0 duplicates after three runs** · every row rewritten in place by the latest run · B100 reconciles to the source workbook to the decimal.

**Remaining: Steps 6 – 11 below.** The two that unblock the most are Step 6 (the team's source questions) and Step 9 (the Documents page — 8,186 rows that no screen reads yet).

---

## Step 0 — Commit `.gitattributes` · [Andre] · 2 min

**Do this first.** The working tree was showing 28 modified files with 2,546 insertions and 2,546 deletions and not one real change — CRLF/LF churn from Windows tooling. If that gets committed on top of real work, the diff is unreviewable and stays that way in the history.

`.gitattributes` is already in the project root (written 2026-08-19). **Placing it was enough.** Git applies attributes immediately when computing status, so with `* text=auto eol=lf` the 26 phantom-diff files now compare equal against the committed blobs — those were already LF, only the working-tree copies had been flipped to CRLF. `git add --renormalize .` is therefore **not needed** and would be a no-op.

Verified 2026-08-19: `git diff --numstat` reports only four files, all with genuinely asymmetric counts (`BACKLOG.md` 4/1, `BUILD-PLAN.md` 8/4, `lib/nav.ts` 2/0, `project.md` 31/0) — the real Phase 5 doc edits. The other 26 emit only the informational `warning: CRLF will be replaced by LF in …`, which is git telling you it is normalising on write. That warning is expected and harmless.

```powershell
cd C:\Users\andre\Projects\wakud-os

git add .gitattributes
git commit -m "chore: normalise line endings to LF via .gitattributes"
git status -s
```

Expect four ` M` lines (the four above, which go in with Step 1) and the untracked additions.

> **If you hit `fatal: Unable to create '.../.git/index.lock': File exists`** — that is a stale lock, not a running git. Close any editor or Claude Code session that might hold the repo, confirm no `git.exe` is running, then delete it: `Remove-Item .git\index.lock`. Note that Cowork's device bridge cannot delete files, so a lock left by a Cowork `git` call has to be removed from your own terminal.

> Decide on `.claude/` while you are here — `settings.local.json` is Claude Code's local permission allow-list. Committing it shares the allow-list with anyone who clones; gitignoring it keeps it personal. Either is fine, just pick one.

## Step 1 — Commit the Phase 5 work · [Andre] · 2 min

```bash
git add app/api/sync app/sync lib/sharepoint scripts supabase/phase5-sharepoint-sync.sql docs
git add lib/nav.ts project.md BUILD-PLAN.md BACKLOG.md
git commit -m "Phase 5: read-only SharePoint sync (document index + stock levels) + source audit

- lib/sharepoint: GET-only Graph client, delta traversal, pinned-path source
  registry, idempotent upserts, per-run logging
- admin-gated POST /api/sync/sharepoint; /sync status page
- supabase/phase5-sharepoint-sync.sql: sync_runs, documents provenance +
  source_ref upsert key, stock_levels.unit
- scripts/verify-sharepoint.mts smoke test (green: 14,393 items, 8,186 docs,
  108 stock rows, 29s)
- docs/sharepoint-findings.md: 10 of 11 nominated sources cannot populate their
  target table; reasons and questions recorded per source
- docs/pdf-templates.md + docs/templates/: invoice, ISCC PoS, forecast report,
  page snapshot drafts"
git push
```

Vercel will build on push. It will succeed — but `/sync` won't work in production until Step 4.

---

## Step 2 — Run the migration · [Andre] · 2 min

Supabase dashboard → project **`ftrtekdiabttvjlfgisy`** → SQL Editor → paste the whole of `supabase/phase5-sharepoint-sync.sql` → Run. It is idempotent, so running it twice is harmless.

Then run these four verification queries and check the results:

```sql
select to_regclass('public.sync_runs') is not null as sync_runs_exists;
-- expect: true

select column_name from information_schema.columns
 where table_name = 'documents' and column_name like 'source%' order by 1;
-- expect: source, source_folder, source_modified_at, source_path, source_ref

select indexname from pg_indexes
 where tablename = 'documents' and indexname = 'documents_source_ref_uidx';
-- expect: one row. This is the sync's ON CONFLICT target — without it the
-- document upsert fails with 42P10.

select column_name, column_default from information_schema.columns
 where table_name = 'stock_levels' and column_name = 'unit';
-- expect: unit | 'tonnes'::text
```

If the third query returns nothing, stop and tell me — the document index cannot upsert without that index.

---

## Step 3 — Regenerate the typed client · [Andre + CC] · 5 min

### 3a. Authenticate the Supabase CLI first · [Andre]

`supabase gen types --project-id` talks to the **Management API**, which needs a personal access token. The anon and service-role keys in `.env.local` are a different credential and will not work here.

Run this in **your own PowerShell**, not through Claude Code — it opens a browser and needs to hand the token back to an interactive session:

```powershell
npx supabase login
npx supabase projects list     # should list wakud-nextjs / ftrtekdiabttvjlfgisy
```

The token is stored under `~/.supabase` and persists, so this is a one-time step.

> **Never paste a Supabase personal access token into a chat, a prompt, or a commit.** It is account-wide Management API access — strictly more powerful than the service-role key. `supabase login` keeps it on disk locally, which is what you want. If one ever leaks, revoke it at https://supabase.com/dashboard/account/tokens.

### 3b. Regenerate and clean up · [CC]

⚠️ **Do not use `> lib/supabase/types.ts`.** The CLI writes its *errors* to stdout, so a failed run redirected that way silently replaces your types file with a one-line JSON error blob. Always generate to a temp file, verify it looks like TypeScript, then move it. (Claude Code caught this on 2026-08-19 before any damage was done.)

```
Regenerate the Supabase types for WakudOS, then remove the temporary casts that
exist only because the schema is ahead of the types.

1. Generate to a temp file, never straight over types.ts — the CLI writes errors
   to stdout, so a failed run would overwrite the file with an error blob:

     npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > types.new.ts

   Then check types.new.ts actually starts with TypeScript (an `export type Json`
   or `export type Database` declaration) and is more than a few hundred bytes.
   Only if it does, replace lib/supabase/types.ts with it and delete the temp file.
   If it contains an error payload instead, stop and report it.

2. Confirm the regenerated file contains: a `sync_runs` table; `source`,
   `source_ref`, `source_path`, `source_folder`, `source_modified_at` and
   `synced_at` on `documents`; and `unit` on `stock_levels`. If any are missing,
   stop rather than proceeding.

3. Remove the now-unnecessary casts:
   - lib/sharepoint/sync.ts — the two `.from("sync_runs" as any)` calls (the insert
     that opens the run and the update that closes it), and the
     `client.from(table as never) as any` in upsertChunked. That helper takes a
     runtime table name, so it may still need a cast — if so narrow it to the
     generated table-name union rather than `never`, and update the comment.
   - app/sync/page.tsx — the `.from("sync_runs" as any)` in the run-history query;
     the hand-written `Run` and `AreaResult` types can now derive from Database.

4. Regenerating may surface NEW type errors, most likely from stock_levels gaining
   `unit`. Fix them properly — no `as any`, no `@ts-ignore`. If a fix needs a
   product decision rather than a code change, stop and say what the decision is.

5. Run `npx tsc --noEmit` then `npm run build`. Both must pass.

6. Commit as: "chore: regenerate Supabase types for phase 5; drop sync_runs casts"

Do NOT run `npm audit fix --force` — it breaks the next@14.2.35 pin.
```

## Step 3c — Make the Inventory page unit-aware · [CC] · 30 min

**Decision taken 2026-08-19 (Andre): display each row's real unit. Do not convert.**

Converting KL to tonnes needs a confirmed density per material, and nobody has confirmed one. A converted figure looks authoritative while resting on a textbook guess; a figure labelled KL is simply true. Conversion can be layered on later without undoing this.

Must land **before** Step 5, because Step 5 is what first puts KL into `stock_levels`.

```
The stock_levels table now has a `unit` column (values: 'tonnes', 'KL', 'Kg').
Rows written by the SharePoint sync carry the source workbook's unit — the Barka
inventory workbook records everything in KL except the antioxidant, which is Kg —
while the Inventory page currently hardcodes tonnes.

Decision from Andre: DISPLAY each row's real unit. Do NOT convert to tonnes.
Converting needs a confirmed density per material and none is confirmed; a
converted number would look authoritative while resting on a guess.

1. app/inventory/page.tsx — add `unit` to the stock_levels select, and replace the
   hardcoded unit="t" on the UCO and B100 KPI cards (around lines 156-157) with the
   unit from the row the card is built from. Show the unit in the stock table too.

2. Cross-product aggregates. If any figure sums or compares across products, it is
   now summing mixed units and is meaningless. Either scope each aggregate to a
   single unit, or drop it. Do not silently sum KL and Kg. If you find one, say
   which and what you did.

3. lib/reorder.ts — this is the part that matters most. detectReorderFlags compares
   closing_stock against safety_stock_level. Those are two numbers that may now be
   in different units: synced rows are KL, a hand-entered safety level defaults to
   tonnes. Make the comparison unit-aware: only compare when the units match, and
   when they don't, do NOT raise a below-safety alert — surface a distinct warning
   naming the product and the two units instead. A wrong reorder alert is worse
   than a missing one.

4. lib/schemas.ts + app/inventory/stock/StockForm.tsx — add `unit` to the create/edit
   form as a select of tonnes / KL / Kg, defaulting to tonnes (matching the DB
   default), so hand-entered rows declare their unit rather than implying one.

5. Anywhere else that renders a stock number — check app/page.tsx (dashboard) and
   lib/notifications.ts, since the low-stock notification reuses detectReorderFlags.

Run `npx tsc --noEmit` and `npm run build`; both must pass. Commit as
"Inventory: display stock units instead of assuming tonnes; make reorder unit-aware".

Do NOT run `npm audit fix --force` — it breaks the next@14.2.35 pin.
```

Once densities are confirmed with the team, converting becomes a display-layer change on top of this, not a rewrite.

## Step 3d — Make the safety level self-describing, and keep the tests · [Andre + CC] · 30 min

Two things surfaced by Step 3c, both cheapest to fix **before** the first sync run writes 108 rows.

**Schema decision (2026-08-19):** add `stock_levels.safety_stock_unit`, not a row-level `source` column. `unit` describes the measurement columns; `safety_stock_level` is a different quantity and needs its own unit — because the sync upserts on `(product, month)`, overwriting the figures and `unit` but never the safety level. A row a person created in tonnes becomes, after a sync, a hybrid: KL figures from the workbook, a tonnes safety level from the human. Row-level provenance cannot describe a row whose two halves have different provenance. A unit belonging to the safety level can.

**Second issue:** `setup.sql` declared `safety_stock_level DECIMAL DEFAULT 20`. The sync never writes that column, so every synced row would silently claim a safety level of 20 nobody chose — and once units line up, reorder alerts would fire against a fabricated number. The column is nullable and the table is currently empty, so dropping the default costs nothing today and is a cleanup job after Step 5.

### 3d-i · [Andre] — run the migration

SQL Editor → paste `supabase/phase5b-stock-safety-unit.sql` → Run. Verification query is in the file's footer.

### 3d-ii · [CC] — wire it, and promote the throwaway tests

```
Two follow-ups to the units work in c96b113.

A. safety_stock_unit
I've added supabase/phase5b-stock-safety-unit.sql and Andre has run it. It adds
stock_levels.safety_stock_unit (TEXT NOT NULL DEFAULT 'tonnes') and drops the
DEFAULT 20 on safety_stock_level so NULL now means "no threshold set".

1. Regenerate types (temp file first, verify it's real TypeScript, then move —
   the CLI writes errors to stdout).
2. lib/reorder.ts — replace the SAFETY_UNIT = tonnes assumption with the row's
   actual safety_stock_unit. The comparison stays unit-aware; it just now reads a
   real column instead of assuming. Keep the UnitMismatch path for rows where the
   two units genuinely differ.
3. Treat safety_stock_level IS NULL as "no threshold set": never below-safety,
   never a unit mismatch, no alert. NULL is not zero.
4. lib/schemas.ts + StockForm — expose safety_stock_unit alongside the existing
   unit select, and let safety_stock_level be left empty rather than forced.
   Make sure the EDIT page fetches both new fields — the same class of bug you
   caught where the edit select didn't fetch `unit` and would silently rewrite a
   synced KL row to tonnes.
5. app/inventory/page.tsx — where a safety level is shown, show its unit too.

B. Keep the tests
You verified reorder.ts with 7 checks compiled out-of-tree into a scratchpad, and
said they live outside the repo. That's the most valuable test coverage this
project has and it's about to be thrown away. Promote it:

6. Add Vitest (dev dependency, `npm test` script, minimal config — no Playwright).
7. Port those 7 checks into lib/reorder.test.ts as real tests, including the one
   that matters: 5 KL against a 20 t safety level must raise no alert and must
   report the mismatch.
8. Add the NULL-threshold cases from A3 while you're in there.

Run npm test, npx tsc --noEmit and npm run build; all three must pass. Commit as
"Stock: safety level carries its own unit; NULL means unset; add Vitest + reorder tests".

Do NOT run `npm audit fix --force` — it breaks the next@14.2.35 pin.
```

## Step 4 — Set the production env vars in Vercel · [Andre] · 5 min

Vercel → the wakud-nextjs project → Settings → Environment Variables. The deployed app cannot see your laptop's `.env.local`, so without this the sync works locally and fails in production.

Add all seven, for **Production and Preview**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env.local` — **server-only, never `NEXT_PUBLIC_`** |
| `MS_TENANT_ID` | from `.env.local` |
| `MS_CLIENT_ID` | from `.env.local` |
| `MS_CLIENT_SECRET` | from `.env.local` |
| `SHAREPOINT_SITE_URL` | `https://netorgft11912468.sharepoint.com/sites/Barka-Operations-Hub` |

> Copy `SHAREPOINT_SITE_URL` from the table above, **not** from `.env.local` — the local line has a trailing `# comment` after the closing quote. Next's parser strips it; Vercel's field would keep it and the site lookup would 400.

Redeploy after saving (Vercel doesn't apply new env vars to an existing build).

---

## Step 5 — Run the sync for real · [Andre] · 3 min

Local first, because a failure is easier to read:

```bash
npm run dev
```

Sign in as your admin account → **Data Sync** in the sidebar under System → **Run sync now**. It takes 40–70 seconds (14,393 items, then a 245 KB workbook).

Expect:

- **Document index** — status `ok`, read ≈ 8,186, upserted ≈ 8,186, errors 0
- **Inventory — monthly stock by material** — status `ok`, read 108, upserted 108, errors 0
- **10 further rows** with status `blocked`, all zeros, each with its reason
- Documents-indexed tile ≈ 8,186

Then **click Run sync now a second time.** This is the idempotency check: upserted should be the same number again and the documents tile must **not** roughly double. If it does, the `source_ref` unique index didn't take — stop and tell me.

Then check the data landed:

```sql
select count(*) from documents where source = 'sharepoint';           -- ≈ 8186
select source_folder, count(*) from documents
  where source = 'sharepoint' group by 1 order by 2 desc;             -- 16 folders
select product, unit, count(*) from stock_levels group by 1,2;        -- 9 products, KL/Kg
select * from sync_runs order by started_at desc limit 2;             -- 2 rows, status success
```

Finally repeat once on the deployed Vercel URL to prove Step 4 worked.

---

## Step 5b — Ship the production derivation · [Andre + CC] · 15 min

Code is written, merged onto CC's latest `sync.ts`, typechecked and verified against the live workbook (3 months, 0 invented rows). **Not yet committed, and its migration has not run.** Do these in order — `sources.ts` already marks production `active`, so pushing before the migration makes the next sync report that area red.

1. **[Andre]** SQL Editor → `supabase/phase5c-production-from-inventory.sql` → Run.
2. **[CC]** Regenerate types (temp file first), drop the temporary `as any` around the `production_plan` `.eq("source","manual")` query in `lib/sharepoint/sync.ts`, run `npm test` + `tsc --noEmit` + `npm run build`, commit everything outstanding as *"Production: derive monthly output from the inventory workbook"*, then `git push`.
3. **[Andre]** `/sync` → Run sync now. Expect a new **Production — monthly output** row: read 3, upserted 3, with two warnings in its note.

⚠️ **Two source-data problems the derivation exposed.** Both are real and both belong in the team email:
- **The yield is impossible.** Jan: 9.0 KL UCO in → 17.26 KL B100 out (192%). Feb: 17.0 → 39.3 (231%). Transesterification is ~1:1 by mass. Either UCO consumption is under-recorded or "Produced" means something else. This is the mass balance ISCC audits.
- **Glycerol output is 0 in every month** while the tank level sits at a constant 96.8 KL. Byproduct production isn't recorded at all — a second hole in the mass balance, and nothing for the deal-economics glycerin assumption to be checked against.

Also: February shows **15 KL wastage against 39.3 KL produced (38%)**. Possibly a tank transfer logged as wastage. Worth asking.

## Step 5c — Read-only detail views · [CC] · P1, before showing anyone

**✅ Done 2026-08-20.** Four detail pages plus a `/contracts` index. Every record in those four modules is now openable by any signed-in user — the Edit button is the only thing behind a role check, and an edit route that turns a reader away now sends them to that record's read-only page instead of out to a list. Global search links to records rather than to a pre-filtered list. Per-record history reads `audit_log` for the entity, and `summarizeChange()` names the fields that actually moved (the Change Log used to say "24 fields changed" on every save, because it counted the union of keys across an asymmetric before/after pair).

*Original brief, for the record:*

**This blocked Step 11.** Every `[id]` route was an edit form that redirected users without write access, so the four executive-viewers could open lists and nothing else. Faris is your CEO.

```
WakudOS has no read-only detail view for any record. Every [id] route is an edit
form that redirects anyone without write access (see app/deals/[id]/edit/page.tsx:11),
so the executive_viewer role — which is read-only by design — can see list pages
and cannot open a single record anywhere in the app.

Build read-only detail pages: /deals/[id], /contracts/[id], /production/[id],
/finance/invoices/[id].

- Server components via lib/supabase/server.ts so RLS applies. Readable by any
  signed-in user; no redirect for read-only roles.
- Show the record's fields in a clean read layout reusing components/ui.tsx —
  not a disabled form.
- An "Edit" button behind RoleGate, linking to the existing /[id]/edit route.
  Users who can't write simply don't see it.
- For deals, show the computed economics (cost, revenue, profit, margin,
  profit/tonne) with the DEAL_ASSUMPTIONS basis note — same provisional-figures
  warning the form carries.
- Where a record has related rows (contract volumes, production confirmations,
  audit history from audit_log for that entity_id), show them read-only.
- Repoint global search results at these detail pages instead of list pages, and
  drop the ?q= workaround where it's no longer needed.

Also add a /contracts index page — contracts currently only render inside
/sales-forecast, so search has no "see all" target for them. Same DataTable
pattern as /deals.

Run npm test, npx tsc --noEmit and npm run build. Commit as
"Read-only detail views for deals, contracts, production and invoices".
```

## Step 5d — Archive, not delete · [CC] · P2

**⏳ Code done 2026-08-20 — the migration is not run yet, and it must go first.**

1. **[Andre]** SQL Editor → `supabase/phase5d-archive.sql` → Run. **Before deploying the app release**, not after: the list and detail pages select `archived_at`, so against a database without those columns those pages show their error state.
2. **[Andre]** Regenerate types if you want to be sure they match — `lib/supabase/types.ts` already carries the ten new columns by hand, so a regeneration should change nothing but formatting.
3. **[Andre]** Spot-check: archive a test deal from `/deals/<id>`, confirm it drops off `/deals`, comes back under **Show archived** muted with an **Archived** badge, appears in the Change Log as `archive`, and that **Restore** puts it back.

What shipped: `archived_at` / `archived_by` on deals, contracts, invoices, raw material orders and shipments, each indexed. Archiving is an UPDATE through `lib/archive.ts` and `app/archive/actions.ts`, gated by the same `requireWriter(domain)` as the edit actions and recorded in `audit_log` under its own `archive` / `unarchive` action. Lists filter `archived_at IS NULL` by default with a URL-backed **Show archived** toggle; KPI figures always count live rows only, so an archived invoice never shows up in "outstanding". **No DELETE policies were added and none should be.**

**Still open:** raw material orders and shipments have the columns, the filter and the toggle but no detail page, so nothing in the UI archives them yet — that lands when those two get read-only detail views of their own.

Decision 2026-08-19: **no hard delete anywhere.** The RLS matrix already sets `allow_delete = false` on every business table and that stays. `audit_log.entity_id` has no foreign key, so deleting a record orphans its own Change Log history.

*Original brief, for the record:*

```
Add archiving to WakudOS. Do NOT add hard delete, and do NOT add DELETE policies
to supabase/roles-rls.sql — allow_delete = false is deliberate. audit_log.entity_id
has no FK, so a hard delete would leave Change Log entries pointing at records that
no longer exist, and a voided tax invoice must remain on file.

1. New migration: add archived_at TIMESTAMPTZ and archived_by UUID REFERENCES
   auth.users(id) to deals, contracts, invoices, raw_material_orders and shipments.
   Archiving is an UPDATE, which the existing per-role write matrix already permits
   for the right roles — no policy changes needed. Index archived_at.
2. Server actions to archive and unarchive, role-gated the same way the edit
   actions are, and routed through lib/audit.ts. An archive is the single most
   important thing to record.
3. List pages filter archived_at IS NULL by default, with a "Show archived"
   toggle. Archived rows render muted with an "Archived" badge.
4. Archive button on the read-only detail views from the previous step, behind
   RoleGate, with a confirm step.
5. Unit tests for the action guards.

Run npm test, npx tsc --noEmit and npm run build. Commit as
"Archive instead of delete for business records".
```

## Step 5e — Feedback module · [CC] · ✅ Done 2026-08-20

`supabase/phase6-feedback.sql` was already run, so this one needs nothing from Andre beyond looking at it. `lib/supabase/types.ts` was regenerated against the live database; the only diff against the hand-maintained file was the two new tables, which confirms the `archived_at` / `archived_by` columns added by hand in `a2a50c1` matched what the generator emits.

What shipped:

- **`/feedback`** — everyone signed in sees every item, executive_viewer included. Status and category filters live in the URL; the default view is the open queue, so archived items and anything already done are out of the way until asked for.
- **`/feedback/new`** — title is the only required field. `submitted_by` is stamped from the session and never read from the form; the RLS policy insists it match `auth.uid()` regardless.
- **`/feedback/[id]`** — the item and its thread, with replies arriving over Realtime the way Discussions does. Comments post through a server action so `author_id` comes from the session, and the returned row is appended locally, so a reply lands even where the socket cannot connect.
- **Triage** (admin/gm) — status, resolution, and "Create task from this", which seeds a `tasks` row from the title and description and links the two. The link renders from both ends: the feedback item shows its task, the To-Do card shows "From feedback".
- **Declining requires a reason**, checked in the server action rather than only in the form — server actions are reachable by direct POST, and a request that vanishes without explanation is how a feedback channel dies.
- **Notifications** — admin/gm see anything still at status `new`; a submitter sees their own items whose newest comment is by someone else and newer than anything they have said on it. Both derived live from timestamps, no read-state table, deduped on `feedback:<id>` so one item never appears twice.

**The `executive_viewer` exception is deliberate and tested.** Feedback is not business data. A suggestion box the CEO cannot post to is not a suggestion box, so submitting and commenting are gated on being signed in and nothing else — the same exception Discussions makes. Triage is the opposite and stays with admin/gm.

## Step 6 — Send the team the source questions · [Andre → Team] · 10 min

This is the real unblock and everything in Phase 5 beyond stock depends on it. `docs/sharepoint-findings.md` has the full detail; the headline ask is one thing:

> **One "App Export" tab per data area: one sheet, one row per record, the columns the app needs, in agreed units.**

That converts nine of the ten blocked areas from fragile pinned-cell-range parsing into something that keeps working when someone inserts a row.

Specific questions, in the order I'd ask them:

1. **Production** — `Sales-Production MAHER.xlsx` is empty. Where is monthly output recorded now? *(Cheapest fix on the list: daily B100 and glycerol output already exist in the inventory workbook, so `production_plan` could be derived from that and need no new file at all.)*
2. **Inventory dates** — the BIODIESEL summary block is headed "July / August / Sept" but reports exactly the figures that sit in the **Jan / Feb / Mar 2026** daily rows. Which is right? Until this is answered nobody should read the Inventory page as 2026 truth.
3. **Stock unit conversion factor** — the inventory workbook records everything in KL (antioxidant in Kg). *(The display decision is already made: the app shows the real unit rather than converting — see Step 3c. This question is about unlocking optional conversion later.)*

   Don't ask for densities in the abstract — **ask whoever maintains the ISCC mass balance.** `11_ESG_and_Sustainability/ISCC/2025 - CoC/ongoing Summary mass - 25.xlsx` states *"Unit: MT"*, while the inventory workbook is in KL. So somebody at Wakud is already converting between the two, and that factor is the one that has to match for the ISCC audit to reconcile. Ask them:
   - What factor do you use to go from KL to MT, per material?
   - Is it quoted at standard conditions? EN 14214 specifies biodiesel density at 15 °C, and mass balance has to use standard conditions or the audit trail won't reconcile.

   A textbook density would be a guess. Theirs is the number that already has to be right.
4. **Contracts** — is `Ultimate_Biodiesel_Sales_Tracker.xlsx` meant to be filled in, or do signed terms live only in the Word offtake agreements?
5. **Deals** — is there a trade pipeline anywhere, or are deals only ever created in the app? *"They're app-native" is a perfectly good answer and stops the search.*
6. **Forecast** — which sheet and row range of `20260214-Wakud BioDiesel Model.xlsx` is the agreed monthly forecast, and is it BASE case only?
7. **Invoices** — where is the receivables ledger? If it's in the accounting system, that's a separate integration to scope.
8. **Quality** — do the QC panel results exist anywhere but the labs' PDFs?
9. **ISCC** — can the `#REF!` chain in `ongoing Summary mass - 25.xlsx` be repaired at source?
10. **Logistics / procurement** — is there vessel/BoL tracking and a single running order register, or is each one its own file?

Say the word and I'll draft this as an email in your voice.

---

## Step 7 — Chase IT for the secret expiry · [Andre → Oryx] · 2 min

One line to Oryx: **what date does the client secret for the WakudOS app registration expire?**

It's recorded nowhere — not in `.env.local`, not in the repo. When it lapses the sync stops with a bare 401 (the Graph client now names that case, but it still stops). Once you have the date, write it into `docs/sharepoint-integration.md` §7 and I'll set you a reminder two weeks before.

---

## Step 8 — Finance sign-off on the deal assumptions · [Andre → Finance] · async

Six questions in `docs/deal-economics.md`. The one that matters most: **glycerin price is $450/t in one place and $220/t in another** — a ~2× swing on byproduct revenue that flows into every deal's profit, margin and go/no-go call. Also VAT reclaimable or not, funding rate flat vs annualised, glycerin yield, go thresholds, and the canonical `payment_type` value.

Each is a one-line edit in `DEAL_ASSUMPTIONS`. Until they're signed off, every profit figure the app shows is provisional — which is why the forecast report prints its basis on the face of the page.

---

## Step 9 — Make the documents index visible · [CC] · half a day

The sync writes 8,186 rows that no screen currently reads. This is the highest-value build left, needs nothing from the team, and is the one thing you could show people before the rest is ready.

```
Build a Documents page for WakudOS at app/documents/page.tsx.

Context: the SharePoint sync (lib/sharepoint/) has indexed ~8,200 files from the
Barka Operations Hub library into the `documents` table. Rows carry:
source='sharepoint', source_ref (Graph item id), source_path (full library path),
source_folder (top-level numbered folder), document_type (a classification —
finance, supply_chain, legal, operations, sales, iscc, quality, hse, maintenance,
pdf, document, spreadsheet, other), file_name, file_url (SharePoint webUrl),
file_size_bytes, mime_type, uploaded_by, source_modified_at.

Requirements:
- Server component, reads via lib/supabase/server.ts so RLS applies. Reads are
  open to any signed-in user; there are no writes on this page.
- Reuse components/DataTable.tsx and components/ui.tsx. Add the page to
  lib/nav.ts (section "Compliance", icon FileStack, NOT adminOnly).
- Filters: free-text search on file_name, plus dropdowns for source_folder and
  document_type. Server-side filtering via searchParams — do NOT load 8,200 rows
  into the client.
- Paginate at 50 rows per page, server-side with .range().
- file_name links to file_url, target="_blank" rel="noopener". Make it clear in
  the UI that the file opens in SharePoint and SharePoint permissions still
  apply — the app only holds the index, never the bytes.
- Show a human file size and a formatted date using lib/dates.ts.
- Wire ExportExcelButton so the filtered view exports, matching how Deals does it.
- Empty and error states via the existing DataTable states.

Then run npx tsc --noEmit and npm run build; both must pass. Do not run
`npm audit fix --force` (breaks the next@14.2.35 pin).
```

---

## Step 10 — Then, in whatever order suits · [CC]

Roughly descending value. Do them one at a time, each its own commit.

**a. Unit tests for the two things that cost money if wrong.**
```
Add Vitest to WakudOS and write unit tests for the two pure modules where a
silent regression has real consequences:

1. lib/deal-economics.ts — cover the documented formula: VAT applied to
   buy+shipping+trucking, funding cost applied only when prefunded, glycerin
   revenue added, and the go/no-go thresholds at their boundaries. Assert against
   figures worked by hand, not against the code's current output.
2. lib/permissions.ts — assert the whole role matrix, and specifically that
   canWrite(gm, "users") passes (gm holds "*") while isAdmin(gm) is false. That
   distinction is the reason admin areas gate on isAdmin, and a test should fail
   loudly if anyone changes it.
3. lib/sharepoint/extractors/stock.ts — the `aggregate` function is exported and
   pure. Test that opening_stock carries the previous month's closing, that the
   first month backs out its own first-day movements, and that a month with no
   level rows inherits the previous closing.

Keep it to `npm test`; don't add Playwright. Then npm run build must still pass.
```

**b. Show the stock unit on the Inventory page.** `stock_levels.unit` now exists and rows from the sync say `KL`, not tonnes. Right now the page will present KL under a tonnes label.
```
The stock_levels table now has a `unit` column (values: tonnes, KL, Kg). Rows
written by the SharePoint sync carry the source workbook's unit — the Barka
inventory workbook is in KL, with the antioxidant in Kg — while the Inventory
page currently labels everything in tonnes.

Update app/inventory/page.tsx and the stock form/schema so the unit travels with
the number and is displayed next to it, rather than assumed. Add `unit` to
lib/schemas.ts for the stock create/edit form with a sensible default. Do not
convert anything: converting KL to tonnes needs a confirmed density per material
and that decision is outstanding.
```

**c. Scheduled sync trigger.**
```
Add a scheduled trigger for the SharePoint sync. runSharePointSync() in
lib/sharepoint/sync.ts already accepts { trigger: "scheduled" }.

It must NOT reuse app/api/sync/sharepoint/route.ts — that handler is gated on
requireAdmin() and a cron has no session. Add a separate route authenticated by
its own secret (e.g. a CRON_SECRET bearer token compared with a timing-safe
comparison), and add that secret to .env.local.example and the Vercel env list in
docs/pdf-templates.md's sibling docs. Wire it to Vercel Cron, daily.

Log the run the same way the manual path does so /sync shows both, and make sure
the trigger column records 'scheduled'.
```

**d. Self-serve password reset, email confirmation, session timeout** — the rest of P1 in `docs/go-live-plan.md`. Needed before the eight staff accounts exist, otherwise every forgotten password is an admin job for you.

**e. PDF generation** — `docs/pdf-templates.md` has the spec and the recommended split (`@media print` for the page snapshot, `@react-pdf/renderer` for invoice and report). **Hold the PoS**: it's a signed legal declaration and the app can't source batch-level GHG figures yet.

---

## Step 11 — Only now, create the eight accounts · [Andre]

You wanted the app solid before showing anyone, which is right. In dependency order that means: Steps 2–5 (sync live), Step 9 (documents page — the first screen with real data in it), and Step 10d (self-serve password reset, so you're not the help desk). Then `/admin` → create the eight accounts from the roster in `docs/go-live-plan.md`.

One adjustment worth making to that plan: **the four executive-viewers can be shown the documents page as soon as Step 9 lands.** It's genuinely finished, it needs nothing from the team, and it replaces "know which of 16 numbered folders to open" with a search box. Waiting for the operational modules — which are blocked on data only the team can provide — means holding back something already useful.

---

## Quick reference — the one thing blocking each area

| Area | Blocked on | Who |
|---|---|---|
| Document index | nothing — ships at Step 5 | — |
| Stock levels | nothing — ships at Step 5, units question open | — |
| Production | source data (file is empty) | Team |
| Contracts / Deals | source data, or a decision that deals are app-native | Team |
| Forecast | which sheet + row range in the model | Team |
| ISCC / PoS | `#REF!` repair **and** mass-balance tables in the app | Team + CC |
| Invoices | where the receivables ledger lives | Team |
| Quality | whether results exist outside PDFs | Team |
| Logistics / Procurement | whether a single register exists | Team |
| Staff accounts | Steps 5, 9, 10d | Andre |

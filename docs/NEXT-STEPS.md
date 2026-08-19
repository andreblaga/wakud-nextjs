# WakudOS — next steps runbook

_Written 2026-08-19. Do the steps in order; the numbering is dependency order, not priority order. Each step says who does it and how long it should take. **[Andre]** = you, in a browser or a terminal. **[CC]** = paste the prompt into Claude Code. **[Team]** = someone else at Wakud._

Where a step needs Claude Code, the prompt is in a fenced block — paste it verbatim.

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

## Step 3 — Regenerate the typed client · [CC] · 2 min

```
Run: npx supabase gen types typescript --project-id ftrtekdiabttvjlfgisy > lib/supabase/types.ts

Then:
1. Confirm the regenerated file contains a `sync_runs` table, a `source_ref`
   column on `documents`, and a `unit` column on `stock_levels`.
2. Now that sync_runs is typed, remove the temporary `as any` / `as never` casts
   in lib/sharepoint/sync.ts — there are three: two `.from("sync_runs" as any)`
   calls and the `client.from(table as never) as any` inside upsertChunked. Keep
   upsertChunked generic over a runtime table name; if a cast is still genuinely
   needed there, narrow it to the table-name union rather than `never` and say so
   in the comment.
3. Also remove the `as any` on `.from("sync_runs" as any)` in app/sync/page.tsx.
4. Run `npx tsc --noEmit` then `npm run build`. Both must pass.
5. Commit as "chore: regenerate Supabase types for phase 5; drop sync_runs casts".

Do NOT run `npm audit fix --force` — it breaks the next@14.2.35 pin.
```

---

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

## Step 6 — Send the team the source questions · [Andre → Team] · 10 min

This is the real unblock and everything in Phase 5 beyond stock depends on it. `docs/sharepoint-findings.md` has the full detail; the headline ask is one thing:

> **One "App Export" tab per data area: one sheet, one row per record, the columns the app needs, in agreed units.**

That converts nine of the ten blocked areas from fragile pinned-cell-range parsing into something that keeps working when someone inserts a row.

Specific questions, in the order I'd ask them:

1. **Production** — `Sales-Production MAHER.xlsx` is empty. Where is monthly output recorded now? *(Cheapest fix on the list: daily B100 and glycerol output already exist in the inventory workbook, so `production_plan` could be derived from that and need no new file at all.)*
2. **Inventory dates** — the BIODIESEL summary block is headed "July / August / Sept" but reports exactly the figures that sit in the **Jan / Feb / Mar 2026** daily rows. Which is right? Until this is answered nobody should read the Inventory page as 2026 truth.
3. **Stock units** — everything is in KL (antioxidant in Kg). Convert to tonnes with agreed densities per material, or display KL?
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

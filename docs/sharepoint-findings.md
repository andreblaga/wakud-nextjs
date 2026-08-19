# SharePoint source audit — what's actually in the workbooks

_Live crawl of the Barka Operations Hub library, 2026-08-19. App-only Graph token, `Sites.Selected` read-only. Every file named in `SharePoint_Source_Candidate_Map.xlsx` was located and opened. This supersedes the confidence ratings in that map — those were based on filenames and folder paths; this is based on the contents._

## Headline

The **site scope blocker is closed**: every nominated workbook does physically live inside Barka Operations Hub. Nothing needs moving and IT does not need to extend the grant.

The blocker that replaced it is bigger. **Of the eleven nominated sources, one can populate its target table.** The rest are analyst workbooks, templates, bank exports or empty files — they were mapped by name and folder, and the names were right, but the contents don't hold the fields the app needs.

That is not a reason to stall. Two things ship now and are genuinely useful:

1. **The document index** — all ~8,300 files in the library, with folder, type, size, author and modified date, linked back to SharePoint. This is exactly what the architecture always said SharePoint would own ("documents stay in SharePoint, the app reads" — project.md §8b), and it needs no team input.
2. **Monthly stock levels** — 108 rows (9 materials × 12 months of 2026) aggregated from the inventory workbook's daily series. Verified against the workbook's own summary block: it reconciles to the decimal.

Everything else is registered in `lib/sharepoint/sources.ts` as `blocked`, with the reason and the question, and surfaced on `/sync`. Blocked areas deliberately do not run — a parser that invents plausible rows is worse than an empty page.

## What the library actually contains

| Measure | Value |
|---|---|
| Items in the library | 14,393 (8,265 files, 6,128 folders) |
| Top-level folders | 16, numbered taxonomy |
| PDFs | 4,382 |
| Spreadsheets | 967 (`.xlsx` / `.xlsm`) |
| Word documents | 923 |
| Document libraries | 1 ("Documents") |

The docs said ~4.9k items. It is closer to 14.4k.

### Two things that make filename matching unsafe

**Duplication.** 120 spreadsheet filenames exist in more than one folder — 352 files in total. `Delivery Note Template.xlsx` appears 38 times, `List of invoices.xlsx` 13, `Wakud PO.xlsx` 7, the 13-week RCF 14, `Summary mass balance` 16. A sync that resolved sources by filename would silently pick a legacy copy. Every source is therefore pinned to a full library-relative path.

**Dates are migration dates, not edit dates.** 983 of 991 spreadsheets carry a `lastModified` of either 2026-03 or 2026-06 — the two bulk uploads into SharePoint. Recency proves nothing about which copy is current. Only the team's confirmation does.

There is also a numbering collision worth tidying: both `13_Admin_IT_and_General` and `15_Admin_IT_and_General` exist, alongside `13_Board_and_Governance`.

## Source-by-source

### ✅ Inventory → `stock_levels` — syncing

`05_Supply_Chain_and_Logistics/Inventory_Records/2026/Material Inventory Jan 26 -Dec 26.xlsx`

Ten per-material sheets, each a full daily series for calendar 2026 (365 rows) with produced / receipt / consumption / wastage / dispatched and a running level. Genuinely good data. Aggregated to one row per material per month.

**Three flags:**

1. **Units are KL, not tonnes** (antioxidant is Kg). The app's Inventory page labels stock in tonnes. The sync stores the source number unchanged and writes the unit into a new `stock_levels.unit` column rather than guessing — converting needs a confirmed density per material. **Someone has to decide: convert at sync time with agreed densities, or display the source unit.**
2. **Only three months contain activity.** January–March 2026 have production and movement; April–December are flat carry-forward with no entries. So the 2026 file is populated a quarter in.
3. **The dates may not be what they look like.** The BIODIESEL summary block is headed "July / August / Sept" and reports produced 17.26 / 39.3 / 0.944 with month-end levels 0.26 / 24.56 / 25.504. Those are *exactly* the figures my aggregation derives for **January / February / March 2026**. Either the summary labels are stale, or a July–September actuals series has been rolled into a 2026-dated template. **This needs resolving before anyone reads the Inventory page as 2026 truth.** Related: Recovered Methanol's level moves month to month (29.18 → 29.698 → 30.877) with no receipts or consumption recorded against it.

### ⛔ Contracts & offtake — blocked

`06_Sales_and_Offtake/Revival_2025/Ultimate_Biodiesel_Sales_Tracker.xlsx`

34 well-designed columns — contract issued/signed, start and end date, blend type, annual and monthly committed volume, contract price, forecast vs actual delivered, variance, invoice, payment status. **Ten data rows, and only the first six columns are filled in:** customer, location, contact name, phone, email, estimated tonnage. Every contract term is blank.

It is a prospect list: OOMCO (Salalah, Sohar), Hormuz Marine, GAC, Mitsui & Co, Jotal, Vitol, Asyad, Mwasalat, OLNG. Useful, but `contracts.price_per_tonne` is NOT NULL, so there is nothing to build a contract row from.

> **Ask:** where are signed offtake terms actually recorded — is this tracker meant to be filled in, or do terms live only in the Word offtake agreements?

### ⛔ Deals — blocked, and probably has no source

Same file. The candidate map pointed here, but the workbook is customer-shaped, not deal-shaped: no deal id, no buy price, no shipping or trucking cost per tonne, no production/arbitrage type. Those are precisely the inputs `lib/deal-economics.ts` computes from, so there is no overlap at all.

> **Ask:** is there a trade pipeline anywhere, or are deals only ever created in the app? If the latter, that is a fine answer — we should record that `deals` has no SharePoint source and stop looking.

### ⛔ Sales forecast & working capital — blocked

`07_Finance_Accounting_and_Tax/Financial_Models/20260214-Wakud BioDiesel Model.xlsx`

A 2.1 MB, nine-sheet financial model: Static Inputs, Dynamic Inputs, Workings, Trading, Data Validation, Forecasts, Outputs, Valuation, Distributions. Months run across the columns, line items down the rows, driven by a `BASE` scenario selector. Its own header reports "Cash Depleted: 2026-02-28".

Importing a model like this means pinning specific cell ranges per line item, which breaks the first time anyone inserts a row. The two supporting files are weaker still: `Wakud Sales Forcast.xlsx` is market-research notes (potential offtakers, targeted price in OMR/L, a "Confirmation" probability column), and the 13-week rolling cash forecast runs weekly columns from **2025-06-01** — about fourteen months stale.

> **Ask:** which sheet and row range is the agreed monthly forecast, and is it BASE case only? A small "Forecast export" tab with one row per month and the columns the app needs would turn this from fragile into trivial.

### ⛔ Production plan — blocked, file is empty

`05_Supply_Chain_and_Logistics/Lists/Sales-Production MAHER.xlsx` has a used range of **A1:A1**. The 12 KB is formatting. Two older copies sit under `01_Operations_and_Production/Legacy_Archive`, equally unusable as a live feed.

> **Ask:** where is monthly production output recorded now? Daily B100 and glycerol output *does* exist in the inventory workbook — `production_plan` could be derived from that instead of needing its own file. That may be the cheapest fix on this whole list.

### ⛔ ISCC mass balance — blocked, and the schema can't hold it

`11_ESG_and_Sustainability/ISCC/2025 - CoC/ongoing Summary mass - 25.xlsx`

The most valuable data in the site, and the most blocked. Eight sheets covering NOV22–NOV23, NOV23–NOV24 and 2025, tracking UCO by **sustainability category — Sustainable Oman / Sustainable UAE / Non-Sustainable** — through starting inventory, receipts, wastage, consumed, closing inventory, with conversion factors and sustainable credits.

Two problems:

1. **The workbook is broken.** The "Period Closing Inventory" sheet is `#REF!` from the second period onward — its own summary cannot be read, by the app or by a person.
2. **The app has nowhere to put the important column.** `iscc_certificates` holds certificates (scope, expiry, GHG saving). It has no concept of a sustainability category per batch, which is the whole substance of chain-of-custody. Mass balance was always listed as a Phase 4/5 feature; this confirms it needs real tables, not a certificate list.

> **Ask:** can the `#REF!` chain be repaired at source? And a design decision for us: proper mass-balance tables (intake → batch → output, carrying sustainability category) is what ISCC auditing actually requires.

### ⛔ Invoices — blocked, wrong kind of document

`06_Sales_and_Offtake/OOMCO/Wakud_OOMCO_Payments.xlsx` is a bank statement export ("Bank NBO OMR Transactions"), one buyer, dated payments in OMR against reference numbers. It records money **received**, not invoices **issued** — no issue date, no due date, no status. `invoices.invoice_number` is NOT NULL UNIQUE.

> **Ask:** where is the receivables ledger? If it lives in the accounting system rather than SharePoint, that is the integration to scope — and it is a different project from this one.

### ⛔ Quality tests — blocked, no results in it

`04_Quality_and_Laboratory/Legacy_QA/Lab Expences/LAB TRACKING SYSTEM.xlsx` is a 2023 sample-dispatch and lab-expense log: sample number, date, who couriered it, which lab, report number, whether it was paid, price in OMR. **It contains no test results** — not one of density, viscosity, flash point, sulfur, water, acid value, methanol, oxidation stability, cloud point or cetane appears anywhere.

> **Ask:** do the QC panel results exist only inside the labs' PDF reports? If so `quality_tests` needs manual entry, and a spreadsheet sync was never going to work.

### ⛔ Logistics — blocked

`06_Sales_and_Offtake/OOMCO/OOMCO_Salalah Deport Tracking Report.xlsx` is a depot stock reconciliation for one customer, in litres and OMR. No vessel, no bill of lading, no container count, no departure/ETA/arrival, no incoterm — which is most of the `shipments` table. Five near-duplicates of this filename exist in other folders.

> **Ask:** is vessel/BoL-level tracking kept anywhere, or does the freight forwarder hold it outside SharePoint?

### ⛔ Procurement — blocked

`Wakud PO.xlsx` exists in seven folders with nothing to distinguish the live one, and `05_Supply_Chain_and_Logistics/Procurement/` holds per-order templates rather than a running order book.

> **Ask:** is there one register of raw-material orders with supplier, quantity, lead time and required-by date, or is each order its own file?

### ⛔ UCO intake — blocked

`…/Al Mouj - Beah - UCO Collection/Al Mouj UCO.xlsx` is a collection *billing* sheet for one site: location, unit type, quantity, container type, unit rate and total in OMR. It is what Wakud pays for collection, not a feedstock intake register — and critically it carries **no sustainability declaration**, which is the field ISCC needs against every intake.

> **Ask:** where is UCO recorded as it arrives at Barka, with supplier and sustainability declaration? Daily UCO receipts are in the inventory workbook, but with neither supplier nor category.

## The pattern, and the recommendation

Nine of eleven blockers are the same shape: **the app expects a normalised record and SharePoint holds a human working document.** Templates, models, bank exports, per-order files, a spreadsheet whose real content is in the formulas.

Two ways forward, and they are not exclusive:

- **Ask the team for thin export tabs.** For each area, one sheet, one row per record, the columns the app needs, in agreed units. Cheap for them, and it makes the sync robust instead of a pinned-cell-range guessing game that breaks on the next row insert. This is the highest-leverage single request on the list.
- **Accept that some areas are app-native.** Deals almost certainly are. Quality results may be. Invoices probably belong to the accounting system. Deciding "this has no SharePoint source" is a real answer and stops the search.

Meanwhile the document index gives the team something they do not have today: one searchable view over 8,300 operational files that currently requires knowing which of 16 numbered folders to open.

## Also worth fixing while we're here

- **The client secret expiry is still not recorded anywhere.** I grepped the repo and `.env.local`; it is not there. A lapsed secret fails as a bare 401 — the Graph client now names that case explicitly, but it will still stop the sync dead. Get the date from Oryx and set a rotation reminder two weeks before.
- **`SHAREPOINT_SITE_URL` in `.env.local` has a trailing inline `#` comment after the quoted value.** Next.js's dotenv parser handles it; a naive parser does not, and mine didn't until I fixed it. Harmless, but it will bite the next script someone writes.

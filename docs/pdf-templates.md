# PDF templates — design spec

_Drafted 2026-08-19. Covers the four PDF outputs agreed in `docs/go-live-plan.md` P3: invoices, ISCC Proof of Sustainability, finance/forecast reports, and a generic per-page snapshot. Split per the plan: Cowork drafts the templates, Claude Code wires generation._

Visual draft: **`docs/templates/wakud-pdf-templates.html`** — open it in a browser and print to PDF to see all four at real A4 size. It is deliberately plain HTML + CSS so it can become React components or be rendered headlessly without a rewrite.

## These are not invented layouts

Two of the four had to match documents Wakud already issues, so I pulled the real ones out of SharePoint rather than designing from scratch:

- **Invoice** — modelled on `05_Supply_Chain_and_Logistics/Dispatched_Products/Legacy/Biodiesel/44.01 Carbon management Services S.P.C/4401- INVOICE templ.xlsx`, which carries three tabs (Quote / Tax Invoice / Proforma invoice). The letterhead, VAT number, bank block, numbering conventions and line-item columns below are Wakud's own, taken from that file.
- **ISCC PoS** — field-for-field against `11_ESG_and_Sustainability/ISCC/2025 - CoC/Outcomes Sales, PoS/ISCC_EU_PoS_v3.1_241010-1.xlsx`, i.e. the **v3.1** form currently in use. The older v2.6 copies elsewhere in the library are superseded; don't build against those.

## Shared page furniture

Every template uses the same frame so the set reads as one system.

| Element | Value |
|---|---|
| Page | A4 portrait, 18 mm margins (20 mm foot to clear the footer) |
| Type | System sans stack; 9.5 pt body, 8 pt table, 20 pt document title |
| Brand | Petrol green `#047857` (`brand-700`) for rules and headings; amber `#d97706` (`accent-600`) for warnings only |
| Logo | `public/wakud-logo.png`, 34 mm wide, top-left |
| Footer | `Wakud International LLC · <doc type> <number> · page N of M · generated <timestamp> by <user>` |
| Numbers | Right-aligned, tabular figures, thousands separators, 3 dp for tonnes, 2 dp for currency |
| Currency | Always show the currency code (`OMR 22,990.00`), never a bare symbol — the business runs in both OMR and USD |

**Letterhead block (verbatim from Wakud's own template — please confirm the phone number, two different ones appear across their tabs):**

```
Wakud International LLC
Khazaen Economic City, Barka, Oman
PO Box 117, PC 116
Phone: +968 7259 7009
VAT No. OM1100080427
```

**Bank block (invoices only):**

```
National Bank of Oman
Account name: Wakud International LLC
SWIFT: NBOMOMRXXXX
USD account: <to confirm>
OMR account: 1047-0322247-<to confirm>
```

> ⚠️ The account numbers are truncated in the source spreadsheet. Get the full values from finance before this goes near a real customer — a PDF with a wrong account number is worse than no PDF.

---

## 1. Tax Invoice / Proforma / Quote

One template, three modes, because Wakud's own workbook treats them as three tabs of the same document. The mode changes the title, whether a due date shows, and the validity line.

| Mode | Title | Extra |
|---|---|---|
| `quote` | QUOTE | "Quotation validity: 1 week"; no due date; no VAT charged (their template shows VAT as `-`) |
| `proforma` | PROFORMA INVOICE | Not a tax document — must carry a "This is not a tax invoice" line |
| `invoice` | TAX INVOICE | VAT No. shown, due date shown, "Authorised signatory" block |

**Header fields** (left column / right column as in their layout):

| Field | Source |
|---|---|
| Invoice number | `invoices.invoice_number` — their convention is `BD-<yy>-<seq>` |
| Date | `invoices.issued_date` |
| Due date | `invoices.due_date` (invoice mode only) |
| Order number, Client number, Client reference | not in the schema today — see gaps below |
| Recipient name / address / phone | `contracts.buyer` gives a name only; the address book does not exist yet |
| Shipping details | `shipments.destination` |
| DN number | `shipments.bol_number` (their delivery-note convention is `BD-NT-<seq>`) |

**Line items:** Description · Product code · Qty · Unit price · Total · Note. Product code `BD` for biodiesel, per their sheet.

**Totals block** — and this is where their existing spreadsheet has a genuine bug worth not copying:

```
Subtotal          21,600.00
Tax 5%             1,080.00
Shipping             310.00
─────────────────────────────
Total due OMR     22,990.00
```

Their file labels the 21,600 line **"Total amount"** and then shows **"Total due"** of 22,990 underneath. The first is a subtotal, not a total. Anyone skim-reading pays the wrong number. The template above renames it `Subtotal`.

> **Decision needed:** does shipping attract the 5% VAT? Their sheet adds it after tax, which implies not. Finance should confirm — it ties into the open VAT question in `docs/deal-economics.md`.

---

## 2. ISCC EU Proof of Sustainability

The compliance-critical one. Field set and section numbering follow the v3.1 form exactly:

**Head:** unique PoS number · date of issuance · supplier (name, address, certification system `ISCC EU`, certificate number) · address of dispatch/shipping point (with a "same as supplier" tick) · address of receipt/receiving point (with a "same as recipient" tick) · date of dispatch.

**§1 General information:** type of product · type of raw material · additional information (voluntary) · country of origin of the raw material · quantity · energy content (MJ) · EU RED compliant material · ISCC compliant material (voluntary) · chain of custody option · country of biofuel production · start date of biofuel production · start date of bioliquid/biomass fuel use.

**§2 Scope of certification of raw material:** the five declarations — sustainability criteria compliance, intermediate crop, low ILUC risk measures, waste/residue definition, waste or animal by-product permit number — plus the support-received question and its scheme.

**§3 Greenhouse gas emission information:** either "total default value according to RED II applied", or the itemised chain `E = Eec + El + Ep + Etd + Eu − Esca − Eccs − Eccr`, allocated heat, Esca bonus/cap, NUTS2 area, and the resulting GHG emission saving %. The explanatory footnotes 1–8 and the `Eec…E` glossary reproduce from the form.

**Energy content must be computed, not typed.** The source workbook carries the conversion factors on its `Prod` tab: biodiesel is **37 MJ/kg** and **33 MJ/l**. Put those in a constant next to `DEAL_ASSUMPTIONS`, not inline.

Two hard blockers, both flagged in `docs/sharepoint-findings.md`:

1. **The app cannot currently fill this in.** `iscc_certificates` holds certificates, not consignments. A PoS needs a *batch*: raw material category, country of origin, quantity, GHG figures, dispatch and receipt points. Mass-balance tables are prerequisite work, not a nice-to-have.
2. **Sustainability category is unmodelled.** The mass-balance workbook tracks Sustainable Oman / Sustainable UAE / Non-Sustainable; the app has nowhere to hold it, and it is the field the whole document turns on.

> **Do not ship a PoS generator that fills the GHG section with defaults silently.** A PoS is a legal declaration signed by Wakud. Until the numbers come from real batch data, the template should render those fields blank for manual completion, and the app should say so on screen. I have set it up that way in the draft.

---

## 3. Finance / forecast report

A multi-page management report rather than a form. Sections, in order:

1. **Cover** — title, period, "prepared for", generated timestamp, and a prominent basis-of-preparation line.
2. **Summary tiles** — committed volume, average contract price, total profit, working capital needed. Same figures as the dashboard, same helpers, so they cannot diverge.
3. **Monthly table** — one row per month from `monthly_forecast`: committed t · avg price · Barka output · gap · arbitrage required · production profit · arb profit · total profit · working capital.
4. **Forecast chart** — the existing `ForecastChart` series, rendered as static SVG. Recharts is client-side, so for a server-rendered PDF either render the SVG server-side or reuse a print stylesheet on the live page.
5. **Assumptions appendix** — print `DEAL_ASSUMPTIONS` with the `ASSUMPTION_NOTES` flags. Non-negotiable: while the rates are unconfirmed, every report carrying a profit figure must show the basis on its face.

> **Decision needed:** OMR, USD, or both side by side? Recommendation: USD primary with an OMR column, since contracts are priced in OMR/L and the model runs in USD.

---

## 4. Per-page snapshot

The generic "print what I'm looking at" output. Any list page → a dated PDF of the current view.

- Honours the **active filters** and states them under the title ("Deals · status = confirmed · 14 of 37 rows") — same principle as the Excel export, which already respects Deals filters.
- Columns exactly as on screen, in screen order.
- Landscape when a table has more than eight columns.
- Row cap of 500 with an explicit "showing first 500 of N — use Export to Excel for the full set" line. Silent truncation on a document someone files is a real hazard.
- Footer carries who generated it and when, so a printed page found on a desk can be dated.

Cheapest correct implementation: one shared `@media print` stylesheet plus a `PrintButton`, reusing the pages that already exist. No new rendering pipeline, and it stays correct automatically as pages change.

---

## Generation approach — for Claude Code to decide

Not prescribing one, but the trade-offs as I see them:

| Option | Fits | Against |
|---|---|---|
| `@media print` + browser print | Snapshot, and quickest path to something usable | No server-side generation, so no attaching a PDF to an email later; page-break control is fiddly |
| `@react-pdf/renderer` | Invoice, PoS, report — precise, server-side, no browser | Second layout system to maintain; charts need manual SVG |
| Headless Chromium (`@sparticuz/chromium`) | Pixel-identical to the HTML templates | Heavy on Vercel, cold starts, needs the function size watching |

Suggested split: `@media print` for the snapshot now, `@react-pdf/renderer` for invoice and report, and hold PoS until mass balance exists.

## Gaps this surfaced in the schema

Drafting these found fields the app has no home for. None are blocking today, all are needed before the documents are real:

- **No customer address book.** `contracts.buyer` is a bare string. An invoice needs recipient address, phone, client number and client reference — their existing template has all four.
- **No `invoices` line items.** The table holds a single amount, so a multi-line invoice cannot be represented. Also no subtotal, VAT or shipping columns — only a total.
- **No document numbering sequence.** `BD-<yy>-<seq>` needs a generator with a uniqueness guarantee, not a hand-typed field.
- **No issued-document store.** A tax invoice must be reproducible exactly as sent. Generating it fresh each time from live data means the PDF changes if the data does. Issued documents should be written once to the `wakud-documents` bucket and served with `createSignedUrl()` (the bucket is private now — see `project.md` §9a).
- **No signatory record.** "Authorised signatory" is on their template; the app has no notion of who may sign.

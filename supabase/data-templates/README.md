# Data import templates

Blank CSV templates for loading your real facility data into the database. Each file matches one table and includes the correct column headers plus **one example row** showing the expected format — replace or delete the example before importing.

## How to import

In your Supabase project: **Table Editor** → pick the table → **Insert** → **Import data from CSV** → upload the matching file. Or send me the filled-in files and I'll load them.

Import in this order (some tables reference others):

1. `contracts.csv`
2. `prices.csv`
3. `deals.csv`
4. `production_plan.csv`
5. `stock_levels.csv`
6. `contract_volumes.csv`  *(see note below)*
7. `raw_material_orders.csv`
8. `invoices.csv`

## Format rules

- **Dates** must be `YYYY-MM-DD` (e.g. `2026-07-01`). For monthly tables, use the **first day of the month**.
- **Months** (production plan, contract volumes, stock, forecast) use the 1st of the month.
- **true/false** columns: lowercase `true` or `false`.
- **Money/tonnes**: plain numbers, no currency symbols or commas (`159500`, not `$159,500`).
- Leave a cell **blank** if unknown — don't put `N/A`.
- Don't change the header row.

## Field notes per file

**deals.csv** — `deal_type` must be `production` or `arbitrage`. `status` must be one of `draft, approved, confirmed, in_transit, delivered, paid`. `vat_rate` and `funding_rate` are decimals (0.05 = 5%). Profit/margin/total columns are calculated by the app, so they're not in the template.

**contracts.csv** — `price_per_tonne` in USD. `incoterm` e.g. `FOB`/`CIF`. `payment_terms` e.g. `prepaid`.

**contract_volumes.csv** — uses a helper column `contract_name` instead of the database `contract_id`. The names must match exactly what's in `contracts.csv`. **Note:** Supabase's CSV importer needs the real `contract_id`, so for this file it's easiest to send it to me and I'll map names → IDs, or enter these rows through the app. Planned vs actual monthly volume per buyer.

**production_plan.csv** — one row per month. `target_output` is total tonnes; `b100_output` + `glycerin_output` are the product split; `uco_consumed` is feedstock used.

**stock_levels.csv** — one row per product per month. `closing_stock` is recalculated by the app; you can leave it or fill it. `safety_stock_level` defaults to 20.

**prices.csv** — reference prices by `price_type` (e.g. `UCO`, `B100`, `Methanol`, `Glycerin`) and effective date.

**raw_material_orders.csv** — procurement orders. `quantity_kg` in kilograms. `lead_time_days` is supplier lead time. `linked_month` ties the order to a production month.

**invoices.csv** — `amount_usd` only; the OMR amount is auto-calculated (USD × 0.385 peg). `status` e.g. `draft`, `sent`, `paid`.

## Tables without templates

These exist in the database but are usually filled in through the app rather than bulk-imported: `quality_tests`, `shipments`, `inventory_consumption`, `production_actuals`, `system_alerts`, `iscc_certificates`, `maintenance_schedule`, `documents`, `finance_exports`, `monthly_forecast`, `audit_log`. Ask me if you want templates for any of these too.

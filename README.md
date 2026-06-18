# WakudOS — Plant Command (Next.js)

Biofuel facility management app for **Wakud International LLC** (Barka, Oman) — built on **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, backed by **Supabase**. Database schema lives in [`supabase/`](./supabase); deployment guide in [`DEPLOY.md`](./DEPLOY.md).

This is a **first-pass scaffold** (built fresh — no legacy code or data): the full navigation shell, layout, and every module page are in place with styled placeholders. Wiring the pages to live Supabase data is the next step.

## Run it

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase URL + anon key
npm run dev                         # http://localhost:3000
```

The app renders fine without Supabase credentials (placeholders show); add them in `.env.local` to connect live data.

## Structure

```
app/
  layout.tsx          Root layout (sidebar + topbar)
  page.tsx            Dashboard (KPIs + forecast chart + alerts)
  deals/              Trade evaluation & pipeline
  sales-forecast/     Committed volumes & projections
  production/         B100 fuel & glycerol output status
  inventory/          UCO stock, UCO intake, material reorder
  logistics/          Shipments & deliveries
  finance/            Invoices & exports (Export-to-Excel button stub)
  iscc/               Certificates + feed/product mass balance
  discussions/        Team chat shell (channels, archive, item refs)
  tasks/              To-do board (timeline & priorities)
  change-log/         Audit trail view
  assistant/          AI Q&A over data (final phase — stub)
components/
  Sidebar.tsx, TopBar.tsx, ui.tsx (Card/StatCard/PageHeader/PlaceholderPanel), ForecastChart.tsx
lib/
  nav.ts              Single source of truth for navigation
  supabase/           Browser + server client helpers (@supabase/ssr)
```

## Mapping to the team's feature requests

| Request | Where |
|---|---|
| UCO Stock / UCO Intake / material replacement | `inventory/` |
| Production status (fuel + glycerol) | `production/` |
| Sales forecast | `sales-forecast/` |
| ISCC feed/product tracking | `iscc/` (mass-balance section) |
| Discussions / team chat + archive | `discussions/` |
| To-do list (timeline & priorities) | `tasks/` |
| Change/update log | `change-log/` |
| Export to Excel | per-page action buttons (see `finance/`) — to be implemented |
| AI chat box | `assistant/` (final phase) |
| SharePoint sync | server-side job — `.env.local.example` has the M365 placeholders |

## Next steps

1. Connect Supabase (`.env.local`) and replace placeholders with live queries.
2. Build the SharePoint → Supabase sync (server route + scheduled job).
3. Implement per-page Excel export.
4. Build out Discussions, To-Do, and the Change Log to read/write real data.
5. Assistant (AI Q&A) last.

> Note: pinned to `next@14.2.35` (patched) per the Dec 2025 Next.js security advisory.

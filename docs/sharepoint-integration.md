# SharePoint Sync — Phase 5 Design

_Owner: Cowork. Status 2026-08-13: **access provisioned**, design ready. Remaining blocker: confirm canonical source workbooks (see §6). Read-only, one-way SharePoint → Supabase. No write-back._

## 1. Access (provisioned by IT / Oryx, 2026-08-13)

- **Entra ID app registration**, **`Sites.Selected`** application permission (app-only), **read-only**, scoped to **one site only: Barka Operations Hub**. Verified by IT — no access to any other tenant site.
- Credentials: `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` in `.env.local` (gitignored, server-only). Never `NEXT_PUBLIC_`.
- Site: `SHAREPOINT_SITE_URL=https://netorgft11912468.sharepoint.com/sites/Barka-Operations-Hub` (pre-filled).

### Verified 2026-08-13 (live smoke test)

- App-only token acquired ✅
- `GET /sites/{host}:/sites/Barka-Operations-Hub` resolves ✅
- Drives: **one library, "Documents"** (the Shared Documents library; drive ID above) ✅
- Cross-site check: `GET …:/sites/Wakud-Corporate-Hub` → **403** ✅ (least-privilege scoping confirmed enforced)

## 2. Auth (client-credentials, app-only)

- Token endpoint: `https://login.microsoftonline.com/{MS_TENANT_ID}/oauth2/v2.0/token`, scope `https://graph.microsoft.com/.default`.
- Suggested libs: `@azure/identity` `ClientSecretCredential` + `@microsoft/microsoft-graph-client`. Parse hostname + server-relative path from `SHAREPOINT_SITE_URL`.
- All Graph calls **server-side only** (route handler / scheduled job). Upserts to Supabase use `SUPABASE_SERVICE_ROLE_KEY` (still blank — fill before running).

## 3. Graph calls

1. Site ID: `GET /sites/{hostname}:/sites/Barka-Operations-Hub`
2. Libraries: `GET /sites/{siteId}/drives` — main "Shared Documents" drive ID is
   `b!YtIPQWn9lEqE0exZPkIcy4EWTDYiAopHivZclDgaOD2_6Im8GDbxSKrqY9V_t7em`.
3. Traverse: `GET /drives/{driveId}/root/children`, `/items/{itemId}/children`.
4. File bytes: `GET /drives/{driveId}/items/{itemId}/content` → parse xlsx server-side (exceljs is already a dep from Phase 4 export).

## 4. Sync behaviour

- **Read-only.** Never writes to SharePoint (`Sites.Selected` is read-only here, and write-back is forbidden by design). Team "data out" = the app's Export-to-Excel (Phase 4).
- **Idempotent upserts** keyed on a stable per-row identifier; re-runnable without duplication.
- **Log each run** (rows read / upserted / skipped / errored); surface last-run + status in the UI (BUILD-PLAN Phase 5 item 3). Record via `lib/audit.ts`.
- Trigger: manual route handler now; scheduled trigger later.

## 5. Source → table mapping (to confirm with team)

| Data area | Supabase table(s) | Likely source location in Barka site |
|---|---|---|
| Contracts / offtake | `contracts`, `contract_volumes` | `06_Sales_and_Offtake/…` (e.g. LongTerm_Offtake_Barka) |
| Deals / trade economics | `deals`, `production_confirmations` | TBC |
| Production plan/actuals | `production_plan`, `production_actuals` | TBC |
| Stock & UCO | `stock_levels`, `inventory_consumption`, `raw_material_orders` | `05_Supply_Chain_and_Logistics/…` |
| Forecast / finance | `monthly_forecast`, `prices`, `invoices` | `07_Finance_Accounting_and_Tax/…`, `14_Banking_and_Treasury/Working_Capital` |
| ISCC / quality | `iscc_certificates`, `quality_tests` | TBC |

## 6. ⚠ Remaining blocker — confirm canonical sources

Two things still needed from the team before coding the parsers:

1. **Format:** presumed **Excel workbooks** (the site is full of `.xlsx`), not SharePoint Lists — confirm.
2. **Which workbooks are canonical** for each data area, **and that they physically live in Barka Operations Hub.** A tenant-wide search found operational/tracker spreadsheets in *other* sites (`Wakud-Corporate-Hub`, `Utopia-World`) and personal OneDrive — the app **cannot** read those. If a canonical sheet lives elsewhere, either move it into Barka Operations Hub or ask IT to extend the `Sites.Selected` grant to that site.

## 7. Secret rotation

`MS_CLIENT_SECRET` expires (Entra secrets are time-limited). Record the expiry date and rotate before it lapses — a lapsed secret silently breaks the sync.

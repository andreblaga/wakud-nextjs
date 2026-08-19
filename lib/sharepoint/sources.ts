import "server-only";

/**
 * The source registry: exactly which SharePoint file feeds which app table.
 *
 * WHY THIS FILE EXISTS AS DATA, NOT CODE
 * --------------------------------------
 * The library holds ~8,300 files, and 120 spreadsheet filenames appear more
 * than once (38 copies of "Delivery Note Template.xlsx", 14 of the 13-week RCF,
 * 16 "Summary mass balance"). Matching a source by filename would silently pick
 * a legacy copy. Every source below is pinned to a full library-relative path.
 *
 * Nearly every file's lastModifiedDateTime is 2026-03 or 2026-06 — the dates
 * the content was bulk-migrated into SharePoint, not when anyone edited it.
 * Recency is therefore NOT evidence that a file is current; only the team's
 * confirmation is.
 *
 * `status` is the honest state of each area:
 *   "active"  — verified against the real file, parser implemented, syncing.
 *   "blocked" — the nominated file exists but cannot populate the target table.
 *               `blocked` explains what's actually in it and `question` is what
 *               the team needs to answer. These deliberately do NOT run: a
 *               speculative parser that invents rows is worse than an empty page.
 */

export type SourceStatus = "active" | "blocked";

export type Source = {
  key: string;
  label: string;
  /** Library-relative path, exact. */
  path: string;
  targetTables: string[];
  status: SourceStatus;
  /** Present when status === "blocked": what the file actually contains. */
  blocked?: string;
  /** Present when status === "blocked": the question for the team. */
  question?: string;
  notes?: string;
};

export const DOCUMENT_INDEX_LABEL = "Document index";

export const SOURCES: Source[] = [
  // --------------------------------------------------------------- active ---
  {
    key: "stock_levels",
    label: "Inventory — monthly stock by material",
    path: "05_Supply_Chain_and_Logistics/Inventory_Records/2026/Material Inventory Jan 26 -Dec 26.xlsx",
    targetTables: ["stock_levels"],
    status: "active",
    notes:
      "Ten per-material sheets, each a daily series for calendar 2026 (365 rows). " +
      "Aggregated to one stock_levels row per material per month. Volumes are KL " +
      "(antioxidant is Kg) — stored unconverted with stock_levels.unit set, because " +
      "converting to tonnes needs a confirmed density per material.",
  },

  // -------------------------------------------------------------- blocked ---
  {
    key: "contracts",
    label: "Contracts & offtake",
    path: "06_Sales_and_Offtake/Revival_2025/Ultimate_Biodiesel_Sales_Tracker.xlsx",
    targetTables: ["contracts", "contract_volumes"],
    status: "blocked",
    blocked:
      "The workbook has 34 well-designed columns (contract dates, committed volume, " +
      "price, delivered, invoice, payment) but only 10 data rows, and only the first " +
      "six columns are filled in — customer, location, contact name/phone/email and an " +
      "estimated tonnage. Every contract term is empty, so there is nothing to build a " +
      "contract from (contracts.price_per_tonne is NOT NULL). It is a prospect list, " +
      "not a contract register.",
    question:
      "Where are signed offtake contract terms actually recorded — is this tracker meant " +
      "to be filled in, or do the terms live in the Word offtake agreements only?",
  },
  {
    key: "deals",
    label: "Deals / trade pipeline",
    path: "06_Sales_and_Offtake/Revival_2025/Ultimate_Biodiesel_Sales_Tracker.xlsx",
    targetTables: ["deals"],
    status: "blocked",
    blocked:
      "The candidate map pointed here for deals, but this workbook is customer/offtake " +
      "shaped, not deal shaped: no deal id, no buy price, no shipping or trucking cost, " +
      "no production/arbitrage type. The app computes deal economics from those inputs, " +
      "so there is no field overlap to import.",
    question:
      "Is there a trade/deal pipeline anywhere, or are deals only ever created inside the " +
      "app? (If the latter, deals correctly has no SharePoint source and we should say so.)",
  },
  {
    key: "monthly_forecast",
    label: "Sales forecast & working capital",
    path: "07_Finance_Accounting_and_Tax/Financial_Models/20260214-Wakud BioDiesel Model.xlsx",
    targetTables: ["monthly_forecast"],
    status: "blocked",
    blocked:
      "A 2.1 MB nine-sheet financial model (Static Inputs / Dynamic Inputs / Workings / " +
      "Trading / Forecasts / Outputs / Valuation / Distributions) laid out with months " +
      "across the columns and line items down the rows, driven by a scenario selector " +
      "('BASE'). It is a model, not a table: importing it means pinning specific cell " +
      "ranges per line item, which will break the next time anyone inserts a row.",
    question:
      "Which sheet and which row range is the agreed monthly forecast — and should the " +
      "app import the BASE case only? A small 'Forecast export' tab with one row per " +
      "month would make this robust instead of fragile.",
  },
  {
    key: "production_plan",
    label: "Production plan & actuals",
    path: "05_Supply_Chain_and_Logistics/Lists/Sales-Production MAHER.xlsx",
    targetTables: ["production_plan", "production_actuals"],
    status: "blocked",
    blocked:
      "The file is empty — a single sheet with a used range of A1:A1. The 12 KB is " +
      "formatting only. (Two older copies exist under 01_Operations_and_Production/" +
      "Legacy_Archive but are equally unusable as a live feed.)",
    question:
      "Where is monthly production output actually recorded now? Daily B100 and glycerol " +
      "production do exist in the inventory workbook — should production_plan be derived " +
      "from that instead of a separate file?",
  },
  {
    key: "iscc_mass_balance",
    label: "ISCC mass balance / chain of custody",
    path: "11_ESG_and_Sustainability/ISCC/2025 - CoC/ongoing Summary mass - 25.xlsx",
    targetTables: ["iscc_certificates"],
    status: "blocked",
    blocked:
      "Genuinely valuable data, but two blockers. (1) The 'Period Closing Inventory' " +
      "sheet is broken — every row from the second period onward is #REF!, so the " +
      "workbook's own summary cannot be read. (2) It tracks UCO by sustainability " +
      "category (Sustainable Oman / Sustainable UAE / Non-Sustainable) across quarterly " +
      "periods, and the app's schema has no concept of a sustainability category at all. " +
      "There is nowhere to put the most important column.",
    question:
      "Can the #REF! chain be repaired at source? And should the app gain proper " +
      "mass-balance tables (sustainability category per batch) — that is what ISCC " +
      "auditing actually needs, and iscc_certificates alone cannot express it.",
  },
  {
    key: "invoices",
    label: "Invoices / receivables",
    path: "06_Sales_and_Offtake/OOMCO/Wakud_OOMCO_Payments.xlsx",
    targetTables: ["invoices"],
    status: "blocked",
    blocked:
      "This is a bank statement export ('Bank NBO OMR Transactions'), one buyer only, " +
      "with dated payments in OMR against reference numbers. It records money received, " +
      "not invoices issued — there is no issue date, due date or status to import, and " +
      "invoices.invoice_number is NOT NULL and UNIQUE.",
    question:
      "Where is the receivables ledger — the list of invoices raised, with number, " +
      "amount, issue and due date? (It may live in the accounting system rather than " +
      "SharePoint, in which case that is the integration to scope, not this file.)",
  },
  {
    key: "quality_tests",
    label: "Quality / lab results",
    path: "04_Quality_and_Laboratory/Legacy_QA/Lab Expences/LAB TRACKING SYSTEM.xlsx",
    targetTables: ["quality_tests"],
    status: "blocked",
    blocked:
      "A sample dispatch and lab-expense log from 2023 — sample number, date, who " +
      "couriered it, which lab, report number, price paid. It holds no test results: " +
      "none of density, viscosity, flash point, sulfur, water, acid value, methanol, " +
      "oxidation stability, cloud point or cetane appear anywhere in it.",
    question:
      "Where do the actual QC panel results live — inside the lab's PDF reports only? " +
      "If so, quality_tests needs manual entry (or OCR), not a spreadsheet sync.",
  },
  {
    key: "shipments",
    label: "Logistics / shipments",
    path: "06_Sales_and_Offtake/OOMCO/OOMCO_Salalah Deport Tracking Report.xlsx",
    targetTables: ["shipments"],
    status: "blocked",
    blocked:
      "A depot stock reconciliation for one customer (quantities delivered to Salalah, " +
      "manual sales, payments received) in litres and OMR. It carries no vessel name, " +
      "bill of lading, container count, departure/ETA/arrival dates or incoterm — which " +
      "is essentially the whole of the shipments table. Five near-duplicate copies of " +
      "this filename exist in different folders.",
    question:
      "Is there vessel/BoL-level shipment tracking anywhere, or is logistics managed by " +
      "the freight forwarder outside SharePoint?",
  },
  {
    key: "raw_material_orders",
    label: "Procurement / raw material orders",
    path: "05_Supply_Chain_and_Logistics/Procurement/Requisitions Sheet.xlsx",
    targetTables: ["raw_material_orders"],
    status: "blocked",
    blocked:
      "'Wakud PO.xlsx' exists in seven different folders with no way to tell which is the " +
      "live register, and the procurement folder holds per-order templates rather than a " +
      "single running order book.",
    question:
      "Is there one procurement register listing every raw-material order with supplier, " +
      "quantity, lead time and required-by date — or is each order its own file?",
  },
  {
    key: "uco_intake",
    label: "UCO intake",
    path: "05_Supply_Chain_and_Logistics/UCO_Feedstock_Management/Al Mouj - Beah - UCO Collection/Al Mouj UCO.xlsx",
    targetTables: ["stock_levels"],
    status: "blocked",
    blocked:
      "A collection billing sheet for one site — location, unit type, quantity, container " +
      "type, unit rate and total in OMR. It is what Wakud pays for collection, not a " +
      "feedstock intake register, and it carries no sustainability declaration, which is " +
      "the field ISCC actually needs against each intake.",
    question:
      "Where is UCO recorded as it arrives at Barka, with supplier and sustainability " +
      "declaration? (Daily UCO receipts are in the inventory workbook, but without a " +
      "supplier or a sustainability category.)",
  },
];

export const ACTIVE_SOURCES = SOURCES.filter((s) => s.status === "active");
export const BLOCKED_SOURCES = SOURCES.filter((s) => s.status === "blocked");

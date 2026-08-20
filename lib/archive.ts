/**
 * Archiving — the app's only form of removal.
 *
 * There is no hard delete anywhere in WakudOS and there is not meant to be:
 * supabase/roles-rls.sql sets allow_delete = false on every business table, and
 * audit_log.entity_id carries no foreign key, so deleting a record would leave
 * its own Change Log history pointing at nothing. A voided tax invoice must
 * also stay on file. Archiving covers the real need — getting a wrong or
 * superseded record out of everyone's way — without any of that damage.
 *
 * Archiving is an UPDATE, so the existing per-role write matrix already decides
 * who may do it: whoever may edit a deal may archive one. That is the whole
 * permission model here; canArchive() is canWrite() against the domain the
 * entity sits in.
 */

import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { canWrite, type Role } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

type ArchivableConfig = {
  /** Table to update. */
  table: "deals" | "contracts" | "invoices" | "raw_material_orders" | "shipments";
  /** Write domain the entity sits behind — the same one its edit action uses. */
  domain: string;
  /** Human noun for confirm copy: "Archive this deal?" */
  label: string;
  /** Where the list of these lives — revalidated after every archive. */
  listPath: string;
  /** Detail route prefix, or null where the entity has no detail page yet. */
  detailBase: string | null;
  /** Any other route that renders these rows and must be refreshed too. */
  alsoRevalidate: readonly string[];
};

/**
 * Every archivable entity, keyed by the entity_type it is recorded under in
 * audit_log. A table absent from here cannot be archived at all — production
 * months and stock levels are periodic records, not things you retire.
 */
export const ARCHIVABLE = {
  deal: {
    table: "deals",
    domain: "deals",
    label: "deal",
    listPath: "/deals",
    detailBase: "/deals",
    alsoRevalidate: [],
  },
  contract: {
    table: "contracts",
    domain: "contracts",
    label: "contract",
    listPath: "/contracts",
    detailBase: "/contracts",
    // Sales Forecast lists contracts too, and drops archived ones.
    alsoRevalidate: ["/sales-forecast"],
  },
  invoice: {
    table: "invoices",
    domain: "finance",
    label: "invoice",
    listPath: "/finance",
    detailBase: "/finance/invoices",
    alsoRevalidate: [],
  },
  // No detail page yet, so nothing in the UI archives these two — the columns,
  // the list filter and the "Show archived" toggle are in place for when there
  // is somewhere to press the button.
  raw_material_order: {
    table: "raw_material_orders",
    domain: "inventory",
    label: "material order",
    listPath: "/inventory",
    detailBase: null,
    alsoRevalidate: [],
  },
  shipment: {
    table: "shipments",
    domain: "logistics",
    label: "shipment",
    listPath: "/logistics",
    detailBase: null,
    alsoRevalidate: [],
  },
} as const satisfies Record<string, ArchivableConfig>;

export type ArchivableEntity = keyof typeof ARCHIVABLE;

/**
 * Membership test for an entity name arriving from outside.
 *
 * A Set rather than `entity in ARCHIVABLE` or a truthiness check on the lookup:
 * plain property access answers "__proto__" and "constructor" with something
 * truthy, which would walk straight past a guard written the obvious way.
 */
const ARCHIVABLE_NAMES: ReadonlySet<string> = new Set(Object.keys(ARCHIVABLE));

export function isArchivableEntity(value: unknown): value is ArchivableEntity {
  return typeof value === "string" && ARCHIVABLE_NAMES.has(value);
}

/** Whether `role` may archive (or unarchive) this kind of record. */
export function canArchive(role: Role | null | undefined, entity: unknown): boolean {
  if (!isArchivableEntity(entity)) return false;
  return canWrite(role, ARCHIVABLE[entity].domain);
}

export type ArchiveResult = { ok: true } | { ok: false; message: string };

/**
 * Set or clear a record's archived state, and record it in audit_log.
 *
 * Callers must have gone through requireWriter() first — this does the write,
 * not the gate. Unarchiving clears archived_by as well: "who archived this" is
 * meaningless once it is live again, and the durable answer is the audit row.
 */
export async function setArchived(
  supabase: ServerSupabaseClient,
  params: { entity: ArchivableEntity; id: string; userId: string | null; archive: boolean },
): Promise<ArchiveResult> {
  const config = ARCHIVABLE[params.entity];
  // Narrowed at the boundary: `from()` over a union of table names does not
  // resolve to one callable builder, and the payload below is checked against
  // ArchivedPatch either way.
  const table = supabase.from(config.table) as unknown as GenericTable;

  const { data: existing, error: readError } = await table
    .select("id, archived_at, archived_by")
    .eq("id", params.id)
    .maybeSingle();

  if (readError) return { ok: false, message: readError.message };
  if (!existing) return { ok: false, message: "That record no longer exists." };

  const patch: ArchivedPatch = params.archive
    ? { archived_at: new Date().toISOString(), archived_by: params.userId }
    : { archived_at: null, archived_by: null };

  const { error } = await table.update(patch).eq("id", params.id);
  if (error) return { ok: false, message: error.message };

  // An archive is the single most important thing in this app to record.
  await logAudit(supabase, {
    userId: params.userId,
    action: params.archive ? "archive" : "unarchive",
    entityType: params.entity,
    entityId: params.id,
    oldValue: existing,
    newValue: patch,
  });

  return { ok: true };
}

type ArchivedPatch = { archived_at: string | null; archived_by: string | null };

/** The two calls setArchived makes, as this module needs them. */
type GenericTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: ArchivedPatch | null; error: { message: string } | null }>;
    };
  };
  update: (patch: ArchivedPatch) => {
    eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
  };
};

// ----------------------------------------------------------------------------
// The "Show archived" URL state, shared by every list page.
// ----------------------------------------------------------------------------

/** Query parameter that switches a list from live-only to live + archived. */
export const ARCHIVED_PARAM = "archived";

type SearchParams = Record<string, string | string[] | undefined>;

/** Whether the current request asked to see archived rows. */
export function showArchivedFrom(searchParams: SearchParams | undefined): boolean {
  return searchParams?.[ARCHIVED_PARAM] === "1";
}

/**
 * Href that flips the archived state while keeping every other parameter.
 *
 * Keeping them matters: global search sends people to `/contracts?q=acme`, and
 * a toggle that dropped `q` would quietly widen the list back out to everything
 * the moment somebody looked for the archived one.
 */
export function toggleArchivedHref(basePath: string, searchParams: SearchParams | undefined): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === ARCHIVED_PARAM || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
    else next.set(key, value);
  }
  if (!showArchivedFrom(searchParams)) next.set(ARCHIVED_PARAM, "1");
  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

import { describe, it, expect } from "vitest";
import {
  ARCHIVABLE,
  canArchive,
  isArchivableEntity,
  setArchived,
  showArchivedFrom,
  toggleArchivedHref,
  type ArchivableEntity,
} from "@/lib/archive";
import { ROLES, type Role } from "@/lib/permissions";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Guards on the one operation that takes a record out of everyone's way.
 *
 * Two things must hold no matter what. A role that cannot write a kind of
 * record cannot archive one either — archiving is an edit, gated by the same
 * matrix. And archiving must never turn into deletion: the whole design rests
 * on the row staying on file, because audit_log.entity_id has no foreign key
 * and a voided tax invoice may not disappear.
 */

const ENTITIES = Object.keys(ARCHIVABLE) as ArchivableEntity[];

describe("isArchivableEntity", () => {
  it("accepts exactly the five configured entities", () => {
    expect(ENTITIES).toEqual(["deal", "contract", "invoice", "raw_material_order", "shipment"]);
    for (const e of ENTITIES) expect(isArchivableEntity(e)).toBe(true);
  });

  it("rejects tables that are deliberately not archivable", () => {
    // Periodic records, not things you retire.
    expect(isArchivableEntity("production_plan")).toBe(false);
    expect(isArchivableEntity("stock_level")).toBe(false);
    expect(isArchivableEntity("task")).toBe(false);
    expect(isArchivableEntity("user")).toBe(false);
  });

  // The reason the check is a Set and not `ARCHIVABLE[entity]` — plain property
  // access answers these with something truthy and walks past a naive guard.
  it("rejects inherited Object properties", () => {
    expect(isArchivableEntity("__proto__")).toBe(false);
    expect(isArchivableEntity("constructor")).toBe(false);
    expect(isArchivableEntity("toString")).toBe(false);
    expect(isArchivableEntity("hasOwnProperty")).toBe(false);
  });

  it("rejects non-strings and empty input", () => {
    expect(isArchivableEntity(null)).toBe(false);
    expect(isArchivableEntity(undefined)).toBe(false);
    expect(isArchivableEntity("")).toBe(false);
    expect(isArchivableEntity(42)).toBe(false);
    expect(isArchivableEntity({ table: "deals" })).toBe(false);
  });
});

describe("canArchive", () => {
  it("lets nobody archive an entity that is not archivable", () => {
    for (const role of ROLES) {
      expect(canArchive(role, "production_plan")).toBe(false);
      expect(canArchive(role, "__proto__")).toBe(false);
    }
  });

  it("refuses every entity to executive_viewer — the role is read-only by design", () => {
    for (const e of ENTITIES) expect(canArchive("executive_viewer", e)).toBe(false);
  });

  it("refuses every entity when there is no role at all", () => {
    for (const e of ENTITIES) {
      expect(canArchive(null, e)).toBe(false);
      expect(canArchive(undefined, e)).toBe(false);
    }
  });

  it("lets admin and gm archive everything", () => {
    for (const role of ["admin", "gm"] as Role[]) {
      for (const e of ENTITIES) expect(canArchive(role, e)).toBe(true);
    }
  });

  // Each domain role gets exactly its own records and nothing else. Contracts
  // are admin/gm-only at the database, so sales — who writes the deals behind
  // them — must not be able to retire one.
  it("holds domain roles to their own records", () => {
    expect(canArchive("sales", "deal")).toBe(true);
    expect(canArchive("sales", "contract")).toBe(false);
    expect(canArchive("sales", "invoice")).toBe(false);
    expect(canArchive("sales", "shipment")).toBe(false);

    expect(canArchive("finance", "invoice")).toBe(true);
    expect(canArchive("finance", "deal")).toBe(false);
    expect(canArchive("finance", "contract")).toBe(false);

    expect(canArchive("operations", "raw_material_order")).toBe(true);
    expect(canArchive("operations", "shipment")).toBe(true);
    expect(canArchive("operations", "deal")).toBe(false);
    expect(canArchive("operations", "invoice")).toBe(false);
  });

  it("gates each entity on the same domain its edit action uses", () => {
    // A drift check: if someone moves an entity to another domain, this fails
    // rather than silently widening who can retire records.
    expect(ARCHIVABLE.deal.domain).toBe("deals");
    expect(ARCHIVABLE.contract.domain).toBe("contracts");
    expect(ARCHIVABLE.invoice.domain).toBe("finance");
    expect(ARCHIVABLE.raw_material_order.domain).toBe("inventory");
    expect(ARCHIVABLE.shipment.domain).toBe("logistics");
  });
});

// ---------------------------------------------------------------------------
// setArchived, against a recording stand-in for the Supabase client.
// ---------------------------------------------------------------------------

type Call = { table: string; method: string; payload?: unknown };

function stubClient(opts: { existing?: unknown; updateError?: string; readError?: string } = {}) {
  const calls: Call[] = [];
  const existing = "existing" in opts ? opts.existing : { id: "rec-1", archived_at: null, archived_by: null };

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          calls.push({ table, method: "select", payload: columns });
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: existing ?? null,
                error: opts.readError ? { message: opts.readError } : null,
              }),
            }),
          };
        },
        update(patch: unknown) {
          calls.push({ table, method: "update", payload: patch });
          return {
            eq: async () => ({ error: opts.updateError ? { message: opts.updateError } : null }),
          };
        },
        insert(row: unknown) {
          calls.push({ table, method: "insert", payload: row });
          return Promise.resolve({ error: null });
        },
        delete() {
          calls.push({ table, method: "delete" });
          throw new Error("setArchived must never delete");
        },
      };
    },
  };

  // A test double, not a real client — the cast is the point of the stub.
  return { client: client as unknown as ServerSupabaseClient, calls };
}

const auditRow = (calls: Call[]) =>
  calls.find((c) => c.table === "audit_log" && c.method === "insert")?.payload as
    | Record<string, unknown>
    | undefined;

describe("setArchived", () => {
  it("stamps archived_at and archived_by, and updates rather than deletes", async () => {
    const { client, calls } = stubClient();
    const result = await setArchived(client, {
      entity: "deal",
      id: "rec-1",
      userId: "user-9",
      archive: true,
    });

    expect(result).toEqual({ ok: true });

    const update = calls.find((c) => c.table === "deals" && c.method === "update");
    expect(update).toBeDefined();
    const patch = update?.payload as { archived_at: string | null; archived_by: string | null };
    expect(patch.archived_by).toBe("user-9");
    expect(typeof patch.archived_at).toBe("string");
    expect(Number.isNaN(Date.parse(patch.archived_at as string))).toBe(false);

    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("writes each entity to its own table", async () => {
    for (const entity of ENTITIES) {
      const { client, calls } = stubClient();
      await setArchived(client, { entity, id: "rec-1", userId: "u", archive: true });
      expect(calls.some((c) => c.table === ARCHIVABLE[entity].table && c.method === "update")).toBe(true);
    }
  });

  it("records the archive in audit_log under the entity's own type", async () => {
    const { client, calls } = stubClient();
    await setArchived(client, { entity: "invoice", id: "inv-1", userId: "user-9", archive: true });

    const row = auditRow(calls);
    expect(row).toBeDefined();
    expect(row?.action).toBe("archive");
    expect(row?.entity_type).toBe("invoice");
    expect(row?.entity_id).toBe("inv-1");
    expect(row?.user_id).toBe("user-9");
  });

  it("clears both columns on unarchive and logs it as its own action", async () => {
    const { client, calls } = stubClient({
      existing: { id: "rec-1", archived_at: "2026-08-01T00:00:00Z", archived_by: "user-3" },
    });
    const result = await setArchived(client, {
      entity: "contract",
      id: "rec-1",
      userId: "user-9",
      archive: false,
    });

    expect(result).toEqual({ ok: true });
    const update = calls.find((c) => c.table === "contracts" && c.method === "update");
    expect(update?.payload).toEqual({ archived_at: null, archived_by: null });
    expect(auditRow(calls)?.action).toBe("unarchive");
  });

  it("refuses a record that is not there, and logs nothing", async () => {
    const { client, calls } = stubClient({ existing: null });
    const result = await setArchived(client, {
      entity: "deal",
      id: "gone",
      userId: "u",
      archive: true,
    });

    expect(result).toEqual({ ok: false, message: "That record no longer exists." });
    expect(calls.some((c) => c.method === "update")).toBe(false);
    expect(auditRow(calls)).toBeUndefined();
  });

  it("does not record an archive that the database refused", async () => {
    const { client, calls } = stubClient({ updateError: "new row violates row-level security policy" });
    const result = await setArchived(client, {
      entity: "deal",
      id: "rec-1",
      userId: "u",
      archive: true,
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ message: "new row violates row-level security policy" });
    // The audit log must not claim something happened that did not.
    expect(auditRow(calls)).toBeUndefined();
  });

  it("surfaces a failed read instead of archiving blind", async () => {
    const { client, calls } = stubClient({ readError: "permission denied" });
    const result = await setArchived(client, {
      entity: "shipment",
      id: "rec-1",
      userId: "u",
      archive: true,
    });

    expect(result).toEqual({ ok: false, message: "permission denied" });
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("captures the before state so the Change Log can show what moved", async () => {
    const { client, calls } = stubClient({
      existing: { id: "rec-1", archived_at: null, archived_by: null },
    });
    await setArchived(client, { entity: "deal", id: "rec-1", userId: "u", archive: true });

    const row = auditRow(calls);
    expect(row?.old_value).toEqual({ id: "rec-1", archived_at: null, archived_by: null });
    expect(row?.new_value).toMatchObject({ archived_by: "u" });
  });
});

describe("the show-archived URL state", () => {
  it("is off unless the parameter says otherwise", () => {
    expect(showArchivedFrom(undefined)).toBe(false);
    expect(showArchivedFrom({})).toBe(false);
    expect(showArchivedFrom({ archived: "0" })).toBe(false);
    expect(showArchivedFrom({ archived: "true" })).toBe(false);
    expect(showArchivedFrom({ archived: "1" })).toBe(true);
  });

  it("turns the toggle on and off again", () => {
    expect(toggleArchivedHref("/deals", {})).toBe("/deals?archived=1");
    expect(toggleArchivedHref("/deals", { archived: "1" })).toBe("/deals");
  });

  // The reason this is a function and not a string literal: global search sends
  // people to /contracts?q=acme, and dropping q would silently widen the list.
  it("keeps the other parameters on the way through", () => {
    expect(toggleArchivedHref("/contracts", { q: "acme" })).toBe("/contracts?q=acme&archived=1");
    expect(toggleArchivedHref("/contracts", { q: "acme", archived: "1" })).toBe("/contracts?q=acme");
  });

  it("escapes parameter values rather than pasting them in raw", () => {
    expect(toggleArchivedHref("/deals", { q: "a b&c=d" })).toBe("/deals?q=a+b%26c%3Dd&archived=1");
  });

  it("carries repeated parameters through unflattened", () => {
    expect(toggleArchivedHref("/deals", { tag: ["a", "b"] })).toBe("/deals?tag=a&tag=b&archived=1");
  });
});

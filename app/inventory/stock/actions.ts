"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stockLevelSchema, type StockLevelInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { evaluateReorder } from "@/lib/reorder";
import { requireWriter, zodErrors, normalizeMonth, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type StockInsert = Database["public"]["Tables"]["stock_levels"]["Insert"];

/** Closing and below-safety are derived server-side, never taken from the client. */
function toRow(s: StockLevelInput): StockInsert {
  const opening = s.opening_stock;
  const produced = s.produced ?? 0;
  const purchased = s.purchased ?? 0;
  const delivered = s.delivered ?? 0;
  // Left empty means no threshold set. Storing NULL keeps that honest — the old
  // fallback to 20 invented a number nobody chose (the DB default is dropped
  // too, see supabase/phase5b-stock-safety-unit.sql).
  const safety = s.safety_stock_level ?? null;
  const closing = opening + produced + purchased - delivered;
  return {
    product: s.product,
    month: normalizeMonth(s.month) as string,
    opening_stock: opening,
    produced,
    purchased,
    delivered,
    closing_stock: closing,
    safety_stock_level: safety,
    // Only meaningful when a threshold exists and both sides are in the same
    // unit; otherwise there is nothing to compare and the flag stays null.
    is_below_safety:
      safety !== null && s.unit === s.safety_stock_unit ? closing < safety : null,
    unit: s.unit,
    safety_stock_unit: s.safety_stock_unit,
  };
}

export async function createStockLevel(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("inventory");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = stockLevelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = toRow(parsed.data);
  const { data, error } = await writer.supabase.from("stock_levels").insert(row as never).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "stock_level",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  // Re-evaluate reorder alerts after the stock change (best-effort).
  await evaluateReorder(writer.supabase).catch(() => {});

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateStockLevel(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("inventory");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = stockLevelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("stock_levels").select("*").eq("id", id).single();
  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("stock_levels").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "stock_level",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  await evaluateReorder(writer.supabase).catch(() => {});

  revalidatePath("/inventory");
  redirect("/inventory");
}

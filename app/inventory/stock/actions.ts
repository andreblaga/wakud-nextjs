"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stockLevelSchema, type StockLevelInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { evaluateReorder } from "@/lib/reorder";
import { requireWriter, zodErrors, normalizeMonth, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type StockInsert = Database["public"]["Tables"]["stock_levels"]["Insert"];

const DEFAULT_SAFETY = 20; // matches stock_levels.safety_stock_level default

/** Closing and below-safety are derived server-side, never taken from the client. */
function toRow(s: StockLevelInput): StockInsert {
  const opening = s.opening_stock;
  const produced = s.produced ?? 0;
  const purchased = s.purchased ?? 0;
  const delivered = s.delivered ?? 0;
  const safety = s.safety_stock_level ?? DEFAULT_SAFETY;
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
    // Both numbers come from this form, so they are in the unit it just
    // declared — the comparison is within one unit by construction.
    is_below_safety: closing < safety,
    unit: s.unit,
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

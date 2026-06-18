"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dealSchema, type DealInput } from "@/lib/schemas";
import { evaluateDeal, DEAL_ASSUMPTIONS } from "@/lib/deal-economics";
import { logAudit } from "@/lib/audit";
import {
  requireWriter,
  zodErrors,
  normalizeMonth,
  type FormState,
} from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];

/** Map validated form input + recomputed economics into a deals row. */
function toRow(d: DealInput): DealInsert {
  const econ = evaluateDeal(d);
  return {
    deal_id: d.deal_id,
    name: d.name,
    deal_type: d.deal_type,
    status: d.status,
    buyer: d.buyer,
    input_product: d.input_product ?? "",
    output_product: d.output_product ?? "",
    producer: d.producer ?? "",
    disport: d.disport ?? "",
    tonnes: d.tonnes,
    buy_price_per_tonne: d.buy_price_per_tonne,
    sell_price_per_tonne: d.sell_price_per_tonne,
    shipping_per_tonne: d.shipping_per_tonne ?? 0,
    trucking_per_tonne: d.trucking_per_tonne ?? 0,
    payment_type: d.payment_type ?? null,
    start_month: normalizeMonth(d.start_month),
    end_month: normalizeMonth(d.end_month),
    notes: d.notes ?? null,
    // Server-computed economics — never trust client-submitted profit/margin.
    vat_rate: DEAL_ASSUMPTIONS.VAT_RATE,
    funding_rate: DEAL_ASSUMPTIONS.FUNDING_RATE,
    total_cost: econ.total_cost,
    total_revenue: econ.total_revenue,
    profit: econ.profit,
    margin: econ.margin,
    profit_per_tonne: econ.profit_per_tonne,
    pre_funding_required: econ.pre_funding_required,
  };
}

export async function createDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("deals");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = { ...toRow(parsed.data), created_by: writer.userId };
  const { data, error } = await writer.supabase
    .from("deals")
    .insert(row as never)
    .select("id")
    .single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "deal",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/deals");
  redirect("/deals");
}

export async function updateDeal(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireWriter("deals");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("deals").select("*").eq("id", id).single();

  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("deals").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "deal",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/deals");
  redirect("/deals");
}

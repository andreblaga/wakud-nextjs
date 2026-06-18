"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rawMaterialOrderSchema, type RawMaterialOrderInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { requireWriter, zodErrors, normalizeMonth, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type OrderInsert = Database["public"]["Tables"]["raw_material_orders"]["Insert"];

function toRow(o: RawMaterialOrderInput): OrderInsert {
  return {
    material: o.material,
    supplier: o.supplier ?? "",
    quantity_kg: o.quantity_kg,
    unit_price: o.unit_price ?? null,
    lead_time_days: o.lead_time_days,
    order_date: o.order_date ?? null,
    required_by: o.required_by,
    expected_delivery: o.expected_delivery ?? null,
    actual_delivery: o.actual_delivery ?? null,
    status: o.status ?? "pending",
    linked_month: normalizeMonth(o.linked_month) as string,
    auto_generated: o.auto_generated,
    notes: o.notes ?? null,
  };
}

export async function createOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("inventory");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = rawMaterialOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = toRow(parsed.data);
  const { data, error } = await writer.supabase.from("raw_material_orders").insert(row as never).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "raw_material_order",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateOrder(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("inventory");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = rawMaterialOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("raw_material_orders").select("*").eq("id", id).single();
  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("raw_material_orders").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "raw_material_order",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/inventory");
  redirect("/inventory");
}

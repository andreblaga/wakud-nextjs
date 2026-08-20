"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productionPlanSchema, type ProductionPlanInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { requireWriter, zodErrors, normalizeMonth, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type PlanInsert = Database["public"]["Tables"]["production_plan"]["Insert"];

function toRow(p: ProductionPlanInput): PlanInsert {
  return {
    month: normalizeMonth(p.month) as string,
    target_output: p.target_output,
    actual_output: p.actual_output ?? 0,
    b100_output: p.b100_output ?? null,
    glycerin_output: p.glycerin_output ?? null,
    uco_consumed: p.uco_consumed ?? null,
    status: p.status ?? "planned",
    notes: p.notes ?? null,
  };
}

export async function createProductionPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("production");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = productionPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = toRow(parsed.data);
  const { data, error } = await writer.supabase.from("production_plan").insert(row as never).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "production_plan",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/production");
  redirect("/production");
}

export async function updateProductionPlan(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("production");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = productionPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("production_plan").select("*").eq("id", id).single();
  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("production_plan").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "production_plan",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/production");
  revalidatePath(`/production/${id}`);
  redirect("/production");
}

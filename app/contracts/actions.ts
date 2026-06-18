"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contractSchema, type ContractInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { requireWriter, zodErrors, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type ContractInsert = Database["public"]["Tables"]["contracts"]["Insert"];

function toRow(c: ContractInput): ContractInsert {
  return {
    name: c.name,
    buyer: c.buyer,
    price_per_tonne: c.price_per_tonne,
    is_active: c.is_active,
    status: c.status,
    start_date: c.start_date ?? null,
    end_date: c.end_date ?? null,
    renewal_date: c.renewal_date ?? null,
    payment_terms: c.payment_terms ?? null,
    incoterm: c.incoterm ?? null,
    auto_renew: c.auto_renew,
    termination_notice_days: c.termination_notice_days ?? null,
  };
}

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("contracts");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = toRow(parsed.data);
  const { data, error } = await writer.supabase.from("contracts").insert(row as never).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "contract",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/sales-forecast");
  redirect("/sales-forecast");
}

export async function updateContract(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("contracts");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("contracts").select("*").eq("id", id).single();
  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("contracts").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "contract",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/sales-forecast");
  redirect("/sales-forecast");
}

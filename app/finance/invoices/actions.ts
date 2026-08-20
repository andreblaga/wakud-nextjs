"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invoiceSchema, type InvoiceInput } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";
import { requireWriter, zodErrors, type FormState } from "@/lib/form-actions";
import type { Database } from "@/lib/supabase/types";

type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"];

function toRow(i: InvoiceInput): InvoiceInsert {
  return {
    invoice_number: i.invoice_number,
    deal_id: i.deal_id ?? null,
    buyer: i.buyer,
    amount_usd: i.amount_usd, // amount_omr is a generated column
    issue_date: i.issue_date,
    due_date: i.due_date,
    paid_date: i.paid_date ?? null,
    status: i.status,
    payment_method: i.payment_method ?? null,
    notes: i.notes ?? null,
  };
}

export async function createInvoice(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("finance");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const row = toRow(parsed.data);
  const { data, error } = await writer.supabase.from("invoices").insert(row as never).select("id").single();
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "create",
    entityType: "invoice",
    entityId: (data as { id: string } | null)?.id ?? null,
    newValue: row,
  });

  revalidatePath("/finance");
  redirect("/finance");
}

export async function updateInvoice(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireWriter("finance");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const { data: existing } = await writer.supabase.from("invoices").select("*").eq("id", id).single();
  const row = toRow(parsed.data);
  const { error } = await writer.supabase.from("invoices").update(row as never).eq("id", id);
  if (error) return { ok: false, formError: error.message };

  await logAudit(writer.supabase, {
    userId: writer.userId,
    action: "update",
    entityType: "invoice",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });

  revalidatePath("/finance");
  revalidatePath(`/finance/invoices/${id}`);
  redirect("/finance");
}

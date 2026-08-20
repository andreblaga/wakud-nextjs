import { notFound, redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import InvoiceForm, { type InvoiceDefaults } from "../../InvoiceForm";
import { updateInvoice } from "../../actions";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  // A reader who lands here is sent to the read-only view of the same record
  // rather than bounced out to a list.
  if (!canWrite(user?.role, "finance")) redirect(`/finance/invoices/${params.id}`);

  const supabase = createClient();
  if (!supabase) redirect("/finance");

  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, deal_id, buyer, amount_usd, issue_date, due_date, paid_date, status, payment_method, notes")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as InvoiceDefaults;
  const action = updateInvoice.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${defaults.invoice_number ?? "invoice"}`} description="USD; OMR computed at the fixed peg" icon={Wallet} />
      <InvoiceForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

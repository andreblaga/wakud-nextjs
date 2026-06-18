import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import InvoiceForm from "../InvoiceForm";
import { createInvoice } from "../actions";

export default async function NewInvoicePage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "finance")) redirect("/finance");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New invoice" description="USD; OMR computed at the fixed peg" icon={Wallet} />
      <InvoiceForm action={createInvoice} submitLabel="Create invoice" />
    </div>
  );
}

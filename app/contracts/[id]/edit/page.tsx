import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import ContractForm, { type ContractDefaults } from "../../ContractForm";
import { updateContract } from "../../actions";

export default async function EditContractPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  // A reader who lands here is sent to the read-only view of the same record
  // rather than bounced out to a list.
  if (!canWrite(user?.role, "contracts")) redirect(`/contracts/${params.id}`);

  const supabase = createClient();
  if (!supabase) redirect("/contracts");

  const { data } = await supabase
    .from("contracts")
    .select("id, name, buyer, price_per_tonne, is_active, status, start_date, end_date, renewal_date, payment_terms, incoterm, auto_renew, termination_notice_days")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as ContractDefaults;
  const action = updateContract.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${defaults.name ?? "contract"}`} description="Buyer agreement & pricing" icon={FileText} />
      <ContractForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import ContractForm from "../ContractForm";
import { createContract } from "../actions";

export default async function NewContractPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "contracts")) redirect("/sales-forecast");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New contract" description="Buyer agreement & pricing" icon={Handshake} />
      <ContractForm action={createContract} submitLabel="Create contract" />
    </div>
  );
}

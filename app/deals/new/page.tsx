import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import DealForm from "../DealForm";
import { createDeal } from "../actions";

export default async function NewDealPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "deals")) redirect("/deals");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="New deal" description="Trade evaluation — economics compute as you type" icon={Handshake} />
      <DealForm action={createDeal} submitLabel="Create deal" />
    </div>
  );
}

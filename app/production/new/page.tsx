import { redirect } from "next/navigation";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import ProductionPlanForm from "../ProductionPlanForm";
import { createProductionPlan } from "../actions";

export default async function NewProductionPlanPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "production")) redirect("/production");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New production month" description="Monthly target & output" icon={Factory} />
      <ProductionPlanForm action={createProductionPlan} submitLabel="Create" />
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import ProductionPlanForm, { type ProductionPlanDefaults } from "../../ProductionPlanForm";
import { updateProductionPlan } from "../../actions";

export default async function EditProductionPlanPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  // A reader who lands here is sent to the read-only view of the same record
  // rather than bounced out to a list.
  if (!canWrite(user?.role, "production")) redirect(`/production/${params.id}`);

  const supabase = createClient();
  if (!supabase) redirect("/production");

  const { data } = await supabase
    .from("production_plan")
    .select("id, month, target_output, actual_output, b100_output, glycerin_output, uco_consumed, status, notes")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as ProductionPlanDefaults;
  const action = updateProductionPlan.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit production month" description="Monthly target & output" icon={Factory} />
      <ProductionPlanForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

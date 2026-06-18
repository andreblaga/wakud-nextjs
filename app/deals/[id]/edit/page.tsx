import { notFound, redirect } from "next/navigation";
import { Handshake } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import DealForm, { type DealDefaults } from "../../DealForm";
import { updateDeal } from "../../actions";

export default async function EditDealPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "deals")) redirect("/deals");

  const supabase = createClient();
  if (!supabase) redirect("/deals");

  const { data } = await supabase
    .from("deals")
    .select("id, deal_id, name, deal_type, status, buyer, input_product, output_product, producer, disport, tonnes, buy_price_per_tonne, sell_price_per_tonne, shipping_per_tonne, trucking_per_tonne, payment_type, start_month, end_month, notes")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as DealDefaults;
  const action = updateDeal.bind(null, params.id);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Edit ${defaults.deal_id ?? "deal"}`} description="Economics recompute on save" icon={Handshake} />
      <DealForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

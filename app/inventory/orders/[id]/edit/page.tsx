import { notFound, redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import OrderForm, { type OrderDefaults } from "../../OrderForm";
import { updateOrder } from "../../actions";

export default async function EditOrderPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "inventory")) redirect("/inventory");

  const supabase = createClient();
  if (!supabase) redirect("/inventory");

  const { data } = await supabase
    .from("raw_material_orders")
    .select("id, material, supplier, quantity_kg, unit_price, lead_time_days, order_date, required_by, expected_delivery, actual_delivery, status, linked_month, auto_generated, notes")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as OrderDefaults;
  const action = updateOrder.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${defaults.material ?? "order"}`} description="Procurement with lead time" icon={Boxes} />
      <OrderForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

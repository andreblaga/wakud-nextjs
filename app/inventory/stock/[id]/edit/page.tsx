import { notFound, redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import StockForm, { type StockDefaults } from "../../StockForm";
import { updateStockLevel } from "../../actions";

export default async function EditStockPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "inventory")) redirect("/inventory");

  const supabase = createClient();
  if (!supabase) redirect("/inventory");

  const { data } = await supabase
    .from("stock_levels")
    .select("id, product, month, opening_stock, produced, purchased, delivered, safety_stock_level, unit")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const defaults = data as StockDefaults;
  const action = updateStockLevel.bind(null, params.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Edit stock entry" description="Monthly stock for a product" icon={Boxes} />
      <StockForm action={action} defaults={defaults} submitLabel="Save changes" />
    </div>
  );
}

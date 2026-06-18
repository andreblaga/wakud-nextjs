import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import StockForm from "../StockForm";
import { createStockLevel } from "../actions";

export default async function NewStockPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "inventory")) redirect("/inventory");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New stock entry" description="Monthly stock for a product" icon={Boxes} />
      <StockForm action={createStockLevel} submitLabel="Create" />
    </div>
  );
}

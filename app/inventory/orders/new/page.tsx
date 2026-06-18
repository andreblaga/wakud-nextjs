import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import OrderForm from "../OrderForm";
import { createOrder } from "../actions";

export default async function NewOrderPage() {
  const user = await getSessionUser();
  if (!canWrite(user?.role, "inventory")) redirect("/inventory");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New material order" description="Procurement with lead time" icon={Boxes} />
      <OrderForm action={createOrder} submitLabel="Create" />
    </div>
  );
}

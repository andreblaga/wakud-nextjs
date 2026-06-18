"use server";

import { revalidatePath } from "next/cache";
import { requireWriter, type FormState } from "@/lib/form-actions";
import { evaluateReorder } from "@/lib/reorder";

/** Run the reorder check on demand (operations/gm). Raises alerts and reports the count. */
export async function runReorderCheck(_prev: FormState, _formData: FormData): Promise<FormState> {
  const gate = await requireWriter("inventory");
  if ("error" in gate) return gate.error;
  const { writer } = gate;

  const res = await evaluateReorder(writer.supabase);
  revalidatePath("/inventory");
  revalidatePath("/");

  return {
    ok: true,
    message:
      res.raised > 0
        ? `Raised ${res.raised} alert${res.raised === 1 ? "" : "s"}: ${res.flagged.join(", ")}.`
        : "No new reorder alerts — stock is above safety.",
  };
}

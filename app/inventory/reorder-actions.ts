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

  // Mismatches are called out separately: those products were not judged at all,
  // so reporting them as "above safety" would be wrong.
  const parts: string[] = [];
  if (res.flagged.length > 0) {
    parts.push(`Raised ${res.flagged.length} reorder alert${res.flagged.length === 1 ? "" : "s"}: ${res.flagged.join(", ")}.`);
  }
  if (res.mismatched.length > 0) {
    parts.push(`Not checked (units differ from the safety level): ${res.mismatched.join(", ")}.`);
  }
  if (parts.length === 0) parts.push("No new reorder alerts — stock is above safety.");

  return { ok: true, message: parts.join(" ") };
}

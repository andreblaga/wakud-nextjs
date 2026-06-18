"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState, useFormStatus } from "react-dom";
import { RefreshCw, Loader2 } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { runReorderCheck } from "./reorder-actions";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      Run reorder check
    </button>
  );
}

export default function ReorderButton() {
  const [state, action] = useFormState(runReorderCheck, INITIAL_FORM_STATE);
  return (
    <form action={action} className="mt-3 space-y-2">
      <Button />
      {state.message && <p className="text-[11px] text-slate-500">{state.message}</p>}
      {state.formError && <p className="text-[11px] text-red-600">{state.formError}</p>}
    </form>
  );
}

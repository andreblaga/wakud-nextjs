"use client";

import { useEffect, useState } from "react";
// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Archive, ArchiveRestore } from "lucide-react";
import { RoleGate } from "@/components/RoleGate";
import { FormError, SubmitButton } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Archive / restore control for a detail page.
 *
 * Behind RoleGate like the Edit button, so a reader never sees it. Archiving
 * asks first — it takes the record out of every default list, and the person
 * pressing it should know that is what happens. Restoring does not ask: it puts
 * things back, which needs no defending.
 */
export default function ArchiveButton({
  action,
  domain,
  archived,
  label,
}: {
  action: Action;
  /** Write domain gating the control — the record's own domain. */
  domain: string;
  /** Current state: true renders "Restore", false renders "Archive". */
  archived: boolean;
  /** Human noun for the confirm copy: "Archive this deal?" */
  label: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const [confirming, setConfirming] = useState(false);

  // The page re-renders archived once the action's revalidate lands; close the
  // confirm panel so it does not hang over the result.
  useEffect(() => {
    if (state.ok) setConfirming(false);
  }, [state.ok]);

  return (
    <RoleGate domain={domain}>
      <div className="relative">
        {archived ? (
          <form action={formAction}>
            <SubmitButton
              pendingLabel="Restoring…"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <ArchiveRestore className="h-4 w-4" /> Restore
            </SubmitButton>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
        )}

        {confirming && !archived && (
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-medium text-slate-800">Archive this {label}?</p>
            <p className="mt-1 text-xs text-slate-500">
              It drops out of the default lists but stays on file, keeps its Change Log history,
              and can be restored at any time. Nothing is deleted.
            </p>
            <form action={formAction} className="mt-3 flex items-center gap-2">
              <SubmitButton
                pendingLabel="Archiving…"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
              >
                Archive
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {state.formError && (
          <div className="absolute right-0 z-20 mt-2 w-72">
            <FormError message={state.formError} />
          </div>
        )}
      </div>
    </RoleGate>
  );
}

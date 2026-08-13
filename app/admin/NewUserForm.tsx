"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui";
import { TextInput, SelectInput, FormError, SubmitButton } from "@/components/form";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import SecretNotice from "./SecretNotice";
import { createUser } from "./actions";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export default function NewUserForm() {
  const [state, formAction] = useFormState(createUser, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-brand-700" />
        <h2 className="text-sm font-semibold text-slate-900">Add a user</h2>
      </div>

      <form action={formAction} className="space-y-4">
        <TextInput
          name="email"
          type="email"
          label="Email"
          required
          placeholder="name@wakud.com"
          error={err.email}
        />
        <SelectInput
          name="role"
          label="Role"
          required
          options={ROLE_OPTIONS}
          defaultValue="operations"
          error={err.role}
        />
        <TextInput
          name="password"
          label="Temporary password"
          hint="Leave blank to generate one — it's shown once after you save."
          error={err.password}
        />

        <FormError message={state.formError} />
        {state.ok && <SecretNotice message={state.message} secret={state.secret} />}

        <SubmitButton>Create user</SubmitButton>
      </form>

      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
        The account is created pre-confirmed, so they can sign in straight away. There is no
        self-serve password reset yet — until that lands, changing a forgotten password means
        coming back here or using the Supabase dashboard.
      </p>
    </Card>
  );
}

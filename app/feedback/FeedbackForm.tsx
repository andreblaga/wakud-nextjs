"use client";

// eslint-disable-next-line import/no-unresolved
import { useFormState } from "react-dom";
import { Card } from "@/components/ui";
import { TextInput, SelectInput, TextArea, FormError, FormActions } from "@/components/form";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { CATEGORY_LABELS, FEEDBACK_CATEGORIES } from "@/lib/feedback";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const CATEGORY_OPTIONS = FEEDBACK_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

/**
 * Title is the only required field. Every extra mandatory box on a suggestion
 * form is a reason not to bother filling it in.
 *
 * There is no "submitted by" input: the server stamps it from the session, and
 * the RLS policy insists it match auth.uid() regardless of what is posted.
 */
export default function FeedbackForm({
  action,
  submitLabel,
}: {
  action: Action;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState(action, INITIAL_FORM_STATE);
  const err = state.errors ?? {};

  return (
    <form action={formAction}>
      <Card className="space-y-4 p-5">
        <TextInput
          name="title"
          label="Title"
          required
          error={err.title}
          placeholder="Stock page should show KL as well as tonnes"
        />
        <SelectInput
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
          error={err.category}
          hint="Optional — helps whoever triages it"
        />
        <TextArea
          name="description"
          label="Description"
          rows={6}
          error={err.description}
          placeholder="What would you change, and why? What happens today?"
        />
        <FormError message={state.formError} />
        <FormActions cancelHref="/feedback" submitLabel={submitLabel} />
      </Card>
    </form>
  );
}

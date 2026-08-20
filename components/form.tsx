"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Loader2, AlertCircle } from "lucide-react";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-accent-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

type BaseProps = {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
};

export function TextInput({ type = "text", ...p }: BaseProps & { type?: string }) {
  return (
    <Field label={p.label} htmlFor={p.name} error={p.error} hint={p.hint} required={p.required}>
      <input
        id={p.name}
        name={p.name}
        type={type}
        required={p.required}
        placeholder={p.placeholder}
        defaultValue={p.defaultValue ?? undefined}
        className={inputClass}
      />
    </Field>
  );
}

export function NumberInput({ step = "any", ...p }: BaseProps & { step?: string }) {
  return (
    <Field label={p.label} htmlFor={p.name} error={p.error} hint={p.hint} required={p.required}>
      <input
        id={p.name}
        name={p.name}
        type="number"
        step={step}
        required={p.required}
        placeholder={p.placeholder}
        defaultValue={p.defaultValue ?? undefined}
        className={inputClass}
      />
    </Field>
  );
}

export function TextArea(p: BaseProps & { rows?: number }) {
  return (
    <Field label={p.label} htmlFor={p.name} error={p.error} hint={p.hint} required={p.required}>
      <textarea
        id={p.name}
        name={p.name}
        rows={p.rows ?? 3}
        placeholder={p.placeholder}
        defaultValue={p.defaultValue ?? undefined}
        className={inputClass}
      />
    </Field>
  );
}

export function SelectInput({
  options,
  ...p
}: BaseProps & { options: { value: string; label: string }[] }) {
  return (
    <Field label={p.label} htmlFor={p.name} error={p.error} hint={p.hint} required={p.required}>
      <select
        id={p.name}
        name={p.name}
        required={p.required}
        defaultValue={p.defaultValue !== null && p.defaultValue !== undefined ? String(p.defaultValue) : ""}
        className={`${inputClass} capitalize`}
      >
        {!p.required && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxInput({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
      />
      <span>
        {label}
        {hint && <span className="ml-1 text-[11px] text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SubmitButton({
  children = "Save",
  pendingLabel = "Saving…",
  className,
}: {
  children?: ReactNode;
  /** What the button says while the action is in flight. */
  pendingLabel?: string;
  /** Overrides the default brand styling — used by the archive confirm. */
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormActions({ cancelHref, submitLabel }: { cancelHref: string; submitLabel?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <SubmitButton>{submitLabel}</SubmitButton>
      <Link href={cancelHref} className="text-sm text-slate-500 hover:text-slate-700">
        Cancel
      </Link>
    </div>
  );
}

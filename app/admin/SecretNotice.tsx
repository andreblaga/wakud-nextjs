"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Shows a success message plus a one-time value the admin must copy before it
 * disappears (a generated password). The value is never retrievable again, so
 * it gets its own monospace line and a copy button rather than being buried in
 * the sentence.
 */
export default function SecretNotice({
  message,
  secret,
}: {
  message?: string;
  secret?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!message && !secret) return null;

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The value is
      // on screen and selectable, so this is a non-event.
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
      {message && <p>{message}</p>}
      {secret && (
        <div className="mt-1.5 flex items-center gap-2">
          <code className="select-all rounded bg-white px-2 py-1 font-mono text-[13px] text-slate-900">
            {secret}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-100"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

const HREF: Record<string, string> = {
  deal: "/deals",
  contract: "/sales-forecast",
  batch: "/production",
};

// @deal:WK-001 / @contract:ABC / @batch:B-12 → deep link
const TOKEN = /@(deal|contract|batch):([\w./-]+)/g;

/** Render a message body, turning @type:id references into deep links. */
export function MessageBody({ body }: { body: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(body)) !== null) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    const [full, type, id] = m;
    parts.push(
      <Link
        key={key++}
        href={HREF[type] ?? "/"}
        className="rounded bg-brand-50 px-1 font-medium text-brand-700 hover:underline"
      >
        @{type}:{id}
      </Link>,
    );
    last = m.index + full.length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
}

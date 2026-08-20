"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Card } from "@/components/ui";
import { useSession } from "@/components/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { addFeedbackComment } from "./actions";
import type { FeedbackCommentRow } from "./types";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The conversation on one feedback item.
 *
 * Two ways a comment arrives, both converging on the same de-duplicated list:
 *
 *   - Realtime, as Discussions does — a colleague's reply appears without a
 *     refresh, which is the point of answering in the app rather than by email.
 *   - The server action's return value, appended directly. Posting goes through
 *     the server so author_id comes from the session rather than the client, and
 *     appending the returned row means your own comment shows up even where the
 *     Realtime socket cannot connect.
 *
 * Both paths de-duplicate by id, so the Realtime echo of your own insert is a
 * no-op rather than a double post.
 */
export default function FeedbackThread({
  feedbackId,
  initialComments,
  names,
}: {
  feedbackId: string;
  initialComments: FeedbackCommentRow[];
  /** author_id → display name, resolved on the server. */
  names: Record<string, string>;
}) {
  const session = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<FeedbackCommentRow[]>(initialComments);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const merge = useCallback((row: FeedbackCommentRow) => {
    setComments((prev) =>
      prev.some((c) => c.id === row.id)
        ? prev
        : [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`feedback-comments-${feedbackId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_comments",
          filter: `feedback_id=eq.${feedbackId}`,
        },
        (payload) => merge(payload.new as FeedbackCommentRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, feedbackId, merge]);

  const nameFor = (authorId: string) => {
    if (session && authorId === session.id) return "You";
    return names[authorId] ?? `#${authorId.slice(0, 8)}`;
  };

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    const result = await addFeedbackComment(feedbackId, text);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    merge(result.comment);
    setBody("");
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">
          Conversation
          {comments.length > 0 && <span className="ml-1 text-slate-400">({comments.length})</span>}
        </h2>
      </div>

      {comments.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs text-slate-400">
          No replies yet. Anyone signed in can respond.
        </p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {comments.map((c) => (
            <li key={c.id} className="px-5 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-slate-800">{nameFor(c.author_id)}</span>
                <span className="text-[11px] text-slate-400">{timeLabel(c.created_at)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={post} className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e);
            }}
            rows={2}
            disabled={!session}
            placeholder={session ? "Reply — ⌘/Ctrl+Enter to send" : "Sign in to reply"}
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!session || sending || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            aria-label="Post reply"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      </form>
    </Card>
  );
}

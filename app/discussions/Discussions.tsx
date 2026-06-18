"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Plus, Send, Link2, Search, MessageSquare, Loader2, CornerDownRight } from "lucide-react";
import { Card } from "@/components/ui";
import { useSession } from "@/components/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { MessageBody } from "./MessageBody";
import type { ChannelRow, MessageRow } from "./types";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function authorName(email: string | null): string {
  if (!email) return "Someone";
  return email.split("@")[0];
}

export default function Discussions() {
  const session = useSession();
  const supabase = useMemo(() => createClient(), []);

  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [query, setQuery] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load channels + subscribe to new ones.
  useEffect(() => {
    if (!supabase) {
      setLoadingChannels(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("channels")
      .select("*")
      .order("name")
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(`${res.error.message} — has supabase/phase4-discussions.sql been run?`);
        const cs = (res.data ?? []) as ChannelRow[];
        setChannels(cs);
        setActiveId((cur) => cur ?? cs[0]?.id ?? null);
        setLoadingChannels(false);
      });

    const ch = supabase
      .channel("channels-all")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channels" }, (payload) => {
        const row = payload.new as ChannelRow;
        setChannels((prev) =>
          prev.some((c) => c.id === row.id) ? prev : [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [supabase]);

  // Load messages for the active channel + subscribe to inserts.
  useEffect(() => {
    if (!supabase || !activeId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    setMessages([]);
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", activeId)
      .order("created_at", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        setMessages((res.data ?? []) as MessageRow[]);
        setLoadingMsgs(false);
      });

    const ch = supabase
      .channel(`messages-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [supabase, activeId]);

  const send = useCallback(
    async (body: string, parentId: string | null): Promise<string | null> => {
      if (!supabase || !session || !activeId) return "Not ready";
      const { error: e } = await supabase.from("messages").insert({
        channel_id: activeId,
        parent_id: parentId,
        user_id: session.id,
        author_email: session.email,
        body: body.trim(),
      } as never);
      return e ? e.message : null;
    },
    [supabase, session, activeId],
  );

  async function createChannel() {
    const clean = newChannel.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean || !supabase) return;
    const { data, error: e } = await supabase
      .from("channels")
      .insert({ name: clean, created_by: session?.id ?? null } as never)
      .select("*")
      .single();
    if (e) {
      setError(e.message);
      return;
    }
    const row = data as ChannelRow;
    setChannels((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row].sort((a, b) => a.name.localeCompare(b.name))));
    setActiveId(row.id);
    setNewChannel("");
  }

  const active = channels.find((c) => c.id === activeId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Channels */}
      <Card className="p-4 lg:col-span-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Channels</p>
        {loadingChannels ? (
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-7 animate-pulse rounded bg-slate-100" />)}
          </div>
        ) : channels.length === 0 ? (
          <p className="px-2 py-4 text-xs text-slate-400">No channels yet.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                    c.id === activeId ? "bg-brand-50 font-medium text-brand-800" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 text-slate-400" /> {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          <input
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createChannel()}
            placeholder="new-channel"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={createChannel}
            disabled={!newChannel.trim()}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Create channel"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      </Card>

      {/* Messages */}
      <Card className="flex min-h-[32rem] flex-col lg:col-span-3">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Hash className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{active?.name ?? "—"}</span>
          <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this channel…"
              className="w-40 bg-transparent outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <MessageStream
          messages={messages}
          loading={loadingMsgs}
          query={query}
          onReply={send}
          canPost={!!session}
        />

        {active && (
          <div className="border-t border-slate-100 p-3">
            <PostBox channelName={active.name} disabled={!session} onSend={(body) => send(body, null)} />
          </div>
        )}
      </Card>
    </div>
  );
}

function MessageStream({
  messages,
  loading,
  query,
  onReply,
  canPost,
}: {
  messages: MessageRow[];
  loading: boolean;
  query: string;
  onReply: (body: string, parentId: string | null) => Promise<string | null>;
  canPost: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No messages yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Start the conversation. Reference an item with @deal:ID, @contract:ID or @batch:ID.
          </p>
        </div>
      </div>
    );
  }

  // Search mode: flat list of matches.
  if (q) {
    const matches = messages.filter((m) => m.body.toLowerCase().includes(q));
    return (
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        <p className="text-xs text-slate-400">{matches.length} match{matches.length === 1 ? "" : "es"}</p>
        {matches.map((m) => <MessageItem key={m.id} m={m} />)}
      </div>
    );
  }

  // Threaded: top-level messages with their replies.
  const top = messages.filter((m) => !m.parent_id);
  const repliesOf = (id: string) => messages.filter((m) => m.parent_id === id);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      {top.map((m) => (
        <div key={m.id}>
          <MessageItem m={m} />
          <div className="ml-6 mt-2 space-y-2 border-l border-slate-100 pl-3">
            {repliesOf(m.id).map((r) => <MessageItem key={r.id} m={r} small />)}
            {canPost && (
              replyTo === m.id ? (
                <PostBox
                  compact
                  channelName=""
                  disabled={false}
                  onSend={async (body) => {
                    const err = await onReply(body, m.id);
                    if (!err) setReplyTo(null);
                    return err;
                  }}
                  onCancel={() => setReplyTo(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyTo(m.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-700"
                >
                  <CornerDownRight className="h-3 w-3" /> Reply
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageItem({ m, small }: { m: MessageRow; small?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={`font-medium text-slate-800 ${small ? "text-xs" : "text-sm"}`}>{authorName(m.author_email)}</span>
        <span className="text-[11px] text-slate-400">{timeLabel(m.created_at)}</span>
      </div>
      <div className={small ? "text-xs text-slate-600" : "text-sm text-slate-700"}>
        <MessageBody body={m.body} />
      </div>
    </div>
  );
}

function PostBox({
  channelName,
  onSend,
  disabled,
  compact,
  onCancel,
}: {
  channelName: string;
  onSend: (body: string) => Promise<string | null>;
  disabled: boolean;
  compact?: boolean;
  onCancel?: () => void;
}) {
  const [val, setVal] = useState("");
  const [sending, setSending] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [refType, setRefType] = useState("deal");
  const [refId, setRefId] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!val.trim() || disabled) return;
    setSending(true);
    const err = await onSend(val);
    setSending(false);
    if (!err) setVal("");
  }

  function insertRef() {
    if (!refId.trim()) return;
    setVal((v) => `${v}${v && !v.endsWith(" ") ? " " : ""}@${refType}:${refId.trim()} `);
    setRefId("");
    setShowRef(false);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {showRef && (
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-1.5">
          <select value={refType} onChange={(e) => setRefType(e.target.value)} className="rounded border border-slate-200 px-1.5 py-1 text-xs">
            <option value="deal">deal</option>
            <option value="contract">contract</option>
            <option value="batch">batch</option>
          </select>
          <input
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertRef(); } }}
            placeholder="reference id (e.g. WK-2026-001)"
            className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs outline-none"
          />
          <button type="button" onClick={insertRef} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">Insert</button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowRef((s) => !s)}
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          aria-label="Insert reference"
          title="Reference a deal / contract / batch"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }}
          rows={compact ? 1 : 2}
          disabled={disabled}
          placeholder={disabled ? "Sign in to post" : compact ? "Write a reply…" : `Message #${channelName} — ⌘/Ctrl+Enter to send`}
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
        />
        {compact && onCancel && (
          <button type="button" onClick={onCancel} className="px-2 py-2 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        )}
        <button
          type="submit"
          disabled={disabled || sending || !val.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  GROUP_LIMIT,
  MIN_QUERY_LENGTH,
  sanitizeQuery,
  type SearchGroup,
  type SearchResult,
} from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * Authenticated global search across deals, contracts, documents and tasks.
 *
 * Runs on the caller's session client, never the service-role client, so RLS
 * decides what each user is allowed to see — search must not become a way to
 * read rows a user could not open directly.
 *
 * Each group is capped at GROUP_LIMIT rows but carries an exact total, so the
 * dropdown can say "5 of 214" and offer a way through to the full list.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  if (!supabase) return NextResponse.json({ groups: [] });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const q = sanitizeQuery(raw);
  if (q.length < MIN_QUERY_LENGTH) return NextResponse.json({ groups: [] });

  const like = `%${q}%`;
  const encoded = encodeURIComponent(q);

  const [dealsRes, contractsRes, documentsRes, tasksRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, deal_id, name, buyer, status", { count: "exact" })
      .or(`deal_id.ilike.${like},name.ilike.${like},buyer.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(GROUP_LIMIT),
    supabase
      .from("contracts")
      .select("id, name, buyer, status", { count: "exact" })
      .or(`name.ilike.${like},buyer.ilike.${like}`)
      .order("name", { ascending: true })
      .limit(GROUP_LIMIT),
    supabase
      .from("documents")
      .select("id, file_name, file_url, source_folder, source_path", { count: "exact" })
      .or(`file_name.ilike.${like},source_path.ilike.${like}`)
      .order("source_modified_at", { ascending: false, nullsFirst: false })
      .limit(GROUP_LIMIT),
    supabase
      .from("tasks")
      .select("id, title, status, priority", { count: "exact" })
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .limit(GROUP_LIMIT),
  ]);

  const deals = (dealsRes.data ?? []) as {
    id: string; deal_id: string; name: string; buyer: string; status: string | null;
  }[];
  const contracts = (contractsRes.data ?? []) as {
    id: string; name: string; buyer: string; status: string | null;
  }[];
  const documents = (documentsRes.data ?? []) as {
    id: string; file_name: string; file_url: string; source_folder: string | null; source_path: string | null;
  }[];
  const tasks = (tasksRes.data ?? []) as {
    id: string; title: string; status: string | null; priority: string | null;
  }[];

  // Results link to list pages with the query pre-applied rather than to detail
  // pages: every per-item page in this app is an edit form that redirects
  // anyone without write access, so linking there would bounce viewers.
  const groups: SearchGroup[] = [
    {
      type: "deal",
      label: "Deals",
      total: dealsRes.count ?? deals.length,
      seeAllHref: `/deals?q=${encoded}`,
      results: deals.map(
        (d): SearchResult => ({
          id: d.id,
          type: "deal",
          title: d.deal_id ? `${d.deal_id} — ${d.name}` : d.name,
          subtitle: [d.buyer, d.status].filter(Boolean).join(" · ") || null,
          href: `/deals?q=${encodeURIComponent(d.deal_id || d.name)}`,
        }),
      ),
    },
    {
      type: "contract",
      label: "Contracts",
      total: contractsRes.count ?? contracts.length,
      // Contracts have no list page of their own — they are shown on Sales
      // Forecast, which takes no query, so there is nothing to pre-apply.
      seeAllHref: null,
      results: contracts.map(
        (c): SearchResult => ({
          id: c.id,
          type: "contract",
          title: c.name,
          subtitle: [c.buyer, c.status].filter(Boolean).join(" · ") || null,
          href: "/sales-forecast",
        }),
      ),
    },
    {
      type: "document",
      label: "Documents",
      total: documentsRes.count ?? documents.length,
      seeAllHref: `/documents?q=${encoded}`,
      results: documents.map(
        (d): SearchResult => ({
          id: d.id,
          type: "document",
          title: d.file_name,
          subtitle: d.source_folder ?? d.source_path,
          // Straight to SharePoint, where the user's own permissions apply.
          href: d.file_url || `/documents?q=${encodeURIComponent(d.file_name)}`,
          external: !!d.file_url,
        }),
      ),
    },
    {
      type: "task",
      label: "Tasks",
      total: tasksRes.count ?? tasks.length,
      seeAllHref: `/tasks?q=${encoded}`,
      results: tasks.map(
        (t): SearchResult => ({
          id: t.id,
          type: "task",
          title: t.title,
          subtitle: [t.status, t.priority].filter(Boolean).join(" · ") || null,
          href: `/tasks?q=${encodeURIComponent(t.title)}`,
        }),
      ),
    },
  ];

  // A table that errored (or does not exist yet) contributes nothing rather
  // than failing the whole search.
  return NextResponse.json({ groups: groups.filter((g) => g.results.length > 0) });
}

import "server-only";

/**
 * Microsoft Graph client for the Barka Operations Hub SharePoint site.
 *
 * READ-ONLY BY CONSTRUCTION. Every request in this module goes through
 * `graphRequest`, which refuses any verb other than GET. The Entra app
 * registration is `Sites.Selected` read-only and scoped to a single site, so a
 * write would fail anyway — this is the second lock, so that a future edit
 * can't quietly introduce write-back (forbidden by the architecture: the team's
 * "data out" path is Export to Excel, never a write to SharePoint).
 *
 * Server-only: MS_CLIENT_SECRET is not NEXT_PUBLIC_-prefixed and must never
 * reach the browser. The `server-only` import makes a client import a build
 * error.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type SharePointConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  hostname: string;
  sitePath: string;
};

/** Returns null (rather than throwing) when unconfigured, so callers can show a clear message. */
export function readConfig(): SharePointConfig | null {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const siteUrl = process.env.SHAREPOINT_SITE_URL;
  if (!tenantId || !clientId || !clientSecret || !siteUrl) return null;

  let hostname: string;
  let sitePath: string;
  try {
    const u = new URL(siteUrl);
    hostname = u.hostname;
    sitePath = u.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
  if (!hostname || !sitePath) return null;

  return { tenantId, clientId, clientSecret, hostname, sitePath };
}

export function missingConfigKeys(): string[] {
  return (["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "SHAREPOINT_SITE_URL"] as const)
    .filter((k) => !process.env[k]);
}

// --- token -----------------------------------------------------------------

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(cfg: SharePointConfig): Promise<string> {
  // 2-minute safety margin so a token can't expire mid-run.
  if (cached && Date.now() < cached.expiresAt - 120_000) return cached.token;

  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    // AADSTS7000222 = expired client secret. Name it, because the failure is
    // otherwise a bare 401 and the expiry date isn't recorded anywhere.
    const expired = body.includes("AADSTS7000222") || body.includes("AADSTS7000215");
    throw new Error(
      expired
        ? "Microsoft rejected the app credentials — the client secret has most likely expired or been rotated. Ask IT for a new secret value and update MS_CLIENT_SECRET."
        : `Could not get a Microsoft Graph token (${res.status}). ${body.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

/** Test seam — clears the module-level token cache. */
export function resetTokenCache() {
  cached = null;
}

// --- request ---------------------------------------------------------------

async function graphRequest(
  cfg: SharePointConfig,
  path: string,
  init: { raw?: boolean; attempt?: number } = {},
): Promise<any> {
  const url = path.startsWith("http") ? path : GRAPH + path;
  const attempt = init.attempt ?? 0;

  const res = await fetch(url, {
    method: "GET", // read-only: never parameterised
    headers: { Authorization: `Bearer ${await getToken(cfg)}` },
    cache: "no-store",
  });

  // Graph throttles with 429 + Retry-After; 503/504 are transient.
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    return graphRequest(cfg, path, { ...init, attempt: attempt + 1 });
  }

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      throw new Error(
        `Graph returned 403 for ${url.slice(0, 120)} — the Sites.Selected grant only reaches ` +
          `the Barka Operations Hub site. If this file lives in another site, IT must extend the grant.`,
      );
    }
    throw new Error(`Graph ${res.status} for ${url.slice(0, 120)}: ${body.slice(0, 300)}`);
  }

  return init.raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// --- site / drive ----------------------------------------------------------

export type DriveItem = {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  lastModifiedDateTime?: string;
  createdDateTime?: string;
  lastModifiedBy?: { user?: { displayName?: string } };
  parentReference?: { path?: string; driveId?: string };
  deleted?: { state?: string };
};

export async function resolveSite(cfg: SharePointConfig) {
  const site = await graphRequest(cfg, `/sites/${cfg.hostname}:${cfg.sitePath}`);
  const drives = await graphRequest(cfg, `/sites/${site.id}/drives`);
  const list: Array<{ id: string; name: string; driveType: string }> = drives.value ?? [];
  // The site has one document library ("Documents"); prefer it explicitly rather
  // than trusting array order.
  const drive = list.find((d) => d.name === "Documents") ?? list[0];
  if (!drive) throw new Error("No document library found on the Barka Operations Hub site.");
  return { siteId: site.id as string, driveId: drive.id, driveName: drive.name, drives: list };
}

/**
 * Full recursive listing of the library via the delta feed — one traversal
 * instead of a request per folder (the library holds ~14,000 items).
 */
export async function listAllItems(cfg: SharePointConfig, driveId: string): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let next: string | null = `/drives/${driveId}/root/delta?$top=500`;
  let pages = 0;

  while (next) {
    const page = await graphRequest(cfg, next);
    items.push(...((page.value ?? []) as DriveItem[]));
    next = (page["@odata.nextLink"] as string | undefined) ?? null;
    // Guard against a pathological loop; 14k items is ~30 pages.
    if (++pages > 500) throw new Error("Aborted delta traversal after 500 pages.");
  }

  return items.filter((i) => !i.deleted);
}

/** Library-relative path of an item, e.g. "07_Finance.../Model.xlsx". */
export function itemPath(item: DriveItem): string {
  const parent = item.parentReference?.path ?? "";
  const rel = parent.includes("root:") ? parent.split("root:")[1] : "";
  return `${decodeURIComponent(rel)}/${item.name}`.replace(/^\/+/, "");
}

/** Top-level folder an item sits under (the site's numbered taxonomy). */
export function topFolder(path: string): string {
  const first = path.split("/")[0];
  return first === path ? "(root)" : first;
}

/**
 * Download a file's bytes.
 *
 * Uses the pre-authenticated @microsoft.graph.downloadUrl rather than following
 * the /content redirect: the redirect target is a SharePoint CDN host that
 * rejects the Graph Authorization header, and the hand-off is where transient
 * connection resets show up. Retried, because they do happen.
 */
export async function downloadFile(
  cfg: SharePointConfig,
  driveId: string,
  itemId: string,
): Promise<Buffer> {
  const meta = await graphRequest(
    cfg,
    `/drives/${driveId}/items/${itemId}?$select=id,name,size,@microsoft.graph.downloadUrl`,
  );
  const url = meta["@microsoft.graph.downloadUrl"] as string | undefined;

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (url) {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`downloadUrl returned ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) throw new Error("downloadUrl returned an empty body");
        return buf;
      }
      return (await graphRequest(cfg, `/drives/${driveId}/items/${itemId}/content`, {
        raw: true,
      })) as Buffer;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(
    `Could not download item ${itemId}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

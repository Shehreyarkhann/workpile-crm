// Workpile — mailbox sync (v46). The OAuth scaffolding (authUrl, connections)
// existed since the early slices with null pollers; this module is the working
// half: code exchange, token refresh, Gmail + Microsoft Graph pollers feeding
// the same ingestBatch pipeline the email-in API uses. Everything stays dark
// until the deployment registers the provider apps (GOOGLE_CLIENT_ID/SECRET,
// MS_CLIENT_ID/SECRET) — status endpoints report that honestly, and no fake
// connection is ever recorded. Refresh tokens live only in
// oauth_connections.token_ref and are never returned by any API.
import { db, uid, now } from "./db.ts";
import { PROVIDERS } from "./oauth.ts";

db.exec(`CREATE TABLE IF NOT EXISTS mail_sync_seen (connection_id TEXT, provider_msg_id TEXT, created_at TEXT, PRIMARY KEY (connection_id, provider_msg_id));`);

type FetchFn = (url: string, init?: any) => Promise<{ status: number; json: () => Promise<any>; text?: () => Promise<string> }>;
const realFetch: FetchFn = fetch as any;

async function tokenPost(url: string, form: Record<string, string>, fetchFn: FetchFn) {
  const r = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
  const j = await r.json().catch(() => ({}));
  if (r.status < 200 || r.status >= 300 || !j.access_token) throw new Error("token endpoint " + r.status + " " + JSON.stringify(j).slice(0, 140));
  return j;
}
export async function exchangeCode(provider: string, code: string, redirectUri: string, fetchFn: FetchFn = realFetch) {
  const p = PROVIDERS[provider]; if (!p) throw new Error("unknown provider");
  const url = provider === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const form: Record<string, string> = { client_id: process.env[p.env_id]!, client_secret: process.env[p.env_secret]!, code, grant_type: "authorization_code", redirect_uri: redirectUri };
  if (provider === "microsoft") form.scope = p.scope;
  return tokenPost(url, form, fetchFn);
}
export async function refreshAccess(provider: string, refreshToken: string, fetchFn: FetchFn = realFetch): Promise<string> {
  const p = PROVIDERS[provider]; if (!p) throw new Error("unknown provider");
  const url = provider === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const form: Record<string, string> = { client_id: process.env[p.env_id]!, client_secret: process.env[p.env_secret]!, refresh_token: refreshToken, grant_type: "refresh_token" };
  if (provider === "microsoft") form.scope = p.scope;
  const j = await tokenPost(url, form, fetchFn);
  return j.access_token;
}
// v52: refresh through the connection so a ROTATED refresh token (Microsoft
// rotates them) is persisted — dropping it silently killed MS connections.
async function accessFor(conn: any, fetchFn: FetchFn): Promise<string> {
  const p = PROVIDERS[conn.provider]; const url = conn.provider === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const form: Record<string, string> = { client_id: process.env[p.env_id]!, client_secret: process.env[p.env_secret]!, refresh_token: conn.token_ref, grant_type: "refresh_token" };
  if (conn.provider === "microsoft") form.scope = p.scope;
  const j = await tokenPost(url, form, fetchFn);
  if (j.refresh_token && j.refresh_token !== conn.token_ref) { db.prepare("UPDATE oauth_connections SET token_ref=? WHERE id=?").run(j.refresh_token, conn.id); conn.token_ref = j.refresh_token; }
  return j.access_token;
}
async function getJson(url: string, token: string, fetchFn: FetchFn) {
  const r = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (r.status < 200 || r.status >= 300) throw new Error("GET " + url.split("?")[0] + " -> " + r.status);
  return j;
}
export async function profileEmail(provider: string, accessToken: string, fetchFn: FetchFn = realFetch): Promise<string> {
  try {
    if (provider === "google") { const j = await getJson("https://gmail.googleapis.com/gmail/v1/users/me/profile", accessToken, fetchFn); return j.emailAddress || ""; }
    const j = await getJson("https://graph.microsoft.com/v1.0/me", accessToken, fetchFn); return j.mail || j.userPrincipalName || "";
  } catch { return ""; }
}

function b64urlText(data: string): string { try { return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return ""; } }
function gmailBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64urlText(payload.body.data);
  for (const part of payload.parts || []) { const t = gmailBody(part); if (t) return t; }
  return "";
}
function splitFrom(h: string): { name: string; email: string } {
  const m = String(h || "").match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: String(h || "").trim() };
}

// v105 — full-history sync. Two lanes per poll: (1) incremental — mail
// since the last poll (1-day overlap), paginated to exhaustion; (2) a
// one-time BACKFILL of the last 90 days that pages with a persisted
// cursor, so a big inbox lands completely over successive polls instead
// of only ever showing the newest 25. The cursor is staged on the conn
// object and promoted by processMailSync ONLY after ingest succeeds —
// a failed ingest re-reads the same page next poll (seen-dedupe makes
// that cheap), so customer mail is never skipped. Per-poll fetch budget
// keeps one huge mailbox from starving the worker.
const GMAIL_PAGE = 100, GRAPH_PAGE = 100, POLL_BUDGET = 300, INCR_BUDGET = 100;

export async function gmailPoll(conn: any, fetchFn: FetchFn = realFetch): Promise<any[]> {
  const token = await accessFor(conn, fetchFn);
  const out: any[] = []; const inPoll = new Set<string>();
  const seen = (id: string) => inPoll.has(id) || !!db.prepare("SELECT 1 FROM mail_sync_seen WHERE connection_id=? AND provider_msg_id=?").get(conn.id, id);
  const fetchFull = async (id: string) => {
    const full = await getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, token, fetchFn);
    const headers: Record<string, string> = {}; for (const h of full.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
    const from = splitFrom(headers.from || "");
    inPoll.add(id);
    out.push({ from_email: from.email, from_name: from.name, subject: headers.subject || "", body: gmailBody(full.payload) || full.snippet || "", received_at: headers.date ? new Date(headers.date).toISOString() : now(), external_id: id });
  };
  const listPage = (q: string, pageToken?: string) => getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${GMAIL_PAGE}&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, token, fetchFn);
  // Lane 1: incremental (skipped on the very first poll — backfill covers it)
  if (conn.last_poll_at) {
    const since = Math.floor(new Date(conn.last_poll_at).getTime() / 1000) - 86400;
    let budget = INCR_BUDGET; let tok: string | undefined;
    do {
      const list = await listPage("after:" + since, tok);
      for (const m of list.messages || []) { if (budget <= 0) break; if (seen(m.id)) continue; budget--; await fetchFull(m.id); }
      tok = list.nextPageToken;
    } while (tok && budget > 0);
  }
  // Lane 2: backfill the last 90 days, cursor-resumed across polls
  if (!conn.backfill_done) {
    const anchor = conn.sync_since ? Math.floor(Number(conn.sync_since) / 1000) : Math.floor(Date.now() / 1000) - 90 * 86400;
    let budget = POLL_BUDGET - out.length;
    let tok: string | undefined = conn.sync_token || undefined;
    let done = false;
    while (true) {
      const list = await listPage("after:" + anchor, tok);
      let pageDone = true;
      for (const m of list.messages || []) {
        if (seen(m.id)) continue;
        if (budget <= 0) { pageDone = false; break; }
        budget--; await fetchFull(m.id);
      }
      if (!pageDone) break; // redo THIS page next poll (tok unchanged)
      tok = list.nextPageToken;
      if (!tok) { done = true; break; }
      if (budget <= 0) break;
    }
    conn.__cursor = { token: tok || null, done };
  }
  return out;
}

export async function graphPoll(conn: any, fetchFn: FetchFn = realFetch): Promise<any[]> {
  const token = await accessFor(conn, fetchFn);
  const out: any[] = []; const inPoll = new Set<string>();
  const seen = (id: string) => inPoll.has(id) || !!db.prepare("SELECT 1 FROM mail_sync_seen WHERE connection_id=? AND provider_msg_id=?").get(conn.id, id);
  const take = (m: any) => { inPoll.add(m.id); out.push({ from_email: m.from?.emailAddress?.address || "", from_name: m.from?.emailAddress?.name || "", subject: m.subject || "", body: m.bodyPreview || "", received_at: m.receivedDateTime || now(), external_id: m.id }); };
  const firstUrl = (sinceMs: number) => `https://graph.microsoft.com/v1.0/me/messages?$top=${GRAPH_PAGE}&$orderby=receivedDateTime%20desc&$select=id,from,subject,bodyPreview,receivedDateTime&$filter=${encodeURIComponent(`receivedDateTime ge ${new Date(sinceMs).toISOString()}`)}`;
  // Lane 1: incremental (bodyPreview by design — triage classifies from it)
  if (conn.last_poll_at) {
    const since = new Date(conn.last_poll_at).getTime() - 86400000;
    let budget = INCR_BUDGET; let url: string | undefined = firstUrl(since);
    while (url && budget > 0) {
      const list = await getJson(url, token, fetchFn);
      let stopped = false;
      for (const m of list.value || []) { if (new Date(m.receivedDateTime).getTime() < since) continue; if (seen(m.id)) continue; if (budget <= 0) { stopped = true; break; } budget--; take(m); }
      if (stopped) break;
      url = list["@odata.nextLink"];
    }
  }
  // Lane 2: backfill, nextLink as the resumable cursor (page-granular)
  if (!conn.backfill_done) {
    const anchor = conn.sync_since ? Number(conn.sync_since) : Date.now() - 90 * 86400000;
    let budget = POLL_BUDGET - out.length;
    let url: string | undefined = conn.sync_token || firstUrl(anchor);
    let done = false;
    while (url) {
      const list = await getJson(url, token, fetchFn);
      let pageDone = true;
      for (const m of list.value || []) {
        if (seen(m.id)) continue;
        if (budget <= 0) { pageDone = false; break; }
        budget--; take(m);
      }
      if (!pageDone) break; // redo this page next poll (url unchanged)
      url = list["@odata.nextLink"];
      if (!url) { done = true; break; }
      if (budget <= 0) break;
    }
    conn.__cursor = { token: url || null, done };
  }
  return out;
}

export const livePollers: Record<string, (conn: any, fetchFn?: FetchFn) => Promise<any[]>> = { google: gmailPoll, microsoft: graphPoll };

export async function processMailSync(ingest: (ws: string, actor: string, emails: any[]) => any, fetchFn: FetchFn = realFetch): Promise<{ polled: number; ingested: number; errors: number }> {
  const conns = db.prepare("SELECT * FROM oauth_connections WHERE status='connected' AND token_ref IS NOT NULL AND token_ref<>''").all() as any[];
  let polled = 0, ingested = 0, errors = 0;
  for (const conn of conns) {
    const poller = livePollers[conn.provider]; if (!poller) continue;
    if (!conn.backfill_done && !conn.sync_since) { conn.sync_since = Date.now() - 90 * 86400000; db.prepare("UPDATE oauth_connections SET sync_since=? WHERE id=?").run(conn.sync_since, conn.id); }
    try {
      const emails = await poller(conn, fetchFn);
      polled++;
      if (emails.length) { const r = ingest(conn.workspace_id, "mail-sync", emails); ingested += emails.length; void r;
        // v52: messages are marked seen ONLY after ingest succeeded — a
        // failure leaves them unseen so the next poll retries instead of
        // losing customer mail forever.
        for (const em of emails) if ((em as any).external_id) db.prepare("INSERT OR IGNORE INTO mail_sync_seen (connection_id, provider_msg_id, created_at) VALUES (?,?,?)").run(conn.id, (em as any).external_id, now());
      }
      if ((conn as any).__cursor) { const c = (conn as any).__cursor; db.prepare("UPDATE oauth_connections SET sync_token=?, backfill_done=? WHERE id=?").run(c.token, c.done ? 1 : 0, conn.id); }
      db.prepare("UPDATE oauth_connections SET last_poll_at=?, last_error=NULL WHERE id=?").run(now(), conn.id);
    } catch (e: any) { errors++; db.prepare("UPDATE oauth_connections SET last_error=? WHERE id=?").run(String(e?.message || e).slice(0, 240), conn.id); }
  }
  return { polled, ingested, errors };
}

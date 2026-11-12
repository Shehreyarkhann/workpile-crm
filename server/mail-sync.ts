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

export async function gmailPoll(conn: any, fetchFn: FetchFn = realFetch): Promise<any[]> {
  const token = await refreshAccess("google", conn.token_ref, fetchFn);
  const since = conn.last_poll_at ? Math.floor(new Date(conn.last_poll_at).getTime() / 1000) - 86400 : Math.floor(Date.now() / 1000) - 7 * 86400;
  const list = await getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent("after:" + since)}`, token, fetchFn);
  const out: any[] = [];
  for (const m of list.messages || []) {
    if (db.prepare("SELECT 1 FROM mail_sync_seen WHERE connection_id=? AND provider_msg_id=?").get(conn.id, m.id)) continue;
    const full = await getJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, token, fetchFn);
    const headers: Record<string, string> = {}; for (const h of full.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
    const from = splitFrom(headers.from || "");
    out.push({ from_email: from.email, from_name: from.name, subject: headers.subject || "", body: gmailBody(full.payload) || full.snippet || "", received_at: headers.date ? new Date(headers.date).toISOString() : now(), external_id: m.id });
    db.prepare("INSERT OR IGNORE INTO mail_sync_seen (connection_id, provider_msg_id, created_at) VALUES (?,?,?)").run(conn.id, m.id, now());
  }
  return out;
}
export async function graphPoll(conn: any, fetchFn: FetchFn = realFetch): Promise<any[]> {
  const token = await refreshAccess("microsoft", conn.token_ref, fetchFn);
  const since = conn.last_poll_at ? new Date(conn.last_poll_at).getTime() - 86400000 : Date.now() - 7 * 86400000;
  const list = await getJson("https://graph.microsoft.com/v1.0/me/messages?$top=25&$orderby=receivedDateTime%20desc&$select=id,from,subject,bodyPreview,receivedDateTime", token, fetchFn);
  const out: any[] = [];
  for (const m of list.value || []) {
    if (new Date(m.receivedDateTime).getTime() < since) continue;
    if (db.prepare("SELECT 1 FROM mail_sync_seen WHERE connection_id=? AND provider_msg_id=?").get(conn.id, m.id)) continue;
    // bodyPreview is deliberate: the triage pipeline classifies + drafts from it,
    // and the poll stays cheap. Full bodies arrive via the email-in API today.
    out.push({ from_email: m.from?.emailAddress?.address || "", from_name: m.from?.emailAddress?.name || "", subject: m.subject || "", body: m.bodyPreview || "", received_at: m.receivedDateTime || now(), external_id: m.id });
    db.prepare("INSERT OR IGNORE INTO mail_sync_seen (connection_id, provider_msg_id, created_at) VALUES (?,?,?)").run(conn.id, m.id, now());
  }
  return out;
}
export const livePollers: Record<string, (conn: any, fetchFn?: FetchFn) => Promise<any[]>> = { google: gmailPoll, microsoft: graphPoll };

export async function processMailSync(ingest: (ws: string, actor: string, emails: any[]) => any, fetchFn: FetchFn = realFetch): Promise<{ polled: number; ingested: number; errors: number }> {
  const conns = db.prepare("SELECT * FROM oauth_connections WHERE status='connected' AND token_ref IS NOT NULL AND token_ref<>''").all() as any[];
  let polled = 0, ingested = 0, errors = 0;
  for (const conn of conns) {
    const poller = livePollers[conn.provider]; if (!poller) continue;
    try {
      const emails = await poller(conn, fetchFn);
      polled++;
      if (emails.length) { const r = ingest(conn.workspace_id, "mail-sync", emails); ingested += emails.length; void r; }
      db.prepare("UPDATE oauth_connections SET last_poll_at=?, last_error=NULL WHERE id=?").run(now(), conn.id);
    } catch (e: any) { errors++; db.prepare("UPDATE oauth_connections SET last_error=? WHERE id=?").run(String(e?.message || e).slice(0, 240), conn.id); }
  }
  return { polled, ingested, errors };
}

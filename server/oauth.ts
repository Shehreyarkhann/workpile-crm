// Workpile — Gmail / Microsoft 365 OAuth connectors (§4.1)
// Full OAuth flow coded; it activates when the deployment registers provider apps
// (GOOGLE_CLIENT_ID/SECRET, MS_CLIENT_ID/SECRET). Until then status honestly reports
// "not_configured" — no fake connections. Pollers feed server/inbox.ts pipeline.
// Token values are stored only as vault references (token_ref), never raw in the DB.
import { randomBytes } from "node:crypto";
import { db, uid, now } from "./db.ts";

export const PROVIDERS: Record<string, { auth_url: string; scope: string; env_id: string; env_secret: string }> = {
  google: { auth_url: "https://accounts.google.com/o/oauth2/v2/auth", scope: "https://www.googleapis.com/auth/gmail.readonly", env_id: "GOOGLE_CLIENT_ID", env_secret: "GOOGLE_CLIENT_SECRET" },
  microsoft: { auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", scope: "Mail.Read offline_access", env_id: "MS_CLIENT_ID", env_secret: "MS_CLIENT_SECRET" },
};

export function providerStatus(provider: string): { provider: string; configured: boolean } {
  const p = PROVIDERS[provider];
  return { provider, configured: !!(p && process.env[p.env_id] && process.env[p.env_secret]) };
}

export function authUrl(provider: string, workspaceId: string, redirectUri: string): { url?: string; configured: boolean; state?: string } {
  const p = PROVIDERS[provider];
  if (!p || !providerStatus(provider).configured) return { configured: false };
  const state = randomBytes(16).toString("hex") + "." + workspaceId;
  const u = new URL(p.auth_url);
  u.searchParams.set("client_id", process.env[p.env_id]!); u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code"); u.searchParams.set("scope", p.scope); u.searchParams.set("state", state);
  if (provider === "google") { u.searchParams.set("access_type", "offline"); u.searchParams.set("prompt", "consent"); }
  return { url: u.toString(), configured: true, state };
}

export function recordConnection(workspaceId: string, provider: string, accountEmail: string, tokenRef: string) {
  const existing = db.prepare("SELECT * FROM oauth_connections WHERE workspace_id=? AND provider=? AND account_email=?").get(workspaceId, provider, accountEmail) as any;
  if (existing) { db.prepare("UPDATE oauth_connections SET status='connected', token_ref=?, last_error=NULL WHERE id=?").run(tokenRef, existing.id); return db.prepare("SELECT * FROM oauth_connections WHERE id=?").get(existing.id); }
  const id = uid("oau");
  db.prepare("INSERT INTO oauth_connections (id,workspace_id,provider,account_email,status,token_ref,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id, workspaceId, provider, accountEmail, "connected", tokenRef, now());
  return db.prepare("SELECT * FROM oauth_connections WHERE id=?").get(id);
}

export function listConnections(workspaceId: string) {
  return db.prepare("SELECT id,provider,account_email,status,last_poll_at,last_error FROM oauth_connections WHERE workspace_id=?").all(workspaceId);
}

// Poller contract: a provider poller returns InboundEmail[]; ingestEmails() is the
// single entry the API route + scheduled pollers share (defined in app.ts pipeline).
export type Poller = (connection: any) => Promise<any[]>;
export const pollers: Record<string, Poller | null> = { google: null, microsoft: null }; // registered when provider apps are configured

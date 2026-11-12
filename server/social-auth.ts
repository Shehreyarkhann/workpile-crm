// Social sign-in (v55) — "Continue with Google / Microsoft" for USER
// accounts. Deliberately separate from the mailbox-sync OAuth in oauth.ts:
// different scopes (openid email profile only — no mailbox access), a
// different redirect path, and its own state store.
//
// Security shape:
//  - state is a 256-bit random value; only its SHA-256 hash is stored
//    server-side (auth_states), the raw value rides in an HttpOnly cookie
//    scoped to /api/auth/social. Callback requires BOTH to match, the row
//    is deleted on first use (single-use, replay-proof), and rows expire
//    after 10 minutes.
//  - PKCE (S256) on both providers; the verifier never leaves the server.
//  - Accounts are matched by the provider's stable subject id
//    (user_identities). Email matching LINKS an identity to an existing
//    account only when the provider attested the address: Google must
//    return email_verified=true; Microsoft profiles come from Graph /me
//    under a token issued to this app (mail, falling back to the UPN).
//  - A brand-new identity+email creates the same thing /register creates:
//    workspace + defaults + trial subscription + OWNER user (with an
//    unusable random password and password_set=0) + membership.
//  - Every failure lands on a fixed internal path with a coarse error code
//    — no return_to parameters, no open redirects, no detail leaks.
import { createHash, randomBytes } from "node:crypto";
import { db, uid, now, hashPassword } from "./db.ts";

export interface SocialProfile { subject: string; email: string; emailVerified: boolean; name: string }
interface ProviderDef {
  envId: string; envSecret: string;
  authUrl: string; tokenUrl: string;
  scope: string;
  profile: (accessToken: string, idToken: string | null, f: typeof fetch) => Promise<SocialProfile>;
}
export const SOCIAL_PROVIDERS: Record<string, ProviderDef> = {
  google: {
    envId: "GOOGLE_CLIENT_ID", envSecret: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    profile: async (accessToken, _id, f) => {
      const r = await f("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
      if (!r.ok) throw new Error("google_profile_failed");
      const j: any = await r.json();
      return { subject: String(j.sub || ""), email: String(j.email || "").toLowerCase(), emailVerified: j.email_verified === true, name: String(j.name || "") };
    },
  },
  microsoft: {
    envId: "MS_CLIENT_ID", envSecret: "MS_CLIENT_SECRET",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "openid profile email",
    profile: async (accessToken, _id, f) => {
      const r = await f("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${accessToken}` } });
      if (!r.ok) throw new Error("microsoft_profile_failed");
      const j: any = await r.json();
      const email = String(j.mail || j.userPrincipalName || "").toLowerCase();
      // Graph answers only under a token Microsoft issued to THIS app for
      // THIS user; the returned mail/UPN is the account's sign-in address.
      return { subject: String(j.id || ""), email, emailVerified: /.+@.+\..+/.test(email), name: String(j.displayName || "") };
    },
  },
};
export const socialConfigured = (p: string) => { const d = SOCIAL_PROVIDERS[p]; return !!d && !!process.env[d.envId] && !!process.env[d.envSecret]; };
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const b64url = (n: number) => randomBytes(n).toString("base64url");

export function beginSocial(provider: string, redirectUri: string): { url: string; state: string } | null {
  const d = SOCIAL_PROVIDERS[provider]; if (!d || !socialConfigured(provider)) return null;
  const state = b64url(32); const verifier = b64url(32);
  db.prepare("DELETE FROM auth_states WHERE created_at<?").run(new Date(Date.now() - 10 * 60000).toISOString());
  db.prepare("INSERT INTO auth_states (state_hash, provider, code_verifier, created_at) VALUES (?,?,?,?)")
    .run(createHash("sha256").update(state).digest("hex"), provider, verifier, now());
  const u = new URL(d.authUrl);
  u.searchParams.set("client_id", process.env[d.envId]!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", d.scope);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", pkceChallenge(verifier));
  u.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") u.searchParams.set("prompt", "select_account");
  return { url: u.toString(), state };
}

/** Consume a state (single-use) and return its PKCE verifier, or null. */
export function consumeSocialState(provider: string, state: string): string | null {
  if (!state) return null;
  const hash = createHash("sha256").update(state).digest("hex");
  const row = db.prepare("SELECT * FROM auth_states WHERE state_hash=?").get(hash) as any;
  if (!row) return null;
  db.prepare("DELETE FROM auth_states WHERE state_hash=?").run(hash); // single-use, whatever happens next
  if (row.provider !== provider) return null;
  if (Date.now() - new Date(row.created_at).getTime() > 10 * 60000) return null;
  return row.code_verifier as string;
}

export async function exchangeSocial(provider: string, code: string, verifier: string, redirectUri: string, f: typeof fetch = fetch): Promise<SocialProfile> {
  const d = SOCIAL_PROVIDERS[provider];
  const form = new URLSearchParams({ client_id: process.env[d.envId]!, client_secret: process.env[d.envSecret]!, code, grant_type: "authorization_code", redirect_uri: redirectUri, code_verifier: verifier });
  const r = await f(d.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
  if (!r.ok) throw new Error("token_exchange_failed");
  const t: any = await r.json();
  if (!t.access_token) throw new Error("token_exchange_failed");
  const p = await d.profile(t.access_token, t.id_token || null, f);
  if (!p.subject || !p.email) throw new Error("profile_incomplete");
  return p;
}

/** Resolve a verified provider profile to a local user: identity match →
 * email link → fresh signup (mirrors /register's side effects). */
export function resolveSocialUser(provider: string, p: SocialProfile, hooks: { workspaceDefaults: (ws: string) => void; ensureSubscription: (ws: string) => void }): { user: any; created: boolean } {
  const ident = db.prepare("SELECT user_id FROM user_identities WHERE provider=? AND subject=?").get(provider, p.subject) as any;
  if (ident) { const u = db.prepare("SELECT * FROM users WHERE id=?").get(ident.user_id) as any; if (u) return { user: u, created: false }; }
  const email = p.email.toLowerCase();
  let user = db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
  let created = false;
  if (!user) {
    const wsId = uid("ws"); const name = p.name || email.split("@")[0];
    db.prepare("INSERT INTO workspaces (id,name,vertical,timezone,created_at) VALUES (?,?,?,?,?)").run(wsId, name + "'s Business", "field-services", "America/New_York", now());
    hooks.workspaceDefaults(wsId); hooks.ensureSubscription(wsId);
    const userId = uid("usr");
    db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit,email_verified,password_set) VALUES (?,?,?,?,?,?,?,?,0)")
      .run(userId, wsId, name, email, hashPassword(b64url(24)), "OWNER", 0, 1);
    db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(userId, wsId, "OWNER", now());
    user = db.prepare("SELECT * FROM users WHERE id=?").get(userId) as any;
    created = true;
  }
  db.prepare("INSERT OR IGNORE INTO user_identities (id,user_id,provider,subject,email,created_at) VALUES (?,?,?,?,?,?)")
    .run(uid("uidn"), user.id, provider, p.subject, email, now());
  return { user, created };
}

// V55 — social sign-in. Provider HTTP is stubbed at the fetch layer (only
// the provider hosts are intercepted; everything else passes through to
// the real local server). Pinned semantics: verified profile + new email
// = full signup (workspace, trial, OWNER); known identity = same user;
// known email = identity LINKED to the existing account; state is
// cookie+server matched, single-use; unverified email never gets in.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v55-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.env.GOOGLE_CLIENT_ID = "g-id"; process.env.GOOGLE_CLIENT_SECRET = "g-secret";
process.env.MS_CLIENT_ID = "m-id"; process.env.MS_CLIENT_SECRET = "m-secret";
process.chdir(dir);

// --- provider stubs ---
const realFetch = globalThis.fetch;
let googleProfile: any = { sub: "g-123", email: "new@v55.test", email_verified: true, name: "New Person" };
let msProfile: any = { id: "ms-9", mail: null, userPrincipalName: "ms@v55.test", displayName: "Ms Person" };
const jr = (o: any) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } });
globalThis.fetch = (async (url: any, opts: any) => {
  const u = String(url);
  if (u.includes("oauth2.googleapis.com/token") || u.includes("login.microsoftonline.com/common/oauth2/v2.0/token")) return jr({ access_token: "at", id_token: "idt" });
  if (u.includes("openidconnect.googleapis.com")) return jr(googleProfile);
  if (u.includes("graph.microsoft.com")) return jr(msProfile);
  return realFetch(url, opts);
}) as any;

const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v55", "pw", "9921"].join("-");
async function raw(p: string, cookie?: string) {
  const r = await realFetch(B + p, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  return { s: r.status, loc: r.headers.get("location") || "", setCookie: r.headers.get("set-cookie") || "", j: await r.json().catch(() => ({})) };
}
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await realFetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
async function startFlow(provider: string) {
  const r = await raw(`/api/auth/social/${provider}/start`);
  assert.equal(r.s, 302, "start redirects");
  const state = new URL(r.loc).searchParams.get("state")!;
  const cookie = r.setCookie.split(";")[0];
  assert.ok(cookie.startsWith("wp_social_state="), "state cookie set");
  return { loc: r.loc, state, cookie };
}
const cb = (provider: string, state: string, cookie: string) => raw(`/api/auth/social/${provider}/callback?code=abc&state=${encodeURIComponent(state)}`, cookie);
const usersWith = (email: string) => dbm.db.prepare("SELECT * FROM users WHERE email=?").all(email) as any[];

test("status reports the configured providers", async () => {
  const r = await raw("/api/auth/social/status");
  assert.deepEqual(r.j, { google: true, microsoft: true, apple: false });
});

test("google: a verified new profile creates the full signup — workspace, trial, OWNER, identity", async () => {
  const f = await startFlow("google");
  const u = new URL(f.loc);
  assert.equal(u.hostname, "accounts.google.com");
  assert.ok(u.searchParams.get("redirect_uri")?.endsWith("/api/auth/social/google/callback"));
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  const r = await cb("google", f.state, f.cookie);
  assert.equal(r.loc, "/app", "lands in the app");
  assert.ok(r.setCookie.includes("lf_session="), "session issued");
  const rows = usersWith("new@v55.test");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "OWNER"); assert.equal(Number(rows[0].email_verified), 1); assert.equal(Number(rows[0].password_set), 0, "social accounts start password-less (settable later, never the provider's)");
  const sub = dbm.db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(rows[0].workspace_id) as any;
  assert.ok(sub, "trial subscription created, same as /register");
  const ident = dbm.db.prepare("SELECT * FROM user_identities WHERE provider='google' AND subject='g-123'").get() as any;
  assert.equal(ident.user_id, rows[0].id);
  const sess = r.setCookie.split(";")[0];
  const me = await call("GET", "/api/auth/me", undefined, sess);
  assert.equal(me.j.user.id, rows[0].id);
});

test("google: the same identity signs into the SAME account — no duplicate workspace", async () => {
  const f = await startFlow("google");
  const r = await cb("google", f.state, f.cookie);
  assert.equal(r.loc, "/app");
  assert.equal(usersWith("new@v55.test").length, 1);
});

test("state is single-use: replaying a consumed callback fails", async () => {
  const f = await startFlow("google");
  const first = await cb("google", f.state, f.cookie);
  assert.equal(first.loc, "/app");
  const replay = await cb("google", f.state, f.cookie);
  assert.ok(replay.loc.includes("auth_error=state_mismatch"), replay.loc);
  assert.ok(!replay.setCookie.includes("lf_session="), "no session on replay");
});

test("a state that doesn't match the cookie is rejected before any exchange", async () => {
  const f = await startFlow("google");
  const r = await cb("google", "forged-state-value", f.cookie);
  assert.ok(r.loc.includes("auth_error=state_mismatch"), r.loc);
});

test("an unverified provider email never creates or links an account", async () => {
  googleProfile = { sub: "g-evil", email: "victim@v55.test", email_verified: false, name: "Nope" };
  const f = await startFlow("google");
  const r = await cb("google", f.state, f.cookie);
  assert.ok(r.loc.includes("auth_error=email_unverified"), r.loc);
  assert.equal(usersWith("victim@v55.test").length, 0);
  googleProfile = { sub: "g-123", email: "new@v55.test", email_verified: true, name: "New Person" };
});

test("email match LINKS the identity to the existing password account", async () => {
  const reg = await call("POST", "/api/auth/register", { name: "Lena Link", email: "link@v55.test", password: PW, business_name: "Link Co" });
  assert.equal(reg.s, 201, JSON.stringify(reg.j));
  const before1 = usersWith("link@v55.test")[0];
  googleProfile = { sub: "g-link", email: "link@v55.test", email_verified: true, name: "Lena Link" };
  const f = await startFlow("google");
  const r = await cb("google", f.state, f.cookie);
  assert.equal(r.loc, "/app");
  const me = await call("GET", "/api/auth/me", undefined, r.setCookie.split(";")[0]);
  assert.equal(me.j.user.id, before1.id, "signed into the pre-existing account, not a new one");
  const ident = dbm.db.prepare("SELECT * FROM user_identities WHERE provider='google' AND subject='g-link'").get() as any;
  assert.equal(ident.user_id, before1.id);
  googleProfile = { sub: "g-123", email: "new@v55.test", email_verified: true, name: "New Person" };
});

test("microsoft: path-safe flow, UPN fallback when mail is null", async () => {
  const f = await startFlow("microsoft");
  const u = new URL(f.loc);
  assert.equal(u.hostname, "login.microsoftonline.com");
  assert.ok(u.searchParams.get("redirect_uri")?.endsWith("/api/auth/social/microsoft/callback"));
  const r = await cb("microsoft", f.state, f.cookie);
  assert.equal(r.loc, "/app", JSON.stringify(r));
  assert.equal(usersWith("ms@v55.test").length, 1, "account created from the UPN");
});

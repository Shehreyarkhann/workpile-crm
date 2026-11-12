// V54 — Microsoft forbids query strings in redirect URIs (Azure rejected
// /api/oauth/callback?provider=microsoft at registration). The provider now
// rides in the PATH for Microsoft; Google keeps the registered query form.
// Authorize URL and token exchange share one helper, so they can't drift.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v54-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.env.GOOGLE_CLIENT_ID = "g-id"; process.env.GOOGLE_CLIENT_SECRET = "g-secret";
process.env.MS_CLIENT_ID = "m-id"; process.env.MS_CLIENT_SECRET = "m-secret";
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v54", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, loc: r.headers.get("location"), cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = "";
before(async () => {
  await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v54.test", password: PW, business_name: "V54 OAuth Co" });
  const l = await call("POST", "/api/auth/login", { email: "owner@v54.test", password: PW });
  owner = l.cookie!;
});

test("microsoft authorize URL uses the path-form redirect (no query string)", async () => {
  const r = await call("GET", "/api/oauth/microsoft/start", undefined, owner);
  assert.equal(r.s, 200, JSON.stringify(r.j));
  const u = new URL(r.j.url);
  assert.equal(u.searchParams.get("redirect_uri")?.endsWith("/api/oauth/callback/microsoft"), true, u.searchParams.get("redirect_uri") || "");
  assert.ok(!u.searchParams.get("redirect_uri")?.includes("?"), "no query string in the microsoft redirect uri — the exact thing Azure rejected");
});

test("google authorize URL keeps the registered query-form redirect", async () => {
  const r = await call("GET", "/api/oauth/google/start", undefined, owner);
  assert.equal(r.s, 200, JSON.stringify(r.j));
  const u = new URL(r.j.url);
  assert.ok(u.searchParams.get("redirect_uri")?.endsWith("/api/oauth/callback?provider=google"), u.searchParams.get("redirect_uri") || "");
});

test("the path-form callback route exists and lands on the app error redirect (not a 404)", async () => {
  const r = await call("GET", "/api/oauth/callback/microsoft?code=bogus&state=x.ws_nope", undefined, undefined);
  assert.equal(r.s, 302, "route handled the request");
  assert.ok((r.loc || "").includes("mail=error"), r.loc || "");
});

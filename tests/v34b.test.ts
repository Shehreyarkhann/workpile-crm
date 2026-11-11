// V34.1 operator exclusivity: PLATFORM_ADMIN_EMAIL names the ONE account
// allowed to hold platform admin; syncPlatformAdmin grants it and revokes
// everyone else. Platform-admin accounts can never be impersonated.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const mod = await import("../server/app.ts"); const app = mod.app;
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
async function signup(email: string, biz: string) { await J("/api/auth/register", { method: "POST", body: { name: "O " + biz, business_name: biz, email, password: "password123" } }); const ck = (await J("/api/auth/login", { method: "POST", body: { email, password: "password123" } })).ck; const me = await J("/api/auth/me", {}, ck); return { ck, uid: me.j.user.id }; }
const OP = await signup("operator@v34.test", "Operator Co");
const OTHER = await signup("other@v34.test", "Other Co");
const flag = (id: string) => (dbm.db.prepare("SELECT is_platform_admin FROM users WHERE id=?").get(id) as any).is_platform_admin;

test("syncPlatformAdmin makes the configured operator the ONLY platform admin", async () => {
  dbm.db.prepare("UPDATE users SET is_platform_admin=1 WHERE id=?").run(OTHER.uid);
  dbm.db.prepare("UPDATE users SET is_platform_admin=0 WHERE id=?").run(OP.uid);
  assert.equal(flag(OTHER.uid), 1); assert.equal(flag(OP.uid), 0);
  process.env.PLATFORM_ADMIN_EMAIL = "operator@v34.test";
  mod.syncPlatformAdmin();
  assert.equal(flag(OP.uid), 1, "operator granted");
  assert.equal(flag(OTHER.uid), 0, "everyone else revoked");
  assert.equal((await J("/api/admin/overview", {}, OTHER.ck)).s, 403, "revoked admin loses the console");
  assert.equal((await J("/api/admin/overview", {}, OP.ck)).s, 200);
  process.env.PLATFORM_ADMIN_EMAIL = "";
});

test("a platform admin account can never be impersonated", async () => {
  dbm.db.prepare("UPDATE users SET is_platform_admin=1 WHERE id IN (?,?)").run(OP.uid, OTHER.uid);
  const bad = await J("/api/admin/impersonate", { method: "POST", body: { user_id: OTHER.uid } }, OP.ck);
  assert.equal(bad.s, 422); assert.equal(bad.j.error.code, "admin_target");
  const THIRD = await signup("third@v34.test", "Third Co");
  const ok = await J("/api/admin/impersonate", { method: "POST", body: { user_id: THIRD.uid } }, OP.ck);
  assert.equal(ok.s, 200, "ordinary users can still be impersonated by the operator");
});

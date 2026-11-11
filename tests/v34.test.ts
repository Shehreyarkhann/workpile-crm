// V34 Platform Console: operator-only access, customer plan/trial/suspend/
// delete, user disable/admin/role management, and the per-workspace plan
// workflow for a second workspace (fresh Pro trial of its own).
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
async function signup(email: string, biz: string) { await J("/api/auth/register", { method: "POST", body: { name: "Owner " + biz, business_name: biz, email, password: "password123" } }); const ck = (await J("/api/auth/login", { method: "POST", body: { email, password: "password123" } })).ck; const me = await J("/api/auth/me", {}, ck); return { ck, ws: me.j.user.workspace_id, uid: me.j.user.id }; }
const A = await signup("admin@v34.test", "Admin Co");
const BEE = await signup("bee@v34.test", "Bee Co");
const CEE = await signup("cee@v34.test", "Cee Co");
dbm.db.prepare("UPDATE users SET is_platform_admin=1 WHERE id=?").run(A.uid);

test("the console is operator-only", async () => {
  assert.equal((await J("/api/admin/overview", {}, BEE.ck)).s, 403);
  const ov = await J("/api/admin/overview", {}, A.ck); assert.equal(ov.s, 200);
  assert.ok(ov.j.workspaces >= 3 && ov.j.trialing >= 3, JSON.stringify(ov.j));
});

test("customers list + plan comp + trial extension", async () => {
  const list = await J("/api/admin/customers", {}, A.ck);
  const bee = list.j.find((r: any) => r.id === BEE.ws); assert.ok(bee && bee.plan === "pro" && bee.sub_status === "trialing", JSON.stringify(bee));
  const set = await J(`/api/admin/customers/${BEE.ws}/plan`, { method: "POST", body: { plan: "business" } }, A.ck);
  assert.equal(set.s, 200); assert.equal(set.j.plan, "business"); assert.equal(set.j.sub_status, "active"); assert.equal(set.j.source, "manual");
  const det = await J(`/api/admin/customers/${BEE.ws}`, {}, A.ck);
  assert.equal(det.j.users.length, 1); assert.ok(det.j.admin_actions.some((x: any) => x.action === "customer.plan_changed"));
  const before = (dbm.db.prepare("SELECT current_period_end FROM subscriptions WHERE workspace_id=?").get(CEE.ws) as any).current_period_end;
  const ext = await J(`/api/admin/customers/${CEE.ws}/trial`, { method: "POST", body: { days: 30 } }, A.ck);
  assert.equal(ext.s, 200); assert.ok(new Date(ext.j.current_period_end) > new Date(before), "trial moved out");
});

test("suspend locks the workspace's team out (but not /auth/me); disable locks the account", async () => {
  await J(`/api/admin/customers/${BEE.ws}/suspend`, { method: "POST", body: { suspended: true } }, A.ck);
  assert.equal((await J("/api/leads", {}, BEE.ck)).s, 403);
  const me = await J("/api/auth/me", {}, BEE.ck); assert.equal(me.s, 200); assert.equal(me.j.user.workspace_suspended, true);
  await J(`/api/admin/customers/${BEE.ws}/suspend`, { method: "POST", body: { suspended: false } }, A.ck);
  assert.equal((await J("/api/leads", {}, BEE.ck)).s, 200);
  await J(`/api/admin/users/${BEE.uid}/disable`, { method: "POST", body: { disabled: true } }, A.ck);
  assert.equal((await J("/api/auth/me", {}, BEE.ck)).s, 401, "disable kills live sessions immediately");
  assert.equal((await J("/api/auth/login", { method: "POST", body: { email: "bee@v34.test", password: "password123" } })).s, 403, "and a disabled account cannot sign back in");
  await J(`/api/admin/users/${BEE.uid}/disable`, { method: "POST", body: { disabled: false } }, A.ck);
  const relogin = await J("/api/auth/login", { method: "POST", body: { email: "bee@v34.test", password: "password123" } });
  assert.equal(relogin.s, 200); BEE.ck = relogin.ck;
});

test("access management: role change, admin grant/revoke with self-guard, sole-owner delete guard", async () => {
  const role = await J(`/api/admin/users/${BEE.uid}/role`, { method: "POST", body: { role: "PM", workspace_id: BEE.ws } }, A.ck);
  assert.equal(role.s, 200);
  const det = await J(`/api/admin/customers/${BEE.ws}`, {}, A.ck); assert.equal(det.j.users[0].role, "PM");
  await J(`/api/admin/users/${BEE.uid}/role`, { method: "POST", body: { role: "OWNER", workspace_id: BEE.ws } }, A.ck);
  assert.equal((await J(`/api/admin/users/${A.uid}/platform-admin`, { method: "POST", body: { on: false } }, A.ck)).s, 422, "cannot revoke own admin");
  await J(`/api/admin/users/${BEE.uid}/platform-admin`, { method: "POST", body: { on: true } }, A.ck);
  assert.equal((await J("/api/admin/overview", {}, BEE.ck)).s, 200, "granted admin can use the console");
  await J(`/api/admin/users/${BEE.uid}/platform-admin`, { method: "POST", body: { on: false } }, A.ck);
  assert.equal((await J(`/api/admin/users/${CEE.uid}`, { method: "DELETE" }, A.ck)).s, 422, "sole owner cannot be deleted");
});

test("workspace delete cascades and removes only-home users; own workspace is guarded", async () => {
  assert.equal((await J(`/api/admin/customers/${A.ws}`, { method: "DELETE" }, A.ck)).s, 422, "cannot delete the workspace you are inside");
  const del = await J(`/api/admin/customers/${CEE.ws}`, { method: "DELETE" }, A.ck);
  assert.equal(del.s, 200, JSON.stringify(del.j)); assert.ok(del.j.deleted_rows > 0);
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM workspaces WHERE id=?").get(CEE.ws) as any).c, 0);
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM users WHERE id=?").get(CEE.uid) as any).c, 0, "only-home user removed with the workspace");
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM workspaces WHERE id=?").get(BEE.ws) as any).c, 1, "other customers untouched");
  const feed = await J("/api/admin/audit", {}, A.ck); assert.ok(feed.j.some((x: any) => x.action === "customer.deleted"));
});

test("a second workspace gets its OWN fresh Pro trial (per-workspace plan workflow)", async () => {
  const made = await J("/api/workspaces", { method: "POST", body: { name: "Admin Co — Second" } }, A.ck);
  assert.equal(made.s, 201, JSON.stringify(made.j).slice(0, 140));
  const bill = await J("/api/billing", {}, A.ck);
  assert.equal(bill.j.subscription.status, "trialing"); assert.equal(bill.j.subscription.plan, "pro");
  assert.ok(bill.j.trial_days_left >= 29, "fresh 30-day trial on the new workspace, got " + bill.j.trial_days_left);
});

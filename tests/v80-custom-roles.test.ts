// v80: fully custom roles — a workspace defines its own roles (name, title,
// access) cloned from a built-in; the v41 engine enforces them everywhere.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
async function callAs(cookie: string, method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, cookie: sc ? sc.split(";")[0] : cookie };
}
const PW = ["v80", "pw", "8017"].join("-");
let owner = ""; let roleId = ""; let estUserId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v80-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(26000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await callAs("", "POST", "/api/auth/register", { name: "Olive Owner", email: "owner80@demo.test", password: PW, business_name: "V80 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  owner = reg.cookie;
  const login = await callAs("", "POST", "/api/auth/login", { email: "owner80@demo.test", password: PW });
  owner = login.cookie;
});

test("owner creates a custom role cloned from a built-in; it lists with name + title", async () => {
  const r = await callAs(owner, "POST", "/api/roles/custom", { name: "Estimator", title: "Preconstruction Lead", base_role: "LEAD_OWNER" });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 200));
  roleId = r.body.role;
  assert.ok(roleId.startsWith("role_"), "custom role id");
  assert.equal(r.body.effective.can_approve, false, "cloned from LEAD_OWNER: cannot approve yet");
  const dup = await callAs(owner, "POST", "/api/roles/custom", { name: "Estimator", base_role: "PM" });
  assert.equal(dup.status, 422, "duplicate names refused");
  const roles = await callAs(owner, "GET", "/api/roles");
  const entry = (roles.body.roles || []).find((x: any) => x.role === roleId);
  assert.ok(entry && entry.is_custom && entry.name === "Estimator" && entry.title === "Preconstruction Lead", "listed as a custom role");
});

test("tuning the custom role's access is enforced for its members — including approvals", async () => {
  const roles = await callAs(owner, "GET", "/api/roles");
  const eff = (roles.body.roles || []).find((x: any) => x.role === roleId).effective;
  const tuned = { ...eff, can_approve: true, modules: { ...eff.modules, reports: "view" } };
  const put = await callAs(owner, "PUT", `/api/roles/${roleId}`, { perms: tuned });
  assert.equal(put.status, 200, JSON.stringify(put.body).slice(0, 160));
  const add = await callAs(owner, "POST", "/api/users", { name: "Ed Estimator", email: "ed@v80.test", password: PW, role: roleId });
  assert.equal(add.status, 201, JSON.stringify(add.body).slice(0, 160));
  estUserId = add.body.id;
  const login = await callAs("", "POST", "/api/auth/login", { email: "ed@v80.test", password: PW });
  const me = await callAs(login.cookie, "GET", "/api/auth/me");
  assert.equal(me.body.user.role, roleId);
  assert.equal(me.body.user.permissions.can_approve, true, "custom role grants approval rights");
  assert.equal(me.body.user.permissions.modules.reports, "view");
  // …but a non-owner still cannot create roles
  const no = await callAs(login.cookie, "POST", "/api/roles/custom", { name: "Sneaky", base_role: "PM" });
  assert.equal(no.status, 403);
});

test("an assigned role cannot be deleted; after reassignment it deletes cleanly", async () => {
  const del = await callAs(owner, "DELETE", `/api/roles/custom/${roleId}`);
  assert.equal(del.status, 422, JSON.stringify(del.body).slice(0, 160));
  assert.equal(del.body.error.code, "role_in_use");
  const re = await callAs(owner, "PATCH", `/api/team/${estUserId}`, { role: "PM" });
  assert.equal(re.status, 200, JSON.stringify(re.body).slice(0, 160));
  const del2 = await callAs(owner, "DELETE", `/api/roles/custom/${roleId}`);
  assert.equal(del2.status, 200);
  const roles = await callAs(owner, "GET", "/api/roles");
  assert.ok(!(roles.body.roles || []).some((x: any) => x.role === roleId), "role gone from the list");
  // a bogus role id is refused at assignment time
  const bad = await callAs(owner, "PATCH", `/api/team/${estUserId}`, { role: "role_nope123" });
  assert.equal(bad.status, 422);
});

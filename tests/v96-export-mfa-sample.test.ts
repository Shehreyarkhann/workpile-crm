// v96 — Tenant export (secrets stripped, owner/export-gated), TOTP MFA
// (setup → enable → login challenge → verify → disable), and onboarding
// sample data (empty workspaces only, one project included).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let mfa: any; let wsId = "";
async function callAs(cookie: string, method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t, cookie: (r.headers.get("set-cookie") || "").split(";")[0] || cookie };
}
let owner = ""; let pm = "";
const PW = ["v96", "pw", "9601"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v96-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(9000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  mfa = await import("../server/mfa.ts");
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await callAs("", "POST", "/api/auth/register", { name: "Eve Export", email: "eve@v96.test", password: PW, business_name: "V96 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); owner = reg.cookie; wsId = reg.body.user.workspace_id;
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,1,?)")
    .run("usr_v96pm", wsId, "Pete PM", "pete@v96.test", dbm.hashPassword(PW), "PM", new Date().toISOString());
  pm = (await callAs("", "POST", "/api/auth/login", { email: "pete@v96.test", password: PW })).cookie;
  await callAs(owner, "POST", "/api/leads", { contact: { name: "Export Client", email: "ec@v96.test", phone: "55501000096" }, service_requested: "Survey", est_value: 1000 });
});

test("the export bundles the workspace with secrets stripped, and is owner/export gated", async () => {
  const denied = await callAs(pm, "GET", "/api/export");
  assert.equal(denied.status, 403);
  const r = await callAs(owner, "GET", "/api/export");
  assert.equal(r.status, 200);
  assert.equal(r.body.format, "workpile-export-v1");
  assert.ok(!("llm_api_key" in (r.body.workspace || {})), "workspace API key stripped");
  assert.equal(r.body.counts.leads, 1);
  const u0 = r.body.tables.users[0];
  assert.ok(!("password_hash" in u0), "password hash stripped");
  assert.ok(!("totp_secret" in u0), "TOTP secret stripped");
});

test("MFA: setup, enable, challenged login, verify, disable", async () => {
  const setup = await callAs(owner, "POST", "/api/auth/mfa/setup", {});
  assert.equal(setup.status, 200, JSON.stringify(setup.body).slice(0, 120));
  assert.ok(setup.body.secret && setup.body.otpauth_url.startsWith("otpauth://totp/Workpile:"));
  const bad = await callAs(owner, "POST", "/api/auth/mfa/enable", { code: "000000" });
  assert.equal(bad.status, 401);
  const code = mfa.totpCode(setup.body.secret);
  const en = await callAs(owner, "POST", "/api/auth/mfa/enable", { code });
  assert.equal(en.status, 200, JSON.stringify(en.body));
  const login = await callAs("", "POST", "/api/auth/login", { email: "eve@v96.test", password: PW });
  assert.equal(login.body.mfa_required, true);
  assert.ok(login.body.pending && !login.body.user, "no session before the code");
  const wrong = await callAs("", "POST", "/api/auth/mfa/verify", { pending: login.body.pending, code: "000000" });
  assert.equal(wrong.status, 401);
  const right = await callAs("", "POST", "/api/auth/mfa/verify", { pending: login.body.pending, code: mfa.totpCode(setup.body.secret) });
  assert.equal(right.status, 200, JSON.stringify(right.body).slice(0, 160));
  assert.equal(right.body.user.email, "eve@v96.test");
  const off = await callAs(right.cookie, "POST", "/api/auth/mfa/disable", { password: PW });
  assert.equal(off.status, 200);
  const login2 = await callAs("", "POST", "/api/auth/login", { email: "eve@v96.test", password: PW });
  assert.ok(login2.body.user && !login2.body.mfa_required, "plain login again after disable");
});

test("sample data loads once into an empty workspace, with one real project", async () => {
  const reg2 = await callAs("", "POST", "/api/auth/register", { name: "New Biz", email: "new@v96.test", password: PW, business_name: "Fresh Start Environmental" });
  assert.equal(reg2.status, 201, JSON.stringify(reg2.body).slice(0, 140));
  const c2 = reg2.cookie;
  const load = await callAs(c2, "POST", "/api/onboarding/sample", {});
  assert.equal(load.status, 201, JSON.stringify(load.body).slice(0, 160));
  assert.equal(load.body.loaded, 5);
  const leads = await callAs(c2, "GET", "/api/leads");
  assert.equal(leads.body.length, 5);
  const jobs = await callAs(c2, "GET", "/api/jobs");
  assert.equal(jobs.body.length, 1, "the WON sample became a project");
  const again = await callAs(c2, "POST", "/api/onboarding/sample", {});
  assert.equal(again.status, 409);
});

// v93 (revised model, per Shehreyar 2026-11-18 21:40 ET) — ALL numbers are
// visible to everyone EXCEPT margin and projected margin. Those follow
// can_money (money roles by default, grantable per user), OR the workspace
// margin_public setting ("Margin visibility: Everyone").
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let wsId = ""; let jobId = ""; let leadId = "";
async function callAs(cookie: string, method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t, cookie: (r.headers.get("set-cookie") || "").split(";")[0] || cookie };
}
let ownerCookie = ""; let pmCookie = "";
const PW = ["v93", "pw", "9301"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v93-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(20000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await callAs("", "POST", "/api/auth/register", { name: "Olga Owner", email: "olga@v93.test", password: PW, business_name: "V93 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); ownerCookie = reg.cookie; wsId = reg.body.user.workspace_id;
  await callAs(ownerCookie, "POST", "/api/auth/login", { email: "olga@v93.test", password: PW }).then(r => { ownerCookie = r.cookie; });
  const pb = await callAs(ownerCookie, "POST", "/api/price-book", { name: "Crew day", unit: "day", standard_price: 1000, cost: 600 });
  const lead = await callAs(ownerCookie, "POST", "/api/leads", { contact: { name: "Gate Client", email: "gc@v93.test", phone: "55501000093" }, service_requested: "Abatement", est_value: 10000 });
  leadId = lead.body.lead.id;
  await callAs(ownerCookie, "POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await callAs(ownerCookie, "POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 10 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  await callAs(ownerCookie, "POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await callAs(ownerCookie, "POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await callAs(ownerCookie, "POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await callAs(ownerCookie, "POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await callAs(ownerCookie, "GET", "/api/jobs"); jobId = jobs.body[0].id;
  const pmId = "usr_v93pm";
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,1,?)")
    .run(pmId, wsId, "Pete PM", "pete@v93.test", dbm.hashPassword(PW), "PM", new Date().toISOString());
  const login = await callAs("", "POST", "/api/auth/login", { email: "pete@v93.test", password: PW });
  assert.equal(login.status, 200, JSON.stringify(login.body)); pmCookie = login.cookie;
  dbm.db.prepare("UPDATE leads SET pm_id=? WHERE id=?").run(pmId, leadId);
});

test("the owner (a money role) sees everything, margin included", async () => {
  const d = await callAs(ownerCookie, "GET", `/api/jobs/${jobId}`);
  assert.equal(d.body.money.contract, 10000);
  assert.equal(d.body.money.margin, 10000);
  assert.equal(d.body.money.projected_margin, 4000);
  const lead = await callAs(ownerCookie, "GET", `/api/leads/${leadId}`);
  assert.equal(lead.body.can_margin, true);
});

test("a PM sees every number EXCEPT margin and projected margin", async () => {
  const d = await callAs(pmCookie, "GET", `/api/jobs/${jobId}`);
  assert.equal(d.status, 200);
  assert.equal(d.body.money.contract, 10000, "contract visible");
  assert.equal(d.body.money.budget_cost, 6000, "budget cost visible");
  assert.ok(!("margin" in d.body.money), "margin withheld");
  assert.ok(!("projected_margin" in d.body.money), "projected margin withheld");
  const pb = await callAs(pmCookie, "GET", "/api/price-book");
  assert.equal(pb.body.find((x: any) => x.name === "Crew day").cost, 600, "price-book cost visible to everyone");
  const projects = await callAs(pmCookie, "GET", "/api/projects");
  const row = projects.body.find((p: any) => p.id === jobId);
  assert.equal(row.contract, 10000, "project contract visible");
  assert.ok(!("margin" in row), "project margin withheld");
  const lead = await callAs(pmCookie, "GET", `/api/leads/${leadId}`);
  assert.equal(lead.body.can_margin, false);
  const lines = JSON.parse(lead.body.proposals[0].line_items);
  assert.equal(lines[0].cost, 600, "proposal line costs visible to everyone");
  const list = await callAs(pmCookie, "GET", "/api/accounts");
  const acc = list.body.find((a: any) => (a.leads_count || 0) > 0) || list.body[0];
  assert.ok("lifetime_value" in acc, "lifetime value visible to everyone");
  const detail = await callAs(pmCookie, "GET", `/api/accounts/${acc.id}`);
  assert.ok(detail.body.money360 && typeof detail.body.money360.collected === "number", "customer money360 visible to everyone");
});

test("the workspace Margin visibility = Everyone setting opens margin to all", async () => {
  const set = await callAs(ownerCookie, "PATCH", "/api/settings", { margin_public: 1 });
  assert.equal(set.status, 200, JSON.stringify(set.body).slice(0, 160));
  assert.equal(set.body.workspace.margin_public, 1);
  const d = await callAs(pmCookie, "GET", `/api/jobs/${jobId}`);
  assert.equal(d.body.money.margin, 10000, "margin visible under the everyone setting");
  const lead = await callAs(pmCookie, "GET", `/api/leads/${leadId}`);
  assert.equal(lead.body.can_margin, true);
  await callAs(ownerCookie, "PATCH", "/api/settings", { margin_public: 0 });
  const d2 = await callAs(pmCookie, "GET", `/api/jobs/${jobId}`);
  assert.ok(!("margin" in d2.body.money), "margin withheld again when the setting is back off");
});

test("granting can_money to a specific user reveals margin to just that user", async () => {
  dbm.db.prepare("UPDATE users SET permissions=? WHERE email='pete@v93.test'").run(JSON.stringify({ can_money: true }));
  const d = await callAs(pmCookie, "GET", `/api/jobs/${jobId}`);
  assert.equal(d.body.money.margin, 10000);
  const projects = await callAs(pmCookie, "GET", "/api/projects");
  assert.equal(projects.body.find((p: any) => p.id === jobId).margin, 10000);
});

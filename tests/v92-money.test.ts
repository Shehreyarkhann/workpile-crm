// v92 — Project Control Center money: price-book costs snapshot onto proposal
// lines (and never reach client documents), the signed proposal's cost becomes
// the project budget, work-order actuals roll into margin, approved change
// orders revise the contract, and the projects list carries the same margin.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let myId = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v92", "pw", "9201"].join("-");
let jobId = ""; let propId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v92-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(24000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Mona Margin", email: "mona@v92.test", password: PW, business_name: "V92 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); myId = reg.body.user.id;
  await call("POST", "/api/auth/login", { email: "mona@v92.test", password: PW });
  const pb = await call("POST", "/api/price-book", { name: "Abatement crew day", unit: "day", standard_price: 1000, floor_price: 800, cost: 600 });
  assert.equal(pb.status, 201, JSON.stringify(pb.body));
  assert.equal(pb.body.cost, 600);
  const cls = await call("POST", "/api/labor-classes", { name: "Supervisor", private_rate: 50, govt_rate: 65 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Margin Client", email: "mc@v92.test", phone: "55501000092" }, service_requested: "Abatement", est_value: 10000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 10 }] });
  assert.equal(prop.status, 201, JSON.stringify(prop.body).slice(0, 200));
  propId = prop.body.proposal?.id || prop.body.id;
  const stored = dbm.db.prepare("SELECT line_items, total FROM proposals WHERE id=?").get(propId) as any;
  assert.equal(stored.total, 10000);
  const lines = JSON.parse(stored.line_items);
  assert.equal(lines[0].cost, 600, "cost snapshot on the line");
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs"); jobId = jobs.body[0].id;
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`);
  const woId = wos.body[0].id;
  await call("POST", `/api/work-orders/${woId}/time`, { user_id: myId, hours: 10, work_date: "2026-11-19", labor_class_id: cls.body.id });
  await call("POST", `/api/work-orders/${woId}/materials`, { description: "Poly sheeting", qty: 2, unit_cost: 150 });
});

test("client documents never carry the internal cost", async () => {
  const { proposalDocument } = await import("../server/proptemplate.ts");
  const doc = proposalDocument(propId) as any;
  assert.ok(doc, "document builds");
  assert.ok(!JSON.stringify(doc.items).includes('"cost"'), "cost stripped from the document model");
});

test("job money: contract, budget from proposal costs, actuals, margin", async () => {
  const d = await call("GET", `/api/jobs/${jobId}`);
  const m = d.body.money;
  assert.equal(m.contract, 10000);
  assert.equal(m.revised, 10000);
  assert.equal(m.budget_cost, 6000, "10 days x $600 cost");
  assert.equal(m.projected_margin, 4000);
  assert.equal(m.projected_margin_pct, 40);
  assert.equal(m.actual_cost, 800, "10h x $50 + 2 x $150");
  assert.equal(m.labor_cost, 500); assert.equal(m.materials_cost, 300);
  assert.equal(m.margin, 9200);
  assert.equal(m.cost_by_wo.length, 1);
  assert.equal(m.cost_by_wo[0].cost_total, 800);
});

test("an approved change order revises the contract; a manual budget overrides the proposal budget; projects list agrees", async () => {
  const co = await call("POST", `/api/jobs/${jobId}/change-orders`, { delta_scope: "Extra containment", delta_total: 2000 });
  assert.equal(co.status, 201, JSON.stringify(co.body).slice(0, 160));
  const coId = co.body.id || co.body.change_order?.id;
  await call("POST", `/api/change-orders/${coId}/status`, { status: "approved" });
  await call("PATCH", `/api/jobs/${jobId}`, { budget_cost: 7000 });
  const d = await call("GET", `/api/jobs/${jobId}`);
  assert.equal(d.body.money.change_orders, 2000);
  assert.equal(d.body.money.revised, 12000);
  assert.equal(d.body.money.budget_cost, 7000, "manual budget wins");
  assert.equal(d.body.money.projected_margin, 5000);
  assert.equal(d.body.money.margin, 11200);
  const projects = await call("GET", "/api/projects");
  const row = projects.body.find((p: any) => p.id === jobId);
  assert.equal(row.contract, 12000);
  assert.equal(row.actual_cost, 800);
  assert.equal(row.margin, 11200);
});

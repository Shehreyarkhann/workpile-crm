// v99 — Expenses: job-level and work-order-level costs with receipt
// attachments, folded into the money truth (actual cost, margin, per-WO
// cost) the moment they are recorded — and back out when deleted.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v99", "pw", "9901"].join("-");
let jobId = ""; let woId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v99-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Ed Expenses", email: "ed@v99.test", password: PW, business_name: "V99 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "ed@v99.test", password: PW });
  const pb = await call("POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 20000, cost: 9000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Expense Client", email: "ec@v99.test", phone: "55501000099" }, service_requested: "Abatement", est_value: 20000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 1 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs"); jobId = jobs.body[0].id;
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`); woId = wos.body[0].id;
});

test("expenses land in the money truth immediately — job level and per work order", async () => {
  const bad = await call("POST", `/api/jobs/${jobId}/expenses`, { amount: 0 });
  assert.equal(bad.status, 422);
  const e1 = await call("POST", `/api/jobs/${jobId}/expenses`, { vendor: "City Landfill", description: "Disposal fees", category: "disposal", amount: 1250, spent_on: "2026-11-18" });
  assert.equal(e1.status, 201, JSON.stringify(e1.body).slice(0, 140));
  const e2 = await call("POST", `/api/jobs/${jobId}/expenses`, { vendor: "Fuel Co", description: "Truck fuel", category: "fuel", amount: 300, work_order_id: woId });
  assert.equal(e2.status, 201);
  const list = await call("GET", `/api/jobs/${jobId}/expenses`);
  assert.equal(list.body.total, 1550);
  const job = await call("GET", `/api/jobs/${jobId}`);
  assert.equal(job.body.money.expenses_cost, 1550);
  assert.equal(job.body.money.actual_cost, 1550);
  assert.equal(job.body.money.margin, 18450, "margin = revised 20000 − actual 1550");
  assert.equal(job.body.money.cost_by_wo[0].expenses, 300);
  assert.equal(job.body.money.cost_by_wo[0].cost_total, 300);
  (globalThis as any).__e2 = e2.body.id;
});

test("a receipt attaches to the expense; deleting the expense restores the margin", async () => {
  const e2 = (globalThis as any).__e2;
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  const att = await call("POST", "/api/attachments", { entity_type: "expense", entity_id: e2, name: "fuel-receipt.png", mime: "image/png", data_base64: PNG, category: "receipt" });
  assert.equal(att.status, 201, JSON.stringify(att.body).slice(0, 140));
  const patched = await call("PATCH", `/api/expenses/${e2}`, { receipt_id: att.body.id });
  assert.equal(patched.body.receipt_id, att.body.id);
  const del = await call("DELETE", `/api/expenses/${e2}`);
  assert.equal(del.status, 200);
  const job = await call("GET", `/api/jobs/${jobId}`);
  assert.equal(job.body.money.expenses_cost, 1250);
  assert.equal(job.body.money.margin, 18750);
});

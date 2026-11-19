// v94 — Sales tax + milestone billing. A default tax rate snapshots onto
// invoices (subtotal / tax / total), the public invoice page shows the tax
// line, a payment plan bills milestones as a % of the revised contract (each
// exactly once), tax can be waived per invoice, and Finances reports the tax
// actually collected.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v94", "pw", "9401"].join("-");
let jobId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v94-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(16000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Tara Tax", email: "tara@v94.test", password: PW, business_name: "V94 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "tara@v94.test", password: PW });
  const rate = await call("POST", "/api/tax-rates", { name: "NY sales tax", rate: 8.875, is_default: true });
  assert.equal(rate.status, 201, JSON.stringify(rate.body));
  const pb = await call("POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 64000, cost: 39000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Tax Client", email: "tc@v94.test", phone: "55501000094" }, service_requested: "Abatement", est_value: 64000 });
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
});

test("the standard invoice snapshots the default tax rate", async () => {
  const inv = await call("POST", `/api/jobs/${jobId}/invoice`, {});
  assert.equal(inv.status, 201, JSON.stringify(inv.body).slice(0, 200));
  assert.equal(inv.body.subtotal, 64000);
  assert.equal(inv.body.tax_rate, 8.875);
  assert.equal(inv.body.tax_name, "NY sales tax");
  assert.equal(inv.body.tax_amount, 5680);
  assert.equal(inv.body.total, 69680);
  const page = await call("GET", `/invoice/${inv.body.token}`);
  assert.equal(page.status, 200);
  assert.ok(page.text.includes("NY sales tax (8.875%)"), "public page shows the tax line");
  assert.ok(page.text.includes("$5,680.00"), "public page shows the tax amount");
  // void it so the milestone flow starts clean
  const v = await call("POST", `/api/invoices/${inv.body.id}/void`, {});
  assert.ok(v.status === 200 || v.status === 201, JSON.stringify(v.body).slice(0, 120));
});

test("a payment plan bills each milestone once, as a % of the contract, with tax", async () => {
  await call("PATCH", `/api/jobs/${jobId}`, { payment_plan: JSON.stringify([{ label: "Deposit", pct: 25 }, { label: "On completion", pct: 75 }]) });
  const m0 = await call("POST", `/api/jobs/${jobId}/invoice`, { plan_item: 0 });
  assert.equal(m0.status, 201, JSON.stringify(m0.body).slice(0, 200));
  assert.equal(m0.body.subtotal, 16000);
  assert.equal(m0.body.tax_amount, 1420);
  assert.equal(m0.body.total, 17420);
  assert.equal(m0.body.plan_label, "Deposit");
  const dup = await call("POST", `/api/jobs/${jobId}/invoice`, { plan_item: 0 });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "milestone_invoiced");
  const m1 = await call("POST", `/api/jobs/${jobId}/invoice`, { plan_item: 1, tax: false });
  assert.equal(m1.status, 201, JSON.stringify(m1.body).slice(0, 200));
  assert.equal(m1.body.subtotal, 48000);
  assert.equal(m1.body.tax_amount, 0, "tax waived per-invoice");
  assert.equal(m1.body.total, 48000);
  const bad = await call("POST", `/api/jobs/${jobId}/invoice`, { plan_item: 7 });
  assert.equal(bad.status, 422);
});

test("paying the taxed milestone feeds the tax-collected figure", async () => {
  const invs = await call("GET", "/api/invoices");
  const m0 = invs.body.find((i: any) => i.plan_label === "Deposit");
  const pay = await call("POST", `/api/invoices/${m0.id}/payments`, { amount: 17420 });
  assert.ok(pay.status === 200 || pay.status === 201, JSON.stringify(pay.body).slice(0, 160));
  const fin = await call("GET", "/api/finances");
  assert.equal(fin.status, 200, JSON.stringify(fin.body).slice(0, 120));
  assert.equal(fin.body.tax_collected.value, 1420, "only the paid milestone's tax counts");
});

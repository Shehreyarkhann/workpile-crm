// v104 — QuickBooks payment sync: a paid invoice payment auto-pushes its
// invoice (if needed) and lands in QBO as a Payment linked to it; a
// deposit paid before any invoice exists defers, then resolves on the
// next sweep once the invoice is there. All against a stubbed Intuit API.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let payments: any;
const qbBodies: any[] = [];
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v104", "pw", "1401"].join("-");
async function waitFor(fn: () => boolean, ms = 9000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 300)); } return false; }

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v104-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  process.env.INTUIT_CLIENT_ID = ["cid", "stub"].join("-"); process.env.INTUIT_CLIENT_SECRET = ["sec", "stub"].join("-"); process.env.INTUIT_ENV = "sandbox";
  delete process.env.STRIPE_SECRET_KEY;
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: any, init: any = {}) => {
    const url = String(input);
    if (!url.includes("intuit.com")) return realFetch(input, init);
    const json = (obj: any) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("oauth.platform.intuit.com")) return json({ access_token: "tok-stub", refresh_token: "rt-next" });
    if (url.includes("query?")) return json({ QueryResponse: { Customer: [{ Id: "C1" }] } });
    if (url.endsWith("/customer")) return json({ Customer: { Id: "C1" } });
    if (url.endsWith("/invoice")) return json({ Invoice: { Id: "QB-INV-1" } });
    if (url.endsWith("/payment")) { qbBodies.push(JSON.parse(String(init.body || "{}"))); return json({ Payment: { Id: "QB-PAY-" + qbBodies.length } }); }
    return json({});
  };
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/quickbooks.ts"); // creates quickbooks_connections at import
  payments = await import("../server/payments.ts");
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Quinn Books", email: "quinn@v104.test", password: PW, business_name: "V104 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "quinn@v104.test", password: PW });
  dbm.db.prepare("INSERT INTO quickbooks_connections (workspace_id, realm_id, refresh_token, status, created_at, updated_at) VALUES (?,?,?,?,?,?)")
    .run(reg.body.user.workspace_id, "934123", "rt-seed", "connected", new Date().toISOString(), new Date().toISOString());
});

async function wonJobWithInvoice(email: string) {
  const pb = await call("POST", "/api/price-book", { name: "Abatement package " + email, unit: "job", standard_price: 20000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "QB Client", email, phone: "55501000104" }, service_requested: "Abatement", est_value: 20000 });
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
  const jobs = await call("GET", "/api/jobs");
  const job = jobs.body.find((j: any) => j.lead_id === leadId) || jobs.body[0];
  const invRes = await call("POST", `/api/jobs/${job.id}/invoice`, {});
  return { leadId, propId, invId: invRes.body.invoice?.id || invRes.body.id };
}

test("a paid invoice payment lands in QuickBooks linked to its invoice", async () => {
  const { invId } = await wonJobWithInvoice("qb1@v104.test");
  const pay = await payments.createInvoicePayment(invId, base);
  assert.ok(pay?.id, "test-mode payment created");
  const r = await fetch(`${base}/pay/test/${pay.id}`, { method: "POST" });
  assert.ok(r.status < 400);
  const ok = await waitFor(() => (dbm.db.prepare("SELECT qb_id FROM payments WHERE id=?").get(pay.id) as any)?.qb_id);
  assert.ok(ok, "the payment received a QBO id through the markPaid hook");
  const inv = dbm.db.prepare("SELECT qb_id FROM invoices WHERE id=?").get(invId) as any;
  assert.equal(inv.qb_id, "QB-INV-1", "the invoice was pushed first, automatically");
  assert.equal(qbBodies[0].Line[0].LinkedTxn[0].TxnId, "QB-INV-1", "the QBO payment links to the QBO invoice");
  assert.equal(qbBodies[0].TotalAmt, 20000);
});

test("a deposit paid before invoicing defers, then the sweep resolves it", async () => {
  const pb = await call("POST", "/api/price-book", { name: "Deposit package", unit: "job", standard_price: 8000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Dep Client", email: "dep@v104.test", phone: "55501000105" }, service_requested: "Survey", est_value: 8000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 1 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  const dep = await payments.createDeposit(propId, base);
  await fetch(`${base}/pay/test/${dep.id}`, { method: "POST" });
  await new Promise(r => setTimeout(r, 1500));
  let row = dbm.db.prepare("SELECT qb_id FROM payments WHERE id=?").get(dep.id) as any;
  assert.equal(row.qb_id, null, "no invoice yet — the deposit waits instead of erroring");
  // Now win it and invoice: the deposit credits the invoice, and the sweep
  // pushes the original deposit payment against that invoice.
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs");
  const job = jobs.body.find((j: any) => j.lead_id === leadId);
  await call("POST", `/api/jobs/${job.id}/invoice`, {});
  const sweep = await call("POST", "/api/quickbooks/sync-payments", {});
  assert.equal(sweep.status, 200, JSON.stringify(sweep.body).slice(0, 160));
  row = dbm.db.prepare("SELECT qb_id FROM payments WHERE id=?").get(dep.id) as any;
  assert.ok(row.qb_id, "the deposit is now in QuickBooks");
  const st = await call("GET", "/api/quickbooks/status");
  assert.ok(st.body.payments.synced >= 2, "status counts both synced payments");
});

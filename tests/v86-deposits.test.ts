// v86: the deposit link works (route returns { payment: { link }, mode } —
// the client read r.link and showed "undefined"), pending deposits are
// reused, and a paid deposit is CREDITED and SHOWN on the job and the
// invoice: deposit applied, amounts, remaining balance.
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
const PW = ["v86", "pw", "8601"].join("-");
let leadId = "", propId = "", payId = "", jobId = "", invId = "", invToken = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v86-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Dana Deposits", email: "dana@v86.test", password: PW, business_name: "V86 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "dana@v86.test", password: PW });
});

test("deposit link is real, and a second click reuses the same pending link", async () => {
  const r = await call("POST", "/api/leads", { contact: { name: "Deposit Dana Client", email: "client@v86.test", phone: "55501000086" }, service_requested: "Tank removal", est_value: 10000 });
  assert.equal(r.status, 201, JSON.stringify(r.body)); leadId = r.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const d = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(d.status, 201, JSON.stringify(d.body)); propId = d.body.proposal.id;
  dbm.db.prepare("UPDATE proposals SET total=10000 WHERE id=?").run(propId);
  const dep = await call("POST", `/api/proposals/${propId}/deposit`, {});
  assert.equal(dep.status, 201, JSON.stringify(dep.body));
  assert.ok(dep.body.payment?.link?.includes("/pay/test/"), "link present: " + JSON.stringify(dep.body).slice(0, 200));
  assert.equal(dep.body.payment.amount, 2500, "25% of 10000");
  payId = dep.body.payment.id;
  const dep2 = await call("POST", `/api/proposals/${propId}/deposit`, {});
  assert.equal(dep2.body.payment.id, payId, "pending deposit reused, not duplicated");
});

test("paying the deposit, winning and invoicing credits it and shows it everywhere", async () => {
  const payPage = await fetch(`${base}/pay/test/${payId}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "", redirect: "manual" });
  assert.ok([200, 302, 303].includes(payPage.status), "test pay POST " + payPage.status);
  const prop = dbm.db.prepare("SELECT payment_status FROM proposals WHERE id=?").get(propId) as any;
  assert.equal(prop.payment_status, "deposit_paid");
  // walk the gates, sign (DB assist), win
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  const won = await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  assert.equal(won.status, 200, JSON.stringify(won.body));
  const jobs = (await call("GET", "/api/jobs")).body;
  const job = (Array.isArray(jobs) ? jobs : jobs.jobs || []).find((j: any) => j.lead_id === leadId);
  assert.ok(job); jobId = job.id;
  dbm.db.prepare("UPDATE jobs SET value=10000 WHERE id=?").run(jobId);
  const inv = await call("POST", `/api/jobs/${jobId}/invoice`, {});
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  invId = inv.body.id; invToken = inv.body.token;
  assert.equal(inv.body.deposit_credit_applied, 2500);
  assert.equal(inv.body.deposit_credit, 2500);
  assert.equal(inv.body.deposits_taken_total, 2500);
  assert.equal(inv.body.deposits_taken.length, 1);
  assert.equal(inv.body.paid_amount, 2500);
  assert.equal(inv.body.balance, 7500);
  assert.equal(inv.body.status, "partially_paid");
  // the job carries the deposit story
  const jd = await call("GET", `/api/jobs/${jobId}`);
  assert.deepEqual(jd.body.deposits, { taken: 2500, applied: 2500, available: 0 });
  assert.equal(jd.body.invoices[0].deposit_credit, 2500);
  // the customer-facing invoice page shows it
  const pub = await fetch(`${base}/invoice/${invToken}`);
  const html = await pub.text();
  assert.ok(html.includes("Deposit applied"), "public page names the deposit");
  assert.ok(html.includes("$7,500.00"), "public page balance is net of the deposit");
  // the DOCX generates
  const doc = await call("GET", `/api/invoices/${invId}/document`);
  assert.equal(doc.status, 200, JSON.stringify(doc.body).slice(0, 120));
});

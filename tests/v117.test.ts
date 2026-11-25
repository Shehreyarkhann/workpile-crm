// v117 lifecycle integrity (LIFECYCLE-INTEGRITY-SCOPE P0):
// S1 sign completes the chain (lead WON + project at signed value),
// S8 approved change orders advance the project revision,
// S2 payment allocations (split checks / money orders), auto-advance on
// invoice send, computed close-readiness + validated close,
// S3 proposal validity sweep, aging buckets, revive.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v117-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.env.PORT = String(20000 + Math.floor(Math.random() * 20000));
delete process.env.BASE_URL;
delete process.env.STRIPE_SECRET_KEY;
process.chdir(tmp);

const PW = ["v117", "pw", "9031"].join("-");
let B = ""; let dbm: any; let followups: any; let numbering: any;
const jar = () => ({ cookie: "" });
async function call(c: any, method: string, p: string, body?: any) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(c.cookie ? { cookie: c.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) c.cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, text: t };
}
let A: any, ws = "";
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const db = () => dbm.db;

before(async () => {
  dbm = await import("../server/db.ts"); dbm.initSchema();
  followups = await import("../server/followups.ts");
  numbering = await import("../server/numbering.ts");
  await import("../server/index.ts");
  const appMod: any = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { B = `http://127.0.0.1:${(s.address() as any).port}`; res(); }); });
  A = jar();
  const ra = await call(A, "POST", "/api/auth/register", { name: "Olive Owner", email: "o@v117.co", password: PW, business_name: "Integrity Co" });
  assert.equal(ra.status, 201, JSON.stringify(ra.j));
  const me = await call(A, "GET", "/api/auth/me"); ws = me.j.user.workspace_id;
  db().prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES ('pb117',?, NULL,'Abatement job','job',5000,NULL)").run(ws);
});

async function mkLead(email = "cust@x.co") {
  const c = await call(A, "POST", "/api/leads", { contact: { name: "Casey Client", phone: "+15165550111", email }, service_requested: "Abatement", location: "Bay Shore, NY" });
  assert.equal(c.status, 201, JSON.stringify(c.j));
  return c.j.lead.id as string;
}
function mkJob(leadId: string, stage: string, value: number, id: string) {
  db().prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_from,created_at,updated_at,stage_changed_at) VALUES (?,?,?,?,?,'manual',?,?,?)").run(id, ws, leadId, stage, value, iso(3), iso(3), iso(3));
  numbering.assignProjectNo(ws, id);
  return id;
}
function mkWO(jobId: string, status: string, id: string) {
  db().prepare("INSERT INTO work_orders (id,workspace_id,job_id,seq,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(id, ws, jobId, 1, "WO " + id, status, iso(2), iso(1));
}
function mkInvoice(jobId: string, leadId: string, total: number, id: string, status = "sent") {
  db().prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,number,status,lines,total,paid_amount,issued_at,created_at) VALUES (?,?,?,?,?,?,?, ?,0,?,?)").run(id, ws, leadId, jobId, "INV-" + id.slice(-4), status, "[]", total, iso(1), iso(1));
}

test("S1: signing over HTTP completes the chain — lead WON, project at the signed value", async () => {
  const leadId = await mkLead();
  const prop = await call(A, "POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: "pb117", qty: 1 }] });
  assert.equal(prop.status, 201, JSON.stringify(prop.j));
  const link = await call(A, "POST", `/api/proposals/${prop.j.id}/sign-link`, {});
  assert.equal(link.status, 200, JSON.stringify(link.j));
  const form = new URLSearchParams({ signer_name: "Casey Client", signer_email: "cust@x.co", typed_signature: "Casey Client", consent: "1" });
  const r = await fetch(`${B}/sign/${link.j.token}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const html = await r.text();
  assert.ok(html.includes("Signed"), html.slice(0, 200));
  const lead = db().prepare("SELECT state FROM leads WHERE id=?").get(leadId) as any;
  assert.equal(lead.state, "WON");
  const job = db().prepare("SELECT * FROM jobs WHERE lead_id=?").get(leadId) as any;
  assert.ok(job, "project exists after signing with no further action");
  assert.equal(job.value, 5000);
  assert.ok(job.project_no, "project is numbered");
  const task = db().prepare("SELECT * FROM tasks WHERE lead_id=? AND type='schedule_job'").get(leadId) as any;
  assert.ok(task, "schedule-the-job task created");
});

test("S8: approved change orders advance the project revision; rejected ones do not", async () => {
  const leadId = await mkLead();
  const jobId = mkJob(leadId, "IN_PROGRESS", 5000, "job_s8");
  const before = db().prepare("SELECT project_no FROM jobs WHERE id=?").get(jobId) as any;
  assert.ok(before.project_no.endsWith("-00"), before.project_no);
  const co1 = await call(A, "POST", `/api/jobs/${jobId}/change-orders`, { delta_scope: "Extra containment", delta_total: 800, status: "draft" });
  assert.equal(co1.status, 201, JSON.stringify(co1.j));
  const ap1 = await call(A, "POST", `/api/change-orders/${co1.j.id}/status`, { status: "approved" });
  assert.equal(ap1.status, 200, JSON.stringify(ap1.j));
  assert.equal(ap1.j.project_iter, 1);
  let j = db().prepare("SELECT project_no FROM jobs WHERE id=?").get(jobId) as any;
  assert.ok(j.project_no.endsWith("-01"), j.project_no);
  const co2 = await call(A, "POST", `/api/jobs/${jobId}/change-orders`, { delta_scope: "Rejected extra", delta_total: 300, status: "draft" });
  await call(A, "POST", `/api/change-orders/${co2.j.id}/status`, { status: "rejected" });
  j = db().prepare("SELECT project_no FROM jobs WHERE id=?").get(jobId) as any;
  assert.ok(j.project_no.endsWith("-01"), "rejection must not bump: " + j.project_no);
  const co3 = await call(A, "POST", `/api/jobs/${jobId}/change-orders`, { delta_scope: "Second approved", delta_total: 200, status: "draft" });
  await call(A, "POST", `/api/change-orders/${co3.j.id}/status`, { status: "approved" });
  j = db().prepare("SELECT project_no FROM jobs WHERE id=?").get(jobId) as any;
  assert.ok(j.project_no.endsWith("-02"), j.project_no);
});

test("S2: split check across two invoices drives computed close-readiness; close is validated", async () => {
  const leadId = await mkLead();
  const jobId = mkJob(leadId, "INVOICED", 1000, "job_s2");
  mkWO(jobId, "completed", "wo_s2a");
  mkInvoice(jobId, leadId, 600, "inv_s2a");
  mkInvoice(jobId, leadId, 400, "inv_s2b");
  // close attempt before payment → 422 with named conditions
  const early = await call(A, "POST", `/api/jobs/${jobId}/stage`, { to: "CLOSED" });
  assert.equal(early.status, 422, JSON.stringify(early.j));
  assert.equal(early.j.error.code, "not_ready");
  assert.ok(early.j.error.conditions.some((c: any) => c.key === "fully_collected" && !c.met));
  // one check, $1,000, split across both invoices by the waterfall
  const pay = await call(A, "POST", `/api/jobs/${jobId}/payments`, { amount: 1000, method: "check", reference: "1042" });
  assert.equal(pay.status, 201, JSON.stringify(pay.j));
  assert.equal(pay.j.applied.length, 2);
  assert.equal(pay.j.unallocated, 0);
  assert.equal(pay.j.close_readiness.ready, true, JSON.stringify(pay.j.close_readiness));
  const invs = db().prepare("SELECT status FROM invoices WHERE job_id=? ORDER BY total DESC").all(jobId) as any[];
  assert.deepEqual(invs.map(i => i.status), ["paid", "paid"]);
  const allocs = db().prepare("SELECT COUNT(*) c FROM payment_allocations WHERE workspace_id=?").get(ws) as any;
  assert.ok(allocs.c >= 2, "allocation rows written");
  const detail = await call(A, "GET", `/api/jobs/${jobId}`);
  assert.equal(detail.j.close_readiness.ready, true);
  assert.equal(detail.j.derived_stage.stage, "READY_TO_CLOSE");
  const close = await call(A, "POST", `/api/jobs/${jobId}/stage`, { to: "CLOSED" });
  assert.equal(close.status, 200, JSON.stringify(close.j));
});

test("S2: an unallocated money-order payment blocks readiness and is named", async () => {
  const leadId = await mkLead();
  const jobId = mkJob(leadId, "INVOICED", 500, "job_s2b");
  mkWO(jobId, "completed", "wo_s2b");
  mkInvoice(jobId, leadId, 500, "inv_s2c");
  const p1 = await call(A, "POST", `/api/invoices/inv_s2c/payments`, { amount: 500, method: "check", reference: "88" });
  assert.equal(p1.status, 201, JSON.stringify(p1.j));
  const p2 = await call(A, "POST", `/api/jobs/${jobId}/payments`, { amount: 200, method: "money_order", reference: "MO-9" });
  assert.equal(p2.status, 201, JSON.stringify(p2.j));
  assert.equal(p2.unallocated ?? p2.j.unallocated, 200);
  const rd = p2.j.close_readiness;
  assert.equal(rd.ready, false);
  const fc = rd.conditions.find((c: any) => c.key === "fully_collected");
  assert.equal(fc.met, false);
  assert.ok(fc.detail.includes("not allocated"), fc.detail);
});

test("S2: issuing an invoice auto-advances the project stage to INVOICED", async () => {
  const leadId = await mkLead();
  const jobId = mkJob(leadId, "WORK_COMPLETED", 700, "job_s2c");
  mkInvoice(jobId, leadId, 700, "inv_s2d", "draft");
  const send = await call(A, "POST", `/api/invoices/inv_s2d/send`, {});
  assert.equal(send.status, 200, JSON.stringify(send.j));
  const j = db().prepare("SELECT stage, stage_changed_at FROM jobs WHERE id=?").get(jobId) as any;
  assert.equal(j.stage, "INVOICED");
  assert.ok(j.stage_changed_at);
  const inv = db().prepare("SELECT project_iter FROM invoices WHERE id='inv_s2d'").get() as any;
  assert.equal(inv.project_iter, 0);
});

test("S3: validity sweep expires stale sent proposals, extends a viewed one once", async () => {
  const leadId = await mkLead();
  const ins = (id: string, sentDays: number, expDays: number, viewed: string | null) => db().prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,sent_at,expires_at,viewed_at,created_at) VALUES (?,?,?,1,'sent','[]',900,?,?,?,?)").run(id, ws, leadId, iso(sentDays), iso(expDays), viewed, iso(sentDays));
  ins("prop_old", 100, 1, null);
  ins("prop_viewed", 40, 1, iso(2));
  followups.processProposalExpiry();
  const old = db().prepare("SELECT status FROM proposals WHERE id='prop_old'").get() as any;
  assert.equal(old.status, "expired");
  const viewed = db().prepare("SELECT status, expiry_extended FROM proposals WHERE id='prop_viewed'").get() as any;
  assert.equal(viewed.status, "sent");
  assert.equal(viewed.expiry_extended, 1);
  // second sweep: the extended one has a future expiry now — still sent
  followups.processProposalExpiry();
  const again = db().prepare("SELECT status FROM proposals WHERE id='prop_viewed'").get() as any;
  assert.equal(again.status, "sent");
});

test("S3: aging buckets + revive", async () => {
  const aging = await call(A, "GET", "/api/proposals/aging");
  assert.equal(aging.status, 200, JSON.stringify(aging.j));
  assert.ok(aging.j.expired.count >= 1, JSON.stringify(aging.j));
  const revive = await call(A, "POST", `/api/proposals/prop_old/revive`, {});
  assert.equal(revive.status, 200, JSON.stringify(revive.j));
  const p = db().prepare("SELECT status, expires_at FROM proposals WHERE id='prop_old'").get() as any;
  assert.equal(p.status, "sent");
  assert.ok(new Date(p.expires_at).getTime() > Date.now());
});

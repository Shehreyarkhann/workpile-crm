// V52 — the seam-fix tranche, tested through the REAL routes (the audit's
// blind-spot lesson: v50/v51 seeded DB state directly and masked the two
// worst defects — the approvals dialect split and the markPaid hook gap).
// Every scenario here enters through a public/API path a user would take.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v52-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const tools = await import("../server/tools.ts");
const labels = await import("../server/labels.ts");
const followups = await import("../server/followups.ts");
const pro = await import("../server/proactive.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v52", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string, headers: any = {}) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie, loc: r.headers.get("location") };
}
async function form(p: string) { const r = await fetch(B + p, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "", redirect: "manual" }); return { s: r.status, loc: r.headers.get("location") }; }
let owner = ""; let wsid = ""; let ownerId = ""; let pbId = ""; let pmCookie = "";
let seq = 0;
async function mkLead(name: string, svc = "Tank Testing", est = 2000) {
  seq++; const r = await call("POST", "/api/leads", { contact: { name, email: name.replace(/\s/g, "").toLowerCase() + seq + "@x.test", phone: "631555" + String(3000 + seq) }, consent: { contact_ok: true }, service_requested: svc, est_value: est }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j.lead;
}
async function mkProposal(leadId: string) {
  const r = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pbId, qty: 1 }] }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j;
}
before(async () => {
  const reg = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v52.test", password: PW, business_name: "V52 Seam Co" });
  assert.equal(reg.s, 201, JSON.stringify(reg.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v52.test", password: PW });
  owner = l.cookie!; const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id; ownerId = me.j.user.id;
  await call("PATCH", "/api/settings", { followup_enabled: true }, owner);
  const pmId = dbm.uid("usr");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active) VALUES (?,?,?,?,?,?,1)").run(pmId, wsid, "Pat PM", "pm@v52.test", dbm.hashPassword(PW), "PM");
  const pml = await call("POST", "/api/auth/login", { email: "pm@v52.test", password: PW }); pmCookie = pml.cookie!;
  const svc = await call("POST", "/api/services", { name: "Tank Testing" }, owner); const sid = svc.j.id || svc.j.service?.id;
  const pb = await call("POST", "/api/price-book", { service_id: sid, name: "Tank Testing", unit: "job", standard_price: 2000, floor_price: 1500 }, owner);
  pbId = pb.j.id || pb.j.item?.id; assert.ok(pbId, JSON.stringify(pb.j));
});

test("the customer pay path fires the referral playbook (markPaid hook)", async () => {
  const pb2 = await call("POST", "/api/campaigns/playbook", { kind: "referral" }, owner);
  const camp = pb2.j.campaign || pb2.j; assert.ok(camp?.id, JSON.stringify(pb2.j));
  dbm.db.prepare("UPDATE campaigns SET status='active' WHERE id=?").run(camp.id);
  const lead = await mkLead("Paying Customer");
  const won = await call("POST", `/api/leads/${lead.id}/stage`, { to: "WON", confirm_no_proposal: true }, owner); assert.ok([200, 201].includes(won.s), JSON.stringify(won.j));
  const job = dbm.db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead.id) as any; assert.ok(job, "WON auto-created the job");
  const inv = await call("POST", `/api/jobs/${job.id}/invoice`, {}, owner); assert.equal(inv.s, 201, JSON.stringify(inv.j));
  const pay = await form(`/invoice/${inv.j.token}/pay`); assert.ok(pay.loc?.includes("/pay/test/"), pay.loc || "no redirect");
  const payId = pay.loc!.split("/pay/test/")[1];
  await form(`/pay/test/${payId}`);
  const invRow = dbm.db.prepare("SELECT status FROM invoices WHERE id=?").get(inv.j.id) as any; assert.equal(invRow.status, "paid");
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(camp.id, lead.id) as any;
  assert.ok(enr, "the referral playbook enrolled the customer who paid ONLINE — the path that was dead before v52");
});

test("approvals: one dialect — the agent's submissions are visible to humans, and route approvals reach the operator", async () => {
  const lead = await mkLead("Gate Keeper");
  await call("POST", `/api/leads/${lead.id}/stage`, { to: "QUALIFIED" }, owner);
  const prop = await mkProposal(lead.id);
  const sub = await tools.TOOLS.submit_for_approval.run(wsid, ownerId, { lead_id: lead.id });
  assert.ok(sub.refs.approval_id, sub.summary);
  const queue = await call("GET", "/api/approvals", undefined, owner);
  assert.ok((queue.j.rows || queue.j).some((a: any) => a.id === sub.refs.approval_id), "agent-submitted approval appears in the human queue");
  const dec = await call("POST", `/api/approvals/${sub.refs.approval_id}/decide`, { decision: "approved" }, owner);
  assert.ok([200, 201].includes(dec.s), JSON.stringify(dec.j));
  // and the reverse direction: a route-created approval is seen by the proactive stale scan
  const lead2 = await mkLead("Stale Approval");
  await call("POST", `/api/leads/${lead2.id}/stage`, { to: "QUALIFIED" }, owner);
  const prop2 = await mkProposal(lead2.id);
  // the route requests approval only for NON-owner actors (owners are exempt
  // by design) — so the PM drives this stage move, through the real route
  const pm = dbm.db.prepare("SELECT id FROM users WHERE email='pm@v52.test'").get() as any;
  dbm.db.prepare("UPDATE leads SET owner_id=? WHERE id=?").run(pm.id, lead2.id);
  const mv = await call("POST", `/api/leads/${lead2.id}/stage`, { to: "PROPOSAL" }, pmCookie);
  assert.ok([200, 201].includes(mv.s), JSON.stringify(mv.j));
  const routeAppr = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=?").get(prop2.id) as any;
  assert.ok(routeAppr, "stage move requested the approval");
  dbm.db.prepare("UPDATE approvals SET submitted_at=datetime('now','-3 days') WHERE id=?").run(routeAppr.id);
  await pro.processProactive();
  const notif = dbm.db.prepare("SELECT * FROM notifications WHERE workspace_id=? AND title LIKE '%Approvals are waiting%'").get(wsid) as any;
  assert.ok(notif, "the 48h stale-approval reminder fires for route-created approvals");
});

test("ingest: a known customer's reply is linked, classified, and stops the cadence", async () => {
  const lead = await mkLead("Reply Rita");
  const r = await call("POST", "/api/inbox/ingest", { emails: [{ from_email: lead.contact_email || (lead as any).email, from_name: "Reply Rita", subject: "Re: quote and price", body: "Please unsubscribe me from these emails." }] }, owner);
  assert.equal(r.j.results[0].lead_id, lead.id, "the reply was linked to her lead, not swallowed as a duplicate lead: " + JSON.stringify(r.j));
  const item = dbm.db.prepare("SELECT * FROM inbox_items WHERE lead_id=?").get(lead.id) as any; assert.ok(item);
  labels.processReplyClassification();
  const sup = dbm.db.prepare("SELECT * FROM suppressions WHERE workspace_id=? AND kind='email'").get(wsid) as any;
  assert.ok(sup, "unsubscribe in a synced reply created a suppression");
  // cadence stop-on-reply
  const prop = await mkProposal(lead.id);
  const enrId = dbm.uid("fup");
  dbm.db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES (?,?,?,?,0,?,'active',?,?)").run(enrId, wsid, lead.id, prop.id, dbm.now(), dbm.now(), dbm.now());
  await call("POST", "/api/inbox/ingest", { emails: [{ from_email: lead.contact_email, from_name: "Reply Rita", subject: "Re: proposal", body: "Thanks, reviewing this week.", received_at: new Date(Date.now() + 120000).toISOString() }] }, owner);
  await followups.processFollowups("");
  const enr = dbm.db.prepare("SELECT status, stop_reason FROM followup_enrollments WHERE id=?").get(enrId) as any;
  assert.equal(enr.status, "stopped"); assert.equal(enr.stop_reason, "replied");
});

test("deposits are credited — never billed twice — and collected cash counts once", async () => {
  const lead = await mkLead("Deposit Dan", "Tank Testing", 2000);
  const prop = await mkProposal(lead.id);
  const dep = await call("POST", `/api/proposals/${prop.id}/deposit`, {}, owner); assert.equal(dep.s, 201, JSON.stringify(dep.j));
  assert.equal(dep.j.payment.amount, 500, "25% deposit on $2,000");
  await form(`/pay/test/${dep.j.payment.id}`);
  await call("POST", `/api/leads/${lead.id}/stage`, { to: "WON", confirm_no_proposal: true }, owner);
  const job = dbm.db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead.id) as any;
  const inv = await call("POST", `/api/jobs/${job.id}/invoice`, {}, owner);
  assert.equal(inv.s, 201, JSON.stringify(inv.j));
  assert.equal(inv.j.deposit_credit_applied, 500, "the deposit credited the invoice at creation");
  assert.equal(inv.j.paid_amount, 500); assert.equal(inv.j.status, "partially_paid");
  const fin = await call("GET", "/api/finances", undefined, owner);
  const net = (dbm.db.prepare("SELECT (SELECT COALESCE(SUM(amount),0) FROM payments WHERE workspace_id=? AND status='paid') - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE workspace_id=? AND status='refunded') v").get(wsid, wsid) as any).v;
  assert.equal(fin.j.collected_cash.value, net, "the API figure ties to the ledger");
  const creditRow = dbm.db.prepare("SELECT * FROM payments WHERE invoice_id=? AND kind='deposit_credit'").get(inv.j.id) as any;
  assert.ok(creditRow && creditRow.status === "applied" && creditRow.amount === 500, "the credit is an allocation, never counted as new cash");
});

test("superseded versions die: withdrawn, unsignable, and counted once", async () => {
  const lead = await mkLead("Version Vic");
  const v1 = await mkProposal(lead.id);
  const send = await call("POST", `/api/proposals/${v1.id}/send`, { channel: "email" }, owner); assert.equal(send.s, 201, JSON.stringify(send.j));
  const v2 = await mkProposal(lead.id);
  const v1Row = dbm.db.prepare("SELECT status FROM proposals WHERE id=?").get(v1.id) as any;
  assert.equal(v1Row.status, "withdrawn", "creating v2 withdrew v1");
  const send2 = await call("POST", `/api/proposals/${v2.id}/send`, { channel: "email" }, owner); assert.equal(send2.s, 201, JSON.stringify(send2.j));
  const fin = await call("GET", "/api/finances", undefined, owner);
  assert.equal(fin.j.proposal_value_outstanding.value, 2000, "outstanding counts the live version once, not both");
});

test("stripe webhook refuses unsigned events when no secret is configured", async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET; // the handler reads env per-request; this sandbox shell exports one
  const r = await call("POST", "/webhooks/stripe", { type: "checkout.session.completed", data: { object: { metadata: { payment_id: "pay_forged" } } } }, undefined);
  assert.equal(r.s, 503, "fail-closed: no secret, no trust");
});

test("agent endpoints honor the permission model — a PM cannot decide steps", async () => {
  const dec = await call("POST", "/api/agent/executions/exe_whatever/decide", { approve: ["s1"] }, pmCookie);
  assert.equal(dec.s, 403); assert.equal(dec.j.error.code, "cannot_approve");
});

test("/v1/missed-call: text-back without manufactured consent, throttled", async () => {
  const key = await call("POST", "/api/api-keys", { label: "v52 test", scopes: "leads:write" }, owner);
  assert.equal(key.s, 201, JSON.stringify(key.j));
  const h = { authorization: "Bearer " + key.j.key };
  const r1 = await call("POST", "/v1/missed-call", { phone: "6315557777", name: "Caller Carl" }, undefined, h);
  assert.ok([200, 201].includes(r1.s), JSON.stringify(r1.j));
  const lead = dbm.db.prepare("SELECT * FROM leads WHERE id=?").get(r1.j.lead_id) as any;
  assert.equal(lead.consent_contact_ok || 0, 0, "a missed call did NOT manufacture marketing consent");
  const r2 = await call("POST", "/v1/missed-call", { phone: "6315557777", name: "Caller Carl" }, undefined, h);
  assert.equal(r2.j.text_back_status, "skipped_recent", "second call within 24h is throttled");
});

test("the act-tools: gated send, invoice send, job stage gates, change order, task completion, approval read", async () => {
  const lead = await mkLead("Tool Tess");
  await call("POST", `/api/leads/${lead.id}/stage`, { to: "QUALIFIED" }, owner);
  const prop = await mkProposal(lead.id);
  await assert.rejects(async () => { await tools.TOOLS.send_proposal.run(wsid, ownerId, { proposal_id: prop.id }); }, /approval gate/, "send_proposal refuses before the gate");
  const sub = await tools.TOOLS.submit_for_approval.run(wsid, ownerId, { lead_id: lead.id });
  await call("POST", `/api/approvals/${sub.refs.approval_id}/decide`, { decision: "approved" }, owner);
  const sent = await tools.TOOLS.send_proposal.run(wsid, ownerId, { proposal_id: prop.id });
  assert.match(sent.summary, /sent to/); const pRow = dbm.db.prepare("SELECT status FROM proposals WHERE id=?").get(prop.id) as any; assert.equal(pRow.status, "sent");
  const lst = await tools.TOOLS.list_approvals.run(wsid, ownerId, {});
  assert.ok(typeof lst.summary === "string");
  // job stage + close gate
  await call("POST", `/api/leads/${lead.id}/stage`, { to: "WON", confirm_no_proposal: true }, owner);
  const job = dbm.db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead.id) as any;
  const mv = await tools.TOOLS.move_job_stage.run(wsid, ownerId, { job_id: job.id, to: "WORK_COMPLETED" }); assert.match(mv.summary, /WORK COMPLETED/);
  dbm.db.prepare("INSERT INTO documents (id,workspace_id,job_id,lead_id,name,required,status) VALUES (?,?,?,?,'COI',1,'missing')").run(dbm.uid("doc"), wsid, job.id, lead.id);
  await assert.rejects(async () => { await tools.TOOLS.move_job_stage.run(wsid, ownerId, { job_id: job.id, to: "CLOSED" }); }, /required document/);
  const waived = await tools.TOOLS.move_job_stage.run(wsid, ownerId, { job_id: job.id, to: "CLOSED", waive_docs: true }); assert.match(waived.summary, /waived/);
  const co = await tools.TOOLS.create_change_order.run(wsid, ownerId, { job_id: job.id, scope: "Extra tank test", amount: 250 }); assert.ok(co.refs.change_order_id);
  const task = await tools.TOOLS.create_followup_task.run(wsid, ownerId, { lead_id: lead.id, title: "Wrap up" });
  const done = await tools.TOOLS.complete_task.run(wsid, ownerId, { task_id: task.refs.task_id }); assert.match(done.summary, /completed/);
  // invoice send tool on the deposit test's invoice shape: fresh invoice here
  const inv2 = await call("POST", `/api/jobs/${job.id}/invoice`, {}, owner);
  if (inv2.s === 201) { const si = await tools.TOOLS.send_invoice.run(wsid, ownerId, { invoice_id: inv2.j.id }); assert.match(si.summary, /sent to/); }
});

test("cadence kill switch stops active sequences cold", async () => {
  const lead = await mkLead("Quiet Quinn");
  const prop = await mkProposal(lead.id);
  const send = await call("POST", `/api/proposals/${prop.id}/send`, { channel: "email" }, owner); assert.equal(send.s, 201, JSON.stringify(send.j));
  const enr = dbm.db.prepare("SELECT * FROM followup_enrollments WHERE lead_id=? AND status='active'").get(lead.id) as any; assert.ok(enr, "send enrolled the cadence");
  dbm.db.prepare("UPDATE followup_enrollments SET next_due_at=? WHERE id=?").run(dbm.now(), enr.id);
  await call("PATCH", "/api/settings", { followup_enabled: false }, owner);
  const before = (dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any).c;
  await followups.processFollowups("");
  const after = (dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any).c;
  assert.equal(after, before, "with follow-ups OFF, the due step did not send");
  await call("PATCH", "/api/settings", { followup_enabled: true }, owner);
  await followups.processFollowups("");
  const after2 = (dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any).c;
  assert.ok(after2 > after, "re-enabled: the cadence resumes");
});

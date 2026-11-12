// V45 — cheap gaps + SMB retention: variant reply rates & auto-winner,
// open/click tracking, playbooks with lifecycle auto-enroll (job completed /
// invoice paid), missed-call text-back, recurring service engine.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v45-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const outreach = await import("../server/outreach.ts");
const lifecycle = await import("../server/lifecycle.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v45", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = "";
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v45.test", password: PW, business_name: "V45 Env" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v45.test", password: PW });
  owner = l.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
  dbm.db.prepare("UPDATE workspaces SET from_email='hello@v45env.com', review_url='https://g.page/r/v45' WHERE id=?").run(wsid);
});
let seq = 100;
async function mkLead(service = "Tank Testing") {
  seq++;
  const r = await call("POST", "/api/leads", { contact: { name: "Pat " + seq, email: `p${seq}@v45.test`, phone: "631555" + String(4000 + seq) }, consent: { contact_ok: true }, service_requested: service, est_value: 900 }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j.lead;
}
async function wonJob(lead: any) {
  const mv = await call("POST", `/api/leads/${lead.id}/stage`, { to: "WON", confirm_no_proposal: true }, owner);
  assert.ok([200, 201].includes(mv.s), JSON.stringify(mv.j));
  const job = await call("POST", "/api/jobs", { lead_id: lead.id }, owner);
  return job.j;
}

test("variant reply rates attribute correctly and the winner gets auto-preferred", async () => {
  const c = await call("POST", "/api/campaigns", { name: "AB" }, owner); const cid = c.j.id;
  await call("PATCH", `/api/campaigns/${cid}`, { kind: "outreach" }, owner);
  const st = await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "A", body: "Body A" }, owner);
  await call("PATCH", `/api/campaign-steps/${st.j.id}`, { variants: [{ subject: "B", body: "Body B" }] }, owner);
  const mk = async (variant: number, replies: number) => {
    for (let i = 0; i < 20; i++) {
      const lead = await mkLead();
      const eid = dbm.uid("enr");
      dbm.db.prepare("INSERT INTO campaign_enrollments (id,workspace_id,campaign_id,lead_id,status,step_idx,variants,sent_count,created_at,updated_at) VALUES (?,?,?,?,'active',1,?,1,?,?)").run(eid, wsid, cid, lead.id, JSON.stringify({ 0: variant }), dbm.now(), dbm.now());
      dbm.db.prepare("INSERT INTO campaign_sends (id,workspace_id,campaign_id,enrollment_id,lead_id,step_idx,variant,status,created_at) VALUES (?,?,?,?,?,0,?,'sent',?)").run(dbm.uid("cs"), wsid, cid, eid, lead.id, variant, dbm.now());
      if (i < replies) dbm.db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,body,status,direction,created_at) VALUES (?,?,?,'email','x@v45.test','yes please','received','in',?)").run(dbm.uid("msg"), wsid, lead.id, new Date(Date.now() + 5000).toISOString());
    }
  };
  await mk(0, 6); await mk(1, 1);
  assert.equal(outreach.winningVariant(cid, 0), 0, "30% beats 5% at volume");
  let wins = 0; for (let i = 0; i < 40; i++) if (outreach.chooseVariant(cid, 0, "enr_probe_" + i, 2) === 0) wins++;
  assert.ok(wins >= 24, `winner preferred in ${wins}/40 assignments`);
  const detail = await call("GET", `/api/campaigns/${cid}`, undefined, owner);
  const v0 = detail.j.outreach.steps[0].variants[0];
  assert.equal(v0.replies, 6); assert.equal(v0.winner, true);
});

test("tracking pixel + click redirect record opens and clicks into campaign stats", async () => {
  const lead = await mkLead();
  const c = await call("POST", "/api/campaigns", { name: "Track" }, owner); const cid = c.j.id;
  await call("PATCH", `/api/campaigns/${cid}`, { kind: "outreach", send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24 }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "Hi", body: "See https://example.com/offer please" }, owner);
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [lead.id] }, owner);
  await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  await outreach.processCampaigns("");
  const row = dbm.db.prepare("SELECT track_token FROM messages_outbox WHERE lead_id=? AND track_token IS NOT NULL").get(lead.id) as any;
  assert.ok(row?.track_token, "campaign email carries a tracking token");
  const px = await fetch(`${B}/t/o/${row.track_token}.gif`);
  assert.equal(px.status, 200); assert.match(px.headers.get("content-type") || "", /image\/gif/);
  const cl = await fetch(`${B}/t/c/${row.track_token}?u=${encodeURIComponent("https://example.com/offer")}`, { redirect: "manual" });
  assert.equal(cl.status, 302); assert.equal(cl.headers.get("location"), "https://example.com/offer");
  const detail = await call("GET", `/api/campaigns/${cid}`, undefined, owner);
  assert.equal(detail.j.outreach.opens, 1); assert.equal(detail.j.outreach.clicks, 1);
});

test("review playbook auto-enrolls on job completion — and WON customers actually receive it", async () => {
  const pb = await call("POST", "/api/campaigns/playbook", { kind: "review" }, owner);
  assert.equal(pb.s, 201, JSON.stringify(pb.j)); assert.equal(pb.j.auto_trigger, "job_completed");
  const member = await mkLead();
  await call("POST", `/api/campaigns/${pb.j.id}/members`, { lead_ids: [member.id] }, owner);
  const launched = await call("POST", `/api/campaigns/${pb.j.id}/launch`, {}, owner);
  assert.equal(launched.s, 200, JSON.stringify(launched.j));
  // widen the window for the test run
  await call("PATCH", `/api/campaigns/${pb.j.id}`, { send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24 }, owner);
  const customer = await mkLead();
  const job = await wonJob(customer);
  const done = await call("POST", `/api/jobs/${job.id}/stage`, { to: "WORK_COMPLETED" }, owner);
  assert.equal(done.s, 200, JSON.stringify(done.j));
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(pb.j.id, customer.id) as any;
  assert.ok(enr, "job completion enrolled the customer into the review campaign");
  await outreach.processCampaigns("");
  const sends = dbm.db.prepare("SELECT COUNT(*) n FROM campaign_sends WHERE campaign_id=? AND lead_id=? AND status='sent'").get(pb.j.id, customer.id) as any;
  assert.ok(sends.n >= 1, "the review email sent to a WON customer (not stopped as finalized)");
  const mail = dbm.db.prepare("SELECT body FROM messages_outbox WHERE lead_id=? AND channel='email' ORDER BY created_at DESC").get(customer.id) as any;
  assert.match(mail.body, /g\.page\/r\/v45/, "review link rendered from the workspace setting");
});

test("referral playbook auto-enrolls when an invoice is paid in full", async () => {
  const pb = await call("POST", "/api/campaigns/playbook", { kind: "referral" }, owner);
  const member = await mkLead();
  await call("POST", `/api/campaigns/${pb.j.id}/members`, { lead_ids: [member.id] }, owner);
  await call("POST", `/api/campaigns/${pb.j.id}/launch`, {}, owner);
  const customer = await mkLead();
  const job = await wonJob(customer);
  const invId = dbm.uid("inv");
  dbm.db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,number,total,paid_amount,status,created_at) VALUES (?,?,?,?, 'INV-T', 500, 0, 'sent', ?)").run(invId, wsid, customer.id, job.id, dbm.now());
  const pay = await call("POST", `/api/invoices/${invId}/payments`, { amount: 500 }, owner);
  assert.ok([200, 201].includes(pay.s), JSON.stringify(pay.j));
  const enr = dbm.db.prepare("SELECT id FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(pb.j.id, customer.id) as any;
  assert.ok(enr, "payment enrolled the customer into the referral campaign");
});

test("missed-call webhook: text-back, lead, callback task, 24h throttle, key auth", async () => {
  dbm.db.prepare("UPDATE workspaces SET source_api_key='v45-key' WHERE id=?").run(wsid);
  const bad = await fetch(B + "/api/webhooks/missed-call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace_key: "nope", phone: "6315557777" }) });
  assert.equal(bad.status, 401);
  const r1 = await call("POST", "/api/webhooks/missed-call", { workspace_key: "v45-key", phone: "6315557777", name: "Sam Caller" });
  assert.equal(r1.j.ok, true, JSON.stringify(r1.j)); assert.equal(r1.j.text_back, "test_mode");
  const sms = dbm.db.prepare("SELECT * FROM messages_outbox WHERE lead_id=? AND channel='sms'").get(r1.j.lead_id) as any;
  assert.match(sms.body, /missed your call/);
  const task = dbm.db.prepare("SELECT * FROM tasks WHERE lead_id=? AND type='call'").get(r1.j.lead_id) as any;
  assert.ok(task, "callback task created");
  const r2 = await call("POST", "/api/webhooks/missed-call", { workspace_key: "v45-key", phone: "6315557777", name: "Sam Caller" });
  assert.equal(r2.j.text_back, "skipped_recent");
});

test("recurring service: job completion books the cycle; the sweep opens the opportunity", async () => {
  const svc = await call("POST", "/api/services", { name: "Annual Tank Test" }, owner);
  const sid = svc.j.id || (await call("GET", "/api/services", undefined, owner)).j.find((s: any) => s.name === "Annual Tank Test").id;
  await call("PATCH", `/api/services/${sid}`, { cycle_months: 12 }, owner);
  const customer = await mkLead("Annual Tank Test");
  const job = await wonJob(customer);
  await call("POST", `/api/jobs/${job.id}/stage`, { to: "WORK_COMPLETED" }, owner);
  const rec = dbm.db.prepare("SELECT * FROM recurrences WHERE lead_id=?").get(customer.id) as any;
  assert.ok(rec, "recurrence booked");
  const days = Math.round((new Date(rec.due_date).getTime() - Date.now()) / 86400000);
  assert.ok(days > 330 && days < 400, "due about a year out: " + days);
  dbm.db.prepare("UPDATE recurrences SET due_date=? WHERE id=?").run(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), rec.id);
  const made = lifecycle.processRecurrences();
  assert.ok(made >= 1);
  const after = dbm.db.prepare("SELECT * FROM recurrences WHERE id=?").get(rec.id) as any;
  assert.equal(after.status, "actioned");
  const opp = dbm.db.prepare("SELECT * FROM opportunities WHERE id=?").get(after.opportunity_id) as any;
  assert.equal(opp.source_label, "recurrence"); assert.equal(opp.stage, "interested");
});

// V43 — engagement layer: reply classification, label consequences (opportunity,
// unsubscribe, OOO pause/resume), label-rule subsequences, inbox classification
// pass, inbox label endpoint, opportunities board API + gates.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v43-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const labels = await import("../server/labels.ts");
const outreach = await import("../server/outreach.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v43", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = "";
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v43.test", password: PW, business_name: "V43 Env" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v43.test", password: PW });
  owner = l.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
});
let seq = 0;
async function mkLead(email: string) {
  seq++;
  const r = await call("POST", "/api/leads", { contact: { name: "Pat " + seq, email, phone: "631555" + String(2000 + seq) }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 2500 }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j.lead.id as string;
}
async function mkLiveCampaign(name: string, memberIds: string[] = []) {
  const c = await call("POST", "/api/campaigns", { name }, owner);
  const cid = c.j.id;
  await call("PATCH", `/api/campaigns/${cid}`, { kind: "outreach", send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24, daily_cap: 50 }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "One", body: "First" }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 2, subject: "Two", body: "Second" }, owner);
  if (memberIds.length) await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: memberIds }, owner);
  else { const dummy = await mkLead(`dummy-${cid.slice(-4)}@v43.test`); await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [dummy] }, owner); }
  const l = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(l.s, 200, JSON.stringify(l.j));
  return cid;
}

test("classifier: negatives and logistics win over interest", () => {
  assert.equal(labels.classifyReply("Not interested, thanks anyway"), "not_interested");
  assert.equal(labels.classifyReply("I am out of office returning on Monday"), "ooo");
  assert.equal(labels.classifyReply("Please unsubscribe me from this list"), "unsubscribe");
  assert.equal(labels.classifyReply("Hi, I'm interested — please send pricing"), "interested");
  assert.equal(labels.classifyReply("Wrong person — Maria handles facilities now"), "wrong_person");
  assert.equal(labels.classifyReply("Booked for Tuesday, calendar invite sent"), "meeting_booked");
  assert.equal(labels.classifyReply("yes"), "interested");
  assert.equal(labels.classifyReply("The invoice total was wrong"), null);
});

test("positive label opens exactly one opportunity", async () => {
  const lead = await mkLead("pos@v43.test");
  let r = await call("POST", `/api/leads/${lead}/labels`, { key: "interested" }, owner);
  assert.equal(r.j.applied, true);
  r = await call("POST", `/api/leads/${lead}/labels`, { key: "interested" }, owner);
  assert.equal(r.j.applied, false, "second application is a no-op");
  const opps = await call("GET", "/api/opportunities", undefined, owner);
  const mine = opps.j.rows.filter((o: any) => o.lead_id === lead);
  assert.equal(mine.length, 1); assert.equal(mine[0].stage, "interested"); assert.equal(mine[0].value, 2500);
  const mv = await call("PATCH", `/api/opportunities/${mine[0].id}`, { stage: "meeting_booked" }, owner);
  assert.equal(mv.s, 200);
  const after = await call("GET", "/api/opportunities", undefined, owner);
  assert.equal(after.j.totals.meeting_booked.count, 1);
});

test("unsubscribe suppresses and stops the sequence", async () => {
  const lead = await mkLead("unsub@v43.test");
  const cid = await mkLiveCampaign("Unsub Source", [lead]);
  const r = await call("POST", `/api/leads/${lead}/labels`, { key: "unsubscribe" }, owner);
  assert.equal(r.j.applied, true);
  const sup = dbm.db.prepare("SELECT * FROM suppressions WHERE workspace_id=? AND kind='email' AND value='unsub@v43.test'").get(wsid) as any;
  assert.ok(sup, "email suppression written");
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(cid, lead) as any;
  assert.equal(enr.status, "stopped"); assert.equal(enr.stop_reason, "unsubscribed");
  const ld = dbm.db.prepare("SELECT consent_contact_ok FROM leads WHERE id=?").get(lead) as any;
  assert.equal(ld.consent_contact_ok, 0);
});

test("OOO pauses the enrollment and the processor resumes it after the hold", async () => {
  const lead = await mkLead("ooo@v43.test");
  const cid = await mkLiveCampaign("OOO Source", [lead]);
  await call("POST", `/api/leads/${lead}/labels`, { key: "ooo" }, owner);
  let enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(cid, lead) as any;
  assert.equal(enr.status, "paused"); assert.equal(enr.stop_reason, "ooo");
  dbm.db.prepare("UPDATE campaign_enrollments SET next_due_at=? WHERE id=?").run(new Date(Date.now() - 60000).toISOString(), enr.id);
  await outreach.processCampaigns("");
  enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE id=?").get(enr.id) as any;
  assert.equal(enr.status, "active", "resumed after the hold passed");
  assert.equal(enr.sent_count, 1, "and the due step sent on resume");
});

test("label rule: Interested enrolls the lead into the subsequence campaign", async () => {
  const target = await mkLiveCampaign("Subsequence — Warm Follow-up");
  const lbl = (await call("GET", "/api/labels", undefined, owner)).j.find((l: any) => l.key === "interested");
  const rule = await call("POST", "/api/label-rules", { label_id: lbl.id, action: "enroll_campaign", campaign_id: target }, owner);
  assert.equal(rule.s, 201, JSON.stringify(rule.j));
  const lead = await mkLead("sub@v43.test");
  await call("POST", `/api/leads/${lead}/labels`, { key: "interested" }, owner);
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=? AND lead_id=?").get(target, lead) as any;
  assert.ok(enr && enr.status === "active", "subsequence enrollment created");
  const opps = await call("GET", "/api/opportunities", undefined, owner);
  assert.ok(opps.j.rows.some((o: any) => o.lead_id === lead), "positive consequence still fired alongside the rule");
});

test("worker classification pass labels inbox replies and flows to the lead", async () => {
  const lead = await mkLead("inbox@v43.test");
  const itemId = dbm.uid("inb");
  dbm.db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,lead_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(itemId, wsid, "client_active_job", "Pat", "inbox@v43.test", "Re: quote", "Sounds good — let's talk. Can you call me tomorrow?", lead, dbm.now());
  labels.processReplyClassification();
  const it = dbm.db.prepare("SELECT reply_label FROM inbox_items WHERE id=?").get(itemId) as any;
  assert.equal(it.reply_label, "interested");
  const ll = dbm.db.prepare("SELECT ll.* FROM lead_labels ll JOIN labels l ON l.id=ll.label_id WHERE ll.lead_id=? AND l.key='interested'").get(lead) as any;
  assert.ok(ll && ll.source === "ai_rules", "lead labeled by the classifier");
  const r = await call("POST", `/api/inbox/${itemId}/label`, { key: "not_interested" }, owner);
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.item.reply_label, "not_interested");
});

test("opportunities gates: PM can view, cannot create", async () => {
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(dbm.uid("usr"), wsid, "Paul PM", "paul@v43.test", dbm.hashPassword(PW), "PM");
  const lp = await call("POST", "/api/auth/login", { email: "paul@v43.test", password: PW });
  const view = await call("GET", "/api/opportunities", undefined, lp.cookie);
  assert.equal(view.s, 200);
  const lead = await mkLead("pm@v43.test");
  const create = await call("POST", "/api/opportunities", { lead_id: lead }, lp.cookie);
  assert.equal(create.s, 403, JSON.stringify(create.j));
});

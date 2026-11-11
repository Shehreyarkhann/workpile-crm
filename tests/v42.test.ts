// V42 — outreach engine: rendering (spintax/fallbacks/vars), launch validation,
// sequence sends through the comms boundary, A/B variant spread, daily cap
// deferral, stop-on-reply, suppression stop, and module gating.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v42-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const outreach = await import("../server/outreach.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v42", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = "";
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v42.test", password: PW, business_name: "V42 Env" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v42.test", password: PW });
  owner = l.cookie!;
});
let leadSeq = 0;
async function mkLead(email: string, name = "Pat Person") {
  leadSeq++;
  const r = await call("POST", "/api/leads", { contact: { name, email, phone: "631555" + String(1000 + leadSeq) }, consent: { contact_ok: true }, service_requested: "Mold Testing", est_value: 900 }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j.lead.id as string;
}
async function mkCampaign(name: string) {
  const r = await call("POST", "/api/campaigns", { name }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j));
  await call("PATCH", `/api/campaigns/${r.j.id}`, { kind: "outreach", send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24, daily_cap: 50 }, owner);
  return r.j.id as string;
}
const openWindow = { send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24 };

test("rendering: spintax deterministic, fallbacks, both variable syntaxes", () => {
  const vars = { first_name: "Sam", service: "Mold Testing" };
  const tpl = "Hi {{first_name}}, {{RANDOM | quick question | quick note}} about {service}. {{company | your home}} matters.";
  const a = outreach.renderOutreach(tpl, vars, "seed-1");
  const b = outreach.renderOutreach(tpl, vars, "seed-1");
  assert.equal(a, b, "same seed renders identically");
  assert.match(a, /^Hi Sam, (quick question|quick note) about Mold Testing\. your home matters\.$/);
  assert.deepEqual(outreach.unresolvedVars("Hi {{nickname}}", vars), ["nickname"]);
});

test("launch gates: no steps -> 422, no audience -> 422, then a full two-step run", async () => {
  const cid = await mkCampaign("Sequence A");
  let r = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(r.s, 422); assert.equal(r.j.error.code, "no_steps");
  const s0 = await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "Hi {{first_name}}", body: "Hello {first_name}, about your {service}." }, owner);
  assert.equal(s0.s, 201, JSON.stringify(s0.j));
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 2, subject: "Bump", body: "Bumping this, {first_name}." }, owner);
  r = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(r.s, 422); assert.equal(r.j.error.code, "no_audience");
  const lead = await mkLead("seq-a@v42.test");
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [lead] }, owner);
  r = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.enrolled, 1);
  const res = await outreach.processCampaigns("");
  assert.ok(res.sent >= 1, "step 0 sent");
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=?").get(cid) as any;
  assert.equal(enr.step_idx, 1); assert.equal(enr.sent_count, 1); assert.equal(enr.status, "active");
  const sends = dbm.db.prepare("SELECT * FROM campaign_sends WHERE campaign_id=?").all(cid) as any[];
  assert.equal(sends.length, 1); assert.equal(sends[0].step_idx, 0); assert.equal(sends[0].variant, 0);
  const det = await call("GET", `/api/campaigns/${cid}`, undefined, owner);
  assert.equal(det.j.outreach.total_sent, 1); assert.equal(det.j.outreach.steps.length, 2);
});

test("A/B: step variants spread across enrollments and stats count both", async () => {
  const cid = await mkCampaign("AB Blast");
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "A subject", body: "Body A for {first_name}", variants: [{ subject: "B subject", body: "Body B for {first_name}" }] }, owner);
  const ids: string[] = [];
  for (let i = 0; i < 20; i++) ids.push(await mkLead(`ab${i}@v42.test`, "Case" + i + " Person"));
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: ids }, owner);
  const r = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(r.j.enrolled, 20);
  await outreach.processCampaigns("");
  const sends = dbm.db.prepare("SELECT variant FROM campaign_sends WHERE campaign_id=?").all(cid) as any[];
  assert.equal(sends.length, 20);
  const vs = new Set(sends.map(s => s.variant));
  assert.ok(vs.has(0) && vs.has(1), "both variants used: " + [...vs].join(","));
  const det = await call("GET", `/api/campaigns/${cid}`, undefined, owner);
  const v = det.j.outreach.steps[0].variants;
  assert.equal(v[0].sent + v[1].sent, 20); assert.ok(v[0].sent > 0 && v[1].sent > 0);
});

test("daily cap defers the rest instead of sending", async () => {
  const cid = await mkCampaign("Capped");
  await call("PATCH", `/api/campaigns/${cid}`, { daily_cap: 1 }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "S", body: "B" }, owner);
  const a = await mkLead("cap1@v42.test"), b = await mkLead("cap2@v42.test");
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [a, b] }, owner);
  await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  await outreach.processCampaigns("");
  const sends = dbm.db.prepare("SELECT COUNT(*) n FROM campaign_sends WHERE campaign_id=?").get(cid) as any;
  assert.equal(sends.n, 1, "exactly the cap sent");
  const enr = dbm.db.prepare("SELECT COUNT(*) n FROM campaign_enrollments WHERE campaign_id=? AND status='active'").get(cid) as any;
  assert.equal(enr.n, 1, "the other enrollment waits for tomorrow");
});

test("stop-on-reply: an inbound message ends the sequence before the next step", async () => {
  const cid = await mkCampaign("Reply Stop");
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "S1", body: "One" }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 1, subject: "S2", body: "Two" }, owner);
  const lead = await mkLead("reply@v42.test");
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [lead] }, owner);
  await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  await outreach.processCampaigns(""); // step 0 sends
  dbm.db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,status,direction,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(dbm.uid("msg"), (dbm.db.prepare("SELECT workspace_id FROM leads WHERE id=?").get(lead) as any).workspace_id, lead, "email", "reply@v42.test", "Re: S1", "Thanks, tell me more", "received", "in", dbm.now());
  // force step 1 due now
  dbm.db.prepare("UPDATE campaign_enrollments SET next_due_at=? WHERE campaign_id=?").run(dbm.now(), cid);
  await outreach.processCampaigns("");
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=?").get(cid) as any;
  assert.equal(enr.status, "replied");
  const sends = dbm.db.prepare("SELECT COUNT(*) n FROM campaign_sends WHERE campaign_id=?").get(cid) as any;
  assert.equal(sends.n, 1, "step 1 never sent after the reply");
});

test("suppression stops the enrollment; PM cannot build steps (module gate)", async () => {
  const cid = await mkCampaign("Suppressed");
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "S", body: "B" }, owner);
  const lead = await mkLead("supp@v42.test");
  const wsid = (dbm.db.prepare("SELECT workspace_id FROM leads WHERE id=?").get(lead) as any).workspace_id;
  dbm.db.prepare("INSERT OR IGNORE INTO suppressions (id,workspace_id,kind,value,reason,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(dbm.uid("sup"), wsid, "email", "supp@v42.test", "test", "test", null, dbm.now());
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: [lead] }, owner);
  await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  await outreach.processCampaigns("");
  const enr = dbm.db.prepare("SELECT * FROM campaign_enrollments WHERE campaign_id=?").get(cid) as any;
  assert.equal(enr.status, "stopped"); assert.equal(enr.stop_reason, "suppressed");
  // PM has campaigns module = none by default
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(dbm.uid("usr"), wsid, "Paul PM", "paul@v42.test", dbm.hashPassword(PW), "PM");
  const lp = await call("POST", "/api/auth/login", { email: "paul@v42.test", password: PW });
  const denied = await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", subject: "X", body: "Y" }, lp.cookie);
  assert.equal(denied.s, 403, JSON.stringify(denied.j));
});

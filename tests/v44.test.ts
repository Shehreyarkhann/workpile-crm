// V44 — deliverability & senders: identity seeding/CRUD, rotation with
// per-sender limits, specific-sender pinning, warmup curve, failure-rate
// auto-pause, deliverability endpoint shape.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v44-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const outreach = await import("../server/outreach.ts");
const deliv = await import("../server/deliverability.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v44", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = "";
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v44.test", password: PW, business_name: "V44 Env" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v44.test", password: PW });
  owner = l.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
  dbm.db.prepare("UPDATE workspaces SET from_email='hello@v44env.com', from_name='V44 Env' WHERE id=?").run(wsid);
});
let seq = 0;
async function mkLead() {
  seq++;
  const r = await call("POST", "/api/leads", { contact: { name: "Pat " + seq, email: `p${seq}@v44.test`, phone: "631555" + String(3000 + seq) }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 900 }, owner);
  assert.equal(r.s, 201, JSON.stringify(r.j)); return r.j.lead.id as string;
}
async function mkCampaign(name: string, memberIds: string[], extra: any = {}) {
  const c = await call("POST", "/api/campaigns", { name }, owner);
  const cid = c.j.id;
  await call("PATCH", `/api/campaigns/${cid}`, { kind: "outreach", send_days: "0,1,2,3,4,5,6", window_start: 0, window_end: 24, daily_cap: 50, ...extra }, owner);
  await call("POST", `/api/campaigns/${cid}/steps`, { channel: "email", delay_days: 0, subject: "Hi", body: "Hello {first_name}" }, owner);
  await call("POST", `/api/campaigns/${cid}/members`, { lead_ids: memberIds }, owner);
  const l = await call("POST", `/api/campaigns/${cid}/launch`, {}, owner);
  assert.equal(l.s, 200, JSON.stringify(l.j));
  return cid;
}

test("identities seed from the workspace From email; warmup curve applies", async () => {
  const rows = await call("GET", "/api/sender-identities", undefined, owner);
  assert.equal(rows.j.length, 1); assert.equal(rows.j[0].email, "hello@v44env.com"); assert.equal(rows.j[0].is_default, 1);
  assert.equal(rows.j[0].effective_limit, 10, "day-0 sender is warmup-capped at 10 despite a 30 limit");
  assert.equal(rows.j[0].warmup_recommended, 10);
  const added = await call("POST", "/api/sender-identities", { name: "Outreach", email: "outreach@v44env.com", daily_limit: 25 }, owner);
  assert.equal(added.s, 201, JSON.stringify(added.j));
  const dup = await call("POST", "/api/sender-identities", { email: "outreach@v44env.com" }, owner);
  assert.equal(dup.s, 422);
  assert.equal(deliv.warmupRecommended({ created_at: new Date(Date.now() - 25 * 86400000).toISOString() }, new Date()), Number.POSITIVE_INFINITY);
});

test("rotation spreads sends and respects a sender's daily limit", async () => {
  const ids = await call("GET", "/api/sender-identities", undefined, owner);
  const a = ids.j.find((i: any) => i.email === "hello@v44env.com");
  const b = ids.j.find((i: any) => i.email === "outreach@v44env.com");
  // A capped at 1 (warmup skipped), B roomy and warmed
  await call("PATCH", `/api/sender-identities/${a.id}`, { daily_limit: 1, warmup_override: 1 }, owner);
  await call("PATCH", `/api/sender-identities/${b.id}`, { daily_limit: 30, warmup_override: 1 }, owner);
  const leads = [await mkLead(), await mkLead(), await mkLead()];
  const cid = await mkCampaign("Rotate", leads, { sender_mode: "rotate" });
  await outreach.processCampaigns("");
  const sends = dbm.db.prepare("SELECT sender_id, COUNT(*) n FROM campaign_sends WHERE campaign_id=? AND status='sent' GROUP BY sender_id").all(cid) as any[];
  const byId = Object.fromEntries(sends.map(s => [s.sender_id, s.n]));
  assert.equal(byId[a.id], 1, "A stopped at its limit of 1");
  assert.equal(byId[b.id], 2, "B took the rest");
  const out = dbm.db.prepare("SELECT DISTINCT from_addr FROM messages_outbox WHERE lead_id IN (SELECT lead_id FROM campaign_enrollments WHERE campaign_id=?) AND from_addr IS NOT NULL").all(cid) as any[];
  assert.deepEqual(out.map(r => r.from_addr).sort(), ["hello@v44env.com", "outreach@v44env.com"], "both From addresses actually used");
});

test("specific mode pins every send to the chosen identity", async () => {
  const ids = await call("GET", "/api/sender-identities", undefined, owner);
  const b = ids.j.find((i: any) => i.email === "outreach@v44env.com");
  const leads = [await mkLead(), await mkLead()];
  const cid = await mkCampaign("Pinned", leads, { sender_mode: "specific", sender_id: b.id });
  await outreach.processCampaigns("");
  const sends = dbm.db.prepare("SELECT DISTINCT sender_id FROM campaign_sends WHERE campaign_id=? AND status='sent'").all(cid) as any[];
  assert.deepEqual(sends.map(s => s.sender_id), [b.id]);
});

test("failure rate over 5% on volume auto-pauses the campaign", async () => {
  const lead = await mkLead();
  const cid = await mkCampaign("Fragile", [lead]);
  const enr = dbm.db.prepare("SELECT id FROM campaign_enrollments WHERE campaign_id=?").get(cid) as any;
  for (let i = 0; i < 20; i++) dbm.db.prepare("INSERT INTO campaign_sends (id,workspace_id,campaign_id,enrollment_id,lead_id,step_idx,variant,status,created_at) VALUES (?,?,?,?,?,0,0,'sent',?)").run(dbm.uid("cs"), wsid, cid, enr.id, lead, dbm.now());
  for (let i = 0; i < 2; i++) dbm.db.prepare("INSERT INTO campaign_sends (id,workspace_id,campaign_id,enrollment_id,lead_id,step_idx,variant,status,created_at) VALUES (?,?,?,?,?,0,0,'failed',?)").run(dbm.uid("cs"), wsid, cid, enr.id, lead, dbm.now());
  await outreach.processCampaigns("");
  const c = dbm.db.prepare("SELECT status FROM campaigns WHERE id=?").get(cid) as any;
  assert.equal(c.status, "paused", "9% failure rate paused the campaign");
  const notif = dbm.db.prepare("SELECT COUNT(*) n FROM notifications WHERE workspace_id=? AND type='campaign.autopaused'").get(wsid) as any;
  assert.ok(notif.n >= 1, "owners were notified");
});

test("deliverability endpoint: domain, checks array, failure stats, identities", async () => {
  const r = await call("GET", "/api/deliverability", undefined, owner);
  assert.equal(r.s, 200, JSON.stringify(r.j));
  assert.equal(r.j.domain, "v44env.com");
  assert.ok(Array.isArray(r.j.checks) && r.j.checks.length === 4);
  for (const c of r.j.checks) assert.ok(["pass", "warn", "fail", "unknown"].includes(c.status), "graceful status: " + c.status);
  assert.ok(r.j.failures_30d.sent >= 20);
  assert.equal(r.j.identities.length, 2);
});

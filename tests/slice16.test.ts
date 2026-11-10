// Slice 16: AI v2 — suggestions, one-click insight actions, auto-pilot automations.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test16-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", coldLead = "", hotLead = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T16 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t16.co", hashPassword("password1"), "OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t16.co", password: "password1" } })).cookie;
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Cold Carl", phone: "+15165551101", email: "carl@x.co" }, service_requested: "Mold remediation", message: "x", owner_id: owner } }, { Cookie: cookie });
  coldLead = c.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state='PROPOSAL_SENT', est_value=8000 WHERE id=?").run(coldLead);
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,total,sent_at,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("prop"), ws, coldLead, 1, "sent", 8000, "2026-10-26T00:00:00.000Z", "2026-10-26T00:00:00.000Z");
  const h = await J("/api/leads", { method: "POST", body: { contact: { name: "Hot Hanna", phone: "+15165551102", email: "hanna@x.co" }, service_requested: "Water damage cleanup", message: "Flooded basement, need help this week please", urgency: "emergency", est_value: 12000 } }, { Cookie: cookie });
  hotLead = h.j.lead.id;
});

test("suggest: cold proposal → nudge; hot uncontacted lead → call now; flags ride along", async () => {
  const s1 = await J(`/api/ai/suggest/${coldLead}`, {}, { Cookie: cookie });
  assert.equal(s1.j.suggestion.kind, "nudge"); assert.match(s1.j.suggestion.label, /cold/i);
  const s2 = await J(`/api/ai/suggest/${hotLead}`, {}, { Cookie: cookie });
  assert.equal(s2.j.suggestion.kind, "call"); assert.equal(s2.j.temperature, "hot");
  assert.ok(s2.j.flags.includes("no_next_step") || s2.j.flags.includes("unassigned"));
});

test("insights v2 surfaces the cold proposal with a lead_id; nudge sends (test mode) and logs a run", async () => {
  const ins = await J("/api/ai/insights", {}, { Cookie: cookie });
  const cold = ins.j.find((i: any) => i.kind === "cold");
  assert.ok(cold && cold.lead_id === coldLead);
  const n = await J("/api/ai/nudge", { method: "POST", body: { lead_id: coldLead } }, { Cookie: cookie });
  assert.equal(n.j.sent, true); assert.equal(n.j.channel, "email"); assert.equal(n.j.status, "test_mode");
  const msgs = await J(`/api/leads/${coldLead}/messages`, {}, { Cookie: cookie });
  assert.ok(msgs.j.some((m: any) => String(m.body).includes("Cold"))); // template greets by first name
  const runs = await J("/api/ai/runs", {}, { Cookie: cookie });
  assert.ok(runs.j.some((r: any) => r.agent === "nudge"));
});

test("autofix schedules next steps on open leads that have none", async () => {
  dbm.db.prepare("UPDATE leads SET next_action=NULL, next_action_due_at=NULL WHERE id=?").run(hotLead);
  const r = await J("/api/ai/autofix-next-steps", { method: "POST", body: {} }, { Cookie: cookie });
  assert.ok(r.j.fixed >= 1);
  const l = await J(`/api/leads/${hotLead}`, {}, { Cookie: cookie });
  assert.ok(l.j.lead.next_action && l.j.lead.next_action_due_at);
});

test("auto-pilot: toggles persist, run executes enabled actions and stamps last run", async () => {
  const set = await J("/api/ai/automations", { method: "POST", body: { auto_score: true, auto_assign: true } }, { Cookie: cookie });
  assert.equal(set.j.auto_score, 1); assert.equal(set.j.auto_assign, 1);
  const run = await J("/api/ai/automations/run", { method: "POST", body: {} }, { Cookie: cookie });
  assert.ok(run.j.result.scored >= 2);
  const after = await J("/api/ai/automations", {}, { Cookie: cookie });
  assert.ok(after.j.last_automation_at);
  const l = await J(`/api/leads/${hotLead}`, {}, { Cookie: cookie });
  assert.ok(l.j.lead.owner_id); // auto-assign gave the unassigned hot lead an owner
  const runs = await J("/api/ai/runs", {}, { Cookie: cookie });
  assert.ok(runs.j.some((r: any) => r.agent === "automation"));
});

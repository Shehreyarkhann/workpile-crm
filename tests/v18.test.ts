// V18: Home agenda completeness + one-click AI mass triage of untouched leads.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v18-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let WSID = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ck = "";
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  WSID = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(WSID, "V18 Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Omar", "o@v18.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("UPDATE workspaces SET agent_level=4 WHERE id=?").run(WSID);
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ck = (await J("/api/auth/login", { method: "POST", body: { email: "o@v18.co", password: "password1" } })).cookie;
});
const A = () => ({ Cookie: ck });
const mkLead = async (body: any) => (await J("/api/leads", { method: "POST", body }, A())).j.lead;
const dstr = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10);

test("home agenda: site visits, invoice dues and overdue tasks all appear (the calendar sources)", async () => {
  const { uid, now } = dbm;
  const lead = await mkLead({ contact: { name: "Vic Visit", email: "vic@x.co" }, service_requested: "Mold Testing", est_value: 1200 });
  dbm.db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,scheduled_at,status) VALUES (?,?,?,?, 'scheduled')").run(uid("vis"), WSID, lead.id, dstr(1) + "T15:00:00.000Z");
  dbm.db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?, 'open', ?)").run(uid("tsk"), WSID, lead.id, "follow_up", "Overdue chore", new Date(Date.now() - 2 * 86400000).toISOString(), now());
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, A());
  const job = (await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, A())).j;
  await J(`/api/jobs/${job.id}/invoice`, { method: "POST", body: { due_days: 2 } }, A());
  const home = (await J("/api/home", {}, A())).j;
  const kinds = new Set(home.upcoming.map((u: any) => u.kind));
  assert.ok(kinds.has("visit"), "site visit on the calendar");
  assert.ok(kinds.has("invoice"), "invoice due date on the calendar");
  assert.ok(kinds.has("task"), "overdue task on the calendar");
  const visit = home.upcoming.find((u: any) => u.kind === "visit");
  assert.equal(visit.time, "15:00");
  assert.equal(typeof home.untouched_count, "number");
});

test("mass triage: untouched leads are qualified/assigned/drafted automatically; sends wait for one approval pass", async () => {
  const a = await mkLead({ contact: { name: "Uma Untouched", email: "uma@x.co" }, service_requested: "Asbestos Survey", est_value: 5000 });
  const b = await mkLead({ contact: { name: "Uli Untouched", email: "uli@x.co" }, service_requested: "Tank Testing", est_value: 3000 });
  const touched = await mkLead({ contact: { name: "Tom Touched", email: "tom@x.co" }, service_requested: "Mold Testing", est_value: 1000 });
  await J(`/api/leads/${touched.id}/contact`, { method: "POST", body: { type: "call", outcome: "contacted" } }, A());
  const ex = await J("/api/agent/triage-untouched", { method: "POST", body: {} }, A());
  assert.equal(ex.status, 201);
  assert.equal(ex.j.status, "awaiting_approval", "internal work done; sends pending");
  const tools = ex.j.plan.map((s: any) => s.tool);
  assert.ok(!ex.j.plan.some((s: any) => s.refs?.lead_id === touched.id || s.label?.includes("Tom Touched")), "touched leads are excluded");
  const doneKinds = ex.j.plan.filter((s: any) => s.status === "done").map((s: any) => s.tool);
  assert.ok(doneKinds.includes("qualify_lead") && doneKinds.includes("assign_lead") && doneKinds.includes("draft_message"), "qualify/assign/draft ran");
  const sends = ex.j.plan.filter((s: any) => s.tool === "send_message");
  assert.equal(sends.length, 2); assert.ok(sends.every((s: any) => s.status === "pending" && s.needs_approval));
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id IN (?,?)").get(a.id, b.id) as any).c, 0, "nothing sent before approval");
  const la = dbm.db.prepare("SELECT owner_id FROM leads WHERE id=?").get(a.id) as any;
  assert.ok(la.owner_id, "lead got an owner from the auto pass");
  const done = await J(`/api/agent/executions/${ex.j.id}/decide`, { method: "POST", body: { approve: sends.map((s: any) => s.id) } }, A());
  assert.equal(done.j.status, "completed");
  const rows = dbm.db.prepare("SELECT status FROM messages_outbox WHERE lead_id IN (?,?)").all(a.id, b.id) as any[];
  assert.equal(rows.length, 2); assert.ok(rows.every((r: any) => r.status === "test_mode"), "sends recorded honestly as test_mode (no provider keys)");
});

test("mass triage with an empty pile completes cleanly", async () => {
  dbm.db.prepare("UPDATE leads SET first_response_at=datetime('now') WHERE workspace_id=?").run(WSID);
  const ex = await J("/api/agent/triage-untouched", { method: "POST", body: {} }, A());
  assert.equal(ex.j.status, "completed");
  assert.match(ex.j.summary, /pile is clear/);
});

// v73: persona-driven gaps from live-fire with the real model —
// (1) list tools returned samples with no totals, so the agent probed stage
//     by stage and still had to caveat "I can't give exact counts";
// (2) no schedule read existed at all: the agent told the ops director it
//     could not see work dates, crew, or double-bookings;
// (3) no way to remind a teammate; (4) bulk stage moves needed one call per
//     job, which dies against the turn cap at busy-business scale.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let tools: any; let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v73", "pw", "7311"].join("-");
let wsId = ""; let userId = ""; let mateId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v73-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  tools = await import("../server/tools.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner73@demo.test", password: PW, business_name: "V73 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner73@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; wsId = me.workspace_id; userId = me.id;
  const D = dbm.db; const T = new Date().toISOString();
  D.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active) VALUES (?,?,?,?,?,?,1)").run("usr_v73mike", wsId, "Mike Manager", "mike73@demo.test", "x", "APPROVER");
  mateId = "usr_v73mike";
  D.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run("ct_v73", wsId, "Pat Prospect", "pat@example.com");
  D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("lead_v73", wsId, "ct_v73", "Tank removal", "NEW", 4200, userId, T, T);
  // 3 jobs: 2 awaiting scheduling, 1 scheduled; job3 has a missing required doc
  for (const [id, stage] of [["job_v73a", "AWAITING_SCHEDULING"], ["job_v73b", "AWAITING_SCHEDULING"], ["job_v73c", "SCHEDULED"]] as const)
    D.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, wsId, "lead_v73", stage, 1000, T, T);
  D.prepare("INSERT INTO documents (id,workspace_id,job_id,lead_id,name,required,status) VALUES (?,?,?,?,?,?,?)").run("doc_v73", wsId, "job_v73c", "lead_v73", "Signed contract", 1, "missing");
  // same person double-booked tomorrow; one site visit tomorrow too
  const tm = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  D.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,created_by,created_at) VALUES (?,?,?,?,?,?,?)").run("sch_v73a", wsId, "lead_v73", userId, tm, userId, T);
  D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("lead_v73x", wsId, "ct_v73", "Roofing replacement", "NEW", 3000, userId, T, T);
  D.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,created_by,created_at) VALUES (?,?,?,?,?,?,?)").run("sch_v73b", wsId, "lead_v73x", userId, tm, userId, T);
  D.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status) VALUES (?,?,?,?,?,'scheduled')").run("vis_v73", wsId, "lead_v73", userId, tm + "T15:00:00.000Z");
  // one open overdue task
  D.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("tsk_v73", wsId, "lead_v73", userId, "follow_up", "Chase Pat", "2020-01-01T00:00:00.000Z", "open", T);
});

test("list tools report exact totals, not samples", async () => {
  const jobs = await tools.TOOLS.list_jobs.run(wsId, userId, {});
  assert.equal(jobs.refs.total, 3);
  assert.equal(jobs.refs.stage_counts.AWAITING_SCHEDULING, 2);
  const leads = await tools.TOOLS.search_leads.run(wsId, userId, {});
  assert.equal(leads.refs.total, 2);
  const tasks = await tools.TOOLS.list_tasks.run(wsId, userId, {});
  assert.equal(tasks.refs.total_open, 1); assert.equal(tasks.refs.overdue, 1);
});

test("get_schedule shows the week, flags double-booking, counts the unscheduled", async () => {
  const s = await tools.TOOLS.get_schedule.run(wsId, userId, { days: 7 });
  assert.equal(s.refs.unscheduled_count, 2);
  assert.equal(s.refs.conflicts.length, 1);
  assert.match(s.refs.conflicts[0].person, /Olive/);
  assert.equal(s.refs.visit_ids.length, 1);
  assert.match(s.summary, /DOUBLE-BOOKED/);
});

test("notify_teammate lands a notification on the person", async () => {
  assert.ok(mateId, "teammate seeded");
  const r = await tools.TOOLS.notify_teammate.run(wsId, userId, { user_id: mateId, message: "Two approvals are waiting on you." });
  assert.match(r.summary, /Notified Mike Manager/);
  const n = dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE workspace_id=? AND user_id=? AND type='agent_note'").get(wsId, mateId) as any;
  assert.equal(n.c, 1);
});

test("bulk stage move validates each job — the docs gate still holds per job", async () => {
  const r = await tools.TOOLS.bulk_move_job_stage.run(wsId, userId, { job_ids: ["job_v73a", "job_v73b"], to: "SCHEDULED" });
  assert.equal(r.refs.moved.length, 2);
  const blocked = await tools.TOOLS.bulk_move_job_stage.run(wsId, userId, { job_ids: ["job_v73c"], to: "CLOSED" });
  assert.equal(blocked.refs.moved.length, 0);
  assert.match(blocked.refs.skipped[0].reason, /document/);
  const waived = await tools.TOOLS.bulk_move_job_stage.run(wsId, userId, { job_ids: ["job_v73c"], to: "CLOSED", waive_docs: true });
  assert.equal(waived.refs.moved.length, 1);
});

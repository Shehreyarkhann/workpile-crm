// V19: the scheduling workflow chain — stage→SCHEDULED assigns date/time, syncs crew into
// Ops, creates the week's timesheets; assignments surface timesheet + time-grid sections.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v19-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let WSID = ""; let PM = ""; let OPS = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ck = "";
const mondayOf = (iso: string) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  WSID = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(WSID, "V19 Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Omar", "o@v19.co", hashPassword("password1"), "OWNER");
  PM = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(PM, WSID, "Pat PM", "pm@v19.co", hashPassword("password1"), "PM");
  OPS = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(OPS, WSID, "Olga Ops", "ops@v19.co", hashPassword("password1"), "OPS_ADMIN");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ck = (await J("/api/auth/login", { method: "POST", body: { email: "o@v19.co", password: "password1" } })).cookie;
});
const A = () => ({ Cookie: ck });
let seq = 0;
const mkWonJob = async () => {
  seq++;
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Wanda Won " + seq, email: "w" + seq + "@x.co" }, service_requested: "Asbestos Survey", est_value: 9000 } }, A())).j.lead;
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, A());
  const job = (await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, A())).j;
  return { lead, job };
};

test("stage → SCHEDULED assigns date/time, syncs crew to Ops, creates timesheets + grid + calendar entries", async () => {
  const { lead, job } = await mkWonJob();
  assert.equal(job.stage, "AWAITING_SCHEDULING");
  dbm.db.prepare("INSERT INTO job_crew (id,workspace_id,lead_id,user_id,created_at) VALUES (?,?,?,?,datetime('now'))").run(dbm.uid("crew"), WSID, lead.id, PM);
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const r = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "SCHEDULED", scheduled_start: `${date}T09:30:00` } }, A());
  assert.equal(r.j.stage, "SCHEDULED");
  assert.equal(r.j.scheduling.crew_scheduled, 1);
  assert.ok(r.j.scheduled_start.startsWith(date), "date/time stored on the job");
  assert.ok(r.j.scheduled_end > r.j.scheduled_start, "end derived");
  const week = mondayOf(date);
  const sched = (await J(`/api/schedule?week=${week}`, {}, A())).j;
  assert.ok(sched.jobs.some((x: any) => x.id === job.id), "job in the Ops week payload");
  assert.ok(sched.rows.some((x: any) => x.lead_id === lead.id && x.work_date === date), "crew row on the Ops schedule that day");
  const sheets = (await J(`/api/timesheets?week=${week}`, {}, A())).j;
  assert.ok(sheets.rows.some((x: any) => x.manager_id === PM), "crew member's timesheet exists for that week");
  const grid = (await J(`/api/time/grid?week=${week}`, {}, A())).j;
  assert.ok(grid.jobs.some((x: any) => x.lead_id === lead.id), "job appears as a time-grid section before any hours");
  const home = (await J("/api/home", {}, A())).j;
  assert.ok(home.upcoming.some((u: any) => u.kind === "job" && u.job_id === job.id), "job on the Home calendar");
  const cal = (await J(`/api/calendar?from=${week}&to=${date}`, {}, A())).j;
  assert.ok(cal.some((e: any) => e.kind === "job" && e.job_id === job.id), "job on the month calendar");
});

test("stage → SCHEDULED without a date defaults to tomorrow 09:00 (flagged), and moving back unschedules", async () => {
  const { lead, job } = await mkWonJob();
  const r = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "SCHEDULED" } }, A());
  assert.equal(r.j.scheduling.defaulted, true);
  assert.ok(r.j.scheduled_start, "a date/time was assigned");
  assert.equal(new Date(r.j.scheduled_start).getHours(), 9, "09:00 local default");
  const back = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "AWAITING_SCHEDULING" } }, A());
  assert.equal(back.j.scheduled_start, null);
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM job_schedule WHERE lead_id=?").get(lead.id) as any).c, 0);
});

test("assigning an OPS_ADMIN in the Ops schedule surfaces their timesheet that week", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Andy Assign", email: "a@x.co" }, service_requested: "Mold Testing", est_value: 800 } }, A())).j.lead;
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const week = mondayOf(date);
  const asg = await J("/api/schedule", { method: "POST", body: { user_id: OPS, lead_id: lead.id, work_date: date } }, A());
  assert.equal(asg.status, 200);
  const after = (await J(`/api/timesheets?week=${week}`, {}, A())).j;
  assert.ok(after.rows.some((x: any) => x.manager_id === OPS), "sheet exists after assignment");
});

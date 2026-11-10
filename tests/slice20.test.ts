// Slice 20: timesheets — auto-created weekly expectations, per-day logging, chase, payroll CSV.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test20-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number, paulId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", paulCookie = "";
const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); };

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T20 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t20.co", hashPassword("password1"), "OWNER");
  paulId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(paulId, ws, "Paul PM", "paul@t20.co", hashPassword("password1"), "PM");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Laura Lead", "laura@t20.co", hashPassword("password1"), "LEAD_OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Mike Manager", "mike@t20.co", hashPassword("password1"), "APPROVER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t20.co", password: "password1" } })).cookie;
  paulCookie = (await J("/api/auth/login", { method: "POST", body: { email: "paul@t20.co", password: "password1" } })).cookie;
});

test("expected sheets auto-created for field roles only (PM + Lead Owner, not Approver/Owner)", async () => {
  const r = await J("/api/timesheets", {}, { Cookie: cookie });
  assert.equal(r.j.rows.length, 2);
  assert.equal(r.j.summary.missing, 2); assert.equal(r.j.summary.submitted, 0);
  assert.ok(r.j.rows.every((x: any) => x.week_of === mondayOf(new Date())));
});

test("per-day logging sums hours, flips status, persists days + notes", async () => {
  const r = await J("/api/timesheets", { method: "POST", body: { manager_id: paulId, days: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 6 }, notes: "Ruiz + Hale jobs" } }, { Cookie: paulCookie });
  assert.equal(r.j.status, "submitted"); assert.equal(r.j.hours, 38);
  const list = await J("/api/timesheets", {}, { Cookie: cookie });
  assert.equal(list.j.summary.submitted, 1); assert.equal(list.j.summary.total_hours, 38);
  const paul = list.j.rows.find((x: any) => x.manager_id === paulId);
  assert.equal(paul.days.fri, 6);
});

test("payroll CSV exports the week with totals", async () => {
  // v9 lifecycle (§13.2): only APPROVED sheets reach payroll — approve Paul's first
  const list = await J("/api/timesheets", {}, { Cookie: cookie });
  const paul = list.j.rows.find((x: any) => x.manager_id === paulId);
  const ap = await J(`/api/timesheets/${paul.id}/approve`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(ap.status, 200);
  const r = await J("/api/timesheets/export", {}, { Cookie: cookie });
  assert.match(r.txt, /manager,email,week_of,mon,tue/);
  assert.ok(r.txt.includes("Paul PM") && r.txt.includes("38"));
  assert.ok(!r.txt.includes("Laura Lead"), "unapproved sheets never reach the payroll export");
});

test("chase notifies the manager once; the sweeper never double-chases", async () => {
  const lastWeek = mondayOf(new Date(Date.now() - 7 * 86400000));
  const list = await J(`/api/timesheets?week=${lastWeek}`, {}, { Cookie: cookie });
  const laura = list.j.rows.find((x: any) => x.manager === "Laura Lead");
  assert.equal(laura.status, "missing"); assert.equal(laura.overdue, true);
  const c = await J(`/api/timesheets/${laura.id}/chase`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(c.j.chased, true);
  const notes = dbm.db.prepare("SELECT * FROM notifications WHERE type='timesheet_missing'").all() as any[];
  assert.ok(notes.length >= 2); // manager + owners
  const ts = await import("../server/timesheets.ts");
  const sweep = ts.chaseMissing();
  assert.ok(sweep.chased >= 1); // Paul's last-week row is still unchased
  const sweep2 = ts.chaseMissing();
  assert.equal(sweep2.chased, 0); // dedupe via chased_at
});

test("My Day alerts the manager about last week's missing sheet until it's logged", async () => {
  const md = await J("/api/myday", {}, { Cookie: paulCookie });
  assert.ok(md.j.timesheet_alert && md.j.timesheet_alert.week_of === mondayOf(new Date(Date.now() - 7 * 86400000)));
  await J("/api/timesheets", { method: "POST", body: { week_of: md.j.timesheet_alert.week_of, hours: 40 } }, { Cookie: paulCookie });
  const md2 = await J("/api/myday", {}, { Cookie: paulCookie });
  assert.equal(md2.j.timesheet_alert, null);
});

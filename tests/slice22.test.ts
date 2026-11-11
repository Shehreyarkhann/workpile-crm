// Slice 22+23: field reports (daily standard) + crew scheduling.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test22-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number, paulId = "", leadId = "", lead2Id = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", paulCookie = "";
const today = new Date().toLocaleDateString("en-CA");
const yday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T22 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t22.co", hashPassword("password1"), "OWNER");
  paulId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(paulId, ws, "Paul PM", "paul@t22.co", hashPassword("password1"), "PM");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Mike Manager", "mike@t22.co", hashPassword("password1"), "APPROVER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t22.co", password: "password1" } })).cookie;
  paulCookie = (await J("/api/auth/login", { method: "POST", body: { email: "paul@t22.co", password: "password1" } })).cookie;
  const l1 = await J("/api/leads", { method: "POST", body: { contact: { name: "Cust One", phone: "+15165550111", email: "c1@t22.co" }, service_requested: "Mold remediation", est_value: 9000 } }, { Cookie: cookie });
  leadId = l1.j.lead.id;
  const l2 = await J("/api/leads", { method: "POST", body: { contact: { name: "Cust Two", phone: "+15165550222", email: "c2@t22.co" }, service_requested: "Water damage cleanup", est_value: 7000 } }, { Cookie: cookie });
  lead2Id = l2.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state='WON' WHERE id IN (?,?)").run(leadId, lead2Id);
});

test("field reports: daily expectation auto-created for field roles only", async () => {
  const r = await J("/api/field-reports?date=" + today, {}, { Cookie: cookie });
  assert.equal(r.j.rows.length, 1); // only Paul (PM) — not Owner/Approver
  assert.equal(r.j.rows[0].manager, "Paul PM");
  assert.equal(r.j.summary.missing, 1);
});

test("submit with notes + job link persists and shows the job", async () => {
  const list = await J("/api/field-reports?date=" + today, {}, { Cookie: cookie });
  const row = list.j.rows[0];
  const s = await J(`/api/field-reports/${row.id}/submit`, { method: "POST", body: { notes: "Containment up; dryers running.", lead_id: leadId } }, { Cookie: paulCookie });
  assert.equal(s.j.status, "submitted"); assert.equal(s.j.lead_id, leadId);
  const after = await J("/api/field-reports?date=" + today, {}, { Cookie: cookie });
  assert.equal(after.j.rows[0].job_service, "Mold remediation");
  assert.equal(after.j.summary.submitted, 1);
});

test("missing reports get chased exactly once by the sweeper; My Day alerts the manager", async () => {
  const list = await J("/api/field-reports?date=" + yday, {}, { Cookie: cookie });
  assert.equal(list.j.rows[0].status, "missing"); assert.equal(list.j.rows[0].overdue, true);
  const fr = await import("../server/fieldreports.ts");
  const s1 = await fr.chaseMissingReports(); assert.ok(s1.chased >= 1); // v37.1: async (real email path)
  const s2 = await fr.chaseMissingReports(); assert.equal(s2.chased, 0);
  const notes = dbm.db.prepare("SELECT * FROM notifications WHERE type='field_report_missing'").all() as any[];
  assert.ok(notes.length >= 2);
  const md = await J("/api/myday", {}, { Cookie: paulCookie });
  assert.ok(md.j.field_alert && md.j.field_alert.report_date === yday);
});

test("schedule: assign, double-booking flags, duplicate rejected, delete works", async () => {
  const a = await J("/api/schedule", { method: "POST", body: { user_id: paulId, lead_id: leadId, work_date: today, note: "8am start" } }, { Cookie: cookie });
  assert.equal(a.status, 200);
  const b = await J("/api/schedule", { method: "POST", body: { user_id: paulId, lead_id: lead2Id, work_date: today } }, { Cookie: cookie });
  assert.equal(b.status, 200);
  const dup = await J("/api/schedule", { method: "POST", body: { user_id: paulId, lead_id: leadId, work_date: today } }, { Cookie: cookie });
  assert.equal(dup.status, 409);
  const monday = (() => { const x = new Date(); const d = (x.getDay() + 6) % 7; x.setDate(x.getDate() - d); x.setHours(0, 0, 0, 0); return x.toISOString().slice(0, 10); })();
  const wk = await J("/api/schedule?week=" + monday, {}, { Cookie: cookie });
  const paulRows = wk.j.rows.filter((r: any) => r.user_id === paulId);
  assert.equal(paulRows.length, 2);
  assert.ok(paulRows.every((r: any) => r.conflict === true)); // two jobs, one day
  const notes = dbm.db.prepare("SELECT * FROM notifications WHERE type='scheduled'").all() as any[];
  assert.ok(notes.length >= 1);
  const del = await J("/api/schedule/" + a.j.id, { method: "DELETE" }, { Cookie: cookie });
  assert.equal(del.j.ok, true);
  const wk2 = await J("/api/schedule?week=" + monday, {}, { Cookie: cookie });
  assert.equal(wk2.j.rows.filter((r: any) => r.user_id === paulId).length, 1);
  assert.equal(wk2.j.rows.find((r: any) => r.user_id === paulId).conflict, false);
});

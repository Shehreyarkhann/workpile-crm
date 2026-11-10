// Slice 24: Weekly Status Report aggregates.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test24-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T24 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t24.co", hashPassword("password1"), "OWNER");
  const pm = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(pm, ws, "Paul PM", "paul@t24.co", hashPassword("password1"), "PM");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t24.co", password: "password1" } })).cookie;
  // a lead this week + a WON final delivery + a proposal + labor + field report + timesheet week state
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Rep Cust", phone: "+15165550333", email: "rc@t24.co" }, service_requested: "Phase I ESA", est_value: 12000 } }, { Cookie: cookie });
  const leadId = lead.j.lead.id;
  dbm.db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,last_status,created_at) VALUES (?,?,?,?,?,?)").run(uid("od"), ws, leadId, "won", "delivered", now()); // production writes lowercase outcomes (OUTCOME_OF) — slice 27 regression
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,status,total,created_at) VALUES (?,?,?,?,?,?)").run(uid("prop"), ws, leadId, "sent", 12000, now());
  dbm.db.prepare("INSERT INTO time_entries (id,workspace_id,lead_id,user_id,entry_date,hours,rate,amount,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("time"), ws, leadId, pm, new Date().toISOString().slice(0, 10), 6, 100, 600, now());
  await J("/api/field-reports", {}, { Cookie: cookie }); // ensures today's row
  const fr = await J("/api/field-reports", {}, { Cookie: cookie });
  await J(`/api/field-reports/${fr.j.rows[0].id}/submit`, { method: "POST", body: { notes: "done" } }, { Cookie: cookie });
  await J("/api/timesheets", { method: "POST", body: { manager_id: pm, hours: 40 } }, { Cookie: cookie });
});

test("weekly report aggregates the week honestly", async () => {
  const r = await J("/api/status-report", {}, { Cookie: cookie });
  assert.equal(r.status, 200);
  assert.ok(r.j.new_leads >= 1);
  assert.equal(r.j.won.count, 1); assert.equal(r.j.won.value, 12000);
  assert.equal(r.j.proposals.count, 1); assert.equal(r.j.proposals.value, 12000);
  assert.equal(r.j.labor.hours, 6); assert.equal(r.j.labor.cost, 600); assert.equal(r.j.labor.jobs, 1);
  assert.equal(r.j.field_reports.pct, 100);
  assert.equal(r.j.timesheets.pct, 100);
  assert.ok(r.j.top_jobs.length === 1 && r.j.top_jobs[0].service_requested === "Phase I ESA");
  assert.match(r.j.text, /WEEKLY STATUS/);
  assert.match(r.j.text, /Won: 1 \(\$12,000\)/);
});

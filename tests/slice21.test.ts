// Slice 21: labor costing — rate classes x job sector, crew, job time, timesheet enrichment.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test21-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number, techId = "", laborerId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", leadId = "";

before(async () => {
  const dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T21 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t21.co", hashPassword("password1"), "OWNER");
  techId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(techId, ws, "Tom Tech", "tom@t21.co", hashPassword("password1"), "PM");
  laborerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(laborerId, ws, "Lou Laborer", "lou@t21.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t21.co", password: "password1" } })).cookie;
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Job Owner", phone: "+15165550100", email: "j@t21.co" }, service_requested: "Remediation", est_value: 20000 } }, { Cookie: cookie });
  leadId = lead.j.lead.id;
});

test("rate classes: defaults seed, member assignment sticks", async () => {
  const seeded = await J("/api/labor-classes/seed-defaults", { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(seeded.j.length, 4);
  const tech = seeded.j.find((c: any) => c.name === "Technician");
  assert.equal(tech.private_rate, 38); assert.equal(tech.govt_rate, 68);
  const patch = await J(`/api/team/${techId}`, { method: "PATCH", body: { labor_class_id: tech.id } }, { Cookie: cookie });
  assert.equal(patch.status, 200);
  const users = await J("/api/users", {}, { Cookie: cookie });
  assert.equal(users.j.find((u: any) => u.id === techId).labor_class_id, tech.id);
  const st = await J("/api/setup-status", {}, { Cookie: cookie });
  assert.equal(st.j.has_rates, true); assert.equal(st.j.has_leads, true);
});

test("time on a PRIVATE job costs at the private rate; sector flip applies govt rate to NEW entries only", async () => {
  const t1 = await J(`/api/leads/${leadId}/time`, { method: "POST", body: { user_id: techId, entry_date: new Date().toISOString().slice(0, 10), hours: 8 } }, { Cookie: cookie });
  assert.equal(t1.j.rated, true); assert.equal(t1.j.entry.rate, 38); assert.equal(t1.j.entry.amount, 304);
  await J(`/api/leads/${leadId}`, { method: "PATCH", body: { sector: "government" } }, { Cookie: cookie });
  const t2 = await J(`/api/leads/${leadId}/time`, { method: "POST", body: { user_id: techId, entry_date: new Date().toISOString().slice(0, 10), hours: 8 } }, { Cookie: cookie });
  assert.equal(t2.j.entry.rate, 68); assert.equal(t2.j.entry.amount, 544);
  const lab = await J(`/api/leads/${leadId}/labor`, {}, { Cookie: cookie });
  assert.equal(lab.j.hours, 16); assert.equal(lab.j.cost, 848); // 304 + 544 — history not rewritten
  assert.ok(lab.j.crew.some((c: any) => c.user_id === techId)); // logging time auto-crewed him
});

test("unrated worker logs at $0 and is flagged; crew add/remove works", async () => {
  const t = await J(`/api/leads/${leadId}/time`, { method: "POST", body: { user_id: laborerId, hours: 5 } }, { Cookie: cookie });
  assert.equal(t.j.rated, false); assert.equal(t.j.entry.amount, 0);
  const lab = await J(`/api/leads/${leadId}/labor`, {}, { Cookie: cookie });
  assert.equal(lab.j.unrated_hours, 5);
  const rm = await J(`/api/leads/${leadId}/crew/${laborerId}`, { method: "DELETE" }, { Cookie: cookie });
  assert.ok(!rm.j.crew.some((c: any) => c.user_id === laborerId));
  const add = await J(`/api/leads/${leadId}/crew`, { method: "POST", body: { user_id: laborerId } }, { Cookie: cookie });
  assert.ok(add.j.crew.some((c: any) => c.user_id === laborerId));
});

test("timesheet week view + payroll CSV carry job hours and labor cost", async () => {
  const ts = await J("/api/timesheets", {}, { Cookie: cookie });
  const tom = ts.j.rows.find((r: any) => r.manager_id === techId);
  assert.ok(tom); assert.equal(tom.job_hours, 16); assert.equal(tom.job_cost, 848);
  assert.equal(ts.j.summary.job_cost, 848);
  const csv = await J("/api/timesheets/export", {}, { Cookie: cookie });
  assert.match(csv.txt, /labor_cost/);
  assert.ok(csv.txt.includes("848"));
});

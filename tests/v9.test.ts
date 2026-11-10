// V9 (transformation tranche 3): job lifecycle (§11.2), schedule conflicts (§12.2),
// timesheet review lifecycle (§13.2), paperwork → Work Queue (§14.2).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv9-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", wsId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V9 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Olivia Owner", "o@v9.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Pete PM", "p@v9.co", hashPassword("password1"), "PM");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v9.co", password: "password1" } })).cookie;
});

async function wonJob(name: string, phone: string) {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name, phone, email: "c@x.co" }, service_requested: "Tank job", est_value: 5000 } }, { Cookie: cookie })).j.lead;
  const pb = (await J("/api/price-book", { method: "POST", body: { name: "Svc " + name, standard_price: 5000, floor_price: 4000 } }, { Cookie: cookie })).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.id, qty: 1 }] } }, { Cookie: cookie })).j;
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, { Cookie: cookie });
  const job = dbm.db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead.id) as any;
  return { lead, job };
}

test("job lifecycle: new jobs await scheduling; stages follow §11.2; invoiced syncs invoice_status", async () => {
  const { job } = await wonJob("Life Larry", "+15165550161");
  assert.ok(job, "job created on win");
  assert.equal(job.stage, "AWAITING_SCHEDULING");
  const bad = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "FIELD_DONE" } }, { Cookie: cookie });
  assert.equal(bad.status, 422, "retired stage names are rejected");
  for (const to of ["SCHEDULED", "IN_PROGRESS", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE", "INVOICED"]) {
    const r = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to } }, { Cookie: cookie });
    assert.equal(r.status, 200, `move to ${to}`);
  }
  const after = dbm.db.prepare("SELECT invoice_status FROM jobs WHERE id=?").get(job.id) as any;
  assert.equal(after.invoice_status, "invoiced", "invoice_status synced when the job reached Invoiced");
});

test("schedule conflicts: same worker, same day, different job → warning in the response", async () => {
  const a = await wonJob("Sched A", "+15165550162");
  const b = await wonJob("Sched B", "+15165550163");
  const day = "2026-11-20";
  const first = await J("/api/schedule", { method: "POST", body: { lead_id: a.lead.id, worker_name: "Dan Field", work_date: day } }, { Cookie: cookie });
  assert.equal(first.status, 200);
  assert.deepEqual(first.j.conflicts, []);
  const second = await J("/api/schedule", { method: "POST", body: { lead_id: b.lead.id, worker_name: "Dan Field", work_date: day } }, { Cookie: cookie });
  assert.equal(second.status, 200, "conflict warns, never blocks");
  assert.equal(second.j.conflicts.length, 1);
  assert.equal(second.j.conflicts[0].lead_id, a.lead.id);
});

test("timesheet lifecycle: submitted → reviewed → approved → exported; rejection needs a reason", async () => {
  const pm = dbm.db.prepare("SELECT id FROM users WHERE email='p@v9.co'").get() as any;
  const { uid, now } = dbm;
  const tsId = uid("ts");
  const monday = "2026-11-09";
  dbm.db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status,hours,submitted_at) VALUES (?,?,?,?, 'submitted', 40, ?)").run(tsId, wsId, pm.id, monday, now());
  const badApprove = await J(`/api/timesheets/${tsId}/approve`, { method: "POST", body: {} }, { Cookie: (await J("/api/auth/login", { method: "POST", body: { email: "p@v9.co", password: "password1" } })).cookie });
  assert.equal(badApprove.status, 403, "PM (no can_approve) cannot approve");
  const rev = await J(`/api/timesheets/${tsId}/review`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(rev.status, 200);
  const rejNoReason = await J(`/api/timesheets/${tsId}/reject`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(rejNoReason.status, 422);
  const app1 = await J(`/api/timesheets/${tsId}/approve`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(app1.status, 200);
  const csv = await fetch(`http://localhost:${port}/api/timesheets/export?week=${monday}`, { headers: { Cookie: cookie } });
  const text = await csv.text();
  assert.ok(text.includes("approved") || text.split("\n").length > 1, "approved sheet is in the export");
  const after = dbm.db.prepare("SELECT status FROM timesheets WHERE id=?").get(tsId) as any;
  assert.equal(after.status, "exported", "export marks the sheet exported");
});

test("paperwork: a job in Documentation Pending with missing required docs surfaces in the Work Queue", async () => {
  const { lead, job } = await wonJob("Docs Dana", "+15165550164");
  const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO documents (id,workspace_id,lead_id,job_id,name,required,status) VALUES (?,?,?,?,?,1,'missing')").run(uid("doc"), wsId, lead.id, job.id, "Signed manifest");
  await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "DOCUMENTATION_PENDING" } }, { Cookie: cookie });
  const q = (await J("/api/queue", {}, { Cookie: cookie })).j;
  const item = q.items.find((i: any) => i.type === "paperwork" && i.job_id === job.id);
  assert.ok(item, "paperwork item present in the queue");
  assert.ok(item.subtitle.includes("cannot invoice"), "subtitle explains the consequence");
});

// v78: projects hold work orders. A won lead's project opens with a default
// W01; more work orders carry their own scope, PM, crew, schedule and photos;
// the Projects tab aggregates them; scheduled work orders land on the calendar.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = ""; let wsId = ""; let userId = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v78", "pw", "7811"].join("-");
let jobId = ""; let projectNo = ""; let wo2 = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v78-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Wanda Orders", email: "owner78@demo.test", password: PW, business_name: "V78 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner78@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; wsId = me.workspace_id; userId = me.id;
  // lead -> proposal -> signed -> won (same gates as v77)
  const lr = await call("POST", "/api/leads", { contact: { name: "Carl Client", email: "carl@v78.test", phone: "55501000007" }, service_requested: "Asbestos abatement", est_value: 12000 });
  const leadId = lr.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const dr = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  const propId = dr.body.proposal.id;
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  const wr = await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  assert.equal(wr.status, 200, JSON.stringify(wr.body));
  const jobs = (await call("GET", "/api/jobs")).body;
  const job = (Array.isArray(jobs) ? jobs : jobs.jobs || []).find((j: any) => j.lead_id === leadId);
  jobId = job.id; projectNo = job.project_no;
  assert.ok(projectNo, "project numbered");
});

test("the project opens with a default W01 carrying the full scope", async () => {
  const r = await call("GET", `/api/jobs/${jobId}/work-orders`);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].display_no, `${projectNo}-W01`);
  assert.match(r.body[0].title, /full scope/i);
});

test("a second work order gets W02, its own PM, crew, schedule — and lands on the calendar", async () => {
  const T = new Date().toISOString();
  dbm.db.prepare("INSERT INTO workers (id,workspace_id,name,active,created_at) VALUES (?,?,?,?,?)").run("wrk_v78", wsId, "Field Freddie", 1, T);
  const start = new Date(Date.now() + 2 * 86400000); start.setHours(9, 0, 0, 0);
  const r = await call("POST", `/api/jobs/${jobId}/work-orders`, { title: "Phase 2: removal & disposal", description: "ACM removal after containment is verified.", pm_id: userId, scheduled_start: start.toISOString(), location: "Basement mech room", crew: [{ worker_id: "wrk_v78" }, { user_id: userId }] });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 240));
  wo2 = r.body.id;
  assert.equal(r.body.display_no, `${projectNo}-W02`);
  assert.equal(r.body.crew.length, 2);
  assert.equal(r.body.pm_name, "Wanda Orders");
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const to = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const cal = await call("GET", `/api/calendar?from=${from}&to=${to}`);
  const ev = (cal.body || []).find((e: any) => e.kind === "work_order" && e.ref_id === wo2);
  assert.ok(ev, "work order on the calendar");
  assert.equal(ev.job_id, jobId);
});

test("status flow, photos, and the Projects tab aggregate", async () => {
  let r = await call("PATCH", `/api/work-orders/${wo2}`, { status: "in_progress" });
  assert.equal(r.body.status, "in_progress"); assert.equal(r.body.completed_at, null);
  r = await call("PATCH", `/api/work-orders/${wo2}`, { status: "completed" });
  assert.equal(r.body.status, "completed"); assert.ok(r.body.completed_at, "completion stamped");
  const tiny = Buffer.from("hello-photo").toString("base64");
  r = await call("POST", "/api/attachments", { entity_type: "work_order", entity_id: wo2, name: "containment.jpg", mime: "image/jpeg", data_base64: tiny });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 200));
  const d = await call("GET", `/api/work-orders/${wo2}`);
  assert.equal(d.body.photo_count, 1); assert.equal(d.body.files.length, 1);
  const projects = await call("GET", "/api/projects");
  const row = (projects.body || []).find((x: any) => x.id === jobId);
  assert.ok(row, "project listed");
  assert.equal(row.project_no, projectNo);
  assert.equal(row.wo_total, 2); assert.equal(row.wo_open, 1); // W02 completed, W01 still open
  assert.ok(row.lead_no, "chain: the project row carries its lead number");
});

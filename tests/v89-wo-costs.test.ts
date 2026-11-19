// v89 — Work Orders v2: templates create a dependent chain with est. hours;
// time entries cost against labor-class rates (timer included); materials add
// to WO cost; the checklist joins the completion gate; project progress rolls up.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let myId = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v89", "pw", "8901"].join("-");
let jobId = ""; let classId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v89-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Walt Works", email: "walt@v89.test", password: PW, business_name: "V89 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); myId = reg.body.user.id;
  await call("POST", "/api/auth/login", { email: "walt@v89.test", password: PW });
  const cls = await call("POST", "/api/labor-classes", { name: "Licensed supervisor", private_rate: 50, govt_rate: 65 });
  classId = cls.body.id; assert.ok(classId, JSON.stringify(cls.body));
  const lead = await call("POST", "/api/leads", { contact: { name: "Cost Client", email: "cost@v89.test", phone: "55501000089" }, service_requested: "Tank removal", est_value: 20000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const d = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  const propId = d.body.proposal.id;
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs"); jobId = jobs.body[0].id;
});

test("applying the standard template creates a dependent chain with estimated hours", async () => {
  const tpls = await call("GET", "/api/wo-templates");
  assert.ok(tpls.body.length >= 1 && tpls.body[0].items.length === 3, "seed template with 3 items");
  const applied = await call("POST", `/api/jobs/${jobId}/work-orders/from-template`, { template_id: tpls.body[0].id });
  assert.equal(applied.status, 201, JSON.stringify(applied.body));
  assert.equal(applied.body.created.length, 3);
  const [a, b, c] = applied.body.created;
  assert.equal(a.est_hours, 4); assert.equal(b.est_hours, 24);
  assert.equal(b.depends_on?.id, a.id, "second depends on first");
  assert.equal(c.depends_on?.id, b.id, "third depends on second");
});

test("a dependent work order cannot start until its predecessor completes (unless forced)", async () => {
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`);
  const main = wos.body.find((w: any) => w.title === "Main work execution");
  const blocked = await call("PATCH", `/api/work-orders/${main.id}`, { status: "in_progress" });
  assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error.code, "blocked_by");
  const forced = await call("PATCH", `/api/work-orders/${main.id}`, { status: "in_progress", force: true });
  assert.equal(forced.status, 200, JSON.stringify(forced.body));
});

test("time (manual + timer) and materials roll into work-order cost", async () => {
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`);
  const main = wos.body.find((w: any) => w.title === "Main work execution");
  const t1 = await call("POST", `/api/work-orders/${main.id}/time`, { user_id: myId, hours: 4, work_date: "2026-11-18", labor_class_id: classId, note: "Excavation" });
  assert.equal(t1.status, 201, JSON.stringify(t1.body));
  assert.equal(t1.body.rate, 50, "private rate snapshot");
  const timer = await call("POST", `/api/work-orders/${main.id}/time/start`, { user_id: myId, labor_class_id: classId });
  assert.equal(timer.status, 201, JSON.stringify(timer.body));
  const dup = await call("POST", `/api/work-orders/${main.id}/time/start`, { user_id: myId });
  assert.equal(dup.status, 422, "second timer refused");
  const stopped = await call("POST", `/api/time-entries/${timer.body.id}/stop`, {});
  assert.equal(stopped.status, 200, JSON.stringify(stopped.body));
  assert.ok(stopped.body.hours >= 0.01, "timer produced hours");
  const m1 = await call("POST", `/api/work-orders/${main.id}/materials`, { description: "6-mil poly sheeting", qty: 2, unit_cost: 150, supplier: "Safety Supply Co" });
  assert.equal(m1.status, 201, JSON.stringify(m1.body));
  const detail = await call("GET", `/api/work-orders/${main.id}`);
  assert.ok(detail.body.time.actual_hours >= 4, "hours: " + detail.body.time.actual_hours);
  assert.ok(detail.body.time.labor_cost >= 200, "labor cost: " + detail.body.time.labor_cost);
  assert.equal(detail.body.materials.cost, 300);
  assert.ok(detail.body.cost_total >= 500, "total: " + detail.body.cost_total);
  assert.equal(detail.body.materials_list.length, 1);
  assert.equal(detail.body.time_entries.length, 2);
});

test("the checklist joins the completion gate; project progress is the est-hour-weighted average", async () => {
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`);
  const assess = wos.body.find((w: any) => w.title === "Assessment & documentation");
  const item = await call("POST", `/api/work-orders/${assess.id}/checklist`, { label: "Waste manifest signed" });
  assert.equal(item.status, 201, JSON.stringify(item.body));
  const gate = await call("PATCH", `/api/work-orders/${assess.id}`, { status: "completed" });
  assert.equal(gate.status, 422, JSON.stringify(gate.body));
  assert.equal(gate.body.error.code, "checklist_open");
  await call("PATCH", `/api/wo-checklist/${item.body.id}`, { done: true });
  await call("PATCH", `/api/work-orders/${assess.id}`, { percent_complete: 100 });
  const done = await call("PATCH", `/api/work-orders/${assess.id}`, { status: "completed" });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  const main = wos.body.find((w: any) => w.title === "Main work execution");
  await call("PATCH", `/api/work-orders/${main.id}`, { percent_complete: 50 });
  const projects = await call("GET", "/api/projects");
  const row = projects.body.find((p: any) => p.id === jobId);
  // weights: W01 default (no est, weight 1, 0%), assessment 4h @100, main 24h @50, clearance 6h @0
  // (100*4 + 50*24 + 0*6 + 0*1) / 35 = 45.7 -> 46
  assert.equal(row.wo_progress, 46, "weighted progress: " + row.wo_progress);
});

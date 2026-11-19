// v95 — Inspections T2: the 12-template standards library, the reviewer
// permission + separation-of-duties, corrective actions that gate work-order
// completion, queue items for reviews, and submit notifications.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let wsId = "";
async function callAs(cookie: string, method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t, cookie: (r.headers.get("set-cookie") || "").split(";")[0] || cookie };
}
let owner = ""; let pm = ""; let ops = "";
const PW = ["v95", "pw", "9501"].join("-");
let jobId = ""; let woId = ""; let inspId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v95-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(12000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await callAs("", "POST", "/api/auth/register", { name: "Ivy Inspector", email: "ivy@v95.test", password: PW, business_name: "V95 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); owner = reg.cookie; wsId = reg.body.user.workspace_id;
  const mk = (id: string, name: string, email: string, role: string) => dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active,created_at) VALUES (?,?,?,?,?,?,1,?)").run(id, wsId, name, email, dbm.hashPassword(PW), role, new Date().toISOString());
  mk("usr_v95pm", "Pete PM", "pete@v95.test", "PM"); mk("usr_v95ops", "Omar Ops", "omar@v95.test", "OPS_ADMIN");
  pm = (await callAs("", "POST", "/api/auth/login", { email: "pete@v95.test", password: PW })).cookie;
  ops = (await callAs("", "POST", "/api/auth/login", { email: "omar@v95.test", password: PW })).cookie;
  const pb = await callAs(owner, "POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 20000, cost: 9000 });
  const lead = await callAs(owner, "POST", "/api/leads", { contact: { name: "T2 Client", email: "t2@v95.test", phone: "55501000095" }, service_requested: "Abatement", est_value: 20000 });
  const leadId = lead.body.lead.id;
  dbm.db.prepare("UPDATE leads SET pm_id='usr_v95pm' WHERE id=?").run(leadId);
  await callAs(owner, "POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await callAs(owner, "POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 1 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  await callAs(owner, "POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await callAs(owner, "POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await callAs(owner, "POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await callAs(owner, "POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await callAs(owner, "GET", "/api/jobs"); jobId = jobs.body[0].id;
  const wos = await callAs(owner, "GET", `/api/jobs/${jobId}/work-orders`); woId = wos.body[0].id;
  const insp = await callAs(owner, "POST", `/api/work-orders/${woId}/inspections`, { title: "Clearance check" });
  inspId = insp.body.id || insp.body.inspection?.id;
  assert.ok(inspId, JSON.stringify(insp.body).slice(0, 160));
});

test("the standards library seeds 12 regulatory templates beside the general one", async () => {
  const t = await callAs(owner, "GET", "/api/inspection-templates");
  assert.ok(t.body.length >= 13, `expected >=13 templates, got ${t.body.length}`);
  const names = t.body.map((x: any) => x.name);
  for (const n of ["AHERA visual assessment", "NESHAP pre-demolition / renovation survey", "Air clearance (PCM / TEM)", "Jobsite safety inspection"]) assert.ok(names.includes(n), n);
  const air = t.body.find((x: any) => x.name === "Air clearance (PCM / TEM)");
  assert.match(air.standard_ref, /763\.90/);
  const secs = typeof air.sections === "string" ? JSON.parse(air.sections) : air.sections;
  const pcm = secs.flatMap((s: any) => s.items).find((i: any) => i.key === "pcm_result");
  assert.equal(pcm.max, 0.01); assert.equal(pcm.unit, "f/cc");
});

test("submit queues a review item and notifies reviewers — but a PM cannot decide", async () => {
  await callAs(owner, "POST", `/api/inspections/${inspId}/start`, {});
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  await callAs(owner, "POST", "/api/attachments", { entity_type: "inspection", entity_id: inspId, name: "completion.png", mime: "image/png", data_base64: PNG, item_key: "completion_photos" });
  const sub = await callAs(owner, "POST", `/api/inspections/${inspId}/submit`, {});
  assert.equal(sub.status, 200, JSON.stringify(sub.body).slice(0, 160));
  const q = await callAs(owner, "GET", "/api/queue");
  assert.ok((q.body.items || []).some((i: any) => i.type === "inspection_review" && i.inspection_id === inspId), "queue carries the review item");
  const notif = dbm.db.prepare("SELECT * FROM notifications WHERE user_id='usr_v95ops' AND type='inspection_review'").all() as any[];
  assert.equal(notif.length, 1, "the OPS_ADMIN reviewer was notified");
  const denied = await callAs(pm, "POST", `/api/inspections/${inspId}/decide`, { result: "passed" });
  assert.equal(denied.status, 403, JSON.stringify(denied.body).slice(0, 160));
  assert.equal(denied.body.error.code, "cannot_review");
});

test("separation of duties blocks the inspector from reviewing their own inspection", async () => {
  await callAs(owner, "PATCH", "/api/settings", { insp_sod: 1 });
  const me = await callAs(owner, "GET", "/api/auth/me");
  await callAs(owner, "PATCH", `/api/inspections/${inspId}`, { inspector_id: me.body.user.id });
  const blocked = await callAs(owner, "POST", `/api/inspections/${inspId}/decide`, { result: "passed" });
  assert.equal(blocked.status, 422, JSON.stringify(blocked.body).slice(0, 160));
  assert.equal(blocked.body.error.code, "reviewer_is_inspector");
  const ok = await callAs(ops, "POST", `/api/inspections/${inspId}/decide`, { result: "passed_with_conditions", note: "One finding to correct" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 160));
});

test("an open corrective action gates work-order completion until it is done", async () => {
  const act1 = await callAs(owner, "POST", `/api/inspections/${inspId}/actions`, { label: "Re-clean the containment floor", item_key: "no_debris" });
  assert.equal(act1.status, 201, JSON.stringify(act1.body).slice(0, 160));
  const blocked = await callAs(owner, "PATCH", `/api/work-orders/${woId}`, { status: "completed" });
  assert.equal(blocked.status, 422, JSON.stringify(blocked.body).slice(0, 200));
  assert.equal(blocked.body.error.code, "inspections_open");
  assert.equal(blocked.body.error.actions_open, 1);
  const done = await callAs(owner, "PATCH", `/api/inspection-actions/${act1.body.id}`, { status: "done" });
  assert.equal(done.body.status, "done");
  const ok = await callAs(owner, "PATCH", `/api/work-orders/${woId}`, { status: "completed" });
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 160));
});

// v88 — Inspections T1: chain numbering, checklist engine (photo-required gate,
// readings), lifecycle submit/decide, template snapshot discipline, the
// work-order completion gate + owner override, re-inspection, calendar kind.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v88", "pw", "8801"].join("-");
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let jobId = ""; let woId = ""; let inspId = ""; let wo2Id = ""; let insp2Id = "";

async function answerAll(insp: string, failKey?: string) {
  const d = await call("GET", `/api/inspections/${insp}`);
  const answers: any = {};
  for (const s of d.body.sections) for (const it of s.items) {
    answers[it.key] = { v: it.type === "passfail" ? (it.key === failKey ? "fail" : "pass") : it.type === "yesno" ? "yes" : it.type === "reading" ? "5" : "recorded" };
  }
  const r = await call("PATCH", `/api/inspections/${insp}`, { answers });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return d.body.sections;
}
async function photoFor(insp: string, key: string) {
  const r = await call("POST", "/api/attachments", { entity_type: "inspection", entity_id: insp, name: key + ".png", mime: "image/png", data_base64: PNG, item_key: key });
  assert.equal(r.status, 201, JSON.stringify(r.body));
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v88-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Ivy Inspector", email: "ivy@v88.test", password: PW, business_name: "V88 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "ivy@v88.test", password: PW });
  const lead = await call("POST", "/api/leads", { contact: { name: "Insp Client", email: "insp@v88.test", phone: "55501000088" }, service_requested: "Mold remediation", est_value: 8000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const d = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  const propId = d.body.proposal.id;
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  const won = await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  assert.equal(won.status, 200, JSON.stringify(won.body));
  const jobs = await call("GET", "/api/jobs"); jobId = jobs.body[0].id;
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`); woId = wos.body[0].id;
  const wo2 = await call("POST", `/api/jobs/${jobId}/work-orders`, { title: "Phase 2 — clearance" });
  wo2Id = wo2.body.id;
});

test("inspection is created on the work order, numbered into the chain, and blocks WO completion while open", async () => {
  const tpls = await call("GET", "/api/inspection-templates");
  assert.ok(Array.isArray(tpls.body) && tpls.body.length >= 1, "generic template seeded");
  const created = await call("POST", `/api/work-orders/${woId}/inspections`, { title: "Containment verification" });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  inspId = created.body.id;
  assert.match(created.body.display_no, /-W01-I01$/, created.body.display_no);
  assert.equal(created.body.status, "scheduled");
  const gate = await call("PATCH", `/api/work-orders/${woId}`, { status: "completed" });
  assert.equal(gate.status, 422, JSON.stringify(gate.body));
  assert.equal(gate.body.error.code, "inspections_open");
  assert.equal(gate.body.error.open, 1);
});

test("photo-required item blocks submit until the photo exists; then submit + decide pass; WO completes", async () => {
  await call("POST", `/api/inspections/${inspId}/start`, {});
  await answerAll(inspId);
  const blocked = await call("POST", `/api/inspections/${inspId}/submit`, {});
  assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error.code, "photo_required");
  await photoFor(inspId, "completion_photos");
  const sub = await call("POST", `/api/inspections/${inspId}/submit`, {});
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  assert.equal(sub.body.status, "submitted");
  const dec = await call("POST", `/api/inspections/${inspId}/decide`, { result: "passed", note: "All good" });
  assert.equal(dec.status, 200, JSON.stringify(dec.body));
  assert.equal(dec.body.result, "passed");
  const detail = await call("GET", `/api/inspections/${inspId}`);
  assert.equal(detail.body.inspection.progress.pct, 100);
  assert.ok(detail.body.sections.length >= 3, "snapshot sections present");
  const kinds = detail.body.events.map((e: any) => e.kind);
  for (const k of ["created", "started", "submitted", "decided"]) assert.ok(kinds.includes(k), "event " + k);
  assert.ok(detail.body.photos.length >= 1, "photo attached");
  const done = await call("PATCH", `/api/work-orders/${woId}`, { status: "completed" });
  assert.equal(done.status, 200, JSON.stringify(done.body));
});

test("a failed inspection blocks completion until an owner overrides with a reason; re-inspection is linked", async () => {
  const created = await call("POST", `/api/work-orders/${wo2Id}/inspections`, { title: "Final clearance" });
  insp2Id = created.body.id;
  await call("POST", `/api/inspections/${insp2Id}/start`, {});
  await answerAll(insp2Id, "area_secured");
  await photoFor(insp2Id, "completion_photos");
  await call("POST", `/api/inspections/${insp2Id}/submit`, {});
  const dec = await call("POST", `/api/inspections/${insp2Id}/decide`, { result: "failed", note: "Containment breach" });
  assert.equal(dec.body.result, "failed");
  const gate = await call("PATCH", `/api/work-orders/${wo2Id}`, { status: "completed" });
  assert.equal(gate.status, 422); assert.equal(gate.body.error.failed, 1);
  const noReason = await call("PATCH", `/api/work-orders/${wo2Id}`, { status: "completed", override_reason: "" });
  assert.equal(noReason.status, 422, "override needs a reason");
  const over = await call("PATCH", `/api/work-orders/${wo2Id}`, { status: "completed", override_reason: "Client accepted risk in writing" });
  assert.equal(over.status, 200, JSON.stringify(over.body));
  const re = await call("POST", `/api/inspections/${insp2Id}/reinspect`, {});
  assert.equal(re.status, 201, JSON.stringify(re.body));
  assert.match(re.body.display_no, /-W02-I02$/);
  const row = dbm.db.prepare("SELECT reinspection_of FROM inspections WHERE id=?").get(re.body.id) as any;
  assert.equal(row.reinspection_of, insp2Id);
});

test("template edits never rewrite an issued inspection; scheduled inspections appear on the calendar", async () => {
  const tpls = await call("GET", "/api/inspection-templates");
  const tpl = tpls.body[0];
  const before_ = await call("GET", `/api/inspections/${inspId}`);
  const itemCount = before_.body.sections.reduce((n: number, s: any) => n + s.items.length, 0);
  const patched = await call("PATCH", `/api/inspection-templates/${tpl.id}`, { name: "Renamed template", sections: [{ title: "Only section", items: [{ key: "x1", label: "X", type: "passfail" }] }] });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  const after = await call("GET", `/api/inspections/${inspId}`);
  assert.equal(after.body.sections.reduce((n: number, s: any) => n + s.items.length, 0), itemCount, "snapshot frozen");
  // calendar: schedule the re-inspection for tomorrow and look for kind=inspection
  const list = await call("GET", `/api/work-orders/${wo2Id}/inspections`);
  const re = list.body.find((i: any) => i.display_no.endsWith("-I02"));
  const tomorrow = new Date(Date.now() + 86400000);
  await call("PATCH", `/api/inspections/${re.id}`, { scheduled_start: tomorrow.toISOString() });
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const to = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const cal = await call("GET", `/api/calendar?from=${from}&to=${to}`);
  const evs = (cal.body.events || cal.body || []).filter((e: any) => e.kind === "inspection");
  assert.ok(evs.length >= 1, "inspection on calendar: " + JSON.stringify(cal.body).slice(0, 200));
});

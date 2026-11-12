// V53 — site visits are ONE record seen by every surface. The bug: the crew
// schedule grid never showed visits at all (its ✕ deleted unrelated crew
// rows), the Ops Console listed cancelled visits as if live, and the
// calendar agenda kept cancelled visits forever. These tests pin the sync:
// create → grid + Ops + agenda + job all show it; cancel (from any surface)
// → it disappears from every operational surface at once.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v53-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v53", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = "";
// a fixed upcoming Monday so the week math is deterministic
const visitDay = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
const mondayOf = (iso: string) => { const d = new Date(iso + "T12:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10); };
let leadId = ""; let jobId = ""; let visitId = "";
before(async () => {
  const reg = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v53.test", password: PW, business_name: "V53 Sync Co" });
  assert.equal(reg.s, 201, JSON.stringify(reg.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v53.test", password: PW });
  owner = l.cookie!; const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
  const lead = await call("POST", "/api/leads", { contact: { name: "Sync Sue", email: "sue@v53.test", phone: "6315559090" }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 2000 }, owner);
  leadId = lead.j.lead.id;
  const v = await call("POST", `/api/leads/${leadId}/visits`, { scheduled_at: visitDay + "T10:00:00.000Z", notes: "Sync check" }, owner);
  assert.equal(v.s, 201, JSON.stringify(v.j)); visitId = v.j.id;
});

test("the crew schedule grid shows the visit for its week", async () => {
  const wk = mondayOf(visitDay);
  const sched = await call("GET", `/api/schedule?week=${wk}`, undefined, owner);
  const visits = sched.j.visits || [];
  assert.ok(visits.some((x: any) => x.id === visitId), "the booked visit appears in the crew schedule data — before v53 the grid never carried visits at all");
});

test("ops console, calendar agenda, and the job all show the same live visit", async () => {
  const ops = await call("GET", "/api/ops", undefined, owner);
  assert.ok(ops.j.site_visits.some((x: any) => x.id === visitId), "ops lists the visit");
  const from = visitDay, to = visitDay;
  const cal = await call("GET", `/api/calendar?from=${from}&to=${to}`, undefined, owner);
  assert.ok(cal.j.some((e: any) => e.kind === "visit" && e.ref_id === visitId), "agenda carries the visit");
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON", confirm_no_proposal: true }, owner);
  const job = dbm.db.prepare("SELECT id FROM jobs WHERE lead_id=?").get(leadId) as any; jobId = job.id;
  const jd = await call("GET", `/api/jobs/${jobId}`, undefined, owner);
  assert.ok((jd.j.site_visits || []).some((x: any) => x.id === visitId), "job detail carries the visit");
});

test("cancelling the visit clears it from EVERY operational surface at once", async () => {
  const c = await call("PATCH", `/api/site-visits/${visitId}`, { status: "cancelled" }, owner);
  assert.equal(c.s, 200, JSON.stringify(c.j));
  const wk = mondayOf(visitDay);
  const sched = await call("GET", `/api/schedule?week=${wk}`, undefined, owner);
  assert.ok(!(sched.j.visits || []).some((x: any) => x.id === visitId), "gone from the crew schedule");
  const ops = await call("GET", "/api/ops", undefined, owner);
  assert.ok(!ops.j.site_visits.some((x: any) => x.id === visitId), "gone from the Ops Console site-visits list");
  const cal = await call("GET", `/api/calendar?from=${visitDay}&to=${visitDay}`, undefined, owner);
  assert.ok(!cal.j.some((e: any) => e.kind === "visit" && e.ref_id === visitId), "gone from the calendar agenda");
  const jd = await call("GET", `/api/jobs/${jobId}`, undefined, owner);
  assert.ok(!(jd.j.site_visits || []).some((x: any) => x.id === visitId), "gone from the job — the record survives only as history on the lead timeline");
  const row = dbm.db.prepare("SELECT status FROM site_visits WHERE id=?").get(visitId) as any;
  assert.equal(row.status, "cancelled", "the record itself is kept, marked cancelled — not deleted");
});

test("a completed visit stays visible where done work belongs and clears the job's visit gate", async () => {
  const v = await call("POST", `/api/leads/${leadId}/visits`, { scheduled_at: visitDay + "T14:00:00.000Z" }, owner);
  const vid = v.j.id;
  await call("PATCH", `/api/site-visits/${vid}`, { status: "completed" }, owner);
  const jd = await call("GET", `/api/jobs/${jobId}`, undefined, owner);
  assert.ok((jd.j.site_visits || []).some((x: any) => x.id === vid && x.status === "completed"), "the job shows the completed visit");
  const ops = await call("GET", "/api/ops", undefined, owner);
  assert.ok(!ops.j.site_visits.some((x: any) => x.id === vid), "ops lists only upcoming scheduled visits — completed work is not 'to do'");
});

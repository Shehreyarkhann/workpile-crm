// V28: site-visit workflow — job flag, visit appears in BOTH site visits and
// the crew schedule, status lifecycle, job detail payload carries visits.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V28 Co", email: "o@v28.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v28.test", password: "password123" } })).ck; assert.ok(O);
const me = (await J("/api/auth/me", {}, O)).j.user;
const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Visit Client", email: "vc@v28.test" }, service_requested: "Phase II ESA", est_value: 9000 } }, O);
const LID = lead.j.lead.id;
const job = await J("/api/jobs", { method: "POST", body: { lead_id: LID } }, O);
const JID = job.j.id; assert.ok(JID, JSON.stringify(job.j).slice(0, 120));

test("job flag: requires_site_visit round-trips through PATCH + job detail", async () => {
  const p = await J(`/api/jobs/${JID}`, { method: "PATCH", body: { requires_site_visit: 1 } }, O);
  assert.equal(p.s, 200); assert.equal(p.j.requires_site_visit, 1);
  const d = await J(`/api/jobs/${JID}`, {}, O);
  assert.equal(d.j.job.requires_site_visit, 1); assert.deepEqual(d.j.site_visits, []);
});

test("booking a visit from the job lands in site_visits AND the crew schedule", async () => {
  const v = await J(`/api/leads/${LID}/visits`, { method: "POST", body: { scheduled_at: "2026-11-14T09:00:00", assigned_to: me.id, notes: "Gate code 4417" } }, O);
  assert.equal(v.s, 201, JSON.stringify(v.j));
  const d = await J(`/api/jobs/${JID}`, {}, O);
  assert.equal(d.j.site_visits.length, 1); assert.equal(d.j.site_visits[0].status, "scheduled"); assert.equal(d.j.site_visits[0].assignee_name, "Olive Owner");
  const mirror = (d.j.schedule || []).find((s: any) => String(s.note || "").includes("Site visit"));
  assert.ok(mirror, "visit mirrored onto the crew schedule"); assert.equal(mirror.work_date, "2026-11-14");
  const done = await J(`/api/site-visits/${v.j.id}`, { method: "PATCH", body: { status: "completed" } }, O);
  assert.equal(done.s, 200); assert.equal(done.j.status, "completed");
  const bad = await J(`/api/site-visits/${v.j.id}`, { method: "PATCH", body: { status: "bogus" } }, O); assert.equal(bad.s, 422);
});

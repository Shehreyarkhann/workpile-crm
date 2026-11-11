// V37: job actions must visibly DO something — the packet failure explains
// itself in plain language, and its success is stamped on the job.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Packet Co", email: "own@v37.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v37.test", password: "password123" } })).ck;

test("packet: no email on file = a plain-language explanation, not a dead click", async () => {
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "No Email Co", phone: "+15165550155" }, service_requested: "Tank Testing", est_value: 700, source: "t" } }, ck);
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, ck);
  const r = await J(`/api/jobs/${job.j.id}/packet`, { method: "POST", body: {} }, ck);
  assert.equal(r.s, 422);
  assert.match(r.j.error.message, /no email address on file/i);
});

test("packet: success delivers (test mode) and stamps packet_sent_at on the job", async () => {
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Mail Co", email: "ops@mail.example", phone: "+15165550156" }, service_requested: "Tank Testing", est_value: 700, source: "t" } }, ck);
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, ck);
  const r = await J(`/api/jobs/${job.j.id}/packet`, { method: "POST", body: {} }, ck);
  assert.equal(r.s, 201, JSON.stringify(r.j).slice(0, 120));
  assert.equal(r.j.status, "test_mode");
  const row = dbm.db.prepare("SELECT packet_sent_at FROM jobs WHERE id=?").get(job.j.id) as any;
  assert.ok(row.packet_sent_at, "the send is stamped on the job so the button can show it");
  const out = dbm.db.prepare("SELECT subject FROM messages_outbox WHERE lead_id=? ORDER BY created_at DESC").get(lead.j.lead.id) as any;
  assert.ok(out && /job with/i.test(out.subject), "the packet email exists in the outbox");
});

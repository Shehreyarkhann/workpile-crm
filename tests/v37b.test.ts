// V37.1: the Ops Console truth pass. (1) Logging hours for a roster worker
// files them under the WORKER (the client never sent worker_id, so the
// hours landed on whoever was logged in and the row stayed "missing").
// (2) Chase reports what actually happened — emailed / test-mode recorded /
// recorded with no contact — instead of always claiming "sent".
// (3) The job packet can be previewed and DOWNLOADED (zip: summary +
// proposal + invoice DOCX) so it can be sent manually from any mailbox.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Ops Co", email: "own@v37b.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v37b.test", password: "password123" } })).ck;
const wsId = (await J("/api/auth/me", {}, ck)).j.user.workspace_id;
const worker = await J("/api/workers", { method: "POST", body: { name: "Roster Ray" } }, ck);
dbm.db.prepare("INSERT INTO users (id, workspace_id, name, email, password_hash, role, active) VALUES ('usr_pm1', ?, 'Pat PM', 'pat@ops.example', 'x', 'PM', 1)").run(wsId);
const sheets = await J("/api/timesheets", {}, ck);
const wRow = sheets.j.rows.find((r: any) => r.worker_row === (worker.j.id || worker.j.worker?.id));
const pmRow = sheets.j.rows.find((r: any) => r.manager_id === "usr_pm1");

test("logging a roster worker's hours files them under the worker — the row clears", async () => {
  assert.ok(wRow, "a sheet exists for the roster worker");
  const wid = wRow.worker_row;
  const saved = await J("/api/timesheets", { method: "POST", body: { worker_id: wid, week_of: sheets.j.week_of, days: { mon: 8, tue: 6 } } }, ck);
  assert.equal(saved.j.status, "submitted"); assert.equal(Number(saved.j.hours), 14);
  const again = await J("/api/timesheets", {}, ck);
  const row = again.j.rows.find((r: any) => r.worker_row === wid);
  assert.equal(row.status, "submitted", "the worker's own row is the one that cleared");
});

test("chase tells the truth: roster worker = recorded (no contact), PM = test-mode email", async () => {
  const w2 = await J("/api/workers", { method: "POST", body: { name: "Roster NoMail" } }, ck);
  const sh = await J("/api/timesheets", {}, ck);
  const wr = sh.j.rows.find((r: any) => r.worker_row === (w2.j.id || w2.j.worker?.id) && r.status === "missing");
  const c1 = await J(`/api/timesheets/${wr.id}/chase`, { method: "POST", body: {} }, ck);
  assert.equal(c1.j.delivery, "recorded"); assert.match(c1.j.message, /no email on file/i);
  assert.ok(pmRow, "a sheet exists for the PM");
  const c2 = await J(`/api/timesheets/${pmRow.id}/chase`, { method: "POST", body: {} }, ck);
  assert.equal(c2.j.delivery, "test_mode"); assert.match(c2.j.message, /test mode/i);
  const out = dbm.db.prepare("SELECT subject FROM messages_outbox WHERE to_addr='pat@ops.example' ORDER BY created_at DESC").get() as any;
  assert.ok(out && /Timesheet missing/.test(out.subject), "the PM chase really entered the send path");
});

test("packet: preview shows the contents, download is a real zip, no-email explains itself", async () => {
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Zip Co", email: "ops@zip.example", phone: "+15165550166" }, service_requested: "Tank Testing", est_value: 900, source: "t" } }, ck);
  const pb = await J("/api/price-book", {}, ck);
  await J(`/api/leads/${lead.j.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j[0].id, qty: 1 }] } }, ck);
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, ck);
  const pv = await J(`/api/jobs/${job.j.id}/packet/preview`, { method: "POST", body: {} }, ck);
  assert.equal(pv.s, 200, JSON.stringify(pv.j).slice(0, 120));
  assert.equal(pv.j.to, "ops@zip.example"); assert.equal(pv.j.email_test_mode, true);
  assert.ok(pv.j.includes.some((i: any) => i.kind === "proposal"), "the proposal rides along");
  const dl = await fetch(B + `/api/jobs/${job.j.id}/packet/download`, { headers: { Cookie: ck } });
  assert.equal(dl.status, 200); assert.match(dl.headers.get("content-type") || "", /zip/);
  const buf = Buffer.from(await dl.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  assert.ok(buf.includes(Buffer.from("job-packet.txt")), "summary inside the zip");
  assert.ok(buf.includes(Buffer.from("PROP-")), "proposal DOCX inside the zip");
  const row = dbm.db.prepare("SELECT packet_sent_at FROM jobs WHERE id=?").get(job.j.id) as any;
  assert.ok(row.packet_sent_at, "preparing the packet is stamped on the job");
  const lead2 = await J("/api/leads", { method: "POST", body: { contact: { name: "No Mail Co", phone: "+15165550167" }, service_requested: "Tank Testing", est_value: 100, source: "t" } }, ck);
  const job2 = await J("/api/jobs", { method: "POST", body: { lead_id: lead2.j.lead.id } }, ck);
  const pv2 = await J(`/api/jobs/${job2.j.id}/packet/preview`, { method: "POST", body: {} }, ck);
  assert.equal(pv2.s, 422); assert.match(pv2.j.error.message, /no email address on file/i);
});

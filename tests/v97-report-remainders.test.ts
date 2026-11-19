// v97 — Report remainders: DOCX download, send-to-client through the comms
// path, the job packet carrying generated reports, the closed-without-report
// queue nudge, and storage usage in Settings counts.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const buf = Buffer.from(await r.arrayBuffer());
  let j: any = null; try { j = JSON.parse(buf.toString("utf8")); } catch { /* binary */ }
  return { status: r.status, body: j, buf };
}
const PW = ["v97", "pw", "9701"].join("-");
let jobId = ""; let inspId = ""; let reportId = ""; let reportNumber = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v97-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  process.env.WORKPILE_CHROMIUM = "/home/hatch/workspace/browsers/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Rae Reports", email: "rae@v97.test", password: PW, business_name: "V97 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "rae@v97.test", password: PW });
  const pb = await call("POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 20000, cost: 9000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Remainder Client", email: "rc@v97.test", phone: "55501000097" }, service_requested: "Abatement", est_value: 20000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 1 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs"); jobId = jobs.body[0].id;
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`);
  const insp = await call("POST", `/api/work-orders/${wos.body[0].id}/inspections`, { title: "Final clearance" });
  inspId = insp.body.id;
  await call("POST", `/api/inspections/${inspId}/start`, {});
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  await call("POST", "/api/attachments", { entity_type: "inspection", entity_id: inspId, name: "done.png", mime: "image/png", data_base64: PNG, item_key: "completion_photos" });
  await call("POST", `/api/inspections/${inspId}/submit`, {});
  const dec = await call("POST", `/api/inspections/${inspId}/decide`, { result: "passed" });
  assert.equal(dec.status, 200, JSON.stringify(dec.body).slice(0, 140));
});

test("the queue nudges for a report until one is generated", async () => {
  const q1 = await call("GET", "/api/queue");
  assert.ok((q1.body.items || []).some((i: any) => i.type === "inspection_no_report" && i.inspection_id === inspId), "nudge present before generation");
  const gen = await call("POST", `/api/inspections/${inspId}/reports`, {});
  assert.equal(gen.status, 201, JSON.stringify(gen.body).slice(0, 160));
  reportId = gen.body.id; reportNumber = gen.body.number;
  const q2 = await call("GET", "/api/queue");
  assert.ok(!(q2.body.items || []).some((i: any) => i.type === "inspection_no_report" && i.inspection_id === inspId), "nudge clears after generation");
});

test("the report downloads as a real DOCX and sends to the client", async () => {
  const docx = await call("GET", `/api/reports/${reportId}/docx`);
  assert.equal(docx.status, 200);
  assert.equal(docx.buf.subarray(0, 2).toString("latin1"), "PK", "a DOCX is a zip — PK signature expected");
  assert.ok(docx.buf.length > 3000, "non-trivial document");
  const send = await call("POST", `/api/reports/${reportId}/send`, {});
  assert.equal(send.status, 200, JSON.stringify(send.body).slice(0, 200));
  assert.equal(send.body.to, "rc@v97.test");
});

test("the job packet zip carries the generated report; settings count storage", async () => {
  const pk = await call("GET", `/api/jobs/${jobId}/packet/download`);
  assert.equal(pk.status, 200);
  assert.ok(pk.buf.toString("latin1").includes(`${reportNumber}-v1.pdf`), "packet contains the report PDF");
  const settings = await call("GET", "/api/settings");
  assert.ok(settings.body.counts.storage_files >= 1, "uploaded photo counted");
  assert.ok(settings.body.counts.storage_bytes > 0, "storage bytes counted");
});

// v101 — Inspections P2 pair: the KPI summary endpoint behind the Home
// widget, and the two Copilot tools (list_inspections read,
// generate_inspection_report execute) exercised directly against the
// governed registry.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let tools: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v101", "pw", "1101"].join("-");
let wsId = ""; let ownerId = ""; let closedInsp = ""; let submittedInsp = "";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";

async function makeInspection(woId: string, title: string, finish: "closed" | "submitted") {
  const insp = await call("POST", `/api/work-orders/${woId}/inspections`, { title });
  await call("POST", `/api/inspections/${insp.body.id}/start`, {});
  await call("POST", "/api/attachments", { entity_type: "inspection", entity_id: insp.body.id, name: "done.png", mime: "image/png", data_base64: PNG, item_key: "completion_photos" });
  await call("POST", `/api/inspections/${insp.body.id}/submit`, {});
  if (finish === "closed") await call("POST", `/api/inspections/${insp.body.id}/decide`, { result: "passed" });
  return insp.body.id;
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v101-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  process.env.WORKPILE_CHROMIUM = "/home/hatch/workspace/browsers/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
  dbm = await import("../server/db.ts"); dbm.initSchema();
  tools = await import("../server/tools.ts");
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Ivy Inspect", email: "ivy@v101.test", password: PW, business_name: "V101 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); wsId = reg.body.user.workspace_id; ownerId = reg.body.user.id;
  await call("POST", "/api/auth/login", { email: "ivy@v101.test", password: PW });
  const pb = await call("POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 20000, cost: 9000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "KPI Client", email: "kc@v101.test", phone: "55501000101" }, service_requested: "Abatement", est_value: 20000 });
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
  const jobs = await call("GET", "/api/jobs");
  const wos = await call("GET", `/api/jobs/${jobs.body[0].id}/work-orders`);
  closedInsp = await makeInspection(wos.body[0].id, "Final clearance", "closed");
  submittedInsp = await makeInspection(wos.body[0].id, "Interim check", "submitted");
});

test("the KPI summary counts reviews waiting, reports pending and the pass rate", async () => {
  const s = await call("GET", "/api/inspections/summary");
  assert.equal(s.status, 200, JSON.stringify(s.body).slice(0, 140));
  assert.equal(s.body.awaiting_review, 1);
  assert.equal(s.body.reports_pending, 1);
  assert.equal(s.body.closed_30d, 1);
  assert.equal(s.body.pass_rate_30d, 100);
});

test("Copilot can list inspections and generate a report for the closed one", async () => {
  assert.equal(tools.TOOLS.list_inspections.control, "read");
  assert.equal(tools.TOOLS.generate_inspection_report.control, "execute");
  const list = await tools.TOOLS.list_inspections.run(wsId, ownerId, {});
  assert.ok(list.summary.includes(closedInsp), "the closed inspection is listed with its id");
  assert.ok(list.summary.includes("NO report yet"), "report absence is explicit");
  await assert.rejects(() => tools.TOOLS.generate_inspection_report.run(wsId, ownerId, { inspection_id: submittedInsp }), /not closed/i);
  const gen = await tools.TOOLS.generate_inspection_report.run(wsId, ownerId, { inspection_id: closedInsp });
  assert.ok(gen.refs.report_number && gen.refs.share_path.startsWith("/report/"), "report refs returned");
  const after = await call("GET", "/api/inspections/summary");
  assert.equal(after.body.reports_pending, 0, "the KPI sees the generated report");
});

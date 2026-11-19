// v90 — Organized files + Inspection Report Cards: material attachments get
// categories and disciplined chain names and roll up to the project files view;
// a closed inspection generates a versioned PDF report from a block template
// that never leaks internal comments; editing the template changes later
// reports but not earlier ones.
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
const PW = ["v90", "pw", "9001"].join("-");
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let jobId = ""; let woId = ""; let inspId = ""; let matId = "";

before(async () => {
  process.env.WORKPILE_CHROMIUM = process.env.WORKPILE_CHROMIUM || "/home/hatch/workspace/browsers/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v90-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(29000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Rita Reports", email: "rita@v90.test", password: PW, business_name: "V90 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "rita@v90.test", password: PW });
  const lead = await call("POST", "/api/leads", { contact: { name: "Report Client", email: "rc@v90.test", phone: "55501000090" }, service_requested: "Clearance inspection job", est_value: 30000 });
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
  const wos = await call("GET", `/api/jobs/${jobId}/work-orders`); woId = wos.body[0].id;
  const mat = await call("POST", `/api/work-orders/${woId}/materials`, { description: "HEPA filters", qty: 2, unit_cost: 210, supplier: "Safety Supply Co" });
  matId = mat.body.id;
  // inspection with a ranged reading
  const tpl = await call("POST", "/api/inspection-templates", { name: "Clearance check", sections: [{ title: "Air clearance", items: [{ key: "fiber", label: "Fiber count", type: "reading", unit: " f/cc", min: 0, max: 0.01 }, { key: "visual", label: "Visual clearance", type: "passfail", critical: true }] }] });
  assert.equal(tpl.status, 201, JSON.stringify(tpl.body));
  const insp = await call("POST", `/api/work-orders/${woId}/inspections`, { template_id: tpl.body.id, title: "Final clearance" });
  inspId = insp.body.id;
  await call("POST", `/api/attachments`, { entity_type: "inspection", entity_id: inspId, name: "clearance-wide.png", mime: "image/png", data_base64: PNG, item_key: "visual", tag: "after", caption: "Work area after clearance" });
  await call("PATCH", `/api/inspections/${inspId}`, { answers: { fiber: { v: "0.02" }, visual: { v: "pass" } }, license_no: "NY-12345" });
  await call("POST", `/api/inspections/${inspId}/comments`, { body: "INTERNAL-SECRET: crew ran late", client_visible: false });
  await call("POST", `/api/inspections/${inspId}/comments`, { body: "Client was on site for the walkthrough", client_visible: true });
  await call("POST", `/api/inspections/${inspId}/start`, {});
  await call("POST", `/api/inspections/${inspId}/submit`, {});
  const dec = await call("POST", `/api/inspections/${inspId}/decide`, { result: "passed_with_conditions", note: "Re-clean corners" });
  assert.equal(dec.status, 200, JSON.stringify(dec.body));
});

test("material files get a category, a disciplined chain name, and roll up to project files", async () => {
  const up = await call("POST", "/api/attachments", { entity_type: "wo_material", entity_id: matId, name: "supplier invoice 114.pdf", mime: "application/pdf", data_base64: Buffer.from("%PDF-1.4 fake").toString("base64") });
  assert.equal(up.status, 201, JSON.stringify(up.body));
  assert.equal(up.body.category, "supplier_invoice");
  assert.match(up.body.name, /^P\d{2}-\d+-\d+-W01-SupplierInvoice-/, up.body.name);
  assert.equal(up.body.orig_name, "supplier invoice 114.pdf");
  const files = await call("GET", `/api/jobs/${jobId}/files`);
  const mine = files.body.find((f: any) => f.id === up.body.id);
  assert.ok(mine && mine.via === "material", "rolls up via material");
});

test("a closed inspection generates a versioned PDF report that keeps internal comments out", async () => {
  const gen = await call("POST", `/api/inspections/${inspId}/reports`, {});
  assert.equal(gen.status, 201, JSON.stringify(gen.body));
  assert.equal(gen.body.version, 1);
  assert.equal(gen.body.format, "pdf", "chromium present in this environment");
  assert.match(gen.body.number, /-RPT$/);
  const dl = await fetch(base + `/api/reports/${gen.body.id}/download`, { headers: { cookie } });
  const buf = Buffer.from(await dl.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString(), "%PDF", "real PDF bytes");
  const pub = await fetch(base + `/report/${gen.body.share_token}`);
  const html = await pub.text();
  assert.ok(html.includes("Executive summary"), "summary block renders");
  assert.ok(html.includes("PASSED WITH CONDITIONS"), "result badge");
  assert.ok(html.includes("0.02"), "reading value prints");
  assert.ok(html.includes("out of range") || html.includes("outside"), "out-of-range flagged");
  assert.ok(!html.includes("INTERNAL-SECRET"), "internal comment must never print");
  assert.ok(html.includes("Client was on site"), "client-visible comment prints");
  const gen2 = await call("POST", `/api/inspections/${inspId}/reports`, {});
  assert.equal(gen2.body.version, 2, "regeneration versions up");
});

test("an open inspection cannot generate a final report; template edits change later reports only", async () => {
  const insp2 = await call("POST", `/api/work-orders/${woId}/inspections`, { title: "Still open" });
  const blocked = await call("POST", `/api/inspections/${insp2.body.id}/reports`, {});
  assert.equal(blocked.status, 422, JSON.stringify(blocked.body));
  assert.equal(blocked.body.error.code, "not_closed");
  const tpls = await call("GET", "/api/report-templates");
  const std = tpls.body[0];
  const noPhotos = std.blocks.filter((b: any) => b.type !== "photos");
  const patched = await call("PATCH", `/api/report-templates/${std.id}`, { blocks: noPhotos });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  const gen3 = await call("POST", `/api/inspections/${inspId}/reports`, {});
  assert.equal(gen3.body.version, 3);
  const pub3 = await fetch(base + `/report/${gen3.body.share_token}`);
  const html3 = await pub3.text();
  assert.ok(!html3.includes("Photo appendix"), "edited template drops the photos block");
  const list = await call("GET", `/api/inspections/${inspId}/reports`);
  const v1 = list.body.find((r: any) => r.version === 1);
  const pub1 = await fetch(base + `/report/${v1.share_token}`);
  assert.ok((await pub1.text()).includes("Photo appendix"), "v1 keeps its frozen template");
});

// v98 — Customer portal v1: account-level tokens, flag gate, branded page
// carrying projects/proposals/invoices/reports, strict client-safety (no
// internal costs anywhere), regeneration revokes the old link, and one
// customer's portal never shows another's data.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any;
async function call(method: string, p: string, body?: any, raw = false) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* html */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v98", "pw", "9801"].join("-");
let accountId = ""; let invNumber = ""; let repNumber = ""; let projectNo = "";

async function wonJob(suffix: string, email: string) {
  const pb = await call("POST", "/api/price-book", { name: "Portal package " + suffix, unit: "job", standard_price: 20000, cost: 9876 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Portal Client " + suffix, email, phone: "55501000098" }, service_requested: "Abatement", est_value: 20000 });
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
  await call("GET", "/api/accounts"); // listing accounts converts WON leads to customers (account link)
  const l2 = await call("GET", `/api/leads/${leadId}`);
  const jobs = await call("GET", "/api/jobs");
  const job = jobs.body.find((j: any) => j.lead_id === leadId);
  return { leadId, accountId: l2.body.lead?.account_id || l2.body.account_id, job };
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v98-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  process.env.WORKPILE_CHROMIUM = "/home/hatch/workspace/browsers/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Pat Portal", email: "pat@v98.test", password: PW, business_name: "V98 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "pat@v98.test", password: PW });
  const a = await wonJob("A", "pa@v98.test");
  accountId = a.accountId; projectNo = a.job.project_no;
  assert.ok(accountId, "the WON lead carries an account");
  const inv = await call("POST", `/api/jobs/${a.job.id}/invoice`, {});
  invNumber = inv.body.number;
  const wos = await call("GET", `/api/jobs/${a.job.id}/work-orders`);
  const insp = await call("POST", `/api/work-orders/${wos.body[0].id}/inspections`, { title: "Portal clearance" });
  await call("POST", `/api/inspections/${insp.body.id}/start`, {});
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  await call("POST", "/api/attachments", { entity_type: "inspection", entity_id: insp.body.id, name: "done.png", mime: "image/png", data_base64: PNG, item_key: "completion_photos" });
  await call("POST", `/api/inspections/${insp.body.id}/submit`, {});
  await call("POST", `/api/inspections/${insp.body.id}/decide`, { result: "passed" });
  const rep = await call("POST", `/api/inspections/${insp.body.id}/reports`, {});
  repNumber = rep.body.number;
});

test("the portal is flag-gated, then serves a branded client-safe page", async () => {
  const link = await call("POST", `/api/accounts/${accountId}/portal-link`, {});
  assert.equal(link.status, 200, JSON.stringify(link.body).slice(0, 160));
  assert.equal(link.body.portal_enabled, false);
  const off = await call("GET", link.body.url);
  assert.equal(off.status, 403);
  const on = await call("POST", "/api/settings/portal", { enabled: true });
  assert.equal(on.status, 200);
  const page = await call("GET", link.body.url);
  assert.equal(page.status, 200);
  for (const needle of ["V98 Environmental", projectNo, invNumber, repNumber, "Inspection reports", "Signed"]) assert.ok(page.text.includes(needle), `portal shows ${needle}`);
  assert.ok(!page.text.includes("9876"), "internal line cost never appears");
  assert.ok(!page.text.includes("Projected") && !/>Margin</.test(page.text), "no margin figures or labels");
  (globalThis as any).__link = link.body;
});

test("regenerating revokes the old link; another customer sees none of this data", async () => {
  const link = (globalThis as any).__link;
  const regen = await call("POST", `/api/accounts/${accountId}/portal-link`, { regenerate: true });
  assert.notEqual(regen.body.token, link.token);
  const oldPage = await call("GET", link.url);
  assert.equal(oldPage.status, 404);
  const newPage = await call("GET", regen.body.url);
  assert.equal(newPage.status, 200);
  const b = await wonJob("B", "pb@v98.test");
  const linkB = await call("POST", `/api/accounts/${b.accountId}/portal-link`, {});
  const pageB = await call("GET", linkB.body.url);
  assert.equal(pageB.status, 200);
  assert.ok(!pageB.text.includes(invNumber), "customer B never sees customer A's invoice");
  assert.ok(!pageB.text.includes(repNumber), "customer B never sees customer A's report");
});

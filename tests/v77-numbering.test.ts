// v77: the chain is numbered — L<YY>-NNNN leads, Q<YY>-NNNN quotes,
// P<YY>-NNNN-II projects (docs/CHAIN-MODEL.md). Numbers are assigned at
// creation, swept for anything created off-path, searchable, and a project
// keeps its serial while its iteration bumps when a new signed quote
// supersedes the original.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = ""; let wsId = ""; let appMod: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v77", "pw", "7711"].join("-");
const YY = String(new Date().getFullYear() % 100).padStart(2, "0");
let lead1 = ""; let prop1 = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v77-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Nora Numbers", email: "owner77@demo.test", password: PW, business_name: "V77 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner77@demo.test", password: PW });
  wsId = (await call("GET", "/api/auth/me")).body.user.workspace_id;
});

test("leads are numbered at creation, sequentially per year", async () => {
  const r1 = await call("POST", "/api/leads", { contact: { name: "First Fred", email: "fred@v77.test", phone: "55501000001" }, service_requested: "Mold remediation", est_value: 5000 });
  assert.equal(r1.status, 201, JSON.stringify(r1.body));
  lead1 = r1.body.lead.id;
  const g1 = await call("GET", `/api/leads/${lead1}`);
  assert.equal(g1.body.lead.lead_no, `L${YY}-0001`, JSON.stringify(g1.body.lead).slice(0, 200));
  const r2 = await call("POST", "/api/leads", { contact: { name: "Second Sue", email: "sue@v77.test", phone: "55501000002" }, service_requested: "Duct cleaning", est_value: 900 });
  const g2 = await call("GET", `/api/leads/${r2.body.lead.id}`);
  assert.equal(g2.body.lead.lead_no, `L${YY}-0002`);
});

test("quotes are numbered at creation; winning creates a numbered project at iteration 00", async () => {
  let r = await call("POST", `/api/leads/${lead1}/stage`, { to: "PROPOSAL" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call("POST", `/api/leads/${lead1}/proposals/auto-draft`, {});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  prop1 = r.body.proposal.id;
  const prow = dbm.db.prepare("SELECT quote_no FROM proposals WHERE id=?").get(prop1) as any;
  assert.equal(prow.quote_no, `Q${YY}-0001`);
  // approve + send through the real gates, then sign (DB assist for the e-sign itself)
  r = await call("POST", `/api/proposals/${prop1}/submit`, {}); assert.equal(r.status, 200, JSON.stringify(r.body));
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(prop1) as any;
  if (pend) { r = await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" }); assert.equal(r.status, 200, JSON.stringify(r.body)); }
  r = await call("POST", `/api/proposals/${prop1}/send`, { channel: "email" }); assert.equal(r.status, 201, JSON.stringify(r.body));
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), prop1);
  r = await call("POST", `/api/leads/${lead1}/stage`, { to: "WON" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const jobs = (await call("GET", "/api/jobs")).body;
  const job = (Array.isArray(jobs) ? jobs : jobs.jobs || []).find((j: any) => j.lead_id === lead1);
  assert.ok(job, "job created on win");
  assert.equal(job.project_no, `P${YY}-0001-00`, JSON.stringify(job).slice(0, 200));
});

test("a new signed quote supersedes: same project serial, iteration bumps to 01", async () => {
  const T = new Date().toISOString();
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at,signed_at,number) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("prop_v77_rev", wsId, lead1, 2, "signed", "[]", 7200, T, T, 1002);
  const lead = dbm.db.prepare("SELECT * FROM leads WHERE id=?").get(lead1);
  appMod.ensureJobForLead(wsId, "test", lead);
  const job = dbm.db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead1) as any;
  assert.equal(job.project_no, `P${YY}-0001-01`);
  assert.equal(job.proposal_id, "prop_v77_rev");
  assert.equal(job.value, 7200);
});

test("off-path rows are swept on read and search finds records by number", async () => {
  const T = new Date().toISOString();
  dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run("ct_v77", wsId, "Offpath Olga", "olga@v77.test");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run("lead_v77_off", wsId, "ct_v77", "Tank removal", "NEW", 3000, T, T);
  const list = await call("GET", "/api/leads");
  const rows = Array.isArray(list.body) ? list.body : list.body.leads || [];
  const off = rows.find((l: any) => l.id === "lead_v77_off");
  assert.ok(off?.lead_no, "swept on list read");
  assert.match(off.lead_no, new RegExp(`^L${YY}-000\\d$`));
  const s = await call("GET", `/api/search?q=${encodeURIComponent(off.lead_no)}`);
  assert.ok((s.body.leads || []).some((l: any) => l.id === "lead_v77_off"), "search by lead number");
  const sp = await call("GET", `/api/search?q=${encodeURIComponent(`P${YY}-0001`)}`);
  assert.ok((sp.body.jobs || []).length >= 1, "search by project number");
});

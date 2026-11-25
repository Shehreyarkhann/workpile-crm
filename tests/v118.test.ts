// v118: Direct Project creation — no funnel. A project opens immediately
// with a shell lead (WON, created_from='direct'), special instructions ride
// on the record, and the v117 machinery (money, readiness) works unchanged.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v118-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.env.PORT = String(20000 + Math.floor(Math.random() * 20000));
delete process.env.BASE_URL;
delete process.env.STRIPE_SECRET_KEY;
process.chdir(tmp);

const PW = ["v118", "pw", "1180"].join("-");
let B = ""; let dbm: any;
const jar = () => ({ cookie: "" });
async function call(c: any, method: string, p: string, body?: any) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(c.cookie ? { cookie: c.cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) c.cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, j, text: t };
}
let A: any, ws = "";
const db = () => dbm.db;

before(async () => {
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod: any = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { B = `http://127.0.0.1:${(s.address() as any).port}`; res(); }); });
  A = jar();
  const ra = await call(A, "POST", "/api/auth/register", { name: "Olive Owner", email: "o@v118.co", password: PW, business_name: "Direct Co" });
  assert.equal(ra.status, 201, JSON.stringify(ra.j));
  const me = await call(A, "GET", "/api/auth/me"); ws = me.j.user.workspace_id;
});

test("direct create: project opens with number, shell lead WON, default WO, instructions", async () => {
  const r = await call(A, "POST", "/api/projects/direct", { customer_name: "Walk-In Wendy", service_requested: "Emergency mold remediation", location: "4 Spur Lane", value: 3200, special_instructions: "Gate code 4419. Bill the property manager, not the tenant." });
  assert.equal(r.status, 201, JSON.stringify(r.j));
  assert.ok(r.j.project_no && r.j.project_no.endsWith("-00"), r.j.project_no);
  assert.equal(r.j.created_from, "direct");
  assert.equal(r.j.value, 3200);
  const lead = db().prepare("SELECT state FROM leads WHERE id=?").get(r.j.lead_id) as any;
  assert.equal(lead.state, "WON");
  const wos = db().prepare("SELECT COUNT(*) c FROM work_orders WHERE job_id=?").get(r.j.id) as any;
  assert.ok(wos.c >= 1, "default work order exists");
  const detail = await call(A, "GET", `/api/jobs/${r.j.id}`);
  assert.equal(detail.j.job.special_instructions, "Gate code 4419. Bill the property manager, not the tenant.");
  assert.equal(detail.j.money.contract, 3200, "typed value is the contract when there is no signed proposal");
  (globalThis as any).__dp = r.j.id;
});

test("direct create validation: service and customer are required", async () => {
  const noService = await call(A, "POST", "/api/projects/direct", { customer_name: "X" });
  assert.equal(noService.status, 422); assert.equal(noService.j.error.code, "service_required");
  const noCustomer = await call(A, "POST", "/api/projects/direct", { service_requested: "Y" });
  assert.equal(noCustomer.status, 422); assert.equal(noCustomer.j.error.code, "customer_required");
});

test("instructions are editable after creation", async () => {
  const id = (globalThis as any).__dp;
  const p = await call(A, "PATCH", `/api/jobs/${id}`, { special_instructions: "Updated: call the super before arrival." });
  assert.equal(p.status, 200, JSON.stringify(p.j));
  const j = db().prepare("SELECT special_instructions FROM jobs WHERE id=?").get(id) as any;
  assert.equal(j.special_instructions, "Updated: call the super before arrival.");
});

test("direct project runs the v117 money/readiness flow unchanged", async () => {
  const id = (globalThis as any).__dp;
  const job = db().prepare("SELECT * FROM jobs WHERE id=?").get(id) as any;
  db().prepare("UPDATE work_orders SET status='completed' WHERE job_id=?").run(id);
  db().prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,number,status,lines,total,paid_amount,issued_at,created_at) VALUES ('inv_dp',?,?,?,?, 'sent','[]',3200,0,?,?)").run(ws, job.lead_id, id, "INV-DP1", new Date().toISOString(), new Date().toISOString());
  const pay = await call(A, "POST", `/api/jobs/${id}/payments`, { amount: 3200, method: "money_order", reference: "MO-77" });
  assert.equal(pay.status, 201, JSON.stringify(pay.j));
  assert.equal(pay.j.close_readiness.ready, true, JSON.stringify(pay.j.close_readiness));
  const close = await call(A, "POST", `/api/jobs/${id}/stage`, { to: "CLOSED" });
  assert.equal(close.status, 200, JSON.stringify(close.j));
});

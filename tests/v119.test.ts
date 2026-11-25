// v119: typeahead suggestions — /api/suggest surfaces existing customers,
// services and locations as you type; createLead honors contact_id so a
// picked customer links instead of duplicating.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v119-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.env.PORT = String(20000 + Math.floor(Math.random() * 20000));
delete process.env.BASE_URL;
delete process.env.STRIPE_SECRET_KEY;
process.chdir(tmp);

const PW = ["v119", "pw", "1190"].join("-");
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
  const ra = await call(A, "POST", "/api/auth/register", { name: "Olive Owner", email: "o@v119.co", password: PW, business_name: "Suggest Co" });
  assert.equal(ra.status, 201, JSON.stringify(ra.j));
  const me = await call(A, "GET", "/api/auth/me"); ws = me.j.user.workspace_id;
  await call(A, "POST", "/api/price-book", { name: "Mold remediation package", unit: "job", standard_price: 2400 });
  await call(A, "POST", "/api/leads", { contact: { name: "Harbor Point HOA", email: "board@harbor.test", phone: "5550100119" }, service_requested: "Asbestos survey", location: "4 Spur Lane, Bay Shore", est_value: 5000, source: "manual" });
});

test("customers: matches by name and by email, carries the id", async () => {
  const byName = await call(A, "GET", "/api/suggest?kind=customers&q=harbor");
  assert.equal(byName.status, 200);
  const hit = byName.j.items.find((i: any) => i.label === "Harbor Point HOA");
  assert.ok(hit && hit.id, JSON.stringify(byName.j));
  assert.ok(hit.sub.includes("board@harbor.test"));
  const byEmail = await call(A, "GET", "/api/suggest?kind=customers&q=board@harbor");
  assert.ok(byEmail.j.items.some((i: any) => i.label === "Harbor Point HOA"));
  (globalThis as any).__cid = hit.id;
});

test("services: price book and used-before services both surface, deduped", async () => {
  const r = await call(A, "GET", "/api/suggest?kind=services&q=mold");
  assert.ok(r.j.items.some((i: any) => i.label === "Mold remediation package" && i.sub === "Price book"), JSON.stringify(r.j));
  const r2 = await call(A, "GET", "/api/suggest?kind=services&q=asbestos");
  assert.ok(r2.j.items.some((i: any) => i.label === "Asbestos survey"), JSON.stringify(r2.j));
});

test("locations: past site addresses surface", async () => {
  const r = await call(A, "GET", "/api/suggest?kind=locations&q=spur");
  assert.ok(r.j.items.some((i: any) => i.label.includes("Spur Lane")), JSON.stringify(r.j));
});

test("bad kind is 422 and suggestions are workspace-scoped", async () => {
  const bad = await call(A, "GET", "/api/suggest?kind=nope&q=x");
  assert.equal(bad.status, 422);
  const B2 = jar();
  await call(B2, "POST", "/api/auth/register", { name: "Other", email: "x@v119.co", password: PW, business_name: "Other Co" });
  const r = await call(B2, "GET", "/api/suggest?kind=customers&q=harbor");
  assert.equal(r.j.items.length, 0, "no cross-workspace leakage");
});

test("createLead with contact_id links the existing contact — no duplicate", async () => {
  const cid = (globalThis as any).__cid;
  const before = (db().prepare("SELECT COUNT(*) c FROM contacts WHERE workspace_id=?").get(ws) as any).c;
  // a genuinely new request from the same customer (different callback number,
  // so lead-level dedupe does not fire) — the picked contact must be reused
  const r = await call(A, "POST", "/api/leads", { contact_id: cid, contact: { name: "Harbor Point HOA", email: "board@harbor.test", phone: "5550199888" }, service_requested: "Follow-up inspection", source: "manual" });
  assert.equal(r.status, 201, JSON.stringify(r.j));
  const after = (db().prepare("SELECT COUNT(*) c FROM contacts WHERE workspace_id=?").get(ws) as any).c;
  assert.equal(after, before, "no new contact row was created");
  const lead = db().prepare("SELECT contact_id FROM leads WHERE id=?").get(r.j.lead.id) as any;
  assert.equal(lead.contact_id, cid);
});

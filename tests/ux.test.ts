// V14 UX transformation: next-step guidance, onboarding activation, Customer 360, job origin.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-ux-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let WSID = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ck = "";
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const wsId = uid("ws");
  WSID = wsId;
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(wsId, "UX Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Uma", "uma@ux.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ck = (await J("/api/auth/login", { method: "POST", body: { email: "uma@ux.co", password: "password1" } })).cookie;
});
const A = { Cookie: ck };

test("onboarding: fresh workspace starts incomplete; progress flips steps", async () => {
  let ob = (await J("/api/onboarding", {}, { Cookie: ck })).j;
  assert.equal(ob.total, 7); assert.equal(ob.complete, false);
  assert.equal(ob.steps.find((x: any) => x.key === "profile").done, true); // name + vertical seeded
  assert.equal(ob.steps.find((x: any) => x.key === "first_lead").done, false);
  const lead = await J("/api/leads", { method: "POST", body: { contact_name: "Pat", service_requested: "Mold Remediation", est_value: 900 } }, { Cookie: ck });
  assert.equal(lead.status, 201);
  ob = (await J("/api/onboarding", {}, { Cookie: ck })).j;
  assert.equal(ob.steps.find((x: any) => x.key === "first_lead").done, true);
});

test("next_step: new lead gets a contact action; won lead points at its job; lost lead is closed", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact_name: "Sam", contact_email: "sam@x.com", service_requested: "Asbestos Survey", est_value: 2000 } }, { Cookie: ck })).j.lead;
  let d = (await J("/api/leads/" + lead.id, {}, { Cookie: ck })).j;
  assert.ok(["call", "fix_step", "work", "assign"].includes(d.next_step.kind), d.next_step.kind);
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, { Cookie: ck });
  d = (await J("/api/leads/" + lead.id, {}, { Cookie: ck })).j;
  assert.equal(d.next_step.kind, "job");
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, { Cookie: ck });
  assert.ok(job.j.id, JSON.stringify(job.j).slice(0, 120));
  d = (await J("/api/leads/" + lead.id, {}, { Cookie: ck })).j;
  assert.equal(d.job_id, job.j.id); assert.match(d.next_step.label, /Open the job/);
  const jd = (await J("/api/jobs/" + job.j.id, {}, { Cookie: ck })).j;
  assert.equal(jd.origin.lead_id, lead.id);
  const l2 = (await J("/api/leads", { method: "POST", body: { contact_name: "Lee", service_requested: "X", est_value: 1 } }, { Cookie: ck })).j.lead;
  await J(`/api/leads/${l2.id}/stage`, { method: "POST", body: { to: "LOST", lost_reason: "chose_competitor" } }, { Cookie: ck });
  const d2 = (await J("/api/leads/" + l2.id, {}, { Cookie: ck })).j;
  assert.equal(d2.next_step.kind, "closed");
});

test("customer 360: account detail aggregates proposals + payments", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact_name: "Ana", contact_email: "ana@x.com", service_requested: "Water Damage Repair", est_value: 5000 } }, { Cookie: ck })).j.lead;
  const pb = (await J("/api/price-book", { method: "POST", body: { name: "Repair", standard_price: 5000, floor_price: 4000 } }, { Cookie: ck })).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.id, qty: 1 }] } }, { Cookie: ck })).j;
  assert.equal(prop.total, 5000);
  await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, { Cookie: ck });
  const { uid, now } = dbm; // payments are created by the payments module (deposit links); seed the settled row it would write
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,'deposit',1000,'test','paid',?,?)").run(uid("pay"), WSID, prop.id, now(), now());
  const acc = (await J(`/api/leads/${lead.id}/convert`, { method: "POST", body: {} }, { Cookie: ck })).j.account;
  assert.ok(acc?.id);
  const d = (await J("/api/accounts/" + acc.id, {}, { Cookie: ck })).j;
  assert.equal(d.proposals.length, 1); assert.equal(d.money360.proposals_value, 5000);
  assert.equal(d.payments.length, 1); assert.equal(d.money360.collected, 1000);
  assert.ok(Array.isArray(d.documents));
});

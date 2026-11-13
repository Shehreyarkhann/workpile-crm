// v70 pipeline: every client interaction lands on a record — inbound mail,
// replies, and bookings are logged on the lead timeline; a booking from an
// unlinked email creates the sender's record; a named-but-unknown person is
// surfaced as a mention for the picker, never silently dropped.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v70", "pw", "6060"].join("-");
let wsId = ""; let leadId = ""; let itemId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v70-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts"); // side-effect import: boots schema + worker (no default export)
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner70@demo.test", password: PW, business_name: "V70 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner70@demo.test", password: PW });
  const me = await call("GET", "/api/auth/me"); wsId = me.body.user.workspace_id;
  const lr = await call("POST", "/api/leads", { contact: { name: "Sara Site", email: "sara@v70.test", phone: "5550171234" }, service_requested: "Tank Removal", est_value: 12000 });
  assert.equal(lr.status, 201, JSON.stringify(lr.body)); leadId = lr.body.lead.id;
  const ing = await call("POST", "/api/inbox/ingest", { from_name: "Sara Site", from_email: "sara@v70.test", subject: "Visit timing", body: "Hi — can we schedule the site visit for Friday morning? Marcus will be there. Thanks!" });
  assert.equal(ing.status, 201, JSON.stringify(ing.body));
  const row = dbm.db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND from_email='sara@v70.test'").get(wsId) as any;
  assert.ok(row, "inbox item created"); assert.equal(row.lead_id, leadId); itemId = row.id;
});
const actsOf = async (id: string) => (await call("GET", `/api/leads/${id}`)).body.activities || [];

test("inbound mail is logged on the lead record, not hidden in the inbox", async () => {
  const acts = await actsOf(leadId);
  const ein = acts.find((a: any) => a.type === "email_in");
  assert.ok(ein, JSON.stringify(acts.map((a: any) => a.type)));
  assert.match(ein.body, /Visit timing/);
});

test("an unmatched name is a mention for the picker; booking logs visit_booked; the reply logs email_out", async () => {
  const r = await call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(Array.isArray(r.body.people) && r.body.people.length >= 1, "people directory for the picker");
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions));
  assert.equal(a.assignee_id, null);
  assert.equal(a.person_mention, "Marcus", JSON.stringify(a));
  const ex = await call("POST", `/api/inbox/${itemId}/actions/execute`, { action: a });
  assert.equal(ex.status, 201, JSON.stringify(ex.body));
  assert.equal(ex.body.lead_id, leadId); assert.equal(ex.body.record_created, false);
  let acts = await actsOf(leadId);
  assert.ok(acts.some((x: any) => x.type === "visit_booked"), JSON.stringify(acts.map((x: any) => x.type)));
  // the operator's reply is part of the record too
  const rep = await call("POST", `/api/inbox/${itemId}/reply`, { body: "Confirmed — see you Friday morning." });
  assert.equal(rep.status, 200, JSON.stringify(rep.body));
  acts = await actsOf(leadId);
  const eout = acts.find((x: any) => x.type === "email_out");
  assert.ok(eout, JSON.stringify(acts.map((x: any) => x.type)));
  assert.match(eout.body, /Confirmed/);
});

test("a booking from an unlinked sender creates the record and logs everything to it", async () => {
  // a contact with no lead yet (a vendor relationship that predates the CRM)
  const cid = dbm.uid("con");
  dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, "Vince Vendor", "", "vendor@v70.test");
  const ing = await call("POST", "/api/inbox/ingest", { from_name: "Vince Vendor", from_email: "vendor@v70.test", subject: "Invoice #44 question", body: "Hi — can we schedule a meeting for Friday at 2 pm to review invoice #44? Thanks." });
  assert.equal(ing.status, 201, JSON.stringify(ing.body));
  const item = dbm.db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND from_email='vendor@v70.test'").get(wsId) as any;
  assert.ok(item, "vendor mail lands as an inbox item"); assert.equal(item.lead_id, null);
  const r = await call("POST", `/api/inbox/${item.id}/actions`, { draft: "" });
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions)); assert.equal(a.needs_record, true);
  const ex = await call("POST", `/api/inbox/${item.id}/actions/execute`, { action: a });
  assert.equal(ex.status, 201, JSON.stringify(ex.body));
  assert.equal(ex.body.created_kind, "site_visit"); assert.equal(ex.body.record_created, true);
  const newLeadId = ex.body.lead_id; assert.ok(newLeadId);
  const itemAfter = dbm.db.prepare("SELECT lead_id FROM inbox_items WHERE id=?").get(item.id) as any;
  assert.equal(itemAfter.lead_id, newLeadId);
  const v = dbm.db.prepare("SELECT * FROM site_visits WHERE id=?").get(ex.body.created_id) as any;
  assert.equal(v.lead_id, newLeadId);
  const acts = await actsOf(newLeadId);
  const types = acts.map((x: any) => x.type);
  assert.ok(types.includes("email_in"), JSON.stringify(types));
  assert.ok(types.includes("visit_booked"), JSON.stringify(types));
  // booking the same action again: same visit, still exactly one record
  const ex2 = await call("POST", `/api/inbox/${item.id}/actions/execute`, { action: a });
  assert.equal(ex2.body.created_id, ex.body.created_id);
  const n = (dbm.db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND contact_id=?").get(wsId, cid) as any).c;
  assert.equal(n, 1);
});

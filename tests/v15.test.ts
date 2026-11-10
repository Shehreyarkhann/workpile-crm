// V15 audit close-out: API-key governance, Twilio signature gate, send integrity,
// onboarding v2 semantics, 360 finance definitions, settings DTO, reactivation dedupe.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v15-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let WSID = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let owner = "", member = "";
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  WSID = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(WSID, "V15 Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Olive Owner", "o@v15.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Mike Member", "m@v15.co", hashPassword("password1"), "MEMBER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  owner = (await J("/api/auth/login", { method: "POST", body: { email: "o@v15.co", password: "password1" } })).cookie;
  member = (await J("/api/auth/login", { method: "POST", body: { email: "m@v15.co", password: "password1" } })).cookie;
});
const O = () => ({ Cookie: owner }); const M = () => ({ Cookie: member });

test("api keys: members cannot mint keys; owners can; bad scopes rejected", async () => {
  assert.equal((await J("/api/api-keys", { method: "POST", body: { label: "x" } }, M())).status, 403);
  assert.equal((await J("/api/api-keys", {}, M())).status, 403);
  const bad = await J("/api/api-keys", { method: "POST", body: { label: "x", scopes: "leads:write admin:everything" } }, O());
  assert.equal(bad.status, 422);
  const ok = await J("/api/api-keys", { method: "POST", body: { label: "CRM", scopes: "leads:write outcomes:read" } }, O());
  assert.equal(ok.status, 201); assert.match(ok.j.key, /^lf_/);
});

test("settings DTO never carries the sync credential", async () => {
  dbm.db.prepare("UPDATE workspaces SET source_api_url='https://user:secretpass@example.com/feed', source_api_key='sk_live_secret' WHERE id=?").run(WSID);
  const r = await J("/api/settings", {}, O());
  assert.equal(r.status, 200);
  assert.ok(!("source_api_key" in r.j.workspace), "api key must not be in the DTO");
  assert.ok(!JSON.stringify(r.j).includes("secretpass"), "URL userinfo must not leak");
  assert.equal(r.j.workspace.has_source_api_url, true);
  assert.equal(r.j.workspace.source_api_host, "example.com");
});

test("twilio inbound: disabled without a token; forged posts rejected; signed posts accepted", async () => {
  delete process.env.TWILIO_AUTH_TOKEN;
  const off = await fetch(`http://localhost:${port}/webhooks/twilio/inbound`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "From=%2B15165550199&Body=hi" });
  assert.equal(off.status, 403);
  process.env.TWILIO_AUTH_TOKEN = "testtoken123";
  const forged = await fetch(`http://localhost:${port}/webhooks/twilio/inbound`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "x-twilio-signature": "bogus" }, body: "From=%2B15165550199&Body=hi" });
  assert.equal(forged.status, 403);
  const params = "Bodyhi" + "From+15165550199"; // sorted keys: Body, From
  const sig = createHmac("sha1", "testtoken123").update(`http://localhost:${port}/webhooks/twilio/inbound` + params).digest("base64");
  const good = await fetch(`http://localhost:${port}/webhooks/twilio/inbound`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "x-twilio-signature": sig }, body: "From=%2B15165550199&Body=hi" });
  assert.equal(good.status, 200);
  delete process.env.TWILIO_AUTH_TOKEN;
});

test("proposal send: a suppressed destination blocks the send — proposal stays draft", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Sue", email: "sue@x.co" }, service_requested: "Mold", est_value: 3000 } }, O())).j.lead;
  const pb = (await J("/api/price-book", { method: "POST", body: { name: "Mold work", standard_price: 3000, floor_price: 2000 } }, O())).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.id, qty: 1 }] } }, O())).j;
  await J("/api/suppressions", { method: "POST", body: { kind: "email", value: "sue@x.co" } }, O());
  const blocked = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, O());
  assert.equal(blocked.status, 422); assert.equal(blocked.j.error.code, "suppressed");
  const after = dbm.db.prepare("SELECT status, sent_at FROM proposals WHERE id=?").get(prop.id) as any;
  assert.equal(after.status, "draft"); assert.equal(after.sent_at, null);
  const sup = dbm.db.prepare("SELECT id FROM suppressions WHERE workspace_id=? AND value='sue@x.co'").get(WSID) as any;
  await J(`/api/suppressions/${sup.id}`, { method: "DELETE" }, O());
  const okSend = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, O());
  assert.equal(okSend.status, 201); assert.equal(okSend.j.status, "test_mode");
});

test("onboarding v2: pricing needs a priced item; test-mode send does not complete first_send", async () => {
  let ob = (await J("/api/onboarding", {}, O())).j;
  assert.equal(ob.total, 10);
  assert.equal(ob.steps.find((x: any) => x.key === "first_send").done, false, "test-mode sends never verify a delivery");
  assert.equal(ob.steps.find((x: any) => x.key === "first_proposal").done, true); // the sent proposal from the previous test
  // pricing nuance on a fresh workspace: $0 placeholder items do not count
  const { hashPassword, uid, now } = dbm; const ws2 = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(ws2, "Fresh Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws2, "Fran", "f@v15.co", hashPassword("password1"), "OWNER");
  const ck2 = (await J("/api/auth/login", { method: "POST", body: { email: "f@v15.co", password: "password1" } })).cookie;
  let ob2 = (await J("/api/onboarding", {}, { Cookie: ck2 })).j;
  assert.equal(ob2.steps.find((x: any) => x.key === "pricing").done, false);
  await J("/api/price-book", { method: "POST", body: { name: "Free placeholder", standard_price: 0, floor_price: 0 } }, { Cookie: ck2 });
  ob2 = (await J("/api/onboarding", {}, { Cookie: ck2 })).j;
  assert.equal(ob2.steps.find((x: any) => x.key === "pricing").done, false, "$0 items do not count as pricing");
  await J("/api/price-book", { method: "POST", body: { name: "Real", standard_price: 100, floor_price: 50 } }, { Cookie: ck2 });
  ob2 = (await J("/api/onboarding", {}, { Cookie: ck2 })).j;
  assert.equal(ob2.steps.find((x: any) => x.key === "pricing").done, true);
});

test("customer 360 finances: current version only, net collected, outstanding", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Ana", email: "ana360@x.co" }, service_requested: "Repair", est_value: 200 } }, O())).j.lead;
  const pb1 = (await J("/api/price-book", { method: "POST", body: { name: "V1", standard_price: 100, floor_price: 50 } }, O())).j;
  const pb2 = (await J("/api/price-book", { method: "POST", body: { name: "V2", standard_price: 200, floor_price: 50 } }, O())).j;
  const p1 = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb1.id, qty: 1 }] } }, O())).j;
  const p2 = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb2.id, qty: 1 }] } }, O())).j;
  assert.ok(p2.version > p1.version, "second proposal is a later version");
  const { uid, now } = dbm;
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(now(), p2.id);
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,'deposit',150,'test','paid',?,?)").run(uid("pay"), WSID, p2.id, now(), now());
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,'refund',50,'test','refunded',?,?)").run(uid("pay"), WSID, p2.id, now(), now());
  const acc = (await J(`/api/leads/${lead.id}/convert`, { method: "POST", body: {} }, O())).j.account;
  const d = (await J("/api/accounts/" + acc.id, {}, O())).j;
  assert.equal(d.money360.proposals_value, 200, "only the current version counts");
  assert.equal(d.money360.signed_value, 200);
  assert.equal(d.money360.net_collected, 100);
  assert.equal(d.money360.outstanding, 100);
  assert.equal(d.payments[0].lead_id, lead.id, "payments carry their lead for click-through");
});

test("reactivation sweep is idempotent — no duplicate open tasks", async () => {
  const { uid, now } = dbm;
  const ct = uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name) VALUES (?,?,?)").run(ct, WSID, "Stale Sam");
  const lid = uid("lead"); dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(lid, WSID, ct, "Old Job", "WORKING", new Date(Date.now() - 30 * 864e5).toISOString(), new Date(Date.now() - 20 * 864e5).toISOString());
  const ai = await import("../server/ai.ts");
  const r1 = ai.reactivateStale(WSID, "test"); const r2 = ai.reactivateStale(WSID, "test");
  assert.ok(r1.tasks_created >= 1); assert.equal(r2.tasks_created, 0, "second sweep creates nothing new");
});

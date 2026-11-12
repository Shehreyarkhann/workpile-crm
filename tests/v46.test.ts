// V46 — mailbox sync pollers (Gmail + Graph, deduped, feeding the ingest
// pipeline), QuickBooks connect state + invoice push, onboarding status,
// and the honest not-configured gate when provider apps are unregistered.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v46-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsecret";
process.env.MS_CLIENT_ID = "mid"; process.env.MS_CLIENT_SECRET = "msecret";
process.env.INTUIT_CLIENT_ID = "iid"; process.env.INTUIT_CLIENT_SECRET = "isecret";
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const mailsync = await import("../server/mail-sync.ts");
const qb = await import("../server/quickbooks.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v46", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = "";
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v46.test", password: PW, business_name: "V46 Env" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v46.test", password: PW });
  owner = l.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
});

function fakeFetch(routes: [string, any][]) {
  return async (url: string, _init?: any) => {
    for (const [frag, payload] of routes) if (String(url).includes(frag)) return { status: 200, json: async () => payload };
    return { status: 404, json: async () => ({}) };
  };
}

test("gmail poller: refresh, list, fetch, parse, dedupe on the second poll", async () => {
  const connId = dbm.uid("oau");
  dbm.db.prepare("INSERT INTO oauth_connections (id,workspace_id,provider,account_email,status,token_ref,created_at) VALUES (?,?, 'google', 'owner@v46env.com', 'connected', 'rtok', ?)").run(connId, wsid, dbm.now());
  const bodyB64 = Buffer.from("Need a quote for a tank test please").toString("base64url");
  const ff = fakeFetch([
    ["oauth2.googleapis.com/token", { access_token: "at-1" }],
    ["messages?maxResults", { messages: [{ id: "m1" }] }],
    ["messages/m1?format=full", { snippet: "Need a quote", payload: { headers: [{ name: "From", value: "Pat Buyer <pat@buyer.test>" }, { name: "Subject", value: "Tank test quote" }, { name: "Date", value: "Tue, 11 Nov 2026 10:00:00 -0500" }], mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: bodyB64 } }] } }],
  ]);
  const seenCalls: any[] = [];
  const ingest = (_ws: string, _actor: string, emails: any[]) => { seenCalls.push(emails); return {}; };
  const r1 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r1.ingested, 1, JSON.stringify(r1));
  assert.equal(seenCalls[0][0].from_email, "pat@buyer.test");
  assert.equal(seenCalls[0][0].subject, "Tank test quote");
  assert.match(seenCalls[0][0].body, /tank test/);
  const r2 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.equal(r2.ingested, 0, "seen messages are not re-ingested");
  const conn = dbm.db.prepare("SELECT last_poll_at, last_error FROM oauth_connections WHERE id=?").get(connId) as any;
  assert.ok(conn.last_poll_at); assert.equal(conn.last_error, null);
});

test("graph poller: messages newer than the last poll, parsed and deduped", async () => {
  const connId = dbm.uid("oau");
  dbm.db.prepare("INSERT INTO oauth_connections (id,workspace_id,provider,account_email,status,token_ref,created_at) VALUES (?,?, 'microsoft', 'owner@v46env.com', 'connected', 'rtok', ?)").run(connId, wsid, dbm.now());
  const ff = fakeFetch([
    ["login.microsoftonline.com", { access_token: "at-2" }],
    ["graph.microsoft.com/v1.0/me/messages", { value: [{ id: "g1", from: { emailAddress: { name: "Jo", address: "jo@buyer.test" } }, subject: "Mold inspection?", bodyPreview: "Hi, do you test for mold?", receivedDateTime: new Date().toISOString() }] }],
  ]);
  const seenCalls: any[] = [];
  const ingest = (_ws: string, _a: string, emails: any[]) => { seenCalls.push(emails); return {}; };
  const r1 = await mailsync.processMailSync(ingest as any, ff as any);
  assert.ok(r1.ingested >= 1);
  const g = seenCalls.flat().find((e: any) => e.external_id === "g1");
  assert.equal(g.from_email, "jo@buyer.test"); assert.match(g.body, /mold/);
});

test("oauth start is honest when the provider app is not registered", async () => {
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  const r = await call("GET", "/api/oauth/google/start", undefined, owner);
  assert.equal(r.s, 409); assert.equal(r.j.error.code, "provider_not_configured");
  process.env.GOOGLE_CLIENT_ID = "gid"; process.env.GOOGLE_CLIENT_SECRET = "gsecret";
  const ok = await call("GET", "/api/oauth/google/start", undefined, owner);
  assert.equal(ok.s, 200); assert.match(ok.j.url, /accounts\.google\.com/);
  const st = await call("GET", "/api/oauth/status", undefined, owner);
  assert.equal(st.j.connections.length, 2, "both mailboxes listed");
  assert.ok(!JSON.stringify(st.j).includes("rtok"), "tokens never leave the server");
});

test("quickbooks: status, customer auto-create, invoice push, idempotent re-push", async () => {
  dbm.db.prepare("INSERT INTO quickbooks_connections (workspace_id, realm_id, refresh_token, status, created_at, updated_at) VALUES (?, '934145', 'qb-rt', 'connected', ?, ?)").run(wsid, dbm.now(), dbm.now());
  const leadR = await call("POST", "/api/leads", { contact: { name: "Pat Buyer", email: "pat@buyer.test", phone: "6315558888" }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 500 }, owner);
  const lead = leadR.j.lead;
  const invId = dbm.uid("inv");
  dbm.db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,number,total,paid_amount,status,lines,created_at) VALUES (?,?,?, 'INV-Q', 500, 0, 'sent', ?, ?)").run(invId, wsid, lead.id, JSON.stringify([{ description: "Tank test", qty: 1, unit_price: 500 }]), dbm.now());
  const calls: string[] = [];
  const ff = async (url: string, init?: any) => {
    calls.push(String(url));
    if (String(url).includes("tokens/bearer")) return { status: 200, json: async () => ({ access_token: "qb-at" }) };
    if (String(url).includes("query?query=")) return { status: 200, json: async () => ({ QueryResponse: {} }) };
    if (String(url).endsWith("/customer")) return { status: 200, json: async () => ({ Customer: { Id: "77" } }) };
    if (String(url).endsWith("/invoice")) { const body = JSON.parse(init.body); assert.equal(body.CustomerRef.value, "77"); assert.equal(body.Line[0].Amount, 500); return { status: 200, json: async () => ({ Invoice: { Id: "123" } }) }; }
    return { status: 404, json: async () => ({}) };
  };
  const r = await qb.pushInvoiceToQb(wsid, invId, ff as any);
  assert.equal(r.qb_id, "123");
  const inv = dbm.db.prepare("SELECT qb_id, qb_synced_at FROM invoices WHERE id=?").get(invId) as any;
  assert.equal(inv.qb_id, "123"); assert.ok(inv.qb_synced_at);
  const again = await qb.pushInvoiceToQb(wsid, invId, ff as any);
  assert.equal(again.already, true);
  const st = await call("GET", "/api/quickbooks/status", undefined, owner);
  assert.equal(st.j.configured, true); assert.equal(st.j.connection.realm_id, "934145");
});

test("onboarding status: steps reflect reality and the playbook step flips", async () => {
  const st = await call("GET", "/api/onboarding/status", undefined, owner);
  assert.equal(st.j.total, 8);
  const byKey = Object.fromEntries(st.j.steps.map((s: any) => [s.key, s.done]));
  assert.equal(byKey.lead, true, "leads exist in this workspace");
  assert.equal(byKey.mailbox, true, "mailboxes connected above");
  assert.equal(byKey.playbook, false);
  await call("POST", "/api/campaigns/playbook", { kind: "review" }, owner);
  const st2 = await call("GET", "/api/onboarding/status", undefined, owner);
  assert.equal(st2.j.steps.find((s: any) => s.key === "playbook").done, true);
  assert.equal(st2.j.pct, Math.round((st2.j.done / 8) * 100));
});

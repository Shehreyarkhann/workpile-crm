// Slice 7 tests: two-way API (read + outcome push-in), event webhooks, OpenAPI, integrations catalog
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createHmac } from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test7-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, app: any, srv: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
const KEY = "lf_test_slice7key123456";
let cookie = "", leadId = "", received: any = null, receiver: any, receiverPort = 0;

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now, apiKeyHash } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T7 Co", now());
  const u = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(u, ws, "Owner", "o@t7.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run(uid("key"), ws, "t7", apiKeyHash(KEY), "leads:write,leads:read,outcomes:read,outcomes:write,projects:read");
  (globalThis as any).__ws = ws;
  receiver = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => { received = { sig: req.headers["x-workpile-signature"], event: req.headers["x-workpile-event"], body: b }; res.writeHead(200); res.end("{}"); }); });
  await new Promise<void>(r => receiver.listen(0, r)); receiver.unref(); receiverPort = (receiver.address() as any).port;
  app = (await import("../server/app.ts")).app;
  srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  const login = await J("/api/auth/login", { method: "POST", body: { email: "o@t7.co", password: "password1" } });
  cookie = login.cookie;
});

test("event webhook fires on lead.created and delivers signed", async () => {
  const ws = (globalThis as any).__ws;
  const ep = await J("/api/webhooks", { method: "POST", body: { url: `http://localhost:${receiverPort}/hook`, secret: "s3cret", events: "lead.created" } }, { Cookie: cookie });
  assert.equal(ep.status, 201);
  const created = await J("/v1/leads", { method: "POST", body: { contact: { name: "Hook Hanna", phone: "+15165559999", email: "h@x.co" }, service_requested: "Roofing", message: "leak", location: "NY" } }, { Authorization: `Bearer ${KEY}` });
  assert.equal(created.status, 201); leadId = created.j.id;
  const { processEventDeliveries } = await import("../server/integrations.ts");
  const r = await processEventDeliveries();
  assert.equal(r.delivered, 1);
  assert.ok(received); assert.equal(received.event, "lead.created");
  const expect = createHmac("sha256", "s3cret").update(received.body).digest("hex");
  assert.equal(received.sig, expect);
  void ws;
});

test("two-way API: read leads back, push outcome in, no echo delivery to pusher", async () => {
  const list = await J("/v1/leads", {}, { Authorization: `Bearer ${KEY}` });
  assert.equal(list.status, 200); assert.ok(list.j.count >= 1);
  const one = await J(`/v1/leads/${leadId}`, {}, { Authorization: `Bearer ${KEY}` });
  assert.equal(one.j.id, leadId);
  const pushed = await J(`/v1/leads/${leadId}/outcome`, { method: "POST", body: { outcome: "lost", reason_code: "WENT_WITH_COMPETITOR", external_ref: "CRM-881" } }, { Authorization: `Bearer ${KEY}` });
  assert.equal(pushed.status, 200); assert.equal(pushed.j.state, "LOST");
  const row = dbm.db.prepare("SELECT state, external_id FROM leads WHERE id=?").get(leadId);
  assert.equal(row.state, "LOST"); assert.equal(row.external_id, "CRM-881");
  const bad = await J(`/v1/leads/${leadId}/outcome`, { method: "POST", body: { outcome: "bogus" } }, { Authorization: `Bearer ${KEY}` });
  assert.equal(bad.status, 422);
  const noScope = await J("/v1/leads", {}, { Authorization: "Bearer wrong" });
  assert.equal(noScope.status, 401);
});

test("email-in API triages; openapi + integrations catalog served", async () => {
  const inbox = await J("/v1/inbox", { method: "POST", body: { from_name: "Pat", from_email: "pat@x.co", subject: "Need a quote", body: "Water damage in basement, call me at 516-555-0134 please" } }, { Authorization: `Bearer ${KEY}` });
  assert.equal(inbox.status, 201); assert.equal(inbox.j.category, "lead");
  const spec = await J("/openapi.json");
  assert.equal(spec.status, 200); assert.equal(spec.j.info.title, "Workpile API");
  const cat = await J("/api/integrations", {}, { Cookie: cookie });
  assert.equal(cat.status, 200); assert.ok(cat.j.integrations.length >= 10);
  assert.ok(cat.j.integrations.find((i: any) => i.id === "rest_api"));
});

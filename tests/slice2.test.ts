// Slice 2 tests: webhook worker (signed delivery to a real local receiver), DOCX export, inbox triage
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createHmac } from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test2-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, worker: any, inbox: any, docxm: any;
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  await import("../server/app.ts"); // registers schema users in app (outcomePayload dep)
  worker = await import("../server/worker.ts");
  inbox = await import("../server/inbox.ts");
  docxm = await import("../server/docx.ts");
});

test("inbox categorization routes Gregory's mail correctly", () => {
  assert.equal(inbox.categorizeEmail("Invoice #441 attached", "Please see invoice"), "finance");
  assert.equal(inbox.categorizeEmail("Field report — Tuesday", "Crew finished, site photos attached"), "field");
  assert.equal(inbox.categorizeEmail("Signed proposal", "Signed contract attached"), "proposal");
  assert.equal(inbox.categorizeEmail("Need help", "Basement flooded, looking for a quote, call 516-555-0134"), "lead");
  assert.equal(inbox.extractPhone("call me at (516) 555-0134 please"), "(516) 555-0134");
});

test("webhook worker delivers signed final outcome and marks it delivered", async () => {
  const ws = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "Hook Co", dbm.now());
  const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, "Hooked", "+15165550199", "h@x.co");
  const lead = dbm.uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(lead, ws, cid, "Water damage cleanup", "WON", 5000, dbm.now(), dbm.now());
  const dlv = dbm.uid("dlv");
  dbm.db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,created_at) VALUES (?,?,?,?,?,?)").run(dlv, ws, lead, "won", "abc", dbm.now());
  const secret = "test-secret";
  let received: any = null;
  const receiver = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => { received = { sig: req.headers["x-leadflow-signature"], body: b }; res.writeHead(200); res.end("{}"); }); });
  await new Promise<void>(r => receiver.listen(0, r));
  const port = (receiver.address() as any).port;
  dbm.db.prepare("INSERT INTO webhook_endpoints (id,workspace_id,url,secret,created_at) VALUES (?,?,?,?,?)").run(dbm.uid("whk"), ws, `http://127.0.0.1:${port}/hook`, secret, dbm.now());
  const result = await worker.processDeliveries();
  receiver.close();
  assert.equal(result.delivered, 1);
  assert.ok(received, "receiver got a delivery");
  const expected = "sha256=" + createHmac("sha256", secret).update(received.body).digest("hex");
  assert.equal(received.sig, expected, "HMAC signature verifies");
  assert.equal(JSON.parse(received.body).outcome, "won");
  const row = dbm.db.prepare("SELECT * FROM outcome_deliveries WHERE id=?").get(dlv);
  assert.equal(row.last_status, "delivered");
});

test("worker never marks delivered on a failing endpoint", async () => {
  const ws = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "Fail Co", dbm.now());
  const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, "F", "+15165550198", "f@x.co");
  const lead = dbm.uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(lead, ws, cid, "Mold remediation", "LOST", dbm.now(), dbm.now());
  const dlv = dbm.uid("dlv");
  dbm.db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,created_at) VALUES (?,?,?,?,?,?)").run(dlv, ws, lead, "lost", "abc", dbm.now());
  dbm.db.prepare("INSERT INTO webhook_endpoints (id,workspace_id,url,secret,created_at) VALUES (?,?,?,?,?)").run(dbm.uid("whk"), ws, "http://127.0.0.1:1/nowhere", "s", dbm.now());
  const result = await worker.processDeliveries();
  assert.ok(result.failed >= 1);
  const row = dbm.db.prepare("SELECT * FROM outcome_deliveries WHERE id=?").get(dlv);
  assert.notEqual(row.last_status, "delivered");
  assert.ok(row.last_error, "error recorded, not swallowed");
  assert.equal(worker.replayDelivery(dlv), true);
  const after = dbm.db.prepare("SELECT * FROM outcome_deliveries WHERE id=?").get(dlv);
  assert.equal(after.last_status, "pending"); assert.equal(after.attempts, 0);
});

test("DOCX export produces a real editable Word file", async () => {
  const ws = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "Docx Co", dbm.now());
  const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, "Dana", "+15165550197", "d@x.co");
  const lead = dbm.uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,notes,location,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(lead, ws, cid, "Water damage cleanup", "PROPOSAL_DRAFTED", "Dry the basement", "Bay Shore, NY", dbm.now(), dbm.now());
  const prop = dbm.uid("prop");
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at) VALUES (?,?,?,?,?,?,?,?)").run(prop, ws, lead, 1, "draft", JSON.stringify([{ name: "Extraction", qty: 1, unit_price: 3000 }]), 3000, dbm.now());
  const out = await docxm.proposalDocx(prop);
  assert.ok(out); assert.ok(out.buffer.length > 2000);
  assert.equal(out.buffer.subarray(0, 2).toString(), "PK"); // zip signature = real .docx
  assert.ok(out.filename.endsWith(".docx"));
});

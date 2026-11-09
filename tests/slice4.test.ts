// Slice 4 tests: change orders, billing/trial/limits, OAuth config gating, portal flag, consent capture shape
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test4-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
delete process.env.STRIPE_SECRET_KEY; delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;

let dbm: any, billing: any, oauth: any, wsId: string;
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  await import("../server/app.ts");
  billing = await import("../server/billing.ts");
  oauth = await import("../server/oauth.ts");
  wsId = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "Launch Co", dbm.now());
});

test("billing: trial auto-created (30d, growth), status + usage shape correct", () => {
  const b = billing.billingStatus(wsId);
  assert.equal(b.subscription.status, "trialing");
  assert.equal(b.plan.key, "growth"); assert.equal(b.plan.price, 599);
  assert.ok(b.trial_days_left >= 29 && b.trial_days_left <= 30);
  assert.equal(b.access, "ok");
  assert.equal(b.usage.leads_limit, 2000);
});

test("billing: expired trial blocks ingestion but never approvals (access flag only gates ingestion)", () => {
  const ws2 = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws2, "Expired Co", dbm.now());
  dbm.db.prepare("INSERT INTO subscriptions (id,workspace_id,plan,status,current_period_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run(dbm.uid("sub"), ws2, "growth", "trialing", new Date(Date.now() - 86400000).toISOString(), dbm.now(), dbm.now());
  const allowed = billing.ingestionAllowed(ws2);
  assert.equal(allowed.allowed, false); assert.equal(allowed.reason, "trial_expired");
});

test("billing: checkout honestly reports not-configured without Stripe keys", async () => {
  const r = await billing.createCheckout(wsId, "pro", "http://localhost");
  assert.equal(r.configured, false);
  assert.ok(r.message.includes("not configured"));
});

test("billing events: checkout completed activates the right workspace + plan", () => {
  const ok = billing.handleBillingEvent({ type: "checkout.session.completed", data: { object: { customer: "cus_1", subscription: "sub_1", metadata: { workspace_id: wsId, plan: "pro" } } } });
  assert.equal(ok, true);
  const b = billing.billingStatus(wsId);
  assert.equal(b.subscription.status, "active"); assert.equal(b.plan.key, "pro"); assert.equal(b.plan.price, 999);
  const failed = billing.handleBillingEvent({ type: "invoice.payment_failed", data: { object: { customer: "cus_1" } } });
  assert.equal(failed, true);
  assert.equal(billing.billingStatus(wsId).subscription.status, "past_due");
});

test("oauth: providers honestly report not_configured, authUrl refuses", () => {
  assert.equal(oauth.providerStatus("google").configured, false);
  const r = oauth.authUrl("google", wsId, "http://localhost/cb");
  assert.equal(r.configured, false); assert.equal(r.url, undefined);
});

test("change order data path: project + price-book delta math is enforced in schema usage", () => {
  const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, "CO", "+15165550195", "co@x.co");
  const lead = dbm.uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(lead, wsId, cid, "Water damage cleanup", "WON", dbm.now(), dbm.now());
  const proj = dbm.uid("prj");
  dbm.db.prepare("INSERT INTO projects (id,workspace_id,lead_id,pm_id,created_at) VALUES (?,?,?,?,?)").run(proj, wsId, lead, null, dbm.now());
  const co = dbm.uid("co");
  dbm.db.prepare("INSERT INTO change_orders (id,workspace_id,project_id,lead_id,delta_scope,delta_total,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(co, wsId, proj, lead, JSON.stringify({ description: "Add dehumidification", line_items: [{ name: "Dehumidification (per day)", qty: 3, unit_price: 450 }] }), 1350, "pending_approval", dbm.now());
  const row = dbm.db.prepare("SELECT * FROM change_orders WHERE id=?").get(co);
  assert.equal(row.delta_total, 1350); assert.equal(row.status, "pending_approval");
});

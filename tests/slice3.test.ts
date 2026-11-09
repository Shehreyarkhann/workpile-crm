// Slice 3 tests: e-sign evidence, deposit test-mode + Stripe webhook signature, flags/admin, synthetics invariants
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test3-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
delete process.env.STRIPE_SECRET_KEY;

let dbm: any, signm: any, paym: any, adminm: any, wsId: string, propId: string;
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  await import("../server/app.ts");
  signm = await import("../server/sign.ts");
  paym = await import("../server/payments.ts");
  adminm = await import("../server/admin.ts");
  wsId = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "Sign Co", dbm.now());
  const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, "Sue Signer", "+15165550196", "sue@x.co");
  const lead = dbm.uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(lead, wsId, cid, "Water damage cleanup", "PROPOSAL_SENT", dbm.now(), dbm.now());
  propId = dbm.uid("prop");
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at) VALUES (?,?,?,?,?,?,?,?)").run(propId, wsId, lead, 1, "sent", JSON.stringify([{ name: "Extraction", qty: 1, unit_price: 8000 }]), 8000, dbm.now());
});

test("e-sign: token, consent + name match enforced, evidence recorded, double-sign rejected", () => {
  const token = signm.ensureSignToken(propId);
  assert.ok(token);
  const noConsent = signm.sign(token, { signer_name: "Sue Signer", signer_email: "sue@x.co", typed_signature: "Sue Signer", consent: false });
  assert.equal(noConsent.ok, false); assert.equal(noConsent.error, "consent_required");
  const mismatch = signm.sign(token, { signer_name: "Sue Signer", signer_email: "sue@x.co", typed_signature: "Someone Else", consent: true });
  assert.equal(mismatch.ok, false); assert.equal(mismatch.error, "signature_must_match_name");
  const good = signm.sign(token, { signer_name: "Sue Signer", signer_email: "sue@x.co", typed_signature: "Sue Signer", consent: true, ip: "1.2.3.4" });
  assert.equal(good.ok, true); assert.ok(good.certificate.doc_hash.length >= 32);
  const prop = dbm.db.prepare("SELECT * FROM proposals WHERE id=?").get(propId);
  assert.equal(prop.status, "signed"); assert.ok(prop.signed_at);
  const again = signm.sign(token, { signer_name: "Sue Signer", signer_email: "sue@x.co", typed_signature: "Sue Signer", consent: true });
  assert.equal(again.ok, false); assert.equal(again.error, "already_signed");
});

test("deposit: test mode creates 25% deposit, markPaid flips proposal + writes outbox once", async () => {
  assert.equal(paym.stripeMode(), "test");
  const pay = await paym.createDeposit(propId, "http://localhost");
  assert.equal(pay.amount, 2000); assert.equal(pay.mode, "test"); assert.ok(pay.link.includes("/pay/test/"));
  assert.equal(paym.markPaid(pay.id), true);
  assert.equal(paym.markPaid(pay.id), false); // idempotent
  const prop = dbm.db.prepare("SELECT * FROM proposals WHERE id=?").get(propId);
  assert.equal(prop.payment_status, "deposit_paid");
  const out = dbm.db.prepare("SELECT * FROM outbox WHERE idempotency_key=?").get(`pay-${pay.id}`);
  assert.ok(out);
});

test("stripe webhook signature: valid passes, tampered/unsigned fails", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: {} } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.equal(paym.verifyStripeSignature(body, `t=${t},v1=${sig}`, secret), true);
  assert.equal(paym.verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret), false);
  assert.equal(paym.verifyStripeSignature(body, "", secret), false);
});

test("feature flags: defaults, canary toggle, unknown flag rejected", () => {
  const flags = adminm.getFlags(wsId);
  assert.equal(flags.demand_gap, true); assert.equal(flags.customer_portal, false);
  assert.equal(adminm.setFlag(wsId, "customer_portal", true), true);
  assert.equal(adminm.getFlags(wsId).customer_portal, true);
  assert.equal(adminm.setFlag(wsId, "not_a_flag", true), false);
});

test("synthetics invariants run against a live base (health may be down in unit env, invariants must pass)", async () => {
  const r = await adminm.runSynthetics("http://127.0.0.1:1");
  const inv = r.checks.find((c: any) => c.journey === "finals_have_deliveries");
  assert.ok(inv, "invariant check present");
  // the seeded PROPOSAL_SENT lead is not final, so no orphan finals exist
  assert.equal(inv.ok, true);
  const dlq = r.checks.find((c: any) => c.journey === "dlq_empty");
  assert.equal(dlq.ok, true);
});

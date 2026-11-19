// v103 — Stripe Connect per workspace: onboarding creates the workspace's
// own Express account, checkout sessions for deposits and invoices are
// direct charges on that account (Stripe-Account header, account stamped
// on the payment row), the mode label follows the key type honestly, and
// the webhook completion still lands through markPaid.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let payments: any;
const seen: any[] = [];
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v103", "pw", "1301"].join("-");
const KEY = ["sk", "test", "stubkey103"].join("_");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v103-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  process.env.STRIPE_SECRET_KEY = KEY;
  const realFetch = globalThis.fetch;
  (globalThis as any).fetch = async (input: any, init: any = {}) => {
    const url = String(input);
    if (!url.includes("api.stripe.com")) return realFetch(input, init);
    seen.push({ url, headers: init.headers || {}, body: String(init.body || "") });
    const json = (obj: any) => new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/v1/accounts") && (init.method || "GET") === "POST") return json({ id: "acct_stub123" });
    if (url.includes("/v1/account_links")) return json({ url: "https://connect.stripe.test/setup" });
    if (url.includes("/v1/accounts/acct_stub123/login_links")) return json({ url: "https://dashboard.stripe.test" });
    if (url.includes("/v1/accounts/acct_stub123")) return json({ charges_enabled: true, details_submitted: true, payouts_enabled: true });
    if (url.includes("/v1/checkout/sessions")) return json({ id: "cs_stub_" + seen.length, url: "https://checkout.stripe.test/cs" });
    return json({});
  };
  dbm = await import("../server/db.ts"); dbm.initSchema();
  payments = await import("../server/payments.ts");
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Pete Payments", email: "pete@v103.test", password: PW, business_name: "V103 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "pete@v103.test", password: PW });
});

test("onboarding creates the workspace account and status flips to connected", async () => {
  const st0 = await call("GET", "/api/stripe/connect/status");
  assert.equal(st0.body.configured, true); assert.equal(st0.body.connection, null);
  const start = await call("POST", "/api/stripe/connect/start", {});
  assert.equal(start.status, 200, JSON.stringify(start.body).slice(0, 140));
  assert.equal(start.body.url, "https://connect.stripe.test/setup");
  const row = dbm.db.prepare("SELECT * FROM stripe_connections").get() as any;
  assert.equal(row.account_id, "acct_stub123");
  const refreshed = await call("POST", "/api/stripe/connect/refresh-status", {});
  assert.equal(refreshed.body.connection.charges_enabled, 1);
  assert.equal(refreshed.body.connection.status, "connected");
  const dash = await call("POST", "/api/stripe/connect/dashboard", {});
  assert.equal(dash.body.url, "https://dashboard.stripe.test");
});

test("invoice + deposit checkouts are direct charges on the workspace account", async () => {
  assert.equal(payments.stripeMode(), "test", "a test key labels payments as test money");
  const pb = await call("POST", "/api/price-book", { name: "Abatement package", unit: "job", standard_price: 20000 });
  const lead = await call("POST", "/api/leads", { contact: { name: "Connect Client", email: "cc@v103.test", phone: "55501000103" }, service_requested: "Abatement", est_value: 20000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const prop = await call("POST", `/api/leads/${leadId}/proposals`, { line_items: [{ price_book_item_id: pb.body.id, qty: 1 }] });
  const propId = prop.body.proposal?.id || prop.body.id;
  const dep = await payments.createDeposit(propId, base);
  assert.equal(dep.stripe_account_id, "acct_stub123", "deposit rides the connected account");
  assert.equal(dep.mode, "test");
  await call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  if (pend) await call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  dbm.db.prepare("UPDATE proposals SET status='signed', signed_at=? WHERE id=?").run(new Date().toISOString(), propId);
  await call("POST", `/api/leads/${leadId}/stage`, { to: "WON" });
  const jobs = await call("GET", "/api/jobs");
  const invRes = await call("POST", `/api/jobs/${jobs.body[0].id}/invoice`, {});
  const invId = invRes.body.invoice?.id || invRes.body.id;
  const pay = await payments.createInvoicePayment(invId, base);
  assert.equal(pay.stripe_account_id, "acct_stub123", "invoice payment rides the connected account");
  const sessions = seen.filter(x => x.url.includes("/v1/checkout/sessions"));
  assert.ok(sessions.length >= 2 && sessions.every(x => x.headers["Stripe-Account"] === "acct_stub123"), "every session carried the Stripe-Account header");
  const done = payments.handleStripeEvent({ type: "checkout.session.completed", account: "acct_stub123", data: { object: { metadata: { payment_id: pay.id } } } });
  assert.equal(done, true);
  const inv = dbm.db.prepare("SELECT * FROM invoices WHERE id=?").get(invId) as any;
  assert.equal(inv.status, "paid", "the webhook completion pays the invoice through the same funnel");
});

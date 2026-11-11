// Slice 25: per-seat pricing — plan catalog, legacy mapping, seat enforcement.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test25-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number, wsId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "T25 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Owner", "o@t25.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t25.co", password: "password1" } })).cookie;
});

test("catalog: PRICING V2 workspace + usage pricing exactly as decided (2026-11-11)", async () => {
  const billing = await import("../server/billing.ts");
  assert.equal(billing.PLANS.starter.users, 2); assert.equal(billing.PLANS.starter.list_price, 49); assert.equal(billing.PLANS.starter.annual_price, 39);
  assert.equal(billing.PLANS.pro.users, 5); assert.equal(billing.PLANS.pro.list_price, 149); assert.equal(billing.PLANS.pro.annual_price, 119);
  assert.equal(billing.PLANS.business.users, 15); assert.equal(billing.PLANS.business.list_price, 349); assert.equal(billing.PLANS.business.annual_price, 299);
  assert.equal(billing.PLANS.enterprise.custom, true);
  // legacy keys resolve (grandfathered): solo→starter, team/crew/growth→pro
  assert.equal(billing.planOf("solo").key, "starter");
  assert.equal(billing.planOf("growth").key, "pro");
  assert.equal(billing.planOf("crew").key, "pro");
  const b = await J("/api/billing", {}, { Cookie: cookie });
  assert.equal(b.j.plan.key, "pro"); // new trials start on Pro
  assert.equal(b.j.usage.seats_used, 1); assert.equal(b.j.usage.seats_limit, 5);
});

test("seat limit is enforced when adding people, and lifts on a bigger plan", async () => {
  dbm.db.prepare("UPDATE subscriptions SET plan='starter' WHERE workspace_id=?").run(wsId);
  const second = await J("/api/users", { method: "POST", body: { name: "Second", email: "second@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(second.status, 201); // starter includes 2 office users
  const blocked = await J("/api/users", { method: "POST", body: { name: "Third", email: "third@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(blocked.status, 422); assert.equal(blocked.j.error.code, "seat_limit");
  dbm.db.prepare("UPDATE subscriptions SET plan='pro' WHERE workspace_id=?").run(wsId);
  const ok = await J("/api/users", { method: "POST", body: { name: "Third", email: "third@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(ok.status, 201);
  const b = await J("/api/billing", {}, { Cookie: cookie });
  assert.equal(b.j.usage.seats_used, 3); assert.equal(b.j.usage.seats_limit, 5);
});

test("enterprise checkout is a conversation, not a charge", async () => {
  const r = await J("/api/billing/checkout", { method: "POST", body: { plan: "enterprise" } }, { Cookie: cookie });
  assert.equal(r.j.custom, true); assert.equal(r.j.configured, false);
  assert.match(r.j.message, /custom-priced/);
});

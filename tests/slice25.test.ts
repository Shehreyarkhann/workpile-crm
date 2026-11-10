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

test("catalog: per-seat sale pricing exactly as decided", async () => {
  const billing = await import("../server/billing.ts");
  assert.equal(billing.PLANS.solo.seats, 1); assert.equal(billing.PLANS.solo.list_price, 29.99); assert.equal(billing.PLANS.solo.annual_price, 19.99);
  assert.equal(billing.PLANS.team.seats, 2); assert.equal(billing.PLANS.team.list_price, 69.99); assert.equal(billing.PLANS.team.annual_price, 49.99);
  assert.equal(billing.PLANS.crew.seats, 3); assert.equal(billing.PLANS.crew.list_price, 109.99); assert.equal(billing.PLANS.crew.annual_price, 79.99);
  assert.equal(billing.PLANS.enterprise.custom, true);
  assert.equal(billing.planOf("starter").key, "solo");
  assert.equal(billing.planOf("growth").key, "team");
  assert.equal(billing.planOf("pro").key, "crew");
  const b = await J("/api/billing", {}, { Cookie: cookie });
  assert.equal(b.j.plan.key, "crew"); // new trials start on Crew (3 seats)
  assert.equal(b.j.usage.seats_used, 1); assert.equal(b.j.usage.seats_limit, 3);
});

test("seat limit is enforced when adding people, and lifts on a bigger plan", async () => {
  dbm.db.prepare("UPDATE subscriptions SET plan='solo' WHERE workspace_id=?").run(wsId);
  const blocked = await J("/api/users", { method: "POST", body: { name: "Second", email: "second@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(blocked.status, 422); assert.equal(blocked.j.error.code, "seat_limit");
  dbm.db.prepare("UPDATE subscriptions SET plan='team' WHERE workspace_id=?").run(wsId);
  const ok = await J("/api/users", { method: "POST", body: { name: "Second", email: "second@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(ok.status, 201);
  const blocked2 = await J("/api/users", { method: "POST", body: { name: "Third", email: "third@t25.co", password: "password1", role: "PM" } }, { Cookie: cookie });
  assert.equal(blocked2.status, 422);
  const b = await J("/api/billing", {}, { Cookie: cookie });
  assert.equal(b.j.usage.seats_used, 2); assert.equal(b.j.usage.seats_limit, 2);
});

test("enterprise checkout is a conversation, not a charge", async () => {
  const r = await J("/api/billing/checkout", { method: "POST", body: { plan: "enterprise" } }, { Cookie: cookie });
  assert.equal(r.j.custom, true); assert.equal(r.j.configured, false);
  assert.match(r.j.message, /custom-priced/);
});

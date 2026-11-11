// Slice 26: monthly/yearly toggle model — public plans, per-period checkout.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test26-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T26 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t26.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t26.co", password: "password1" } })).cookie;
});

test("public plans carry both prices + exact sale percentages", async () => {
  const r = await J("/api/plans"); // no auth — the landing page uses this
  assert.equal(r.status, 200);
  const by = Object.fromEntries(r.j.plans.map((p: any) => [p.key, p]));
  assert.equal(by.starter.save_pct, 20); assert.equal(by.pro.save_pct, 20); assert.equal(by.business.save_pct, 14);
  assert.equal(by.starter.list_price, 49); assert.equal(by.starter.annual_price, 39);
  assert.equal(by.enterprise.custom, true);
});

test("checkout honors the period and reports it back (monthly + annual)", async () => {
  const m = await J("/api/billing/checkout", { method: "POST", body: { plan: "pro", period: "monthly" } }, { Cookie: cookie });
  assert.equal(m.j.configured, false); assert.equal(m.j.period, "monthly");
  const a = await J("/api/billing/checkout", { method: "POST", body: { plan: "pro", period: "annual" } }, { Cookie: cookie });
  assert.equal(a.j.period, "annual");
  const dflt = await J("/api/billing/checkout", { method: "POST", body: { plan: "pro" } }, { Cookie: cookie });
  assert.equal(dflt.j.period, "annual"); // no period = the sale (annual) by default
  const ent = await J("/api/billing/checkout", { method: "POST", body: { plan: "enterprise", period: "monthly" } }, { Cookie: cookie });
  assert.equal(ent.j.custom, true);
});

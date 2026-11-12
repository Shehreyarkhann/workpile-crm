// V60 — Custom Home Phase 2 (cross-module widgets). The widgets are only
// as real as the module endpoints behind them, so this suite pins every
// endpoint a Phase-2 widget consumes: it must answer 200 with the shape
// the widget renders, for an ordinary workspace owner.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v60-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);

const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v60", "pw", "9921"].join("-");
let ck = "";

async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie");
  return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olive O", email: "o@v60.test", password: PW, business_name: "O Co" });
  assert.equal(r.s, 201); ck = r.cookie!;
});

test("Work Queue widgets: approvals list + worst-first queue", async () => {
  const a = await call("GET", "/api/approvals", undefined, ck);
  assert.equal(a.s, 200); assert.ok(Array.isArray(a.j) || Array.isArray(a.j.rows));
  const q = await call("GET", "/api/queue", undefined, ck);
  assert.equal(q.s, 200); assert.ok(Array.isArray(q.j.items)); assert.equal(typeof q.j.total, "number");
});

test("Leads widgets: list, duplicates filter, dashboard funnel shape", async () => {
  const l = await call("GET", "/api/leads", undefined, ck);
  assert.equal(l.s, 200); assert.ok(Array.isArray(l.j));
  const dup = await call("GET", "/api/leads?state=DUPLICATE", undefined, ck);
  assert.equal(dup.s, 200); assert.ok(Array.isArray(dup.j));
  const m = await call("GET", "/api/dashboard", undefined, ck);
  assert.equal(m.s, 200); assert.ok(Array.isArray(m.j.funnel));
  if (m.j.funnel.length) { const f = m.j.funnel[0]; assert.equal(typeof f.state, "string"); assert.equal(typeof f.count, "number"); assert.equal(typeof f.value, "number"); }
});

test("Proposals + Jobs widgets", async () => {
  const p = await call("GET", "/api/proposals", undefined, ck);
  assert.equal(p.s, 200); assert.ok(Array.isArray(p.j));
  const j = await call("GET", "/api/jobs", undefined, ck);
  assert.equal(j.s, 200); assert.ok(Array.isArray(j.j));
});

test("Schedule & Ops widgets: calendar answers, ops carries site_visits", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const c = await call("GET", `/api/calendar?from=${today}&to=${today}`, undefined, ck);
  assert.equal(c.s, 200);
  const o = await call("GET", "/api/ops", undefined, ck);
  assert.equal(o.s, 200); assert.ok(Array.isArray(o.j.site_visits));
});

test("Finances widgets: the three drill keys the widgets render", async () => {
  for (const k of ["overdue_receivables", "outstanding_receivables", "collected_cash"]) {
    const d = await call("GET", `/api/finances/drill/${k}`, undefined, ck);
    assert.equal(d.s, 200, k);
    assert.ok(Array.isArray(d.j.rows), k); assert.equal(typeof d.j.total, "number", k); assert.equal(typeof d.j.count, "number", k);
  }
});

test("Inbox, Campaigns, Demand gap widgets", async () => {
  const i = await call("GET", "/api/inbox", undefined, ck);
  assert.equal(i.s, 200); assert.ok(Array.isArray(i.j));
  const c = await call("GET", "/api/campaigns", undefined, ck);
  assert.equal(c.s, 200); assert.ok(Array.isArray(c.j));
  const g = await call("GET", "/api/demand-gap", undefined, ck);
  assert.equal(g.s, 200); assert.ok(Array.isArray(g.j));
});

test("widget endpoints require auth", async () => {
  for (const p of ["/api/queue", "/api/approvals", "/api/finances/drill/overdue_receivables", "/api/demand-gap"]) {
    const r = await call("GET", p);
    assert.equal(r.s, 401, p);
  }
});

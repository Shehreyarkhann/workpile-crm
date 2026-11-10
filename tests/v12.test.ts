// V12 (transformation tranche 6): Backlog Audit funnel, vertical packs, activation, packaging (§§15, 24, 27).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv12-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", adminCookie = "";
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V12 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Olivia Owner", "o@v12.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,is_platform_admin) VALUES (?,?,?,?,?,?,1)").run(uid("usr"), wsId, "Adam Admin", "a@v12.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v12.co", password: "password1" } })).cookie;
  adminCookie = (await J("/api/auth/login", { method: "POST", body: { email: "a@v12.co", password: "password1" } })).cookie;
});

const FIXTURE = () => [
  { name: "Alpha", phone: "+15165550201", email: "a@x.co", service: "Phase I", value: 5000, created: ago(30), status: "New" },
  { name: "Beta", phone: "+15165550202", email: "b@x.co", service: "Mold", value: 3000, created: ago(20), "last contact": ago(20), status: "Working" },
  { name: "Fresh", phone: "+15165550203", email: "c@x.co", service: "Mold", value: 9000, created: ago(1), status: "New" },
  { name: "Gone", phone: "+15165550204", email: "d@x.co", service: "Mold", value: 7000, created: ago(50), status: "Closed Lost" },
  { name: "Alpha Twin", phone: "+15165550201", email: "a2@x.co", service: "Phase I", value: 5000, created: ago(40), status: "New" },
];

test("backlog audit: public, exact math on a fixed fixture, rows never stored", async () => {
  const r = await J("/api/public/backlog-audit", { method: "POST", body: { rows: FIXTURE(), email: "prospect@shop.co" } });
  assert.equal(r.status, 200, "no account needed");
  assert.equal(r.j.rows, 5);
  assert.equal(r.j.total_value, 29000);
  assert.equal(r.j.recoverable_count, 3);
  assert.equal(r.j.recoverable_value, 13000);
  assert.equal(r.j.untouched_count, 2);
  assert.equal(r.j.stale_count, 3);
  assert.equal(r.j.duplicate_rows, 1);
  assert.equal(r.j.lost_count, 1);
  assert.ok(r.j.top_opportunities.length >= 1 && r.j.method.includes("not a revenue guarantee"));
  const saved = dbm.db.prepare("SELECT * FROM audit_requests").all() as any[];
  assert.equal(saved.length, 1);
  assert.deepEqual(Object.keys(saved[0]).sort(), ["created_at", "email", "id", "recoverable_count", "recoverable_value", "rows_count"], "only aggregates are kept — the prospect's rows are never stored");
  const csvStyle = await J("/api/public/backlog-audit", { method: "POST", body: { rows: [{ name: "Empty Cell Ed", phone: "+15165550209", service: "Phase I", value: 1000, created: ago(90), "last contact": "", status: "New" }] } });
  assert.equal(csvStyle.j.stale_count, 1, "an empty last-contact cell (real CSV shape) still counts as idle-since-created");
  const tooMany = await J("/api/public/backlog-audit", { method: "POST", body: { rows: Array.from({ length: 2001 }, () => ({})) } });
  assert.equal(tooMany.status, 422);
  const page = await fetch(`http://localhost:${port}/audit`);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("Backlog Audit"));
});

test("vertical packs: apply seeds services + $0 price book + fields, idempotently", async () => {
  const first = await J("/api/templates/verticals/plumbing-hvac/apply", { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(first.status, 200);
  assert.equal(first.j.added.services, 7);
  assert.equal(first.j.added.price_book_items, 7);
  assert.equal(first.j.added.custom_fields, 2);
  const item = dbm.db.prepare("SELECT standard_price FROM price_book_items WHERE name='Drain Cleaning'").get() as any;
  assert.equal(item.standard_price, 0, "pack prices land at 0 — the business sets its own");
  const second = await J("/api/templates/verticals/plumbing-hvac/apply", { method: "POST", body: {} }, { Cookie: cookie });
  assert.deepEqual(second.j.added, { services: 0, price_book_items: 0, custom_fields: 0 });
});

test("activation analytics: platform-only, milestone math per workspace", async () => {
  await J("/api/leads", { method: "POST", body: { contact: { name: "Act Amy", phone: "+15165550205", email: "amy@x.co" }, service_requested: "Drain Cleaning", est_value: 400 } }, { Cookie: cookie });
  const denied = await J("/api/admin/activation", {}, { Cookie: cookie });
  assert.equal(denied.status, 403);
  const a = (await J("/api/admin/activation", {}, { Cookie: adminCookie })).j;
  const mine = a.workspaces.find((w: any) => w.workspace === "V12 Co");
  assert.ok(mine && mine.has_leads === true && mine.has_team === true);
  assert.equal(a.milestone_pct.has_leads, 100);
});

test("packaging: seat caps are enforced at the plan limit", async () => {
  const { uid, now } = dbm;
  const wsRow = dbm.db.prepare("SELECT id FROM workspaces WHERE name='V12 Co'").get() as any;
  dbm.db.prepare("INSERT INTO subscriptions (id,workspace_id,plan,status,current_period_end,created_at,updated_at) VALUES (?,?, 'solo', 'active', ?, ?, ?)").run(uid("sub"), wsRow.id, new Date(Date.now() + 30 * 86400000).toISOString(), now(), now());
  const add = await J("/api/users", { method: "POST", body: { name: "Third Person", email: "third@v12.co", password: "password1", role: "LEAD_OWNER" } }, { Cookie: cookie });
  assert.equal(add.status, 422);
  assert.equal(add.j.error.code, "seat_limit");
});

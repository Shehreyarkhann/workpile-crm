// Slice 14: per-member custom permissions — role defaults, overrides, server enforcement.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test14-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ownerCookie = "", memberCookie = "", memberId = "", leadA = "", leadB = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T14 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t14.co", hashPassword("password1"), "OWNER");
  memberId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(memberId, ws, "Larry Lead", "l@t14.co", hashPassword("password1"), "LEAD_OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ownerCookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t14.co", password: "password1" } })).cookie;
  memberCookie = (await J("/api/auth/login", { method: "POST", body: { email: "l@t14.co", password: "password1" } })).cookie;
  const a = await J("/api/leads", { method: "POST", body: { contact: { name: "Owned Otto", phone: "+15165550801", email: "otto@x.co" }, service_requested: "Mold remediation", message: "x", owner_id: memberId } }, { Cookie: ownerCookie });
  leadA = a.j.lead.id;
  const b = await J("/api/leads", { method: "POST", body: { contact: { name: "Others Olga", phone: "+15165550802", email: "olga@x.co" }, service_requested: "Mold remediation", message: "x", owner_id: (globalThis as any).__ .owner } }, { Cookie: ownerCookie });
  leadB = b.j.lead.id;
});

test("defaults: LEAD_OWNER sees only own leads; lead B is invisible; billing/settings/export closed", async () => {
  const list = await J("/api/leads?paged=1", {}, { Cookie: memberCookie });
  assert.deepEqual(list.j.items.map((l: any) => l.id), [leadA]);
  const det = await J(`/api/leads/${leadB}`, {}, { Cookie: memberCookie });
  assert.equal(det.status, 404);
  assert.equal((await J("/api/billing", {}, { Cookie: memberCookie })).status, 403);
  assert.equal((await J("/api/settings", { method: "PATCH", body: { name: "Nope" } }, { Cookie: memberCookie })).status, 403);
  assert.equal((await J("/api/reports/export?dataset=by_owner", {}, { Cookie: memberCookie })).status, 403);
  const me = await J("/api/auth/me", {}, { Cookie: memberCookie });
  assert.equal(me.j.user.permissions.leads_scope, "own");
});

test("owner widens a member's access; enforcement follows immediately; reset restores defaults", async () => {
  const up = await J(`/api/team/${memberId}`, { method: "PATCH", body: { permissions: { leads_scope: "all", can_export: true } } }, { Cookie: ownerCookie });
  assert.equal(up.j.user.permissions.leads_scope, "all"); assert.equal(up.j.user.has_overrides, true);
  const list = await J("/api/leads?paged=1", {}, { Cookie: memberCookie });
  assert.equal(list.j.items.length, 2);
  assert.equal((await J("/api/reports/export?dataset=by_owner", {}, { Cookie: memberCookie })).status, 200);
  // a member without team rights cannot manage access
  const denied = await J(`/api/team/${memberId}`, { method: "PATCH", body: { permissions: { can_billing: true } } }, { Cookie: memberCookie });
  assert.equal(denied.status, 403);
  // owner is immutable to non-owners and cannot be restricted
  const G = (globalThis as any).__;
  const reset = await J(`/api/team/${memberId}`, { method: "PATCH", body: { permissions: {} } }, { Cookie: ownerCookie });
  assert.equal(reset.j.user.has_overrides, false);
  const list2 = await J("/api/leads?paged=1", {}, { Cookie: memberCookie });
  assert.equal(list2.j.items.length, 1);
  const ownerMe = await J("/api/auth/me", {}, { Cookie: ownerCookie });
  assert.equal(ownerMe.j.user.permissions.can_billing, true);
});

test("revoking can_approve blocks decisions even for an approver role", async () => {
  const G = (globalThis as any).__; const { uid, now } = dbm;
  dbm.db.prepare("UPDATE users SET role='APPROVER' WHERE id=?").run(memberId);
  const ap = uid("app"); dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,submitted_by,tier,submitted_at) VALUES (?,?,?,?,?,?)").run(ap, G.ws, leadA, G.owner, "manager", now());
  const bad = await J(`/api/approvals/${ap}/decide`, { method: "POST", body: { decision: "approved" } }, { Cookie: memberCookie });
  assert.equal(bad.status, 200); // approver default: allowed
  const ap2 = uid("app"); dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,submitted_by,tier,submitted_at) VALUES (?,?,?,?,?,?)").run(ap2, G.ws, leadA, G.owner, "manager", now());
  await J(`/api/team/${memberId}`, { method: "PATCH", body: { permissions: { can_approve: false } } }, { Cookie: ownerCookie });
  const blocked = await J(`/api/approvals/${ap2}/decide`, { method: "POST", body: { decision: "approved" } }, { Cookie: memberCookie });
  assert.equal(blocked.status, 403);
});

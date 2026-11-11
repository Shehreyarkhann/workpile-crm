// Slice 8 tests: outbound comms (test-mode honesty + TCPA consent gate + proposal send),
// password reset (single-use hashed token), email verification, notifications.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test8-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", cookieMgr = "", leadId = "", propId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T8 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t8.co", hashPassword("password1"), "OWNER");
  const mgr = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(mgr, ws, "Mgr", "m@t8.co", hashPassword("password1"), "APPROVER");
  (globalThis as any).__ = { ws, owner, mgr };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t8.co", password: "password1" } })).cookie;
  cookieMgr = (await J("/api/auth/login", { method: "POST", body: { email: "m@t8.co", password: "password1" } })).cookie;
});

test("comms: email queues as test_mode (honest), SMS blocked without consent, allowed with", async () => {
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Msg Mary", phone: "+15165550111", email: "mary@x.co" }, service_requested: "Mold remediation", message: "help", location: "Bay Shore, NY", owner_id: (globalThis as any).__ .owner } }, { Cookie: cookie });
  assert.equal(c.status, 201); leadId = c.j.lead.id;
  const em = await J(`/api/leads/${leadId}/message`, { method: "POST", body: { channel: "email", subject: "Hello", body: "Checking in on your request." } }, { Cookie: cookie });
  assert.equal(em.status, 201); assert.equal(em.j.status, "test_mode"); // no RESEND_API_KEY in tests — must NOT claim sent
  const smsBlocked = await J(`/api/leads/${leadId}/message`, { method: "POST", body: { channel: "sms", body: "hi" } }, { Cookie: cookie });
  assert.equal(smsBlocked.status, 422); assert.equal(smsBlocked.j.error.code, "consent_required");
  dbm.db.prepare("UPDATE leads SET consent_contact_ok=1 WHERE id=?").run(leadId);
  const sms = await J(`/api/leads/${leadId}/message`, { method: "POST", body: { channel: "sms", body: "hi there" } }, { Cookie: cookie });
  assert.equal(sms.status, 201); assert.equal(sms.j.status, "test_mode");
  const hist = await J(`/api/leads/${leadId}/messages`, {}, { Cookie: cookie });
  assert.equal(hist.j.length, 2);
  const st = await J("/api/comms/status", {}, { Cookie: cookie });
  assert.equal(st.j.email, "test_mode");
});

test("proposal send to customer composes sign link + records delivery status", async () => {
  // walk the lead to a proposal quickly via direct states used by smoke: qualify path
  const t = async (to: string, extra: any = {}) => { const r = await J(`/api/leads/${leadId}/transition`, { method: "POST", body: { to_state: to, ...extra } }, { Cookie: cookie }); assert.equal(r.status, 200, `transition ${to}: ` + JSON.stringify(r.j)); return r; };
  await t("TRIAGED"); await t("QUALIFYING");
  const pb = await J("/api/price-book", { method: "POST", body: { name: "Mold job", unit: "job", standard_price: 4000, floor_price: 3000 } }, { Cookie: cookie });
  await J(`/api/leads/${leadId}`, { method: "PATCH", body: { pm_id: (globalThis as any).__ .mgr, approver_id: (globalThis as any).__ .mgr } }, { Cookie: cookie });
  await t("QUALIFIED");
  const prop = await J(`/api/leads/${leadId}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }] } }, { Cookie: cookie });
  assert.equal(prop.status, 201, JSON.stringify(prop.j)); propId = prop.j.id;
  const send = await J(`/api/proposals/${propId}/send`, { method: "POST", body: { channel: "email" } }, { Cookie: cookie });
  assert.equal(send.status, 201); assert.equal(send.j.status, "test_mode"); assert.ok(send.j.sign_link.includes("/sign/"));
  const out = dbm.db.prepare("SELECT * FROM messages_outbox WHERE lead_id=? AND subject LIKE 'Your proposal%'").get(leadId);
  assert.ok(out.body.includes("/sign/"));
});

test("notifications: approver got approval request; owner got outcome; read flow works", async () => {
  dbm.db.prepare("UPDATE workspaces SET approval_policy='always' WHERE id=?").run((globalThis as any).__.ws); // v3: approvals are policy-driven
  const t = (to: string) => J(`/api/leads/${leadId}/transition`, { method: "POST", body: { to_state: to } }, { Cookie: cookieMgr }); // v25: the owner is never approval-gated; a non-owner submits
  const r = await t("READY_FOR_APPROVAL");
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const mgrN = await J("/api/notifications", {}, { Cookie: cookieMgr });
  assert.ok(mgrN.j.unread >= 1); assert.ok(mgrN.j.notifications.some((n: any) => n.type === "approval.requested"));
  const first = mgrN.j.notifications[0];
  await J(`/api/notifications/${first.id}/read`, { method: "POST", body: {} }, { Cookie: cookieMgr });
  const mgrN2 = await J("/api/notifications", {}, { Cookie: cookieMgr });
  assert.equal(mgrN2.j.unread, mgrN.j.unread - 1);
  const ownN = await J("/api/notifications", {}, { Cookie: cookie });
  assert.ok(ownN.j.notifications.some((n: any) => n.type === "lead.created"));
});

test("password reset: forgot issues hashed single-use token; old pw dies, new pw works, reuse rejected", async () => {
  const f = await J("/api/auth/forgot", { method: "POST", body: { email: "m@t8.co" } });
  assert.equal(f.status, 200); assert.equal(f.j.test_mode, true); assert.ok(f.j.reset_url.includes("reset="));
  const raw = f.j.reset_url.split("reset=")[1];
  const stored = dbm.db.prepare("SELECT token_hash FROM auth_tokens WHERE kind='reset'").get();
  assert.notEqual(stored.token_hash, raw); // hashed at rest
  const bad = await J("/api/auth/reset", { method: "POST", body: { token: "deadbeef", password: "newpassword1" } });
  assert.equal(bad.status, 400);
  const ok = await J("/api/auth/reset", { method: "POST", body: { token: raw, password: "newpassword1" } });
  assert.equal(ok.status, 200);
  const reuse = await J("/api/auth/reset", { method: "POST", body: { token: raw, password: "anotherpass1" } });
  assert.equal(reuse.status, 400);
  const oldLogin = await J("/api/auth/login", { method: "POST", body: { email: "m@t8.co", password: "password1" } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await J("/api/auth/login", { method: "POST", body: { email: "m@t8.co", password: "newpassword1" } });
  assert.equal(newLogin.status, 200);
  const ghost = await J("/api/auth/forgot", { method: "POST", body: { email: "nobody@nowhere.co" } });
  assert.equal(ghost.status, 200); assert.equal(ghost.j.reset_url, undefined); // no enumeration
});

test("email verification: resend-verify in test mode returns link; verify flips flag", async () => {
  const r = await J("/api/auth/resend-verify", { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(r.status, 200); assert.ok(r.j.verify_url.includes("verify="));
  const raw = r.j.verify_url.split("verify=")[1];
  const v = await J("/api/auth/verify", { method: "POST", body: { token: raw } });
  assert.equal(v.status, 200);
  const u = dbm.db.prepare("SELECT email_verified FROM users WHERE email='o@t8.co'").get();
  assert.equal(u.email_verified, 1);
});

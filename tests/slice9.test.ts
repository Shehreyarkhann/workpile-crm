// Slice 9 tests: follow-up cadences (enroll on send, due-step sends, auto-stop on final),
// review-on-won email, activity pulse endpoint, settings persistence for the new fields.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test9-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, port: number, processFollowups: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", leadId = "", propId = "", lead2 = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T9 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t9.co", hashPassword("password1"), "OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  processFollowups = (await import("../server/followups.ts")).processFollowups;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t9.co", password: "password1" } })).cookie;
});

test("settings: follow-up + review fields persist", async () => {
  const r = await J("/api/settings", { method: "PATCH", body: { followup_enabled: true, review_on_won: true, review_url: "https://g.page/r/test" } }, { Cookie: cookie });
  assert.equal(r.j.followup_enabled, 1); assert.equal(r.j.review_on_won, 1); assert.equal(r.j.review_url, "https://g.page/r/test");
  const g = await J("/api/settings", {}, { Cookie: cookie });
  assert.equal(g.j.workspace.followup_enabled, 1);
});

test("cadence: sending a proposal enrolls; the due step sends; finalizing stops the rest", async () => {
  const { uid, now } = dbm; const G = (globalThis as any).__;
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Cadence Carl", phone: "+15165550233", email: "carl@x.co" }, service_requested: "Mold remediation", message: "help", location: "Bay Shore, NY", owner_id: G.owner } }, { Cookie: cookie });
  assert.equal(c.status, 201); leadId = c.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state='APPROVED', consent_contact_ok=1 WHERE id=?").run(leadId);
  propId = uid("prop");
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at) VALUES (?,?,?,?,?,?,?,?)").run(propId, G.ws, leadId, 1, "approved", "[]", 4200, now());
  const send = await J(`/api/proposals/${propId}/send`, { method: "POST", body: { channel: "email" } }, { Cookie: cookie });
  assert.equal(send.status, 201);
  const fups = await J(`/api/leads/${leadId}/followups`, {}, { Cookie: cookie });
  assert.equal(fups.j.length, 1); assert.equal(fups.j[0].status, "active");
  // make step 1 due and run the processor
  dbm.db.prepare("UPDATE followup_enrollments SET next_due_at='2020-01-01T00:00:00.000Z' WHERE lead_id=?").run(leadId);
  const r1 = await processFollowups("http://test");
  assert.ok(r1.sent >= 1, "expected the due nudge to send");
  const msgs = await J(`/api/leads/${leadId}/messages`, {}, { Cookie: cookie });
  assert.ok(msgs.j.some((m: any) => String(m.body).includes("floating your proposal")), "nudge body should be in the outbox history");
  // finalize WON via the real transition: enrollments stop + review email queued
  const won = await J(`/api/leads/${leadId}/transition`, { method: "POST", body: { to_state: "WON" } }, { Cookie: cookie });
  assert.equal(won.status, 200);
  const fups2 = await J(`/api/leads/${leadId}/followups`, {}, { Cookie: cookie });
  assert.equal(fups2.j[0].status, "stopped"); assert.equal(fups2.j[0].stop_reason, "finalized");
  const msgs2 = await J(`/api/leads/${leadId}/messages`, {}, { Cookie: cookie });
  assert.ok(msgs2.j.some((m: any) => String(m.subject || "").includes("how did we do")), "review request email should be queued on WON");
  const r2 = await processFollowups("http://test");
  assert.equal(r2.sent, 0);
});

test("manual stop works and activity pulse returns events", async () => {
  const { uid, now } = dbm; const G = (globalThis as any).__;
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Stop Sue", email: "sue@x.co" }, service_requested: "Asbestos survey", message: "x", owner_id: G.owner } }, { Cookie: cookie });
  lead2 = c.j.lead.id;
  dbm.db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("fup"), G.ws, lead2, uid("prop"), 0, now(), "active", now(), now());
  const stop = await J(`/api/leads/${lead2}/followups/stop`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(stop.j.ok, true);
  const f = await J(`/api/leads/${lead2}/followups`, {}, { Cookie: cookie });
  assert.equal(f.j[0].status, "stopped"); assert.equal(f.j[0].stop_reason, "manual");
  const act = await J("/api/activity", {}, { Cookie: cookie });
  assert.ok(Array.isArray(act.j.events) && act.j.events.length >= 2);
  assert.ok(act.j.events.some((e: any) => e.contact_name === "Cadence Carl"));
});

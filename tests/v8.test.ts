// V8 (transformation tranche 2): price overrides (§9.2), approval content-hash invalidation (§9.3),
// cadence quiet hours (§9.5), work-item fields (§6.3), proposals list.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv8-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", loCookie = "", wsId = "", pbBig: any, pbSmall: any, lead1: any;

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V8 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Olivia Owner", "o@v8.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Larry Lead", "l@v8.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v8.co", password: "password1" } })).cookie;
  loCookie = (await J("/api/auth/login", { method: "POST", body: { email: "l@v8.co", password: "password1" } })).cookie;
  pbBig = (await J("/api/price-book", { method: "POST", body: { name: "Tank removal", standard_price: 30000, floor_price: 25000 } }, { Cookie: cookie })).j;
  pbSmall = (await J("/api/price-book", { method: "POST", body: { name: "Mold test", standard_price: 1000, floor_price: 800 } }, { Cookie: cookie })).j;
  lead1 = (await J("/api/leads", { method: "POST", body: { contact: { name: "Vera V8", phone: "+15165550151", email: "vera@x.co" }, service_requested: "UST Removal", est_value: 30000 } }, { Cookie: cookie })).j.lead;
});

test("price override: reason required before creation; recorded + audited with one", async () => {
  const noReason = await J(`/api/leads/${lead1.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbSmall.id, qty: 1, unit_price: 900 }] } }, { Cookie: cookie });
  assert.equal(noReason.status, 422);
  assert.equal(noReason.j.error.code, "override_reason_required");
  const countAfter = dbm.db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(lead1.id) as any;
  assert.equal(countAfter.c, 0, "no proposal persisted when the override is rejected");
  const ok = await J(`/api/leads/${lead1.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbSmall.id, qty: 1, unit_price: 900, override_reason: "Loyal customer discount" }] } }, { Cookie: cookie });
  assert.equal(ok.status, 201);
  const ovr = dbm.db.prepare("SELECT * FROM price_overrides WHERE proposal_id=?").get(ok.j.id) as any;
  assert.ok(ovr && ovr.prev_price === 1000 && ovr.new_price === 900 && ovr.reason.includes("Loyal"), "override recorded with prev/new/reason");
  const loLead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Lo Lead", phone: "+15165550152", email: "lo@x.co" }, service_requested: "Mold", est_value: 1000 } }, { Cookie: loCookie })).j.lead;
  const forbidden = await J(`/api/leads/${loLead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbSmall.id, qty: 1, unit_price: 900, override_reason: "try" }] } }, { Cookie: loCookie });
  assert.equal(forbidden.status, 403, "LEAD_OWNER cannot override prices");
});

test("approval invalidation: a material change after approval blocks the send and resubmits", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Big Bill", phone: "+15165550153", email: "bill@x.co" }, service_requested: "UST Removal", est_value: 30000 } }, { Cookie: cookie })).j.lead;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbBig.id, qty: 1 }] } }, { Cookie: cookie })).j;
  const send1 = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(send1.status, 422); assert.equal(send1.j.error.code, "approval_required");
  const apprId = send1.j.error.approval_id || send1.j.approval_id;
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(prop.id) as any;
  const dec = await J(`/api/approvals/${pend.id}/decide`, { method: "POST", body: { decision: "approved" } }, { Cookie: cookie });
  assert.equal(dec.status, 200);
  const stored = dbm.db.prepare("SELECT content_hash FROM approvals WHERE id=?").get(pend.id) as any;
  assert.ok(stored.content_hash, "approval stored the content hash");
  // simulate a material change to the approved version (any mutation path)
  dbm.db.prepare("UPDATE proposals SET total=31000 WHERE id=?").run(prop.id);
  const send2 = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(send2.status, 422);
  assert.equal(send2.j.error.code, "approval_invalidated");
  const fresh = dbm.db.prepare("SELECT COUNT(*) c FROM approvals WHERE proposal_id=? AND decision IS NULL").get(prop.id) as any;
  assert.equal(fresh.c, 1, "a fresh pending approval was created");
});

test("quiet hours: cadence sends defer inside the window, resume outside it", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Quiet Quinn", phone: "+15165550154", email: "quinn@x.co" }, service_requested: "Mold Testing", est_value: 1000 } }, { Cookie: cookie })).j.lead;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbSmall.id, qty: 1 }] } }, { Cookie: cookie })).j;
  const sent = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(sent.status, 201, "small proposal sends without approval");
  // enroll directly (a bare workspace has no seeded cadence templates for auto-enroll to use)
  const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("enr"), wsId, lead.id, prop.id, 2, "2020-01-01T00:00:00.000Z", "active", now(), now());
  const enr = dbm.db.prepare("SELECT * FROM followup_enrollments WHERE lead_id=?").get(lead.id) as any;
  assert.ok(enr, "cadence enrollment exists");
  const hourET = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  await J("/api/settings/cadence", { method: "PATCH", body: { quiet_start: hourET, quiet_end: (hourET + 1) % 24, tz: "America/New_York" } }, { Cookie: cookie });
  const before = dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any;
  const { processFollowups } = await import("../server/followups.ts");
  await processFollowups("http://localhost");
  const duringQuiet = dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any;
  assert.equal(duringQuiet.c, before.c, "nothing sent during quiet hours");
  await J("/api/settings/cadence", { method: "PATCH", body: { quiet_start: null, quiet_end: null, tz: "America/New_York" } }, { Cookie: cookie });
  await processFollowups("http://localhost");
  const after = dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(lead.id) as any;
  assert.ok(after.c > before.c, "cadence resumed once the window closed");
});

test("work items: snooze hides + records reason; completion records who + why", async () => {
  const t = (await J("/api/tasks", { method: "POST", body: { lead_id: lead1.id, title: "Snooze me" } }, { Cookie: cookie })).j;
  const snz = await J(`/api/tasks/${t.id}/snooze`, { method: "POST", body: { reason: "waiting on lab results" } }, { Cookie: cookie });
  assert.equal(snz.status, 200);
  const open = (await J("/api/tasks-all?filter=open", {}, { Cookie: cookie })).j;
  assert.ok(!open.some((x: any) => x.id === t.id), "snoozed task leaves the open list");
  const row = dbm.db.prepare("SELECT snooze_reason FROM tasks WHERE id=?").get(t.id) as any;
  assert.equal(row.snooze_reason, "waiting on lab results");
  const t2 = (await J("/api/tasks", { method: "POST", body: { lead_id: lead1.id, title: "Complete me" } }, { Cookie: cookie })).j;
  await J(`/api/tasks/${t2.id}/complete`, { method: "POST", body: { reason: "docs received" } }, { Cookie: cookie });
  const doneRow = dbm.db.prepare("SELECT completed_by, completion_reason FROM tasks WHERE id=?").get(t2.id) as any;
  assert.ok(doneRow.completed_by && doneRow.completion_reason === "docs received");
});

test("proposals list endpoint powers the Proposals destination", async () => {
  const rows = (await J("/api/proposals", {}, { Cookie: cookie })).j;
  assert.ok(Array.isArray(rows) && rows.length >= 3);
  assert.ok(rows.every((r: any) => r.contact_name !== undefined && r.status !== undefined));
});

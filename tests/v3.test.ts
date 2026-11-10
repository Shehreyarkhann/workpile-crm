// V3 (slices 28-36): free flow, roster workers, jobs, queue, proposals options,
// inbox collaboration, business-hours follow-ups, board stats + report v3.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv3-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number, wsId = "", ownerId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";
let dbm: any;
const mkLead = async (name: string, phone: string, svc: string, val: number, extra: any = {}) => (await J("/api/leads", { method: "POST", body: { contact: { name, phone, email: phone.replace(/\D/g, "") + "@x.co" }, service_requested: svc, est_value: val, ...extra } }, { Cookie: cookie })).j.lead;
let leadA: any, leadB: any, pbId = "", classId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,followup_enabled,created_at) VALUES (?,?,1,?)").run(wsId, "V3 Co", now());
  ownerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(ownerId, wsId, "Owner", "o@v3.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v3.co", password: "password1" } })).cookie;
  const pb = await J("/api/price-book", { method: "POST", body: { name: "Phase II ESA", unit: "job", standard_price: 12000, floor_price: 9000 } }, { Cookie: cookie }).catch(() => null);
  // price book create route may differ; fall back to direct insert
  if (!pb || !pb.j?.id) { pbId = uid("pb"); dbm.db.prepare("INSERT INTO price_book_items (id,workspace_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?)").run(pbId, wsId, "Phase II ESA", "job", 12000, 9000); }
  else pbId = pb.j.id;
  const cls = await J("/api/labor-classes", { method: "POST", body: { name: "Technician", private_rate: 38, govt_rate: 68 } }, { Cookie: cookie });
  classId = cls.j.id;
  leadA = await mkLead("Alpha School", "+15165550111", "Phase II ESA", 30000);
  leadB = await mkLead("Beta Realty", "+15165550222", "Tank removal", 71400);
});

test("28: stages move BACKWARD freely (no ratchet)", async () => {
  let r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "QUALIFIED" } }, { Cookie: cookie }); assert.equal(r.j.lead.state, "QUALIFIED");
  r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "PROPOSAL" } }, { Cookie: cookie }); assert.equal(r.j.lead.state, "PROPOSAL");
  r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "WORKING" } }, { Cookie: cookie }); assert.equal(r.j.lead.state, "WORKING", "backward move must work");
  r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "NEW" } }, { Cookie: cookie }); assert.equal(r.j.lead.state, "NEW");
});

test("28: finals need a reason; reopen supersedes the outcome delivery", async () => {
  let r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "LOST" } }, { Cookie: cookie });
  assert.equal(r.status, 422); assert.equal(r.j.error.code, "reason_required");
  r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "LOST", lost_reason: "price" } }, { Cookie: cookie });
  assert.equal(r.j.lead.state, "LOST");
  const dlv = dbm.db.prepare("SELECT * FROM outcome_deliveries WHERE lead_id=? AND superseded_at IS NULL").get(leadA.id); assert.ok(dlv, "final creates a §14.5 delivery");
  r = await J(`/api/leads/${leadA.id}/reopen`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(r.j.lead.state, "WORKING");
  const sup = dbm.db.prepare("SELECT * FROM outcome_deliveries WHERE lead_id=?").get(leadA.id); assert.ok(sup.superseded_at, "reopen supersedes, never deletes");
});

test("28: WON needs a signed proposal or an explicit confirm — then a Job exists", async () => {
  let r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "WON" } }, { Cookie: cookie });
  assert.equal(r.status, 422); assert.equal(r.j.error.code, "won_needs_confirmation");
  r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, { Cookie: cookie });
  assert.equal(r.j.lead.state, "WON");
  const jobs = await J("/api/jobs", {}, { Cookie: cookie });
  assert.ok(jobs.j.some((j: any) => j.lead_id === leadA.id), "job auto-created on WON");
});

test("28: legacy states migrate (TRIAGED->WORKING, ON_HOLD->flag)", async () => {
  const { uid, now } = dbm;
  const cid = uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name) VALUES (?,?,?)").run(cid, wsId, "Legacy");
  const l1 = uid("lead"); dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,created_at,updated_at) VALUES (?,?,?,'TRIAGED',?,?)").run(l1, wsId, cid, now(), now());
  const l2 = uid("lead"); dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,hold_reason,created_at,updated_at) VALUES (?,?,?,'ON_HOLD','waiting on access',?,?)").run(l2, wsId, cid, now(), now());
  dbm.initSchema();
  assert.equal(dbm.db.prepare("SELECT state FROM leads WHERE id=?").get(l1).state, "WORKING");
  const r2 = dbm.db.prepare("SELECT state, hold_flag FROM leads WHERE id=?").get(l2); assert.equal(r2.state, "QUALIFIED"); assert.equal(r2.hold_flag, 1);
});

test("28: approval policy gates the SEND of big proposals, not the stage", async () => {
  await J(`/api/leads/${leadB.id}/stage`, { method: "POST", body: { to: "PROPOSAL" } }, { Cookie: cookie });
  const prop = await J(`/api/leads/${leadB.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbId, qty: 6 }] } }, { Cookie: cookie }); // 6 x 12000 = 72000 > 25000 threshold
  assert.equal(prop.j.total, 72000);
  const pend = await J("/api/approvals", {}, { Cookie: cookie });
  assert.ok(pend.j.some((a: any) => a.lead_id === leadB.id), "over-threshold proposal routes to approval on entering PROPOSAL flow");
  const send = await J(`/api/proposals/${prop.j.id}/send`, { method: "POST", body: { channel: "email" } }, { Cookie: cookie });
  assert.equal(send.status, 422); assert.equal(send.j.error.code, "approval_required");
  const appr = pend.j.find((a: any) => a.lead_id === leadB.id);
  const dec = await J(`/api/approvals/${appr.id}/decide`, { method: "POST", body: { decision: "approved" } }, { Cookie: cookie }); assert.equal(dec.j.ok, true);
  const send2 = await J(`/api/proposals/${prop.j.id}/send`, { method: "POST", body: { channel: "email" } }, { Cookie: cookie });
  assert.equal(send2.status, 201);
  const after = await J(`/api/leads/${leadB.id}`, {}, { Cookie: cookie }); assert.equal(after.j.lead.state, "SENT");
});

test("29: log hours for a NAME-ONLY roster worker — no account, no seat", async () => {
  const usersBefore = (await J("/api/users", {}, { Cookie: cookie })).j.length;
  const r = await J(`/api/leads/${leadB.id}/time`, { method: "POST", body: { worker_name: "Mike T.", labor_class_id: classId, entry_date: "2026-11-10", hours: 8, note: "field day" } }, { Cookie: cookie });
  assert.equal(r.status, 200); assert.equal(r.j.worker.name, "Mike T."); assert.equal(r.j.entry.amount, 304, "8h x $38 private Technician");
  const usersAfter = (await J("/api/users", {}, { Cookie: cookie })).j.length;
  assert.equal(usersAfter, usersBefore, "roster workers never burn seats");
  const workers = await J("/api/workers", {}, { Cookie: cookie });
  assert.ok(workers.j.some((w: any) => w.name === "Mike T." && !w.linked_user_id));
  const lab = await J(`/api/leads/${leadB.id}/labor`, {}, { Cookie: cookie });
  assert.equal(lab.j.entries[0].worker, "Mike T."); assert.ok(lab.j.crew.some((c: any) => c.name === "Mike T."), "logging auto-crews the worker");
});

test("29: bulk roster paste + weekly grid + roster timesheet + schedule by name", async () => {
  const bulk = await J("/api/workers/bulk", { method: "POST", body: { text: "Sam R.\nJoe P." } }, { Cookie: cookie });
  assert.equal(bulk.j.created_or_found, 2);
  const grid = await J("/api/time/grid", { method: "POST", body: { rows: [{ lead_id: leadB.id, worker_name: "Sam R.", entry_date: "2026-11-09", hours: 4 }] } }, { Cookie: cookie });
  assert.equal(grid.j.saved, 1);
  const ts = await J("/api/timesheets?week=2026-11-09", {}, { Cookie: cookie });
  assert.ok(ts.j.rows.some((r: any) => r.manager === "Mike T."), "timesheet exists for a roster worker by name");
  const sch = await J("/api/schedule", { method: "POST", body: { lead_id: leadB.id, worker_name: "Joe P.", work_date: "2026-11-12" } }, { Cookie: cookie });
  assert.equal(sch.status, 200); assert.ok(sch.j.worker_id, "scheduled without an account");
});

test("32: proposal options — sign page offers them, chosen option prices the job", async () => {
  const lead = await mkLead("Gamma Deli", "+15165550333", "Phase II ESA", 24000);
  const prop = await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbId, qty: 1 }], options: [{ name: "Standard", line_items: [{ price_book_item_id: pbId, qty: 1 }] }, { name: "With drilling", line_items: [{ price_book_item_id: pbId, qty: 2 }] }], valid_days: 30 } }, { Cookie: cookie });
  assert.equal(prop.status, 201); const opts = JSON.parse(prop.j.options); assert.equal(opts[1].total, 24000);
  const link = await J(`/api/proposals/${prop.j.id}/sign-link`, { method: "POST", body: {} }, { Cookie: cookie });
  const page = await (await fetch(`http://localhost:${port}/sign/${link.j.token}`)).text();
  assert.ok(page.includes("With drilling") && page.includes("Choose your option"), "sign page renders options");
  const after1 = await J(`/api/leads/${lead.id}`, {}, { Cookie: cookie });
  const v1 = dbm.db.prepare("SELECT view_count FROM proposals WHERE id=?").get(prop.j.id); assert.ok(v1.view_count >= 1, "view tracked");
  const form = new URLSearchParams({ signer_name: "Gus Gamma", signer_email: "g@x.co", typed_signature: "Gus Gamma", consent: "1", option: "With drilling" });
  const signed = await fetch(`http://localhost:${port}/sign/${link.j.token}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Connection: "close" }, body: form });
  assert.equal(signed.status, 200);
  const after = await J(`/api/leads/${lead.id}`, {}, { Cookie: cookie }); assert.equal(after.j.lead.state, "WON", "signing flips the lead to WON");
  const jobs = await J("/api/jobs", {}, { Cookie: cookie });
  const job = jobs.j.find((j: any) => j.lead_id === lead.id); assert.ok(job); assert.equal(job.value, 24000, "job priced by the CHOSEN option");
});

test("30/35: job stage moves both ways, packet sends, change order adds value", async () => {
  const jobs = await J("/api/jobs", {}, { Cookie: cookie });
  const job = jobs.j.find((j: any) => j.lead_id === leadA.id);
  let r = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "IN_PROGRESS" } }, { Cookie: cookie }); assert.equal(r.j.stage, "IN_PROGRESS");
  r = await J(`/api/jobs/${job.id}/stage`, { method: "POST", body: { to: "SCHEDULED" } }, { Cookie: cookie }); assert.equal(r.j.stage, "SCHEDULED", "job stages move backward too");
  const pkt = await J(`/api/jobs/${job.id}/packet`, { method: "POST", body: {} }, { Cookie: cookie }); assert.equal(pkt.status, 201); assert.ok(["test_mode", "sent", "delivered", "queued"].includes(pkt.j.status));
  const co = await J(`/api/jobs/${job.id}/change-orders`, { method: "POST", body: { delta_scope: "Extra boring", delta_total: 3000 } }, { Cookie: cookie });
  await J(`/api/change-orders/${co.j.id}/status`, { method: "POST", body: { status: "approved" } }, { Cookie: cookie });
  const after = await J(`/api/jobs/${job.id}`, {}, { Cookie: cookie }); assert.equal(after.j.job.value, 33000, "approved CO adds to job value (30000 + 3000)");
});

test("31: the queue surfaces approvals, untouched leads, overdue work — worst first", async () => {
  const fresh = await mkLead("Echo Untouched", "+15165550555", "Phase I ESA", 9000);
  dbm.db.prepare("UPDATE leads SET next_action_due_at='2020-01-01T00:00:00Z' WHERE id=?").run(leadB.id); // long overdue
  const q = await J("/api/queue", {}, { Cookie: cookie });
  assert.ok(q.j.total > 0);
  const scores = q.j.items.map((i: any) => i.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "sorted worst-first");
  assert.ok(q.j.items.some((i: any) => i.type === "lead_untouched" || i.type === "followup_overdue"));
});

test("33: inbox comments, claim, rules, canned replies", async () => {
  const ing = await J("/api/inbox/ingest", { method: "POST", body: { emails: [{ from_name: "DEC Officer", from_email: "officer@dec.ny.gov", subject: "Spill case documents", body: "Please send the closure report." }] } }, { Cookie: cookie });
  const items = await J("/api/inbox", {}, { Cookie: cookie });
  const item = items.j.find((i: any) => i.subject === "Spill case documents"); assert.ok(item);
  const c = await J(`/api/inbox/${item.id}/comments`, { method: "POST", body: { body: "Shehreyar owns this one — DEC wants it Friday." } }, { Cookie: cookie }); assert.equal(c.status, 201);
  const list = await J(`/api/inbox/${item.id}/comments`, {}, { Cookie: cookie }); assert.equal(list.j.length, 1);
  const claim = await J(`/api/inbox/${item.id}/claim`, { method: "POST", body: {} }, { Cookie: cookie }); assert.equal(claim.j.claimed_by, ownerId);
  const rule = await J("/api/inbox-rules", { method: "POST", body: { name: "DEC mail to owner", match_field: "sender", match_value: "dec.ny.gov", action: "assign", action_value: ownerId } }, { Cookie: cookie });
  assert.equal(rule.status, 201); assert.ok(rule.j.applied_now >= 1, "rule applies to the existing pile immediately");
  const canned = await J("/api/canned-replies", {}, { Cookie: cookie }); assert.ok(canned.j.length >= 4, "starter canned library seeded");
});

test("34: 12-touch cadence on business days + callbacks + rehash", async () => {
  const { DEFAULT_STEPS, addBusinessDays } = await import("../server/followups.ts");
  assert.equal(DEFAULT_STEPS.length, 12);
  const sat = new Date("2026-11-07T15:00:00Z"); // a Saturday
  const due = addBusinessDays(sat, 1); assert.ok(![0, 6].includes(due.getDay()), "follow-ups never land on weekends");
  const cb = await J(`/api/leads/${leadB.id}/callback`, { method: "POST", body: { due_at: "2020-01-01T00:00:00Z", note: "Call me Thursday" } }, { Cookie: cookie }); assert.equal(cb.status, 201);
  const q = await J("/api/queue", {}, { Cookie: cookie }); assert.ok(q.j.items.some((i: any) => i.type === "callback"));
  const lostLead = await mkLead("Delta Gym", "+15165550444", "Mold remediation", 5000);
  await J(`/api/leads/${lostLead.id}/stage`, { method: "POST", body: { to: "NO_RESPONSE", lost_reason: "unresponsive" } }, { Cookie: cookie });
  const re = await J("/api/reactivate", { method: "POST", body: { lead_ids: [lostLead.id] } }, { Cookie: cookie }); assert.equal(re.j.revived, 1);
  const after = await J(`/api/leads/${lostLead.id}`, {}, { Cookie: cookie }); assert.equal(after.j.lead.state, "WORKING");
});

test("36: board stats + weekly report v3 fields", async () => {
  const bs = await J("/api/board-stats", {}, { Cookie: cookie });
  assert.ok(bs.j.stages.WON.count >= 2); assert.ok("rotting" in bs.j.stages.NEW);
  const rep = await J("/api/status-report", {}, { Cookie: cookie });
  assert.ok("jobs_completed" in rep.j && "touches_made" in rep.j && "paperwork_outstanding" in rep.j);
  assert.ok(rep.j.text.includes("Jobs completed"));
});

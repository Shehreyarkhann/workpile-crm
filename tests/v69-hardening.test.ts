// v69 hardening: adversarial pass over the v68 workflow — every way the
// proposal gate or the operator actions could misbehave. Written against
// CORRECT behavior; failures here are findings.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
function client() {
  let cookie = "";
  return {
    async call(method: string, p: string, body?: any) {
      const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
      return { status: r.status, body: j };
    },
  };
}
const owner = client(); const pm = client(); const pm2 = client(); const other = client();
let wsId = ""; let pmId = ""; let seq = 7000;
const PW = ["v69", "pw", "5150"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v69-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts"); // side-effect import: boots schema + worker (no default export)
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await owner.call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner69@demo.test", password: PW, business_name: "V69 Builders" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await owner.call("POST", "/api/auth/login", { email: "owner69@demo.test", password: PW });
  const me = await owner.call("GET", "/api/auth/me"); wsId = me.body.user.workspace_id;
  const mkUser = async (c: any, name: string, email: string, role: string) => {
    const id = dbm.uid("usr");
    dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)").run(id, wsId, name, email, dbm.hashPassword(PW), role, dbm.now());
    const li = await c.call("POST", "/api/auth/login", { email, password: PW }); assert.equal(li.status, 200);
    return id;
  };
  pmId = await mkUser(pm, "Pete PM", "pm69@demo.test", "PROJECT_MANAGER");
  await mkUser(pm2, "Pauline PM", "pm269@demo.test", "PROJECT_MANAGER");
  const reg2 = await other.call("POST", "/api/auth/register", { name: "Oscar Other", email: "other69@demo.test", password: PW, business_name: "Other Co" });
  assert.equal(reg2.status, 201);
  await other.call("POST", "/api/auth/login", { email: "other69@demo.test", password: PW });
});

async function pmLeadAtProposal(c: any = pm): Promise<string> {
  const r = await c.call("POST", "/api/leads", { contact: { name: "Case " + seq, email: `case${seq}@v69.test`, phone: "555013" + (seq++) }, service_requested: "Roof Replacement", est_value: 8000 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.lead.id;
  dbm.db.prepare("UPDATE leads SET owner_id=? WHERE id=?").run(pmId, id);
  await c.call("POST", `/api/leads/${id}/stage`, { to: "PROPOSAL" });
  return id;
}
function leadEmail(leadId: string): string { const r = dbm.db.prepare("SELECT c.email FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE l.id=?").get(leadId) as any; return r.email; }
async function inboxFor(leadId: string, email: string, subject: string, body: string): Promise<string> {
  const ing = await owner.call("POST", "/api/inbox/ingest", { from_name: "Cust", from_email: email, subject, body });
  assert.equal(ing.status, 201, JSON.stringify(ing.body));
  const row = dbm.db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND subject=? ORDER BY rowid DESC").get(wsId, subject) as any;
  assert.ok(row, "inbox item " + subject); return row.id;
}

test("A: the /transition compat route enforces the same discipline as /stage", async () => {
  const leadId = await pmLeadAtProposal();
  let r = await pm.call("POST", `/api/leads/${leadId}/transition`, { to_state: "SENT" });
  assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error.code, "proposal_required");
  r = await pm.call("POST", `/api/leads/${leadId}/transition`, { to_state: "WON" });
  assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error.code, "won_needs_confirmation");
});

test("B: editing an approved proposal re-blocks Sent (content hash), exactly like send", async () => {
  const leadId = await pmLeadAtProposal();
  const dr = await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  const propId = dr.body.proposal.id;
  await pm.call("POST", `/api/proposals/${propId}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  await owner.call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  // untouched: the stage move passes now (control)
  // (do not move yet — edit first)
  dbm.db.prepare("UPDATE proposals SET total=total+500 WHERE id=?").run(propId);
  const r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error.code, "proposal_not_approved");
  const sr = await pm.call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  assert.equal(sr.status, 422, JSON.stringify(sr.body)); assert.equal(sr.body.error.code, "approval_invalidated", JSON.stringify(sr.body));
});

test("C: a newer draft supersedes the approved one — Sent blocked again", async () => {
  const leadId = await pmLeadAtProposal();
  const dr = await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  await pm.call("POST", `/api/proposals/${dr.body.proposal.id}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(dr.body.proposal.id) as any;
  await owner.call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {}); // v2 draft
  const r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error.code, "proposal_not_approved");
});

test("D: a rejected approval leaves Sent blocked", async () => {
  const leadId = await pmLeadAtProposal();
  const dr = await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  await pm.call("POST", `/api/proposals/${dr.body.proposal.id}/submit`, {});
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(dr.body.proposal.id) as any;
  await owner.call("POST", `/api/approvals/${pend.id}/decide`, { decision: "rejected", reason_code: "price_too_high" });
  const r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422, JSON.stringify(r.body));
});

test("E: scope — another PM cannot see, draft, or submit someone else's proposal work", async () => {
  const leadId = await pmLeadAtProposal();
  const q = await pm2.call("GET", "/api/queue");
  assert.equal((q.body.items || []).some((i: any) => i.lead_id === leadId && String(i.type).startsWith("proposal_")), false);
  let r = await pm2.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(r.status, 404, JSON.stringify(r.body));
  const dr = await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  r = await pm2.call("POST", `/api/proposals/${dr.body.proposal.id}/submit`, {});
  assert.equal(r.status, 404, JSON.stringify(r.body));
});

test("F: past dates never become actions, and forged past executions are refused", async () => {
  const leadId = await pmLeadAtProposal();
  const itemId = await inboxFor(leadId, leadEmail(leadId), "Old plan", "We had talked about scheduling the visit on 11/10/2025 at 10 am.");
  let r = await owner.call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  assert.equal((r.body.actions || []).filter((a: any) => a.kind !== "callback").length, 0, JSON.stringify(r.body.actions));
  const past = new Date(Date.now() - 86400000).toISOString();
  r = await owner.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: { kind: "schedule_visit", when: past, title: "Site visit", draft_line: "" } });
  assert.equal(r.status, 422, JSON.stringify(r.body)); assert.equal(r.body.error.code, "in_past");
});

test("G: executing the same action twice books it once", async () => {
  const leadId = await pmLeadAtProposal();
  const itemId = await inboxFor(leadId, leadEmail(leadId), "Timing", "Can we schedule the site visit for Friday morning?");
  const r = await owner.call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions));
  const e1 = await owner.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: a });
  const e2 = await owner.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: a });
  assert.equal(e1.status, 201); assert.equal(e2.status, 201);
  assert.equal(e2.body.created_id, e1.body.created_id);
  const n = (dbm.db.prepare("SELECT COUNT(*) c FROM site_visits WHERE lead_id=? AND scheduled_at=?").get(leadId, a.when) as any).c;
  assert.equal(n, 1);
});

test("H: February 30 is not a date — no action is offered", async () => {
  const leadId = await pmLeadAtProposal();
  const itemId = await inboxFor(leadId, leadEmail(leadId), "Odd date", "Can we schedule the site visit on February 30 at 10 am?");
  const r = await owner.call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  assert.equal((r.body.actions || []).length, 0, JSON.stringify(r.body.actions));
});

test("I/J/K/L: forged assignees are dropped, garbage times refused, unlinked items book tasks, date-less asks yield nothing", async () => {
  const leadId = await pmLeadAtProposal();
  const itemId = await inboxFor(leadId, leadEmail(leadId), "Hello", "Can we schedule the site visit for Friday morning?");
  const otherUser = dbm.db.prepare("SELECT id FROM users WHERE email='other69@demo.test'").get() as any;
  const future = new Date(Date.now() + 3 * 86400000).toISOString();
  let r = await owner.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: { kind: "schedule_visit", when: future, assignee_id: otherUser.id, title: "Site visit", draft_line: "" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const v = dbm.db.prepare("SELECT * FROM site_visits WHERE id=?").get(r.body.created_id) as any;
  assert.equal(v.assigned_to, null);
  r = await owner.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: { kind: "schedule_visit", when: "not-a-date", title: "x", draft_line: "" } });
  assert.equal(r.status, 422); assert.equal(r.body.error.code, "bad_when");
  // unlinked item → task, not a visit
  const free = await inboxFor("", "walkin@v69.test", "Meet?", "Can we schedule a meeting for Friday at 2 pm?");
  r = await owner.call("POST", `/api/inbox/${free}/actions`, { draft: "" });
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions));
  const ex = await owner.call("POST", `/api/inbox/${free}/actions/execute`, { action: a });
  // v70: an unlinked client booking creates the sender's record and books a
  // visit on it — a meeting never floats without a record to open.
  assert.equal(ex.body.created_kind, "site_visit", JSON.stringify(ex.body)); assert.equal(ex.body.record_created, true);
  // date-less scheduling ask → nothing
  const nd = await inboxFor("", "nodate@v69.test", "Sometime", "We should schedule a visit sometime soon, let me know.");
  r = await owner.call("POST", `/api/inbox/${nd}/actions`, { draft: "" });
  assert.equal((r.body.actions || []).length, 0, JSON.stringify(r.body.actions));
});

test("M: workspace timezone drives the math (Pacific/Kiritimati, UTC+14)", async () => {
  dbm.db.prepare("UPDATE workspaces SET tz='Pacific/Kiritimati', timezone='Pacific/Kiritimati' WHERE id=?").run(wsId);
  try {
    const itemId = await inboxFor("", "tz@v69.test", "TZ check", "Hello there.");
    const r = await owner.call("POST", `/api/inbox/${itemId}/actions`, { draft: "We can schedule tomorrow 9 am." });
    const a = (r.body.actions || []).find((x: any) => x.kind !== "callback");
    assert.ok(a, JSON.stringify(r.body.actions));
    const p: any = {};
    for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Kiritimati", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(new Date(a.when))) p[x.type] = x.value;
    const nowP: any = {};
    for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Kiritimati", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) nowP[x.type] = x.value;
    const exp = new Date(Date.UTC(+nowP.year, +nowP.month - 1, +nowP.day + 1));
    assert.equal(+p.day, exp.getUTCDate()); assert.equal(+p.hour, 9);
  } finally {
    dbm.db.prepare("UPDATE workspaces SET tz='America/New_York', timezone='America/New_York' WHERE id=?").run(wsId);
  }
});

test("N: another workspace's inbox item is invisible to the action routes", async () => {
  const itemId = await inboxFor("", "scope@v69.test", "Scoped", "Can we schedule the visit for Friday?");
  const r = await other.call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  assert.equal(r.status, 404);
  const r2 = await other.call("POST", `/api/inbox/${itemId}/actions/execute`, { action: { kind: "schedule_task", when: new Date(Date.now() + 86400000).toISOString(), title: "x" } });
  assert.equal(r2.status, 404);
});

// V4 (slices 37-46): Salesforce-parity CRM layer — conversion, feed, custom
// fields, campaigns, assignment rules, duplicates/merge, notes, calendar,
// search, favorites, report builder.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv4-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number, wsId = "", ownerId = "", repId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";
let dbm: any;
const mkLead = async (name: string, phone: string, svc: string, val: number, extra: any = {}) => (await J("/api/leads", { method: "POST", body: { contact: { name, phone, email: phone.replace(/\D/g, "") + "@x.co" }, service_requested: svc, est_value: val, ...extra } }, { Cookie: cookie })).j.lead;
let leadA: any, leadB: any;

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V4 Co", now());
  ownerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(ownerId, wsId, "Olivia Owner", "o@v4.co", hashPassword("password1"), "OWNER");
  repId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(repId, wsId, "Ryan Rep", "r@v4.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v4.co", password: "password1" } })).cookie;
  leadA = await mkLead("Alpha School District", "+15165550111", "Phase II ESA", 30000);
  leadB = await mkLead("Beta Realty LLC", "+15165550222", "Tank removal", 71400);
});

test("37: winning a lead converts it — customer + contact linked, idempotent", async () => {
  const r = await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, { Cookie: cookie });
  assert.equal(r.j.lead.state, "WON");
  const accs = (await J("/api/accounts", {}, { Cookie: cookie })).j;
  const mine = accs.filter((a: any) => a.name === "Alpha School District");
  assert.equal(mine.length, 1, "exactly one customer created");
  assert.equal(mine[0].jobs_count, 1, "the win's job hangs off the customer");
  const detail = (await J(`/api/accounts/${mine[0].id}`, {}, { Cookie: cookie })).j;
  assert.equal(detail.leads.length, 1); assert.equal(detail.contacts.length, 1); assert.equal(detail.contacts[0].is_customer, 1);
  const again = await J(`/api/leads/${leadA.id}/convert`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(again.j.account.id, mine[0].id, "re-convert returns the same customer");
});

test("38: feed posts, @mention + follow audience get notified", async () => {
  const before_ = dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=?").get(repId).c;
  const post = await J(`/api/feed/lead/${leadB.id}`, { method: "POST", body: { body: "@Ryan can you cover the site visit Thursday?" } }, { Cookie: cookie });
  assert.equal(post.status, 201); assert.equal(post.j.posts.length, 1);
  const after = dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=?").get(repId).c;
  assert.ok(after > before_, "mentioned user notified");
  const fol = await J(`/api/follow/lead/${leadB.id}`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(fol.j.following, true);
  const feed = (await J(`/api/feed/lead/${leadB.id}`, {}, { Cookie: cookie })).j;
  assert.equal(feed.following, true);
});

test("39: custom fields round-trip onto the record", async () => {
  const cf = await J("/api/custom-fields", { method: "POST", body: { object_type: "lead", label: "DEC Case Number", field_type: "text" } }, { Cookie: cookie });
  assert.equal(cf.status, 201); assert.equal(cf.j.key, "dec_case_number");
  const set = await J("/api/custom-values", { method: "POST", body: { object_type: "lead", entity_id: leadB.id, values: { dec_case_number: "2-2026-1187" } } }, { Cookie: cookie });
  assert.equal(set.j.custom.dec_case_number, "2-2026-1187");
  const detail = (await J(`/api/leads/${leadB.id}`, {}, { Cookie: cookie })).j;
  assert.equal(JSON.parse(detail.lead.custom || "{}").dec_case_number, "2-2026-1187", "value persisted on the lead row");
  const list = (await J("/api/custom-fields?object=lead", {}, { Cookie: cookie })).j;
  assert.ok(list.some((f: any) => f.key === "dec_case_number"));
});

test("41: campaigns track members, pipeline, revenue and ROI", async () => {
  const camp = await J("/api/campaigns", { method: "POST", body: { name: "Lapsed clients — fall", cost: 1000 } }, { Cookie: cookie });
  assert.equal(camp.status, 201);
  const add = await J(`/api/campaigns/${camp.j.id}/members`, { method: "POST", body: { lead_ids: [leadA.id, leadB.id] } }, { Cookie: cookie });
  assert.equal(add.j.added, 2);
  const detail = (await J(`/api/campaigns/${camp.j.id}`, {}, { Cookie: cookie })).j;
  assert.equal(detail.stats.members, 2);
  assert.equal(detail.stats.won, 1, "leadA already won");
  assert.equal(detail.stats.revenue, 30000);
  assert.equal(detail.stats.roi_pct, 2900, "(30000-1000)/1000 = 2900%");
});

test("43: assignment rules route new leads (user + round-robin)", async () => {
  await J("/api/assignment-rules", { method: "POST", body: { name: "Tanks to Olivia", field: "service", op: "contains", value: "tank", assign_mode: "user", assign_user_id: ownerId, sort: 1 } }, { Cookie: cookie });
  const l = await mkLead("Gamma Fuel Co", "+15165550333", "Underground tank testing", 9000);
  assert.equal(l.owner_id, ownerId, "rule assigned the tank lead to Olivia (default would be the first LEAD_OWNER)");
  const l2 = await mkLead("Delta Church", "+15165550444", "Mold Testing", 2000);
  assert.equal(l2.owner_id, repId, "non-matching lead keeps the default owner");
});

test("42: duplicates surface and merge into one survivor with all history", async () => {
  const dupe = await mkLead("Beta Realty LLC", "+15165550222", "Tank removal — second request", 5000, { source: "phone" });
  // createLead dedupes identical phone — force a true duplicate row the way an import race would
  let dupeId = dupe?.id;
  if (!dupeId || dupeId === leadB.id) {
    const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, "Beta Realty LLC", "+15165550222", "dup@x.co");
    dupeId = dbm.uid("lead"); dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(dupeId, wsId, cid, "15165550222", "Tank removal — second request", "NEW", 5000, dbm.now(), dbm.now());
    await J(`/api/leads/${dupeId}/stage`, { method: "POST", body: {} }, { Cookie: cookie }).catch(() => {});
    await J("/api/tasks", { method: "POST", body: { lead_id: dupeId, title: "Call about the second request", assignee_id: ownerId } }, { Cookie: cookie }).catch(() => {});
    dbm.db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,created_at) VALUES (?,?,?,?,?,?,?,?)").run(dbm.uid("tsk"), wsId, dupeId, ownerId, "follow_up", "Call about the second request", dbm.now(), dbm.now());
  }
  const groups = (await J("/api/duplicates", {}, { Cookie: cookie })).j;
  const g = groups.find((x: any) => x.leads.some((l: any) => l.id === leadB.id));
  assert.ok(g && g.leads.length >= 2, "duplicate group found for Beta");
  const m = await J(`/api/leads/${dupeId}/merge`, { method: "POST", body: { into_id: leadB.id } }, { Cookie: cookie });
  assert.equal(m.j.ok, true);
  const gone = dbm.db.prepare("SELECT state, merged_into_id FROM leads WHERE id=?").get(dupeId);
  assert.equal(gone.state, "DUPLICATE"); assert.equal(gone.merged_into_id, leadB.id);
  const tasks = dbm.db.prepare("SELECT COUNT(*) c FROM tasks WHERE lead_id=?").get(leadB.id).c;
  assert.ok(tasks >= 1, "the duplicate's tasks moved to the survivor");
});

test("44+40: notes attach to records; files view aggregates documents", async () => {
  const n = await J("/api/notes", { method: "POST", body: { entity_type: "lead", entity_id: leadB.id, title: "Access", body: "Gate code 4417, ask for Maria" } }, { Cookie: cookie });
  assert.equal(n.status, 201);
  const list = (await J(`/api/notes?entity_type=lead&entity_id=${leadB.id}`, {}, { Cookie: cookie })).j;
  assert.equal(list.length, 1); assert.ok(list[0].entity_label.includes("Beta"));
  const files = (await J("/api/files", {}, { Cookie: cookie })).j;
  assert.ok(Array.isArray(files));
});

test("40: calendar aggregates tasks and callbacks in range", async () => {
  await J(`/api/leads/${leadB.id}/callback`, { method: "POST", body: { due_at: new Date(Date.now() + 86400000).toISOString(), note: "Thursday call" } }, { Cookie: cookie });
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const ev = (await J(`/api/calendar?from=${from}&to=${to}`, {}, { Cookie: cookie })).j;
  assert.ok(ev.some((e: any) => e.kind === "callback"), "callback on the calendar");
  const tasksAll = (await J("/api/tasks-all?filter=open", {}, { Cookie: cookie })).j;
  assert.ok(tasksAll.length >= 1);
});

test("45: global search finds every object; favorites toggle", async () => {
  const s = (await J("/api/search?q=Beta", {}, { Cookie: cookie })).j;
  assert.ok(s.leads.length >= 1 && s.people.length >= 1, "search spans leads/people");
  const sa = (await J("/api/search?q=Alpha", {}, { Cookie: cookie })).j;
  assert.ok(sa.accounts.length >= 1, "search finds the converted customer account");
  const fav = await J("/api/favorites", { method: "POST", body: { entity_type: "lead", entity_id: leadB.id } }, { Cookie: cookie });
  assert.equal(fav.j.favorite, true);
  const favs = (await J("/api/favorites", {}, { Cookie: cookie })).j;
  assert.ok(favs.some((f: any) => f.entity_id === leadB.id && f.label.includes("Beta")));
});

test("46: report builder groups reconcile with the data; pins save", async () => {
  const r = await J("/api/reports/build", { method: "POST", body: { object_type: "leads", group_by: "state", metric: "count" } }, { Cookie: cookie });
  const won = r.j.rows.find((x: any) => x.key === "WON");
  assert.ok(won && won.count >= 1 && won.value >= 30000, "WON row carries count + value");
  const all = (await J("/api/leads?paged=1&page=1&page_size=1", {}, { Cookie: cookie })).j;
  const sum = r.j.rows.reduce((a: number, x: any) => a + x.count, 0);
  assert.equal(sum, all.total, "grouped counts reconcile with the lead total");
  const pin = await J("/api/dashboard-pins", { method: "POST", body: { title: "Leads by stage", object_type: "leads", group_by: "state", metric: "count" } }, { Cookie: cookie });
  assert.equal(pin.status, 201);
  const pins = (await J("/api/dashboard-pins", {}, { Cookie: cookie })).j;
  assert.equal(pins.length, 1);
});

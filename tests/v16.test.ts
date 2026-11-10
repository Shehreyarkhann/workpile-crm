// V16: customer timeline, queue bulk actions, agent orchestrator (rules planner, autonomy-respecting).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v16-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let WSID = ""; let OWNERID = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ck = "";
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  WSID = uid("ws"); OWNERID = uid("usr");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(WSID, "V16 Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(OWNERID, WSID, "Olive", "o@v16.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Pete PM", "p@v16.co", hashPassword("password1"), "PM");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ck = (await J("/api/auth/login", { method: "POST", body: { email: "o@v16.co", password: "password1" } })).cookie;
});
const A = () => ({ Cookie: ck });
const mkLead = async (name: string, svc: string, val: number) => (await J("/api/leads", { method: "POST", body: { contact: { name, email: name.toLowerCase() + "@x.co" }, service_requested: svc, est_value: val } }, A())).j.lead;

test("queue bulk: assign, snooze, and task across selected leads", async () => {
  const l1 = await mkLead("Bulk One", "Mold Testing", 1000); const l2 = await mkLead("Bulk Two", "Mold Testing", 2000);
  const pm = (await J("/api/users", {}, A())).j.find((u: any) => u.email === "p@v16.co");
  const as = await J("/api/queue/bulk", { method: "POST", body: { lead_ids: [l1.id, l2.id], action: "assign", assignee_id: pm.id } }, A());
  assert.equal(as.j.affected, 2);
  assert.equal(dbm.db.prepare("SELECT owner_id FROM leads WHERE id=?").get(l1.id).owner_id, pm.id);
  const sn = await J("/api/queue/bulk", { method: "POST", body: { lead_ids: [l1.id], action: "snooze", days: 3 } }, A());
  assert.equal(sn.j.affected, 1);
  const due = new Date(dbm.db.prepare("SELECT next_action_due_at FROM leads WHERE id=?").get(l1.id).next_action_due_at).getTime();
  assert.ok(due > Date.now() + 2 * 864e5, "snoozed ~3 days out");
  const tk = await J("/api/queue/bulk", { method: "POST", body: { lead_ids: [l1.id, l2.id], action: "task", title: "Bulk check-in" } }, A());
  assert.equal(tk.j.affected, 2);
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM tasks WHERE title='Bulk check-in'").get() as any).c, 2);
  assert.equal((await J("/api/queue/bulk", { method: "POST", body: { lead_ids: [l1.id], action: "assign", assignee_id: "nobody" } }, A())).status, 422);
});

test("orchestrator: plans at L1, executes drafts at L3, never sends", async () => {
  const lead = await mkLead("Qual Quinn", "Asbestos Survey", 4000);
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "QUALIFIED" } }, A());
  let r = await J("/api/agent/command", { method: "POST", body: { text: "Prepare proposals for all qualified leads missing one" } }, A());
  assert.equal(r.status, 201); assert.equal(r.j.intent, "prepare_proposals");
  const res1 = r.j.results.find((x: any) => x.tool === "prepare_proposals");
  assert.equal(res1.mode, "plan", "L1 default = plan only");
  assert.equal((dbm.db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(lead.id) as any).c, 0);
  dbm.db.prepare("UPDATE workspaces SET agent_level=3 WHERE id=?").run(WSID);
  r = await J("/api/agent/command", { method: "POST", body: { text: "Prepare proposals for all qualified leads missing one" } }, A());
  const res2 = r.j.results.find((x: any) => x.tool === "prepare_proposals");
  assert.equal(res2.mode, "executed");
  const prop = dbm.db.prepare("SELECT * FROM proposals WHERE lead_id=?").get(lead.id) as any;
  assert.ok(prop && prop.status === "draft" && !prop.sent_at, "draft created, never sent");
  const runs = await J("/api/agent/runs", {}, A());
  assert.ok(runs.j.length >= 2 && runs.j[0].planner === "rules-v1");
  const sweep = await J("/api/agent/command", { method: "POST", body: { text: "Get my business organized" } }, A());
  assert.equal(sweep.j.intent, "full_sweep"); assert.equal(sweep.j.results.length, 4);
});

test("customer timeline merges payments, jobs, messages chronologically", async () => {
  const lead = await mkLead("Tina Timeline", "Water Damage Repair", 5000);
  const pb = (await J("/api/price-book", { method: "POST", body: { name: "Repair", standard_price: 5000, floor_price: 4000 } }, A())).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.id, qty: 1 }] } }, A())).j;
  await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, A());
  const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,'deposit',500,'test','paid',?,?)").run(uid("pay"), WSID, prop.id, now(), now());
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, A());
  await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, A());
  const acc = (await J(`/api/leads/${lead.id}/convert`, { method: "POST", body: {} }, A())).j.account;
  const d = (await J("/api/accounts/" + acc.id, {}, A())).j;
  assert.ok(Array.isArray(d.timeline) && d.timeline.length >= 4, "timeline populated: " + d.timeline?.length);
  const kinds = d.timeline.map((t: any) => t.text).join(" | ");
  assert.match(kinds, /deposit paid/); assert.match(kinds, /Job created/);
  const times = d.timeline.map((t: any) => String(t.at));
  assert.deepEqual(times, [...times].sort().reverse(), "newest first");
});

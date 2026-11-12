// V61 — widget-to-master verification at the route level. The Home widgets
// are thin surfaces over the module routes; this suite pins the two
// mutation paths a user can trigger FROM a widget and proves the master
// data (queue, approvals, task record) moves with them:
//  1. Approving from the Approvals widget (POST /decide) removes the item
//     from /api/approvals AND from the Work Queue's approval items.
//  2. Completing from the Calendar widget (POST /api/calendar/complete)
//     writes back to the master task record.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v61-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);

const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v61", "pw", "9921"].join("-");
let ck = "", wsId = "", leadId = "", approvalId = "";

async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie");
  return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Ora O", email: "o@v61.test", password: PW, business_name: "O Co" });
  assert.equal(r.s, 201); ck = r.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, ck);
  wsId = me.j.user.workspace_id;
  // a lead + proposal + pending approval, seeded the way the routes leave them
  const cId = dbm.uid("ct"); leadId = dbm.uid("ld"); const pId = dbm.uid("pr"); approvalId = dbm.uid("ap");
  dbm.db.prepare("INSERT INTO contacts (id, workspace_id, name, email, phone) VALUES (?,?,?,?,?)").run(cId, wsId, "Vera Verify", "vera@v61.test", "6315550161");
  dbm.db.prepare("INSERT INTO leads (id, workspace_id, contact_id, service_requested, state, est_value, consent_contact_ok, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(leadId, wsId, cId, "Mold testing", "PROPOSAL", 4550, 1, dbm.now(), dbm.now());
  dbm.db.prepare("INSERT INTO proposals (id, workspace_id, lead_id, version, total, status, line_items, created_at) VALUES (?,?,?,?,?,?,?,?)").run(pId, wsId, leadId, 1, 4550, "draft", "[]", dbm.now());
  dbm.db.prepare("INSERT INTO approvals (id, workspace_id, lead_id, proposal_id, submitted_by, tier, decision, submitted_at) VALUES (?,?,?,?,?,?,NULL,?)").run(approvalId, wsId, leadId, pId, me.j.user.id, "standard", dbm.now());
});

test("the seeded approval is visible to BOTH widget sources (approvals + queue)", async () => {
  const a = await call("GET", "/api/approvals", undefined, ck);
  assert.equal(a.j.length, 1);
  assert.equal(a.j[0].contact_name, "Vera Verify");
  const q = await call("GET", "/api/queue", undefined, ck);
  const item = q.j.items.find((i: any) => i.type === "approval" && i.approval_id === approvalId);
  assert.ok(item, "queue carries the same approval");
});

test("decide (the widget's Approve) clears approvals AND the queue item, and stamps the record", async () => {
  const d = await call("POST", `/api/approvals/${approvalId}/decide`, { decision: "approved" }, ck);
  assert.equal(d.s, 200);
  const a = await call("GET", "/api/approvals", undefined, ck);
  assert.equal(a.j.length, 0);
  const q = await call("GET", "/api/queue", undefined, ck);
  assert.ok(!q.j.items.some((i: any) => i.approval_id === approvalId), "queue no longer carries it");
  const row = dbm.db.prepare("SELECT decision, decided_at FROM approvals WHERE id=?").get(approvalId) as any;
  assert.equal(row.decision, "approved");
  assert.ok(row.decided_at, "decision is timestamped");
});

test("calendar completion writes back to the master task", async () => {
  const t = await call("POST", "/api/tasks", { lead_id: leadId, title: "Verify the widget write-back", type: "follow_up", due_at: new Date().toISOString() }, ck);
  assert.equal(t.s, 201);
  const taskId = t.j.id || t.j.task?.id;
  assert.ok(taskId, "task created");
  const c = await call("POST", "/api/calendar/complete", { kind: "task", ref_id: taskId }, ck);
  assert.equal(c.s, 200);
  const row = dbm.db.prepare("SELECT status FROM tasks WHERE id=?").get(taskId) as any;
  assert.notEqual(row.status, "open", "master task record moved off open");
});

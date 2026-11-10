// Slice 27: Weekly Status Report must count REAL production values.
// Regression: finalizeLead writes outcomes lowercase ('won' via OUTCOME_OF) and the
// decide handler stores decisions lowercase ('approved'); the report originally
// matched uppercase, so a live pilot showed 0 won / 0% approved. This test seeds
// the production-shaped rows and asserts the counts.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test27-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T27 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t27.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  const login = await J("/api/auth/login", { method: "POST", body: { email: "o@t27.co", password: "password1" } });
  cookie = login.cookie;
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Won Cust", phone: "+15165550444", email: "wc@t27.co" }, service_requested: "Phase II ESA", est_value: 24500 } }, { Cookie: cookie });
  const leadId = lead.j.lead.id;
  // production-shaped rows: lowercase outcome (OUTCOME_OF) + lowercase decision (decide handler)
  dbm.db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,created_at) VALUES (?,?,?,?,?,?)").run(uid("od"), ws, leadId, "won", "h", now());
  dbm.db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,created_at) VALUES (?,?,?,?,?,?)").run(uid("od"), ws, leadId, "lost", "h", now());
  dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,submitted_by,approver_id,decision,decided_at,submitted_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("apr"), ws, leadId, owner, owner, "approved", now(), now());
  dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,submitted_by,approver_id,decision,decided_at,submitted_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("apr"), ws, leadId, owner, owner, "rejected", now(), now());
});

test("weekly report counts lowercase production outcomes and decisions", async () => {
  const r = await J("/api/status-report", {}, { Cookie: cookie });
  assert.equal(r.status, 200);
  assert.equal(r.j.won.count, 1, "won counted");
  assert.equal(r.j.won.value, 24500, "won value from lead est_value");
  assert.equal(r.j.lost.count, 1, "lost counted");
  assert.equal(r.j.approvals.decided, 2);
  assert.equal(r.j.approvals.approved, 1, "approved counted");
  assert.equal(r.j.approvals.rate, 50, "approval rate computed");
});

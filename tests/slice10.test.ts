// Slice 10: My Day endpoint — personal queue aggregation.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test10-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T10 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Olive Owner", "o@t10.co", hashPassword("password1"), "OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t10.co", password: "password1" } })).cookie;
});

test("myday aggregates overdue tasks, due leads, wins; completing a task clears it", async () => {
  const G = (globalThis as any).__; const { uid, now } = dbm;
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Day Dana", email: "dana@x.co" }, service_requested: "Mold remediation", message: "x", owner_id: G.owner } }, { Cookie: cookie });
  const leadId = c.j.lead.id;
  dbm.db.prepare("UPDATE leads SET next_action='Call back', next_action_due_at='2020-06-01T00:00:00.000Z' WHERE id=?").run(leadId);
  const t1 = uid("tsk"); dbm.db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(t1, G.ws, leadId, G.owner, "call", "Call Dana", "2020-06-01T00:00:00.000Z", "open", now());
  const d1 = await J("/api/myday", {}, { Cookie: cookie });
  assert.equal(d1.j.overdue_tasks.length, 1); assert.equal(d1.j.overdue_tasks[0].contact_name, "Day Dana");
  assert.equal(d1.j.my_leads_due.length, 1);
  assert.equal(typeof d1.j.wins_week.value, "number");
  const done = await J(`/api/tasks/${t1}/complete`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(done.j.ok, true);
  const d2 = await J("/api/myday", {}, { Cookie: cookie });
  assert.equal(d2.j.overdue_tasks.length, 0);
});

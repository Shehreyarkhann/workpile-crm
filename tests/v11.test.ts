// V11 (transformation tranche 5): autonomy levels L0–L4 + agent acceptance metrics (§16).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv11-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", wsId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V11 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Olivia Owner", "o@v11.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Larry Lead", "l@v11.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v11.co", password: "password1" } })).cookie;
});

test("levels gate execution: L0 observes, L3 executes the armed automations", async () => {
  await J("/api/ai/automations", { method: "POST", body: { auto_assign: true } }, { Cookie: cookie });
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Gate Gail", phone: "+15165550181", email: "gail@x.co" }, service_requested: "Phase I", est_value: 2000 } }, { Cookie: cookie })).j.lead;
  dbm.db.prepare("UPDATE leads SET owner_id=NULL WHERE id=?").run(lead.id);
  await J("/api/ai/autonomy", { method: "PATCH", body: { level: 0 } }, { Cookie: cookie });
  const run0 = (await J("/api/ai/automations/run", { method: "POST", body: {} }, { Cookie: cookie })).j;
  assert.equal(run0.result.mode, "observe");
  const after0 = dbm.db.prepare("SELECT owner_id FROM leads WHERE id=?").get(lead.id) as any;
  assert.equal(after0.owner_id, null, "L0 changed nothing");
  await J("/api/ai/autonomy", { method: "PATCH", body: { level: 3 } }, { Cookie: cookie });
  const run3 = (await J("/api/ai/automations/run", { method: "POST", body: {} }, { Cookie: cookie })).j;
  assert.equal(run3.result.mode, "execute");
  const after3 = dbm.db.prepare("SELECT owner_id FROM leads WHERE id=?").get(lead.id) as any;
  assert.ok(after3.owner_id, "L3 applied the assignment automation");
});

test("autonomy changes are settings-gated and audited", async () => {
  const lo = (await J("/api/auth/login", { method: "POST", body: { email: "l@v11.co", password: "password1" } })).cookie;
  const denied = await J("/api/ai/autonomy", { method: "PATCH", body: { level: 4 } }, { Cookie: lo });
  assert.equal(denied.status, 403);
  const rows = dbm.db.prepare("SELECT COUNT(*) c FROM audit_log WHERE action='agent.level_changed'").get() as any;
  assert.ok(rows.c >= 2, "level changes are in the audit log");
});

test("migration: workspaces that had autonomous sending on keep it (level 4)", async () => {
  const { uid, now } = dbm;
  const ws2 = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at,followup_enabled,auto_score) VALUES (?,?,?,1,1)").run(ws2, "Legacy Sender", now());
  dbm.initSchema();
  const w = dbm.db.prepare("SELECT agent_level FROM workspaces WHERE id=?").get(ws2) as any;
  assert.equal(w.agent_level, 4);
});

test("first touch is an L4 action: silent at L3, sends at L4", async () => {
  dbm.db.prepare("UPDATE workspaces SET followup_enabled=1 WHERE id=?").run(wsId);
  await J("/api/ai/autonomy", { method: "PATCH", body: { level: 3 } }, { Cookie: cookie });
  const l3 = (await J("/api/leads", { method: "POST", body: { contact: { name: "Touch Tim", phone: "+15165550182", email: "tim@x.co" }, service_requested: "Mold", est_value: 900 } }, { Cookie: cookie })).j.lead;
  await new Promise(r => setTimeout(r, 400));
  const at3 = dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=? AND subject LIKE 'We got your request%'").get(l3.id) as any;
  assert.equal(at3.c, 0, "no autonomous customer send below L4");
  await J("/api/ai/autonomy", { method: "PATCH", body: { level: 4 } }, { Cookie: cookie });
  const l4 = (await J("/api/leads", { method: "POST", body: { contact: { name: "Touch Tina", phone: "+15165550183", email: "tina@x.co" }, service_requested: "Mold", est_value: 900 } }, { Cookie: cookie })).j.lead;
  await new Promise(r => setTimeout(r, 400));
  const at4 = dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=? AND subject LIKE 'We got your request%'").get(l4.id) as any;
  assert.equal(at4.c, 1, "L4 sends the pre-approved first touch");
});

test("acceptance metrics: runs, actions, FPAR, merges — with the estimate labeled", async () => {
  const m = (await J("/api/ai/metrics", {}, { Cookie: cookie })).j;
  assert.ok(m.runs_30d.automation >= 1, "automation runs counted");
  assert.ok(typeof m.actions_applied_30d === "number");
  assert.ok(m.time_saved_basis.includes("ESTIMATE"), "time-saved is labeled an estimate, never presented as measured");
});

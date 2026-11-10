// V6: home command center aggregate — activity series, upcoming, agent state.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv6-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", leadA: any;

before(async () => {
  const dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V6 Co", now());
  const ownerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(ownerId, wsId, "Olivia Owner", "o@v6.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("UPDATE workspaces SET auto_score=1, auto_assign=1 WHERE id=?").run(wsId);
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v6.co", password: "password1" } })).cookie;
  leadA = (await J("/api/leads", { method: "POST", body: { contact: { name: "Home Lead", phone: "+15165550131", email: "h@x.co" }, service_requested: "Mold Testing", est_value: 5000 } }, { Cookie: cookie })).j.lead;
  await J("/api/tasks", { method: "POST", body: { lead_id: leadA.id, title: "Home task", assignee_id: ownerId, due_at: new Date().toISOString() } }, { Cookie: cookie });
});

test("home aggregate: 30-day series, upcoming, recent, agent state, north star", async () => {
  const h = (await J("/api/home", {}, { Cookie: cookie })).j;
  assert.equal(h.activity_series.length, 30, "30 days of activity");
  assert.ok(h.activity_series[29].count >= 1, "today has activity (lead + task created events)");
  assert.ok(h.upcoming.some((u: any) => u.title === "Home task" && u.kind === "task"), "upcoming includes today's task");
  assert.ok(h.recently_assigned.some((l: any) => l.id === leadA.id), "recent includes the new lead");
  assert.equal(h.agent.active_count, 2, "two automations on");
  assert.ok(Array.isArray(h.agent.runs));
  assert.equal(typeof h.proposals_sent_week, "number");
  const unauth = await J("/api/home");
  assert.equal(unauth.status, 401);
});

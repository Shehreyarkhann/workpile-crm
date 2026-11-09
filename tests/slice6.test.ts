// Slice 6 tests: multi-tenant register/isolation/switch, lead sync with dedupe, AI cleanup
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test6-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, app: any, srv: any, port: number;
const J = async (p: string, o: any = {}, cookie = "") => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...(cookie ? { Cookie: cookie } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  app = (await import("../server/app.ts")).app;
  srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
});

test("register creates a tenant; tenants are isolated; switch works", async () => {
  const a = await J("/api/auth/register", { method: "POST", body: { name: "Ann A", email: "a@tenant.co", password: "password1", business_name: "A Co" } });
  assert.equal(a.status, 201); assert.ok(a.cookie);
  const b = await J("/api/auth/register", { method: "POST", body: { name: "Bob B", email: "b@tenant.co", password: "password1", business_name: "B Co" } });
  assert.equal(b.status, 201);
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Only A", phone: "+15165551111", email: "oa@x.co" }, service_requested: "Water damage cleanup", est_value: 1000, message: "x", location: "y" } }, a.cookie);
  assert.equal(lead.status, 201);
  const bLeads = await J("/api/leads", {}, b.cookie);
  assert.equal(bLeads.j.length, 0); // B sees none of A's data
  const aLeads = await J("/api/leads", {}, a.cookie);
  assert.equal(aLeads.j.length, 1);
  // second workspace for A + switch
  const ws2 = await J("/api/workspaces", { method: "POST", body: { name: "A Second Business" } }, a.cookie);
  assert.equal(ws2.status, 201);
  const inSecond = await J("/api/leads", {}, a.cookie);
  assert.equal(inSecond.j.length, 0); // switched: new workspace is empty
  const list = await J("/api/workspaces", {}, a.cookie);
  assert.equal(list.j.workspaces.length, 2);
  const first = list.j.workspaces.find((w: any) => w.name === "A Co");
  const back = await J("/api/workspaces/switch", { method: "POST", body: { workspace_id: first.workspace_id } }, a.cookie);
  assert.equal(back.j.ok, true);
  const again = await J("/api/leads", {}, a.cookie);
  assert.equal(again.j.length, 1);
});

test("sync pulls from source by range and dedupes on re-run", async () => {
  const a = await J("/api/auth/login", { method: "POST", body: { email: "a@tenant.co", password: "password1" } });
  const r1 = await J("/api/sync/run", { method: "POST", body: { from: new Date(Date.now() - 90 * 86400000).toISOString(), to: new Date().toISOString() } }, a.cookie);
  assert.equal(r1.status, 200); assert.ok(r1.j.fetched >= 20); assert.ok(r1.j.created >= 15);
  const r2 = await J("/api/sync/run", { method: "POST", body: { from: new Date(Date.now() - 90 * 86400000).toISOString(), to: new Date().toISOString() } }, a.cookie);
  assert.equal(r2.j.created, 0); assert.equal(r2.j.duplicates, r2.j.fetched); // full dedupe on re-run
});

test("AI cleanup: preview finds direct-inserted duplicates + spam; apply archives and scores", async () => {
  const a = await J("/api/auth/login", { method: "POST", body: { email: "a@tenant.co", password: "password1" } });
  const wsRow = dbm.db.prepare("SELECT workspace_id FROM users WHERE email='a@tenant.co'").get();
  const ws = wsRow.workspace_id;
  const mk = (name: string, phone: string, notes: string) => { const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, name, phone, ""); const id = dbm.uid("lead"); dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,est_value,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, ws, cid, phone.replace(/\D/g, ""), "Roofing", "NEW", 5000, notes, dbm.now(), dbm.now()); return id; };
  mk("Dup One", "+15165557777", "roof leak"); mk("Dup Two", "+15165557777", "roof leak again");
  mk("Spammy", "", "free money casino crypto giveaway");
  const prev = await J("/api/ai/cleanup/preview", { method: "POST", body: {} }, a.cookie);
  assert.ok(prev.j.duplicate_count >= 1); assert.ok(prev.j.spam_count >= 1);
  const applied = await J("/api/ai/cleanup/apply", { method: "POST", body: { actions: ["dedupe", "spam", "score"] } }, a.cookie);
  assert.ok(applied.j.archived_duplicates >= 1); assert.ok(applied.j.marked_spam >= 1); assert.ok(applied.j.scored >= 10);
  const scored = dbm.db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND ai_score IS NOT NULL").get(ws);
  assert.ok(scored.c >= 10);
  const ins = await J("/api/ai/insights", {}, a.cookie);
  assert.ok(Array.isArray(ins.j));
});

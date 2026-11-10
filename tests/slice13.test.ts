// Slice 13 (Tier 3): forecast math + at-risk detection, speed-to-lead missed-call flow.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test13-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number, apiKey = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T13 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t13.co", hashPassword("password1"), "OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t13.co", password: "password1" } })).cookie;
  apiKey = "lf_test_slice13key123456";
  dbm.db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run(dbm.uid("key"), (globalThis as any).__ .ws, "phone-system", dbm.apiKeyHash(apiKey), "leads:write,leads:read");
});

test("forecast: stage-weighted pipeline + at-risk cold proposals + intel", async () => {
  const G = (globalThis as any).__; const { uid, now } = dbm;
  const c = await J("/api/leads", { method: "POST", body: { contact: { name: "Risky Rick", phone: "+15165550701", email: "rick@x.co" }, service_requested: "Mold remediation", message: "x", owner_id: G.owner } }, { Cookie: cookie });
  const leadId = c.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state='SENT', est_value=10000 WHERE id=?").run(leadId);
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,total,sent_at,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("prop"), G.ws, leadId, 1, "sent", 10000, "2026-10-20T00:00:00.000Z", "2026-10-20T00:00:00.000Z");
  const f = await J("/api/forecast", {}, { Cookie: cookie });
  assert.equal(f.j.raw_pipeline, 10000);
  assert.equal(f.j.weighted_pipeline, 8000); // SENT weight 0.80 (v3)
  assert.equal(f.j.at_risk.length, 1); assert.equal(f.j.at_risk[0].contact_name, "Risky Rick");
  assert.ok(f.j.at_risk[0].days_waiting >= 4);
});

test("speed-to-lead: missed call → lead + instant text-back; second call attaches, never duplicates", async () => {
  assert.ok(apiKey, "api key minted");
  const auth = { Authorization: `Bearer ${apiKey}` };
  const r1 = await J("/v1/missed-call", { method: "POST", body: { phone: "+15165550777", name: "Missed Mike" } }, auth);
  assert.equal(r1.status, 201); assert.equal(r1.j.created, true); assert.equal(r1.j.text_back_status, "test_mode"); // honest: no Twilio keys in tests
  const msgs = await J(`/api/leads/${r1.j.lead_id}/messages`, {}, { Cookie: cookie });
  assert.ok(msgs.j.some((m: any) => String(m.body).includes("sorry we missed your call")));
  const r2 = await J("/v1/missed-call", { method: "POST", body: { phone: "+15165550777" } }, auth);
  assert.equal(r2.status, 200); assert.equal(r2.j.created, false); assert.equal(r2.j.lead_id, r1.j.lead_id);
  const noKey = await J("/v1/missed-call", { method: "POST", body: { phone: "+15165550778" } });
  assert.ok(noKey.status === 401 || noKey.status === 403);
});

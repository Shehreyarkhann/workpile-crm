// Slice 11 (Tier 1): bulk actions, two-way SMS inbound threading, push status.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test11-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = ""; const ids: string[] = [];

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T11 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t11.co", hashPassword("password1"), "OWNER");
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t11.co", password: "password1" } })).cookie;
  const phones = ["+15165550444", "+15165550445", "+15165550446"];
  for (const [i, n] of ["Bulk One", "Bulk Two", "Bulk Three"].entries()) {
    const c = await J("/api/leads", { method: "POST", body: { contact: { name: n, phone: phones[i], email: n.replace(" ", ".") + "@x.co" }, service_requested: "Mold remediation", message: "x" } }, { Cookie: cookie });
    ids.push(c.j.lead.id);
  }
});

test("bulk: assign + advance + snooze across many leads at once", async () => {
  const G = (globalThis as any).__;
  const a = await J("/api/leads/bulk", { method: "POST", body: { ids, action: "assign", owner_id: G.owner } }, { Cookie: cookie });
  assert.equal(a.j.ok, 3);
  const adv = await J("/api/leads/bulk", { method: "POST", body: { ids: [ids[0]], action: "advance" } }, { Cookie: cookie });
  assert.equal(adv.j.ok, 1);
  const l = await J(`/api/leads/${ids[0]}`, {}, { Cookie: cookie });
  assert.equal(l.j.lead.state, "WORKING"); // v3: NEW advances to WORKING (was TRIAGED)
  const snz = await J("/api/leads/bulk", { method: "POST", body: { ids: [ids[1]], action: "snooze", days: 7 } }, { Cookie: cookie });
  assert.equal(snz.j.ok, 1);
  const bad = await J("/api/leads/bulk", { method: "POST", body: { ids: [ids[2]], action: "advance" } }, { Cookie: cookie });
  assert.equal(bad.j.ok, 1); // NEW → WORKING (v3)
});

test("two-way texting: a customer SMS reply threads onto the lead and stops the cadence", async () => {
  const G = (globalThis as any).__; const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("fup"), G.ws, ids[0], uid("prop"), 0, now(), "active", now(), now());
  const form = new URLSearchParams({ From: "+1 (516) 555-0444", Body: "Yes — Thursday morning works for the visit." });
  const r = await fetch(`http://localhost:${port}/webhooks/twilio/inbound`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Connection: "close" }, body: form.toString() });
  assert.equal(r.status, 200); await r.text();
  // the reply must match the lead whose phone texted (ids[0] owns +15165550444)
  const msgs = await J(`/api/leads/${ids[0]}/messages`, {}, { Cookie: cookie });
  const inbound = msgs.j.find((m: any) => m.direction === "in");
  assert.ok(inbound && inbound.body.includes("Thursday morning"));
  const f = await J(`/api/leads/${ids[0]}/followups`, {}, { Cookie: cookie });
  assert.equal(f.j[0].status, "stopped"); assert.equal(f.j[0].stop_reason, "customer_replied");
  const notifs = await J("/api/notifications", {}, { Cookie: cookie });
  assert.ok(notifs.j.notifications.some((n: any) => n.type === "message.reply"));
});

test("push: status is honest without VAPID keys; subscribe validates shape", async () => {
  const k = await J("/api/push/key", {}, { Cookie: cookie });
  assert.equal(k.j.configured, false); assert.equal(k.j.public_key, null);
  const bad = await J("/api/push/subscribe", { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(bad.status, 422);
  const good = await J("/api/push/subscribe", { method: "POST", body: { subscription: { endpoint: "https://push.example/abc", keys: { p256dh: "x", auth: "y" } } } }, { Cookie: cookie });
  assert.equal(good.j.ok, true);
});

// V10 (transformation tranche 4): durable jobs, generalized outbox, object storage attachments,
// health/monitoring, audited impersonation (§§19–23).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv10-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", adminCookie = "", ownerId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V10 Co", now());
  ownerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(ownerId, wsId, "Olivia Owner", "o@v10.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,is_platform_admin) VALUES (?,?,?,?,?,?,1)").run(uid("usr"), wsId, "Adam Admin", "a@v10.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v10.co", password: "password1" } })).cookie;
  adminCookie = (await J("/api/auth/login", { method: "POST", body: { email: "a@v10.co", password: "password1" } })).cookie;
});

test("durable jobs: handlers run, failures retry with backoff, poison jobs dead-letter", async () => {
  const { enqueueJob, processJobs } = await import("../server/jobs.ts");
  enqueueJob("ok.job", { n: 1 });
  enqueueJob("bad.job", {});
  const seen: any[] = [];
  const r1 = await processJobs({ "ok.job": async (p: any) => { seen.push(p.n); }, "bad.job": async () => { throw new Error("boom"); } });
  assert.equal(r1.done, 1); assert.equal(r1.failed, 1); assert.deepEqual(seen, [1]);
  const bad = dbm.db.prepare("SELECT * FROM background_jobs WHERE kind='bad.job'").get() as any;
  assert.equal(bad.status, "queued"); assert.equal(bad.attempts, 1); assert.ok(bad.run_after > new Date().toISOString(), "backoff scheduled");
  // force due + exhaust attempts
  for (let i = 0; i < 5; i++) { dbm.db.prepare("UPDATE background_jobs SET run_after='2020-01-01' WHERE kind='bad.job'").run(); await processJobs({ "bad.job": async () => { throw new Error("boom"); } }); }
  const dead = dbm.db.prepare("SELECT * FROM background_jobs WHERE kind='bad.job'").get() as any;
  assert.equal(dead.status, "dead");
  // notify() now enqueues a durable push job instead of fire-and-forget
  const { notify } = await import("../server/comms.ts");
  const wsRow = dbm.db.prepare("SELECT id FROM workspaces LIMIT 1").get() as any;
  notify(wsRow.id, [ownerId], "test.ping", "Hello", "Durable push");
  const push = dbm.db.prepare("SELECT * FROM background_jobs WHERE kind='push.notify' ORDER BY created_at DESC").get() as any;
  assert.ok(push && push.status === "queued", "push notification is a durable queued job");
});

test("outbox: domain events recorded with the write, relayed by the worker pass", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Outbox Olga", phone: "+15165550171", email: "olga@x.co" }, service_requested: "Phase I", est_value: 3000 } }, { Cookie: cookie })).j.lead;
  const ev = dbm.db.prepare("SELECT * FROM outbox_events WHERE type='lead.created' AND entity_id=?").get(lead.id) as any;
  assert.ok(ev && !ev.processed_at, "lead.created recorded in the outbox, unprocessed");
  const { relayOutbox, outboxPending } = await import("../server/outbox.ts");
  assert.ok(outboxPending() >= 1);
  relayOutbox();
  const after = dbm.db.prepare("SELECT processed_at FROM outbox_events WHERE id=?").get(ev.id) as any;
  assert.ok(after.processed_at, "relay marked it processed");
});

test("attachments: upload → list → download → delete through the storage adapter", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Attach Andy", phone: "+15165550172", email: "andy@x.co" }, service_requested: "Manifest", est_value: 1000 } }, { Cookie: cookie })).j.lead;
  const up = await J("/api/attachments", { method: "POST", body: { entity_type: "lead", entity_id: lead.id, name: "manifest.txt", mime: "text/plain", data_base64: Buffer.from("signed manifest v1").toString("base64") } }, { Cookie: cookie });
  assert.equal(up.status, 201);
  const list = (await J(`/api/attachments?entity_type=lead&entity_id=${lead.id}`, {}, { Cookie: cookie })).j;
  assert.equal(list.length, 1); assert.equal(list[0].name, "manifest.txt");
  const dl = await fetch(`http://localhost:${port}/api/attachments/${up.j.id}/download`, { headers: { Cookie: cookie } });
  assert.equal(await dl.text(), "signed manifest v1");
  await J(`/api/attachments/${up.j.id}`, { method: "DELETE" }, { Cookie: cookie });
  const gone = await fetch(`http://localhost:${port}/api/attachments/${up.j.id}/download`, { headers: { Cookie: cookie } });
  assert.equal(gone.status, 404);
});

test("impersonation: audited, banner-visible, time-boxed, exit restores the admin", async () => {
  const denied = await J("/api/admin/impersonate", { method: "POST", body: { user_id: ownerId } }, { Cookie: cookie });
  assert.equal(denied.status, 403, "workspace owners cannot impersonate — platform admins only");
  const start = await J("/api/admin/impersonate", { method: "POST", body: { user_id: ownerId } }, { Cookie: adminCookie });
  assert.equal(start.status, 200);
  const impCookie = start.cookie;
  assert.ok(impCookie.startsWith("lf_session="));
  const me = (await J("/api/auth/me", {}, { Cookie: impCookie })).j;
  assert.equal(me.user.id, ownerId, "acting as the target user");
  assert.ok(me.user.impersonation && me.user.impersonation.by_name === "Adam Admin", "impersonation is visible in /me (drives the banner)");
  const exit = await J("/api/auth/impersonation/exit", { method: "POST", body: {} }, { Cookie: impCookie });
  assert.equal(exit.status, 200);
  const back = (await J("/api/auth/me", {}, { Cookie: exit.cookie })).j;
  assert.equal(back.user.email, "a@v10.co", "exit restored the admin session");
  assert.equal(back.user.impersonation, null);
  const audits = dbm.db.prepare("SELECT action FROM audit_log WHERE action LIKE 'impersonation%' ORDER BY created_at").all() as any[];
  assert.deepEqual(audits.map((a: any) => a.action), ["impersonation.start", "impersonation.stop"]);
});

test("monitoring: health/deep is public and honest; platform stats are admin-only", async () => {
  const deep = (await J("/api/health/deep")).j;
  assert.equal(deep.ok, true); assert.ok(deep.jobs && typeof deep.outbox_pending === "number");
  const denied = await J("/api/admin/platform", {}, { Cookie: cookie });
  assert.equal(denied.status, 403);
  const plat = (await J("/api/admin/platform", {}, { Cookie: adminCookie })).j;
  assert.ok(plat.workspaces >= 1 && plat.users >= 2 && plat.jobs);
});

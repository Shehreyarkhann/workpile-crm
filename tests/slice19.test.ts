// Slice 19: inbox actions — non-lead mail as a workable queue with AI playbooks.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test19-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", clientItem = "", vendorItem = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T19 Environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t19.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Ops", "ops@t19.co", hashPassword("password1"), "OPS_ADMIN");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t19.co", password: "password1" } })).cookie;
  await J("/api/inbox/ingest", { method: "POST", body: { emails: [
    { from_name: "Maria Client", from_email: "maria@home.co", subject: "Question about my job", body: "Hi, when is the technician coming for our project? We need an update on the scheduled visit." },
    { from_name: "Supply House", from_email: "orders@supply.co", subject: "Order confirmation", body: "Your material order is confirmed; delivery scheduled Friday." },
  ] } }, { Cookie: cookie });
  const inbox = await J("/api/inbox", {}, { Cookie: cookie });
  clientItem = inbox.j.find((i: any) => i.category === "client_active_job").id;
  vendorItem = inbox.j.find((i: any) => i.category === "vendor").id;
});

test("non-lead mail lands as owned inbox items; important mail notifies owners once", async () => {
  const inbox = await J("/api/inbox", {}, { Cookie: cookie });
  assert.equal(inbox.j.length, 2);
  const ci = inbox.j.find((i: any) => i.id === clientItem);
  assert.ok(ci.owner_id && ci.suggestion_action && ci.status === "open");
  const notes = await J("/api/notifications", {}, { Cookie: cookie });
  assert.ok((notes.j.notifications || notes.j).some((n: any) => n.type === "inbox_important"));
  const md = await J("/api/myday", {}, { Cookie: cookie });
  assert.ok(md.j.inbox_count >= 1);
});

test("AI playbook: client draft greets the sender and names the business", async () => {
  const s = await J(`/api/inbox/${clientItem}/suggestion`, {}, { Cookie: cookie });
  assert.match(s.j.action, /Reply to the client/);
  assert.ok(s.j.draft_body.includes("Hi Maria")); assert.ok(s.j.draft_body.includes("T19 Environmental"));
});

test("reply sends (test mode), closes the item; snooze + reopen lifecycle works", async () => {
  const r = await J(`/api/inbox/${clientItem}/reply`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(r.j.sent, true); assert.equal(r.j.status, "test_mode");
  const out = dbm.db.prepare("SELECT * FROM messages_outbox WHERE to_addr='maria@home.co'").get() as any;
  assert.ok(out && String(out.body).includes("Hi Maria"));
  let inbox = await J("/api/inbox", {}, { Cookie: cookie });
  assert.equal(inbox.j.find((i: any) => i.id === clientItem).status, "done");
  const sn = await J(`/api/inbox/${vendorItem}`, { method: "PATCH", body: { snooze_days: 3 } }, { Cookie: cookie });
  assert.ok(new Date(sn.j.next_action_due_at).getTime() > Date.now() + 2 * 86400000);
  const re = await J(`/api/inbox/${clientItem}`, { method: "PATCH", body: { status: "open" } }, { Cookie: cookie });
  assert.equal(re.j.status, "open");
});

test("convert to task and to lead close the loop", async () => {
  const t = await J(`/api/inbox/${vendorItem}/convert-task`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.ok(t.j.task_id);
  const task = dbm.db.prepare("SELECT * FROM tasks WHERE id=?").get(t.j.task_id) as any;
  assert.ok(task && String(task.title).includes("Order confirmation"));
  await J("/api/inbox/ingest", { method: "POST", body: { from_name: "New Person", from_email: "np@x.co", subject: "Insurance renewal", body: "Certificate renewal paperwork." } }, { Cookie: cookie });
  const inbox = await J("/api/inbox", {}, { Cookie: cookie });
  const admin = inbox.j.find((i: any) => i.category === "admin" && i.status === "open");
  const c = await J(`/api/inbox/${admin.id}/convert-lead`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.ok(c.j.lead_id);
  const after = await J("/api/inbox", {}, { Cookie: cookie });
  assert.equal(after.j.find((i: any) => i.id === admin.id).status, "done");
});

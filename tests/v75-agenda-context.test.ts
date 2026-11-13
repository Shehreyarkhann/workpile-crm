// v75: agenda items booked from the inbox must explain themselves. A meeting
// or visit created from an email used to land in the schedule as a bare
// title with only a Done button — no reason, no record, no thread. Now the
// booking persists the source email + a one-line summary, and both agenda
// feeds (Calendar + Home upcoming) carry why + thread for the detail view.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = ""; let wsId = ""; let userId = ""; let actions: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v75", "pw", "7511"].join("-");
const ITEM = "itm_v75test1"; const LEAD = "lead_v75test";
const WHEN = new Date(Date.now() + 2 * 86400000); WHEN.setUTCHours(14, 0, 0, 0);
const DAY = WHEN.toISOString().slice(0, 10);

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v75-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  actions = await import("../server/inbox-actions.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner75@demo.test", password: PW, business_name: "V75 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner75@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; wsId = me.workspace_id; userId = me.id;
  const D = dbm.db; const T = new Date().toISOString();
  D.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run("ct_v75", wsId, "Vince Vendor", "vince@vendor.example");
  D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(LEAD, wsId, "ct_v75", "Equipment rental", "WORKING", 800, T, T);
  D.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,lead_id,status,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(ITEM, wsId, "vendor", "Vince Vendor", "vince@vendor.example", "Invoice #44 question", "Hi — can we meet Friday at 2pm to go over invoice #44? The quantities don't match our PO. — Vince", LEAD, "open", T, T);
});
const itemRow = () => dbm.db.prepare("SELECT * FROM inbox_items WHERE id=?").get(ITEM) as any;

test("a meeting booked from an email persists its context on the task", async () => {
  const r = actions.executeAction(wsId, userId, itemRow(), { kind: "meeting", when: WHEN.toISOString(), title: "📅 Meeting — Vince Vendor" });
  assert.equal(r.created_kind, "task");
  const task = dbm.db.prepare("SELECT * FROM tasks WHERE id=?").get(r.created_id) as any;
  assert.equal(task.source_inbox_item_id, ITEM);
  assert.match(String(task.notes || ""), /Invoice #44 question/);
  const again = actions.executeAction(wsId, userId, itemRow(), { kind: "meeting", when: WHEN.toISOString(), title: "📅 Meeting — Vince Vendor" });
  assert.equal(again.deduped, true);
  assert.equal(again.created_id, r.created_id);
});

test("the calendar feed carries why + the original thread for the booking", async () => {
  const r = await call("GET", `/api/calendar?from=${DAY}&to=${DAY}`);
  const ev = (r.body as any[]).find(e => e.kind === "task");
  assert.ok(ev, "task event present");
  assert.match(String(ev.why || ""), /Invoice #44 question/);
  assert.equal(ev.inbox_item_id, ITEM);
  assert.match(String(ev.thread?.body || ""), /quantities don't match/);
  assert.equal(ev.thread?.subject, "Invoice #44 question");
  assert.ok(ev.assignee_name, "assignee name present");
});

test("a site visit booked from an email carries the same context", async () => {
  const r = actions.executeAction(wsId, userId, itemRow(), { kind: "schedule_visit", when: WHEN.toISOString(), title: "Site visit" });
  assert.equal(r.created_kind, "site_visit");
  const v = dbm.db.prepare("SELECT * FROM site_visits WHERE id=?").get(r.created_id) as any;
  assert.equal(v.source_inbox_item_id, ITEM);
  const cal = await call("GET", `/api/calendar?from=${DAY}&to=${DAY}`);
  const ev = (cal.body as any[]).find(e => e.kind === "visit");
  assert.ok(ev, "visit event present");
  assert.match(String(ev.why || ""), /Invoice #44 question/);
  assert.match(String(ev.thread?.body || ""), /invoice #44/i);
});

test("Home upcoming carries the context too", async () => {
  const r = await call("GET", "/api/home");
  const ev = (r.body.upcoming as any[]).find(e => e.kind === "task");
  assert.ok(ev, "task in upcoming");
  assert.match(String(ev.why || ""), /Invoice #44 question/);
  assert.equal(ev.inbox_item_id, ITEM);
  assert.ok(ev.thread, "thread attached on Home upcoming");
});

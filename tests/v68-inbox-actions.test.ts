// v68: operator reply actions — the reply window reads the incoming email and
// the operator's draft, detects concrete scheduling intent (day/time/named
// teammate), and executes it server-side (site visit / task) in one tap.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const TZ = "America/New_York";
function parts(d: Date) {
  const p: any = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d)) p[x.type] = x.value;
  return p;
}
let wsId = ""; let mikeId = ""; let leadId = ""; let itemId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v68-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts"); // side-effect import: boots schema + worker (no default export)
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner68@demo.test", password: ["v68", "pw", "2202"].join("-"), business_name: "V68 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner68@demo.test", password: ["v68", "pw", "2202"].join("-") });
  const me = await call("GET", "/api/auth/me"); wsId = me.body.user.workspace_id;
  mikeId = dbm.uid("usr");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(mikeId, wsId, "Mike Manager", "mike@v68.test", dbm.hashPassword(["v68", "pw", "3303"].join("-")), "PROJECT_MANAGER", dbm.now());
  const lr = await call("POST", "/api/leads", { contact: { name: "Sara Site", email: "sara@v68.test", phone: "5550171234" }, service_requested: "Tank Removal", est_value: 12000 });
  assert.equal(lr.status, 201, JSON.stringify(lr.body)); leadId = lr.body.lead.id;
  const ing = await call("POST", "/api/inbox/ingest", { from_name: "Sara Site", from_email: "sara@v68.test", subject: "Visit timing", body: "Hi — can we schedule the site visit for Friday morning? The gate will be open. Thanks!" });
  assert.equal(ing.status, 201, JSON.stringify(ing.body));
  const row = dbm.db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND from_email='sara@v68.test'").get(wsId) as any;
  assert.ok(row, "inbox item created"); assert.equal(row.lead_id, leadId, "item linked to the lead");
  itemId = row.id;
});

test("the sender's Friday ask becomes a Book-visit action on the right Friday", async () => {
  const r = await call("POST", `/api/inbox/${itemId}/actions`, { draft: "" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.source, "rules"); // no LLM key in the test env — honest floor
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions));
  const p = parts(new Date(a.when));
  assert.equal(p.weekday, "Fri");
  assert.ok(new Date(a.when).getTime() > Date.now(), "in the future");
  assert.match(a.label, /Book visit/);
});

test("the operator's own words win: Monday 10 am with Mike named in the draft", async () => {
  const r = await call("POST", `/api/inbox/${itemId}/actions`, { draft: "Hi Sara — we can only schedule Monday 10 am and Mike will be there. Does that work?" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = (r.body.actions || []).find((x: any) => x.kind === "schedule_visit");
  assert.ok(a, JSON.stringify(r.body.actions));
  const p = parts(new Date(a.when));
  assert.equal(p.weekday, "Mon"); assert.equal(+p.hour, 10); assert.equal(+p.minute, 0);
  assert.equal(a.assignee_id, mikeId);
  assert.match(a.draft_line, /Mike will be there/);
  // execute → a real site visit on the lead, assigned to Mike, at that instant
  const ex = await call("POST", `/api/inbox/${itemId}/actions/execute`, { action: a });
  assert.equal(ex.status, 201, JSON.stringify(ex.body));
  assert.equal(ex.body.created_kind, "site_visit");
  const v = dbm.db.prepare("SELECT * FROM site_visits WHERE id=?").get(ex.body.created_id) as any;
  assert.equal(v.lead_id, leadId); assert.equal(v.assigned_to, mikeId); assert.equal(v.scheduled_at, a.when);
});

test("a promised callback becomes a callback task; plain mail yields nothing", async () => {
  const r = await call("POST", `/api/inbox/${itemId}/actions`, { draft: "Got it — I will call you back tomorrow." });
  const a = (r.body.actions || []).find((x: any) => x.kind === "callback");
  assert.ok(a, JSON.stringify(r.body.actions));
  const ex = await call("POST", `/api/inbox/${itemId}/actions/execute`, { action: a });
  assert.equal(ex.status, 201, JSON.stringify(ex.body));
  const t = dbm.db.prepare("SELECT * FROM tasks WHERE id=?").get(ex.body.created_id) as any;
  assert.equal(t.type, "callback");
  const plain = await call("POST", `/api/inbox/${itemId}/actions`, { draft: "Thanks, received — no action needed." });
  assert.deepEqual(plain.body.actions, []);
});

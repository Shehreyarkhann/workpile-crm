// V41: access control v2 — a PM sees only his own schedule/calendar, cannot
// complete other people's work, cannot open jobs he isn't on, money and
// reports are owner/ops-only by default, role templates are owner-editable,
// and personal overrides win over templates.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v41-")); process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
const { app } = await import("../server/app.ts"); const server = app.listen(0); server.unref();
const dbm: any = await import("../server/db.ts"); dbm.initSchema();
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const J = async (p: string, o: any = {}, ck = "") => { const r = await fetch(base + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} const sc = r.headers.get("set-cookie"); return { s: r.status, j, ck: sc ? sc.split(";")[0] : ck }; };
const PW = ["v41", "pw", "9921"].join("-");
let O = "", PM = "", wsId = "", ownerId = "", pmId = "", ownerLead = "", pmLead = "", jobOther = "", taskOwner = "", taskPm = "", schedOwner = "", schedPm = "";
const today = new Date().toISOString().slice(0, 10);
before(async () => {
  await J("/api/auth/register", { method: "POST", body: { name: "Olga Owner", business_name: "V41 Env", email: "o@v41.test", password: PW } });
  O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v41.test", password: PW } })).ck;
  const me = await J("/api/auth/me", {}, O); wsId = me.j.user.workspace_id; ownerId = me.j.user.id;
  pmId = dbm.uid("usr");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(pmId, wsId, "Pete PM", "pm@v41.test", dbm.hashPassword(PW), "PM");
  PM = (await J("/api/auth/login", { method: "POST", body: { email: "pm@v41.test", password: PW } })).ck;
  const ins = (sql: string, ...args: any[]) => dbm.db.prepare(sql).run(...args);
  const mkLead = async (owner: string, email: string, name: string) => (await J("/api/leads", { method: "POST", body: { contact: { name, email }, service_requested: "Mold Testing", est_value: 900, source: "v41", owner_id: owner } }, O)).j.lead.id;
  ownerLead = await mkLead(ownerId, "a@v41.example", "Owner Lead"); pmLead = await mkLead(pmId, "b@v41.example", "PM Lead");
  jobOther = dbm.uid("job");
  ins("INSERT INTO jobs (id,workspace_id,lead_id,stage,created_at,updated_at) VALUES (?,?,?,'SCHEDULED',?,?)", jobOther, wsId, ownerLead, dbm.now(), dbm.now());
  taskOwner = dbm.uid("tsk"); taskPm = dbm.uid("tsk");
  ins("INSERT INTO tasks (id,workspace_id,lead_id,title,status,assignee_id,due_at,created_at) VALUES (?,?,?,?,'open',?,?,?)", taskOwner, wsId, ownerLead, "Owner task", ownerId, new Date(Date.now() + 3600000).toISOString(), dbm.now());
  ins("INSERT INTO tasks (id,workspace_id,lead_id,title,status,assignee_id,due_at,created_at) VALUES (?,?,?,?,'open',?,?,?)", taskPm, wsId, pmLead, "PM task", pmId, new Date(Date.now() + 3600000).toISOString(), dbm.now());
  schedOwner = dbm.uid("sch"); schedPm = dbm.uid("sch");
  ins("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,created_at) VALUES (?,?,?,?,?,?)", schedOwner, wsId, ownerLead, ownerId, today, dbm.now());
  ins("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,created_at) VALUES (?,?,?,?,?,?)", schedPm, wsId, pmLead, pmId, today, dbm.now());
});
test("the PM's calendar + home agenda contain ONLY his own items", async () => {
  const cal = await J(`/api/calendar?from=${today}&to=${today}`, {}, PM);
  const refs = (cal.j || []).map((e: any) => String(e.ref_id || e.id || ""));
  assert.ok(!refs.some(r => r.includes(schedOwner)), "owner's schedule row leaked into PM calendar");
  const home = await J("/api/home", {}, PM);
  const up = JSON.stringify(home.j.upcoming || []);
  assert.ok(!up.includes(taskOwner), "owner's task leaked into PM agenda");
  assert.equal(home.j.finances, null, "PM must not receive money figures");
});
test("the PM cannot complete other people's work — but can complete his own", async () => {
  const bad = await J("/api/calendar/complete", { method: "POST", body: { kind: "schedule", ref_id: schedOwner } }, PM);
  assert.equal(bad.s, 403); assert.equal(bad.j.error.code, "not_assigned");
  const stillOpen = dbm.db.prepare("SELECT done_at FROM job_schedule WHERE id=?").get(schedOwner);
  assert.equal(stillOpen.done_at, null, "the owner's row must stay untouched");
  const badTask = await J("/api/tasks/" + taskOwner + "/complete", { method: "POST", body: {} }, PM);
  assert.equal(badTask.s, 403);
  const good = await J("/api/calendar/complete", { method: "POST", body: { kind: "task", ref_id: taskPm } }, PM);
  assert.equal(good.s, 200);
  const mine = await J("/api/calendar/complete", { method: "POST", body: { kind: "schedule", ref_id: schedPm } }, PM);
  assert.equal(mine.s, 200, "his own schedule row completes");
});
test("jobs he isn't on are invisible; money and reports are closed to him", async () => {
  const det = await J("/api/jobs/" + jobOther, {}, PM); assert.equal(det.s, 404);
  const list = await J("/api/jobs", {}, PM); assert.ok(!(list.j || []).some((j: any) => j.id === jobOther));
  assert.equal((await J("/api/finances", {}, PM)).s, 403);
  assert.equal((await J("/api/analytics?period=month", {}, PM)).s, 403);
  assert.equal((await J("/api/demand-gap/full", {}, PM)).s, 403);
  const sched = await J("/api/schedule", {}, PM);
  assert.ok(!(sched.j.rows || []).some((r: any) => r.id === schedOwner), "schedule board leaked the owner's rows");
});
test("role templates: the owner can open money for PMs; nobody else can edit templates", async () => {
  const roles = await J("/api/roles", {}, O); assert.equal(roles.s, 200);
  const pm = roles.j.roles.find((r: any) => r.role === "PM"); assert.equal(pm.effective.modules.reports, "none");
  const put = await J("/api/roles/PM", { method: "PUT", body: { perms: { ...pm.effective, can_money: true, modules: { ...pm.effective.modules, reports: "view" } } } }, O);
  assert.equal(put.s, 200);
  assert.equal((await J("/api/finances", {}, PM)).s, 200, "template change reaches the PM");
  assert.equal((await J("/api/analytics?period=month", {}, PM)).s, 200);
  const pmPut = await J("/api/roles/PM", { method: "PUT", body: { perms: pm.effective } }, PM);
  assert.equal(pmPut.s, 403, "a PM must not edit role templates");
  const del = await J("/api/roles/PM", { method: "DELETE" }, O); assert.equal(del.s, 200);
  assert.equal((await J("/api/finances", {}, PM)).s, 403, "reset restores the closed default");
});
test("a personal override beats the role template — and clearing it restores the template", async () => {
  const roles = await J("/api/roles", {}, O); const pm = roles.j.roles.find((r: any) => r.role === "PM");
  await J("/api/roles/PM", { method: "PUT", body: { perms: { ...pm.effective, can_money: true } } }, O);
  assert.equal((await J("/api/finances", {}, PM)).s, 200);
  const patch = await J("/api/team/" + pmId, { method: "PATCH", body: { permissions: { can_money: false } } }, O);
  assert.equal(patch.s, 200);
  assert.equal((await J("/api/finances", {}, PM)).s, 403, "personal override wins over the template");
  await J("/api/team/" + pmId, { method: "PATCH", body: { permissions: {} } }, O);
  assert.equal((await J("/api/finances", {}, PM)).s, 200, "clearing overrides returns to the template");
  await J("/api/roles/PM", { method: "DELETE" }, O);
  const mePm = await J("/api/auth/me", {}, PM);
  assert.equal(mePm.j.user.permissions.modules.jobs, "edit"); assert.equal(mePm.j.user.permissions.jobs_scope, "assigned"); assert.equal(mePm.j.user.permissions.schedule_scope, "mine");
  const meO = await J("/api/auth/me", {}, O); assert.equal(meO.j.user.permissions.can_money, true);
});

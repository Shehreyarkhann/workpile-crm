// V30: backlog bands, inbox priority tiers, one-time escalation sweep,
// integrations catalog carries email_sending + quickbooks honestly.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V30 Co", email: "o@v30.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v30.test", password: "password123" } })).ck; assert.ok(O);
const me = (await J("/api/auth/me", {}, O)).j.user; const WS = me.workspace_id;
const db = dbm.db;
function seedLead(score: any, email: string, state = "NEW") { const cid = dbm.uid("ct"); db.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run(cid, WS, "P " + email, email); const lid = dbm.uid("ld"); db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,service_requested,ai_score,dedupe_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(lid, WS, cid, state, "Svc", score, email, dbm.now(), dbm.now()); return lid; }
seedLead(85, "hot@v30.test"); seedLead(55, "warm@v30.test"); seedLead(10, "low@v30.test"); seedLead(null, "none@v30.test"); seedLead(95, "junk@v30.test", "JUNK");

test("bands: hot/warm/low/unscored counted, junk excluded from bands but in total", async () => {
  const r = await J("/api/backlog/bands", {}, O);
  assert.equal(r.s, 200); assert.deepEqual([r.j.hot, r.j.warm, r.j.low, r.j.unscored, r.j.total_all], [1, 1, 1, 1, 5]);
});

test("catalog: email_sending + quickbooks present with honest statuses", async () => {
  const r = await J("/api/integrations", {}, O);
  const qb = r.j.integrations.find((i: any) => i.id === "quickbooks"); const es = r.j.integrations.find((i: any) => i.id === "email_sending");
  assert.ok(qb && es); assert.equal(qb.status, "not_configured"); assert.equal(es.status, "not_configured");
});

test("inbox priority: urgent language is hot today; old overdue proposal mail is URGENT + escalated, sweep marks it once", async () => {
  const ing = await J("/api/inbox/ingest", { method: "POST", body: { emails: [{ from_email: "a@cust.test", from_name: "Ann", subject: "URGENT: leak in the basement", body: "Water everywhere, please hurry." }] } }, O);
  assert.equal(ing.s, 200, JSON.stringify(ing.j));
  const old = new Date(Date.now() - 3 * 86400000).toISOString(); const due = new Date(Date.now() - 2 * 86400000).toISOString();
  db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,status,next_action_due_at,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(dbm.uid("inb"), WS, "proposal", "Bob", "b@cust.test", "Signed proposal attached", "See attached.", "open", due, old, old);
  const list = await J("/api/inbox", {}, O);
  const urg = list.j.find((i: any) => i.subject === "URGENT: leak in the basement"); const prop = list.j.find((i: any) => i.subject === "Signed proposal attached");
  assert.equal(urg.priority.tier, "hot", JSON.stringify(urg.priority));
  assert.equal(prop.priority.tier, "urgent", JSON.stringify(prop.priority)); assert.equal(prop.priority.escalated, true);
  assert.equal(list.j[0].id, prop.id, "urgent sorts first");
  const run = await J("/api/ai/automations/run", { method: "POST", body: {} }, O);
  assert.equal(run.s, 200);
  const marked = db.prepare("SELECT escalated_at FROM inbox_items WHERE subject='Signed proposal attached'").get() as any;
  assert.ok(marked.escalated_at, "sweep stamped escalated_at");
  const notif = db.prepare("SELECT COUNT(*) c FROM notifications WHERE workspace_id=? AND type='inbox.escalated'").get(WS) as any;
  assert.equal(notif.c, 1);
});

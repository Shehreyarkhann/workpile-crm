// V26: inbox AI — full original email, suggestion pipeline (template-labeled
// without a provider, cached), reply via the shared sender, and the agent
// working the inbox (triage -> draft -> approved send).
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V26 Co", email: "o@v26.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v26.test", password: "password123" } })).ck; assert.ok(O);
const WS = (await J("/api/auth/me", {}, O)).j.user.workspace_id;
const LONG = "Dear team,\n\n" + "This paragraph concerns the October Geoprobe days and the attached invoice detail. ".repeat(30) + "\n\nRegards, Dana";
function seedItem(id: string, cat: string, email: string, subject: string, body: string) { dbm.db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,status,received_at,created_at) VALUES (?,?,?,?,?,?,?,'open',?,?)").run(id, WS, cat, "Dana Sender", email, subject, body, new Date().toISOString(), new Date().toISOString()); }
seedItem("inb_1", "finance", "dana@vendor.test", "Invoice 2214 — Geoprobe rig, October days", LONG);
seedItem("inb_2", "admin", "os@agency.test", "HAZWOPER renewals — two seats expire in December", "Please confirm the two seats.");

test("suggestion: template-labeled without a provider, cached, full body in list", async () => {
  const s1 = await J("/api/inbox/inb_1/suggestion", {}, O);
  assert.equal(s1.s, 200); assert.equal(s1.j.source, "template"); assert.ok(s1.j.draft_body.includes("V26 Co"), "template signs with the business name"); assert.ok(s1.j.action.length > 0);
  const row = dbm.db.prepare("SELECT ai_source, ai_draft_body FROM inbox_items WHERE id='inb_1'").get() as any;
  assert.equal(row.ai_source, "template"); assert.equal(row.ai_draft_body, s1.j.draft_body, "draft cached on the item");
  const list = await J("/api/inbox", {}, O);
  const it = list.j.find((x: any) => x.id === "inb_1"); assert.ok(it); assert.equal(it.body, LONG, "the full original email is served — no 900-char truncation");
});

test("reply: shared sender closes the item, honestly test_mode", async () => {
  const r = await J("/api/inbox/inb_2/reply", { method: "POST", body: { body: "Confirmed — the two seats are booked." } }, O);
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.sent, true); assert.equal(r.j.status, "test_mode");
  const it = dbm.db.prepare("SELECT status FROM inbox_items WHERE id='inb_2'").get() as any; assert.equal(it.status, "done");
});

test("agent works the inbox: triage + draft auto-run, send waits for approval, then closes the item", async () => {
  dbm.db.prepare("UPDATE workspaces SET agent_level=4 WHERE id=?").run(WS);
  const ex = await J("/api/agent/execute", { method: "POST", body: { instruction: "Please work my inbox" } }, O);
  assert.equal(ex.s, 201, JSON.stringify(ex.j)); assert.equal(ex.j.planner, "rules-v1 (inbox)");
  const tools = ex.j.plan.map((s: any) => s.tool);
  assert.ok(tools.includes("triage_inbox") && tools.includes("draft_inbox_reply") && tools.includes("send_inbox_reply"), tools.join(","));
  const draft = ex.j.plan.find((s: any) => s.tool === "draft_inbox_reply"); assert.equal(draft.status, "done", "draft ran immediately (inbox executions run internal steps before the send decision, like mass triage)");
  const sends = ex.j.plan.filter((s: any) => s.tool === "send_inbox_reply");
  assert.equal(sends.length, 1); assert.ok(sends[0].needs_approval && sends[0].status === "pending");
  assert.equal(dbm.db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE to_addr='dana@vendor.test'").get().c, 0, "nothing sent before approval");
  const done = await J(`/api/agent/executions/${ex.j.id}/decide`, { method: "POST", body: { approve: sends.map((s: any) => s.id) } }, O);
  assert.equal(done.j.status, "completed", JSON.stringify(done.j).slice(0, 200));
  const out = dbm.db.prepare("SELECT status FROM messages_outbox WHERE to_addr='dana@vendor.test'").get() as any;
  assert.ok(out && out.status === "test_mode");
  assert.equal((dbm.db.prepare("SELECT status FROM inbox_items WHERE id='inb_1'").get() as any).status, "done");
});

test("convert-lead still works through the route", async () => {
  seedItem("inb_3", "client_active_job", "newclient@x.test", "Need a Phase I at our Brentwood site", "Please send a proposal.");
  const r = await J("/api/inbox/inb_3/convert-lead", { method: "POST", body: {} }, O);
  assert.equal(r.s, 200, JSON.stringify(r.j)); assert.ok(r.j.lead_id);
  const lead = dbm.db.prepare("SELECT id FROM leads WHERE id=?").get(r.j.lead_id); assert.ok(lead);
});

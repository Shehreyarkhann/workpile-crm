// V49 Phase 1 — the multi-turn agent loop + full tool coverage.
// A scripted fake Anthropic endpoint drives the REAL provider + loop:
// turn 1 calls a read tool, turn 2 must OBSERVE its tool_result before
// continuing, an approval-class call pauses the run, and the human decision
// resumes the loop with the outcome fed back to the model.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v49-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const agent = await import("../server/agent.ts");
const tools = await import("../server/tools.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v49", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = ""; let leadId = "";
const realFetch = globalThis.fetch;
let script: (n: number, body: any) => any = () => ({ content: [{ type: "text", text: "ok" }] });
let fetchCount = 0; let sawToolResult = "";
(globalThis as any).fetch = async (url: any, init: any) => {
  if (String(url).includes("api.anthropic.com")) {
    fetchCount++;
    const body = JSON.parse(init.body);
    const flat = JSON.stringify(body.messages);
    if (flat.includes("tool_result")) { const m = flat.match(/"content":"([^"]*lead\(s\)[^"]*)"/) || flat.match(/tool_result/); sawToolResult = flat; }
    const payload = script(fetchCount, body);
    return { ok: true, status: 200, json: async () => ({ content: payload.content, usage: { input_tokens: 11, output_tokens: 7 }, model: "claude-sonnet-4-5" }), text: async () => JSON.stringify(payload) };
  }
  return realFetch(url, init);
};
const toolUse = (name: string, input: any = {}, id = "tu_" + Math.random().toString(36).slice(2, 8)) => ({ content: [{ type: "tool_use", id, name, input }] });

before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v49.test", password: PW, business_name: "V49 Ops" });
  assert.equal(r.s, 201, JSON.stringify(r.j));
  const l = await call("POST", "/api/auth/login", { email: "owner@v49.test", password: PW });
  owner = l.cookie!;
  const me = await call("GET", "/api/auth/me", undefined, owner); wsid = me.j.user.workspace_id;
  dbm.db.prepare("UPDATE workspaces SET llm_api_key='sk-test', llm_provider='anthropic', agent_level=3 WHERE id=?").run(wsid);
  const leadR = await call("POST", "/api/leads", { contact: { name: "Pat Buyer", email: "pat@buyer.test", phone: "6315557777" }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 2400 }, owner);
  leadId = leadR.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state='QUALIFIED' WHERE id=?").run(leadId);
});

test("loop: model observes tool results across turns, then finishes", async () => {
  fetchCount = 0; sawToolResult = "";
  script = (n) => n === 1 ? toolUse("search_leads", { state: "QUALIFIED" }, "tu_search") : n === 2 ? toolUse("get_revenue_report", {}, "tu_rev") : ({ content: [{ type: "text", text: "Found the qualified lead and pulled the money figures." }] });
  const ex = await agent.createExecution(wsid, "usr_test", "Survey the pipeline and the money");
  assert.equal(ex.status, "completed", JSON.stringify(ex).slice(0, 300));
  assert.ok(ex.planner.startsWith("loop:anthropic:"), ex.planner);
  assert.equal(fetchCount, 3, "three model turns");
  assert.ok(sawToolResult.includes("Tank Testing"), "turn 2+ received the search result as a tool_result");
  const doneSteps = ex.plan.filter((s: any) => s.status === "done");
  assert.equal(doneSteps.length, 2);
  assert.ok(ex.tokens_in >= 22, "tokens metered across turns");
  assert.match(ex.summary, /qualified lead/);
});

test("loop: approval-class call pauses; the human decision resumes the loop", async () => {
  fetchCount = 0;
  script = (n) => n === 1 ? toolUse("send_message", { lead_id: leadId, body: "Hi Pat — following up on your tank testing.", channel: "email" }, "tu_send") : ({ content: [{ type: "text", text: "The follow-up was sent with your approval." }] });
  const ex = await agent.createExecution(wsid, "usr_test", "Send Pat a follow-up");
  assert.equal(ex.status, "awaiting_approval");
  const pending = ex.plan.filter((s: any) => s.status === "pending");
  assert.equal(pending.length, 1); assert.equal(pending[0].tool, "send_message"); assert.equal(pending[0].call_id, "tu_send");
  const after = await agent.decideSteps(wsid, ex.id, [pending[0].id], [], "usr_test");
  assert.equal(after.status, "completed", JSON.stringify(after).slice(0, 300));
  const sendStep = after.plan.find((s: any) => s.tool === "send_message");
  assert.equal(sendStep.status, "done"); assert.match(sendStep.result, /test_mode|Message to/);
  assert.equal(fetchCount, 2, "the loop resumed for exactly one more turn");
  assert.match(after.summary, /sent with your approval/);
});

test("loop: the step cap stops a model that never finishes", async () => {
  fetchCount = 0;
  script = () => toolUse("search_leads", { limit: 3 });
  const ex = await agent.createExecution(wsid, "usr_test", "Keep searching forever");
  assert.equal(ex.status, "completed");
  assert.equal(fetchCount, 12, "exactly MAX_TURNS model calls");
  assert.match(ex.summary, /step cap/);
});

test("no provider: rules planner path is unchanged", async () => {
  dbm.db.prepare("UPDATE workspaces SET llm_api_key=NULL WHERE id=?").run(wsid);
  const ex = await agent.createExecution(wsid, "usr_test", "Show me the revenue picture");
  assert.ok(ex.planner.startsWith("rules"), ex.planner);
  dbm.db.prepare("UPDATE workspaces SET llm_api_key='sk-test' WHERE id=?").run(wsid);
});

test("new tools: scheduling, crew, documents, AR, invoices, payments, stages, playbooks", async () => {
  const T = tools.TOOLS as any;
  // job for the lead
  dbm.db.prepare("UPDATE leads SET state='WON' WHERE id=?").run(leadId);
  const jobId = dbm.uid("job");
  dbm.db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,'SCHEDULED',2400,?,?)").run(jobId, wsid, leadId, dbm.now(), dbm.now());
  const me = await call("GET", "/api/auth/me", undefined, owner); const myId = me.j.user.id;
  const sch = await T.schedule_job.run(wsid, myId, { lead_id: leadId, work_date: "2026-11-20", user_id: myId });
  assert.match(sch.summary, /scheduled on 2026-11-20/);
  const sch2 = await T.schedule_job.run(wsid, myId, { lead_id: leadId, work_date: "2026-11-20", user_id: myId });
  assert.match(sch2.summary, /already scheduled/);
  const crew = await T.assign_crew.run(wsid, myId, { lead_id: leadId, user_id: myId });
  assert.match(crew.summary, /on the crew/);
  assert.ok(dbm.db.prepare("SELECT id FROM job_crew WHERE lead_id=? AND user_id=?").get(leadId, myId));
  // documents chase
  dbm.db.prepare("INSERT INTO documents (id,workspace_id,job_id,lead_id,name,required,status) VALUES (?,?,?,?,'W-9',1,'missing')").run(dbm.uid("doc"), wsid, jobId, leadId);
  const chase1 = await T.chase_missing_documents.run(wsid, myId, {});
  assert.equal(chase1.refs.tasks_created, 1);
  const chase2 = await T.chase_missing_documents.run(wsid, myId, {});
  assert.equal(chase2.refs.tasks_created, 0, "no duplicate chase tasks");
  // invoice + payments
  const invR = await T.create_invoice.run(wsid, myId, { job_id: jobId });
  assert.match(invR.summary, /INV-\d{4} created/);
  const invId = invR.refs.invoice_id;
  const dupe = await T.create_invoice.run(wsid, myId, { job_id: jobId });
  assert.match(dupe.summary, /already exists/);
  const ar = await T.get_ar_snapshot.run(wsid, myId, {});
  assert.match(ar.summary, /Open AR \$2,400/);
  await assert.rejects(() => T.record_payment.run(wsid, myId, { invoice_id: invId, amount: 99999 }), /exceeds/);
  const part = await T.record_payment.run(wsid, myId, { invoice_id: invId, amount: 1000 });
  assert.match(part.summary, /of \$2,400 paid/);
  const full = await T.record_payment.run(wsid, myId, { invoice_id: invId, amount: 1400 });
  assert.match(full.summary, /PAID IN FULL/);
  assert.equal(T.record_payment.control, "approval", "payments are approval-class");
  // status report + stage guards
  const rep = await T.draft_status_report.run(wsid, myId, {});
  assert.match(rep.summary, /Weekly status/);
  const lead2 = await call("POST", "/api/leads", { contact: { name: "Second Lead", email: "two@buyer.test", phone: "6315556666" }, consent: { contact_ok: true }, service_requested: "Mold Testing", est_value: 900 }, owner);
  const l2 = lead2.j.lead.id;
  await assert.rejects(async () => T.move_lead_stage.run(wsid, myId, { lead_id: l2, to: "LOST" }), /lost_reason/);
  await assert.rejects(async () => T.move_lead_stage.run(wsid, myId, { lead_id: l2, to: "WON" }), /no proposal/);
  const won = await T.move_lead_stage.run(wsid, myId, { lead_id: l2, to: "WON", confirm_no_proposal: true });
  assert.match(won.summary, /→ WON/);
  // playbook enrollment
  await assert.rejects(() => T.enroll_in_playbook.run(wsid, myId, { lead_id: leadId, kind: "review" }), /no ACTIVE review playbook/);
  await call("POST", "/api/campaigns/playbook", { kind: "review" }, owner);
  const camp = dbm.db.prepare("SELECT id FROM campaigns WHERE workspace_id=? AND auto_trigger='job_completed' LIMIT 1").get(wsid) as any;
  dbm.db.prepare("UPDATE campaigns SET status='active' WHERE id=?").run(camp.id);
  const enr = await T.enroll_in_playbook.run(wsid, myId, { lead_id: leadId, kind: "review" });
  assert.equal(enr.refs.enrolled, true);
  const enr2 = await T.enroll_in_playbook.run(wsid, myId, { lead_id: leadId, kind: "review" });
  assert.equal(enr2.refs.enrolled, false, "enrollment is idempotent");
  assert.ok(Object.keys(T).length >= 27, "registry grew to 27 tools");
});

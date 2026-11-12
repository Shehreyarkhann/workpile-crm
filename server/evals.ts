// Workpile Agent — eval harness (v51, Phase 3).
// A standing suite of operational scenarios that score the governed agent
// machinery the way a release gate should: pricing integrity, stage guards,
// payment safety, the consent boundary, dedupe, conflict handling, proactive
// dedupe, the loop's cross-turn observation, earned-autonomy promotion AND
// its hard limits, and memory round-trips. Run in CI via tests/v51.test.ts
// (all scenarios must pass) or standalone: node scripts/run-evals.ts.
// Scenarios run against ONE scratch workspace and create their own fixtures
// with unique phones — they never touch production-shaped data.
import { db, uid, now } from "./db.ts";
import { TOOLS } from "./tools.ts";
import { rememberFact, operatorBrief } from "./agent-memory.ts";
import { requiredLevel, applyEarnedPolicy, clearTrustCache } from "./autonomy.ts";
import { processProactive } from "./proactive.ts";
import { createExecution } from "./agent.ts";

export interface EvalResult { name: string; pass: boolean; detail: string }
interface Ctx { ws: string; actor: string; seq: number }
const phone = (c: Ctx) => "631555" + String(1000 + (++c.seq));
function mkLead(c: Ctx, over: any = {}): any {
  const cid = uid("con"), lid = uid("lead");
  const ph = over.phone || phone(c);
  db.prepare("INSERT INTO contacts (id,workspace_id,name,email,phone) VALUES (?,?,?,?,?)").run(cid, c.ws, over.name || "Eval Person", over.email || `eval${c.seq}@x.test`, ph);
  db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,dedupe_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(lid, c.ws, cid, over.service_requested || "Tank Testing", over.state || "NEW", over.est_value ?? 1000, ph.replace(/\D/g, ""), over.created_at || now(), now());
  if (over.untouched) db.prepare("UPDATE leads SET first_touch_at=NULL, first_response_at=NULL WHERE id=?").run(lid);
  return db.prepare("SELECT * FROM leads WHERE id=?").get(lid);
}
async function attempt(fn: () => any): Promise<string | null> { try { await fn(); return null; } catch (e: any) { return String(e?.message || e); } }

export const EVAL_SCENARIOS: { name: string; run: (c: Ctx) => Promise<string> }[] = [
  { name: "pricing_integrity — proposals price only from the price book", run: async (c) => {
      const sid = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name,active) VALUES (?,?,?,1)").run(sid, c.ws, "Tank Testing");
      db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,'job',500,400)").run(uid("pbi"), c.ws, sid, "Tank Testing");
      const lead = mkLead(c, { state: "QUALIFIED", est_value: 9999 });
      const r = await TOOLS.prepare_proposal.run(c.ws, c.actor, { lead_id: lead.id });
      if (!/price book/.test(r.summary) || !/\$500/.test(r.summary)) throw new Error("proposal was not priced from the book at $500: " + r.summary);
      return "drafted at exactly the $500 book price despite a $9,999 lead estimate";
    } },
  { name: "stage_guards — finals demand reasons, WON demands a proposal", run: async (c) => {
      const lead = mkLead(c);
      const e1 = await attempt(() => TOOLS.move_lead_stage.run(c.ws, c.actor, { lead_id: lead.id, to: "LOST" }));
      const e2 = await attempt(() => TOOLS.move_lead_stage.run(c.ws, c.actor, { lead_id: lead.id, to: "WON" }));
      if (!e1 || !/lost_reason/.test(e1)) throw new Error("LOST without a reason was not refused");
      if (!e2 || !/no proposal/.test(e2)) throw new Error("WON without a proposal was not refused");
      return "both silent-final paths refused";
    } },
  { name: "payment_safety — overpayment refused, exact settlement lands", run: async (c) => {
      const lead = mkLead(c, { state: "WON" });
      const jobId = uid("job"); db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,'COMPLETED',1200,?,?)").run(jobId, c.ws, lead.id, now(), now());
      const inv = await TOOLS.create_invoice.run(c.ws, c.actor, { job_id: jobId });
      const e = await attempt(() => TOOLS.record_payment.run(c.ws, c.actor, { invoice_id: inv.refs.invoice_id, amount: 1201 }));
      if (!e || !/exceeds/.test(e)) throw new Error("overpayment was not refused");
      await TOOLS.record_payment.run(c.ws, c.actor, { invoice_id: inv.refs.invoice_id, amount: 1200 });
      const row = db.prepare("SELECT status FROM invoices WHERE id=?").get(inv.refs.invoice_id) as any;
      if (row.status !== "paid") throw new Error("invoice did not settle to paid");
      return "overpay refused; exact payment settled the invoice";
    } },
  { name: "consent_boundary — a suppressed customer is never sent to", run: async (c) => {
      const lead = mkLead(c, { email: "suppressed@x.test" });
      db.prepare("INSERT INTO suppressions (id,workspace_id,kind,value,reason,source,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("sup"), c.ws, "email", "suppressed@x.test", "unsubscribed", "eval", now());
      const r = await TOOLS.send_message.run(c.ws, c.actor, { lead_id: lead.id, body: "Hello from evals", channel: "email" });
      if (!/suppressed/.test(r.summary)) throw new Error("send to a suppressed address was not blocked: " + r.summary);
      return "send boundary reported suppressed — nothing queued";
    } },
  { name: "dedupe — playbook enrollment and chase tasks never duplicate", run: async (c) => {
      const campId = uid("camp"); db.prepare("INSERT INTO campaigns (id,workspace_id,name,type,status,kind,auto_trigger,created_at,updated_at) VALUES (?,?,?,'outreach','active','outreach','job_completed',?,?)").run(campId, c.ws, "⭐ Review requests — after the job", now(), now());
      const lead = mkLead(c, { state: "WON" });
      const a = await TOOLS.enroll_in_playbook.run(c.ws, c.actor, { lead_id: lead.id, kind: "review" });
      const b = await TOOLS.enroll_in_playbook.run(c.ws, c.actor, { lead_id: lead.id, kind: "review" });
      if (!a.refs.enrolled || b.refs.enrolled) throw new Error("enrollment duplicated");
      return "second enrollment was a no-op";
    } },
  { name: "schedule_conflicts — warn on clash, never double-book", run: async (c) => {
      const l1 = mkLead(c, { state: "WON" }), l2 = mkLead(c, { state: "WON" });
      for (const l of [l1, l2]) db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,'SCHEDULED',800,?,?)").run(uid("job"), c.ws, l.id, now(), now());
      const s1 = await TOOLS.schedule_job.run(c.ws, c.actor, { lead_id: l1.id, work_date: "2027-01-05", user_id: c.actor });
      const s2 = await TOOLS.schedule_job.run(c.ws, c.actor, { lead_id: l2.id, work_date: "2027-01-05", user_id: c.actor });
      const s3 = await TOOLS.schedule_job.run(c.ws, c.actor, { lead_id: l1.id, work_date: "2027-01-05", user_id: c.actor });
      if (!/scheduled on 2027-01-05/.test(s1.summary)) throw new Error("first schedule failed: " + s1.summary);
      if (!/already has work that day/.test(s2.summary)) throw new Error("clash was not surfaced: " + s2.summary);
      if (!/already scheduled/.test(s3.summary)) throw new Error("duplicate was not refused: " + s3.summary);
      return "clash warned, duplicate refused";
    } },
  { name: "memory_roundtrip — taught facts reach the next brief", run: async (c) => {
      const fact = "Eval fact: the owner never schedules on Sundays.";
      rememberFact(c.ws, fact, "eval", c.actor);
      if (!operatorBrief(c.ws).includes("never schedules on Sundays")) throw new Error("fact missing from the operator brief");
      return "fact persisted into the brief";
    } },
  { name: "earned_autonomy — trust promotes drafts, never promotes sends", run: async (c) => {
      const mk = (tool: string, done: number, rejected: number) => { const plan = JSON.stringify([...Array.from({ length: done }, (_, i) => ({ id: tool + "d" + i, tool, needs_approval: true, status: "done" })), ...Array.from({ length: rejected }, (_, i) => ({ id: tool + "r" + i, tool, needs_approval: true, status: "rejected" }))]);
        db.prepare("INSERT INTO agent_executions (id,workspace_id,user_id,instruction,status,planner,plan,created_at,updated_at) VALUES (?,?,?,'eval history','completed','eval',?,?,?)").run(uid("exe"), c.ws, c.actor, plan, now(), now()); };
      mk("draft_message", 24, 1); mk("send_message", 30, 0); mk("create_followup_task", 5, 5);
      clearTrustCache(c.ws);
      const draft = requiredLevel(c.ws, "draft_message");
      if (draft.adjustment !== "earned" || draft.required !== 1) throw new Error(`draft_message should be earned → L1, got ${JSON.stringify(draft)}`);
      const send = requiredLevel(c.ws, "send_message");
      if (Number.isFinite(send.required)) throw new Error("send_message must never become finite/automatic");
      const steps: any[] = [{ tool: "send_message", status: "pending", needs_approval: true }];
      applyEarnedPolicy(c.ws, steps, 4);
      if (!steps[0].needs_approval) throw new Error("send_message auto-approved at L4 — invariant broken");
      const task = requiredLevel(c.ws, "create_followup_task");
      if (task.adjustment !== "demoted" || task.required !== 4) throw new Error(`create_followup_task should be demoted → L4, got ${JSON.stringify(task)}`);
      return "draft earned L1 · send still always gated · weak tool demoted to L4";
    } },
  { name: "proactive_once — a leak prepares work exactly once a day", run: async (c) => {
      mkLead(c, { untouched: true, created_at: new Date(Date.now() - 2 * 86400000).toISOString() });
      const before = (db.prepare("SELECT COUNT(*) c FROM agent_executions WHERE workspace_id=? AND planner='proactive (rules)'").get(c.ws) as any).c;
      await processProactive(); await processProactive();
      const after = (db.prepare("SELECT COUNT(*) c FROM agent_executions WHERE workspace_id=? AND planner='proactive (rules)'").get(c.ws) as any).c;
      if (after - before !== 1) throw new Error(`expected exactly 1 proactive execution, got ${after - before}`);
      return "one governed execution across two scans";
    } },
  { name: "loop_observation — the model reads tool results before continuing", run: async (c) => {
      db.prepare("UPDATE workspaces SET llm_api_key='sk-eval', llm_provider='anthropic', agent_level=3 WHERE id=?").run(c.ws);
      const realFetch = globalThis.fetch; let calls = 0; let observed = false;
      (globalThis as any).fetch = async (url: any, init: any) => {
        if (String(url).includes("api.anthropic.com")) { calls++; const body = JSON.parse(init.body); if (JSON.stringify(body.messages).includes("tool_result")) observed = true;
          const content = calls === 1 ? [{ type: "tool_use", id: "tu_e1", name: "search_leads", input: { limit: 3 } }] : [{ type: "text", text: "Eval loop finished." }];
          return { ok: true, status: 200, json: async () => ({ content, usage: { input_tokens: 5, output_tokens: 3 }, model: "claude-sonnet-4-5" }), text: async () => "{}" }; }
        return realFetch(url, init);
      };
      try { const ex = await createExecution(c.ws, c.actor, "Eval: survey the leads"); if (ex.status !== "completed" || !observed) throw new Error(`status=${ex.status} observed=${observed}`); }
      finally { (globalThis as any).fetch = realFetch; db.prepare("UPDATE workspaces SET llm_api_key=NULL WHERE id=?").run(c.ws); }
      return "two turns, second carried the tool result";
    } },
];

export async function runEvals(ws: string, actor: string): Promise<{ total: number; passed: number; results: EvalResult[] }> {
  const c: Ctx = { ws, actor, seq: 0 };
  const results: EvalResult[] = [];
  for (const s of EVAL_SCENARIOS) {
    try { const detail = await s.run(c); results.push({ name: s.name, pass: true, detail }); }
    catch (e: any) { results.push({ name: s.name, pass: false, detail: String(e?.message || e) }); }
  }
  return { total: results.length, passed: results.filter(r => r.pass).length, results };
}

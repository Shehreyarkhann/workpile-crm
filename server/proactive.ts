// Workpile Agent — proactive operator (v50, Phase 2).
// The operator stops waiting to be told. A worker-tick scan looks for the
// five situations that quietly cost a field-service business money, and for
// each one it PREPARES the work as an agent execution — drafts and tasks
// executed per policy, customer-facing steps parked for the human's one-tap
// decision — then notifies the owners once. Hard dedupe: a trigger fires at
// most once per workspace per 24 hours, and never while its previous
// execution still waits for a decision.
import { db, uid, now } from "./db.ts";
import { agentLevel } from "./ai.ts";
import { mkStep, triageSteps, runExecution, type Step } from "./agent.ts";
import { notifyOwners } from "./comms.ts";

db.exec(`CREATE TABLE IF NOT EXISTS proactive_log (id TEXT PRIMARY KEY, workspace_id TEXT, trigger_name TEXT, execution_id TEXT, created_at TEXT);`);

const TRIGGERS = ["untouched_leads", "overdue_invoices", "cold_proposals", "missing_docs", "stale_approvals"] as const;
type Trigger = typeof TRIGGERS[number];

function recentlyFired(ws: string, trigger: Trigger): boolean {
  return !!db.prepare("SELECT id FROM proactive_log WHERE workspace_id=? AND trigger_name=? AND created_at >= datetime('now','-24 hours')").get(ws, trigger);
}
function stillWaiting(ws: string, trigger: Trigger): boolean {
  return !!db.prepare("SELECT id FROM agent_executions WHERE workspace_id=? AND planner='proactive (rules)' AND status='awaiting_approval' AND instruction LIKE ?").get(ws, `[proactive:${trigger}]%`);
}
function ownerId(ws: string): string | null {
  const u = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='OWNER' AND active=1 LIMIT 1").get(ws) as any || db.prepare("SELECT id FROM users WHERE workspace_id=? AND active=1 LIMIT 1").get(ws) as any;
  return u?.id || null;
}

async function fire(ws: string, trigger: Trigger, instruction: string, steps: Step[], note: string): Promise<boolean> {
  const actor = ownerId(ws); if (!actor || !steps.length) return false;
  try { const { applyEarnedPolicy } = await import("./autonomy.ts"); const wRow = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any; applyEarnedPolicy(ws, steps, agentLevel(wRow)); } catch { /* base policy stands */ }
  const id = uid("exe");
  db.prepare("INSERT INTO agent_executions (id,workspace_id,user_id,parent_id,instruction,status,planner,plan,context,created_at,updated_at) VALUES (?,?,?,NULL,?,'executing','proactive (rules)',?,'{}',?,?)")
    .run(id, ws, actor, `[proactive:${trigger}] ${instruction}`, JSON.stringify(steps), now(), now());
  db.prepare("INSERT INTO proactive_log (id,workspace_id,trigger_name,execution_id,created_at) VALUES (?,?,?,?,?)").run(uid("pro"), ws, trigger, id, now());
  // v52: run the auto-approved half NOW (drafts, tasks), exactly like a
  // human-started triage — finalizeExecution parks the rest as
  // awaiting_approval. Previously a single gated step froze the whole run.
  await runExecution(ws, id);
  const ex = db.prepare("SELECT status FROM agent_executions WHERE id=?").get(id) as any;
  notifyOwners(ws, "agent.proactive", "🤖 Your operator prepared work", `${note} Open the Agent panel to ${ex?.status === "awaiting_approval" ? "review and approve it" : "see what it did"}.`);
  return true;
}

export async function processProactive(): Promise<{ fired: string[] }> {
  const fired: string[] = [];
  const workspaces = db.prepare("SELECT id FROM workspaces").all() as any[];
  for (const { id: ws } of workspaces) {
    try {
      const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
      const level = agentLevel(w);
      // 1) Untouched leads sitting > 24h — the classic silent leak.
      if (!recentlyFired(ws, "untouched_leads") && !stillWaiting(ws, "untouched_leads")) {
        const n = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state='NEW' AND first_touch_at IS NULL AND first_response_at IS NULL AND created_at < datetime('now','-24 hours')").get(ws) as any).c;
        if (n > 0) { const { steps, count } = triageSteps(ws, level, 10, { minAgeHours: 24 }); if (count && await fire(ws, "untouched_leads", `Triage ${count} untouched lead(s) — the oldest have waited 24h+`, steps, `${count} lead(s) have sat untouched for over a day — the operator qualified, assigned and drafted first touches for them.`)) fired.push(ws + ":untouched_leads"); }
      }
      // 2) Overdue invoices — money already earned, quietly aging.
      if (!recentlyFired(ws, "overdue_invoices") && !stillWaiting(ws, "overdue_invoices")) {
        const invs = db.prepare(`SELECT i.*, l.service_requested FROM invoices i JOIN leads l ON l.id=i.lead_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') AND i.due_at < datetime('now','-7 days') ORDER BY i.due_at LIMIT 5`).all(ws) as any[];
        if (invs.length) { const steps: Step[] = []; for (const inv of invs) { const lead = db.prepare("SELECT l.*, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.id=?").get(inv.lead_id) as any; steps.push(mkStep("draft_message", { lead_id: inv.lead_id, intent: `a friendly nudge about invoice ${inv.number}, now overdue — balance $${Math.round((inv.total || 0) - (inv.paid_amount || 0))}`, __label: `Draft overdue nudge — ${inv.number} (${lead?.contact_name || inv.service_requested})` }, level)); steps.push(mkStep("create_followup_task", { lead_id: inv.lead_id, title: `Chase overdue invoice ${inv.number} (agent)`, __label: `Chase task — ${inv.number}` }, level)); }
          if (await fire(ws, "overdue_invoices", `Chase ${invs.length} invoice(s) overdue by 7+ days`, steps, `${invs.length} invoice(s) are 7+ days overdue — the operator drafted the nudges and set the chase tasks.`)) fired.push(ws + ":overdue_invoices"); }
      }
      // 3) Cold proposals — sent a week ago, silence since.
      if (!recentlyFired(ws, "cold_proposals") && !stillWaiting(ws, "cold_proposals")) {
        const props = db.prepare(`SELECT p.lead_id, p.total, l.service_requested FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.workspace_id=? AND p.status='sent' AND p.sent_at < datetime('now','-7 days') AND l.state NOT IN ('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE') LIMIT 5`).all(ws) as any[];
        if (props.length) { const steps: Step[] = []; for (const p of props) { steps.push(mkStep("draft_message", { lead_id: p.lead_id, intent: "check in on the proposal we sent last week and offer to answer questions", __label: `Draft proposal follow-up — ${p.service_requested} ($${Math.round(p.total)})` }, level)); steps.push(mkStep("create_followup_task", { lead_id: p.lead_id, title: "Proposal follow-up (agent)", __label: `Follow-up task — ${p.service_requested}` }, level)); }
          if (await fire(ws, "cold_proposals", `Revive ${props.length} cold proposal(s)`, steps, `${props.length} proposal(s) have been silent for a week — follow-up drafts and tasks are ready.`)) fired.push(ws + ":cold_proposals"); }
      }
      // 4) Missing job documents — one step, the governed chase tool.
      if (!recentlyFired(ws, "missing_docs") && !stillWaiting(ws, "missing_docs")) {
        const n = (db.prepare("SELECT COUNT(*) c FROM documents d JOIN jobs j ON j.id=d.job_id WHERE d.workspace_id=? AND d.required=1 AND d.status<>'received' AND j.stage NOT IN ('CLOSED','CANCELLED')").get(ws) as any).c;
        if (n > 0) { if (await fire(ws, "missing_docs", `Chase ${n} missing required document(s)`, [mkStep("chase_missing_documents", { __label: `Chase ${n} missing document(s)` }, level)], `${n} required job document(s) are missing — the operator created the chase tasks.`)) fired.push(ws + ":missing_docs"); }
      }
      // 5) Stale approvals — the work is done; it's the DECISION that's stuck. A reminder, not an execution.
      if (!recentlyFired(ws, "stale_approvals")) {
        const n = (db.prepare("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL AND submitted_at < datetime('now','-48 hours')").get(ws) as any).c;
        if (n > 0) { db.prepare("INSERT INTO proactive_log (id,workspace_id,trigger_name,execution_id,created_at) VALUES (?,?,?,?,?)").run(uid("pro"), ws, "stale_approvals", null, now()); notifyOwners(ws, "agent.proactive", "⏳ Approvals are waiting on you", `${n} approval(s) have been pending for over 48 hours — the work behind them can't move until they're decided.`); fired.push(ws + ":stale_approvals"); }
      }
    } catch { /* one workspace's failure never stops the scan */ }
  }
  return { fired };
}

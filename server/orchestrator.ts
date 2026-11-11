// Workpile Agent — orchestrator v1 (audit Priority 2, first increment).
// Architecture per the audit: orchestrator → context → tool registry → policy (autonomy levels) →
// execution → verification → report. The planner is deterministic rules today; `llmProvider` is the
// seam where an LLM planner (founder's provider + key decision) drops in WITHOUT touching tools/policy.
// Hard rules: tools never send customer-facing messages, never change prices, never bypass approvals.
import { db, uid, now } from "./db.ts";
import { agentLevel, reactivateStale } from "./ai.ts";
import { draftProposalForLead, qualifiedLeadsMissingProposals } from "./proposals-core.ts";

export const llmProvider: null | { name: string } = null; // founder decision pending — rules planner is live

type ToolResult = { tool: string; mode: "executed" | "plan"; summary: string; items: { label: string; lead_id?: string; job_id?: string; value?: number }[] };
type Tool = { name: string; description: string; minLevel: number; run: (ws: string, actor: string, level: number) => ToolResult };

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString();

const prepareProposals: Tool = {
  name: "prepare_proposals", description: "Draft proposals for qualified leads that have none", minLevel: 2,
  run(ws, actor, level) {
    const leads = qualifiedLeadsMissingProposals(ws, 25);
    const items: ToolResult["items"] = [];
    for (const l of leads) {
      if (level < this.minLevel) { items.push({ label: `Would draft: ${l.service_requested} (${money(l.est_value)})`, lead_id: l.id, value: l.est_value || 0 }); continue; }
      const r = draftProposalForLead(ws, l);
      items.push({ label: `Drafted: ${l.service_requested} — ${money(r.total)}${r.priced === "price_book" ? " (price book)" : " (estimate — review)"}`, lead_id: l.id, value: r.total });
    }
    return { tool: this.name, mode: level >= this.minLevel ? "executed" : "plan", summary: leads.length ? `${items.length} qualified lead${items.length === 1 ? "" : "s"} ${level >= this.minLevel ? "drafted" : "would be drafted (autonomy L" + level + " < L" + this.minLevel + ")"} — drafts only, nothing sent, approvals still apply at send.` : "No qualified leads are missing a proposal.", items };
  },
};

const opsReview: Tool = {
  name: "ops_review", description: "Scan active jobs: missing documents, unscheduled, ready to invoice", minLevel: 0,
  run(ws) {
    const items: ToolResult["items"] = [];
    for (const d of db.prepare(`SELECT d.name, d.job_id, d.lead_id, j.stage FROM documents d JOIN jobs j ON j.id=d.job_id WHERE d.workspace_id=? AND d.required=1 AND d.status<>'received' AND j.stage NOT IN ('CLOSED','CANCELLED') LIMIT 15`).all(ws) as any[])
      items.push({ label: `Missing document: ${d.name} (job ${d.stage.replaceAll("_", " ")})`, job_id: d.job_id, lead_id: d.lead_id });
    for (const j of db.prepare(`SELECT j.* FROM jobs j WHERE j.workspace_id=? AND j.stage IN ('AWAITING_SCHEDULING','SCHEDULED') AND NOT EXISTS (SELECT 1 FROM job_schedule s WHERE s.lead_id=j.lead_id) LIMIT 10`).all(ws) as any[])
      items.push({ label: `Job not scheduled: ${j.id.slice(-6)} — ${money(j.value)}`, job_id: j.id, lead_id: j.lead_id, value: j.value });
    for (const j of db.prepare(`SELECT * FROM jobs WHERE workspace_id=? AND stage='READY_TO_INVOICE' LIMIT 10`).all(ws) as any[])
      items.push({ label: `Ready to invoice: ${money(j.value)}`, job_id: j.id, lead_id: j.lead_id, value: j.value });
    return { tool: this.name, mode: "executed", summary: items.length ? `${items.length} operational item${items.length === 1 ? "" : "s"} need attention.` : "Operations are clean — no missing documents, unscheduled jobs, or uninvoiced work.", items };
  },
};

const recoverRevenue: Tool = {
  name: "recover_revenue", description: "Find stale leads and cold proposals; create reactivation work at L3+", minLevel: 3,
  run(ws, actor, level) {
    const cold = db.prepare(`SELECT p.*, l.service_requested FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.workspace_id=? AND p.status='sent' AND julianday('now') - julianday(p.sent_at) >= 7 ORDER BY p.total DESC LIMIT 15`).all(ws) as any[];
    const items: ToolResult["items"] = cold.map(p => ({ label: `Cold proposal: ${p.service_requested} — ${money(p.total)} sent ${Math.floor((Date.now() - new Date(p.sent_at).getTime()) / 86400000)}d ago`, lead_id: p.lead_id, value: p.total }));
    let taskNote = "";
    if (level >= this.minLevel) { const r = reactivateStale(ws, actor); taskNote = ` Created ${r.tasks_created} reactivation task${r.tasks_created === 1 ? "" : "s"}.`; }
    else taskNote = ` (Reactivation tasks need autonomy L3 — currently L${level}; report only.)`;
    const staleValue = (db.prepare("SELECT COALESCE(SUM(est_value),0) s FROM leads WHERE workspace_id=? AND state IN ('NEW','WORKING','QUALIFIED','PROPOSAL','SENT','FOLLOWUP') AND julianday('now') - julianday(updated_at) >= 14").get(ws) as any).s;
    return { tool: this.name, mode: level >= this.minLevel ? "executed" : "plan", summary: `${items.length} cold proposals (${money(items.reduce((a, i) => a + (i.value || 0), 0))}) + ${money(staleValue)} in 14d+ stale open leads.${taskNote}`, items };
  },
};

const execBrief: Tool = {
  name: "exec_brief", description: "This week vs last week: leads, proposals, signed, collected, biggest stuck items", minLevel: 0,
  run(ws) {
    const c = (sql: string, ...p: any[]) => (db.prepare(sql).get(ws, ...p) as any).c ?? (db.prepare(sql).get(ws, ...p) as any).s;
    const wk = (col: string, tbl: string, extra = "") => (db.prepare(`SELECT COUNT(*) c FROM ${tbl} WHERE workspace_id=? AND ${col} >= datetime('now','-7 days') ${extra}`).get(ws) as any).c;
    const signed = (db.prepare("SELECT COALESCE(SUM(total),0) s FROM proposals WHERE workspace_id=? AND status='signed' AND signed_at >= datetime('now','-7 days')").get(ws) as any).s;
    const collected = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE workspace_id=? AND status='paid' AND created_at >= datetime('now','-7 days')").get(ws) as any).s;
    const stuck = db.prepare("SELECT service_requested, est_value FROM leads WHERE workspace_id=? AND state IN ('NEW','WORKING') AND first_touch_at IS NULL AND first_response_at IS NULL ORDER BY est_value DESC LIMIT 3").all(ws) as any[];
    const items = stuck.map(l => ({ label: `Never contacted: ${l.service_requested} — ${money(l.est_value)}`, value: l.est_value }));
    return { tool: this.name, mode: "executed", summary: `Last 7 days: ${wk("created_at", "leads")} new leads · ${wk("sent_at", "proposals", "AND sent_at IS NOT NULL")} proposals sent · ${money(signed)} signed · ${money(collected)} collected. ${items.length ? "Biggest stuck items below." : "No untouched high-value leads."}`, items };
  },
};

export const TOOLS: Record<string, Tool> = { prepare_proposals: prepareProposals, ops_review: opsReview, recover_revenue: recoverRevenue, exec_brief: execBrief };

export function planCommand(text: string): { intent: string; tools: string[] } {
  const t = " " + String(text || "").toLowerCase() + " ";
  if (/proposal/.test(t) && /prepare|draft|missing|qualified|create|build/.test(t)) return { intent: "prepare_proposals", tools: ["prepare_proposals"] };
  if (/recover|stale|cold|follow.?up|old leads|reactivat/.test(t)) return { intent: "recover_revenue", tools: ["recover_revenue", "exec_brief"] };
  if (/job|operat|document|invoice|schedul|crew/.test(t)) return { intent: "ops_review", tools: ["ops_review"] };
  if (/organiz|everything|full sweep|get .* organized/.test(t)) return { intent: "full_sweep", tools: ["exec_brief", "ops_review", "recover_revenue", "prepare_proposals"] };
  return { intent: "exec_brief", tools: ["exec_brief"] };
}

export function runCommand(ws: string, actor: string, text: string) {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const level = agentLevel(w);
  const plan = planCommand(text);
  const results = plan.tools.map(name => TOOLS[name].run(ws, actor, level));
  const runId = uid("run");
  const output = { command: text, intent: plan.intent, planner: llmProvider ? llmProvider.name : "rules-v1", autonomy_level: level, results };
  db.prepare("INSERT INTO agent_runs (id,workspace_id,agent,lead_id,model,prompt_version,input_hash,output,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(runId, ws, "orchestrator", null, output.planner, "orch-v1", "", JSON.stringify(output), 1, now());
  return { run_id: runId, ...output };
}

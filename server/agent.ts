// Workpile Agent engine (v17): persisted executions with the audit's lifecycle —
// queued → planning → awaiting_approval → executing → verifying → completed
// (terminal: failed / cancelled / rejected). The planner is an LLM when a provider is
// configured, else the deterministic rules planner (labeled honestly). The policy engine —
// never the model — decides what may run automatically: control class × autonomy level.
// send_message is approval-class at EVERY level. Steps execute once (status-guarded),
// verify their write, and record evidence on the execution.
import { db, uid, now } from "./db.ts";
import { TOOLS, TOOL_LIST, draftBodyFor } from "./tools.ts";
import { getProvider, providerStatus } from "./llm.ts";
import { agentLevel } from "./ai.ts";
import { qualifiedLeadsMissingProposals } from "./proposals-core.ts";

export interface Step { id: string; tool: string; args: any; control: string; label: string; status: "pending" | "approved" | "rejected" | "done" | "failed" | "skipped"; needs_approval: boolean; result?: string; refs?: any; verified?: boolean }
const J = (v: any, d: any) => { try { return JSON.parse(v); } catch { return d; } };

export function needsApproval(control: string, level: number): boolean {
  if (control === "approval") return true;
  if (control === "draft") return level < 2;
  if (control === "execute") return level < 3;
  return false;
}
const labelFor = (tool: string, args: any) => { if (args?.__label) return String(args.__label); const t = TOOLS[tool]; return t ? `${tool.replaceAll("_", " ")}${args?.lead_id ? " · " + String(args.lead_id).slice(-6) : ""}` : tool; };
function mkStep(tool: string, args: any, level: number): Step { const t = TOOLS[tool]; const na = needsApproval(t.control, level); return { id: uid("stp"), tool, args: args || {}, control: t.control, label: labelFor(tool, args), status: na ? "pending" : "approved", needs_approval: na }; }

function businessContext(ws: string): any {
  const c = (sql: string) => (db.prepare(sql).get(ws) as any).c;
  return { leads_open: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state NOT IN ('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE','UNSERVICEABLE','CLOSED')"),
    untouched: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state='NEW' AND first_response_at IS NULL"),
    qualified_no_proposal: qualifiedLeadsMissingProposals(ws, 25).length,
    stale_open: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state IN ('WORKING','PROPOSAL','SENT','FOLLOWUP') AND julianday('now') - julianday(updated_at) >= 14"),
    jobs_active: c("SELECT COUNT(*) c FROM jobs WHERE workspace_id=? AND stage NOT IN ('CLOSED','CANCELLED')"),
    approvals_pending: c("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision='pending'") };
}

function rulesPlan(ws: string, instruction: string, level: number): Step[] {
  const t = " " + instruction.toLowerCase() + " ";
  const steps: Step[] = [];
  const leads = (sql: string, ...p: any[]) => db.prepare(sql).all(ws, ...p) as any[];
  if (/proposal/.test(t) && /prepare|draft|missing|qualified|create|build/.test(t)) {
    for (const l of qualifiedLeadsMissingProposals(ws, 10)) steps.push(mkStep("prepare_proposal", { lead_id: l.id }, level));
    if (!steps.length) steps.push(mkStep("search_leads", { state: "QUALIFIED" }, level));
    return steps;
  }
  if (/recover|stale|cold|follow.?up|unresponsive|haven.t responded/.test(t)) {
    const stale = leads("SELECT id FROM leads WHERE workspace_id=? AND state IN ('WORKING','PROPOSAL','SENT','FOLLOWUP') AND julianday('now') - julianday(updated_at) >= 7 ORDER BY est_value DESC LIMIT 8");
    for (const l of stale) { steps.push(mkStep("draft_message", { lead_id: l.id, intent: "check in on your request" }, level)); steps.push(mkStep("create_followup_task", { lead_id: l.id, title: "Recovery follow-up (agent)" }, level)); }
    if (!steps.length) steps.push(mkStep("search_leads", { stale_days: 7 }, level));
    return steps;
  }
  if (/review|triage|assign|best|opportunit/.test(t) && /lead/.test(t)) {
    const fresh = leads("SELECT id FROM leads WHERE workspace_id=? AND state='NEW' ORDER BY ai_score DESC, est_value DESC LIMIT 8");
    for (const l of fresh) { steps.push(mkStep("qualify_lead", { lead_id: l.id }, level)); steps.push(mkStep("assign_lead", { lead_id: l.id }, level)); steps.push(mkStep("create_followup_task", { lead_id: l.id, title: "First contact (agent triage)" }, level)); }
    if (!steps.length) steps.push(mkStep("search_leads", { state: "NEW" }, level));
    return steps;
  }
  if (/job|operat|document|invoice|schedul/.test(t)) { steps.push(mkStep("search_leads", { stale_days: 14 }, level)); const missing = db.prepare("SELECT DISTINCT d.lead_id FROM documents d JOIN jobs j ON j.id=d.job_id WHERE d.workspace_id=? AND d.required=1 AND d.status<>'received' AND j.stage NOT IN ('CLOSED','CANCELLED') LIMIT 6").all(ws) as any[]; for (const d of missing) steps.push(mkStep("create_followup_task", { lead_id: d.lead_id, title: "Chase missing job document (agent)" }, level)); return steps; }
  if (/organiz|everything|full sweep/.test(t)) { return [...rulesPlan(ws, "prepare proposals for qualified leads", level), ...rulesPlan(ws, "recover stale leads", level), mkStep("get_revenue_report", {}, level)]; }
  return [mkStep("get_revenue_report", {}, level), mkStep("search_leads", { stale_days: 7, limit: 5 }, level)];
}

const SYSTEM = `You are Workpile Agent, the execution layer of a CRM for field-service businesses. Produce a PLAN ONLY: a JSON array of steps, each {"tool": "<name>", "args": {...}}. Use only the provided tools. Never invent lead ids — use search_leads first when you need ids, and plan read steps before write steps. Customer-facing sends (send_message) always need human approval; prefer draft_message. Prices come only from prepare_proposal (price-book governed). Respond with ONLY the JSON array.`;

// Mass untouched triage (v18): the one-click business workflow. Per untouched lead the agent
// qualifies (read), assigns (execute), drafts (draft) and prepares the first-touch SEND as an
// approval-class step — internal work runs immediately; every customer-facing send waits for
// one human approval pass. Capped so one run stays reviewable.
export function triageSteps(ws: string, level: number, cap = 25): { steps: Step[]; count: number } {
  const leads = db.prepare(`SELECT l.*, c.name contact_name, c.email contact_email, c.phone contact_phone FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.state='NEW' AND l.first_response_at IS NULL AND l.state<>'JUNK' ORDER BY COALESCE(l.ai_score,0) DESC, l.est_value DESC LIMIT ?`).all(ws, cap) as any[];
  const steps: Step[] = [];
  for (const l of leads) {
    const who = l.contact_name || l.service_requested;
    steps.push(mkStep("qualify_lead", { lead_id: l.id, __label: `Qualify — ${who}` }, level));
    steps.push(mkStep("assign_lead", { lead_id: l.id, __label: `Assign — ${who}` }, level));
    steps.push(mkStep("draft_message", { lead_id: l.id, intent: "introduce ourselves and offer next steps", __label: `Draft first touch — ${who}` }, level));
    if (l.contact_email || l.contact_phone) steps.push(mkStep("send_message", { lead_id: l.id, body: draftBodyFor(ws, l, "introduce ourselves and offer next steps"), channel: l.contact_email ? "email" : "sms", __label: `Send first touch — ${who} (${l.contact_email ? "email" : "SMS"})` }, level));
  }
  return { steps, count: leads.length };
}

export async function createTriageExecution(ws: string, userId: string): Promise<any> {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const level = agentLevel(w);
  const { steps, count } = triageSteps(ws, level);
  const id = uid("exe");
  db.prepare("INSERT INTO agent_executions (id,workspace_id,user_id,parent_id,instruction,status,planner,plan,context,created_at,updated_at) VALUES (?,?,?,NULL,?,'executing','rules-v1 (mass triage)',?,?,?,?)")
    .run(id, ws, userId, `Handle all untouched leads (${count})`, JSON.stringify(steps), JSON.stringify({ ...businessContext(ws), triage_count: count }), now(), now());
  if (!count) { db.prepare("UPDATE agent_executions SET status='completed', summary='No untouched leads — the pile is clear.', updated_at=? WHERE id=?").run(now(), id); return getExecution(ws, id); }
  return runExecution(ws, id);
}

export async function createExecution(ws: string, userId: string, instruction: string, parentId?: string): Promise<any> {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const level = agentLevel(w);
  const id = uid("exe");
  const ctx = businessContext(ws);
  if (parentId) { const p = db.prepare("SELECT summary, instruction FROM agent_executions WHERE id=? AND workspace_id=?").get(parentId, ws) as any; if (p) (ctx as any).parent = { instruction: p.instruction, summary: p.summary }; }
  db.prepare("INSERT INTO agent_executions (id,workspace_id,user_id,parent_id,instruction,status,planner,plan,context,created_at,updated_at) VALUES (?,?,?,?,?,'planning','', '[]',?,?,?)").run(id, ws, userId, parentId || null, instruction, JSON.stringify(ctx), now(), now());
  let steps: Step[] = []; let planner = "rules-v1"; let tokens = { in: 0, out: 0 };
  const provider = getProvider(ws);
  if (provider) {
    try {
      const r = await provider.chat({ system: SYSTEM, messages: [{ role: "user", content: `Instruction: ${instruction}\nBusiness context: ${JSON.stringify(ctx)}\nWorkspace autonomy level: L${level}.` }], tools: TOOL_LIST as any, maxTokens: 2048 });
      tokens = r.usage; planner = `${provider.kind}:${r.model}`;
      const raw = r.calls.length ? r.calls.map(c => ({ tool: c.name, args: c.args })) : J((r.text || "").slice((r.text || "").indexOf("["), (r.text || "").lastIndexOf("]") + 1), []);
      for (const s of Array.isArray(raw) ? raw.slice(0, 20) : []) if (s && TOOLS[s.tool]) steps.push(mkStep(s.tool, s.args || {}, level));
      if (!steps.length) steps = rulesPlan(ws, instruction, level); // model returned nothing usable — deterministic fallback, still labeled by planner
    } catch { steps = rulesPlan(ws, instruction, level); planner = "rules-v1 (provider error — fell back)"; }
  } else if (/untouched|first touch|handle (all )?(the )?new leads|triage/.test(" " + instruction.toLowerCase() + " ")) { steps = triageSteps(ws, level).steps; planner = "rules-v1 (mass triage)"; }
  else steps = rulesPlan(ws, instruction, level);
  const awaiting = steps.some(s => s.needs_approval && s.status === "pending");
  db.prepare("UPDATE agent_executions SET planner=?, plan=?, tokens_in=?, tokens_out=?, status=?, updated_at=? WHERE id=?").run(planner, JSON.stringify(steps), tokens.in, tokens.out, awaiting ? "awaiting_approval" : "executing", now(), id);
  const ex = getExecution(ws, id);
  if (!awaiting) return runExecution(ws, id);
  return ex;
}

export function getExecution(ws: string, id: string): any {
  const e = db.prepare("SELECT * FROM agent_executions WHERE id=? AND workspace_id=?").get(id, ws) as any;
  if (!e) return null;
  return { ...e, plan: J(e.plan, []), context: J(e.context, {}) };
}

export async function runExecution(ws: string, id: string): Promise<any> {
  const ex = getExecution(ws, id); if (!ex) return null;
  const steps: Step[] = ex.plan;
  db.prepare("UPDATE agent_executions SET status='executing', updated_at=? WHERE id=?").run(now(), id);
  for (const s of steps) {
    if (s.status !== "approved") continue;
    try { const r = await TOOLS[s.tool].run(ws, ex.user_id, s.args); s.result = r.summary; s.refs = r.refs; s.verified = true; s.status = "done"; }
    catch (e: any) { s.result = "Failed: " + String(e?.message || e); s.verified = false; s.status = "failed"; }
    db.prepare("UPDATE agent_executions SET plan=?, updated_at=? WHERE id=?").run(JSON.stringify(steps), now(), id);
  }
  const done = steps.filter(s => s.status === "done").length, failed = steps.filter(s => s.status === "failed").length;
  const pending = steps.filter(s => s.status === "pending").length;
  const summary = steps.filter(s => s.result).map(s => `${s.status === "done" ? "✓" : s.status === "failed" ? "✗" : "•"} ${s.result}`).join("\n") || "No steps ran.";
  const status = pending > 0 ? "awaiting_approval" : (failed > 0 && done === 0 ? "failed" : "completed");
  db.prepare("UPDATE agent_executions SET status=?, summary=?, updated_at=? WHERE id=?").run(status, summary, now(), id);
  return getExecution(ws, id);
}

export async function decideSteps(ws: string, id: string, approveIds: string[], rejectIds: string[]): Promise<any> {
  const ex = getExecution(ws, id); if (!ex) return null;
  if (["completed", "failed", "cancelled", "rejected"].includes(ex.status)) { const err: any = new Error("execution is already " + ex.status); err.code = "already_final"; throw err; }
  const steps: Step[] = ex.plan;
  for (const s of steps) { if (approveIds.includes(s.id) && s.status === "pending") s.status = "approved"; if (rejectIds.includes(s.id) && s.status === "pending") s.status = "rejected"; }
  db.prepare("UPDATE agent_executions SET plan=?, updated_at=? WHERE id=?").run(JSON.stringify(steps), now(), id);
  if (steps.every(s => s.status === "rejected" || s.status === "done" || s.status === "failed") && steps.some(s => s.status === "rejected") && !steps.some(s => s.status === "approved" || s.status === "done")) {
    db.prepare("UPDATE agent_executions SET status='rejected', summary='All remaining steps were rejected by the user.', updated_at=? WHERE id=?").run(now(), id);
    return getExecution(ws, id);
  }
  return runExecution(ws, id);
}

export function cancelExecution(ws: string, id: string): any {
  const ex = getExecution(ws, id); if (!ex) return null;
  const steps: Step[] = ex.plan.map((s: Step) => s.status === "pending" || s.status === "approved" ? { ...s, status: "skipped" } : s);
  db.prepare("UPDATE agent_executions SET status='cancelled', plan=?, updated_at=? WHERE id=?").run(JSON.stringify(steps), now(), id);
  return getExecution(ws, id);
}

export { providerStatus };

// Workpile — single Metrics Service (spec §10.2: every KPI computed exactly once, here)
import { db } from "./db.ts";

export function metrics(workspaceId: string) {
  const q = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as any;
  const qa = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
  const leads = qa("SELECT * FROM leads WHERE workspace_id=?", workspaceId);
  const byState: Record<string, number> = {};
  const CANON: any = { WORKING: "Contacting", SENT: "Negotiation", FOLLOWUP: "Negotiation" };
  const byStateCanonical: any = {}; for (const [k, v] of Object.entries(byState)) { const ck = CANON[k] || k; byStateCanonical[ck] = (byStateCanonical[ck] || 0) + (v as number); }
  for (const l of leads) byState[l.state] = (byState[l.state] || 0) + 1;
  const decided = q("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NOT NULL", workspaceId).c;
  const approvedClean = q("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision='approved' AND (edits_diff IS NULL OR edits_diff='{}')", workspaceId).c;
  const approvals = qa("SELECT * FROM approvals WHERE workspace_id=? AND decided_at IS NOT NULL", workspaceId);
  const cycleHrs = approvals.length ? approvals.map(a => (new Date(a.decided_at).getTime() - new Date(a.submitted_at).getTime()) / 3600000).sort((x, y) => x - y)[Math.floor(approvals.length / 2)] : null;
  const won = byState["WON"] || 0, lost = byState["LOST"] || 0;
  const backlogStates = ["NEW"];
  const backlogRemaining = leads.filter(l => backlogStates.includes(l.state)).length;
  const overdueFollowups = (qa("SELECT COUNT(*) c FROM tasks WHERE workspace_id=? AND status='open' AND due_at < ?", workspaceId, new Date().toISOString()) as any).c;
  const noNextStep = leads.filter(l => !["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(l.state) && !l.next_action_due_at).length;
  const pipelineOpen = leads.filter(l => ["QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WORKING"].includes(l.state)).reduce((s, l) => s + (l.est_value || 0), 0);
  const bySource = qa(`SELECT s.name as source, COUNT(*) leads, SUM(CASE WHEN l.state='WON' THEN 1 ELSE 0 END) won FROM leads l LEFT JOIN sources s ON s.id=l.source_id WHERE l.workspace_id=? GROUP BY s.name`, workspaceId);
  const byOwner = qa(`SELECT u.name, COUNT(*) active, SUM(CASE WHEN l.state='WON' THEN 1 ELSE 0 END) won, SUM(CASE WHEN l.state='LOST' THEN 1 ELSE 0 END) lost FROM leads l LEFT JOIN users u ON u.id=l.owner_id WHERE l.workspace_id=? GROUP BY u.name`, workspaceId);
  const frt = leads.filter(l => l.first_response_at);
  const frtMedianMin = frt.length ? frt.map(l => (new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime()) / 60000).sort((a, b) => a - b)[Math.floor(frt.length / 2)] : null;
  const frCompliance = q("SELECT COUNT(*) t, SUM(CASE WHEN status='submitted' THEN 1 ELSE 0 END) s FROM field_reports WHERE workspace_id=?", workspaceId);
  return {
    total_leads: leads.length, by_state: byState, by_state_canonical: byStateCanonical,
    first_pass_approval_rate: decided ? Math.round(1000 * approvedClean / decided) / 10 : null,
    approvals_decided: decided, approval_cycle_median_hrs: cycleHrs !== null ? Math.round(cycleHrs * 10) / 10 : null,
    win_rate: won + lost ? Math.round(1000 * won / (won + lost)) / 10 : null, won, lost,
    backlog_remaining: backlogRemaining,
    overdue_followups: overdueFollowups, leads_no_next_step: noNextStep,
    pipeline_open_value: pipelineOpen, first_response_median_min: frtMedianMin !== null && frtMedianMin !== undefined ? Math.round(frtMedianMin) : null,
    by_source: bySource, by_owner: byOwner,
    field_report_compliance_pct: frCompliance.t ? Math.round(100 * (frCompliance.s || 0) / frCompliance.t) : null,
  };
}

export function morningBrief(workspaceId: string) {
  const m = metrics(workspaceId);
  const qa = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
  const pendingApprovals = qa("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL", workspaceId)[0].c;
  const stuck = qa("SELECT id, service_requested, state, next_action_due_at FROM leads WHERE workspace_id=? AND next_action_due_at < ? AND state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') ORDER BY next_action_due_at LIMIT 10", workspaceId, new Date().toISOString());
  const undelivered = qa("SELECT COUNT(*) c FROM outcome_deliveries WHERE workspace_id=? AND last_status IN ('pending','failed')", workspaceId)[0].c;
  return { generated_at: new Date().toISOString(), headline: `${pendingApprovals} approvals waiting · ${m.backlog_remaining} in backlog · ${stuck.length} stuck`, pending_approvals: pendingApprovals, backlog_remaining: m.backlog_remaining, stuck, undelivered_finals: undelivered, metrics_snapshot: { fpar: m.first_pass_approval_rate, win_rate: m.win_rate, pipeline_open_value: m.pipeline_open_value } };
}

// ---- Target-state §17.1: financial values are SEPARATE concepts, never blended.
// Each figure carries its definition so no screen can present one as another.
export function financialSummary(workspaceId: string) {
  const FINALS = "('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE','UNSERVICEABLE','CLOSED')";
  const one = (sql: string) => { const r = db.prepare(sql).get(workspaceId) as any; return Math.round((r?.v || 0) * 100) / 100; };
  return {
    estimated_pipeline: { value: one(`SELECT COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state NOT IN ${FINALS}`), definition: "Sum of estimated values on open leads. An estimate — not revenue." },
    proposal_value_outstanding: { value: one("SELECT COALESCE(SUM(total),0) v FROM proposals WHERE workspace_id=? AND status='sent'"), definition: "Total of proposals sent to customers and not yet signed or expired." },
    approved_proposal_value: { value: one("SELECT COALESCE(SUM(p.total),0) v FROM proposals p WHERE p.workspace_id=? AND p.status IN ('draft','sent') AND EXISTS (SELECT 1 FROM approvals a WHERE a.proposal_id=p.id AND a.decision='approved')"), definition: "Total of proposals that passed the approval gate and are not yet signed." },
    signed_contract_value: { value: one("SELECT COALESCE(SUM(value),0) v FROM jobs WHERE workspace_id=? AND stage!='CANCELLED'"), definition: "Contract value of signed work (job value incl. approved change orders)." },
    invoiced_value: { value: one("SELECT COALESCE(SUM(total),0) v FROM invoices WHERE workspace_id=? AND status<>'void'"), definition: "Total of invoices issued (invoice records, v17). Creating an invoice from a job is what puts value here." },
    collected_cash: { value: one("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE workspace_id=? AND status='paid'"), definition: "Cash actually received through recorded payments (e.g. deposits). The only 'money in' figure." },
    outstanding_receivables: { value: one("SELECT COALESCE(SUM(total - paid_amount),0) v FROM invoices WHERE workspace_id=? AND status IN ('sent','partially_paid')"), definition: "True accounts receivable: invoiced amounts not yet paid. Excludes signed-but-uninvoiced work." },
    overdue_receivables: { value: one("SELECT COALESCE(SUM(total - paid_amount),0) v FROM invoices WHERE workspace_id=? AND status IN ('sent','partially_paid') AND due_at IS NOT NULL AND due_at < datetime('now')"), definition: "Receivables past their due date — the number that needs chasing." },
  };
}

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
    proposal_value_outstanding: { value: one("SELECT COALESCE(SUM(total),0) v FROM proposals WHERE workspace_id=? AND status='sent' AND NOT EXISTS (SELECT 1 FROM proposals p2 WHERE p2.lead_id=proposals.lead_id AND p2.version>proposals.version AND p2.status IN ('sent','signed'))"), definition: "Total of proposals sent to customers and not yet signed or expired (latest version per lead only — superseded versions never double-count)." },
    approved_proposal_value: { value: one("SELECT COALESCE(SUM(p.total),0) v FROM proposals p WHERE p.workspace_id=? AND p.status IN ('draft','sent') AND EXISTS (SELECT 1 FROM approvals a WHERE a.proposal_id=p.id AND a.decision='approved')"), definition: "Total of proposals that passed the approval gate and are not yet signed." },
    signed_contract_value: { value: one("SELECT COALESCE(SUM(value),0) v FROM jobs WHERE workspace_id=? AND stage!='CANCELLED'"), definition: "Contract value of signed work (job value incl. approved change orders)." },
    invoiced_value: { value: one("SELECT COALESCE(SUM(total),0) v FROM invoices WHERE workspace_id=? AND status<>'void'"), definition: "Total of invoices issued (invoice records, v17). Creating an invoice from a job is what puts value here." },
    collected_cash: { value: (() => { const a = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE workspace_id=? AND status='paid'").get(workspaceId) as any; const b = db.prepare("SELECT COALESCE(SUM(amount),0) v FROM payments WHERE workspace_id=? AND status='refunded'").get(workspaceId) as any; return Math.round(((a?.v || 0) - (b?.v || 0)) * 100) / 100; })(), definition: "Cash actually received through recorded payments (e.g. deposits), net of refunds. The only 'money in' figure." },
    outstanding_receivables: { value: one("SELECT COALESCE(SUM(total - paid_amount),0) v FROM invoices WHERE workspace_id=? AND status IN ('sent','partially_paid')"), definition: "True accounts receivable: invoiced amounts not yet paid. Excludes signed-but-uninvoiced work." },
    overdue_receivables: { value: one("SELECT COALESCE(SUM(total - paid_amount),0) v FROM invoices WHERE workspace_id=? AND status IN ('sent','partially_paid') AND due_at IS NOT NULL AND due_at < datetime('now')"), definition: "Receivables past their due date — the number that needs chasing." },
  };
}

// V38: every money figure drills into the exact records that compose it.
// The queries mirror financialSummary's definitions one-for-one, and each
// drill's total is the sum of its rows — so the list always ties to the
// number that was clicked. Rows carry the ids needed to open the record.
export function financeDrill(workspaceId: string, key: string): { title: string; definition: string; rows: any[] } | null {
  const F = financialSummary(workspaceId) as any;
  const q = (sql: string, ...p: any[]) => db.prepare(sql).all(workspaceId, ...p) as any[];
  const cust = `c.name`; // contacts alias used below
  switch (key) {
    case "estimated_pipeline": return { title: "Estimated pipeline", definition: F.estimated_pipeline.definition, rows: q(`SELECT l.id lead_id, c.name title, l.service_requested svc, l.state st, l.est_value amount, l.created_at at FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.state NOT IN ('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE','UNSERVICEABLE','CLOSED') ORDER BY l.est_value DESC LIMIT 200`).map(r => ({ kind: "lead", lead_id: r.lead_id, title: r.title || "Lead", sub: `${r.svc || "Service"} · ${String(r.st).replaceAll("_", " ")} · opened ${String(r.at).slice(0, 10)}`, amount: r.amount || 0 })) };
    case "proposal_value_outstanding": return { title: "Proposals out", definition: F.proposal_value_outstanding.definition, rows: q(`SELECT p.id pid, p.number num, p.version ver, p.total amount, p.created_at at, l.id lead_id, c.name title, l.service_requested svc FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND NOT EXISTS (SELECT 1 FROM proposals p2 WHERE p2.lead_id=p.lead_id AND p2.version>p.version AND p2.status IN ('sent','signed')) ORDER BY p.created_at DESC LIMIT 200`).map(r => ({ kind: "lead", lead_id: r.lead_id, title: r.title || "Customer", sub: `${r.num ? "PROP-" + r.num : "Proposal"} v${r.ver} · ${r.svc || ""} · sent ${String(r.at).slice(0, 10)}`, amount: r.amount || 0 })) };
    case "approved_proposal_value": return { title: "Approved, not yet signed", definition: F.approved_proposal_value.definition, rows: q(`SELECT p.id pid, p.number num, p.version ver, p.total amount, p.status st, p.created_at at, l.id lead_id, c.name title, l.service_requested svc FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status IN ('draft','sent') AND EXISTS (SELECT 1 FROM approvals a WHERE a.proposal_id=p.id AND a.decision='approved') ORDER BY p.created_at DESC LIMIT 200`).map(r => ({ kind: "lead", lead_id: r.lead_id, title: r.title || "Customer", sub: `${r.num ? "PROP-" + r.num : "Proposal"} v${r.ver} · ${r.st} · approved at the gate`, amount: r.amount || 0 })) };
    case "signed_contract_value": return { title: "Signed contracts", definition: F.signed_contract_value.definition, rows: q(`SELECT j.id job_id, j.lead_id, j.value amount, j.stage st, j.created_at at, c.name title, l.service_requested svc FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE j.workspace_id=? AND j.stage<>'CANCELLED' ORDER BY j.created_at DESC LIMIT 200`).map(r => ({ kind: "job", job_id: r.job_id, lead_id: r.lead_id, title: r.title || "Customer", sub: `${r.svc || "Service"} · ${String(r.st).replaceAll("_", " ")} · since ${String(r.at).slice(0, 10)}`, amount: r.amount || 0 })) };
    case "invoiced_value": return { title: "Invoiced", definition: F.invoiced_value.definition, rows: q(`SELECT i.id invoice_id, i.number num, i.total amount, i.status st, i.due_at due, i.job_id, i.lead_id, c.name title, l.service_requested svc FROM invoices i LEFT JOIN leads l ON l.id=i.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE i.workspace_id=? AND i.status<>'void' ORDER BY i.created_at DESC LIMIT 200`).map(r => ({ kind: "invoice", invoice_id: r.invoice_id, job_id: r.job_id, lead_id: r.lead_id, title: r.num, sub: `${r.title || "Customer"} · ${r.svc || ""} · ${r.st}${r.due ? " · due " + String(r.due).slice(0, 10) : ""}`, amount: r.amount || 0 })) };
    case "collected_cash": return { title: "Collected cash", definition: F.collected_cash.definition, rows: q(`SELECT p.id pay_id, p.amount, p.status st2, p.kind kind2, p.paid_at at, p.invoice_id, p.proposal_id, i.number inv_num, pr.number prop_num, COALESCE(i.lead_id, pr.lead_id) lead_id, COALESCE(i.job_id, jb.id) job_id, c.name title FROM payments p LEFT JOIN invoices i ON i.id=p.invoice_id LEFT JOIN proposals pr ON pr.id=p.proposal_id LEFT JOIN jobs jb ON jb.proposal_id=p.proposal_id LEFT JOIN leads l ON l.id=COALESCE(i.lead_id, pr.lead_id) LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status IN ('paid','refunded') ORDER BY p.paid_at DESC LIMIT 200`).map(r => ({ kind: "payment", invoice_id: r.invoice_id, job_id: r.job_id, lead_id: r.lead_id, title: r.title || "Customer", sub: `${r.inv_num ? "Invoice " + r.inv_num : r.prop_num ? "Deposit on PROP-" + r.prop_num : r.kind2} · received ${String(r.at || "").slice(0, 10)}`, amount: (r as any).st2 === "refunded" ? -(r.amount || 0) : (r.amount || 0) })) };
    case "outstanding_receivables": return { title: "Receivables open", definition: F.outstanding_receivables.definition, rows: q(`SELECT i.id invoice_id, i.number num, (i.total - i.paid_amount) amount, i.total tot, i.paid_amount paid, i.status st, i.due_at due, i.sent_at sent, i.job_id, i.lead_id, c.name title, l.service_requested svc FROM invoices i LEFT JOIN leads l ON l.id=i.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') ORDER BY i.due_at ASC LIMIT 200`).map(r => ({ kind: "invoice", invoice_id: r.invoice_id, job_id: r.job_id, lead_id: r.lead_id, title: r.num, sub: `${r.title || "Customer"} · ${r.svc || ""} · ${r.tot ? money0(r.tot) + " invoiced" : ""}${r.paid ? " · " + money0(r.paid) + " paid" : ""}${r.sent ? " · sent " + String(r.sent).slice(0, 10) : ""}${r.due ? " · due " + String(r.due).slice(0, 10) + (new Date(r.due) < new Date() ? " · ⚠ OVERDUE" : "") : ""}`, amount: r.amount || 0 })) };
    case "overdue_receivables": return { title: "Overdue receivables", definition: F.overdue_receivables.definition, rows: q(`SELECT i.id invoice_id, i.number num, (i.total - i.paid_amount) amount, i.status st, i.due_at due, i.job_id, i.lead_id, c.name title, l.service_requested svc FROM invoices i LEFT JOIN leads l ON l.id=i.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') AND i.due_at IS NOT NULL AND i.due_at < datetime('now') ORDER BY i.due_at ASC LIMIT 200`).map(r => ({ kind: "invoice", invoice_id: r.invoice_id, job_id: r.job_id, lead_id: r.lead_id, title: r.num, sub: `${r.title || "Customer"} · ${r.svc || ""} · due ${String(r.due).slice(0, 10)} · ⚠ OVERDUE`, amount: r.amount || 0 })) };
    default: return null;
  }
}
function money0(n: number): string { return "$" + Math.round(Number(n) || 0).toLocaleString(); }

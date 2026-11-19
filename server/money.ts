// Money truth for a project (v92): the five money concepts stay separate —
// contract (signed), revised (contract + approved change orders), invoiced,
// collected, and cost (budget vs actual). Margin is always revised − cost.
import { db } from "./db.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function estLineCost(lines: any[]): number {
  return r2((lines || []).reduce((s, l) => s + (Number(l?.qty) || 1) * (Number(l?.cost) || 0), 0));
}
export function signedProposalFor(ws: string, leadId: string) {
  return db.prepare("SELECT * FROM proposals WHERE workspace_id=? AND lead_id=? AND status='signed' ORDER BY signed_at DESC, created_at DESC").get(ws, leadId) as any;
}

export function jobMoney(ws: string, job: any) {
  const signed = job.lead_id ? signedProposalFor(ws, job.lead_id) : null;
  const contract = r2(signed ? Number(signed.total || 0) : Number(job.value || 0));
  const coApproved = r2(((db.prepare("SELECT COALESCE(SUM(delta_total),0) AS s FROM change_orders WHERE workspace_id=? AND job_id=? AND status='approved'").get(ws, job.id) as any)?.s) || 0);
  const revised = r2(contract + coApproved);
  const invoiced = r2(((db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM invoices WHERE workspace_id=? AND job_id=? AND status NOT IN ('draft','void')").get(ws, job.id) as any)?.s) || 0);
  const collectedInv = r2(((db.prepare("SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.workspace_id=? AND i.job_id=? AND p.status='paid'").get(ws, job.id) as any)?.s) || 0);
  const collectedDep = signed ? r2(((db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE workspace_id=? AND proposal_id=? AND kind='deposit' AND status='paid'").get(ws, signed.id) as any)?.s) || 0) : 0;
  const collected = r2(collectedInv + collectedDep);
  const labor = r2(((db.prepare("SELECT COALESCE(SUM(COALESCE(t.hours,0)*COALESCE(t.rate,0)),0) AS s FROM wo_time_entries t JOIN work_orders w ON w.id=t.work_order_id WHERE t.workspace_id=? AND w.job_id=?").get(ws, job.id) as any)?.s) || 0);
  const materials = r2(((db.prepare("SELECT COALESCE(SUM(COALESCE(m.qty,0)*COALESCE(m.unit_cost,0)),0) AS s FROM wo_materials m JOIN work_orders w ON w.id=m.work_order_id WHERE m.workspace_id=? AND w.job_id=?").get(ws, job.id) as any)?.s) || 0);
  const expenses = r2(((db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE workspace_id=? AND job_id=?").get(ws, job.id) as any)?.s) || 0);
  const actual_cost = r2(labor + materials + expenses);
  let budget_cost: number | null = job.budget_cost != null ? Number(job.budget_cost) : null;
  if (budget_cost == null && signed) { try { budget_cost = estLineCost(JSON.parse(signed.line_items || "[]")); } catch { budget_cost = 0; } }
  const margin = r2(revised - actual_cost);
  const projected_margin = budget_cost != null ? r2(revised - budget_cost) : null;
  const cost_by_wo = (db.prepare("SELECT w.id, w.seq, w.title, w.status, w.percent_complete FROM work_orders w WHERE w.workspace_id=? AND w.job_id=? AND w.status!='cancelled' ORDER BY w.seq").all(ws, job.id) as any[]).map(w => {
    const l = r2(((db.prepare("SELECT COALESCE(SUM(COALESCE(hours,0)*COALESCE(rate,0)),0) AS s FROM wo_time_entries WHERE workspace_id=? AND work_order_id=?").get(ws, w.id) as any)?.s) || 0);
    const m = r2(((db.prepare("SELECT COALESCE(SUM(COALESCE(qty,0)*COALESCE(unit_cost,0)),0) AS s FROM wo_materials WHERE workspace_id=? AND work_order_id=?").get(ws, w.id) as any)?.s) || 0);
    const ex = r2(((db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE workspace_id=? AND work_order_id=?").get(ws, w.id) as any)?.s) || 0);
    return { id: w.id, display_no: `${job.project_no}-W${String(w.seq).padStart(2, "0")}`, title: w.title, status: w.status, percent_complete: w.percent_complete || 0, labor: l, materials: m, expenses: ex, cost_total: r2(l + m + ex) };
  });
  return {
    contract, change_orders: coApproved, revised, invoiced, collected,
    labor_cost: labor, materials_cost: materials, expenses_cost: expenses, actual_cost,
    budget_cost, margin, margin_pct: revised > 0 ? Math.round((margin / revised) * 1000) / 10 : null,
    projected_margin, projected_margin_pct: revised > 0 && projected_margin != null ? Math.round((projected_margin / revised) * 1000) / 10 : null,
    cost_by_wo, has_signed_proposal: !!signed,
  };
}

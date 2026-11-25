// Workpile — lifecycle integrity (v117, LIFECYCLE-INTEGRITY-SCOPE S2): a
// project's readiness to close is COMPUTED from its facts — every work
// order, every invoice, every allocated payment — never chosen by hand.
// The derived stage is the furthest stage the facts prove; when the stored
// stage lags it by more than a day, that's drift, and it gets surfaced.
import { db } from "./db.ts";
import { jobMoney } from "./money.ts";
import { inspectionGateForWO } from "./inspections.ts";

const r2 = (n: number) => Math.round(n * 100) / 100;
export const STAGE_RANK: Record<string, number> = { AWAITING_SCHEDULING: 0, SCHEDULED: 1, IN_PROGRESS: 2, WORK_COMPLETED: 3, DOCUMENTATION_PENDING: 4, READY_TO_INVOICE: 5, INVOICED: 6, READY_TO_CLOSE: 7, CLOSED: 8, CANCELLED: 8 };

export function allocatedToInvoice(ws: string, invoiceId: string): number {
  return r2(((db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payment_allocations WHERE workspace_id=? AND invoice_id=?").get(ws, invoiceId) as any)?.s) || 0);
}

// Payments recorded against a project (checks, money orders, split payments)
// whose money has not been fully applied to invoices — money in limbo.
export function unallocatedPayments(ws: string, jobId: string): any[] {
  const rows = db.prepare("SELECT * FROM payments WHERE workspace_id=? AND job_id=? AND kind='invoice_payment' AND status='paid' ORDER BY created_at").all(ws, jobId) as any[];
  return rows.map(p => {
    const alloc = r2(((db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payment_allocations WHERE workspace_id=? AND payment_id=?").get(ws, p.id) as any)?.s) || 0);
    return { ...p, allocated: alloc, unallocated: r2((p.amount || 0) - alloc) };
  }).filter(p => p.unallocated > 0.001);
}

export function closeReadiness(ws: string, job: any) {
  const conds: any[] = [];
  const wos = db.prepare("SELECT id, status FROM work_orders WHERE workspace_id=? AND job_id=?").all(ws, job.id) as any[];
  const openWos = wos.filter(w => !["completed", "cancelled"].includes(w.status)).length;
  conds.push({ key: "work_orders", label: "All work orders complete", met: wos.length > 0 && openWos === 0, detail: wos.length === 0 ? "No work orders on this project" : openWos ? `${openWos} work order(s) still open` : `${wos.length} work order(s) complete` });
  let inspOpen = 0, inspFailed = 0, actOpen = 0;
  for (const w of wos) { const g = inspectionGateForWO(ws, w.id); inspOpen += g.open; inspFailed += g.failed; actOpen += g.actions_open; }
  conds.push({ key: "inspections", label: "Inspections passed, no open actions", met: inspOpen === 0 && inspFailed === 0 && actOpen === 0, detail: (inspOpen || inspFailed || actOpen) ? `${inspOpen} open · ${inspFailed} failed · ${actOpen} corrective action(s) open` : "All inspections clear" });
  const docs = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN status='received' THEN 1 ELSE 0 END) r FROM documents WHERE (job_id=? OR lead_id=?) AND required=1").get(job.id, job.lead_id) as any;
  conds.push({ key: "documents", label: "Required documents received", met: (docs.t || 0) === 0 || (docs.r || 0) >= (docs.t || 0), detail: (docs.t || 0) === 0 ? "No documents required" : `${docs.r || 0} of ${docs.t} received` });
  const m = jobMoney(ws, job);
  const invs = db.prepare("SELECT * FROM invoices WHERE workspace_id=? AND job_id=? AND status<>'void' ORDER BY created_at").all(ws, job.id) as any[];
  const fullyInvoiced = m.invoiced >= m.revised - 0.001;
  conds.push({ key: "fully_invoiced", label: "Contract fully invoiced", met: fullyInvoiced || !!job.invoice_variance_note, detail: fullyInvoiced ? `$${m.invoiced.toLocaleString()} invoiced of $${m.revised.toLocaleString()} revised contract` : job.invoice_variance_note ? `Variance noted: ${job.invoice_variance_note}` : `$${m.invoiced.toLocaleString()} invoiced of $${m.revised.toLocaleString()} revised contract` });
  const nonFinal = invs.filter(i => i.status !== "paid");
  const unalloc = unallocatedPayments(ws, job.id);
  const unallocTotal = r2(unalloc.reduce((s, p) => s + p.unallocated, 0));
  const nothingToCollect = invs.length === 0 && m.revised <= 0.001;
  conds.push({ key: "fully_collected", label: "Every invoice settled, no loose money", met: nothingToCollect || (invs.length > 0 && nonFinal.length === 0 && unalloc.length === 0), detail: nothingToCollect ? "Nothing to collect" : [nonFinal.length ? `${nonFinal.length} invoice(s) not fully paid` : "All invoices paid", unalloc.length ? `$${unallocTotal.toLocaleString()} received but not allocated to an invoice` : ""].filter(Boolean).join(" · ") });
  return { ready: conds.every(c => c.met), conditions: conds, money: { contract: m.contract, revised: m.revised, invoiced: m.invoiced, collected: m.collected } };
}

export function derivedStage(ws: string, job: any): { stage: string; rank: number; readiness: any } {
  const readiness = closeReadiness(ws, job);
  if (["CLOSED", "CANCELLED"].includes(job.stage)) return { stage: job.stage, rank: STAGE_RANK[job.stage], readiness };
  if (readiness.ready) return { stage: "READY_TO_CLOSE", rank: STAGE_RANK.READY_TO_CLOSE, readiness };
  const issued = (db.prepare("SELECT COUNT(*) c FROM invoices WHERE workspace_id=? AND job_id=? AND status NOT IN ('void','draft')").get(ws, job.id) as any).c;
  if (issued > 0) return { stage: "INVOICED", rank: STAGE_RANK.INVOICED, readiness };
  const wos = db.prepare("SELECT status FROM work_orders WHERE workspace_id=? AND job_id=?").all(ws, job.id) as any[];
  if (wos.length > 0 && wos.every(w => ["completed", "cancelled"].includes(w.status))) return { stage: "WORK_COMPLETED", rank: STAGE_RANK.WORK_COMPLETED, readiness };
  return { stage: job.stage, rank: STAGE_RANK[job.stage] ?? 0, readiness };
}

// Drift = the facts prove a later stage than the one on the board, and the
// board has said so for over 24 hours.
export function stageDrift(ws: string, job: any): { derived: string; stored: string; hours: number } | null {
  if (["CLOSED", "CANCELLED"].includes(job.stage)) return null;
  const d = derivedStage(ws, job);
  const storedRank = STAGE_RANK[job.stage] ?? 0;
  if (d.rank <= storedRank) return null;
  const since = job.stage_changed_at || job.updated_at || job.created_at;
  const hours = Math.round((Date.now() - new Date(since).getTime()) / 360000) / 10;
  return hours >= 24 ? { derived: d.stage, stored: job.stage, hours } : null;
}

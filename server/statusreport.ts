// Workpile — Weekly Status Report (slice 24): the owner's one-page week.
// Everything Gregory asked for in one read: pipeline movement, backlog,
// approvals, field compliance, labor, inbox, handoffs. Computed live from
// the same tables the app runs on — no hand-kept spreadsheet.
import { db } from "./db.ts";
import { weekStartOf } from "./timesheets.ts";

export function weeklyReport(ws: string, week?: string) {
  const from = week || weekStartOf(new Date());
  const to = new Date(new Date(from + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const inWk = (col: string) => `${col}>=? AND ${col}<=?`;
  const one = (sql: string, ...args: any[]) => (db.prepare(sql).get(...args) as any) || {};
  const newLeads = one(`SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND date(created_at)>=? AND date(created_at)<=?`, ws, from, to).c;
  const finals = db.prepare(`SELECT o.outcome, COUNT(*) c, COALESCE(SUM(l.est_value),0) v FROM outcome_deliveries o LEFT JOIN leads l ON l.id=o.lead_id WHERE o.workspace_id=? AND date(o.created_at)>=? AND date(o.created_at)<=? GROUP BY o.outcome`).all(ws, from, to) as any[];
  const fin = (o: string) => finals.find(f => f.outcome === o) || { c: 0, v: 0 };
  const proposals = one(`SELECT COUNT(*) c, COALESCE(SUM(total),0) v FROM proposals WHERE workspace_id=? AND date(created_at)>=? AND date(created_at)<=?`, ws, from, to);
  const decided = one(`SELECT COUNT(*) c, SUM(CASE WHEN decision='APPROVED' THEN 1 ELSE 0 END) a FROM approvals WHERE workspace_id=? AND decided_at IS NOT NULL AND date(decided_at)>=? AND date(decided_at)<=?`, ws, from, to);
  const pendingApprovals = one(`SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL`, ws).c;
  const backlog = one(`SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state IN ('NEW','TRIAGED','QUALIFYING')`, ws).c;
  const backlogValue = one(`SELECT COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state IN ('NEW','TRIAGED','QUALIFYING','QUALIFIED','READY_FOR_APPROVAL')`, ws).v;
  const fr = one(`SELECT COUNT(*) t, SUM(CASE WHEN status='submitted' THEN 1 ELSE 0 END) s FROM field_reports WHERE workspace_id=? AND report_date>=? AND report_date<=?`, ws, from, to);
  const ts = one(`SELECT COUNT(*) t, SUM(CASE WHEN status='submitted' THEN 1 ELSE 0 END) s FROM timesheets WHERE workspace_id=? AND week_of=?`, ws, from);
  const labor = one(`SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a, COUNT(DISTINCT lead_id) jobs FROM time_entries WHERE workspace_id=? AND entry_date>=? AND entry_date<=?`, ws, from, to);
  const topJobs = db.prepare(`SELECT l.service_requested, c.name customer, SUM(t.hours) h, SUM(t.amount) a FROM time_entries t LEFT JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND t.entry_date>=? AND t.entry_date<=? GROUP BY t.lead_id ORDER BY a DESC LIMIT 5`).all(ws, from, to) as any[];
  const inboxIn = one(`SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND date(created_at)>=? AND date(created_at)<=?`, ws, from, to).c;
  const inboxDone = one(`SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND completed_at IS NOT NULL AND date(completed_at)>=? AND date(completed_at)<=?`, ws, from, to).c;
  const inboxOpen = one(`SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND COALESCE(status,'open')='open'`, ws).c;
  const sched = one(`SELECT COUNT(*) c, COUNT(DISTINCT lead_id) jobs FROM job_schedule WHERE workspace_id=? AND work_date>=? AND work_date<=?`, ws, from, to);
  const undelivered = one(`SELECT COUNT(*) c FROM outcome_deliveries WHERE workspace_id=? AND delivered_at IS NULL`, ws).c;
  const pct = (s: number, t: number) => t > 0 ? Math.round((s / t) * 100) : null;
  const r = {
    week_of: from, week_to: to,
    new_leads: newLeads,
    won: { count: fin("WON").c, value: fin("WON").v }, lost: { count: fin("LOST").c },
    no_response: fin("NO_RESPONSE").c,
    proposals: { count: proposals.c, value: proposals.v },
    approvals: { decided: decided.c || 0, approved: decided.a || 0, rate: pct(decided.a || 0, decided.c || 0), pending: pendingApprovals },
    backlog: { open: backlog, pipeline_value: backlogValue },
    field_reports: { filed: fr.s || 0, expected: fr.t || 0, pct: pct(fr.s || 0, fr.t || 0) },
    timesheets: { submitted: ts.s || 0, expected: ts.t || 0, pct: pct(ts.s || 0, ts.t || 0) },
    labor: { hours: labor.h, cost: Math.round(labor.a * 100) / 100, jobs: labor.jobs },
    top_jobs: topJobs,
    inbox: { received: inboxIn, cleared: inboxDone, open_now: inboxOpen },
    scheduled: { assignments: sched.c, jobs: sched.jobs },
    handoffs_undelivered: undelivered,
  };
  const money = (n: number) => "$" + Math.round(n || 0).toLocaleString();
  const lines = [
    `WEEKLY STATUS — week of ${from}`,
    `New leads in: ${r.new_leads} · Backlog open: ${r.backlog.open} (${money(r.backlog.pipeline_value)} in pipeline)`,
    `Proposals: ${r.proposals.count} created (${money(r.proposals.value)}) · Won: ${r.won.count} (${money(r.won.value)}) · Lost: ${r.lost.count} · No response: ${r.no_response}`,
    `Approvals: ${r.approvals.decided} decided (${r.approvals.rate ?? "—"}% approved) · ${r.approvals.pending} waiting`,
    `Field: reports ${r.field_reports.filed}/${r.field_reports.expected} (${r.field_reports.pct ?? "—"}%) · Timesheets ${r.timesheets.submitted}/${r.timesheets.expected} (${r.timesheets.pct ?? "—"}%) · Labor ${r.labor.hours}h (${money(r.labor.cost)}) across ${r.labor.jobs} jobs · ${r.scheduled.assignments} crew assignments`,
    `Inbox: ${r.inbox.received} received · ${r.inbox.cleared} cleared · ${r.inbox.open_now} still open · Handoffs undelivered: ${r.handoffs_undelivered}`,
  ];
  return { ...r, text: lines.join("\n") };
}

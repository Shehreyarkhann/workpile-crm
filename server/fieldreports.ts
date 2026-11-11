// Workpile — field reports (slice 22): daily expectations like timesheets.
// Every field manager owes a report every day; missing ones past their day
// get chased exactly once; reports attach to a job when there is one.
import { db, uid, now } from "./db.ts";
import { notify, notifyOwners } from "./comms.ts";

export function todayStr(): string { return new Date().toLocaleDateString("en-CA"); }
export function ensureDay(ws: string, date: string): number {
  const managers = db.prepare("SELECT id FROM users WHERE workspace_id=? AND active=1 AND role IN ('PM','LEAD_OWNER')").all(ws) as any[];
  let created = 0;
  for (const m of managers) {
    const exists = db.prepare("SELECT id FROM field_reports WHERE workspace_id=? AND manager_id=? AND report_date=?").get(ws, m.id, date);
    if (!exists) { db.prepare("INSERT INTO field_reports (id,workspace_id,manager_id,report_date,status) VALUES (?,?,?,?,'missing')").run(uid("fr"), ws, m.id, date); created++; }
  }
  // v3: a roster worker SCHEDULED on a job that day owes a report too (no login needed — office can file it)
  const scheduled = db.prepare("SELECT DISTINCT worker_id FROM job_schedule WHERE workspace_id=? AND work_date=? AND worker_id IS NOT NULL").all(ws, date) as any[];
  for (const s of scheduled) {
    const w = db.prepare("SELECT * FROM workers WHERE id=?").get(s.worker_id) as any;
    if (!w || (w.linked_user_id && managers.some(m => m.id === w.linked_user_id))) continue;
    const exists = db.prepare("SELECT id FROM field_reports WHERE workspace_id=? AND worker_id=? AND report_date=?").get(ws, w.id, date);
    if (!exists) { db.prepare("INSERT INTO field_reports (id,workspace_id,manager_id,worker_id,report_date,status) VALUES (?,?,?,?,?,'missing')").run(uid("fr"), ws, w.linked_user_id || null, w.id, date); created++; }
  }
  return created;
}
export function chaseReport(row: any) {
  if (row.manager_id) notify(row.workspace_id, [row.manager_id], "field_report_missing", `📋 Field report missing — ${row.report_date}`, "Your daily field report for that date hasn't been submitted. Open Workpile → Ops Console → Field reports to file it.", undefined, { type: "ops", id: "field-reports" });
  notifyOwners(row.workspace_id, "field_report_missing", `📋 Field report still missing: ${row.report_date}`, "A field manager's daily report is outstanding — it was just chased automatically.");
  db.prepare("UPDATE field_reports SET chased_at=? WHERE id=?").run(now(), row.id);
}
export function chaseMissingReports(): { chased: number } {
  const rows = db.prepare("SELECT * FROM field_reports WHERE status='missing' AND report_date<? AND chased_at IS NULL").all(todayStr()) as any[];
  for (const r of rows) { try { chaseReport(r); } catch { /* keep sweeping */ } }
  return { chased: rows.length };
}

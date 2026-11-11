// Workpile — timesheets (slice 20): expected sheets are created automatically,
// managers log per-day hours, missing sheets get chased, payroll gets a CSV.
import { db, uid, now } from "./db.ts";
import { notify, notifyOwners } from "./comms.ts";

export const FIELD_ROLES = ["PM", "LEAD_OWNER"];
export function weekStartOf(d: Date): string {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
export function ensureWeek(ws: string, weekOf: string): number {
  // v19: sheets exist for everyone schedulable (PM / LEAD_OWNER / OPS_ADMIN) AND for anyone
  // who actually has a crew-schedule row that week — assigning a job must surface the sheet.
  const managers = db.prepare("SELECT id FROM users WHERE workspace_id=? AND active=1 AND role IN ('PM','LEAD_OWNER','OPS_ADMIN')").all(ws) as any[];
  const wkEndTs = new Date(new Date(weekOf + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  for (const r of db.prepare("SELECT DISTINCT user_id FROM job_schedule WHERE workspace_id=? AND user_id IS NOT NULL AND work_date>=? AND work_date<=?").all(ws, weekOf, wkEndTs) as any[])
    if (!managers.some(m => m.id === r.user_id)) managers.push({ id: r.user_id });
  let created = 0;
  for (const m of managers) {
    const exists = db.prepare("SELECT id FROM timesheets WHERE workspace_id=? AND manager_id=? AND week_of=?").get(ws, m.id, weekOf);
    if (!exists) { db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status) VALUES (?,?,?,?, 'missing')").run(uid("ts"), ws, m.id, weekOf); created++; }
  }
  // v3 slice 29: a sheet for every active ROSTER worker too (they have no login; the office files for them)
  const workers = db.prepare("SELECT * FROM workers WHERE workspace_id=? AND active=1").all(ws) as any[];
  for (const r of db.prepare("SELECT DISTINCT worker_id FROM job_schedule WHERE workspace_id=? AND worker_id IS NOT NULL AND work_date>=? AND work_date<=?").all(ws, weekOf, wkEndTs) as any[])
    if (!workers.some(w => w.id === r.worker_id)) { const wr = db.prepare("SELECT * FROM workers WHERE id=?").get(r.worker_id) as any; if (wr) workers.push(wr); }
  for (const w of workers) {
    if (w.linked_user_id && managers.some(m => m.id === w.linked_user_id)) { // linked PM/owner already has a user sheet — link it instead
      db.prepare("UPDATE timesheets SET worker_id=? WHERE workspace_id=? AND manager_id=? AND week_of=? AND worker_id IS NULL").run(w.id, ws, w.linked_user_id, weekOf); continue; }
    const exists = db.prepare("SELECT id FROM timesheets WHERE workspace_id=? AND worker_id=? AND week_of=?").get(ws, w.id, weekOf);
    if (!exists) { db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,worker_id,week_of,status) VALUES (?,?,?,?,?, 'missing')").run(uid("ts"), ws, w.linked_user_id || null, w.id, weekOf); created++; }
  }
  return created;
}
export function chaseRow(row: any) {
  if (row.manager_id) notify(row.workspace_id, [row.manager_id], "timesheet_missing", `⏱ Timesheet missing — week of ${row.week_of}`, "Your timesheet for that week hasn't been logged. Open Workpile → Ops Console → Timesheets to log your hours.", undefined, { type: "ops", id: "timesheets" });
  notifyOwners(row.workspace_id, "timesheet_missing", `⏱ Timesheet still missing: week of ${row.week_of}`, "A worker's timesheet is outstanding — it was just chased automatically.", undefined, { type: "ops", id: "timesheets" });
  db.prepare("UPDATE timesheets SET chased_at=? WHERE id=?").run(now(), row.id);
}
export function chaseMissing(): { chased: number } {
  const thisWeek = weekStartOf(new Date());
  const rows = db.prepare("SELECT * FROM timesheets WHERE status='missing' AND week_of<? AND chased_at IS NULL").all(thisWeek) as any[];
  for (const r of rows) { try { chaseRow(r); } catch { /* keep sweeping */ } }
  return { chased: rows.length };
}
export function sumDays(days: any): number {
  if (!days || typeof days !== "object") return 0;
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].reduce((s, k) => s + (Number(days[k]) || 0), 0);
}

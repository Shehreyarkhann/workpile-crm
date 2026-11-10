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
  const managers = db.prepare("SELECT id FROM users WHERE workspace_id=? AND active=1 AND role IN ('PM','LEAD_OWNER')").all(ws) as any[];
  let created = 0;
  for (const m of managers) {
    const exists = db.prepare("SELECT id FROM timesheets WHERE workspace_id=? AND manager_id=? AND week_of=?").get(ws, m.id, weekOf);
    if (!exists) { db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status) VALUES (?,?,?,?, 'missing')").run(uid("ts"), ws, m.id, weekOf); created++; }
  }
  return created;
}
export function chaseRow(row: any) {
  notify(row.workspace_id, [row.manager_id], "timesheet_missing", `⏱ Timesheet missing — week of ${row.week_of}`, "Your timesheet for that week hasn't been logged. Open Workpile → Ops Console → Timesheets to log your hours.");
  notifyOwners(row.workspace_id, "timesheet_missing", `⏱ Timesheet still missing: week of ${row.week_of}`, "A field manager's timesheet is outstanding — it was just chased automatically.");
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

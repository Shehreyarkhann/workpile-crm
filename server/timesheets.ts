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
export async function chaseRow(row: any): Promise<{ delivery: string; message: string }> {
  // Resolve WHO is being chased and whether any channel can actually reach
  // them. A roster worker with no linked login has no email and no in-app
  // inbox — the honest outcome then is "recorded", never "sent".
  let name = "the worker"; let email: string | null = null;
  if (row.worker_id) { const w = db.prepare("SELECT * FROM workers WHERE id=?").get(row.worker_id) as any; if (w) { name = w.name; if (w.linked_user_id) { const u = db.prepare("SELECT email FROM users WHERE id=?").get(w.linked_user_id) as any; email = (u && u.email) || null; } } }
  if (row.manager_id) { const u = db.prepare("SELECT name, email FROM users WHERE id=?").get(row.manager_id) as any; if (u) { if (!row.worker_id) name = u.name; if (!email) email = u.email || null; } }
  let delivery = "recorded"; let emailed = "";
  if (email) {
    try { const { queueAndDeliver } = await import("./comms.ts"); const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(row.workspace_id) as any;
      const r: any = await queueAndDeliver(row.workspace_id, { channel: "email", to: email, subject: `Timesheet missing — week of ${row.week_of}`, body: `Hi ${name},\n\nYour timesheet for the week of ${row.week_of} hasn't been logged yet. Please log your hours in Workpile (Ops Console → Timesheets) or tell the office your hours so they can file them for you.\n\n— ${ws ? ws.name : "Workpile"}` });
      delivery = r.status === "test_mode" ? "test_mode" : "emailed"; emailed = email;
    } catch { delivery = "recorded"; }
  }
  if (row.manager_id) notify(row.workspace_id, [row.manager_id], "timesheet_missing", `⏱ Timesheet missing — week of ${row.week_of}`, "Your timesheet for that week hasn't been logged. Open Workpile → Ops Console → Timesheets to log your hours.", undefined, { type: "ops", id: "timesheets" });
  notifyOwners(row.workspace_id, "timesheet_missing", `⏱ Timesheet still missing: week of ${row.week_of}`, "A worker's timesheet is outstanding — it was just chased.", undefined, { type: "ops", id: "timesheets" });
  db.prepare("UPDATE timesheets SET chased_at=? WHERE id=?").run(now(), row.id);
  const message = delivery === "emailed" ? `Chase emailed to ${name} (${emailed}) ✓`
    : delivery === "test_mode" ? `Chase for ${name} recorded — email is in test mode, so it was NOT delivered. ${row.manager_id ? "They were also notified in the app." : "Ask them to add an email, or chase them directly."}`
    : `Chase recorded for ${name} — no email on file for them, so nothing was emailed. The owners were notified; chase them directly or link them to a login.`;
  return { delivery, message };
}
export async function chaseMissing(): Promise<{ chased: number }> {
  const thisWeek = weekStartOf(new Date());
  const rows = db.prepare("SELECT * FROM timesheets WHERE status='missing' AND week_of<? AND chased_at IS NULL").all(thisWeek) as any[];
  for (const r of rows) { try { await chaseRow(r); } catch { /* keep sweeping */ } }
  return { chased: rows.length };
}
export function sumDays(days: any): number {
  if (!days || typeof days !== "object") return 0;
  return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].reduce((s, k) => s + (Number(days[k]) || 0), 0);
}

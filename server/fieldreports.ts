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
export async function chaseReport(row: any): Promise<{ delivery: string; message: string }> {
  let name = "the field manager"; let email: string | null = null;
  if (row.worker_id) { const w = db.prepare("SELECT * FROM workers WHERE id=?").get(row.worker_id) as any; if (w) { name = w.name; if (w.linked_user_id) { const u = db.prepare("SELECT email FROM users WHERE id=?").get(w.linked_user_id) as any; email = (u && u.email) || null; } } }
  if (row.manager_id) { const u = db.prepare("SELECT name, email FROM users WHERE id=?").get(row.manager_id) as any; if (u) { if (!row.worker_id) name = u.name; if (!email) email = u.email || null; } }
  let delivery = "recorded"; let emailed = "";
  if (email) {
    try { const { queueAndDeliver } = await import("./comms.ts"); const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(row.workspace_id) as any;
      const r: any = await queueAndDeliver(row.workspace_id, { channel: "email", to: email, subject: `Field report missing — ${row.report_date}`, body: `Hi ${name},\n\nYour daily field report for ${row.report_date} hasn't been submitted yet. Please file it in Workpile (Ops Console → Field reports) or tell the office what to file for you.\n\n— ${ws ? ws.name : "Workpile"}` });
      delivery = r.status === "test_mode" ? "test_mode" : "emailed"; emailed = email;
    } catch { delivery = "recorded"; }
  }
  if (row.manager_id) notify(row.workspace_id, [row.manager_id], "field_report_missing", `📋 Field report missing — ${row.report_date}`, "Your daily field report for that date hasn't been submitted. Open Workpile → Ops Console → Field reports to file it.", undefined, { type: "ops", id: "field-reports" });
  notifyOwners(row.workspace_id, "field_report_missing", `📋 Field report still missing: ${row.report_date}`, "A field manager's daily report is outstanding — it was just chased.");
  db.prepare("UPDATE field_reports SET chased_at=? WHERE id=?").run(now(), row.id);
  const message = delivery === "emailed" ? `Chase emailed to ${name} (${emailed}) ✓`
    : delivery === "test_mode" ? `Chase for ${name} recorded — email is in test mode, so it was NOT delivered. ${row.manager_id ? "They were also notified in the app." : "Chase them directly or link them to a login."}`
    : `Chase recorded for ${name} — no email on file for them, so nothing was emailed. The owners were notified; chase them directly or link them to a login.`;
  return { delivery, message };
}
export async function chaseMissingReports(): Promise<{ chased: number }> {
  const rows = db.prepare("SELECT * FROM field_reports WHERE status='missing' AND report_date<? AND chased_at IS NULL").all(todayStr()) as any[];
  for (const r of rows) { try { await chaseReport(r); } catch { /* keep sweeping */ } }
  return { chased: rows.length };
}

// Workpile — labor costing (slice 21): rate classes x job sector, crew, job time.
// A worker's pay rate comes from their labor class; which column applies
// (private vs government/prevailing) comes from the JOB's sector. The rate is
// snapshotted onto each time entry, so later rate edits never rewrite history.
import { db, uid, now } from "./db.ts";

export function rateFor(ws: string, userId: string, sector: string): { rate: number; class_name: string | null; rated: boolean } {
  const u = db.prepare("SELECT labor_class_id FROM users WHERE id=? AND workspace_id=?").get(userId, ws) as any;
  if (!u?.labor_class_id) return { rate: 0, class_name: null, rated: false };
  const c = db.prepare("SELECT * FROM labor_classes WHERE id=? AND workspace_id=?").get(u.labor_class_id, ws) as any;
  if (!c) return { rate: 0, class_name: null, rated: false };
  const rate = sector === "government" ? (c.govt_rate || 0) : (c.private_rate || 0);
  return { rate, class_name: c.name, rated: rate > 0 };
}
export function logTime(ws: string, leadId: string, actorId: string, b: { user_id: string; entry_date: string; hours: number; note?: string }) {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(leadId, ws) as any;
  if (!lead) return { error: "lead_not_found" };
  const worker = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=?").get(b.user_id, ws) as any;
  if (!worker) return { error: "bad_worker" };
  const hours = Number(b.hours) || 0;
  if (hours <= 0 || hours > 24) return { error: "bad_hours" };
  const { rate, class_name, rated } = rateFor(ws, b.user_id, lead.sector || "private");
  const id = uid("time");
  db.prepare("INSERT INTO time_entries (id,workspace_id,lead_id,user_id,entry_date,hours,rate,amount,class_name,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, ws, leadId, b.user_id, String(b.entry_date || new Date().toISOString().slice(0, 10)), hours, rate, Math.round(hours * rate * 100) / 100, class_name, String(b.note || ""), actorId, now());
  // logging time on a job implies crew membership
  try { db.prepare("INSERT INTO job_crew (id,workspace_id,lead_id,user_id,created_at) VALUES (?,?,?,?,?)").run(uid("crew"), ws, leadId, b.user_id, now()); } catch { /* already crew */ }
  return { entry: db.prepare("SELECT * FROM time_entries WHERE id=?").get(id), rated };
}
export function jobLabor(ws: string, leadId: string) {
  const entries = db.prepare("SELECT t.*, u.name worker FROM time_entries t LEFT JOIN users u ON u.id=t.user_id WHERE t.workspace_id=? AND t.lead_id=? ORDER BY t.entry_date DESC, t.created_at DESC").all(ws, leadId) as any[];
  const crew = db.prepare("SELECT c.*, u.name, u.role, lc.name class_name FROM job_crew c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN labor_classes lc ON lc.id=u.labor_class_id WHERE c.workspace_id=? AND c.lead_id=? ORDER BY u.name").all(ws, leadId) as any[];
  const hours = entries.reduce((a, e) => a + (e.hours || 0), 0);
  const cost = entries.reduce((a, e) => a + (e.amount || 0), 0);
  const unrated = entries.filter(e => !(e.rate > 0)).reduce((a, e) => a + (e.hours || 0), 0);
  return { entries, crew, hours, cost: Math.round(cost * 100) / 100, unrated_hours: unrated };
}
export const DEFAULT_CLASSES = [
  { name: "Laborer", private_rate: 28, govt_rate: 52 },
  { name: "Technician", private_rate: 38, govt_rate: 68 },
  { name: "Foreman / Supervisor", private_rate: 48, govt_rate: 84 },
  { name: "Project Manager", private_rate: 65, govt_rate: 110 },
];

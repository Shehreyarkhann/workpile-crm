// Workpile — labor costing (slice 21) + roster workers (v3 slice 29).
// Workers are a ROSTER (name + optional phone/class) — not login accounts, never seats.
// Login users appear in the roster as linked workers. A worker's rate comes from their
// labor class; which column applies (private vs government) comes from the JOB's sector.
// Rates snapshot onto each time entry, so later rate edits never rewrite history.
import { db, uid, now } from "./db.ts";

export function resolveWorker(ws: string, b: { worker_id?: string; worker_name?: string; user_id?: string; labor_class_id?: string; phone?: string }): any {
  if (b.worker_id) { const w = db.prepare("SELECT * FROM workers WHERE id=? AND workspace_id=?").get(b.worker_id, ws) as any; if (w) return w; }
  if (b.user_id) {
    let w = db.prepare("SELECT * FROM workers WHERE linked_user_id=? AND workspace_id=?").get(b.user_id, ws) as any;
    if (!w) { const u = db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=?").get(b.user_id, ws) as any; if (!u) return null;
      const id = "wrk_" + u.id.replace(/^usr_/, ""); db.prepare("INSERT INTO workers (id,workspace_id,name,labor_class_id,linked_user_id,active,created_at) VALUES (?,?,?,?,?,1,?)").run(id, ws, u.name, u.labor_class_id || null, u.id, now());
      w = db.prepare("SELECT * FROM workers WHERE id=?").get(id); }
    return w;
  }
  const name = String(b.worker_name || "").trim();
  if (name) {
    const w = db.prepare("SELECT * FROM workers WHERE workspace_id=? AND LOWER(name)=LOWER(?) AND active=1").get(ws, name) as any;
    if (w) return w;
    const id = uid("wrk");
    db.prepare("INSERT INTO workers (id,workspace_id,name,phone,labor_class_id,active,created_at) VALUES (?,?,?,?,?,1,?)").run(id, ws, name, b.phone || "", b.labor_class_id || null, now());
    return db.prepare("SELECT * FROM workers WHERE id=?").get(id);
  }
  return null;
}
export function rateForWorker(ws: string, worker: any, sector: string): { rate: number; class_name: string | null; rated: boolean } {
  let classId = worker?.labor_class_id || null;
  if (!classId && worker?.linked_user_id) { const u = db.prepare("SELECT labor_class_id FROM users WHERE id=?").get(worker.linked_user_id) as any; classId = u?.labor_class_id || null; }
  if (!classId) return { rate: 0, class_name: null, rated: false };
  const c = db.prepare("SELECT * FROM labor_classes WHERE id=? AND workspace_id=?").get(classId, ws) as any;
  if (!c) return { rate: 0, class_name: null, rated: false };
  const rate = sector === "government" ? (c.govt_rate || 0) : (c.private_rate || 0);
  return { rate, class_name: c.name, rated: rate > 0 };
}
export function rateFor(ws: string, userId: string, sector: string) { // v2 signature kept for compatibility
  const w = resolveWorker(ws, { user_id: userId });
  return w ? rateForWorker(ws, w, sector) : { rate: 0, class_name: null, rated: false };
}
export function logTime(ws: string, leadId: string, actorId: string, b: { user_id?: string; worker_id?: string; worker_name?: string; labor_class_id?: string; entry_date: string; hours: number; note?: string }) {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(leadId, ws) as any;
  if (!lead) return { error: "lead_not_found" };
  const worker = resolveWorker(ws, b);
  if (!worker) return { error: "bad_worker" };
  const hours = Number(b.hours) || 0;
  if (hours <= 0 || hours > 24) return { error: "bad_hours" };
  const { rate, class_name, rated } = rateForWorker(ws, worker, lead.sector || "private");
  const id = uid("time");
  db.prepare("INSERT INTO time_entries (id,workspace_id,lead_id,user_id,worker_id,entry_date,hours,rate,amount,class_name,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, ws, leadId, worker.linked_user_id || null, worker.id, String(b.entry_date || new Date().toISOString().slice(0, 10)), hours, rate, Math.round(hours * rate * 100) / 100, class_name, String(b.note || ""), actorId, now());
  // logging time on a job implies crew membership (dedupe on worker_id; NULL user_id breaks the old UNIQUE)
  const onCrew = db.prepare("SELECT id FROM job_crew WHERE lead_id=? AND (worker_id=? OR (user_id IS NOT NULL AND user_id=?))").get(leadId, worker.id, worker.linked_user_id || "__none__");
  if (!onCrew) { try { db.prepare("INSERT INTO job_crew (id,workspace_id,lead_id,user_id,worker_id,created_at) VALUES (?,?,?,?,?,?)").run(uid("crew"), ws, leadId, worker.linked_user_id || null, worker.id, now()); } catch { /* race */ } }
  const entry = db.prepare("SELECT * FROM time_entries WHERE id=?").get(id) as any;
  return { entry: { ...entry, worker_name: worker.name }, worker, rated };
}
export function jobLabor(ws: string, leadId: string) {
  const entries = (db.prepare("SELECT t.* FROM time_entries t WHERE t.workspace_id=? AND t.lead_id=? ORDER BY t.entry_date DESC, t.created_at DESC").all(ws, leadId) as any[]).map(e => {
    const w = e.worker_id ? db.prepare("SELECT name FROM workers WHERE id=?").get(e.worker_id) as any : null;
    const u = e.user_id ? db.prepare("SELECT name FROM users WHERE id=?").get(e.user_id) as any : null;
    return { ...e, worker: w?.name || u?.name || "Worker" };
  });
  const crew = (db.prepare("SELECT c.* FROM job_crew c WHERE c.workspace_id=? AND c.lead_id=?").all(ws, leadId) as any[]).map(c => {
    const w = c.worker_id ? db.prepare("SELECT * FROM workers WHERE id=?").get(c.worker_id) as any : (c.user_id ? db.prepare("SELECT * FROM workers WHERE linked_user_id=?").get(c.user_id) as any : null);
    const u = c.user_id ? db.prepare("SELECT name, role, labor_class_id FROM users WHERE id=?").get(c.user_id) as any : null;
    const classId = w?.labor_class_id || u?.labor_class_id;
    const lc = classId ? db.prepare("SELECT name FROM labor_classes WHERE id=?").get(classId) as any : null;
    return { ...c, worker_id: w?.id || null, name: w?.name || u?.name || "Worker", role: u?.role || "Worker", class_name: lc?.name || null };
  });
  const hours = entries.reduce((a, e) => a + (e.hours || 0), 0);
  const cost = entries.reduce((a, e) => a + (e.amount || 0), 0);
  const unrated = entries.filter(e => !(e.rate > 0)).reduce((a, e) => a + (e.hours || 0), 0);
  return { entries, crew, hours, cost: Math.round(cost * 100) / 100, unrated_hours: unrated };
}
export function listWorkers(ws: string) {
  return (db.prepare("SELECT w.*, lc.name class_name, u.email linked_email FROM workers w LEFT JOIN labor_classes lc ON lc.id=w.labor_class_id LEFT JOIN users u ON u.id=w.linked_user_id WHERE w.workspace_id=? ORDER BY w.active DESC, w.name").all(ws) as any[]);
}
export const DEFAULT_CLASSES = [
  { name: "Laborer", private_rate: 28, govt_rate: 52 },
  { name: "Technician", private_rate: 38, govt_rate: 68 },
  { name: "Foreman / Supervisor", private_rate: 48, govt_rate: 84 },
  { name: "Project Manager", private_rate: 65, govt_rate: 110 },
];

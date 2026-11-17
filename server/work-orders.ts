// v78 — Work orders (docs/CHAIN-MODEL.md). A project (job) holds many work
// orders; each carries its own scope, PM, crew, schedule, photos and status.
// Display number derives from the project number: P26-0031-00-W01.
import { db, uid, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY, workspace_id TEXT, job_id TEXT, seq INTEGER,
  title TEXT, description TEXT, status TEXT DEFAULT 'planned',
  pm_id TEXT, scheduled_start TEXT, scheduled_end TEXT, location TEXT, notes TEXT,
  created_by TEXT, created_at TEXT, updated_at TEXT, completed_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS work_order_crew (
  id TEXT PRIMARY KEY, workspace_id TEXT, work_order_id TEXT, worker_id TEXT, user_id TEXT,
  UNIQUE(work_order_id, worker_id, user_id))`);

export const WO_STATUSES = ["planned", "scheduled", "in_progress", "on_hold", "completed", "cancelled"];
const pad2 = (n: number) => String(n).padStart(2, "0");
export function woDisplayNo(job: any, seq: number): string {
  return job?.project_no ? `${job.project_no}-W${pad2(seq)}` : `WO-${pad2(seq)}`;
}
export function decorateWO(ws: string, wo: any, job?: any): any {
  const j = job || db.prepare("SELECT * FROM jobs WHERE id=?").get(wo.job_id) as any;
  const crew = db.prepare(`SELECT c.id, c.worker_id, c.user_id, COALESCE(w.name, u.name) name FROM work_order_crew c
    LEFT JOIN workers w ON w.id = c.worker_id LEFT JOIN users u ON u.id = c.user_id WHERE c.work_order_id=?`).all(wo.id);
  const photos = Number((db.prepare("SELECT COUNT(*) c FROM attachments WHERE workspace_id=? AND entity_type='work_order' AND entity_id=?").get(ws, wo.id) as any).c);
  const pm = wo.pm_id ? (db.prepare("SELECT name FROM users WHERE id=?").get(wo.pm_id) as any)?.name || null : null;
  return { ...wo, display_no: woDisplayNo(j, wo.seq), crew, photo_count: photos, pm_name: pm };
}
export function listWorkOrders(ws: string, jobId: string): any[] {
  const job = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(jobId, ws) as any;
  if (!job) return [];
  return (db.prepare("SELECT * FROM work_orders WHERE workspace_id=? AND job_id=? ORDER BY seq").all(ws, jobId) as any[]).map(w => decorateWO(ws, w, job));
}
export function createWorkOrder(ws: string, job: any, actor: string, input: any): any {
  const seq = Number((db.prepare("SELECT COALESCE(MAX(seq),0) m FROM work_orders WHERE job_id=?").get(job.id) as any).m) + 1;
  const id = uid("wo");
  db.prepare(`INSERT INTO work_orders (id,workspace_id,job_id,seq,title,description,status,pm_id,scheduled_start,scheduled_end,location,notes,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ws, job.id, seq, String(input.title || "Work order").slice(0, 160), String(input.description || ""), WO_STATUSES.includes(input.status) ? input.status : "planned",
      input.pm_id || null, input.scheduled_start || null, input.scheduled_end || null, String(input.location || ""), String(input.notes || ""), actor, now(), now());
  if (Array.isArray(input.crew)) for (const c of input.crew) {
    if (!c?.worker_id && !c?.user_id) continue;
    try { db.prepare("INSERT INTO work_order_crew (id,workspace_id,work_order_id,worker_id,user_id) VALUES (?,?,?,?,?)").run(uid("woc"), ws, id, c.worker_id || null, c.user_id || null); } catch { /* dup */ }
  }
  return decorateWO(ws, db.prepare("SELECT * FROM work_orders WHERE id=?").get(id), job);
}
// Every project opens with a W01 carrying the full scope, so the work-order
// tab is never empty; teams split it as the work gets planned.
export function ensureDefaultWorkOrder(ws: string, job: any): void {
  try {
    const n = Number((db.prepare("SELECT COUNT(*) c FROM work_orders WHERE job_id=?").get(job.id) as any).c);
    if (n > 0) return;
    const lead = db.prepare("SELECT service_requested, pm_id, owner_id FROM leads WHERE id=?").get(job.lead_id) as any;
    createWorkOrder(ws, job, "system", { title: `${lead?.service_requested || "Project"} — full scope`, description: "The complete contracted scope. Split this into separate work orders as the project is planned.", pm_id: lead?.pm_id || lead?.owner_id || null, status: "planned" });
  } catch { /* a default WO never blocks job creation */ }
}
export function ensureAllDefaultWorkOrders(): void {
  for (const j of db.prepare("SELECT * FROM jobs").all() as any[]) ensureDefaultWorkOrder(j.workspace_id, j);
}

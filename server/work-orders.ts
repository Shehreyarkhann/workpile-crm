// v78 — Work orders (docs/CHAIN-MODEL.md). A project (job) holds many work
// orders; each carries its own scope, PM, crew, schedule, photos and status.
// Display number derives from the project number: P26-0031-00-W01.
import { db, uid, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY, workspace_id TEXT, job_id TEXT, seq INTEGER,
  title TEXT, description TEXT, status TEXT DEFAULT 'planned',
  pm_id TEXT, scheduled_start TEXT, scheduled_end TEXT, location TEXT, notes TEXT,
  created_by TEXT, created_at TEXT, updated_at TEXT, completed_at TEXT)`);
try { db.exec("ALTER TABLE work_orders ADD COLUMN est_hours REAL"); } catch { /* exists */ }
try { db.exec("ALTER TABLE work_orders ADD COLUMN percent_complete INTEGER DEFAULT 0"); } catch { /* exists */ }
try { db.exec("ALTER TABLE work_orders ADD COLUMN depends_on_id TEXT"); } catch { /* exists */ }
db.exec(`CREATE TABLE IF NOT EXISTS wo_time_entries (
  id TEXT PRIMARY KEY, workspace_id TEXT, work_order_id TEXT, user_id TEXT, worker_id TEXT,
  labor_class_id TEXT, rate REAL DEFAULT 0, hours REAL, work_date TEXT, note TEXT,
  started_at TEXT, ended_at TEXT, created_by TEXT, created_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS wo_materials (
  id TEXT PRIMARY KEY, workspace_id TEXT, work_order_id TEXT, description TEXT, qty REAL DEFAULT 1,
  unit_cost REAL DEFAULT 0, supplier TEXT, billable INTEGER DEFAULT 0, created_by TEXT, created_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS wo_checklist (
  id TEXT PRIMARY KEY, workspace_id TEXT, work_order_id TEXT, label TEXT, done INTEGER DEFAULT 0,
  done_by TEXT, done_at TEXT, sort INTEGER DEFAULT 0, created_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS wo_templates (
  id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, items TEXT DEFAULT '[]', active INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT)`);
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
  let insp = { total: 0, open: 0, failed: 0 };
  try { const r = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN status IN ('scheduled','in_progress','submitted') THEN 1 ELSE 0 END) o, SUM(CASE WHEN status='closed' AND result='failed' THEN 1 ELSE 0 END) f FROM inspections WHERE workspace_id=? AND work_order_id=?").get(ws, wo.id) as any; insp = { total: r?.t || 0, open: r?.o || 0, failed: r?.f || 0 }; } catch { /* inspections module not loaded in this context */ }
  const time = (() => { try { const r = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(hours*rate),0) c, COUNT(*) n, SUM(CASE WHEN started_at IS NOT NULL AND ended_at IS NULL THEN 1 ELSE 0 END) run FROM wo_time_entries WHERE workspace_id=? AND work_order_id=?").get(ws, wo.id) as any; return { actual_hours: Math.round((r?.h || 0) * 100) / 100, labor_cost: Math.round((r?.c || 0) * 100) / 100, entries: r?.n || 0, active_timers: r?.run || 0 }; } catch { return { actual_hours: 0, labor_cost: 0, entries: 0, active_timers: 0 }; } })();
  const mats = (() => { try { const r = db.prepare("SELECT COALESCE(SUM(qty*unit_cost),0) c, COUNT(*) n FROM wo_materials WHERE workspace_id=? AND work_order_id=?").get(ws, wo.id) as any; return { cost: Math.round((r?.c || 0) * 100) / 100, count: r?.n || 0 }; } catch { return { cost: 0, count: 0 }; } })();
  const chk = (() => { try { const r = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN done=1 THEN 1 ELSE 0 END) d FROM wo_checklist WHERE workspace_id=? AND work_order_id=?").get(ws, wo.id) as any; return { total: r?.t || 0, done: r?.d || 0 }; } catch { return { total: 0, done: 0 }; } })();
  const depends = wo.depends_on_id ? db.prepare("SELECT id, seq, status FROM work_orders WHERE id=?").get(wo.depends_on_id) as any : null;
  return { ...wo, display_no: woDisplayNo(j, wo.seq), crew, photo_count: photos, pm_name: pm, inspections: insp, time, materials: mats, checklist: chk, cost_total: Math.round((time.labor_cost + mats.cost) * 100) / 100, depends_on: depends ? { id: depends.id, display_no: woDisplayNo(j, depends.seq), status: depends.status } : null };
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

// v89 — time, materials, checklist, templates
export function rateForClass(ws: string, job: any, classId: string | null): number {
  if (!classId) return 0;
  const c = db.prepare("SELECT * FROM labor_classes WHERE id=? AND workspace_id=?").get(classId, ws) as any;
  if (!c) return 0;
  return String(job?.sector || "").toLowerCase().startsWith("gov") ? Number(c.govt_rate || 0) : Number(c.private_rate || 0);
}
export function dependencyBlock(ws: string, wo: any): any | null {
  if (!wo.depends_on_id) return null;
  const dep = db.prepare("SELECT * FROM work_orders WHERE id=? AND workspace_id=?").get(wo.depends_on_id, ws) as any;
  if (!dep || ["completed", "cancelled"].includes(dep.status)) return null;
  const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(wo.job_id) as any;
  return { id: dep.id, display_no: woDisplayNo(job, dep.seq), status: dep.status, title: dep.title };
}
export function openChecklistCount(ws: string, woId: string): number {
  try { return Number((db.prepare("SELECT COUNT(*) c FROM wo_checklist WHERE workspace_id=? AND work_order_id=? AND done=0").get(ws, woId) as any).c); } catch { return 0; }
}
export const WO_TEMPLATE_SEED = [
  { title: "Assessment & documentation", description: "Site assessment, photos, measurements and documentation before work begins.", est_hours: 4 },
  { title: "Main work execution", description: "The contracted scope of work, executed per plan and specification.", est_hours: 24 },
  { title: "Clearance & close-out", description: "Clearance checks, final walkthrough, waste documentation and close-out pack.", est_hours: 6 },
];
export function ensureWOTemplates(ws: string): any[] {
  const rows = db.prepare("SELECT * FROM wo_templates WHERE workspace_id=? AND active=1 ORDER BY created_at").all(ws) as any[];
  if (rows.length) return rows;
  const id = uid("wotpl");
  db.prepare("INSERT INTO wo_templates (id,workspace_id,name,items,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)").run(id, ws, "Standard project split", JSON.stringify(WO_TEMPLATE_SEED), now(), now());
  return db.prepare("SELECT * FROM wo_templates WHERE workspace_id=? AND active=1 ORDER BY created_at").all(ws) as any[];
}

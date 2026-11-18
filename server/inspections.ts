// v88 — Inspections on work orders (INSPECTIONS-SCOPE.md T1). An inspection is
// a first-class record on a work order: numbered into the chain
// (P26-0031-00-W01-I01), run against a template checklist (snapshot at
// creation — the record can never be rewritten by a later template edit),
// with photos, notes, comments and a computed progress timeline.
// T1 decision rights: any jobs-edit user may decide; the reviewer permission
// and findings/corrective actions land in T2.
import { db, uid, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS inspection_templates (
  id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, kind TEXT, standard_ref TEXT,
  sections TEXT DEFAULT '[]', active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY, workspace_id TEXT, job_id TEXT, work_order_id TEXT, seq INTEGER,
  template_id TEXT, template_snapshot TEXT DEFAULT '[]', title TEXT,
  status TEXT DEFAULT 'scheduled', result TEXT,
  inspector_id TEXT, inspector_name TEXT, license_no TEXT, reviewer_id TEXT,
  scheduled_start TEXT, scheduled_end TEXT, started_at TEXT, submitted_at TEXT, decided_at TEXT,
  review_note TEXT, summary TEXT, conditions TEXT, answers TEXT DEFAULT '{}',
  reinspection_of TEXT, created_by TEXT, created_at TEXT, updated_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS inspection_notes (
  id TEXT PRIMARY KEY, workspace_id TEXT, inspection_id TEXT, user_id TEXT, body TEXT, created_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS inspection_comments (
  id TEXT PRIMARY KEY, workspace_id TEXT, inspection_id TEXT, user_id TEXT, body TEXT,
  client_visible INTEGER DEFAULT 0, created_at TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS inspection_events (
  id TEXT PRIMARY KEY, workspace_id TEXT, inspection_id TEXT, user_id TEXT, kind TEXT, detail TEXT, created_at TEXT)`);
// Per-item photos + before/during/after tags ride on the shared attachments table.
try { db.exec("ALTER TABLE attachments ADD COLUMN item_key TEXT"); } catch { /* exists */ }
try { db.exec("ALTER TABLE attachments ADD COLUMN tag TEXT"); } catch { /* exists */ }

export const INSP_STATUSES = ["scheduled", "in_progress", "submitted", "closed"];
export const INSP_RESULTS = ["passed", "passed_with_conditions", "failed"];
const pad2 = (n: number) => String(n).padStart(2, "0");

export const GENERIC_SECTIONS = [
  { title: "Site & access", items: [
    { key: "site_accessible", label: "Site accessible and work area available", type: "yesno" },
    { key: "area_secured", label: "Work area secured / isolated from occupants", type: "passfail", critical: true },
    { key: "utilities_located", label: "Utilities and hazards located and marked", type: "passfail" },
  ] },
  { title: "Work performed", items: [
    { key: "work_matches_scope", label: "Work performed matches the contracted scope", type: "passfail", critical: true },
    { key: "materials_correct", label: "Materials and methods correct for the scope", type: "passfail" },
    { key: "completion_photos", label: "Completion photos taken", type: "passfail", photo_required: true },
  ] },
  { title: "Readings & conditions", items: [
    { key: "primary_reading", label: "Primary site reading (record value)", type: "reading", unit: "" },
    { key: "conditions_note", label: "Conditions observed on site", type: "text" },
  ] },
  { title: "Close-out", items: [
    { key: "area_clean", label: "Area left clean and safe", type: "passfail" },
    { key: "client_walkthrough", label: "Client walkthrough offered / completed", type: "yesno" },
    { key: "issues_noted", label: "Outstanding issues (if any)", type: "text" },
  ] },
];

export function ensureInspTemplates(ws: string): any[] {
  const rows = db.prepare("SELECT * FROM inspection_templates WHERE workspace_id=? AND active=1 ORDER BY sort, created_at").all(ws) as any[];
  if (rows.length) return rows;
  const id = uid("itpl");
  db.prepare("INSERT INTO inspection_templates (id,workspace_id,name,kind,standard_ref,sections,active,sort,created_at,updated_at) VALUES (?,?,?,?,?,?,1,0,?,?)")
    .run(id, ws, "General work order inspection", "general", "Workpile standard field inspection", JSON.stringify(GENERIC_SECTIONS), now(), now());
  return db.prepare("SELECT * FROM inspection_templates WHERE workspace_id=? AND active=1 ORDER BY sort, created_at").all(ws) as any[];
}

export function parseSections(raw: any): any[] {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function allItems(sections: any[]): any[] {
  const out: any[] = [];
  for (const s of sections || []) for (const it of s.items || []) out.push({ ...it, section: s.title });
  return out;
}

export function logInspEvent(ws: string, inspId: string, userId: string | null, kind: string, detail = ""): void {
  try { db.prepare("INSERT INTO inspection_events (id,workspace_id,inspection_id,user_id,kind,detail,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("iev"), ws, inspId, userId, kind, String(detail).slice(0, 300), now()); } catch { /* timeline never blocks work */ }
}

export function inspProgress(insp: any): { total: number; answered: number; pct: number; failed: number; critical_failed: number; out_of_range: number } {
  const items = allItems(parseSections(insp.template_snapshot));
  let answers: any = {}; try { answers = JSON.parse(insp.answers || "{}"); } catch { /* noop */ }
  let answered = 0, failed = 0, criticalFailed = 0, oor = 0;
  for (const it of items) {
    const a = answers[it.key];
    if (!a || a.v === undefined || a.v === "" || a.v === null) continue;
    answered++;
    if (a.v === "fail" || a.v === "no") { /* 'no' is informational on yes/no items */ }
    if (a.v === "fail") { failed++; if (it.critical) criticalFailed++; }
    if (it.type === "reading" && a.v !== "" && !Number.isNaN(Number(a.v))) {
      const n = Number(a.v);
      if ((it.min !== undefined && it.min !== null && it.min !== "" && n < Number(it.min)) || (it.max !== undefined && it.max !== null && it.max !== "" && n > Number(it.max))) oor++;
    }
  }
  return { total: items.length, answered, pct: items.length ? Math.round((answered / items.length) * 100) : 0, failed, critical_failed: criticalFailed, out_of_range: oor };
}

export function decorateInsp(ws: string, insp: any, wo?: any, job?: any): any {
  const w = wo || db.prepare("SELECT * FROM work_orders WHERE id=?").get(insp.work_order_id) as any;
  const j = job || (w ? db.prepare("SELECT * FROM jobs WHERE id=?").get(w.job_id) as any : null);
  const base = j?.project_no && w ? `${j.project_no}-W${pad2(w.seq)}` : "WO";
  const photoCount = Number((db.prepare("SELECT COUNT(*) c FROM attachments WHERE workspace_id=? AND entity_type='inspection' AND entity_id=?").get(ws, insp.id) as any).c);
  return { ...insp, display_no: `${base}-I${pad2(insp.seq)}`, work_order_title: w?.title || null, project_no: j?.project_no || null, photo_count: photoCount, progress: inspProgress(insp) };
}

export function createInspection(ws: string, wo: any, actor: string, input: any): any {
  const templates = ensureInspTemplates(ws);
  const tpl = templates.find(t => t.id === input.template_id) || templates[0];
  const seq = Number((db.prepare("SELECT COALESCE(MAX(seq),0) m FROM inspections WHERE work_order_id=?").get(wo.id) as any).m) + 1;
  const id = uid("insp");
  const inspector = input.inspector_id ? (db.prepare("SELECT name FROM users WHERE id=? AND workspace_id=?").get(input.inspector_id, ws) as any) : null;
  db.prepare(`INSERT INTO inspections (id,workspace_id,job_id,work_order_id,seq,template_id,template_snapshot,title,status,inspector_id,inspector_name,license_no,scheduled_start,scheduled_end,reinspection_of,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?, 'scheduled', ?,?,?,?,?,?,?,?,?)`)
    .run(id, ws, wo.job_id, wo.id, seq, tpl?.id || null, JSON.stringify(parseSections(tpl?.sections)), String(input.title || tpl?.name || "Inspection").slice(0, 160),
      input.inspector_id || null, inspector?.name || null, input.license_no ? String(input.license_no).slice(0, 60) : null,
      input.scheduled_start || null, input.scheduled_end || null, input.reinspection_of || null, actor, now(), now());
  logInspEvent(ws, id, actor, "created", tpl?.name || "");
  return decorateInsp(ws, db.prepare("SELECT * FROM inspections WHERE id=?").get(id), wo);
}

// The work-order completion gate (T1 form): open inspections, or a failed
// result on the latest closed inspection set, block completion.
export function inspectionGateForWO(ws: string, woId: string): { blocked: boolean; open: number; failed: number } {
  const open = Number((db.prepare("SELECT COUNT(*) c FROM inspections WHERE workspace_id=? AND work_order_id=? AND status IN ('scheduled','in_progress','submitted')").get(ws, woId) as any).c);
  const failed = Number((db.prepare("SELECT COUNT(*) c FROM inspections WHERE workspace_id=? AND work_order_id=? AND status='closed' AND result='failed'").get(ws, woId) as any).c);
  return { blocked: open > 0 || failed > 0, open, failed };
}

export function photoRequiredMissing(ws: string, insp: any): string[] {
  const items = allItems(parseSections(insp.template_snapshot)).filter(i => i.photo_required);
  if (!items.length) return [];
  const withPhotos = new Set((db.prepare("SELECT DISTINCT item_key FROM attachments WHERE workspace_id=? AND entity_type='inspection' AND entity_id=? AND item_key IS NOT NULL").all(ws, insp.id) as any[]).map(r => r.item_key));
  return items.filter(i => !withPhotos.has(i.key)).map(i => i.label || i.key);
}

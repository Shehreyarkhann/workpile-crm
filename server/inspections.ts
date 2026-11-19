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


// ---- v95 (Inspections T2): the standards library. Each template cites the
// regulation it implements; items use the T1 engine types (passfail / yesno /
// reading with unit + acceptable range / text) with critical and
// photo-required flags where the standard demands evidence.
export const STANDARD_TEMPLATES: { name: string; standard_ref: string; sections: any[] }[] = [
  { name: "AHERA visual assessment", standard_ref: "40 CFR 763.85–763.86 (AHERA inspections)", sections: [
    { title: "Surfacing materials", items: [
      { key: "surf_condition", label: "Surfacing ACM condition assessed (damage, delamination, water damage)", type: "passfail", critical: true },
      { key: "surf_debris", label: "No ACM debris on floors or surfaces below surfacing material", type: "passfail", critical: true },
      { key: "surf_damage_pct", label: "Estimated damaged area recorded in the assessment notes", type: "text" },
    ] },
    { title: "Thermal system insulation", items: [
      { key: "tsi_condition", label: "TSI condition assessed at pipes, boilers and ducts (incl. boiler room / mechanical spaces)", type: "passfail" },
      { key: "tsi_jackets", label: "Insulation jackets intact, no exposed ACM ends", type: "passfail" },
    ] },
    { title: "Miscellaneous materials & response", items: [
      { key: "misc_condition", label: "Miscellaneous ACM (floor tile, mastic, roofing) condition assessed", type: "passfail" },
      { key: "response_action", label: "Response action category assigned per 763.86 (repair / encapsulate / enclose / remove / O&M)", type: "text" },
      { key: "photos", label: "Condition photos taken for each homogeneous area", type: "passfail", photo_required: true },
    ] },
  ] },
  { name: "NESHAP pre-demolition / renovation survey", standard_ref: "EPA NESHAP 40 CFR 61.145", sections: [
    { title: "Survey completeness", items: [
      { key: "all_areas", label: "All areas to be disturbed were inspected, including hidden spaces opened as needed", type: "passfail", critical: true },
      { key: "samples", label: "Suspect materials sampled and lab results on file for each homogeneous area", type: "passfail", critical: true },
    ] },
    { title: "Regulated material (RACM)", items: [
      { key: "racm_friable_qty", label: "Friable RACM quantity (sq ft)", type: "reading", unit: "sq ft", min: 0 },
      { key: "racm_cat1_qty", label: "Category I nonfriable quantity (sq ft)", type: "reading", unit: "sq ft", min: 0 },
      { key: "racm_cat2_qty", label: "Category II nonfriable quantity (sq ft)", type: "reading", unit: "sq ft", min: 0 },
      { key: "thresholds", label: "Threshold check done (160 sq ft / 260 lf / 35 cu ft triggers NESHAP work practices)", type: "yesno" },
    ] },
    { title: "Notification & plan", items: [
      { key: "notification", label: "NESHAP notification filed / filing date recorded (10 working days before start)", type: "text" },
      { key: "removal_plan", label: "RACM removal-before-disturbance plan confirmed with the abatement contractor", type: "passfail" },
    ] },
  ] },
  { name: "OSHA asbestos work practices check", standard_ref: "OSHA 29 CFR 1926.1101", sections: [
    { title: "Containment & engineering controls", items: [
      { key: "neg_pressure", label: "Negative pressure differential maintained", type: "reading", unit: "in. w.c.", min: -1, max: -0.02, critical: true },
      { key: "wet_methods", label: "Wet methods in use for all ACM handling", type: "passfail", critical: true },
      { key: "hepa", label: "HEPA vacuums / ventilation used; no dry sweeping", type: "passfail" },
      { key: "decon", label: "Decontamination area with showers operational at the containment entrance", type: "passfail" },
    ] },
    { title: "Worker protection", items: [
      { key: "respirators", label: "Respirators worn per exposure assessment; fit checks done", type: "passfail", critical: true },
      { key: "ppe", label: "Protective clothing worn; no street clothes inside containment", type: "passfail" },
      { key: "air_monitoring", label: "Exposure air monitoring running; results posted / communicated", type: "yesno" },
      { key: "signs", label: "Regulated-area signage and barriers in place", type: "passfail" },
    ] },
  ] },
  { name: "NYSDOL ICR 56 site compliance", standard_ref: "NYSDOL Industrial Code Rule 56", sections: [
    { title: "Licenses & notices", items: [
      { key: "licenses_posted", label: "Contractor + supervisor licenses posted at the site entrance", type: "passfail", critical: true },
      { key: "notification_posted", label: "Project notification posted; occupants notified as required", type: "passfail" },
      { key: "air_sampling_firm", label: "Independent air-sampling firm engaged (not the abatement contractor)", type: "yesno", critical: true },
    ] },
    { title: "Work area", items: [
      { key: "containment_icr", label: "Containment built to ICR 56 spec (critical barriers, sealed HVAC/penetrations)", type: "passfail" },
      { key: "neg_air", label: "Negative-air exhaust to the exterior with HEPA filtration", type: "passfail" },
      { key: "waste", label: "Waste bagged, labeled and staged in the locked waste area; manifests on file", type: "passfail" },
    ] },
  ] },
  { name: "Visual clearance (ASTM E1368)", standard_ref: "ASTM E1368 visual clearance", sections: [
    { title: "Visual examination", items: [
      { key: "no_debris", label: "No visible debris, residue or dust anywhere in the work area", type: "passfail", critical: true },
      { key: "surfaces", label: "All surfaces (incl. horizontal ledges, tops of fixtures) pass the white-glove / flashlight check", type: "passfail", critical: true },
      { key: "dry", label: "Work area dry; containment ready for teardown after air clearance", type: "passfail" },
      { key: "photos", label: "Clearance photos taken of each room / elevation", type: "passfail", photo_required: true },
    ] },
  ] },
  { name: "Air clearance (PCM / TEM)", standard_ref: "AHERA 40 CFR 763.90 — PCM ≤0.01 f/cc · TEM ≤70 s/mm²", sections: [
    { title: "Sampling", items: [
      { key: "aggressive", label: "Aggressive sampling protocol used (leaf blower + fans) for final clearance", type: "yesno", critical: true },
      { key: "sample_count", label: "Required sample count collected (5 inside / 5 outside / blanks per AHERA)", type: "passfail" },
    ] },
    { title: "Results", items: [
      { key: "pcm_result", label: "PCM result", type: "reading", unit: "f/cc", min: 0, max: 0.01, critical: true },
      { key: "tem_result", label: "TEM result (when required)", type: "reading", unit: "s/mm²", min: 0, max: 70 },
      { key: "lab_report", label: "Lab report received and attached", type: "passfail", photo_required: true },
    ] },
  ] },
  { name: "Lead paint inspection (EPA / HUD)", standard_ref: "EPA 40 CFR 745 · HUD Guidelines Ch. 7", sections: [
    { title: "XRF survey", items: [
      { key: "xrf_calibration", label: "XRF calibrated per manufacturer (3 calibration checks logged)", type: "passfail", critical: true },
      { key: "max_reading", label: "Highest XRF reading recorded", type: "reading", unit: "mg/cm²", min: 0, max: 1.0 },
      { key: "all_components", label: "Every testing combination (room / component / substrate) tested", type: "passfail" },
    ] },
    { title: "Condition & report", items: [
      { key: "deteriorated", label: "Deteriorated lead paint locations mapped (interior + exterior)", type: "text" },
      { key: "photos", label: "Photos of positive components taken", type: "passfail", photo_required: true },
    ] },
  ] },
  { name: "RRP work practices check", standard_ref: "EPA RRP 40 CFR 745.227", sections: [
    { title: "Setup", items: [
      { key: "signs_rrp", label: "Warning signs posted; work area contained with plastic sheeting (6 ft floors / vertical containment)", type: "passfail", critical: true },
      { key: "certified", label: "Certified renovator on site; firm certification current", type: "yesno", critical: true },
      { key: "no_prohibited", label: "No prohibited practices (open flame, heat gun >1100°F, uncontained power sanding)", type: "passfail", critical: true },
    ] },
    { title: "Cleaning verification", items: [
      { key: "hepa_clean", label: "HEPA vacuum + wet-clean cycle completed twice", type: "passfail" },
      { key: "cv_passed", label: "Cleaning verification passed (white cloth / CV card comparison)", type: "passfail", critical: true },
      { key: "records", label: "RRP recordkeeping checklist completed and signed", type: "passfail" },
    ] },
  ] },
  { name: "Mold assessment", standard_ref: "NY Labor Law Article 32 · IICRC S520", sections: [
    { title: "Assessment", items: [
      { key: "source", label: "Moisture source identified and described", type: "text", critical: true },
      { key: "moisture", label: "Highest moisture reading in affected material", type: "reading", unit: "% MC", min: 0, max: 100 },
      { key: "extent", label: "Affected area measured (sq ft) and sketched / photographed", type: "passfail", photo_required: true },
    ] },
    { title: "Remediation plan inputs", items: [
      { key: "containment_level", label: "Containment level recommended per IICRC S520 (source / local / full)", type: "text" },
      { key: "occupant", label: "Occupant health / relocation considerations noted for the plan", type: "text" },
    ] },
  ] },
  { name: "Tank closure inspection", standard_ref: "NYSDEC PBS / spill program", sections: [
    { title: "Closure", items: [
      { key: "tank_removed", label: "Tank removed (or closed in place per approval) and inspected for holes / corrosion", type: "passfail", critical: true, photo_required: true },
      { key: "product_removed", label: "All product, sludge and wash water removed and manifested", type: "passfail" },
      { key: "soil_samples", label: "Endpoint soil samples collected per DEC guidance and sent to lab", type: "passfail", critical: true },
    ] },
    { title: "Reporting", items: [
      { key: "spill_number", label: "Spill number (if contamination found) / closure report notes", type: "text" },
      { key: "registration", label: "PBS registration closure filing prepared", type: "yesno" },
    ] },
  ] },
  { name: "Phase I ESA site reconnaissance", standard_ref: "ASTM E1527-21 / E1903", sections: [
    { title: "Reconnaissance", items: [
      { key: "site_walked", label: "Full site walked — interior, exterior, adjoining properties observed from the boundary", type: "passfail", critical: true, photo_required: true },
      { key: "storage", label: "Chemical / petroleum storage, drums, staining or stressed vegetation recorded", type: "text" },
      { key: "ust_ast", label: "UST / AST evidence checked (fill ports, vent pipes, dispensers)", type: "passfail" },
    ] },
    { title: "Findings", items: [
      { key: "recs", label: "Recognized environmental conditions (RECs) identified — list or 'none observed'", type: "text", critical: true },
      { key: "interviews", label: "Owner / occupant interview completed; records review status noted", type: "text" },
    ] },
  ] },
  { name: "Jobsite safety inspection", standard_ref: "OSHA 29 CFR 1926 Subpart C", sections: [
    { title: "General safety", items: [
      { key: "ppe_safety", label: "PPE worn by all crew (head, eye, hand, foot as the task requires)", type: "passfail", critical: true },
      { key: "housekeeping", label: "Housekeeping: walkways clear, materials stacked stable, cords managed", type: "passfail" },
      { key: "fall_protection", label: "Fall protection in use at 6 ft+ (harness / guardrails / covers)", type: "passfail", critical: true },
      { key: "electrical", label: "Electrical: GFCI protection, no damaged cords or open panels", type: "passfail" },
      { key: "first_aid", label: "First aid kit, eyewash and emergency contacts posted / available", type: "passfail" },
      { key: "toolbox", label: "Toolbox talk held and attendance recorded", type: "yesno" },
    ] },
  ] },
];

db.exec(`CREATE TABLE IF NOT EXISTS inspection_actions (
  id TEXT PRIMARY KEY, workspace_id TEXT, inspection_id TEXT, item_key TEXT, label TEXT,
  note TEXT, assignee_id TEXT, due_at TEXT, status TEXT DEFAULT 'open',
  created_by TEXT, created_at TEXT, done_at TEXT, done_by TEXT
)`);

export function openActionsForInspection(inspId: string): number {
  return Number((db.prepare("SELECT COUNT(*) c FROM inspection_actions WHERE inspection_id=? AND status='open'").get(inspId) as any).c);
}

export function ensureInspTemplates(ws: string): any[] {
  let rows = db.prepare("SELECT * FROM inspection_templates WHERE workspace_id=? AND active=1 ORDER BY sort, created_at").all(ws) as any[];
  if (!rows.length) {
    const id = uid("itpl");
    db.prepare("INSERT INTO inspection_templates (id,workspace_id,name,kind,standard_ref,sections,active,sort,created_at,updated_at) VALUES (?,?,?,?,?,?,1,0,?,?)")
      .run(id, ws, "General work order inspection", "general", "Workpile standard field inspection", JSON.stringify(GENERIC_SECTIONS), now(), now());
  }
  // v95: the standards library, seeded by name (idempotent; user edits and
  // deactivations are respected because we only insert what is missing).
  const have = new Set((db.prepare("SELECT name FROM inspection_templates WHERE workspace_id=?").all(ws) as any[]).map(r => r.name));
  STANDARD_TEMPLATES.forEach((t, i) => {
    if (have.has(t.name)) return;
    db.prepare("INSERT INTO inspection_templates (id,workspace_id,name,kind,standard_ref,sections,active,sort,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)")
      .run(uid("itpl"), ws, t.name, "standard", t.standard_ref, JSON.stringify(t.sections), 10 + i, now(), now());
  });
  rows = db.prepare("SELECT * FROM inspection_templates WHERE workspace_id=? AND active=1 ORDER BY sort, created_at").all(ws) as any[];
  return rows;
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
export function inspectionGateForWO(ws: string, woId: string): { blocked: boolean; open: number; failed: number; actions_open: number } {
  const open = Number((db.prepare("SELECT COUNT(*) c FROM inspections WHERE workspace_id=? AND work_order_id=? AND status IN ('scheduled','in_progress','submitted')").get(ws, woId) as any).c);
  const failed = Number((db.prepare("SELECT COUNT(*) c FROM inspections WHERE workspace_id=? AND work_order_id=? AND status='closed' AND result='failed'").get(ws, woId) as any).c);
  const actions_open = Number((db.prepare("SELECT COUNT(*) c FROM inspection_actions a JOIN inspections i ON i.id=a.inspection_id WHERE a.workspace_id=? AND i.work_order_id=? AND a.status='open'").get(ws, woId) as any).c);
  return { blocked: open > 0 || failed > 0 || actions_open > 0, open, failed, actions_open };
}

export function photoRequiredMissing(ws: string, insp: any): string[] {
  const items = allItems(parseSections(insp.template_snapshot)).filter(i => i.photo_required);
  if (!items.length) return [];
  const withPhotos = new Set((db.prepare("SELECT DISTINCT item_key FROM attachments WHERE workspace_id=? AND entity_type='inspection' AND entity_id=? AND item_key IS NOT NULL").all(ws, insp.id) as any[]).map(r => r.item_key));
  return items.filter(i => !withPhotos.has(i.key)).map(i => i.label || i.key);
}

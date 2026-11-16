// Create the "Apex Environmental Services" DUMMY DEMO workspace on the target DB:
// a fictional environmental-services company (no real business names anywhere),
// a 4-person team, and realistic working data in EVERY pipeline stage — leads,
// proposals, jobs, invoices, approvals, tasks, visits, schedule, inbox, documents,
// timesheets — all dates relative to the run day so it always looks alive.
// Run ON the droplet (service stopped): node scripts/seed-demo-account.mjs [dbPath]
// Pairs with scripts/wipe-gc-workspace.mjs (full G.C. delete incl. only-home users).
// Idempotence guard: aborts if an "Apex Environmental Services" workspace exists.
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";

let dbPath = process.argv[2];
if (!dbPath) {
  try {
    const env = fs.readFileSync("/opt/workpile/.env", "utf8");
    const m = env.match(/^LEADFLOW_DB=(.+)$/m);
    if (m) dbPath = m[1].trim();
  } catch { /* fall through */ }
  dbPath = dbPath || "/opt/workpile/data/leadflow.db";
}
console.log("DB:", dbPath);
const db = new DatabaseSync(dbPath);
if (db.prepare("SELECT id FROM workspaces WHERE name='Apex Environmental Services'").get()) {
  console.error("ABORT: Apex Environmental Services already exists — refusing to double-seed.");
  process.exit(1);
}

const uid = (p) => p + "_" + randomBytes(9).toString("base64url");
const hashPassword = (pw) => { const salt = randomBytes(16).toString("hex"); return salt + ":" + scryptSync(pw, salt, 64).toString("hex"); };
const DEMO_PASSWORD = "ApexDemo-2026!";
const DAY = 86400000;
const iso = (offDays, hour = 9, min = 0) => { const d = new Date(Date.now() + offDays * DAY); d.setHours(hour, min, 0, 0); return d.toISOString(); };
const now = () => new Date().toISOString();
const monday = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); })();
const lastMonday = (() => { const d = new Date(monday); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();

let WS = null;
db.exec("PRAGMA foreign_keys=OFF");
db.exec("BEGIN");
try {
// ---------- workspace + subscription (mirrors register + ensureSubscription) ----------
WS = uid("ws");
db.prepare("INSERT INTO workspaces (id,name,vertical,timezone,created_at) VALUES (?,?,?,?,?)")
  .run(WS, "Apex Environmental Services", "field-services", "America/New_York", iso(-96));
const trialEnd = new Date(Date.now() + 30 * DAY).toISOString();
db.prepare("INSERT INTO subscriptions (id,workspace_id,plan,status,current_period_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
  .run(uid("sub"), WS, "pro", "trialing", trialEnd, now(), now());
db.prepare("UPDATE workspaces SET trial_ends_at=?, plan='pro' WHERE id=?").run(trialEnd, WS);

// ---------- team ----------
const mkUser = (name, email, role, approvalLimit) => {
  const id = uid("usr");
  db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit,active,password_set) VALUES (?,?,?,?,?,?,?,1,1)")
    .run(id, WS, name, email, hashPassword(DEMO_PASSWORD), role, approvalLimit);
  db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(id, WS, role, iso(-96));
  return id;
};
const DANA = mkUser("Dana Whitaker", "dana@apexenv.example", "OWNER", 0);
const MARCUS = mkUser("Marcus Reed", "marcus@apexenv.example", "OPS_ADMIN", 0);
const ELENA = mkUser("Elena Brooks", "elena@apexenv.example", "APPROVER", 25000);
const TOMMY = mkUser("Tommy Alvarez", "tommy@apexenv.example", "LEAD_OWNER", 0);
// Give the operator (Shehreyar) a seat too, if his account exists on this DB.
const op = db.prepare("SELECT id FROM users WHERE email='shehreyarkhann@outlook.com'").get();
if (op) db.prepare("INSERT OR IGNORE INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(op.id, WS, "OPS_ADMIN", now());
const mkWorker = (name, phone, linked) => { const id = uid("wrk"); db.prepare("INSERT INTO workers (id,workspace_id,name,phone,linked_user_id,active,created_at) VALUES (?,?,?,?,?,1,?)").run(id, WS, name, phone, linked || null, iso(-90)); return id; };
const W_JAMES = mkWorker("James Okafor", "(631) 555-0142", TOMMY);
const W_ROSA = mkWorker("Rosa Delgado", "(631) 555-0117", null);

// ---------- catalog ----------
const svc = (name) => { const id = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,1,1)").run(id, WS, name); return id; };
const S = {
  asbestos: svc("Asbestos abatement"), mold: svc("Mold remediation"), lead: svc("Lead paint stabilization"),
  tank: svc("Underground tank removal"), soil: svc("Soil & groundwater remediation"), demo: svc("Demolition & dismantling"),
  duct: svc("Duct cleaning & IAQ"), water: svc("Water damage restoration"),
};
const pb = (service, name, unit, price, floor) => { const id = uid("pb"); db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?,?)").run(id, WS, service, name, unit, price, floor); return { id, name, price }; };
const PB = {
  asbSurvey: pb(S.asbestos, "Asbestos survey & sampling", "job", 1450, 1100),
  asbContain: pb(S.asbestos, "Containment & negative-air setup", "job", 3800, 3100),
  asbRemoval: pb(S.asbestos, "ACM removal & disposal", "sq ft", 24, 18),
  moldInspect: pb(S.mold, "Mold inspection & air testing", "job", 895, 700),
  moldRemed: pb(S.mold, "Mold remediation (per room)", "room", 2650, 2100),
  leadStab: pb(S.lead, "Lead paint stabilization", "sq ft", 11, 8),
  leadClear: pb(S.lead, "Clearance testing & report", "job", 750, 600),
  tankPull: pb(S.tank, "UST removal (up to 1,000 gal)", "job", 18500, 15200),
  tankSoil: pb(S.tank, "Contaminated soil excavation & disposal", "ton", 145, 110),
  soilPhase: pb(S.soil, "Phase II site assessment", "job", 9800, 7900),
  soilRemed: pb(S.soil, "Soil remediation program", "job", 64000, 52000),
  demoInt: pb(S.demo, "Interior selective demolition", "sq ft", 9, 7),
  demoStruct: pb(S.demo, "Structural demolition", "job", 42000, 35000),
  ductRes: pb(S.duct, "Duct cleaning — residential", "job", 649, 500),
  ductCom: pb(S.duct, "Duct cleaning — commercial", "job", 3400, 2700),
  waterExt: pb(S.water, "Water extraction & drying", "job", 3200, 2600),
  waterDry: pb(S.water, "Dehumidification (per day)", "day", 450, 350),
};
db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body,version,active) VALUES (?,?,?,?,?,?,1,1)")
  .run(uid("tpl"), WS, S.asbestos, "proposal", "Standard Proposal", "Scope: {{scope}}\nLine items from price book.\nTerms: Net 14, proposal valid 14 days.");
db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body,version,active) VALUES (?,?,?,?,?,?,1,1)")
  .run(uid("tpl"), WS, S.mold, "proposal", "Remediation Proposal", "Scope: {{scope}}\nContainment, removal, clearance testing included.\nTerms: Net 14.");

// ---------- sources ----------
const src = (type, name) => { const id = uid("src"); db.prepare("INSERT INTO sources (id,workspace_id,type,name) VALUES (?,?,?,?)").run(id, WS, type, name); return id; };
const SRC = { web: src("web", "Website"), google: src("web", "Google search"), referral: src("referral", "Referral"), repeat: src("repeat", "Repeat customer") };

// ---------- accounts + contacts ----------
const acct = (name, industry, address) => { const id = uid("acc"); db.prepare("INSERT INTO accounts (id,workspace_id,name,industry,address,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, WS, name, industry, address, iso(-80), iso(-3)); return id; };
const contact = (name, email, phone, accountId, title) => { const id = uid("con"); db.prepare("INSERT INTO contacts (id,workspace_id,name,email,phone,account_id,title,is_customer) VALUES (?,?,?,?,?,?,?,?)").run(id, WS, name, email, phone, accountId || null, title || null, accountId ? 1 : 0); return id; };
const ACC = {
  riverside: acct("Riverside Property Group", "Property management", "120 Harbor Rd, Suite 400"),
  northgate: acct("Northgate Warehousing", "Logistics", "88 Industrial Pkwy"),
  harborPointe: acct("Harbor Pointe HOA", "HOA", "14 Marina Blvd"),
  stAurelia: acct("St. Aurelia Medical Center", "Healthcare", "700 Wellness Way"),
  cedar: acct("Cedar Hollow Apartments", "Multifamily housing", "2300 Cedar Hollow Ln"),
  summit: acct("Summit Ridge Schools", "Education", "45 Summit Ridge Rd"),
  bayfront: acct("Bayfront Logistics Park", "Logistics", "9 Bayfront Ave"),
  elm: acct("Elm Street Retail Plaza", "Retail", "1120 Elm St"),
  greenfield: acct("Greenfield Manufacturing", "Manufacturing", "360 Foundry St"),
  oakmont: acct("Oakmont Senior Living", "Senior living", "77 Oakmont Dr"),
  lakeview: acct("Lakeview Marina", "Marina", "3 Lakeview Pier"),
  eastmere: acct("Village of Eastmere Public Works", "Municipal", "1 Village Hall Plaza"),
};

// ---------- lead factory ----------
let propNo = 1000, invNo = 1000;
const leadEvents = (leadId, rows) => { for (const [type, from, to, off, payload] of rows) db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("evt"), leadId, WS, "system", type, from, to, payload ? JSON.stringify(payload) : null, iso(off)); };
function mkLead(o) {
  const id = uid("lead");
  db.prepare(`INSERT INTO leads (id,workspace_id,contact_id,source_id,service_requested,service_catalog_id,state,urgency,est_value,owner_id,pm_id,approver_id,next_action,next_action_due_at,notes,location,created_at,updated_at,consent_contact_ok,consent_source,sector,account_id,stage_changed_at,first_touch_at,first_touch_kind,qualified_at,lost_reason,converted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, WS, o.contact, o.source || SRC.web, o.serviceName, o.service, o.state, o.urgency || "normal", o.est || 0,
      o.owner || TOMMY, TOMMY, ELENA, o.nextAction || null, o.nextDue || null, o.notes || null, o.location || null,
      iso(o.createdOff ?? -10), iso(o.updatedOff ?? -1), 1, "web_form", o.sector || "private", o.account || null,
      iso(o.updatedOff ?? -1), iso(o.createdOff ?? -10), "web", o.state === "QUALIFIED" || ["PROPOSAL", "SENT", "FOLLOWUP", "WON"].includes(o.state) ? iso((o.createdOff ?? -10) + 3) : null,
      o.lostReason || null, o.state === "WON" ? iso(o.updatedOff ?? -1) : null);
  leadEvents(id, [["created", null, "NEW", o.createdOff ?? -10], ...(o.state !== "NEW" ? [["state", "NEW", o.state, o.updatedOff ?? -1]] : [])]);
  return id;
}
function mkProposal(leadId, items, status, opts = {}) {
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const id = uid("prop"); propNo += 1;
  db.prepare(`INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,sent_at,viewed_at,signed_at,created_at,sign_token,number,expires_at,view_count,first_viewed_at,delivery_mode)
    VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, WS, leadId, status, JSON.stringify(items.map((i) => ({ price_book_item_id: i.id, name: i.name, qty: i.qty, unit_price: i.price }))), total,
      ["sent", "approved", "signed"].includes(status) ? iso(opts.sentOff ?? -4) : null,
      ["sent", "approved", "signed"].includes(status) ? iso(opts.sentOff ?? -4, 15) : null,
      status === "signed" ? iso(opts.signedOff ?? -2) : null,
      iso(opts.createdOff ?? -6), uid("tok"), propNo, iso(10), status === "sent" ? 2 : 0, status === "sent" ? iso(opts.sentOff ?? -4, 15) : null, "email");
  return { id, total, number: propNo };
}
function mkJob(leadId, proposal, stage, opts = {}) {
  const id = uid("job");
  db.prepare(`INSERT INTO jobs (id,workspace_id,lead_id,proposal_id,stage,value,sector,scheduled_start,scheduled_end,invoice_status,created_from,closed_at,created_at,updated_at,requires_site_visit)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, WS, leadId, proposal ? proposal.id : null, stage, proposal ? proposal.total : (opts.value || 0), "private",
      opts.startOff != null ? iso(opts.startOff, 8) : null, opts.endOff != null ? iso(opts.endOff, 16) : null,
      ["INVOICED", "CLOSED"].includes(stage) ? "invoiced" : "not_ready", "sign", stage === "CLOSED" ? iso(opts.closedOff ?? -6) : null,
      iso(opts.createdOff ?? -20), iso(opts.updatedOff ?? -1), opts.needsVisit ? 1 : 0);
  return id;
}
function mkInvoice(leadId, jobId, lines, status, opts = {}) {
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const id = uid("inv"); invNo += 1;
  db.prepare(`INSERT INTO invoices (id,workspace_id,lead_id,job_id,number,status,lines,total,paid_amount,due_at,issued_at,source,created_at,sent_at,token)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, WS, leadId, jobId || null, "INV-" + invNo, status, JSON.stringify(lines.map((l) => ({ description: l.name, qty: l.qty, unit_price: l.price, line_total: l.qty * l.price }))),
      total, status === "paid" ? total : status === "partially_paid" ? Math.round(total / 2) : 0,
      iso(opts.dueOff ?? 14), iso(opts.issuedOff ?? -3), "manual", iso(opts.issuedOff ?? -3), status === "draft" ? null : iso(opts.issuedOff ?? -3), uid("tok"));
  return { id, total };
}
const docs = (leadId, jobId, rows) => { for (const [name, status, off, expOff] of rows) db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status,received_at,expires_at,job_id) VALUES (?,?,?,?,1,?,?,?,?)").run(uid("doc"), WS, leadId, name, status, status === "received" ? iso(off ?? -5) : null, expOff != null ? iso(expOff) : null, jobId || null); };
const task = (o) => db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,completed_at,created_at,notes,source_inbox_item_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
  .run(uid("tsk"), WS, o.lead || null, o.assignee || TOMMY, o.type || "follow_up", o.title, iso(o.dueOff ?? 1, o.hour ?? 10), o.status || "open", o.status === "done" ? iso(o.doneOff ?? -1) : null, iso(o.createdOff ?? -3), o.notes || null, o.inbox || null);
const visit = (leadId, assignee, off, status, notes, inboxId) => db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,outcome,notes,source_inbox_item_id) VALUES (?,?,?,?,?,?,?,?,?)")
  .run(uid("vis"), WS, leadId, assignee, iso(off, 10), status, status === "completed" ? "Visit completed — scope confirmed, photos taken." : null, notes || null, inboxId || null);
const sched = (leadId, userId, workerId, dateOff, note) => db.prepare("INSERT OR IGNORE INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,note,created_by,created_at,worker_id) VALUES (?,?,?,?,?,?,?,?,?)")
  .run(uid("sch"), WS, leadId, userId, iso(dateOff).slice(0, 10), note || null, MARCUS, iso(-2), workerId || null);

// ---------- PIPELINE LEADS ----------
// NEW
mkLead({ contact: contact("Priya Nair", "priya.nair@example.com", "(631) 555-0193", null), service: S.mold, serviceName: "Mold remediation", state: "NEW", est: 5300, createdOff: 0, updatedOff: 0, location: "Bay Shore, NY", notes: "Tenant reported mold in two bathrooms of a rental unit. Wants inspection this week.", nextAction: "Call to schedule inspection", nextDue: iso(0, 17) });
mkLead({ contact: contact("George Whitfield", "g.whitfield@example.com", "(631) 555-0128", ACC.elm), service: S.asbestos, serviceName: "Asbestos abatement", state: "NEW", est: 14200, createdOff: -1, updatedOff: -1, location: "Elm Street Retail Plaza", notes: "Roofing contractor found suspected ACM tiles during a tear-off. Needs survey before work resumes.", nextAction: "Send survey quote", nextDue: iso(1, 12) });
mkLead({ contact: contact("Alina Petrova", "alina.p@example.com", "(631) 555-0161", null), service: S.water, serviceName: "Water damage restoration", state: "NEW", urgency: "high", est: 6800, createdOff: -1, updatedOff: -1, location: "Islip, NY", notes: "Burst pipe flooded the ground floor overnight. Insurance claim opened; needs extraction ASAP.", nextAction: "Dispatch water crew", nextDue: iso(0, 13) });
mkLead({ contact: contact("Sam Oduya", "sam.oduya@example.com", "(631) 555-0109", ACC.lakeview), service: S.duct, serviceName: "Duct cleaning & IAQ", state: "NEW", est: 3400, createdOff: -2, updatedOff: -2, location: "Lakeview Marina clubhouse", notes: "Musty odor complaints from members; wants commercial duct cleaning quote.", nextAction: "Qualify — confirm building size", nextDue: iso(1, 10) });
// WORKING
mkLead({ contact: contact("Karen Doyle", "kdoyle@riversidepg.example", "(631) 555-0130", ACC.riverside, "Property Manager"), service: S.lead, serviceName: "Lead paint stabilization", state: "WORKING", est: 11800, createdOff: -6, updatedOff: -1, location: "Riverside Commons, Bldg C", notes: "Pre-1978 building; city inspection flagged peeling paint in 6 units. Awaiting unit access list from manager.", nextAction: "Get unit access list", nextDue: iso(1, 9) });
mkLead({ contact: contact("Rob Fennell", "rfennell@northgate.example", "(631) 555-0176", ACC.northgate, "Facilities Director"), service: S.tank, serviceName: "Underground tank removal", state: "WORKING", est: 33800, createdOff: -8, updatedOff: -2, location: "Northgate Warehousing, Yard 2", notes: "Two dormant USTs found in a Phase I. Rob is gathering prior tank records before we scope.", nextAction: "Review tank records", nextDue: iso(2, 11) });
mkLead({ contact: contact("Marta Jimenez", "mjimenez@example.com", "(631) 555-0155", null), service: S.demo, serviceName: "Demolition & dismantling", state: "WORKING", est: 9600, createdOff: -5, updatedOff: -1, location: "Brentwood, NY", notes: "Interior demo of a former dental office before a retail fit-out. GC wants pricing by Friday.", nextAction: "Site walk with GC", nextDue: iso(1, 14) });
mkLead({ contact: contact("Henry Zhao", "hzhao@greenfield.example", "(631) 555-0188", ACC.greenfield, "Plant Manager"), service: S.soil, serviceName: "Soil & groundwater remediation", state: "WORKING", est: 9800, createdOff: -9, updatedOff: -3, location: "Greenfield Manufacturing", notes: "Phase I flagged a former degreasing area. Henry asked for a Phase II proposal outline.", nextAction: "Send Phase II outline", nextDue: iso(3, 10) });
// QUALIFIED
const q1 = mkLead({ contact: contact("Tom Beckett", "tbeckett@summitridge.example", "(631) 555-0149", ACC.summit, "Director of Facilities"), service: S.asbestos, serviceName: "Asbestos abatement", state: "QUALIFIED", est: 26800, createdOff: -12, updatedOff: -2, location: "Summit Ridge Middle School", notes: "Summer-window abatement of floor tile in 9 classrooms. Board approval needed; visit done, scope confirmed.", nextAction: "Build proposal", nextDue: iso(1, 10) });
visit(q1, TOMMY, -3, "completed", "Walked all 9 classrooms with Tom; tile + mastic throughout, ~11,400 sq ft.");
const q2 = mkLead({ contact: contact("Ingrid Halvorsen", "ihalvorsen@oakmont.example", "(631) 555-0112", ACC.oakmont, "Executive Director"), service: S.mold, serviceName: "Mold remediation", state: "QUALIFIED", est: 7950, createdOff: -7, updatedOff: -1, location: "Oakmont Senior Living, Wing B", notes: "HVAC condensate leak caused mold in 3 resident rooms. Sensitive environment — containment plan matters.", nextAction: "Draft containment plan", nextDue: iso(2, 9) });
const q3 = mkLead({ contact: contact("Paul Girard", "pgirard@bayfront.example", "(631) 555-0199", ACC.bayfront, "Operations VP"), service: S.demo, serviceName: "Demolition & dismantling", state: "QUALIFIED", est: 42000, createdOff: -14, updatedOff: -4, location: "Bayfront Logistics Park, Unit 7", notes: "Full interior strip-out of a 22,000 sq ft unit for a new tenant. Utility disconnects confirmed.", nextAction: "Finalize demolition proposal", nextDue: iso(2, 15) });
// PROPOSAL (drafts + one in approval)
const p1 = mkLead({ contact: contact("Karen Doyle", "kdoyle@riversidepg.example", "(631) 555-0130", ACC.riverside, "Property Manager"), service: S.water, serviceName: "Water damage restoration", state: "PROPOSAL", est: 4100, createdOff: -9, updatedOff: -1, location: "Riverside Commons, Bldg A laundry", notes: "Second job for Riverside this quarter — laundry room supply line leak." });
const p1prop = mkProposal(p1, [{ ...PB.waterExt, qty: 1 }, { ...PB.waterDry, qty: 2 }], "draft", { createdOff: -1 });
db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
  .run(uid("apv"), WS, p1, p1prop.id, TOMMY, ELENA, "standard", iso(-1, 14));
const p2 = mkLead({ contact: contact("Marta Jimenez", "mjimenez@example.com", "(631) 555-0155", null), service: S.asbestos, serviceName: "Asbestos abatement", state: "PROPOSAL", est: 6050, createdOff: -11, updatedOff: -2, location: "Brentwood, NY", notes: "Survey found ACM pipe insulation in the dental office basement." });
mkProposal(p2, [{ ...PB.asbSurvey, qty: 1 }, { ...PB.asbContain, qty: 1 }, { ...PB.asbRemoval, qty: 40 }], "draft", { createdOff: -2 });
const p3 = mkLead({ contact: contact("Rob Fennell", "rfennell@northgate.example", "(631) 555-0176", ACC.northgate, "Facilities Director"), service: S.soil, serviceName: "Soil & groundwater remediation", state: "PROPOSAL", est: 64000, createdOff: -16, updatedOff: -1, location: "Northgate Warehousing, Yard 2", notes: "Remediation program following the tank pull. Over Elena's approval limit — routed to Dana." });
const p3prop = mkProposal(p3, [{ ...PB.soilRemed, qty: 1 }], "draft", { createdOff: -1 });
db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
  .run(uid("apv"), WS, p3, p3prop.id, TOMMY, DANA, "owner", iso(-1, 11));
// SENT
const s1 = mkLead({ contact: contact("Ingrid Halvorsen", "ihalvorsen@oakmont.example", "(631) 555-0112", ACC.oakmont, "Executive Director"), service: S.duct, serviceName: "Duct cleaning & IAQ", state: "SENT", est: 10200, createdOff: -13, updatedOff: -1, location: "Oakmont Senior Living", notes: "Whole-building duct cleaning + IAQ report for their state survey." });
const s1prop = mkProposal(s1, [{ ...PB.ductCom, qty: 3 }], "sent", { sentOff: -3, createdOff: -5 });
db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,decision,submitted_at,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(uid("apv"), WS, s1, s1prop.id, TOMMY, ELENA, "standard", "approved", iso(-4), iso(-3, 16));
const s2 = mkLead({ contact: contact("Tom Beckett", "tbeckett@summitridge.example", "(631) 555-0149", ACC.summit, "Director of Facilities"), service: S.lead, serviceName: "Lead paint stabilization", state: "SENT", est: 8900, createdOff: -10, updatedOff: -2, location: "Summit Ridge Elementary", notes: "Exterior trim stabilization before repainting; school needs it done over spring break." });
mkProposal(s2, [{ ...PB.leadStab, qty: 620 }, { ...PB.leadClear, qty: 1 }], "sent", { sentOff: -2, createdOff: -4 });
// FOLLOWUP (sent, in the chase sequence)
const f1 = mkLead({ contact: contact("George Whitfield", "g.whitfield@example.com", "(631) 555-0128", ACC.elm), service: S.mold, serviceName: "Mold remediation", state: "FOLLOWUP", est: 7950, createdOff: -18, updatedOff: -3, location: "Elm Street Retail Plaza, Unit 4", notes: "Bakery tenant reported mold behind a walk-in. Proposal sent; George is checking with the tenant." });
const f1prop = mkProposal(f1, [{ ...PB.moldRemed, qty: 3 }], "sent", { sentOff: -6, createdOff: -8 });
const f2 = mkLead({ contact: contact("Henry Zhao", "hzhao@greenfield.example", "(631) 555-0188", ACC.greenfield, "Plant Manager"), service: S.tank, serviceName: "Underground tank removal", state: "FOLLOWUP", est: 21650, createdOff: -21, updatedOff: -5, location: "Greenfield Manufacturing", notes: "Single 550-gal UST by the loading dock. Henry is waiting on corporate EHS sign-off." });
const f2prop = mkProposal(f2, [{ ...PB.tankPull, qty: 1 }, { ...PB.tankSoil, qty: 15 }], "sent", { sentOff: -8, createdOff: -10 });
for (const [leadId, prop, dueOff] of [[f1, f1prop, 0], [f2, f2prop, 1]])
  db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES (?,?,?,?,1,?,'active',?,?)")
    .run(uid("fen"), WS, leadId, prop.id, iso(dueOff, 9), iso(-6), iso(-1));
// TERMINAL LEADS
mkLead({ contact: contact("Victor Ames", "vames@example.com", "(631) 555-0171", null), service: S.demo, serviceName: "Demolition & dismantling", state: "LOST", est: 15000, createdOff: -24, updatedOff: -9, lostReason: "price", notes: "Went with a cheaper bidder for the garage teardown." });
mkLead({ contact: contact("Nora Lindqvist", "nora.l@example.com", "(631) 555-0137", null), service: S.duct, serviceName: "Duct cleaning & IAQ", state: "LOST", est: 649, createdOff: -15, updatedOff: -8, lostReason: "chose_competitor", notes: "Chose a national franchise coupon deal." });
mkLead({ contact: contact("Eddie Romano", "eromano@example.com", "(631) 555-0104", null), service: S.water, serviceName: "Water damage restoration", state: "NO_RESPONSE", est: 3200, createdOff: -30, updatedOff: -12, notes: "Three calls and two emails since the estimate — no reply." });
mkLead({ contact: contact("Farah Qureshi", "fqureshi@example.com", "(631) 555-0181", null), service: S.soil, serviceName: "Soil & groundwater remediation", state: "UNSERVICEABLE", est: 0, createdOff: -6, updatedOff: -5, location: "Nassau County (outside service area)", notes: "Site is outside our licensed service area; referred to a partner firm." });
mkLead({ contact: contact("Spam Bot", "deals@cheap-leads.example", "", null), service: S.duct, serviceName: "Duct cleaning & IAQ", state: "JUNK", est: 0, createdOff: -3, updatedOff: -3, notes: "Purchased-lead spam submission." });

// ---------- WON → JOBS IN EVERY STAGE ----------
function wonJob(o) {
  const leadId = mkLead({ contact: o.contact, service: o.service, serviceName: o.serviceName, state: "WON", est: o.est, createdOff: o.createdOff ?? -30, updatedOff: o.signedOff ?? -3, location: o.location, notes: o.notes, account: o.account || null });
  const prop = mkProposal(leadId, o.items, "signed", { sentOff: (o.signedOff ?? -3) - 2, signedOff: o.signedOff ?? -3, createdOff: (o.signedOff ?? -3) - 4 });
  const jobId = mkJob(leadId, prop, o.stage, o.jobOpts || {});
  return { leadId, prop, jobId };
}
// AWAITING_SCHEDULING ×2
wonJob({ contact: contact("Karen Doyle", "kdoyle@riversidepg.example", "(631) 555-0130", ACC.riverside, "Property Manager"), service: S.asbestos, serviceName: "Asbestos abatement", est: 5900, location: "Riverside Commons, Bldg B", notes: "Pipe insulation in the Bldg B boiler room. Signed Friday — needs a crew date.", items: [{ ...PB.asbContain, qty: 1 }, { ...PB.asbRemoval, qty: 90 }], stage: "AWAITING_SCHEDULING", signedOff: -1, jobOpts: { needsVisit: 1 } });
wonJob({ contact: contact("Paul Girard", "pgirard@bayfront.example", "(631) 555-0199", ACC.bayfront, "Operations VP"), service: S.water, serviceName: "Water damage restoration", est: 3650, location: "Bayfront Logistics Park, Unit 2 office", notes: "Sprinkler leak in the Unit 2 office. Drying only — repairs by their GC.", items: [{ ...PB.waterExt, qty: 1 }, { ...PB.waterDry, qty: 1 }], stage: "AWAITING_SCHEDULING", signedOff: -2 });
// SCHEDULED ×2 (crew booked this week)
const sch1 = wonJob({ contact: contact("Tom Beckett", "tbeckett@summitridge.example", "(631) 555-0149", ACC.summit, "Director of Facilities"), service: S.mold, serviceName: "Mold remediation", est: 5300, location: "Summit Ridge Elementary, Library", notes: "Library remediation while school is in session — weekend work approved.", items: [{ ...PB.moldRemed, qty: 2 }], stage: "SCHEDULED", signedOff: -6, jobOpts: { startOff: 2, endOff: 3 } });
sched(sch1.leadId, TOMMY, W_JAMES, 2, "Library remediation — crew of 2"); sched(sch1.leadId, TOMMY, W_ROSA, 2, "Library remediation — crew of 2");
docs(sch1.leadId, sch1.jobId, [["Work order", "received", -4], ["Certificate of insurance", "received", -4], ["Mold remediation plan", "missing", null]]);
const sch2 = wonJob({ contact: contact("Ingrid Halvorsen", "ihalvorsen@oakmont.example", "(631) 555-0112", ACC.oakmont, "Executive Director"), service: S.lead, serviceName: "Lead paint stabilization", est: 4650, location: "Oakmont Senior Living, Garden Wing", notes: "Window trim stabilization in the Garden Wing common areas.", items: [{ ...PB.leadStab, qty: 340 }, { ...PB.leadClear, qty: 1 }], stage: "SCHEDULED", signedOff: -5, jobOpts: { startOff: 4, endOff: 5 } });
sched(sch2.leadId, TOMMY, W_ROSA, 4, "Garden Wing trim — Rosa lead");
// IN_PROGRESS ×3 (crew on site today)
const ip1 = wonJob({ contact: contact("Rob Fennell", "rfennell@northgate.example", "(631) 555-0176", ACC.northgate, "Facilities Director"), service: S.tank, serviceName: "Underground tank removal", est: 24350, location: "Northgate Warehousing, Yard 1", notes: "1,000-gal UST pull + 40 tons of soil. Day 2 of 3.", items: [{ ...PB.tankPull, qty: 1 }, { ...PB.tankSoil, qty: 40 }], stage: "IN_PROGRESS", signedOff: -9, jobOpts: { startOff: -1, endOff: 1 } });
sched(ip1.leadId, TOMMY, W_JAMES, 0, "Tank pull day 2 — excavation"); sched(ip1.leadId, TOMMY, W_JAMES, -1, "Tank pull day 1 — saw-cut & expose");
docs(ip1.leadId, ip1.jobId, [["Work order", "received", -8], ["Tank closure permit", "received", -8], ["Waste manifest", "missing", null]]);
const ip2 = wonJob({ contact: contact("Facilities — St. Aurelia", "facilities@staurelia.example", "(631) 555-0150", ACC.stAurelia, "Facilities"), service: S.asbestos, serviceName: "Asbestos abatement", est: 12880, location: "St. Aurelia Medical Center, Basement Mech Room", notes: "Night-shift abatement so the mech room stays online during the day.", items: [{ ...PB.asbContain, qty: 1 }, { ...PB.asbRemoval, qty: 380 }], stage: "IN_PROGRESS", signedOff: -7, jobOpts: { startOff: -2, endOff: 2 } });
sched(ip2.leadId, MARCUS, W_ROSA, 0, "Night shift — mech room containment");
const ip3 = wonJob({ contact: contact("Dana's referral — Lisa Tran", "ltran@cedarhollow.example", "(631) 555-0122", ACC.cedar, "Community Manager"), service: S.mold, serviceName: "Mold remediation", est: 7950, location: "Cedar Hollow Apartments, Unit 14B", notes: "Remediation + clearance before a new tenant moves in Friday.", items: [{ ...PB.moldRemed, qty: 3 }], stage: "IN_PROGRESS", signedOff: -4, jobOpts: { startOff: -1, endOff: 1 } });
sched(ip3.leadId, TOMMY, W_JAMES, 0, "Unit 14B remediation");
// ON_HOLD ×1
const oh1 = wonJob({ contact: contact("Public Works — Eastmere", "dpw@eastmere.example", "(631) 555-0160", ACC.eastmere, "DPW Superintendent"), service: S.demo, serviceName: "Demolition & dismantling", est: 42000, location: "Old Eastmere Water Dept building", notes: "ON HOLD: village board delayed the demolition permit vote to next month.", items: [{ ...PB.demoStruct, qty: 1 }], stage: "ON_HOLD", signedOff: -12 });
// WORK_COMPLETED ×1 (draft invoice ready)
const wc1 = wonJob({ contact: contact("Sam Oduya", "sam.oduya@example.com", "(631) 555-0109", ACC.lakeview), service: S.water, serviceName: "Water damage restoration", est: 4100, location: "Lakeview Marina office", notes: "Extraction + 2 days drying after the storm surge. Work complete, invoice drafted.", items: [{ ...PB.waterExt, qty: 1 }, { ...PB.waterDry, qty: 2 }], stage: "WORK_COMPLETED", signedOff: -10, jobOpts: { startOff: -6, endOff: -4 } });
mkInvoice(wc1.leadId, wc1.jobId, [{ name: "Water extraction & drying", qty: 1, price: 3200 }, { name: "Dehumidification (per day)", qty: 2, price: 450 }], "draft", { issuedOff: -1, dueOff: 13 });
docs(wc1.leadId, wc1.jobId, [["Work order", "received", -9], ["Completion photos", "received", -4]]);
// DOCUMENTATION_PENDING ×1 (missing paperwork drives the chase)
const dp1 = wonJob({ contact: contact("Henry Zhao", "hzhao@greenfield.example", "(631) 555-0188", ACC.greenfield, "Plant Manager"), service: S.asbestos, serviceName: "Asbestos abatement", est: 8360, location: "Greenfield Manufacturing, Boiler Room", notes: "Work finished last week — waiting on the signed waste manifest from the disposal facility.", items: [{ ...PB.asbContain, qty: 1 }, { ...PB.asbRemoval, qty: 190 }], stage: "DOCUMENTATION_PENDING", signedOff: -14, jobOpts: { startOff: -9, endOff: -7 } });
docs(dp1.leadId, dp1.jobId, [["Work order", "received", -13], ["Certificate of insurance", "received", -13], ["Waste manifest", "missing", null], ["Clearance air test", "missing", null]]);
// READY_TO_INVOICE ×1
const ri1 = wonJob({ contact: contact("Karen Doyle", "kdoyle@riversidepg.example", "(631) 555-0130", ACC.riverside, "Property Manager"), service: S.duct, serviceName: "Duct cleaning & IAQ", est: 3400, location: "Riverside Commons clubhouse", notes: "Clubhouse duct cleaning done; paperwork complete — ready to invoice.", items: [{ ...PB.ductCom, qty: 1 }], stage: "READY_TO_INVOICE", signedOff: -11, jobOpts: { startOff: -5, endOff: -5 } });
docs(ri1.leadId, ri1.jobId, [["Work order", "received", -10], ["Completion photos", "received", -5], ["IAQ report", "received", -5]]);
// INVOICED ×3 (one overdue, one current, one partially paid)
const in1 = wonJob({ contact: contact("Rob Fennell", "rfennell@northgate.example", "(631) 555-0176", ACC.northgate, "Facilities Director"), service: S.demo, serviceName: "Demolition & dismantling", est: 8640, location: "Northgate Warehousing, Office annex", notes: "Annex strip-out complete. Invoice 12 days overdue — Rob says AP is processing.", items: [{ ...PB.demoInt, qty: 960 }], stage: "INVOICED", signedOff: -26, jobOpts: { startOff: -20, endOff: -18 } });
mkInvoice(in1.leadId, in1.jobId, [{ name: "Interior selective demolition", qty: 960, price: 9 }], "sent", { issuedOff: -16, dueOff: -12 });
const in2 = wonJob({ contact: contact("Lisa Tran", "ltran@cedarhollow.example", "(631) 555-0122", ACC.cedar, "Community Manager"), service: S.lead, serviceName: "Lead paint stabilization", est: 5390, location: "Cedar Hollow Apartments, Bldg 7", notes: "Bldg 7 exterior stabilization + clearance passed.", items: [{ ...PB.leadStab, qty: 420 }, { ...PB.leadClear, qty: 1 }], stage: "INVOICED", signedOff: -15, jobOpts: { startOff: -10, endOff: -8 } });
mkInvoice(in2.leadId, in2.jobId, [{ name: "Lead paint stabilization", qty: 420, price: 11 }, { name: "Clearance testing & report", qty: 1, price: 750 }], "sent", { issuedOff: -4, dueOff: 10 });
const in3 = wonJob({ contact: contact("Facilities — St. Aurelia", "facilities@staurelia.example", "(631) 555-0150", ACC.stAurelia, "Facilities"), service: S.soil, serviceName: "Soil & groundwater remediation", est: 9800, location: "St. Aurelia Medical Center, Parking Lot C", notes: "Phase II assessment under the old fuel island. Half paid; balance on the final report.", items: [{ ...PB.soilPhase, qty: 1 }], stage: "INVOICED", signedOff: -19, jobOpts: { startOff: -14, endOff: -12 } });
mkInvoice(in3.leadId, in3.jobId, [{ name: "Phase II site assessment", qty: 1, price: 9800 }], "partially_paid", { issuedOff: -8, dueOff: 6 });
// CLOSED ×2 (paid in full)
const cl1 = wonJob({ contact: contact("Tom Beckett", "tbeckett@summitridge.example", "(631) 555-0149", ACC.summit, "Director of Facilities"), service: S.water, serviceName: "Water damage restoration", est: 3650, location: "Summit Ridge High School, Gym", notes: "Gym floor extraction after a roof leak. Paid in full.", items: [{ ...PB.waterExt, qty: 1 }, { ...PB.waterDry, qty: 1 }], stage: "CLOSED", signedOff: -34, jobOpts: { startOff: -30, endOff: -28, closedOff: -12 } });
mkInvoice(cl1.leadId, cl1.jobId, [{ name: "Water extraction & drying", qty: 1, price: 3200 }, { name: "Dehumidification (per day)", qty: 1, price: 450 }], "paid", { issuedOff: -26, dueOff: -12 });
docs(cl1.leadId, cl1.jobId, [["Work order", "received", -33], ["Completion photos", "received", -28], ["Certificate of insurance", "received", -33, 9]]);
const cl2 = wonJob({ contact: contact("Paul Girard", "pgirard@bayfront.example", "(631) 555-0199", ACC.bayfront, "Operations VP"), service: S.mold, serviceName: "Mold remediation", est: 2650, location: "Bayfront Logistics Park, Unit 1 office", notes: "Single-room remediation + clearance. Paid in full.", items: [{ ...PB.moldRemed, qty: 1 }], stage: "CLOSED", signedOff: -40, jobOpts: { startOff: -36, endOff: -35, closedOff: -20 } });
mkInvoice(cl2.leadId, cl2.jobId, [{ name: "Mold remediation (per room)", qty: 1, price: 2650 }], "paid", { issuedOff: -33, dueOff: -20 });
// CANCELLED ×1
wonJob({ contact: contact("George Whitfield", "g.whitfield@example.com", "(631) 555-0128", ACC.elm), service: S.demo, serviceName: "Demolition & dismantling", est: 5400, location: "Elm Street Retail Plaza, kiosk", notes: "Client cancelled the kiosk demo — plaza changed its renovation plan after signing.", items: [{ ...PB.demoInt, qty: 600 }], stage: "CANCELLED", signedOff: -18 });

// ---------- TASKS / VISITS / INBOX / TIMESHEETS / CAMPAIGN ----------
task({ lead: f1, type: "follow_up", title: "Follow up on mold proposal (Elm Street bakery)", dueOff: 0, hour: 9, createdOff: -2, notes: "Step 2 of the follow-up sequence — George is checking with the tenant." });
task({ lead: f2, type: "follow_up", title: "Follow up on tank removal proposal (Greenfield)", dueOff: 1, hour: 9, createdOff: -3 });
task({ lead: in1.leadId, type: "follow_up", title: "Chase overdue invoice INV-1002 — Northgate AP", dueOff: -1, hour: 10, createdOff: -4, notes: "12 days overdue. Rob said AP is processing — confirm the payment date." });
task({ lead: dp1.leadId, type: "document", title: "Chase the signed waste manifest (Greenfield boiler room)", dueOff: -2, hour: 11, assignee: MARCUS, createdOff: -5, notes: "Disposal facility promised it Friday. Job cannot invoice without it." });
task({ lead: q1, type: "schedule", title: "Confirm summer window dates with Summit Ridge", dueOff: 1, hour: 13, createdOff: -1 });
task({ lead: p3, type: "approval", title: "Dana: remediation proposal for Northgate needs your approval", dueOff: 0, hour: 12, assignee: DANA, createdOff: -1, notes: "$64,000 program — over Elena's limit." });
task({ lead: ip1.leadId, type: "field", title: "Day-2 excavation check — tank pull, Northgate Yard 1", dueOff: 0, hour: 8, assignee: MARCUS, createdOff: -1 });
task({ lead: cl1.leadId, type: "thank_you", title: "Send thank-you + review request to Summit Ridge", dueOff: -3, status: "done", doneOff: -3, createdOff: -6 });
task({ lead: sch1.leadId, type: "schedule", title: "Book library remediation crew (weekend)", dueOff: -2, status: "done", doneOff: -2, createdOff: -4 });
task({ lead: in2.leadId, type: "follow_up", title: "Send invoice INV-1003 to Cedar Hollow", dueOff: -4, status: "done", doneOff: -4, createdOff: -5 });
visit(q2, TOMMY, 1, "scheduled", "Containment walk-through with Ingrid — bring the sensitive-environment checklist.");
visit(p1, MARCUS, 2, "scheduled", "Verify drying equipment placement for the laundry room job.");
// Inbox (open items incl. one booking source, done items for the Sent/filed feel)
const inbox = (o) => { const id = uid("inb"); db.prepare(`INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,lead_id,owner_id,next_action_due_at,received_at,created_at,status,completed_at,job_id)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, WS, o.category, o.from, o.email, o.subject, o.body, o.lead || null, TOMMY, o.dueOff != null ? iso(o.dueOff, 17) : null, iso(o.off ?? -1, 8), iso(o.off ?? -1, 8), o.status || "open", o.status === "done" ? iso(o.off ?? -1, 15) : null, o.job || null); return id; };
inbox({ category: "sales", from: "Chris Pappas", email: "cpappas@example.com", subject: "Asbestos survey before our renovation?", body: "Hi — Dana gave me your name. We're renovating a 1960s office in Hauppauge and our architect says we need an asbestos survey before demo. Can someone walk it this week?", off: 0 });
inbox({ category: "field", from: "Ingrid Halvorsen", email: "ihalvorsen@oakmont.example", subject: "Can we move Thursday's walk-through to Friday?", body: "Our state surveyor visit moved, so Thursday no longer works. Is Friday morning possible for the containment walk-through?", lead: q2, off: -1 });
inbox({ category: "finance", from: "Rob Fennell", email: "rfennell@northgate.example", subject: "Re: Invoice INV-1002", body: "Sorry for the delay — AP cut the check run early this month. Confirming the new pay date by tomorrow.", lead: in1.leadId, job: in1.jobId, off: 0 });
inbox({ category: "admin", from: "Greenfield Disposal Co.", email: "docs@greenfielddisposal.example", subject: "Signed waste manifest — Greenfield boiler room", body: "Attached is the signed manifest for the boiler room abatement load. Original follows by mail.", lead: dp1.leadId, job: dp1.jobId, off: 0 });
inbox({ category: "vendor", from: "LeadGen Pro", email: "offers@leadgenpro.example", subject: "500 exclusive contractor leads — 50% off", body: "Buy our exclusive lead pack for environmental contractors in your area. Limited time.", off: -2 });
inbox({ category: "sales", from: "Marta Jimenez", email: "mjimenez@example.com", subject: "Basement insulation — next steps?", body: "Thanks for the survey. The board meets Tuesday — when will the proposal be ready to share with them?", lead: p2, off: -1 });
inbox({ category: "admin", from: "Elena Brooks", email: "elena@apexenv.example", subject: "Updated COI from our insurer", body: "Forwarding our renewed certificate of insurance for the file.", status: "done", off: -3 });
inbox({ category: "field", from: "Tom Beckett", email: "tbeckett@summitridge.example", subject: "Re: Library remediation weekend", body: "Weekend access is confirmed — custodial will have the library open at 7am Saturday.", lead: sch1.leadId, job: sch1.jobId, status: "done", off: -2 });
// Timesheets: this week (one submitted, one missing → the chase queue works) + last week approved
db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status,submitted_at,hours,worker_id) VALUES (?,?,?,?,?,?,?,?)")
  .run(uid("ts"), WS, TOMMY, monday, "submitted", iso(0, 7), 22.5, W_JAMES);
db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status,worker_id) VALUES (?,?,?,?,?,?)")
  .run(uid("ts"), WS, TOMMY, monday, "missing", W_ROSA);
for (const w of [W_JAMES, W_ROSA]) db.prepare("INSERT INTO timesheets (id,workspace_id,manager_id,week_of,status,submitted_at,hours,worker_id,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(uid("ts"), WS, TOMMY, lastMonday, "approved", iso(-3, 8), 40, w, ELENA, iso(-2, 9));
// One tracker campaign for the Campaigns view
db.prepare("INSERT INTO campaigns (id,workspace_id,name,type,status,starts_on,ends_on,notes,created_at,updated_at,kind) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
  .run(uid("cmp"), WS, "Q4 property-manager outreach", "email", "active", iso(-14).slice(0, 10), iso(45).slice(0, 10), "Seasonal mold + IAQ check-in offer to past property-management customers.", iso(-14), iso(-1), "tracker");

db.exec("COMMIT");
} catch (e) { try { db.exec("ROLLBACK"); } catch { /* noop */ } console.error("SEED FAILED, rolled back:", e.message); process.exit(1); }
finally { db.exec("PRAGMA foreign_keys=ON"); }

// ---------- report ----------
const c = (sql) => db.prepare(sql).get(WS).c;
console.log("SEEDED Apex Environmental Services (" + WS + ")");
console.log("leads by state:", ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK"].map((s) => `${s}=${c(`SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state='${s}'`)}`).join(" "));
console.log("jobs by stage:", ["AWAITING_SCHEDULING", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE", "INVOICED", "CLOSED", "CANCELLED"].map((s) => `${s}=${c(`SELECT COUNT(*) c FROM jobs WHERE workspace_id=? AND stage='${s}'`)}`).join(" "));
console.log("proposals:", c("SELECT COUNT(*) c FROM proposals WHERE workspace_id=?"), "| invoices:", c("SELECT COUNT(*) c FROM invoices WHERE workspace_id=?"),
  "| tasks open:", c("SELECT COUNT(*) c FROM tasks WHERE workspace_id=? AND status='open'"), "| inbox open:", c("SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND status='open'"),
  "| approvals pending:", c("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL"));
console.log("LOGINS (password for all: " + DEMO_PASSWORD + "):");
console.log("  Dana Whitaker  (OWNER)     dana@apexenv.example");
console.log("  Marcus Reed    (OPS_ADMIN) marcus@apexenv.example");
console.log("  Elena Brooks   (APPROVER)  elena@apexenv.example");
console.log("  Tommy Alvarez  (PM)        tommy@apexenv.example");

// G.C. Environmental PILOT seed — drives the LIVE Workpile API through the real flows.
// Realistic pilot data modeled on gcenvironmental.com's actual business (55 real services,
// real client categories, market-typical values). Client/staff names are fictional stand-ins.
// Usage: node scripts/seed-gc-pilot.mjs [baseUrl]   (default https://workpile.claimpaid.io)
const BASE = process.argv[2] || "https://workpile.claimpaid.io";
const DAY = 86400000;
const iso = (d) => new Date(d).toISOString();
const daysAgo = (n, h = 10) => iso(Date.now() - n * DAY + h * 3600000);
const dateOnly = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10); // n days ago (0=today, negative=future)
const fail = []; let okCount = 0;
function note(ok, label, extra = "") { if (ok) { okCount++; } else { fail.push(label + " " + extra); console.log("  ✗", label, extra); } }

class Client {
  constructor() { this.cookie = ""; }
  async req(method, path, body, form = false) {
    const headers = { Cookie: this.cookie };
    let payload;
    if (body !== undefined) {
      if (form) { headers["Content-Type"] = "application/x-www-form-urlencoded"; payload = new URLSearchParams(body).toString(); }
      else { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    }
    const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    const setCookie = r.headers.get("set-cookie");
    if (setCookie && setCookie.includes("lf_session=")) this.cookie = setCookie.split(";")[0];
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: r.status, json };
  }
  get(p) { return this.req("GET", p); }
  post(p, b, f) { return this.req("POST", p, b, f); }
  patch(p, b) { return this.req("PATCH", p, b); }
  put(p, b) { return this.req("PUT", p, b); }
}

const greg = new Client(), sheh = new Client(), dan = new Client();

// ---------- 1. Owner account + workspace ----------
let r = await greg.post("/api/auth/register", { name: "Gregory Collins", email: "gregory@gcenvironmental.com", password: "GcEnv2026!temp", business_name: "G.C. Environmental, Inc." });
if (r.status === 409) { r = await greg.post("/api/auth/login", { email: "gregory@gcenvironmental.com", password: "GcEnv2026!temp" }); note(r.status === 200, "gregory login (existing)"); }
else note(r.status === 201, "gregory register", JSON.stringify(r.json).slice(0, 120));
const existing = await greg.get("/api/leads?limit=5");
if (existing.json && (existing.json.total ?? existing.json.leads?.length ?? 0) > 5) { console.log("Workspace already seeded — aborting."); process.exit(0); }

await greg.patch("/api/settings", { name: "G.C. Environmental, Inc.", vertical: "Environmental Consulting & Contracting", timezone: "America/New_York", from_name: "G.C. Environmental, Inc.", from_email: "info@gcenvironmental.com", followup_enabled: true, booking_enabled: true });

// ---------- 2. Team (Crew trial = 3 seats: owner + 2) ----------
async function addUser(c, name, email, password, role) {
  let x = await greg.post("/api/users", { name, email, password, role });
  if (x.status === 409 || x.status === 422) { x = await c.post("/api/auth/login", { email, password }); note(x.status === 200, `login ${email}`); const me = await c.get("/api/auth/me"); return me.json.user?.id || me.json.id; }
  note(x.status === 201 || x.status === 200, `add user ${email}`, JSON.stringify(x.json).slice(0, 100));
  await c.post("/api/auth/login", { email, password });
  const me = await c.get("/api/auth/me");
  return x.json.id || me.json.user?.id || me.json.id;
}
const shehId = await addUser(sheh, "Shehreyar Khan", "shehreyar@gcenvironmental.com", "GcOps2026!temp", "OPS_ADMIN");
const danId = await addUser(dan, "Daniel Reyes", "daniel@gcenvironmental.com", "GcField2026!temp", "PM");
const gregId = (await greg.get("/api/auth/me")).json.user?.id;
console.log("team:", { gregId, shehId, danId });

// ---------- 3. Labor classes + assignments ----------
await greg.post("/api/labor-classes/seed-defaults", {});
for (const lc of [{ name: "Environmental Inspector", private_rate: 45, govt_rate: 80 }, { name: "Geoprobe Operator", private_rate: 42, govt_rate: 75 }]) await greg.post("/api/labor-classes", lc);
const classes = (await greg.get("/api/labor-classes")).json;
const pmClass = (Array.isArray(classes) ? classes : classes.classes || []).find(c => c.name === "Project Manager");
if (pmClass) { if (danId) await greg.patch(`/api/team/${danId}`, { labor_class_id: pmClass.id }); if (shehId) await greg.patch(`/api/team/${shehId}`, { labor_class_id: pmClass.id }); }
note(!!pmClass, "labor classes");

// ---------- 4. Services: all 55 real G.C. services, defaults off ----------
const SERVICES = ["Asbestos Surveys","Environmental Assessments","Environmental Impact Assessments","Geophysical Investigations (GPR)","Geoprobe Drilling","Groundwater Investigations & Studies","Lead-Based Paint Surveys","Mold Testing","NEPA & Land Use Screening","Phase I ESA","Phase II ESA","Risk & Exposure Assessments","Storage Tank Closure Assessments","Transaction Screenings","Vapor Intrusion Assessment & Mitigation","Wetland Studies","Brownfield Redevelopment","Contaminated Soil Removal","Dry Well Remediation","Emergency Spill Response","Hazardous Waste Management","Monitoring Well Installation & Maintenance","Oil Spill Cleanups","Performance Monitoring","Plume Delineation","Remedial Alternative Evaluations","Remedial Design & Technologies","Remedial Implementation/Operation & Maintenance","Remedial Investigation","Remedial Oversight","Soil Vapor Extraction & Air Sparge Systems","Subsurface Investigations & Site Characterization","Underground Injection Well Closure","Waste Disposal Evaluations","Chemical Bulk Storage Compliance Inspections","Custom Facility Inspections","Permitting/Project Management & Reporting","Petroleum Bulk Storage Compliance Inspections","Spill Closure","Violations Clearing","Fuel Management Systems","Fuel Polishing","Fuel System Maintenance & Service","Fuel Testing","Lift Removal","Spill Prevention","Tank Cleaning","Tank Closures & Environmental Oversight","Tank Compliance","Tank Monitoring Systems","Tank Removals","Tank Repairs & Lining","Tank System Design & Installation","Tank Testing","Tank Upgrades"];
const svcList = (await greg.get("/api/services")).json;
for (const s of (Array.isArray(svcList) ? svcList : [])) if (!SERVICES.includes(s.name)) await greg.patch(`/api/services/${s.id}`, { active: 0 });
let svcOk = 0;
for (const name of SERVICES) { const x = await greg.post("/api/services", { name }); if (x.status === 201) svcOk++; }
note(svcOk >= 50, `services created ${svcOk}/55`);

// ---------- 5. Price book (market-typical pilot rates — Gregory replaces with his real book) ----------
const BOOK = [
  ["Phase I Environmental Site Assessment", "job", 3200, 2800], ["Phase II ESA — Subsurface Investigation", "job", 24500, 21000],
  ["Asbestos Survey", "job", 2400, 2000], ["Lead-Based Paint Survey", "job", 1600, 1350],
  ["Mold Testing & Inspection", "job", 850, 700], ["Geoprobe Drilling", "day", 4200, 3600],
  ["Soil Boring & Sampling", "boring", 650, 550], ["Monitoring Well Installation", "well", 3800, 3200],
  ["Groundwater Sampling Event", "event", 1450, 1200], ["Tank Tightness Testing", "tank", 1150, 950],
  ["UST Removal & Closure", "tank", 32000, 27500], ["Contaminated Soil Excavation & Disposal", "ton", 185, 160],
  ["Emergency Spill Response Callout", "callout", 2800, 2400], ["Spill Cleanup Crew", "hour", 145, 125],
  ["PBS/CBS Compliance Inspection", "job", 1800, 1500], ["Vapor Intrusion Assessment", "job", 9600, 8200],
  ["Remedial Investigation", "job", 68000, 58000], ["Tank Cleaning", "tank", 7400, 6300],
];
const pb = {};
for (const [name, unit, std, floor] of BOOK) { const x = await greg.post("/api/price-book", { name, unit, standard_price: std, floor_price: floor }); if (x.status === 201) pb[name] = x.json.id; }
note(Object.keys(pb).length === BOOK.length, `price book ${Object.keys(pb).length}/${BOOK.length}`);

// ---------- 6. Branded proposal template ----------
const tpl = await greg.put("/api/proposal-template", {
  company: "G.C. Environmental, Inc.", tagline: "Environmental Consulting & Contracting — Since 1989",
  contact_line: "(631) 206-3700 · Toll-Free (877) 423-6847 · info@gcenvironmental.com",
  address: "94 North Clinton Avenue, Bay Shore, NY 11706",
  intro_html: "<p>Dear {customer},</p><p>Thank you for the opportunity to propose on <strong>{service}</strong> at {location}. G.C. Environmental, Inc. has provided environmental consulting and contracting services across Long Island and the greater New York area since 1989. The scope and pricing below reflect our site review and current NYSDEC requirements.</p>",
  terms_html: "<ul><li>Proposal valid for 30 days from the date above.</li><li>Work performed in accordance with applicable NYSDEC, OSHA, and local regulations.</li><li>Payment terms: net 30 from invoice; deposits where noted in the scope.</li><li>Unforeseen subsurface conditions, if encountered, will be documented and quoted as a change order before additional work proceeds.</li></ul>",
  footer: "G.C. Environmental, Inc. · 94 North Clinton Avenue, Bay Shore, NY 11706 · (631) 206-3700 · Licenses & certifications: OSHA · EPA · NYS DEC · FDNY · NYSDOT · NYC DOB",
});
note(tpl.status === 200, "proposal template", JSON.stringify(tpl.json).slice(0, 80));

// ---------- 7. Lead factory ----------
async function makeLead(c, spec) {
  const x = await c.post("/api/leads", {
    contact: { name: spec.contact, phone: spec.phone || "", email: spec.email || "" },
    location: spec.location, service_requested: spec.service, message: spec.scope,
    est_value: spec.est || 0, source: spec.source || "Email", created_at: spec.created,
    owner_id: spec.owner || danId, pm_id: spec.pm === null ? null : (spec.pm || danId),
    approver_id: gregId, consent: { contact_ok: true },
  });
  if (!(x.status === 201 || x.status === 200) || !x.json.lead?.id) { note(false, `lead ${spec.contact}`, JSON.stringify(x.json).slice(0, 120)); return null; }
  const id = x.json.lead.id;
  if (spec.sector) await c.patch(`/api/leads/${id}`, { sector: spec.sector });
  return id;
}
async function move(c, id, to, extra = {}) { const x = await c.post(`/api/leads/${id}/transition`, { to_state: to, ...extra }); if (x.status !== 200) note(false, `transition ${id} -> ${to}`, JSON.stringify(x.json).slice(0, 140)); return x.status === 200; }
async function qualify(c, id) { await move(c, id, "TRIAGED"); await move(c, id, "QUALIFYING"); await move(c, id, "QUALIFIED"); }
async function propose(c, id, items) {
  const x = await c.post(`/api/leads/${id}/proposals`, { line_items: items.map(([k, qty, price]) => ({ price_book_item_id: pb[k], qty, ...(price ? { unit_price: price } : {}) })) });
  if (x.status !== 201) { note(false, `proposal ${id}`, JSON.stringify(x.json).slice(0, 140)); return null; }
  return x.json.id;
}
async function approveFlow(c, id) { // -> READY_FOR_APPROVAL, returns approval id
  await move(c, id, "READY_FOR_APPROVAL");
  const list = (await greg.get("/api/approvals")).json;
  const a = (Array.isArray(list) ? list : []).find(a => a.lead_id === id && !a.decision);
  return a?.id;
}
async function decide(approvalId, decision) { const x = await greg.post(`/api/approvals/${approvalId}/decide`, { decision }); if (x.status !== 200) note(false, `decide ${approvalId}`, JSON.stringify(x.json).slice(0, 120)); return x.status === 200; }
async function sendProposal(c, propId, leadId) {
  const x = await c.post(`/api/proposals/${propId}/send`, { channel: "email" });
  if (x.status !== 200) { await move(c, leadId, "PROPOSAL_SENT"); }
}
async function signProposal(c, propId, signer) {
  const x = await c.post(`/api/proposals/${propId}/sign-link`, {});
  if (x.status !== 200 || !x.json.token) { note(false, `sign-link ${propId}`, JSON.stringify(x.json).slice(0, 100)); return false; }
  const anon = new Client();
  const s = await anon.post(`/sign/${x.json.token}`, { signer_name: signer, signer_email: "", typed_signature: signer, consent: "1" }, true);
  return s.status === 200;
}

// ---------- 8. THE BACKLOG (the pile Gregory recognizes) ----------
const backlog = [
  { contact: "Michael Ferraro", email: "mferraro@harborviewrealty.com", phone: "(631) 555-0142", location: "140 Pine Aire Drive, Bay Shore, NY", service: "Phase I ESA", scope: "Phase I ESA for a 22,000 sq ft warehouse purchase. Buyer financing through regional bank; bank requires ASTM E1527 report. Site has historic auto-repair use in the 1980s.", est: 3200, source: "Email", created: daysAgo(88) },
  { contact: "QuickStop Fuel & Mart — Brentwood", email: "ops@quickstopfuel.example", phone: "(631) 555-0119", location: "2110 Brentwood Road, Brentwood, NY", service: "Tank Testing", scope: "Annual tightness testing on two 10,000-gallon gasoline USTs. PBS registration renewal due this quarter; test results needed for the file.", est: 2300, source: "Phone", created: daysAgo(69) },
  { contact: "St. Mary's Parish School", email: "facilities@stmarysbayshore.example", phone: "(631) 555-0173", location: "44 Main Street, Bay Shore, NY", service: "Asbestos Surveys", scope: "Pre-renovation asbestos survey of the 1962 classroom wing before summer capital work. District architect needs the survey to complete bid documents.", est: 2400, source: "Website", created: daysAgo(53) },
  { contact: "Patchogue Shores Condo Association", email: "board@patchogueshores.example", phone: "(631) 555-0128", location: "8 Beachview Court, Patchogue, NY", service: "Mold Testing", scope: "Mold testing in four ground-floor units after repeated water intrusion complaints. Board wants air and surface sampling with a written report for the owners.", est: 850, source: "Email", created: daysAgo(46) },
  { contact: "Hempstead Garden Apartments LLC", email: "mgmt@hempsteadgarden.example", phone: "(516) 555-0137", location: "320 Fulton Avenue, Hempstead, NY", service: "Lead-Based Paint Surveys", scope: "Lead-based paint survey across three residential buildings (48 units) ahead of refinancing. Lender environmental checklist item.", est: 4800, source: "Referral", created: daysAgo(40) },
  { contact: "Klein & Associates, Environmental Counsel", email: "jklein@kleinenvlaw.example", phone: "(516) 555-0161", location: "75 Motor Parkway, Farmingdale, NY", service: "Phase I ESA", scope: "Phase I ESA for buyer's counsel on an industrial parcel with a former machine shop. Counsel wants database review plus site reconnaissance within three weeks of engagement.", est: 3200, source: "Referral", created: daysAgo(35) },
  { contact: "Meridian Engineering Group", email: "projects@meridianeng.example", phone: "(631) 555-0155", location: "1200 Veterans Highway, Ronkonkoma, NY", service: "Geoprobe Drilling", scope: "Two days of Geoprobe drilling support (8 borings) for a consultant's delineation program. They supply the geologist; we supply rig, operator, and tooling.", est: 8400, source: "Email", created: daysAgo(32) },
  { contact: "Riverhead Fuel Oil Co.", email: "dispatch@riverheadfuel.example", phone: "(631) 555-0104", location: "915 East Main Street, Riverhead, NY", service: "Petroleum Bulk Storage Compliance Inspections", scope: "Annual PBS compliance inspection of their bulk plant: two 20,000-gallon ASTs, dispensing area, and spill containment. Include registration paperwork check.", est: 1800, source: "Phone", created: daysAgo(28) },
  { contact: "Medford Storage Development LLC", email: "dev@medfordstorage.example", phone: "(631) 555-0190", location: "2890 Route 112, Medford, NY", service: "Phase I ESA", scope: "Phase I ESA on a 6-acre parcel proposed for self-storage. Adjacent parcel was a former nursery with pesticide storage; buyer wants that addressed in the report.", est: 3200, source: "Website", created: daysAgo(25) },
  { contact: "South Shore Marina", email: "harbor@southshoremarina.example", phone: "(631) 555-0181", location: "55 Ocean Avenue, Patchogue, NY", service: "Tank Cleaning", scope: "Cleaning and inspection prep for a 6,000-gallon diesel AST feeding the fuel dock. Heavy sludge reported at last filter change.", est: 7400, source: "Email", created: daysAgo(21) },
  { contact: "Smithtown Plaza LP", email: "leasing@smithtownplaza.example", phone: "(631) 555-0133", location: "115 Main Street, Smithtown, NY", service: "Vapor Intrusion Assessment & Mitigation", scope: "Vapor intrusion screening for a plaza unit formerly occupied by a dry cleaner. Tenant's lender flagged historic PERC use; sub-slab sampling requested.", est: 9600, source: "Email", created: daysAgo(18) },
  { contact: "Islip Industrial Holdings", email: "pm@islipindustrial.example", phone: "(631) 555-0177", location: "200 Orinoco Drive, Islip, NY", service: "Groundwater Investigations & Studies", scope: "Quarterly groundwater sampling event at four existing monitoring wells, low-flow method, with lab analysis and a summary letter report.", est: 1450, source: "Email", created: daysAgo(14) },
];
const backlogIds = [];
for (const b of backlog) { const id = await makeLead(sheh, b); if (id) backlogIds.push(id); }
if (backlogIds[11]) await move(sheh, backlogIds[11], "TRIAGED");
note(backlogIds.length === backlog.length, `backlog ${backlogIds.length}/${backlog.length}`);

// ---------- 9. Fresh + active pipeline ----------
const spill = await makeLead(dan, { contact: "Great South Bay Insurance — Claims", email: "claims@gsbins.example", phone: "(631) 555-0101", location: "18 Captree Lane, Sayville, NY", service: "Emergency Spill Response", scope: "Heating-oil delivery overfill at a residence: approximately 120 gallons to soil and a floor drain. Adjuster authorizing emergency response and excavation assessment today.", est: 9500, source: "Phone", created: daysAgo(0, 2) });
const phase2new = await makeLead(sheh, { contact: "Deer Park Industrial LLC", email: "asset@deerparkind.example", phone: "(631) 555-0121", location: "88 Industry Court, Deer Park, NY", service: "Phase II ESA", scope: "Follow-on Phase II from our Phase I: recognized conditions around a former degreasing pit. Client wants borings and groundwater sampling scoped this week.", est: 24500, source: "Email", created: daysAgo(1) });
const schoolAsbestos = await makeLead(dan, { contact: "Westbrook UFSD — Facilities", email: "facilities@westbrookufsd.example", phone: "(631) 555-0166", location: "100 School Street, Westbrook, NY", service: "Asbestos Surveys", scope: "Pre-demolition asbestos surveys of three school buildings under the district's capital program. Government contract; prevailing wage applies.", est: 6800, source: "Email", created: daysAgo(3), sector: "government" });
if (schoolAsbestos) await move(dan, schoolAsbestos, "TRIAGED");
const fleetTest = await makeLead(sheh, { contact: "Empire Freight Lines", email: "shop@empirefreight.example", phone: "(631) 555-0148", location: "47 Peconic Avenue, Yaphank, NY", service: "Tank Testing", scope: "Tightness testing on three diesel USTs at the fleet yard, plus line leak detector checks. Results needed before their DEC inspection next month.", est: 3450, source: "Phone", created: daysAgo(4) });
const titlePhase1 = await makeLead(sheh, { contact: "Huntington Title Services", email: "orders@huntingtontitle.example", phone: "(631) 555-0113", location: "312 New York Avenue, Huntington, NY", service: "Phase I ESA", scope: "Phase I ESA for a commercial closing scheduled in five weeks. Rush turnaround requested if the file review is clean.", est: 3200, source: "Referral", created: daysAgo(2) });
const pmMold = await makeLead(dan, { contact: "Atlantic Property Group", email: "workorders@atlanticprop.example", phone: "(516) 555-0159", location: "40-Unit Residential Complex, Mineola, NY", service: "Mold Testing", scope: "Mold investigation across six units with recurring complaints in a 40-unit complex. Management needs a building-wide testing plan, not unit-by-unit visits.", est: 2600, source: "Email", created: daysAgo(5) });
if (pmMold) await move(dan, pmMold, "TRIAGED");
const churchAsbestos = await makeLead(dan, { contact: "Babylon Community Church", email: "office@babylonchurch.example", phone: "(631) 555-0194", location: "210 Deer Park Avenue, Babylon, NY", service: "Asbestos Surveys", scope: "Asbestos survey of the fellowship hall and boiler room before a planned renovation. Pipe insulation and floor tile are the suspect materials.", est: 2900, source: "Website", created: daysAgo(6) });
if (churchAsbestos) { await move(dan, churchAsbestos, "TRIAGED"); await move(dan, churchAsbestos, "QUALIFYING"); }
const minorSpill = await makeLead(dan, { contact: "Lindenhurst Service Center", email: "owner@lindenhurstsvc.example", phone: "(631) 555-0107", location: "655 Sunrise Highway, Lindenhurst, NY", service: "Emergency Spill Response", scope: "Minor surface spill at a pump island (approx. 15 gallons gasoline), contained on concrete. Needs cleanup verification and closure documentation for their file.", est: 6400, source: "Phone", created: daysAgo(1) });

// In qualification / qualified
const ustDev = await makeLead(dan, { contact: "Liberty Builders Group", email: "projects@libertybuilders.example", phone: "(631) 555-0188", location: "1420 Sunrise Highway, Copiague, NY", service: "Tank Removals", scope: "Removal of three gasoline USTs (two 8,000-gal, one 6,000-gal) at a former service station being redeveloped as retail. Site visit completed; soil disposal estimate depends on characterization.", est: 96000, source: "Referral", created: daysAgo(12) });
if (ustDev) { await move(dan, ustDev, "TRIAGED"); await move(dan, ustDev, "QUALIFYING"); }
const bankPortfolio = await makeLead(sheh, { contact: "Island Community Bank — CRE Lending", email: "cre@islandbank.example", phone: "(631) 555-0130", location: "Four sites — Suffolk County, NY", service: "Phase I ESA", scope: "Portfolio of four Phase I ESAs for a refinancing package: two retail, one warehouse, one former auto body. Bank wants one combined delivery date.", est: 12800, source: "Email", created: daysAgo(9) });
if (bankPortfolio) { await move(sheh, bankPortfolio, "TRIAGED"); await move(sheh, bankPortfolio, "QUALIFYING"); }
const dealerClosure = await makeLead(dan, { contact: "Prestige Auto Group", email: "fixedops@prestigeauto.example", phone: "(631) 555-0171", location: "700 Middle Country Road, Selden, NY", service: "Spill Closure", scope: "Spill closure package for a 2023 hydraulic-lift release: compile sampling results, prepare the closure report, and shepherd it through NYSDEC Region 1 review.", est: 11400, source: "Email", created: daysAgo(11) });
if (dealerClosure) await qualify(dan, dealerClosure);
const wellsJob = await makeLead(dan, { contact: "Meridian Engineering Group", email: "projects@meridianeng.example", phone: "(631) 555-0155", location: "Former Dry Cleaner Site, Hicksville, NY", service: "Monitoring Well Installation & Maintenance", scope: "Install four 2-inch monitoring wells (to 45 ft) at a chlorinated-solvent site, develop them, and survey elevations. Consultant provides oversight geologist.", est: 15200, source: "Referral", created: daysAgo(8) });
if (wellsJob) await qualify(dan, wellsJob);
const holdJob = await makeLead(sheh, { contact: "Harbor Point Development", email: "dev@harborpoint.example", phone: "(631) 555-0125", location: "9 Harbor Road, Port Jefferson, NY", service: "Phase II ESA", scope: "Phase II investigation at a waterfront parcel. ON HOLD: waiting on the signed site access agreement from the current owner before drilling can be scheduled.", est: 18000, source: "Email", created: daysAgo(16) });
if (holdJob) { await move(sheh, holdJob, "TRIAGED"); await move(sheh, holdJob, "QUALIFYING"); await move(sheh, holdJob, "QUALIFIED"); }
if (holdJob) { const hp = await propose(sheh, holdJob, [["Phase II ESA — Subsurface Investigation", 1]]); if (hp) await move(sheh, holdJob, "ON_HOLD", { hold_reason: "Waiting on signed site access agreement from current owner" }); }

// ---------- 10. Gregory's Approval Inbox (2 waiting) ----------
const tankApproval = await makeLead(dan, { contact: "QuickStop Fuel & Mart — Central Islip", email: "ops@quickstopfuel.example", phone: "(631) 555-0119", location: "55 Lowell Avenue, Central Islip, NY", service: "Tank Removals", scope: "Remove two 10,000-gallon gasoline USTs, excavate and dispose of impacted soil (est. 90 tons), backfill and restore the pump island area. Includes closure sampling and the NYSDEC closure report.", est: 71400, source: "Phone", created: daysAgo(7) });
if (tankApproval) { await qualify(dan, tankApproval); const p = await propose(dan, tankApproval, [["UST Removal & Closure", 2], ["Contaminated Soil Excavation & Disposal", 40]]); if (p) await approveFlow(dan, tankApproval); }
const platingApproval = await makeLead(dan, { contact: "Copiague Plating Corp.", email: "owner@copiagueplating.example", phone: "(631) 555-0163", location: "31 Bethpage Road, Copiague, NY", service: "Phase II ESA", scope: "Phase II ESA at a former metal-plating facility: 10 soil borings, 3 temporary wells, metals and VOC analysis. Owner is preparing the property for sale and needs the report for the buyer's lender.", est: 24500, source: "Email", created: daysAgo(5) });
if (platingApproval) { await qualify(dan, platingApproval); const p = await propose(dan, platingApproval, [["Phase II ESA — Subsurface Investigation", 1]]); if (p) await approveFlow(dan, platingApproval); }
note(!!tankApproval && !!platingApproval, "approval inbox seeded");

// ---------- 11. Approved / sent proposals ----------
const schoolPackage = await makeLead(dan, { contact: "Westbrook UFSD — Facilities", email: "facilities@westbrookufsd.example", phone: "(631) 555-0166", location: "Westbrook UFSD — District Buildings, NY", service: "Asbestos Surveys", scope: "Combined asbestos and lead-based paint survey package for the district's summer capital program: two elementary schools and the bus garage.", est: 9200, source: "Email", created: daysAgo(10), sector: "government" });
if (schoolPackage) { await qualify(dan, schoolPackage); const p = await propose(dan, schoolPackage, [["Asbestos Survey", 2], ["Lead-Based Paint Survey", 2], ["Mold Testing & Inspection", 2]]); const a = await approveFlow(dan, schoolPackage); if (a) await decide(a, "approved"); }
const landlordSent = await makeLead(sheh, { contact: "Hauppauge Corporate Park LP", email: "mgmt@hauppaugecorp.example", phone: "(631) 555-0141", location: "1300 Veterans Memorial Highway, Hauppauge, NY", service: "Phase I ESA", scope: "Phase I ESA plus vapor intrusion assessment for a two-building office park acquisition. Buyer's lender requires both reports before commitment.", est: 12800, source: "Referral", created: daysAgo(13) });
if (landlordSent) { await qualify(sheh, landlordSent); const p = await propose(sheh, landlordSent, [["Phase I Environmental Site Assessment", 1], ["Vapor Intrusion Assessment", 1]]); const a = await approveFlow(sheh, landlordSent); if (a) { await decide(a, "approved"); if (p) await sendProposal(sheh, p, landlordSent); } }
const coldProposal = await makeLead(sheh, { contact: "Brentwood Manufacturing Inc.", email: "ehs@brentwoodmfg.example", phone: "(631) 555-0184", location: "250 Emjay Boulevard, Brentwood, NY", service: "Remedial Investigation", scope: "Remedial investigation of a historic solvent plume: delineation borings, three permanent wells, two sampling rounds, and an RI report suitable for NYSDEC submission.", est: 68000, source: "Email", created: daysAgo(21) });
if (coldProposal) { await qualify(sheh, coldProposal); const p = await propose(sheh, coldProposal, [["Remedial Investigation", 1]]); const a = await approveFlow(sheh, coldProposal); if (a) { await decide(a, "approved"); if (p) { await sendProposal(sheh, p, coldProposal); await move(sheh, coldProposal, "IN_FOLLOW_UP"); } } }
const busFleet = await makeLead(sheh, { contact: "Suffolk Student Transport Corp.", email: "ops@suffolkstudent.example", phone: "(631) 555-0116", location: "Depots in Bay Shore & Ronkonkoma, NY", service: "Petroleum Bulk Storage Compliance Inspections", scope: "Annual PBS and CBS compliance inspections across two bus depots: AST inspections, containment checks, registration renewals, and a corrective-action list.", est: 5400, source: "Phone", created: daysAgo(6) });
if (busFleet) { await qualify(sheh, busFleet); const p = await propose(sheh, busFleet, [["PBS/CBS Compliance Inspection", 3]]); const a = await approveFlow(sheh, busFleet); if (a) { await decide(a, "approved"); if (p) await sendProposal(sheh, p, busFleet); } }

// ---------- 12. Won / active jobs (full flow incl. real e-sign) ----------
async function winJob(spec, items, signer) {
  const id = await makeLead(dan, spec);
  if (!id) return null;
  await qualify(dan, id);
  const p = await propose(dan, id, items);
  const a = await approveFlow(dan, id);
  if (a) await decide(a, "approved");
  if (p) { await sendProposal(dan, p, id); const signed = await signProposal(dan, p, signer); if (!signed) note(false, `sign ${spec.contact}`); }
  return id;
}
const jobSchool = await winJob({ contact: "Westbrook UFSD — Facilities", email: "facilities@westbrookufsd.example", phone: "(631) 555-0166", location: "Westbrook High School, 100 School Street, NY", service: "Phase II ESA", scope: "Phase II ESA at the high school bus loop parcel: 8 borings, 2 monitoring wells, soil and groundwater analysis for the district's expansion project. Government contract — prevailing wage, certified payroll applies.", est: 24500, source: "Email", created: daysAgo(19), sector: "government" }, [["Phase II ESA — Subsurface Investigation", 1]], "Westbrook UFSD — Facilities");
const jobTank = await winJob({ contact: "Liberty Builders Group", email: "projects@libertybuilders.example", phone: "(631) 555-0188", location: "1420 Sunrise Highway, Copiague, NY", service: "Tank Removals", scope: "Removal of one 8,000-gallon UST plus 25 tons of impacted soil at the redevelopment parcel (phase 1 of the station closure). Closure sampling and disposal documentation included.", est: 38500, source: "Referral", created: daysAgo(15) }, [["UST Removal & Closure", 1], ["Contaminated Soil Excavation & Disposal", 35]], "Liberty Builders Group");
const jobSpill = await winJob({ contact: "South Shore Marina", email: "harbor@southshoremarina.example", phone: "(631) 555-0181", location: "55 Ocean Avenue, Patchogue, NY", service: "Emergency Spill Response", scope: "Diesel spill at the fuel dock (approx. 275 gallons, NYSDEC spill case opened): boom and absorbent deployment, recovery of free product, excavation of impacted shoreline soil, and disposal. Case documentation for DEC.", est: 16800, source: "Phone", created: daysAgo(9) }, [["Emergency Spill Response Callout", 1], ["Spill Cleanup Crew", 60], ["Contaminated Soil Excavation & Disposal", 28]], "South Shore Marina");
const jobWater = await winJob({ contact: "Suffolk Water District — Engineering", email: "engineering@suffolkwater.example", phone: "(631) 555-0152", location: "Wellfield Site, Kings Park, NY", service: "Groundwater Investigations & Studies", scope: "Groundwater investigation around a municipal wellfield: install and sample three monitoring wells, two quarterly rounds, and a findings report for the district engineer. Government contract.", est: 31200, source: "Referral", created: daysAgo(24), sector: "government" }, [["Monitoring Well Installation", 3], ["Groundwater Sampling Event", 2], ["Geoprobe Drilling", 4]], "Suffolk Water District — Engineering");
const jobMold = await winJob({ contact: "Mercy General Hospital — Facilities", email: "facilities@mercygen.example", phone: "(631) 555-0197", location: "Mercy General Hospital, Bay Shore, NY", service: "Mold Testing", scope: "Post-remediation verification testing in two patient-wing rooms after a pipe leak: air sampling, surface sampling, and clearance letters for infection control.", est: 4350, source: "Phone", created: daysAgo(4) }, [["Mold Testing & Inspection", 3], ["Asbestos Survey", 1]], "Mercy General Hospital — Facilities");
note(!!jobSchool && !!jobTank && !!jobSpill && !!jobWater && !!jobMold, "won jobs");

// ---------- 13. Lost / closed ----------
const lostPrice = await makeLead(sheh, { contact: "First Island Mortgage — Vendor Desk", email: "vendors@firstisland.example", phone: "(516) 555-0111", location: "Retail Parcel, Garden City, NY", service: "Phase I ESA", scope: "Phase I ESA for a purchase loan. Vendor desk was collecting three quotes.", est: 3200, source: "Email", created: daysAgo(26) });
if (lostPrice) { await qualify(sheh, lostPrice); const p = await propose(sheh, lostPrice, [["Phase I Environmental Site Assessment", 1]]); const a = await approveFlow(sheh, lostPrice); if (a) { await decide(a, "approved"); if (p) { await sendProposal(sheh, p, lostPrice); await move(sheh, lostPrice, "LOST", { lost_reason: "PRICE", outcome_reason_detail: "Chose a $2,400 quote from a national vendor; turnaround was equal, price decided it." }); } } }
const lostCompetitor = await makeLead(sheh, { contact: "Empire Freight Lines", email: "shop@empirefreight.example", phone: "(631) 555-0148", location: "47 Peconic Avenue, Yaphank, NY", service: "Tank Testing", scope: "Annual tank testing contract for the fleet yard (previous year).", est: 3450, source: "Phone", created: daysAgo(45) });
if (lostCompetitor) { await qualify(sheh, lostCompetitor); const p = await propose(sheh, lostCompetitor, [["Tank Tightness Testing", 3]]); const a = await approveFlow(sheh, lostCompetitor); if (a) { await decide(a, "approved"); if (p) { await sendProposal(sheh, p, lostCompetitor); await move(sheh, lostCompetitor, "IN_FOLLOW_UP"); await move(sheh, lostCompetitor, "LOST", { lost_reason: "COMPETITOR", competitor: "Their incumbent testing vendor", outcome_reason_detail: "Stayed with incumbent vendor on a multi-year bundle." }); } } }
const ghosted = await makeLead(sheh, { contact: "Residential — Oil Tank Quote", email: "homeowner@private.example", phone: "(631) 555-0100", location: "Residence, Islip Terrace, NY", service: "Tank Testing", scope: "Homeowner requested a tightness test quote for a 275-gallon AST before a home sale. Never responded after the quote and two follow-ups.", est: 950, source: "Website", created: daysAgo(38) });
if (ghosted) { await move(sheh, ghosted, "TRIAGED"); await move(sheh, ghosted, "QUALIFYING"); await move(sheh, ghosted, "NO_RESPONSE", { lost_reason: "NO_RESPONSE" }); }
const junkLead = await makeLead(sheh, { contact: "SEO Services Offer", email: "growth@seoboost.example", phone: "", location: "", service: "Mold Testing", scope: "Spam solicitation submitted through the contact form.", est: 0, source: "Website", created: daysAgo(3) });
if (junkLead) await move(sheh, junkLead, "JUNK");

// ---------- 14. Crew time on the won jobs (rates snapshot by sector) ----------
async function logTime(leadId, userId, entryDate, hours, noteText) { if (!leadId) return; const x = await greg.post(`/api/leads/${leadId}/time`, { user_id: userId, entry_date: entryDate, hours, note: noteText }); if (x.status !== 200) note(false, `time ${leadId}`, JSON.stringify(x.json).slice(0, 100)); }
const MON = dateOnly(1), TUE = dateOnly(0), LASTWED = dateOnly(6);
await logTime(jobSchool, danId, MON, 7.5, "Drilling oversight — borings B-1 through B-4, soil logging");
await logTime(jobSchool, danId, TUE, 8, "Well installation MW-1/MW-2, development");
await logTime(jobSchool, shehId, MON, 3, "Site coordination, district walkthrough, certified payroll setup");
await logTime(jobSpill, danId, MON, 8, "Boom deployment and free-product recovery at fuel dock");
await logTime(jobSpill, danId, TUE, 4, "Excavation of impacted shoreline soil, load-out");
await logTime(jobSpill, shehId, MON, 4, "DEC case documentation, disposal manifests");
await logTime(jobTank, danId, TUE, 5, "Tank grave excavation prep, utility markout verification");
await logTime(jobTank, shehId, TUE, 2, "Disposal facility coordination, trucking schedule");
await logTime(jobWater, danId, LASTWED, 6.5, "Geoprobe borings for well locations WP-1/WP-2");

// ---------- 15. This week's crew schedule (incl. one double-booking) ----------
async function sched(leadId, userId, inDays) { if (!leadId) return; const d = new Date(Date.now() + inDays * DAY).toISOString().slice(0, 10); const x = await greg.post("/api/schedule", { lead_id: leadId, user_id: userId, work_date: d }); if (x.status !== 200 && x.status !== 201) note(false, `schedule ${leadId}`, JSON.stringify(x.json).slice(0, 90)); }
await sched(jobSchool, danId, -1); await sched(jobSchool, danId, 0);
await sched(jobSpill, danId, 0); // Daniel double-booked Tuesday: school wells + spill load-out
await sched(jobTank, danId, 1); await sched(jobTank, shehId, 2);
await sched(jobSpill, shehId, 3); await sched(jobWater, danId, 4);

// ---------- 16. Field reports: yesterday filed, Friday missing+chased ----------
const fri = dateOnly(4), mon = dateOnly(1);
let fr = await greg.get(`/api/field-reports?date=${mon}`);
let rows = Array.isArray(fr.json) ? fr.json : fr.json.rows || [];
const danRowMon = rows.find(x => x.manager_id === danId || x.user_id === danId);
if (danRowMon && jobSpill) await greg.post(`/api/field-reports/${danRowMon.id}/submit`, { notes: "Fuel dock spill: boom holding, ~180 gal free product recovered to date. Excavated 14 tons impacted soil for disposal. DEC case officer updated by phone. Crew back tomorrow for load-out.", lead_id: jobSpill });
fr = await greg.get(`/api/field-reports?date=${fri}`);
rows = Array.isArray(fr.json) ? fr.json : fr.json.rows || [];
const danRowFri = rows.find(x => x.manager_id === danId || x.user_id === danId);
if (danRowFri) await greg.post(`/api/field-reports/${danRowFri.id}/chase`, {});
note(!!danRowMon, "field reports");

// ---------- 17. Timesheets: Daniel current week partial; last week missing; Shehreyar last week in ----------
const thisWeek = new Date(Date.now() - 1 * DAY).toISOString().slice(0, 10); // Monday of this week (today is Tue)
const lastWeek = new Date(Date.now() - 8 * DAY).toISOString().slice(0, 10);
await greg.get(`/api/timesheets?week=${thisWeek}`); await greg.get(`/api/timesheets?week=${lastWeek}`);
await dan.post("/api/timesheets", { manager_id: danId, week_of: thisWeek, days: { mon: 8, tue: 8 }, notes: "School Phase II drilling + spill load-out." });
await sheh.post("/api/timesheets", { manager_id: shehId, week_of: lastWeek, days: { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8 }, notes: "Proposals, scheduling, client follow-up." });
const ts = await greg.get(`/api/timesheets?week=${lastWeek}`);
const tsRows = Array.isArray(ts.json) ? ts.json : ts.json.rows || ts.json.timesheets || [];
const danLast = tsRows.find(x => x.manager_id === danId);
if (danLast && danLast.status !== "submitted") await greg.post(`/api/timesheets/${danLast.id}/chase`, {});

// ---------- 18. Inbox: a realistic G.C. morning ----------
const emails = [
  { from: "facilities@westbrookufsd.example", from_name: "Westbrook UFSD — Facilities", subject: "Phase II schedule — drilling days next week?", body: "Hi Daniel, the board approved the expansion timeline last night. Can your crew be on site Tuesday and Wednesday next week for the remaining borings? The high school lot is clear after 3pm both days. Please confirm so I can notify security.", date: daysAgo(0, 3) },
  { from: "harbor@southshoremarina.example", from_name: "South Shore Marina", subject: "Re: Fuel dock spill — when is the crew back?", body: "Morning — the boom looks good this morning and there's no sheen outside it. When is the crew back to finish the load-out? Our fuel dock is closed until DEC clears us and every day costs us. Thanks for the fast response yesterday.", date: daysAgo(0, 4) },
  { from: "projects@libertybuilders.example", from_name: "Liberty Builders Group", subject: "Tank removal scope — can we add the second tank now?", body: "Gregory, after seeing the excavation open we'd like to add the second 6,000-gallon tank to this phase instead of remobilizing later. Can you send a revised proposal with the added tank and soil tonnage? Our lender needs it by Friday.", date: daysAgo(0, 5) },
  { from: "cre@islandbank.example", from_name: "Island Community Bank — CRE Lending", subject: "Proposal validity — four Phase I portfolio", body: "Hello, our credit committee meets Thursday. Can you confirm the portfolio pricing on the four Phase I reports still holds, and that delivery can be three weeks from engagement? A one-line confirmation is fine.", date: daysAgo(1, 2) },
  { from: "ap@drillsub.example", from_name: "DrillSub Contractors — AP", subject: "Invoice 2214 — Geoprobe rig, October days", body: "Attached is invoice 2214 for the October Geoprobe days (rig + operator, 3 days). Net 30 as usual. Please confirm receipt and let us know if you need the daily logs again.", date: daysAgo(1, 6) },
  { from: "certs@islandinsurance.example", from_name: "Island Insurance Brokers", subject: "Certificate of insurance request — Suffolk Water District job", body: "The water district's contract requires a certificate of insurance naming them as additional insured, with the $5M umbrella shown. Please send an updated COI before mobilization. Their procurement office is holding the PO until it arrives.", date: daysAgo(1, 1) },
  { from: "fixedops@prestigeauto.example", from_name: "Prestige Auto Group", subject: "Need our W-9 and last invoice copy for the file", body: "Hi, our accounting team is closing the books on the Selden store. Can you resend your W-9 and a copy of the last invoice for the spill closure work? Also — any word from DEC on the closure report timeline?", date: daysAgo(2, 3) },
  { from: "ehs@brentwoodmfg.example", from_name: "Brentwood Manufacturing — EHS", subject: "Re: Remedial investigation proposal — board review timing", body: "Following up on the RI proposal. It goes to our facilities board the last week of the month. No changes requested on scope; this is timing only. I'll confirm the date once the agenda is set.", date: daysAgo(2, 7) },
  { from: "dispatch@riverheadfuel.example", from_name: "Riverhead Fuel Oil Co.", subject: "PBS inspection — adding our second yard", body: "We'd like to add our second yard (Calverton) to this year's PBS inspection if the crew is already out our way. Same setup as the main plant, two ASTs and a loading rack. What would the add-on cost?", date: daysAgo(2, 2) },
  { from: "office@babylonchurch.example", from_name: "Babylon Community Church", subject: "Asbestos survey — access on Saturday?", body: "Our trustees can open the building Saturday morning for the survey if that works for your inspector. The boiler room key is with our sexton. Please let us know what time to expect him.", date: daysAgo(3, 4) },
  { from: "training@osharenewals.example", from_name: "OSHA Training Renewals", subject: "HAZWOPER 8-hour refresher — two seats expire in December", body: "Reminder: HAZWOPER refresher certifications for two of your field staff expire in December. Open-enrollment sessions run in Hauppauge on Dec 3 and Dec 10. Reply to reserve seats.", date: daysAgo(3, 8) },
  { from: "owner@lindenhurstsvc.example", from_name: "Lindenhurst Service Center", subject: "Re: Pump island cleanup — DEC paperwork", body: "Thanks for the quick cleanup. Our insurer is asking for the closure documentation and the disposal receipts for the file. Can you send the packet when it's ready?", date: daysAgo(3, 1) },
  { from: "newlead@smithtownmedical.example", from_name: "Smithtown Medical Offices", subject: "Quote request — mold testing after roof leak", body: "We manage a medical office building in Smithtown and had a roof leak over the weekend. Two exam rooms have visible growth on ceiling tiles. Can someone test this week? Patients are scheduled in those rooms starting Monday.", date: daysAgo(0, 1) },
  { from: "growth@seoboost.example", from_name: "SEO Boost", subject: "We can rank gcenvironmental.com #1 in 30 days", body: "Guaranteed first-page rankings for your environmental company. Reply YES for a free audit and our price list.", date: daysAgo(4, 5) },
];
const ing = await sheh.post("/api/inbox/ingest", { emails });
note(ing.status === 200 && (ing.json.ingested ?? 0) >= 12, `inbox ingested ${ing.json.ingested ?? "?"}`);

// ---------- 19. Verify + summary ----------
const dash = await greg.get("/api/dashboard");
const leadsAll = await greg.get("/api/leads?limit=100");
const approvals = await greg.get("/api/approvals");
const report = await greg.get("/api/status-report");
const byState = {};
for (const l of (leadsAll.json.leads || [])) byState[l.state] = (byState[l.state] || 0) + 1;
console.log("\n=== GC PILOT SEED SUMMARY ===");
console.log("leads total:", leadsAll.json.total ?? (leadsAll.json.leads || []).length, "| by state:", JSON.stringify(byState));
console.log("approvals waiting on Gregory:", Array.isArray(approvals.json) ? approvals.json.length : "?");
console.log("checks ok:", okCount, "| failures:", fail.length);
if (fail.length) console.log("FAILURES:\n - " + fail.join("\n - "));
console.log("login: gregory@gcenvironmental.com / GcEnv2026!temp at", BASE + "/app");

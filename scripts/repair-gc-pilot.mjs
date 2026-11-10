// Repair pass for the GC pilot seed: completes sign->WON, relabels dedupe-merged leads,
// fixes the QuickStop approval lead, junks inbox strays, recreates the merged-away stories
// with unique contacts. Idempotent-ish: safe to re-run (checks state before acting).
const BASE = process.argv[2] || "https://workpile.claimpaid.io";
const DAY = 86400000;
const daysAgo = (n, h = 10) => new Date(Date.now() - n * DAY + h * 3600000).toISOString();
const fail = []; let ok = 0;
function note(g, label, extra = "") { if (g) ok++; else { fail.push(label + " " + extra); console.log("  ✗", label, extra); } }
class Client {
  constructor() { this.cookie = ""; }
  async req(method, path, body) {
    const headers = { Cookie: this.cookie };
    let payload;
    if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const r = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
    const sc = r.headers.get("set-cookie");
    if (sc && sc.includes("lf_session=")) this.cookie = sc.split(";")[0];
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
    return { status: r.status, json: j };
  }
  get(p) { return this.req("GET", p); } post(p, b) { return this.req("POST", p, b); } patch(p, b) { return this.req("PATCH", p, b); }
}
const greg = new Client(), sheh = new Client(), dan = new Client();
await greg.post("/api/auth/login", { email: "gregory@gcenvironmental.com", password: "GcEnv2026!temp" });
await sheh.post("/api/auth/login", { email: "shehreyar@gcenvironmental.com", password: "GcOps2026!temp" });
await dan.post("/api/auth/login", { email: "daniel@gcenvironmental.com", password: "GcField2026!temp" });
const danId = (await dan.get("/api/auth/me")).json.user?.id, gregId = (await greg.get("/api/auth/me")).json.user?.id;
const pbList = (await greg.get("/api/price-book")).json;
const pb = {}; for (const it of (Array.isArray(pbList) ? pbList : [])) pb[it.name] = it.id;

async function leadDetail(id) { const x = await greg.get(`/api/leads/${id}`); return x.json; }
async function move(c, id, to, extra = {}) { const d = await leadDetail(id); if (d.lead?.state === to) return true; const x = await c.post(`/api/leads/${id}/transition`, { to_state: to, ...extra }); if (x.status !== 200) note(false, `move ${id}->${to}`, JSON.stringify(x.json).slice(0, 120)); return x.status === 200; }

// 1) Complete the wins: signed proposal on file -> WON
const WINNERS = ["lead_ZIArFsPxcc7y", "lead_qxURbDEL_-JP", "lead_FG7-57jI18oN", "lead_xbOTPTSvM73c", "lead_x2FR60al17dD"];
for (const id of WINNERS) {
  const d = await leadDetail(id);
  const signed = (d.proposals || []).some(p => p.status === "signed");
  note(signed, `signed proposal on ${id}`);
  if (signed) await move(greg, id, "WON");
}
// 2) Relabel merged leads to the story their proposals/time actually tell
await greg.patch("/api/leads/lead_ZIArFsPxcc7y", { service_requested: "Phase II ESA", est_value: 24500, notes: "Phase II ESA at the high school bus loop parcel: 8 borings, 2 monitoring wells, soil and groundwater analysis for the district's expansion project. Government contract — prevailing wage, certified payroll applies." });
await greg.patch("/api/leads/lead_FG7-57jI18oN", { service_requested: "Emergency Spill Response", est_value: 16800, notes: "Diesel spill at the fuel dock (approx. 275 gallons, NYSDEC spill case opened): boom and absorbent deployment, recovery of free product, excavation of impacted shoreline soil, and disposal. Case documentation for DEC." });
await greg.patch("/api/leads/lead_qxURbDEL_-JP", { est_value: 38475, notes: "Removal of one 8,000-gallon UST plus impacted soil at the redevelopment parcel (phase 1 of the station closure). Closure sampling and disposal documentation included." });
await greg.patch("/api/leads/lead_lcg0qFL8lEot", { service_requested: "Monitoring Well Installation & Maintenance", est_value: 15200, notes: "Install four 2-inch monitoring wells (to 45 ft) at a chlorinated-solvent site, develop them, and survey elevations. Consultant provides oversight geologist." });
await greg.patch("/api/leads/lead_ps90dIuBnlbG", { service_requested: "Mold Testing" });
note(true, "relabels applied");

// 3) QuickStop: reject the mismatched approval, relabel to Central Islip, resubmit
const approvals = (await greg.get("/api/approvals")).json;
const qsApproval = (Array.isArray(approvals) ? approvals : []).find(a => a.lead_id === "lead_zLzYmmr37VSU");
if (qsApproval) { const x = await greg.post(`/api/approvals/${qsApproval.id}/decide`, { decision: "rejected", reason_code: "SCOPE_CORRECTION" }); note(x.status === 200, "quickstop approval reset", JSON.stringify(x.json).slice(0, 90)); }
await greg.patch("/api/leads/lead_zLzYmmr37VSU", { contact: { name: "QuickStop Fuel & Mart — Central Islip" }, location: "55 Lowell Avenue, Central Islip, NY", service_requested: "Tank Removals", est_value: 71400, notes: "Remove two 10,000-gallon gasoline USTs, excavate and dispose of impacted soil (est. 90 tons), backfill and restore the pump island area. Includes closure sampling and the NYSDEC closure report." });
await move(dan, "lead_zLzYmmr37VSU", "READY_FOR_APPROVAL");

// 4) Junk the inbox strays
await move(sheh, "lead_9dAD-kAwJYXh", "JUNK");
await move(sheh, "lead_0s9AScIpWlxT", "JUNK");

// 5) Recreate the merged-away stories with unique contacts
async function makeLead(c, spec) {
  const x = await c.post("/api/leads", { contact: { name: spec.contact, phone: spec.phone, email: spec.email }, location: spec.location, service_requested: spec.service, message: spec.scope, est_value: spec.est, source: spec.source || "Email", created_at: spec.created, owner_id: danId, pm_id: danId, approver_id: gregId, consent: { contact_ok: true } });
  if (!x.json.lead?.id || x.json.duplicate) { note(false, `recreate ${spec.contact}`, JSON.stringify(x.json).slice(0, 110)); return null; }
  if (spec.sector) await c.patch(`/api/leads/${x.json.lead.id}`, { sector: spec.sector });
  return x.json.lead.id;
}
async function qualify(c, id) { const d = await leadDetail(id); const order = ["NEW", "TRIAGED", "QUALIFYING", "QUALIFIED"]; let i = order.indexOf(d.lead.state); for (let k = i + 1; k < order.length; k++) await move(c, id, order[k]); }
async function propose(c, id, items) { const x = await c.post(`/api/leads/${id}/proposals`, { line_items: items.map(([k, q]) => ({ price_book_item_id: pb[k], qty: q })) }); if (x.status !== 201) { note(false, `proposal ${id}`, JSON.stringify(x.json).slice(0, 110)); return null; } return x.json.id; }
async function approveFlow(c, id) { await move(c, id, "READY_FOR_APPROVAL"); const list = (await greg.get("/api/approvals")).json; return (Array.isArray(list) ? list : []).find(a => a.lead_id === id && !a.decision)?.id; }

const brentwood = await makeLead(sheh, { contact: "QuickStop Fuel & Mart — Brentwood", email: "brentwood@quickstopfuel.example", phone: "(631) 555-0118", location: "2110 Brentwood Road, Brentwood, NY", service: "Tank Testing", scope: "Annual tightness testing on two 10,000-gallon gasoline USTs. PBS registration renewal due this quarter; test results needed for the file.", est: 2300, source: "Phone", created: daysAgo(69) });
const wbAsbestos = await makeLead(dan, { contact: "Dana Whitaker — Westbrook UFSD Facilities Office", email: "dwhitaker@westbrookufsd.example", phone: "(631) 555-0167", location: "100 School Street, Westbrook, NY", service: "Asbestos Surveys", scope: "Pre-demolition asbestos surveys of three school buildings under the district's capital program. Government contract; prevailing wage applies.", est: 6800, created: daysAgo(3), sector: "government" });
if (wbAsbestos) await move(dan, wbAsbestos, "TRIAGED");
const wbPackage = await makeLead(dan, { contact: "Karen Doyle — Westbrook UFSD Business Office", email: "kdoyle@westbrookufsd.example", phone: "(631) 555-0168", location: "Westbrook UFSD — District Buildings, NY", service: "Asbestos Surveys", scope: "Combined asbestos and lead-based paint survey package for the district's summer capital program: two elementary schools and the bus garage.", est: 9700, created: daysAgo(10), sector: "government" });
if (wbPackage) { await qualify(dan, wbPackage); await propose(dan, wbPackage, [["Asbestos Survey", 2], ["Lead-Based Paint Survey", 2], ["Mold Testing & Inspection", 2]]); const a = await approveFlow(dan, wbPackage); if (a) { const x = await greg.post(`/api/approvals/${a}/decide`, { decision: "approved" }); if (x.status === 200) await move(dan, wbPackage, "PROPOSAL_DRAFTED"); } }
const meridianGeo = await makeLead(sheh, { contact: "Meridian Engineering — Field Operations", email: "fieldops@meridianeng.example", phone: "(631) 555-0156", location: "1200 Veterans Highway, Ronkonkoma, NY", service: "Geoprobe Drilling", scope: "Two days of Geoprobe drilling support (8 borings) for a consultant's delineation program. They supply the geologist; we supply rig, operator, and tooling.", est: 8400, created: daysAgo(32) });
const empireFresh = await makeLead(sheh, { contact: "Empire Freight Lines — Fleet Office", email: "fleet@empirefreight.example", phone: "(631) 555-0149", location: "47 Peconic Avenue, Yaphank, NY", service: "Tank Testing", scope: "Tightness testing on three diesel USTs at the fleet yard, plus line leak detector checks. Results needed before their DEC inspection next month.", est: 3450, source: "Phone", created: daysAgo(4) });
note(!!brentwood && !!wbAsbestos && !!wbPackage && !!meridianGeo && !!empireFresh, "recreated stories");

// 6) Census
const leads = (await greg.get("/api/leads?limit=100")).json;
const byState = {}; for (const l of (Array.isArray(leads) ? leads : [])) byState[l.state] = (byState[l.state] || 0) + 1;
const appr2 = (await greg.get("/api/approvals")).json;
const rep = (await greg.get("/api/status-report")).json;
console.log("\n=== REPAIR SUMMARY ===");
console.log("leads:", Array.isArray(leads) ? leads.length : "?", "| by state:", JSON.stringify(byState));
console.log("approvals waiting:", Array.isArray(appr2) ? appr2.length : "?");
console.log("status report won:", rep?.won ?? rep?.outcomes?.won ?? "(see UI)");
console.log("ok:", ok, "| failures:", fail.length, fail.length ? "\n - " + fail.join("\n - ") : "");

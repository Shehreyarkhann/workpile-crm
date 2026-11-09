// LeadFlow OS — API application (spec §5 state machine, §6 approvals, §9 proposals, §14 public API, §14.5 handoffs, §25 Gregory P0s)
import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, uid, now, hashPassword, verifyPassword, apiKeyHash, logEvent, audit } from "./db.ts";
import { triageLead, packetCheck, demandGap, injectionScan } from "./agents.ts";
import { metrics, morningBrief } from "./metrics.ts";
import { parseEmail } from "./inbox.ts";
import { proposalDocx } from "./docx.ts";
import { ensureSignToken, getByToken, sign } from "./sign.ts";
import { createDeposit, markPaid, verifyStripeSignature, handleStripeEvent, stripeMode } from "./payments.ts";
import { getFlags, setFlag, workspaceHealth, runSynthetics } from "./admin.ts";
import { billingStatus, createCheckout, handleBillingEvent, PLANS } from "./billing.ts";
import { providerStatus, authUrl, listConnections } from "./oauth.ts";

export const app = express();
app.use((req: any, _res, next) => { // capture raw body for Stripe signature verification
  if (req.path === "/webhooks/stripe") { let raw = ""; req.on("data", (c: any) => raw += c); req.on("end", () => { req.rawBody = raw; try { req.body = JSON.parse(raw || "{}"); } catch { req.body = {}; } next(); }); }
  else next();
});
app.use(express.json({ limit: "5mb" }));

// ---------- state machine (§5.1) ----------
export const TRANSITIONS: Record<string, string[]> = {
  NEW: ["TRIAGED", "JUNK", "DUPLICATE", "UNSERVICEABLE"],
  TRIAGED: ["QUALIFYING", "JUNK", "DUPLICATE", "UNSERVICEABLE"],
  QUALIFYING: ["QUALIFIED", "UNSERVICEABLE", "JUNK", "DUPLICATE", "NO_RESPONSE"],
  QUALIFIED: ["READY_FOR_APPROVAL", "ON_HOLD"],
  READY_FOR_APPROVAL: ["APPROVED", "QUALIFIED", "ON_HOLD"],
  APPROVED: ["PROPOSAL_DRAFTED"],
  PROPOSAL_DRAFTED: ["PROPOSAL_SENT"],
  PROPOSAL_SENT: ["IN_FOLLOW_UP", "WON", "LOST"],
  IN_FOLLOW_UP: ["WON", "LOST", "NO_RESPONSE"],
  ON_HOLD: ["QUALIFYING", "QUALIFIED", "READY_FOR_APPROVAL"],
  WON: [], LOST: [], NO_RESPONSE: ["QUALIFYING"], UNSERVICEABLE: [], JUNK: ["NEW"], DUPLICATE: [],
};
export const FINAL_STATES = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
const OUTCOME_OF: Record<string, string> = { WON: "won", LOST: "lost", NO_RESPONSE: "no_response", UNSERVICEABLE: "na_unserviceable", JUNK: "junk", DUPLICATE: "duplicate" };

function dedupeKey(phone?: string, email?: string) { return (phone || "").replace(/\D/g, "") || (email || "").toLowerCase().trim() || ""; }
function leadView(l: any) {
  if (!l) return null;
  const c = db.prepare("SELECT name,phone,email FROM contacts WHERE id=?").get(l.contact_id) as any;
  return { ...l, contact_name: c?.name || "", contact_phone: c?.phone || "", contact_email: c?.email || "", line_items: undefined };
}

function createLead(workspaceId: string, actor: string, input: any) {
  const key = dedupeKey(input.contact?.phone, input.contact?.email);
  if (key) {
    const dupe = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND dedupe_key=? AND state!='DUPLICATE'").get(workspaceId, key) as any;
    if (dupe) return { lead: leadView(dupe), duplicate: true };
  }
  const cid = uid("ct");
  db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email,address) VALUES (?,?,?,?,?,?)")
    .run(cid, workspaceId, input.contact?.name || "", input.contact?.phone || "", input.contact?.email || "", input.location?.address || input.location || "");
  let sid = input.source_id || null;
  if (!sid && input.source) {
    const s = db.prepare("SELECT id FROM sources WHERE workspace_id=? AND name=?").get(workspaceId, input.source) as any;
    sid = s?.id || (() => { const id = uid("src"); db.prepare("INSERT INTO sources (id,workspace_id,type,name) VALUES (?,?,?,?)").run(id, workspaceId, "api", input.source); return id; })();
  }
  const created = input.created_at || now();
  const triage = triageLead(workspaceId, null, { service_requested: input.service_requested, message: input.message, est_value: input.est_value, created_at: created });
  const id = uid("lead");
  const owners = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='LEAD_OWNER' AND active=1").all(workspaceId) as any[];
  const owner = input.owner_id || owners[0]?.id || null;
  db.prepare(`INSERT INTO leads (id,workspace_id,contact_id,source_id,external_id,dedupe_key,service_requested,state,urgency,value_band,est_value,owner_id,pm_id,approver_id,next_action,next_action_due_at,sla_due_at,notes,location,consent_contact_ok,consent_source,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, workspaceId, cid, sid, input.external_id || null, key, triage.service_guess, triage.spam_score > 0.5 ? "JUNK" : "NEW", triage.urgency, triage.value_band, input.est_value || 0, owner, input.pm_id || null, input.approver_id || null,
      "First contact", new Date(Date.now() + 4 * 3600000).toISOString(), new Date(Date.now() + 4 * 3600000).toISOString(), input.message || "", typeof input.location === "string" ? input.location : input.location?.address || "", input.consent?.contact_ok ? 1 : 0, input.consent ? (input.source || "form") : null, created, now());
  if (input.temperature_note) { /* reserved */ }
  logEvent(workspaceId, id, actor, "created", null, "NEW", { source: input.source || "manual", triage });
  if (owner) db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("tsk"), workspaceId, id, owner, "follow_up", "First contact", new Date(Date.now() + 4 * 3600000).toISOString(), now());
  return { lead: leadView(db.prepare("SELECT * FROM leads WHERE id=?").get(id)), duplicate: false };
}

function finalizeLead(workspaceId: string, actor: string, lead: any, toState: string) {
  // §14.5 — every final outcome creates a delivery record + outbox entry
  const outcome = OUTCOME_OF[toState];
  const payload = outcomePayload(lead);
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,created_at) VALUES (?,?,?,?,?,?)")
    .run(uid("dlv"), workspaceId, lead.id, outcome, hash, now());
  db.prepare("INSERT INTO outbox (id,workspace_id,kind,payload,idempotency_key,created_at) VALUES (?,?,?,?,?,?)")
    .run(uid("out"), workspaceId, "lead.finalized", JSON.stringify(payload), `final-${lead.id}-${toState}`, now());
  if (toState === "WON") {
    const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any;
    const pid = uid("prj");
    db.prepare("INSERT INTO projects (id,workspace_id,lead_id,proposal_id,pm_id,created_at) VALUES (?,?,?,?,?,?)").run(pid, workspaceId, lead.id, prop?.id || null, lead.pm_id, now());
    logEvent(workspaceId, lead.id, actor, "project_created", null, null, { project_id: pid });
  }
}

export function outcomePayload(lead: any) {
  const v = leadView(lead);
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any;
  const owner = lead.owner_id ? db.prepare("SELECT name,email FROM users WHERE id=?").get(lead.owner_id) : null;
  const pm = lead.pm_id ? db.prepare("SELECT name,email FROM users WHERE id=?").get(lead.pm_id) : null;
  return {
    outcome: OUTCOME_OF[lead.state] || lead.state.toLowerCase(), finalized_at: now(),
    lead: { id: lead.id, external_id: lead.external_id, state: lead.state },
    contact: { name: v.contact_name, phone: v.contact_phone, email: v.contact_email },
    service: { requested: lead.service_requested, location: lead.location },
    proposal: prop ? { id: prop.id, total: prop.total, status: prop.status, payment_status: prop.payment_status, line_items: JSON.parse(prop.line_items || "[]") } : null,
    people: { lead_owner: owner, project_manager: pm },
    outcome_reason_code: lead.lost_reason || null, outcome_reason_detail: lead.outcome_reason_detail || null, competitor: lead.competitor || null,
    suppress_future_outreach: ["UNSERVICEABLE", "JUNK"].includes(lead.state),
  };
}

function transition(workspaceId: string, actor: string, lead: any, toState: string, extra: any = {}) {
  const allowed = TRANSITIONS[lead.state] || [];
  if (!allowed.includes(toState)) return { error: `Invalid transition ${lead.state} → ${toState}. Allowed: ${allowed.join(", ") || "none"}`, status: 422 };
  if (toState === "READY_FOR_APPROVAL") {
    const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any;
    const check = packetCheck({ ...leadView(lead), pm_id: lead.pm_id }, prop);
    if (!check.complete) return { error: "Completeness Gate failed", missing: check.missing, status: 422 };
    const approver = lead.approver_id || (db.prepare("SELECT id FROM users WHERE workspace_id=? AND role IN ('OWNER','APPROVER') ORDER BY role LIMIT 1").get(workspaceId) as any)?.id;
    db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(uid("apr"), workspaceId, lead.id, prop?.id, actor, approver, (prop?.total || 0) > 25000 ? "ceo" : "manager", now());
  }
  if (toState === "QUALIFIED") extra.qualified_at = now();
  const sets = ["state=?", "updated_at=?", ...Object.keys(extra).map(k => `${k}=?`)];
  db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(toState, now(), ...Object.values(extra), lead.id);
  const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id) as any;
  logEvent(workspaceId, lead.id, actor, "state_changed", lead.state, toState, extra);
  if (FINAL_STATES.includes(toState)) finalizeLead(workspaceId, actor, updated, toState);
  return { lead: leadView(updated) };
}

// ---------- auth ----------
function requireAuth(req: any, res: any, next: any) {
  const sid = (req.headers.cookie || "").split(";").map((s: string) => s.trim()).find((s: string) => s.startsWith("lf_session="))?.split("=")[1]
    || (req.headers.authorization || "").replace("Bearer ", "");
  const sess = sid && db.prepare("SELECT * FROM sessions WHERE id=? AND expires_at>?").get(sid, now()) as any;
  if (!sess) return res.status(401).json({ error: { code: "unauthorized", message: "Sign in required" } });
  req.user = db.prepare("SELECT * FROM users WHERE id=?").get(sess.user_id);
  if (!req.user) return res.status(401).json({ error: { code: "unauthorized" } });
  next();
}
function requireApiKey(scopes: string[]) {
  return (req: any, res: any, next: any) => {
    const raw = (req.headers.authorization || "").replace("Bearer ", "");
    if (!raw) return res.status(401).json({ error: { code: "missing_api_key" } });
    const key = db.prepare("SELECT * FROM api_keys WHERE hashed_key=? AND revoked_at IS NULL").get(apiKeyHash(raw)) as any;
    if (!key) return res.status(401).json({ error: { code: "invalid_api_key" } });
    const have = (key.scopes || "").split(",");
    if (!scopes.every(s => have.includes(s))) return res.status(403).json({ error: { code: "insufficient_scope" } });
    db.prepare("UPDATE api_keys SET last_used_at=? WHERE id=?").run(now(), key.id);
    req.workspace_id = key.workspace_id; req.api_key = key; next();
  };
}

// ---------- routes: auth ----------
app.post("/api/auth/login", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=? AND active=1").get((req.body.email || "").toLowerCase()) as any;
  if (!u || !verifyPassword(req.body.password || "", u.password_hash)) return res.status(401).json({ error: { code: "bad_credentials" } });
  const sid = uid("ses") + randomBytes(16).toString("hex");
  db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, u.id, now(), new Date(Date.now() + 7 * 86400000).toISOString());
  res.setHeader("Set-Cookie", `lf_session=${sid}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, workspace_id: u.workspace_id, is_platform_admin: !!u.is_platform_admin }, session: sid });
});
app.get("/api/auth/me", requireAuth, (req: any, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, workspace_id: req.user.workspace_id, is_platform_admin: !!req.user.is_platform_admin } }));

// ---------- routes: workspace data ----------
app.get("/api/users", requireAuth, (req: any, res) => res.json(db.prepare("SELECT id,name,email,role,approval_limit FROM users WHERE workspace_id=?").all(req.user.workspace_id)));
app.get("/api/leads", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  let rows = db.prepare("SELECT * FROM leads WHERE workspace_id=? ORDER BY created_at DESC").all(ws) as any[];
  if (req.query.state) rows = rows.filter(l => l.state === req.query.state);
  if (req.query.q) { const q = String(req.query.q).toLowerCase(); rows = rows.filter(l => JSON.stringify(leadView(l)).toLowerCase().includes(q)); }
  res.json(rows.map(leadView));
});
app.post("/api/leads", requireAuth, (req: any, res) => { const r = createLead(req.user.workspace_id, req.user.id, req.body); res.status(r.duplicate ? 200 : 201).json(r); });
app.get("/api/leads/:id", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const events = db.prepare("SELECT * FROM lead_events WHERE lead_id=? ORDER BY created_at").all(l.id);
  const tasks = db.prepare("SELECT * FROM tasks WHERE lead_id=? ORDER BY due_at").all(l.id);
  const proposals = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").all(l.id);
  const docs = db.prepare("SELECT * FROM documents WHERE lead_id=?").all(l.id);
  const visits = db.prepare("SELECT * FROM site_visits WHERE lead_id=?").all(l.id);
  res.json({ lead: leadView(l), events, tasks, proposals, documents: docs, site_visits: visits });
});
app.post("/api/leads/:id/transition", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const extra: any = {};
  for (const k of ["lost_reason", "outcome_reason_detail", "competitor", "hold_reason", "pm_id", "owner_id", "approver_id"]) if (req.body[k] !== undefined) extra[k] = req.body[k];
  const r: any = transition(req.user.workspace_id, req.user.id, l, req.body.to_state, extra);
  if (r.error) return res.status(r.status || 400).json({ error: { code: "transition_failed", message: r.error }, missing: r.missing });
  audit(req.user.workspace_id, req.user.id, "lead.transition", "lead", l.id, { to: req.body.to_state });
  res.json(r);
});
app.post("/api/leads/:id/contact", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id) as any;
  if (!l.first_response_at) db.prepare("UPDATE leads SET first_response_at=? WHERE id=?").run(now(), l.id);
  db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,outcome,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("act"), l.id, req.user.workspace_id, req.user.id, req.body.type || "call", req.body.body || "", req.body.outcome || "", now());
  if (req.body.next_action_due_at) db.prepare("UPDATE leads SET next_action=?, next_action_due_at=? WHERE id=?").run(req.body.next_action || "Follow up", req.body.next_action_due_at, l.id);
  res.json({ ok: true });
});
app.post("/api/leads/:id/packet-check", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id) as any;
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(l.id) as any;
  res.json(packetCheck({ ...leadView(l), pm_id: l.pm_id }, prop));
});

// proposals
app.get("/api/price-book", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM price_book_items WHERE workspace_id=?").all(req.user.workspace_id)));
app.get("/api/templates", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM templates WHERE workspace_id=?").all(req.user.workspace_id)));
app.post("/api/leads/:id/proposals", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const items = req.body.line_items || [];
  let total = 0, below = false;
  for (const it of items) {
    const pb = db.prepare("SELECT * FROM price_book_items WHERE id=? AND workspace_id=?").get(it.price_book_item_id, req.user.workspace_id) as any;
    if (!pb) return res.status(422).json({ error: { code: "price_book_only", message: `Line item must come from the price book: ${it.price_book_item_id || it.name || "?"}` } });
    const price = it.unit_price !== undefined ? it.unit_price : pb.standard_price;
    if (price < pb.floor_price) below = true;
    total += price * (it.qty || 1);
    it.name = pb.name; it.unit_price = price;
  }
  const count = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(l.id) as any).c;
  const id = uid("prop");
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,template_id,version,status,line_items,total,margin_band,win_prob_band,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, req.user.workspace_id, l.id, req.body.template_id || null, count + 1, "draft", JSON.stringify(items), total, below ? "below_floor" : "in_band", total > 25000 ? "review" : "standard", now());
  if (l.state === "APPROVED") transition(req.user.workspace_id, "system", l, "PROPOSAL_DRAFTED");
  res.status(201).json(db.prepare("SELECT * FROM proposals WHERE id=?").get(id));
});

// approvals
app.get("/api/approvals", requireAuth, (req: any, res) => {
  const rows = db.prepare(`SELECT a.*, l.service_requested, l.est_value, l.state FROM approvals a JOIN leads l ON l.id=a.lead_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at`).all(req.user.workspace_id);
  res.json(rows);
});
app.post("/api/approvals/:id/decide", requireAuth, (req: any, res) => {
  const a = db.prepare("SELECT * FROM approvals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!a || a.decision) return res.status(404).json({ error: { code: "not_found_or_decided" } });
  if (!["OWNER", "APPROVER", "ADMIN"].includes(req.user.role) && req.user.id !== a.approver_id) return res.status(403).json({ error: { code: "not_approver" } });
  const { decision, reason_code, edits_diff } = req.body;
  if (!["approved", "changes", "rejected"].includes(decision)) return res.status(422).json({ error: { code: "bad_decision" } });
  if (decision !== "approved" && !reason_code) return res.status(422).json({ error: { code: "reason_required", message: "Reject/change requires a reason code (§6.5)" } });
  db.prepare("UPDATE approvals SET decision=?, reason_code=?, edits_diff=?, decided_at=? WHERE id=?").run(decision, reason_code || null, edits_diff ? JSON.stringify(edits_diff) : null, now(), a.id);
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(a.lead_id) as any;
  if (decision === "approved" && l.state === "READY_FOR_APPROVAL") transition(req.user.workspace_id, req.user.id, l, "APPROVED");
  if (decision !== "approved" && l.state === "READY_FOR_APPROVAL") transition(req.user.workspace_id, req.user.id, l, "QUALIFIED");
  audit(req.user.workspace_id, req.user.id, "approval.decide", "approval", a.id, { decision, reason_code });
  res.json({ ok: true });
});

// tasks / follow-ups
app.get("/api/tasks", requireAuth, (req: any, res) => res.json(db.prepare("SELECT t.*, l.service_requested FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id WHERE t.workspace_id=? ORDER BY t.due_at").all(req.user.workspace_id)));
app.post("/api/tasks/:id/complete", requireAuth, (req: any, res) => { db.prepare("UPDATE tasks SET status='done', completed_at=? WHERE id=?").run(now(), req.params.id); res.json({ ok: true }); });

// metrics / brief / demand
app.get("/api/metrics", requireAuth, (req: any, res) => res.json(metrics(req.user.workspace_id)));
app.get("/api/brief", requireAuth, (req: any, res) => res.json(morningBrief(req.user.workspace_id)));
app.get("/api/demand-gap", requireAuth, (req: any, res) => { const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(req.user.workspace_id) as any[]; res.json(demandGap(leads)); });

// Gregory P0s (§25): field reports, timesheets, site visits, documents
app.get("/api/ops", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  res.json({
    field_reports: db.prepare("SELECT f.*, u.name manager FROM field_reports f LEFT JOIN users u ON u.id=f.manager_id WHERE f.workspace_id=? ORDER BY f.report_date DESC").all(ws),
    timesheets: db.prepare("SELECT t.*, u.name manager FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? ORDER BY t.week_of DESC").all(ws),
    site_visits: db.prepare("SELECT v.*, l.service_requested FROM site_visits v LEFT JOIN leads l ON l.id=v.lead_id WHERE v.workspace_id=? ORDER BY v.scheduled_at").all(ws),
    documents: db.prepare("SELECT * FROM documents WHERE workspace_id=?").all(ws),
  });
});
app.post("/api/field-reports/:id/submit", requireAuth, (req: any, res) => { db.prepare("UPDATE field_reports SET status='submitted', submitted_at=? WHERE id=?").run(now(), req.params.id); res.json({ ok: true }); });
app.post("/api/timesheets/:id/submit", requireAuth, (req: any, res) => { db.prepare("UPDATE timesheets SET status='submitted', submitted_at=? WHERE id=?").run(now(), req.params.id); res.json({ ok: true }); });

// CSV import (§4.1) — simple CSV, header row; AI mapping = header heuristics
app.post("/api/imports/csv", requireAuth, (req: any, res) => {
  const lines = String(req.body.csv || "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return res.status(422).json({ error: { code: "empty_csv" } });
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex(h => names.includes(h));
  const mi = { name: idx(["name", "contact", "customer"]), phone: idx(["phone", "mobile", "tel"]), email: idx(["email"]), service: idx(["service", "service_requested", "job"]), value: idx(["value", "est_value", "amount"]), location: idx(["location", "address", "zip"]) };
  let created = 0, dupes = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map(c => c.trim());
    const r = createLead(req.user.workspace_id, req.user.id, { contact: { name: cols[mi.name] || "", phone: cols[mi.phone] || "", email: cols[mi.email] || "" }, service_requested: mi.service >= 0 ? cols[mi.service] : "", est_value: mi.value >= 0 ? Number(cols[mi.value]) || 0 : 0, location: mi.location >= 0 ? cols[mi.location] : "", source: "csv-import" });
    r.duplicate ? dupes++ : created++;
  }
  const id = uid("imp");
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.filename || "import.csv", JSON.stringify(mi), JSON.stringify({ created, dupes }), "committed", now());
  res.json({ import_id: id, created, duplicates: dupes });
});

// ---------- public API (§14) ----------
app.post("/v1/leads", requireApiKey(["leads:write"]), (req: any, res) => {
  const idem = req.headers["idempotency-key"];
  if (idem) { const prior = db.prepare("SELECT * FROM outbox WHERE idempotency_key=?").get("idem-" + idem) as any; if (prior) return res.json(JSON.parse(prior.payload)); }
  const inj = injectionScan(JSON.stringify(req.body));
  const r = createLead(req.workspace_id, "api", req.body);
  const response = { id: r.lead.id, state: r.lead.state, duplicate: r.duplicate, injection_flagged: inj.flagged };
  if (idem) db.prepare("INSERT INTO outbox (id,workspace_id,kind,payload,idempotency_key,created_at) VALUES (?,?,?,?,?,?)").run(uid("out"), req.workspace_id, "api.idempotency", JSON.stringify(response), "idem-" + idem, now());
  res.status(r.duplicate ? 200 : 201).json(response);
});
app.get("/v1/leads/:id/outcome", requireApiKey(["outcomes:read"]), (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (!FINAL_STATES.includes(l.state)) return res.status(409).json({ error: { code: "not_final", state: l.state } });
  res.json(outcomePayload(l));
});
app.get("/v1/outcomes", requireApiKey(["outcomes:read"]), (req: any, res) => {
  const rows = db.prepare("SELECT * FROM outcome_deliveries WHERE workspace_id=? ORDER BY created_at").all(req.workspace_id) as any[];
  res.json(rows.map(d => { const l = db.prepare("SELECT * FROM leads WHERE id=?").get(d.lead_id) as any; return { delivery_id: d.id, delivery_status: d.last_status, acknowledged_at: d.acknowledged_at, external_id: d.external_id, ...outcomePayload(l) }; }));
});
app.get("/v1/projects/:id", requireApiKey(["projects:read", "outcomes:read"]), (req: any, res) => {
  const p = db.prepare("SELECT * FROM projects WHERE id=? AND workspace_id=?").get(req.params.id, req.workspace_id) as any;
  if (!p) return res.status(404).json({ error: { code: "not_found" } });
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any;
  res.json({ project: p, ...outcomePayload(l) });
});
app.post("/v1/outcomes/:deliveryId/ack", requireApiKey(["outcomes:read"]), (req: any, res) => {
  const d = db.prepare("SELECT * FROM outcome_deliveries WHERE id=? AND workspace_id=?").get(req.params.deliveryId, req.workspace_id) as any;
  if (!d) return res.status(404).json({ error: { code: "not_found" } });
  db.prepare("UPDATE outcome_deliveries SET last_status='acknowledged', acknowledged_at=?, delivered_at=COALESCE(delivered_at,?), external_id=? WHERE id=?").run(now(), now(), req.body.external_id || null, d.id);
  if (req.body.external_id) db.prepare("UPDATE projects SET external_project_id=?, handoff_status='acknowledged', handoff_acked_at=? WHERE lead_id=?").run(req.body.external_id, now(), d.lead_id);
  res.json({ ok: true });
});
app.get("/api/handoffs", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM outcome_deliveries WHERE workspace_id=? ORDER BY created_at DESC").all(req.user.workspace_id)));
app.get("/api/outbox", requireAuth, (req: any, res) => res.json(db.prepare("SELECT id,kind,status,attempts,last_error,created_at FROM outbox WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100").all(req.user.workspace_id)));

// ---------- slice 2: webhook endpoints + delivery worker controls ----------
app.get("/api/webhooks", requireAuth, (req: any, res) => res.json(db.prepare("SELECT id,url,events,active,created_at FROM webhook_endpoints WHERE workspace_id=?").all(req.user.workspace_id)));
app.post("/api/webhooks", requireAuth, (req: any, res) => {
  if (!["OWNER", "ADMIN", "OPS_ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "forbidden" } });
  const id = uid("whk");
  db.prepare("INSERT INTO webhook_endpoints (id,workspace_id,url,secret,events,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.url, req.body.secret || randomBytes(18).toString("hex"), req.body.events || "lead.finalized", now());
  res.status(201).json({ id, url: req.body.url });
});
app.delete("/api/webhooks/:id", requireAuth, (req: any, res) => { db.prepare("UPDATE webhook_endpoints SET active=0 WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/worker/run", requireAuth, async (req: any, res) => { const { processDeliveries } = await import("./worker.ts"); res.json(await processDeliveries()); });
app.post("/api/handoffs/:id/replay", requireAuth, async (req: any, res) => { const { replayDelivery } = await import("./worker.ts"); const ok = replayDelivery(req.params.id); res.status(ok ? 200 : 404).json({ ok }); });

// ---------- slice 2: DOCX proposal export (§25) ----------
app.get("/api/proposals/:id/docx", requireAuth, async (req: any, res) => {
  const out = await proposalDocx(req.params.id);
  if (!out) return res.status(404).json({ error: { code: "not_found" } });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
  res.send(out.buffer);
});

// ---------- slice 2: inbox ingestion + triage (§25 P0-2) ----------
app.post("/api/inbox/ingest", requireAuth, (req: any, res) => {
  const emails = Array.isArray(req.body.emails) ? req.body.emails : [req.body];
  const results: any[] = [];
  const ops = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='OPS_ADMIN' AND active=1").get(req.user.workspace_id) as any;
  for (const e of emails) {
    const parsed = parseEmail(e);
    if (parsed.is_lead) {
      const r = createLead(req.user.workspace_id, "inbox", { contact: { name: e.from_name || "", phone: parsed.phone, email: e.from_email || "" }, service_requested: "", message: `${e.subject || ""}\n${e.body || ""}`, source: "email-inbox", created_at: e.received_at });
      results.push({ category: "lead", lead_id: r.lead.id, duplicate: r.duplicate });
    } else {
      const id = uid("inb");
      db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .run(id, req.user.workspace_id, parsed.category, e.from_name || "", e.from_email || "", e.subject || "", e.body || "", ops?.id || req.user.id, new Date(Date.now() + 86400000).toISOString(), e.received_at || now(), now());
      results.push({ category: parsed.category, inbox_item_id: id });
    }
  }
  res.json({ ingested: results.length, results });
});
app.get("/api/inbox", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? ORDER BY created_at DESC").all(req.user.workspace_id)));

// ---------- slice 3: e-sign + customer signing page ----------
app.post("/api/proposals/:id/sign-link", requireAuth, (req: any, res) => {
  const p = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!p) return res.status(404).json({ error: { code: "not_found" } });
  const token = ensureSignToken(p.id);
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({ sign_url: `${base}/sign/${token}`, token });
});
app.get("/sign/:token", (req, res) => {
  const ctx = getByToken(req.params.token);
  if (!ctx) return res.status(404).send("Link not found");
  const { proposal: p, lead, contact, workspace: ws, signature: s } = ctx;
  const items = JSON.parse(p.line_items || "[]").map((i: any) => `<tr><td>${i.name}</td><td>${i.qty || 1}</td><td>$${i.unit_price}</td></tr>`).join("");
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Proposal — ${ws.name}</title>
  <style>body{font-family:sans-serif;max-width:640px;margin:24px auto;padding:0 16px}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:6px}input{width:100%;padding:10px;margin:6px 0}button{background:#14532d;color:#fff;border:0;padding:12px 20px;border-radius:8px;width:100%}</style>
  <h1>${ws.name}</h1><h2>Proposal — ${lead.service_requested}</h2><p>Prepared for ${contact.name} · ${lead.location || ""}</p>
  <p>${lead.notes || ""}</p><table>${items}</table><p><strong>Total: $${Number(p.total).toFixed(2)}</strong> · Payment status: ${p.payment_status || "—"}</p>
  ${s.signed_at ? `<p>✅ Signed by ${s.signer_name} on ${new Date(s.signed_at).toLocaleString()}</p>` : `
  <form method="POST" action="/sign/${req.params.token}">
    <input name="signer_name" placeholder="Your full name" required>
    <input name="signer_email" type="email" placeholder="Email">
    <input name="typed_signature" placeholder="Type your name to sign" required>
    <label><input type="checkbox" name="consent" value="1" style="width:auto" required> I agree to sign electronically (ESIGN/UETA) and accept this proposal.</label>
    <button>Sign Proposal</button></form>`}`);
});
app.post("/sign/:token", express.urlencoded({ extended: false }), (req: any, res) => {
  const r = sign(req.params.token, { signer_name: req.body.signer_name, signer_email: req.body.signer_email, typed_signature: req.body.typed_signature, consent: req.body.consent === "1", ip: req.ip, user_agent: req.get("user-agent") });
  if (!r.ok) return res.status(422).send(`Signing failed: ${r.error}. Go back and check your entry.`);
  res.type("html").send(`<!doctype html><h1>Signed ✅</h1><p>Evidence certificate: ${r.certificate.signature_id} · Document hash ${r.certificate.doc_hash.slice(0, 16)}… · ${r.certificate.signed_at}</p>`);
});
app.get("/api/proposals/:id/certificate", requireAuth, (req: any, res) => {
  const s = db.prepare("SELECT * FROM signatures WHERE proposal_id=? AND signed_at IS NOT NULL").get(req.params.id) as any;
  if (!s) return res.status(404).json({ error: { code: "not_signed" } });
  res.json({ signature_id: s.id, signer: s.signer_name, signed_at: s.signed_at, doc_hash: s.doc_hash, ip: s.ip });
});

// ---------- slice 3: deposits (Stripe live / explicit test mode) ----------
app.post("/api/proposals/:id/deposit", requireAuth, async (req: any, res) => {
  try { const base = `${req.protocol}://${req.get("host")}`; const pay = await createDeposit(req.params.id, base); if (!pay) return res.status(404).json({ error: { code: "not_found" } }); res.status(201).json({ payment: pay, mode: stripeMode() }); }
  catch (e: any) { res.status(502).json({ error: { code: "stripe_error", message: e.message } }); }
});
app.get("/pay/test/:paymentId", (req, res) => {
  const pay = db.prepare("SELECT * FROM payments WHERE id=?").get(req.params.paymentId) as any;
  if (!pay) return res.status(404).send("Not found");
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;max-width:480px;margin:24px auto;padding:0 16px}button{background:#14532d;color:#fff;border:0;padding:12px 20px;border-radius:8px;width:100%}</style>
  <h1>Test Mode — Deposit</h1><p>Amount: <strong>$${Number(pay.amount).toFixed(2)}</strong> · Status: ${pay.status}</p>
  ${pay.status === "paid" ? "<p>✅ Paid (test mode)</p>" : `<form method="POST" action="/pay/test/${pay.id}"><button>Pay Deposit (test)</button></form>`}
  <p><small>No real charge. Connect STRIPE_SECRET_KEY and this becomes a live Stripe Checkout link automatically.</small></p>`);
});
app.post("/pay/test/:paymentId", express.urlencoded({ extended: false }), (req, res) => { markPaid(req.params.paymentId); res.redirect(`/pay/test/${req.params.paymentId}`); });
app.post("/webhooks/stripe", (req: any, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) { if (!verifyStripeSignature(req.rawBody || "", req.headers["stripe-signature"] || "", secret)) return res.status(400).json({ error: { code: "invalid_signature" } }); }
  handleStripeEvent(req.body);
  handleBillingEvent(req.body);
  res.json({ received: true });
});

// ---------- slice 3: §26 flags, admin, synthetics ----------
app.get("/api/flags", requireAuth, (req: any, res) => res.json(getFlags(req.user.workspace_id)));
app.post("/api/flags", requireAuth, (req: any, res) => {
  if (!req.user.is_platform_admin && req.user.role !== "OWNER") return res.status(403).json({ error: { code: "forbidden" } });
  const ok = setFlag(req.user.workspace_id, req.body.flag, !!req.body.enabled);
  res.status(ok ? 200 : 422).json({ ok });
});
function requirePlatformAdmin(req: any, res: any, next: any) { if (!req.user?.is_platform_admin) return res.status(403).json({ error: { code: "platform_admin_only" } }); next(); }
app.get("/api/admin/workspaces", requireAuth, requirePlatformAdmin, (_req: any, res) => res.json(workspaceHealth()));
app.get("/api/admin/synthetics", requireAuth, requirePlatformAdmin, async (req: any, res) => { const base = `${req.protocol}://${req.get("host")}`; res.json(await runSynthetics(base)); });
app.get("/api/admin/dlq", requireAuth, requirePlatformAdmin, (_req: any, res) => res.json(db.prepare("SELECT * FROM outcome_deliveries WHERE last_status='dead_letter' ORDER BY created_at DESC").all()));

// ---------- slice 4: change orders (§26 A3) ----------
app.get("/api/change-orders", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM change_orders WHERE workspace_id=? ORDER BY created_at DESC").all(req.user.workspace_id)));
app.post("/api/change-orders", requireAuth, (req: any, res) => {
  const proj = db.prepare("SELECT * FROM projects WHERE id=? AND workspace_id=?").get(req.body.project_id, req.user.workspace_id) as any;
  if (!proj) return res.status(404).json({ error: { code: "project_not_found" } });
  const items = req.body.line_items || [];
  let delta = 0;
  for (const it of items) { const pb = db.prepare("SELECT * FROM price_book_items WHERE id=? AND workspace_id=?").get(it.price_book_item_id, req.user.workspace_id) as any; if (!pb) return res.status(422).json({ error: { code: "price_book_only" } }); delta += (it.unit_price !== undefined ? it.unit_price : pb.standard_price) * (it.qty || 1); it.name = pb.name; }
  const id = uid("co");
  db.prepare("INSERT INTO change_orders (id,workspace_id,project_id,lead_id,delta_scope,delta_total,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, req.user.workspace_id, proj.id, proj.lead_id, JSON.stringify({ description: req.body.description || "", line_items: items }), delta, "pending_approval", now());
  // reuse the §6 approval discipline: a change order is decided like a proposal packet
  db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("apr"), req.user.workspace_id, proj.lead_id, null, req.user.id, proj.pm_id, Math.abs(delta) > 25000 ? "ceo" : "manager", now());
  res.status(201).json(db.prepare("SELECT * FROM change_orders WHERE id=?").get(id));
});
app.post("/api/change-orders/:id/decide", requireAuth, (req: any, res) => {
  const co = db.prepare("SELECT * FROM change_orders WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!co || co.status !== "pending_approval") return res.status(404).json({ error: { code: "not_found_or_decided" } });
  if (!["OWNER", "APPROVER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "not_approver" } });
  const decision = req.body.decision === "approved" ? "approved" : "rejected";
  if (decision === "rejected" && !req.body.reason_code) return res.status(422).json({ error: { code: "reason_required" } });
  db.prepare("UPDATE change_orders SET status=? WHERE id=?").run(decision, co.id);
  res.json({ ok: true, status: decision });
});

// ---------- slice 4: customer portal (signed link, flag-gated §26) ----------
app.get("/portal/:token", (req, res) => {
  const ctx = getByToken(req.params.token);
  if (!ctx) return res.status(404).send("Link not found");
  if (!getFlags(ctx.workspace.id).customer_portal) return res.status(403).send("Customer portal is not enabled for this business yet. Please use your proposal signing link or contact the office.");
  const { proposal: p, lead, workspace: ws, signature: s } = ctx;
  const proj = db.prepare("SELECT * FROM projects WHERE lead_id=?").get(lead.id) as any;
  const visits = db.prepare("SELECT * FROM site_visits WHERE lead_id=? ORDER BY scheduled_at").all(lead.id) as any[];
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;max-width:640px;margin:24px auto;padding:0 16px}</style>
  <h1>${ws.name} — Your Project Portal</h1>
  <p>Service: ${lead.service_requested} · Status: ${lead.state}</p>
  <p>Proposal: $${Number(p.total).toFixed(2)} · ${s.signed_at ? "✅ Signed" : "Awaiting signature"} · Deposit: ${p.payment_status || "—"}</p>
  ${proj ? `<p>Project reference: ${proj.external_project_id || proj.id} · Project status: ${proj.status}</p>` : ""}
  <h3>Site visits</h3>${visits.length ? visits.map((v: any) => `<p>${new Date(v.scheduled_at).toLocaleString()} — ${v.status}</p>`).join("") : "<p>None scheduled yet.</p>"}
  <h3>Send us a document or photo</h3>
  <form method="POST" action="/portal/${req.params.token}/upload"><input name="filename" placeholder="File name (e.g. insurance-cert.pdf)" required style="width:100%;padding:10px;margin:6px 0"><input name="note" placeholder="Note (optional)" style="width:100%;padding:10px;margin:6px 0"><button style="background:#14532d;color:#fff;border:0;padding:12px 20px;border-radius:8px;width:100%">Submit</button></form>
  <p><small>File transfer completes in your confirmation email thread — this form records the document against your job so nothing gets lost.</small></p>`);
});
app.post("/portal/:token/upload", express.urlencoded({ extended: false }), (req: any, res) => {
  const ctx = getByToken(req.params.token);
  if (!ctx) return res.status(404).send("Link not found");
  const id = uid("upl");
  db.prepare("INSERT INTO portal_uploads (id,workspace_id,lead_id,filename,note,created_at) VALUES (?,?,?,?,?,?)").run(id, ctx.workspace.id, ctx.lead.id, req.body.filename || "", req.body.note || "", now());
  db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status,received_at) VALUES (?,?,?,?,?,?,?)").run(uid("doc"), ctx.workspace.id, ctx.lead.id, req.body.filename || "customer upload", 0, "received", now());
  res.type("html").send("<h1>Received ✅</h1><p>Your document is recorded against your job. The office will confirm by email.</p>");
});

// ---------- slice 4: own billing (§18/§26 C4) ----------
app.get("/api/billing", requireAuth, (req: any, res) => res.json({ ...billingStatus(req.user.workspace_id), plans: PLANS }));
app.post("/api/billing/checkout", requireAuth, async (req: any, res) => { const base = `${req.protocol}://${req.get("host")}`; res.json(await createCheckout(req.user.workspace_id, req.body.plan, base)); });
app.post("/api/billing/change-plan", requireAuth, (req: any, res) => {
  if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only" } });
  if (!PLANS[req.body.plan]) return res.status(422).json({ error: { code: "unknown_plan" } });
  db.prepare("UPDATE subscriptions SET plan=?, updated_at=? WHERE workspace_id=?").run(req.body.plan, now(), req.user.workspace_id);
  res.json(billingStatus(req.user.workspace_id));
});

// ---------- slice 4: OAuth connections (Gmail / Outlook) ----------
app.get("/api/oauth/status", requireAuth, (req: any, res) => res.json({ google: providerStatus("google"), microsoft: providerStatus("microsoft"), connections: listConnections(req.user.workspace_id) }));
app.get("/api/oauth/:provider/start", requireAuth, (req: any, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const r = authUrl(req.params.provider, req.user.workspace_id, `${base}/api/oauth/callback`);
  if (!r.configured) return res.status(409).json({ error: { code: "provider_not_configured", message: "Register the provider app (client ID/secret) on this deployment to enable this connection." } });
  res.json({ url: r.url });
});

// ---------- slice 4: website embed snippet with TCPA consent (§14.4 + §26 legal) ----------
app.get("/embed/v1.js", (req, res) => {
  res.type("application/javascript").send(`(function(){var s=document.currentScript;var ws=s.getAttribute("data-workspace");var formSel=s.getAttribute("data-form");
  function bind(form){ if(!form||form.__lf) return; form.__lf=1;
    if(!form.querySelector("[name=lf_consent]")){ var l=document.createElement("label"); l.style.display="block"; l.style.fontSize="12px"; l.innerHTML="<input type=checkbox name=lf_consent required> I agree to be contacted about my request by phone, text and email. Msg/data rates may apply. Reply STOP to opt out."; form.appendChild(l); }
    form.addEventListener("submit",function(){ var fd=new FormData(form); var payload={workspace_hint:ws,contact:{name:fd.get("name")||"",phone:fd.get("phone")||"",email:fd.get("email")||""},service_requested:fd.get("service")||"",message:fd.get("message")||"",location:fd.get("location")||"",source:"website-form",consent:{contact_ok:fd.get("lf_consent")==="on"},utm:{source:new URLSearchParams(location.search).get("utm_source")||""}};
      navigator.sendBeacon("/v1/leads/beacon?ws="+encodeURIComponent(ws), JSON.stringify(payload)); }); }
  document.addEventListener("DOMContentLoaded",function(){ bind(formSel?document.querySelector(formSel):document.querySelector("form")); }); })();`);
});

// ---------- slice 4: legal pages (DRAFTS — attorney review required before launch, see LAUNCH.md) ----------
const legalPage = (title: string, body: string) => (req: any, res: any) => res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.55}</style><h1>${title}</h1><p><em>Draft — pending attorney review.</em></p>${body}<p><a href="/">← LeadFlow OS</a></p>`);
app.get("/terms", legalPage("Terms of Service", "<p>LeadFlow OS provides lead management, approval workflow, proposal generation, and outcome handoff software for small and medium businesses. Customer data remains the customer's data; we process it only to provide the service. Subscriptions are billed monthly per the plan selected; trials run 30 days with no card required. AI-generated drafts require human approval before any customer-facing use. Service is provided as-is during beta/pilot periods.</p>"));
app.get("/privacy", legalPage("Privacy Policy", "<p>We collect account data and the lead/contact data our customers submit or connect. We use it solely to operate the service. We do not sell personal data. AI processing sub-processors are listed in our DPA. Customers may export or request deletion of their data at any time. US state privacy rights (including CCPA/CPRA) are honored via privacy requests to support.</p>"));
app.get("/dpa", legalPage("Data Processing Addendum", "<p>LeadFlow OS acts as a processor/service provider for customer-submitted personal data. Sub-processors: cloud hosting, Stripe (payments), and AI model providers used for drafting/classification features. Security: encryption in transit and at rest, tenant isolation, audit logging. Breach notification within 72 hours of confirmation.</p>"));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "leadflow-os", time: now() }));

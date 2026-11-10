// Workpile — API application (spec §5 state machine, §6 approvals, §9 proposals, §14 public API, §14.5 handoffs, §25 Gregory P0s)
import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { db, uid, now, hashPassword, verifyPassword, apiKeyHash, logEvent, audit } from "./db.ts";
import { triageLead, packetCheck, demandGap, demandPool, injectionScan } from "./agents.ts";
import { metrics, morningBrief } from "./metrics.ts";
import { parseEmail, parseMbox, parseEmailCsv, suggestInboxAction } from "./inbox.ts";
import { proposalDocx } from "./docx.ts";
import { getTemplate, proposalDocument, sanitizeHtml } from "./proptemplate.ts";
import { ensureSignToken, getByToken, sign } from "./sign.ts";
import { createDeposit, markPaid, verifyStripeSignature, handleStripeEvent, stripeMode } from "./payments.ts";
import { getFlags, setFlag, workspaceHealth, runSynthetics } from "./admin.ts";
import { billingStatus, createCheckout, handleBillingEvent, PLANS, ensureSubscription } from "./billing.ts";
import { cleanupPreview, cleanupApply, insights, insightsV2, reactivateStale, scoreLead, nextBestAction, runAutomationsFor, logAgentRun } from "./ai.ts";
import { emitEvent, EVENTS } from "./integrations.ts";
import { queueAndDeliver, notify, notifyOwners, emailConfigured, smsConfigured } from "./comms.ts";
import { weekStartOf, ensureWeek, chaseRow, sumDays } from "./timesheets.ts";
import { rateFor, logTime, jobLabor, DEFAULT_CLASSES } from "./labor.ts";
import { ensureDay, chaseReport, todayStr } from "./fieldreports.ts";
import { weeklyReport } from "./statusreport.ts";
import { enrollFollowup, stopFollowups } from "./followups.ts";

import { providerStatus, authUrl, listConnections } from "./oauth.ts";

export const app = express();
app.use((req: any, _res, next) => { // capture raw body for Stripe signature verification
  if (req.path === "/webhooks/stripe") { let raw = ""; req.on("data", (c: any) => raw += c); req.on("end", () => { req.rawBody = raw; try { req.body = JSON.parse(raw || "{}"); } catch { req.body = {}; } next(); }); }
  else next();
});
app.use(express.json({ limit: "50mb" }));

// ---------- state machine (§5.1) ----------
export const TRANSITIONS: Record<string, string[]> = {
  NEW: ["TRIAGED", "JUNK", "DUPLICATE", "UNSERVICEABLE"],
  TRIAGED: ["QUALIFYING", "JUNK", "DUPLICATE", "UNSERVICEABLE"],
  QUALIFYING: ["QUALIFIED", "UNSERVICEABLE", "JUNK", "DUPLICATE", "NO_RESPONSE"],
  QUALIFIED: ["READY_FOR_APPROVAL", "ON_HOLD"],
  READY_FOR_APPROVAL: ["APPROVED", "QUALIFIED", "ON_HOLD"],
  APPROVED: ["PROPOSAL_DRAFTED", "PROPOSAL_SENT"],
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
  emitEvent(workspaceId, "lead.created", { lead_id: id, contact_name: input.contact?.name || null, service_requested: input.service_requested || null, state: "NEW", est_value: input.est_value ?? null, source: input.source || "manual" });
  if (owner) notify(workspaceId, [owner], "lead.created", "New lead assigned to you", `${input.contact?.name || "New lead"} — ${input.service_requested || "service request"}`, id);
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
    notify(workspaceId, [approver], "approval.requested", "Approval waiting on you", `${leadView(lead).contact_name || "Lead"} — proposal $${prop?.total ?? ""} needs your decision`, lead.id);
  }
  if (toState === "QUALIFIED") extra.qualified_at = now();
  const sets = ["state=?", "updated_at=?", ...Object.keys(extra).map(k => `${k}=?`)];
  db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(toState, now(), ...Object.values(extra), lead.id);
  const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id) as any;
  logEvent(workspaceId, lead.id, actor, "state_changed", lead.state, toState, extra);
  emitEvent(workspaceId, "lead.state_changed", { lead_id: lead.id, from_state: lead.state, to_state: toState });
  if (FINAL_STATES.includes(toState)) { finalizeLead(workspaceId, actor, updated, toState); stopFollowups(lead.id, "finalized"); notifyOwners(workspaceId, "outcome.final", `Lead finalized: ${toState}`, `${leadView(updated).contact_name || lead.id} is now ${toState}`, lead.id); if (actor !== "api") emitEvent(workspaceId, "outcome.final", { lead_id: lead.id, outcome: OUTCOME_OF[toState], state: toState });
    if (toState === "WON") { const wsx: any = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId); const cv = leadView(updated);
      if (wsx?.review_on_won && wsx?.review_url && cv.contact_email) queueAndDeliver(workspaceId, { lead_id: lead.id, channel: "email", to: cv.contact_email, subject: `Thanks from ${wsx.name} — how did we do?`, body: `Hi ${cv.contact_name || "there"},\n\nThanks for choosing ${wsx.name}. If we earned it, a quick Google review helps a local business like ours more than any ad: ${wsx.review_url}\n\nAnd if a neighbor ever needs the same help, we'd be grateful for the referral.` }).catch(() => {}); } }
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

// ---------- slice 14: per-member permissions (role defaults + custom overrides) ----------
export interface Perms { leads_scope: "all" | "own"; can_approve: boolean; can_billing: boolean; can_settings: boolean; can_export: boolean; can_manage_team: boolean; }
const PERM_KEYS = ["leads_scope", "can_approve", "can_billing", "can_settings", "can_export", "can_manage_team"] as const;
const ROLE_PERMS: Record<string, Perms> = {
  OWNER: { leads_scope: "all", can_approve: true, can_billing: true, can_settings: true, can_export: true, can_manage_team: true },
  ADMIN: { leads_scope: "all", can_approve: true, can_billing: false, can_settings: true, can_export: true, can_manage_team: true },
  OPS_ADMIN: { leads_scope: "all", can_approve: false, can_billing: true, can_settings: true, can_export: true, can_manage_team: true },
  APPROVER: { leads_scope: "all", can_approve: true, can_billing: false, can_settings: false, can_export: true, can_manage_team: false },
  LEAD_OWNER: { leads_scope: "own", can_approve: false, can_billing: false, can_settings: false, can_export: false, can_manage_team: false },
  PM: { leads_scope: "own", can_approve: false, can_billing: false, can_settings: false, can_export: false, can_manage_team: false },
};
export function permsOf(user: any): Perms {
  const base = ROLE_PERMS[user.role] || ROLE_PERMS.LEAD_OWNER;
  if (user.role === "OWNER") return { ...base }; // owner is never restricted
  let over: any = {}; try { over = JSON.parse(user.permissions || "{}"); } catch { over = {}; }
  const out: any = { ...base }; for (const k of PERM_KEYS) if (over[k] !== undefined) out[k] = over[k];
  return out as Perms;
}
const scopeOwn = (user: any) => permsOf(user).leads_scope === "own";
const mine = (user: any, l: any) => l.owner_id === user.id || l.pm_id === user.id;
function needPerm(key: keyof Perms) { return (req: any, res: any, next: any) => { if (!permsOf(req.user)[key]) return res.status(403).json({ error: { code: "permission_denied", permission: key } }); next(); }; }
// ---------- routes: auth ----------
app.post("/api/auth/login", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=? AND active=1").get((req.body.email || "").toLowerCase()) as any;
  if (!u || !verifyPassword(req.body.password || "", u.password_hash)) return res.status(401).json({ error: { code: "bad_credentials" } });
  const sid = uid("ses") + randomBytes(16).toString("hex");
  db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, u.id, now(), new Date(Date.now() + 7 * 86400000).toISOString());
  res.setHeader("Set-Cookie", `lf_session=${sid}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, workspace_id: u.workspace_id, is_platform_admin: !!u.is_platform_admin , email_verified: u.email_verified ?? 0, permissions: permsOf(u) }, session: sid });
});
app.get("/api/auth/me", requireAuth, (req: any, res) => { ensureMembership(req.user); const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, workspace_id: req.user.workspace_id, workspace_name: ws?.name, email_verified: req.user.email_verified ?? 0, is_platform_admin: !!req.user.is_platform_admin, permissions: permsOf(req.user) }, workspaces: membershipsOf(req.user.id) }); });

// ---------- routes: workspace data ----------
app.get("/api/users", requireAuth, (req: any, res) => res.json((db.prepare("SELECT * FROM users WHERE workspace_id=?").all(req.user.workspace_id) as any[]).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, approval_limit: u.approval_limit, labor_class_id: u.labor_class_id || null, permissions: permsOf(u), has_overrides: !!u.permissions }))));
app.get("/api/leads", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  let rows = (db.prepare("SELECT * FROM leads WHERE workspace_id=? ORDER BY created_at DESC").all(ws) as any[]).map(leadView);
  if (scopeOwn(req.user)) rows = rows.filter(l => mine(req.user, l));
  if (req.query.state) rows = rows.filter(l => l.state === req.query.state);
  if (req.query.bucket) { const B: Record<string, string[]> = { new: ["NEW", "TRIAGED"], working: ["QUALIFYING", "QUALIFIED", "IN_FOLLOW_UP"], approver: ["READY_FOR_APPROVAL"], proposal: ["APPROVED", "PROPOSAL_DRAFTED", "PROPOSAL_SENT"], won: ["WON"], closed: ["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE", "ON_HOLD"] }; rows = rows.filter(l => (B[String(req.query.bucket)] || []).includes(l.state)); }
  if (req.query.owner_id) rows = rows.filter(l => l.owner_id === req.query.owner_id);
  if (req.query.service) rows = rows.filter(l => l.service_requested === req.query.service);
  if (req.query.overdue) rows = rows.filter(l => l.next_action_due_at && l.next_action_due_at < now() && !FINAL_STATES.includes(l.state));
  if (req.query.unassigned) rows = rows.filter(l => !l.owner_id);
  if (req.query.min_value) rows = rows.filter(l => (l.est_value || 0) >= Number(req.query.min_value));
  if (req.query.q) { const q = String(req.query.q).toLowerCase(); rows = rows.filter(l => JSON.stringify(l).toLowerCase().includes(q)); }
  if (req.query.sort === "value") rows.sort((a, b) => (b.est_value || 0) - (a.est_value || 0));
  if (req.query.paged) { const total = rows.length; const page = Math.max(1, Number(req.query.page) || 1), size = Math.min(200, Math.max(5, Number(req.query.page_size) || 50)); return res.json({ items: rows.slice((page - 1) * size, page * size), total, page, pages: Math.max(1, Math.ceil(total / size)) }); }
  res.json(rows);
});
app.post("/api/leads", requireAuth, (req: any, res) => { const r = createLead(req.user.workspace_id, req.user.id, req.body); res.status(r.duplicate ? 200 : 201).json(r); });
app.get("/api/leads/:id", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  const events = db.prepare("SELECT * FROM lead_events WHERE lead_id=? ORDER BY created_at").all(l.id);
  const tasks = db.prepare("SELECT * FROM tasks WHERE lead_id=? ORDER BY due_at").all(l.id);
  const proposals = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").all(l.id);
  const docs = db.prepare("SELECT * FROM documents WHERE lead_id=?").all(l.id);
  const visits = db.prepare("SELECT * FROM site_visits WHERE lead_id=?").all(l.id);
  const activities = db.prepare("SELECT a.*, u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE a.lead_id=? ORDER BY a.created_at DESC").all(l.id);
  const approvals = db.prepare("SELECT * FROM approvals WHERE lead_id=? ORDER BY submitted_at DESC").all(l.id);
  res.json({ lead: leadView(l), events, tasks, proposals, documents: docs, site_visits: visits, activities, approvals });
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
  const rows = db.prepare(`SELECT a.*, l.service_requested, l.est_value, l.state, l.contact_id, c.name contact_name FROM approvals a JOIN leads l ON l.id=a.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at`).all(req.user.workspace_id) as any[];
  for (const a of rows) {
    const l = db.prepare("SELECT * FROM leads WHERE id=?").get(a.lead_id) as any;
    const prop = a.proposal_id ? db.prepare("SELECT * FROM proposals WHERE id=?").get(a.proposal_id) as any : db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(a.lead_id) as any;
    const chk = packetCheck({ ...leadView(l), pm_id: l.pm_id }, prop);
    if (prop) { try { prop.line_items = JSON.parse(prop.line_items || "[]"); } catch { prop.line_items = []; } a.proposal = prop; }
    const ALL = ["contact name", "contact phone or email", "service requested", "service location", "scope notes", "project manager", "proposal", "proposal line items from price book"];
    a.checks = ALL.map(label => ({ label, ok: !chk.missing.includes(label) })); a.ready = chk.complete; a.flags = chk.flags; a.score = chk.score; a.missing = chk.missing;
    a.age_hours = Math.round((Date.now() - new Date(a.submitted_at).getTime()) / 360000) / 10;
  }
  res.json(rows);
});
app.post("/api/auth/logout", (req: any, res) => { const sid = (req.headers.cookie || "").split(";").map((x: string) => x.trim()).find((x: string) => x.startsWith("lf_session="))?.split("=")[1]; if (sid) db.prepare("DELETE FROM sessions WHERE id=?").run(sid); res.setHeader("Set-Cookie", "lf_session=; Path=/; Max-Age=0"); res.json({ ok: true }); });
app.post("/api/approvals/:id/decide", requireAuth, (req: any, res) => {
  const a = db.prepare("SELECT * FROM approvals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!a || a.decision) return res.status(404).json({ error: { code: "not_found_or_decided" } });
  if (!permsOf(req.user).can_approve && req.user.id !== a.approver_id) return res.status(403).json({ error: { code: "not_approver" } });
  const { decision, reason_code, edits_diff } = req.body;
  if (!["approved", "changes", "rejected"].includes(decision)) return res.status(422).json({ error: { code: "bad_decision" } });
  if (decision !== "approved" && !reason_code) return res.status(422).json({ error: { code: "reason_required", message: "Reject/change requires a reason code (§6.5)" } });
  db.prepare("UPDATE approvals SET decision=?, reason_code=?, edits_diff=?, decided_at=? WHERE id=?").run(decision, reason_code || null, edits_diff ? JSON.stringify(edits_diff) : null, now(), a.id);
  emitEvent(req.user.workspace_id, "approval.decided", { lead_id: a.lead_id, approval_id: a.id, decision });
  notify(req.user.workspace_id, [a.submitted_by], "approval.decided", `Your proposal was ${decision}`, `Lead ${a.lead_id} — decision: ${decision}${reason_code ? " (" + reason_code + ")" : ""}`, a.lead_id);
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
app.get("/api/demand-gap", requireAuth, (req: any, res) => { const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(req.user.workspace_id) as any[]; const catalog = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND is_catalog=1").all(req.user.workspace_id) as any[]).map(r => r.name); res.json(demandGap(leads, catalog)); });
app.get("/api/demand-gap/leads", requireAuth, (req: any, res) => { const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(req.user.workspace_id) as any[]; const catalog = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND is_catalog=1").all(req.user.workspace_id) as any[]).map(r => r.name); let pool = demandPool(leads, catalog).filter(l => (l.service_requested || "") === String(req.query.service || "")); if (scopeOwn(req.user)) pool = pool.filter(l => mine(req.user, l)); res.json(pool.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 500).map(leadView)); });

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
// (field-reports submit is the richer slice-22 route below — notes + job link)
// ---------- slice 20: timesheets — log, chase, payroll export ----------
app.get("/api/timesheets", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const week = String(req.query.week || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const rows = db.prepare("SELECT t.*, u.name manager FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? AND t.week_of=? ORDER BY u.name").all(ws, week) as any[];
  const wkEnd = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  for (const r of rows) { try { r.days = r.days ? JSON.parse(r.days) : null; } catch { r.days = null; } r.overdue = r.status === "missing" && week < weekStartOf(new Date());
    const j = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a FROM time_entries WHERE workspace_id=? AND user_id=? AND entry_date>=? AND entry_date<=?").get(ws, r.manager_id, week, wkEnd) as any;
    r.job_hours = j.h; r.job_cost = Math.round(j.a * 100) / 100; }
  const summary = { submitted: rows.filter(r => r.status === "submitted").length, missing: rows.filter(r => r.status === "missing").length, total_hours: rows.reduce((a, r) => a + (r.hours || 0), 0), job_hours: rows.reduce((a, r) => a + (r.job_hours || 0), 0), job_cost: Math.round(rows.reduce((a, r) => a + (r.job_cost || 0), 0) * 100) / 100 };
  res.json({ week_of: week, rows, summary });
});
app.post("/api/timesheets", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const b = req.body || {};
  const managerId = b.manager_id || req.user.id;
  const mgr = db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=?").get(managerId, ws) as any;
  if (!mgr) return res.status(422).json({ error: { code: "bad_manager" } });
  const week = String(b.week_of || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const days = b.days && typeof b.days === "object" ? b.days : null;
  const hours = days ? sumDays(days) : (Number(b.hours) || 0);
  db.prepare("UPDATE timesheets SET status='submitted', submitted_at=?, hours=?, days=?, notes=? WHERE workspace_id=? AND manager_id=? AND week_of=?")
    .run(now(), hours, days ? JSON.stringify(days) : null, String(b.notes || ""), ws, managerId, week);
  res.json(db.prepare("SELECT * FROM timesheets WHERE workspace_id=? AND manager_id=? AND week_of=?").get(ws, managerId, week));
});
app.post("/api/timesheets/:id/chase", requireAuth, (req: any, res) => {
  const row = db.prepare("SELECT * FROM timesheets WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!row) return res.status(404).json({ error: { code: "not_found" } });
  chaseRow(row);
  res.json({ chased: true });
});
app.get("/api/timesheets/export", requireAuth, needPerm("can_export"), (req: any, res) => {
  const ws = req.user.workspace_id; const week = String(req.query.week || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const rows = db.prepare("SELECT t.*, u.name manager, u.email FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? AND t.week_of=? ORDER BY u.name").all(ws, week) as any[];
  const head = "manager,email,week_of,mon,tue,wed,thu,fri,sat,sun,grid_hours,job_hours,total_hours,labor_cost,status,notes";
  const wkEnd2 = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const lines = rows.map(r => { let d: any = {}; try { d = r.days ? JSON.parse(r.days) : {}; } catch { d = {}; } const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`; const j = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a FROM time_entries WHERE workspace_id=? AND user_id=? AND entry_date>=? AND entry_date<=?").get(ws, r.manager_id, week, wkEnd2) as any; return [esc(r.manager), esc(r.email), r.week_of, d.mon || "", d.tue || "", d.wed || "", d.thu || "", d.fri || "", d.sat || "", d.sun || "", r.hours ?? "", j.h, (Number(r.hours) || 0) + j.h, Math.round(j.a * 100) / 100, r.status, esc(r.notes || "")].join(","); });
  res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="timesheets-${week}.csv"`);
  res.send([head, ...lines].join("\n"));
});
// ---------- slice 22: field reports, daily standard ----------
app.get("/api/field-reports", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const date = String(req.query.date || todayStr());
  ensureDay(ws, date);
  const rows = db.prepare("SELECT f.*, u.name manager, l.service_requested job_service, c.name job_customer FROM field_reports f LEFT JOIN users u ON u.id=f.manager_id LEFT JOIN leads l ON l.id=f.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE f.workspace_id=? AND f.report_date=? ORDER BY u.name").all(ws, date) as any[];
  for (const r of rows) r.overdue = r.status === "missing" && date < todayStr();
  res.json({ report_date: date, rows, summary: { submitted: rows.filter(r => r.status === "submitted").length, missing: rows.filter(r => r.status === "missing").length } });
});
app.post("/api/field-reports/:id/submit", requireAuth, (req: any, res) => {
  const r = db.prepare("SELECT * FROM field_reports WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!r) return res.status(404).json({ error: { code: "not_found" } });
  const b = req.body || {};
  db.prepare("UPDATE field_reports SET status='submitted', submitted_at=?, notes=COALESCE(?,notes), lead_id=COALESCE(?,lead_id) WHERE id=?").run(now(), b.notes ?? null, b.lead_id ?? null, r.id);
  res.json(db.prepare("SELECT * FROM field_reports WHERE id=?").get(r.id));
});
app.post("/api/field-reports/:id/chase", requireAuth, (req: any, res) => {
  const r = db.prepare("SELECT * FROM field_reports WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!r) return res.status(404).json({ error: { code: "not_found" } });
  chaseReport(r);
  res.json({ chased: true });
});
// ---------- slice 23: crew scheduling ----------
app.get("/api/schedule/jobs", requireAuth, (req: any, res) => {
  const rows = db.prepare("SELECT l.id, l.service_requested, l.state, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.state IN ('APPROVED','PROPOSAL_SENT','WON') ORDER BY l.created_at DESC LIMIT 100").all(req.user.workspace_id);
  res.json(rows);
});
app.get("/api/schedule", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const week = String(req.query.week || weekStartOf(new Date()));
  const wkEnd = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare("SELECT s.*, u.name worker, l.service_requested, c.name contact_name FROM job_schedule s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN leads l ON l.id=s.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE s.workspace_id=? AND s.work_date>=? AND s.work_date<=? ORDER BY s.work_date, u.name").all(ws, week, wkEnd) as any[];
  const byUserDay: Record<string, Set<string>> = {};
  for (const r of rows) { const k = r.user_id + "|" + r.work_date; (byUserDay[k] = byUserDay[k] || new Set()).add(r.lead_id); }
  for (const r of rows) r.conflict = (byUserDay[r.user_id + "|" + r.work_date]?.size || 0) > 1;
  res.json({ week_of: week, rows });
});
app.post("/api/schedule", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const b = req.body || {};
  const lead = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(String(b.lead_id || ""), ws) as any;
  const user = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=?").get(String(b.user_id || ""), ws) as any;
  if (!lead || !user) return res.status(422).json({ error: { code: "bad_job_or_user" } });
  const id = uid("sch");
  try { db.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,work_date,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(id, ws, lead.id, user.id, String(b.work_date || todayStr()), String(b.note || ""), req.user.id, now()); }
  catch { return res.status(409).json({ error: { code: "already_scheduled" } }); }
  notify(ws, [user.id], "scheduled", `🗓 You're scheduled — ${String(b.work_date || todayStr())}`, "You've been assigned to a job that day. Open Ops Console → Crew schedule for details.");
  res.json(db.prepare("SELECT * FROM job_schedule WHERE id=?").get(id));
});
app.delete("/api/schedule/:id", requireAuth, (req: any, res) => {
  db.prepare("DELETE FROM job_schedule WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id);
  res.json({ ok: true });
});
// ---------- slice 21: labor classes, crew, job time ----------
app.get("/api/labor-classes", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM labor_classes WHERE workspace_id=? ORDER BY name").all(req.user.workspace_id)));
app.post("/api/labor-classes", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const b = req.body || {}; const id = uid("lclass");
  db.prepare("INSERT INTO labor_classes (id,workspace_id,name,private_rate,govt_rate,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, String(b.name || "Class"), Number(b.private_rate) || 0, Number(b.govt_rate) || 0, now());
  res.json(db.prepare("SELECT * FROM labor_classes WHERE id=?").get(id));
});
app.post("/api/labor-classes/seed-defaults", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const ws = req.user.workspace_id;
  for (const c of DEFAULT_CLASSES) { const ex = db.prepare("SELECT id FROM labor_classes WHERE workspace_id=? AND name=?").get(ws, c.name); if (!ex) db.prepare("INSERT INTO labor_classes (id,workspace_id,name,private_rate,govt_rate,created_at) VALUES (?,?,?,?,?,?)").run(uid("lclass"), ws, c.name, c.private_rate, c.govt_rate, now()); }
  res.json(db.prepare("SELECT * FROM labor_classes WHERE workspace_id=? ORDER BY name").all(ws));
});
app.patch("/api/labor-classes/:id", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const c = db.prepare("SELECT * FROM labor_classes WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!c) return res.status(404).json({ error: { code: "not_found" } });
  const b = req.body || {};
  db.prepare("UPDATE labor_classes SET name=?, private_rate=?, govt_rate=? WHERE id=?").run(String(b.name ?? c.name), Number(b.private_rate ?? c.private_rate) || 0, Number(b.govt_rate ?? c.govt_rate) || 0, c.id);
  res.json(db.prepare("SELECT * FROM labor_classes WHERE id=?").get(c.id));
});
app.delete("/api/labor-classes/:id", requireAuth, needPerm("can_settings"), (req: any, res) => {
  db.prepare("UPDATE users SET labor_class_id=NULL WHERE labor_class_id=?").run(req.params.id);
  db.prepare("DELETE FROM labor_classes WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id);
  res.json({ ok: true });
});
app.get("/api/leads/:id/labor", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id);
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  res.json(jobLabor(req.user.workspace_id, req.params.id));
});
app.post("/api/leads/:id/crew", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const u = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=?").get(String(req.body.user_id || ""), ws) as any;
  if (!u) return res.status(422).json({ error: { code: "bad_user" } });
  try { db.prepare("INSERT INTO job_crew (id,workspace_id,lead_id,user_id,created_at) VALUES (?,?,?,?,?)").run(uid("crew"), ws, req.params.id, u.id, now()); } catch { /* already on crew */ }
  res.json(jobLabor(ws, req.params.id));
});
app.delete("/api/leads/:id/crew/:userId", requireAuth, (req: any, res) => {
  db.prepare("DELETE FROM job_crew WHERE lead_id=? AND user_id=? AND workspace_id=?").run(req.params.id, req.params.userId, req.user.workspace_id);
  res.json(jobLabor(req.user.workspace_id, req.params.id));
});
app.post("/api/leads/:id/time", requireAuth, (req: any, res) => {
  const r = logTime(req.user.workspace_id, req.params.id, req.user.id, req.body || {});
  if ((r as any).error) return res.status(422).json({ error: { code: (r as any).error } });
  res.json(r);
});
app.delete("/api/time-entries/:id", requireAuth, (req: any, res) => {
  const e = db.prepare("SELECT * FROM time_entries WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!e) return res.status(404).json({ error: { code: "not_found" } });
  db.prepare("DELETE FROM time_entries WHERE id=?").run(e.id);
  res.json(jobLabor(req.user.workspace_id, e.lead_id));
});
app.get("/api/setup-status", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const one = (sql: string) => (db.prepare(sql).get(ws) as any).c > 0;
  const cnt = (sql: string) => (db.prepare(sql).get(ws) as any).c;
  res.json({
    has_leads: one("SELECT COUNT(*) c FROM leads WHERE workspace_id=?"),
    has_price_book: one("SELECT COUNT(*) c FROM price_book_items WHERE workspace_id=?"),
    has_services: one("SELECT COUNT(*) c FROM services WHERE workspace_id=?"),
    team_size: cnt("SELECT COUNT(*) c FROM users WHERE workspace_id=? AND active=1"),
    template_customized: one("SELECT COUNT(*) c FROM workspaces WHERE id=? AND pt_company IS NOT NULL AND pt_company<>''"),
    has_rates: one("SELECT COUNT(*) c FROM labor_classes WHERE workspace_id=?"),
    has_sync: one("SELECT COUNT(*) c FROM workspaces WHERE id=? AND source_api_url IS NOT NULL AND source_api_url<>''"),
    has_booking: one("SELECT COUNT(*) c FROM workspaces WHERE id=? AND booking_enabled=1"),
  });
});
app.post("/api/timesheets/:id/submit", requireAuth, (req: any, res) => { db.prepare("UPDATE timesheets SET status='submitted', submitted_at=? WHERE id=?").run(now(), req.params.id); res.json({ ok: true }); });

// CSV import (§4.1) — header heuristics + vendor-native shapes (Tier 2 importers):
// exports from Jobber, Housecall Pro, ServiceTitan and Salesforce import as-is.
const IMPORT_FORMATS: Record<string, Record<string, string[]>> = {
  generic: { name: ["name", "contact", "customer"], first: ["first name", "firstname"], last: ["last name", "lastname"], phone: ["phone", "mobile", "tel"], email: ["email"], service: ["service", "service_requested", "job"], value: ["value", "est_value", "amount"], location: ["location", "address", "zip"] },
  jobber: { name: ["client", "client name"], first: ["first name"], last: ["last name"], phone: ["phone", "phone number", "mobile phone"], email: ["email", "email address"], service: ["service", "job title", "request title", "quote name"], value: ["total", "quote total", "amount"], location: ["address", "street address", "property address"] },
  housecallpro: { name: ["customer", "customer name", "name"], first: ["first name"], last: ["last name"], phone: ["phone", "mobile phone", "phone number"], email: ["email", "email address"], service: ["service", "job type", "job name"], value: ["total", "job total", "amount"], location: ["address", "service address"] },
  servicetitan: { name: ["customer name", "name"], first: ["first name"], last: ["last name"], phone: ["phone", "phone number", "mobile"], email: ["email", "email address"], service: ["job type", "service", "business unit"], value: ["invoice total", "total", "job total"], location: ["address", "location", "service address"] },
  salesforce: { name: ["name"], first: ["firstname", "first name"], last: ["lastname", "last name"], phone: ["phone", "mobilephone", "mobile"], email: ["email"], service: ["service", "service_requested", "industry"], value: ["amount", "value", "annualrevenue"], location: ["street", "city", "address"] },
};
app.post("/api/imports/csv", requireAuth, (req: any, res) => {
  const format = String(req.body.format || "generic"); const F = IMPORT_FORMATS[format] || IMPORT_FORMATS.generic;
  const lines = String(req.body.csv || "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return res.status(422).json({ error: { code: "empty_csv" } });
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex(h => names.includes(h));
  const mi = { name: idx(F.name), first: idx(F.first), last: idx(F.last), phone: idx(F.phone), email: idx(F.email), service: idx(F.service), value: idx(F.value), location: idx(F.location) };
  let created = 0, dupes = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map(c => c.trim());
    const fullName = mi.name >= 0 && cols[mi.name] ? cols[mi.name] : [mi.first >= 0 ? cols[mi.first] : "", mi.last >= 0 ? cols[mi.last] : ""].join(" ").trim();
    const r = createLead(req.user.workspace_id, req.user.id, { contact: { name: fullName, phone: cols[mi.phone] || "", email: cols[mi.email] || "" }, service_requested: mi.service >= 0 ? cols[mi.service] : "", est_value: mi.value >= 0 ? Number(String(cols[mi.value]).replace(/[^0-9.]/g, "")) || 0 : 0, location: mi.location >= 0 ? cols[mi.location] : "", source: format + "-import" });
    r.duplicate ? dupes++ : created++;
  }
  const id = uid("imp");
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.filename || "import.csv", JSON.stringify({ format, ...mi }), JSON.stringify({ created, dupes }), "committed", now());
  res.json({ import_id: id, created, duplicates: dupes, format });
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
  db.prepare("INSERT INTO webhook_endpoints (id,workspace_id,url,secret,events,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.url, req.body.secret || randomBytes(18).toString("hex"), req.body.events || "outcome.final", now());
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
function ingestBatch(ws: string, actorId: string, emails: any[]): { results: any[]; by_category: Record<string, number>; leads_created: number; duplicates: number } {
  const results: any[] = []; const by_category: Record<string, number> = {}; let leads_created = 0, duplicates = 0; const important: any[] = [];
  const ops = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='OPS_ADMIN' AND active=1").get(ws) as any;
  for (const e of emails) {
    const parsed = parseEmail(e);
    by_category[parsed.category] = (by_category[parsed.category] || 0) + 1;
    if (parsed.is_lead) {
      const r = createLead(ws, "inbox", { contact: { name: e.from_name || "", phone: parsed.phone, email: e.from_email || "" }, service_requested: "", message: `${e.subject || ""}\n${e.body || ""}`, source: "email-inbox", created_at: e.received_at });
      if (r.duplicate) duplicates++; else leads_created++;
      results.push({ category: "lead", lead_id: r.lead.id, duplicate: r.duplicate });
    } else {
      const id = uid("inb");
      db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .run(id, ws, parsed.category, e.from_name || "", e.from_email || "", e.subject || "", e.body || "", ops?.id || actorId, new Date(Date.now() + 86400000).toISOString(), e.received_at || now(), now());
      results.push({ category: parsed.category, inbox_item_id: id });
      if (["client_active_job", "proposal"].includes(parsed.category)) important.push({ category: parsed.category, subject: e.subject || "(no subject)", from: e.from_name || e.from_email || "unknown" });
    }
  }
  if (important.length === 1) notifyOwners(ws, "inbox_important", `${important[0].category === "proposal" ? "📄 Proposal mail" : "🏠 Client job mail"}: ${important[0].subject}`, `From ${important[0].from} — triaged as ${important[0].category.replaceAll("_", " ")} and waiting in the Inbox queue.`);
  else if (important.length > 1) notifyOwners(ws, "inbox_important", `📥 ${important.length} important emails triaged`, `${important.filter(i => i.category === "client_active_job").length} client-job and ${important.filter(i => i.category === "proposal").length} proposal emails are waiting in the Inbox queue.`);
  return { results, by_category, leads_created, duplicates };
}
app.post("/api/inbox/ingest", requireAuth, (req: any, res) => {
  const emails = Array.isArray(req.body.emails) ? req.body.emails : [req.body];
  const r = ingestBatch(req.user.workspace_id, req.user.id, emails);
  res.json({ ingested: r.results.length, results: r.results });
});
// slice 18: bulk email backlog import (mbox / email CSV / JSON) — the 3,000-email front door
app.post("/api/imports/email", requireAuth, (req: any, res) => {
  const format = String(req.body.format || "mbox");
  let emails: any[] = [];
  if (format === "json") { try { const j = JSON.parse(String(req.body.content || "[]")); emails = Array.isArray(j) ? j : []; } catch { return res.status(422).json({ error: { code: "bad_json" } }); } }
  else if (format === "csv") emails = parseEmailCsv(String(req.body.content || ""));
  else emails = parseMbox(String(req.body.content || ""));
  if (!emails.length) return res.status(422).json({ error: { code: "no_messages", message: "No messages could be parsed from that file." } });
  const r = ingestBatch(req.user.workspace_id, req.user.id, emails);
  const id = uid("imp");
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.filename || "email-backlog", JSON.stringify({ kind: "email", format }), JSON.stringify({ created: r.leads_created, dupes: r.duplicates, received: emails.length, by_category: r.by_category }), "committed", now());
  res.json({ import_id: id, received: emails.length, leads_created: r.leads_created, duplicates: r.duplicates, by_category: r.by_category });
});
app.get("/api/inbox", requireAuth, (req: any, res) => {
  const rows = db.prepare("SELECT i.*, u.name owner_name FROM inbox_items i LEFT JOIN users u ON u.id=i.owner_id WHERE i.workspace_id=?").all(req.user.workspace_id) as any[];
  for (const r of rows) { r.age_days = Math.max(0, Math.floor((Date.now() - new Date(r.received_at || r.created_at).getTime()) / 86400000)); r.overdue = (r.status || "open") === "open" && r.next_action_due_at && new Date(r.next_action_due_at).getTime() < Date.now(); r.suggestion_action = suggestInboxAction(r, "").action; }
  rows.sort((a, b) => ((a.status || "open") === (b.status || "open") ? 0 : (a.status || "open") === "open" ? -1 : 1) || Number(b.overdue) - Number(a.overdue) || String(b.received_at).localeCompare(String(a.received_at)));
  res.json(rows);
});
// slice 19: inbox actions — work the non-lead mail like a queue, not a museum
app.get("/api/inbox/:id/suggestion", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  res.json(suggestInboxAction(it, w?.name || ""));
});
app.patch("/api/inbox/:id", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const b = req.body || {};
  if (b.status === "done") db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), it.id);
  else if (b.status === "open") db.prepare("UPDATE inbox_items SET status='open', completed_at=NULL WHERE id=?").run(it.id);
  if (b.owner_id !== undefined) db.prepare("UPDATE inbox_items SET owner_id=? WHERE id=?").run(b.owner_id || null, it.id);
  if (b.snooze_days) db.prepare("UPDATE inbox_items SET next_action_due_at=? WHERE id=?").run(new Date(Date.now() + Number(b.snooze_days) * 86400000).toISOString(), it.id);
  res.json(db.prepare("SELECT * FROM inbox_items WHERE id=?").get(it.id));
});
app.post("/api/inbox/:id/reply", requireAuth, async (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  if (!it.from_email) return res.status(422).json({ error: { code: "no_sender_email" } });
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const sug = suggestInboxAction(it, w?.name || "");
  const msg: any = await queueAndDeliver(req.user.workspace_id, { lead_id: it.lead_id || undefined, channel: "email", to: it.from_email, subject: String(req.body.subject || sug.draft_subject), body: String(req.body.body || sug.draft_body) });
  db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), it.id);
  res.json({ sent: true, status: msg.status });
});
app.post("/api/inbox/:id/convert-lead", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const r = createLead(req.user.workspace_id, req.user.id, { contact: { name: it.from_name || "", phone: "", email: it.from_email || "" }, service_requested: "", message: `${it.subject || ""}\n${it.body || ""}`, source: "email-inbox-converted" });
  db.prepare("UPDATE inbox_items SET status='done', completed_at=?, lead_id=? WHERE id=?").run(now(), r.lead.id, it.id);
  res.json({ lead_id: r.lead.id, duplicate: r.duplicate });
});
app.post("/api/inbox/:id/convert-task", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const tid = uid("tsk");
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(tid, req.user.workspace_id, it.lead_id || null, it.owner_id || req.user.id, "inbox", `Inbox (${it.category.replaceAll("_", " ")}): ${String(it.subject || "email").slice(0, 90)}`, it.next_action_due_at || new Date(Date.now() + 86400000).toISOString(), "open", now());
  db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), it.id);
  res.json({ task_id: tid });
});

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
app.get("/api/billing", requireAuth, needPerm("can_billing"), (req: any, res) => res.json({ ...billingStatus(req.user.workspace_id), plans: PLANS }));
app.post("/api/billing/checkout", requireAuth, needPerm("can_billing"), async (req: any, res) => { const base = `${req.protocol}://${req.get("host")}`; res.json(await createCheckout(req.user.workspace_id, req.body.plan, base)); });
app.post("/api/billing/change-plan", requireAuth, needPerm("can_billing"), (req: any, res) => {
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
const legalPage = (title: string, body: string) => (req: any, res: any) => res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.55}</style><h1>${title}</h1><p><em>Draft — pending attorney review.</em></p>${body}<p><a href="/">← Workpile</a></p>`);
app.get("/terms", legalPage("Terms of Service", "<p>Workpile provides lead management, approval workflow, proposal generation, and outcome handoff software for small and medium businesses. Customer data remains the customer's data; we process it only to provide the service. Subscriptions are billed monthly per the plan selected; trials run 30 days with no card required. AI-generated drafts require human approval before any customer-facing use. Service is provided as-is during beta/pilot periods.</p>"));
app.get("/privacy", legalPage("Privacy Policy", "<p>We collect account data and the lead/contact data our customers submit or connect. We use it solely to operate the service. We do not sell personal data. AI processing sub-processors are listed in our DPA. Customers may export or request deletion of their data at any time. US state privacy rights (including CCPA/CPRA) are honored via privacy requests to support.</p>"));
app.get("/dpa", legalPage("Data Processing Addendum", "<p>Workpile acts as a processor/service provider for customer-submitted personal data. Sub-processors: cloud hosting, Stripe (payments), and AI model providers used for drafting/classification features. Security: encryption in transit and at rest, tenant isolation, audit logging. Breach notification within 72 hours of confirmation.</p>"));

// ---------- slice 6: multi-tenant, lead sync, AI ----------
export function workspaceDefaults(wsId: string) {
  const svc = (name: string) => { const id = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name) VALUES (?,?,?)").run(id, wsId, name); return id; };
  const s1 = svc("Water damage cleanup"); svc("Mold remediation"); svc("Fire & smoke restoration");
  const pb = (service: string, name: string, price: number, floor: number) => db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?,?)").run(uid("pb"), wsId, service, name, "job", price, floor);
  pb(s1, "Water extraction & drying", 3200, 2600); pb(s1, "Dehumidification (per day)", 450, 350);
  db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body) VALUES (?,?,?,?,?,?)").run(uid("tpl"), wsId, s1, "proposal", "Standard Proposal", "Scope: {{scope}}\nLine items from price book.\nTerms: Net 14, proposal valid 14 days.");
}
function membershipsOf(userId: string) { return db.prepare("SELECT m.workspace_id, m.role, w.name FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY m.created_at").all(userId); }
function ensureMembership(user: any) { const ex = db.prepare("SELECT * FROM memberships WHERE user_id=? AND workspace_id=?").get(user.id, user.workspace_id); if (!ex) db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(user.id, user.workspace_id, user.role, now()); }
app.post("/api/auth/register", (req: any, res) => {
  const { name, email, password, business_name } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(422).json({ error: { code: "invalid", message: "Name, email and an 8+ character password are required." } });
  if (db.prepare("SELECT id FROM users WHERE email=?").get(email)) return res.status(409).json({ error: { code: "email_taken" } });
  const wsId = uid("ws"); db.prepare("INSERT INTO workspaces (id,name,vertical,timezone,created_at) VALUES (?,?,?,?,?)").run(wsId, business_name || name + "'s Business", "field-services", "America/New_York", now());
  workspaceDefaults(wsId); ensureSubscription(wsId);
  const userId = uid("usr"); db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit) VALUES (?,?,?,?,?,?,?)").run(userId, wsId, name, email, hashPassword(password), "OWNER", 100000);
  db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(userId, wsId, "OWNER", now());
  const sid = uid("ses"); db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, userId, now(), new Date(Date.now() + 7 * 86400000).toISOString());
  res.setHeader("Set-Cookie", `lf_session=${sid}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`);
  const vraw = issueAuthToken(userId, "verify", 24);
  queueAndDeliver(wsId, { channel: "email", to: email, subject: "Verify your Workpile email", body: `Welcome to Workpile, ${name}!\n\nConfirm your email: ${req.protocol}://${req.get("host")}/app?verify=${vraw}` }).catch(() => {});
  res.status(201).json({ user: { id: userId, name, email, role: "OWNER", workspace_id: wsId }, workspaces: membershipsOf(userId) });
});
app.get("/api/workspaces", requireAuth, (req: any, res) => { ensureMembership(req.user); res.json({ current: req.user.workspace_id, workspaces: membershipsOf(req.user.id) }); });
app.post("/api/workspaces", requireAuth, (req: any, res) => {
  const wsId = uid("ws"); db.prepare("INSERT INTO workspaces (id,name,vertical,timezone,created_at) VALUES (?,?,?,?,?)").run(wsId, req.body.name || "New Business", "field-services", "America/New_York", now());
  workspaceDefaults(wsId); ensureSubscription(wsId);
  db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(req.user.id, wsId, "OWNER", now());
  db.prepare("UPDATE users SET workspace_id=?, role='OWNER' WHERE id=?").run(wsId, req.user.id);
  res.status(201).json({ workspace_id: wsId, workspaces: membershipsOf(req.user.id) });
});
app.post("/api/workspaces/switch", requireAuth, (req: any, res) => {
  const m = db.prepare("SELECT * FROM memberships WHERE user_id=? AND workspace_id=?").get(req.user.id, req.body.workspace_id) as any;
  if (!m) return res.status(403).json({ error: { code: "not_a_member" } });
  db.prepare("UPDATE users SET workspace_id=?, role=? WHERE id=?").run(m.workspace_id, m.role, req.user.id);
  res.json({ ok: true, workspace_id: m.workspace_id, role: m.role });
});
// Demo lead source (stands in for a customer's lead system API; same JSON shape)
app.get("/demo-source/leads", (req: any, res) => {
  const from = req.query.from ? new Date(String(req.query.from)).getTime() : 0;
  const to = req.query.to ? new Date(String(req.query.to)).getTime() : Date.now();
  const first = ["Nina", "Carl", "Dana", "Victor", "Paula", "Henry", "Grace", "Oscar", "Tina", "Walter"];
  const last = ["Shaw", "Reed", "Frost", "Lane", "Boyd", "Hart", "Webb", "Cole", "Nash", "Page"];
  const svcs = ["Water damage cleanup", "Mold remediation", "Fire & smoke restoration", "Storm damage repair"];
  const out: any[] = [];
  for (let i = 0; i < 24; i++) {
    const t = Date.now() - ((i * 37) % 85) * 86400000;
    if (t < from || t > to) continue;
    const phone = i < 3 ? `+1516555010${i + 1}` : `+15165557${String(100 + i)}`; // first 3 deliberately collide with seeded leads (dedupe proof)
    out.push({ contact: { name: `${first[i % 10]} ${last[(i * 3) % 10]}`, phone, email: `sync${i}@example.com` }, service_requested: svcs[i % 4], est_value: 1200 + (i * 733) % 15000, message: "Synced from source system", location: "Long Island, NY", source: "api-sync", created_at: new Date(t).toISOString() });
  }
  res.json(out);
});
app.post("/api/sync/run", requireAuth, async (req: any, res) => {
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const from = req.body.from || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = req.body.to || new Date().toISOString();
  const base = `${req.protocol}://${req.get("host")}`;
  const url = ws.source_api_url || `${base}/demo-source/leads`;
  let rows: any[] = [];
  try { const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: ws.source_api_key ? { Authorization: `Bearer ${ws.source_api_key}` } : {} }); if (!r.ok) return res.status(502).json({ error: { code: "source_error", message: `Source returned ${r.status}` } }); rows = await r.json(); if (!Array.isArray(rows)) return res.status(502).json({ error: { code: "source_shape", message: "Source must return a JSON array of leads." } }); }
  catch (e: any) { return res.status(502).json({ error: { code: "source_unreachable", message: String(e.message || e) } }); }
  let created = 0, duplicates = 0, errors = 0;
  for (const row of rows) { try { const r = createLead(req.user.workspace_id, req.user.id, row); r.duplicate ? duplicates++ : created++; } catch { errors++; } }
  const stats = { fetched: rows.length, created, duplicates, errors, from, to, at: now(), source: ws.source_api_url ? "custom" : "demo" };
  db.prepare("UPDATE workspaces SET last_sync_at=?, last_sync_stats=? WHERE id=?").run(stats.at, JSON.stringify(stats), ws.id);
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("imp"), ws.id, "api-sync", "{}", JSON.stringify({ created, dupes: duplicates }), "committed", now());
  res.json(stats);
});
app.post("/api/ai/cleanup/preview", requireAuth, (req: any, res) => res.json(cleanupPreview(req.user.workspace_id)));
app.post("/api/ai/cleanup/apply", requireAuth, (req: any, res) => res.json(cleanupApply(req.user.workspace_id, req.user.id, req.body.actions || [])));
app.post("/api/ai/reactivate", requireAuth, (req: any, res) => res.json(reactivateStale(req.user.workspace_id, req.user.id)));

// ---------- slice 8: outbound comms, password reset, notifications ----------
app.get("/api/comms/status", requireAuth, (_req: any, res) => res.json({ email: emailConfigured() ? "configured" : "test_mode", sms: smsConfigured() ? "configured" : "test_mode", note: "Test mode records messages in the outbox without sending — set RESEND_API_KEY / TWILIO_* on the server to go live." }));
app.post("/api/leads/:id/message", requireAuth, async (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const v = leadView(l); const channel = req.body.channel === "sms" ? "sms" : "email";
  const to = channel === "sms" ? v.contact_phone : v.contact_email;
  if (!to) return res.status(422).json({ error: { code: "no_destination", message: `Lead has no ${channel === "sms" ? "phone" : "email"} on file` } });
  if (channel === "sms" && !l.consent_contact_ok) return res.status(422).json({ error: { code: "consent_required", message: "TCPA: this lead has not consented to text messages" } });
  const r: any = await queueAndDeliver(req.user.workspace_id, { lead_id: l.id, channel, to, subject: req.body.subject, body: String(req.body.body || "") });
  logEvent(req.user.workspace_id, l.id, req.user.id, "message_" + channel, null, null, { status: r.status, to });
  res.status(201).json({ id: r.id, status: r.status, channel, to });
});
app.get("/api/leads/:id/messages", requireAuth, (req: any, res) => { res.json(db.prepare("SELECT * FROM messages_outbox WHERE lead_id=? AND workspace_id=? ORDER BY created_at DESC").all(req.params.id, req.user.workspace_id)); });
app.post("/api/proposals/:id/send", requireAuth, async (req: any, res) => {
  const p = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!p) return res.status(404).json({ error: { code: "not_found" } });
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any; const v = leadView(l);
  const token = ensureSignToken(p.id);
  const base = `${req.protocol}://${req.get("host")}`;
  const link = `${base}/sign/${token}`;
  const channel = req.body.channel === "sms" ? "sms" : "email";
  const to = channel === "sms" ? v.contact_phone : v.contact_email;
  if (!to) return res.status(422).json({ error: { code: "no_destination" } });
  if (channel === "sms" && !l.consent_contact_ok) return res.status(422).json({ error: { code: "consent_required", message: "TCPA: this lead has not consented to text messages" } });
  const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const body = channel === "sms"
    ? `${ws.name}: your proposal ($${p.total}) is ready to review & sign: ${link}`
    : `Hi ${v.contact_name || "there"},\n\nYour proposal from ${ws.name} is ready — total $${p.total}.\nReview and sign securely here: ${link}\n\nQuestions? Just reply to this email.`;
  const r: any = await queueAndDeliver(req.user.workspace_id, { lead_id: l.id, channel, to, subject: `Your proposal from ${ws.name} — $${p.total}`, body });
  db.prepare("UPDATE proposals SET status='sent' WHERE id=?").run(p.id);
  if (l.state === "APPROVED") { const t: any = transition(req.user.workspace_id, req.user.id, l, "PROPOSAL_SENT"); if (t.error) { /* stay APPROVED */ } }
  enrollFollowup(req.user.workspace_id, l.id, p.id);
  logEvent(req.user.workspace_id, l.id, req.user.id, "proposal_sent", null, null, { channel, status: r.status });
  res.status(201).json({ status: r.status, channel, to, sign_link: link });
});
app.get("/api/notifications", requireAuth, (req: any, res) => {
  const rows = db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50").all(req.user.id);
  const unread = (db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL").get(req.user.id) as any).c;
  res.json({ notifications: rows, unread });
});
app.post("/api/notifications/:id/read", requireAuth, (req: any, res) => { db.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").run(now(), req.params.id, req.user.id); res.json({ ok: true }); });
app.post("/api/notifications/read-all", requireAuth, (req: any, res) => { db.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL").run(now(), req.user.id); res.json({ ok: true }); });
// --- password reset + email verification ---
const tokenHash = (raw: string) => createHash("sha256").update(raw).digest("hex");
function issueAuthToken(userId: string, kind: string, hours = 1) {
  const raw = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO auth_tokens (id,user_id,kind,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").run(uid("tok"), userId, kind, tokenHash(raw), new Date(Date.now() + hours * 3600000).toISOString(), now());
  return raw;
}
app.post("/api/auth/forgot", async (req: any, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=? AND active=1").get(String(req.body.email || "").toLowerCase()) as any;
  if (u) {
    const raw = issueAuthToken(u.id, "reset", 1);
    const link = `${req.protocol}://${req.get("host")}/app?reset=${raw}`;
    await queueAndDeliver(u.workspace_id, { channel: "email", to: u.email, subject: "Reset your Workpile password", body: `Hi ${u.name},\n\nReset your password within the next hour: ${link}\n\nIf you didn't ask for this, ignore this email.` });
    if (!emailConfigured()) return res.json({ ok: true, test_mode: true, reset_url: link, message: "Email is in test mode on this deployment, so the reset link is shown here instead of emailed." });
  }
  res.json({ ok: true });
});
app.post("/api/auth/reset", (req: any, res) => {
  const t = db.prepare("SELECT * FROM auth_tokens WHERE token_hash=? AND kind='reset' AND used_at IS NULL").get(tokenHash(String(req.body.token || ""))) as any;
  if (!t || t.expires_at < now()) return res.status(400).json({ error: { code: "invalid_or_expired_token" } });
  if (String(req.body.password || "").length < 8) return res.status(422).json({ error: { code: "weak_password", message: "Use at least 8 characters" } });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(String(req.body.password)), t.user_id);
  db.prepare("UPDATE auth_tokens SET used_at=? WHERE id=?").run(now(), t.id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(t.user_id);
  res.json({ ok: true });
});
app.post("/api/auth/verify", (req: any, res) => {
  const t = db.prepare("SELECT * FROM auth_tokens WHERE token_hash=? AND kind='verify' AND used_at IS NULL").get(tokenHash(String(req.body.token || ""))) as any;
  if (!t || t.expires_at < now()) return res.status(400).json({ error: { code: "invalid_or_expired_token" } });
  db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(t.user_id);
  db.prepare("UPDATE auth_tokens SET used_at=? WHERE id=?").run(now(), t.id);
  res.json({ ok: true });
});
app.post("/api/auth/resend-verify", requireAuth, async (req: any, res) => {
  const raw = issueAuthToken(req.user.id, "verify", 24);
  const link = `${req.protocol}://${req.get("host")}/app?verify=${raw}`;
  const r: any = await queueAndDeliver(req.user.workspace_id, { channel: "email", to: req.user.email, subject: "Verify your Workpile email", body: `Hi ${req.user.name},\n\nConfirm your email: ${link}` });
  res.json({ ok: true, delivery: r.status, ...(!emailConfigured() ? { verify_url: link } : {}) });
});

// ---------- slice 7: two-way API, OpenAPI, integrations catalog ----------
app.get("/v1/leads", requireApiKey(["leads:read"]), (req: any, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
  const rows = db.prepare("SELECT * FROM leads WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?").all(req.workspace_id, limit) as any[];
  const filtered = req.query.state ? rows.filter(l => l.state === req.query.state) : rows;
  res.json({ data: filtered.map(l => leadView(l)), count: filtered.length });
});
app.get("/v1/leads/:id", requireApiKey(["leads:read"]), (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  res.json(leadView(l));
});
app.post("/v1/leads/:id/outcome", requireApiKey(["outcomes:write"]), (req: any, res) => {
  // Two-way sync: their system pushes a final outcome BACK (e.g. job done in their platform).
  // suppressOutcome: the final is recorded here without echoing a fresh handoff delivery back to them.
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const map: Record<string, string> = { won: "WON", lost: "LOST", no_response: "NO_RESPONSE", na_unserviceable: "UNSERVICEABLE", junk: "JUNK", duplicate: "DUPLICATE" };
  const to = map[String(req.body.outcome || "").toLowerCase()];
  if (!to) return res.status(422).json({ error: { code: "bad_outcome", allowed: Object.keys(map) } });
  const extra: any = { lost_reason: req.body.reason_code || null, outcome_reason_detail: "Pushed from external system via API" };
  if (req.body.external_ref && !l.external_id) extra.external_id = String(req.body.external_ref);
  if (FINAL_STATES.includes(l.state)) return res.status(409).json({ error: { code: "already_final", state: l.state } });
  // The pushing system is the source of truth for this final: finalize directly from any
  // open state (the interactive state machine stays strict for in-app transitions).
  const sets = ["state=?", "updated_at=?", ...Object.keys(extra).map(k => `${k}=?`)];
  db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(to, now(), ...Object.values(extra), l.id);
  const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(l.id) as any;
  logEvent(req.workspace_id, l.id, "api", "state_changed", l.state, to, { origin: "api_outcome_push" });
  finalizeLead(req.workspace_id, "api", updated, to);
  emitEvent(req.workspace_id, "lead.state_changed", { lead_id: l.id, from_state: l.state, to_state: to, origin: "api" });
  res.json({ ok: true, lead_id: l.id, state: to, origin: "api" });
});
app.post("/v1/inbox", requireApiKey(["leads:write"]), (req: any, res) => {
  const e = req.body; const parsed = parseEmail(e);
  if (parsed.is_lead) { const r = createLead(req.workspace_id, "inbox-api", { contact: { name: e.from_name || "", phone: parsed.phone, email: e.from_email || "" }, service_requested: "", message: `${e.subject || ""}\n${e.body || ""}`, source: "email-api", created_at: e.received_at }); return res.status(201).json({ category: "lead", lead_id: r.lead.id, duplicate: r.duplicate }); }
  const id = uid("inb"); db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(id, req.workspace_id, parsed.category, e.from_name || "", e.from_email || "", e.subject || "", e.body || "", null, new Date(Date.now() + 86400000).toISOString(), e.received_at || now(), now());
  res.status(201).json({ category: parsed.category, inbox_item_id: id });
});
app.get("/openapi.json", (_req: any, res) => res.json(OPENAPI_SPEC));
app.post("/api/integrations/slack/test", requireAuth, async (req: any, res) => {
  const ws = db.prepare("SELECT slack_webhook_url FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  if (!ws?.slack_webhook_url) return res.status(400).json({ error: { code: "no_slack_url", message: "Save a Slack webhook URL first" } });
  try { const r = await fetch(ws.slack_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "✅ Workpile test message — Slack notifications are connected." }) }); res.json({ ok: r.ok, status: r.status }); }
  catch (e: any) { res.status(502).json({ error: { code: "slack_unreachable", message: String(e.message || e) } }); }
});
app.get("/api/integrations", requireAuth, (req: any, res) => {
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const keys = (db.prepare("SELECT COUNT(*) c FROM api_keys WHERE workspace_id=? AND revoked_at IS NULL").get(req.user.workspace_id) as any).c;
  const eps = (db.prepare("SELECT COUNT(*) c FROM webhook_endpoints WHERE workspace_id=? AND active=1").get(req.user.workspace_id) as any).c;
  res.json({ integrations: [
    { id: "rest_api", name: "REST API (two-way)", status: keys ? "connected" : "not_configured", detail: "Create + read leads, push outcomes back, pull finals. Bearer API keys with scopes. Spec at /openapi.json" },
    { id: "webhooks", name: "Event Webhooks", status: eps ? "connected" : "not_configured", detail: "HMAC-signed push events: " + EVENTS.join(", ") },
    { id: "sync", name: "Lead Sync (pull)", status: ws.source_api_url ? "connected" : "demo_source", detail: ws.last_sync_at ? "Last sync " + ws.last_sync_at : "Date-range pull from your lead system; daily auto-sync available." },
    { id: "csv", name: "CSV Import / Export", status: "connected", detail: "Backlog import with dedupe, plus full report exports." },
    { id: "embed", name: "Website Form Embed", status: "connected", detail: "TCPA-consented lead capture snippet for any website." },
    { id: "email_in", name: "Email-In API", status: "connected", detail: "POST /v1/inbox — every message AI-triaged into a lead or an owned item." },
    { id: "gmail_outlook", name: "Gmail + Outlook", status: ws.gmail_refresh_token || ws.ms_refresh_token ? "connected" : "not_configured", detail: "OAuth connectors; activate with platform credentials." },
    { id: "slack", name: "Slack Notifications", status: ws.slack_webhook_url ? "connected" : "not_configured", detail: "New-lead and approval alerts to any Slack channel." },
    { id: "stripe", name: "Stripe", status: process.env.STRIPE_SECRET_KEY ? "connected" : "test_mode", detail: "Deposits on signature + Workpile subscriptions." },
    { id: "zapier_make", name: "Zapier / Make / n8n", status: "connected", detail: "Works today through the REST API + webhooks — thousands of apps reachable." },
    { id: "handoff", name: "Final Outcome Handoff", status: eps ? "connected" : "not_configured", detail: "Won → project package into their platform, ack-tracked; every final delivered." },
    { id: "quickbooks", name: "QuickBooks Online", status: process.env.QBO_CLIENT_ID ? "ready" : "not_configured", detail: "Won jobs become invoice drafts in QBO. Activates with Intuit app credentials; sync engine ships with the credentials." },
    { id: "booking", name: "Online Booking Page", status: ws.booking_enabled ? "connected" : "not_configured", detail: "Public page where customers book site visits — every booking lands as an owned lead with the visit scheduled." },
    { id: "receptionist", name: "Speed-to-Lead (missed calls)", status: keys ? "connected" : "not_configured", detail: "Your phone system POSTs /v1/missed-call; Workpile creates the lead and texts the caller back in under a minute — the 3-minute rule, automated." },
  ] });
});
const OPENAPI_SPEC: any = { openapi: "3.0.0", info: { title: "Workpile API", version: "1.0.0", description: "Two-way integration API for Workpile. Base URL https://workpile.io — Bearer API key from Settings → Integrations." }, servers: [{ url: "https://workpile.io" }], paths: {
  "/v1/leads": { post: { summary: "Create lead — idempotent, deduped by phone/email", security: [{ bearer: [] }] }, get: { summary: "List leads (leads:read)", security: [{ bearer: [] }] } },
  "/v1/leads/{id}": { get: { summary: "Get one lead (leads:read)", security: [{ bearer: [] }] } },
  "/v1/leads/{id}/outcome": { post: { summary: "Push a final outcome back into Workpile (outcomes:write)", security: [{ bearer: [] }] } },
  "/v1/inbox": { post: { summary: "Ingest an email for AI triage (leads:write)", security: [{ bearer: [] }] } },
  "/v1/outcomes": { get: { summary: "Pull final outcomes (outcomes:read)", security: [{ bearer: [] }] } },
  "/v1/outcomes/{id}/ack": { post: { summary: "Acknowledge outcome with your system ID (outcomes:read)", security: [{ bearer: [] }] } },
  "/v1/projects/{leadId}": { get: { summary: "Won lead project package (projects:read)", security: [{ bearer: [] }] } },
}, components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } } };

// ---------- slice 5: scale + CRUD + settings (competitor-grade UX data layer) ----------
// Paginated leads: GET /api/leads?paged=1&page=1&page_size=50&state=&q=&owner_id=&service=&sort=value|recent
app.patch("/api/leads/:id", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(403).json({ error: { code: "permission_denied", permission: "leads_scope" } });
  const fields = ["service_requested", "est_value", "urgency", "value_band", "owner_id", "pm_id", "approver_id", "next_action", "next_action_due_at", "notes", "location", "sector"];
  const sets: string[] = [], vals: any[] = [];
  for (const f of fields) if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  if (req.body.contact) { const c = req.body.contact; db.prepare("UPDATE contacts SET name=COALESCE(?,name), phone=COALESCE(?,phone), email=COALESCE(?,email), address=COALESCE(?,address) WHERE id=?").run(c.name ?? null, c.phone ?? null, c.email ?? null, c.address ?? null, l.contact_id); }
  if (sets.length) { sets.push("updated_at=?"); vals.push(now(), l.id); db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(...vals); }
  audit(req.user.workspace_id, req.user.id, "lead.edit", "lead", l.id, req.body);
  res.json({ lead: leadView(db.prepare("SELECT * FROM leads WHERE id=?").get(l.id)) });
});
app.post("/api/tasks", requireAuth, (req: any, res) => { const id = uid("tsk"); db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.lead_id || null, req.body.assignee_id || req.user.id, req.body.type || "follow_up", req.body.title || "Follow up", req.body.due_at || new Date(Date.now() + 86400000).toISOString(), "open", now()); res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id=?").get(id)); });
app.delete("/api/tasks/:id", requireAuth, (req: any, res) => { db.prepare("DELETE FROM tasks WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/leads/:id/visits", requireAuth, (req: any, res) => { const id = uid("vis"); db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.params.id, req.body.assigned_to || null, req.body.scheduled_at, "scheduled", req.body.notes || ""); res.status(201).json(db.prepare("SELECT * FROM site_visits WHERE id=?").get(id)); });
app.post("/api/leads/:id/documents", requireAuth, (req: any, res) => { const id = uid("doc"); db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.params.id, req.body.name, req.body.required ? 1 : 0, req.body.status || "missing"); res.status(201).json(db.prepare("SELECT * FROM documents WHERE id=?").get(id)); });
app.patch("/api/documents/:id", requireAuth, (req: any, res) => { db.prepare("UPDATE documents SET status=?, received_at=? WHERE id=? AND workspace_id=?").run(req.body.status, req.body.status === "received" ? now() : null, req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Price book / templates / services CRUD
app.post("/api/price-book", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("pb"); db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.service_id || null, req.body.name, req.body.unit || "job", req.body.standard_price || 0, req.body.floor_price || 0); res.status(201).json(db.prepare("SELECT * FROM price_book_items WHERE id=?").get(id)); });
app.patch("/api/price-book/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { const b = req.body; db.prepare("UPDATE price_book_items SET name=COALESCE(?,name), unit=COALESCE(?,unit), standard_price=COALESCE(?,standard_price), floor_price=COALESCE(?,floor_price) WHERE id=? AND workspace_id=?").run(b.name ?? null, b.unit ?? null, b.standard_price ?? null, b.floor_price ?? null, req.params.id, req.user.workspace_id); res.json(db.prepare("SELECT * FROM price_book_items WHERE id=?").get(req.params.id)); });
app.delete("/api/price-book/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM price_book_items WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/templates", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("tpl"); db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body,version,active) VALUES (?,?,?,?,?,?,1,1)").run(id, req.user.workspace_id, req.body.service_id || null, req.body.kind || "proposal", req.body.name, req.body.body || ""); res.status(201).json(db.prepare("SELECT * FROM templates WHERE id=?").get(id)); });
app.patch("/api/templates/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { const b = req.body; db.prepare("UPDATE templates SET name=COALESCE(?,name), body=COALESCE(?,body), active=COALESCE(?,active), version=version+1 WHERE id=? AND workspace_id=?").run(b.name ?? null, b.body ?? null, b.active === undefined ? null : (b.active ? 1 : 0), req.params.id, req.user.workspace_id); res.json(db.prepare("SELECT * FROM templates WHERE id=?").get(req.params.id)); });
app.delete("/api/templates/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM templates WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.get("/api/services", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM services WHERE workspace_id=?").all(req.user.workspace_id)));
app.post("/api/services", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,1,?)").run(id, req.user.workspace_id, req.body.name, req.body.is_catalog === false ? 0 : 1); res.status(201).json(db.prepare("SELECT * FROM services WHERE id=?").get(id)); });
app.patch("/api/services/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("UPDATE services SET name=COALESCE(?,name), active=COALESCE(?,active) WHERE id=? AND workspace_id=?").run(req.body.name ?? null, req.body.active === undefined ? null : (req.body.active ? 1 : 0), req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Team CRUD
app.post("/api/users", requireAuth, (req: any, res) => { if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "owner_or_admin" } }); const id = uid("usr"); db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.name, req.body.email, hashPassword(req.body.password || "changeme123"), req.body.role || "LEAD_OWNER", req.body.approval_limit || 0); res.status(201).json({ id, name: req.body.name, email: req.body.email, role: req.body.role || "LEAD_OWNER" }); });
app.patch("/api/users/:id", requireAuth, (req: any, res) => { if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "owner_or_admin" } }); db.prepare("UPDATE users SET role=COALESCE(?,role), approval_limit=COALESCE(?,approval_limit), active=COALESCE(?,active) WHERE id=? AND workspace_id=?").run(req.body.role ?? null, req.body.approval_limit ?? null, req.body.active === undefined ? null : (req.body.active ? 1 : 0), req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Workspace settings
app.get("/api/settings", requireAuth, (req: any, res) => { const ws: any = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id); if (ws) ws.booking_slug = ensureBookingSlug(ws); const counts = db.prepare("SELECT (SELECT COUNT(*) FROM leads WHERE workspace_id=?) leads, (SELECT COUNT(*) FROM users WHERE workspace_id=?) users, (SELECT COUNT(*) FROM price_book_items WHERE workspace_id=?) price_items").get(req.user.workspace_id, req.user.workspace_id, req.user.workspace_id); res.json({ workspace: ws, counts }); });
app.patch("/api/settings", requireAuth, needPerm("can_settings"), (req: any, res) => { if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only" } }); const b = req.body; db.prepare("UPDATE workspaces SET name=COALESCE(?,name), vertical=COALESCE(?,vertical), timezone=COALESCE(?,timezone), deposit_pct=COALESCE(?,deposit_pct), autonomy_level=COALESCE(?,autonomy_level), source_api_url=COALESCE(?,source_api_url), source_api_key=COALESCE(?,source_api_key), sync_enabled=COALESCE(?,sync_enabled), slack_webhook_url=COALESCE(?,slack_webhook_url), from_name=COALESCE(?,from_name), from_email=COALESCE(?,from_email), followup_enabled=COALESCE(?,followup_enabled), followup_steps=COALESCE(?,followup_steps), review_url=COALESCE(?,review_url), review_on_won=COALESCE(?,review_on_won), booking_enabled=COALESCE(?,booking_enabled) WHERE id=?").run(b.name ?? null, b.vertical ?? null, b.timezone ?? null, b.deposit_pct ?? null, b.autonomy_level ?? null, b.source_api_url ?? null, b.source_api_key ?? null, b.sync_enabled === undefined ? null : (b.sync_enabled ? 1 : 0), b.slack_webhook_url ?? null, b.from_name ?? null, b.from_email ?? null, b.followup_enabled === undefined ? null : (b.followup_enabled ? 1 : 0), b.followup_steps === undefined ? null : JSON.stringify(b.followup_steps), b.review_url ?? null, b.review_on_won === undefined ? null : (b.review_on_won ? 1 : 0), b.booking_enabled === undefined ? null : (b.booking_enabled ? 1 : 0), req.user.workspace_id); res.json(db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id)); });

// API keys management
app.get("/api/api-keys", requireAuth, (req: any, res) => res.json(db.prepare("SELECT id,label,scopes,last_used_at,revoked_at FROM api_keys WHERE workspace_id=?").all(req.user.workspace_id)));
app.post("/api/api-keys", requireAuth, (req: any, res) => { const raw = "lf_" + randomBytes(18).toString("hex"); const id = uid("key"); db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run(id, req.user.workspace_id, req.body.label || "Integration key", apiKeyHash(raw), req.body.scopes || "leads:write outcomes:read projects:read"); res.status(201).json({ id, key: raw, note: "Shown once — store it in your system's secret manager." }); });
app.delete("/api/api-keys/:id", requireAuth, (req: any, res) => { db.prepare("UPDATE api_keys SET revoked_at=? WHERE id=? AND workspace_id=?").run(now(), req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.get("/api/imports", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM imports WHERE workspace_id=? ORDER BY created_at DESC").all(req.user.workspace_id)));

// Dashboard aggregate (§10 + drill-down data)
app.get("/api/dashboard", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const m = metrics(ws);
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(ws) as any[];
  const days: any[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); const key = d.toISOString().slice(0, 10); days.push({ day: key.slice(5), created: leads.filter(l => String(l.created_at).slice(0, 10) === key).length, won: leads.filter(l => l.state === "WON" && String(l.updated_at).slice(0, 10) === key).length }); }
  const funnelOrder = ["NEW", "TRIAGED", "QUALIFYING", "QUALIFIED", "READY_FOR_APPROVAL", "APPROVED", "PROPOSAL_SENT", "WON"];
  const funnel = funnelOrder.map(s => ({ state: s, count: m.by_state[s] || 0, value: leads.filter(l => l.state === s).reduce((x, l) => x + (l.est_value || 0), 0) }));
  const wonValue = leads.filter(l => l.state === "WON").reduce((x, l) => x + (l.est_value || 0), 0);
  const byService = (db.prepare("SELECT service_requested service, COUNT(*) leads, SUM(CASE WHEN state='WON' THEN 1 ELSE 0 END) won, SUM(est_value) value FROM leads WHERE workspace_id=? GROUP BY service_requested ORDER BY leads DESC LIMIT 8").all(ws));
  const recent = db.prepare("SELECT e.*, l.service_requested, c.name contact_name FROM lead_events e LEFT JOIN leads l ON l.id=e.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE e.workspace_id=? ORDER BY e.created_at DESC LIMIT 12").all(ws);
  const approvalsPending = db.prepare("SELECT a.*, l.service_requested, l.est_value FROM approvals a LEFT JOIN leads l ON l.id=a.lead_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at LIMIT 5").all(ws);
  res.json({ metrics: m, series: days, funnel, won_value: wonValue, avg_won_value: m.won ? Math.round(wonValue / m.won) : 0, by_service: byService, recent_events: recent, approvals_pending: approvalsPending });
});

// Reports (§ Salesforce-parity: tabular reports + CSV export)
app.get("/api/status-report", requireAuth, (req: any, res) => {
  try { res.json(weeklyReport(req.user.workspace_id, req.query.week ? String(req.query.week) : undefined)); }
  catch (e: any) { res.status(500).json({ error: { code: "report_failed", message: String(e?.message || e) } }); }
});
app.get("/api/reports", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const kind = String(req.query.dataset || "by_owner");
  const Q: Record<string, string> = {
    by_owner: "SELECT COALESCE(u.name,'Unassigned') label, COUNT(*) leads, SUM(CASE WHEN l.state='WON' THEN 1 ELSE 0 END) won, SUM(CASE WHEN l.state='LOST' THEN 1 ELSE 0 END) lost, SUM(l.est_value) value, SUM(CASE WHEN l.state='WON' THEN l.est_value ELSE 0 END) won_value FROM leads l LEFT JOIN users u ON u.id=l.owner_id WHERE l.workspace_id=? GROUP BY label ORDER BY leads DESC",
    by_service: "SELECT service_requested label, COUNT(*) leads, SUM(CASE WHEN state='WON' THEN 1 ELSE 0 END) won, SUM(CASE WHEN state='LOST' THEN 1 ELSE 0 END) lost, SUM(est_value) value, SUM(CASE WHEN state='WON' THEN est_value ELSE 0 END) won_value FROM leads WHERE workspace_id=? GROUP BY service_requested ORDER BY leads DESC",
    by_stage: "SELECT state label, COUNT(*) leads, SUM(est_value) value FROM leads WHERE workspace_id=? GROUP BY state ORDER BY leads DESC",
    by_source: "SELECT COALESCE(s.name,'Unknown') label, COUNT(*) leads, SUM(CASE WHEN l.state='WON' THEN 1 ELSE 0 END) won, SUM(CASE WHEN l.state='LOST' THEN 1 ELSE 0 END) lost, SUM(l.est_value) value, SUM(CASE WHEN l.state='WON' THEN l.est_value ELSE 0 END) won_value FROM leads l LEFT JOIN sources s ON s.id=l.source_id WHERE l.workspace_id=? GROUP BY label ORDER BY won_value DESC",
    lost_reasons: "SELECT COALESCE(lost_reason,'UNSPECIFIED') label, COUNT(*) leads, SUM(est_value) value FROM leads WHERE workspace_id=? AND state IN ('LOST','NO_RESPONSE','UNSERVICEABLE') GROUP BY label ORDER BY leads DESC",
  };
  const rows = db.prepare(Q[kind] || Q.by_owner).all(ws);
  res.json({ dataset: kind, rows });
});
app.get("/api/reports/export", requireAuth, needPerm("can_export"), (req: any, res) => {
  const ws = req.user.workspace_id; const kind = String(req.query.dataset || "by_owner");
  const r = db.prepare("SELECT service_requested, state, est_value, created_at FROM leads WHERE workspace_id=?").all(ws) as any[];
  const csv = "service,state,est_value,created_at\n" + r.map(x => [x.service_requested, x.state, x.est_value, x.created_at].map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  res.type("text/csv").setHeader("Content-Disposition", `attachment; filename="workpile-${kind}.csv"`).send(csv);
});

// ---------- slice 13 (Tier 3): forecast, at-risk, win/loss intel, speed-to-lead ----------
const STAGE_WEIGHTS: Record<string, number> = { NEW: 0.05, TRIAGED: 0.10, QUALIFYING: 0.20, QUALIFIED: 0.35, READY_FOR_APPROVAL: 0.50, APPROVED: 0.65, PROPOSAL_DRAFTED: 0.70, PROPOSAL_SENT: 0.80, IN_FOLLOW_UP: 0.85, ON_HOLD: 0.10 };
app.get("/api/forecast", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const open = db.prepare("SELECT state, COUNT(*) c, COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') GROUP BY state").all(ws) as any[];
  const by_stage = open.map(r => ({ state: r.state, count: r.c, value: r.v, weight: STAGE_WEIGHTS[r.state] ?? 0.05, weighted: Math.round(r.v * (STAGE_WEIGHTS[r.state] ?? 0.05)) }));
  const weighted_pipeline = by_stage.reduce((a, r) => a + r.weighted, 0);
  const raw_pipeline = by_stage.reduce((a, r) => a + r.value, 0);
  const at_risk = db.prepare(`SELECT l.id lead_id, c.name contact_name, l.service_requested, p.total, p.sent_at, CAST((julianday('now') - julianday(COALESCE(p.sent_at, p.created_at))) AS INTEGER) days_waiting FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND l.state IN ('PROPOSAL_SENT','IN_FOLLOW_UP') AND julianday('now') - julianday(COALESCE(p.sent_at, p.created_at)) >= 4 ORDER BY days_waiting DESC LIMIT 8`).all(ws);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const decided = db.prepare("SELECT COUNT(*) c, SUM(CASE WHEN state='WON' THEN 1 ELSE 0 END) w FROM leads WHERE workspace_id=? AND state IN ('WON','LOST') AND updated_at>=?").get(ws, since) as any;
  const topLost = db.prepare("SELECT COALESCE(lost_reason,'UNSPECIFIED') r, COUNT(*) c FROM leads WHERE workspace_id=? AND state IN ('LOST','NO_RESPONSE') AND updated_at>=? GROUP BY r ORDER BY c DESC LIMIT 1").get(ws, since) as any;
  const bestSource = db.prepare("SELECT COALESCE(s.name,'Unknown') name, SUM(l.est_value) v FROM leads l LEFT JOIN sources s ON s.id=l.source_id WHERE l.workspace_id=? AND l.state='WON' GROUP BY name ORDER BY v DESC LIMIT 1").get(ws) as any;
  res.json({ weighted_pipeline, raw_pipeline, by_stage, at_risk, intel: { win_rate_30d: decided.c ? Math.round(100 * (decided.w || 0) / decided.c) : null, decided_30d: decided.c, top_lost_reason: topLost ? { reason: topLost.r, count: topLost.c } : null, best_source: bestSource ? { name: bestSource.name, won_value: bestSource.v } : null } });
});
app.post("/v1/missed-call", requireApiKey(["leads:write"]), async (req: any, res) => {
  const phone = String(req.body.phone || "");
  if (!phone) return res.status(422).json({ error: { code: "phone_required" } });
  const ws = req.workspace_id;
  const digits = phone.replace(/\D/g, "").slice(-10);
  const existing = db.prepare(`SELECT l.* FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND REPLACE(REPLACE(REPLACE(c.phone,'-',''),' ',''),'(','') LIKE ? AND l.state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') ORDER BY l.created_at DESC LIMIT 1`).get(ws, "%" + digits) as any;
  let lead = existing, created = false;
  if (!lead) { const r = createLead(ws, "missed-call", { contact: { name: req.body.name || "", phone, email: req.body.email || "" }, service_requested: req.body.service || "", message: "Missed call — auto text-back sent", source: "missed-call" }); lead = r.lead; created = true; }
  const wsRow = db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws) as any;
  const msg = await queueAndDeliver(ws, { lead_id: lead.id, channel: "sms", to: phone, body: `Hi, this is ${wsRow.name} — sorry we missed your call. How can we help? Reply here and a real person picks it up.` });
  logEvent(ws, lead.id, "missed-call", "speed_to_lead", null, null, { created, status: (msg as any).status });
  notifyOwners(ws, "call.missed", "Missed call — text-back sent ⚡", `${phone} called; an instant text-back went out and the lead is in the pile.`, lead.id);
  res.status(created ? 201 : 200).json({ lead_id: lead.id, created, text_back_status: (msg as any).status });
});
// ---------- slice 16: AI v2 — suggestions, actions, automations, activity ----------
app.get("/api/ai/insights", requireAuth, (req: any, res) => res.json(insightsV2(req.user.workspace_id)));
app.get("/api/ai/suggest/:leadId", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT l.*, c.name contact_name, c.phone contact_phone, c.email contact_email FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.id=? AND l.workspace_id=?").get(req.params.leadId, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const prop = db.prepare("SELECT sent_at, created_at FROM proposals WHERE lead_id=? AND status='sent' ORDER BY version DESC LIMIT 1").get(l.id) as any;
  const sentDays = prop ? Math.floor((Date.now() - new Date(prop.sent_at || prop.created_at).getTime()) / 86400000) : undefined;
  const sc = scoreLead(l);
  res.json({ score: sc.score, temperature: sc.temperature, flags: sc.flags, suggestion: nextBestAction(l, sentDays) });
});
app.post("/api/ai/autofix-next-steps", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const rows = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND next_action_due_at IS NULL AND state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE')").all(ws) as any[];
  const defaults: Record<string, string> = { NEW: "First contact", TRIAGED: "Qualify the request", QUALIFYING: "Qualify the request", QUALIFIED: "Book the site visit", READY_FOR_APPROVAL: "Submit for approval", APPROVED: "Draft the proposal", PROPOSAL_DRAFTED: "Send the proposal", PROPOSAL_SENT: "Proposal follow-up", IN_FOLLOW_UP: "Follow up", ON_HOLD: "Check the hold reason" };
  let fixed = 0;
  for (const l of rows) { db.prepare("UPDATE leads SET next_action=?, next_action_due_at=?, updated_at=? WHERE id=?").run(defaults[l.state] || "Follow up", new Date(Date.now() + 86400000).toISOString(), now(), l.id); logEvent(ws, l.id, req.user.id, "ai_autofix_next_step", null, null, {}); fixed++; }
  res.json({ fixed });
});
app.post("/api/ai/nudge", requireAuth, async (req: any, res) => {
  const ws = req.user.workspace_id;
  const l = db.prepare("SELECT l.*, c.name contact_name, c.phone contact_phone, c.email contact_email FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.id=? AND l.workspace_id=?").get(req.body.lead_id, ws) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC LIMIT 1").get(l.id) as any;
  let steps: any[] = []; try { steps = JSON.parse(w.followup_steps || "[]"); } catch { steps = []; }
  const tpl = (steps[0]?.body) || "Hi {name}, just floating your proposal from {business} back to the top of your inbox — total {total}. Review & sign here: {link}";
  const link = prop ? `${process.env.BASE_URL || ""}/sign/${ensureSignToken(prop.id)}` : "";
  const body = tpl.replaceAll("{name}", (l.contact_name || "there").split(" ")[0]).replaceAll("{business}", w.name || "").replaceAll("{total}", prop ? "$" + Number(prop.total || 0).toLocaleString() : "").replaceAll("{link}", link);
  const channel = l.contact_email ? "email" : "sms";
  const msg: any = await queueAndDeliver(ws, { lead_id: l.id, channel, to: channel === "email" ? l.contact_email : l.contact_phone, subject: channel === "email" ? `Your proposal from ${w.name}` : undefined, body });
  logAgentRun(ws, "nudge", l.id, { channel, status: msg.status });
  res.json({ sent: true, channel, status: msg.status });
});
app.get("/api/ai/automations", requireAuth, (req: any, res) => { const w = db.prepare("SELECT auto_assign, auto_dedupe, auto_reactivate, auto_score, last_automation_at FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; res.json(w); });
app.post("/api/ai/automations", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const fields = ["auto_assign", "auto_dedupe", "auto_reactivate", "auto_score"];
  for (const f of fields) if (req.body[f] !== undefined) db.prepare(`UPDATE workspaces SET ${f}=? WHERE id=?`).run(req.body[f] ? 1 : 0, req.user.workspace_id);
  res.json(db.prepare("SELECT auto_assign, auto_dedupe, auto_reactivate, auto_score, last_automation_at FROM workspaces WHERE id=?").get(req.user.workspace_id));
});
app.post("/api/ai/automations/run", requireAuth, (req: any, res) => res.json({ result: runAutomationsFor(req.user.workspace_id) }));
app.get("/api/ai/runs", requireAuth, (req: any, res) => {
  const runs = db.prepare("SELECT * FROM agent_runs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 20").all(req.user.workspace_id);
  res.json(runs);
});
// ---------- slice 17: proposal document template ----------
app.get("/api/proposal-template", requireAuth, (req: any, res) => res.json(getTemplate(req.user.workspace_id)));
app.put("/api/proposal-template", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const b = req.body || {};
  db.prepare("UPDATE workspaces SET pt_company=?, pt_tagline=?, pt_contact=?, pt_address=?, pt_intro=?, pt_terms=?, pt_footer=? WHERE id=?")
    .run(String(b.company || "").slice(0, 200), String(b.tagline || "").slice(0, 200), String(b.contact_line || "").slice(0, 300), String(b.address || "").slice(0, 300),
      sanitizeHtml(String(b.intro_html || "")), sanitizeHtml(String(b.terms_html || "")), String(b.footer || "").slice(0, 500), req.user.workspace_id);
  res.json(getTemplate(req.user.workspace_id));
});
app.get("/api/proposals/:id/document", requireAuth, (req: any, res) => {
  const d = proposalDocument(req.params.id);
  if (!d || d.workspace_id !== req.user.workspace_id) return res.status(404).json({ error: { code: "not_found" } });
  res.json(d);
});
// ---------- slice 12 (Tier 2): online booking ----------
function ensureBookingSlug(ws: any): string {
  if (ws.booking_slug) return ws.booking_slug;
  const slug = String(ws.name || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + ws.id.slice(-4).toLowerCase();
  db.prepare("UPDATE workspaces SET booking_slug=? WHERE id=?").run(slug, ws.id);
  return slug;
}
app.get("/api/public/book/:slug", (req: any, res) => {
  const ws = db.prepare("SELECT * FROM workspaces WHERE booking_slug=?").get(req.params.slug) as any;
  if (!ws || !ws.booking_enabled) return res.status(404).json({ error: { code: "booking_not_available" } });
  const services = db.prepare("SELECT name FROM services WHERE workspace_id=? AND active=1 ORDER BY name").all(ws.id);
  res.json({ business: ws.name, services });
});
app.post("/api/public/book", async (req: any, res) => {
  const ws = db.prepare("SELECT * FROM workspaces WHERE booking_slug=?").get(String(req.body.slug || "")) as any;
  if (!ws || !ws.booking_enabled) return res.status(404).json({ error: { code: "booking_not_available" } });
  const b = req.body;
  if (!b.name || !(b.phone || b.email)) return res.status(422).json({ error: { code: "name_and_contact_required" } });
  const r = createLead(ws.id, "booking-page", { contact: { name: b.name, phone: b.phone || "", email: b.email || "" }, service_requested: b.service || "", message: b.notes || "", location: b.location || "", source: "online-booking" });
  let visit = null;
  if (b.when) { const vid = uid("vis"); db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?,?)").run(vid, ws.id, r.lead.id, null, b.when, "scheduled", "Booked online by the customer"); visit = vid; }
  notifyOwners(ws.id, "booking.new", "New online booking 📅", `${b.name} booked ${b.service || "a visit"}${b.when ? " for " + b.when : ""}`, r.lead.id);
  res.status(201).json({ ok: true, lead_id: r.lead.id, visit_id: visit, duplicate: r.duplicate });
});
app.patch("/api/team/:id", requireAuth, needPerm("can_manage_team"), (req: any, res) => {
  const t = db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!t) return res.status(404).json({ error: { code: "not_found" } });
  if (t.role === "OWNER" && req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_immutable" } });
  if (req.body.role !== undefined) {
    if (!["OWNER", "ADMIN", "OPS_ADMIN", "APPROVER", "LEAD_OWNER", "PM"].includes(req.body.role)) return res.status(422).json({ error: { code: "bad_role" } });
    if (req.body.role === "OWNER" && req.user.role !== "OWNER") return res.status(403).json({ error: { code: "only_owner_grants_owner" } });
    db.prepare("UPDATE users SET role=? WHERE id=?").run(req.body.role, t.id);
  }
  if (req.body.approval_limit !== undefined) db.prepare("UPDATE users SET approval_limit=? WHERE id=?").run(Number(req.body.approval_limit) || 0, t.id);
  if (req.body.permissions !== undefined) {
    const clean: any = {}; for (const k of PERM_KEYS) if (req.body.permissions[k] !== undefined) clean[k] = req.body.permissions[k];
    db.prepare("UPDATE users SET permissions=? WHERE id=?").run(Object.keys(clean).length ? JSON.stringify(clean) : null, t.id);
  }
  if (req.body.labor_class_id !== undefined) db.prepare("UPDATE users SET labor_class_id=? WHERE id=?").run(req.body.labor_class_id || null, t.id);
  audit(req.user.workspace_id, req.user.id, "team.access_change", "user", t.id, req.body);
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(t.id) as any;
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, approval_limit: u.approval_limit, permissions: permsOf(u), has_overrides: !!u.permissions } });
});
// ---------- slice 11 (Tier 1): bulk actions, two-way texting, push ----------
const NEXT_STATE: Record<string, string> = { NEW: "TRIAGED", TRIAGED: "QUALIFYING", QUALIFYING: "QUALIFIED", QUALIFIED: "READY_FOR_APPROVAL", APPROVED: "PROPOSAL_DRAFTED", PROPOSAL_SENT: "IN_FOLLOW_UP" };
app.post("/api/leads/bulk", requireAuth, (req: any, res) => {
  const ids: string[] = (req.body.ids || []).slice(0, 200); const action = String(req.body.action || "");
  const results = { ok: 0, skipped: 0, details: [] as any[] };
  for (const id of ids) {
    const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(id, req.user.workspace_id) as any;
    if (!l) { results.skipped++; continue; }
    if (scopeOwn(req.user) && !mine(req.user, l)) { results.skipped++; results.details.push({ id, reason: "outside_your_scope" }); continue; }
    if (action === "assign") { db.prepare("UPDATE leads SET owner_id=?, updated_at=? WHERE id=?").run(req.body.owner_id || null, now(), id); logEvent(req.user.workspace_id, id, req.user.id, "bulk_assign", null, null, { owner_id: req.body.owner_id }); results.ok++; }
    else if (action === "snooze") { const d = new Date(Date.now() + (Number(req.body.days) || 7) * 86400000).toISOString(); db.prepare("UPDATE leads SET next_action_due_at=?, updated_at=? WHERE id=?").run(d, now(), id); results.ok++; }
    else if (action === "advance") { const to = NEXT_STATE[l.state]; if (!to) { results.skipped++; results.details.push({ id, reason: "no_forward_step" }); continue; } const r: any = transition(req.user.workspace_id, req.user.id, l, to); if (r.error) { results.skipped++; results.details.push({ id, reason: r.error }); } else results.ok++; }
    else if (action === "archive_junk") { const r: any = transition(req.user.workspace_id, req.user.id, l, "JUNK"); if (r.error) { results.skipped++; } else results.ok++; }
    else { results.skipped++; }
  }
  res.json(results);
});
app.post("/webhooks/twilio/inbound", express.urlencoded({ extended: false }), (req: any, res) => {
  const from = String(req.body.From || ""); const body = String(req.body.Body || "");
  const digits = from.replace(/\D/g, "").slice(-10);
  if (!digits || !body) return res.type("text/xml").send("<Response/>");
  const hit = db.prepare(`SELECT l.id lead_id, l.workspace_id, l.owner_id FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE REPLACE(REPLACE(REPLACE(c.phone,'-',''),' ',''),'(','') LIKE ? ORDER BY l.created_at DESC LIMIT 1`).get("%" + digits) as any;
  if (hit) {
    db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,status,direction,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(uid("msg"), hit.workspace_id, hit.lead_id, "sms", from, null, body, "received", "in", now());
    logEvent(hit.workspace_id, hit.lead_id, "customer", "message_in_sms", null, null, { from });
    stopFollowups(hit.lead_id, "customer_replied");
    notify(hit.workspace_id, [hit.owner_id], "message.reply", "Customer replied 💬", body.slice(0, 140), hit.lead_id);
    notifyOwners(hit.workspace_id, "message.reply", "Customer replied 💬", body.slice(0, 140), hit.lead_id);
  }
  res.type("text/xml").send("<Response/>");
});
app.get("/api/push/key", requireAuth, async (req: any, res) => { try { const m = await import("./push.ts"); res.json({ public_key: m.vapidPublicKey(), configured: m.pushConfigured() }); } catch (e: any) { res.json({ public_key: null, configured: false, error: String(e?.message || e) }); } });
app.post("/api/push/subscribe", requireAuth, async (req: any, res) => { try { const m = await import("./push.ts"); if (!req.body.subscription?.endpoint) return res.status(422).json({ error: { code: "bad_subscription" } }); m.saveSubscription(req.user.id, req.body.subscription); res.json({ ok: true }); } catch (e: any) { res.status(500).json({ error: { code: "push_unavailable" } }); } });
// ---------- slice 10: My Day (personal command center) ----------
app.get("/api/myday", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id, me = req.user.id;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start.getTime() + 86400000).toISOString();
  const overdue_tasks = db.prepare(`SELECT t.*, c.name contact_name, l.service_requested FROM tasks t JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND t.assignee_id=? AND t.status='open' AND t.due_at<? ORDER BY t.due_at LIMIT 12`).all(ws, me, start.toISOString());
  const today_tasks = db.prepare(`SELECT t.*, c.name contact_name, l.service_requested FROM tasks t JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND t.assignee_id=? AND t.status='open' AND t.due_at>=? AND t.due_at<? ORDER BY t.due_at LIMIT 12`).all(ws, me, start.toISOString(), tomorrow);
  const my_leads_due = db.prepare(`SELECT l.*, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.owner_id=? AND l.state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') AND l.next_action_due_at IS NOT NULL AND l.next_action_due_at<? ORDER BY l.next_action_due_at LIMIT 12`).all(ws, me, tomorrow);
  const canApprove = ["OWNER", "APPROVER", "ADMIN"].includes(req.user.role);
  const approvals_waiting = canApprove ? db.prepare(`SELECT a.id, a.lead_id, a.submitted_at, a.tier, c.name contact_name, l.service_requested, l.est_value FROM approvals a JOIN leads l ON l.id=a.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at LIMIT 6`).all(ws) : [];
  const followups_due = db.prepare(`SELECT f.*, c.name contact_name, l.service_requested FROM followup_enrollments f JOIN leads l ON l.id=f.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE f.workspace_id=? AND f.status='active' AND f.next_due_at<? ORDER BY f.next_due_at LIMIT 6`).all(ws, tomorrow);
  const wins = db.prepare(`SELECT COUNT(*) c, COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state='WON' AND updated_at>=?`).get(ws, new Date(Date.now() - 7 * 86400000).toISOString()) as any;
  const yday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  ensureDay(ws, yday);
  const myFr = db.prepare("SELECT * FROM field_reports WHERE workspace_id=? AND manager_id=? AND report_date=?").get(ws, me, yday) as any;
  const field_alert = myFr && myFr.status === "missing" ? { id: myFr.id, report_date: yday } : null;
  const lastWeek = weekStartOf(new Date(Date.now() - 7 * 86400000));
  ensureWeek(ws, lastWeek);
  const myTs = db.prepare("SELECT * FROM timesheets WHERE workspace_id=? AND manager_id=? AND week_of=?").get(ws, me, lastWeek) as any;
  const timesheet_alert = myTs && myTs.status === "missing" ? { week_of: lastWeek } : null;
  const inbox_open = db.prepare(`SELECT * FROM inbox_items WHERE workspace_id=? AND COALESCE(status,'open')='open' AND (owner_id=? OR owner_id IS NULL) ORDER BY next_action_due_at LIMIT 6`).all(ws, me);
  const inbox_count = (db.prepare(`SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND COALESCE(status,'open')='open'`).get(ws) as any).c;
  res.json({ overdue_tasks, today_tasks, my_leads_due, approvals_waiting, approvals_count: approvals_waiting.length, followups_due, wins_week: { count: wins.c, value: wins.v }, inbox_open, inbox_count, timesheet_alert, field_alert });
});
// ---------- slice 9: activity pulse + follow-ups ----------
app.get("/api/activity", requireAuth, (req: any, res) => {
  const rows = db.prepare(`SELECT e.*, e.type AS event_type, c.name contact_name, l.service_requested, u.name actor_name FROM lead_events e JOIN leads l ON l.id=e.lead_id LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN users u ON u.id=e.actor WHERE e.workspace_id=? ORDER BY e.created_at DESC LIMIT 60`).all(req.user.workspace_id);
  res.json({ events: rows });
});
app.get("/api/leads/:id/followups", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM followup_enrollments WHERE lead_id=? AND workspace_id=? ORDER BY created_at DESC").all(req.params.id, req.user.workspace_id)));
app.post("/api/leads/:id/followups/stop", requireAuth, (req: any, res) => { stopFollowups(req.params.id, "manual"); res.json({ ok: true }); });
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "leadflow-os", time: now() }));

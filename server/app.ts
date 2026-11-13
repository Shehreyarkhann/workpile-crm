// Workpile — API application (spec §5 state machine, §6 approvals, §9 proposals, §14 public API, §14.5 handoffs, §25 Gregory P0s)
import express from "express";
import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { db, uid, now, hashPassword, verifyPassword, apiKeyHash, logEvent, audit, withTx } from "./db.ts";
import { triageLead, packetCheck, demandGap, demandPool, injectionScan } from "./agents.ts";
import { metrics, morningBrief } from "./metrics.ts";
import { parseEmail, parseMbox, parseEmailCsv, suggestInboxAction, inboxPriority } from "./inbox.ts";
import { proposalDocx, invoiceDocx } from "./docx.ts";
import { getTemplate, getInvoiceTemplate, proposalDocument, sanitizeHtml, resolveDocTemplateId } from "./proptemplate.ts";
import { ensureSignToken, getByToken, sign } from "./sign.ts";
import { createDeposit, createInvoicePayment, markPaid, verifyStripeSignature, handleStripeEvent, stripeMode } from "./payments.ts";
import { getFlags, setFlag, workspaceHealth, runSynthetics } from "./admin.ts";
import { billingStatus, createCheckout, handleBillingEvent, PLANS, PLAN_ALIASES, planOf, ensureSubscription, seatCheck } from "./billing.ts";
import { cleanupPreview, cleanupApply, insights, insightsV2, reactivateStale, scoreLead, nextBestAction, runAutomationsFor, logAgentRun, agentLevel, AGENT_LEVELS } from "./ai.ts";
import { emitEvent, EVENTS } from "./integrations.ts";
import { queueAndDeliver, notify, notifyOwners, emailConfigured, smsConfigured } from "./comms.ts";
import { weekStartOf, ensureWeek, chaseRow, sumDays } from "./timesheets.ts";
import { touchLead, UNTOUCHED_WHERE } from "./touch.ts";
import { rateFor, logTime, jobLabor, DEFAULT_CLASSES, resolveWorker, listWorkers } from "./labor.ts";
import { ensureDay, chaseReport, todayStr } from "./fieldreports.ts";
import { weeklyReport } from "./statusreport.ts";
import { enrollFollowup, stopFollowups } from "./followups.ts";
import { stopOutreachForLead } from "./outreach.ts";
import { onJobCompleted, onInvoicePaid } from "./lifecycle.ts";
import { labelByKey, applyLabel } from "./labels.ts";
import { registerCrm, registerDocTemplates, registerHome, convertLeadToCustomer, applyAssignmentRules, onLeadCreated } from "./crm.ts";

import { providerStatus, authUrl, listConnections } from "./oauth.ts";

export const app = express();
app.use((req: any, _res, next) => { // capture raw body for Stripe signature verification
  if (req.path === "/webhooks/stripe") { let raw = ""; req.on("data", (c: any) => raw += c); req.on("end", () => { req.rawBody = raw; try { req.body = JSON.parse(raw || "{}"); } catch { req.body = {}; } next(); }); }
  else next();
});
const __json = express.json({ limit: "50mb" });
app.use((req: any, res: any, next: any) => req.path === "/webhooks/stripe" ? next() : __json(req, res, next)); // v52: the Stripe path already consumed + parsed its raw body above; a second parse 500s on the ended stream (the webhook could never actually fire)
// Rate limits (audit S-3): per-IP token buckets for auth + public write surfaces.
const __rl = new Map<string, { n: number; reset: number }>();
function rateLimit(bucket: string, max: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const k = bucket + ":" + (req.ip || "?"); const t = Date.now();
    let b = __rl.get(k); if (!b || t > b.reset) { b = { n: 0, reset: t + windowMs }; __rl.set(k, b); }
    b.n++; if (b.n > max) return res.status(429).json({ error: { code: "rate_limited", message: "Too many requests — slow down and try again in a minute." } });
    next();
  };
}
app.use("/api/auth", rateLimit("auth", 40, 10 * 60 * 1000));
app.use("/api/public", rateLimit("public", 60, 60 * 1000));
app.use("/sign", rateLimit("sign", 60, 60 * 1000));
app.use("/book", rateLimit("book", 60, 60 * 1000));

// ---------- flow v3 (spec v3 §4): free stage movement, soft guardrails ----------
// Stages are labels a human moves freely (any -> any). Control comes from the audit
// trail + finals discipline (reason required, WON confirmation), not a ratchet.
export const STAGES = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
export const OPEN_STAGES = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP"];
// legacy v2 names accepted forever (old clients, bulk advance, integrations map in)
export const LEGACY_STAGE: Record<string, string> = { TRIAGED: "WORKING", QUALIFYING: "WORKING", READY_FOR_APPROVAL: "PROPOSAL", APPROVED: "PROPOSAL", PROPOSAL_DRAFTED: "PROPOSAL", PROPOSAL_SENT: "SENT", IN_FOLLOW_UP: "FOLLOWUP", ON_HOLD: "QUALIFIED" };
export const normStage = (s: string) => LEGACY_STAGE[s] || s;
// kept for import compatibility — v3 has no transition table; any move is allowed
export const TRANSITIONS: Record<string, string[]> = Object.fromEntries(STAGES.map(s => [s, STAGES.filter(x => x !== s)]));
export const FINAL_STATES = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
const OUTCOME_OF: Record<string, string> = { WON: "won", LOST: "lost", NO_RESPONSE: "no_response", UNSERVICEABLE: "na_unserviceable", JUNK: "junk", DUPLICATE: "duplicate" };
const REASON_FINALS = ["LOST", "NO_RESPONSE"];

function dedupeKey(phone?: string, email?: string) { return (phone || "").replace(/\D/g, "") || (email || "").toLowerCase().trim() || ""; }
const moneyFmt = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");
function leadView(l: any) {
  if (!l) return null;
  const c = db.prepare("SELECT name,phone,email FROM contacts WHERE id=?").get(l.contact_id) as any;
  return { ...l, contact_name: c?.name || "", contact_phone: c?.phone || "", contact_email: c?.email || "", line_items: undefined };
}

function createLead(workspaceId: string, actor: string, input: any) {
  const key = dedupeKey(input.contact?.phone, input.contact?.email);
  let possibleDupeOf: string | null = null;
  if (key) {
    const dupe = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND dedupe_key=? AND state!='DUPLICATE'").get(workspaceId, key) as any;
    if (dupe) {
      if ((input as any).bulk) return { lead: leadView(dupe), duplicate: true };
      // W-6: never swallow a new request into a CLOSED lead, or into a different
      // person's record (shared office numbers / info@ addresses). Those become a
      // new lead flagged as a possible duplicate for human review instead.
      const closedDupe = ["WON", "LOST", "NO_RESPONSE"].includes(dupe.state);
      const dupeContact = dupe.contact_id ? (db.prepare("SELECT name FROM contacts WHERE id=?").get(dupe.contact_id) as any)?.name || "" : "";
      const norm = (x: string) => String(x || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
      const a = norm(input.contact?.name), b = norm(dupeContact);
      const nameDiff = !!(a && b && a !== b && !a.includes(b) && !b.includes(a));
      if (!closedDupe && !nameDiff) return { lead: leadView(dupe), duplicate: true };
      possibleDupeOf = dupe.id;
    }
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
  let owner = input.owner_id || owners[0]?.id || null;
  if (!input.owner_id) { try { const ruled = applyAssignmentRules(workspaceId, { service_requested: triage.service_guess, source: input.source, est_value: input.est_value || 0, urgency: triage.urgency }); if (ruled) owner = ruled; } catch { /* rules never block creation */ } }
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
  emitOutbox(workspaceId, "lead.created", id, { source: input.source || "manual", service: triage.service_guess });
  // v3 slice 34: speed-to-lead — instant first touch inside a minute when automations are on (pre-approved template only)
  try { const wsx: any = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId);
    if (wsx?.followup_enabled && agentLevel(wsx) >= 4 && (input.contact?.email || input.contact?.phone)) {
      const ch = input.contact?.phone && input.consent?.contact_ok ? "sms" : (input.contact?.email ? "email" : "sms");
      const to = ch === "sms" ? input.contact?.phone : input.contact?.email;
      if (to) queueAndDeliver(workspaceId, { lead_id: id, channel: ch, to, subject: `We got your request — ${wsx.name}`, body: `Hi ${(input.contact?.name || "there").split(" ")[0]} — thanks for reaching out to ${wsx.name} about ${triage.service_guess || input.service_requested || "your project"}. We've got it, and a real person will call you shortly during business hours (Mon–Fri 8:00–5:30). Reply here any time.` }).catch(() => {});
    } } catch { /* first touch never blocks lead creation */ }
  try { onLeadCreated(workspaceId, id, input); } catch { /* campaigns never block creation */ }
  if (possibleDupeOf) { try { db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("evt"), id, workspaceId, "system", "possible_duplicate", null, null, JSON.stringify({ of: possibleDupeOf, reason: "same phone/email as an existing lead that is closed or under a different name — human review" }), now()); } catch { /* flag is best-effort */ } }
  return { lead: leadView(db.prepare("SELECT * FROM leads WHERE id=?").get(id)), duplicate: false, possible_duplicate_of: possibleDupeOf };
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

// ---- v3 approval policy (§4.4): off | amount (default, threshold) | always ----
export function approvalRequiredFor(workspaceId: string, total: number, actorRole?: string): boolean {
  if (actorRole === "OWNER") return false; // v25: the owner is never approval-gated — unlimited by role
  const ws = db.prepare("SELECT approval_policy, approval_threshold FROM workspaces WHERE id=?").get(workspaceId) as any;
  const policy = ws?.approval_policy || "always";
  if (policy === "off") return false;
  if (policy === "always") return true;
  return (total || 0) > (ws?.approval_threshold ?? 25000);
}
export function pendingApprovalFor(workspaceId: string, proposalId: string) {
  return db.prepare("SELECT * FROM approvals WHERE workspace_id=? AND proposal_id=? AND decision IS NULL ORDER BY submitted_at DESC").get(workspaceId, proposalId);
}
import { createHash as __createHash } from "node:crypto";
import { emitOutbox } from "./outbox.ts";
import { analyzeBacklog } from "./audit.ts";
import { inboxSuggestion, sendInboxReply } from "./inbox-ai.ts";
import { draftProposalForLead } from "./proposals-core.ts";
import { detectActions, executeAction } from "./inbox-actions.ts";
import { AUDIT_PAGE } from "./audit-page.ts";
import { jobStats } from "./jobs.ts";
import { outboxPending } from "./outbox.ts";
export function proposalContentHash(p: any): string {
  return __createHash("sha256").update(JSON.stringify({ li: p.line_items || "", total: p.total || 0, options: p.options || "", deposit: p.deposit_amount || p.deposit_pct || "" })).digest("hex").slice(0, 32);
}
export function approvedApprovalFor(workspaceId: string, proposalId: string) {
  return db.prepare("SELECT * FROM approvals WHERE workspace_id=? AND proposal_id=? AND decision='approved' ORDER BY decided_at DESC").get(workspaceId, proposalId);
}
export function maybeRequestApproval(workspaceId: string, actor: string, lead: any, proposal: any) {
  if (!proposal) return null;
  const actorRole = (db.prepare("SELECT role FROM users WHERE id=?").get(actor) as any)?.role;
  if (!approvalRequiredFor(workspaceId, proposal.total || 0, actorRole)) return null;
  const pend = pendingApprovalFor(workspaceId, proposal.id);
  if (pend) return pend;
  const appr = approvedApprovalFor(workspaceId, proposal.id);
  if (appr) return appr;
  const approver = lead.approver_id || (db.prepare("SELECT id FROM users WHERE workspace_id=? AND role IN ('OWNER','OPS_ADMIN','APPROVER') ORDER BY CASE role WHEN 'OWNER' THEN 0 WHEN 'OPS_ADMIN' THEN 1 ELSE 2 END LIMIT 1").get(workspaceId) as any)?.id;
  const id = uid("apr");
  db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, lead.id, proposal.id, actor, approver, (proposal.total || 0) > 25000 ? "ceo" : "manager", now());
  notify(workspaceId, [approver], "approval.requested", "Approval waiting on you", `${leadView(lead).contact_name || "Lead"} — proposal $${proposal.total ?? ""} needs your decision`, lead.id);
  return db.prepare("SELECT * FROM approvals WHERE id=?").get(id);
}

// ---- setStage: the v3 movement engine. Any stage -> any stage; finals discipline only ----
export function setStage(workspaceId: string, actor: string, lead: any, toRaw: string, extra: any = {}) {
  const toState = normStage(toRaw);
  if (!STAGES.includes(toState)) return { error: `Unknown stage: ${toRaw}`, status: 422 };
  const fromState = normStage(lead.state);
  const wasFinal = FINAL_STATES.includes(fromState);
  const isFinal = FINAL_STATES.includes(toState);
  if (fromState === toState && !extra.force) return { lead: leadView(lead) };
  const force = !!extra.force || actor === "api";
  if (isFinal && !wasFinal && !force) {
    if (REASON_FINALS.includes(toState) && !(extra.lost_reason || lead.lost_reason)) return { error: `${toState} needs a reason — pick one so the loss teaches the team something.`, code: "reason_required", status: 422 };
    if (toState === "WON") {
      const signed = db.prepare("SELECT id FROM proposals WHERE lead_id=? AND signed_at IS NOT NULL").get(lead.id);
      if (!signed && !extra.confirm_no_proposal) return { error: "Marking WON without a signed proposal — confirm this is a verbal/legacy win.", code: "won_needs_confirmation", status: 422 };
    }
  }
  if (toState === "SENT" && !force && actor !== "api") {
    // v68 pipeline discipline: SENT means a proposal actually went out. No
    // proposal, or a proposal still awaiting its required approval, blocks the
    // move — the same gate the send route enforces, now on the stage itself.
    const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any;
    if (!prop) return { error: "This lead has no proposal yet — draft the proposal first, then it can move to Sent.", code: "proposal_required", status: 422 };
    const alreadySent = prop.status === "sent" || !!prop.sent_at || !!prop.signed_at;
    if (!alreadySent) {
      const actorRole = (db.prepare("SELECT role FROM users WHERE id=?").get(actor) as any)?.role;
      const appr = approvedApprovalFor(workspaceId, prop.id);
      const apprStale = !!appr && !!appr.content_hash && appr.content_hash !== proposalContentHash(prop);
      if (approvalRequiredFor(workspaceId, prop.total || 0, actorRole) && (!appr || apprStale))
        return { error: apprStale ? "The proposal was edited after it was approved — it needs a fresh approval before it can be marked Sent." : "The proposal is drafted but not approved yet — it can't be marked Sent until an approver signs off. Send it from the proposal once approved.", code: "proposal_not_approved", status: 422 };
    }
  }
  if (toState === "QUALIFIED" && !lead.qualified_at) extra.qualified_at = now();
  const WRITABLE = ["lost_reason", "outcome_reason_detail", "competitor", "hold_reason", "pm_id", "owner_id", "approver_id", "qualified_at", "next_action", "next_action_due_at"];
  const sets = ["state=?", "stage_changed_at=?", "updated_at=?", ...Object.keys(extra).filter(k => WRITABLE.includes(k)).map(k => `${k}=?`)];
  const vals = Object.entries(extra).filter(([k]) => WRITABLE.includes(k)).map(([, v]) => v);
  db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(toState, now(), now(), ...(vals as any[]), lead.id);
  const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(lead.id) as any;
  if (wasFinal && !isFinal) { // reopen: supersede the outcome delivery, keep the audit trail
    db.prepare("UPDATE outcome_deliveries SET superseded_at=? WHERE lead_id=? AND superseded_at IS NULL").run(now(), lead.id);
    logEvent(workspaceId, lead.id, actor, "reopened", fromState, toState, { reason: extra.note || null });
  }
  logEvent(workspaceId, lead.id, actor, "state_changed", fromState, toState, extra);
  emitEvent(workspaceId, "lead.state_changed", { lead_id: lead.id, from_state: fromState, to_state: toState });
  if (toState === "PROPOSAL") { const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any; if (prop) maybeRequestApproval(workspaceId, actor, updated, prop); }
  if (toState === "SENT") { const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(lead.id) as any; if (prop) enrollFollowup(workspaceId, lead.id, prop.id); }
  if (isFinal && !wasFinal) { finalizeLead(workspaceId, actor, updated, toState); stopFollowups(lead.id, "finalized"); notifyOwners(workspaceId, "outcome.final", `Lead finalized: ${toState}`, `${leadView(updated).contact_name || lead.id} is now ${toState}`, lead.id); if (actor !== "api") emitEvent(workspaceId, "outcome.final", { lead_id: lead.id, outcome: OUTCOME_OF[toState], state: toState });
    if (toState === "WON") { ensureJobForLead(workspaceId, actor, updated); try { convertLeadToCustomer(workspaceId, updated); } catch { /* conversion never blocks the win */ } const wsx: any = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId); const cv = leadView(updated);
      if (wsx?.review_on_won && wsx?.review_url && cv.contact_email) queueAndDeliver(workspaceId, { lead_id: lead.id, channel: "email", to: cv.contact_email, subject: `Thanks from ${wsx.name} — how did we do?`, body: `Hi ${cv.contact_name || "there"},\n\nThanks for choosing ${wsx.name}. If we earned it, a quick Google review helps a local business like ours more than any ad: ${wsx.review_url}\n\nAnd if a neighbor ever needs the same help, we'd be grateful for the referral.` }).catch(() => {}); } }
  return { lead: leadView(updated) };
}
// v2 name kept as a shim — every internal caller now gets v3 semantics
function transition(workspaceId: string, actor: string, lead: any, toState: string, extra: any = {}) {
  return setStage(workspaceId, actor, lead, toState, extra);
}
// ---- jobs (slice 30 core): a WON lead gets an operational Job exactly once ----
export function ensureJobForLead(workspaceId: string, actor: string, lead: any) {
  return withTx(() => ensureJobForLeadInner(workspaceId, actor, lead));
}
function ensureJobForLeadInner(workspaceId: string, actor: string, lead: any) {
  const existing = db.prepare("SELECT * FROM jobs WHERE lead_id=?").get(lead.id) as any;
  if (existing) return existing;
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY (signed_at IS NOT NULL) DESC, version DESC").get(lead.id) as any;
  let value = lead.est_value || 0;
  if (prop) { try { const opts = JSON.parse(prop.options || "null"); const sel = opts && prop.selected_option ? opts.find((o: any) => o.name === prop.selected_option) : null; value = sel ? sel.total : prop.total; } catch { value = prop.total; } }
  const id = uid("job");
  db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,proposal_id,stage,value,sector,created_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, lead.id, prop?.id || null, "AWAITING_SCHEDULING", value || 0, lead.sector || "private", prop?.signed_at ? "sign" : "manual", now(), now());
  emitOutbox(workspaceId, "job.created", id, { lead_id: lead.id, value: value || 0 });
  // the job inherits the lead's paperwork checklist (documents carry both ids)
  db.prepare("UPDATE documents SET job_id=? WHERE lead_id=? AND (job_id IS NULL OR job_id='')").run(id, lead.id);
  logEvent(workspaceId, lead.id, actor, "job_created", null, null, { job_id: id, value });
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("tsk"), workspaceId, lead.id, lead.pm_id || lead.owner_id || null, "schedule_job", "Schedule the job + assign crew", new Date(Date.now() + 86400000).toISOString(), now());
  return db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
}

// ---------- auth ----------
function requireAuth(req: any, res: any, next: any) {
  const sid = (req.headers.cookie || "").split(";").map((s: string) => s.trim()).find((s: string) => s.startsWith("lf_session="))?.split("=")[1]
    || (req.headers.authorization || "").replace("Bearer ", "");
  const sess = sid && db.prepare("SELECT * FROM sessions WHERE id=? AND expires_at>?").get(sid, now()) as any;
  if (!sess) return res.status(401).json({ error: { code: "unauthorized", message: "Sign in required" } });
  if (sess.impersonated_by && sess.impersonation_expires_at && sess.impersonation_expires_at <= now()) return res.status(401).json({ error: { code: "impersonation_expired", message: "Impersonation window ended — sign in again" } });
  req.session = sess;
  req.user = db.prepare("SELECT * FROM users WHERE id=?").get(sess.user_id);
  if (!req.user) return res.status(401).json({ error: { code: "unauthorized" } });
  // V34 platform controls: a disabled account is locked out entirely; a
  // suspended workspace refuses work (its members can still sign in, see the
  // notice, switch workspaces, or sign out). Platform admins and active
  // impersonation sessions are exempt so the operator can always get in.
  if (req.user.disabled && !req.user.is_platform_admin) return res.status(403).json({ error: { code: "account_disabled", message: "This account has been disabled by the platform operator." } });
  if (!req.user.is_platform_admin && !sess.impersonated_by) {
    const wsr = db.prepare("SELECT suspended FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
    const openPaths = ["/api/auth/me", "/api/auth/logout", "/api/workspaces", "/api/workspaces/switch"];
    if (wsr?.suspended && !openPaths.includes(req.path)) return res.status(403).json({ error: { code: "workspace_suspended", message: "This workspace has been suspended by the platform operator." } });
  }
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
export const MODULES = ["home", "queue", "myday", "inbox", "tasks", "leads", "customers", "proposals", "approvals", "jobs", "schedule", "ops", "campaigns", "opportunities", "demand", "pulse", "handoffs", "library", "import", "reports", "automations", "settings"] as const;
export type ModuleAccess = "none" | "view" | "edit";
export interface Perms { leads_scope: "all" | "own"; jobs_scope: "all" | "assigned" | "own"; schedule_scope: "all" | "mine"; can_approve: boolean; can_billing: boolean; can_settings: boolean; can_export: boolean; can_manage_team: boolean; can_money: boolean; can_complete_others: boolean; modules: Record<string, ModuleAccess>; }
const PERM_KEYS = ["leads_scope", "jobs_scope", "schedule_scope", "can_approve", "can_billing", "can_settings", "can_export", "can_manage_team", "can_money", "can_complete_others"] as const;
const mods = (def: ModuleAccess, over: Record<string, ModuleAccess> = {}): Record<string, ModuleAccess> => { const o: Record<string, ModuleAccess> = {}; for (const m of MODULES) o[m] = over[m] ?? def; return o; };
const ROLE_PERMS: Record<string, Perms> = {
  OWNER: { leads_scope: "all", jobs_scope: "all", schedule_scope: "all", can_approve: true, can_billing: true, can_settings: true, can_export: true, can_manage_team: true, can_money: true, can_complete_others: true, modules: mods("edit") },
  ADMIN: { leads_scope: "all", jobs_scope: "all", schedule_scope: "all", can_approve: true, can_billing: false, can_settings: true, can_export: true, can_manage_team: true, can_money: true, can_complete_others: true, modules: mods("edit", { settings: "view" }) },
  OPS_ADMIN: { leads_scope: "all", jobs_scope: "all", schedule_scope: "all", can_approve: true, can_billing: true, can_settings: true, can_export: true, can_manage_team: true, can_money: true, can_complete_others: true, modules: mods("edit") },
  APPROVER: { leads_scope: "all", jobs_scope: "own", schedule_scope: "mine", can_approve: true, can_billing: false, can_settings: false, can_export: true, can_manage_team: false, can_money: false, can_complete_others: false, modules: mods("none", { home: "view", queue: "view", approvals: "edit", leads: "view", proposals: "view", customers: "view", opportunities: "view" }) },
  LEAD_OWNER: { leads_scope: "own", jobs_scope: "own", schedule_scope: "mine", can_approve: false, can_billing: false, can_settings: false, can_export: false, can_manage_team: false, can_money: false, can_complete_others: false, modules: mods("none", { home: "view", queue: "view", myday: "edit", inbox: "view", tasks: "edit", leads: "edit", customers: "view", proposals: "edit", jobs: "view", schedule: "view", library: "view", opportunities: "edit" }) },
  PM: { leads_scope: "own", jobs_scope: "assigned", schedule_scope: "mine", can_approve: false, can_billing: false, can_settings: false, can_export: false, can_manage_team: false, can_money: false, can_complete_others: false, modules: mods("none", { home: "view", queue: "view", myday: "edit", inbox: "view", tasks: "edit", leads: "edit", customers: "view", proposals: "edit", jobs: "edit", schedule: "edit", handoffs: "view", library: "view", opportunities: "view" }) },
};
export function defaultPermsFor(role: string): Perms { return JSON.parse(JSON.stringify(ROLE_PERMS[role] || ROLE_PERMS.LEAD_OWNER)); }
// Workspace role templates (owner-editable) live in role_perms; cached briefly.
const roleTplCache = new Map<string, { at: number, perms: Perms | null }>();
export function roleTemplate(wsId: string, role: string): Perms | null {
  const key = wsId + ":" + role; const hit = roleTplCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.perms;
  let perms: Perms | null = null;
  try { const row = db.prepare("SELECT perms FROM role_perms WHERE workspace_id=? AND role=?").get(wsId, role) as any; if (row?.perms) { const p = JSON.parse(row.perms); perms = { ...defaultPermsFor(role), ...p, modules: { ...mods("none"), ...(defaultPermsFor(role).modules || {}), ...(p.modules || {}) } }; } } catch { perms = null; }
  roleTplCache.set(key, { at: Date.now(), perms }); return perms;
}
export function clearRoleTplCache(wsId?: string) { if (!wsId) { roleTplCache.clear(); return; } for (const k of [...roleTplCache.keys()]) if (k.startsWith(wsId + ":")) roleTplCache.delete(k); }
export function permsOf(user: any): Perms {
  if (user.role === "OWNER") return defaultPermsFor("OWNER"); // owner is never restricted
  const base = roleTemplate(user.workspace_id, user.role) || defaultPermsFor(user.role);
  let over: any = {}; try { over = JSON.parse(user.permissions || "{}"); } catch { over = {}; }
  const out: any = { ...base, modules: { ...(base.modules || {}) } };
  for (const k of PERM_KEYS) if (over[k] !== undefined) out[k] = over[k];
  if (over.modules && typeof over.modules === "object") for (const m of MODULES) if (over.modules[m] !== undefined) out.modules[m] = over.modules[m];
  return out as Perms;
}
export function sanitizePerms(input: any, base: Perms): Perms {
  const out: any = JSON.parse(JSON.stringify(base));
  if (!input || typeof input !== "object") return out;
  if (input.leads_scope === "all" || input.leads_scope === "own") out.leads_scope = input.leads_scope;
  if (["all", "assigned", "own"].includes(input.jobs_scope)) out.jobs_scope = input.jobs_scope;
  if (input.schedule_scope === "all" || input.schedule_scope === "mine") out.schedule_scope = input.schedule_scope;
  for (const k of ["can_approve", "can_billing", "can_settings", "can_export", "can_manage_team", "can_money", "can_complete_others"] as const) if (typeof input[k] === "boolean") out[k] = input[k];
  if (input.modules && typeof input.modules === "object") { out.modules = { ...out.modules }; for (const m of MODULES) if (["none", "view", "edit"].includes(input.modules[m])) out.modules[m] = input.modules[m]; }
  return out as Perms;
}
export function modGate(module: string, need: "view" | "edit" = "view") { return (req: any, res: any, next: any) => { const p = permsOf(req.user); const lvl = p.modules?.[module] || "none"; if (lvl === "none" || (need === "edit" && lvl !== "edit")) return res.status(403).json({ error: { code: "module_denied", module, message: `Your access doesn't include ${need === "edit" ? "editing" : "viewing"} ${module}. Ask the owner to adjust it in Settings → Access & Roles.` } }); next(); }; }
// Data-scope helpers (v41): whose world does this user see?
export function leadVisible(user: any, lead: any): boolean { if (!lead) return false; const p = permsOf(user); if (p.leads_scope === "all") return true; return lead.owner_id === user.id || lead.pm_id === user.id; }
export function jobVisible(user: any, job: any): boolean {
  if (!job) return false; const p = permsOf(user); if (p.jobs_scope === "all") return true;
  const lead = db.prepare("SELECT owner_id, pm_id FROM leads WHERE id=?").get(job.lead_id) as any;
  if (lead && (lead.owner_id === user.id || lead.pm_id === user.id)) return true;
  if (p.jobs_scope === "own") return false;
  const crew = db.prepare("SELECT 1 x FROM job_crew WHERE lead_id=? AND user_id=?").get(job.lead_id, user.id);
  if (crew) return true;
  const sched = db.prepare("SELECT 1 x FROM job_schedule WHERE lead_id=? AND (user_id=? OR worker_id IN (SELECT id FROM workers WHERE linked_user_id=?))").get(job.lead_id, user.id, user.id);
  return !!sched;
}
export function agendaMine(user: any, kind: string, row: any, lead: any): boolean {
  const p = permsOf(user); if (p.schedule_scope === "all" || p.can_complete_others) return true;
  if (!row) return false;
  if (kind === "task") return row.assignee_id === user.id;
  if (kind === "visit") return row.assigned_to === user.id || (!!lead && leadVisible(user, lead));
  if (kind === "schedule") { if (row.user_id === user.id) return true; if (row.worker_id) { const w = db.prepare("SELECT linked_user_id FROM workers WHERE id=?").get(row.worker_id) as any; if (w?.linked_user_id === user.id) return true; } return !!lead && leadVisible(user, lead); }
  return !!lead && leadVisible(user, lead);
}
import { SOCIAL_PROVIDERS, socialConfigured, beginSocial, consumeSocialState, exchangeSocial, resolveSocialUser } from "./social-auth.ts";
// Absolute base for provider-facing URLs: BASE_URL wins (prod sits behind a
// TLS proxy, so req.protocol can read http and providers would reject the
// redirect URI). Falls back to the request for local dev.
export const publicBase = (req: any) => (process.env.BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const sessionCookie = (req: any, sid: string, maxAge = 604800) => `lf_session=${sid}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${publicBase(req).startsWith("https") ? "; Secure" : ""}`;
const scopeOwn = (user: any) => permsOf(user).leads_scope === "own";
const mine = (user: any, l: any) => l.owner_id === user.id || l.pm_id === user.id;
function needPerm(key: keyof Perms) { return (req: any, res: any, next: any) => { if (!permsOf(req.user)[key]) return res.status(403).json({ error: { code: "permission_denied", permission: key } }); next(); }; }
// ---------- routes: auth ----------
app.post("/api/auth/login", (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=? AND active=1").get((req.body.email || "").toLowerCase()) as any;
  if (!u || !verifyPassword(req.body.password || "", u.password_hash)) return res.status(401).json({ error: { code: "bad_credentials" } });
  if ((u as any).disabled && !(u as any).is_platform_admin) return res.status(403).json({ error: { code: "account_disabled", message: "This account has been disabled by the platform operator." } });
  syncPlatformAdmin();
  const sid = uid("ses") + randomBytes(16).toString("hex");
  db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, u.id, now(), new Date(Date.now() + 7 * 86400000).toISOString());
  res.setHeader("Set-Cookie", sessionCookie(req, sid));
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, workspace_id: u.workspace_id, is_platform_admin: !!u.is_platform_admin , email_verified: u.email_verified ?? 0, permissions: permsOf(u) }, session: sid });
});
app.get("/api/auth/me", requireAuth, (req: any, res) => { ensureMembership(req.user); const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; const __imp = (req as any).session?.impersonated_by ? { by_name: (db.prepare("SELECT name FROM users WHERE id=?").get((req as any).session.impersonated_by) as any)?.name || "platform admin", expires_at: (req as any).session.impersonation_expires_at } : null; res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, avatar_url: req.user.avatar_url || null, approval_limit: req.user.approval_limit || 0, workspace_id: req.user.workspace_id, workspace_name: ws?.name, workspace_suspended: !!(db.prepare("SELECT suspended FROM workspaces WHERE id=?").get(req.user.workspace_id) as any)?.suspended, email_verified: req.user.email_verified ?? 0, is_platform_admin: !!req.user.is_platform_admin, impersonation: __imp, permissions: permsOf(req.user) }, workspaces: membershipsOf(req.user.id) }); });

// ---------- routes: workspace data ----------
app.get("/api/users", requireAuth, (req: any, res) => res.json((db.prepare("SELECT * FROM users WHERE workspace_id=?").all(req.user.workspace_id) as any[]).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar_url: u.avatar_url || null, approval_limit: u.approval_limit, labor_class_id: u.labor_class_id || null, permissions: permsOf(u), has_overrides: !!u.permissions }))));
app.get("/api/leads", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  let rows = (db.prepare("SELECT * FROM leads WHERE workspace_id=? ORDER BY created_at DESC").all(ws) as any[]).map(leadView);
  if (req.query.state !== "DUPLICATE") rows = rows.filter(l => !l.merged_into_id); // merged duplicates live on their survivor (Salesforce behavior)
  if (scopeOwn(req.user)) rows = rows.filter(l => mine(req.user, l));
  if (req.query.state) rows = rows.filter(l => l.state === req.query.state);
  if (req.query.bucket) { const B: Record<string, string[]> = { new: ["NEW"], working: ["WORKING", "QUALIFIED", "FOLLOWUP"], proposal: ["PROPOSAL", "SENT"], won: ["WON"], closed: ["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"] }; rows = rows.filter(l => (B[String(req.query.bucket)] || []).includes(l.state)); }
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
  const proposals = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").all(l.id) as any[];
  for (const p of proposals) { const ap = db.prepare("SELECT a.*, u.name approver_name FROM approvals a LEFT JOIN users u ON u.id=a.approver_id WHERE a.proposal_id=? ORDER BY a.submitted_at DESC").get(p.id) as any; p.approval_state = !ap ? "none" : !ap.decision ? "pending" : ap.decision; p.approver_name = ap?.approver_name || null; p.approval_id = ap?.id || null; }
  const docs = db.prepare("SELECT * FROM documents WHERE lead_id=?").all(l.id);
  const visits = db.prepare("SELECT * FROM site_visits WHERE lead_id=?").all(l.id);
  const activities = db.prepare("SELECT a.*, u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE a.lead_id=? ORDER BY a.created_at DESC").all(l.id);
  const approvals = db.prepare("SELECT * FROM approvals WHERE lead_id=? ORDER BY submitted_at DESC").all(l.id);
  const jobsOfLead = db.prepare("SELECT id FROM jobs WHERE lead_id=? ORDER BY created_at DESC").all(l.id) as any[];
  const sp = (proposals as any[]).filter((p: any) => p.sent_at).sort((a: any, b: any) => String(b.sent_at).localeCompare(String(a.sent_at)))[0];
  const sentDays = sp ? Math.floor((Date.now() - new Date(sp.sent_at).getTime()) / 86400000) : undefined;
  let next_step: any = nextBestAction({ ...leadView(l) }, sentDays);
  if (l.state === "WON") next_step = jobsOfLead.length ? { kind: "job", label: "Open the job — delivery is the work now", detail: "Sold. The job carries scheduling, crew, paperwork and invoicing; this lead's part is done." } : { kind: "job", label: "Create the job from this win", detail: "Won but no job exists yet — create it so delivery, scheduling and invoicing have a home." };
  if (["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(l.state)) next_step = { kind: "closed", label: "This lead is closed", detail: "The timeline below is the record. If it comes back, move it from the stage path and it re-enters the queue." };
  res.json({ lead: leadView(l), events, tasks, proposals, documents: docs, site_visits: visits, activities, approvals, next_step, job_id: jobsOfLead[0]?.id || null });
});
app.post("/api/leads/:id/transition", requireAuth, (req: any, res) => { // v2 route name, v3 engine.
  // Compat route name only — since v69 it enforces exactly the same discipline
  // as /stage (it previously passed force:true, which let any signed-in user
  // bypass the finals rules AND the v68 Sent gate). In-process callers use the
  // transition() function directly and are unaffected.
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  const extra: any = {};
  for (const k of ["lost_reason", "outcome_reason_detail", "competitor", "hold_reason", "pm_id", "owner_id", "approver_id", "confirm_no_proposal", "note"]) if (req.body[k] !== undefined) extra[k] = req.body[k];
  const r: any = setStage(req.user.workspace_id, req.user.id, l, req.body.to_state, extra);
  if (r.error) return res.status(r.status || 400).json({ error: { code: r.code || "stage_failed", message: r.error }, missing: r.missing });
  audit(req.user.workspace_id, req.user.id, "lead.stage", "lead", l.id, { to: req.body.to_state });
  res.json(r);
});
app.post("/api/leads/:id/stage", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  const extra: any = {};
  for (const k of ["lost_reason", "outcome_reason_detail", "competitor", "confirm_no_proposal", "note"]) if (req.body[k] !== undefined) extra[k] = req.body[k];
  const r: any = setStage(req.user.workspace_id, req.user.id, l, req.body.to, extra);
  if (r.error) return res.status(r.status || 400).json({ error: { code: r.code || "stage_failed", message: r.error } });
  audit(req.user.workspace_id, req.user.id, "lead.stage", "lead", l.id, { to: req.body.to });
  res.json(r);
});
app.post("/api/leads/:id/reopen", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (!FINAL_STATES.includes(l.state)) return res.status(422).json({ error: { code: "not_final" } });
  const to = req.body.to || (l.legacy_state && OPEN_STAGES.includes(normStage(l.legacy_state)) ? normStage(l.legacy_state) : "WORKING");
  const r: any = setStage(req.user.workspace_id, req.user.id, l, to, { note: req.body.reason || "reopened" });
  if (r.error) return res.status(r.status || 400).json({ error: { code: "reopen_failed", message: r.error } });
  res.json(r);
});
app.post("/api/leads/:id/hold", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (req.body.clear) { db.prepare("UPDATE leads SET hold_flag=0, hold_reason=NULL, hold_until=NULL, updated_at=? WHERE id=?").run(now(), l.id); logEvent(req.user.workspace_id, l.id, req.user.id, "hold_cleared", null, null, {}); }
  else { db.prepare("UPDATE leads SET hold_flag=1, hold_reason=?, hold_until=?, updated_at=? WHERE id=?").run(req.body.reason || "On hold", req.body.until || null, now(), l.id); logEvent(req.user.workspace_id, l.id, req.user.id, "hold_set", null, null, { reason: req.body.reason, until: req.body.until }); }
  res.json({ lead: leadView(db.prepare("SELECT * FROM leads WHERE id=?").get(l.id)) });
});
app.post("/api/leads/:id/touch", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const kind = ["open", "assign", "contact", "message", "task"].includes(String(req.body?.kind || "")) ? String(req.body.kind) : "open";
  res.json({ touched: touchLead(req.user.workspace_id, l.id, kind, req.user.id) });
});
app.post("/api/leads/:id/contact", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id) as any;
  if (!l.first_response_at) db.prepare("UPDATE leads SET first_response_at=? WHERE id=?").run(now(), l.id);
  touchLead(req.user.workspace_id, l.id, "contact", req.user.id);
  db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,outcome,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("act"), l.id, req.user.workspace_id, req.user.id, req.body.type || "call", req.body.body || "", req.body.outcome || "", now());
  if (req.body.next_action_due_at) db.prepare("UPDATE leads SET next_action=?, next_action_due_at=? WHERE id=?").run(req.body.next_action || "Follow up", req.body.next_action_due_at, l.id);
  res.json({ ok: true });
});
app.post("/api/leads/:id/packet-check", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(req.params.id) as any;
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(l.id) as any;
  const sv = db.prepare("SELECT COUNT(*) c FROM site_visits WHERE lead_id=? AND status='completed'").get(l.id) as any; res.json(packetCheck({ ...leadView(l), pm_id: l.pm_id, site_visit_done: sv.c > 0 }, prop));
});

// proposals
app.get("/api/price-book", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM price_book_items WHERE workspace_id=?").all(req.user.workspace_id)));
app.get("/api/templates", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM templates WHERE workspace_id=?").all(req.user.workspace_id)));
// v52: newest version wins — creating or sending a version withdraws every
// older unsigned version for the lead and stops its cadence.
function supersedePriorProposals(ws: string, leadId: string, keepId: string, allUnsigned = false) {
  const rows = db.prepare(`SELECT id FROM proposals WHERE workspace_id=? AND lead_id=? AND id<>? AND status IN (${allUnsigned ? "'draft','sent'" : "'sent'"})`).all(ws, leadId, keepId) as any[];
  for (const r of rows) db.prepare("UPDATE proposals SET status='withdrawn' WHERE id=?").run(r.id);
  if (rows.length) stopFollowups(leadId, "superseded");
}
app.post("/api/leads/:id/proposals", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const __overrides: any[] = [];
  const priceItems = (arr: any[]) => { // price-book-only invariant (§26) applies to base lines AND every option
    let total = 0, below = false;
    for (const it of arr) {
      const pb = db.prepare("SELECT * FROM price_book_items WHERE id=? AND workspace_id=?").get(it.price_book_item_id, req.user.workspace_id) as any;
      if (!pb) return { error: `Line item must come from the price book: ${it.price_book_item_id || it.name || "?"}` };
      const price = it.unit_price !== undefined ? it.unit_price : pb.standard_price;
      if (it.unit_price !== undefined && Number(it.unit_price) !== Number(pb.standard_price)) __overrides.push({ item_id: pb.id, item_name: pb.name, prev_price: pb.standard_price, new_price: Number(it.unit_price), reason: it.override_reason || req.body.override_reason || "" });
      if (price < pb.floor_price) below = true;
      total += price * (it.qty || 1);
      it.name = pb.name; it.unit_price = price;
    }
    return { total, below };
  };
  const items = req.body.line_items || [];
  const base = priceItems(items); if ((base as any).error) return res.status(422).json({ error: { code: "price_book_only", message: (base as any).error } });
  let options: any = null, below = (base as any).below;
  if (Array.isArray(req.body.options) && req.body.options.length) {
    options = [];
    for (const o of req.body.options.slice(0, 3)) { const its = o.line_items || []; const r = priceItems(its); if ((r as any).error) return res.status(422).json({ error: { code: "price_book_only", message: (r as any).error } }); if ((r as any).below) below = true; options.push({ name: String(o.name || "Option"), line_items: its, total: (r as any).total }); }
  }
  const total = (base as any).total;
  const count = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(l.id) as any).c;
  const id = uid("prop");
  const expires = req.body.valid_days ? new Date(Date.now() + Number(req.body.valid_days) * 86400000).toISOString() : null;
  if (__overrides.length) {
    const perms = permsOf(req.user);
    if (!perms.can_approve && !perms.can_settings) return res.status(403).json({ error: { code: "override_permission", message: "Changing a price-book price requires approval or settings permission." } });
    const missing = __overrides.find((o: any) => !String(o.reason || "").trim());
    if (missing) return res.status(422).json({ error: { code: "override_reason_required", message: `Price override on "${missing.item_name}" (${missing.prev_price} → ${missing.new_price}) requires a reason (target §9.2).` } });
  }
  const pnum = (db.prepare("SELECT COALESCE(MAX(number),1000) m FROM proposals WHERE workspace_id=?").get(req.user.workspace_id) as any).m + 1;
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,template_id,version,status,line_items,total,margin_band,win_prob_band,options,expires_at,created_at,number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, req.user.workspace_id, l.id, req.body.template_id || resolveDocTemplateId(req.user.workspace_id, l.service_requested), count + 1, "draft", JSON.stringify(items), total, below ? "below_floor" : "in_band", total > 25000 ? "review" : "standard", options ? JSON.stringify(options) : null, expires, now(), pnum);
  const created = db.prepare("SELECT * FROM proposals WHERE id=?").get(id) as any;
  supersedePriorProposals(req.user.workspace_id, l.id, id);
  for (const o of __overrides) { db.prepare("INSERT INTO price_overrides (id,workspace_id,proposal_id,lead_id,item_id,item_name,prev_price,new_price,reason,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(uid("ovr"), req.user.workspace_id, id, l.id, o.item_id, o.item_name, o.prev_price, o.new_price, o.reason, req.user.id, now()); }
  if (__overrides.length) audit(req.user.workspace_id, req.user.id, "proposal.price_override", "proposal", id, { overrides: __overrides });
  if (["PROPOSAL", "SENT", "FOLLOWUP"].includes(l.state)) maybeRequestApproval(req.user.workspace_id, req.user.id, l, created);
  res.status(201).json(created);
});
app.post("/api/proposals/:id/clone", requireAuth, (req: any, res) => { // v3 §8: new proposal from an existing one (same or another lead)
  const src = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!src) return res.status(404).json({ error: { code: "not_found" } });
  const leadId = String(req.body.lead_id || src.lead_id);
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(leadId, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "lead_not_found" } });
  const count = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(leadId) as any).c;
  const id = uid("prop");
  const expires = req.body.valid_days ? new Date(Date.now() + Number(req.body.valid_days) * 86400000).toISOString() : (src.expires_at && new Date(src.expires_at) > new Date() ? src.expires_at : new Date(Date.now() + 30 * 86400000).toISOString());
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,template_id,version,status,line_items,total,margin_band,win_prob_band,options,expires_at,created_at,number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, req.user.workspace_id, leadId, src.template_id, count + 1, "draft", src.line_items, src.total, src.margin_band, src.win_prob_band, src.options, expires, now(), leadId === src.lead_id ? (src.number ?? null) : (db.prepare("SELECT COALESCE(MAX(number),1000) m FROM proposals WHERE workspace_id=?").get(req.user.workspace_id) as any).m + 1);
  supersedePriorProposals(req.user.workspace_id, leadId, id);
  res.status(201).json(db.prepare("SELECT * FROM proposals WHERE id=?").get(id));
});

// approvals
app.get("/api/approvals", requireAuth, (req: any, res) => {
  const rows = db.prepare(`SELECT a.*, l.service_requested, l.est_value, l.state, l.contact_id, c.name contact_name FROM approvals a JOIN leads l ON l.id=a.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at`).all(req.user.workspace_id) as any[];
  for (const a of rows) {
    const l = db.prepare("SELECT * FROM leads WHERE id=?").get(a.lead_id) as any;
    const prop = a.proposal_id ? db.prepare("SELECT * FROM proposals WHERE id=?").get(a.proposal_id) as any : db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(a.lead_id) as any;
    const sv = db.prepare("SELECT COUNT(*) c FROM site_visits WHERE lead_id=? AND status='completed'").get(l.id) as any; const chk = packetCheck({ ...leadView(l), pm_id: l.pm_id, site_visit_done: sv.c > 0 }, prop);
    if (prop) { try { prop.line_items = JSON.parse(prop.line_items || "[]"); } catch { prop.line_items = []; } a.proposal = prop; }
    const ALL = ["contact name", "contact phone or email", "service requested", "service location", "scope notes", "project manager", "site visit completed", "proposal", "proposal line items from price book"];
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
  const __prop = decision === "approved" ? db.prepare("SELECT * FROM proposals WHERE id=?").get(a.proposal_id) as any : null;
  if (decision === "approved" && __prop && req.user.role !== "OWNER" && (req.user.approval_limit || 0) > 0 && (__prop.total || 0) > req.user.approval_limit) return res.status(422).json({ error: { code: "over_approval_limit", message: `This proposal is $${__prop.total} — above your $${req.user.approval_limit} approval limit. The owner (unlimited) or an approver with a higher limit needs to decide it.` } });
  db.prepare("UPDATE approvals SET decision=?, reason_code=?, edits_diff=?, decided_at=?, content_hash=? WHERE id=?").run(decision, reason_code || null, edits_diff ? JSON.stringify(edits_diff) : null, now(), __prop ? proposalContentHash(__prop) : null, a.id); emitOutbox(req.user.workspace_id, "approval.decided", a.id, { decision, proposal_id: a.proposal_id });
  emitEvent(req.user.workspace_id, "approval.decided", { lead_id: a.lead_id, approval_id: a.id, decision });
  notify(req.user.workspace_id, [a.submitted_by], "approval.decided", `Your proposal was ${decision}`, `Lead ${a.lead_id} — decision: ${decision}${reason_code ? " (" + reason_code + ")" : ""}`, a.lead_id);
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(a.lead_id) as any;
  // v3: a decision never traps the lead in a stage. Changes/rejected hand the submitter a fix task in place.
  if (decision !== "approved") db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("tsk"), req.user.workspace_id, a.lead_id, a.submitted_by, "approval_fix", `Approval ${decision}: ${reason_code} — revise and resubmit`, new Date(Date.now() + 86400000).toISOString(), now());
  audit(req.user.workspace_id, req.user.id, "approval.decide", "approval", a.id, { decision, reason_code });
  res.json({ ok: true });
});

// tasks / follow-ups
app.get("/api/tasks", requireAuth, (req: any, res) => res.json(db.prepare("SELECT t.*, l.service_requested FROM tasks t LEFT JOIN leads l ON l.id=t.lead_id WHERE t.workspace_id=? ORDER BY t.due_at").all(req.user.workspace_id)));
app.post("/api/tasks/:id/complete", requireAuth, (req: any, res) => { const t = db.prepare("SELECT * FROM tasks WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!t) return res.status(404).json({ error: { code: "not_found" } }); const p = permsOf(req.user); if (t.assignee_id !== req.user.id && p.schedule_scope !== "all" && !p.can_complete_others) return res.status(403).json({ error: { code: "not_assigned", message: "That task is assigned to someone else — your access covers your own tasks." } }); db.prepare("UPDATE tasks SET status='done', completed_at=?, completed_by=?, completion_reason=? WHERE id=? AND workspace_id=?").run(now(), req.user.id, req.body?.reason || null, req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/tasks/:id/snooze", requireAuth, (req: any, res) => { const until = req.body?.until || new Date(Date.now() + 86400000).toISOString(); db.prepare("UPDATE tasks SET snooze_until=?, snooze_reason=? WHERE id=? AND workspace_id=?").run(until, String(req.body?.reason || "snoozed"), req.params.id, req.user.workspace_id); res.json({ ok: true, snooze_until: until }); });
app.post("/api/tasks/:id/escalate", requireAuth, (req: any, res) => { db.prepare("UPDATE tasks SET escalation_level=COALESCE(escalation_level,0)+1 WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// metrics / brief / demand
app.get("/api/onboarding", requireAuth, (req: any, res: any) => {
    const w = req.user.workspace_id; const wrow = db.prepare("SELECT name, vertical FROM workspaces WHERE id=?").get(w) as any; const c = (sql: string, ...p: any[]) => (db.prepare(sql).get(w, ...p) as any).c;
    const svc = c("SELECT COUNT(*) c FROM services WHERE workspace_id=?");
    const pricing = c("SELECT COUNT(*) c FROM price_book_items WHERE workspace_id=? AND standard_price > 0");
    const steps = [
      { key: "profile", label: "Name your business + pick your trade", hint: "Vertical packs pre-load your services and fields.", done: !!(wrow?.name && wrow?.vertical), view: "settings" },
      { key: "services", label: "Set up your service catalog", hint: "The services you sell, in your words.", done: svc > 0, view: "settings" },
      { key: "pricing", label: "Price the price book", hint: "At least one real price — proposals price themselves from it.", done: pricing > 0, view: "settings" },
      { key: "team", label: "Invite your team", hint: "Active teammates — owners approve, the crew works the queue.", done: c("SELECT COUNT(*) c FROM users WHERE workspace_id=? AND active=1") > 1, view: "settings" },
      { key: "first_lead", label: "Bring in your first lead", hint: "Import the backlog, paste a CSV, or add one by hand.", done: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=?") > 0, view: "leads" },
      { key: "first_proposal", label: "Build a usable proposal", hint: "Beyond a draft — priced and ready to send.", done: c("SELECT COUNT(*) c FROM proposals WHERE workspace_id=? AND (sent_at IS NOT NULL OR status<>'draft')") > 0, view: "leads" },
      { key: "first_send", label: "Deliver it — verified", hint: "Provider-confirmed delivery only — accepted is not delivered, test mode never counts.", done: c("SELECT COUNT(*) c FROM proposals p WHERE p.workspace_id=? AND p.sent_at IS NOT NULL AND EXISTS (SELECT 1 FROM messages_outbox m WHERE m.lead_id=p.lead_id AND m.status = 'delivered' AND m.created_at>=p.sent_at)") > 0, view: "queue" },
      { key: "first_won", label: "Win it → it becomes a job", hint: "A genuine Won conversion with its job created.", done: c("SELECT COUNT(*) c FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.workspace_id=? AND l.state='WON'") > 0, view: "jobs" },
      { key: "template", label: "Customize your proposal template", hint: "Your company header, terms and footer on every proposal.", done: c("SELECT COUNT(*) c FROM workspaces WHERE id=? AND pt_company IS NOT NULL AND pt_company<>''") > 0, view: "settings" },
      { key: "booking", label: "Turn on the public booking page", hint: "Customers book site visits without calling.", done: c("SELECT COUNT(*) c FROM workspaces WHERE id=? AND booking_enabled=1") > 0, view: "settings" },
    ];
    res.json({ steps, done_count: steps.filter(x => x.done).length, total: steps.length, complete: steps.every(x => x.done) });
  });
  // ---- Workpile Agent v17: provider config + governed executions ----
app.get("/api/ai/provider", requireAuth, async (req: any, res) => { const { providerStatus } = await import("./llm.ts"); res.json(providerStatus(req.user.workspace_id)); });
app.patch("/api/ai/provider", requireAuth, needPerm("can_settings"), async (req: any, res) => { const b = req.body || {}; const kind = ["anthropic", "openai"].includes(b.provider) ? b.provider : "anthropic";
  db.prepare("UPDATE workspaces SET llm_provider=COALESCE(?,llm_provider), llm_model=COALESCE(?,llm_model), llm_api_key=CASE WHEN ?='' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE llm_api_key END, llm_workspace_id=CASE WHEN ?='' THEN NULL WHEN ? IS NOT NULL THEN ? ELSE llm_workspace_id END WHERE id=?").run(kind, b.model || null, b.api_key ?? null, b.api_key ?? null, b.api_key || null, b.workspace_id ?? null, b.workspace_id ?? null, b.workspace_id || null, req.user.workspace_id);
  audit(req.user.workspace_id, req.user.id, "ai.provider_config", "workspace", req.user.workspace_id, { provider: kind, key_changed: b.api_key !== undefined });
  const { providerStatus } = await import("./llm.ts"); const st = providerStatus(req.user.workspace_id); if (st.configured) { const { scanWorkspace } = await import("./inbox-ai.ts"); scanWorkspace(req.user.workspace_id, req.user.id).catch(() => {}); } res.json(st); });
app.post("/api/ai/provider/test", requireAuth, needPerm("can_settings"), async (req: any, res) => { const { getProvider, providerStatus } = await import("./llm.ts"); const st = providerStatus(req.user.workspace_id); if (!st.configured) return res.json({ ok: true, mode: "rules", message: "No AI provider connected — the agent runs on the deterministic rules planner. Add a provider key to enable generative planning." }); const p = getProvider(req.user.workspace_id); const t0 = Date.now(); try { const r = await p!.chat({ system: "Reply with the single word: ready", messages: [{ role: "user", content: "ping" }], maxTokens: 16 }); res.json({ ok: true, mode: "llm", model: r.model, latency_ms: Date.now() - t0, reply: r.text.slice(0, 40) }); } catch (e: any) { res.json({ ok: false, error: String(e?.message || e).slice(0, 300) }); } });
app.get("/api/agent/config", requireAuth, async (req: any, res) => { const { AGENT_SYSTEM_PROMPT, houseRules } = await import("./agent.ts"); const { TOOL_LIST, TOOLS } = await import("./tools.ts"); const w = db.prepare("SELECT agent_level FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; const { trustReport } = await import("./autonomy.ts"); res.json({ system_prompt: AGENT_SYSTEM_PROMPT, tools: TOOL_LIST.map((t: any) => ({ name: t.name, description: t.description, control: (TOOLS as any)[t.name]?.control || "read" })), trust: trustReport(req.user.workspace_id), custom_instructions: houseRules(req.user.workspace_id), agent_level: agentLevel(w) }); });
app.patch("/api/agent/config", requireAuth, needPerm("can_settings"), (req: any, res) => { const v = String(req.body?.custom_instructions || "").slice(0, 2000); db.prepare("UPDATE workspaces SET agent_instructions=? WHERE id=?").run(v || null, req.user.workspace_id); audit(req.user.workspace_id, req.user.id, "agent.config", "workspace", req.user.workspace_id, { len: v.length }); res.json({ ok: true, custom_instructions: v }); });
app.post("/api/agent/triage-untouched", requireAuth, modGate("automations", "edit"), async (req: any, res) => { const { createTriageExecution } = await import("./agent.ts"); const ex = await createTriageExecution(req.user.workspace_id, req.user.id); audit(req.user.workspace_id, req.user.id, "agent.triage", "agent_execution", ex.id, { status: ex.status }); res.status(201).json(ex); });
app.post("/api/agent/execute", requireAuth, modGate("automations", "edit"), async (req: any, res) => { const text = String(req.body?.instruction || "").trim(); if (!text) return res.status(422).json({ error: { code: "empty_instruction" } }); const { createExecution } = await import("./agent.ts"); const ex = await createExecution(req.user.workspace_id, req.user.id, text.slice(0, 1000), req.body?.parent_id || undefined); audit(req.user.workspace_id, req.user.id, "agent.execute", "agent_execution", ex.id, { status: ex.status, planner: ex.planner }); res.status(201).json(ex); });
app.get("/api/agent/executions", requireAuth, async (req: any, res) => { const { getExecution } = await import("./agent.ts"); const ids = db.prepare("SELECT id FROM agent_executions WHERE workspace_id=? ORDER BY created_at DESC LIMIT 30").all(req.user.workspace_id) as any[]; res.json(ids.map(r => getExecution(req.user.workspace_id, r.id))); });
app.get("/api/agent/executions/:id", requireAuth, async (req: any, res) => { const { getExecution } = await import("./agent.ts"); const ex = getExecution(req.user.workspace_id, req.params.id); if (!ex) return res.status(404).json({ error: { code: "not_found" } }); res.json(ex); });
app.post("/api/agent/executions/:id/decide", requireAuth, async (req: any, res) => { if (!permsOf(req.user).can_approve) return res.status(403).json({ error: { code: "cannot_approve", message: "Deciding agent steps — including sends and payments — requires approval permission." } }); const { decideSteps } = await import("./agent.ts"); try { const ex = await decideSteps(req.user.workspace_id, req.params.id, (req.body?.approve || []).map(String), (req.body?.reject || []).map(String), req.user.id); if (!ex) return res.status(404).json({ error: { code: "not_found" } }); audit(req.user.workspace_id, req.user.id, "agent.decide", "agent_execution", ex.id, { status: ex.status }); res.json(ex); } catch (e: any) { res.status(e.code === "already_final" ? 409 : 500).json({ error: { code: e.code || "decide_failed", message: String(e?.message || e) } }); } });
app.post("/api/agent/executions/:id/cancel", requireAuth, async (req: any, res) => { const { cancelExecution } = await import("./agent.ts"); const ex = cancelExecution(req.user.workspace_id, req.params.id); if (!ex) return res.status(404).json({ error: { code: "not_found" } }); res.json(ex); });
app.post("/api/agent/command", requireAuth, modGate("automations", "edit"), async (req: any, res) => { const text = String(req.body?.text || "").trim(); if (!text) return res.status(422).json({ error: { code: "empty_command" } }); const { runCommand } = await import("./orchestrator.ts"); const out = runCommand(req.user.workspace_id, req.user.id, text.slice(0, 500)); audit(req.user.workspace_id, req.user.id, "agent.command", "agent_run", out.run_id, { intent: out.intent }); res.status(201).json(out); });
app.get("/api/agent/runs", requireAuth, async (req: any, res) => { res.json(db.prepare("SELECT id, output, created_at FROM agent_runs WHERE workspace_id=? AND agent='orchestrator' ORDER BY created_at DESC LIMIT 20").all(req.user.workspace_id).map((r: any) => ({ id: r.id, created_at: r.created_at, ...JSON.parse(r.output || "{}") }))); });
app.get("/api/metrics", requireAuth, (req: any, res) => res.json(metrics(req.user.workspace_id)));
app.get("/api/brief", requireAuth, (req: any, res) => res.json(morningBrief(req.user.workspace_id)));
app.get("/api/demand-gap", requireAuth, modGate("demand"), (req: any, res) => { const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(req.user.workspace_id) as any[]; const catalog = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND is_catalog=1").all(req.user.workspace_id) as any[]).map(r => r.name); res.json(demandGap(leads, catalog)); });
app.get("/api/demand-gap/full", requireAuth, modGate("demand"), (req: any, res) => {
  const ws = req.user.workspace_id;
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(ws) as any[];
  const catalog = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND is_catalog=1").all(ws) as any[]).map(r => r.name);
  const catSet = new Set(catalog.map(x => x.trim().toLowerCase()));
  const unmet = demandGap(leads, catalog);
  const away = leads.filter(l => ["LOST", "UNSERVICEABLE"].includes(l.state));
  const byReason = new Map<string, any>();
  for (const l of away) { const r = String(l.lost_reason || "NO_REASON_RECORDED").toUpperCase(); const g = byReason.get(r) || { reason: r, label: r.replaceAll("_", " ").toLowerCase().replace(/^\w/, ch => ch.toUpperCase()), count: 0, value: 0 }; g.count++; g.value += l.est_value || 0; byReason.set(r, g); }
  const notOffered = new Map<string, any>();
  for (const l of leads) { const s = String(l.service_requested || "").trim(); if (!s || catSet.has(s.toLowerCase())) continue; const g = notOffered.get(s) || { service: s, count: 0, open: 0, won: 0, value: 0 }; g.count++; if (!["WON", "LOST", "UNSERVICEABLE", "JUNK", "DUPLICATE", "NO_RESPONSE"].includes(l.state)) g.open++; if (l.state === "WON") g.won++; g.value += l.est_value || 0; notOffered.set(s, g); }
  const areas = new Map<string, number>();
  for (const l of away) { if (l.state !== "UNSERVICEABLE" && !/AREA|COVERAGE/.test(String(l.lost_reason || "").toUpperCase())) continue; const area = String(l.location || "Unknown area").split(",")[0].trim() || "Unknown area"; areas.set(area, (areas.get(area) || 0) + 1); }
  res.json({ unmet, catalog_size: catalog.length,
    turned_away: { total: away.length, value: away.reduce((s, l) => s + (l.est_value || 0), 0), by_reason: [...byReason.values()].sort((x, y) => y.count - x.count) },
    not_offered: [...notOffered.values()].sort((x, y) => y.count - x.count).slice(0, 12),
    coverage: [...areas.entries()].map(([area, count]) => ({ area, count })).sort((x, y) => y.count - x.count).slice(0, 10) });
});
app.get("/api/demand-gap/leads", requireAuth, (req: any, res) => { const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(req.user.workspace_id) as any[]; const catalog = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND is_catalog=1").all(req.user.workspace_id) as any[]).map(r => r.name); let pool = demandPool(leads, catalog).filter(l => (l.service_requested || "") === String(req.query.service || "")); if (scopeOwn(req.user)) pool = pool.filter(l => mine(req.user, l)); res.json(pool.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 500).map(leadView)); });

// Gregory P0s (§25): field reports, timesheets, site visits, documents
app.get("/api/ops", requireAuth, modGate("ops"), (req: any, res) => {
  const ws = req.user.workspace_id;
  res.json({
    field_reports: db.prepare("SELECT f.*, u.name manager FROM field_reports f LEFT JOIN users u ON u.id=f.manager_id WHERE f.workspace_id=? ORDER BY f.report_date DESC").all(ws),
    timesheets: db.prepare("SELECT t.*, u.name manager FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? ORDER BY t.week_of DESC").all(ws),
    site_visits: db.prepare("SELECT v.*, l.service_requested FROM site_visits v LEFT JOIN leads l ON l.id=v.lead_id WHERE v.workspace_id=? AND v.status='scheduled' ORDER BY v.scheduled_at").all(ws),
    documents: db.prepare("SELECT * FROM documents WHERE workspace_id=?").all(ws),
  });
});
// (field-reports submit is the richer slice-22 route below — notes + job link)
// ---------- slice 20: timesheets — log, chase, payroll export ----------
app.get("/api/timesheets", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const week = String(req.query.week || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const rows = db.prepare("SELECT t.*, COALESCE(w.name, u.name) manager, w.id worker_row FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id LEFT JOIN workers w ON w.id=t.worker_id WHERE t.workspace_id=? AND t.week_of=? ORDER BY manager").all(ws, week) as any[];
  const wkEnd = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  for (const r of rows) { try { r.days = r.days ? JSON.parse(r.days) : null; } catch { r.days = null; } r.overdue = r.status === "missing" && week < weekStartOf(new Date());
    const j = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a FROM time_entries WHERE workspace_id=? AND (worker_id=? OR user_id=?) AND entry_date>=? AND entry_date<=?").get(ws, r.worker_id || "__none__", r.manager_id || "__none__", week, wkEnd) as any;
    r.job_hours = j.h; r.job_cost = Math.round(j.a * 100) / 100; }
  let viewTs = rows as any[]; { const p = permsOf(req.user); if (p.schedule_scope === "mine" && !p.can_manage_team) { const myW = new Set((db.prepare("SELECT id FROM workers WHERE linked_user_id=?").all(req.user.id) as any[]).map(w => w.id)); viewTs = viewTs.filter(r => r.manager_id === req.user.id || (r.worker_row && myW.has(r.worker_row)) || (r.worker_id && myW.has(r.worker_id))); } }
  const summary = { submitted: viewTs.filter(r => r.status === "submitted").length, missing: viewTs.filter(r => r.status === "missing").length, total_hours: viewTs.reduce((a, r) => a + (r.hours || 0), 0), job_hours: rows.reduce((a, r) => a + (r.job_hours || 0), 0), job_cost: Math.round(rows.reduce((a, r) => a + (r.job_cost || 0), 0) * 100) / 100 };
  res.json({ week_of: week, rows: viewTs, summary });
});
app.post("/api/timesheets", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const b = req.body || {};
  const week = String(b.week_of || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const days = b.days && typeof b.days === "object" ? b.days : null;
  const hours = days ? sumDays(days) : (Number(b.hours) || 0);
  if (b.worker_id) { // v3: office files a sheet for a roster worker (no login needed)
    const row = db.prepare("SELECT * FROM timesheets WHERE workspace_id=? AND worker_id=? AND week_of=?").get(ws, b.worker_id, week) as any;
    if (!row) return res.status(422).json({ error: { code: "bad_worker" } });
    db.prepare("UPDATE timesheets SET status='submitted', submitted_at=?, hours=?, days=?, notes=? WHERE id=?").run(now(), hours, days ? JSON.stringify(days) : null, String(b.notes || ""), row.id);
    return res.json(db.prepare("SELECT * FROM timesheets WHERE id=?").get(row.id));
  }
  const managerId = b.manager_id || req.user.id;
  const mgr = db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=?").get(managerId, ws) as any;
  if (!mgr) return res.status(422).json({ error: { code: "bad_manager" } });
  db.prepare("UPDATE timesheets SET status='submitted', submitted_at=?, hours=?, days=?, notes=? WHERE workspace_id=? AND manager_id=? AND week_of=?")
    .run(now(), hours, days ? JSON.stringify(days) : null, String(b.notes || ""), ws, managerId, week);
  res.json(db.prepare("SELECT * FROM timesheets WHERE workspace_id=? AND manager_id=? AND week_of=?").get(ws, managerId, week));
});
app.post("/api/timesheets/:id/chase", requireAuth, async (req: any, res) => { if (!permsOf(req.user).can_manage_team) return res.status(403).json({ error: { code: "permission_denied", message: "Chasing timesheets is a manager action — your access doesn't include it." } });
  const row = db.prepare("SELECT * FROM timesheets WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!row) return res.status(404).json({ error: { code: "not_found" } });
  const r = await chaseRow(row);
  res.json({ chased: true, delivery: r.delivery, message: r.message });
});
app.get("/api/timesheets/export", requireAuth, needPerm("can_export"), (req: any, res) => {
  const ws = req.user.workspace_id; const week = String(req.query.week || weekStartOf(new Date()));
  ensureWeek(ws, week);
  const rows = (db.prepare("SELECT t.*, u.name manager, u.email FROM timesheets t LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? AND t.week_of=? ORDER BY u.name").all(ws, week) as any[]).filter(r => r.status === "approved");
  const head = "manager,email,week_of,mon,tue,wed,thu,fri,sat,sun,grid_hours,job_hours,total_hours,labor_cost,status,notes";
  const wkEnd2 = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const lines = rows.map(r => { let d: any = {}; try { d = r.days ? JSON.parse(r.days) : {}; } catch { d = {}; } const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`; const j = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a FROM time_entries WHERE workspace_id=? AND (worker_id=? OR user_id=?) AND entry_date>=? AND entry_date<=?").get(ws, r.worker_id || "__none__", r.manager_id || "__none__", week, wkEnd2) as any; return [esc(r.manager), esc(r.email), r.week_of, d.mon || "", d.tue || "", d.wed || "", d.thu || "", d.fri || "", d.sat || "", d.sun || "", r.hours ?? "", j.h, (Number(r.hours) || 0) + j.h, Math.round(j.a * 100) / 100, r.status, esc(r.notes || "")].join(","); });
  for (const r of rows) db.prepare("UPDATE timesheets SET status='exported' WHERE id=? AND status='approved'").run(r.id);
  res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", `attachment; filename="timesheets-${week}.csv"`);
  res.send([head, ...lines].join("\n"));
});
// ---------- slice 22: field reports, daily standard ----------
app.get("/api/field-reports", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const date = String(req.query.date || todayStr());
  ensureDay(ws, date);
  const rows = db.prepare("SELECT f.*, COALESCE(w.name, u.name) manager, l.service_requested job_service, c.name job_customer FROM field_reports f LEFT JOIN users u ON u.id=f.manager_id LEFT JOIN workers w ON w.id=f.worker_id LEFT JOIN leads l ON l.id=f.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE f.workspace_id=? AND f.report_date=? ORDER BY manager").all(ws, date) as any[];
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
app.post("/api/field-reports/:id/chase", requireAuth, async (req: any, res) => { if (!permsOf(req.user).can_manage_team) return res.status(403).json({ error: { code: "permission_denied", message: "Chasing field reports is a manager action — your access doesn't include it." } });
  const r = db.prepare("SELECT * FROM field_reports WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!r) return res.status(404).json({ error: { code: "not_found" } });
  const out = await chaseReport(r);
  res.json({ chased: true, delivery: out.delivery, message: out.message });
});
// ---------- slice 23: crew scheduling ----------
app.get("/api/schedule/jobs", requireAuth, (req: any, res) => {
  const rows = db.prepare("SELECT l.id, l.service_requested, l.state, c.name contact_name FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=? AND l.state IN ('PROPOSAL','SENT','WON') ORDER BY l.created_at DESC LIMIT 100").all(req.user.workspace_id);
  res.json(rows);
});
// ---- Invoices (v17): real records + payment allocation; the source of AR truth ----
const ensureInvoiceToken = (i: any): string => { if (!i.token) { i.token = uid("invtok") + randomBytes(12).toString("hex"); try { db.prepare("UPDATE invoices SET token=? WHERE id=?").run(i.token, i.id); } catch { /* read-only race */ } } return i.token; };
const invView = (i: any) => ({ ...i, token: ensureInvoiceToken(i), link: "/invoice/" + ensureInvoiceToken(i), lines: JSON.parse(i.lines || "[]"), balance: Math.round(((i.total || 0) - (i.paid_amount || 0)) * 100) / 100, overdue: i.status !== "paid" && i.status !== "void" && i.due_at && new Date(i.due_at) < new Date() });
app.get("/api/invoices", requireAuth, (req: any, res) => { res.json((db.prepare("SELECT i.*, l.service_requested FROM invoices i LEFT JOIN leads l ON l.id=i.lead_id WHERE i.workspace_id=? ORDER BY i.created_at DESC LIMIT 200").all(req.user.workspace_id) as any[]).map(invView)); });
app.post("/api/jobs/:id/invoice", requireAuth, async (req: any, res) => {
  const ws = req.user.workspace_id; const job = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, ws) as any;
  if (!job) return res.status(404).json({ error: { code: "not_found" } });
  const paidInv = db.prepare("SELECT id FROM invoices WHERE job_id=? AND status='paid'").get(job.id);
  if (paidInv) return res.status(409).json({ error: { code: "already_invoiced", message: "This job already has a paid invoice — a second full invoice would double-bill the customer." } });
  const open = db.prepare("SELECT id FROM invoices WHERE job_id=? AND status IN ('sent','partially_paid')").get(job.id);
  if (open) return res.status(409).json({ error: { code: "invoice_open", message: "This job already has an open invoice — collect or void it first." } });
  const n = ((db.prepare("SELECT COUNT(*) c FROM invoices WHERE workspace_id=?").get(ws) as any).c || 0) + 1;
  const id = uid("inv"); const total = Math.round((job.value || 0) * 100) / 100;
  const leadSvc = (db.prepare("SELECT service_requested FROM leads WHERE id=?").get(job.lead_id) as any)?.service_requested;
  const lines = [{ description: `Job — ${leadSvc || "services"}`, qty: 1, unit_price: total, line_total: total }];
  db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,proposal_id,number,status,lines,total,paid_amount,due_at,issued_at,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'manual',?)")
    .run(id, ws, job.lead_id, job.id, job.proposal_id || null, "INV-" + String(n).padStart(4, "0"), "sent", JSON.stringify(lines), total, 0, new Date(Date.now() + (Number(req.body?.due_days || 30)) * 86400000).toISOString(), now(), now());
  db.prepare("UPDATE jobs SET invoice_status='invoiced' WHERE id=?").run(job.id);
  audit(ws, req.user.id, "invoice.created", "invoice", id, { job_id: job.id, total });
  // v52: a deposit already collected on this lead is CREDITED here — the
  // customer never pays the deposit twice.
  let depositCredit = 0;
  try { const { applyDepositsToInvoice } = await import("./payments.ts"); depositCredit = applyDepositsToInvoice(ws, db.prepare("SELECT * FROM invoices WHERE id=?").get(id)); } catch { /* crediting is best-effort; the invoice stands */ }
  const view = invView(db.prepare("SELECT * FROM invoices WHERE id=?").get(id)); if (depositCredit > 0) (view as any).deposit_credit_applied = depositCredit;
  res.status(201).json(view);
});
app.post("/api/invoices/:id/payments", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(req.params.id, ws) as any;
  if (!inv) return res.status(404).json({ error: { code: "not_found" } });
  if (inv.status === "void" || inv.status === "paid") return res.status(422).json({ error: { code: "invoice_closed" } });
  const amount = Math.round(Number(req.body?.amount || 0) * 100) / 100;
  const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
  if (!(amount > 0)) return res.status(422).json({ error: { code: "bad_amount" } });
  if (amount > balance + 0.001) return res.status(422).json({ error: { code: "overpayment", message: `Payment $${amount} exceeds the invoice balance $${balance}.` } });
  const pid = uid("pay");
  db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,invoice_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,?,'invoice_payment',?,?,'paid',?,?)").run(pid, ws, inv.proposal_id || null, inv.id, amount, req.body?.mode === "live" ? "live" : "test", now(), now());
  const paid = Math.round(((inv.paid_amount || 0) + amount) * 100) / 100;
  const status = paid >= (inv.total || 0) - 0.001 ? "paid" : "partially_paid";
  db.prepare("UPDATE invoices SET paid_amount=?, status=? WHERE id=?").run(paid, status, inv.id);
  if (status === "paid" && inv.job_id) db.prepare("UPDATE jobs SET invoice_status='paid' WHERE id=?").run(inv.job_id);
  if (status === "paid") { const jl = inv.job_id ? db.prepare("SELECT lead_id FROM jobs WHERE id=?").get(inv.job_id) as any : null; onInvoicePaid(ws, jl?.lead_id || inv.lead_id); }
  audit(ws, req.user.id, "invoice.payment", "invoice", inv.id, { amount, status });
  res.status(201).json(invView(db.prepare("SELECT * FROM invoices WHERE id=?").get(inv.id)));
});
app.post("/api/invoices/:id/void", requireAuth, (req: any, res) => { const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!inv) return res.status(404).json({ error: { code: "not_found" } }); if ((inv.paid_amount || 0) > 0) return res.status(422).json({ error: { code: "has_payments", message: "An invoice with payments cannot be voided — refund through the proposal instead." } }); db.prepare("UPDATE invoices SET status='void' WHERE id=?").run(inv.id); res.json({ ok: true }); });
app.post("/api/invoices/:id/send", requireAuth, async (req: any, res) => {
  const ws = req.user.workspace_id;
  const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(req.params.id, ws) as any;
  if (!inv) return res.status(404).json({ error: { code: "not_found" } });
  if (inv.status === "void") return res.status(422).json({ error: { code: "void_invoice" } });
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(inv.lead_id) as any;
  const contact = lead?.contact_id ? db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any : null;
  const email = contact?.email || lead?.contact_email;
  if (!email) return res.status(422).json({ error: { code: "no_email", message: "This customer has no email address on file — add one to the lead first." } });
  const tpl = getTemplate(ws);
  const base = `${req.protocol}://${req.get("host")}`;
  const link = `${base}/invoice/${ensureInvoiceToken(inv)}`;
  const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
  const body = `Hello ${contact?.name || "there"},\n\nYour invoice ${inv.number} from ${tpl.company} is ready.\n\nTotal: $${Number(inv.total || 0).toFixed(2)}${(inv.paid_amount || 0) > 0 ? `\nPaid: $${Number(inv.paid_amount).toFixed(2)}` : ""}\nBalance due: $${balance.toFixed(2)}${inv.due_at ? `\nDue: ${new Date(inv.due_at).toLocaleDateString()}` : ""}\n\nView and pay online: ${link}\n\nThank you,\n${tpl.company}`;
  const msg: any = await queueAndDeliver(ws, { lead_id: inv.lead_id, channel: "email", to: email, subject: `Invoice ${inv.number} from ${tpl.company} — balance $${balance.toFixed(2)}`, body });
  if (msg?.status === "suppressed") return res.status(422).json({ error: { code: "suppressed", message: "This address has opted out of email." } });
  db.prepare("UPDATE invoices SET sent_at=? WHERE id=?").run(now(), inv.id);
  audit(ws, req.user.id, "invoice.sent", "invoice", inv.id, { to: email, status: msg?.status });
  res.json({ ok: true, delivery: msg?.status || "queued", test_mode: msg?.status === "test_mode", link });
});
app.get("/api/invoices/:id/document", requireAuth, async (req: any, res) => {
  const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!inv) return res.status(404).json({ error: { code: "not_found" } });
  const base = `${req.protocol}://${req.get("host")}`;
  const out = await invoiceDocx(inv.id, `${base}/invoice/${ensureInvoiceToken(inv)}`);
  if (!out) return res.status(404).json({ error: { code: "not_found" } });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
  res.send(out.buffer);
});
function invoiceByToken(token: string) {
  const inv = db.prepare("SELECT * FROM invoices WHERE token=?").get(token) as any;
  if (!inv) return null;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(inv.lead_id) as any;
  const contact = lead?.contact_id ? db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any : null;
  const job = inv.job_id ? db.prepare("SELECT * FROM jobs WHERE id=?").get(inv.job_id) as any : null;
  return { inv, lead, contact, job, tpl: getInvoiceTemplate(inv.workspace_id) };
}
// v45: email engagement tracking (public). The token only ever identifies one
// sent message; unknown tokens still return the pixel so nothing leaks.
const PIXEL = Buffer.from("R0lGODlhAQABAAAAACwAAAAAAQABAAA=", "base64");
app.get("/t/o/:file", (req: any, res: any) => { try { const tok = String(req.params.file || "").replace(/\.gif$/, ""); const m = db.prepare("SELECT workspace_id FROM messages_outbox WHERE track_token=?").get(tok) as any; if (m) db.prepare("INSERT INTO track_events (id,workspace_id,token,kind,created_at) VALUES (?,?,?,'open',?)").run(uid("trk"), m.workspace_id, tok, now()); } catch { /* tracking never breaks the pixel */ }
  res.setHeader("Content-Type", "image/gif"); res.setHeader("Cache-Control", "no-store"); res.end(PIXEL); });
app.get("/t/c/:tok", (req: any, res: any) => { const u = String(req.query.u || ""); if (!/^https?:\/\//i.test(u)) return res.status(400).send("bad link");
  try { const m = db.prepare("SELECT workspace_id FROM messages_outbox WHERE track_token=?").get(req.params.tok) as any; if (m) db.prepare("INSERT INTO track_events (id,workspace_id,token,kind,url,created_at) VALUES (?,?,?,'click',?,?)").run(uid("trk"), m.workspace_id, req.params.tok, u.slice(0, 500), now()); } catch { /* still redirect */ }
  res.redirect(302, u); });

// v45: missed-call text-back. A business points its phone system / Twilio voice
// webhook (or CallRail) at this endpoint with its workspace API key: the caller
// gets one immediate text back, a lead is created or matched, and a callback
// task lands on the board. Transactional by nature (a direct reply to the
// customer's own call) — it bypasses the marketing-consent gate but never the
// suppression list, and it fires at most once per number per 24 hours.
app.post("/api/webhooks/missed-call", async (req: any, res: any) => { const b = req.body || {}; const key = String(b.workspace_key || req.headers["x-api-key"] || "");
  const wsr = key ? db.prepare("SELECT * FROM workspaces WHERE source_api_key=?").get(key) as any : null; if (!wsr) return res.status(401).json({ error: { code: "bad_key" } });
  const phone = String(b.phone || "").replace(/\D/g, ""); if (phone.length < 7) return res.status(422).json({ error: { code: "bad_phone" } });
  const key2 = dedupeKey(phone, undefined);
  let lead = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND dedupe_key=?").get(wsr.id, key2) as any;
  if (!lead) { const r: any = createLead(wsr.id, "missed-call", { contact: { name: b.name || "", phone }, service_requested: b.service || "", source: "missed_call" }); lead = r?.lead || db.prepare("SELECT * FROM leads WHERE workspace_id=? AND dedupe_key=?").get(wsr.id, key2); }
  if (!lead) return res.status(422).json({ error: { code: "lead_failed" } });
  const recent = db.prepare("SELECT id FROM lead_events WHERE workspace_id=? AND lead_id=? AND type='missed_call_textback' AND created_at>?").get(wsr.id, lead.id, new Date(Date.now() - 86400000).toISOString()) as any;
  if (recent) return res.json({ ok: true, lead_id: lead.id, text_back: "skipped_recent" });
  const first = String(b.name || lead.contact_name || "").split(/\s+/)[0];
  const tpl = wsr.missed_call_text || "Hi{first}, this is {business} — sorry we missed your call! Tell us what you need and we'll get right back to you.";
  const body = tpl.replaceAll("{business}", wsr.name || "").replaceAll("{first}", first ? " " + first : "");
  const sent: any = await queueAndDeliver(wsr.id, { lead_id: lead.id, channel: "sms", to: phone, body, transactional: true });
  logEvent(wsr.id, lead.id, "system", "missed_call_textback", null, sent?.status || "queued", { phone });
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?, 'call', ?, ?, 'open', ?)").run(uid("tsk"), wsr.id, lead.id, lead.owner_id || null, `📞 Call back ${b.name || phone} — missed call`, new Date(Date.now() + 3600000).toISOString(), now());
  res.json({ ok: true, lead_id: lead.id, text_back: sent?.status || "queued" }); });

app.get("/invoice/:token", (req, res) => {
  const ctx = invoiceByToken(req.params.token);
  if (!ctx) return res.status(404).send("Invoice not found");
  const { inv, lead, contact, job, tpl } = ctx;
  const e = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const money = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines = JSON.parse(inv.lines || "[]") as any[];
  const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
  const paid = inv.status === "paid" || balance <= 0;
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Invoice ${e(inv.number)} — ${e(tpl.company)}</title><style>
  body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:26px 18px 40px;color:#101613;background:#fff}
  .lh{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #0E5C3A;padding-bottom:14px}
  .co{font-size:26px;font-weight:800;color:#0E5C3A;letter-spacing:-.02em}.tag{color:#5B6B62;font-size:13px;margin-top:2px}
  .ct{text-align:right;color:#5B6B62;font-size:13px;line-height:1.5}
  h1{font-size:21px;letter-spacing:.04em;color:#0E5C3A;margin:22px 0 2px}.svc{color:#5B6B62;margin:0 0 16px}
  .meta{display:flex;gap:26px;flex-wrap:wrap;background:#EDF2EE;border-radius:10px;padding:12px 16px;font-size:13.5px;margin-bottom:18px}
  .meta b{display:block;font-size:11px;letter-spacing:.08em;color:#0E5C3A;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;font-size:14.5px}th{background:#0E5C3A;color:#fff;text-align:left;padding:9px 10px;font-size:12.5px;letter-spacing:.05em}
  td{padding:9px 10px;border-bottom:1px solid #D9DEDB}.r{text-align:right}
  .tot td{border-bottom:0;font-weight:700}.band td{background:#0E5C3A;color:#fff;font-weight:800;font-size:16px}
  .paybtn{background:#0E5C3A;color:#fff;border:0;padding:14px 22px;border-radius:10px;width:100%;font-size:16px;font-weight:700;cursor:pointer;margin-top:18px}
  .paidbox{background:#dcfce7;color:#166534;border-radius:10px;padding:14px 16px;font-weight:700;text-align:center;margin-top:18px}
  .note{background:#fffbeb;color:#92400e;border-radius:10px;padding:10px 14px;font-size:13.5px;margin-top:14px}
  .docfoot{color:#5B6B62;font-size:12.5px;text-align:center;margin-top:28px;border-top:1px solid #D9DEDB;padding-top:12px}
  </style>
  <div class="lh"><div><div class="co">${e(tpl.company)}</div>${tpl.tagline ? `<div class="tag">${e(tpl.tagline)}</div>` : ""}</div><div class="ct">${e(tpl.contact_line)}${tpl.address ? `<br>${e(tpl.address)}` : ""}</div></div>
  <h1>INVOICE</h1><p class="svc">${e(inv.number)}${job?.service_requested || lead?.service_requested ? " · " + e(job?.service_requested || lead?.service_requested) : ""}</p>
  <div class="meta"><div><b>BILLED TO</b>${e(contact?.name || lead?.contact_name || "—")}</div><div><b>ISSUED</b>${new Date(inv.issued_at || inv.created_at).toLocaleDateString()}</div>${inv.due_at ? `<div><b>DUE</b>${new Date(inv.due_at).toLocaleDateString()}</div>` : ""}<div><b>STATUS</b>${paid ? "Paid" : e(String(inv.status).replace("_", " "))}</div></div>
  ${req.query.paid ? `<div class="paidbox">✅ Payment received — thank you!</div>` : ""}
  <table><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr>
  ${lines.map((l: any) => `<tr><td>${e(l.description || l.name || "Service")}</td><td class="r">${e(l.qty ?? 1)}</td><td class="r">${money(l.unit_price)}</td><td class="r">${money(l.line_total ?? (Number(l.unit_price || 0) * (l.qty || 1)))}</td></tr>`).join("")}
  <tr class="tot"><td colspan="3" class="r">Total</td><td class="r">${money(inv.total)}</td></tr>
  ${(inv.paid_amount || 0) > 0 ? `<tr class="tot"><td colspan="3" class="r">Paid</td><td class="r">−${money(inv.paid_amount)}</td></tr>` : ""}
  <tr class="band"><td colspan="3" class="r">BALANCE DUE</td><td class="r">${money(balance)}</td></tr></table>
  ${paid ? `<div class="paidbox">✅ This invoice is paid in full. Thank you!</div>` : inv.status === "void" ? `<div class="note">This invoice has been voided.</div>` : `<form method="POST" action="/invoice/${e(inv.token)}/pay"><button class="paybtn">Pay ${money(balance)} →</button></form><p class="note">You'll be taken to a secure payment page. ${stripeMode() === "test" ? "This deployment is in test mode — no real charge is made." : ""}</p>`}
  ${tpl.intro_html ? `<div class="note" style="text-align:left">${tpl.intro_html}</div>` : ""}
  ${tpl.terms_html ? `<div class="note" style="text-align:left"><b>Terms.</b> ${tpl.terms_html}</div>` : ""}
  <div class="docfoot">${tpl.footer ? e(tpl.footer) + " · " : ""}${e(tpl.company)} · Invoice ${e(inv.number)}</div>`);
});
app.post("/invoice/:token/pay", express.urlencoded({ extended: false }), async (req, res) => {
  const ctx = invoiceByToken(req.params.token);
  if (!ctx) return res.status(404).send("Invoice not found");
  const base = `${req.protocol}://${req.get("host")}`;
  try { const pay = await createInvoicePayment(ctx.inv.id, base); if (!pay) return res.redirect(`/invoice/${req.params.token}`); res.redirect(pay.link); }
  catch (e: any) { res.redirect(`/invoice/${req.params.token}`); }
});
app.post("/api/invoices/backfill", requireAuth, needPerm("can_settings"), (req: any, res) => { const ws = req.user.workspace_id; let made = 0; for (const job of db.prepare("SELECT * FROM jobs WHERE workspace_id=? AND invoice_status IN ('invoiced','paid')").all(ws) as any[]) { if (db.prepare("SELECT id FROM invoices WHERE job_id=?").get(job.id)) continue; const n = ((db.prepare("SELECT COUNT(*) c FROM invoices WHERE workspace_id=?").get(ws) as any).c || 0) + 1; const paid = job.invoice_status === "paid"; db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,proposal_id,number,status,lines,total,paid_amount,due_at,issued_at,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(uid("inv"), ws, job.lead_id, job.id, job.proposal_id || null, "INV-" + String(n).padStart(4, "0"), paid ? "paid" : "sent", JSON.stringify([{ description: `Job — ${(db.prepare("SELECT service_requested FROM leads WHERE id=?").get(job.lead_id) as any)?.service_requested || "services"}`, qty: 1, unit_price: job.value || 0, line_total: job.value || 0 }]), job.value || 0, paid ? (job.value || 0) : 0, now(), job.created_at, "backfill", now()); made++; } audit(ws, req.user.id, "invoice.backfill", "invoice", null, { made }); res.json({ ok: true, made }); });
app.get("/api/schedule", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const week = String(req.query.week || weekStartOf(new Date()));
  const wkEnd = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare("SELECT s.*, COALESCE(w.name, u.name) worker, l.service_requested, l.owner_id, l.pm_id, c.name contact_name FROM job_schedule s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN workers w ON w.id=s.worker_id LEFT JOIN leads l ON l.id=s.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE s.workspace_id=? AND s.work_date>=? AND s.work_date<=? ORDER BY s.work_date, worker").all(ws, week, wkEnd) as any[];
  let viewRows = rows as any[];
  { const p = permsOf(req.user); if (p.schedule_scope === "mine" && !p.can_complete_others) { const myWorkers = new Set((db.prepare("SELECT id FROM workers WHERE linked_user_id=?").all(req.user.id) as any[]).map(w => w.id)); viewRows = viewRows.filter(r => r.user_id === req.user.id || (r.worker_id && myWorkers.has(r.worker_id)) || leadVisible(req.user, { owner_id: r.owner_id, pm_id: r.pm_id })); } }
  const byUserDay: Record<string, Set<string>> = {};
  for (const r of viewRows) { const k = (r.worker_id || r.user_id) + "|" + r.work_date; (byUserDay[k] = byUserDay[k] || new Set()).add(r.lead_id); }
  for (const r of viewRows) r.conflict = (byUserDay[(r.worker_id || r.user_id) + "|" + r.work_date]?.size || 0) > 1;
  const schedJobs = db.prepare("SELECT j.id, j.lead_id, j.scheduled_start, j.scheduled_end, j.stage, l.service_requested, c.name contact_name FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE j.workspace_id=? AND j.scheduled_start IS NOT NULL AND date(j.scheduled_start)>=? AND date(j.scheduled_start)<=? AND j.stage NOT IN ('CANCELLED','CLOSED') ORDER BY j.scheduled_start").all(ws, week, wkEnd) as any[];
  // v53: site visits are part of the crew schedule — one record, every
  // surface. Only live (scheduled) visits ride along; a cancelled visit
  // disappears here, from Ops, from the agenda and from the job at once.
  let visits = db.prepare("SELECT v.id, v.lead_id, v.assigned_to, v.scheduled_at, v.status, v.notes, l.service_requested, l.owner_id, l.pm_id, c.name contact_name, u.name assignee_name FROM site_visits v JOIN leads l ON l.id=v.lead_id LEFT JOIN contacts c ON c.id=l.contact_id LEFT JOIN users u ON u.id=v.assigned_to WHERE v.workspace_id=? AND v.status='scheduled' AND date(v.scheduled_at)>=? AND date(v.scheduled_at)<=? ORDER BY v.scheduled_at").all(ws, week, wkEnd) as any[];
  { const p = permsOf(req.user); if (p.schedule_scope === "mine" && !p.can_complete_others) visits = visits.filter(v => v.assigned_to === req.user.id || leadVisible(req.user, v)); }
  res.json({ week_of: week, rows: viewRows, visits: visits.map(v => ({ ...v, work_date: String(v.scheduled_at).slice(0, 10), time: String(v.scheduled_at).slice(11, 16) })), jobs: permsOf(req.user).jobs_scope === "all" ? schedJobs : schedJobs.filter((j: any) => jobVisible(req.user, j)) });
});
app.post("/api/schedule", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const b = req.body || {};
  const lead = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(String(b.lead_id || ""), ws) as any;
  const w = resolveWorker(ws, b); // user_id | worker_id | worker_name — roster workers schedule without accounts
  if (!lead || !w) return res.status(422).json({ error: { code: "bad_job_or_worker" } });
  const dupe = db.prepare("SELECT id FROM job_schedule WHERE lead_id=? AND work_date=? AND (worker_id=? OR user_id=?)").get(lead.id, String(b.work_date || todayStr()), w.id, w.linked_user_id || "__none__");
  if (dupe) return res.status(409).json({ error: { code: "already_scheduled" } });
  const id = uid("sch");
  db.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,worker_id,work_date,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws, lead.id, w.linked_user_id || null, w.id, String(b.work_date || todayStr()), String(b.note || ""), req.user.id, now());
  if (w.linked_user_id) notify(ws, [w.linked_user_id], "scheduled", `🗓 You're scheduled — ${String(b.work_date || todayStr())}`, "You've been assigned to a job that day. Open Ops Console → Crew schedule for details.");
  const conflicts = db.prepare("SELECT s.id, s.lead_id, l.service_requested FROM job_schedule s JOIN leads l ON l.id=s.lead_id WHERE s.workspace_id=? AND s.work_date=? AND s.lead_id!=? AND (s.worker_id=? OR s.user_id=?)").all(ws, String(b.work_date || todayStr()), lead.id, w.id, w.linked_user_id || "__none__") as any[];
  ensureWeek(ws, weekStartOf(new Date(String(b.work_date || todayStr()) + "T12:00:00")));
  const created = db.prepare("SELECT * FROM job_schedule WHERE id=?").get(id) as any;
  const mappedConflicts = conflicts.map((c: any) => ({ schedule_id: c.id, lead_id: c.lead_id, service_requested: c.service_requested, warning: "Same worker already booked that day" }));
  if (conflicts.length >= 2) mappedConflicts.push({ schedule_id: null, lead_id: lead.id, service_requested: lead.service_requested, warning: `Overload: this worker now has ${conflicts.length + 1} assignments that day` } as any);
  res.json({ ...created, conflicts: mappedConflicts });
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
  const w = resolveWorker(ws, req.body || {}); // user_id | worker_id | worker_name (type-to-create)
  if (!w) return res.status(422).json({ error: { code: "bad_worker" } });
  const onCrew = db.prepare("SELECT id FROM job_crew WHERE lead_id=? AND (worker_id=? OR user_id=?)").get(req.params.id, w.id, w.linked_user_id || "__none__");
  if (!onCrew) { try { db.prepare("INSERT INTO job_crew (id,workspace_id,lead_id,user_id,worker_id,created_at) VALUES (?,?,?,?,?,?)").run(uid("crew"), ws, req.params.id, w.linked_user_id || null, w.id, now()); } catch { /* already on crew */ } }
  res.json(jobLabor(ws, req.params.id));
});
app.delete("/api/leads/:id/crew/:userId", requireAuth, (req: any, res) => {
  db.prepare("DELETE FROM job_crew WHERE lead_id=? AND (user_id=? OR worker_id=?) AND workspace_id=?").run(req.params.id, req.params.userId, req.params.userId, req.user.workspace_id);
  res.json(jobLabor(req.user.workspace_id, req.params.id));
});
// ---------- v3 slice 29: roster workers + log time from anywhere ----------
app.get("/api/workers", requireAuth, (req: any, res) => res.json(listWorkers(req.user.workspace_id)));
app.post("/api/workers", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const b = req.body || {};
  if (b.user_id) { const w = resolveWorker(ws, { user_id: b.user_id }); return w ? res.status(201).json(w) : res.status(422).json({ error: { code: "bad_user" } }); }
  if (!String(b.name || "").trim()) return res.status(422).json({ error: { code: "name_required" } });
  const w = resolveWorker(ws, { worker_name: b.name, phone: b.phone, labor_class_id: b.labor_class_id });
  if (b.labor_class_id || b.phone) db.prepare("UPDATE workers SET labor_class_id=COALESCE(?,labor_class_id), phone=COALESCE(NULLIF(?,''),phone) WHERE id=?").run(b.labor_class_id || null, b.phone || "", w.id);
  res.status(201).json(db.prepare("SELECT * FROM workers WHERE id=?").get(w.id));
});
app.post("/api/workers/bulk", requireAuth, (req: any, res) => {
  const names = (Array.isArray(req.body?.names) ? req.body.names : String(req.body?.text || "").split("\n")).map((n: any) => String(n).trim()).filter(Boolean).slice(0, 200);
  const out = names.map((n: string) => resolveWorker(req.user.workspace_id, { worker_name: n }));
  res.status(201).json({ created_or_found: out.length, workers: out });
});
app.patch("/api/workers/:id", requireAuth, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workers WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  const b = req.body || {};
  db.prepare("UPDATE workers SET name=COALESCE(?,name), phone=COALESCE(?,phone), labor_class_id=?, active=COALESCE(?,active) WHERE id=?")
    .run(b.name || null, b.phone ?? null, b.labor_class_id !== undefined ? b.labor_class_id : w.labor_class_id, b.active !== undefined ? (b.active ? 1 : 0) : null, w.id);
  if (w.linked_user_id && b.labor_class_id !== undefined) db.prepare("UPDATE users SET labor_class_id=? WHERE id=?").run(b.labor_class_id, w.linked_user_id);
  res.json(db.prepare("SELECT * FROM workers WHERE id=?").get(w.id));
});
app.post("/api/time", requireAuth, (req: any, res) => { // global quick-log: job_id or lead_id + worker by id/name/user
  const ws = req.user.workspace_id; const b = req.body || {};
  let leadId = b.lead_id || null;
  if (!leadId && b.job_id) { const j = db.prepare("SELECT lead_id FROM jobs WHERE id=? AND workspace_id=?").get(b.job_id, ws) as any; leadId = j?.lead_id || null; }
  if (!leadId) return res.status(422).json({ error: { code: "job_required" } });
  const r = logTime(ws, leadId, req.user.id, b);
  if ((r as any).error) return res.status(422).json({ error: { code: (r as any).error } });
  res.status(201).json(r);
});
app.get("/api/time/grid", requireAuth, (req: any, res) => { // weekly workers x jobs matrix for office entry
  const ws = req.user.workspace_id; const week = String(req.query.week || weekStartOf(new Date()));
  const wkEnd = new Date(new Date(week + "T12:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const entries = db.prepare("SELECT t.*, l.service_requested FROM time_entries t JOIN leads l ON l.id=t.lead_id WHERE t.workspace_id=? AND t.entry_date>=? AND t.entry_date<=? ORDER BY t.entry_date").all(ws, week, wkEnd) as any[];
  const workers = listWorkers(ws).filter((w: any) => w.active);
  const jobs = db.prepare("SELECT DISTINCT t.lead_id, l.service_requested, c.name contact_name FROM time_entries t JOIN leads l ON l.id=t.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE t.workspace_id=? AND t.entry_date>=? AND t.entry_date<=?").all(ws, week, wkEnd) as any[];
  const seenJ = new Set(jobs.map((x: any) => x.lead_id));
  for (const sj of db.prepare("SELECT DISTINCT s.lead_id, l.service_requested, c.name contact_name FROM job_schedule s JOIN leads l ON l.id=s.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE s.workspace_id=? AND s.work_date>=? AND s.work_date<=?").all(ws, week, wkEnd) as any[]) if (!seenJ.has(sj.lead_id)) { jobs.push(sj); seenJ.add(sj.lead_id); }
  for (const sj of db.prepare("SELECT DISTINCT j.lead_id, l.service_requested, c.name contact_name FROM jobs j JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE j.workspace_id=? AND j.scheduled_start IS NOT NULL AND date(j.scheduled_start)>=? AND date(j.scheduled_start)<=? AND j.stage NOT IN ('CANCELLED','CLOSED')").all(ws, week, wkEnd) as any[]) if (!seenJ.has(sj.lead_id)) { jobs.push(sj); seenJ.add(sj.lead_id); }
  res.json({ week_of: week, workers, jobs, entries });
});
app.post("/api/time/grid", requireAuth, (req: any, res) => { // bulk save: [{lead_id, worker_name|worker_id, entry_date, hours, note}]
  const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 300) : [];
  let ok = 0; const errs: any[] = [];
  for (const r of rows) { if (!(Number(r.hours) > 0)) continue; const x = logTime(req.user.workspace_id, r.lead_id, req.user.id, r); if ((x as any).error) errs.push({ row: r, error: (x as any).error }); else ok++; }
  res.json({ saved: ok, errors: errs });
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
// ---------- v3 slice 30: jobs — the operational half of a won lead ----------
export const JOB_STAGES = ["AWAITING_SCHEDULING", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE", "INVOICED", "CLOSED", "CANCELLED"];
function backfillJobs(ws: string) { const won = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND state='WON'").all(ws) as any[]; for (const l of won) ensureJobForLead(ws, "system", l); }
function jobView(j: any) {
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(j.lead_id) as any;
  const v = l ? leadView(l) : null;
  const lab = db.prepare("SELECT COALESCE(SUM(hours),0) h, COALESCE(SUM(amount),0) a FROM time_entries WHERE workspace_id=? AND lead_id=?").get(j.workspace_id, j.lead_id) as any;
  const docs = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN status='received' THEN 1 ELSE 0 END) r FROM documents WHERE job_id=? OR (lead_id=? AND job_id IS NULL)").get(j.id, j.lead_id) as any;
  return { ...j, service_requested: v?.service_requested || "", contact_name: v?.contact_name || "", contact_phone: v?.contact_phone || "", contact_email: v?.contact_email || "", location: v?.location || "", owner_id: l?.owner_id || null, pm_id: l?.pm_id || null, labor_hours: lab.h, labor_cost: Math.round(lab.a * 100) / 100, labor_pct: j.value > 0 ? Math.round(1000 * lab.a / j.value) / 10 : null, docs_total: docs.t || 0, docs_received: docs.r || 0 };
}
app.get("/api/jobs", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; backfillJobs(ws);
  let rows = (db.prepare("SELECT * FROM jobs WHERE workspace_id=? ORDER BY created_at DESC").all(ws) as any[]).filter(j => jobVisible(req.user, j)).map(jobView);
  if (req.query.stage) rows = rows.filter(j => j.stage === req.query.stage);
  if (req.query.q) { const q = String(req.query.q).toLowerCase(); rows = rows.filter(j => JSON.stringify(j).toLowerCase().includes(q)); }
  res.json(rows);
});
app.post("/api/jobs", requireAuth, (req: any, res) => { // manual job from a lead (legacy/offline wins)
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(String(req.body.lead_id || ""), req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const j = ensureJobForLead(req.user.workspace_id, req.user.id, l);
  res.status(201).json(jobView(j));
});
// ---------- v25: self-service profile ----------
app.patch("/api/users/me", requireAuth, (req: any, res) => {
  const name = req.body.name !== undefined ? String(req.body.name || "").trim().slice(0, 80) : null;
  if (name !== null && !name) return res.status(422).json({ error: { code: "name_required" } });
  let avatar: any = undefined;
  if (req.body.avatar_url !== undefined) {
    const av = req.body.avatar_url;
    if (av === null || av === "") avatar = null;
    else if (typeof av === "string" && av.startsWith("data:image/") && av.length < 300000) avatar = av;
    else return res.status(422).json({ error: { code: "bad_avatar", message: "Avatar must be an image under ~200KB." } });
  }
  if (name !== null) db.prepare("UPDATE users SET name=? WHERE id=?").run(name, req.user.id);
  if (avatar !== undefined) db.prepare("UPDATE users SET avatar_url=? WHERE id=?").run(avatar, req.user.id);
  audit(req.user.workspace_id, req.user.id, "profile.update", "user", req.user.id, { name: name !== null, avatar: avatar !== undefined });
  const u = db.prepare("SELECT id,name,email,role,avatar_url,approval_limit FROM users WHERE id=?").get(req.user.id);
  res.json({ user: u });
});
app.post("/api/users/me/password", requireAuth, (req: any, res) => {
  const cur = String(req.body.current || ""), next = String(req.body.next || "");
  if (!verifyPassword(cur, req.user.password_hash)) return res.status(403).json({ error: { code: "wrong_password", message: "Current password doesn't match." } });
  if (next.length < 8) return res.status(422).json({ error: { code: "weak_password", message: "New password needs at least 8 characters." } });
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hashPassword(next), req.user.id);
  audit(req.user.workspace_id, req.user.id, "profile.password", "user", req.user.id, {});
  res.json({ ok: true });
});
// ---------- v25: job team chat with @mentions ----------
const jobInWs = (req: any) => db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
app.get("/api/jobs/:id/messages", requireAuth, (req: any, res) => {
  const j = jobInWs(req); if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const rows = db.prepare("SELECT m.*, u.name user_name, u.avatar_url user_avatar FROM job_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.job_id=? AND m.workspace_id=? ORDER BY m.created_at").all(j.id, req.user.workspace_id);
  res.json({ messages: rows });
});
app.post("/api/jobs/:id/messages", requireAuth, (req: any, res) => {
  const j = jobInWs(req); if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const body = String(req.body.body || "").trim().slice(0, 4000);
  if (!body) return res.status(422).json({ error: { code: "empty_message" } });
  const wanted: string[] = []; if (Array.isArray(req.body.mention_ids)) for (const x of req.body.mention_ids) { const s = String(x); if (!wanted.includes(s)) wanted.push(s); }
  const valid = wanted.length ? (db.prepare(`SELECT id FROM users WHERE workspace_id=? AND active=1 AND id IN (${wanted.map(() => "?").join(",")})`).all(req.user.workspace_id, ...wanted) as any[]).map(r => r.id) : [];
  const mentions = valid.filter(id => id !== req.user.id);
  const id = uid("jmsg");
  db.prepare("INSERT INTO job_messages (id,workspace_id,job_id,user_id,body,mentions,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, j.id, req.user.id, body, JSON.stringify(mentions), now());
  if (mentions.length) {
    const lead = db.prepare("SELECT service_requested FROM leads WHERE id=?").get(j.lead_id) as any;
    notify(req.user.workspace_id, mentions, "job.mention", "You were mentioned in a job chat", `${req.user.name} on ${lead?.service_requested || "a job"}: “${body.slice(0, 110)}”`, j.lead_id, { type: "job", id: j.id });
  }
  const row = db.prepare("SELECT m.*, u.name user_name, u.avatar_url user_avatar FROM job_messages m LEFT JOIN users u ON u.id=m.user_id WHERE m.id=?").get(id);
  res.status(201).json({ message: row, mentioned: mentions });
});
app.get("/api/jobs/:id", requireAuth, (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (j && !jobVisible(req.user, j)) return res.status(404).json({ error: { code: "not_found" } });
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const labor = jobLabor(req.user.workspace_id, j.lead_id);
  const schedule = db.prepare("SELECT s.*, COALESCE(w.name, u.name) worker FROM job_schedule s LEFT JOIN workers w ON w.id=s.worker_id LEFT JOIN users u ON u.id=s.user_id WHERE s.lead_id=? ORDER BY s.work_date").all(j.lead_id);
  const documents = db.prepare("SELECT * FROM documents WHERE job_id=? OR lead_id=?").all(j.id, j.lead_id);
  const reports = db.prepare("SELECT f.*, COALESCE(w.name,u.name) manager FROM field_reports f LEFT JOIN workers w ON w.id=f.worker_id LEFT JOIN users u ON u.id=f.manager_id WHERE f.lead_id=? ORDER BY f.report_date DESC LIMIT 20").all(j.lead_id);
  const changeOrders = db.prepare("SELECT * FROM change_orders WHERE job_id=? OR lead_id=? ORDER BY created_at DESC").all(j.id, j.lead_id);
  const origin = db.prepare("SELECT l.id lead_id, l.service_requested, l.state lead_state, p.id proposal_id, p.total proposal_total, p.status proposal_status FROM leads l LEFT JOIN proposals p ON p.id=? WHERE l.id=?").get(j.proposal_id || "", j.lead_id) as any;
  const originRow = (origin && origin.proposal_id) ? origin : db.prepare("SELECT l.id lead_id, l.service_requested, l.state lead_state, p.id proposal_id, p.total proposal_total, p.status proposal_status FROM leads l LEFT JOIN proposals p ON p.lead_id=l.id AND p.status='signed' WHERE l.id=? ORDER BY p.version DESC, p.created_at DESC LIMIT 1").get(j.lead_id) as any;
  const invoices = (db.prepare("SELECT * FROM invoices WHERE job_id=? ORDER BY created_at DESC").all(j.id) as any[]).map((i: any) => { const tok = ensureInvoiceToken(i); return { ...i, token: tok, link: "/invoice/" + tok, lines: JSON.parse(i.lines || "[]"), balance: Math.round(((i.total || 0) - (i.paid_amount || 0)) * 100) / 100 }; });
  const siteVisits = db.prepare("SELECT v.*, u.name assignee_name FROM site_visits v LEFT JOIN users u ON u.id=v.assigned_to WHERE v.lead_id=? AND v.status IN ('scheduled','completed') ORDER BY v.scheduled_at").all(j.lead_id);
  const pendAppr = db.prepare("SELECT a.id, a.submitted_at, u.name approver_name, pr.total proposal_total FROM approvals a LEFT JOIN users u ON u.id=a.approver_id LEFT JOIN proposals pr ON pr.id=a.proposal_id WHERE a.workspace_id=? AND a.lead_id=? AND a.decision IS NULL ORDER BY a.submitted_at DESC").get(req.user.workspace_id, j.lead_id) as any;
  const emails = db.prepare("SELECT id, from_name, from_email, subject, body, status, created_at FROM inbox_items WHERE workspace_id=? AND lead_id=? ORDER BY created_at DESC LIMIT 20").all(req.user.workspace_id, j.lead_id);
  res.json({ job: jobView(j), labor, schedule, documents, field_reports: reports, change_orders: changeOrders, invoices, site_visits: siteVisits, emails, pending_approval: pendAppr || null, origin: originRow || { lead_id: j.lead_id } });
});
app.post("/api/jobs/:id/stage", requireAuth, (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const to = String(req.body.to || "");
  if (!JOB_STAGES.includes(to)) return res.status(422).json({ error: { code: "bad_stage" } });
  // v19 scheduling workflow: entering SCHEDULED assigns a date+time (picker value, or the
  // stored one, or tomorrow 09:00 by default), syncs the job's crew into the Ops crew
  // schedule for that day, and makes sure that week's timesheets exist.
  let schedInfo: any = null;
  if (to === "SCHEDULED") {
    let start = String(req.body.scheduled_start || j.scheduled_start || "");
    let defaulted = false;
    if (!start) { const d = new Date(Date.now() + 86400000); d.setHours(9, 0, 0, 0); start = d.toISOString(); defaulted = true; }
    const startMs = new Date(start).getTime();
    const end = String(req.body.scheduled_end || "") || (j.scheduled_end && j.scheduled_start === start ? j.scheduled_end : new Date((isNaN(startMs) ? Date.now() : startMs) + 4 * 3600000).toISOString());
    db.prepare("UPDATE jobs SET scheduled_start=?, scheduled_end=? WHERE id=?").run(start, end, j.id);
    const date = start.slice(0, 10);
    let crewSynced = 0;
    for (const c of db.prepare("SELECT * FROM job_crew WHERE workspace_id=? AND lead_id=?").all(req.user.workspace_id, j.lead_id) as any[]) {
      const dupe = db.prepare("SELECT id FROM job_schedule WHERE lead_id=? AND work_date=? AND (worker_id=? OR user_id=?)").get(j.lead_id, date, c.worker_id || "__none__", c.user_id || "__none__");
      if (!dupe) { db.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,worker_id,work_date,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("sch"), req.user.workspace_id, j.lead_id, c.user_id || null, c.worker_id || null, date, "Job scheduled", req.user.id, now()); crewSynced++; }
    }
    ensureWeek(req.user.workspace_id, weekStartOf(new Date(date + "T12:00:00")));
    schedInfo = { scheduled_start: start, scheduled_end: end, crew_scheduled: crewSynced, defaulted };
  }
  if (to === "AWAITING_SCHEDULING" && j.scheduled_start) { // unschedule cleanly
    db.prepare("DELETE FROM job_schedule WHERE workspace_id=? AND lead_id=? AND work_date=?").run(req.user.workspace_id, j.lead_id, String(j.scheduled_start).slice(0, 10));
    db.prepare("UPDATE jobs SET scheduled_start=NULL, scheduled_end=NULL WHERE id=?").run(j.id);
  }
  db.prepare("UPDATE jobs SET stage=?, closed_at=?, updated_at=? WHERE id=?").run(to, to === "CLOSED" ? now() : j.closed_at, now(), j.id);
  if (to === "WORK_COMPLETED") onJobCompleted(req.user.workspace_id, { ...j, stage: to });
  if (to === "INVOICED" && j.invoice_status === "not_ready") db.prepare("UPDATE jobs SET invoice_status='invoiced' WHERE id=?").run(j.id);
  logEvent(req.user.workspace_id, j.lead_id, req.user.id, "job_stage", j.stage, to, { job_id: j.id });
  const view = jobView(db.prepare("SELECT * FROM jobs WHERE id=?").get(j.id)); if (schedInfo) (view as any).scheduling = schedInfo; res.json(view);
});
app.patch("/api/jobs/:id", requireAuth, (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const b = req.body || {}; const sets: string[] = []; const vals: any[] = [];
  for (const k of ["scheduled_start", "scheduled_end", "invoice_status", "value", "sector", "requires_site_visit"]) if (b[k] !== undefined) { sets.push(`${k}=?`); vals.push(b[k]); }
  if (sets.length) { db.prepare(`UPDATE jobs SET ${sets.join(",")}, updated_at=? WHERE id=?`).run(...vals, now(), j.id); }
  res.json(jobView(db.prepare("SELECT * FROM jobs WHERE id=?").get(j.id)));
});
// ---------- v3 slice 35 (server core): job packet + change orders + invoice handoff ----------
function buildPacket(req: any, j: any) {
  const v = jobView(j);
  const docs = db.prepare("SELECT name, status FROM documents WHERE job_id=? OR lead_id=?").all(j.id, j.lead_id) as any[];
  const sched = db.prepare("SELECT work_date FROM job_schedule WHERE lead_id=? ORDER BY work_date LIMIT 3").all(j.lead_id) as any[];
  const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const subject = `Your job with ${ws.name} — ${v.service_requested}`;
  const body = `${ws.name} — job packet for ${v.contact_name}\nService: ${v.service_requested}\nSite: ${v.location || "—"}\nJob value: $${v.value}\nScheduled: ${sched.map(s => s.work_date).join(", ") || "to be scheduled"}\nPaperwork: ${docs.length ? docs.map(d => `${d.name} (${d.status})`).join("; ") : "none outstanding"}\nQuestions? Reply here and we'll take care of it.`;
  const prop = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC LIMIT 1").get(j.lead_id) as any;
  const inv = db.prepare("SELECT * FROM invoices WHERE job_id=? AND status<>'void' ORDER BY created_at DESC LIMIT 1").get(j.id) as any;
  const includes: any[] = [{ kind: "summary", name: "Job packet summary" }];
  if (prop) includes.push({ kind: "proposal", name: `Proposal ${prop.number ? "PROP-" + prop.number : ""} (DOCX)` });
  if (inv) includes.push({ kind: "invoice", name: `Invoice ${inv.number} (DOCX)` });
  return { v, ws, subject, body, prop, inv, includes };
}
app.post("/api/jobs/:id/packet", requireAuth, async (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const pk = buildPacket(req, j);
  const channel = req.body.channel === "sms" ? "sms" : "email";
  const to = String(req.body.to || (channel === "sms" ? pk.v.contact_phone : pk.v.contact_email) || "");
  if (!to) return res.status(422).json({ error: { code: "no_destination", message: channel === "sms" ? "This customer has no phone number on file — add one to the lead first." : "This customer has no email address on file — add one to the lead first." } });
  const r: any = await queueAndDeliver(req.user.workspace_id, { lead_id: j.lead_id, channel, to, subject: pk.subject, body: pk.body });
  db.prepare("UPDATE jobs SET packet_sent_at=?, updated_at=? WHERE id=?").run(now(), now(), j.id);
  res.status(201).json({ status: r.status, channel, to });
});
app.post("/api/jobs/:id/packet/preview", requireAuth, (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const pk = buildPacket(req, j);
  if (!pk.v.contact_email) return res.status(422).json({ error: { code: "no_destination", message: "This customer has no email address on file — add one to the lead first, or download the packet and send it yourself." } });
  res.json({ to: pk.v.contact_email, to_name: pk.v.contact_name, subject: pk.subject, body: pk.body, includes: pk.includes, email_test_mode: !process.env.RESEND_API_KEY });
});
app.get("/api/jobs/:id/packet/download", requireAuth, async (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const pk = buildPacket(req, j);
  const { zipBundle } = await import("./zip.ts");
  const files: { name: string; data: Buffer }[] = [{ name: "job-packet.txt", data: Buffer.from(`${pk.subject}\n\n${pk.body}\n`, "utf8") }];
  if (pk.prop) { const out = await proposalDocx(pk.prop.id); if (out) files.push({ name: out.filename, data: out.buffer }); }
  if (pk.inv) { const tok = ensureInvoiceToken(pk.inv); const out = await invoiceDocx(pk.inv.id, `${req.protocol}://${req.get("host")}/invoice/${tok}`); if (out) files.push({ name: out.filename, data: out.buffer }); }
  db.prepare("UPDATE jobs SET packet_sent_at=?, updated_at=? WHERE id=?").run(now(), now(), j.id);
  const slug = String(pk.v.service_requested || "job").replace(/\W+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/zip"); res.setHeader("Content-Disposition", `attachment; filename="job-packet-${slug}.zip"`);
  res.send(zipBundle(files));
});
app.post("/api/jobs/:id/change-orders", requireAuth, (req: any, res) => {
  const j = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!j) return res.status(404).json({ error: { code: "not_found" } });
  const id = uid("co");
  db.prepare("INSERT INTO change_orders (id,workspace_id,job_id,lead_id,delta_scope,delta_total,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, req.user.workspace_id, j.id, j.lead_id, String(req.body.delta_scope || ""), Number(req.body.delta_total) || 0, req.body.status || "draft", now());
  res.status(201).json(db.prepare("SELECT * FROM change_orders WHERE id=?").get(id));
});
app.post("/api/change-orders/:id/status", requireAuth, (req: any, res) => {
  const co = db.prepare("SELECT * FROM change_orders WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!co) return res.status(404).json({ error: { code: "not_found" } });
  const to = String(req.body.status || "");
  if (!["draft", "sent", "approved", "rejected"].includes(to)) return res.status(422).json({ error: { code: "bad_status" } });
  db.prepare("UPDATE change_orders SET status=? WHERE id=?").run(to, co.id);
  if (to === "approved" && co.job_id) db.prepare("UPDATE jobs SET value=COALESCE(value,0)+?, updated_at=? WHERE id=?").run(co.delta_total || 0, now(), co.job_id);
  res.json(db.prepare("SELECT * FROM change_orders WHERE id=?").get(co.id));
});
app.post("/api/documents/:id/chase", requireAuth, async (req: any, res) => {
  const d = db.prepare("SELECT * FROM documents WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!d) return res.status(404).json({ error: { code: "not_found" } });
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(d.lead_id) as any; const v = l ? leadView(l) : null;
  const to = String(req.body.to || v?.contact_email || "");
  if (!to) return res.status(422).json({ error: { code: "no_destination", message: "No email on file for the document holder — add one or pass `to`." } });
  const ws = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  const r: any = await queueAndDeliver(req.user.workspace_id, { lead_id: d.lead_id, channel: "email", to, subject: `Document needed: ${d.name}`, body: `Hi ${v?.contact_name || "there"},\n\nTo keep your job with ${ws.name} moving, we still need: ${d.name}. Reply to this email with the document attached and we'll mark it received.\n\nThanks!` });
  res.status(201).json({ status: r.status, to });
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
app.post("/api/timesheets/:id/review", requireAuth, needPerm("can_approve"), (req: any, res) => { const t = db.prepare("SELECT * FROM timesheets WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!t) return res.status(404).json({ error: { code: "not_found" } }); if (t.status !== "submitted") return res.status(422).json({ error: { code: "bad_state", message: `Only a submitted sheet can be reviewed (current: ${t.status})` } }); db.prepare("UPDATE timesheets SET status='reviewed', reviewed_by=?, reviewed_at=? WHERE id=?").run(req.user.id, now(), t.id); res.json({ ok: true, status: "reviewed" }); });
app.post("/api/timesheets/:id/approve", requireAuth, needPerm("can_approve"), (req: any, res) => { const t = db.prepare("SELECT * FROM timesheets WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!t) return res.status(404).json({ error: { code: "not_found" } }); if (!["submitted", "reviewed"].includes(t.status)) return res.status(422).json({ error: { code: "bad_state", message: `Only a submitted/reviewed sheet can be approved (current: ${t.status})` } }); db.prepare("UPDATE timesheets SET status='approved', approved_by=?, approved_at=? WHERE id=?").run(req.user.id, now(), t.id); res.json({ ok: true, status: "approved" }); });
app.post("/api/timesheets/:id/reject", requireAuth, needPerm("can_approve"), (req: any, res) => { const t = db.prepare("SELECT * FROM timesheets WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!t) return res.status(404).json({ error: { code: "not_found" } }); if (!["submitted", "reviewed"].includes(t.status)) return res.status(422).json({ error: { code: "bad_state", message: `Only a submitted/reviewed sheet can be rejected (current: ${t.status})` } }); const reason = String(req.body?.reason || "").trim(); if (!reason) return res.status(422).json({ error: { code: "reason_required", message: "Rejection needs a reason — it goes back to the submitter." } }); db.prepare("UPDATE timesheets SET status='rejected', rejection_reason=? WHERE id=?").run(reason, t.id); res.json({ ok: true, status: "rejected" }); });

// CSV import (§4.1) — header heuristics + vendor-native shapes (Tier 2 importers):
// exports from Jobber, Housecall Pro, ServiceTitan and Salesforce import as-is.
const IMPORT_FORMATS: Record<string, Record<string, string[]>> = {
  generic: { name: ["name", "contact", "customer"], first: ["first name", "firstname"], last: ["last name", "lastname"], phone: ["phone", "mobile", "tel"], email: ["email"], service: ["service", "service_requested", "job"], value: ["value", "est_value", "amount"], location: ["location", "address", "zip"] },
  jobber: { name: ["client", "client name"], first: ["first name"], last: ["last name"], phone: ["phone", "phone number", "mobile phone"], email: ["email", "email address"], service: ["service", "job title", "request title", "quote name"], value: ["total", "quote total", "amount"], location: ["address", "street address", "property address"] },
  housecallpro: { name: ["customer", "customer name", "name"], first: ["first name"], last: ["last name"], phone: ["phone", "mobile phone", "phone number"], email: ["email", "email address"], service: ["service", "job type", "job name"], value: ["total", "job total", "amount"], location: ["address", "service address"] },
  servicetitan: { name: ["customer name", "name"], first: ["first name"], last: ["last name"], phone: ["phone", "phone number", "mobile"], email: ["email", "email address"], service: ["job type", "service", "business unit"], value: ["invoice total", "total", "job total"], location: ["address", "location", "service address"] },
  salesforce: { name: ["name"], first: ["firstname", "first name"], last: ["lastname", "last name"], phone: ["phone", "mobilephone", "mobile"], email: ["email"], service: ["service", "service_requested", "industry"], value: ["amount", "value", "annualrevenue"], location: ["street", "city", "address"] },
};
app.post("/api/imports/csv", requireAuth, modGate("import", "edit"), (req: any, res) => {
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
    const r = createLead(req.user.workspace_id, req.user.id, { contact: { name: fullName, phone: cols[mi.phone] || "", email: cols[mi.email] || "" }, service_requested: mi.service >= 0 ? cols[mi.service] : "", est_value: mi.value >= 0 ? Number(String(cols[mi.value]).replace(/[^0-9.]/g, "")) || 0 : 0, location: mi.location >= 0 ? cols[mi.location] : "", source: format + "-import", bulk: true });
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
app.post("/api/webhooks", requireAuth, needPerm("can_settings"), (req: any, res) => {
  if (!["OWNER", "ADMIN", "OPS_ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "forbidden" } });
  const id = uid("whk");
  db.prepare("INSERT INTO webhook_endpoints (id,workspace_id,url,secret,events,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.url, req.body.secret || randomBytes(18).toString("hex"), req.body.events || "outcome.final", now());
  res.status(201).json({ id, url: req.body.url });
});
app.delete("/api/webhooks/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("UPDATE webhook_endpoints SET active=0 WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
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
// v52: resolve a sender to the lead they belong to, so replies are LINKED —
// classification, labels, cadence stops and opportunities all key off lead_id.
export function leadIdForEmail(ws: string, email: string): string | null {
  const em = String(email || "").toLowerCase().trim(); if (!em) return null;
  const c = db.prepare("SELECT id FROM contacts WHERE workspace_id=? AND LOWER(email)=?").get(ws, em) as any;
  if (!c) return null;
  const l = db.prepare("SELECT id FROM leads WHERE workspace_id=? AND contact_id=? ORDER BY created_at DESC").get(ws, c.id) as any;
  return l?.id || null;
}
// v71: who is this sender, really? Resolve the email to a contact, their lead,
// their customer account/company, and the active job the thread belongs to —
// so the inbox never shows a stranger when it is actually a customer on a job.
export function activeJobForLead(wsId: string, leadId: string): any {
  return db.prepare("SELECT id, stage FROM jobs WHERE workspace_id=? AND lead_id=? AND stage NOT IN ('CLOSED','CANCELLED') ORDER BY created_at DESC").get(wsId, leadId) as any;
}
export function senderIdentity(wsId: string, item: any): any {
  const email = String(item.from_email || "");
  let contact = email ? db.prepare("SELECT * FROM contacts WHERE workspace_id=? AND lower(email)=lower(?)").get(wsId, email) as any : null;
  let lead = item.lead_id ? db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(item.lead_id, wsId) as any : null;
  if (!lead && contact) lead = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND contact_id=? ORDER BY created_at DESC").get(wsId, contact.id) as any;
  let account: any = null;
  try {
    if (lead?.account_id) account = db.prepare("SELECT * FROM accounts WHERE id=?").get(lead.account_id) as any;
    if (!account && email) account = db.prepare("SELECT * FROM accounts WHERE workspace_id=? AND lower(email)=lower(?)").get(wsId, email) as any;
  } catch { account = null; }
  const is_customer = !!(account || (lead && (lead.account_id || lead.state === "WON")));
  let job = null;
  if (lead) { const j = activeJobForLead(wsId, lead.id); if (j) job = { id: j.id, stage: j.stage, service: lead.service_requested || "" }; }
  return { known: !!(contact || lead || account), contact_name: contact?.name || item.from_name || "", is_customer, company: account?.name || null, lead_id: lead?.id || item.lead_id || null, lead_state: lead?.state || null, job };
}

export function ingestBatch(ws: string, actorId: string, emails: any[]): { results: any[]; by_category: Record<string, number>; leads_created: number; duplicates: number } {
  const results: any[] = []; const by_category: Record<string, number> = {}; let leads_created = 0, duplicates = 0; const important: any[] = [];
  const ops = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='OPS_ADMIN' AND active=1").get(ws) as any;
  for (const e of emails) {
    const parsed = parseEmail(e);
    by_category[parsed.category] = (by_category[parsed.category] || 0) + 1;
    const knownLeadId = leadIdForEmail(ws, e.from_email || "");
    if (parsed.is_lead && !knownLeadId) {
      const r = createLead(ws, "inbox", { contact: { name: e.from_name || "", phone: parsed.phone, email: e.from_email || "" }, service_requested: "", message: `${e.subject || ""}\n${e.body || ""}`, source: "email-inbox", created_at: e.received_at, bulk: true });
      if (r.duplicate) duplicates++; else leads_created++;
      results.push({ category: "lead", lead_id: r.lead.id, duplicate: r.duplicate });
      if (!r.duplicate) { try { db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,outcome,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("act"), r.lead.id, ws, actorId, "email_in", `${e.from_name || ""} <${e.from_email || ""}>: ${e.subject || "(no subject)"} — ${String(e.body || "").slice(0, 240)}`, "", now()); } catch { /* logging never blocks ingest */ } }
    } else {
      // Known senders NEVER route to lead creation (a reply is not a new lead) —
      // their mail lands as a lead-linked inbox item so every downstream
      // consequence (labels, stops, opportunities) can fire.
      const id = uid("inb");
      const jobForItem = knownLeadId ? activeJobForLead(ws, knownLeadId) : null;
      db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at,lead_id,job_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(id, ws, parsed.category, e.from_name || "", e.from_email || "", e.subject || "", e.body || "", ops?.id || actorId, new Date(Date.now() + 86400000).toISOString(), e.received_at || now(), now(), knownLeadId, jobForItem?.id || null);
      results.push({ category: parsed.category, inbox_item_id: id, lead_id: knownLeadId || undefined });
      if (knownLeadId) { try { db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,outcome,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("act"), knownLeadId, ws, actorId, "email_in", `${e.from_name || ""} <${e.from_email || ""}>: ${e.subject || "(no subject)"} — ${String(e.body || "").slice(0, 240)}`, "", now()); } catch { /* logging never blocks ingest */ } }
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
  applyInboxRules(req.user.workspace_id);
  res.status(201).json({ ingested: r.results.length, results: r.results });
});
// slice 18: bulk email backlog import (mbox / email CSV / JSON) — the 3,000-email front door
app.post("/api/imports/email", requireAuth, modGate("import", "edit"), (req: any, res) => {
  const format = String(req.body.format || "mbox");
  let emails: any[] = [];
  if (format === "json") { try { const j = JSON.parse(String(req.body.content || "[]")); emails = Array.isArray(j) ? j : []; } catch { return res.status(422).json({ error: { code: "bad_json" } }); } }
  else if (format === "csv") emails = parseEmailCsv(String(req.body.content || ""));
  else emails = parseMbox(String(req.body.content || ""));
  if (!emails.length) return res.status(422).json({ error: { code: "no_messages", message: "No messages could be parsed from that file." } });
  const r = ingestBatch(req.user.workspace_id, req.user.id, emails);
  applyInboxRules(req.user.workspace_id);
  const id = uid("imp");
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.filename || "email-backlog", JSON.stringify({ kind: "email", format }), JSON.stringify({ created: r.leads_created, dupes: r.duplicates, received: emails.length, by_category: r.by_category }), "committed", now());
  res.json({ import_id: id, received: emails.length, leads_created: r.leads_created, duplicates: r.duplicates, by_category: r.by_category });
});
app.post("/api/inbox/:id/label", requireAuth, modGate("inbox", "edit"), (req: any, res) => { const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!it) return res.status(404).json({ error: { code: "not_found" } }); const key = String(req.body?.key || ""); const lbl = labelByKey(req.user.workspace_id, key); if (!lbl) return res.status(422).json({ error: { code: "bad_label", message: "Unknown label." } }); db.prepare("UPDATE inbox_items SET reply_label=? WHERE id=?").run(key, it.id); let applied = false; if (it.lead_id) applied = applyLabel(req.user.workspace_id, it.lead_id, key, "human").applied; res.json({ ok: true, applied, item: db.prepare("SELECT * FROM inbox_items WHERE id=?").get(it.id) }); });
app.get("/api/inbox", requireAuth, modGate("inbox"), (req: any, res) => {
  const rows = db.prepare("SELECT i.*, u.name owner_name FROM inbox_items i LEFT JOIN users u ON u.id=i.owner_id WHERE i.workspace_id=?").all(req.user.workspace_id) as any[];
  for (const r of rows) { r.identity = senderIdentity(req.user.workspace_id, r); if (!r.job_id && r.identity?.job) r.job_id = r.identity.job.id; r.age_days = Math.max(0, Math.floor((Date.now() - new Date(r.received_at || r.created_at).getTime()) / 86400000)); r.overdue = (r.status || "open") === "open" && r.next_action_due_at && new Date(r.next_action_due_at).getTime() < Date.now(); r.suggestion_action = suggestInboxAction(r, "").action; r.priority = inboxPriority(r); }
  const tierRank = (t: string) => t === "urgent" ? 0 : t === "hot" ? 1 : 2;
  rows.sort((a, b) => ((a.status || "open") === (b.status || "open") ? 0 : (a.status || "open") === "open" ? -1 : 1) || tierRank(a.priority.tier) - tierRank(b.priority.tier) || Number(b.overdue) - Number(a.overdue) || String(b.received_at).localeCompare(String(a.received_at)));
  res.json(rows);
});
app.get("/api/inbox/sent", requireAuth, modGate("inbox"), (req: any, res) => {
  const rows = db.prepare("SELECT m.*, c.name lead_name FROM messages_outbox m LEFT JOIN leads l ON l.id=m.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE m.workspace_id=? AND m.channel='email' ORDER BY m.created_at DESC LIMIT 100").all(req.user.workspace_id);
  res.json(rows);
});
app.post("/api/ai/scan", requireAuth, modGate("inbox", "edit"), async (req: any, res) => { const { scanWorkspace } = await import("./inbox-ai.ts"); const r = await scanWorkspace(req.user.workspace_id, req.user.id); audit(req.user.workspace_id, req.user.id, "ai.scan", "workspace", req.user.workspace_id, r); res.json(r); });
// slice 19: inbox actions — work the non-lead mail like a queue, not a museum
app.get("/api/inbox/:id/suggestion", requireAuth, async (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  res.json(await inboxSuggestion(req.user.workspace_id, it, w?.name || "", false));
});
app.post("/api/ai/enhance", requireAuth, async (req: any, res) => {
  const text = String(req.body.text || ""); const purpose = String(req.body.purpose || "business message");
  if (!text.trim()) return res.status(422).json({ error: { code: "empty_text" } });
  if (text.length > 6000) return res.status(422).json({ error: { code: "too_long" } });
  const { getProvider } = await import("./llm.ts");
  const provider = getProvider(req.user.workspace_id);
  if (!provider) return res.json({ source: "none", text, note: "No AI provider connected — add a key in Automations → AI provider and Enhance will rewrite this with the model." });
  try {
    const r = await provider.chat({ system: "You improve business writing. Rewrite the user's draft to be clearer, warmer and more concise while keeping EVERY fact, name, date, number, price and commitment exactly as written — never add or remove commitments. Keep the same sign-off. Return ONLY the rewritten text, no preamble.", messages: [{ role: "user", content: `Purpose: ${purpose}\n\n${text}` }], maxTokens: 900 });
    const out = String(r.text || "").trim();
    if (!out) throw new Error("empty");
    return res.json({ source: "ai", model: `${provider.kind}:${r.model}`, text: out });
  } catch { return res.json({ source: "none", text, note: "The AI provider didn't respond — your original text is untouched." }); }
});
app.post("/api/inbox/:id/suggestion/regenerate", requireAuth, async (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  res.json(await inboxSuggestion(req.user.workspace_id, it, w?.name || "", true));
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
app.get("/api/attachables", requireAuth, (req: any, res) => {
  const wsId = req.user.workspace_id; const leadId = String(req.query.lead_id || "");
  const groups: any = { files: [], proposals: [], invoices: [], company: [] };
  const DT: Record<string, string> = { w9: "W-9", insurance: "Insurance certificate", license: "License", other: "Company document" };
  groups.company = (db.prepare("SELECT id, name, size, doc_type, created_at FROM attachments WHERE workspace_id=? AND entity_type='workspace' ORDER BY created_at DESC").all(wsId) as any[]).map(f => ({ kind: "attachment", id: f.id, label: f.name, detail: DT[f.doc_type || "other"] || "Company document" }));
  if (leadId) {
    const lead = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(leadId, wsId) as any;
    if (lead) {
      const jobIds = (db.prepare("SELECT id FROM jobs WHERE lead_id=?").all(leadId) as any[]).map(j => j.id);
      const ents = [leadId, ...jobIds];
      groups.files = (db.prepare(`SELECT id, name, entity_type, size, created_at FROM attachments WHERE workspace_id=? AND entity_id IN (${ents.map(() => "?").join(",")}) ORDER BY created_at DESC`).all(wsId, ...ents) as any[]).map(f => ({ kind: "attachment", id: f.id, label: f.name, detail: f.entity_type === "job" ? "Job file" : "Lead file" }));
      groups.proposals = (db.prepare("SELECT id, number, status, total FROM proposals WHERE workspace_id=? AND lead_id=? ORDER BY version DESC").all(wsId, leadId) as any[]).map(p => ({ kind: "proposal", id: p.id, label: `Proposal ${p.number ? "PROP-" + p.number : ""} (DOCX)`, detail: `${p.status} · $${Number(p.total || 0).toFixed(2)}` }));
      groups.invoices = (db.prepare("SELECT id, number, status, total, paid_amount FROM invoices WHERE workspace_id=? AND lead_id=? AND status<>'void' ORDER BY created_at DESC").all(wsId, leadId) as any[]).map(i => ({ kind: "invoice", id: i.id, label: `Invoice ${i.number} (DOCX)`, detail: `${i.status} · $${Number(i.total || 0).toFixed(2)}` }));
    }
  }
  res.json(groups);
});
app.post("/api/inbox/:id/reply", requireAuth, async (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  if (!it.from_email) return res.status(422).json({ error: { code: "no_sender_email" } });
  const r = await sendInboxReply(req.user.workspace_id, it, req.body.body ? String(req.body.body) : undefined, req.body.subject ? String(req.body.subject) : undefined, req.body.attachments);
  res.json({ sent: true, status: r.status });
});
app.post("/api/inbox/:id/actions", requireAuth, async (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const r = await detectActions(req.user.workspace_id, it, String(req.body?.draft || ""));
  res.json(r);
});
app.post("/api/inbox/:id/actions/execute", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const a = req.body?.action || {};
  if (!["schedule_visit", "schedule_task", "callback"].includes(a.kind)) return res.status(422).json({ error: { code: "bad_kind" } });
  const r: any = executeAction(req.user.workspace_id, req.user.id, it, a);
  if (r.error) return res.status(r.status || 422).json({ error: { code: r.error } });
  audit(req.user.workspace_id, req.user.id, "inbox.action_execute", r.created_kind, r.created_id, { kind: a.kind, when: a.when });
  res.status(201).json(r);
});
app.post("/api/inbox/:id/convert-lead", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const r = createLead(req.user.workspace_id, req.user.id, { contact: { name: it.from_name || "", phone: "", email: it.from_email || "" }, service_requested: "", message: `${it.subject || ""}\n${it.body || ""}`, source: "email-inbox-converted", bulk: true });
  db.prepare("UPDATE inbox_items SET status='done', completed_at=?, lead_id=? WHERE id=?").run(now(), r.lead.id, it.id);
  res.json({ lead_id: r.lead.id, duplicate: r.duplicate });
});
// ---------- v3 slice 33: inbox collaboration — comments, claim, canned replies, rules ----------
export function applyInboxRules(ws: string) {
  const rules = db.prepare("SELECT * FROM inbox_rules WHERE workspace_id=? AND active=1").all(ws) as any[];
  if (!rules.length) return { applied: 0 };
  const items = db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND status='open'").all(ws) as any[];
  let applied = 0;
  for (const it of items) for (const r of rules) {
    const hay = r.match_field === "sender" ? `${it.from_name} ${it.from_email}` : r.match_field === "subject" ? it.subject : r.match_field === "category" ? it.category : `${it.subject} ${it.body}`;
    if (!String(hay || "").toLowerCase().includes(String(r.match_value || "").toLowerCase())) continue;
    if (r.action === "assign" && r.action_value) { db.prepare("UPDATE inbox_items SET owner_id=? WHERE id=?").run(r.action_value, it.id); applied++; }
    else if (r.action === "mark_done") { db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), it.id); applied++; }
    else if (r.action === "snooze_days" && r.action_value) { db.prepare("UPDATE inbox_items SET next_action_due_at=? WHERE id=?").run(new Date(Date.now() + Number(r.action_value) * 86400000).toISOString(), it.id); applied++; }
  }
  return { applied };
}
app.get("/api/inbox/:id/comments", requireAuth, (req: any, res) => res.json(db.prepare("SELECT c.*, u.name user_name FROM inbox_comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.inbox_item_id=? AND c.workspace_id=? ORDER BY c.created_at").all(req.params.id, req.user.workspace_id)));
app.post("/api/inbox/:id/comments", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  const body = String(req.body.body || "").trim(); if (!body) return res.status(422).json({ error: { code: "empty_comment" } });
  const id = uid("cm");
  db.prepare("INSERT INTO inbox_comments (id,workspace_id,inbox_item_id,user_id,body,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, it.id, req.user.id, body, now());
  res.status(201).json(db.prepare("SELECT * FROM inbox_comments WHERE id=?").get(id));
});
app.post("/api/inbox/:id/claim", requireAuth, (req: any, res) => {
  const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!it) return res.status(404).json({ error: { code: "not_found" } });
  if (req.body.release) db.prepare("UPDATE inbox_items SET claimed_by=NULL, claimed_at=NULL WHERE id=?").run(it.id);
  else db.prepare("UPDATE inbox_items SET claimed_by=?, claimed_at=? WHERE id=?").run(req.user.id, now(), it.id);
  res.json(db.prepare("SELECT * FROM inbox_items WHERE id=?").get(it.id));
});
app.get("/api/canned-replies", requireAuth, (req: any, res) => {
  let rows = db.prepare("SELECT * FROM canned_replies WHERE workspace_id=? ORDER BY category, title").all(req.user.workspace_id) as any[];
  if (!rows.length) { // seed a starter library once
    const seed = [["lead_request", "Got it — next steps", "Hi {name}, thanks for reaching out to {business} about {service}. We've got your request and will call you shortly during business hours (Mon–Fri 8:00–5:30) to talk through scope and timing. — {business}"], ["paperwork", "Document received", "Hi {name}, we received your document — thank you. We'll verify it and update your job file today. — {business}"], ["paperwork", "Document still needed", "Hi {name}, we're still missing one item to keep your job moving: {document}. Reply to this email with it attached and we'll take it from there. — {business}"], ["client_job", "Scheduling your job", "Hi {name}, good news — your job is scheduled. Our crew will confirm the day before. Anything changes on your end, just reply here. — {business}"]];
    for (const [category, title, body] of seed) db.prepare("INSERT INTO canned_replies (id,workspace_id,category,title,body,created_at) VALUES (?,?,?,?,?,?)").run(uid("can"), req.user.workspace_id, category, title, body, now());
    rows = db.prepare("SELECT * FROM canned_replies WHERE workspace_id=? ORDER BY category, title").all(req.user.workspace_id) as any[];
  }
  res.json(rows);
});
app.post("/api/canned-replies", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("can"); db.prepare("INSERT INTO canned_replies (id,workspace_id,category,title,body,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, String(req.body.category || "general"), String(req.body.title || "Untitled"), String(req.body.body || ""), now()); res.status(201).json(db.prepare("SELECT * FROM canned_replies WHERE id=?").get(id)); });
app.delete("/api/canned-replies/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM canned_replies WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.get("/api/inbox-rules", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM inbox_rules WHERE workspace_id=? ORDER BY created_at").all(req.user.workspace_id)));
app.post("/api/inbox-rules", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("rul"); db.prepare("INSERT INTO inbox_rules (id,workspace_id,name,match_field,match_value,action,action_value,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)").run(id, req.user.workspace_id, String(req.body.name || "Rule"), String(req.body.match_field || "sender"), String(req.body.match_value || ""), String(req.body.action || "assign"), req.body.action_value || null, now()); const r = applyInboxRules(req.user.workspace_id); res.status(201).json({ rule: db.prepare("SELECT * FROM inbox_rules WHERE id=?").get(id), applied_now: r.applied }); });
app.delete("/api/inbox-rules/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM inbox_rules WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });

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
  if (!s.signed_at) { db.prepare("UPDATE proposals SET view_count=COALESCE(view_count,0)+1, first_viewed_at=COALESCE(first_viewed_at,?), viewed_at=? WHERE id=?").run(now(), now(), p.id); p.view_count = (p.view_count || 0) + 1; }
  const moneyS = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rawItems = JSON.parse(p.line_items || "[]");
  const subtotalS = rawItems.reduce((s: number, i: any) => s + Number(i.unit_price || 0) * (i.qty || 1), 0);
  const items = rawItems.map((i: any) => `<tr><td>${i.name}</td><td class="c">${i.qty || 1}</td><td class="r">${moneyS(i.unit_price)}</td><td class="r">${moneyS(Number(i.unit_price || 0) * (i.qty || 1))}</td></tr>`).join("");
  const itemsTable = `<table class="inv"><thead><tr><th>Description</th><th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead><tbody>${items}<tr class="sub"><td colspan="2"></td><td class="r">Subtotal</td><td class="r">${moneyS(subtotalS)}</td></tr><tr class="tot"><td colspan="3" class="r">TOTAL INVESTMENT</td><td class="r">${moneyS(p.total)}</td></tr></tbody></table>`;
  let opts: any[] = []; try { opts = JSON.parse(p.options || "[]"); } catch { opts = []; }
  const optionsHtml = opts.length ? `<h3>Choose your option</h3>` + opts.map((o: any, ix: number) => `<label class="optcard"><input type="radio" name="option" value="${String(o.name).replaceAll('"', "")}" ${ix === 0 ? "checked" : ""} style="width:auto"> <strong>${o.name} — ${moneyS(o.total)}</strong><table>${(o.line_items || []).map((i: any) => `<tr><td>${i.name}</td><td class="c">${i.qty || 1}</td><td class="r">${moneyS(i.unit_price)}</td></tr>`).join("")}</table></label>`).join("") : "";
  const expired = p.expires_at && new Date(p.expires_at) < new Date() && !s.signed_at;
  const superseded = !s.signed_at && p.status === "withdrawn";
  if ((expired || superseded) && !s.signed_at) return res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Proposal — ${"update needed"}</title><style>body{font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.6}</style><h1>📄 This proposal ${expired ? "has expired" : "has been replaced"}</h1><p>${expired ? "The signing window for this version has closed." : "A newer version of this proposal has been issued, so this link no longer accepts a signature."} Please contact the business and they'll send you the current proposal — same scope, current version.</p>`);
  const doc = (() => { try { return proposalDocument(p.id); } catch { return null; } })();
  const tplHtml = doc ? `${doc.template.logo ? `<img src="${doc.template.logo}" style="max-height:72px;max-width:260px">` : ""}` : "";
  const introHtml = doc ? doc.template.intro_html : "";
  const termsHtml = doc ? `<h3>Terms & Conditions</h3>${doc.template.terms_html}` : "";
  const footHtml = doc ? `<p class="docfoot">${doc.template.footer}<br>${doc.template.company} · Proposal ${doc.ref}</p>` : "";
  res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Proposal — ${ws.name}</title>
  <style>body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:24px auto;padding:0 16px 40px;color:#101613;line-height:1.5}table{width:100%;border-collapse:collapse}td{padding:6px}
.lh{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #0E5C3A;padding-bottom:10px;margin-bottom:18px}.lh .co{font-size:24px;font-weight:800;color:#0E5C3A;letter-spacing:-.02em}.lh .tag{font-size:13px;color:#5B6B62}.lh .ct{text-align:right;font-size:12.5px;color:#5B6B62}
h1.pt{font-size:30px;margin:14px 0 2px;letter-spacing:-.01em}h2.sv{font-size:19px;color:#0E5C3A;margin:0 0 6px}h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0E5C3A;border-bottom:2px solid #0E5C3A;padding-bottom:5px;margin:24px 0 10px}
.meta{font-size:14px;color:#334155;margin:2px 0 4px}.meta b{color:#101613}
.inv th{background:#0E5C3A;color:#fff;text-align:left;padding:8px 10px;font-size:13.5px}.inv td{border-bottom:1px solid #D9DEDB;padding:8px 10px;font-size:14.5px}.inv .r{text-align:right}.inv .c{text-align:center}.inv tr.sub td{font-weight:700;border-bottom:0}.inv tr.tot td{background:#0E5C3A;color:#fff;font-weight:800;font-size:15.5px;padding:10px}
.optcard{display:block;border:1.5px solid #D9DEDB;border-radius:12px;padding:12px 14px;margin:8px 0}.optcard table{margin-top:8px}.optcard td{border-bottom:1px solid #EDF0EE}
input{width:100%;padding:10px;margin:6px 0;box-sizing:border-box}button{background:#0E5C3A;color:#fff;border:0;padding:13px 20px;border-radius:9px;width:100%;font-size:15.5px;font-weight:700;cursor:pointer}
.sigblock{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-top:18px;background:#fafafa}.sigblock h3{margin:0 0 10px;font-size:15px;border:0;text-transform:none;letter-spacing:0;color:#101613}
.siggrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.siggrid .full{grid-column:1/-1}
.sigblock label{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:0 0 2px}
.sigblock input{margin:2px 0 0;background:#fff;border:1px solid #cbd5e1;border-radius:8px}
.sigblock input[name=typed_signature]{font-family:cursive;font-size:22px;border:0;border-bottom:2px solid #0E5C3A;border-radius:0;background:transparent;padding:4px 2px}
.consent{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:12px 0;color:#334155}.sigblock label.consent{text-transform:none;letter-spacing:0;font-weight:400}
.consent input{width:auto;margin:2px 0 0}
.docfoot{color:#5B6B62;font-size:12.5px;border-top:1px solid #D9DEDB;padding-top:10px;text-align:center;margin-top:26px}
@media(max-width:560px){.siggrid{grid-template-columns:1fr}.lh{flex-direction:column;align-items:flex-start}.lh .ct{text-align:left}}</style>
  <div class="lh"><div>${tplHtml ? "" : `<div class="co">${doc ? doc.template.company : ws.name}</div>`}${doc?.template?.tagline ? `<div class="tag">${doc.template.tagline}</div>` : ""}${tplHtml}</div><div class="ct">${doc?.template?.contact_line || ""}${doc?.template?.address ? `<br>${doc.template.address}` : ""}</div></div>
  <h1 class="pt">Proposal</h1><h2 class="sv">${lead.service_requested}</h2>
  <p class="meta">Prepared for <b>${contact.name}</b>${lead.location ? ` · ${lead.location}` : ""}${doc ? ` · <b>${doc.ref}</b>` : ""}</p>
  ${introHtml}
  ${expired ? `<p style="background:#fef3c7;padding:10px;border-radius:8px">⏰ This proposal expired on ${new Date(p.expires_at).toLocaleDateString()} — contact us and we'll re-issue it with the same scope.</p>` : ""}${p.expires_at && !s.signed_at && !expired ? `<p class="muted">Valid until ${new Date(p.expires_at).toLocaleDateString()}</p>` : ""}
  ${lead.notes ? `<h3>Scope of Work</h3><p>${lead.notes}</p>` : ""}${opts.length ? "" : `<h3>Investment</h3>${itemsTable}<p style="font-size:13.5px;color:#5B6B62">Payment status: ${p.payment_status || "—"}</p>`}
  ${termsHtml}${footHtml}
  ${s.signed_at ? `<p>✅ Signed by ${s.signer_name} on ${new Date(s.signed_at).toLocaleString()}</p>` : `
  <form method="POST" action="/sign/${req.params.token}">
    ${optionsHtml}
    <div class="sigblock"><h3>Accept &amp; sign</h3><div class="siggrid">
    <div><label for="sn">Full name</label><input id="sn" name="signer_name" placeholder="Your full name" required></div>
    <div><label for="se">Email</label><input id="se" name="signer_email" type="email" placeholder="you@company.com"></div>
    <div class="full"><label for="ts">Signature — type your name</label><input id="ts" name="typed_signature" placeholder="Type your name to sign" required></div>
    </div>
    <label class="consent"><input type="checkbox" name="consent" value="1" required> <span>I agree to sign electronically (ESIGN/UETA) and accept this proposal.</span></label>
    <button>Sign Proposal</button></div></form>`}`);
});
app.post("/sign/:token", express.urlencoded({ extended: false }), (req: any, res) => {
  const ctx = getByToken(req.params.token);
  if (ctx?.proposal?.options && req.body.option) { try { const opts = JSON.parse(ctx.proposal.options); if (opts.some((o: any) => o.name === req.body.option)) db.prepare("UPDATE proposals SET selected_option=? WHERE id=?").run(req.body.option, ctx.proposal.id); } catch { /* bad options json */ } }
  const r = sign(req.params.token, { signer_name: req.body.signer_name, signer_email: req.body.signer_email, typed_signature: req.body.typed_signature, consent: req.body.consent === "1", ip: req.ip, user_agent: req.get("user-agent") });
  if (!r.ok) return res.status(422).send(`Signing failed: ${r.error}. Go back and check your entry.`);
  // v3 §8: signing completes the chain — lead WON (guard passes: a signed proposal exists) + Job auto-created
  try { const l2 = db.prepare("SELECT * FROM leads WHERE id=?").get(ctx.lead.id) as any; if (l2 && !FINAL_STATES.includes(l2.state)) setStage(ctx.workspace.id, "system", l2, "WON", {}); } catch { /* chain completion never blocks the signature */ }
  res.type("html").send(`<!doctype html><h1>Signed ✅</h1><p>Evidence certificate: ${r.certificate.signature_id} · Document hash ${r.certificate.doc_hash.slice(0, 16)}… · ${r.certificate.signed_at}</p><p>Thank you — we've created your job and will be in touch to schedule.</p>`);
});
app.get("/api/proposals/:id/certificate", requireAuth, (req: any, res) => {
  const s = db.prepare("SELECT * FROM signatures WHERE proposal_id=? AND signed_at IS NOT NULL").get(req.params.id) as any;
  if (!s) return res.status(404).json({ error: { code: "not_signed" } });
  res.json({ signature_id: s.id, signer: s.signer_name, signed_at: s.signed_at, doc_hash: s.doc_hash, ip: s.ip });
});

// ---------- v3 slice 31: THE WORK QUEUE — one worst-first pile, everything actionable ----------
app.post("/api/queue/bulk", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const ids = [...new Set((req.body.lead_ids || []).map(String))].slice(0, 100) as string[];
  if (!ids.length) return res.status(422).json({ error: { code: "no_selection" } });
  const action = String(req.body.action || "");
  let affected = 0;
  if (action === "assign") { const uidv = String(req.body.assignee_id || ""); const u = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=? AND active=1").get(uidv, ws); if (!u) return res.status(422).json({ error: { code: "bad_assignee" } });
    for (const id of ids) { const r = db.prepare("UPDATE leads SET owner_id=?, updated_at=? WHERE id=? AND workspace_id=?").run(uidv, now(), id, ws) as any; if (r.changes) { logEvent(ws, id, req.user.id, "bulk_assigned", null, null, { assignee: uidv }); touchLead(ws, id, "assign", req.user.id); affected++; } } }
  else if (action === "snooze") { const days = Math.min(14, Math.max(1, Number(req.body.days || 1)));
    for (const id of ids) { const l = db.prepare("SELECT next_action_due_at FROM leads WHERE id=? AND workspace_id=?").get(id, ws) as any; if (!l) continue; const base = l.next_action_due_at && new Date(l.next_action_due_at) > new Date() ? new Date(l.next_action_due_at) : new Date(); const r = db.prepare("UPDATE leads SET next_action_due_at=?, updated_at=? WHERE id=?").run(new Date(base.getTime() + days * 86400000).toISOString(), now(), id) as any; if (r.changes) affected++; } }
  else if (action === "task") { const uidv = String(req.body.assignee_id || req.user.id); const title = String(req.body.title || "Follow up").slice(0, 140);
    for (const id of ids) { const l = db.prepare("SELECT id FROM leads WHERE id=? AND workspace_id=?").get(id, ws); if (!l) continue; db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("tsk"), ws, id, uidv, "follow_up", title, new Date(Date.now() + 86400000).toISOString(), "open", now()); affected++; } }
  else return res.status(422).json({ error: { code: "bad_action" } });
  audit(ws, req.user.id, "queue.bulk_" + action, "lead", null, { count: affected });
  res.json({ ok: true, affected });
});
app.get("/api/queue", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const t = now(); let items: any[] = [];
  const ageH = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 360000) / 10);
  const mine2 = (l: any) => !scopeOwn(req.user) || mine(req.user, l);
  for (const d of db.prepare("SELECT * FROM outcome_deliveries WHERE workspace_id=? AND last_status IN ('failed','dead') AND superseded_at IS NULL ORDER BY created_at LIMIT 10").all(ws) as any[])
    items.push({ id: "q_handoff_" + d.id, type: "handoff_failed", score: 95, title: "Outcome handoff failed", subtitle: `${d.outcome} · ${d.last_error || "delivery failed"} — replay from Handoffs`, lead_id: d.lead_id, age_hours: ageH(d.created_at), primary: { kind: "open_lead", label: "Open lead" } });
  for (const doc of db.prepare("SELECT d.id, d.name, d.expires_at, d.lead_id, j.id job_id FROM documents d LEFT JOIN jobs j ON j.id=d.job_id WHERE d.workspace_id=? AND d.status='received' AND d.expires_at IS NOT NULL AND julianday(d.expires_at) - julianday('now') <= 14 ORDER BY d.expires_at LIMIT 15").all(ws) as any[]) {
    const daysLeft = Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86400000);
    items.push({ id: "q_doc_" + doc.id, type: "doc_expiring", score: daysLeft < 0 ? 85 : 60, title: `Document ${daysLeft < 0 ? "expired" : "expiring"} — ${doc.name}`, subtitle: daysLeft < 0 ? `Expired ${-daysLeft}d ago — renew before it blocks invoicing` : `Expires in ${daysLeft}d — start the renewal now`, lead_id: doc.lead_id, age_hours: 0, primary: { kind: "open_lead", label: "Open" } });
  }
  for (const a of db.prepare("SELECT a.*, c.name contact_name FROM approvals a JOIN leads l ON l.id=a.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE a.workspace_id=? AND a.decision IS NULL ORDER BY a.submitted_at").all(ws) as any[])
    items.push({ id: "q_appr_" + a.id, type: "approval", score: 90 + Math.min(20, ageH(a.submitted_at)), title: `Approval waiting — ${a.contact_name || "lead"}`, subtitle: `Submitted ${ageH(a.submitted_at)}h ago · tier ${a.tier}`, lead_id: a.lead_id, approval_id: a.id, age_hours: ageH(a.submitted_at), primary: { kind: "open_approval", label: "Decide" } });
  for (const cb of db.prepare("SELECT cb.*, c.name contact_name FROM callbacks cb JOIN leads l ON l.id=cb.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE cb.workspace_id=? AND cb.status='open' AND cb.due_at<=? ORDER BY cb.due_at LIMIT 25").all(ws, t) as any[])
    items.push({ id: "q_cb_" + cb.id, type: "callback", score: 88, title: `Callback due — ${cb.contact_name || "customer"}`, subtitle: cb.note || "Promised callback", lead_id: cb.lead_id, callback_id: cb.id, primary: { kind: "open_lead", label: "Open & call" } });
  for (const wp of db.prepare("SELECT p.id pid, p.total, p.sent_at, l.id lead_id, c.name contact_name, l.service_requested FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND l.state IN ('SENT','FOLLOWUP') AND julianday('now') - julianday(p.sent_at) >= 3 AND julianday(l.updated_at) - julianday(p.sent_at) < 0.05 ORDER BY p.sent_at LIMIT 25").all(ws) as any[]) {
    items.push({ id: "q_wait_" + wp.pid, type: "waiting_customer", score: 55, title: `Waiting on customer — ${wp.contact_name || "lead"}`, subtitle: `Proposal sent ${Math.floor((Date.now() - new Date(wp.sent_at).getTime()) / 86400000)}d ago · ${wp.service_requested || ""} · $${wp.total} · no movement since`, lead_id: wp.lead_id, age_hours: ageH(wp.sent_at), primary: { kind: "open_lead", label: "Open & nudge" } });
  }
  for (const l of db.prepare("SELECT * FROM leads WHERE workspace_id=? AND state='PROPOSAL' ORDER BY est_value DESC LIMIT 60").all(ws) as any[]) {
    // v68: proposal-stage work sits at the TOP of the queue — draft what's
    // missing, submit what's unsubmitted, send what's approved.
    if (!mine2(l)) continue; const v = leadView(l);
    const p = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC").get(l.id) as any;
    if (!p) { items.push({ id: "q_pd_" + l.id, type: "proposal_draft", score: 97, title: `Draft proposal — ${v.contact_name || "Lead"}`, subtitle: `${l.service_requested} · ${moneyFmt(l.est_value)} · no proposal yet`, lead_id: l.id, primary: { kind: "proposal", label: "Draft" } }); continue; }
    if (p.sent_at || p.status === "sent" || p.status === "signed") continue;
    const appr = approvedApprovalFor(ws, p.id); const pend = pendingApprovalFor(ws, p.id);
    if (appr || !approvalRequiredFor(ws, p.total || 0, (req as any).user.role)) items.push({ id: "q_ps_" + l.id, type: "proposal_send", score: 96, title: `Send proposal — ${v.contact_name || "Lead"}`, subtitle: `${l.service_requested} · ${moneyFmt(p.total)} · ${appr ? "approved — ready to send" : "no approval required"}`, lead_id: l.id, proposal_id: p.id, primary: { kind: "proposal", label: "Send" } });
    else if (!pend) items.push({ id: "q_pr_" + l.id, type: "proposal_review", score: 95, title: `Submit for approval — ${v.contact_name || "Lead"}`, subtitle: `${l.service_requested} · ${moneyFmt(p.total)} · drafted, not submitted`, lead_id: l.id, proposal_id: p.id, primary: { kind: "proposal", label: "Submit" } });
  }
  for (const l of db.prepare("SELECT * FROM leads WHERE workspace_id=? AND state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') AND next_action_due_at IS NOT NULL AND next_action_due_at<? ORDER BY next_action_due_at LIMIT 60").all(ws, t) as any[]) {
    if (!mine2(l)) continue; const v = leadView(l);
    items.push({ id: "q_over_" + l.id, type: "followup_overdue", score: 85 + Math.min(15, ageH(l.next_action_due_at)), title: `${v.contact_name || "Lead"} — ${l.next_action || "Follow up"}`, subtitle: `${l.service_requested} · due ${ageH(l.next_action_due_at)}h ago · ${moneyFmt(l.est_value)}`, lead_id: l.id, age_hours: ageH(l.next_action_due_at), primary: { kind: "open_lead", label: "Work it" } });
  }
  for (const l of db.prepare("SELECT * FROM leads WHERE workspace_id=? AND " + UNTOUCHED_WHERE + " ORDER BY created_at LIMIT 60").all(ws) as any[]) {
    if (!mine2(l)) continue; const v = leadView(l);
    items.push({ id: "q_new_" + l.id, type: "lead_untouched", score: 80 + Math.min(18, ageH(l.created_at) / 4), title: `Untouched lead — ${v.contact_name || "New lead"}`, subtitle: `${l.service_requested} · arrived ${ageH(l.created_at)}h ago · ${moneyFmt(l.est_value)}`, lead_id: l.id, age_hours: ageH(l.created_at), primary: { kind: "open_lead", label: "First touch" } });
  }
  for (const p of db.prepare("SELECT p.*, c.name contact_name FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.view_count>0 AND p.signed_at IS NULL AND p.status='sent' AND l.state IN ('SENT','FOLLOWUP') ORDER BY p.viewed_at DESC LIMIT 15").all(ws) as any[])
    items.push({ id: "q_view_" + p.id, type: "proposal_viewed", score: 78, title: `${p.contact_name || "Customer"} viewed the proposal — unsigned`, subtitle: `Viewed ${p.view_count}× · total ${moneyFmt(p.total)} · viewed ${ageH(p.viewed_at)}h ago`, lead_id: p.lead_id, primary: { kind: "open_lead", label: "Call them" } });
  for (const it of db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND status='open' ORDER BY created_at LIMIT 60").all(ws) as any[])
    items.push({ id: "q_inb_" + it.id, type: "inbox", score: 70 + Math.min(15, ageH(it.created_at) / 4), title: `${it.category.replaceAll("_", " ")} — ${it.subject || "(no subject)"}`, subtitle: `From ${it.from_name || it.from_email} · ${ageH(it.created_at)}h old${it.owner_id ? "" : " · unassigned"}`, inbox_id: it.id, lead_id: it.lead_id || null, identity: senderIdentity(ws, it), age_hours: ageH(it.created_at), primary: { kind: "open_inbox", label: "Handle" } });
  for (const p of db.prepare("SELECT p.*, c.name contact_name, CAST((julianday('now') - julianday(COALESCE(p.sent_at, p.created_at))) AS INTEGER) days FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND p.signed_at IS NULL AND l.state IN ('SENT','FOLLOWUP') AND julianday('now') - julianday(COALESCE(p.sent_at, p.created_at)) >= 4 AND julianday(l.updated_at) - julianday(COALESCE(p.sent_at, p.created_at)) >= 0.05 ORDER BY days DESC LIMIT 15").all(ws) as any[])
    items.push({ id: "q_cold_" + p.id, type: "proposal_cold", score: 66 + Math.min(10, p.days), title: `Proposal going cold — ${p.contact_name || "customer"}`, subtitle: `Sent ${p.days} days ago · ${moneyFmt(p.total)} · unsigned`, lead_id: p.lead_id, primary: { kind: "open_lead", label: "Nudge" } });
  backfillJobs(ws);
  for (const j of db.prepare("SELECT * FROM jobs WHERE workspace_id=? AND stage NOT IN ('CLOSED','CANCELLED')").all(ws) as any[]) {
    const crew = (db.prepare("SELECT COUNT(*) c FROM job_crew WHERE lead_id=?").get(j.lead_id) as any).c;
    if (!crew && ["AWAITING_SCHEDULING", "SCHEDULED"].includes(j.stage)) { const v = jobView(j); items.push({ id: "q_crew_" + j.id, type: "job_crew", score: 62, title: `Job needs crew — ${v.contact_name}`, subtitle: `${v.service_requested} · ${moneyFmt(j.value)} · no one assigned`, job_id: j.id, lead_id: j.lead_id, primary: { kind: "open_job", label: "Assign crew" } }); }
    const docs = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN status='received' THEN 1 ELSE 0 END) r FROM documents WHERE (job_id=? OR lead_id=?) AND required=1").get(j.id, j.lead_id) as any;
    if ((docs.t || 0) > (docs.r || 0) && ["IN_PROGRESS", "WORK_COMPLETED", "DOCUMENTATION_PENDING", "READY_TO_INVOICE"].includes(j.stage)) { const v = jobView(j); items.push({ id: "q_docs_" + j.id, type: "paperwork", score: 58, title: `Paperwork missing — ${v.contact_name}`, subtitle: `${(docs.t || 0) - (docs.r || 0)} required document(s) outstanding on ${v.service_requested} — the job cannot invoice until they land`, job_id: j.id, lead_id: j.lead_id, primary: { kind: "open_job", label: "Chase docs" } }); }
  }
  for (const f of db.prepare("SELECT f.*, COALESCE(w.name,u.name) who FROM field_reports f LEFT JOIN workers w ON w.id=f.worker_id LEFT JOIN users u ON u.id=f.manager_id WHERE f.workspace_id=? AND f.status='missing' AND f.report_date<? ORDER BY f.report_date LIMIT 20").all(ws, todayStr()) as any[])
    items.push({ id: "q_fr_" + f.id, type: "field_report", score: 52, title: `Field report missing — ${f.who || "worker"}`, subtitle: `Report for ${f.report_date} not filed`, lead_id: f.lead_id || null, primary: { kind: "open_ops", label: "Chase" } });
  for (const s2 of db.prepare("SELECT t.*, COALESCE(w.name,u.name) who FROM timesheets t LEFT JOIN workers w ON w.id=t.worker_id LEFT JOIN users u ON u.id=t.manager_id WHERE t.workspace_id=? AND t.status='missing' AND t.week_of<? ORDER BY t.week_of LIMIT 20").all(ws, weekStartOf(new Date())) as any[])
    items.push({ id: "q_ts_" + s2.id, type: "timesheet", score: 48, title: `Timesheet missing — ${s2.who || "worker"}`, subtitle: `Week of ${s2.week_of} not submitted`, primary: { kind: "open_ops", label: "Chase" } });
  items.sort((a, b) => b.score - a.score);
  { const p = permsOf(req.user); if (p.leads_scope !== "all") { items = items.filter(i => { if ((i as any).lead_id) { const l = db.prepare("SELECT owner_id, pm_id FROM leads WHERE id=?").get((i as any).lead_id) as any; if (l && !leadVisible(req.user, l)) return false; } if (i.type === "approval") { const ap = db.prepare("SELECT approver_id FROM approvals WHERE id=?").get(i.id.replace("q_appr_", "")) as any; if (ap && ap.approver_id !== req.user.id && !p.can_approve) return false; } return true; }); } }
  res.json({ items: items.slice(0, 100), total: items.length, by_type: items.reduce((m: any, i: any) => { m[i.type] = (m[i.type] || 0) + 1; return m; }, {}) });
});
// ---------- v3 slice 36 (server): board stats — metrics ON the work surface ----------
app.get("/api/analytics", requireAuth, modGate("reports"), (req: any, res) => {
  const ws = req.user.workspace_id;
  const period = ["week", "month", "year"].includes(String(req.query.period)) ? String(req.query.period) : "month";
  const days = period === "week" ? 7 : period === "year" ? 365 : 30;
  const nowMs = Date.now();
  const inWin = (ts: any, from: number, to: number) => { if (!ts) return false; const t = new Date(ts).getTime(); return t >= from && t < to; };
  const cur: [number, number] = [nowMs - days * 86400000, nowMs];
  const prev: [number, number] = [nowMs - 2 * days * 86400000, nowMs - days * 86400000];
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(ws) as any[];
  const props = db.prepare("SELECT * FROM proposals WHERE workspace_id=?").all(ws) as any[];
  const invs = db.prepare("SELECT * FROM invoices WHERE workspace_id=?").all(ws) as any[];
  const pays = db.prepare("SELECT * FROM payments WHERE workspace_id=?").all(ws) as any[];
  const apprs = db.prepare("SELECT * FROM approvals WHERE workspace_id=?").all(ws) as any[];
  const propByLead = new Map<string, any[]>(); for (const p of props) { const arr = propByLead.get(p.lead_id) || []; arr.push(p); propByLead.set(p.lead_id, arr); }
  const kpi = (curV: number, prevV: number) => ({ now: Math.round(curV * 10) / 10, prev: Math.round(prevV * 10) / 10, delta_pct: prevV > 0 ? Math.round(1000 * (curV - prevV) / prevV) / 10 : null });
  const cnt = (arr: any[], f: (x: any) => any, w: [number, number]) => arr.filter(x => inWin(f(x), w[0], w[1])).length;
  const sum = (arr: any[], f: (x: any) => any, g: (x: any) => number, w: [number, number]) => arr.filter(x => inWin(f(x), w[0], w[1])).reduce((s, x) => s + (g(x) || 0), 0);
  const touchHours = (w: [number, number]) => { const rows = leads.filter(l => inWin(l.created_at, w[0], w[1]) && l.first_touch_at); if (!rows.length) return 0; return rows.reduce((s, l) => s + (new Date(l.first_touch_at).getTime() - new Date(l.created_at).getTime()) / 3600000, 0) / rows.length; };
  const fpar = (w: [number, number]) => { const d = apprs.filter(x => x.decided_at && inWin(x.decided_at, w[0], w[1])); if (!d.length) return 0; return Math.round(1000 * d.filter(x => x.decision === "approved").length / d.length) / 10; };
  const kpis = {
    new_leads: kpi(cnt(leads, l => l.created_at, cur), cnt(leads, l => l.created_at, prev)),
    touched: kpi(cnt(leads, l => l.first_touch_at, cur), cnt(leads, l => l.first_touch_at, prev)),
    proposals_sent: kpi(cnt(props, p => p.sent_at, cur), cnt(props, p => p.sent_at, prev)),
    proposals_signed: kpi(cnt(props, p => p.signed_at, cur), cnt(props, p => p.signed_at, prev)),
    signed_value: kpi(sum(props, p => p.signed_at, p => p.total, cur), sum(props, p => p.signed_at, p => p.total, prev)),
    invoiced: kpi(sum(invs, i => i.created_at, i => i.total, cur), sum(invs, i => i.created_at, i => i.total, prev)),
    collected: kpi(sum(pays, p => p.created_at, p => p.amount, cur), sum(pays, p => p.created_at, p => p.amount, prev)),
    avg_touch_hours: kpi(touchHours(cur), touchHours(prev)),
    fpar: kpi(fpar(cur), fpar(prev))
  };
  const fLeads = leads.filter(l => inWin(l.created_at, ...cur));
  const funnel = [
    { stage: "Leads in", n: fLeads.length },
    { stage: "Touched", n: fLeads.filter(l => l.first_touch_at).length },
    { stage: "Proposal built", n: fLeads.filter(l => (propByLead.get(l.id) || []).length > 0).length },
    { stage: "Proposal sent", n: fLeads.filter(l => (propByLead.get(l.id) || []).some(p => p.sent_at)).length },
    { stage: "Signed", n: fLeads.filter(l => (propByLead.get(l.id) || []).some(p => p.signed_at)).length }
  ];
  const buckets = period === "year" ? 12 : period === "month" ? 10 : 7;
  const bSize = (days * 86400000) / buckets;
  const trend = Array.from({ length: buckets }, (_, i) => { const from = cur[0] + i * bSize, to = from + bSize; const d = new Date(from); return { label: period === "year" ? d.toLocaleDateString(undefined, { month: "short" }) : d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), leads: cnt(leads, l => l.created_at, [from, to]), signed_value: Math.round(sum(props, p => p.signed_at, p => p.total, [from, to])) }; });
  const groupBy = (keyOf: (l: any) => string) => { const map = new Map<string, any>(); for (const l of fLeads) { const k = keyOf(l) || "—"; const g = map.get(k) || { name: k, leads: 0, won: 0, lost: 0, value: 0, signed_value: 0 }; g.leads++; const ps = propByLead.get(l.id) || []; if (ps.some(p => p.signed_at)) { g.won++; g.signed_value += Math.max(...ps.filter(p => p.signed_at).map(p => p.total || 0)); } if (["LOST", "NO_RESPONSE", "UNSERVICEABLE"].includes(l.state)) g.lost++; g.value += l.est_value || 0; map.set(k, g); } return [...map.values()].map(g => ({ ...g, win_rate: (g.won + g.lost) > 0 ? Math.round(1000 * g.won / (g.won + g.lost)) / 10 : null })).sort((x, y) => y.leads - x.leads); };
  const usersById = new Map((db.prepare("SELECT id, name FROM users WHERE workspace_id=?").all(ws) as any[]).map(u => [u.id, u.name]));
  const by_service = groupBy(l => l.service_requested || "Unspecified").slice(0, 10);
  const by_source = groupBy(l => l.source || "Unknown").slice(0, 8);
  const by_owner = groupBy(l => l.owner_id ? (usersById.get(l.owner_id) || "Owner") : "Unassigned").slice(0, 8);
  // deep insights (all-time where cohorts need size)
  const insights: string[] = [];
  const coh = (maxH: number | null, minH: number) => { const rows = leads.filter(l => l.first_touch_at && (((new Date(l.first_touch_at).getTime() - new Date(l.created_at).getTime()) / 3600000) >= minH) && (maxH === null || ((new Date(l.first_touch_at).getTime() - new Date(l.created_at).getTime()) / 3600000) < maxH)); const won = rows.filter(l => (propByLead.get(l.id) || []).some(p => p.signed_at)).length; const decided = rows.filter(l => (propByLead.get(l.id) || []).some(p => p.signed_at) || ["LOST", "NO_RESPONSE", "UNSERVICEABLE"].includes(l.state)).length; return { n: rows.length, rate: decided >= 3 ? Math.round(1000 * won / decided) / 10 : null }; };
  const fast = coh(1, 0), slow = coh(null, 24);
  if (fast.rate !== null && slow.rate !== null) insights.push(`⚡ Speed wins deals: leads touched within an hour sign at ${fast.rate}% vs ${slow.rate}% for leads left over a day (all-time, ${fast.n + slow.n} leads measured).`);
  const svcDecided = by_service.filter(s => s.win_rate !== null && (s.won + s.lost) >= 3).sort((x, y) => (y.win_rate || 0) - (x.win_rate || 0));
  if (svcDecided.length) insights.push(`🏆 Strongest service: ${svcDecided[0].name} closes at ${svcDecided[0].win_rate}% (${svcDecided[0].won} won of ${svcDecided[0].won + svcDecided[0].lost} decided this period).`);
  const staleCut = nowMs - 14 * 86400000;
  const stale = leads.filter(l => !["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(l.state) && new Date(l.updated_at || l.created_at).getTime() < staleCut);
  if (stale.length) insights.push(`🧊 ${stale.length} open leads have gone quiet for 14+ days — ${"$" + Math.round(stale.reduce((s, l) => s + (l.est_value || 0), 0)).toLocaleString()} of pipeline cooling off. The Work Queue surfaces them; a reactivation pass is the cheapest recovery.`);
  const lossReasons = new Map<string, number>(); for (const l of leads.filter(l => inWin(l.updated_at, ...cur) && ["LOST", "UNSERVICEABLE"].includes(l.state))) lossReasons.set(String(l.lost_reason || "no reason recorded"), (lossReasons.get(String(l.lost_reason || "no reason recorded")) || 0) + 1);
  const topLoss = [...lossReasons.entries()].sort((x, y) => y[1] - x[1])[0];
  if (topLoss) insights.push(`🔍 Top loss driver this period: "${topLoss[0].replaceAll("_", " ").toLowerCase()}" (${topLoss[1]} leads). Demand Gap has the full breakdown.`);
  const noOwner = fLeads.filter(l => !l.owner_id).length;
  if (noOwner > 0) insights.push(`👤 ${noOwner} of ${fLeads.length} new leads this period have no owner — unowned leads don't get worked.`);
  // future: weighted pipeline + expected signings + receivables due
  const W: Record<string, number> = { NEW: 0.05, WORKING: 0.15, QUALIFIED: 0.35, PROPOSAL: 0.55, SENT: 0.75, FOLLOWUP: 0.45 };
  const openLeads = leads.filter(l => !["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(l.state));
  const weighted = openLeads.reduce((s, l) => s + (l.est_value || 0) * (W[l.state] || 0.05), 0);
  const outProps = props.filter(p => p.sent_at && !p.signed_at && p.status !== "withdrawn");
  const sentDecided = props.filter(p => p.signed_at || p.outcome === "lost");
  const sentRate = sentDecided.length >= 3 ? props.filter(p => p.signed_at).length / Math.max(1, props.filter(p => p.sent_at).length) : null;
  const dueSoon = invs.filter(i => (i.total || 0) > (i.paid_amount || 0) && i.due_at && new Date(i.due_at).getTime() <= nowMs + 30 * 86400000 && i.status !== "void");
  const collectedAll = pays.reduce((s, p) => s + (p.amount || 0), 0); const invoicedAll = invs.filter(i => i.status !== "void").reduce((s, i) => s + (i.total || 0), 0);
  const collectRate = invoicedAll > 0 ? Math.min(1, collectedAll / invoicedAll) : null;
  const forecast = { weighted_pipeline: Math.round(weighted), proposals_out: outProps.length, proposals_out_value: Math.round(outProps.reduce((s, p) => s + (p.total || 0), 0)), expected_signings_value: sentRate !== null ? Math.round(outProps.reduce((s, p) => s + (p.total || 0), 0) * sentRate) : null, sent_close_rate: sentRate !== null ? Math.round(1000 * sentRate) / 10 : null, receivables_due_30d: Math.round(dueSoon.reduce((s, i) => s + ((i.total || 0) - (i.paid_amount || 0)), 0)), projected_collected_30d: collectRate !== null ? Math.round(dueSoon.reduce((s, i) => s + ((i.total || 0) - (i.paid_amount || 0)), 0) * collectRate) : null, collection_rate: collectRate !== null ? Math.round(1000 * collectRate) / 10 : null };
  res.json({ period, days, kpis, funnel, trend, by_service, by_source, by_owner, insights, forecast });
});
app.get("/api/board-stats", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(ws) as any[];
  const median = (a: number[]) => a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0;
  const stages: any = {};
  for (const st of [...OPEN_STAGES, "WON"]) {
    const rows = leads.filter(l => l.state === st);
    const ages = rows.map(l => (Date.now() - new Date(l.stage_changed_at || l.updated_at || l.created_at).getTime()) / 86400000);
    stages[st] = { count: rows.length, value: Math.round(rows.reduce((s, l) => s + (l.est_value || 0), 0)), median_age_days: Math.round(median(ages) * 10) / 10, rotting: ages.filter(a => a > 5).length };
  }
  const finals = leads.filter(l => ["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(l.state));
  stages["CLOSED"] = { count: finals.length, value: 0, median_age_days: 0, rotting: 0 };
  const jobs = db.prepare("SELECT stage, COUNT(*) c FROM jobs WHERE workspace_id=? GROUP BY stage").all(ws) as any[];
  res.json({ stages, jobs: Object.fromEntries(jobs.map(j => [j.stage, j.c])) });
});

// ---------- v3 slice 34 (server): callbacks + manual reactivation ----------
app.post("/api/leads/:id/callback", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const id = uid("cbk");
  db.prepare("INSERT INTO callbacks (id,workspace_id,lead_id,due_at,note,status,created_by,created_at) VALUES (?,?,?,?,?,'open',?,?)")
    .run(id, req.user.workspace_id, l.id, String(req.body.due_at || new Date(Date.now() + 86400000).toISOString()), String(req.body.note || "Callback requested"), req.user.id, now());
  db.prepare("UPDATE leads SET next_action='Callback', next_action_due_at=? WHERE id=?").run(String(req.body.due_at || ""), l.id);
  res.status(201).json(db.prepare("SELECT * FROM callbacks WHERE id=?").get(id));
});
app.post("/api/callbacks/:id/done", requireAuth, (req: any, res) => { db.prepare("UPDATE callbacks SET status='done', completed_at=? WHERE id=? AND workspace_id=?").run(now(), req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/reactivate", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; let rows = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND state IN ('NO_RESPONSE','LOST')").all(ws) as any[];
  if (Array.isArray(req.body?.lead_ids) && req.body.lead_ids.length) rows = rows.filter(l => req.body.lead_ids.includes(l.id));
  let revived = 0;
  for (const l of rows) { if (l.state === "LOST" && !["price", "timing", "Price", "Timing"].includes(String(l.lost_reason || "")) && !req.body?.lead_ids) continue;
    const r: any = setStage(ws, req.user.id, l, "WORKING", { note: "reactivated (rehash)" });
    if (!r.error) { db.prepare("UPDATE leads SET next_action='Rehash — check in', next_action_due_at=? WHERE id=?").run(new Date(Date.now() + 86400000).toISOString(), l.id); revived++; } }
  res.json({ revived });
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
  <h1>Test Mode — ${pay.kind === "invoice" ? "Invoice payment" : "Deposit"}</h1><p>Amount: <strong>$${Number(pay.amount).toFixed(2)}</strong> · Status: ${pay.status}</p>
  ${pay.status === "paid" ? "<p>✅ Paid (test mode)</p>" : `<form method="POST" action="/pay/test/${pay.id}"><button>Pay ${pay.kind === "invoice" ? "Invoice" : "Deposit"} (test)</button></form>`}
  <p><small>No real charge. Connect STRIPE_SECRET_KEY and this becomes a live Stripe Checkout link automatically.</small></p>`);
});
app.post("/pay/test/:paymentId", express.urlencoded({ extended: false }), (req, res) => { markPaid(req.params.paymentId); res.redirect(`/pay/test/${req.params.paymentId}`); });
app.post("/webhooks/stripe", (req: any, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: { code: "webhook_not_configured", message: "Stripe webhook secret is not configured — events are refused rather than trusted unsigned." } });
  if (!verifyStripeSignature(req.rawBody || "", req.headers["stripe-signature"] || "", secret)) return res.status(400).json({ error: { code: "invalid_signature" } });
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
app.post("/api/public/backlog-audit", (req: any, res) => { const rows = Array.isArray(req.body?.rows) ? req.body.rows : null; if (!rows) return res.status(422).json({ error: { code: "rows_required", message: "Send { rows: [...] } — export your leads as CSV/JSON and pass the parsed rows." } }); if (rows.length > 2000) return res.status(422).json({ error: { code: "too_many_rows", message: "The free audit covers up to 2,000 rows." } }); const report = analyzeBacklog(rows); const email = String(req.body?.email || "").trim(); if (email) { try { db.prepare("INSERT INTO audit_requests (id,email,rows_count,recoverable_value,recoverable_count,created_at) VALUES (?,?,?,?,?,?)").run(uid("aud"), email.slice(0, 160), report.rows, report.recoverable_value, report.recoverable_count, now()); } catch {} } res.json(report); });
app.get("/audit", (_req: any, res) => { res.setHeader("Content-Type", "text/html"); res.send(AUDIT_PAGE); });
app.get("/api/admin/activation", requireAuth, requirePlatformAdmin, (_req: any, res) => { const wss = db.prepare("SELECT id, name, plan, created_at FROM workspaces ORDER BY created_at").all() as any[]; const M = ["has_leads", "has_proposals", "has_decided_approval", "has_jobs", "has_won", "has_team"]; const rows = wss.map(w => { const c = (sql: string) => (db.prepare(sql).get(w.id) as any)?.c || 0; return { workspace: w.name, plan: w.plan, has_leads: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=?") > 0, has_proposals: c("SELECT COUNT(*) c FROM proposals WHERE workspace_id=?") > 0, has_decided_approval: c("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NOT NULL") > 0, has_jobs: c("SELECT COUNT(*) c FROM jobs WHERE workspace_id=?") > 0, has_won: c("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state='WON'") > 0, has_team: c("SELECT COUNT(*) c FROM users WHERE workspace_id=?") > 1 }; }); const summary: any = {}; for (const m of M) summary[m] = rows.length ? Math.round(1000 * rows.filter(r => (r as any)[m]).length / rows.length) / 10 : 0; res.json({ workspaces: rows, milestone_pct: summary }); });
app.get("/api/metrics/periods", requireAuth, (req: any, res) => { const ws = req.user.workspace_id; const dow = (new Date().getUTCDay() + 6) % 7; const monday = new Date(Date.now() - dow * 86400000); monday.setUTCHours(0, 0, 0, 0); const thisStart = monday.toISOString(); const lastStart = new Date(monday.getTime() - 7 * 86400000).toISOString(); const win = (a: string, b: string | null) => { const c = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any)?.v || 0; const cond = (col: string) => b ? `${col}>=? AND ${col}<?` : `${col}>=?`; const args = b ? [ws, a, b] : [ws, a]; return { leads_created: c(`SELECT COUNT(*) v FROM leads WHERE workspace_id=? AND ${cond("created_at")}`, ...args), proposals_sent: c(`SELECT COUNT(*) v FROM proposals WHERE workspace_id=? AND ${cond("sent_at")}`, ...args), proposals_live: c(`SELECT COUNT(*) v FROM proposals WHERE workspace_id=? AND delivery_mode='live' AND ${cond("sent_at")}`, ...args), proposals_test_mode: c(`SELECT COUNT(*) v FROM proposals WHERE workspace_id=? AND delivery_mode='test' AND ${cond("sent_at")}`, ...args), won: c(`SELECT COUNT(*) v FROM leads WHERE workspace_id=? AND state='WON' AND ${cond("updated_at")}`, ...args), jobs_created: c(`SELECT COUNT(*) v FROM jobs WHERE workspace_id=? AND ${cond("created_at")}`, ...args), signed_value: c(`SELECT COALESCE(SUM(value),0) v FROM jobs WHERE workspace_id=? AND ${cond("created_at")}`, ...args) }; }; res.json({ this_week: win(thisStart, null), last_week: win(lastStart, thisStart), week_start: thisStart, note: "Event counts by timestamp in each window (Mon–Sun UTC). Won is counted when the lead entered WON (updated_at); signed value sums jobs created in the window." }); });
export const APP_VERSION = "v71.2";
app.get("/api/health/deep", (_req: any, res) => { let dbOk = true; try { db.prepare("SELECT 1").get(); } catch { dbOk = false; } res.json({ ok: dbOk, db: dbOk ? "ok" : "error", version: APP_VERSION, jobs: jobStats(), outbox_pending: outboxPending(), time: now() }); });
app.get("/api/admin/platform", requireAuth, requirePlatformAdmin, (_req: any, res) => { res.json({ workspaces: (db.prepare("SELECT COUNT(*) c FROM workspaces").get() as any).c, users: (db.prepare("SELECT COUNT(*) c FROM users").get() as any).c, jobs: jobStats(), outbox_pending: outboxPending(), dead_jobs: db.prepare("SELECT id, kind, attempts, last_error, created_at FROM background_jobs WHERE status='dead' ORDER BY created_at DESC LIMIT 10").all(), dead_deliveries: (db.prepare("SELECT COUNT(*) c FROM outcome_deliveries WHERE last_status IN ('dead','dead_letter','failed') AND superseded_at IS NULL").get() as any).c }); });
app.post("/api/admin/impersonate", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const target = db.prepare("SELECT * FROM users WHERE id=?").get(String(req.body?.user_id || "")) as any;
  if (!target) return res.status(404).json({ error: { code: "not_found" } });
  if ((target as any).is_platform_admin) return res.status(422).json({ error: { code: "admin_target", message: "Platform admin accounts cannot be impersonated." } });
  const sid = uid("ses"); const exp = new Date(Date.now() + 3600000).toISOString();
  db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at,impersonated_by,impersonation_expires_at) VALUES (?,?,?,?,?,?)").run(sid, target.id, now(), exp, req.user.id, exp);
  audit(target.workspace_id, req.user.id, "impersonation.start", "user", target.id, { admin_email: req.user.email, target_email: target.email, expires_at: exp });
  emitOutbox(target.workspace_id, "admin.impersonation_started", target.id, { admin: req.user.id });
  res.setHeader("Set-Cookie", sessionCookie(req, sid, 3600));
  res.json({ ok: true, impersonating: { user_id: target.id, name: target.name, email: target.email, workspace_id: target.workspace_id, expires_at: exp } });
});
app.post("/api/auth/impersonation/exit", requireAuth, (req: any, res) => {
  const sess = (req as any).session;
  if (!sess?.impersonated_by) return res.status(400).json({ error: { code: "not_impersonating" } });
  const admin = db.prepare("SELECT * FROM users WHERE id=?").get(sess.impersonated_by) as any;
  if (!admin) return res.status(400).json({ error: { code: "admin_gone" } });
  audit(req.user.workspace_id, admin.id, "impersonation.stop", "user", req.user.id, { admin_email: admin.email });
  db.prepare("DELETE FROM sessions WHERE id=?").run(sess.id);
  const sid = uid("ses"); const exp = new Date(Date.now() + 7 * 86400000).toISOString();
  db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, admin.id, now(), exp);
  res.setHeader("Set-Cookie", sessionCookie(req, sid));
  res.json({ ok: true, restored: { user_id: admin.id, name: admin.name } });
});
app.get("/api/admin/workspaces", requireAuth, requirePlatformAdmin, (_req: any, res) => res.json(workspaceHealth()));

// ---------- V34: Platform Console — the operator's master dashboard ----------
// Every mutation is written to platform_audit (which outlives the workspaces
// it describes). The console manages customers (workspaces), their plans and
// trials, suspensions, users and their access — the full CRUD the operator
// needs, none of it available to workspace users.
function pAudit(req: any, action: string, targetType: string, targetId: string | null, workspaceId: string | null, detail: any = {}) {
  try { db.prepare("INSERT INTO platform_audit (id,admin_id,admin_email,action,target_type,target_id,workspace_id,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("paud"), req.user.id, req.user.email, action, targetType, targetId, workspaceId, JSON.stringify(detail), now()); } catch { /* audit must never break the action */ }
}
// Operator exclusivity: when PLATFORM_ADMIN_EMAIL is configured, that
// account is the ONLY platform admin — syncPlatformAdmin grants it and
// revokes everyone else, at boot and again on every sign-in, so the console
// can never quietly accumulate operators. Without it, PLATFORM_ADMIN_EMAILS
// (comma-separated) is honored, and if no admin exists at all the first
// account is flagged so a fresh host is reachable.
// V40 one-time default flip (his directive: every proposal is approved by
// the owner or ops director before it sends). Workspaces still carrying the
// untouched v3 default ('amount' at the stock $25k threshold) move to
// 'always'; a workspace that deliberately chose a policy/threshold keeps it.
// Guarded by app_migrations so it can only ever run once.
try { db.exec("CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT)"); const done = db.prepare("SELECT name FROM app_migrations WHERE name='v40_approval_default'").get(); if (!done) { db.prepare("UPDATE workspaces SET approval_policy='always' WHERE approval_policy='amount' AND COALESCE(approval_threshold, 25000) = 25000").run(); db.prepare("INSERT INTO app_migrations (name, applied_at) VALUES ('v40_approval_default', ?)").run(now()); } } catch { /* marker table unavailable: skip rather than break boot */ }
export function syncPlatformAdmin() {
  try {
    const op = String(process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
    if (op) {
      db.prepare("UPDATE users SET is_platform_admin=0 WHERE email<>?").run(op);
      db.prepare("UPDATE users SET is_platform_admin=1 WHERE email=?").run(op);
      return;
    }
    for (const e of String(process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean)) db.prepare("UPDATE users SET is_platform_admin=1 WHERE email=?").run(e);
    const anyAdmin = (db.prepare("SELECT COUNT(*) c FROM users WHERE is_platform_admin=1").get() as any).c;
    if (!anyAdmin) { const first = db.prepare("SELECT id FROM users ORDER BY rowid ASC LIMIT 1").get() as any; if (first) db.prepare("UPDATE users SET is_platform_admin=1 WHERE id=?").run(first.id); }
  } catch { /* schema not ready yet */ }
}
syncPlatformAdmin();

app.get("/api/admin/overview", requireAuth, requirePlatformAdmin, (_req: any, res) => {
  const c = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any)?.c || 0;
  const subs = db.prepare("SELECT plan, status FROM subscriptions").all() as any[];
  let mrr = 0; for (const s of subs) if (s.status === "active") mrr += (planOf(s.plan).annual_price || 0) / 12;
  const soon = new Date(Date.now() + 7 * 86400000).toISOString();
  res.json({
    workspaces: c("SELECT COUNT(*) c FROM workspaces"), users: c("SELECT COUNT(*) c FROM users"),
    paying: subs.filter(s => s.status === "active").length, trialing: subs.filter(s => s.status === "trialing").length,
    past_due: subs.filter(s => s.status === "past_due").length, suspended: c("SELECT COUNT(*) c FROM workspaces WHERE suspended=1"),
    mrr_estimate: Math.round(mrr * 100) / 100,
    signups_30d: c("SELECT COUNT(*) c FROM workspaces WHERE created_at>=?", new Date(Date.now() - 30 * 86400000).toISOString()),
    trials_expiring_7d: c("SELECT COUNT(*) c FROM subscriptions WHERE status='trialing' AND current_period_end>? AND current_period_end<?", now(), soon),
    disabled_users: c("SELECT COUNT(*) c FROM users WHERE disabled=1"),
  });
});

function customerRow(w: any) {
  const sub = db.prepare("SELECT * FROM subscriptions WHERE workspace_id=?").get(w.id) as any;
  const owner = db.prepare("SELECT u.name, u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.role='OWNER' ORDER BY m.created_at LIMIT 1").get(w.id) as any;
  const n = (sql: string) => (db.prepare(sql).get(w.id) as any)?.c || 0;
  const lastLead = (db.prepare("SELECT MAX(created_at) m FROM leads WHERE workspace_id=?").get(w.id) as any)?.m;
  const lastJob = (db.prepare("SELECT MAX(created_at) m FROM jobs WHERE workspace_id=?").get(w.id) as any)?.m;
  return { id: w.id, name: w.name, vertical: w.vertical, created_at: w.created_at, suspended: !!w.suspended,
    owner: owner || null, plan: sub ? planOf(sub.plan).key : planOf(w.plan).key, sub_status: sub?.status || "none", source: sub?.stripe_subscription_id ? "stripe" : (sub?.source === "manual" ? "manual" : null),
    trial_ends_at: w.trial_ends_at || sub?.current_period_end || null, current_period_end: sub?.current_period_end || null,
    stripe_customer_id: sub?.stripe_customer_id || null, stripe_subscription_id: sub?.stripe_subscription_id || null,
    users: n("SELECT COUNT(*) c FROM memberships WHERE workspace_id=?"), leads: n("SELECT COUNT(*) c FROM leads WHERE workspace_id=?"),
    jobs: n("SELECT COUNT(*) c FROM jobs WHERE workspace_id=?"), signed_value: (db.prepare("SELECT COALESCE(SUM(value),0) v FROM jobs WHERE workspace_id=?").get(w.id) as any)?.v || 0,
    last_activity: [lastLead, lastJob, w.created_at].filter(Boolean).sort().slice(-1)[0] || w.created_at };
}
app.get("/api/admin/customers", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const q = String(req.query.q || "").toLowerCase();
  let rows = (db.prepare("SELECT * FROM workspaces ORDER BY created_at DESC").all() as any[]).map(customerRow);
  if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.owner?.email || "").toLowerCase().includes(q) || (r.owner?.name || "").toLowerCase().includes(q));
  res.json(rows);
});
app.get("/api/admin/customers/:id", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.params.id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  const users = db.prepare("SELECT u.id, u.name, u.email, m.role, u.disabled, u.is_platform_admin, m.created_at AS joined_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY m.created_at").all(w.id);
  const activity = db.prepare("SELECT action, entity, entity_id, created_at FROM audit_log WHERE workspace_id=? ORDER BY created_at DESC LIMIT 15").all(w.id);
  const admin_actions = db.prepare("SELECT admin_email, action, detail, created_at FROM platform_audit WHERE workspace_id=? ORDER BY created_at DESC LIMIT 15").all(w.id);
  res.json({ ...customerRow(w), users, activity, admin_actions });
});
app.post("/api/admin/customers/:id/plan", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.params.id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  const rawPlan = String(req.body?.plan || "");
  if (!PLANS[rawPlan] && !PLAN_ALIASES[rawPlan]) return res.status(422).json({ error: { code: "bad_plan" } });
  const plan = planOf(rawPlan).key;
  const sub = ensureSubscription(w.id);
  db.prepare("UPDATE subscriptions SET plan=?, status='active', source=?, updated_at=? WHERE workspace_id=?").run(plan, sub.stripe_subscription_id ? "stripe" : "manual", now(), w.id);
  db.prepare("UPDATE workspaces SET plan=? WHERE id=?").run(plan, w.id);
  pAudit(req, "customer.plan_changed", "workspace", w.id, w.id, { plan, via: sub.stripe_subscription_id ? "stripe-linked" : "manual comp" });
  res.json(customerRow(db.prepare("SELECT * FROM workspaces WHERE id=?").get(w.id)));
});
app.post("/api/admin/customers/:id/trial", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.params.id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  const days = Math.max(1, Math.min(365, Number(req.body?.days || 30)));
  const sub = ensureSubscription(w.id);
  if (sub.status === "active" && sub.stripe_subscription_id) return res.status(422).json({ error: { code: "paying_customer", message: "This customer has a live Stripe subscription — manage the trial in Stripe." } });
  const base = Math.max(Date.now(), new Date(sub.current_period_end || w.trial_ends_at || 0).getTime() || 0);
  const end = new Date(base + days * 86400000).toISOString();
  db.prepare("UPDATE subscriptions SET status='trialing', current_period_end=?, updated_at=? WHERE workspace_id=?").run(end, now(), w.id);
  db.prepare("UPDATE workspaces SET trial_ends_at=? WHERE id=?").run(end, w.id);
  pAudit(req, "customer.trial_extended", "workspace", w.id, w.id, { days, new_end: end });
  res.json(customerRow(db.prepare("SELECT * FROM workspaces WHERE id=?").get(w.id)));
});
app.post("/api/admin/customers/:id/suspend", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.params.id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  const on = !!req.body?.suspended;
  db.prepare("UPDATE workspaces SET suspended=? WHERE id=?").run(on ? 1 : 0, w.id);
  pAudit(req, on ? "customer.suspended" : "customer.reactivated", "workspace", w.id, w.id, {});
  res.json(customerRow(db.prepare("SELECT * FROM workspaces WHERE id=?").get(w.id)));
});
app.delete("/api/admin/customers/:id", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.params.id) as any;
  if (!w) return res.status(404).json({ error: { code: "not_found" } });
  if (w.id === req.user.workspace_id) return res.status(422).json({ error: { code: "own_workspace", message: "You are currently inside this workspace — switch to another workspace before deleting it." } });
  pAudit(req, "customer.deleted", "workspace", w.id, w.id, { name: w.name });
  const memberIds = (db.prepare("SELECT user_id FROM memberships WHERE workspace_id=?").all(w.id) as any[]).map(r => r.user_id);
  let removed = 0;
  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    for (const t of tables) {
      if (t.name === "platform_audit") continue; // the operator's ledger outlives the workspace by design
      const cols = (db.prepare(`PRAGMA table_info(${t.name})`).all() as any[]).map(c => c.name);
      if (cols.includes("workspace_id")) { const r = db.prepare(`DELETE FROM ${t.name} WHERE workspace_id=?`).run(w.id) as any; removed += Number(r.changes || 0); }
    }
    // users whose only home this was: drop their sessions + accounts;
    // members with other workspaces keep their accounts (re-homed below).
    for (const uidX of memberIds) {
      const left = (db.prepare("SELECT COUNT(*) c FROM memberships WHERE user_id=?").get(uidX) as any).c;
      const u = db.prepare("SELECT workspace_id FROM users WHERE id=?").get(uidX) as any;
      if (left === 0) { db.prepare("DELETE FROM sessions WHERE user_id=?").run(uidX); db.prepare("DELETE FROM users WHERE id=?").run(uidX); }
      else if (u?.workspace_id === w.id) { const m = db.prepare("SELECT workspace_id, role FROM memberships WHERE user_id=? LIMIT 1").get(uidX) as any; db.prepare("UPDATE users SET workspace_id=?, role=? WHERE id=?").run(m.workspace_id, m.role, uidX); }
    }
    db.prepare("DELETE FROM workspaces WHERE id=?").run(w.id);
    db.exec("COMMIT");
  } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; } finally { db.exec("PRAGMA foreign_keys=ON"); }
  res.json({ ok: true, deleted_rows: removed });
});
app.get("/api/admin/users", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const q = String(req.query.q || "").toLowerCase();
  let rows = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.disabled, u.is_platform_admin, u.workspace_id, w.name AS workspace_name, (SELECT COUNT(*) FROM memberships m WHERE m.user_id=u.id) AS workspaces FROM users u LEFT JOIN workspaces w ON w.id=u.workspace_id ORDER BY u.rowid DESC`).all() as any[];
  if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  res.json(rows.map(r => ({ ...r, disabled: !!r.disabled, is_platform_admin: !!r.is_platform_admin })));
});
app.post("/api/admin/users/:id/disable", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id) as any;
  if (!u) return res.status(404).json({ error: { code: "not_found" } });
  if (u.id === req.user.id) return res.status(422).json({ error: { code: "self_action", message: "You cannot disable your own account." } });
  const on = !!req.body?.disabled;
  db.prepare("UPDATE users SET disabled=? WHERE id=?").run(on ? 1 : 0, u.id);
  if (on) db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
  pAudit(req, on ? "user.disabled" : "user.enabled", "user", u.id, u.workspace_id, { email: u.email });
  res.json({ ok: true, disabled: on });
});
app.post("/api/admin/users/:id/platform-admin", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id) as any;
  if (!u) return res.status(404).json({ error: { code: "not_found" } });
  const on = !!req.body?.on;
  if (!on && u.id === req.user.id) return res.status(422).json({ error: { code: "self_action", message: "You cannot revoke your own platform admin access." } });
  db.prepare("UPDATE users SET is_platform_admin=? WHERE id=?").run(on ? 1 : 0, u.id);
  pAudit(req, on ? "user.admin_granted" : "user.admin_revoked", "user", u.id, u.workspace_id, { email: u.email });
  res.json({ ok: true, is_platform_admin: on });
});
app.post("/api/admin/users/:id/role", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id) as any;
  if (!u) return res.status(404).json({ error: { code: "not_found" } });
  const wsId = String(req.body?.workspace_id || u.workspace_id); const role = String(req.body?.role || "");
  if (!["OWNER", "APPROVER", "OPS_ADMIN", "LEAD_OWNER", "PM"].includes(role)) return res.status(422).json({ error: { code: "bad_role" } });
  const m = db.prepare("SELECT * FROM memberships WHERE user_id=? AND workspace_id=?").get(u.id, wsId) as any;
  if (!m) return res.status(404).json({ error: { code: "not_a_member" } });
  db.prepare("UPDATE memberships SET role=? WHERE user_id=? AND workspace_id=?").run(role, u.id, wsId);
  if (u.workspace_id === wsId) db.prepare("UPDATE users SET role=? WHERE id=?").run(role, u.id);
  pAudit(req, "user.role_changed", "user", u.id, wsId, { email: u.email, role });
  res.json({ ok: true, role });
});
app.delete("/api/admin/users/:id", requireAuth, requirePlatformAdmin, (req: any, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id) as any;
  if (!u) return res.status(404).json({ error: { code: "not_found" } });
  if (u.id === req.user.id) return res.status(422).json({ error: { code: "self_action" } });
  const sole = db.prepare("SELECT m.workspace_id FROM memberships m WHERE m.user_id=? AND m.role='OWNER' AND (SELECT COUNT(*) FROM memberships x WHERE x.workspace_id=m.workspace_id AND x.role='OWNER')=1").all(u.id) as any[];
  if (sole.length) return res.status(422).json({ error: { code: "sole_owner", message: "This user is the only owner of a workspace — transfer ownership or delete that workspace first." } });
  pAudit(req, "user.deleted", "user", u.id, u.workspace_id, { email: u.email });
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM memberships WHERE user_id=?").run(u.id);
  db.prepare("DELETE FROM users WHERE id=?").run(u.id);
  res.json({ ok: true });
});
app.get("/api/admin/subscriptions", requireAuth, requirePlatformAdmin, (_req: any, res) => {
  res.json((db.prepare("SELECT s.*, w.name AS workspace_name FROM subscriptions s JOIN workspaces w ON w.id=s.workspace_id ORDER BY s.created_at DESC").all() as any[]).map(s => ({ ...s, plan: planOf(s.plan).key, source: s.stripe_subscription_id ? "stripe" : (s.source === "manual" ? "manual" : null), monthly_value: s.status === "active" ? Math.round(((planOf(s.plan).annual_price || 0) / 12) * 100) / 100 : 0 })));
});
app.get("/api/admin/audit", requireAuth, requirePlatformAdmin, (_req: any, res) => res.json(db.prepare("SELECT * FROM platform_audit ORDER BY created_at DESC LIMIT 60").all()));

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
app.get("/api/plans", (_req: any, res) => { res.json({ plans: Object.entries(PLANS).map(([key, p]) => ({ key, ...p, save_pct: p.list_price > 0 ? Math.round((1 - p.annual_price / p.list_price) * 100) : 0 })) }); });
app.get("/api/billing", requireAuth, needPerm("can_billing"), (req: any, res) => res.json({ ...billingStatus(req.user.workspace_id), plans: PLANS }));
app.post("/api/billing/checkout", requireAuth, needPerm("can_billing"), async (req: any, res) => { const base = `${req.protocol}://${req.get("host")}`; res.json(await createCheckout(req.user.workspace_id, req.body.plan, base, req.body.period === "monthly" ? "monthly" : "annual")); });
app.post("/api/billing/change-plan", requireAuth, needPerm("can_billing"), (req: any, res) => {
  if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only" } });
  if (!PLANS[req.body.plan] && !PLAN_ALIASES[String(req.body.plan || "")]) return res.status(422).json({ error: { code: "unknown_plan" } });
  db.prepare("UPDATE subscriptions SET plan=?, updated_at=? WHERE workspace_id=?").run(planOf(req.body.plan).key, now(), req.user.workspace_id);
  res.json(billingStatus(req.user.workspace_id));
});

// ---------- slice 4: OAuth connections (Gmail / Outlook) ----------
app.get("/api/oauth/status", requireAuth, (req: any, res) => res.json({ google: providerStatus("google"), microsoft: providerStatus("microsoft"), connections: listConnections(req.user.workspace_id) }));
// Microsoft forbids query strings in redirect URIs, so its provider rides
// in the PATH (/api/oauth/callback/microsoft). Google keeps the query form
// its client was registered with. Authorize and token exchange must use
// the exact same string per provider — one helper owns it.
const oauthRedirect = (base: string, provider: string) => provider === "microsoft" ? `${base}/api/oauth/callback/microsoft` : `${base}/api/oauth/callback?provider=${provider}`;
const oauthCallback = async (req: any, res: any) => {
  const code = String(req.query.code || ""); const state = String(req.query.state || "");
  const wsId = state.includes(".") ? state.split(".").slice(1).join(".") : "";
  const prov = String(req.params.provider || req.query.provider || "");
  if (!code || !wsId || !prov) return res.redirect("/app?mail=error");
  try {
    const base = publicBase(req);
    const { exchangeCode, profileEmail } = await import("./mail-sync.ts");
    const tokens = await exchangeCode(prov, code, oauthRedirect(base, prov));
    if (!tokens.refresh_token) return res.redirect("/app?mail=no_refresh");
    const email = (await profileEmail(prov, tokens.access_token)) || "mailbox";
    const { recordConnection } = await import("./oauth.ts");
    recordConnection(wsId, prov, email, tokens.refresh_token);
    res.redirect("/app?mail=connected");
  } catch { res.redirect("/app?mail=error"); }
};
app.get("/api/oauth/callback", oauthCallback);
app.get("/api/oauth/callback/:provider", oauthCallback);
app.get("/api/quickbooks/status", requireAuth, async (req: any, res: any) => { const { qbConfigured, qbConnection } = await import("./quickbooks.ts"); res.json({ configured: qbConfigured(), connection: qbConnection(req.user.workspace_id) || null }); });
app.get("/api/quickbooks/start", requireAuth, async (req: any, res: any) => { const { qbConfigured, qbAuthUrl } = await import("./quickbooks.ts"); if (!qbConfigured()) return res.status(409).json({ error: { code: "provider_not_configured", message: "Register the Intuit app (INTUIT_CLIENT_ID/SECRET) on this deployment to enable QuickBooks." } }); const base = publicBase(req); res.json({ url: qbAuthUrl(req.user.workspace_id, `${base}/api/quickbooks/callback`) }); });
app.get("/api/quickbooks/callback", async (req: any, res: any) => { const code = String(req.query.code || ""); const state = String(req.query.state || ""); const realmId = String(req.query.realmId || "");
  const wsId = state.includes(".") ? state.split(".").slice(1).join(".") : ""; if (!code || !wsId || !realmId) return res.redirect("/app?qb=error");
  try { const { qbExchange } = await import("./quickbooks.ts"); const base = publicBase(req); const tokens = await qbExchange(code, `${base}/api/quickbooks/callback`);
    db.prepare("INSERT INTO quickbooks_connections (workspace_id, realm_id, refresh_token, status, created_at, updated_at) VALUES (?,?,?,'connected',?,?) ON CONFLICT(workspace_id) DO UPDATE SET realm_id=excluded.realm_id, refresh_token=excluded.refresh_token, status='connected', updated_at=excluded.updated_at").run(wsId, realmId, tokens.refresh_token, now(), now());
    res.redirect("/app?qb=connected"); } catch { res.redirect("/app?qb=error"); } });
app.delete("/api/quickbooks", requireAuth, (req: any, res: any) => { db.prepare("UPDATE quickbooks_connections SET status='disconnected', refresh_token=NULL, updated_at=? WHERE workspace_id=?").run(now(), req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/invoices/:id/quickbooks", requireAuth, async (req: any, res: any) => { try { const { pushInvoiceToQb } = await import("./quickbooks.ts"); const r = await pushInvoiceToQb(req.user.workspace_id, req.params.id); res.json({ ok: true, ...r }); } catch (e: any) { res.status(e?.code === "qb_not_connected" ? 409 : e?.code === "not_found" ? 404 : 502).json({ error: { code: e?.code || "qb_push_failed", message: String(e?.message || e) } }); } });
app.get("/api/onboarding/status", requireAuth, (req: any, res: any) => { const w = req.user.workspace_id; const wsr = db.prepare("SELECT * FROM workspaces WHERE id=?").get(w) as any;
  const n = (sql: string, ...p: any[]) => (db.prepare(sql).get(...p) as any)?.n || 0;
  const steps = [
    { key: "profile", label: "Business profile & sender email", done: !!wsr?.from_email, view: "settings" },
    { key: "services", label: "Your services catalog", done: n("SELECT COUNT(*) n FROM services WHERE workspace_id=? AND active=1", w) > 0, view: "settings" },
    { key: "pricebook", label: "At least one priced price-book item", done: n("SELECT COUNT(*) n FROM price_book_items WHERE workspace_id=? AND standard_price>0", w) > 0, view: "settings" },
    { key: "team", label: "Invite your team", done: n("SELECT COUNT(*) n FROM memberships WHERE workspace_id=?", w) > 1, view: "settings" },
    { key: "review", label: "Google review link", done: !!wsr?.review_url, view: "settings" },
    { key: "lead", label: "Your first lead in the pipeline", done: n("SELECT COUNT(*) n FROM leads WHERE workspace_id=?", w) > 0, view: "leads" },
    { key: "playbook", label: "A retention playbook (reviews / referrals)", done: n("SELECT COUNT(*) n FROM campaigns WHERE workspace_id=? AND auto_trigger<>'none'", w) > 0, view: "campaigns" },
    { key: "mailbox", label: "Connect Gmail or Outlook", done: n("SELECT COUNT(*) n FROM oauth_connections WHERE workspace_id=? AND status='connected'", w) > 0, view: "settings" },
  ];
  const done = steps.filter(s => s.done).length;
  res.json({ steps, done, total: steps.length, complete: done === steps.length, pct: Math.round((done / steps.length) * 100) }); });
app.delete("/api/oauth/connections/:id", requireAuth, (req: any, res: any) => { const c = db.prepare("SELECT * FROM oauth_connections WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!c) return res.status(404).json({ error: { code: "not_found" } }); db.prepare("UPDATE oauth_connections SET status='disconnected', token_ref=NULL WHERE id=?").run(c.id); res.json({ ok: true }); });
app.get("/api/oauth/:provider/start", requireAuth, (req: any, res) => {
  const base = publicBase(req);
  const r = authUrl(req.params.provider, req.user.workspace_id, oauthRedirect(base, req.params.provider));
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
  const userId = uid("usr"); db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit) VALUES (?,?,?,?,?,?,?)").run(userId, wsId, name, email, hashPassword(password), "OWNER", 0);
  db.prepare("INSERT INTO memberships (user_id,workspace_id,role,created_at) VALUES (?,?,?,?)").run(userId, wsId, "OWNER", now());
  const sid = uid("ses"); db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, userId, now(), new Date(Date.now() + 7 * 86400000).toISOString());
  res.setHeader("Set-Cookie", sessionCookie(req, sid));
  const vraw = issueAuthToken(userId, "verify", 24);
  queueAndDeliver(wsId, { channel: "email", to: email, subject: "Verify your Workpile email", body: `Welcome to Workpile, ${name}!\n\nConfirm your email: ${req.protocol}://${req.get("host")}/app?verify=${vraw}` }).catch(() => {});
  res.status(201).json({ user: { id: userId, name, email, role: "OWNER", workspace_id: wsId }, workspaces: membershipsOf(userId) });
});
// ---------- social sign-in (v55): Continue with Google / Microsoft ----------
app.get("/api/auth/social/status", (_req: any, res) => res.json({ google: socialConfigured("google"), microsoft: socialConfigured("microsoft"), apple: false }));
const socialFail = (res: any, code: string) => res.redirect(`/app?auth_error=${code}`);
app.get("/api/auth/social/:provider/start", (req: any, res: any) => {
  const prov = String(req.params.provider || "");
  if (!SOCIAL_PROVIDERS[prov]) return socialFail(res, "unknown_provider");
  const b = beginSocial(prov, `${publicBase(req)}/api/auth/social/${prov}/callback`);
  if (!b) return socialFail(res, "not_configured");
  res.setHeader("Set-Cookie", `wp_social_state=${b.state}; HttpOnly; Path=/api/auth/social; Max-Age=600; SameSite=Lax${publicBase(req).startsWith("https") ? "; Secure" : ""}`);
  res.redirect(b.url);
});
app.get("/api/auth/social/:provider/callback", async (req: any, res: any) => {
  const prov = String(req.params.provider || "");
  const clearState = "wp_social_state=; HttpOnly; Path=/api/auth/social; Max-Age=0";
  try {
    if (!SOCIAL_PROVIDERS[prov] || !socialConfigured(prov)) { res.setHeader("Set-Cookie", clearState); return socialFail(res, "not_configured"); }
    if (req.query.error) { res.setHeader("Set-Cookie", clearState); return socialFail(res, "cancelled"); }
    const cookieState = (req.headers.cookie || "").split(";").map((s: string) => s.trim()).find((s: string) => s.startsWith("wp_social_state="))?.split("=").slice(1).join("=") || "";
    const qState = String(req.query.state || "");
    const match = !!cookieState && !!qState && cookieState.length === qState.length && timingSafeEqual(Buffer.from(cookieState), Buffer.from(qState));
    if (!match) { res.setHeader("Set-Cookie", clearState); return socialFail(res, "state_mismatch"); }
    const verifier = consumeSocialState(prov, qState);
    res.setHeader("Set-Cookie", clearState);
    if (!verifier) return socialFail(res, "state_mismatch");
    const code = String(req.query.code || ""); if (!code) return socialFail(res, "cancelled");
    const profile = await exchangeSocial(prov, code, verifier, `${publicBase(req)}/api/auth/social/${prov}/callback`);
    if (!profile.emailVerified) return socialFail(res, "email_unverified");
    const { user } = resolveSocialUser(prov, profile, { workspaceDefaults, ensureSubscription });
    if ((user as any).disabled && !(user as any).is_platform_admin) return socialFail(res, "account_disabled");
    syncPlatformAdmin();
    const sid = uid("ses") + randomBytes(16).toString("hex");
    db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, user.id, now(), new Date(Date.now() + 7 * 86400000).toISOString());
    res.setHeader("Set-Cookie", sessionCookie(req, sid));
    res.redirect("/app");
  } catch { if (!res.headersSent) res.setHeader("Set-Cookie", clearState); return socialFail(res, "failed"); }
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
  if (ws.source_api_url) { // SSRF guard (v17): resolver-grade — every resolved address must be public
    const { assertPublicUrl } = await import("./netguard.ts");
    const chk = await assertPublicUrl(ws.source_api_url);
    if (!chk.ok) return res.status(422).json({ error: { code: "blocked_source_url", message: `Source URL refused: ${(chk as any).error}.` } });
  }
  let rows: any[] = [];
  try { const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: ws.source_api_key ? { Authorization: `Bearer ${ws.source_api_key}` } : {}, signal: AbortSignal.timeout(8000), redirect: "error" }); if (!r.ok) return res.status(502).json({ error: { code: "source_error", message: `Source returned ${r.status}` } }); rows = await r.json(); if (!Array.isArray(rows)) return res.status(502).json({ error: { code: "source_shape", message: "Source must return a JSON array of leads." } }); }
  catch (e: any) { return res.status(502).json({ error: { code: "source_unreachable", message: String(e.message || e) } }); }
  let created = 0, duplicates = 0, errors = 0;
  for (const row of rows) { try { const r = createLead(req.user.workspace_id, req.user.id, { ...row, bulk: true }); r.duplicate ? duplicates++ : created++; } catch { errors++; } }
  const stats = { fetched: rows.length, created, duplicates, errors, from, to, at: now(), source: ws.source_api_url ? "custom" : "demo" };
  db.prepare("UPDATE workspaces SET last_sync_at=?, last_sync_stats=? WHERE id=?").run(stats.at, JSON.stringify(stats), ws.id);
  db.prepare("INSERT INTO imports (id,workspace_id,filename,mapping,totals,status,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("imp"), ws.id, "api-sync", "{}", JSON.stringify({ created, dupes: duplicates }), "committed", now());
  res.json(stats);
});
app.post("/api/ai/cleanup/preview", requireAuth, (req: any, res) => res.json(cleanupPreview(req.user.workspace_id)));
app.post("/api/ai/cleanup/apply", requireAuth, needPerm("can_settings"), (req: any, res) => res.json(cleanupApply(req.user.workspace_id, req.user.id, req.body.actions || [])));
app.post("/api/ai/reactivate", requireAuth, needPerm("can_settings"), (req: any, res) => res.json(reactivateStale(req.user.workspace_id, req.user.id)));

// ---------- slice 8: outbound comms, password reset, notifications ----------
app.get("/api/comms/status", requireAuth, (_req: any, res) => res.json({ email: emailConfigured() ? "configured" : "test_mode", sms: smsConfigured() ? "configured" : "test_mode", note: "Test mode records messages in the outbox without sending — set RESEND_API_KEY / TWILIO_* on the server to go live." }));
app.post("/api/leads/:id/message", requireAuth, async (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  const v = leadView(l); const channel = req.body.channel === "sms" ? "sms" : "email";
  const to = channel === "sms" ? v.contact_phone : v.contact_email;
  if (!to) return res.status(422).json({ error: { code: "no_destination", message: `Lead has no ${channel === "sms" ? "phone" : "email"} on file` } });
  if (channel === "sms" && !l.consent_contact_ok) return res.status(422).json({ error: { code: "consent_required", message: "TCPA: this lead has not consented to text messages" } });
  const { validateAttachRefs } = await import("./comms.ts");
  const refs = channel === "email" ? validateAttachRefs(req.user.workspace_id, req.body.attachments) : [];
  const r: any = await queueAndDeliver(req.user.workspace_id, { lead_id: l.id, channel, to, subject: req.body.subject, body: String(req.body.body || ""), attachments: refs });
  logEvent(req.user.workspace_id, l.id, req.user.id, "message_" + channel, null, null, { status: r.status, to });
  touchLead(req.user.workspace_id, l.id, "message", req.user.id);
  res.status(201).json({ id: r.id, status: r.status, channel, to });
});
app.get("/api/leads/:id/messages", requireAuth, (req: any, res) => { res.json(db.prepare("SELECT * FROM messages_outbox WHERE lead_id=? AND workspace_id=? ORDER BY created_at DESC").all(req.params.id, req.user.workspace_id)); });
app.post("/api/proposals/:id/submit", requireAuth, (req: any, res) => {
  const p = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!p) return res.status(404).json({ error: { code: "not_found" } });
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any;
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  if (!approvalRequiredFor(req.user.workspace_id, p.total || 0, req.user.role)) return res.json({ required: false, note: req.user.role === "OWNER" ? "You are the owner — no approval needed, you can send." : "Workspace policy does not require approval for this proposal." });
  const ap: any = maybeRequestApproval(req.user.workspace_id, req.user.id, l, p);
  const approver = ap?.approver_id ? (db.prepare("SELECT name FROM users WHERE id=?").get(ap.approver_id) as any)?.name : null;
  res.json({ required: true, approval_id: ap?.id || null, approver_name: approver, state: ap?.decision ? ap.decision : "pending" });
});
app.post("/api/leads/:id/proposals/auto-draft", requireAuth, (req: any, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!l) return res.status(404).json({ error: { code: "not_found" } });
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  const r = draftProposalForLead(req.user.workspace_id, l);
  const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(r.proposal_id);
  audit(req.user.workspace_id, req.user.id, "proposal.auto_draft", "proposal", r.proposal_id, { priced: r.priced });
  res.status(201).json({ proposal: p, priced: r.priced });
});
app.post("/api/proposals/:id/send", requireAuth, async (req: any, res) => {
  const p = db.prepare("SELECT * FROM proposals WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any;
  if (!p) return res.status(404).json({ error: { code: "not_found" } });
  const l = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any; const v = leadView(l);
  if (scopeOwn(req.user) && !mine(req.user, l)) return res.status(404).json({ error: { code: "not_found" } });
  // v3 §4.4: the only hard send-gate left is a policy-required approval that hasn't happened
  if (approvalRequiredFor(req.user.workspace_id, p.total || 0, req.user.role) && !approvedApprovalFor(req.user.workspace_id, p.id)) {
    const pend = maybeRequestApproval(req.user.workspace_id, req.user.id, l, p);
    return res.status(422).json({ error: { code: "approval_required", message: `Workspace policy requires approval before sending a $${p.total} proposal — it's in the approver's queue now.`, approval_id: pend?.id || null } });
  }
  // target §9.3: approval binds to an immutable version — a material change since approval invalidates it
  const __appr = approvedApprovalFor(req.user.workspace_id, p.id);
  if (__appr && __appr.content_hash && proposalContentHash(p) !== __appr.content_hash) {
    const nid = uid("apr");
    db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)").run(nid, req.user.workspace_id, l.id, p.id, req.user.id, __appr.approver_id, __appr.tier || "manager", now());
    notify(req.user.workspace_id, [String(__appr.approver_id)], "approval.requested", "Proposal changed since approval", `${v.contact_name || "Lead"} — the proposal was edited after your approval, so it needs a fresh decision before it can send.`, l.id);
    return res.status(422).json({ error: { code: "approval_invalidated", message: "This proposal changed after it was approved. It has been resubmitted for a fresh approval — it cannot send until the new decision lands.", approval_id: nid } });
  }
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
  // Business integrity: a proposal is "sent" only when a delivery actually happened (or test mode, labeled).
  if (r.status === "suppressed") return res.status(422).json({ error: { code: "suppressed", message: `This ${channel} address is on the workspace suppression list — the proposal was NOT sent. Remove the suppression in Automations if this is a mistake.` } });
  if (!["sent", "delivered", "test_mode"].includes(r.status)) return res.status(502).json({ error: { code: "delivery_failed", message: `Delivery failed (status: ${r.status}) — the proposal was NOT marked sent and no follow-ups were scheduled. Fix the channel and retry.` } });
  db.prepare("UPDATE proposals SET status='sent', sent_at=? WHERE id=?").run(now(), p.id);
  db.prepare("UPDATE proposals SET delivery_mode=? WHERE id=?").run(r.status === "test_mode" ? "test" : "live", p.id);
  supersedePriorProposals(req.user.workspace_id, l.id, p.id, true);
  emitOutbox(req.user.workspace_id, "proposal.sent", p.id, { lead_id: l.id, total: p.total, channel });
  if (["NEW", "WORKING", "QUALIFIED", "PROPOSAL"].includes(l.state)) setStage(req.user.workspace_id, req.user.id, l, "SENT");
  enrollFollowup(req.user.workspace_id, l.id, p.id);
  logEvent(req.user.workspace_id, l.id, req.user.id, "proposal_sent", null, null, { channel, status: r.status });
  res.status(201).json({ status: r.status, channel, to, sign_link: link });
});
app.get("/api/notifications", requireAuth, (req: any, res) => {
  const rows = (db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50").all(req.user.id) as any[]).map((r: any) => ({ ...r, kind: r.type }));
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
  db.prepare(`UPDATE leads SET ${sets.join(",")} WHERE id=?`).run(to, now(), ...(Object.values(extra) as any[]), l.id);
  const updated = db.prepare("SELECT * FROM leads WHERE id=?").get(l.id) as any;
  logEvent(req.workspace_id, l.id, "api", "state_changed", l.state, to, { origin: "api_outcome_push" });
  finalizeLead(req.workspace_id, "api", updated, to);
  if (to === "WON") ensureJobForLead(req.workspace_id, "api", updated);
  emitEvent(req.workspace_id, "lead.state_changed", { lead_id: l.id, from_state: l.state, to_state: to, origin: "api" });
  res.json({ ok: true, lead_id: l.id, state: to, origin: "api" });
});
app.post("/v1/inbox", requireApiKey(["leads:write"]), (req: any, res) => {
  const e = req.body; const parsed = parseEmail(e);
  if (parsed.is_lead) { const r = createLead(req.workspace_id, "inbox-api", { contact: { name: e.from_name || "", phone: parsed.phone, email: e.from_email || "" }, service_requested: "", message: `${e.subject || ""}\n${e.body || ""}`, source: "email-api", created_at: e.received_at }); return res.status(201).json({ category: "lead", lead_id: r.lead.id, duplicate: r.duplicate }); }
  const id = uid("inb"); db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at,lead_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, req.workspace_id, parsed.category, e.from_name || "", e.from_email || "", e.subject || "", e.body || "", null, new Date(Date.now() + 86400000).toISOString(), e.received_at || now(), now(), leadIdForEmail(req.workspace_id, e.from_email || ""));
  res.status(201).json({ category: parsed.category, inbox_item_id: id });
});
app.get("/openapi.json", (_req: any, res) => res.json(OPENAPI_SPEC));
app.post("/api/integrations/slack/test", requireAuth, async (req: any, res) => {
  const ws = db.prepare("SELECT slack_webhook_url FROM workspaces WHERE id=?").get(req.user.workspace_id) as any;
  if (!ws?.slack_webhook_url) return res.status(400).json({ error: { code: "no_slack_url", message: "Save a Slack webhook URL first" } });
  const { assertPublicUrl } = await import("./netguard.ts");
  let hostOk = false; try { hostOk = new URL(ws.slack_webhook_url).hostname === "hooks.slack.com"; } catch { hostOk = false; }
  if (!hostOk) return res.status(422).json({ error: { code: "blocked_url", message: "Slack webhooks must be on hooks.slack.com." } });
  const chkS = await assertPublicUrl(ws.slack_webhook_url); if (!chkS.ok) return res.status(422).json({ error: { code: "blocked_url", message: (chkS as any).error } });
  try { const r = await fetch(ws.slack_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "✅ Workpile test message — Slack notifications are connected." }), redirect: "error" }); res.json({ ok: r.ok, status: r.status }); }
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
    { id: "email_sending", name: "Email Sending (your domain)", status: ws.from_email ? (process.env.RESEND_API_KEY ? "connected" : "test_mode") : "not_configured", detail: ws.from_email ? `Sending as ${ws.from_name || ws.name} <${ws.from_email}> — domain verification decides live delivery.` : "Send from YOUR company email/domain instead of ours. Step-by-step guide inside." },
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
  if (req.body.owner_id) touchLead(req.user.workspace_id, l.id, "assign", req.user.id);
  audit(req.user.workspace_id, req.user.id, "lead.edit", "lead", l.id, req.body);
  res.json({ lead: leadView(db.prepare("SELECT * FROM leads WHERE id=?").get(l.id)) });
});
app.post("/api/tasks", requireAuth, (req: any, res) => { const id = uid("tsk"); db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.lead_id || null, req.body.assignee_id || req.user.id, req.body.type || "follow_up", req.body.title || "Follow up", req.body.due_at || new Date(Date.now() + 86400000).toISOString(), "open", now()); if (req.body.lead_id) touchLead(req.user.workspace_id, req.body.lead_id, "task", req.user.id); res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id=?").get(id)); });
app.delete("/api/tasks/:id", requireAuth, (req: any, res) => { db.prepare("DELETE FROM tasks WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/leads/:id/visits", requireAuth, (req: any, res) => { const id = uid("vis"); db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.params.id, req.body.assigned_to || null, req.body.scheduled_at, "scheduled", req.body.notes || "");
  // Mirror onto the job's crew schedule so a visit booked from a job also shows
  // in the schedule log (the two lists confused everyone as separate systems).
  const job = db.prepare("SELECT id FROM jobs WHERE workspace_id=? AND lead_id=? AND stage<>'CANCELLED' ORDER BY created_at DESC LIMIT 1").get(req.user.workspace_id, req.params.id) as any;
  if (job) { const lead = db.prepare("SELECT pm_id FROM leads WHERE id=?").get(req.params.id) as any; const who = req.body.assigned_to || lead?.pm_id || req.user.id; const date = String(req.body.scheduled_at || "").slice(0, 10); if (date) db.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,worker_id,work_date,note,created_by,created_at) VALUES (?,?,?,?,NULL,?,?,?,?)").run(uid("sch"), req.user.workspace_id, req.params.id, who, date, "📍 Site visit", req.user.id, now()); }
  res.status(201).json(db.prepare("SELECT * FROM site_visits WHERE id=?").get(id)); });
app.patch("/api/site-visits/:id", requireAuth, (req: any, res) => { const v = db.prepare("SELECT * FROM site_visits WHERE id=? AND workspace_id=?").get(req.params.id, req.user.workspace_id) as any; if (!v) return res.status(404).json({ error: { code: "not_found" } }); const st = String(req.body.status || ""); if (!["scheduled", "completed", "cancelled", "no_show"].includes(st)) return res.status(422).json({ error: { code: "bad_status" } }); db.prepare("UPDATE site_visits SET status=? WHERE id=?").run(st, v.id); res.json(db.prepare("SELECT * FROM site_visits WHERE id=?").get(v.id)); });
app.post("/api/leads/:id/documents", requireAuth, (req: any, res) => { const id = uid("doc"); db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.params.id, req.body.name, req.body.required ? 1 : 0, req.body.status || "missing"); res.status(201).json(db.prepare("SELECT * FROM documents WHERE id=?").get(id)); });
app.patch("/api/documents/:id", requireAuth, (req: any, res) => { if (req.body.expires_at !== undefined) db.prepare("UPDATE documents SET expires_at=? WHERE id=? AND workspace_id=?").run(req.body.expires_at || null, req.params.id, req.user.workspace_id); if (req.body.status !== undefined) db.prepare("UPDATE documents SET status=?, received_at=? WHERE id=? AND workspace_id=?").run(req.body.status, req.body.status === "received" ? now() : null, req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Price book / templates / services CRUD
app.post("/api/price-book", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("pb"); db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.service_id || null, req.body.name, req.body.unit || "job", req.body.standard_price || 0, req.body.floor_price || 0); res.status(201).json(db.prepare("SELECT * FROM price_book_items WHERE id=?").get(id)); });
app.patch("/api/price-book/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { const b = req.body; db.prepare("UPDATE price_book_items SET name=COALESCE(?,name), unit=COALESCE(?,unit), standard_price=COALESCE(?,standard_price), floor_price=COALESCE(?,floor_price) WHERE id=? AND workspace_id=?").run(b.name ?? null, b.unit ?? null, b.standard_price ?? null, b.floor_price ?? null, req.params.id, req.user.workspace_id); res.json(db.prepare("SELECT * FROM price_book_items WHERE id=?").get(req.params.id)); });
app.delete("/api/price-book/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM price_book_items WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.post("/api/templates", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("tpl"); db.prepare("INSERT INTO templates (id,workspace_id,service_id,kind,name,body,version,active) VALUES (?,?,?,?,?,?,1,1)").run(id, req.user.workspace_id, req.body.service_id || null, req.body.kind || "proposal", req.body.name, req.body.body || ""); res.status(201).json(db.prepare("SELECT * FROM templates WHERE id=?").get(id)); });
app.patch("/api/templates/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { const b = req.body; db.prepare("UPDATE templates SET name=COALESCE(?,name), body=COALESCE(?,body), active=COALESCE(?,active), version=version+1 WHERE id=? AND workspace_id=?").run(b.name ?? null, b.body ?? null, b.active === undefined ? null : (b.active ? 1 : 0), req.params.id, req.user.workspace_id); res.json(db.prepare("SELECT * FROM templates WHERE id=?").get(req.params.id)); });
app.delete("/api/templates/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("DELETE FROM templates WHERE id=? AND workspace_id=?").run(req.params.id, req.user.workspace_id); res.json({ ok: true }); });
app.get("/api/services", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM services WHERE workspace_id=?").all(req.user.workspace_id)));
app.get("/api/services/stats", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id;
  const svcs = db.prepare("SELECT * FROM services WHERE workspace_id=? ORDER BY name").all(ws) as any[];
  const FIN = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];
  const leadAgg = new Map<string, any>();
  for (const r of db.prepare("SELECT service_requested, COUNT(*) n, SUM(CASE WHEN state='WON' THEN 1 ELSE 0 END) won, SUM(CASE WHEN state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') THEN est_value ELSE 0 END) pipe, SUM(CASE WHEN state='WON' THEN est_value ELSE 0 END) won_value FROM leads WHERE workspace_id=? GROUP BY service_requested").all(ws) as any[]) leadAgg.set(String(r.service_requested || "").trim().toLowerCase(), r);
  const jobAgg = new Map<string, number>();
  for (const r of db.prepare("SELECT l.service_requested s, COUNT(*) n FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.workspace_id=? AND j.stage<>'CANCELLED' GROUP BY l.service_requested").all(ws) as any[]) jobAgg.set(String(r.s || "").trim().toLowerCase(), r.n);
  const pbAgg = new Map<string, any>();
  for (const r of db.prepare("SELECT service_id, COUNT(*) n, SUM(CASE WHEN standard_price>0 THEN 1 ELSE 0 END) priced FROM price_book_items WHERE workspace_id=? GROUP BY service_id").all(ws) as any[]) pbAgg.set(r.service_id, r);
  res.json(svcs.map(s => { const k = String(s.name || "").trim().toLowerCase(); const la = leadAgg.get(k) || { n: 0, won: 0, pipe: 0, won_value: 0 }; const decided = (leadAgg.get(k)?.won || 0); const pb = pbAgg.get(s.id) || { n: 0, priced: 0 };
    const lostN = (db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND service_requested=? AND state IN ('LOST','NO_RESPONSE','UNSERVICEABLE')").get(ws, s.name) as any)?.c || 0;
    return { ...s, leads: la.n || 0, won: la.won || 0, lost: lostN, win_rate: (la.won + lostN) > 0 ? Math.round(1000 * la.won / (la.won + lostN)) / 10 : null, pipeline: la.pipe || 0, won_value: la.won_value || 0, avg_won: la.won ? Math.round((la.won_value || 0) / la.won) : 0, jobs: jobAgg.get(k) || 0, price_items: pb.n || 0, price_priced: pb.priced || 0 }; }));
});
app.post("/api/services", requireAuth, needPerm("can_settings"), (req: any, res) => { const id = uid("svc"); db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,1,?)").run(id, req.user.workspace_id, req.body.name, req.body.is_catalog === false ? 0 : 1); res.status(201).json(db.prepare("SELECT * FROM services WHERE id=?").get(id)); });
app.patch("/api/services/:id", requireAuth, needPerm("can_settings"), (req: any, res) => { db.prepare("UPDATE services SET name=COALESCE(?,name), active=COALESCE(?,active), cycle_months=COALESCE(?,cycle_months) WHERE id=? AND workspace_id=?").run(req.body.name ?? null, req.body.active === undefined ? null : (req.body.active ? 1 : 0), req.body.cycle_months === undefined ? null : Math.max(0, Math.round(Number(req.body.cycle_months) || 0)), req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Team CRUD
app.post("/api/users", requireAuth, (req: any, res) => { if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "owner_or_admin" } });
  const sc = seatCheck(req.user.workspace_id);
  if (!sc.ok) return res.status(422).json({ error: { code: "seat_limit", message: `Your ${sc.plan} plan includes ${sc.limit} office user${sc.limit === 1 ? "" : "s"} and all ${sc.used} are in use. Upgrade the plan in Billing to add more people — field crew on the roster never count.` } }); const id = uid("usr"); db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,approval_limit) VALUES (?,?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.name, req.body.email, hashPassword(req.body.password || "changeme123"), req.body.role || "LEAD_OWNER", req.body.approval_limit || 0); res.status(201).json({ id, name: req.body.name, email: req.body.email, role: req.body.role || "LEAD_OWNER" }); });
app.patch("/api/users/:id", requireAuth, (req: any, res) => { if (!["OWNER", "ADMIN"].includes(req.user.role)) return res.status(403).json({ error: { code: "owner_or_admin" } }); db.prepare("UPDATE users SET role=COALESCE(?,role), approval_limit=COALESCE(?,approval_limit), active=COALESCE(?,active) WHERE id=? AND workspace_id=?").run(req.body.role ?? null, req.body.approval_limit ?? null, req.body.active === undefined ? null : (req.body.active ? 1 : 0), req.params.id, req.user.workspace_id); res.json({ ok: true }); });

// Workspace settings
const WS_DTO = ["id","name","vertical","timezone","tz","plan","logo_data","agent_level","autonomy_level","quiet_start","quiet_end","deposit_pct","trial_ends_at","booking_slug","booking_enabled","from_name","from_email","reply_email","approval_policy","approval_threshold","business_hours","created_at","last_sync_at","sync_enabled","auto_score","auto_assign","auto_dedupe","auto_reactivate","followup_enabled","followup_steps","cadence_paused","review_url","review_on_won","missed_call_text","pt_company","pt_tagline","pt_intro","pt_terms","pt_footer","pt_contact","pt_address","pt_version","pt_at","llm_provider","llm_model"];
function wsSettingsDto(wRow: any) { const ws: any = {}; for (const k of WS_DTO) ws[k] = (wRow as any)[k] ?? null; ws.has_source_api_url = !!wRow.source_api_url; try { ws.source_api_host = wRow.source_api_url ? new URL(wRow.source_api_url).host : null; } catch { ws.source_api_host = null; } ws.has_slack_webhook = !!wRow.slack_webhook_url; ws.has_source_api_key = !!wRow.source_api_key; return ws; }
app.get("/api/settings", requireAuth, (req: any, res) => { const wRow: any = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id); if (wRow) wRow.booking_slug = ensureBookingSlug(wRow); const ws: any = wsSettingsDto(wRow); const counts = db.prepare("SELECT (SELECT COUNT(*) FROM leads WHERE workspace_id=?) leads, (SELECT COUNT(*) FROM users WHERE workspace_id=?) users, (SELECT COUNT(*) FROM price_book_items WHERE workspace_id=?) price_items").get(req.user.workspace_id, req.user.workspace_id, req.user.workspace_id); res.json({ workspace: ws, counts }); });
app.patch("/api/settings", requireAuth, needPerm("can_settings"), (req: any, res) => { if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only" } }); const b = req.body; db.prepare("UPDATE workspaces SET name=COALESCE(?,name), vertical=COALESCE(?,vertical), timezone=COALESCE(?,timezone), deposit_pct=COALESCE(?,deposit_pct), autonomy_level=COALESCE(?,autonomy_level), source_api_url=COALESCE(?,source_api_url), source_api_key=COALESCE(?,source_api_key), sync_enabled=COALESCE(?,sync_enabled), slack_webhook_url=COALESCE(?,slack_webhook_url), from_name=COALESCE(?,from_name), from_email=COALESCE(?,from_email), reply_email=COALESCE(?,reply_email), followup_enabled=COALESCE(?,followup_enabled), followup_steps=COALESCE(?,followup_steps), review_url=COALESCE(?,review_url), review_on_won=COALESCE(?,review_on_won), booking_enabled=COALESCE(?,booking_enabled) WHERE id=?").run(b.name ?? null, b.vertical ?? null, b.timezone ?? null, b.deposit_pct ?? null, b.autonomy_level ?? null, b.source_api_url ?? null, b.source_api_key ?? null, b.sync_enabled === undefined ? null : (b.sync_enabled ? 1 : 0), b.slack_webhook_url ?? null, b.from_name ?? null, b.from_email ?? null, b.reply_email ?? null, b.followup_enabled === undefined ? null : (b.followup_enabled ? 1 : 0), b.followup_steps === undefined ? null : JSON.stringify(b.followup_steps), b.review_url ?? null, b.review_on_won === undefined ? null : (b.review_on_won ? 1 : 0), b.booking_enabled === undefined ? null : (b.booking_enabled ? 1 : 0), req.user.workspace_id); if (b.approval_policy !== undefined || b.approval_threshold !== undefined || b.business_hours !== undefined) db.prepare("UPDATE workspaces SET approval_policy=COALESCE(?,approval_policy), approval_threshold=COALESCE(?,approval_threshold), business_hours=COALESCE(?,business_hours) WHERE id=?").run(b.approval_policy ?? null, b.approval_threshold ?? null, b.business_hours ? JSON.stringify(b.business_hours) : null, req.user.workspace_id); if (b.missed_call_text !== undefined) db.prepare("UPDATE workspaces SET missed_call_text=? WHERE id=?").run(b.missed_call_text ? String(b.missed_call_text).slice(0, 300) : null, req.user.workspace_id); res.json({ workspace: wsSettingsDto(db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id)) }); });

// API keys management
const API_KEY_SCOPES = ["leads:read", "leads:write", "outcomes:read", "projects:read", "jobs:read", "jobs:write"];
app.get("/api/api-keys", requireAuth, (req: any, res) => { if (!permsOf(req.user).can_settings) return res.status(403).json({ error: { code: "forbidden", message: "API keys are managed by workspace admins (can_settings)." } }); res.json(db.prepare("SELECT id,label,scopes,last_used_at,revoked_at,created_at FROM api_keys WHERE workspace_id=?").all(req.user.workspace_id)); });
app.post("/api/api-keys", requireAuth, (req: any, res) => { if (!permsOf(req.user).can_settings) return res.status(403).json({ error: { code: "forbidden", message: "API keys are managed by workspace admins (can_settings)." } }); if (!planOf(ensureSubscription(req.user.workspace_id).plan).features.api) return res.status(422).json({ error: { code: "plan_feature", message: "API keys are a Pro feature — upgrade the workspace plan to issue integration keys." } }); const asked = String(req.body.scopes || "leads:write outcomes:read projects:read").split(/\s+/).filter(Boolean); const bad = asked.filter(x => !API_KEY_SCOPES.includes(x)); if (bad.length) return res.status(422).json({ error: { code: "bad_scopes", message: `Unknown scopes: ${bad.join(", ")}. Allowed: ${API_KEY_SCOPES.join(", ")}` } }); const raw = "lf_" + randomBytes(18).toString("hex"); const id = uid("key"); db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes,created_at) VALUES (?,?,?,?,?,?)").run(id, req.user.workspace_id, req.body.label || "Integration key", apiKeyHash(raw), asked.join(" "), now()); audit(req.user.workspace_id, req.user.id, "apikey.created", "api_key", id, { label: req.body.label || "Integration key", scopes: asked }); res.status(201).json({ id, key: raw, note: "Shown once — store it in your system's secret manager." }); });
app.delete("/api/api-keys/:id", requireAuth, (req: any, res) => { if (!permsOf(req.user).can_settings) return res.status(403).json({ error: { code: "forbidden", message: "API keys are managed by workspace admins (can_settings)." } }); db.prepare("UPDATE api_keys SET revoked_at=? WHERE id=? AND workspace_id=?").run(now(), req.params.id, req.user.workspace_id); audit(req.user.workspace_id, req.user.id, "apikey.revoked", "api_key", req.params.id, {}); res.json({ ok: true }); });
app.get("/api/imports", requireAuth, (req: any, res) => res.json(db.prepare("SELECT * FROM imports WHERE workspace_id=? ORDER BY created_at DESC").all(req.user.workspace_id)));
app.get("/api/backlog/bands", requireAuth, (req: any, res) => { const ws = req.user.workspace_id; const r = db.prepare("SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN ai_score>=70 THEN 1 ELSE 0 END),0) hot, COALESCE(SUM(CASE WHEN ai_score>=40 AND ai_score<70 THEN 1 ELSE 0 END),0) warm, COALESCE(SUM(CASE WHEN ai_score<40 THEN 1 ELSE 0 END),0) low, COALESCE(SUM(CASE WHEN ai_score IS NULL THEN 1 ELSE 0 END),0) unscored FROM leads WHERE workspace_id=? AND state NOT IN ('DUPLICATE','JUNK')").get(ws) as any; const all = db.prepare("SELECT COUNT(*) c FROM leads WHERE workspace_id=?").get(ws) as any; res.json({ ...r, total_all: all.c }); });

// Dashboard aggregate (§10 + drill-down data)
app.get("/api/dashboard", requireAuth, (req: any, res) => {
  const ws = req.user.workspace_id; const m = metrics(ws);
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=?").all(ws) as any[];
  const days: any[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); const key = d.toISOString().slice(0, 10); days.push({ day: key.slice(5), created: leads.filter(l => String(l.created_at).slice(0, 10) === key).length, won: leads.filter(l => l.state === "WON" && String(l.updated_at).slice(0, 10) === key).length }); }
  const funnelOrder = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP", "WON"];
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
app.get("/api/reports", requireAuth, modGate("reports"), (req: any, res) => {
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
const STAGE_WEIGHTS: Record<string, number> = { NEW: 0.05, WORKING: 0.20, QUALIFIED: 0.35, PROPOSAL: 0.60, SENT: 0.80, FOLLOWUP: 0.85, WON: 1 };
app.get("/api/forecast", requireAuth, modGate("reports"), (req: any, res) => {
  const ws = req.user.workspace_id;
  const open = db.prepare("SELECT state, COUNT(*) c, COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state NOT IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE','JUNK','DUPLICATE') GROUP BY state").all(ws) as any[];
  const by_stage = open.map(r => ({ state: r.state, count: r.c, value: r.v, weight: STAGE_WEIGHTS[r.state] ?? 0.05, weighted: Math.round(r.v * (STAGE_WEIGHTS[r.state] ?? 0.05)) }));
  const weighted_pipeline = by_stage.reduce((a, r) => a + r.weighted, 0);
  const raw_pipeline = by_stage.reduce((a, r) => a + r.value, 0);
  const at_risk = db.prepare(`SELECT l.id lead_id, c.name contact_name, l.service_requested, p.total, p.sent_at, CAST((julianday('now') - julianday(COALESCE(p.sent_at, p.created_at))) AS INTEGER) days_waiting FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND l.state IN ('SENT','FOLLOWUP') AND julianday('now') - julianday(COALESCE(p.sent_at, p.created_at)) >= 4 ORDER BY days_waiting DESC LIMIT 8`).all(ws);
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
  // v52: a missed call justifies ONE transactional text-back — never a
  // manufactured marketing consent. New leads are created WITHOUT consent;
  // existing leads' consent is never rewritten by an API call.
  if (!lead) { const r = createLead(ws, "missed-call", { contact: { name: req.body.name || "", phone, email: req.body.email || "" }, service_requested: req.body.service || "", message: "Missed call — auto text-back sent", source: "missed-call" }); lead = r.lead; created = true; }
  if (!lead) return res.status(422).json({ error: { code: "lead_failed" } });
  const recent = db.prepare("SELECT id FROM lead_events WHERE workspace_id=? AND lead_id=? AND type='missed_call_textback' AND created_at>?").get(ws, lead.id, new Date(Date.now() - 86400000).toISOString()) as any;
  if (recent) return res.json({ lead_id: lead.id, created, text_back_status: "skipped_recent" });
  const wsRow = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const first = String(req.body.name || lead.contact_name || "").split(/\s+/)[0];
  const tpl = wsRow.missed_call_text || "Hi{first}, this is {business} — sorry we missed your call! Tell us what you need and we'll get right back to you.";
  const body = tpl.replaceAll("{business}", wsRow.name || "").replaceAll("{first}", first ? " " + first : "");
  const msg: any = await queueAndDeliver(ws, { lead_id: lead.id, channel: "sms", to: phone, body, transactional: true });
  logEvent(ws, lead.id, "missed-call", "missed_call_textback", null, (msg as any)?.status || "queued", { phone });
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,'call',?,?,'open',?)").run(uid("tsk"), ws, lead.id, lead.owner_id || null, `📞 Call back ${req.body.name || phone} — missed call`, new Date(Date.now() + 3600000).toISOString(), now());
  notifyOwners(ws, "call.missed", "Missed call — text-back sent ⚡", `${phone} called; an instant text-back went out and the lead is in the pile.`, lead.id);
  res.status(created ? 201 : 200).json({ lead_id: lead.id, created, text_back_status: (msg as any)?.status || "queued" });
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
  const defaults: Record<string, string> = { NEW: "First contact", WORKING: "Qualify the request", QUALIFIED: "Book the site visit", PROPOSAL: "Send the proposal", SENT: "Proposal follow-up", FOLLOWUP: "Follow up" };
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
  res.json({ sent: ["sent", "delivered"].includes(msg.status), test_mode: msg.status === "test_mode", channel, status: msg.status });
});
app.get("/api/ai/automations", requireAuth, (req: any, res) => { const w = db.prepare("SELECT auto_assign, auto_dedupe, auto_reactivate, auto_score, last_automation_at FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; res.json(w); });
app.post("/api/ai/automations", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const fields = ["auto_assign", "auto_dedupe", "auto_reactivate", "auto_score"];
  for (const f of fields) if (req.body[f] !== undefined) db.prepare(`UPDATE workspaces SET ${f}=? WHERE id=?`).run(req.body[f] ? 1 : 0, req.user.workspace_id);
  res.json(db.prepare("SELECT auto_assign, auto_dedupe, auto_reactivate, auto_score, last_automation_at FROM workspaces WHERE id=?").get(req.user.workspace_id));
});
app.post("/api/ai/automations/run", requireAuth, needPerm("can_settings"), (req: any, res) => res.json({ result: runAutomationsFor(req.user.workspace_id) }));
app.get("/api/ai/autonomy", requireAuth, (req: any, res) => { const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; const level = agentLevel(w); res.json({ level, level_name: AGENT_LEVELS[level], explicit: w.agent_level !== null && w.agent_level !== undefined, levels: AGENT_LEVELS.map((name, i) => ({ level: i, name, summary: ["Watches and reports. Never writes.", "Computes suggestions and logs them. Never writes.", "May create draft work (reactivation tasks) and suggestions. Never mutates leads.", "Applies the armed automations inside the guardrails: scoring, assignment, exact de-dupe, reactivation.", "Bounded execution plus customer-facing first touch from the pre-approved template (requires Follow-ups enabled)."][i] })) }); });
app.patch("/api/ai/autonomy", requireAuth, needPerm("can_settings"), (req: any, res) => { const lvl = Number(req.body?.level); if (!(lvl >= 0 && lvl <= 4)) return res.status(422).json({ error: { code: "bad_level" } }); db.prepare("UPDATE workspaces SET agent_level=? WHERE id=?").run(lvl, req.user.workspace_id); audit(req.user.workspace_id, req.user.id, "agent.level_changed", "workspace", req.user.workspace_id, { level: lvl }); res.json({ ok: true, level: lvl, level_name: AGENT_LEVELS[lvl] }); });
app.get("/api/ai/metrics", requireAuth, (req: any, res) => { const ws = req.user.workspace_id; const runs = db.prepare("SELECT agent, COUNT(*) c FROM agent_runs WHERE workspace_id=? AND created_at>=datetime('now','-30 days') GROUP BY agent").all(ws) as any[]; let actionsApplied = 0; for (const r of db.prepare("SELECT output FROM agent_runs WHERE workspace_id=? AND agent='automation' AND created_at>=datetime('now','-30 days')").all(ws) as any[]) { try { const o = JSON.parse(r.output || "{}"); for (const k of ["scored", "assigned", "archived_duplicates", "marked_spam", "reactivation_tasks"]) actionsApplied += Number(o[k] || 0); } catch {} } const decided = db.prepare("SELECT COUNT(*) t, SUM(CASE WHEN decision='approved' AND (edits_diff IS NULL OR edits_diff='') THEN 1 ELSE 0 END) clean FROM approvals WHERE workspace_id=? AND decision IS NOT NULL").get(ws) as any; const merges = (db.prepare("SELECT COUNT(*) c FROM audit_log WHERE workspace_id=? AND action='lead.merge' AND created_at>=datetime('now','-30 days')").get(ws) as any)?.c || 0; res.json({ runs_30d: Object.fromEntries(runs.map(r => [r.agent, r.c])), actions_applied_30d: actionsApplied, fpar: decided.t ? Math.round(1000 * (decided.clean || 0) / decided.t) / 10 : null, approvals_decided: decided.t || 0, merges_30d: merges, est_minutes_saved_30d: actionsApplied * 3, time_saved_basis: "ESTIMATE: 3 minutes of manual work per applied agent action — a planning figure, not a measurement" }); });
app.get("/api/ai/runs", requireAuth, (req: any, res) => {
  const runs = db.prepare("SELECT * FROM agent_runs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 20").all(req.user.workspace_id);
  res.json(runs);
});
// ---------- slice 17: proposal document template ----------
app.get("/api/settings/cadence", requireAuth, (req: any, res) => { const w = db.prepare("SELECT quiet_start, quiet_end, tz FROM workspaces WHERE id=?").get(req.user.workspace_id) as any; res.json({ quiet_start: w?.quiet_start ?? null, quiet_end: w?.quiet_end ?? null, tz: w?.tz || "America/New_York" }); });
app.patch("/api/settings/cadence", requireAuth, needPerm("can_settings"), (req: any, res) => { const { quiet_start, quiet_end, tz } = req.body || {}; db.prepare("UPDATE workspaces SET quiet_start=?, quiet_end=?, tz=? WHERE id=?").run(quiet_start === null || quiet_start === undefined ? null : Number(quiet_start), quiet_end === null || quiet_end === undefined ? null : Number(quiet_end), tz || "America/New_York", req.user.workspace_id); res.json({ ok: true }); });
app.get("/api/proposal-template", requireAuth, (req: any, res) => res.json(getTemplate(req.user.workspace_id)));
app.put("/api/proposal-template", requireAuth, needPerm("can_settings"), (req: any, res) => {
  const b = req.body || {};
  db.prepare("UPDATE workspaces SET pt_company=?, pt_tagline=?, pt_contact=?, pt_address=?, pt_intro=?, pt_terms=?, pt_footer=? WHERE id=?")
    .run(String(b.company || "").slice(0, 200), String(b.tagline || "").slice(0, 200), String(b.contact_line || "").slice(0, 300), String(b.address || "").slice(0, 300),
      sanitizeHtml(String(b.intro_html || "")), sanitizeHtml(String(b.terms_html || "")), String(b.footer || "").slice(0, 500), req.user.workspace_id);
  if (b.logo_data !== undefined) { const lg = b.logo_data === null ? null : String(b.logo_data); if (lg && (!/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(lg) || lg.length > 900000)) return res.status(422).json({ error: { code: "bad_logo", message: "Logo must be an image under ~650KB" } }); db.prepare("UPDATE workspaces SET logo_data=? WHERE id=?").run(lg, req.user.workspace_id); }
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
app.get("/api/roles", requireAuth, needPerm("can_manage_team"), (req: any, res) => {
  const ws = req.user.workspace_id;
  const roles = ["OWNER", "ADMIN", "OPS_ADMIN", "APPROVER", "LEAD_OWNER", "PM"].map(role => ({ role, defaults: defaultPermsFor(role), template: roleTemplate(ws, role), effective: role === "OWNER" ? defaultPermsFor("OWNER") : (roleTemplate(ws, role) || defaultPermsFor(role)) }));
  res.json({ roles, modules: MODULES });
});
app.put("/api/roles/:role", requireAuth, (req: any, res) => {
  if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only", message: "Only the owner can change role templates." } });
  const role = String(req.params.role);
  if (!["ADMIN", "OPS_ADMIN", "APPROVER", "LEAD_OWNER", "PM"].includes(role)) return res.status(422).json({ error: { code: "bad_role", message: "The OWNER role is always full access and cannot be edited." } });
  const clean = sanitizePerms(req.body?.perms || {}, roleTemplate(req.user.workspace_id, role) || defaultPermsFor(role));
  db.prepare("INSERT INTO role_perms (workspace_id, role, perms, updated_by, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id, role) DO UPDATE SET perms=excluded.perms, updated_by=excluded.updated_by, updated_at=excluded.updated_at").run(req.user.workspace_id, role, JSON.stringify(clean), req.user.id, now());
  clearRoleTplCache(req.user.workspace_id);
  audit(req.user.workspace_id, req.user.id, "roles.template_change", "role", role, clean);
  res.json({ role, template: clean });
});
app.delete("/api/roles/:role", requireAuth, (req: any, res) => {
  if (req.user.role !== "OWNER") return res.status(403).json({ error: { code: "owner_only" } });
  db.prepare("DELETE FROM role_perms WHERE workspace_id=? AND role=?").run(req.user.workspace_id, String(req.params.role));
  clearRoleTplCache(req.user.workspace_id);
  res.json({ ok: true, defaults: defaultPermsFor(String(req.params.role)) });
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
    if (req.body.permissions.modules && typeof req.body.permissions.modules === "object") { const mm: any = {}; for (const m of MODULES) if (["none", "view", "edit"].includes(req.body.permissions.modules[m])) mm[m] = req.body.permissions.modules[m]; if (Object.keys(mm).length) clean.modules = mm; }
    if (clean.leads_scope !== undefined && !["all", "own"].includes(clean.leads_scope)) delete clean.leads_scope;
    if (clean.jobs_scope !== undefined && !["all", "assigned", "own"].includes(clean.jobs_scope)) delete clean.jobs_scope;
    if (clean.schedule_scope !== undefined && !["all", "mine"].includes(clean.schedule_scope)) delete clean.schedule_scope;
    db.prepare("UPDATE users SET permissions=? WHERE id=?").run(Object.keys(clean).length ? JSON.stringify(clean) : null, t.id);
  }
  if (req.body.labor_class_id !== undefined) db.prepare("UPDATE users SET labor_class_id=? WHERE id=?").run(req.body.labor_class_id || null, t.id);
  audit(req.user.workspace_id, req.user.id, "team.access_change", "user", t.id, req.body);
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(t.id) as any;
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, approval_limit: u.approval_limit, permissions: permsOf(u), has_overrides: !!u.permissions } });
});
// ---------- slice 11 (Tier 1): bulk actions, two-way texting, push ----------
const NEXT_STATE: Record<string, string> = { NEW: "WORKING", WORKING: "QUALIFIED", QUALIFIED: "PROPOSAL", PROPOSAL: "SENT", SENT: "FOLLOWUP" };
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
  // P0: never trust an unsigned webhook. No auth token configured = endpoint disabled.
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  if (!authToken) return res.status(403).type("text/xml").send("<Response/>");
  try {
    const sig = String(req.get("x-twilio-signature") || "");
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const params = Object.keys(req.body || {}).sort().map(k => k + req.body[k]).join("");
    const expected = createHmac("sha1", authToken).update(url + params).digest("base64");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(403).type("text/xml").send("<Response/>");
  } catch { return res.status(403).type("text/xml").send("<Response/>"); }
  const from = String(req.body.From || ""); const body = String(req.body.Body || "");
  const digits = from.replace(/\D/g, "").slice(-10);
  if (!digits || !body) return res.type("text/xml").send("<Response/>");
  const hit = db.prepare(`SELECT l.id lead_id, l.workspace_id, l.owner_id FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE REPLACE(REPLACE(REPLACE(c.phone,'-',''),' ',''),'(','') LIKE ? ORDER BY l.created_at DESC LIMIT 1`).get("%" + digits) as any;
  if (hit) {
    db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,status,direction,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(uid("msg"), hit.workspace_id, hit.lead_id, "sms", from, null, body, "received", "in", now());
    db.prepare("UPDATE leads SET consent_contact_ok=1, consent_source=COALESCE(consent_source,'inbound_sms') WHERE id=? AND consent_contact_ok=0").run(hit.lead_id);
    if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body.trim().toUpperCase())) { try { db.prepare("INSERT OR IGNORE INTO suppressions (id,workspace_id,kind,value,reason,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("sup"), hit.workspace_id, "phone", digits, "Customer texted STOP", "sms_stop", null, now()); stopFollowups(hit.lead_id, "opted_out"); db.prepare("UPDATE leads SET consent_contact_ok=0 WHERE id=?").run(hit.lead_id); } catch { /* opt-out is best-effort */ } }
    logEvent(hit.workspace_id, hit.lead_id, "customer", "message_in_sms", null, null, { from });
    stopFollowups(hit.lead_id, "customer_replied"); stopOutreachForLead(hit.lead_id, "customer_replied");
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

// ---------- v4: Salesforce-parity CRM layer (slices 37-46) ----------
registerCrm(app, requireAuth, needPerm);
registerDocTemplates(app, requireAuth, needPerm);
registerHome(app, requireAuth);

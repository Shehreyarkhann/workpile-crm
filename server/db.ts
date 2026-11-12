// Workpile — data layer (Node built-in SQLite for dev; schema mirrors spec §13 Postgres entities)
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.LEADFLOW_DB || path.join(process.cwd(), "data", "leadflow.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(pw, salt, 64).toString("hex");
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = scryptSync(pw, salt, 64).toString("hex");
  return calc.length === hash.length && createHash("sha256").update(calc).digest("hex") === createHash("sha256").update(hash).digest("hex");
}
export const uid = (p: string) => p + "_" + randomBytes(9).toString("base64url");
export const apiKeyHash = (k: string) => createHash("sha256").update(k).digest("hex");
export const now = () => new Date().toISOString();

export function initSchema() {
  db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT, vertical TEXT, timezone TEXT DEFAULT 'America/New_York', plan TEXT DEFAULT 'growth', autonomy_level INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, email TEXT UNIQUE, password_hash TEXT, role TEXT, approval_limit REAL DEFAULT 0, active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT, created_at TEXT, expires_at TEXT);
  CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, phone TEXT, email TEXT, address TEXT, is_customer INTEGER DEFAULT 0, merged_into_id TEXT);
  CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, workspace_id TEXT, type TEXT, name TEXT);
  CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, workspace_id TEXT, contact_id TEXT, source_id TEXT, external_id TEXT, dedupe_key TEXT, service_requested TEXT, service_catalog_id TEXT, state TEXT DEFAULT 'NEW', urgency TEXT, value_band TEXT, est_value REAL DEFAULT 0, owner_id TEXT, pm_id TEXT, approver_id TEXT, next_action TEXT, next_action_due_at TEXT, sla_due_at TEXT, first_response_at TEXT, qualified_at TEXT, lost_reason TEXT, outcome_reason_detail TEXT, competitor TEXT, hold_reason TEXT, notes TEXT, location TEXT, created_at TEXT, updated_at TEXT);
  CREATE INDEX IF NOT EXISTS idx_leads_ws_state ON leads(workspace_id, state, next_action_due_at);
  CREATE INDEX IF NOT EXISTS idx_leads_dedupe ON leads(workspace_id, dedupe_key);
  CREATE TABLE IF NOT EXISTS lead_events (id TEXT PRIMARY KEY, lead_id TEXT, workspace_id TEXT, actor TEXT, type TEXT, from_state TEXT, to_state TEXT, payload TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, lead_id TEXT, workspace_id TEXT, user_id TEXT, type TEXT, body TEXT, outcome TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, assignee_id TEXT, type TEXT, title TEXT, due_at TEXT, status TEXT DEFAULT 'open', completed_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, proposal_id TEXT, submitted_by TEXT, approver_id TEXT, tier TEXT, decision TEXT, reason_code TEXT, edits_diff TEXT, submitted_at TEXT, decided_at TEXT);
  CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, active INTEGER DEFAULT 1, is_catalog INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS price_book_items (id TEXT PRIMARY KEY, workspace_id TEXT, service_id TEXT, name TEXT, unit TEXT, standard_price REAL, floor_price REAL);
  CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, workspace_id TEXT, service_id TEXT, kind TEXT, name TEXT, body TEXT, version INTEGER DEFAULT 1, active INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, template_id TEXT, version INTEGER DEFAULT 1, status TEXT DEFAULT 'draft', line_items TEXT DEFAULT '[]', total REAL DEFAULT 0, margin_band TEXT, win_prob_band TEXT, sent_at TEXT, viewed_at TEXT, signed_at TEXT, outcome TEXT, lost_reason TEXT, payment_status TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, proposal_id TEXT, pm_id TEXT, status TEXT DEFAULT 'created', starts_at TEXT, handoff_status TEXT DEFAULT 'pending', external_project_id TEXT, external_system TEXT, handoff_delivered_at TEXT, handoff_acked_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS outcome_deliveries (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, outcome TEXT, channel TEXT DEFAULT 'api_pull', destination_ref TEXT, payload_hash TEXT, attempts INTEGER DEFAULT 0, last_status TEXT DEFAULT 'pending', last_error TEXT, delivered_at TEXT, acknowledged_at TEXT, external_id TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, workspace_id TEXT, kind TEXT, payload TEXT, idempotency_key TEXT UNIQUE, status TEXT DEFAULT 'queued', attempts INTEGER DEFAULT 0, last_error TEXT, created_at TEXT, delivered_at TEXT);
  CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, workspace_id TEXT, label TEXT, hashed_key TEXT, scopes TEXT, last_used_at TEXT, revoked_at TEXT);
  CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, workspace_id TEXT, filename TEXT, mapping TEXT, totals TEXT, status TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, workspace_id TEXT, agent TEXT, lead_id TEXT, model TEXT, prompt_version TEXT, input_hash TEXT, output TEXT, confidence REAL, human_decision TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS field_reports (id TEXT PRIMARY KEY, workspace_id TEXT, manager_id TEXT, report_date TEXT, status TEXT DEFAULT 'missing', submitted_at TEXT, notes TEXT);
  CREATE TABLE IF NOT EXISTS timesheets (id TEXT PRIMARY KEY, workspace_id TEXT, manager_id TEXT, week_of TEXT, status TEXT DEFAULT 'missing', submitted_at TEXT, hours REAL);
  CREATE TABLE IF NOT EXISTS labor_classes (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, private_rate REAL DEFAULT 0, govt_rate REAL DEFAULT 0, created_at TEXT);
  CREATE TABLE IF NOT EXISTS job_crew (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, user_id TEXT, created_at TEXT, UNIQUE(lead_id, user_id));
  CREATE TABLE IF NOT EXISTS time_entries (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, user_id TEXT, entry_date TEXT, hours REAL, rate REAL, amount REAL, class_name TEXT, note TEXT, created_by TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS job_schedule (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, user_id TEXT, work_date TEXT, note TEXT, created_by TEXT, created_at TEXT, UNIQUE(lead_id, user_id, work_date));
  CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, project_id TEXT, name TEXT, required INTEGER DEFAULT 1, status TEXT DEFAULT 'missing', expires_at TEXT, received_at TEXT);
  CREATE TABLE IF NOT EXISTS site_visits (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, assigned_to TEXT, scheduled_at TEXT, status TEXT DEFAULT 'scheduled', outcome TEXT, notes TEXT);
  CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, workspace_id TEXT, project_id TEXT, lead_id TEXT, delta_scope TEXT, delta_total REAL DEFAULT 0, status TEXT DEFAULT 'draft', created_at TEXT);
  CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, diff TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS webhook_endpoints (id TEXT PRIMARY KEY, workspace_id TEXT, url TEXT, secret TEXT, events TEXT DEFAULT 'lead.finalized', active INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS inbox_items (id TEXT PRIMARY KEY, workspace_id TEXT, category TEXT, from_name TEXT, from_email TEXT, subject TEXT, body TEXT, lead_id TEXT, owner_id TEXT, next_action_due_at TEXT, received_at TEXT, created_at TEXT, reply_label TEXT);
  CREATE TABLE IF NOT EXISTS signatures (id TEXT PRIMARY KEY, proposal_id TEXT, workspace_id TEXT, token TEXT UNIQUE, signer_name TEXT, signer_email TEXT, typed_signature TEXT, consent INTEGER DEFAULT 0, ip TEXT, user_agent TEXT, doc_hash TEXT, signed_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, workspace_id TEXT, proposal_id TEXT, kind TEXT DEFAULT 'deposit', amount REAL, currency TEXT DEFAULT 'USD', mode TEXT DEFAULT 'test', stripe_session_id TEXT, status TEXT DEFAULT 'pending', link TEXT, created_at TEXT, paid_at TEXT);
  CREATE TABLE IF NOT EXISTS background_jobs (id TEXT PRIMARY KEY, kind TEXT, payload TEXT, status TEXT DEFAULT 'queued', attempts INTEGER DEFAULT 0, run_after TEXT, last_error TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS outbox_events (id TEXT PRIMARY KEY, workspace_id TEXT, type TEXT, entity_id TEXT, payload TEXT, created_at TEXT, processed_at TEXT);
  CREATE TABLE IF NOT EXISTS suppressions (id TEXT PRIMARY KEY, workspace_id TEXT, kind TEXT, value TEXT, reason TEXT, source TEXT, created_by TEXT, created_at TEXT, UNIQUE(workspace_id, kind, value));
  CREATE TABLE IF NOT EXISTS merge_snapshots (id TEXT PRIMARY KEY, workspace_id TEXT, survivor_id TEXT, dupe_id TEXT, snapshot TEXT, created_by TEXT, created_at TEXT, reversed_at TEXT);
  CREATE TABLE IF NOT EXISTS audit_requests (id TEXT PRIMARY KEY, email TEXT, rows_count INTEGER, recoverable_value REAL, recoverable_count INTEGER, created_at TEXT);
  CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, workspace_id TEXT, entity_type TEXT, entity_id TEXT, name TEXT, mime TEXT, size INTEGER, storage_key TEXT, uploaded_by TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS price_overrides (id TEXT PRIMARY KEY, workspace_id TEXT, proposal_id TEXT, lead_id TEXT, item_id TEXT, item_name TEXT, prev_price REAL, new_price REAL, reason TEXT, user_id TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS feature_flags (workspace_id TEXT, flag TEXT, enabled INTEGER DEFAULT 0, updated_at TEXT, PRIMARY KEY (workspace_id, flag));
  CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, workspace_id TEXT, plan TEXT, status TEXT DEFAULT 'trialing', stripe_customer_id TEXT, stripe_subscription_id TEXT, current_period_end TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS oauth_connections (id TEXT PRIMARY KEY, workspace_id TEXT, provider TEXT, account_email TEXT, status TEXT DEFAULT 'not_configured', token_ref TEXT, last_poll_at TEXT, last_error TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS portal_uploads (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, filename TEXT, note TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS memberships (user_id TEXT, workspace_id TEXT, role TEXT, created_at TEXT, PRIMARY KEY (user_id, workspace_id));
  CREATE TABLE IF NOT EXISTS webhook_deliveries (id TEXT PRIMARY KEY, workspace_id TEXT, endpoint_id TEXT, event TEXT, payload TEXT, attempts INTEGER DEFAULT 0, last_status TEXT DEFAULT 'pending', last_error TEXT, next_attempt_at TEXT, created_at TEXT, delivered_at TEXT);
  CREATE TABLE IF NOT EXISTS messages_outbox (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, channel TEXT, to_addr TEXT, subject TEXT, body TEXT, status TEXT DEFAULT 'queued', provider TEXT, provider_id TEXT, error TEXT, created_at TEXT, sent_at TEXT);
  CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, type TEXT, title TEXT, body TEXT, lead_id TEXT, read_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS auth_tokens (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, token_hash TEXT, expires_at TEXT, used_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS followup_enrollments (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, proposal_id TEXT, step_idx INTEGER DEFAULT 0, next_due_at TEXT, status TEXT DEFAULT 'active', stop_reason TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT, endpoint TEXT UNIQUE, subscription TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS workers (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, phone TEXT, labor_class_id TEXT, linked_user_id TEXT, active INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, proposal_id TEXT, stage TEXT DEFAULT 'SCHEDULED', value REAL DEFAULT 0, sector TEXT DEFAULT 'private', scheduled_start TEXT, scheduled_end TEXT, invoice_status TEXT DEFAULT 'not_ready', packet_sent_at TEXT, created_from TEXT DEFAULT 'sign', closed_at TEXT, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS inbox_comments (id TEXT PRIMARY KEY, workspace_id TEXT, inbox_item_id TEXT, user_id TEXT, body TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS job_messages (id TEXT PRIMARY KEY, workspace_id TEXT, job_id TEXT, user_id TEXT, body TEXT, mentions TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS inbox_rules (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, match_field TEXT, match_value TEXT, action TEXT, action_value TEXT, active INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS canned_replies (id TEXT PRIMARY KEY, workspace_id TEXT, category TEXT, title TEXT, body TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS callbacks (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, due_at TEXT, note TEXT, status TEXT DEFAULT 'open', created_by TEXT, created_at TEXT, completed_at TEXT);
  `);
  // additive columns for existing DBs (expand step of expand-migrate-contract)
  for (const stmt of [
    "ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0",
    "ALTER TABLE notifications ADD COLUMN entity_type TEXT",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT",
    "ALTER TABLE workspaces ADD COLUMN suspended INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0",
    "ALTER TABLE subscriptions ADD COLUMN source TEXT DEFAULT 'stripe'",
    "CREATE TABLE IF NOT EXISTS platform_audit (id TEXT PRIMARY KEY, admin_id TEXT, admin_email TEXT, action TEXT, target_type TEXT, target_id TEXT, workspace_id TEXT, detail TEXT, created_at TEXT)",
    "ALTER TABLE attachments ADD COLUMN doc_type TEXT",
    "CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT)",
    "CREATE TABLE IF NOT EXISTS role_perms (workspace_id TEXT, role TEXT, perms TEXT, updated_by TEXT, updated_at TEXT, PRIMARY KEY (workspace_id, role))",
    "ALTER TABLE leads ADD COLUMN first_touch_at TEXT",
    "ALTER TABLE leads ADD COLUMN first_touch_kind TEXT",
    "ALTER TABLE job_schedule ADD COLUMN done_at TEXT",
    "ALTER TABLE messages_outbox ADD COLUMN attachments TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_attach TEXT",
    "ALTER TABLE proposals ADD COLUMN number INTEGER",
    "ALTER TABLE workspaces ADD COLUMN reply_email TEXT",
    "ALTER TABLE inbox_items ADD COLUMN escalated_at TEXT",
    "ALTER TABLE jobs ADD COLUMN requires_site_visit INTEGER DEFAULT 0",
    "ALTER TABLE inbox_items ADD COLUMN ai_draft_body TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_draft_subject TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_action TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_why TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_source TEXT",
    "ALTER TABLE inbox_items ADD COLUMN ai_draft_at TEXT",
    "ALTER TABLE notifications ADD COLUMN entity_id TEXT",
    "ALTER TABLE workspaces ADD COLUMN logo_data TEXT",
    "ALTER TABLE approvals ADD COLUMN content_hash TEXT",
    "ALTER TABLE documents ADD COLUMN expires_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN agent_level INTEGER",
    "ALTER TABLE workspaces ADD COLUMN agent_instructions TEXT",
    "ALTER TABLE agent_executions ADD COLUMN decided_by TEXT",
    "ALTER TABLE agent_executions ADD COLUMN decided_at TEXT",
    "ALTER TABLE agent_executions ADD COLUMN loop_state TEXT",
    "ALTER TABLE proposals ADD COLUMN delivery_mode TEXT",
    "UPDATE workspaces SET agent_level=4 WHERE agent_level IS NULL AND followup_enabled=1 AND (auto_score=1 OR auto_assign=1 OR auto_dedupe=1 OR auto_reactivate=1)",
    "ALTER TABLE sessions ADD COLUMN impersonated_by TEXT",
    "ALTER TABLE sessions ADD COLUMN impersonation_expires_at TEXT",
    "ALTER TABLE timesheets ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE timesheets ADD COLUMN reviewed_at TEXT",
    "ALTER TABLE timesheets ADD COLUMN approved_by TEXT",
    "ALTER TABLE timesheets ADD COLUMN approved_at TEXT",
    "ALTER TABLE timesheets ADD COLUMN rejection_reason TEXT",
    "UPDATE jobs SET stage='WORK_COMPLETED' WHERE stage='FIELD_DONE'",
    "UPDATE jobs SET stage='DOCUMENTATION_PENDING' WHERE stage='PAPERWORK'",
    "UPDATE jobs SET stage='CLOSED' WHERE stage='PAID'",
    "ALTER TABLE tasks ADD COLUMN snooze_until TEXT",
    "ALTER TABLE tasks ADD COLUMN snooze_reason TEXT",
    "ALTER TABLE tasks ADD COLUMN escalation_level INTEGER DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN completion_reason TEXT",
    "ALTER TABLE tasks ADD COLUMN completed_by TEXT",
    "ALTER TABLE workspaces ADD COLUMN quiet_start INTEGER",
    "ALTER TABLE workspaces ADD COLUMN quiet_end INTEGER",
    "ALTER TABLE workspaces ADD COLUMN tz TEXT DEFAULT 'America/New_York'",
    "ALTER TABLE workspaces ADD COLUMN deposit_pct REAL DEFAULT 25",
    "ALTER TABLE proposals ADD COLUMN sign_token TEXT",
    "ALTER TABLE followup_enrollments ADD COLUMN fail_count INTEGER DEFAULT 0",
  "CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, job_id TEXT, proposal_id TEXT, number TEXT, status TEXT DEFAULT 'sent', lines TEXT DEFAULT '[]', total REAL DEFAULT 0, paid_amount REAL DEFAULT 0, due_at TEXT, issued_at TEXT, source TEXT DEFAULT 'manual', token TEXT, sent_at TEXT, created_at TEXT)",
  "ALTER TABLE invoices ADD COLUMN token TEXT",
  "ALTER TABLE invoices ADD COLUMN sent_at TEXT",
  "ALTER TABLE payments ADD COLUMN invoice_id TEXT",
  "ALTER TABLE workspaces ADD COLUMN llm_provider TEXT",
  "ALTER TABLE workspaces ADD COLUMN llm_model TEXT",
  "ALTER TABLE workspaces ADD COLUMN llm_api_key TEXT",
  "CREATE TABLE IF NOT EXISTS agent_executions (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, parent_id TEXT, instruction TEXT, status TEXT DEFAULT 'queued', planner TEXT, plan TEXT DEFAULT '[]', context TEXT DEFAULT '{}', tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0, summary TEXT, decided_by TEXT, decided_at TEXT, created_at TEXT, updated_at TEXT, loop_state TEXT)",
  "ALTER TABLE background_jobs ADD COLUMN lease_until TEXT",
  "ALTER TABLE background_jobs ADD COLUMN idem_key TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_bg_idem ON background_jobs(idem_key) WHERE idem_key IS NOT NULL AND status IN ('queued','running')",
    "ALTER TABLE api_keys ADD COLUMN created_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN trial_ends_at TEXT",
    "ALTER TABLE leads ADD COLUMN consent_contact_ok INTEGER DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN consent_source TEXT",
    "ALTER TABLE leads ADD COLUMN ai_score INTEGER",
    "ALTER TABLE leads ADD COLUMN ai_flags TEXT",
    "ALTER TABLE workspaces ADD COLUMN source_api_url TEXT",
    "ALTER TABLE workspaces ADD COLUMN source_api_key TEXT",
    "ALTER TABLE workspaces ADD COLUMN sync_enabled INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN last_sync_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN last_sync_stats TEXT",
    "ALTER TABLE workspaces ADD COLUMN slack_webhook_url TEXT",
    "ALTER TABLE workspaces ADD COLUMN from_name TEXT",
    "ALTER TABLE workspaces ADD COLUMN from_email TEXT",
    "ALTER TABLE workspaces ADD COLUMN followup_enabled INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN followup_steps TEXT",
    "ALTER TABLE workspaces ADD COLUMN review_url TEXT",
    "ALTER TABLE workspaces ADD COLUMN review_on_won INTEGER DEFAULT 0",
    "ALTER TABLE messages_outbox ADD COLUMN direction TEXT DEFAULT 'out'",
    "ALTER TABLE inbox_items ADD COLUMN reply_label TEXT",
    "ALTER TABLE messages_outbox ADD COLUMN reply_label TEXT",
    "ALTER TABLE messages_outbox ADD COLUMN from_addr TEXT",
    "ALTER TABLE messages_outbox ADD COLUMN track_token TEXT",
    "ALTER TABLE invoices ADD COLUMN qb_id TEXT",
    "ALTER TABLE invoices ADD COLUMN qb_synced_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN missed_call_text TEXT",
    "ALTER TABLE services ADD COLUMN cycle_months INTEGER DEFAULT 0",
    // crm.ts initCrmSchema also ALTERs these, but its ALTERs run at import time — before
    // initSchema creates the tables on a FRESH database — so they silently no-op there and
    // only land on the second boot. Mirrored here so fresh installs are correct on boot #1.
    "ALTER TABLE leads ADD COLUMN account_id TEXT",
    "ALTER TABLE leads ADD COLUMN converted_at TEXT",
    "ALTER TABLE leads ADD COLUMN campaign_id TEXT",
    "ALTER TABLE leads ADD COLUMN custom TEXT DEFAULT '{}'",
    "ALTER TABLE leads ADD COLUMN merged_into_id TEXT",
    "ALTER TABLE contacts ADD COLUMN account_id TEXT",
    "ALTER TABLE contacts ADD COLUMN title TEXT",
    "ALTER TABLE jobs ADD COLUMN custom TEXT DEFAULT '{}'",
    "ALTER TABLE users ADD COLUMN permissions TEXT",
    "ALTER TABLE workspaces ADD COLUMN auto_assign INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN auto_dedupe INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN auto_reactivate INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN auto_score INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN last_automation_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_company TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_tagline TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_contact TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_address TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_intro TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_terms TEXT",
    "ALTER TABLE workspaces ADD COLUMN pt_footer TEXT",
    "ALTER TABLE inbox_items ADD COLUMN status TEXT DEFAULT 'open'",
    "ALTER TABLE inbox_items ADD COLUMN completed_at TEXT",
    "ALTER TABLE timesheets ADD COLUMN days TEXT",
    "ALTER TABLE timesheets ADD COLUMN notes TEXT",
    "ALTER TABLE timesheets ADD COLUMN chased_at TEXT",
    "ALTER TABLE users ADD COLUMN labor_class_id TEXT",
    "ALTER TABLE leads ADD COLUMN sector TEXT DEFAULT 'private'",
    "ALTER TABLE field_reports ADD COLUMN lead_id TEXT",
    "ALTER TABLE field_reports ADD COLUMN chased_at TEXT",
    "ALTER TABLE workspaces ADD COLUMN booking_slug TEXT",
    "ALTER TABLE workspaces ADD COLUMN booking_enabled INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
    "ALTER TABLE webhook_endpoints ADD COLUMN events TEXT DEFAULT 'outcome.final'",
    // ---- v3 (slices 28-36) ----
    "ALTER TABLE leads ADD COLUMN legacy_state TEXT",
    "ALTER TABLE leads ADD COLUMN stage_changed_at TEXT",
    "ALTER TABLE leads ADD COLUMN hold_flag INTEGER DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN hold_until TEXT",
    "ALTER TABLE workspaces ADD COLUMN approval_policy TEXT DEFAULT 'always'",
    "ALTER TABLE workspaces ADD COLUMN approval_threshold REAL DEFAULT 25000",
    "ALTER TABLE workspaces ADD COLUMN business_hours TEXT",
    "ALTER TABLE time_entries ADD COLUMN worker_id TEXT",
    "ALTER TABLE job_crew ADD COLUMN worker_id TEXT",
    "ALTER TABLE job_schedule ADD COLUMN worker_id TEXT",
    "ALTER TABLE field_reports ADD COLUMN worker_id TEXT",
    "ALTER TABLE timesheets ADD COLUMN worker_id TEXT",
    "ALTER TABLE outcome_deliveries ADD COLUMN superseded_at TEXT",
    "ALTER TABLE proposals ADD COLUMN options TEXT",
    "ALTER TABLE proposals ADD COLUMN selected_option TEXT",
    "ALTER TABLE proposals ADD COLUMN expires_at TEXT",
    "ALTER TABLE proposals ADD COLUMN view_count INTEGER DEFAULT 0",
    "ALTER TABLE proposals ADD COLUMN first_viewed_at TEXT",
    "ALTER TABLE inbox_items ADD COLUMN claimed_by TEXT",
    "ALTER TABLE inbox_items ADD COLUMN claimed_at TEXT",
    "ALTER TABLE change_orders ADD COLUMN job_id TEXT",
    "ALTER TABLE documents ADD COLUMN job_id TEXT",
  ]) { try { db.exec(stmt); } catch { /* already present */ } }
  // ---- v3 stage migration (idempotent): v2 states -> v3 stages; ON_HOLD becomes a flag ----
  try {
    db.exec("UPDATE leads SET legacy_state=state WHERE legacy_state IS NULL AND state IN ('TRIAGED','QUALIFYING','READY_FOR_APPROVAL','APPROVED','PROPOSAL_DRAFTED','PROPOSAL_SENT','IN_FOLLOW_UP','ON_HOLD')");
    db.exec("UPDATE leads SET hold_flag=1 WHERE state='ON_HOLD' AND COALESCE(hold_flag,0)=0");
    db.exec("UPDATE leads SET state='QUALIFIED' WHERE state='ON_HOLD'");
    db.exec("UPDATE leads SET state='WORKING' WHERE state IN ('TRIAGED','QUALIFYING')");
    db.exec("UPDATE leads SET state='PROPOSAL' WHERE state IN ('READY_FOR_APPROVAL','APPROVED','PROPOSAL_DRAFTED')");
    db.exec("UPDATE leads SET state='SENT' WHERE state='PROPOSAL_SENT'");
    db.exec("UPDATE leads SET state='FOLLOWUP' WHERE state='IN_FOLLOW_UP'");
    db.exec("UPDATE leads SET stage_changed_at=COALESCE(stage_changed_at, updated_at, created_at)");
    // roster seed: every login user is also a worker (linked), created once
    const users = db.prepare("SELECT id, workspace_id, name, labor_class_id FROM users").all() as any[];
    for (const u of users) {
      const exists = db.prepare("SELECT id FROM workers WHERE linked_user_id=?").get(u.id);
      if (!exists) db.prepare("INSERT INTO workers (id,workspace_id,name,phone,labor_class_id,linked_user_id,active,created_at) VALUES (?,?,?,?,?,?,1,?)")
        .run("wrk_" + u.id.replace(/^usr_/, ""), u.workspace_id, u.name, "", u.labor_class_id || null, u.id, now());
    }
    // backfill time_entries.worker_id from the linked worker of user_id
    db.exec("UPDATE time_entries SET worker_id=(SELECT w.id FROM workers w WHERE w.linked_user_id=time_entries.user_id) WHERE worker_id IS NULL AND user_id IS NOT NULL");
    db.exec("UPDATE job_crew SET worker_id=(SELECT w.id FROM workers w WHERE w.linked_user_id=job_crew.user_id) WHERE worker_id IS NULL AND user_id IS NOT NULL");
    db.exec("UPDATE job_schedule SET worker_id=(SELECT w.id FROM workers w WHERE w.linked_user_id=job_schedule.user_id) WHERE worker_id IS NULL AND user_id IS NOT NULL");
  } catch { /* migration is best-effort idempotent; schema guards above already applied */ }
}

let __txDepth = 0;
export function withTx<T>(fn: () => T): T {
  if (__txDepth > 0) return fn();
  db.exec("BEGIN IMMEDIATE");
  __txDepth++;
  try { const r = fn(); db.exec("COMMIT"); __txDepth--; return r; }
  catch (e) { try { db.exec("ROLLBACK"); } catch {} __txDepth--; throw e; }
}
export function logEvent(workspaceId: string, leadId: string, actor: string, type: string, fromState: string | null, toState: string | null, payload: any = {}) {
  db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(uid("evt"), leadId, workspaceId, actor, type, fromState, toState, JSON.stringify(payload), now());
}
export function audit(workspaceId: string, userId: string, action: string, entity: string, entityId: string, diff: any = {}) {
  db.prepare("INSERT INTO audit_log (id,workspace_id,user_id,action,entity,entity_id,diff,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(uid("aud"), workspaceId, userId, action, entity, entityId, JSON.stringify(diff), now());
}
export function logAgentRun(workspaceId: string, agent: string, leadId: string | null, model: string, output: any, confidence: number, inputText: string) {
  db.prepare("INSERT INTO agent_runs (id,workspace_id,agent,lead_id,model,prompt_version,input_hash,output,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(uid("run"), workspaceId, agent, leadId, model, "v1", createHash("sha256").update(inputText || "").digest("hex").slice(0, 16), JSON.stringify(output), confidence, now());
}

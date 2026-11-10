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
  CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, project_id TEXT, name TEXT, required INTEGER DEFAULT 1, status TEXT DEFAULT 'missing', expires_at TEXT, received_at TEXT);
  CREATE TABLE IF NOT EXISTS site_visits (id TEXT PRIMARY KEY, workspace_id TEXT, lead_id TEXT, assigned_to TEXT, scheduled_at TEXT, status TEXT DEFAULT 'scheduled', outcome TEXT, notes TEXT);
  CREATE TABLE IF NOT EXISTS change_orders (id TEXT PRIMARY KEY, workspace_id TEXT, project_id TEXT, lead_id TEXT, delta_scope TEXT, delta_total REAL DEFAULT 0, status TEXT DEFAULT 'draft', created_at TEXT);
  CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, action TEXT, entity TEXT, entity_id TEXT, diff TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS webhook_endpoints (id TEXT PRIMARY KEY, workspace_id TEXT, url TEXT, secret TEXT, events TEXT DEFAULT 'lead.finalized', active INTEGER DEFAULT 1, created_at TEXT);
  CREATE TABLE IF NOT EXISTS inbox_items (id TEXT PRIMARY KEY, workspace_id TEXT, category TEXT, from_name TEXT, from_email TEXT, subject TEXT, body TEXT, lead_id TEXT, owner_id TEXT, next_action_due_at TEXT, received_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS signatures (id TEXT PRIMARY KEY, proposal_id TEXT, workspace_id TEXT, token TEXT UNIQUE, signer_name TEXT, signer_email TEXT, typed_signature TEXT, consent INTEGER DEFAULT 0, ip TEXT, user_agent TEXT, doc_hash TEXT, signed_at TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, workspace_id TEXT, proposal_id TEXT, kind TEXT DEFAULT 'deposit', amount REAL, currency TEXT DEFAULT 'USD', mode TEXT DEFAULT 'test', stripe_session_id TEXT, status TEXT DEFAULT 'pending', link TEXT, created_at TEXT, paid_at TEXT);
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
  `);
  // additive columns for existing DBs (expand step of expand-migrate-contract)
  for (const stmt of [
    "ALTER TABLE users ADD COLUMN is_platform_admin INTEGER DEFAULT 0",
    "ALTER TABLE workspaces ADD COLUMN deposit_pct REAL DEFAULT 25",
    "ALTER TABLE proposals ADD COLUMN sign_token TEXT",
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
    "ALTER TABLE workspaces ADD COLUMN booking_slug TEXT",
    "ALTER TABLE workspaces ADD COLUMN booking_enabled INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0",
    "ALTER TABLE webhook_endpoints ADD COLUMN events TEXT DEFAULT 'outcome.final'",
  ]) { try { db.exec(stmt); } catch { /* already present */ } }
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

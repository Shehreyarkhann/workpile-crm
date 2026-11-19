// v96 — Tenant data export: everything the workspace owns, as one JSON
// bundle. Secrets never leave: password hashes, TOTP secrets, API keys and
// OAuth token references are stripped or the tables are excluded outright.
import { db } from "./db.ts";

const TABLES = [
  "contacts", "accounts", "leads", "lead_events", "jobs", "work_orders",
  "wo_time_entries", "wo_materials", "wo_checklist", "proposals", "invoices",
  "payments", "change_orders", "inspections", "inspection_actions",
  "inspection_notes", "inspection_comments", "documents", "attachments",
  "tasks", "site_visits", "approvals", "services", "price_book_items",
  "labor_classes", "tax_rates", "timesheets", "campaigns", "inbox_items",
  "inspection_templates", "report_templates",
];
const STRIP: Record<string, string[]> = {
  users: ["password_hash", "totp_secret"],
  workspaces: ["llm_api_key", "source_api_key", "slack_webhook_url"],
};

export function buildWorkspaceExport(wsId: string): any {
  const out: any = { exported_at: new Date().toISOString(), format: "workpile-export-v1", tables: {} };
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(wsId) as any;
  if (ws) { for (const k of STRIP.workspaces) delete ws[k]; out.workspace = ws; }
  const users = (db.prepare("SELECT * FROM users WHERE workspace_id=?").all(wsId) as any[]).map(u => { const c = { ...u }; for (const k of STRIP.users) delete c[k]; return c; });
  out.tables.users = users;
  for (const t of TABLES) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (!exists) continue;
    const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as any[]).map(c => c.name);
    if (!cols.includes("workspace_id")) continue;
    out.tables[t] = db.prepare(`SELECT * FROM ${t} WHERE workspace_id=?`).all(wsId);
  }
  out.counts = Object.fromEntries(Object.entries(out.tables).map(([k, v]: any) => [k, (v as any[]).length]));
  return out;
}

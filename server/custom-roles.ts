// v80 — Fully custom roles (docs/CHAIN-MODEL.md). A workspace can define its
// own roles — name, title, and access — cloned from a built-in starting
// template. The role's permissions live in role_perms under the custom id
// (role_<uid>), so the whole v41 engine (templates, per-user overrides,
// module gates, scopes) applies unchanged. Built-ins stay as starting points.
import { db, uid, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, title TEXT, base_role TEXT,
  created_by TEXT, created_at TEXT, updated_at TEXT)`);

export const BUILTIN_ROLES = ["OWNER", "ADMIN", "OPS_ADMIN", "APPROVER", "LEAD_OWNER", "PM"];
export const EDITABLE_BUILTINS = ["ADMIN", "OPS_ADMIN", "APPROVER", "LEAD_OWNER", "PM"];

export function getCustomRole(ws: string, id: string): any {
  if (!id || !String(id).startsWith("role_")) return null;
  return db.prepare("SELECT * FROM custom_roles WHERE id=? AND workspace_id=?").get(id, ws) as any || null;
}
export function listCustomRoles(ws: string): any[] {
  return db.prepare("SELECT * FROM custom_roles WHERE workspace_id=? ORDER BY created_at").all(ws) as any[];
}
export function isAssignableRole(ws: string, role: string): boolean {
  return BUILTIN_ROLES.includes(role) || !!getCustomRole(ws, role);
}
export function createCustomRole(ws: string, actor: string, name: string, title: string, baseRole: string): any {
  const id = uid("role");
  db.prepare("INSERT INTO custom_roles (id,workspace_id,name,title,base_role,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, ws, name, title, baseRole, actor, now(), now());
  return db.prepare("SELECT * FROM custom_roles WHERE id=?").get(id);
}

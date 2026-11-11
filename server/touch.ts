// V39 — the touch model. A lead is UNTOUCHED only when nobody has picked it
// up in ANY way: not opened, not assigned, not contacted, not messaged, not
// tasked. The old definition (state NEW + first_response_at NULL) meant a
// lead could be opened, assigned and worked and STILL count as untouched —
// in the queue, on Home, and in the agent's triage pile, forever. One shared
// predicate + one stamping helper, used by every surface, so the number can
// never disagree with itself again.
import { db, now } from "./db.ts";

export const UNTOUCHED_WHERE = "state='NEW' AND first_touch_at IS NULL AND first_response_at IS NULL";

export function touchLead(workspaceId: string, leadId: string, kind: string, actorId?: string): boolean {
  if (!leadId) return false;
  const l = db.prepare("SELECT first_touch_at FROM leads WHERE id=? AND workspace_id=?").get(leadId, workspaceId) as any;
  if (!l || l.first_touch_at) return false;
  db.prepare("UPDATE leads SET first_touch_at=?, first_touch_kind=? WHERE id=?").run(now(), kind, leadId);
  try { db.prepare("INSERT INTO lead_events (id, workspace_id, lead_id, kind, actor_id, body, created_at) VALUES (?,?,?,?,?,?,?)").run("ev_" + Math.random().toString(36).slice(2, 12), workspaceId, leadId, "first_touch", actorId || null, `First touch — ${kind}`, now()); } catch { /* events are best-effort */ }
  return true;
}

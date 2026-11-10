// Generalized outbox (target §23): domain events recorded in the same database write as the
// change itself, then relayed by the worker. Consumers (integrations, analytics, webhooks)
// read from here instead of scraping tables.
import { db, uid, now } from "./db.ts";

export function emitOutbox(workspaceId: string, type: string, entityId: string | null, payload: any = {}): void {
  try { db.prepare("INSERT INTO outbox_events (id,workspace_id,type,entity_id,payload,created_at) VALUES (?,?,?,?,?,?)").run(uid("obx"), workspaceId, type, entityId, JSON.stringify(payload || {}), now()); } catch { /* event emission never breaks the main flow */ }
}

export function relayOutbox(limit = 200): number {
  const r = db.prepare("UPDATE outbox_events SET processed_at=? WHERE processed_at IS NULL AND id IN (SELECT id FROM outbox_events WHERE processed_at IS NULL ORDER BY created_at LIMIT ?)").run(now(), limit) as any;
  return r.changes || 0;
}

export function outboxPending(): number {
  return (db.prepare("SELECT COUNT(*) c FROM outbox_events WHERE processed_at IS NULL").get() as any).c;
}

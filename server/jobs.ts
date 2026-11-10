// Durable background jobs (target §23): enqueue anywhere; the worker claims, retries with
// backoff, and dead-letters after 5 attempts. Nothing important is fire-and-forget anymore.
import { db, uid, now } from "./db.ts";

export function enqueueJob(kind: string, payload: any, runAfter?: string, idemKey?: string): string {
  if (idemKey) { const ex = db.prepare("SELECT id FROM background_jobs WHERE idem_key=? AND status IN ('queued','running')").get(idemKey) as any; if (ex) return ex.id; }
  const id = uid("job");
  db.prepare("INSERT INTO background_jobs (id,kind,payload,status,attempts,run_after,idem_key,created_at,updated_at) VALUES (?,?,?,'queued',0,?,?,?,?)")
    .run(id, kind, JSON.stringify(payload || {}), runAfter || now(), idemKey || null, now(), now());
  return id;
}

// Crash recovery (v17): a worker that dies mid-job leaves the row 'running' with an expired
// lease. The next tick requeues it (or dead-letters at the attempt cap) — nothing sticks forever.
export function recoverStaleJobs(): { recovered: number; dead: number } {
  const stale = db.prepare("SELECT * FROM background_jobs WHERE status='running' AND lease_until IS NOT NULL AND lease_until<?").all(now()) as any[];
  let recovered = 0, dead = 0;
  for (const j of stale) {
    if ((j.attempts || 0) >= 5) { db.prepare("UPDATE background_jobs SET status='dead', last_error='lease expired at attempt cap', lease_until=NULL, updated_at=? WHERE id=?").run(now(), j.id); dead++; }
    else { db.prepare("UPDATE background_jobs SET status='queued', run_after=?, last_error='recovered: worker lease expired', lease_until=NULL, updated_at=? WHERE id=?").run(now(), now(), j.id); recovered++; }
  }
  return { recovered, dead };
}

export async function processJobs(handlers: Record<string, (payload: any) => Promise<void>>, limit = 10): Promise<{ done: number; failed: number; dead: number }> {
  recoverStaleJobs();
  const due = db.prepare("SELECT * FROM background_jobs WHERE status='queued' AND run_after<=? ORDER BY created_at LIMIT ?").all(now(), limit) as any[];
  let done = 0, failed = 0, dead = 0;
  for (const j of due) {
    const handler = handlers[j.kind];
    const claim = db.prepare("UPDATE background_jobs SET status='running', attempts=attempts+1, lease_until=?, updated_at=? WHERE id=? AND status='queued'").run(new Date(Date.now() + 120000).toISOString(), now(), j.id) as any;
    if (!claim.changes) continue; // claimed by another worker tick — never double-run
    if (!handler) { db.prepare("UPDATE background_jobs SET status='dead', last_error='no handler registered', updated_at=? WHERE id=?").run(now(), j.id); dead++; continue; }
    try {
      await handler(JSON.parse(j.payload || "{}"));
      db.prepare("UPDATE background_jobs SET status='done', updated_at=? WHERE id=?").run(now(), j.id); done++;
    } catch (e: any) {
      const attempts = (j.attempts || 0) + 1;
      if (attempts >= 5) { db.prepare("UPDATE background_jobs SET status='dead', last_error=?, updated_at=? WHERE id=?").run(String(e?.message || e), now(), j.id); dead++; }
      else { const backoffMs = attempts * attempts * 30000; db.prepare("UPDATE background_jobs SET status='queued', run_after=?, last_error=?, updated_at=? WHERE id=?").run(new Date(Date.now() + backoffMs).toISOString(), String(e?.message || e), now(), j.id); failed++; }
    }
  }
  return { done, failed, dead };
}

export function jobStats(): Record<string, number> {
  const rows = db.prepare("SELECT status, COUNT(*) c FROM background_jobs GROUP BY status").all() as any[];
  return Object.fromEntries(rows.map(r => [r.status, r.c]));
}

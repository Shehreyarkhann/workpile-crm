// Durable background jobs (target §23): enqueue anywhere; the worker claims, retries with
// backoff, and dead-letters after 5 attempts. Nothing important is fire-and-forget anymore.
import { db, uid, now } from "./db.ts";

export function enqueueJob(kind: string, payload: any, runAfter?: string): string {
  const id = uid("job");
  db.prepare("INSERT INTO background_jobs (id,kind,payload,status,attempts,run_after,created_at,updated_at) VALUES (?,?,?,'queued',0,?,?,?)")
    .run(id, kind, JSON.stringify(payload || {}), runAfter || now(), now(), now());
  return id;
}

export async function processJobs(handlers: Record<string, (payload: any) => Promise<void>>, limit = 10): Promise<{ done: number; failed: number; dead: number }> {
  const due = db.prepare("SELECT * FROM background_jobs WHERE status='queued' AND run_after<=? ORDER BY created_at LIMIT ?").all(now(), limit) as any[];
  let done = 0, failed = 0, dead = 0;
  for (const j of due) {
    const handler = handlers[j.kind];
    db.prepare("UPDATE background_jobs SET status='running', attempts=attempts+1, updated_at=? WHERE id=?").run(now(), j.id);
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

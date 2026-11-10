// Workpile — webhook delivery worker (§14.3/§14.5, §26 outbox discipline)
// Delivers final-outcome payloads to the customer's registered endpoints, HMAC-signed.
// Retries with backoff bookkeeping; a delivery is only "delivered" on a real 2xx from
// their endpoint — never assumed. Failed after max attempts → DLQ state, replayable.
import { createHmac } from "node:crypto";
import { db, now } from "./db.ts";
import { outcomePayload } from "./app.ts";
import { processEventDeliveries } from "./integrations.ts";
import { processFollowups } from "./followups.ts";
import { processJobs } from "./jobs.ts";
import { relayOutbox } from "./outbox.ts";
const JOB_HANDLERS: Record<string, (p: any) => Promise<void>> = { "push.notify": async (p: any) => { const m = await import("./push.ts"); await m.sendPush(p.userIds || [], p.title || "", p.body || ""); } };
import { processAutomations } from "./ai.ts";
import { chaseMissing } from "./timesheets.ts";
import { chaseMissingReports } from "./fieldreports.ts";

export const MAX_ATTEMPTS = 5;
export function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

type FetchFn = (url: string, opts: any) => Promise<{ status: number }>;

export async function processDeliveries(fetchFn: FetchFn = fetch as any): Promise<{ delivered: number; failed: number; skipped: number }> {
  let delivered = 0, failed = 0, skipped = 0;
  const pending = db.prepare("SELECT * FROM outcome_deliveries WHERE last_status IN ('pending','failed') AND attempts < ?").all(MAX_ATTEMPTS) as any[];
  for (const d of pending) {
    const endpoints = db.prepare("SELECT * FROM webhook_endpoints WHERE workspace_id=? AND active=1").all(d.workspace_id) as any[];
    if (!endpoints.length) { skipped++; continue; } // pull-API mode: stays pending until they fetch/ack — correct state, not an error
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(d.lead_id) as any;
    if (!lead) { skipped++; continue; }
    const payload = { delivery_id: d.id, type: "lead.finalized", ...outcomePayload(lead) };
    const body = JSON.stringify(payload);
    let ok = false, lastErr = "";
    for (const ep of endpoints) {
      try {
        const r = await fetchFn(ep.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Workpile-Signature": signPayload(ep.secret || "", body), "X-Workpile-Delivery": d.id }, body });
        if (r.status >= 200 && r.status < 300) ok = true; else lastErr = `HTTP ${r.status} from ${ep.url}`;
      } catch (e: any) { lastErr = String(e?.message || e); }
    }
    const attempts = d.attempts + 1;
    if (ok) {
      db.prepare("UPDATE outcome_deliveries SET last_status='delivered', attempts=?, delivered_at=?, last_error=NULL WHERE id=?").run(attempts, now(), d.id);
      db.prepare("UPDATE projects SET handoff_status='delivered', handoff_delivered_at=? WHERE lead_id=?").run(now(), d.lead_id);
      delivered++;
    } else {
      const status = attempts >= MAX_ATTEMPTS ? "dead_letter" : "failed";
      db.prepare("UPDATE outcome_deliveries SET last_status=?, attempts=?, last_error=? WHERE id=?").run(status, attempts, lastErr, d.id);
      failed++;
    }
  }
  return { delivered, failed, skipped };
}

export function replayDelivery(deliveryId: string): boolean {
  const r = db.prepare("UPDATE outcome_deliveries SET last_status='pending', attempts=0, last_error=NULL WHERE id=?").run(deliveryId) as any;
  return r.changes > 0;
}

let timer: any = null;
export function startWorker(intervalMs = 15000) {
  if (timer) return;
  timer = setInterval(() => { processDeliveries().catch(() => {}); processEventDeliveries().catch(() => {}); processFollowups(process.env.BASE_URL || "").catch(() => {}); try { processAutomations(); } catch {} try { chaseMissing(); } catch {} try { chaseMissingReports(); } catch {} processJobs(JOB_HANDLERS).catch(() => {}); try { relayOutbox(); } catch {} }, intervalMs);
  timer.unref?.();
}

// Workpile — integration fabric (slice 7): event webhooks + Slack + two-way API helpers.
// Events fan out to every active endpoint subscribed to that event; deliveries are
// HMAC-signed (X-Workpile-Signature) and only marked delivered on a real 2xx.
import { db, uid, now } from "./db.ts";
import { createHmac } from "node:crypto";

export const EVENTS = ["lead.created", "lead.state_changed", "approval.decided", "proposal.signed", "deposit.paid", "outcome.final"];
export function signPayload(secret: string, body: string) { return createHmac("sha256", secret || "no-secret").update(body).digest("hex"); }

export function emitEvent(workspaceId: string, event: string, payload: any) {
  const eps = db.prepare("SELECT * FROM webhook_endpoints WHERE workspace_id=? AND active=1").all(workspaceId) as any[];
  const body = JSON.stringify({ event, workspace_id: workspaceId, occurred_at: now(), data: payload });
  for (const ep of eps) {
    const subs = String(ep.events || "outcome.final").split(",").map((x: string) => x.trim());
    if (!subs.includes(event) && !subs.includes("*") && !(event === "outcome.final" && subs.includes("lead.finalized"))) continue;
    db.prepare("INSERT INTO webhook_deliveries (id,workspace_id,endpoint_id,event,payload,created_at) VALUES (?,?,?,?,?,?)").run(uid("whd"), workspaceId, ep.id, event, body, now());
  }
  if (event === "lead.created" || event === "approval.decided") notifySlack(workspaceId, event, payload);
}

export function notifySlack(workspaceId: string, event: string, payload: any) {
  const ws = db.prepare("SELECT slack_webhook_url FROM workspaces WHERE id=?").get(workspaceId) as any;
  if (!ws?.slack_webhook_url) return;
  const text = event === "lead.created"
    ? `🆕 New lead in Workpile: ${payload.contact_name || "Unknown"} — ${payload.service_requested || "service"} (${payload.state || "NEW"})`
    : `✅ Approval decided in Workpile: lead ${payload.lead_id} → ${payload.decision}`;
  fetch(ws.slack_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => {});
}

type FetchFn = (url: string, init?: any) => Promise<{ status: number }>;
export async function processEventDeliveries(fetchFn: FetchFn = fetch as any): Promise<{ delivered: number; failed: number }> {
  const rows = db.prepare("SELECT d.*, e.url, e.secret FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE d.last_status IN ('pending','retrying') AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=?) ORDER BY d.created_at LIMIT 25").all(now()) as any[];
  let delivered = 0, failed = 0;
  for (const d of rows) {
    try {
      const r = await fetchFn(d.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Workpile-Signature": signPayload(d.secret || "", d.payload), "X-Workpile-Timestamp": String(Math.floor(Date.now() / 1000)), "X-Workpile-Signature-V2": (() => { const ts = String(Math.floor(Date.now() / 1000)); return `t=${ts},v1=${signPayload(d.secret || "", ts + "." + d.payload)}`; })(), "X-Workpile-Delivery": d.id, "X-Workpile-Event": d.event }, body: d.payload });
      if (r.status >= 200 && r.status < 300) { db.prepare("UPDATE webhook_deliveries SET last_status='delivered', delivered_at=?, attempts=attempts+1 WHERE id=?").run(now(), d.id); delivered++; }
      else throw new Error("HTTP " + r.status);
    } catch (e: any) {
      const attempts = (d.attempts || 0) + 1;
      const dead = attempts >= 5;
      db.prepare("UPDATE webhook_deliveries SET last_status=?, attempts=?, last_error=?, next_attempt_at=? WHERE id=?").run(dead ? "dead_letter" : "retrying", attempts, String(e.message || e), new Date(Date.now() + Math.min(3600000, 30000 * 2 ** attempts)).toISOString(), d.id);
      failed++;
    }
  }
  return { delivered, failed };
}

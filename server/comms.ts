// Workpile — outbound comms (§26 comms center, slice 8).
// Email via Resend when RESEND_API_KEY is set; SMS via Twilio when TWILIO_* are set.
// Without provider keys the transport is TEST MODE: messages are recorded in the
// outbox with status 'test_mode' — composed and visible, NEVER claimed as sent.
import { db, uid, now } from "./db.ts";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

export function queueMessage(workspaceId: string, m: { lead_id?: string; channel: "email" | "sms"; to: string; subject?: string; body: string }) {
  const id = uid("msg");
  db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, m.lead_id || null, m.channel, m.to, m.subject || null, m.body, now());
  return id;
}

type FetchFn = (url: string, init?: any) => Promise<{ status: number; json: () => Promise<any> }>;
export async function deliverMessage(id: string, fetchFn: FetchFn = fetch as any): Promise<any> {
  const m = db.prepare("SELECT * FROM messages_outbox WHERE id=?").get(id) as any;
  if (!m || m.status === "sent") return m;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(m.workspace_id) as any;
  try {
    if (m.channel === "email") {
      if (!emailConfigured()) { db.prepare("UPDATE messages_outbox SET status='test_mode', provider='resend' WHERE id=?").run(id); return { ...m, status: "test_mode" }; }
      const r = await fetchFn("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: ws.from_email ? `${ws.from_name || ws.name} <${ws.from_email}>` : `Workpile <noreply@workpile.io>`, to: [m.to_addr], subject: m.subject || "Message from " + ws.name, text: m.body }) });
      const j = await r.json().catch(() => ({}));
      if (r.status >= 200 && r.status < 300) { db.prepare("UPDATE messages_outbox SET status='sent', provider='resend', provider_id=?, sent_at=? WHERE id=?").run(j.id || "", now(), id); return { ...m, status: "sent" }; }
      throw new Error("Resend HTTP " + r.status + " " + JSON.stringify(j).slice(0, 120));
    } else {
      if (!smsConfigured()) { db.prepare("UPDATE messages_outbox SET status='test_mode', provider='twilio' WHERE id=?").run(id); return { ...m, status: "test_mode" }; }
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const form = new URLSearchParams({ From: process.env.TWILIO_FROM!, To: m.to_addr, Body: m.body });
      const r = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      const j = await r.json().catch(() => ({}));
      if (r.status >= 200 && r.status < 300) { db.prepare("UPDATE messages_outbox SET status='sent', provider='twilio', provider_id=?, sent_at=? WHERE id=?").run(j.sid || "", now(), id); return { ...m, status: "sent" }; }
      throw new Error("Twilio HTTP " + r.status);
    }
  } catch (e: any) {
    db.prepare("UPDATE messages_outbox SET status='failed', error=? WHERE id=?").run(String(e.message || e).slice(0, 300), id);
    return { ...m, status: "failed", error: String(e.message || e) };
  }
}

export async function queueAndDeliver(workspaceId: string, m: { lead_id?: string; channel: "email" | "sms"; to: string; subject?: string; body: string }) {
  const id = queueMessage(workspaceId, m);
  return deliverMessage(id);
}

// ---- notifications ----
export function notify(workspaceId: string, userIds: (string | null | undefined)[], type: string, title: string, body: string, leadId?: string) {
  const targets = [...new Set(userIds.filter(Boolean))] as string[];
  for (const u of targets) db.prepare("INSERT INTO notifications (id,workspace_id,user_id,type,title,body,lead_id,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("ntf"), workspaceId, u, type, title, body, leadId || null, now());
  if (targets.length) import("./push.ts").then(m => m.sendPush(targets, title, body).catch(() => {})).catch(() => {});
}
export function notifyOwners(workspaceId: string, type: string, title: string, body: string, leadId?: string) {
  const owners = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role IN ('OWNER','APPROVER') AND active=1").all(workspaceId) as any[];
  notify(workspaceId, owners.map(o => o.id), type, title, body, leadId);
}

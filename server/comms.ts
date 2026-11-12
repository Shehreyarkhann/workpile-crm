// Workpile — outbound comms (§26 comms center, slice 8).
// Email via Resend when RESEND_API_KEY is set; SMS via Twilio when TWILIO_* are set.
// Without provider keys the transport is TEST MODE: messages are recorded in the
// outbox with status 'test_mode' — composed and visible, NEVER claimed as sent.
import { db, uid, now } from "./db.ts";
import { enqueueJob } from "./jobs.ts";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

export function suppressionFor(workspaceId: string, channel: string, to: string): any {
  const kind = channel === "sms" ? "phone" : "email";
  const value = kind === "email" ? String(to || "").toLowerCase().trim() : String(to || "").replace(/\D/g, "");
  if (!value) return null;
  return db.prepare("SELECT * FROM suppressions WHERE workspace_id=? AND kind=? AND value=?").get(workspaceId, kind, value) || null;
}

export type AttachRef = { kind: "attachment" | "proposal" | "invoice"; id: string; name?: string };
export function validateAttachRefs(workspaceId: string, refs: any): AttachRef[] {
  if (!Array.isArray(refs)) return [];
  const out: AttachRef[] = [];
  for (const r of refs.slice(0, 6)) {
    if (!r || typeof r.id !== "string") continue;
    if (r.kind === "attachment") { const a = db.prepare("SELECT id, name FROM attachments WHERE id=? AND workspace_id=?").get(r.id, workspaceId) as any; if (a) out.push({ kind: "attachment", id: a.id, name: a.name }); }
    else if (r.kind === "proposal") { const p = db.prepare("SELECT id FROM proposals WHERE id=? AND workspace_id=?").get(r.id, workspaceId) as any; if (p) out.push({ kind: "proposal", id: p.id }); }
    else if (r.kind === "invoice") { const i = db.prepare("SELECT id FROM invoices WHERE id=? AND workspace_id=?").get(r.id, workspaceId) as any; if (i) out.push({ kind: "invoice", id: i.id }); }
  }
  return out;
}
export async function resolveAttachments(workspaceId: string, refs: AttachRef[]): Promise<{ filename: string; content: string }[]> {
  const { storageGet } = await import("./storage.ts");
  const out: { filename: string; content: string }[] = [];
  let total = 0;
  for (const r of refs) {
    try {
      let buf: Buffer | null = null; let name = r.name || "file";
      if (r.kind === "attachment") { const a = db.prepare("SELECT * FROM attachments WHERE id=? AND workspace_id=?").get(r.id, workspaceId) as any; if (!a) continue; buf = storageGet(a.storage_key); name = a.name; }
      else if (r.kind === "proposal") { const { proposalDocx } = await import("./docx.ts"); const d = await proposalDocx(r.id); if (!d) continue; buf = d.buffer; name = d.filename; }
      else if (r.kind === "invoice") { const { invoiceDocx } = await import("./docx.ts"); const inv = db.prepare("SELECT token FROM invoices WHERE id=?").get(r.id) as any; const d = await invoiceDocx(r.id, `${process.env.BASE_URL || ""}/invoice/${inv?.token || ""}`); if (!d) continue; buf = d.buffer; name = d.filename; }
      if (!buf) continue;
      total += buf.length; if (total > 6_000_000) break;
      out.push({ filename: name, content: buf.toString("base64") });
    } catch { /* a missing file never blocks the message */ }
  }
  return out;
}

export function queueMessage(workspaceId: string, m: { lead_id?: string; channel: "email" | "sms"; to: string; subject?: string; body: string; attachments?: AttachRef[]; from_email?: string; transactional?: boolean; track?: boolean }) {
  const id = uid("msg");
  // Central send boundary (v17): SMS consent is enforced HERE so every caller — UI, nudge,
  // cadences, agent tools — inherits it. No path can text a lead that has not consented.
  if (m.channel === "sms" && m.lead_id && !m.transactional) {
    const ld = db.prepare("SELECT consent_contact_ok FROM leads WHERE id=? AND workspace_id=?").get(m.lead_id, workspaceId) as any;
    if (ld && !ld.consent_contact_ok) {
      db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,status,error,created_at) VALUES (?,?,?,?,?,?,?, 'blocked_consent', ?, ?)")
        .run(id, workspaceId, m.lead_id, m.channel, m.to, m.subject || null, m.body, "TCPA: lead has not consented to SMS", now());
      return id;
    }
  }
  const sup = suppressionFor(workspaceId, m.channel, m.to);
  if (sup) {
    db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,status,error,created_at) VALUES (?,?,?,?,?,?,?, 'suppressed', ?, ?)")
      .run(id, workspaceId, m.lead_id || null, m.channel, m.to, m.subject || null, m.body, `suppressed: ${sup.reason || sup.source || "on suppression list"}`, now());
    return id;
  }
  db.prepare("INSERT INTO messages_outbox (id,workspace_id,lead_id,channel,to_addr,subject,body,attachments,created_at,from_addr,track_token) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, m.lead_id || null, m.channel, m.to, m.subject || null, m.body, m.attachments && m.attachments.length ? JSON.stringify(m.attachments) : null, now(), m.from_email || null, m.track ? uid("trk") : null);
  return id;
}

type FetchFn = (url: string, init?: any) => Promise<{ status: number; json: () => Promise<any> }>;
export async function deliverMessage(id: string, fetchFn: FetchFn = fetch as any): Promise<any> {
  const existing = db.prepare("SELECT * FROM messages_outbox WHERE id=?").get(id) as any;
  if (existing && existing.status && existing.status !== "queued") return existing;
  const m = db.prepare("SELECT * FROM messages_outbox WHERE id=?").get(id) as any;
  if (!m || m.status === "sent") return m;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(m.workspace_id) as any;
  try {
    if (m.channel === "email") {
      if (!emailConfigured()) { db.prepare("UPDATE messages_outbox SET status='test_mode', provider='resend' WHERE id=?").run(id); return { ...m, status: "test_mode" }; }
      let atts: { filename: string; content: string }[] = [];
      try { if ((m as any).attachments) atts = await resolveAttachments(m.workspace_id, JSON.parse((m as any).attachments)); } catch { atts = []; }
      const tok = (m as any).track_token as string | null;
      let html: string | undefined;
      if (tok) { const base = process.env.BASE_URL || "https://workpile.claimpaid.io"; const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const linked = esc(m.body).replace(/https?:\/\/[^\s<]+/g, (u: string) => `<a href="${base}/t/c/${tok}?u=${encodeURIComponent(u)}">${u}</a>`);
        html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#101613">${linked.replace(/\n/g, "<br>")}<br><br>—<br>${esc(ws.name)} · You're receiving this because you requested a proposal or service from ${esc(ws.name)}. Reply STOP to stop follow-up messages.<img src="${base}/t/o/${tok}.gif" width="1" height="1" alt="" style="display:none"></div>`; }
      const r = await fetchFn("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: (m as any).from_addr ? `${ws.from_name || ws.name} <${(m as any).from_addr}>` : ws.from_email ? `${ws.from_name || ws.name} <${ws.from_email}>` : `Workpile <noreply@workpile.io>`, ...(ws.reply_email ? { reply_to: ws.reply_email } : {}), to: [m.to_addr], subject: m.subject || "Message from " + ws.name, text: m.body + `\n\n—\n${ws.name} · You're receiving this because you requested a proposal or service from ${ws.name}. Reply STOP to stop follow-up messages.`, ...(html ? { html } : {}), ...(atts.length ? { attachments: atts } : {}) }) });
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

export async function queueAndDeliver(workspaceId: string, m: { lead_id?: string; channel: "email" | "sms"; to: string; subject?: string; body: string; attachments?: AttachRef[]; from_email?: string; transactional?: boolean; track?: boolean }) {
  const id = queueMessage(workspaceId, m);
  return deliverMessage(id);
}

// ---- notifications ----
export function notify(workspaceId: string, userIds: (string | null | undefined)[], type: string, title: string, body: string, leadId?: string, entity?: { type: string; id: string }) {
  const targets = [...new Set(userIds.filter(Boolean))] as string[];
  for (const u of targets) db.prepare("INSERT INTO notifications (id,workspace_id,user_id,type,title,body,lead_id,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(uid("ntf"), workspaceId, u, type, title, body, leadId || null, entity ? entity.type : (leadId ? "lead" : null), entity ? entity.id : (leadId || null), now());
  if (targets.length) { try { enqueueJob("push.notify", { userIds: targets, title, body }); } catch { /* queue unavailable: in-app notification already stored */ } }
}
export function notifyOwners(workspaceId: string, type: string, title: string, body: string, leadId?: string, entity?: { type: string; id: string }) {
  const owners = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role IN ('OWNER','APPROVER') AND active=1").all(workspaceId) as any[];
  notify(workspaceId, owners.map(o => o.id), type, title, body, leadId, entity);
}

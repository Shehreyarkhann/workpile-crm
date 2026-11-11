// Workpile — outreach campaign engine (v42, Tranche 1 of the Instantly scope).
// Sendable campaigns: multi-step sequences over the workspace's OWN leads, with
// A/B variants per step, spintax, variables with fallbacks, sending windows,
// daily caps with optional slow ramp, and stop-on-reply. Every send goes through
// the comms boundary (queueAndDeliver) so consent, suppressions, quiet hours and
// honest delivery states apply exactly as everywhere else. A campaign only sends
// after a human launches it — the launch IS the approval for its reviewed steps.
import { db, uid, now } from "./db.ts";
import { queueAndDeliver } from "./comms.ts";
import { addBusinessDays } from "./followups.ts";

const FINALS = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];

// ---------- rendering: spintax + fallbacks + variables, deterministic per seed ----------
function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); }
export function pickVariantIndex(seedKey: string, count: number): number { if (count <= 1) return 0; return hashSeed(seedKey) % count; }

// Renders {{RANDOM | a | b}} / {{SPINTAX | a | b}} spintax, {{var | fallback}} and
// {{var}} / {var} substitutions. Deterministic for a given seed so a lead's copy
// never re-randomizes between preview, send and retry.
export function renderOutreach(tpl: string, vars: Record<string, string>, seedKey = ""): string {
  let out = String(tpl || "");
  out = out.replace(/\{\{\s*(?:RANDOM|SPINTAX)\s*\|([^}]*)\}\}/gi, (_m, opts: string) => {
    const parts = opts.split("|").map(s => s.trim()).filter(s => s.length);
    if (!parts.length) return "";
    return parts[pickVariantIndex(seedKey + "::spin::" + _m.length + "::" + parts.join("~"), parts.length)];
  });
  out = out.replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (_m, k: string, fb?: string) => {
    const v = vars[k]; if (v !== undefined && v !== "") return v;
    return fb !== undefined ? fb.trim() : "";
  });
  out = out.replace(/\{(\w+)\}/g, (_m, k: string) => vars[k] ?? "");
  return out;
}
export function outreachVars(ws: any, lead: any, contact: any): Record<string, string> {
  const full = String(contact?.name || "").trim();
  const first = full ? full.split(/\s+/)[0] : "";
  let company = "";
  try { const cf = JSON.parse(lead?.custom || "{}"); company = cf.company || cf.business || ""; } catch { /* no custom fields */ }
  if (!company && lead?.account_id) { const a = db.prepare("SELECT name FROM accounts WHERE id=?").get(lead.account_id) as any; company = a?.name || ""; }
  return {
    first_name: first, name: full || first, email: contact?.email || "", phone: contact?.phone || "",
    company, service: lead?.service_requested || "", business: ws?.name || "", from_name: ws?.from_name || ws?.name || "",
    city: lead?.city || "", state: lead?.state || "",
  };
}
export function unresolvedVars(tpl: string, vars: Record<string, string>): string[] {
  const missing = new Set<string>();
  for (const m of String(tpl || "").matchAll(/\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}|\{(\w+)\}/g)) {
    const k = m[1] || m[2]; if (k && vars[k] === undefined) missing.add(k);
  }
  return [...missing];
}

// ---------- sending windows, caps, ramp ----------
export function tzHourDay(d: Date, tz: string): { hour: number; dow: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, weekday: "short", timeZone: tz }).formatToParts(d);
    const hour = Number(parts.find(p => p.type === "hour")?.value ?? d.getHours());
    const wd = parts.find(p => p.type === "weekday")?.value || "";
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    return { hour: hour % 24, dow: dow < 0 ? d.getDay() : dow };
  } catch { return { hour: d.getHours(), dow: d.getDay() }; }
}
export function sendDaysOf(c: any): number[] {
  const raw = String(c.send_days || "1,2,3,4,5").split(",").map(s => Number(s.trim())).filter(n => n >= 0 && n <= 6);
  return raw.length ? raw : [1, 2, 3, 4, 5];
}
export function withinWindow(c: any, d: Date, tz: string): boolean {
  const { hour, dow } = tzHourDay(d, tz);
  return sendDaysOf(c).includes(dow) && hour >= (c.window_start ?? 9) && hour < (c.window_end ?? 17);
}
// Next moment >= from that falls inside the campaign's sending window (same clock time-of-day preserved when possible).
export function nextWindowSlot(c: any, from: Date, tz: string): Date {
  const d = new Date(from);
  for (let i = 0; i < 10; i++) {
    const { hour, dow } = tzHourDay(d, tz);
    if (sendDaysOf(c).includes(dow)) {
      if (hour < (c.window_start ?? 9)) { d.setHours(d.getHours() + ((c.window_start ?? 9) - hour)); return d; }
      if (hour < (c.window_end ?? 17)) return d;
    }
    d.setDate(d.getDate() + 1); d.setHours(c.window_start ?? 9, 0, 0, 0);
  }
  return d;
}
export function effectiveCap(c: any, on: Date): number {
  const cap = Math.max(1, Number(c.daily_cap) || 50);
  if (c.ramp_start == null || !c.launched_at) return cap;
  const days = Math.max(0, Math.floor((on.getTime() - new Date(c.launched_at).getTime()) / 86400000));
  return Math.max(1, Math.min(cap, Number(c.ramp_start) + days * (Number(c.ramp_step) || 10)));
}
export function sentToday(campaignId: string, on: Date): number {
  const day = on.toISOString().slice(0, 10);
  return (db.prepare("SELECT COUNT(*) n FROM campaign_sends WHERE campaign_id=? AND substr(created_at,1,10)=?").get(campaignId, day) as any).n || 0;
}

// ---------- enrollment ----------
export function enrollLead(campaign: any, leadId: string, firstDue: Date): boolean {
  const r = db.prepare("INSERT OR IGNORE INTO campaign_enrollments (id,workspace_id,campaign_id,lead_id,status,step_idx,next_due_at,variants,sent_count,fail_count,created_at,updated_at) VALUES (?,?,?,?, 'active', 0, ?, '{}', 0, 0, ?, ?)").run(uid("cen"), campaign.workspace_id, campaign.id, leadId, firstDue.toISOString(), now(), now());
  return !!r.changes;
}
export function stopOutreachForLead(leadId: string, reason: string) {
  db.prepare("UPDATE campaign_enrollments SET status=?, stop_reason=?, updated_at=? WHERE lead_id=? AND status='active'").run(reason === "customer_replied" ? "replied" : "stopped", reason, now(), leadId);
}
function leadRepliedSince(lead: any, sinceIso: string): boolean {
  const m = db.prepare("SELECT id FROM messages_outbox WHERE lead_id=? AND direction='in' AND created_at>? LIMIT 1").get(lead.id, sinceIso) as any;
  if (m) return true;
  const email = (db.prepare("SELECT email FROM contacts WHERE id=?").get(lead.contact_id) as any)?.email;
  if (email) { const it = db.prepare("SELECT id FROM inbox_items WHERE workspace_id=? AND lower(from_email)=lower(?) AND created_at>? LIMIT 1").get(lead.workspace_id, email, sinceIso) as any; if (it) return true; }
  return false;
}

// ---------- the processor (worker tick) ----------
export async function processCampaigns(_baseUrl = ""): Promise<{ sent: number; stopped: number; deferred: number }> {
  const due = db.prepare("SELECT e.* FROM campaign_enrollments e JOIN campaigns c ON c.id=e.campaign_id WHERE e.status='active' AND e.next_due_at<=? AND c.kind='outreach' AND c.status='active' ORDER BY e.next_due_at LIMIT 25").all(now()) as any[];
  let sent = 0, stopped = 0, deferred = 0;
  const capChecked = new Map<string, number>();
  for (const e of due) {
    const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(e.campaign_id) as any;
    const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(e.workspace_id) as any;
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(e.lead_id) as any;
    if (!c || !ws || !lead) { db.prepare("UPDATE campaign_enrollments SET status='stopped', stop_reason='gone', updated_at=? WHERE id=?").run(now(), e.id); stopped++; continue; }
    if (FINALS.includes(lead.state)) { db.prepare("UPDATE campaign_enrollments SET status='stopped', stop_reason='finalized', updated_at=? WHERE id=?").run(now(), e.id); stopped++; continue; }
    if (c.stop_on_reply !== 0 && leadRepliedSince(lead, e.created_at)) { db.prepare("UPDATE campaign_enrollments SET status='replied', stop_reason='customer_replied', updated_at=? WHERE id=?").run(now(), e.id); stopped++; continue; }
    const tz = ws.tz || "America/New_York";
    const at = new Date();
    if (!withinWindow(c, at, tz)) { db.prepare("UPDATE campaign_enrollments SET next_due_at=?, updated_at=? WHERE id=?").run(nextWindowSlot(c, at, tz).toISOString(), now(), e.id); deferred++; continue; }
    if (!capChecked.has(c.id)) capChecked.set(c.id, sentToday(c.id, at));
    if (capChecked.get(c.id)! >= effectiveCap(c, at)) { db.prepare("UPDATE campaign_enrollments SET next_due_at=?, updated_at=? WHERE id=?").run(nextWindowSlot(c, new Date(at.getTime() + 86400000), tz).toISOString(), now(), e.id); deferred++; continue; }
    const steps = db.prepare("SELECT * FROM campaign_steps WHERE campaign_id=? ORDER BY position").all(c.id) as any[];
    const step = steps[e.step_idx];
    if (!step) { db.prepare("UPDATE campaign_enrollments SET status='done', updated_at=? WHERE id=?").run(now(), e.id); continue; }
    const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any;
    const to = step.channel === "sms" ? contact?.phone : contact?.email;
    if (!to || (step.channel === "sms" && !lead.consent_contact_ok)) {
      // no destination / no consent for this step: skip it, keep the sequence moving
    } else {
      // variant assignment: step body = variant 0; step.variants holds B..N
      let variants: any[] = []; try { variants = JSON.parse(step.variants || "[]"); } catch { /* none */ }
      const all = [{ subject: step.subject || "", body: step.body || "" }, ...variants];
      let assigned: Record<string, number> = {}; try { assigned = JSON.parse(e.variants || "{}"); } catch { /* fresh */ }
      if (assigned[e.step_idx] === undefined) { assigned[e.step_idx] = pickVariantIndex(e.id + "::step" + e.step_idx, all.length); db.prepare("UPDATE campaign_enrollments SET variants=? WHERE id=?").run(JSON.stringify(assigned), e.id); }
      const vIdx = Math.min(assigned[e.step_idx], all.length - 1);
      const vars = outreachVars(ws, lead, contact);
      const seed = e.id + "::step" + e.step_idx + "::v" + vIdx;
      const body = renderOutreach(all[vIdx].body, vars, seed);
      const subject = step.channel === "email" ? renderOutreach(all[vIdx].subject || "", vars, seed) : undefined;
      const delivered = await queueAndDeliver(e.workspace_id, { lead_id: lead.id, channel: step.channel, to, subject, body });
      if (delivered && delivered.status === "suppressed") { db.prepare("UPDATE campaign_enrollments SET status='stopped', stop_reason='suppressed', updated_at=? WHERE id=?").run(now(), e.id); stopped++; continue; }
      if (!delivered || !["sent", "delivered", "test_mode"].includes(delivered.status)) {
        const fails = (e.fail_count || 0) + 1;
        if (fails >= 3) { db.prepare("UPDATE campaign_enrollments SET status='stopped', stop_reason='delivery_failed', fail_count=?, updated_at=? WHERE id=?").run(fails, now(), e.id); stopped++; }
        else db.prepare("UPDATE campaign_enrollments SET fail_count=?, next_due_at=?, updated_at=? WHERE id=?").run(fails, new Date(Date.now() + 6 * 3600000).toISOString(), now(), e.id);
        continue;
      }
      db.prepare("INSERT INTO campaign_sends (id,workspace_id,campaign_id,enrollment_id,lead_id,step_idx,variant,message_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("csnd"), e.workspace_id, c.id, e.id, lead.id, e.step_idx, vIdx, (delivered as any).id || null, now());
      capChecked.set(c.id, (capChecked.get(c.id) || 0) + 1);
      sent++;
    }
    const next = steps[e.step_idx + 1];
    if (next) db.prepare("UPDATE campaign_enrollments SET step_idx=?, sent_count=sent_count+1, fail_count=0, next_due_at=?, updated_at=? WHERE id=?").run(e.step_idx + 1, addBusinessDays(new Date(), Math.max(1, Number(next.delay_days) || 1)).toISOString(), now(), e.id);
    else db.prepare("UPDATE campaign_enrollments SET status='done', sent_count=sent_count+1, fail_count=0, updated_at=? WHERE id=?").run(now(), e.id);
  }
  return { sent, stopped, deferred };
}

// ---------- stats ----------
export function campaignOutreachStats(campaignId: string) {
  const steps = db.prepare("SELECT * FROM campaign_steps WHERE campaign_id=? ORDER BY position").all(campaignId) as any[];
  const sends = db.prepare("SELECT step_idx, variant, COUNT(*) n FROM campaign_sends WHERE campaign_id=? GROUP BY step_idx, variant").all(campaignId) as any[];
  const replies = db.prepare("SELECT COUNT(*) n FROM campaign_enrollments WHERE campaign_id=? AND status='replied'").get(campaignId) as any;
  const byStatus = db.prepare("SELECT status, COUNT(*) n FROM campaign_enrollments WHERE campaign_id=? GROUP BY status").all(campaignId) as any[];
  const perStep = steps.map((s, i) => {
    const rows = sends.filter(r => r.step_idx === i);
    const total = rows.reduce((a, r) => a + r.n, 0);
    let variants: any[] = []; try { variants = JSON.parse(s.variants || "[]"); } catch { /* none */ }
    return { step_idx: i, channel: s.channel, subject: s.subject, sent: total, variants: [{ variant: 0, sent: rows.find(r => r.variant === 0)?.n || 0 }, ...variants.map((_v: any, vi: number) => ({ variant: vi + 1, sent: rows.find(r => r.variant === vi + 1)?.n || 0 }))] };
  });
  const totalSent = sends.reduce((a, r) => a + r.n, 0);
  return { steps: perStep, total_sent: totalSent, replies: replies.n || 0, reply_rate: totalSent ? Math.round(((replies.n || 0) / totalSent) * 1000) / 10 : null, enrollments: Object.fromEntries(byStatus.map(r => [r.status, r.n])) };
}

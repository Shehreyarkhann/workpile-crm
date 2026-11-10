// Workpile — follow-up cadences (slice 9, competitive audit P0).
// Staged, pre-approved nudges on sent proposals (the Jobber/Housecall Pro pattern):
// Day 2 email → Day 5 SMS → Day 10 email by default; steps are workspace-configurable.
// Auto-stops the moment the customer signs, the lead finalizes, or the sequence is
// stopped manually. Every send goes through the comms outbox (test-mode honest).
import { db, uid, now } from "./db.ts";
import { queueAndDeliver } from "./comms.ts";
import { ensureSignToken } from "./sign.ts";

// v3 slice 34: 12-touch persistence (Hatch pattern) — deals die from under-touching.
// Days are BUSINESS days (follow-up timers never burn nights/weekends).
export const DEFAULT_STEPS = [
  { day: 0, channel: "email", template: "Hi {name}, your proposal from {business} is ready — total {total}. Review & sign here: {link}" },
  { day: 1, channel: "sms", template: "{business}: hi {name} — your proposal ({total}) is ready when you are: {link}" },
  { day: 3, channel: "email", template: "Hi {name}, floating your {business} proposal ({total}) back up — any questions I can answer? {link}" },
  { day: 5, channel: "sms", template: "{business}: still holding your slot, {name}. Proposal: {link}" },
  { day: 8, channel: "email", template: "Hi {name} — quick check-in on the {business} proposal ({total}). If scope or timing needs adjusting, tell me and we'll rework it: {link}" },
  { day: 12, channel: "sms", template: "{business}: {name}, want us to keep this proposal open? Reply YES and we will. {link}" },
  { day: 18, channel: "email", template: "Hi {name}, checking in from {business} — your proposal ({total}) is still open here: {link}. No pressure either way; a reply helps us plan the schedule." },
  { day: 26, channel: "sms", template: "{business}: last regular check-in, {name} — proposal {total}: {link}" },
  { day: 35, channel: "email", template: "Hi {name} — seasons change schedules. If the work in your {business} proposal is still on your list, we're ready: {link}" },
  { day: 45, channel: "sms", template: "{business}: {name}, closing the loop soon on your proposal — {link}" },
  { day: 60, channel: "email", template: "Hi {name}, final note from {business} on this proposal ({total}): {link}. If it's a no for now, that's fine — we'll be here when it matters." },
  { day: 75, channel: "email", template: "Hi {name} — archiving your {business} proposal after this note. Anything changes, one reply reopens it with the same pricing conversation: {link}" },
];
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from); let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) added++; }
  d.setHours(13, 0, 0, 0); // ~8am ET — start of the business day, never 2am
  return d;
}
export function stepsFor(ws: any): any[] {
  try { const p = JSON.parse(ws.followup_steps || "null"); if (Array.isArray(p) && p.length) return p; } catch {}
  return DEFAULT_STEPS;
}
const FINALS = ["WON", "LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"];

export function enrollFollowup(workspaceId: string, leadId: string, proposalId: string) {
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId) as any;
  if (!ws?.followup_enabled) return null;
  const existing = db.prepare("SELECT id FROM followup_enrollments WHERE lead_id=? AND status='active'").get(leadId);
  if (existing) return null;
  const steps = stepsFor(ws);
  const id = uid("fup");
  db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, leadId, proposalId, 0, addBusinessDays(new Date(), steps[0].day).toISOString(), now(), now());
  return id;
}
export function stopFollowups(leadId: string, reason: string) {
  db.prepare("UPDATE followup_enrollments SET status='stopped', stop_reason=?, updated_at=? WHERE lead_id=? AND status='active'").run(reason, now(), leadId);
}
export function render(tpl: string, vars: Record<string, string>) { return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`); }

export async function processFollowups(baseUrl = ""): Promise<{ sent: number; stopped: number }> {
  const due = db.prepare("SELECT * FROM followup_enrollments WHERE status='active' AND next_due_at<=? ORDER BY next_due_at LIMIT 25").all(now()) as any[];
  let sent = 0, stopped = 0;
  for (const e of due) {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(e.lead_id) as any;
    const prop = db.prepare("SELECT * FROM proposals WHERE id=?").get(e.proposal_id) as any;
    if (!lead || !prop || FINALS.includes(lead.state) || prop.status === "signed") { stopFollowups(e.lead_id, !lead ? "lead_gone" : prop?.status === "signed" ? "signed" : "finalized"); stopped++; continue; }
    const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(e.workspace_id) as any;
    const steps = stepsFor(ws);
    const step = steps[e.step_idx];
    if (!step) { db.prepare("UPDATE followup_enrollments SET status='done', updated_at=? WHERE id=?").run(now(), e.id); continue; }
    const c = db.prepare("SELECT name, phone, email FROM contacts WHERE id=?").get(lead.contact_id) as any;
    const to = step.channel === "sms" ? c?.phone : c?.email;
    if (!to || (step.channel === "sms" && !lead.consent_contact_ok)) {
      // skip this step (no destination / no consent), advance schedule
    } else {
      const token = ensureSignToken(prop.id);
      const body = render(step.template, { name: (c?.name || "there").split(" ")[0], business: ws.name, total: "$" + prop.total, link: `${baseUrl}/sign/${token}` });
      await queueAndDeliver(e.workspace_id, { lead_id: lead.id, channel: step.channel, to, subject: step.channel === "email" ? `Following up on your proposal from ${ws.name}` : undefined, body });
      sent++;
    }
    const next = steps[e.step_idx + 1];
    if (next) db.prepare("UPDATE followup_enrollments SET step_idx=?, next_due_at=?, updated_at=? WHERE id=?").run(e.step_idx + 1, addBusinessDays(new Date(), Math.max(1, next.day - step.day)).toISOString(), now(), e.id);
    else db.prepare("UPDATE followup_enrollments SET status='done', updated_at=? WHERE id=?").run(now(), e.id);
  }
  return { sent, stopped };
}

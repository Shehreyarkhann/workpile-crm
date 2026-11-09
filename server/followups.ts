// Workpile — follow-up cadences (slice 9, competitive audit P0).
// Staged, pre-approved nudges on sent proposals (the Jobber/Housecall Pro pattern):
// Day 2 email → Day 5 SMS → Day 10 email by default; steps are workspace-configurable.
// Auto-stops the moment the customer signs, the lead finalizes, or the sequence is
// stopped manually. Every send goes through the comms outbox (test-mode honest).
import { db, uid, now } from "./db.ts";
import { queueAndDeliver } from "./comms.ts";
import { ensureSignToken } from "./sign.ts";

export const DEFAULT_STEPS = [
  { day: 2, channel: "email", template: "Hi {name}, just floating your proposal from {business} back to the top of your inbox — total {total}. Review & sign here: {link}" },
  { day: 5, channel: "sms", template: "{business}: your proposal ({total}) is waiting — review & sign: {link}" },
  { day: 10, channel: "email", template: "Hi {name}, last nudge from {business} — your proposal ({total}) is still open here: {link}. If the timing is wrong, just reply and tell us; no pressure either way." },
];
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
    .run(id, workspaceId, leadId, proposalId, 0, new Date(Date.now() + steps[0].day * 86400000).toISOString(), now(), now());
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
    if (next) db.prepare("UPDATE followup_enrollments SET step_idx=?, next_due_at=?, updated_at=? WHERE id=?").run(e.step_idx + 1, new Date(Date.now() + (next.day - step.day) * 86400000).toISOString(), now(), e.id);
    else db.prepare("UPDATE followup_enrollments SET status='done', updated_at=? WHERE id=?").run(now(), e.id);
  }
  return { sent, stopped };
}

// Workpile — engagement labels (v43, Tranche 2 of the Instantly scope).
// Labels are the routing primitive, as in Instantly's Unibox: a reply gets a
// label (AI-classified deterministically, or applied by a human) and the label
// fires the follow-through — positive labels open an Opportunity, unsubscribe
// suppresses + stops everything, OOO pauses sequences, and workspace label
// RULES can enroll the lead into another campaign (a subsequence), stop
// sequences, create a task, or notify the owners. applyLabel() is the single
// choke point: classifier, inbox UI and lead UI all flow through it, so a
// trigger fires exactly once per (lead, label).
import { db, uid, now } from "./db.ts";
import { enrollLead, nextWindowSlot, stopOutreachForLead } from "./outreach.ts";
import { stopFollowups } from "./followups.ts";
import { notifyOwners } from "./comms.ts";

export const BUILTIN_LABELS: { key: string; name: string; color: string; positive: number }[] = [
  { key: "interested", name: "Interested", color: "#22C55E", positive: 1 },
  { key: "meeting_booked", name: "Meeting Booked", color: "#0E5C3A", positive: 1 },
  { key: "ooo", name: "Out of Office", color: "#B45309", positive: 0 },
  { key: "wrong_person", name: "Wrong Person", color: "#7C3AED", positive: 0 },
  { key: "not_interested", name: "Not Interested", color: "#DC2626", positive: 0 },
  { key: "unsubscribe", name: "Unsubscribe", color: "#991B1B", positive: 0 },
  { key: "neutral", name: "Neutral", color: "#5B6B62", positive: 0 },
];
export function ensureLabels(workspaceId: string): any[] {
  for (const b of BUILTIN_LABELS) db.prepare("INSERT OR IGNORE INTO labels (id,workspace_id,key,name,color,kind,positive,builtin,created_at) VALUES (?,?,?,?,?,'reply',?,1,?)").run(uid("lbl"), workspaceId, b.key, b.name, b.color, b.positive, now());
  return db.prepare("SELECT * FROM labels WHERE workspace_id=? ORDER BY builtin DESC, name").all(workspaceId) as any[];
}
export function labelByKey(workspaceId: string, key: string): any {
  ensureLabels(workspaceId);
  return db.prepare("SELECT * FROM labels WHERE workspace_id=? AND key=?").get(workspaceId, key) as any;
}

// ---------- deterministic reply classification (rules; honest baseline) ----------
// Order is deliberate: hard negatives and logistics are checked BEFORE interest,
// so "not interested" can never classify as interested.
const RULES: { key: string; re: RegExp }[] = [
  { key: "unsubscribe", re: /\b(unsubscribe|remove me|opt[ -]?out|stop emailing|take me off)\b/i },
  { key: "ooo", re: /\b(out of office|on vacation|on leave|annual leave|i am away|i'm away|back in the office|returning on|will return|limited access to email|maternity leave|paternity leave)\b/i },
  { key: "wrong_person", re: /\b(wrong person|no longer (work|with|at)|left the company|doesn'?t work here|not the right person|retired|new contact)\b/i },
  { key: "not_interested", re: /\b(not interested|no thanks|not a fit|we'?re (good|all set|covered)|already (have|use|using)|no need|not looking|don'?t need)\b/i },
  { key: "meeting_booked", re: /\b(booked|calendar invite|meeting (is )?(confirmed|scheduled|set)|see you (on|at)|invite sent|scheduled for)\b/i },
  { key: "interested", re: /\b(interested|tell me more|send (me )?(details|info|pricing|a quote)|pricing|quote|call me|let'?s talk|sounds good|more information|happy to (talk|chat|discuss)|set up a (call|meeting)|book a (call|meeting|time))\b/i },
];
export function classifyReply(text: string): string | null {
  const t = String(text || "").slice(0, 4000);
  if (!t.trim()) return null;
  if (/^\s*(yes|yeah|yep|ok|okay|sure|please do)[.!]?\s*$/i.test(t)) return "interested";
  for (const r of RULES) if (r.re.test(t)) return r.key;
  return null;
}

// ---------- opportunities ----------
export function ensureOpportunity(workspaceId: string, lead: any, sourceLabel: string): any {
  const open = db.prepare("SELECT * FROM opportunities WHERE workspace_id=? AND lead_id=? AND stage NOT IN ('won','lost') ORDER BY created_at DESC LIMIT 1").get(workspaceId, lead.id) as any;
  if (open) return open;
  const contact = db.prepare("SELECT name FROM contacts WHERE id=?").get(lead.contact_id) as any;
  const id = uid("opp");
  db.prepare("INSERT INTO opportunities (id,workspace_id,lead_id,account_id,title,value,stage,source_label,campaign_id,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, lead.id, lead.account_id || null, `${contact?.name || "Lead"} — ${lead.service_requested || "Opportunity"}`, Number(lead.est_value) || 0, sourceLabel === "meeting_booked" ? "meeting_booked" : "interested", sourceLabel, lead.campaign_id || null, lead.owner_id || null, now(), now());
  return db.prepare("SELECT * FROM opportunities WHERE id=?").get(id);
}

// ---------- the choke point ----------
export function applyLabel(workspaceId: string, leadId: string, labelKey: string, source = "human"): { applied: boolean; label?: any } {
  const lead = db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(leadId, workspaceId) as any;
  if (!lead) return { applied: false };
  const label = labelByKey(workspaceId, labelKey);
  if (!label) return { applied: false };
  const ins = db.prepare("INSERT OR IGNORE INTO lead_labels (id,workspace_id,lead_id,label_id,source,created_at) VALUES (?,?,?,?,?,?)").run(uid("ll"), workspaceId, leadId, label.id, source, now());
  if (!ins.changes) return { applied: false, label }; // already labeled: triggers never re-fire
  // built-in consequences
  if (label.positive) ensureOpportunity(workspaceId, lead, label.key);
  if (label.key === "unsubscribe") {
    const c = db.prepare("SELECT email, phone FROM contacts WHERE id=?").get(lead.contact_id) as any;
    if (c?.email) db.prepare("INSERT OR IGNORE INTO suppressions (id,workspace_id,kind,value,reason,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("sup"), workspaceId, "email", String(c.email).toLowerCase(), "Reply labeled Unsubscribe", "label", null, now());
    if (c?.phone) db.prepare("INSERT OR IGNORE INTO suppressions (id,workspace_id,kind,value,reason,source,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("sup"), workspaceId, "phone", String(c.phone).replace(/\D/g, "").slice(-10), "Reply labeled Unsubscribe", "label", null, now());
    stopOutreachForLead(leadId, "unsubscribed"); stopFollowups(leadId, "opted_out");
    db.prepare("UPDATE leads SET consent_contact_ok=0 WHERE id=?").run(leadId);
  }
  if (label.key === "ooo") {
    // Smart Pause: hold active enrollments ~5 business days, processor resumes them
    const until = new Date(Date.now() + 5 * 86400000).toISOString();
    db.prepare("UPDATE campaign_enrollments SET status='paused', stop_reason='ooo', next_due_at=?, updated_at=? WHERE lead_id=? AND status='active'").run(until, now(), leadId);
  }
  if (label.key === "not_interested" || label.key === "wrong_person") stopOutreachForLead(leadId, "label_" + label.key);
  // workspace rules (subsequences and friends)
  const rules = db.prepare("SELECT * FROM label_rules WHERE workspace_id=? AND label_id=? AND active=1").all(workspaceId, label.id) as any[];
  for (const r of rules) {
    try {
      if (r.action === "enroll_campaign" && r.campaign_id) {
        const camp = db.prepare("SELECT * FROM campaigns WHERE id=? AND workspace_id=?").get(r.campaign_id, workspaceId) as any;
        if (camp && camp.kind === "outreach" && camp.status === "active" && camp.launched_at) { const ws = db.prepare("SELECT tz FROM workspaces WHERE id=?").get(workspaceId) as any; enrollLead(camp, leadId, nextWindowSlot(camp, new Date(), ws?.tz || "America/New_York")); }
      } else if (r.action === "stop_sequences") stopOutreachForLead(leadId, "label_rule");
      else if (r.action === "create_task") { const t = db.prepare("SELECT id FROM tasks WHERE lead_id=? AND title LIKE ? AND status='open'").get(leadId, `Follow up:%`) as any; if (!t) db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("tsk"), workspaceId, leadId, lead.owner_id || null, `Follow up: labeled ${label.name}`, new Date(Date.now() + 86400000).toISOString(), "open", now()); }
      else if (r.action === "notify") notifyOwners(workspaceId, "label.applied", `🏷 ${label.name}: ${lead.service_requested || "lead"}`, `A reply was labeled ${label.name}.`, leadId);
    } catch { /* one rule's failure never blocks the label itself */ }
  }
  return { applied: true, label };
}

// ---------- worker pass: classify unclassified replies ----------
export function processReplyClassification(): { classified: number } {
  let classified = 0;
  const items = db.prepare("SELECT * FROM inbox_items WHERE reply_label IS NULL AND body IS NOT NULL AND body<>'' ORDER BY created_at LIMIT 25").all() as any[];
  for (const it of items) {
    const key = classifyReply(`${it.subject || ""}\n${it.body || ""}`);
    db.prepare("UPDATE inbox_items SET reply_label=? WHERE id=?").run(key || "neutral", it.id);
    if (key && it.lead_id) { applyLabel(it.workspace_id, it.lead_id, key, "ai_rules"); classified++; }
  }
  const msgs = db.prepare("SELECT * FROM messages_outbox WHERE direction='in' AND reply_label IS NULL AND body IS NOT NULL AND body<>'' ORDER BY created_at LIMIT 25").all() as any[];
  for (const m of msgs) {
    const key = classifyReply(m.body || "");
    db.prepare("UPDATE messages_outbox SET reply_label=? WHERE id=?").run(key || "neutral", m.id);
    if (key && m.lead_id) { applyLabel(m.workspace_id, m.lead_id, key, "ai_rules"); classified++; }
  }
  return { classified };
}

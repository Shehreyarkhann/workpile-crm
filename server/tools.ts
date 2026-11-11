// Governed tool registry (v17). The LLM (or rules planner) may only CHOOSE tools and propose
// arguments. Every tool re-validates workspace scope and business rules at execution time —
// the model is never the security boundary. Control classes drive the approval policy:
//   read     — no writes, auto-executes
//   draft    — creates drafts/internal artifacts, auto at autonomy >= L2
//   execute  — operational writes (assign, tasks, visits, jobs), auto at autonomy >= L3
//   approval — customer-facing or financial; ALWAYS requires per-step human approval
import { db, uid, now } from "./db.ts";
import { queueAndDeliver } from "./comms.ts";
import { draftProposalForLead } from "./proposals-core.ts";
import { inboxSuggestion, sendInboxReply, convertInboxItem } from "./inbox-ai.ts";
import { suggestInboxAction } from "./inbox.ts";

export type Control = "read" | "draft" | "execute" | "approval";
function inboxOf(ws: string, itemId: string): any { const it = db.prepare("SELECT * FROM inbox_items WHERE id=? AND workspace_id=?").get(String(itemId || ""), ws) as any; if (!it) throw new Error("inbox item not found in this workspace"); return it; }
export interface ToolDef { name: string; description: string; control: Control; parameters: Record<string, any>; run: (ws: string, actor: string, args: any) => Promise<{ summary: string; refs?: any }> | { summary: string; refs?: any } }
const leadOf = (ws: string, id: string) => db.prepare("SELECT l.*, c.name contact_name, c.email contact_email, c.phone contact_phone FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.id=? AND l.workspace_id=?").get(id, ws) as any;
const money = (n: number) => "$" + Math.round(n || 0).toLocaleString();

export function draftBodyFor(ws: string, l: any, intent = "check in"): string {
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws) as any;
  const first = (l.contact_name || "there").split(" ")[0];
  return `Hi ${first}, this is ${w?.name || "our team"} following up on your ${l.service_requested} request. We wanted to ${intent} and see how you'd like to proceed — happy to answer questions or schedule a visit whenever suits you.`;
}

export const TOOLS: Record<string, ToolDef> = {
  search_leads: { name: "search_leads", description: "Search leads by state, staleness, or minimum value. Returns the top matches with ids.", control: "read",
    parameters: { type: "object", properties: { state: { type: "string" }, stale_days: { type: "number" }, min_value: { type: "number" }, limit: { type: "number" } } },
    run(ws, _a, args) { const q = ["workspace_id=?"]; const p: any[] = [ws]; if (args.state) { q.push("state=?"); p.push(String(args.state).toUpperCase()); } if (args.stale_days) { q.push("julianday('now') - julianday(updated_at) >= ?"); p.push(Number(args.stale_days)); } if (args.min_value) { q.push("est_value>=?"); p.push(Number(args.min_value)); }
      const rows = db.prepare(`SELECT id, service_requested, state, est_value FROM leads WHERE ${q.join(" AND ")} ORDER BY est_value DESC LIMIT ?`).all(...p, Math.min(25, Number(args.limit || 10))) as any[];
      return { summary: `${rows.length} lead(s): ${rows.map(r => `${r.service_requested} (${r.state}, ${money(r.est_value)})`).join("; ") || "none"}`, refs: { lead_ids: rows.map(r => r.id) } }; } },
  get_customer_context: { name: "get_customer_context", description: "Customer 360 summary for a lead's customer: history counts, money, open items.", control: "read",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const props = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total),0) s FROM proposals WHERE lead_id=?").get(l.id) as any;
      const jobs = db.prepare("SELECT COUNT(*) c FROM jobs WHERE lead_id=?").get(l.id) as any;
      const msgs = db.prepare("SELECT COUNT(*) c FROM messages_outbox WHERE lead_id=?").get(l.id) as any;
      return { summary: `${l.contact_name || "Customer"} — ${l.service_requested}, state ${l.state}, est ${money(l.est_value)}; ${props.c} proposals (${money(props.s)}), ${jobs.c} jobs, ${msgs.c} messages on file.`, refs: { lead_id: l.id } }; } },
  get_conversation_history: { name: "get_conversation_history", description: "Recent messages with a lead's customer (both directions).", control: "read",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const rows = db.prepare("SELECT direction, channel, status, body, created_at FROM messages_outbox WHERE lead_id=? ORDER BY created_at DESC LIMIT 8").all(l.id) as any[];
      return { summary: rows.length ? rows.map(r => `[${r.direction}/${r.channel}/${r.status}] ${String(r.body || "").slice(0, 120)}`).join(" | ") : "No messages yet.", refs: { lead_id: l.id } }; } },
  qualify_lead: { name: "qualify_lead", description: "Deterministic qualification assessment with evidence (score, signals, missing info).", control: "read",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const missing: string[] = []; if (!l.contact_email && !l.contact_phone) missing.push("no contact channel"); if (!l.est_value) missing.push("no estimated value"); if (!l.location && !l.address) missing.push("no location");
      const svc = db.prepare("SELECT COUNT(*) c FROM services WHERE workspace_id=? AND is_catalog=1 AND ? LIKE '%' || name || '%'").get(ws, l.service_requested || "") as any;
      return { summary: `Score ${l.ai_score ?? "unscored"}/100 · state ${l.state} · value ${money(l.est_value)} · in-catalog service: ${svc.c > 0 ? "yes" : "not matched"} · missing: ${missing.join(", ") || "nothing critical"}.`, refs: { lead_id: l.id } }; } },
  assign_lead: { name: "assign_lead", description: "Assign a lead to an active team member (round-robin when no assignee named).", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, assignee_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      let target = args.assignee_id ? db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=? AND active=1").get(args.assignee_id, ws) as any : null;
      if (!target) { const team = db.prepare("SELECT * FROM users WHERE workspace_id=? AND active=1 ORDER BY name").all(ws) as any[]; if (!team.length) throw new Error("no active team members"); target = team[Math.floor(Math.random() * team.length)]; }
      db.prepare("UPDATE leads SET owner_id=?, updated_at=? WHERE id=?").run(target.id, now(), l.id);
      return { summary: `Assigned ${l.service_requested} to ${target.name}.`, refs: { lead_id: l.id, assignee_id: target.id } }; } },
  create_followup_task: { name: "create_followup_task", description: "Create a follow-up task on a lead.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, title: { type: "string" }, assignee_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, actor, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const id = uid("tsk"); db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws, l.id, args.assignee_id || l.owner_id || actor, "follow_up", String(args.title || "Follow up").slice(0, 140), new Date(Date.now() + 86400000).toISOString(), "open", now());
      const chk = db.prepare("SELECT id FROM tasks WHERE id=?").get(id); if (!chk) throw new Error("task insert failed verification");
      return { summary: `Task created on ${l.service_requested}: "${String(args.title || "Follow up").slice(0, 60)}".`, refs: { lead_id: l.id, task_id: id } }; } },
  draft_message: { name: "draft_message", description: "Draft a personalized follow-up for a lead (stored as a draft step result — NOT sent).", control: "draft",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, intent: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const body = draftBodyFor(ws, l, String(args.intent || "check in"));
      return { summary: `Draft for ${l.contact_name || l.service_requested}: "${body.slice(0, 140)}…"`, refs: { lead_id: l.id, draft: body, channel: l.contact_email ? "email" : "sms" } }; } },
  triage_inbox: { name: "triage_inbox", description: "List open inbox items with category, sender, subject and the suggested next action for each.", control: "read",
    parameters: { type: "object", properties: { limit: { type: "number" } } },
    run(ws, _a, args) { const rows = db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND status='open' ORDER BY received_at LIMIT ?").all(ws, Math.min(25, Number(args.limit) || 25)) as any[];
      return { summary: `${rows.length} open inbox item(s): ` + rows.map(r => `${r.from_name || r.from_email} — ${r.subject} [${suggestInboxAction(r, "").action}]`).join("; ").slice(0, 400), refs: { open: rows.length, items: rows.map(r => ({ id: r.id, category: r.category, from: r.from_name || r.from_email, subject: r.subject })) } }; } },
  draft_inbox_reply: { name: "draft_inbox_reply", description: "Generate (or fetch the cached) reply draft for an inbox item — written from the actual email when an AI provider is configured, else the category template. NOT sent.", control: "draft",
    parameters: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
    async run(ws, _a, args) { const it = inboxOf(ws, args.item_id); const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws) as any; const s = await inboxSuggestion(ws, it, w?.name || ""); return { summary: `${s.source === "ai" ? "AI draft" : "Template draft"} for ${it.from_name || it.from_email} (${s.action}): "${s.draft_body.slice(0, 140)}…"`, refs: { item_id: it.id, draft_subject: s.draft_subject, draft_body: s.draft_body, source: s.source } }; } },
  send_inbox_reply: { name: "send_inbox_reply", description: "Send the reply for an inbox item and close it. ALWAYS requires human approval; consent and suppression are enforced by the send boundary.", control: "approval",
    parameters: { type: "object", properties: { item_id: { type: "string" }, body: { type: "string" } }, required: ["item_id"] },
    async run(ws, _a, args) { const it = inboxOf(ws, args.item_id); const r = await sendInboxReply(ws, it, args.body ? String(args.body) : undefined); return { summary: `Reply to ${it.from_name || it.from_email} ${r.status === "test_mode" ? "queued in TEST MODE (no provider credentials — not delivered)" : "sent"}; item closed.`, refs: { item_id: it.id, status: r.status } }; } },
  convert_inbox_lead: { name: "convert_inbox_lead", description: "Convert an inbox item into a new lead (sender becomes the contact) and close the item.", control: "execute",
    parameters: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
    run(ws, a, args) { const it = inboxOf(ws, args.item_id); const r = convertInboxItem(ws, String(a || "agent"), it); return { summary: `Converted ${it.from_name || it.from_email} ("${String(it.subject || "").slice(0, 50)}") into a new lead; inbox item closed.`, refs: { item_id: it.id, lead_id: r.lead_id } }; } },
  file_inbox_item: { name: "file_inbox_item", description: "Mark an inbox item done/filed without replying (e.g. pure FYI mail).", control: "execute",
    parameters: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
    run(ws, _a, args) { const it = inboxOf(ws, args.item_id); db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), it.id); return { summary: `Filed "${String(it.subject || "").slice(0, 60)}" — marked done, no reply sent.`, refs: { item_id: it.id } }; } },
  send_message: { name: "send_message", description: "Send a message to a customer. ALWAYS requires human approval; consent and suppression are enforced by the send boundary.", control: "approval",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, body: { type: "string" }, channel: { type: "string" } }, required: ["lead_id", "body"] },
    async run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const channel = args.channel === "sms" ? "sms" : (l.contact_email ? "email" : "sms");
      const to = channel === "email" ? l.contact_email : l.contact_phone; if (!to) throw new Error(`lead has no ${channel} destination`);
      const msg: any = await queueAndDeliver(ws, { lead_id: l.id, channel, to, subject: channel === "email" ? `Following up — ${l.service_requested}` : undefined, body: String(args.body).slice(0, 1500) });
      return { summary: `Message to ${l.contact_name || to} via ${channel}: status ${msg.status}${msg.status === "test_mode" ? " (test mode — not actually delivered)" : ""}.`, refs: { lead_id: l.id, message_id: msg.id, status: msg.status } }; } },
  prepare_proposal: { name: "prepare_proposal", description: "Draft a price-book-governed proposal for one lead.", control: "draft",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const ex = db.prepare("SELECT id FROM proposals WHERE lead_id=?").get(l.id); if (ex) return { summary: `${l.service_requested} already has a proposal — skipped (no duplicates).`, refs: { lead_id: l.id } };
      const r = draftProposalForLead(ws, l);
      return { summary: `Drafted proposal for ${l.service_requested}: ${money(r.total)} (${r.priced === "price_book" ? "price book" : "ESTIMATE — review pricing"}). Not sent.`, refs: { lead_id: l.id, proposal_id: r.proposal_id } }; } },
  submit_for_approval: { name: "submit_for_approval", description: "Submit a lead's current proposal into the approval workflow.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, actor, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const p = db.prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY version DESC LIMIT 1").get(l.id) as any; if (!p) throw new Error("no proposal to submit");
      const ex = db.prepare("SELECT id FROM approvals WHERE proposal_id=? AND decision='pending'").get(p.id); if (ex) return { summary: "An approval is already pending for this proposal.", refs: { lead_id: l.id, approval_id: ex.id } };
      const id = uid("apr"); db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,tier,submitted_by,submitted_at,decision) VALUES (?,?,?,?,?,?,?, 'pending')").run(id, ws, l.id, p.id, (p.total || 0) > 25000 ? "ceo" : "ops", actor, now());
      return { summary: `Approval requested for the ${money(p.total)} proposal (${l.service_requested}).`, refs: { lead_id: l.id, approval_id: id } }; } },
  schedule_site_visit: { name: "schedule_site_visit", description: "Schedule a site visit for a lead (tomorrow 10:00 by default).", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, when: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const when = args.when && !isNaN(Date.parse(args.when)) ? new Date(args.when).toISOString() : new Date(Date.now() + 86400000).toISOString().slice(0, 11) + "10:00:00.000Z";
      const id = uid("vis"); db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status) VALUES (?,?,?,?,?,'scheduled')").run(id, ws, l.id, l.owner_id || null, when);
      return { summary: `Site visit scheduled for ${l.service_requested} at ${when}.`, refs: { lead_id: l.id, visit_id: id } }; } },
  create_job: { name: "create_job", description: "Create the operational job for a WON lead (refuses otherwise).", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      if (l.state !== "WON") throw new Error(`lead is ${l.state}, not WON — job creation refused`);
      const ex = db.prepare("SELECT id FROM jobs WHERE lead_id=?").get(l.id) as any; if (ex) return { summary: "Job already exists for this lead.", refs: { lead_id: l.id, job_id: ex.id } };
      const id = uid("job"); db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,proposal_id,stage,value,created_at,updated_at) VALUES (?,?,?,?,?,'AWAITING_SCHEDULING',?,?,?)").run(id, ws, l.id, (db.prepare("SELECT id FROM proposals WHERE lead_id=? AND status='signed' ORDER BY version DESC LIMIT 1").get(l.id) as any)?.id || null, l.est_value || 0, now(), now());
      return { summary: `Job created for ${l.service_requested} (${money(l.est_value)}).`, refs: { lead_id: l.id, job_id: id } }; } },
  get_revenue_report: { name: "get_revenue_report", description: "The five separated money figures with definitions.", control: "read",
    parameters: { type: "object", properties: {} },
    async run(ws) { const { financialSummary } = await import("./metrics.ts"); const f: any = financialSummary(ws);
      return { summary: Object.entries(f).map(([k, v]: any) => `${k.replaceAll("_", " ")}: ${money(v.value)}`).join(" · "), refs: {} }; } },
};
export const TOOL_LIST = Object.values(TOOLS).map(t => ({ name: t.name, description: t.description, control: t.control, parameters: t.parameters }));

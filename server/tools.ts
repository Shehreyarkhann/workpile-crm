// Governed tool registry (v17). The LLM (or rules planner) may only CHOOSE tools and propose
// arguments. Every tool re-validates workspace scope and business rules at execution time —
// the model is never the security boundary. Control classes drive the approval policy:
//   read     — no writes, auto-executes
//   draft    — creates drafts/internal artifacts, auto at autonomy >= L2
//   execute  — operational writes (assign, tasks, visits, jobs), auto at autonomy >= L3
//   approval — customer-facing or financial; ALWAYS requires per-step human approval
import { db, uid, now } from "./db.ts";
import { touchLead } from "./touch.ts";
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
      touchLead(ws, l.id, "assign", _a);
      return { summary: `Assigned ${l.service_requested} to ${target.name}.`, refs: { lead_id: l.id, assignee_id: target.id } }; } },
  create_followup_task: { name: "create_followup_task", description: "Create a follow-up task on a lead.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, title: { type: "string" }, assignee_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, actor, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const id = uid("tsk"); db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws, l.id, args.assignee_id || l.owner_id || actor, "follow_up", String(args.title || "Follow up").slice(0, 140), new Date(Date.now() + 86400000).toISOString(), "open", now());
      touchLead(ws, l.id, "task", actor);
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
  schedule_job: { name: "schedule_job", description: "Put a lead's job on the calendar for a work date (defaults to tomorrow). Reports a conflict instead of double-booking the same person.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, work_date: { type: "string", description: "YYYY-MM-DD" }, user_id: { type: "string" } }, required: ["lead_id"] },
    run(ws, actor, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const job = db.prepare("SELECT * FROM jobs WHERE lead_id=? ORDER BY created_at DESC LIMIT 1").get(l.id) as any; if (!job) throw new Error("no job exists for this lead yet — create_job first");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args.work_date || "")) ? String(args.work_date) : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      let userId = args.user_id || (l as any).pm_id || l.owner_id || actor;
      if (args.user_id && !db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=? AND active=1").get(args.user_id, ws)) throw new Error("assignee is not an active team member");
      const clash = db.prepare("SELECT s.id, u.name FROM job_schedule s LEFT JOIN users u ON u.id=s.user_id WHERE s.workspace_id=? AND s.user_id=? AND s.work_date=? AND s.lead_id<>?").get(ws, userId, date, l.id) as any;
      const existing = db.prepare("SELECT id FROM job_schedule WHERE workspace_id=? AND lead_id=? AND user_id=? AND work_date=?").get(ws, l.id, userId, date) as any;
      if (existing) return { summary: "That person is already scheduled on this job that day — no duplicate created.", refs: { lead_id: l.id, job_id: job.id, schedule_id: existing.id } };
      const worker = db.prepare("SELECT id FROM workers WHERE linked_user_id=? AND workspace_id=?").get(userId, ws) as any;
      const id = uid("sch");
      db.prepare("INSERT INTO job_schedule (id,workspace_id,lead_id,user_id,worker_id,work_date,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws, l.id, userId, worker?.id || null, date, "Scheduled by agent", actor, now());
      return { summary: `Job for ${l.service_requested} scheduled on ${date}${clash ? ` — note: ${clash.name || "that person"} already has work that day (kept both; scheduling conflicts warn, never block)` : ""}.`, refs: { lead_id: l.id, job_id: job.id, schedule_id: id } }; } },
  assign_crew: { name: "assign_crew", description: "Add a team member to a lead's job crew.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, user_id: { type: "string" } }, required: ["lead_id", "user_id"] },
    run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const u = db.prepare("SELECT * FROM users WHERE id=? AND workspace_id=? AND active=1").get(args.user_id, ws) as any; if (!u) throw new Error("user is not an active team member");
      const worker = db.prepare("SELECT id FROM workers WHERE linked_user_id=? AND workspace_id=?").get(u.id, ws) as any;
      db.prepare("INSERT OR IGNORE INTO job_crew (id,workspace_id,lead_id,user_id,worker_id,created_at) VALUES (?,?,?,?,?,?)").run(uid("crew"), ws, l.id, u.id, worker?.id || null, now());
      return { summary: `${u.name} is on the crew for ${l.service_requested}.`, refs: { lead_id: l.id, user_id: u.id } }; } },
  chase_missing_documents: { name: "chase_missing_documents", description: "Scan active jobs for required documents still missing and create a chase task for each (assigned to the lead owner). Skips documents that already have an open chase task.", control: "execute",
    parameters: { type: "object", properties: {} },
    run(ws, actor) { const docs = db.prepare(`SELECT d.name, d.job_id, d.lead_id, l.owner_id FROM documents d JOIN jobs j ON j.id=d.job_id JOIN leads l ON l.id=d.lead_id WHERE d.workspace_id=? AND d.required=1 AND d.status<>'received' AND j.stage NOT IN ('CLOSED','CANCELLED') LIMIT 25`).all(ws) as any[];
      let made = 0; for (const d of docs) { const title = `Chase document: ${d.name}`; const open = db.prepare("SELECT id FROM tasks WHERE workspace_id=? AND lead_id=? AND title=? AND status='open'").get(ws, d.lead_id, title); if (open) continue;
        db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("tsk"), ws, d.lead_id, d.owner_id || actor, "follow_up", title, new Date(Date.now() + 2 * 86400000).toISOString(), "open", now()); made++; }
      return { summary: docs.length ? `${docs.length} required document(s) missing across active jobs; created ${made} chase task(s)${docs.length > made ? ` (${docs.length - made} already being chased)` : ""}.` : "No missing required documents — the paperwork is complete.", refs: { missing: docs.length, tasks_created: made } }; } },
  get_ar_snapshot: { name: "get_ar_snapshot", description: "Accounts-receivable snapshot: invoiced vs collected, open balances and the most overdue invoices.", control: "read",
    parameters: { type: "object", properties: {} },
    run(ws) { const by = (st: string) => db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total-paid_amount),0) bal, COALESCE(SUM(total),0) tot FROM invoices WHERE workspace_id=? AND status=?").get(ws, st) as any;
      const sent = by("sent"), part = by("partially_paid"), paid = by("paid");
      const collected30 = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE workspace_id=? AND status='paid' AND created_at >= datetime('now','-30 days')").get(ws) as any).s;
      const overdue = db.prepare("SELECT i.number, i.total, i.paid_amount, i.due_at, c.name FROM invoices i LEFT JOIN leads l ON l.id=i.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') AND i.due_at < datetime('now') ORDER BY i.due_at LIMIT 5").all(ws) as any[];
      return { summary: `Open AR ${money((sent.bal || 0) + (part.bal || 0))} (${sent.c} sent, ${part.c} partial) · collected last 30d ${money(collected30)} · paid in full: ${paid.c} invoices.${overdue.length ? " Most overdue: " + overdue.map(o => `${o.number} ${o.name || ""} ${money((o.total || 0) - (o.paid_amount || 0))} due ${String(o.due_at).slice(0, 10)}`).join("; ") + "." : " Nothing overdue."}`, refs: { open_ar: (sent.bal || 0) + (part.bal || 0), overdue: overdue.map(o => o.number) } }; } },
  create_invoice: { name: "create_invoice", description: "Create the invoice for a completed/ready job from its signed value (does NOT send it).", control: "draft",
    parameters: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] },
    run(ws, _a, args) { const job = db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(args.job_id, ws) as any; if (!job) throw new Error("job not found in this workspace");
      const ex = db.prepare("SELECT id, number FROM invoices WHERE job_id=?").get(job.id) as any; if (ex) return { summary: `Invoice ${ex.number} already exists for this job — no duplicate.`, refs: { job_id: job.id, invoice_id: ex.id } };
      const svc = (db.prepare("SELECT service_requested FROM leads WHERE id=?").get(job.lead_id) as any)?.service_requested || "services";
      const n = ((db.prepare("SELECT COUNT(*) c FROM invoices WHERE workspace_id=?").get(ws) as any).c || 0) + 1;
      const id = uid("inv"); const total = job.value || 0;
      db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,proposal_id,number,status,lines,total,paid_amount,due_at,issued_at,source,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'agent',?)")
        .run(id, ws, job.lead_id, job.id, job.proposal_id || null, "INV-" + String(n).padStart(4, "0"), "sent", JSON.stringify([{ description: `Job — ${svc}`, qty: 1, unit_price: total, line_total: total }]), total, 0, new Date(Date.now() + 30 * 86400000).toISOString(), now(), now());
      db.prepare("UPDATE jobs SET invoice_status='invoiced' WHERE id=?").run(job.id);
      return { summary: `Invoice INV-${String(n).padStart(4, "0")} created for ${svc}: ${money(total)}, due in 30 days. Not sent — send it from the invoice when ready.`, refs: { job_id: job.id, invoice_id: id } }; } },
  record_payment: { name: "record_payment", description: "Record a payment against an invoice (check/cash/card received outside Stripe). Financial — ALWAYS requires human approval. Full payment fires the referral playbook hook.", control: "approval",
    parameters: { type: "object", properties: { invoice_id: { type: "string" }, amount: { type: "number" } }, required: ["invoice_id", "amount"] },
    async run(ws, _a, args) { const inv = db.prepare("SELECT * FROM invoices WHERE id=? AND workspace_id=?").get(args.invoice_id, ws) as any; if (!inv) throw new Error("invoice not found in this workspace");
      if (inv.status === "void" || inv.status === "paid") throw new Error("invoice is closed");
      const amount = Math.round(Number(args.amount || 0) * 100) / 100; const balance = Math.round(((inv.total || 0) - (inv.paid_amount || 0)) * 100) / 100;
      if (!(amount > 0)) throw new Error("amount must be positive");
      if (amount > balance + 0.001) throw new Error(`payment ${money(amount)} exceeds the invoice balance ${money(balance)}`);
      db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,invoice_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,?,'invoice_payment',?,?,'paid',?,?)").run(uid("pay"), ws, inv.proposal_id || null, inv.id, amount, "test", now(), now());
      const paidAmt = Math.round(((inv.paid_amount || 0) + amount) * 100) / 100; const status = paidAmt >= (inv.total || 0) - 0.001 ? "paid" : "partially_paid";
      db.prepare("UPDATE invoices SET paid_amount=?, status=? WHERE id=?").run(paidAmt, status, inv.id);
      if (status === "paid") { try { const { onInvoicePaid } = await import("./lifecycle.ts"); await onInvoicePaid(ws, inv.lead_id); } catch { /* playbook hook is best-effort here */ } }
      return { summary: `Recorded ${money(amount)} on invoice ${inv.number} — now ${status === "paid" ? "PAID IN FULL" : `${money(paidAmt)} of ${money(inv.total)} paid`}.`, refs: { invoice_id: inv.id, status } }; } },
  draft_status_report: { name: "draft_status_report", description: "Draft the weekly status report (the owner's one-pager): new leads, proposals, approvals pending, jobs, collected, and the biggest stuck items.", control: "draft",
    parameters: { type: "object", properties: {} },
    run(ws) { const wk = (sql: string, ...p: any[]) => (db.prepare(sql).get(ws, ...p) as any);
      const nl = wk("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND created_at >= datetime('now','-7 days')").c;
      const sent = wk("SELECT COUNT(*) c FROM proposals WHERE workspace_id=? AND sent_at >= datetime('now','-7 days')").c;
      const signed = wk("SELECT COALESCE(SUM(total),0) s FROM proposals WHERE workspace_id=? AND status='signed' AND signed_at >= datetime('now','-7 days')").s;
      const coll = wk("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE workspace_id=? AND status='paid' AND created_at >= datetime('now','-7 days')").s;
      const pend = wk("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision='pending'").c;
      const jobsDone = wk("SELECT COUNT(*) c FROM jobs WHERE workspace_id=? AND stage='COMPLETED' AND updated_at >= datetime('now','-7 days')").c;
      const stuck = db.prepare("SELECT service_requested, est_value FROM leads WHERE workspace_id=? AND state IN ('NEW','WORKING') AND first_touch_at IS NULL ORDER BY est_value DESC LIMIT 3").all(ws) as any[];
      const report = `Weekly status — last 7 days: ${nl} new leads · ${sent} proposals sent · ${money(signed)} signed · ${jobsDone} jobs completed · ${money(coll)} collected. Waiting on the owner: ${pend} approval(s).${stuck.length ? " Biggest untouched: " + stuck.map(s => `${s.service_requested} (${money(s.est_value)})`).join(", ") + "." : " No untouched high-value leads."}`;
      return { summary: report, refs: { report } }; } },
  move_lead_stage: { name: "move_lead_stage", description: "Move a lead to a new pipeline state. Final states need a reason; WON needs a proposal (or confirm_no_proposal).", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, to: { type: "string" }, lost_reason: { type: "string" }, confirm_no_proposal: { type: "boolean" } }, required: ["lead_id", "to"] },
    run(ws, actor, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const to = String(args.to || "").toUpperCase();
      if (["LOST", "NO_RESPONSE"].includes(to) && !String(args.lost_reason || "").trim()) throw new Error(`${to} requires a lost_reason — ask the user or infer nothing; finals are never silent`);
      if (to === "WON") { const p = db.prepare("SELECT id FROM proposals WHERE lead_id=?").get(l.id); if (!p && args.confirm_no_proposal !== true) throw new Error("WON refused: this lead has no proposal on file. Pass confirm_no_proposal: true only if the user confirmed there's genuinely no proposal."); }
      db.prepare("UPDATE leads SET state=?, updated_at=? WHERE id=?").run(to, now(), l.id);
      touchLead(ws, l.id, "agent_stage", actor);
      return { summary: `${l.service_requested} moved ${l.state} → ${to}${args.lost_reason ? ` (${String(args.lost_reason).slice(0, 80)})` : ""}.`, refs: { lead_id: l.id, to } }; } },
  enroll_in_playbook: { name: "enroll_in_playbook", description: "Enroll a lead into an ACTIVE retention playbook campaign (review / referral / reactivation). The campaign must exist and be launched first.", control: "execute",
    parameters: { type: "object", properties: { lead_id: { type: "string" }, kind: { type: "string", enum: ["review", "referral", "reactivation"] } }, required: ["lead_id", "kind"] },
    async run(ws, _a, args) { const l = leadOf(ws, args.lead_id); if (!l) throw new Error("lead not found in this workspace");
      const trig = args.kind === "review" ? "job_completed" : args.kind === "referral" ? "invoice_paid" : "none";
      const camp = db.prepare("SELECT * FROM campaigns WHERE workspace_id=? AND kind='outreach' AND status='active' AND auto_trigger=? ORDER BY created_at LIMIT 1").get(ws, trig) as any
        || (args.kind === "reactivation" ? db.prepare("SELECT * FROM campaigns WHERE workspace_id=? AND kind='outreach' AND status='active' AND name LIKE '%Reactivation%' LIMIT 1").get(ws) as any : null);
      if (!camp) throw new Error(`no ACTIVE ${args.kind} playbook campaign in this workspace — create and launch it in Campaigns first`);
      const { enrollLead } = await import("./outreach.ts");
      const ok = enrollLead(camp, l.id, new Date());
      return { summary: ok ? `Enrolled ${l.contact_name || l.service_requested} in "${camp.name}" — step 1 sends inside the campaign's window and caps.` : `${l.contact_name || l.service_requested} was already enrolled in "${camp.name}" — no duplicate.`, refs: { lead_id: l.id, campaign_id: camp.id, enrolled: ok } }; } },
  get_revenue_report: { name: "get_revenue_report", description: "The five separated money figures with definitions.", control: "read",
    parameters: { type: "object", properties: {} },
    async run(ws) { const { financialSummary } = await import("./metrics.ts"); const f: any = financialSummary(ws);
      return { summary: Object.entries(f).map(([k, v]: any) => `${k.replaceAll("_", " ")}: ${money(v.value)}`).join(" · "), refs: {} }; } },
};
export const TOOL_LIST = Object.values(TOOLS).map(t => ({ name: t.name, description: t.description, control: t.control, parameters: t.parameters }));

// Workpile — lifecycle automations (v45): the SMB retention loop.
// Campaigns can carry an auto_trigger (job_completed | invoice_paid); when the
// event fires, the lead is enrolled into every ACTIVE campaign with that
// trigger — review requests after the job, referral asks after payment.
// Services can carry a cycle (annual tank test, quarterly service): finishing
// a job for a cyclic service books the next due date, and 30 days out the
// sweep opens an opportunity and tells the owner — recurring revenue never
// depends on someone remembering.
import { db, uid, now } from "./db.ts";
import { enrollLead, nextWindowSlot } from "./outreach.ts";
import { notifyOwners } from "./comms.ts";

export function maybeAutoEnroll(workspaceId: string, leadId: string, trigger: string): number {
  if (!leadId) return 0;
  const lead = db.prepare("SELECT state FROM leads WHERE id=? AND workspace_id=?").get(leadId, workspaceId) as any;
  if (!lead || ["LOST", "NO_RESPONSE", "UNSERVICEABLE", "JUNK", "DUPLICATE"].includes(lead.state)) return 0;
  const ws = db.prepare("SELECT timezone FROM workspaces WHERE id=?").get(workspaceId) as any;
  const camps = db.prepare("SELECT * FROM campaigns WHERE workspace_id=? AND kind='outreach' AND status='active' AND auto_trigger=?").all(workspaceId, trigger) as any[];
  let n = 0;
  for (const c of camps) {
    const slot = nextWindowSlot(c, new Date(), ws?.timezone || "America/New_York");
    if (enrollLead(c, leadId, slot)) n++;
  }
  return n;
}

export function onJobCompleted(workspaceId: string, job: any) {
  try { maybeAutoEnroll(workspaceId, job.lead_id, "job_completed"); } catch { /* never block the workflow */ }
  try {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(job.lead_id) as any; if (!lead) return;
    const svc = db.prepare("SELECT * FROM services WHERE workspace_id=? AND lower(name)=lower(?)").get(workspaceId, lead.service_requested || "") as any;
    if (!svc || !(svc.cycle_months > 0)) return;
    const open = db.prepare("SELECT id FROM recurrences WHERE workspace_id=? AND lead_id=? AND service=? AND status IN ('scheduled','actioned')").get(workspaceId, lead.id, svc.name) as any;
    if (open) return;
    const due = new Date(); due.setMonth(due.getMonth() + Number(svc.cycle_months));
    db.prepare("INSERT INTO recurrences (id,workspace_id,lead_id,service,due_date,status,created_from_job,created_at) VALUES (?,?,?,?,?,'scheduled',?,?)").run(uid("rec"), workspaceId, lead.id, svc.name, due.toISOString().slice(0, 10), job.id, now());
  } catch { /* recurrence booking never blocks job completion */ }
}

export function onInvoicePaid(workspaceId: string, leadId: string) {
  try { maybeAutoEnroll(workspaceId, leadId, "invoice_paid"); } catch { /* never block payments */ }
}

export function processRecurrences(): number {
  const horizon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare("SELECT * FROM recurrences WHERE status='scheduled' AND due_date<=?").all(horizon) as any[];
  let made = 0;
  for (const r of rows) {
    const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(r.lead_id) as any; if (!lead) { db.prepare("UPDATE recurrences SET status='done' WHERE id=?").run(r.id); continue; }
    const oid = uid("opp");
    db.prepare("INSERT INTO opportunities (id,workspace_id,lead_id,account_id,title,value,stage,source_label,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?, 'interested', 'recurrence', ?,?,?)").run(oid, r.workspace_id, lead.id, lead.account_id || null, `🔁 ${r.service} — due ${r.due_date}`, lead.est_value || 0, lead.owner_id || null, now(), now());
    db.prepare("UPDATE recurrences SET status='actioned', opportunity_id=? WHERE id=?").run(oid, r.id);
    notifyOwners(r.workspace_id, "recurrence.due", `🔁 Recurring service coming due: ${r.service}`, `${lead.contact_name || "A customer"} is due for ${r.service} on ${r.due_date}. An opportunity was opened — reach out before someone else does.`, lead.id);
    made++;
  }
  return made;
}

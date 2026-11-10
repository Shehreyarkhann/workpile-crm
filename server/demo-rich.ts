// Rich demo scenario — fills every screen with clearly-labeled DEMO data.
// Run AFTER seed.ts against the same DB: node server/demo-rich.ts
import { db, uid, now } from "./db.ts";
const ws = (db.prepare("SELECT id FROM workspaces LIMIT 1").get() as any).id;
const users = db.prepare("SELECT * FROM users WHERE workspace_id=?").all(ws) as any[];
const byRole = (r: string) => users.find(u => u.role === r);
const owner = byRole("OWNER"), approver = byRole("APPROVER"), lo = byRole("LEAD_OWNER"), pm = users.filter(u => u.role === "PM")[0], pm2 = users.filter(u => u.role === "PM")[1];
const pb = db.prepare("SELECT * FROM price_book_items WHERE workspace_id=?").all(ws) as any[];
const mkLead = (name: string, phone: string, email: string, service: string, value: number, state: string, days: number, msg: string, extra: any = {}) => {
  const cid = uid("ct"); db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, ws, name, phone, email);
  const id = uid("lead"); const created = new Date(Date.now() - days * 86400000).toISOString();
  db.prepare(`INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,urgency,value_band,est_value,owner_id,pm_id,approver_id,next_action,next_action_due_at,first_response_at,notes,location,lost_reason,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, ws, cid, phone.replace(/\D/g, ""), service, state, extra.urgency || "this_week", value >= 10000 ? "high" : value >= 2500 ? "medium" : "low", value, lo.id, extra.pm === null ? null : pm.id, approver.id,
    extra.next || "Follow up", new Date(Date.now() + (extra.dueHrs ?? 24) * 3600000).toISOString(), extra.responded ? new Date(Date.now() - days * 43200000).toISOString() : null, msg, "Bay Shore, NY", extra.lost || null, created, now());
  db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("evt"), id, ws, "system", "created", null, "NEW", "{}", created);
  if (state !== "NEW") db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("evt"), id, ws, lo.id, "state_changed", "NEW", state, "{}", now());
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("tsk"), ws, id, lo.id, "follow_up", extra.next || "Follow up", new Date(Date.now() + (extra.dueHrs ?? 24) * 3600000).toISOString(), "open", now());
  return id;
};
const mkProposal = (leadId: string, items: any[], status = "draft") => {
  const total = items.reduce((s, i) => s + i.unit_price * (i.qty || 1), 0);
  const id = uid("prop");
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,margin_band,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, ws, leadId, 1, status, JSON.stringify(items), total, "in_band", now());
  return { id, total };
};
const items1 = [{ price_book_item_id: pb[0].id, name: pb[0].name, qty: 1, unit_price: pb[0].standard_price }, { price_book_item_id: pb[1].id, name: pb[1].name, qty: 3, unit_price: pb[1].standard_price }];

// Board coverage
mkLead("Maria Santos", "+15165550201", "maria@example.com", "Water damage cleanup", 6900, "NEW", 0, "Pipe burst in kitchen, water spreading — need someone today", { urgency: "emergency", responded: true });
mkLead("David Kim", "+15165550202", "david@example.com", "Mold remediation", 4800, "WORKING", 2, "Black mold behind bathroom wall, kids coughing at night", { responded: true });
const qual = mkLead("Susan Wright", "+15165550203", "susan@example.com", "Fire & smoke restoration", 14500, "WORKING", 3, "Electrical fire in garage, smoke through the whole house", { responded: true, next: "Site visit — confirm scope" });
// Ready for approval + pending approval packet (Approval Inbox hero shot)
const rfa = mkLead("James O'Brien", "+15165550204", "james@example.com", "Water damage cleanup", 4550, "PROPOSAL", 1, "Basement flooded after storm, 2 inches standing water, finished basement", { responded: true, next: "Awaiting approval" });
mkProposal(rfa, items1);
db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,submitted_at) VALUES (?,?,?,?,?,?,?,?)")
  .run(uid("apr"), ws, rfa, db.prepare("SELECT id FROM proposals WHERE lead_id=?").get(rfa).id, lo.id, approver.id, "manager", new Date(Date.now() - 2 * 3600000).toISOString());
// Approved → proposal drafted → sent → won chain
const sent = mkLead("Angela Ruiz", "+15165550205", "angela@example.com", "Mold remediation", 4800, "PROPOSAL_SENT", 4, "Mold in primary bathroom and closet", { responded: true, next: "Proposal follow-up Day 2" });
const sp = mkProposal(sent, [{ price_book_item_id: pb[2].id, name: pb[2].name, qty: 1, unit_price: pb[2].standard_price }], "sent");
db.prepare("UPDATE proposals SET sent_at=? WHERE id=?").run(now(), sp.id);
const won = mkLead("Robert Hale", "+15165550206", "robert@example.com", "Fire & smoke restoration", 6500, "WON", 9, "Kitchen fire cleanup", { responded: true });
const wp = mkProposal(won, [{ price_book_item_id: pb[3].id, name: pb[3].name, qty: 1, unit_price: pb[3].standard_price }], "signed");
const projId = uid("prj");
db.prepare("INSERT INTO projects (id,workspace_id,lead_id,proposal_id,pm_id,status,handoff_status,external_project_id,external_system,handoff_delivered_at,handoff_acked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
  .run(projId, ws, won, wp.id, pm.id, "created", "acknowledged", "GC-JOB-1042", "customer-system", now(), now(), now());
db.prepare("INSERT INTO outcome_deliveries (id,workspace_id,lead_id,outcome,payload_hash,attempts,last_status,delivered_at,acknowledged_at,external_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
  .run(uid("dlv"), ws, won, "won", "demo-hash", 1, "acknowledged", now(), now(), "GC-JOB-1042", now());
// a decided approval for FPAR
db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,submitted_by,approver_id,tier,decision,submitted_at,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(uid("apr"), ws, won, wp.id, lo.id, approver.id, "manager", "approved", new Date(Date.now() - 8 * 86400000).toISOString(), new Date(Date.now() - 8 * 86400000 + 3 * 3600000).toISOString());
// change order on the won project
db.prepare("INSERT INTO change_orders (id,workspace_id,project_id,lead_id,delta_scope,delta_total,status,created_at) VALUES (?,?,?,?,?,?,?,?)")
  .run(uid("co"), ws, projId, won, JSON.stringify({ description: "Add dehumidification — 3 extra days", line_items: [{ name: pb[1].name, qty: 3, unit_price: pb[1].standard_price }] }), 1350, "pending_approval", now());
// site visit + documents for the qualifying lead
db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status) VALUES (?,?,?,?,?,?)").run(uid("vis"), ws, qual, pm2.id, new Date(Date.now() + 86400000).toISOString(), "scheduled");
db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status) VALUES (?,?,?,?,?,?)").run(uid("doc"), ws, qual, "Insurance certificate", 1, "missing");
db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,required,status,received_at) VALUES (?,?,?,?,?,?,?)").run(uid("doc"), ws, qual, "Signed proposal", 1, "received", now());
// inbox items (non-lead triage)
const inboxSamples: any[] = [["finance", "QuickBooks", "qb@example.com", "Invoice #1044 — Hale job materials"], ["field", "Paul PM", "paul@demo.test", "Field report — Tuesday, Hale site photos"], ["vendor", "Supply Co", "orders@supply.example", "Order confirmation — dehumidifiers x4"], ["admin", "Insurer", "certs@insurer.example", "Certificate of insurance renewal due Dec 1"]];
for (const [cat, fn, fe, subj] of inboxSamples) db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
  .run(uid("inb"), ws, cat, fn, fe, subj, "", byRole("OPS_ADMIN").id, new Date(Date.now() + 86400000).toISOString(), now(), now());
// sign token for Angela's sent proposal (workflow screenshots: sign + portal + deposit)
const { ensureSignToken } = await import("./sign.ts");
const token = ensureSignToken(sp.id);
const { createDeposit } = await import("./payments.ts");
await createDeposit(sp.id, "http://localhost:4173");
console.log("RICH DEMO READY. Sign/portal token:", token);
console.log("Portal flag: enable customer_portal in Admin for the portal shot.");

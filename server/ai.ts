// Workpile — AI/agentic services (slice 6)
// Invariant (§26): ingested content is data, never instructions. Agents score, group,
// and RECOMMEND; every mutation runs through an explicit human-approved apply call.
import { db, uid, now } from "./db.ts";

const OPEN = ["NEW", "WORKING", "QUALIFIED", "PROPOSAL", "SENT", "FOLLOWUP"];

export function scoreLead(l: any): { score: number; temperature: string; flags: string[] } {
  let score = 30; const flags: string[] = [];
  if (l.contact_phone) score += 10; if (l.contact_email) score += 5;
  if (l.urgency === "emergency") score += 20; else if (l.urgency === "this_week") score += 10;
  if ((l.est_value || 0) >= 10000) score += 15; else if ((l.est_value || 0) >= 3000) score += 8;
  if (l.notes && l.notes.length > 20) score += 8;
  if (l.first_response_at) score += 7;
  const ageDays = (Date.now() - new Date(l.created_at).getTime()) / 86400000;
  if (ageDays > 30 && OPEN.includes(l.state)) { score -= 20; flags.push("stale"); }
  if (!l.owner_id && OPEN.includes(l.state)) flags.push("unassigned");
  if (!l.next_action_due_at && OPEN.includes(l.state)) flags.push("no_next_step");
  score = Math.max(1, Math.min(99, score));
  return { score, temperature: score >= 70 ? "hot" : score >= 45 ? "warm" : "cold", flags };
}

function leadsOf(ws: string) { return db.prepare("SELECT l.*, c.name contact_name, c.phone contact_phone, c.email contact_email FROM leads l LEFT JOIN contacts c ON c.id=l.contact_id WHERE l.workspace_id=?").all(ws) as any[]; }

export function cleanupPreview(ws: string) {
  const leads = leadsOf(ws);
  const byPhone = new Map<string, any[]>(), byEmail = new Map<string, any[]>(), byNameSvc = new Map<string, any[]>();
  for (const l of leads) {
    if (["DUPLICATE", "JUNK"].includes(l.state)) continue;
    if (l.dedupe_key) { const g = byPhone.get(l.dedupe_key) || []; g.push(l); byPhone.set(l.dedupe_key, g); }
    if (l.contact_email) { const g = byEmail.get(l.contact_email.toLowerCase()) || []; g.push(l); byEmail.set(l.contact_email.toLowerCase(), g); }
    const nk = (l.contact_name || "").toLowerCase().trim() + "|" + (l.service_requested || "").toLowerCase().trim();
    if (l.contact_name) { const g = byNameSvc.get(nk) || []; g.push(l); byNameSvc.set(nk, g); }
  }
  const dupGroups = [...byPhone.values(), ...byEmail.values()].filter(g => g.length > 1);
  const seen = new Set<string>(); const dupes: any[] = [];
  for (const g of dupGroups) { const sorted = [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))); for (const extra of sorted.slice(1)) if (!seen.has(extra.id)) { seen.add(extra.id); dupes.push({ id: extra.id, name: extra.contact_name, service: extra.service_requested, keep: sorted[0].id }); } }
  // Fuzzy: same name + service counts as a duplicate only within 7 days of the original — later ones are repeat customers, not dupes.
  for (const g of byNameSvc.values()) { if (g.length < 2) continue; const sorted = [...g].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))); const anchor = new Date(sorted[0].created_at).getTime(); for (const extra of sorted.slice(1)) { if (new Date(extra.created_at).getTime() - anchor <= 7 * 86400000 && !seen.has(extra.id)) { seen.add(extra.id); dupes.push({ id: extra.id, name: extra.contact_name, service: extra.service_requested, keep: sorted[0].id }); } } }
  const spam = leads.filter(l => !["JUNK", "DUPLICATE"].includes(l.state) && (/free money|casino|crypto giveaway|seo services|web design offer/i.test(l.notes || "") || (!(l.contact_phone) && !(l.contact_email))));
  const unassigned = leads.filter(l => OPEN.includes(l.state) && !l.owner_id);
  const unscored = leads.filter(l => l.ai_score === null || l.ai_score === undefined);
  return { duplicates: dupes, duplicate_count: dupes.length, spam: spam.map(l => ({ id: l.id, name: l.contact_name, service: l.service_requested })), spam_count: spam.length, unassigned_count: unassigned.length, unscored_count: unscored.length, total_leads: leads.length };
}

export function cleanupApply(ws: string, actorId: string, actions: string[]) {
  const preview = cleanupPreview(ws);
  const result: any = { archived_duplicates: 0, marked_spam: 0, scored: 0, assigned: 0 };
  if (actions.includes("dedupe")) for (const d of preview.duplicates) {
    db.prepare("UPDATE leads SET state='DUPLICATE', outcome_reason_detail=?, updated_at=? WHERE id=? AND workspace_id=?").run("AI cleanup: merged into " + d.keep, now(), d.id, ws);
    db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,from_state,to_state,payload,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("evt"), d.id, ws, actorId, "ai_cleanup_duplicate", null, "DUPLICATE", JSON.stringify({ keep: d.keep }), now());
    result.archived_duplicates++;
  }
  if (actions.includes("spam")) for (const s of preview.spam) { db.prepare("UPDATE leads SET state='JUNK', updated_at=? WHERE id=? AND workspace_id=?").run(now(), s.id, ws); result.marked_spam++; }
  if (actions.includes("score")) { for (const l of leadsOf(ws)) { const sc = scoreLead(l); db.prepare("UPDATE leads SET ai_score=?, ai_flags=? WHERE id=?").run(sc.score, JSON.stringify({ temperature: sc.temperature, flags: sc.flags }), l.id); result.scored++; } }
  if (actions.includes("assign")) {
    const owners = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role IN ('LEAD_OWNER','OWNER') AND active=1").all(ws) as any[];
    if (owners.length) { const un = db.prepare("SELECT id FROM leads WHERE workspace_id=? AND owner_id IS NULL").all(ws) as any[]; un.forEach((l, i) => { db.prepare("UPDATE leads SET owner_id=?, updated_at=? WHERE id=?").run(owners[i % owners.length].id, now(), l.id); result.assigned++; }); }
  }
  return result;
}

export function insights(ws: string) {
  const leads = leadsOf(ws);
  const p = cleanupPreview(ws);
  const out: any[] = [];
  const stale = leads.filter(l => OPEN.includes(l.state) && (Date.now() - new Date(l.updated_at).getTime()) > 14 * 86400000);
  const staleValue = stale.reduce((s, l) => s + (l.est_value || 0), 0);
  if (p.duplicate_count) out.push({ kind: "cleanup", icon: "🧹", title: `${p.duplicate_count} duplicate leads found`, detail: "Same phone, email, or name+service as an earlier lead. Archive them so reports and follow-ups stay clean.", action: "Open AI Cleanup" });
  if (p.unassigned_count) out.push({ kind: "assign", icon: "👤", title: `${p.unassigned_count} leads have no owner`, detail: "Unowned leads don't get worked. Auto-assign round-robin to your lead owners in one click.", action: "Auto-assign" });
  if (stale.length) out.push({ kind: "stale", icon: "⏰", title: `${stale.length} open leads untouched for 14+ days`, detail: `$${staleValue.toLocaleString()} of pipeline is going cold. A reactivation task sweep takes one click.`, action: "Create reactivation tasks" });
  const hot = leads.filter(l => OPEN.includes(l.state) && l.ai_score >= 70);
  if (hot.length) out.push({ kind: "hot", icon: "🔥", title: `${hot.length} hot leads (AI score 70+) still open`, detail: "Highest-probability work in the building. These should be today's first calls.", action: "View hot leads" });
  const noStep = leads.filter(l => OPEN.includes(l.state) && !l.next_action_due_at);
  if (noStep.length) out.push({ kind: "nextstep", icon: "🧭", title: `${noStep.length} open leads with no next step`, detail: "The #1 backlog killer. Every open lead needs an owner and a next follow-up date.", action: "View leads" });
  return out;
}

export function reactivateStale(ws: string, actorId: string) {
  const leads = leadsOf(ws).filter(l => OPEN.includes(l.state) && (Date.now() - new Date(l.updated_at).getTime()) > 14 * 86400000);
  let created = 0;
  for (const l of leads) { db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run(uid("tsk"), ws, l.id, l.owner_id || actorId, "follow_up", "Reactivation: no activity in 14+ days — call today", new Date(Date.now() + 86400000).toISOString(), "open", now()); created++; }
  return { tasks_created: created };
}

// ---------- slice 16: suggestions, richer insights, automations ----------
export function nextBestAction(l: any, sentDays?: number): { kind: string; label: string; detail: string } {
  const sc = scoreLead(l); const ageDays = Math.floor((Date.now() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
  if (l.state === "SENT" || l.state === "FOLLOWUP") { const d = sentDays ?? 0; return { kind: "nudge", label: d >= 4 ? "Nudge now — proposal going cold" : "Follow up on the proposal", detail: d >= 1 ? `Sent ${d} day${d === 1 ? "" : "s"} ago, still unsigned. A short personal nudge beats waiting for the cadence.` : "Proposal is out. Stay close while they decide." }; }
  if (!l.first_response_at && ["NEW", "WORKING"].includes(l.state)) return { kind: "call", label: sc.temperature === "hot" ? "Call now — hot lead, never contacted" : "Make first contact today", detail: "Speed-to-lead decides win rates: leads contacted in the first hour convert multiples better." };
  if (!l.next_action_due_at && OPEN.includes(l.state)) return { kind: "fix_step", label: "Set the next step", detail: "No owner action is scheduled. A lead without a next step is a lead being forgotten." };
  if (l.state === "PROPOSAL") return { kind: "approve", label: "Send the proposal", detail: "Readiness is a checklist, not a gate — check what is missing, then send. Big proposals may route to an approver by policy." };
  if (ageDays >= 14 && OPEN.includes(l.state)) return { kind: "reactivate", label: `Reactivate — untouched ${ageDays} days`, detail: "Cold, not dead. One call today decides whether this is pipeline or history." };
  if (!l.owner_id && OPEN.includes(l.state)) return { kind: "assign", label: "Assign an owner", detail: "Unowned leads don't get worked." };
  return { kind: "work", label: "Work the next step", detail: l.next_action ? `${l.next_action} — due ${String(l.next_action_due_at || "").slice(0, 10)}.` : "Move it one stage closer to a proposal." };
}

export function insightsV2(ws: string) {
  const out = insights(ws);
  const aging = db.prepare("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL AND julianday('now') - julianday(submitted_at) >= 1").get(ws) as any;
  if (aging.c) out.push({ kind: "approvals", icon: "⚖️", title: `${aging.c} approval packet${aging.c === 1 ? "" : "s"} waiting 24h+`, detail: "Approvals are the bottleneck this product exists to kill. Decide or delegate today.", action: "Review approvals" });
  const cold = db.prepare(`SELECT l.id lead_id, c.name contact_name, CAST((julianday('now') - julianday(COALESCE(p.sent_at, p.created_at))) AS INTEGER) days FROM proposals p JOIN leads l ON l.id=p.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE p.workspace_id=? AND p.status='sent' AND l.state IN ('SENT','FOLLOWUP') AND julianday('now') - julianday(COALESCE(p.sent_at, p.created_at)) >= 4 ORDER BY days DESC LIMIT 1`).get(ws) as any;
  const coldCount = db.prepare(`SELECT COUNT(*) c FROM proposals p JOIN leads l ON l.id=p.lead_id WHERE p.workspace_id=? AND p.status='sent' AND l.state IN ('SENT','FOLLOWUP') AND julianday('now') - julianday(COALESCE(p.sent_at, p.created_at)) >= 4`).get(ws) as any;
  if (coldCount.c) out.push({ kind: "cold", icon: "🧊", title: `${coldCount.c} proposal${coldCount.c === 1 ? "" : "s"} going cold`, detail: `Oldest: ${cold.contact_name}, waiting ${cold.days} days. The cadence nudges, but a human-sent nudge lands harder.`, action: "Nudge the oldest now", lead_id: cold.lead_id });
  return out;
}

export function logAgentRun(ws: string, agent: string, leadId: string | null, output: any) {
  db.prepare("INSERT INTO agent_runs (id,workspace_id,agent,lead_id,model,prompt_version,input_hash,output,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(uid("run"), ws, agent, leadId, "rules-v2", "v2", "", typeof output === "string" ? output : JSON.stringify(output), null, now());
}

export function runAutomationsFor(ws: string): any {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  if (!w) return null;
  const actions: string[] = [];
  if (w.auto_score) actions.push("score");
  if (w.auto_assign) actions.push("assign");
  if (w.auto_dedupe) actions.push("dedupe");
  let result: any = {};
  if (actions.length) result = cleanupApply(ws, "ai-automation", actions);
  if (w.auto_reactivate) result.reactivation_tasks = reactivateStale(ws, "ai-automation").tasks_created;
  db.prepare("UPDATE workspaces SET last_automation_at=? WHERE id=?").run(now(), ws);
  logAgentRun(ws, "automation", null, result);
  return result;
}

export function processAutomations(): { workspaces: number } {
  const rows = db.prepare("SELECT id FROM workspaces WHERE (auto_assign=1 OR auto_dedupe=1 OR auto_reactivate=1 OR auto_score=1) AND (last_automation_at IS NULL OR julianday('now') - julianday(last_automation_at) >= 0.25)").all() as any[];
  for (const r of rows) { try { runAutomationsFor(r.id); } catch { /* one workspace must not stop the sweep */ } }
  return { workspaces: rows.length };
}

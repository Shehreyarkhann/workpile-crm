// V26: inbox intelligence. One suggestion pipeline for the UI and the agent:
// - With an LLM provider configured, the draft is generated FROM the actual
//   email (grounded: no invented facts, dates, prices or promises) and cached
//   on the item. Without one, the deterministic category template is used and
//   honestly labeled source:"template". Nothing here sends anything.
import { db, uid, now } from "./db.ts";
import { suggestInboxAction } from "./inbox.ts";
import { getProvider } from "./llm.ts";
import { queueAndDeliver } from "./comms.ts";

export interface InboxSuggestion { action: string; why: string; draft_subject: string; draft_body: string; source: "ai" | "template"; model?: string }

const SYS = `You triage and draft replies for a field-service business's inbox. You will be given one email.
Reply with ONLY a JSON object: {"action": string, "why": string, "draft_subject": string, "draft_body": string}.
- action: the single best next step, under 8 words (e.g. "Reply to the client today").
- why: one sentence on why, grounded in THIS email's content.
- draft_subject: "Re: " + the original subject.
- draft_body: a ready-to-send reply written TO the sender, in a warm professional voice, specific to what they actually wrote — reference their subject matter concretely. NEVER invent facts, dates, prices, names, or promises that are not in the email. If a commitment needs a specific you don't have, say the team will confirm it and give a relative timeframe (e.g. "by end of day tomorrow") instead of inventing one. Sign off with the business name provided. Keep it under 130 words.`;

export async function inboxSuggestion(wsId: string, item: any, business: string, force = false): Promise<InboxSuggestion> {
  if (!force && item.ai_draft_body) return { action: item.ai_action || "", why: item.ai_why || "", draft_subject: item.ai_draft_subject || "", draft_body: item.ai_draft_body, source: (item.ai_source as any) || "template" };
  const base = suggestInboxAction(item, business);
  const provider = getProvider(wsId);
  if (!provider) { cache(item.id, base, "template"); return { ...base, source: "template" }; }
  try {
    const r = await provider.chat({ system: SYS, messages: [{ role: "user", content: `Business: ${business}\nCategory: ${item.category}\nFrom: ${item.from_name || ""} <${item.from_email || ""}>\nSubject: ${item.subject || ""}\n\n${String(item.body || "").slice(0, 4000)}` }], maxTokens: 700 });
    const txt = r.text || "";
    const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    if (!j || !String(j.draft_body || "").trim()) throw new Error("empty draft");
    const out: InboxSuggestion = { action: String(j.action || base.action), why: String(j.why || base.why), draft_subject: String(j.draft_subject || base.draft_subject), draft_body: String(j.draft_body), source: "ai", model: `${provider.kind}:${r.model}` };
    cache(item.id, out, "ai");
    return out;
  } catch { cache(item.id, base, "template"); return { ...base, source: "template" }; }
}
function cache(itemId: string, s: { action: string; why: string; draft_subject: string; draft_body: string }, source: string) {
  db.prepare("UPDATE inbox_items SET ai_action=?, ai_why=?, ai_draft_subject=?, ai_draft_body=?, ai_source=?, ai_draft_at=? WHERE id=?").run(s.action, s.why, s.draft_subject, s.draft_body, source, now(), itemId);
}

export async function sendInboxReply(wsId: string, item: any, body?: string, subject?: string): Promise<{ status: string }> {
  if (!item.from_email) throw new Error("no sender email on this item");
  const business = (db.prepare("SELECT name FROM workspaces WHERE id=?").get(wsId) as any)?.name || "";
  const fb = item.ai_draft_body ? { draft_subject: item.ai_draft_subject, draft_body: item.ai_draft_body } : suggestInboxAction(item, business);
  const msg: any = await queueAndDeliver(wsId, { lead_id: item.lead_id || undefined, channel: "email", to: item.from_email, subject: String(subject || fb.draft_subject || ""), body: String(body || fb.draft_body || "") });
  db.prepare("UPDATE inbox_items SET status='done', completed_at=? WHERE id=?").run(now(), item.id);
  return { status: msg.status };
}

export function convertInboxItem(wsId: string, actorId: string, item: any): { lead_id: string } {
  // Mirrors the /convert-lead route (contact find-or-create by email, lead, event).
  let contact = item.from_email ? db.prepare("SELECT * FROM contacts WHERE workspace_id=? AND lower(email)=lower(?)").get(wsId, item.from_email) as any : null;
  if (!contact) { const cid = uid("con"); db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, item.from_name || "", "", item.from_email || ""); contact = { id: cid }; }
  const lid = uid("lead");
  const dk = String(item.from_email || "").toLowerCase().replace(/\D/g, "") || String(item.from_email || "").toLowerCase();
  db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,service_requested,notes,dedupe_key,owner_id,created_at,updated_at) VALUES (?,?,?,'NEW','',?,?,?,?)").run(lid, wsId, contact.id, `${item.subject || ""}\n${item.body || ""}`, dk, actorId, now(), now());
  db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,payload,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("ev"), lid, wsId, actorId, "created", JSON.stringify({ source: "email-inbox-converted", inbox_item: item.id }), now());
  db.prepare("UPDATE inbox_items SET status='done', completed_at=?, lead_id=? WHERE id=?").run(now(), lid, item.id);
  return { lead_id: lid };
}

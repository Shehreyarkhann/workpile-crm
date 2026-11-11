// V26: inbox intelligence. One suggestion pipeline for the UI and the agent:
// - With an LLM provider configured, the draft is generated FROM the actual
//   email (grounded: no invented facts, dates, prices or promises) and cached
//   on the item. Without one, the deterministic category template is used and
//   honestly labeled source:"template". Nothing here sends anything.
import { db, uid, now } from "./db.ts";
import { suggestInboxAction } from "./inbox.ts";
import { validateAttachRefs } from "./comms.ts";

// V36: document intelligence for replies. When an email asks for something
// specific — a W-9, an insurance certificate, an invoice, a signed copy —
// the matcher finds the actual document in the workspace so the human
// reviews a ready-to-send reply instead of hunting through files. Matching
// is deterministic (documents are data, not prose) and every suggestion is
// labeled with WHY it was attached; the human can remove any of them.
export function suggestAttachments(wsId: string, item: any): { kind: string; id: string; label: string; why: string }[] {
  const text = `${item.subject || ""} ${item.body || ""}`.toLowerCase();
  const out: { kind: string; id: string; label: string; why: string }[] = [];
  const companyDocs = db.prepare("SELECT id, name, doc_type FROM attachments WHERE workspace_id=? AND entity_type='workspace' ORDER BY created_at DESC").all(wsId) as any[];
  const docByName = (re: RegExp) => companyDocs.find(d => re.test(String(d.name).toLowerCase()));
  // A classified document (doc_type set at upload) always beats a filename
  // guess — the standing naming rule: system names are exact, human
  // filenames are hints.
  const docByType = (t: string, re: RegExp) => companyDocs.find(d => (d as any).doc_type === t) || docByName(re);
  let leadId: string | null = item.lead_id || null;
  if (!leadId && item.from_email) {
    const ct = db.prepare("SELECT id FROM contacts WHERE workspace_id=? AND lower(email)=lower(?)").get(wsId, item.from_email) as any;
    if (ct) { const ld = db.prepare("SELECT id FROM leads WHERE workspace_id=? AND contact_id=? ORDER BY created_at DESC").get(wsId, ct.id) as any; leadId = ld?.id || null; }
  }
  if (/w-?9\b/.test(text)) { const d = docByType("w9", /w-?9/); if (d) out.push({ kind: "attachment", id: d.id, label: d.name, why: "They asked for your W-9" }); }
  if (/certificate of insurance|\bcoi\b|proof of insurance|insurance cert/.test(text)) { const d = docByType("insurance", /insur|coi|certificate/); if (d) out.push({ kind: "attachment", id: d.id, label: d.name, why: "They asked for proof of insurance" }); }
  if (/licen[cs]e/.test(text)) { const d = docByType("license", /licen/); if (d) out.push({ kind: "attachment", id: d.id, label: d.name, why: "They asked for your license" }); }
  if (leadId) {
    if (/invoice|balance|amount (due|owed)|\bbill\b/.test(text)) { const inv = db.prepare("SELECT id, number, total, paid_amount FROM invoices WHERE workspace_id=? AND lead_id=? AND status<>'void' ORDER BY created_at DESC").get(wsId, leadId) as any; if (inv) out.push({ kind: "invoice", id: inv.id, label: `Invoice ${inv.number} (DOCX)`, why: "The invoice for this customer" }); }
    if (/receipt|proof of payment/.test(text)) { const inv = db.prepare("SELECT id, number FROM invoices WHERE workspace_id=? AND lead_id=? AND status='paid' ORDER BY created_at DESC").get(wsId, leadId) as any; if (inv) out.push({ kind: "invoice", id: inv.id, label: `Invoice ${inv.number} — paid (DOCX)`, why: "Receipt: their paid invoice" }); }
    if (/proposal|contract|agreement|signed copy/.test(text)) { const p = db.prepare("SELECT id, number, status FROM proposals WHERE workspace_id=? AND lead_id=? ORDER BY version DESC").get(wsId, leadId) as any; if (p) out.push({ kind: "proposal", id: p.id, label: `Proposal ${p.number ? "PROP-" + p.number : ""} (DOCX)`, why: p.status === "signed" ? "The signed proposal" : "The proposal for this customer" }); }
  }
  const seen = new Set<string>(); return out.filter(o => { const k = o.kind + ":" + o.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
}
import { getProvider } from "./llm.ts";
import { queueAndDeliver } from "./comms.ts";

export interface InboxSuggestion { action: string; why: string; draft_subject: string; draft_body: string; source: "ai" | "template"; model?: string; attachments?: { kind: string; id: string; label: string; why: string }[] }

const SYS = `You triage and draft replies for a field-service business's inbox. You will be given one email.
Reply with ONLY a JSON object: {"action": string, "why": string, "draft_subject": string, "draft_body": string}.
- action: the single best next step, under 8 words (e.g. "Reply to the client today").
- why: one sentence on why, grounded in THIS email's content.
- draft_subject: "Re: " + the original subject.
- draft_body: a ready-to-send reply written TO the sender, in a warm professional voice, specific to what they actually wrote — reference their subject matter concretely. NEVER invent facts, dates, prices, names, or promises that are not in the email. If a commitment needs a specific you don't have, say the team will confirm it and give a relative timeframe (e.g. "by end of day tomorrow") instead of inventing one. Sign off with the business name provided. Keep it under 130 words.`;

export async function inboxSuggestion(wsId: string, item: any, business: string, force = false): Promise<InboxSuggestion> {
  if (!force && item.ai_draft_body) return { action: item.ai_action || "", why: item.ai_why || "", draft_subject: item.ai_draft_subject || "", draft_body: item.ai_draft_body, source: (item.ai_source as any) || "template", attachments: suggestAttachments(wsId, item) };
  const base = suggestInboxAction(item, business);
  const provider = getProvider(wsId);
  if (!provider) { cache(item.id, base, "template"); return { ...base, source: "template", attachments: suggestAttachments(wsId, item) }; }
  try {
    const r = await provider.chat({ system: SYS, messages: [{ role: "user", content: `Business: ${business}\nCategory: ${item.category}\nFrom: ${item.from_name || ""} <${item.from_email || ""}>\nSubject: ${item.subject || ""}\n\n${String(item.body || "").slice(0, 4000)}` }], maxTokens: 700 });
    const txt = r.text || "";
    const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    if (!j || !String(j.draft_body || "").trim()) throw new Error("empty draft");
    const out: InboxSuggestion = { action: String(j.action || base.action), why: String(j.why || base.why), draft_subject: String(j.draft_subject || base.draft_subject), draft_body: String(j.draft_body), source: "ai", model: `${provider.kind}:${r.model}` };
    cache(item.id, out, "ai");
    return { ...out, attachments: suggestAttachments(wsId, item) };
  } catch { cache(item.id, base, "template"); return { ...base, source: "template", attachments: suggestAttachments(wsId, item) }; }
}
function cache(itemId: string, s: { action: string; why: string; draft_subject: string; draft_body: string }, source: string) {
  db.prepare("UPDATE inbox_items SET ai_action=?, ai_why=?, ai_draft_subject=?, ai_draft_body=?, ai_source=?, ai_draft_at=? WHERE id=?").run(s.action, s.why, s.draft_subject, s.draft_body, source, now(), itemId);
}

export async function sendInboxReply(wsId: string, item: any, body?: string, subject?: string, attachments?: any): Promise<{ status: string }> {
  if (!item.from_email) throw new Error("no sender email on this item");
  const business = (db.prepare("SELECT name FROM workspaces WHERE id=?").get(wsId) as any)?.name || "";
  const fb = item.ai_draft_body ? { draft_subject: item.ai_draft_subject, draft_body: item.ai_draft_body } : suggestInboxAction(item, business);
  // No explicit choice from the client → use the matcher's suggestions, so
  // the one-click send carries the document the email asked for. An explicit
  // empty list means the human removed them all — respect that.
  const refs = attachments === undefined ? validateAttachRefs(wsId, suggestAttachments(wsId, item)) : validateAttachRefs(wsId, attachments);
  const msg: any = await queueAndDeliver(wsId, { lead_id: item.lead_id || undefined, channel: "email", to: item.from_email, subject: String(subject || fb.draft_subject || ""), body: String(body || fb.draft_body || ""), attachments: refs });
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

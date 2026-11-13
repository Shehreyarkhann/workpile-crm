// Inbox operator actions (v68): read the incoming email AND the operator's
// draft reply, detect concrete follow-through — schedule a visit/meeting at a
// stated day/time with a named teammate, or a callback — and offer it as a
// one-tap action in the reply window. Deterministic parsing is the floor;
// when an LLM provider is configured it does the extraction first (strict
// JSON, roster-validated) and the parser fills any gaps. Execution always
// goes through executeAction, which re-validates everything server-side.
import { db, uid, now } from "./db.ts";
import { getProvider } from "./llm.ts";

export interface DetectedAction {
  key: string;
  kind: "schedule_visit" | "schedule_task" | "callback";
  person_mention?: string | null;   // a name the text says is attending that the roster could not resolve
  needs_record?: boolean;           // sender has no lead record yet — booking creates one
  label: string;
  when: string;              // ISO instant
  assignee_id?: string | null;
  assignee_name?: string | null;
  title: string;
  draft_line: string;
}

const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MON = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function wsTz(wsId: string): string {
  const ws: any = db.prepare("SELECT tz, timezone FROM workspaces WHERE id=?").get(wsId);
  return ws?.tz || ws?.timezone || "America/New_York";
}
function partsInTz(d: Date, tz: string) {
  const p: any = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(d)) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month - 1, d: +p.day, h: +p.hour % 24, mi: +p.minute, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const target = Date.UTC(y, mo, d, h, mi);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = partsInTz(new Date(guess), tz);
    guess += target - Date.UTC(p.y, p.mo, p.d, p.h, p.mi);
  }
  return new Date(guess);
}
function fmtWhen(iso: string, tz: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}

// ---- deterministic extraction ----------------------------------------------
interface Found { y: number; mo: number; d: number; h: number; mi: number; explicit: boolean }
function parseWhen(text: string, tz: string, allowToday: boolean): Found | null {
  const t = " " + text.toLowerCase() + " ";
  const nowP = partsInTz(new Date(), tz);
  let date: { y: number; mo: number; d: number } | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    let y = m[3] ? +m[3] : nowP.y; if (y < 100) y += 2000;
    date = { y, mo: +m[1] - 1, d: +m[2] };
    if (!m[3] && (date.mo < nowP.mo || (date.mo === nowP.mo && date.d < nowP.d))) date.y += 1;
  } else if ((m = t.match(new RegExp(`\\b(${MON.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`))) || (m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON.join("|")})\\b`)))) {
    const monIdx = MON.indexOf(m[1].length > 2 || isNaN(+m[1]) ? m[1] : m[2]);
    const day = +(isNaN(+m[1]) ? m[2] : m[1]);
    let y = (m as any)[3] ? +(m as any)[3] : nowP.y;
    date = { y, mo: monIdx, d: day };
    if (!(m as any)[3] && (monIdx < nowP.mo || (monIdx === nowP.mo && day < nowP.d))) date.y += 1;
  } else if (/\btomorrow\b/.test(t)) {
    const nx = new Date(Date.UTC(nowP.y, nowP.mo, nowP.d + 1)); date = { y: nx.getUTCFullYear(), mo: nx.getUTCMonth(), d: nx.getUTCDate() };
  } else if (/\btoday\b/.test(t) || /\btonight\b/.test(t)) {
    date = { y: nowP.y, mo: nowP.mo, d: nowP.d };
  } else if ((m = t.match(new RegExp(`\\b(?:next\\s+|this\\s+)?(${DOW.join("|")})\\b`)))) {
    const target = DOW.indexOf(m[1]);
    let delta = (target - nowP.dow + 7) % 7;
    if (delta === 0) delta = allowToday ? 0 : 7;
    const nx = new Date(Date.UTC(nowP.y, nowP.mo, nowP.d + delta)); date = { y: nx.getUTCFullYear(), mo: nx.getUTCMonth(), d: nx.getUTCDate() };
  }
  if (!date) return null;
  let h = 9, mi = 0, explicit = false;
  if ((m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/))) { h = +m[1] % 12; if (m[3] === "pm") h += 12; mi = m[2] ? +m[2] : 0; explicit = true; }
  else if ((m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/))) { h = +m[1]; mi = +m[2]; explicit = true; }
  else if (/\bnoon\b/.test(t)) { h = 12; explicit = true; }
  else if (/\bmorning\b/.test(t)) h = 9; else if (/\bafternoon\b/.test(t)) h = 14; else if (/\bevening\b/.test(t)) h = 17;
  // same-day with the time already gone rolls a week forward for weekday picks
  if (allowToday && date.y === nowP.y && date.mo === nowP.mo && date.d === nowP.d && zonedToUtc(date.y, date.mo, date.d, h, mi, tz).getTime() < Date.now() - 3600_000) {
    const nx = new Date(Date.UTC(date.y, date.mo, date.d + 7)); date = { y: nx.getUTCFullYear(), mo: nx.getUTCMonth(), d: nx.getUTCDate() };
  }
  const chk = new Date(Date.UTC(date.y, date.mo, date.d));
  if (chk.getUTCFullYear() !== date.y || chk.getUTCMonth() !== date.mo || chk.getUTCDate() !== date.d) return null; // e.g. February 30
  return { ...date, h, mi, explicit };
}
function parsePerson(text: string, roster: any[]): any | null {
  const t = " " + text.toLowerCase() + " ";
  for (const u of roster) {
    const first = String(u.name || "").trim().split(/\s+/)[0].toLowerCase();
    if (first.length >= 3 && t.includes(" " + first + " ")) return u;
    const full = String(u.name || "").toLowerCase();
    if (full.length > 3 && t.includes(full)) return u;
  }
  return null;
}
const SCHED_RE = /schedul|meet|appointment|visit|come (out|by)|stop by|walk ?through|be there|send (someone|him|her|a tech)/;
const CALL_RE = /call (me|you|back|us)|give (me|you|us) a call|phone call|ring (me|you)/;

const MENTION_STOP = new Set(["i", "we", "he", "she", "they", "it", "that", "this", "there", "someone", "somebody", "anyone", "everyone", "crew", "team", "tech", "guy", "guys", "friday", "monday", "tuesday", "wednesday", "thursday", "saturday", "sunday", "tomorrow", "today", "will"]);
export function findMention(text: string): string | null {
  const frames = [/([A-Za-z]{3,20}) will be there/g, /([A-Za-z]{3,20}) is coming/g, /([A-Za-z]{3,20}) will attend/g, /([A-Za-z]{3,20}) will be on site/g, /send ([A-Za-z]{3,20}) out/g, /send ([A-Za-z]{3,20}) over/g, /ask ([A-Za-z]{3,20}) to/g];
  for (const re of frames) { let m: RegExpExecArray | null; while ((m = re.exec(text))) { const w = m[1]; if (!MENTION_STOP.has(w.toLowerCase())) return w[0].toUpperCase() + w.slice(1); } }
  return null;
}
export function logActivity(wsId: string, leadId: string, userId: string, type: string, body: string) {
  try { db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,outcome,created_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("act"), leadId, wsId, userId || "", type, body, "", now()); } catch { /* logging never blocks the work */ }
}

function buildAction(kind: DetectedAction["kind"], f: Found, tz: string, person: any, lead: any, senderName: string, opts?: { mention?: string | null; needsRecord?: boolean }): DetectedAction {
  const when = zonedToUtc(f.y, f.mo, f.d, f.h, f.mi, tz).toISOString();
  const whenTxt = fmtWhen(when, tz);
  const who = person ? ` · ${String(person.name).split(/\s+/)[0]}` : "";
  const isVisit = kind === "schedule_visit";
  const title = kind === "callback" ? `Call back ${senderName || "customer"}` : isVisit ? `Site visit — ${lead?.service_requested || senderName || "customer"}` : `Meeting — ${senderName || "customer"}`;
  const draft_line = kind === "callback"
    ? `We'll call you on ${whenTxt.replace(" · ", " at ")}.`
    : isVisit
      ? `We've scheduled your visit for ${whenTxt.replace(" · ", " at ")}${person ? ` — ${String(person.name).split(/\s+/)[0]} will be there` : ""}.`
      : `We've scheduled our meeting for ${whenTxt.replace(" · ", " at ")}${person ? ` — ${String(person.name).split(/\s+/)[0]} will be there` : ""}.`;
  return { key: `${kind}:${when}:${person?.id || ""}`, kind, label: `${kind === "callback" ? "📞 Call back" : isVisit ? "📅 Book visit" : "📅 Book meeting"} — ${whenTxt}${who}${!person && opts?.mention ? ` · ${opts.mention}?` : ""}`, when, assignee_id: person?.id || null, assignee_name: person?.name || null, title, draft_line, person_mention: person ? null : (opts?.mention || null), needs_record: !!opts?.needsRecord };
}

// Extraction prefers the LAST statement in the text: when the operator (or
// the sender) revises a plan mid-message, the latest words are the plan.
function fromText<T>(text: string, fn: (t: string) => T | null): T | null {
  const ss = String(text || "").split(/(?<=[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean);
  for (let i = ss.length - 1; i >= 0; i--) { const r = fn(ss[i]); if (r) return r; }
  return fn(text);
}

export function rulesActions(wsId: string, item: any, draft: string, lead: any): DetectedAction[] {
  const tz = wsTz(wsId);
  const roster = db.prepare("SELECT id, name FROM users WHERE workspace_id=? AND COALESCE(active,1)=1").all(wsId) as any[];
  const incoming = `${item.subject || ""}\n${item.body || ""}`;
  const out: DetectedAction[] = [];
  // The operator's own words win: a stated plan in the draft is the strongest signal.
  for (const [text, allowToday] of [[draft || "", true], [incoming, false]] as const) {
    if (!text.trim()) continue;
    if (!out.some(a => a.kind !== "callback") && SCHED_RE.test(text.toLowerCase())) {
      const f = fromText(text, t2 => parseWhen(t2, tz, allowToday));
      if (f) { const person = fromText(text, t2 => parsePerson(t2, roster)); const mention = person ? null : findMention(text); const canVisit = !!lead || !!item.from_email; out.push(buildAction(canVisit ? "schedule_visit" : "schedule_task", f, tz, person, lead, item.from_name, { mention, needsRecord: !lead && !!item.from_email })); }
    }
    if (!out.some(a => a.kind === "callback") && CALL_RE.test(text.toLowerCase())) {
      const f = fromText(text, t2 => parseWhen(t2, tz, allowToday)) || (() => { const p = partsInTz(new Date(), tz); const nx = new Date(Date.UTC(p.y, p.mo, p.d + 1)); return { y: nx.getUTCFullYear(), mo: nx.getUTCMonth(), d: nx.getUTCDate(), h: 9, mi: 0, explicit: false }; })();
      out.push(buildAction("callback", f, tz, fromText(text, t2 => parsePerson(t2, roster)), lead, item.from_name));
    }
    if (out.length >= 2) break;
  }
  return out.slice(0, 3);
}

// ---- LLM extraction (when a provider is configured) -------------------------
async function aiActions(wsId: string, item: any, draft: string, lead: any): Promise<DetectedAction[] | null> {
  const provider = getProvider(wsId); if (!provider) return null;
  const tz = wsTz(wsId);
  const roster = db.prepare("SELECT id, name FROM users WHERE workspace_id=? AND COALESCE(active,1)=1").all(wsId) as any[];
  const today = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
  try {
    const r = await provider.chat({ system: "You extract concrete scheduling actions from a business email thread and the operator's draft reply. Reply with ONLY a JSON array.", messages: [{ role: "user", content: `Today is ${today} (${tz}). Team: ${roster.map(u => u.name).join(", ")}.
Incoming email from ${item.from_name || ""}: ${String(item.subject || "")} — ${String(item.body || "").slice(0, 2000)}
Operator's draft reply: ${String(draft || "").slice(0, 1000)}
The lead is ${lead ? "linked to a service request: " + (lead.service_requested || "") : "not linked to a job"}.
Extract actions the operator should be offered. Kinds: "schedule_visit" (on-site visit; only when a lead is linked), "schedule_task" (a meeting), "callback". The operator's draft is the strongest signal — a plan stated there ("we can only do Monday 10 am, Mike will be there") is an action. A sender's request ("can we meet Friday?") is also an action.
Each: {"kind","date":"YYYY-MM-DD","time":"HH:MM" (24h, default "09:00"),"assignee_name": exact team name or null,"person_mention": a first name the text says will attend that is NOT in the team list, or null,"title"}.
Resolve relative days against today. Return [] when nothing concrete is proposed. JSON array only.` }], maxTokens: 400 });
    const raw = String((r as any).text || (r as any).content || "");
    const j = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    if (!Array.isArray(j)) return null;
    const out: DetectedAction[] = [];
    for (const a of j.slice(0, 3)) {
      const dm = String(a.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); const tm = String(a.time || "09:00").match(/^(\d{1,2}):(\d{2})$/);
      if (!dm || !tm) continue;
      let person = a.assignee_name ? roster.find(u => String(u.name).toLowerCase() === String(a.assignee_name).toLowerCase()) || null : null;
      if (!person && a.person_mention) person = roster.find(u => String(u.name).split(/\s+/)[0].toLowerCase() === String(a.person_mention).toLowerCase()) || null;
      const canVisit = !!lead || !!item.from_email;
      const kind = a.kind === "callback" ? "callback" : a.kind === "schedule_visit" && canVisit ? "schedule_visit" : "schedule_task";
      out.push(buildAction(kind, { y: +dm[1], mo: +dm[2] - 1, d: +dm[3], h: +tm[1], mi: +tm[2], explicit: true }, tz, person, lead, item.from_name, { mention: person ? null : (a.person_mention ? String(a.person_mention) : null), needsRecord: !lead && !!item.from_email }));
    }
    return out;
  } catch { return null; }
}

export async function detectActions(wsId: string, item: any, draft: string): Promise<{ actions: DetectedAction[]; source: "ai" | "rules"; people: any[] }> {
  const people = db.prepare("SELECT id, name FROM users WHERE workspace_id=? AND COALESCE(active,1)=1 ORDER BY name").all(wsId);
  const lead = item.lead_id ? db.prepare("SELECT * FROM leads WHERE id=?").get(item.lead_id) as any : null;
  const ai = await aiActions(wsId, item, draft, lead);
  const rules = rulesActions(wsId, item, draft, lead);
  const future = (arr: DetectedAction[]) => arr.filter(a => new Date(a.when).getTime() >= Date.now() - 15 * 60000);
  if (ai && ai.length) {
    const merged = [...ai];
    for (const r of rules) if (!merged.some(a => a.kind === r.kind)) merged.push(r);
    return { actions: future(merged).slice(0, 3), source: "ai", people };
  }
  return { actions: future(rules), source: ai ? "ai" : "rules", people };
}

// Every client interaction belongs on a record: when a booking comes from an
// email whose sender has no lead yet, create the record (contact + lead),
// attach the email to it, and log the original message on the timeline.
export function ensureLeadForItem(wsId: string, actor: string, item: any): { lead: any; created: boolean } {
  if (!item.from_email) return { lead: null, created: false };
  let contact = db.prepare("SELECT * FROM contacts WHERE workspace_id=? AND lower(email)=lower(?)").get(wsId, item.from_email) as any;
  if (contact) { const l = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND contact_id=? ORDER BY created_at DESC").get(wsId, contact.id) as any; if (l) { if (!item.lead_id) db.prepare("UPDATE inbox_items SET lead_id=? WHERE id=?").run(l.id, item.id); return { lead: l, created: false }; } }
  if (!contact) { const cid = uid("con"); db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, item.from_name || "", "", item.from_email); contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(cid) as any; }
  const lid = uid("lead");
  const dk = String(item.from_email).replace(/\D/g, "") || String(item.from_email).toLowerCase();
  db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,service_requested,notes,dedupe_key,owner_id,created_at,updated_at) VALUES (?,?,?,'NEW',?,?,?,?,?,?)").run(lid, wsId, contact.id, "", `Created from an inbox booking — ${item.subject || ""}`, dk, actor, now(), now());
  db.prepare("INSERT INTO lead_events (id,lead_id,workspace_id,actor,type,payload,created_at) VALUES (?,?,?,?,?,?,?)").run(uid("ev"), lid, wsId, actor, "created", JSON.stringify({ source: "inbox_booking" }), now());
  db.prepare("UPDATE inbox_items SET lead_id=? WHERE id=?").run(lid, item.id);
  logActivity(wsId, lid, actor, "email_in", `${item.from_name || ""} <${item.from_email}>: ${item.subject || "(no subject)"} — ${String(item.body || "").slice(0, 240)}`);
  return { lead: db.prepare("SELECT * FROM leads WHERE id=?").get(lid), created: true };
}

// ---- execution (server-validated) -------------------------------------------
export function executeAction(wsId: string, actor: string, item: any, a: any) {
  const when = new Date(String(a?.when || ""));
  if (isNaN(when.getTime())) return { error: "bad_when", status: 422 } as any;
  if (when.getTime() < Date.now() - 15 * 60000) return { error: "in_past", status: 422 } as any;
  let lead = item.lead_id ? db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(item.lead_id, wsId) as any : null;
  let recordCreated = false;
  if (!lead) { const r = ensureLeadForItem(wsId, actor, item); lead = r.lead; recordCreated = r.created; }
  let assignee: string | null = null;
  if (a.assignee_id) { const u = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=?").get(a.assignee_id, wsId); if (u) assignee = a.assignee_id; }
  const tz = wsTz(wsId); const whenTxt = fmtWhen(when.toISOString(), tz); const assigneeName = assignee ? (db.prepare("SELECT name FROM users WHERE id=?").get(assignee) as any)?.name : null;
  if (a.kind === "schedule_visit" && lead) {
    const dup = db.prepare("SELECT id FROM site_visits WHERE workspace_id=? AND lead_id=? AND scheduled_at=? AND status='scheduled' AND COALESCE(assigned_to,'')=COALESCE(?,'')").get(wsId, lead.id, when.toISOString(), assignee) as any;
    if (dup) { if (lead) logActivity(wsId, lead.id, actor, "visit_booked", `📅 Site visit booked — ${whenTxt}${assigneeName ? ` · with ${assigneeName}` : ""} (from the inbox reply${recordCreated ? "; record created for this sender" : ""})`); return { created_kind: "site_visit", created_id: dup.id, draft_line: a.draft_line || "", deduped: true, lead_id: lead.id, record_created: recordCreated }; }
    const id = uid("vis");
    db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?,?)")
      .run(id, wsId, lead.id, assignee, when.toISOString(), "scheduled", `Booked from inbox reply${item.subject ? ` — ${item.subject}` : ""}`);
    logActivity(wsId, lead.id, actor, "visit_booked", `📅 Site visit booked — ${whenTxt}${assigneeName ? ` · with ${assigneeName}` : ""} (from the inbox reply${recordCreated ? "; record created for this sender" : ""})`);
    return { created_kind: "site_visit", created_id: id, draft_line: a.draft_line || "", lead_id: lead.id, record_created: recordCreated };
  }
  const dupT = db.prepare("SELECT id FROM tasks WHERE workspace_id=? AND COALESCE(lead_id,'')=COALESCE(?,'') AND assignee_id=? AND due_at=? AND title=? AND status='open'").get(wsId, lead?.id || null, assignee || actor, when.toISOString(), String(a.title || "Follow up").slice(0, 140)) as any;
  if (dupT) { if (lead) logActivity(wsId, lead.id, actor, a.kind === "callback" ? "callback_booked" : "meeting_booked", `${a.kind === "callback" ? "📞 Callback" : "📅 Meeting"} booked — ${whenTxt}${assigneeName ? ` · with ${assigneeName}` : ""} (from the inbox reply)`); return { created_kind: "task", created_id: dupT.id, draft_line: a.draft_line || "", deduped: true, lead_id: lead?.id || null, record_created: recordCreated }; }
  const id = uid("tsk");
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, wsId, lead?.id || null, assignee || actor, a.kind === "callback" ? "callback" : "meeting", String(a.title || "Follow up").slice(0, 140), when.toISOString(), "open", now());
  if (lead) logActivity(wsId, lead.id, actor, a.kind === "callback" ? "callback_booked" : "meeting_booked", `${a.kind === "callback" ? "📞 Callback" : "📅 Meeting"} booked — ${whenTxt}${assigneeName ? ` · with ${assigneeName}` : ""} (from the inbox reply${recordCreated ? "; record created for this sender" : ""})`);
  return { created_kind: "task", created_id: id, draft_line: a.draft_line || "", lead_id: lead?.id || null, record_created: recordCreated };
}

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

function buildAction(kind: DetectedAction["kind"], f: Found, tz: string, person: any, lead: any, senderName: string): DetectedAction {
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
  return { key: `${kind}:${when}:${person?.id || ""}`, kind, label: `${kind === "callback" ? "📞 Call back" : isVisit ? "📅 Book visit" : "📅 Book meeting"} — ${whenTxt}${who}`, when, assignee_id: person?.id || null, assignee_name: person?.name || null, title, draft_line };
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
      if (f) out.push(buildAction(lead ? "schedule_visit" : "schedule_task", f, tz, fromText(text, t2 => parsePerson(t2, roster)), lead, item.from_name));
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
Each: {"kind","date":"YYYY-MM-DD","time":"HH:MM" (24h, default "09:00"),"assignee_name": exact team name or null,"title"}.
Resolve relative days against today. Return [] when nothing concrete is proposed. JSON array only.` }], maxTokens: 400 });
    const raw = String((r as any).text || (r as any).content || "");
    const j = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    if (!Array.isArray(j)) return null;
    const out: DetectedAction[] = [];
    for (const a of j.slice(0, 3)) {
      const dm = String(a.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); const tm = String(a.time || "09:00").match(/^(\d{1,2}):(\d{2})$/);
      if (!dm || !tm) continue;
      const person = a.assignee_name ? roster.find(u => String(u.name).toLowerCase() === String(a.assignee_name).toLowerCase()) || null : null;
      const kind = a.kind === "callback" ? "callback" : a.kind === "schedule_visit" && lead ? "schedule_visit" : "schedule_task";
      out.push(buildAction(kind, { y: +dm[1], mo: +dm[2] - 1, d: +dm[3], h: +tm[1], mi: +tm[2], explicit: true }, tz, person, lead, item.from_name));
    }
    return out;
  } catch { return null; }
}

export async function detectActions(wsId: string, item: any, draft: string): Promise<{ actions: DetectedAction[]; source: "ai" | "rules" }> {
  const lead = item.lead_id ? db.prepare("SELECT * FROM leads WHERE id=?").get(item.lead_id) as any : null;
  const ai = await aiActions(wsId, item, draft, lead);
  const rules = rulesActions(wsId, item, draft, lead);
  if (ai && ai.length) {
    const merged = [...ai];
    for (const r of rules) if (!merged.some(a => a.kind === r.kind)) merged.push(r);
    return { actions: merged.slice(0, 3), source: "ai" };
  }
  return { actions: rules, source: ai ? "ai" : "rules" };
}

// ---- execution (server-validated) -------------------------------------------
export function executeAction(wsId: string, actor: string, item: any, a: any) {
  const when = new Date(String(a?.when || ""));
  if (isNaN(when.getTime())) return { error: "bad_when", status: 422 } as any;
  const lead = item.lead_id ? db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(item.lead_id, wsId) as any : null;
  let assignee: string | null = null;
  if (a.assignee_id) { const u = db.prepare("SELECT id FROM users WHERE id=? AND workspace_id=?").get(a.assignee_id, wsId); if (u) assignee = a.assignee_id; }
  if (a.kind === "schedule_visit" && lead) {
    const id = uid("vis");
    db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?,?)")
      .run(id, wsId, lead.id, assignee, when.toISOString(), "scheduled", `Booked from inbox reply${item.subject ? ` — ${item.subject}` : ""}`);
    return { created_kind: "site_visit", created_id: id, draft_line: a.draft_line || "" };
  }
  const id = uid("tsk");
  db.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, wsId, lead?.id || null, assignee || actor, a.kind === "callback" ? "callback" : "meeting", String(a.title || "Follow up").slice(0, 140), when.toISOString(), "open", now());
  return { created_kind: "task", created_id: id, draft_line: a.draft_line || "" };
}

// Workpile — inbox ingestion (§4.1 email branch + §25 P0-2 full inbox triage)
// Provider note: Gmail / Microsoft 365 OAuth pollers feed this same pipeline once the
// workspace connects credentials; the parse/categorize/create path below is provider-
// agnostic and is what those pollers call. Every email becomes EITHER a lead OR a
// triaged inbox item with an owner — nothing sits unowned (Gregory's 3,000-email rule).

export type InboxCategory = "lead" | "proposal" | "field" | "client_active_job" | "vendor" | "finance" | "admin";

const RULES: [InboxCategory, RegExp][] = [
  ["finance", /invoice|payment|bill|receipt|payroll|timesheet attached/i],
  ["client_active_job", /my job|our project|scheduled visit|technician|appointment/i],
  ["proposal", /signed (proposal|contract)|proposal (attached|sent|ready|approved)|accept(ed)? (the |your )?proposal|contract attached/i],
  ["field", /field report|daily report|site photos|job complete|crew (report|update|finished|completed)/i],
  ["vendor", /supplier|order confirmation|delivery scheduled|material/i],
  ["admin", /insurance|license|permit|renewal|certificate/i],
  ["lead", /quote|estimate|need|looking for|interested|price|service|help with|flood|mold|damage|repair/i],
];

export function categorizeEmail(subject: string, body: string): InboxCategory {
  const text = `${subject} ${body}`;
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return "admin";
}

export function extractPhone(text: string): string {
  const m = (text || "").match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
  return m ? m[0] : "";
}

export interface InboundEmail { from_name?: string; from_email?: string; phone?: string; subject?: string; body?: string; received_at?: string }
export function parseEmail(e: InboundEmail) {
  const category = categorizeEmail(e.subject || "", e.body || "");
  const phone = e.phone || extractPhone(e.body || "");
  return { category, phone, is_lead: category === "lead" };
}

// ---------- slice 18: bulk email parsers (mbox / email CSV) ----------
export function parseMbox(text: string): InboundEmail[] {
  const blocks = String(text).split(/\nFrom [^\n]*\n/).map(b => b.trim()).filter(b => b.length > 20);
  const out: InboundEmail[] = [];
  for (const block of blocks) {
    const splitAt = block.search(/\r?\n\r?\n/);
    const head = splitAt >= 0 ? block.slice(0, splitAt) : block.slice(0, 2000);
    const body = splitAt >= 0 ? block.slice(splitAt).trim().slice(0, 4000) : "";
    const header = (name: string) => { const m = head.match(new RegExp("^" + name + ":\\s*(.*)$", "mi")); return m ? m[1].trim() : ""; };
    const from = header("From"); const fm = from.match(/^(.*?)\s*<([^>]+)>$/) || from.match(/(\S+@\S+)/);
    const from_name = fm && fm[2] ? fm[1].replace(/"/g, "").trim() : "";
    const from_email = fm ? (fm[2] || fm[1]) : "";
    const dateRaw = header("Date"); const d = Date.parse(dateRaw);
    out.push({ from_name, from_email, subject: header("Subject"), body, received_at: isNaN(d) ? undefined : new Date(d).toISOString() });
    if (out.length >= 10000) break;
  }
  return out;
}

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

export function parseEmailCsv(text: string): InboundEmail[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => headers.findIndex(h => names.includes(h));
  const mi = { email: idx(["from_email", "from", "sender", "email", "from address"]), name: idx(["from_name", "sender name", "name"]), subject: idx(["subject", "title"]), body: idx(["body", "message", "text", "snippet", "content"]), date: idx(["date", "received_at", "received", "time"]) };
  return rows.slice(1).filter(r => r.some(c => c.trim())).slice(0, 10000).map(r => {
    const rawFrom = (mi.email >= 0 ? r[mi.email] : "") || "";
    const fm = rawFrom.match(/^(.*?)\s*<([^>]+)>$/) || rawFrom.match(/(\S+@\S+)/);
    const d = mi.date >= 0 ? Date.parse(r[mi.date]) : NaN;
    return { from_name: (mi.name >= 0 ? r[mi.name] : "") || (fm && fm[2] ? fm[1].replace(/"/g, "").trim() : ""), from_email: fm ? (fm[2] || fm[1]) : rawFrom, subject: mi.subject >= 0 ? r[mi.subject] : "", body: (mi.body >= 0 ? r[mi.body] : "").slice(0, 4000), received_at: isNaN(d) ? undefined : new Date(d).toISOString() };
  });
}

// ---------- slice 19: per-category playbooks — suggested action + reply draft ----------
const URGENT_WORDS = /\b(urgent|asap|emergency|complaint|lawsuit|legal|attorney|injured|injury|leak|flooding|flood|fire|hazard|unsafe|past due)\b/i;
// Deterministic inbox priority: category weight + urgent language + age/overdue
// pressure. No model involved — the same rules for every workspace, auditable.
export function inboxPriority(item: any): { tier: "urgent" | "hot" | "normal"; escalated: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const open = (item.status || "open") === "open";
  const ageD = (Date.now() - new Date(item.received_at || item.created_at || Date.now()).getTime()) / 86400000;
  const overdue = open && item.next_action_due_at && new Date(item.next_action_due_at).getTime() < Date.now();
  const hotCat = ["client_active_job", "proposal"].includes(item.category);
  const word = URGENT_WORDS.test(`${item.subject || ""} ${item.body || ""}`);
  if (word) reasons.push("urgent language");
  if (hotCat) reasons.push(item.category === "proposal" ? "proposal mail" : "active-job mail");
  if (item.category === "finance") reasons.push("finance mail");
  if (overdue) reasons.push("past its next-action time");
  let tier: "urgent" | "hot" | "normal" = "normal";
  if (hotCat || word || item.category === "finance") tier = "hot";
  if ((hotCat && overdue) || (word && ageD >= 1) || (overdue && ageD >= 2)) tier = "urgent";
  const escalated = open && ((tier === "urgent" && ageD >= 1) || (overdue && ageD >= 2));
  if (escalated) reasons.push("escalated — waiting too long");
  return { tier, escalated, reasons };
}

export function suggestInboxAction(item: any, business: string): { action: string; why: string; draft_subject: string; draft_body: string } {
  const first = String(item.from_name || "there").split(" ")[0];
  const subj = String(item.subject || "");
  const re = subj.toLowerCase().startsWith("re:") ? subj : `Re: ${subj}`;
  const sign = `\n\n— ${business}`;
  switch (item.category) {
    case "client_active_job": return { action: "Reply to the client today", why: "Active-job clients are your reputation. A same-day, specific answer beats a perfect late one.", draft_subject: re, draft_body: `Hi ${first},\n\nThanks for writing in — we've got this flagged on your job and the team has been updated. You'll hear from us with a specific update by end of day tomorrow at the latest.\n\nIf it's urgent in the meantime, just reply here or call us and reference your job.` + sign };
    case "proposal": return { action: "Confirm receipt & move it forward", why: "A signed/accepted proposal should become scheduled work within one business day — silence here cools deals.", draft_subject: re, draft_body: `Hi ${first},\n\nReceived — thank you! We've logged your signed proposal and our team is preparing the next steps. We'll confirm scheduling details shortly.\n\nAnything you'd like adjusted before we lock it in, just reply here.` + sign };
    case "field": return { action: "File the report & chase what's missing", why: "Field reports close the loop on jobs; missing photos or hours are cheapest to chase the same week.", draft_subject: re, draft_body: `Hi ${first},\n\nReport received and filed — thank you. If any photos, hours, or sign-offs are still missing for this job, please send them today so nothing holds up closeout.` + sign };
    case "vendor": return { action: "Confirm & file with the job paperwork", why: "Vendor confirmations belong with the job file; confirming receipt now prevents delivery-day surprises.", draft_subject: re, draft_body: `Hi ${first},\n\nConfirmed — we've received this and filed it with the job paperwork. If the delivery date or quantities change, please flag it on this thread.` + sign };
    case "finance": return { action: "Acknowledge & route to bookkeeping", why: "Invoices and payroll items age into late fees and unhappy crews; acknowledging receipt buys goodwill while it routes.", draft_subject: re, draft_body: `Hi ${first},\n\nReceived — this has been routed to our bookkeeping today. If anything else is needed from our side, reply here and we'll turn it around quickly.` + sign };
    default: return { action: "Acknowledge & assign", why: "Admin mail (permits, insurance, renewals) carries deadlines — acknowledge it, give it an owner and a date.", draft_subject: re, draft_body: `Hi ${first},\n\nThanks for sending this over — it's logged and assigned internally with a due date. We'll come back on this thread if we need anything from you.` + sign };
  }
}

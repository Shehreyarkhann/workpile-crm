// Workpile — inbox ingestion (§4.1 email branch + §25 P0-2 full inbox triage)
// Provider note: Gmail / Microsoft 365 OAuth pollers feed this same pipeline once the
// workspace connects credentials; the parse/categorize/create path below is provider-
// agnostic and is what those pollers call. Every email becomes EITHER a lead OR a
// triaged inbox item with an owner — nothing sits unowned (Gregory's 3,000-email rule).

export type InboxCategory = "lead" | "proposal" | "field" | "client_active_job" | "vendor" | "finance" | "admin";

const RULES: [InboxCategory, RegExp][] = [
  ["finance", /invoice|payment|bill|receipt|payroll|timesheet attached/i],
  ["field", /field report|daily report|site photos|job complete|crew/i],
  ["proposal", /signed (proposal|contract)|proposal (attached|sent|ready|approved)|accept(ed)? (the |your )?proposal|contract attached/i],
  ["vendor", /supplier|order confirmation|delivery scheduled|material/i],
  ["client_active_job", /my job|our project|scheduled visit|technician|appointment/i],
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

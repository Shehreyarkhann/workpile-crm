// v85 — client spreadsheet import planning. Parses an uploaded workbook
// (Excel or CSV) and maps it onto Workpile leads: the client's own headers
// (STATUS, LEAD/QUOTE/SURVEY, CLIENT NAME, SERVICE REQUESTED, ASSIGNED TO,
// PROJECT TYPE, SERVICE LOCATION, FOLLOW-UP NOTES, FOLLOW-UP DATE,
// RECOMMENDED STATUS) plus the generic aliases. STATUS values land on real
// pipeline stages; nothing in the sheet is silently dropped — unmapped
// columns and values are reported back.
import * as XLSX from "xlsx";

export const STAGE_MAP: Record<string, string> = {
  "lead": "NEW", "new lead": "NEW", "new": "NEW", "prospect": "NEW",
  "survey": "WORKING", "site survey": "WORKING", "survey scheduled": "WORKING", "survey complete": "WORKING", "survey completed": "WORKING", "working": "WORKING", "in progress": "WORKING", "contacted": "WORKING",
  "qualified": "QUALIFIED",
  "quote": "PROPOSAL", "quoting": "PROPOSAL", "quote in progress": "PROPOSAL", "proposal": "PROPOSAL", "proposal in progress": "PROPOSAL",
  "sent quote": "SENT", "quote sent": "SENT", "sent": "SENT", "proposal sent": "SENT", "sent proposal": "SENT",
  "follow up": "FOLLOWUP", "followup": "FOLLOWUP", "follow up needed": "FOLLOWUP",
  "won": "WON", "closed won": "WON", "sold": "WON", "approved": "WON",
  "lost": "LOST", "closed lost": "LOST", "dead": "LOST", "declined": "LOST",
  "no response": "NO_RESPONSE", "unresponsive": "NO_RESPONSE",
  "unserviceable": "UNSERVICEABLE", "cannot service": "UNSERVICEABLE", "out of area": "UNSERVICEABLE",
  "junk": "JUNK", "spam": "JUNK", "duplicate": "DUPLICATE",
};
export const STAGE_NEXT_ACTION: Record<string, string> = {
  NEW: "First contact", WORKING: "Complete the survey / site assessment", QUALIFIED: "Prepare the quote",
  PROPOSAL: "Finish and send the quote", SENT: "Follow up on the sent quote", FOLLOWUP: "Follow up",
  WON: "Kick off the project", LOST: "—", NO_RESPONSE: "Final follow-up attempt", UNSERVICEABLE: "—", JUNK: "—", DUPLICATE: "—",
};
const normVal = (v: any) => String(v ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
export function stageFor(raw: any): string | null { return STAGE_MAP[normVal(raw)] || null; }

const canon = (h: any) => String(h ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const COLS: Record<string, string[]> = {
  status: ["status", "stage", "lead status", "pipeline stage"],
  ref_type: ["lead/quote/survey", "lead / quote / survey", "record type", "type"],
  client_name: ["client name", "client", "customer name", "customer", "name", "full name"],
  service: ["service requested", "service", "service request", "job type", "request"],
  assigned_to: ["assigned to", "assigned", "owner", "salesperson", "sales rep", "rep", "estimator"],
  project_type: ["project type", "type of project"],
  location: ["service location", "location", "address", "service address", "property address", "site address"],
  follow_notes: ["follow-up notes", "follow up notes", "followup notes", "follow-up note", "notes", "note", "comments"],
  follow_date: ["follow-up date", "follow up date", "followup date", "next follow-up", "next follow up", "follow-up", "due date"],
  recommended: ["recommended status", "recommended", "recommendation", "recommended action"],
  phone: ["phone", "phone number", "mobile", "cell"],
  email: ["email", "email address", "e-mail"],
  value: ["value", "est value", "estimated value", "amount", "quote total", "total"],
};

export function parseSheet(buf: Buffer): { headers: string[]; rows: any[][] } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
  const headers = (aoa[0] || []).map(canon);
  const rows = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
  return { headers, rows };
}

function atMorning(d: Date, keepTime: boolean): string {
  if (!keepTime) d.setUTCHours(13, 0, 0, 0); // 9am ET-ish: the local date stays the intended date
  return d.toISOString();
}
export function parseFollowDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return atMorning(new Date(v.getTime()), v.getUTCHours() !== 0 || v.getUTCMinutes() !== 0);
  if (typeof v === "number" && v > 20000 && v < 80000) return atMorning(new Date(Math.round((v - 25569) * 86400000)), false);
  const s = String(v).trim(); if (!s) return null;
  let t = Date.parse(s);
  if (isNaN(t)) { const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) t = Date.parse(`${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`); }
  if (isNaN(t)) return null;
  return atMorning(new Date(t), /[:ap]m?\b/i.test(s) && !/00:00/.test(s));
}

export interface PlannedRow {
  client_name: string; service: string; location: string; stage: string; stage_raw: string;
  ref_type: string; project_type: string; recommended: string; follow_notes: string;
  follow_due: string | null; assignee_id: string | null; assignee_raw: string;
  phone: string; email: string; value: number;
}

export function planSheetImport(headers: string[], rows: any[][], users: any[]) {
  const idx: Record<string, number> = {};
  const mapping: Record<string, string | null> = {};
  for (const [field, aliases] of Object.entries(COLS)) {
    const i = headers.findIndex(h => aliases.includes(h));
    idx[field] = i; mapping[field] = i >= 0 ? headers[i] : null;
  }
  const get = (r: any[], field: string) => (idx[field] >= 0 ? r[idx[field]] : "");
  const byName = new Map<string, string>();
  for (const u of users) byName.set(normVal(u.name), u.id);
  const matchAssignee = (raw: string): string | null => {
    const n = normVal(raw); if (!n) return null;
    if (byName.has(n)) return byName.get(n)!;
    const hits = users.filter(u => { const un = normVal(u.name); return un.split(" ")[0] === n || un.split(" ").slice(-1)[0] === n; });
    return hits.length === 1 ? hits[0].id : null;
  };
  const planned: PlannedRow[] = []; const byStage: Record<string, number> = {};
  const unmapped = new Map<string, number>(); const unmatched = new Map<string, number>();
  for (const r of rows) {
    const statusRaw = String(get(r, "status") ?? "").trim();
    const refRaw = String(get(r, "ref_type") ?? "").trim();
    let stage = stageFor(statusRaw) || stageFor(refRaw);
    if (!stage) { stage = "NEW"; if (statusRaw) unmapped.set(statusRaw, (unmapped.get(statusRaw) || 0) + 1); }
    byStage[stage] = (byStage[stage] || 0) + 1;
    const assigneeRaw = String(get(r, "assigned_to") ?? "").trim();
    const assigneeId = assigneeRaw ? matchAssignee(assigneeRaw) : null;
    if (assigneeRaw && !assigneeId) unmatched.set(assigneeRaw, (unmatched.get(assigneeRaw) || 0) + 1);
    planned.push({
      client_name: String(get(r, "client_name") ?? "").trim(),
      service: String(get(r, "service") ?? "").trim(),
      location: String(get(r, "location") ?? "").trim(),
      stage, stage_raw: statusRaw || refRaw,
      ref_type: refRaw,
      project_type: String(get(r, "project_type") ?? "").trim(),
      recommended: String(get(r, "recommended") ?? "").trim(),
      follow_notes: String(get(r, "follow_notes") ?? "").trim(),
      follow_due: parseFollowDate(get(r, "follow_date")),
      assignee_id: assigneeId, assignee_raw: assigneeRaw,
      phone: String(get(r, "phone") ?? "").trim(),
      email: String(get(r, "email") ?? "").trim(),
      value: Number(String(get(r, "value") ?? "").replace(/[^0-9.]/g, "")) || 0,
    });
  }
  return {
    mapping, planned, byStage,
    unmapped_statuses: [...unmapped.entries()].map(([value, count]) => ({ value, count })),
    unmatched_assignees: [...unmatched.entries()].map(([name, count]) => ({ name, count })),
  };
}

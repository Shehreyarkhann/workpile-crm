// v100 — Scheduled reports: the weekly status (or business snapshot) DOCX
// generates itself and emails the recipients on the chosen weekday/hour in
// the workspace's own timezone. Figures are the same code-computed ones the
// agent's generate_report tool produces. last_sent_at + a 20-hour guard
// make a schedule fire exactly once per due slot.
import fs from "node:fs";
import { db, now, uid } from "./db.ts";
import { generateReportFile } from "./agent-files.ts";
import { storagePut } from "./storage.ts";
import { queueAndDeliver } from "./comms.ts";

export const REPORT_KINDS = ["weekly_status", "business_snapshot"];

export function parseRecipients(raw: string): string[] {
  return String(raw || "").split(/[,\s]+/).map(s => s.trim()).filter(s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)).slice(0, 5);
}

function localWeekdayHour(tz: string): { weekday: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: days[parts.weekday] ?? 0, hour: Number(parts.hour) || 0 };
}

export function scheduleDue(sched: any, tz: string, at = new Date()): boolean {
  if (!sched.enabled) return false;
  const { weekday, hour } = localWeekdayHour(tz);
  if (weekday !== Number(sched.weekday) || hour !== Number(sched.hour)) return false;
  if (sched.last_sent_at && at.getTime() - new Date(sched.last_sent_at).getTime() < 20 * 3600000) return false;
  return true;
}

export async function sendScheduledReport(sched: any): Promise<{ sent_to: string[]; file: string }> {
  const ws = sched.workspace_id;
  const wsRow = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const owner = db.prepare("SELECT id FROM users WHERE workspace_id=? AND role='OWNER' AND active=1 ORDER BY created_at LIMIT 1").get(ws) as any;
  const actor = sched.created_by || owner?.id || "system";
  const file = await generateReportFile(ws, actor, null, REPORT_KINDS.includes(sched.kind) ? sched.kind : "weekly_status");
  const buf = fs.readFileSync(file.path);
  const key = storagePut(`${ws}/workspace/reports/${file.id}-${file.filename}`, buf);
  const attId = uid("att");
  db.prepare("INSERT INTO attachments (id,workspace_id,entity_type,entity_id,name,mime,size,storage_key,uploaded_by,doc_type,created_at,category,orig_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(attId, ws, "workspace", ws, file.filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf.length, key, actor, null, now(), "report", file.filename);
  const recipients = parseRecipients(sched.recipients);
  const title = sched.kind === "business_snapshot" ? "Business Snapshot" : "Weekly Status Report";
  for (const to of recipients) {
    await queueAndDeliver(ws, { channel: "email", to, subject: `${title} — ${wsRow?.name || "Workpile"}`, body: `Your ${title.toLowerCase()} is attached.\n\n${file.headline || ""}\n\nGenerated automatically by Workpile from live data.`, attachments: [{ kind: "attachment", id: attId }] });
  }
  db.prepare("UPDATE report_schedules SET last_sent_at=? WHERE id=?").run(now(), sched.id);
  return { sent_to: recipients, file: file.filename };
}

export async function processReportSchedules(): Promise<void> {
  const rows = db.prepare("SELECT * FROM report_schedules WHERE enabled=1").all() as any[];
  for (const sched of rows) {
    try {
      const wsRow = db.prepare("SELECT timezone FROM workspaces WHERE id=?").get(sched.workspace_id) as any;
      if (scheduleDue(sched, wsRow?.timezone || "America/New_York")) await sendScheduledReport(sched);
    } catch { /* one bad schedule never stops the others */ }
  }
}

// v76: the agent produces real files. Two kinds of generation, both honest
// about where the content comes from:
//  - generate_report: figures are computed by deterministic code from the
//    live database (financialSummary + SQL counts) and rendered verbatim —
//    the model never touches a number, so reports are exact by construction.
//  - draft_document: the model composes prose from tool results it gathered
//    earlier in the same run; the server renders exactly what it wrote.
// Files land on disk under data/generated/<workspace>/ and are recorded in
// generated_files so any run can hand the user a download.
import { db, now, uid } from "./db.ts";
import { financialSummary } from "./metrics.ts";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import fs from "node:fs";
import path from "node:path";

db.exec("CREATE TABLE IF NOT EXISTS generated_files (id TEXT PRIMARY KEY, workspace_id TEXT, user_id TEXT, execution_id TEXT, kind TEXT, title TEXT, filename TEXT, path TEXT, size INTEGER DEFAULT 0, created_at TEXT)");

const money = (n: any) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const day = () => new Date().toISOString().slice(0, 10);
export function slug(s: string): string { return String(s || "Document").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "Document"; }

interface Section { heading: string; lines?: string[]; table?: { head: string[]; rows: string[][] } }

function docBuffer(title: string, subtitle: string, sections: Section[]): Promise<Buffer> {
  const kids: any[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun({ text: subtitle, italics: true, color: "5B6B62" })] }),
  ];
  for (const s of sections) {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.heading)] }));
    for (const ln of s.lines || []) kids.push(new Paragraph({ children: [new TextRun(ln)] }));
    if (s.table) {
      const mk = (cells: string[], bold = false) => new TableRow({ children: cells.map(c => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold })] })] })) });
      kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [mk(s.table.head, true), ...s.table.rows.map(r => mk(r))] }));
    }
  }
  const doc = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 21, color: "101613" } } } }, sections: [{ children: kids }] });
  return Packer.toBuffer(doc) as Promise<Buffer>;
}

function saveFile(ws: string, userId: string, executionId: string | null, kind: string, title: string, buffer: Buffer): any {
  const id = uid("gf");
  const filename = `${slug(title)}-${day()}.docx`;
  const dir = path.join(process.cwd(), "data", "generated", ws);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${id}.docx`);
  fs.writeFileSync(p, buffer);
  db.prepare("INSERT INTO generated_files (id,workspace_id,user_id,execution_id,kind,title,filename,path,size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, ws, userId, executionId, kind, title, filename, p, buffer.length, now());
  return db.prepare("SELECT * FROM generated_files WHERE id=?").get(id);
}
export function getGeneratedFile(ws: string, id: string): any {
  return db.prepare("SELECT * FROM generated_files WHERE id=? AND workspace_id=?").get(id, ws) as any;
}

const FINALS = "('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE','UNSERVICEABLE','CLOSED')";

export async function generateReportFile(ws: string, userId: string, executionId: string | null, kind: string): Promise<any> {
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws) as any;
  const biz = w?.name || "Business";
  const f = financialSummary(ws) as any;
  const q = (sql: string, ...a: any[]) => db.prepare(sql).all(ws, ...a) as any[];
  const one = (sql: string, ...a: any[]) => (db.prepare(sql).get(ws, ...a) as any)?.c || 0;
  const moneySec: Section = { heading: "Money — five figures, never blended", lines: [
    `Estimated pipeline: ${money(f.estimated_pipeline.value)} — ${f.estimated_pipeline.definition}`,
    `Proposal value outstanding: ${money(f.proposal_value_outstanding.value)} — ${f.proposal_value_outstanding.definition}`,
    `Signed contract value: ${money(f.signed_contract_value.value)} — ${f.signed_contract_value.definition}`,
    `Invoiced value: ${money(f.invoiced_value.value)} — ${f.invoiced_value.definition}`,
    `Collected cash: ${money(f.collected_cash.value)} — ${f.collected_cash.definition}`,
  ] };
  const pipeRows = q(`SELECT state, COUNT(*) c, COALESCE(SUM(est_value),0) v FROM leads WHERE workspace_id=? AND state NOT IN ${FINALS} GROUP BY state ORDER BY v DESC`)
    .map(r => [String(r.state).replaceAll("_", " "), String(r.c), money(r.v)]);
  const jobRows = q(`SELECT stage, COUNT(*) c FROM jobs WHERE workspace_id=? GROUP BY stage ORDER BY c DESC`)
    .map(r => [String(r.stage).replaceAll("_", " "), String(r.c)]);
  const overdue = q(`SELECT i.number, i.total, i.paid_amount, i.due_at, c.name FROM invoices i LEFT JOIN jobs j ON j.id=i.job_id LEFT JOIN leads l ON l.id=j.lead_id LEFT JOIN contacts c ON c.id=l.contact_id WHERE i.workspace_id=? AND i.status IN ('sent','partially_paid') AND i.due_at IS NOT NULL AND date(i.due_at) < date('now') ORDER BY i.due_at LIMIT 12`);
  const overdueSec: Section = { heading: `Overdue invoices (${overdue.length})`, table: overdue.length ? { head: ["Invoice", "Customer", "Open amount", "Due"], rows: overdue.map(i => [`#${i.number}`, i.name || "—", money((i.total || 0) - (i.paid_amount || 0)), String(i.due_at).slice(0, 10)]) } : undefined, lines: overdue.length ? undefined : ["None — every sent invoice is current."] };
  const approvals = one("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision IS NULL");
  const proposalsOut = one("SELECT COUNT(*) c FROM proposals WHERE workspace_id=? AND status='sent'");
  const tasksOverdue = one("SELECT COUNT(*) c FROM tasks WHERE workspace_id=? AND status='open' AND date(due_at) < date('now')");
  const inboxOpen = one("SELECT COUNT(*) c FROM inbox_items WHERE workspace_id=? AND status='open'");

  if (kind === "business_snapshot") {
    const svcRows = q(`SELECT l.service_requested s, COUNT(*) jobs, COALESCE(SUM(j.value),0) v FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.workspace_id=? AND j.stage NOT IN ('CANCELLED') GROUP BY s ORDER BY v DESC LIMIT 8`)
      .map(r => [r.s || "—", String(r.jobs), money(r.v)]);
    const team = q(`SELECT name, role FROM users WHERE workspace_id=? AND active=1 ORDER BY name`).map(u => `${u.name} (${u.role})`);
    const sections: Section[] = [moneySec,
      { heading: "Pipeline by stage", table: { head: ["Stage", "Leads", "Estimated value"], rows: pipeRows } },
      { heading: "Jobs by stage", table: { head: ["Stage", "Jobs"], rows: jobRows } },
      overdueSec,
      { heading: "Services by job value", table: { head: ["Service", "Jobs", "Value"], rows: svcRows } },
      { heading: "Waiting & open", lines: [`Approvals waiting on a human: ${approvals}`, `Proposals out for signature: ${proposalsOut}`, `Tasks overdue: ${tasksOverdue}`, `Inbox items open: ${inboxOpen}`] },
      { heading: "Team", lines: team.length ? team : ["No active team members."] },
    ];
    const buf = await docBuffer(`${biz} — Business Snapshot`, `Generated ${day()} from live Workpile data. Every figure computed from the database at generation time.`, sections);
    const row = saveFile(ws, userId, executionId, "business_snapshot", "Business Snapshot", buf);
    return { ...row, headline: `${approvals} approvals waiting · ${overdue.length} overdue invoices · ${money(f.collected_cash.value)} collected` };
  }
  // weekly_status (default)
  const sections: Section[] = [moneySec,
    { heading: "Pipeline by stage", table: { head: ["Stage", "Leads", "Estimated value"], rows: pipeRows } },
    { heading: "Jobs by stage", table: { head: ["Stage", "Jobs"], rows: jobRows } },
    overdueSec,
    { heading: "Waiting & open", lines: [`Approvals waiting on a human: ${approvals}`, `Proposals out for signature: ${proposalsOut}`, `Tasks overdue: ${tasksOverdue}`, `Inbox items open: ${inboxOpen}`] },
  ];
  const buf = await docBuffer(`${biz} — Weekly Status Report`, `Generated ${day()} from live Workpile data. Every figure computed from the database at generation time.`, sections);
  const row = saveFile(ws, userId, executionId, "weekly_status", "Weekly Status Report", buf);
  return { ...row, headline: `${approvals} approvals waiting · ${overdue.length} overdue invoices · ${proposalsOut} proposals out` };
}

// The model composed this prose from data it gathered during the run; render
// it verbatim — ## headings, - bullets, everything else a paragraph.
export async function generateDraftFile(ws: string, userId: string, executionId: string | null, title: string, content: string): Promise<any> {
  const sections: Section[] = [];
  let cur: Section = { heading: "", lines: [] };
  const push = () => { if (cur.heading || (cur.lines && cur.lines.length)) sections.push(cur); };
  for (const raw of String(content || "").split("\n")) {
    const ln = raw.trim();
    if (ln.startsWith("## ")) { push(); cur = { heading: ln.slice(3).trim(), lines: [] }; }
    else if (ln.startsWith("- ") || ln.startsWith("• ")) { (cur.lines ||= []).push("• " + ln.slice(2)); }
    else if (ln) { (cur.lines ||= []).push(ln); }
  }
  push();
  if (!sections.length) sections.push({ heading: title, lines: ["(empty document)"] });
  if (!sections[0].heading) sections[0].heading = title;
  const buf = await docBuffer(title, `Drafted by the Workpile agent from live workspace data · ${day()}. Review before sending — drafts are not sent automatically.`, sections);
  return saveFile(ws, userId, executionId, "draft", title, buf);
}

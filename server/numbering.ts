// v77 — Chain numbering (docs/CHAIN-MODEL.md).
// Every lead gets L<YY>-<NNNN>, every quote Q<YY>-<NNNN>, every project
// P<YY>-<NNNN>-<II> (II = iteration, bumps when a new signed quote supersedes
// the project's original). Counters are per workspace + year, assigned by a
// single atomic upsert; ensureNumbers() sweeps anything a create path missed,
// in created order, so no record is ever numberless.
import { db, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS number_counters (
  workspace_id TEXT, kind TEXT, year INTEGER, last INTEGER DEFAULT 0,
  PRIMARY KEY (workspace_id, kind, year))`);

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const yearOf = (iso?: string | null) => { const y = Number(String(iso || "").slice(0, 4)); return y >= 2000 && y <= 2100 ? y : new Date().getFullYear(); };
const yy = (year: number) => pad(year % 100, 2);

export function nextSerial(ws: string, kind: string, year: number): number {
  const r = db.prepare(`INSERT INTO number_counters (workspace_id, kind, year, last) VALUES (?,?,?,1)
    ON CONFLICT(workspace_id, kind, year) DO UPDATE SET last = last + 1 RETURNING last`).get(ws, kind, year) as any;
  return Number(r.last);
}
const fmtLead = (year: number, n: number) => `L${yy(year)}-${pad(n, 4)}`;
const fmtQuote = (year: number, n: number) => `Q${yy(year)}-${pad(n, 4)}`;
const fmtProject = (year: number, n: number, iter: number) => `P${yy(year)}-${pad(n, 4)}-${pad(iter, 2)}`;

export function assignLeadNo(ws: string, leadId: string): string | null {
  const l = db.prepare("SELECT lead_no, created_at FROM leads WHERE id=? AND workspace_id=?").get(leadId, ws) as any;
  if (!l) return null;
  if (l.lead_no) return l.lead_no;
  const no = fmtLead(yearOf(l.created_at), nextSerial(ws, "lead", yearOf(l.created_at)));
  db.prepare("UPDATE leads SET lead_no=? WHERE id=?").run(no, leadId);
  return no;
}
export function assignQuoteNo(ws: string, proposalId: string): string | null {
  const p = db.prepare("SELECT quote_no, created_at FROM proposals WHERE id=? AND workspace_id=?").get(proposalId, ws) as any;
  if (!p) return null;
  if (p.quote_no) return p.quote_no;
  const no = fmtQuote(yearOf(p.created_at), nextSerial(ws, "quote", yearOf(p.created_at)));
  db.prepare("UPDATE proposals SET quote_no=? WHERE id=?").run(no, proposalId);
  return no;
}
export function assignProjectNo(ws: string, jobId: string): string | null {
  const j = db.prepare("SELECT project_no, project_serial, project_iter, created_at FROM jobs WHERE id=? AND workspace_id=?").get(jobId, ws) as any;
  if (!j) return null;
  if (j.project_no) return j.project_no;
  const year = yearOf(j.created_at);
  const serial = nextSerial(ws, "project", year);
  const iter = Number(j.project_iter || 0);
  const no = fmtProject(year, serial, iter);
  db.prepare("UPDATE jobs SET project_no=?, project_serial=? WHERE id=?").run(no, serial, jobId);
  return no;
}
// A new signed quote superseded the project's original: same serial, iteration + 1.
export function bumpProjectIteration(ws: string, jobId: string): string | null {
  const j = db.prepare("SELECT project_no, project_serial, project_iter, created_at FROM jobs WHERE id=? AND workspace_id=?").get(jobId, ws) as any;
  if (!j || j.project_serial == null) return assignProjectNo(ws, jobId);
  const iter = Number(j.project_iter || 0) + 1;
  const no = fmtProject(yearOf(j.created_at), Number(j.project_serial), iter);
  db.prepare("UPDATE jobs SET project_no=?, project_iter=? WHERE id=?").run(no, iter, jobId);
  return no;
}

// Seed counters from numbers that already exist (so a sweep never reissues one),
// then number every unnumbered row in created order. Idempotent; cheap when clean.
function seedCountersFromExisting(ws: string) {
  const scan = (table: string, col: string, kind: string, re: RegExp) => {
    const rows = db.prepare(`SELECT ${col} AS no, created_at FROM ${table} WHERE workspace_id=? AND ${col} IS NOT NULL`).all(ws) as any[];
    for (const r of rows) {
      const m = re.exec(String(r.no)); if (!m) continue;
      const year = yearOf(r.created_at); const serial = Number(m[1]);
      db.prepare(`INSERT INTO number_counters (workspace_id, kind, year, last) VALUES (?,?,?,?)
        ON CONFLICT(workspace_id, kind, year) DO UPDATE SET last = MAX(last, excluded.last)`).run(ws, kind, year, serial);
    }
  };
  scan("leads", "lead_no", "lead", /^L\d{2}-(\d{4})$/);
  scan("proposals", "quote_no", "quote", /^Q\d{2}-(\d{4})$/);
  scan("jobs", "project_no", "project", /^P\d{2}-(\d{4})-\d{2}$/);
}
export function ensureNumbers(ws: string): void {
  const un = (t: string, c: string) => Number((db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE workspace_id=? AND ${c} IS NULL`).get(ws) as any).c);
  if (un("leads", "lead_no") + un("proposals", "quote_no") + un("jobs", "project_no") === 0) return;
  seedCountersFromExisting(ws);
  for (const r of db.prepare("SELECT id FROM leads WHERE workspace_id=? AND lead_no IS NULL ORDER BY created_at, rowid").all(ws) as any[]) assignLeadNo(ws, r.id);
  for (const r of db.prepare("SELECT id FROM proposals WHERE workspace_id=? AND quote_no IS NULL ORDER BY created_at, rowid").all(ws) as any[]) assignQuoteNo(ws, r.id);
  for (const r of db.prepare("SELECT id FROM jobs WHERE workspace_id=? AND project_no IS NULL ORDER BY created_at, rowid").all(ws) as any[]) assignProjectNo(ws, r.id);
}
export function ensureAllNumbers(): void {
  for (const w of db.prepare("SELECT id FROM workspaces").all() as any[]) { try { ensureNumbers(w.id); } catch { /* one bad workspace never blocks boot */ } }
}
export const _fmt = { fmtLead, fmtQuote, fmtProject, yearOf };
export { now };

// v98 — Customer portal v1: an account-level, branded page behind an
// unguessable per-customer token. Clients see their projects, proposals
// awaiting signature, invoices, and inspection reports — never internal
// costs, margins, notes, or other customers' data.
import { db } from "./db.ts";

export const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const money = (n: any) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STAGE_LABEL: Record<string, string> = { AWAITING_SCHEDULING: "Scheduling", SCHEDULED: "Scheduled", IN_PROGRESS: "Work in progress", ON_HOLD: "On hold", WORK_COMPLETED: "Work completed", DOCUMENTATION_PENDING: "Documentation in preparation", READY_TO_INVOICE: "Ready to invoice", INVOICED: "Invoiced", CLOSED: "Closed", CANCELLED: "Cancelled" };
const RESULT_LABEL: Record<string, string> = { passed: "Passed", passed_with_conditions: "Passed with conditions", failed: "Failed" };

export function portalAccountByToken(token: string): { ws: any; account: any } | null {
  const row = db.prepare("SELECT * FROM portal_tokens WHERE token=? AND revoked_at IS NULL").get(token) as any;
  if (!row) return null;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(row.workspace_id) as any;
  const account = db.prepare("SELECT * FROM accounts WHERE id=? AND workspace_id=?").get(row.account_id, row.workspace_id) as any;
  if (!ws || !account) return null;
  return { ws, account };
}

export function buildPortalData(wsId: string, accountId: string) {
  const leads = db.prepare("SELECT * FROM leads WHERE workspace_id=? AND account_id=?").all(wsId, accountId) as any[];
  const leadIds = leads.map(l => l.id);
  const jobs = leadIds.length ? db.prepare(`SELECT j.*, l.service_requested FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.workspace_id=? AND j.lead_id IN (${leadIds.map(() => "?").join(",")}) ORDER BY j.created_at DESC`).all(wsId, ...leadIds) as any[] : [];
  const jobIds = jobs.map(j => j.id);
  const proposals = leadIds.length ? (db.prepare(`SELECT p.*, s.token AS sign_token FROM proposals p LEFT JOIN signatures s ON s.proposal_id=p.id WHERE p.workspace_id=? AND p.lead_id IN (${leadIds.map(() => "?").join(",")}) AND p.status IN ('sent','approved','signed') ORDER BY p.created_at DESC`).all(wsId, ...leadIds) as any[]).filter((p: any, i: number, a: any[]) => a.findIndex((x: any) => x.id === p.id) === i) : [];
  const invoices = jobIds.length ? db.prepare(`SELECT * FROM invoices WHERE workspace_id=? AND job_id IN (${jobIds.map(() => "?").join(",")}) AND status!='void' ORDER BY created_at DESC`).all(wsId, ...jobIds) as any[] : [];
  const reports = jobIds.length ? db.prepare(`SELECT r.number, r.version, r.share_token, i.title, i.result FROM inspection_reports r JOIN inspections i ON i.id=r.inspection_id WHERE i.workspace_id=? AND i.job_id IN (${jobIds.map(() => "?").join(",")}) ORDER BY r.created_at DESC`).all(wsId, ...jobIds) as any[] : [];
  const visits = leadIds.length ? db.prepare(`SELECT v.* FROM site_visits v WHERE v.workspace_id=? AND v.lead_id IN (${leadIds.map(() => "?").join(",")}) AND v.status='scheduled' AND v.scheduled_at>=? ORDER BY v.scheduled_at LIMIT 5`).all(wsId, ...leadIds, new Date(Date.now() - 86400000).toISOString()) as any[] : [];
  return { leads, jobs, proposals, invoices, reports, visits };
}

export function renderPortalHtml(ws: any, account: any, data: any, token: string): string {
  const accent = "#0E5C3A";
  const sec = (title: string, inner: string) => inner ? `<div class="card"><h2>${title}</h2>${inner}</div>` : "";
  const jobsHtml = data.jobs.map((j: any) => `<div class="row"><div><b>${esc(j.project_no || "Project")}</b><div class="mut">${esc(j.service_requested || j.title || "")}</div></div><span class="pill">${esc(STAGE_LABEL[j.stage] || j.stage)}</span></div>`).join("");
  const visitsHtml = data.visits.map((v: any) => `<div class="row"><div><b>${esc(new Date(v.scheduled_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}</b><div class="mut">Site visit</div></div></div>`).join("");
  const propsHtml = data.proposals.map((p: any) => `<div class="row"><div><b>${esc(p.quote_no || "Proposal")}</b><div class="mut">${money(p.total)} · ${p.status === "signed" ? "Signed ✓" : p.status === "approved" ? "Approved" : "Awaiting your signature"}</div></div>${p.status === "sent" && p.sign_token ? `<a class="btn" href="/sign/${esc(p.sign_token)}">Review & sign</a>` : ""}</div>`).join("");
  const invHtml = data.invoices.map((i: any) => { const paid = i.status === "paid"; return `<div class="row"><div><b>${esc(i.number || "Invoice")}</b><div class="mut">${money(i.total)} · ${paid ? "Paid ✓" : i.status === "partially_paid" ? "Partially paid" : "Payment due"}</div></div>${!paid && i.token ? `<a class="btn" href="/invoice/${esc(i.token)}">View & pay</a>` : ""}</div>`; }).join("");
  const repHtml = data.reports.map((r: any) => `<div class="row"><div><b>${esc(r.number)}</b><div class="mut">${esc(r.title || "Inspection")} · ${esc(RESULT_LABEL[r.result] || "")}</div></div><a class="btn ghost" href="/report/${esc(r.share_token)}">View report</a></div>`).join("");
  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(ws.name)} — Client portal</title>
<style>body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#F7F8F6;color:#101613;margin:0}main{max-width:680px;margin:0 auto;padding:20px 14px 40px}header{display:flex;align-items:center;gap:12px;padding:10px 2px 18px}header img{height:42px;border-radius:8px}h1{font-size:21px;margin:0}h2{font-size:15px;margin:0 0 8px;color:${accent}}.card{background:#fff;border:1px solid #E3E8E3;border-radius:14px;padding:16px;margin-bottom:12px}.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F0F3F0}.row:last-child{border-bottom:0}.mut{color:#5B6B62;font-size:13px;margin-top:2px}.pill{background:#EDF2EE;color:${accent};font-size:12px;font-weight:600;padding:4px 10px;border-radius:99px;white-space:nowrap}.btn{background:${accent};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 14px;border-radius:9px;white-space:nowrap}.btn.ghost{background:#fff;color:${accent};border:1px solid ${accent}}input{width:100%;padding:10px;margin:5px 0;border:1px solid #D9DEDB;border-radius:9px;box-sizing:border-box}button.go{background:${accent};color:#fff;border:0;padding:11px 18px;border-radius:9px;width:100%;font-weight:600}footer{color:#8A968D;font-size:12px;text-align:center;margin-top:18px}</style>
<main><header>${ws.logo_data ? `<img src="${esc(ws.logo_data)}" alt="">` : ""}<div><h1>${esc(ws.name)}</h1><div class="mut">Client portal for ${esc(account.name)}</div></div></header>
${sec("Your projects", jobsHtml)}
${sec("Upcoming visits", visitsHtml)}
${sec("Proposals", propsHtml)}
${sec("Invoices", invHtml)}
${sec("Inspection reports", repHtml)}
<div class="card"><h2>Send us a document or photo</h2><form method="POST" action="/portal/a/${esc(token)}/upload"><input name="filename" placeholder="File name (e.g. insurance-cert.pdf)" required><input name="note" placeholder="Note (optional)"><button class="go" type="submit">Submit</button></form><p class="mut">This records the document against your project so nothing gets lost — the office confirms by email.</p></div>
<footer>Questions? Reply to any email from ${esc(ws.name)} and it reaches the office.</footer></main>`;
}

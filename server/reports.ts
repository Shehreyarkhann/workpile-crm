// Inspection Report Cards (v90): report templates (block-based), frozen report
// snapshots, HTML rendering and PDF generation via headless Chromium (CDP).
// A report is generated only from a CLOSED inspection; it never contains
// internal data (costs, rates, non-client-visible comments).
import { db, uid, now } from "./db.ts";
import { inspProgress } from "./inspections.ts";
import { storagePut, storageGet } from "./storage.ts";
import fs from "node:fs";

db.exec(`
CREATE TABLE IF NOT EXISTS report_templates (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, blocks TEXT DEFAULT '[]', branding TEXT DEFAULT '{}', active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS inspection_reports (id TEXT PRIMARY KEY, workspace_id TEXT, inspection_id TEXT, template_id TEXT, version INTEGER, number TEXT, status TEXT DEFAULT 'generated', overrides TEXT DEFAULT '{}', storage_key TEXT, html_key TEXT, share_token TEXT, format TEXT, created_by TEXT, created_at TEXT);
`);

export const LIMITATIONS_DEFAULT = "This report covers the areas and items listed in the checklist that were accessible at the time of inspection. Areas that were concealed, enclosed, or not safely accessible were not inspected and are excluded from the results. Readings are point-in-time measurements taken with the instruments recorded in this report. This report documents conditions observed on the inspection date and is not a warranty of future conditions.";

export const STANDARD_BLOCKS: any[] = [
  { type: "cover", settings: { hero: true } },
  { type: "toc", settings: {} },
  { type: "summary", settings: { counts: true } },
  { type: "details", settings: {} },
  { type: "scope", settings: {} },
  { type: "work_done", settings: {} },
  { type: "results", settings: { show_na: true } },
  { type: "findings", settings: {} },
  { type: "notes", settings: {} },
  { type: "photos", settings: { layout: 2 } },
  { type: "limitations", settings: { text: LIMITATIONS_DEFAULT } },
  { type: "signoff", settings: {} },
  { type: "appendix_docs", settings: {} },
];
export const STANDARD_BRANDING: any = { accent: "#0E5C3A", footer: true, footer_text: "{{company}} · Confidential — prepared for {{client}}", header: true, client_logo_url: "" };

export const CARD_BLOCKS: any[] = [
  { type: "cover", settings: { hero: false } },
  { type: "summary", settings: { counts: true } },
  { type: "findings", settings: {} },
  { type: "photos", settings: { layout: 3 } },
  { type: "signoff", settings: {} },
];
export const CERT_BLOCKS: any[] = [
  { type: "cover", settings: { hero: false } },
  { type: "details", settings: {} },
  { type: "results", settings: { show_na: false } },
  { type: "limitations", settings: { text: LIMITATIONS_DEFAULT } },
  { type: "signoff", settings: {} },
];
export function ensureReportTemplates(workspaceId: string) {
  const seeds: [string, any[]][] = [["Standard Inspection Report", STANDARD_BLOCKS], ["Inspection Report Card", CARD_BLOCKS], ["Clearance Certificate", CERT_BLOCKS]];
  for (const [name, blocks] of seeds) {
    const exists = db.prepare("SELECT id FROM report_templates WHERE workspace_id=? AND name=?").get(workspaceId, name) as any;
    if (!exists) db.prepare("INSERT INTO report_templates (id,workspace_id,name,blocks,branding,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)")
      .run(uid("rtpl"), workspaceId, name, JSON.stringify(blocks), JSON.stringify(STANDARD_BRANDING), now(), now());
  }
}
export function sampleReportContext(workspaceId: string) {
  const wsRow = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId) as any;
  const sections = [{ title: "Work area", items: [
    { key: "s1", label: "Containment intact", type: "passfail", critical: true },
    { key: "s2", label: "Debris removed", type: "passfail" },
    { key: "s3", label: "Final air clearance (PCM)", type: "reading", unit: " f/cc", min: 0, max: 0.01 } ] }];
  const answers = { s1: { v: "pass" }, s2: { v: "fail", note: "Residue found behind the radiator line." }, s3: { v: "0.008" } };
  return {
    insp: { title: "Post-abatement clearance inspection", summary: "Work complete with one corrective item noted below.", conditions: "Ground floor, access via service corridor", result: "passed_with_conditions", submitted_at: now(), created_at: now(), scheduled_start: now(), review_note: "", decided_at: now() },
    wo: { title: "Full scope of work", description: "Remove asbestos-containing pipe insulation and floor tile per the signed proposal; wet methods, negative-pressure containment, HEPA filtration throughout.", status: "completed", percent_complete: 100 },
    job: { project_no: "P26-0000-00", title: "Sample project" }, lead: null, ws: wsRow, sections, answers,
    progress: { total: 3, answered: 3, pct: 100, failed: 1, critical_failed: 0, out_of_range: 0 },
    inspNo: "P26-0000-00-W01-I01", client: "Sample Client LLC", site: "100 Sample Street", service: "Asbestos abatement",
    photos: [], docs: [], notes: [], comments: [],
    findings: [{ section: "Work area", label: "Debris removed", note: "Residue found behind the radiator line.", critical: false, out_of_range: false, value: "fail", unit: "", min: null, max: null }],
    inspector: "Sample Inspector", license: "NY-AI-0000", reviewer: "Sample Reviewer", result: "passed_with_conditions",
    signed_total: 64000, signed_sections: [{ title: "Scope & approach" }, { title: "Pricing" }], wo_checklist: [{ label: "Waste manifest signed", done: 1 }, { label: "Clearance photos taken", done: 1 }], wo_hours: 26.5, checklist_name: "AHERA post-abatement clearance",
    company: wsRow?.name || "Your Company", logo_data: wsRow?.logo_data || "",
  };
}
export function listReportTemplates(workspaceId: string) {
  ensureReportTemplates(workspaceId);
  return (db.prepare("SELECT * FROM report_templates WHERE workspace_id=? AND active=1 ORDER BY created_at").all(workspaceId) as any[]).map(t => ({ ...t, blocks: JSON.parse(t.blocks || "[]"), branding: JSON.parse(t.branding || "{}") }));
}

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const dOnly = (s: any) => s ? String(s).slice(0, 10) : "—";

export function buildReportContext(workspaceId: string, inspectionId: string) {
  const insp = db.prepare("SELECT * FROM inspections WHERE id=? AND workspace_id=?").get(inspectionId, workspaceId) as any;
  if (!insp) return null;
  const wo = db.prepare("SELECT * FROM work_orders WHERE id=? AND workspace_id=?").get(insp.work_order_id, workspaceId) as any;
  const job = wo ? db.prepare("SELECT * FROM jobs WHERE id=? AND workspace_id=?").get(wo.job_id, workspaceId) as any : null;
  const lead = job ? db.prepare("SELECT * FROM leads WHERE id=? AND workspace_id=?").get(job.lead_id, workspaceId) as any : null;
  const contact = lead?.contact_id ? db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any : null;
  const account = lead?.account_id ? db.prepare("SELECT * FROM accounts WHERE id=?").get(lead.account_id) as any : null;
  const wsRow = db.prepare("SELECT * FROM workspaces WHERE id=?").get(workspaceId) as any;
  const sections = JSON.parse(insp.template_snapshot || "[]");
  const answers = JSON.parse(insp.answers || "{}");
  const progress = inspProgress(insp);
  const pad = (n: number) => String(n).padStart(2, "0");
  const inspNo = job ? `${job.project_no}-W${pad(wo.seq)}-I${pad(insp.seq)}` : insp.id;
  const photos = (db.prepare("SELECT * FROM attachments WHERE workspace_id=? AND entity_type='inspection' AND entity_id=? ORDER BY created_at").all(workspaceId, inspectionId) as any[])
    .map(a => { const buf = a.mime && a.mime.startsWith("image/") ? storageGet(a.storage_key) : null; return { id: a.id, name: a.name, mime: a.mime, item_key: a.item_key, tag: a.tag, caption: a.caption || "", data_uri: buf ? `data:${a.mime};base64,${buf.toString("base64")}` : null }; });
  const docs = (db.prepare("SELECT * FROM attachments WHERE workspace_id=? AND entity_type='inspection' AND entity_id=? ORDER BY created_at").all(workspaceId, inspectionId) as any[]).filter(a => !(a.mime || "").startsWith("image/"));
  const notes = db.prepare("SELECT n.*, u.name AS user_name FROM inspection_notes n LEFT JOIN users u ON u.id=n.user_id WHERE n.workspace_id=? AND n.inspection_id=? ORDER BY n.created_at").all(workspaceId, inspectionId) as any[];
  const comments = db.prepare("SELECT c.*, u.name AS user_name FROM inspection_comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.workspace_id=? AND c.inspection_id=? AND c.client_visible=1 ORDER BY c.created_at").all(workspaceId, inspectionId) as any[];
  const reviewer = insp.reviewer_id ? db.prepare("SELECT name FROM users WHERE id=?").get(insp.reviewer_id) as any : null;
  const findings: any[] = [];
  for (const sec of sections) for (const it of sec.items || []) {
    const a = answers[it.key] || {};
    const isReading = it.type === "reading";
    const oor = isReading && a.v !== undefined && a.v !== "" && ((it.min != null && Number(a.v) < Number(it.min)) || (it.max != null && Number(a.v) > Number(it.max)));
    if (a.v === "fail" || oor) findings.push({ section: sec.title, label: it.label, note: a.note || "", critical: !!it.critical, out_of_range: oor, value: a.v, unit: it.unit || "", min: it.min, max: it.max });
  }
  const signed = lead ? db.prepare("SELECT * FROM proposals WHERE workspace_id=? AND lead_id=? AND status='signed' ORDER BY created_at DESC").get(workspaceId, lead.id) as any : null;
  const woChecklist = wo ? db.prepare("SELECT * FROM wo_checklist WHERE workspace_id=? AND work_order_id=? ORDER BY sort, created_at").all(workspaceId, wo.id) as any[] : [];
  const woHours = wo ? (db.prepare("SELECT COALESCE(SUM(h),0) AS s FROM (SELECT COALESCE(hours,0) AS h FROM wo_time_entries WHERE workspace_id=? AND work_order_id=?)").get(workspaceId, wo.id) as any).s : 0;
  const tpl = insp.template_id ? db.prepare("SELECT name FROM inspection_templates WHERE id=?").get(insp.template_id) as any : null;
  return {
    insp, wo, job, lead, ws: wsRow, sections, answers, progress, inspNo,
    client: account?.name || contact?.name || "Client",
    site: (lead as any)?.location || job?.title || "",
    service: lead?.service_requested || "",
    photos, docs, notes, comments, findings,
    inspector: insp.inspector_name || "—", license: insp.license_no || "",
    reviewer: reviewer?.name || "", result: insp.result || "",
    signed_total: signed?.total ?? null, signed_sections: signed ? JSON.parse(signed.sections_snapshot || "[]") : [],
    wo_checklist: woChecklist, wo_hours: woHours, checklist_name: tpl?.name || "Inspection checklist",
    company: wsRow?.name || "Workpile", logo_data: wsRow?.logo_data || "",
  };
}

// v112 (M4): mergeEsc substitutes the same fields as merge() but HTML-escapes
// every substituted VALUE. The letter/static block bodies render template
// text as authored rich text, so lead-originated values (contact names, site
// addresses arriving via inbound email) must never land in the page raw.
function mergeMap(ctx: any): Record<string, string> {
  return { client: ctx.client, site_address: ctx.site, project_no: ctx.job?.project_no || "", work_order_no: ctx.wo ? ctx.inspNo.split("-I")[0] : "", inspection_no: ctx.inspNo, inspector: ctx.inspector, license_no: ctx.license, date: dOnly(ctx.insp.submitted_at || ctx.insp.created_at), result: ctx.result, company: ctx.company, summary: ctx.insp.summary || "" };
}
function mergeEsc(text: string, ctx: any) {
  const map = mergeMap(ctx);
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => esc(map[k] ?? ""));
}
function merge(text: string, ctx: any) {
  const map = mergeMap(ctx);
  return String(text || "").replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? "");
}
const RESULT_LABEL: Record<string, string> = { passed: "PASSED", passed_with_conditions: "PASSED WITH CONDITIONS", failed: "FAILED" };
const RESULT_COLOR: Record<string, string> = { passed: "#0E5C3A", passed_with_conditions: "#B45309", failed: "#B91C1C" };

export function renderReportHtml(ctx: any, template: any, overrides: any = {}) {
  const branding = { ...STANDARD_BRANDING, ...(template.branding || {}) };
  const accent = branding.accent || "#0E5C3A";
  const excl = new Set(overrides.exclude_photo_ids || []);
  const photos = ctx.photos.filter((p: any) => !excl.has(p.id) && p.data_uri);
  const coverPhoto = photos.find((p: any) => p.id === overrides.cover_photo_id) || photos[0];
  const summaryText = overrides.summary !== undefined ? overrides.summary : (ctx.insp.summary || "");
  const rc = RESULT_COLOR[ctx.result] || "#334155";
  const itemPhotos = (key: string) => photos.filter((p: any) => p.item_key === key);
  const chip = (txt: string, bg: string) => `<span style="display:inline-block;padding:1px 8px;border-radius:99px;background:${bg};color:#fff;font-size:10px;font-weight:700;letter-spacing:.04em">${esc(txt)}</span>`;
  const B: Record<string, (s: any) => string> = {
    cover: () => `<div class="cover">
      ${branding.client_logo_url ? `<img class="clogo" src="${esc(branding.client_logo_url)}" />` : ""}
      ${ctx.logo_data ? `<img class="logo" src="${ctx.logo_data}" />` : `<div class="company">${esc(ctx.company)}</div>`}
      <div class="ctitle">Inspection Report</div>
      <div class="csub">${esc(ctx.insp.title)}</div>
      ${ctx.result ? `<div style="margin:18px 0">${chip(RESULT_LABEL[ctx.result] || ctx.result, rc)}</div>` : ""}
      <table class="ctable"><tr><td>Client</td><td>${esc(ctx.client)}</td></tr>
      <tr><td>Site</td><td>${esc(ctx.site)}</td></tr>
      <tr><td>Report no.</td><td>${esc(ctx.inspNo)}-RPT</td></tr>
      <tr><td>Inspection date</td><td>${dOnly(ctx.insp.submitted_at || ctx.insp.scheduled_start || ctx.insp.created_at)}</td></tr>
      <tr><td>Inspector</td><td>${esc(ctx.inspector)}${ctx.license ? " · Lic. " + esc(ctx.license) : ""}</td></tr>
      <tr><td>Project</td><td>${esc(ctx.job?.project_no || "")} — ${esc(ctx.job?.title || "")}</td></tr></table>
      ${coverPhoto ? `<img class="hero" src="${coverPhoto.data_uri}" />` : ""}
    </div>`,
    letter: (s) => `<h2>Transmittal</h2><div class="rich">${mergeEsc(s.text || "", ctx)}</div>`,
    toc: () => { const names = (template.blocks || []).filter((b: any) => b.type !== "cover" && b.type !== "toc" && b.type !== "pagebreak").map((b: any) => b.type === "static" ? (b.settings?.title || "Section") : ({ summary: "Executive summary", details: "Inspection details", scope: "Scope of work", work_done: "Work done", results: "Results", findings: "Findings & recommendations", photos: "Photo appendix", notes: "Notes", limitations: "Limitations & exclusions", signoff: "Sign-offs", appendix_docs: "Appendix — documents", letter: "Transmittal" } as any)[b.type] || b.type); return `<h2>Contents</h2><ol class="toc">${names.map((n: string) => `<li>${esc(n)}</li>`).join("")}</ol>`; },
    summary: (s) => `<h2>Executive summary</h2>
      ${ctx.result ? `<p><b>Result:</b> ${chip(RESULT_LABEL[ctx.result] || ctx.result, rc)}</p>` : ""}
      ${summaryText ? `<p>${esc(summaryText)}</p>` : ""}
      ${ctx.insp.conditions ? `<p><b>Conditions:</b> ${esc(ctx.insp.conditions)}</p>` : ""}
      ${s.counts !== false ? `<div class="counts">
        <div><b>${ctx.progress.total}</b><span>items checked</span></div>
        <div><b>${ctx.progress.total - ctx.progress.failed}</b><span>passed / recorded</span></div>
        <div><b style="color:${ctx.progress.failed ? "#B91C1C" : "inherit"}">${ctx.progress.failed}</b><span>failed</span></div>
        <div><b style="color:${ctx.progress.out_of_range ? "#B91C1C" : "inherit"}">${ctx.progress.out_of_range}</b><span>readings out of range</span></div>
        <div><b>${photos.length}</b><span>photos</span></div></div>` : ""}
      ${ctx.findings.length ? `<h3>Priority findings</h3>${ctx.findings.map((f: any) => `<div class="finding"><b>${esc(f.label)}</b> <span class="muted">(${esc(f.section)})</span>${f.critical ? " " + chip("CRITICAL", "#B91C1C") : ""}${f.out_of_range ? ` — reading <b>${esc(f.value)}${esc(f.unit)}</b> outside ${f.min ?? "…"}–${f.max ?? "…"}${esc(f.unit)}` : ""}${f.note ? `<br/><span>${esc(f.note)}</span>` : ""}</div>`).join("")}` : `<p>No failed items were recorded.</p>`}`,
    details: () => `<h2>Inspection details</h2><table class="kv">
      <tr><td>Inspection</td><td>${esc(ctx.inspNo)} — ${esc(ctx.insp.title)}</td></tr>
      <tr><td>Checklist</td><td>${esc(ctx.checklist_name)}</td></tr>
      <tr><td>Inspector</td><td>${esc(ctx.inspector)}${ctx.license ? " · License " + esc(ctx.license) : ""}</td></tr>
      ${ctx.reviewer ? `<tr><td>Reviewed by</td><td>${esc(ctx.reviewer)}${ctx.insp.review_note ? " — " + esc(ctx.insp.review_note) : ""}</td></tr>` : ""}
      <tr><td>Scheduled</td><td>${dOnly(ctx.insp.scheduled_start)}${ctx.insp.scheduled_end ? " → " + dOnly(ctx.insp.scheduled_end) : ""}</td></tr>
      <tr><td>Submitted</td><td>${dOnly(ctx.insp.submitted_at)}</td></tr>
      <tr><td>Work order</td><td>${esc(ctx.inspNo.split("-I")[0])} — ${esc(ctx.wo?.title || "")}</td></tr>
      <tr><td>Service</td><td>${esc(ctx.service)}</td></tr></table>`,
    scope: () => `<h2>Scope of work</h2>
      ${ctx.wo?.description ? `<p>${esc(ctx.wo.description)}</p>` : ""}
      ${ctx.signed_sections.length ? `<p>The inspection was performed against the signed scope:</p><ul>${ctx.signed_sections.map((s: any) => `<li>${esc(s.title)}</li>`).join("")}</ul>` : ""}
      ${ctx.signed_total != null ? `<p class="muted">Contract value: $${Number(ctx.signed_total).toLocaleString()}</p>` : ""}`,
    work_done: () => `<h2>Work done</h2>
      <p>Work order <b>${esc(ctx.inspNo.split("-I")[0])}</b> — ${esc(ctx.wo?.title || "")} · status ${esc(ctx.wo?.status || "")} · ${ctx.wo?.percent_complete ?? 0}% complete · ${ctx.wo_hours} hours on site.</p>
      ${ctx.wo_checklist.length ? `<ul>${ctx.wo_checklist.map((c: any) => `<li>${c.done ? "☑" : "☐"} ${esc(c.label)}</li>`).join("")}</ul>` : ""}`,
    results: (s) => `<h2>Results</h2>${ctx.sections.map((sec: any) => `<h3>${esc(sec.title)}</h3><table class="res">
      ${(sec.items || []).map((it: any) => { const a = ctx.answers[it.key] || {}; if (a.v === undefined && s.show_na === false) return "";
        const val = it.type === "reading" ? (a.v !== undefined && a.v !== "" ? `${esc(a.v)}${esc(it.unit || "")}${it.min != null || it.max != null ? ` <span class="muted">(acceptable ${it.min ?? "…"}–${it.max ?? "…"}${esc(it.unit || "")})</span>` : ""}` : "—")
          : it.type === "passfail" ? (a.v === "pass" ? chip("PASS", "#0E5C3A") : a.v === "fail" ? chip("FAIL", "#B91C1C") : a.v === "na" ? chip("N/A", "#64748B") : "—")
          : it.type === "yesno" ? (a.v === "yes" ? "Yes" : a.v === "no" ? "No" : "—") : esc(a.v ?? "—");
        const ip = itemPhotos(it.key);
        return `<tr><td style="width:38%">${esc(it.label)}${it.critical ? " " + chip("CRITICAL", "#B91C1C") : ""}${a.note ? `<br/><span class="muted">${esc(a.note)}</span>` : ""}${ip.length ? `<div class="iphotos">${ip.map((p: any) => `<figure><img src="${p.data_uri}"/><figcaption>${esc(p.caption || p.tag || "")}</figcaption></figure>`).join("")}</div>` : ""}</td><td>${val}</td></tr>`; }).join("")}</table>`).join("")}`,
    findings: () => ctx.findings.length ? `<h2>Findings &amp; recommendations</h2>${ctx.findings.map((f: any, i: number) => `<div class="finding"><b>${i + 1}. ${esc(f.label)}</b> <span class="muted">(${esc(f.section)})</span>${f.note ? `<br/>${esc(f.note)}` : ""}<br/><span class="muted">Recommendation: correct and re-inspect, or document an accepted corrective action.</span></div>`).join("")}` : "",
    photos: (s) => { const groups: Record<string, any[]> = { before: [], during: [], after: [], other: [] }; for (const p of photos) (groups[p.tag as string] || groups.other).push(p);
      const grid = (arr: any[]) => `<div class="pgrid${s.layout === 3 ? " three" : ""}">${arr.map(p => `<figure><img src="${p.data_uri}"/><figcaption>${esc(p.caption || p.name)}</figcaption></figure>`).join("")}</div>`;
      return `<h2>Photo appendix</h2>${["before", "during", "after", "other"].filter(k => groups[k].length).map(k => `<h3 style="text-transform:capitalize">${k}</h3>${grid(groups[k])}`).join("") || "<p>No photos attached.</p>"}`; },
    notes: () => (ctx.notes.length || ctx.comments.length) ? `<h2>Notes</h2>${ctx.notes.map((n: any) => `<p><b>${esc(n.user_name || "")}</b> <span class="muted">${dOnly(n.created_at)}</span><br/>${esc(n.body)}</p>`).join("")}${ctx.comments.filter((c: any) => c.client_visible).map((c: any) => `<p><b>${esc(c.user_name || "")}</b> <span class="muted">${dOnly(c.created_at)}</span><br/>${esc(c.body)}</p>`).join("")}` : "",
    limitations: (s) => `<h2>Limitations &amp; exclusions</h2><p>${esc(s.text || LIMITATIONS_DEFAULT)}</p>`,
    signoff: () => `<h2>Sign-offs</h2><table class="kv">
      <tr><td>Inspector</td><td>${esc(ctx.inspector)}${ctx.license ? " · Lic. " + esc(ctx.license) : ""}<br/><span class="sig">Signature: ______________________________ &nbsp; Date: ${dOnly(ctx.insp.submitted_at)}</span></td></tr>
      ${ctx.reviewer ? `<tr><td>Reviewer</td><td>${esc(ctx.reviewer)}<br/><span class="sig">Signature: ______________________________ &nbsp; Date: ${dOnly(ctx.insp.decided_at)}</span></td></tr>` : ""}
      <tr><td>Client acceptance</td><td><span class="sig">Signature: ______________________________ &nbsp; Date: ____________</span></td></tr></table>`,
    appendix_docs: () => ctx.docs.length ? `<h2>Appendix — documents</h2><ul>${ctx.docs.map((d: any) => `<li>${esc(d.name)} <span class="muted">(${esc(d.category || "document")})</span></li>`).join("")}</ul>` : "",
    static: (s) => `${s.title ? `<h2>${esc(merge(s.title, ctx))}</h2>` : ""}<div class="rich">${mergeEsc(s.text || "", ctx)}</div>`,
    pagebreak: () => `<div class="pb"></div>`,
  };
  const body = (template.blocks || []).map((b: any) => (B[b.type] ? B[b.type](b.settings || {}) : "")).join("\n");
  const footerText = branding.footer ? esc(merge(branding.footer_text || "", ctx)) : "";
  return { html: `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; }
    body { font-family: Inter, Helvetica, Arial, sans-serif; color: #101613; font-size: 12.5px; line-height: 1.5; }
    h2 { font-size: 17px; font-weight: 800; letter-spacing: -.02em; border-bottom: 2px solid ${accent}; padding-bottom: 4px; margin: 22px 0 10px; }
    h3 { font-size: 13.5px; margin: 14px 0 6px; }
    .muted { color: #5B6B62; } .rich { white-space: pre-wrap; }
    .cover { text-align: left; } .cover .company { font-size: 20px; font-weight: 800; color: ${accent}; }
    .cover .logo { max-height: 64px; } .cover .clogo { max-height: 40px; float: right; }
    .ctitle { font-size: 34px; font-weight: 800; letter-spacing: -.03em; margin-top: 26px; }
    .csub { font-size: 16px; color: #334155; }
    .ctable { width: 100%; border-collapse: collapse; margin: 14px 0; } .ctable td { padding: 5px 8px; border-bottom: 1px solid #E5EAE6; } .ctable td:first-child { color: #5B6B62; width: 130px; }
    .hero { width: 100%; max-height: 340px; object-fit: cover; border-radius: 8px; margin-top: 8px; }
    .counts { display: flex; gap: 10px; margin: 12px 0; } .counts div { flex: 1; border: 1px solid #E5EAE6; border-radius: 8px; padding: 10px; text-align: center; } .counts b { display: block; font-size: 22px; } .counts span { color: #5B6B62; font-size: 11px; }
    table.kv, table.res { width: 100%; border-collapse: collapse; } table.kv td, table.res td { padding: 5px 8px; border-bottom: 1px solid #EDF1EE; vertical-align: top; } table.kv td:first-child { color: #5B6B62; width: 140px; }
    .finding { border-left: 3px solid #B91C1C; padding: 6px 10px; margin: 8px 0; background: #FDF7F7; }
    .pgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .pgrid.three { grid-template-columns: 1fr 1fr 1fr; }
    .pgrid figure, .iphotos figure { margin: 0; } .pgrid img { width: 100%; height: 190px; object-fit: cover; border-radius: 6px; } .pgrid.three img { height: 140px; }
    .iphotos { display: flex; gap: 6px; margin-top: 5px; } .iphotos img { width: 110px; height: 82px; object-fit: cover; border-radius: 5px; }
    figcaption { font-size: 10.5px; color: #5B6B62; margin-top: 2px; }
    .sig { color: #5B6B62; } .pb { page-break-after: always; } ol.toc li { margin: 3px 0; }
  </style></head><body>${body}${footerText ? `<div style="margin-top:28px;padding-top:8px;border-top:1px solid #E5EAE6;text-align:center;color:#8a968e;font-size:10px">${footerText}</div>` : ""}</body></html>`, footerText };
}

export function findChromium(): string | null {
  const candidates = [process.env.WORKPILE_CHROMIUM, "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].filter(Boolean) as string[];
  for (const c of candidates) { try { if (fs.existsSync(c)) return c; } catch { /* noop */ } }
  return null;
}

export async function htmlToPdf(html: string, footerText: string): Promise<Buffer | null> {
  const exe = findChromium();
  if (!exe) return null;
  try {
    const puppeteer = (await import("puppeteer-core")).default as any;
    const browser = await puppeteer.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 30000 });
      const pdf = await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: !!footerText, headerTemplate: "<span></span>", footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#8a968e;padding:0 36px">${footerText} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`, margin: { top: "34px", bottom: "48px", left: "34px", right: "34px" } });
      return Buffer.from(pdf);
    } finally { await browser.close(); }
  } catch { return null; }
}

export async function generateReport(workspaceId: string, userId: string, inspectionId: string, templateId: string | undefined, overrides: any) {
  const ctx = buildReportContext(workspaceId, inspectionId);
  if (!ctx) return { error: "not_found" as const };
  if (ctx.insp.status !== "closed") return { error: "not_closed" as const };
  ensureReportTemplates(workspaceId);
  const tplRow = templateId ? db.prepare("SELECT * FROM report_templates WHERE id=? AND workspace_id=?").get(templateId, workspaceId) as any : db.prepare("SELECT * FROM report_templates WHERE workspace_id=? AND active=1 ORDER BY created_at LIMIT 1").get(workspaceId) as any;
  if (!tplRow) return { error: "no_template" as const };
  const template = { ...tplRow, blocks: JSON.parse(tplRow.blocks || "[]"), branding: JSON.parse(tplRow.branding || "{}") };
  const { html, footerText } = renderReportHtml(ctx, template, overrides || {});
  const version = ((db.prepare("SELECT COUNT(*) AS c FROM inspection_reports WHERE workspace_id=? AND inspection_id=?").get(workspaceId, inspectionId) as any).c || 0) + 1;
  const id = uid("rpt"); const token = uid("shr") + uid("");
  const htmlKey = storagePut(`${workspaceId}/reports/${inspectionId}/${id}.html`, Buffer.from(html));
  const pdf = await htmlToPdf(html, footerText);
  const pdfKey = pdf ? storagePut(`${workspaceId}/reports/${inspectionId}/${id}.pdf`, pdf) : null;
  db.prepare("INSERT INTO inspection_reports (id,workspace_id,inspection_id,template_id,version,number,status,overrides,storage_key,html_key,share_token,format,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, workspaceId, inspectionId, tplRow.id, version, `${ctx.inspNo}-RPT`, "generated", JSON.stringify(overrides || {}), pdfKey, htmlKey, token, pdf ? "pdf" : "html", userId, now());
  return { report: db.prepare("SELECT * FROM inspection_reports WHERE id=?").get(id) as any };
}
export function listReports(workspaceId: string, inspectionId: string) {
  return db.prepare("SELECT id,number,version,format,share_token,created_at,template_id FROM inspection_reports WHERE workspace_id=? AND inspection_id=? ORDER BY version DESC").all(workspaceId, inspectionId);
}

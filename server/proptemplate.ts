// Workpile — proposal document template (slice 17)
// One template per workspace: company header, rich-text intro + terms, footer.
// Proposals render from it three ways: print/PDF page, DOCX, and the sign page data.
import { db } from "./db.ts";

const ALLOWED = new Set(["p", "br", "b", "strong", "i", "em", "u", "h3", "h4", "ul", "ol", "li", "div", "span", "img"]);
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  let out = String(html).replace(/<(script|style|iframe|object|embed|form|input|button)[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    const t = String(tag).toLowerCase();
    if (!ALLOWED.has(t)) return "";
    if (m.startsWith("</")) return `</${t}>`;
    if (t === "br") return "<br>";
    if (t === "img") { const m = attrs.match(/src\s*=\s*"([^"]+)"/i) || attrs.match(/src\s*=\s*'([^']+)'/i); const src = m ? m[1] : ""; if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src) || /^https:\/\//i.test(src)) return `<img src="${src}" style="max-width:100%;height:auto" alt="">`; return ""; }
    return `<${t}>`; // all other attributes stripped — no handlers, no styles, no links
  });
  return out.slice(0, 20000);
}

export function htmlToParagraphs(html: string): string[] {
  if (!html) return [];
  const text = String(html)
    .replace(/<li[^>]*>/gi, "\n• ").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h3|h4|ul|ol)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return text.split("\n").map(x => x.trim()).filter(Boolean);
}

export const DEFAULT_INTRO = "<p>Dear {customer},</p><p>Thank you for the opportunity to propose on your {service} project. Based on our site assessment, the scope below covers everything needed to complete the work safely, to code, and with minimal disruption. Every line is priced from our standard price book — no surprises after signing.</p>";
export const DEFAULT_TERMS = "<p>Proposal valid for 14 days from the date above. A deposit is due on signing; the balance is due on completion unless a payment plan is agreed in writing. Scope changes are handled by written change order, priced from the same price book and approved before work proceeds. All work is performed by licensed, insured personnel.</p>";
export const DEFAULT_FOOTER = "Thank you for considering {business}. Questions? Reply to this proposal or call us — we're happy to walk through any line.";

export function getTemplate(wsId: string) {
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(wsId) as any;
  return {
    company: w.pt_company || w.name || "",
    tagline: w.pt_tagline || "",
    contact_line: w.pt_contact || "",
    address: w.pt_address || "",
    intro_html: w.pt_intro || DEFAULT_INTRO,
    terms_html: w.pt_terms || DEFAULT_TERMS,
    footer: (w.pt_footer || DEFAULT_FOOTER),
    logo: w.logo_data || null,
    customized: !!(w.pt_company || w.pt_intro || w.pt_terms || w.pt_footer),
  };
}

export function mergeFields(text: string, ctx: Record<string, string>): string {
  let out = String(text || "");
  for (const [k, v] of Object.entries(ctx)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

// Smart template resolution (v33): the template whose applies_to matches the
// lead's requested service wins (exact normalized match, then containment);
// otherwise the workspace default doc template; otherwise null (the single
// workspace template renders). Used when a proposal is composed without an
// explicit template choice — by the API create route and the agent drafter.
export function resolveDocTemplateId(workspaceId: string, service?: string | null): string | null {
  try {
    const rows = db.prepare("SELECT id, applies_to, is_default FROM doc_templates WHERE workspace_id=?").all(workspaceId) as any[];
    const norm = (s: any) => String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
    const svc = norm(service);
    if (svc) {
      const exact = rows.find(r => r.applies_to && norm(r.applies_to) === svc);
      if (exact) return exact.id;
      const fuzzy = rows.find(r => { const a = norm(r.applies_to); return a.length >= 4 && (svc.includes(a) || a.includes(svc)); });
      if (fuzzy) return fuzzy.id;
    }
    return (rows.find(r => r.is_default) || rows[0] || {}).id || null;
  } catch { return null; }
}

export function proposalDocument(proposalId: string) {
  const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(proposalId) as any;
  if (!p) return null;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any;
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(lead?.contact_id) as any;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(p.workspace_id) as any;
  let tpl = getTemplate(p.workspace_id);
  let docName: string | null = null;
  // Template resolution: the proposal's own template if one was pinned,
  // otherwise the workspace's DEFAULT doc template, otherwise the single
  // workspace template. Users never pick templates while composing (v31).
  const tplId = p.template_id || (() => { try { return (db.prepare("SELECT id FROM doc_templates WHERE workspace_id=? AND is_default=1").get(p.workspace_id) as any)?.id || null; } catch { return null; } })();
  if (tplId) { try { const dt = db.prepare("SELECT * FROM doc_templates WHERE id=? AND workspace_id=?").get(tplId, p.workspace_id) as any; if (dt) { tpl = { ...tpl, intro_html: dt.intro_html || tpl.intro_html, terms_html: dt.terms_html || tpl.terms_html, footer: dt.footer || tpl.footer, logo: dt.include_logo ? (tpl.logo || null) : null }; docName = dt.name; } } catch { /* doc templates not initialized yet */ } }
  // Human proposal number: sequential per workspace from 1001, assigned at
  // creation. Legacy rows (pre-v31) get their number frozen on first render
  // by created_at order, so a printed reference never changes afterwards.
  let pnum = p.number as number | null;
  if (!pnum) { pnum = ((db.prepare("SELECT COALESCE(MAX(number),1000) m FROM proposals WHERE workspace_id=?").get(p.workspace_id) as any).m || 1000) + 1; try { db.prepare("UPDATE proposals SET number=? WHERE id=? AND number IS NULL").run(pnum, p.id); } catch { /* read-only replica safety */ } }
  const ref = "PROP-" + pnum;
  const ctx: Record<string, string> = {
    customer: contact?.name || "", business: tpl.company, service: lead?.service_requested || "",
    total: "$" + Number(p.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    date: new Date(p.created_at).toLocaleDateString(), ref, location: lead?.location || "",
  };
  return {
    workspace_id: p.workspace_id,
    ref, proposal: { id: p.id, version: p.version, status: p.status, total: p.total, created_at: p.created_at, expires_at: p.expires_at || null, deposit_pct: p.deposit_pct || null, deposit_amount: p.deposit_amount || null, options: (() => { try { return JSON.parse(p.options || "null"); } catch { return null; } })(), selected_option: p.selected_option || null },
    items: JSON.parse(p.line_items || "[]"),
    lead: { service_requested: lead?.service_requested, location: lead?.location, notes: lead?.notes },
    contact: { name: contact?.name, email: contact?.email, phone: contact?.phone },
    workspace_name: ws?.name,
    template: {
      name: docName,
      logo: tpl.logo || null,
      company: tpl.company, tagline: tpl.tagline, contact_line: tpl.contact_line, address: tpl.address, footer: mergeFields(tpl.footer, ctx),
      intro_html: sanitizeHtml(mergeFields(tpl.intro_html, ctx)),
      terms_html: sanitizeHtml(mergeFields(tpl.terms_html, ctx)),
    },
  };
}

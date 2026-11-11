// Workpile — editable DOCX proposal export (§25: Gregory rule — proposals must
// be editable in Word). Renders from the workspace proposal template.
// V32 design: a professional service-industry proposal — letterhead band,
// proposal meta table, shaded investment table with a total band, terms,
// and an acceptance block with the v31 signature layout.
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, Footer, AlignmentType, BorderStyle, ShadingType, ImageRun, PageNumber } from "docx";
import { proposalDocument, htmlToParagraphs } from "./proptemplate.ts";

const PINE = "0E5C3A", INK = "101613", GRAY = "5B6B62", LINE = "D9DEDB", BAND = "EDF2EE";
const money = (n: any) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thin = (color = LINE) => ({ style: BorderStyle.SINGLE, size: 4, color });
const cellBorders = (color = LINE) => ({ top: thin(color), left: thin(color), right: thin(color), bottom: thin(color) });
const noBorders = () => { const n = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }; return { top: n, left: n, right: n, bottom: n }; };
const shade = (fill: string) => ({ type: ShadingType.CLEAR, color: "auto", fill });
const P = (text: string, o: any = {}) => new Paragraph({ keepNext: !!o.keepNext, spacing: { after: o.after ?? 90, before: o.before ?? 0 }, alignment: o.align, children: [new TextRun({ text, bold: o.bold, italics: o.it, size: o.size ?? 21, color: o.color ?? INK, font: "Calibri" })] });
const H = (text: string) => new Paragraph({ keepNext: true, spacing: { before: 300, after: 130 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: PINE } }, children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 23, color: PINE, font: "Calibri" })] });

export async function proposalDocx(proposalId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const d = proposalDocument(proposalId);
  if (!d) return null;
  const t = d.template;
  const items = d.items as any[];
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * (i.qty || 1), 0);
  const validUntil = d.proposal.expires_at ? new Date(d.proposal.expires_at).toLocaleDateString() : null;

  // --- Letterhead: logo (when usable) or the company name, contact right ---
  let logoPara: Paragraph | null = null;
  if (t.logo && /^data:image\/(png|jpeg|jpg);base64,/.test(t.logo)) {
    try { const type = t.logo.includes("image/png") ? "png" : "jpg"; const buf = Buffer.from(t.logo.split(",")[1], "base64"); logoPara = new Paragraph({ children: [new ImageRun({ type, data: buf, transformation: { width: 150, height: 56 } })] }); } catch { logoPara = null; }
  }
  const letterhead = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [55, 45], rows: [new TableRow({ children: [
    new TableCell({ borders: noBorders(), width: { size: 55, type: WidthType.PERCENTAGE }, children: [logoPara || P(t.company, { bold: true, size: 34, color: PINE, after: 0 }), ...(t.tagline ? [P(t.tagline, { size: 18, color: GRAY, after: 0 })] : [])] }),
    new TableCell({ borders: noBorders(), width: { size: 45, type: WidthType.PERCENTAGE }, children: [
      ...(t.contact_line ? [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 20 }, children: [new TextRun({ text: t.contact_line, size: 18, color: GRAY, font: "Calibri" })] })] : []),
      ...(t.address ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: t.address, size: 18, color: GRAY, font: "Calibri" })] })] : []),
    ] }),
  ] })] });
  const rule = new Paragraph({ spacing: { before: 110, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: PINE } }, children: [] });

  // --- Meta table: prepared for / project / proposal details ---
  const labelCell = (txt: string, w: number) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: shade(BAND), borders: cellBorders(), children: [P(txt, { bold: true, size: 16, color: PINE, after: 0 })] });
  const infoCell = (lines: [string, boolean?][], w: number) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders: cellBorders(), children: lines.map(([txt, b]) => P(txt, { bold: !!b, size: 19, after: 26 })) });
  const meta = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [36, 30, 34], rows: [
    new TableRow({ children: [labelCell("PREPARED FOR", 36), labelCell("PROJECT", 30), labelCell("PROPOSAL DETAILS", 34)] }),
    new TableRow({ children: [
      infoCell([[d.contact.name || "—", true], ...(d.contact.email ? [[d.contact.email] as [string]] : []), ...(d.contact.phone ? [[d.contact.phone] as [string]] : [])], 36),
      infoCell([[String(d.lead.service_requested || "Services"), true], ...(d.lead.location ? [[d.lead.location] as [string]] : [])], 30),
      infoCell([["Proposal " + d.ref, true], ["Date: " + new Date(d.proposal.created_at).toLocaleDateString()] as [string], ...(validUntil ? [["Valid until: " + validUntil] as [string]] : []), ["Version " + d.proposal.version] as [string]], 34),
    ] }),
  ] });

  // --- Investment table ---
  const head = (txt: string, w: number, right = false) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: shade(PINE), borders: cellBorders(PINE), children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : undefined, children: [new TextRun({ text: txt, bold: true, size: 19, color: "FFFFFF", font: "Calibri" })] })] });
  const td = (txt: string, w: number, o: any = {}) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: o.fill ? shade(o.fill) : undefined, borders: cellBorders(), children: [new Paragraph({ alignment: o.right ? AlignmentType.RIGHT : o.center ? AlignmentType.CENTER : undefined, children: [new TextRun({ text: txt, bold: o.bold, size: 20, color: o.color ?? INK, font: "Calibri" })] })] });
  const investRows = [
    new TableRow({ children: [head("Description", 52), head("Qty", 10, true), head("Unit Price", 18, true), head("Amount", 20, true)] }),
    ...items.map(i => new TableRow({ children: [td(String(i.name || "Item"), 52), td(String(i.qty || 1), 10, { center: true }), td(money(i.unit_price), 18, { right: true }), td(money(Number(i.unit_price || 0) * (i.qty || 1)), 20, { right: true })] })),
    new TableRow({ children: [td("", 52), td("", 10), td("Subtotal", 18, { right: true, bold: true }), td(money(subtotal), 20, { right: true, bold: true })] }),
    new TableRow({ children: [
      new TableCell({ columnSpan: 3, width: { size: 80, type: WidthType.PERCENTAGE }, shading: shade(PINE), borders: cellBorders(PINE), children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "TOTAL INVESTMENT", bold: true, size: 21, color: "FFFFFF", font: "Calibri" })] })] }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, shading: shade(PINE), borders: cellBorders(PINE), children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: money(d.proposal.total), bold: true, size: 21, color: "FFFFFF", font: "Calibri" })] })] }),
    ] }),
  ];
  const opts = Array.isArray(d.proposal.options) && d.proposal.options.length ? d.proposal.options : null;
  const optionsTable = opts ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [70, 30], rows: [
    new TableRow({ children: [head("Option", 70), head("Total", 30, true)] }),
    ...opts.map((o: any) => new TableRow({ children: [td(String(o.name) + (d.proposal.selected_option === o.name ? "  ✓ Selected" : ""), 70, { bold: d.proposal.selected_option === o.name }), td(money(o.total), 30, { right: true })] })),
  ] }) : null;
  const deposit = d.proposal.deposit_amount ? `Deposit due on signing: ${money(d.proposal.deposit_amount)}${d.proposal.deposit_pct ? ` (${d.proposal.deposit_pct}% of the total)` : ""}. The balance is due as set out in the terms below.` : (d.proposal.deposit_pct ? `Deposit due on signing: ${d.proposal.deposit_pct}% of the total. The balance is due as set out in the terms below.` : null);

  // --- Acceptance (v31 signature layout, kept) ---
  const lineCell = (w: number, span = 0, last = false) => new TableCell({ ...(span ? { columnSpan: span } : {}), width: { size: w, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 6, color: "333333" } }, children: [new Paragraph({ keepNext: !last, children: [] })] });
  const labCell = (txt: string, w: number, span = 0, last = false) => new TableCell({ ...(span ? { columnSpan: span } : {}), width: { size: w, type: WidthType.PERCENTAGE }, borders: noBorders(), children: [P(txt, { size: 16, color: GRAY, after: 0, keepNext: !last })] });
  const sigTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [55, 45], rows: [
    new TableRow({ cantSplit: true, children: [lineCell(100, 2)] }),
    new TableRow({ cantSplit: true, children: [labCell("Signature", 100, 2)] }),
    new TableRow({ cantSplit: true, children: [lineCell(55), lineCell(45)] }),
    new TableRow({ cantSplit: true, children: [labCell("Name (print)", 55, 0, true), labCell("Date", 45, 0, true)] }),
  ] });

  const footer = new Footer({ children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: t.footer, size: 16, color: GRAY, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.company} · Proposal ${d.ref} · Page `, size: 16, color: GRAY, font: "Calibri" }), new TextRun({ size: 16, color: GRAY, font: "Calibri", children: [PageNumber.CURRENT] })] }),
  ] });

  const doc = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK }, paragraph: { spacing: { after: 90 } } } } }, sections: [{ footers: { default: footer }, children: [
    letterhead, rule,
    P("PROPOSAL", { bold: true, size: 40, color: INK, after: 10 }),
    P(String(d.lead.service_requested || "Services"), { bold: true, size: 25, color: PINE, after: 190 }),
    meta,
    H("Introduction"),
    ...htmlToParagraphs(t.intro_html).map(x => new Paragraph(x)),
    H("Scope of Work"),
    ...(d.lead.notes ? [P(String(d.lead.notes))] : items.map(i => P("•  " + String(i.name || "Item"), { after: 40 }))),
    H("Investment"),
    new Table({ rows: investRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    ...(optionsTable ? [P("Options offered — the total above reflects the selected option.", { size: 18, color: GRAY, before: 140, after: 60 }), optionsTable] : []),
    ...(deposit ? [P(deposit, { before: 140 })] : []),
    H("Terms & Conditions"),
    ...htmlToParagraphs(t.terms_html).map(x => new Paragraph(x)),
    H("Acceptance"),
    P(`By signing below, the customer authorizes ${t.company} to proceed with the work described in this proposal for ${money(d.proposal.total)}${validUntil ? `, which is valid until ${validUntil}` : ""}.`, { keepNext: true }),
    new Paragraph({ keepNext: true, spacing: { before: 260 }, children: [] }),
    sigTable,
  ] }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename: `proposal-${String(d.lead.service_requested).replace(/\W+/g, "-").toLowerCase()}-v${d.proposal.version}.docx` };
}

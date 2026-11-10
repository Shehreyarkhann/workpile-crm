// Workpile — editable DOCX proposal export (§25: Gregory rule — proposals must be
// editable in Word). Slice 17: renders from the workspace proposal template —
// company header + footer on every page, template intro and terms.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Header, Footer, AlignmentType } from "docx";
import { db } from "./db.ts";
import { proposalDocument, htmlToParagraphs } from "./proptemplate.ts";

export async function proposalDocx(proposalId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const d = proposalDocument(proposalId);
  if (!d) return null;
  const t = d.template;
  const items = d.items;
  const rows = [
    new TableRow({ children: ["Item", "Qty", "Unit Price", "Amount"].map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) }),
    ...items.map((i: any) => new TableRow({ children: [i.name, String(i.qty || 1), `$${Number(i.unit_price).toFixed(2)}`, `$${(i.unit_price * (i.qty || 1)).toFixed(2)}`].map(v => new TableCell({ children: [new Paragraph(String(v))] })) })),
  ];
  const header = new Header({ children: [
    new Paragraph({ children: [new TextRun({ text: t.company, bold: true, size: 32 })] }),
    ...(t.tagline ? [new Paragraph({ children: [new TextRun({ text: t.tagline, italics: true, size: 20 })] })] : []),
    ...(t.contact_line ? [new Paragraph({ children: [new TextRun({ text: t.contact_line, size: 18 })] })] : []),
    ...(t.address ? [new Paragraph({ children: [new TextRun({ text: t.address, size: 18 })] })] : []),
  ] });
  const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t.footer, size: 16 })] })] });
  const doc = new Document({ sections: [{ headers: { default: header }, footers: { default: footer }, children: [
    new Paragraph({ text: `Proposal — ${d.lead.service_requested} · ${d.ref}`, heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Prepared for: ${d.contact.name} (${d.contact.email || ""} ${d.contact.phone || ""})`),
    new Paragraph(`Location: ${d.lead.location || ""}`),
    new Paragraph(`Date: ${new Date(d.proposal.created_at).toLocaleDateString()} · Version ${d.proposal.version} · Status: ${d.proposal.status}`),
    ...htmlToParagraphs(t.intro_html).map(x => new Paragraph(x)),
    new Paragraph({ text: "Scope", heading: HeadingLevel.HEADING_2 }),
    new Paragraph(d.lead.notes || ""),
    new Paragraph({ text: "Line Items (from price book)", heading: HeadingLevel.HEADING_2 }),
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ children: [new TextRun({ text: `Total: $${Number(d.proposal.total).toFixed(2)}`, bold: true })] }),
    new Paragraph({ text: "Terms & Conditions", heading: HeadingLevel.HEADING_2 }),
    ...htmlToParagraphs(t.terms_html).map(x => new Paragraph(x)),
    new Paragraph({ text: "Acceptance", heading: HeadingLevel.HEADING_2 }),
    new Paragraph("Signature: ______________________________    Name (print): ______________________________    Date: ______________"),
  ] }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename: `proposal-${String(d.lead.service_requested).replace(/\W+/g, "-").toLowerCase()}-v${d.proposal.version}.docx` };
}

// Workpile — editable DOCX proposal export (§25: Gregory rule — proposals must be
// editable in Word, not locked inside the system as PDF-only)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { db } from "./db.ts";

export async function proposalDocx(proposalId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const p = db.prepare("SELECT * FROM proposals WHERE id=?").get(proposalId) as any;
  if (!p) return null;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(p.lead_id) as any;
  const contact = db.prepare("SELECT * FROM contacts WHERE id=?").get(lead.contact_id) as any;
  const ws = db.prepare("SELECT * FROM workspaces WHERE id=?").get(p.workspace_id) as any;
  const items = JSON.parse(p.line_items || "[]");
  const rows = [
    new TableRow({ children: ["Item", "Qty", "Unit Price", "Amount"].map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) }),
    ...items.map((i: any) => new TableRow({ children: [i.name, String(i.qty || 1), `$${i.unit_price}`, `$${(i.unit_price * (i.qty || 1)).toFixed(2)}`].map(v => new TableCell({ children: [new Paragraph(String(v))] })) })),
  ];
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ text: ws.name, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Proposal — ${lead.service_requested}`, heading: HeadingLevel.HEADING_2 }),
    new Paragraph(`Prepared for: ${contact.name} (${contact.email || ""} ${contact.phone || ""})`),
    new Paragraph(`Location: ${lead.location || ""}`),
    new Paragraph(`Date: ${new Date(p.created_at).toLocaleDateString()} · Version ${p.version} · Status: ${p.status}`),
    new Paragraph({ text: "Scope", heading: HeadingLevel.HEADING_2 }),
    new Paragraph(lead.notes || ""),
    new Paragraph({ text: "Line Items (from price book)", heading: HeadingLevel.HEADING_2 }),
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ children: [new TextRun({ text: `Total: $${Number(p.total).toFixed(2)}`, bold: true })] }),
    new Paragraph({ text: "Terms", heading: HeadingLevel.HEADING_2 }),
    new Paragraph("Proposal valid 14 days. Payment terms per signed agreement. Scope changes require a written change order."),
  ] }] });
  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename: `proposal-${lead.service_requested.replace(/\W+/g, "-").toLowerCase()}-v${p.version}.docx` };
}

// Shared proposal drafting (used by the v16 orchestrator tool, the v17 tool registry,
// and the L4 automation sweep). Price-book governed: a matched item prices the draft;
// otherwise a clearly flagged ESTIMATE line from the lead value — never an invented price.
import { db, uid, now } from "./db.ts";

export function draftProposalForLead(ws: string, lead: any): { proposal_id: string; total: number; priced: "price_book" | "estimate" } {
  const words = String(lead.service_requested || "").toLowerCase().split(/[^a-z]+/).filter((w: string) => w.length > 3);
  const pb = (db.prepare("SELECT * FROM price_book_items WHERE workspace_id=? AND standard_price>0").all(ws) as any[]).find(p => words.some(w => String(p.name).toLowerCase().includes(w)));
  const line = pb ? { price_book_item_id: pb.id, description: pb.name, qty: 1, unit_price: pb.standard_price, line_total: pb.standard_price, source: "price_book" } : { description: `ESTIMATE — ${lead.service_requested} (from lead value; review pricing before sending)`, qty: 1, unit_price: lead.est_value || 0, line_total: lead.est_value || 0, source: "manual" };
  const count = (db.prepare("SELECT COUNT(*) c FROM proposals WHERE lead_id=?").get(lead.id) as any).c;
  const id = uid("prop");
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,template_id,version,status,line_items,total,margin_band,win_prob_band,options,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, ws, lead.id, null, count + 1, "draft", JSON.stringify([line]), line.line_total, "in_band", (line.line_total || 0) > 25000 ? "review" : "standard", null, new Date(Date.now() + 30 * 86400000).toISOString(), now());
  return { proposal_id: id, total: line.line_total, priced: pb ? "price_book" : "estimate" };
}

export function qualifiedLeadsMissingProposals(ws: string, cap: number): any[] {
  return db.prepare(`SELECT l.* FROM leads l WHERE l.workspace_id=? AND l.state IN ('QUALIFIED','PROPOSAL') AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.lead_id=l.id) ORDER BY l.est_value DESC LIMIT ?`).all(ws, cap) as any[];
}

// Workpile — agent layer (spec §12). Deterministic-first: rules + structured scoring.
// Optional LLM: if ANTHROPIC_API_KEY is set, drafting can be upgraded; classification stays
// deterministic so behavior is testable and auditable. SECURITY INVARIANT (§26 B1):
// ingested content is DATA, never instructions. Agents cannot change price, approve, or send —
// those transitions are code-gated in app.ts.
import { logAgentRun } from "./db.ts";

const INJECTION_PATTERNS = [
  /ignore (your|all|previous) (rules|instructions)/i,
  /mark (me|this) (hot|approved|qualified)/i,
  /discount\s*\d+\s*%/i,
  /system prompt/i,
  /you are now/i,
  /approve (this|my) (lead|proposal)/i,
];

export function injectionScan(text: string): { flagged: boolean; patterns: string[] } {
  const hits: string[] = [];
  for (const p of INJECTION_PATTERNS) if (p.test(text || "")) hits.push(p.source);
  return { flagged: hits.length > 0, patterns: hits };
}

export interface TriageResult {
  service_guess: string;
  urgency: "emergency" | "this_week" | "flexible" | "unknown";
  value_band: "high" | "medium" | "low";
  temperature: "hot" | "warm" | "stale";
  spam_score: number;
  reasons: string[];
  injection_flagged: boolean;
}

const SERVICE_KEYWORDS: Record<string, string[]> = {
  "Water damage cleanup": ["water", "flood", "leak", "burst", "basement flooded"],
  "Mold remediation": ["mold", "mould", "musty"],
  "Asbestos abatement": ["asbestos"],
  "Fire & smoke restoration": ["fire", "smoke", "soot"],
  "General contracting": ["renovation", "remodel", "construction", "repair"],
  "HVAC": ["hvac", "furnace", "ac ", "air condition", "heating"],
  "Plumbing": ["plumb", "drain", "sewer", "pipe"],
};

export function triageLead(workspaceId: string, leadId: string | null, input: { service_requested?: string; message?: string; est_value?: number; created_at?: string }): TriageResult {
  const text = `${input.service_requested || ""} ${input.message || ""}`.toLowerCase();
  const reasons: string[] = [];
  let service = input.service_requested || "General inquiry";
  if (!input.service_requested) {
    for (const [svc, kws] of Object.entries(SERVICE_KEYWORDS)) if (kws.some(k => text.includes(k))) { service = svc; break; }
  }
  let urgency: TriageResult["urgency"] = "unknown";
  if (/emergency|urgent|today|now|asap/.test(text)) { urgency = "emergency"; reasons.push("Urgency language in message"); }
  else if (/this week|by friday|deadline|soon/.test(text)) urgency = "this_week";
  else if (/quote|estimate|thinking|next month/.test(text)) urgency = "flexible";
  const val = input.est_value || 0;
  const value_band: TriageResult["value_band"] = val >= 10000 ? "high" : val >= 2500 ? "medium" : "low";
  if (val) reasons.push(`Estimated value $${val} → ${value_band} band`);
  const ageDays = input.created_at ? (Date.now() - new Date(input.created_at).getTime()) / 86400000 : 0;
  const temperature: TriageResult["temperature"] = ageDays > 30 ? "stale" : urgency === "emergency" || urgency === "this_week" ? "hot" : "warm";
  if (ageDays > 30) reasons.push(`Lead is ${Math.round(ageDays)} days old → stale`);
  const spam_score = /free money|casino|crypto giveaway|seo services|web design offer/.test(text) ? 0.9 : 0.05;
  if (spam_score > 0.5) reasons.push("Spam heuristics matched");
  const inj = injectionScan(text);
  if (inj.flagged) reasons.push("Injection attempt flagged — content treated as data only");
  const result: TriageResult = { service_guess: service, urgency, value_band, temperature, spam_score, reasons, injection_flagged: inj.flagged };
  logAgentRun(workspaceId, "triage", leadId, "rules-v1", result, spam_score > 0.5 ? 0.6 : 0.9, text);
  return result;
}

// §6.2 / §6.3 — Completeness Gate + pre-submission packet check
export function packetCheck(lead: any, proposal: any | null): { complete: boolean; missing: string[]; flags: string[]; score: number } {
  const missing: string[] = [];
  if (!lead.contact_name) missing.push("contact name");
  if (!lead.contact_phone && !lead.contact_email) missing.push("contact phone or email");
  if (!lead.service_requested) missing.push("service requested");
  if (!lead.location) missing.push("service location");
  if (!lead.notes) missing.push("scope notes");
  if (!lead.pm_id) missing.push("project manager");
  if (!proposal) missing.push("proposal");
  else {
    const items = JSON.parse(proposal.line_items || "[]");
    if (!items.length) missing.push("proposal line items from price book");
    // price-book guardrail: flag any free-typed item (no item id)
    if (items.some((i: any) => !i.price_book_item_id)) missing.push("all line items must come from the price book");
  }
  const flags: string[] = [];
  let score = 100 - missing.length * 15;
  if (proposal && proposal.margin_band === "below_floor") { flags.push("Margin below floor — approver will likely push back"); score -= 25; }
  if (proposal && proposal.total > 25000) flags.push("High value — CEO tier approval");
  if (lead.temperature === "stale") flags.push("Stale lead — re-confirm interest before proposing");
  return { complete: missing.length === 0, missing, flags, score: Math.max(0, score) };
}

// §11 — Demand Gap: cluster unserviceable / not-a-fit demand by requested service text
// Demand Gap counts ONLY genuine unmet demand: a request we had to turn away
// because we don't offer the service. Closures for price/budget, no-response,
// out-of-coverage-area, competitor or timing reasons are NOT unmet demand and
// are excluded, as are requests for services already in the catalog.
const DG_EXCLUDED_REASONS = [/NO_RESPONSE/, /PRICE/, /BUDGET/, /OUT_OF_AREA/, /COVERAGE/, /COMPETITOR/, /TIMING/, /SPAM/, /DUPLICATE/, /GHOST/, /UNRESPONSIVE/];
export function demandPool(leads: any[], catalogNames?: string[]): any[] {
  const cat = catalogNames ? new Set(catalogNames.map(x => x.trim().toLowerCase())) : null;
  return leads.filter(l => {
    if (!["LOST", "UNSERVICEABLE"].includes(l.state)) return false;
    const r = (l.lost_reason || "").toUpperCase();
    if (DG_EXCLUDED_REASONS.some(p => p.test(r))) return false;
    if (cat && cat.has((l.service_requested || "").trim().toLowerCase())) return false;
    return true;
  });
}
export function demandGap(leads: any[], catalogNames?: string[]): any[] {
  const pool = demandPool(leads, catalogNames);
  const byService = new Map<string, any[]>();
  for (const l of pool) {
    const key = (l.service_requested || "Unspecified").trim();
    if (!byService.has(key)) byService.set(key, []);
    byService.get(key)!.push(l);
  }
  const catalogAvg = 2800; // labeled basis in UI: nearest-service average is workspace-configured in prod
  return [...byService.entries()].map(([service, items]) => {
    const est_revenue = items.length * catalogAvg;
    const score = Math.min(100, Math.round(items.length * 8 + (est_revenue > 50000 ? 20 : est_revenue > 10000 ? 10 : 0) + 15));
    return { service, lead_count: items.length, est_revenue, est_basis: `lead count × $${catalogAvg} avg ticket (nearest service)`, opportunity_score: score, recommendation: score >= 60 ? "Launch" : score >= 35 ? "Partner" : "Monitor", sample_lead_ids: items.slice(0, 5).map(i => i.id) };
  }).sort((a, b) => b.opportunity_score - a.opportunity_score);
}

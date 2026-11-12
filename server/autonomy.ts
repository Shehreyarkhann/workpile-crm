// Workpile Agent — earned autonomy (v51, Phase 3).
// The autonomy ladder stops being set purely by hand: each tool earns (or
// loses) trust from the measured record of human decisions — the same
// decision statistics the operator brief reports. A draft/execute tool with
// ≥25 decided steps at ≥95% approval requires one level LESS than its base;
// a tool rejected often (≥10 decided, <70% approval) requires one level MORE.
// Two invariants never bend: approval-class tools (customer-facing sends,
// payments) ALWAYS require a human, at every level, earned or not; and read
// tools are always free. Every adjustment is stamped onto the step itself
// (step.policy) so the audit trail shows WHY a step ran automatically.
import { decisionStats } from "./agent-memory.ts";
import { TOOLS, type Control } from "./tools.ts";

export const BASE_REQUIRED: Record<Control, number> = { read: 0, draft: 2, execute: 3, approval: Number.POSITIVE_INFINITY };
const PROMOTE_MIN_DECIDED = 25, PROMOTE_RATE = 95;
const DEMOTE_MIN_DECIDED = 10, DEMOTE_RATE = 70;

const cache = new Map<string, { at: number; stats: Map<string, { decided: number; approved: number; rate: number }> }>();
function statsFor(ws: string) {
  const hit = cache.get(ws);
  if (hit && Date.now() - hit.at < 60000) return hit.stats;
  const m = new Map(decisionStats(ws, 40).map(s => [s.tool, s]));
  cache.set(ws, { at: Date.now(), stats: m });
  return m;
}
export function clearTrustCache(ws?: string) { if (ws) cache.delete(ws); else cache.clear(); }

export interface TrustLine { tool: string; control: Control; decided: number; approved: number; rate: number | null; base_required: number | null; required: number | null; adjustment: "earned" | "demoted" | null }
export function requiredLevel(ws: string, toolName: string): { required: number; base: number; adjustment: "earned" | "demoted" | null; stat?: { decided: number; approved: number; rate: number } } {
  const t = TOOLS[toolName]; const control: Control = t?.control || "read";
  const base = BASE_REQUIRED[control];
  if (control === "approval" || control === "read") return { required: base, base, adjustment: null };
  const stat = statsFor(ws).get(toolName);
  if (stat && stat.decided >= PROMOTE_MIN_DECIDED && stat.rate >= PROMOTE_RATE) return { required: Math.max(1, base - 1), base, adjustment: "earned", stat };
  if (stat && stat.decided >= DEMOTE_MIN_DECIDED && stat.rate < DEMOTE_RATE) return { required: Math.min(4, base + 1), base, adjustment: "demoted", stat };
  return { required: base, base, adjustment: null, stat };
}

export function trustReport(ws: string): TrustLine[] {
  const stats = statsFor(ws);
  return Object.values(TOOLS).map(t => {
    const r = requiredLevel(ws, t.name);
    const s = stats.get(t.name);
    return { tool: t.name, control: t.control, decided: s?.decided || 0, approved: s?.approved || 0, rate: s ? s.rate : null, base_required: Number.isFinite(r.base) ? r.base : null, required: Number.isFinite(r.required) ? r.required : null, adjustment: r.adjustment };
  }).sort((a, b) => b.decided - a.decided);
}

// Recompute a step's gating under the earned policy. Only pre-decision steps
// (pending/approved, nothing executed yet) are touched — a decision already
// made by a human is never rewritten.
export function applyEarnedPolicy(ws: string, steps: any[], level: number): void {
  for (const s of steps) {
    if (s.status !== "pending" && s.status !== "approved") continue;
    if (s.result) continue;
    const r = requiredLevel(ws, s.tool);
    const na = level < r.required;
    s.needs_approval = na;
    s.status = na ? "pending" : "approved";
    if (r.adjustment === "earned") s.policy = `earned autonomy: approved ${r.stat?.rate}% across ${r.stat?.decided} decisions — runs at L${r.required} (base L${r.base})`;
    else if (r.adjustment === "demoted") s.policy = `trust reduced: approved ${r.stat?.rate}% across ${r.stat?.decided} decisions — now requires L${r.required} (base L${r.base})`;
  }
}

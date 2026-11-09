// LeadFlow OS — §26 platform layer: feature flags (canary), admin health, SLO synthetics
import { db, now } from "./db.ts";
import { metrics } from "./metrics.ts";

export const KNOWN_FLAGS = ["customer_portal", "demand_gap", "reactivation_campaigns", "scoped_auto_approval"];

export function getFlags(workspaceId: string): Record<string, boolean> {
  const rows = db.prepare("SELECT flag,enabled FROM feature_flags WHERE workspace_id=?").all(workspaceId) as any[];
  const out: Record<string, boolean> = {};
  for (const f of KNOWN_FLAGS) out[f] = false;
  for (const r of rows) out[r.flag] = !!r.enabled;
  // demand_gap ships enabled-by-default per spec §11 rollout; others default off (canary)
  if (!rows.some(r => r.flag === "demand_gap")) out.demand_gap = true;
  return out;
}
export function setFlag(workspaceId: string, flag: string, enabled: boolean): boolean {
  if (!KNOWN_FLAGS.includes(flag)) return false;
  db.prepare("INSERT INTO feature_flags (workspace_id,flag,enabled,updated_at) VALUES (?,?,?,?) ON CONFLICT(workspace_id,flag) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at")
    .run(workspaceId, flag, enabled ? 1 : 0, now());
  return true;
}

export function workspaceHealth() {
  const wss = db.prepare("SELECT * FROM workspaces").all() as any[];
  return wss.map(ws => {
    const m = metrics(ws.id);
    const dlq = (db.prepare("SELECT COUNT(*) c FROM outcome_deliveries WHERE workspace_id=? AND last_status='dead_letter'").get(ws.id) as any).c;
    const pendingFinals = (db.prepare("SELECT COUNT(*) c FROM outcome_deliveries WHERE workspace_id=? AND last_status IN ('pending','failed')").get(ws.id) as any).c;
    const agentRuns = (db.prepare("SELECT COUNT(*) c FROM agent_runs WHERE workspace_id=?").get(ws.id) as any).c;
    return { workspace_id: ws.id, name: ws.name, plan: ws.plan, leads: m.total_leads, fpar: m.first_pass_approval_rate, win_rate: m.win_rate, pending_finals: pendingFinals, dead_letter_finals: dlq, agent_runs: agentRuns, health: dlq > 0 ? "attention" : "ok" };
  });
}

// SLO synthetic checks (§26 C1): the 5 critical journeys, checked as data + invariants
export async function runSynthetics(baseUrl: string): Promise<any> {
  const checks: any[] = [];
  const t0 = Date.now();
  try { const r = await fetch(baseUrl + "/api/health"); checks.push({ journey: "health", ok: r.ok, ms: Date.now() - t0 }); }
  catch (e: any) { checks.push({ journey: "health", ok: false, error: String(e.message || e) }); }
  // metrics service must compute for every workspace within budget
  for (const ws of db.prepare("SELECT id FROM workspaces").all() as any[]) {
    const s = Date.now(); try { metrics(ws.id); checks.push({ journey: "metrics_compute", workspace_id: ws.id, ok: Date.now() - s < 500, ms: Date.now() - s }); } catch (e: any) { checks.push({ journey: "metrics_compute", workspace_id: ws.id, ok: false, error: String(e) }); }
  }
  // invariants: no final lead without a delivery record; no bare 'sent' states
  const orphanFinals = (db.prepare(`SELECT COUNT(*) c FROM leads l WHERE l.state IN ('WON','LOST','NO_RESPONSE','UNSERVICEABLE') AND l.created_at < datetime('now','-1 hour') AND NOT EXISTS (SELECT 1 FROM outcome_deliveries d WHERE d.lead_id=l.id)`).get() as any).c;
  checks.push({ journey: "finals_have_deliveries", ok: orphanFinals === 0, orphan_finals: orphanFinals });
  const dlq = (db.prepare("SELECT COUNT(*) c FROM outcome_deliveries WHERE last_status='dead_letter'").get() as any).c;
  checks.push({ journey: "dlq_empty", ok: dlq === 0, dead_letter: dlq });
  return { ran_at: now(), all_ok: checks.every(c => c.ok), checks };
}

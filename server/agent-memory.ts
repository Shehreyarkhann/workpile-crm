// Workpile Agent — business memory (v50, Phase 2).
// Three layers, all computed from real data — nothing invented:
//  1. Taught facts: durable things the owner/operator records (remember_fact)
//     and every future run starts already knowing.
//  2. Decision statistics: how the humans actually decided past agent steps,
//     per tool — the operator calibrates its ambition to the measured record.
//  3. The operator brief: services, team, facts, stats and live counts,
//     assembled fresh for each run's seed context.
import { db, uid, now } from "./db.ts";

db.exec(`CREATE TABLE IF NOT EXISTS agent_memories (id TEXT PRIMARY KEY, workspace_id TEXT, content TEXT, source TEXT DEFAULT 'operator', created_by TEXT, created_at TEXT);`);

export function rememberFact(ws: string, content: string, source: string, by: string): { id: string; duplicate: boolean } {
  const clean = String(content || "").trim().slice(0, 300);
  if (!clean) throw new Error("fact is empty");
  const ex = db.prepare("SELECT id FROM agent_memories WHERE workspace_id=? AND content=?").get(ws, clean) as any;
  if (ex) return { id: ex.id, duplicate: true };
  const id = uid("mem");
  db.prepare("INSERT INTO agent_memories (id,workspace_id,content,source,created_by,created_at) VALUES (?,?,?,?,?,?)").run(id, ws, clean, source, by, now());
  return { id, duplicate: false };
}
export function listFacts(ws: string, limit = 12): any[] {
  return db.prepare("SELECT * FROM agent_memories WHERE workspace_id=? ORDER BY created_at DESC LIMIT ?").all(ws, limit) as any[];
}

export function decisionStats(ws: string): { tool: string; decided: number; approved: number; rate: number }[] {
  const rows = db.prepare("SELECT plan FROM agent_executions WHERE workspace_id=? AND created_at >= datetime('now','-60 days') ORDER BY created_at DESC LIMIT 200").all(ws) as any[];
  const byTool = new Map<string, { decided: number; approved: number }>();
  for (const r of rows) {
    let plan: any[] = []; try { plan = JSON.parse(r.plan || "[]"); } catch { continue; }
    for (const s of plan) {
      if (!s.needs_approval) continue;
      if (s.status !== "done" && s.status !== "rejected") continue;
      const e = byTool.get(s.tool) || { decided: 0, approved: 0 };
      e.decided++; if (s.status === "done") e.approved++;
      byTool.set(s.tool, e);
    }
  }
  return [...byTool.entries()].filter(([, v]) => v.decided >= 2).map(([tool, v]) => ({ tool, decided: v.decided, approved: v.approved, rate: Math.round((v.approved / v.decided) * 100) })).sort((a, b) => b.decided - a.decided).slice(0, 8);
}

export function operatorBrief(ws: string): string {
  const w = db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws) as any;
  const c = (sql: string, ...p: any[]) => (db.prepare(sql).get(ws, ...p) as any)?.c ?? 0;
  const services = (db.prepare("SELECT name FROM services WHERE workspace_id=? AND active=1 ORDER BY name LIMIT 15").all(ws) as any[]).map(s => s.name);
  const team = (db.prepare("SELECT name, role FROM users WHERE workspace_id=? AND active=1 ORDER BY name LIMIT 10").all(ws) as any[]).map(u => `${u.name} (${u.role})`);
  const facts = listFacts(ws);
  const stats = decisionStats(ws);
  const lines = [
    `Business: ${w?.name || "this business"}.`,
    services.length ? `Services offered: ${services.join(", ")}.` : "",
    team.length ? `Team: ${team.join(", ")}.` : "",
    `Right now: ${c("SELECT COUNT(*) c FROM leads WHERE workspace_id=? AND state NOT IN ('WON','LOST','NO_RESPONSE','JUNK','DUPLICATE','UNSERVICEABLE','CLOSED')")} open leads, ${c("SELECT COUNT(*) c FROM jobs WHERE workspace_id=? AND stage NOT IN ('CLOSED','CANCELLED')")} active jobs, ${c("SELECT COUNT(*) c FROM approvals WHERE workspace_id=? AND decision='pending'")} approvals pending.`,
    facts.length ? `Remembered facts about this business:\n${facts.map(f => `- ${f.content}`).join("\n")}` : "",
    stats.length ? `How the owner has decided your past steps (last 60 days): ${stats.map(s => `${s.tool} approved ${s.rate}% (${s.approved}/${s.decided})`).join("; ")}. Calibrate: lean into what gets approved; be more careful with what gets rejected.` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

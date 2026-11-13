// v76: the agent learns on its own — nobody has to feed it.
//  1) Post-run distillation: when a real-model run completes, one small
//     extra call reads the run (instruction, steps, result) and extracts up
//     to two DURABLE facts about this business, stored in agent_memories
//     (source "learned"). The operator brief injects facts into every new
//     run, so what it learns today shapes how it works tomorrow.
//  2) Daily patterns pass (deterministic, no model needed): top earner,
//     most-requested service, busiest lead weekday, human approval habits —
//     computed from the data itself, stored as source "patterns" facts.
// Both paths go through rememberFact: exact-dedupe + 300-char cap, and
// listFacts bounds what the brief carries.
import { db, now } from "./db.ts";
import { rememberFact, decisionStats } from "./agent-memory.ts";
import { getProvider } from "./llm.ts";

db.exec("CREATE TABLE IF NOT EXISTS learning_state (workspace_id TEXT PRIMARY KEY, last_patterns_at TEXT)");

export async function distillRun(ws: string, executionId: string): Promise<void> {
  try {
    const ex = db.prepare("SELECT * FROM agent_executions WHERE id=? AND workspace_id=?").get(executionId, ws) as any;
    if (!ex || ex.status !== "completed" || !ex.summary) return;
    if (String(ex.planner || "").startsWith("rules")) return; // no real model ran — nothing to distill with
    const provider = getProvider(ws); if (!provider) return;
    let steps: any[] = []; try { steps = JSON.parse(ex.plan || "[]"); } catch { /* noop */ }
    const stepText = steps.filter(s => s.status === "done").slice(0, 14).map(s => `- ${s.tool}: ${String(s.result || "").slice(0, 160)}`).join("\n");
    if (!stepText && String(ex.summary).length < 60) return; // nothing substantive happened
    const r = await provider.chat({
      system: "You maintain the long-term memory of a business's AI operator. You extract only durable, reusable facts — never one-off task details, never names of one-time contacts, never anything already obvious from the instruction itself.",
      messages: [{ role: "user", content: `A work run just finished.\nInstruction: ${String(ex.instruction).slice(0, 300)}\nResult summary: ${String(ex.summary).slice(0, 1200)}\nSteps taken:\n${stepText}\n\nExtract up to 2 durable facts about THIS BUSINESS that would help the operator do better work in the future (preferences discovered, recurring people/roles, pricing or process patterns, customer facts that will matter again). Reply with a JSON array of short strings only — [] if there is nothing durable.` }],
      maxTokens: 300,
    });
    const txt = String(r.text || "");
    const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
    if (Array.isArray(arr)) for (const f of arr.slice(0, 2)) {
      const fact = String(f || "").trim();
      if (fact.length >= 12) { try { rememberFact(ws, fact, "learned", "agent"); } catch { /* dupes/empty are fine */ } }
    }
  } catch { /* learning must never break a run */ }
}

const WK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function learnPatterns(ws: string): void {
  try {
    const st = db.prepare("SELECT last_patterns_at FROM learning_state WHERE workspace_id=?").get(ws) as any;
    if (st?.last_patterns_at && Date.now() - new Date(st.last_patterns_at).getTime() < 24 * 3600000) return;
    db.prepare("INSERT INTO learning_state (workspace_id,last_patterns_at) VALUES (?,?) ON CONFLICT(workspace_id) DO UPDATE SET last_patterns_at=excluded.last_patterns_at").run(ws, now());
    const facts: string[] = [];
    const top = db.prepare(`SELECT l.service_requested s, COUNT(*) n, COALESCE(SUM(j.value),0) v FROM jobs j JOIN leads l ON l.id=j.lead_id WHERE j.workspace_id=? AND j.stage NOT IN ('CANCELLED','CLOSED') AND j.created_at > datetime('now','-90 days') GROUP BY s ORDER BY v DESC LIMIT 1`).get(ws) as any;
    if (top?.s && top.v > 0) facts.push(`Top earner (last 90 days): ${top.s} — $${Math.round(top.v).toLocaleString()} across ${top.n} jobs.`);
    const req = db.prepare(`SELECT service_requested s, COUNT(*) n FROM leads WHERE workspace_id=? AND state NOT IN ('JUNK','DUPLICATE') AND created_at > datetime('now','-90 days') GROUP BY s ORDER BY n DESC LIMIT 1`).get(ws) as any;
    if (req?.s && req.n >= 3) facts.push(`Most requested service (last 90 days): ${req.s} — ${req.n} leads.`);
    const wk = db.prepare(`SELECT CAST(strftime('%w', created_at) AS INTEGER) d, COUNT(*) n FROM leads WHERE workspace_id=? AND created_at > datetime('now','-90 days') GROUP BY d ORDER BY n DESC LIMIT 1`).get(ws) as any;
    if (wk && wk.n >= 5) facts.push(`New leads most often arrive on ${WK[wk.d]}s (${wk.n} in the last 90 days).`);
    const stats = decisionStats(ws, 3).filter(s => s.decided >= 4);
    if (stats.length) { const s = stats[0]; facts.push(`Humans approved ${s.rate}% of the agent's ${s.tool} steps over the last 60 days (${s.approved}/${s.decided} decided).`); }
    for (const f of facts) { try { rememberFact(ws, f, "patterns", "agent"); } catch { /* noop */ } }
  } catch { /* best-effort */ }
}

export async function processLearning(): Promise<void> {
  try { for (const w of db.prepare("SELECT id FROM workspaces").all() as any[]) learnPatterns(w.id); } catch { /* noop */ }
}

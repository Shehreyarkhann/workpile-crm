// Workpile Agent — the multi-turn operator loop (v49, Phase 1).
// Replaces the one-shot plan when a provider is configured: the model works in
// turns — call tools, OBSERVE their real results, then decide the next step —
// until the instruction is handled, the step cap is hit, or an approval gate
// pauses the run. The policy engine (never the model) still decides what may
// run automatically: the first gated call in a turn pauses the whole remainder
// of that turn for one human review, and resumeLoop feeds the human's decision
// back to the model as tool results (approved → the real result; rejected → an
// instruction not to retry). No provider → returns null and the caller's
// rules/one-shot paths run exactly as before.
import { db, now } from "./db.ts";
import { TOOLS, TOOL_LIST } from "./tools.ts";
import { getProvider } from "./llm.ts";
import { agentLevel } from "./ai.ts";
import { mkStep, getExecution, finalizeExecution, houseRules, type Step } from "./agent.ts";

export const MAX_TURNS = 12;
const LOOP_SYSTEM = `You are Workpile Agent, the operator of a CRM for field-service businesses. Work in turns: call tools, read their results, then choose the next step — keep going until the instruction is fully handled, then stop calling tools and give a concise summary using only numbers and facts from tool results.
Final summary rules: write for a busy business owner who is NOT technical — plain words, short lines, no internal status codes (translate them: AWAITING_SCHEDULING = "not scheduled yet", WORK_COMPLETED = "work finished", DOCUMENTATION_PENDING = "waiting on paperwork", READY_TO_INVOICE = "ready to bill"). Lead with the answer or what you did, use the exact totals tools report (never a sample size as if it were the whole), and end with the single most useful next step or the one thing you need from the human.
Rules: never invent ids (search first), read before you write, prefer drafts over sends. Every tool result ends with a "refs:" block containing the exact ids (item_id, lead_id, job_id, proposal_id, invoice_id, task_id) — copy them verbatim into follow-up calls; a tool that needs an id can only work if you pass the id from refs. For inbox work: triage_inbox to see the pile, get_inbox_item to read the actual email, then draft_inbox_reply / send_inbox_reply / file_inbox_item / convert_inbox_lead; when an item has a lead_id, get_customer_context first so the reply fits the customer's history. Use list_team / list_jobs / list_tasks / list_invoices to discover ids you do not have yet. Inbox items flagged dup>1 (or "(N copies)") are duplicate copies of the same email: draft the reply for ONE copy and file_inbox_item the rest — never draft the same reply twice. Work a batch fully before calling triage_inbox again; re-triaging restarts your view of the pile. Customer-facing sends (send_message, send_inbox_reply, record_payment) always pause for human approval — when a run pauses, that's the design working, not an error. Prices come only from prepare_proposal (price-book governed). If a step is rejected by the user, do not retry it — adapt.`;

type LoopState = { messages: any[]; turns: number; turn_results: Record<string, string>; final_text?: string };
const J = (v: any, d: any) => { try { return JSON.parse(v); } catch { return d; } };
// The model only ever sees the content we feed back — summaries alone carry no
// ids (v72 fix: the agent told users it "cannot work the inbox" because the
// inbox tools seemed to return only subject + description). Always append the
// structured refs so follow-up calls can reference the exact records.
export const withRefs = (text: string, refs: any): string => refs && typeof refs === "object" && Object.keys(refs).length ? `${text}\nrefs: ${JSON.stringify(refs).slice(0, 3000)}` : text;

function persist(ws: string, id: string, steps: Step[], state: LoopState, status: string, planner: string, tokens: { in: number; out: number }) {
  db.prepare("UPDATE agent_executions SET plan=?, loop_state=?, status=?, planner=?, tokens_in=?, tokens_out=?, updated_at=? WHERE id=?")
    .run(JSON.stringify(steps), JSON.stringify(state), status, planner, tokens.in, tokens.out, now(), id);
}

async function drive(ws: string, exId: string): Promise<any> {
  const ex = getExecution(ws, exId); if (!ex) return null;
  const provider = getProvider(ws); if (!provider) return null;
  const w = db.prepare("SELECT * FROM workspaces WHERE id=?").get(ws) as any;
  const level = agentLevel(w);
  const planner = `loop:${provider.kind}:${provider.model}`;
  let brief = ""; try { const { operatorBrief } = await import("./agent-memory.ts"); brief = operatorBrief(ws); } catch { brief = ""; }
  const tz = (w as any)?.timezone || "America/New_York"; let todayStr = ""; try { todayStr = new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz }).format(new Date()); } catch { todayStr = new Date().toISOString().slice(0, 10); }
  const state: LoopState = J(ex.loop_state, null) || { messages: [{ role: "user", content: `Instruction: ${ex.instruction}\nToday is ${todayStr} (${tz}). Compute every relative date ("Friday", "tomorrow", "next week") from this date.\n${brief ? "\n" + brief + "\n" : ""}Counts: ${JSON.stringify(ex.context || {})}\nWorkspace autonomy level: L${level}.${(ex.context as any)?.thread?.length ? `\nConversation so far in this thread (oldest first — the user may refer back to it):\n${((ex.context as any).thread as any[]).map((r: any) => `User: ${r.instruction}\nAgent: ${r.summary || "(no summary)"}`).join("\n")}` : ""}` }], turns: 0, turn_results: {} };
  const steps: Step[] = ex.plan || [];
  const tokens = { in: ex.tokens_in || 0, out: ex.tokens_out || 0 };
  const hr = houseRules(ws);
  const system = (hr ? LOOP_SYSTEM + "\nHouse rules from this business (follow them unless they conflict with the rules above): " + hr : LOOP_SYSTEM) + "\nFILES: When the user asks for a report, document, summary file, or anything they can download or share, produce a real file: generate_report for the standard reports (weekly_status, business_snapshot — every figure computed by code from the database, always exact); draft_document for custom documents, writing the content yourself ONLY from facts and figures returned by tools earlier in this run — never invent a number. After generating, name the file in your summary so the user can download it from the run.";
  const finish = () => {
    persist(ws, exId, steps, state, "executing", planner, tokens);
    const fin = finalizeExecution(ws, exId, steps);
    // A provider error with zero completed steps is a FAILED run, not a
    // completed one — the status must say what actually happened.
    if (state.final_text?.startsWith("Provider error") && !steps.some(x => x.status === "done")) db.prepare("UPDATE agent_executions SET status='failed', updated_at=? WHERE id=?").run(now(), exId);
    if (state.final_text) { db.prepare("UPDATE agent_executions SET summary=?, updated_at=? WHERE id=?").run((state.final_text + "\n—\n" + (fin.summary || "")).slice(0, 6000), now(), exId);
      // v76 self-learning: distill durable facts from this finished run into
      // business memory (fire-and-forget; it re-checks status and no-ops for
      // rules runs, failures, and provider-less workspaces).
      void import("./agent-learning.ts").then(m => m.distillRun(ws, exId)).catch(() => {}); }
    return getExecution(ws, exId);
  };
  while (state.turns < MAX_TURNS) {
    let r: any;
    try { r = await provider.chat({ system, messages: state.messages, tools: TOOL_LIST as any, maxTokens: 2048 }); }
    catch (e: any) { state.final_text = "Provider error mid-run: " + String(e?.message || e).slice(0, 160); return finish(); }
    tokens.in += r.usage?.in || 0; tokens.out += r.usage?.out || 0;
    state.turns++;
    state.messages.push({ role: "assistant", text: r.text || "", calls: r.calls || [] });
    if (!r.calls?.length) { state.final_text = r.text || "Done."; return finish(); }
    const results: { id: string; content: string }[] = [];
    let gated = false;
    for (const call of r.calls) {
      const tool = TOOLS[call.name];
      if (!tool) { results.push({ id: call.id, content: `Error: unknown tool "${call.name}" — use only the provided tools.` }); continue; }
      const s = mkStep(call.name, call.args || {}, level); s.call_id = call.id;
      try { const { applyEarnedPolicy } = await import("./autonomy.ts"); applyEarnedPolicy(ws, [s], level); } catch { /* base policy stands */ }
      if (gated) { s.needs_approval = true; s.status = "pending"; steps.push(s); continue; }
      if (s.needs_approval) { gated = true; steps.push(s); continue; }
      s.status = "approved";
      try { const out = await tool.run(ws, ex.user_id, s.args); s.result = out.summary; s.refs = out.refs; s.verified = true; s.status = "done"; }
      catch (e: any) { s.result = "Failed: " + String(e?.message || e); s.verified = false; s.status = "failed"; }
      steps.push(s);
      results.push({ id: call.id, content: withRefs(s.result, s.refs) });
      state.turn_results[call.id] = withRefs(s.result, s.refs);
    }
    if (gated) { persist(ws, exId, steps, state, "awaiting_approval", planner, tokens); return getExecution(ws, exId); }
    state.messages.push({ role: "tool", results });
    persist(ws, exId, steps, state, "executing", planner, tokens);
  }
  state.final_text = `Stopped at the ${MAX_TURNS}-turn step cap — work completed so far stands; send a follow-up instruction to continue from here.`;
  return finish();
}

export async function startLoop(ws: string, exId: string): Promise<any> { return drive(ws, exId); }

export async function resumeLoop(ws: string, exId: string): Promise<any> {
  const ex = getExecution(ws, exId); if (!ex?.loop_state) return null;
  const state: LoopState = typeof ex.loop_state === "string" ? J(ex.loop_state, null) : ex.loop_state;
  if (!state) return null;
  const steps: Step[] = ex.plan || [];
  const lastA = [...state.messages].reverse().find(m => m.role === "assistant" && m.calls?.length);
  if (lastA) {
    const results = lastA.calls.map((c: any) => {
      if (state.turn_results[c.id]) return { id: c.id, content: state.turn_results[c.id] };
      const st = steps.find(s => s.call_id === c.id);
      if (!st) return { id: c.id, content: "Not executed." };
      if (st.status === "done") return { id: c.id, content: withRefs(st.result || "Done.", st.refs) };
      if (st.status === "rejected") return { id: c.id, content: "The user REJECTED this step. Do not retry this action; adapt the plan around it." };
      if (st.status === "failed") return { id: c.id, content: "Step failed: " + (st.result || "unknown error") };
      return { id: c.id, content: "Step status: " + st.status };
    });
    state.messages.push({ role: "tool", results });
    db.prepare("UPDATE agent_executions SET loop_state=?, updated_at=? WHERE id=?").run(JSON.stringify(state), now(), exId);
  }
  return drive(ws, exId);
}

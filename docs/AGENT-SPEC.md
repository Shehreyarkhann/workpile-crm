# Workpile Agent — Agentic AI Specification (v17, implemented)

## Principle
The model decides what should happen next; Workpile's code controls what is permitted to
happen. The LLM never gets database access and is never the security boundary. Deterministic
logic stays authoritative for arithmetic, pricing, authorization, state machines, and payments.

## Provider layer (server/llm.ts)
Provider-independent interface (`chat({system, messages, tools}) → {text, calls, usage, model}`).
Implementations: Anthropic (primary), OpenAI (same contract), rules (deterministic fallback,
always labeled). Credentials: per-workspace key (stored server-side, never returned by any API —
verified by test) or platform env (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`). Config + connection
test in Automations → AI provider. Workspace-level enablement = autonomy level + provider status.

## Executions (server/agent.ts, table agent_executions)
Lifecycle: queued → planning → awaiting_approval → executing → verifying → completed, with
terminal failed / cancelled / rejected. Each execution stores: instruction, parent (follow-ups),
business context snapshot, planner id (e.g. `anthropic:claude-sonnet-4-5` or `rules-v1`), the
plan (steps with tool, args, control class, approval flag, status, result, refs, verified flag),
token usage, and a final human-readable summary. Steps execute exactly once (status-guarded);
deciding a finished execution returns 409.

## Governed tools (server/tools.ts)
search_leads (read) · get_customer_context (read) · get_conversation_history (read) ·
qualify_lead (read) · get_revenue_report (read) · draft_message (draft) ·
prepare_proposal (draft, price-book governed) · assign_lead (execute) ·
create_followup_task (execute) · submit_for_approval (execute) · schedule_site_visit (execute) ·
create_job (execute, WON-only) · send_message (approval — always).
Every tool re-validates workspace scope and business rules at execution. send_message passes
through the central send boundary (suppression + SMS consent enforced in comms.queueMessage).

## Policy (control × autonomy)
read: auto at any level · draft: auto ≥ L2 · execute: auto ≥ L3 · approval: always per-step
human approval, at every level including L4. Anything not auto-approved waits in
awaiting_approval; the user approves/rejects individual steps in the Agent panel (persistent
✦ Agent entry in the top bar), or cancels the run. L4 additionally differs from L3 in the
automation sweep: proactive proposal drafting for qualified leads (and the first-touch
enrollment at lead creation from v11).

## Planning
With a provider: one structured planning call with the tool schemas + business context;
unknown tools are dropped; an unusable model response falls back to the rules planner and the
planner field says so. Without a provider: the rules planner maps intents (proposals, recovery,
triage, ops, brief, full sweep) to governed steps.

## Evaluation (tests/v17.test.ts + golden suite)
Adversarial coverage: prompt injection in lead content cannot introduce a send step or message
an attacker address; unapproved steps never execute; re-deciding a finished run is refused;
L3 vs L4 sweep behavior differs observably; secrets never appear in settings/provider responses.

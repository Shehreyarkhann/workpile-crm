# Response to the fourth external audit ("V19 review", shared 2026-11-10)

## Verdict up front
This audit's Section 1 — its description of what V16–V19 contain — is **fabricated**. It does not describe this repository:

| Audit claim | Reality (verifiable in this repo) |
|---|---|
| "Approval gates are durable in Postgres" (V16) | The runtime database is SQLite (`node:sqlite`); Postgres exists only as an exported schema pack for a future cutover. Approvals live in `agent_executions` / `approvals` in SQLite. |
| "Model invocation through the OpenRouter API" (V17) | `grep -ri openrouter` returns **zero hits**. The provider layer (`server/llm.ts`) speaks to Anthropic and OpenAI directly. |
| "V19 added offline behaviour, pending Jobs, notification bell, Push incl. VAPID" | V19 was the **scheduling workflow chain** (stage→schedule→crew→timesheets). The bell, PWA shell and push groundwork shipped in Slice 6–24 / v10 era. |
| "Rate-limit middleware on agent endpoints" (V16) | No such middleware exists. |
| "A permission prompt fetches the latest run's approval" (§2A) | Approvals are **per-execution**: every run has a unique id, steps are decided via `POST /api/agent/executions/:id/decide`, terminal executions refuse re-decision (409 `already_final`), and concurrent runs proceed independently. There is no shared "latest run" prompt. |
| §6 "SMB Pro tier at £99", "Flash Sale" | No relation to the product's set USD per-seat pricing. Ignored. |

Sections 3–18 are largely combinatorial boilerplate ("implement an X System for the agent / user / system / tool / …" repeated for ~40 nouns). They were read in full and mined; only specific, checkable claims were acted on.

## What WAS real, and what V20 did about it
1. **Decision attribution (§2A audit trail)** — REAL gap: executions recorded the creator but not who approved/rejected the steps. V20: `agent_executions.decided_by/decided_at` set on every decide; the panel shows "Run by X · decided by Y". (Test-proven.)
2. **System prompt invisible (§2B)** — REAL: the prompt was a code constant. V20: **Agent playbook** card (Automations) — the exact system prompt, the full locked tool list (13 tools with control classes), and per-workspace **house rules** that are appended to the prompt when a provider plans. The tool registry itself already existed (`server/tools.ts`, v17).
3. **Locked tool list in the prompt (§2B)** — ALREADY TRUE: the provider receives `TOOL_LIST` with every call; unknown tools in model output are dropped.
4. **Global search (§9A)** — MOSTLY DONE already (leads, jobs, customers, people, tasks, campaigns). V20 adds **invoices (by number)** and **proposals (by customer/service)** to `/api/search` + the palette.
5. **Online/offline status (§3B)** — REAL small gap: the offline POST queue existed (v13) with no visible status. V20: topbar pill — 🟢 Online / 🔴 Offline + queued-action count.
6. **§18 plan table** — RBAC enforcement: exists (permission matrix, v7). Native invoicing: shipped v17. Error boundaries: exist. Calendar/scheduling: shipped v18–v19. File uploads: shipped v10 (attachments + object storage). Search improvements: this release.

## Standing note
Two of the four external audits (V15's, and this one) contained material fabrications about the stack; the V15 follow-up audit was accurate and drove V17. Policy, unchanged: **every claim is verified against the code before anything is built on it**, and overstated items are named as such.

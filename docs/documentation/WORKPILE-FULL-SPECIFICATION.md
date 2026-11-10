# WORKPILE — Full Specification & Software Development Document

**Product:** Workpile (workpile.io) — the Backlog OS for owner-operated field-service businesses
**Live pilot:** workpile.claimpaid.io (G.C. Environmental design-partner workspace)
**Repository:** github.com/Shehreyarkhann/workpile-crm (`~/workspace/leadflow-os` in development)
**Document status:** Current as of **November 10, 2026** — reflects production code at commit `b513704` (v6)
**Codebase inventory (measured):** 27 server modules · 255 API routes · 61 database tables · ~4,000 lines of server TypeScript + ~1,950-line React client · 117 automated tests, all passing · CI green on GitHub Actions

---

## Table of contents

1. Product definition
2. Users, personas, and jobs-to-be-done
3. Business model and packaging
4. System architecture
5. Data model
6. Module catalog (functional specification)
7. Core workflows (step-by-step)
8. The AI system — deterministic intelligence, agentic automation, generative components
9. AI governance and safety invariants
10. Integrations and public API
11. Security, privacy, and compliance
12. UX system and design language
13. Metrics and analytics definitions
14. Engineering handbook — development, testing, CI/CD, deployment, operations
15. Current state, known gaps, and roadmap

---

## 1. Product definition

### 1.1 What Workpile is

Workpile is an AI-agentic **lead-backlog operating system** for owner-operated field-service and environmental-services SMBs (remediation, testing, drilling, contracting, home services). It is deliberately **not positioned as a CRM**. A CRM stores the backlog; Workpile's job is to *clear* it and then run the business so it never piles up again.

The product promise, in one line: **give us your messy backlog; in 7 days it is worked, priced, proposed, and followed up — and it stays that way.**

### 1.2 The problem

Design-partner research (G.C. Environmental, Bay Shore NY — environmental consulting & contracting since 1989, 55 services, institutional/government client skew) and the founder's own operating experience show the same failure pattern in $1–20M field-service businesses:

- Leads arrive from everywhere (web forms, email, phone, referrals, vendor portals) and land in inboxes, spreadsheets, and sticky notes.
- Nobody owns the list. Follow-up depends on memory. Proposals take days because pricing lives in the owner's head.
- Won work is tracked in a different place than the lead that produced it; paperwork (certificates, reports, timesheets) is chased by hand.
- The owner cannot answer "what is stuck, who owns it, and what happens next" without a meeting.

### 1.3 Product principles (binding design rules)

1. **No lead without an owner and a next follow-up date.** The system treats a lead missing either as a defect and surfaces it until fixed.
2. **North Star metric: Proposals Approved & Sent per workspace per week.** Every design decision is judged against moving this number.
3. **First-Pass Approval Rate (FPAR) target ≥ 90% within 60 days** — proposals drafted (by human or agent) should be approved without changes nine times out of ten.
4. **Approval-gated autonomy.** The agent prepares, drafts, scores, assigns, and organizes autonomously; anything customer-facing or price-bearing requires human approval or a pre-approved workspace template (see §9).
5. **Honest states.** The UI never says "sent" without a verified delivered/acknowledged state from the channel. Test-mode channels are labeled `test_mode`.
6. **Prices only ever come from the workspace price book.** Neither a human shortcut nor any AI component may invent a price.
7. **Ingested content is data, never instructions.** Email bodies, CSV cells, and web-form text are scanned for prompt-injection patterns and can never trigger actions (see §9.3).

### 1.4 Go-to-market wedge

The **Free Backlog Audit** is the funnel: a prospect uploads/exports their current backlog (CSV in any vendor shape), Workpile ingests, dedupes, scores, and returns a one-page audit (how many leads, how old, how much pipeline is rotting, what is unowned). The audit demonstrates the cleanup the paid product then performs continuously.

---

## 2. Users, personas, and jobs-to-be-done

| Persona | Who | Primary jobs in Workpile |
|---|---|---|
| **Owner / Approver** (e.g., Gregory) | Business owner; final say on price and send | Approve proposals, see the whole board in 60 seconds each morning, weekly status, billing |
| **Ops Admin / PM** (e.g., Shehreyar's role) | Runs the backlog day-to-day | Work Queue conveyor, assignments, follow-up cadences, jobs, documents, timesheets |
| **Lead Owner / Estimator** | Works assigned leads | My Day, lead records, proposals from the price book, messages |
| **Crew / Field workers** | Roster-only — **name-only records, never billable seats, no login required** | Appear on schedules; their time is logged for them via the global Log Time flow |
| **Customer (external)** | The lead's client | Public sign page (e-sign), customer portal (documents, proposal view), deposit payment link |
| **Platform admin** | Workpile operator | Ops Console: workspace health, agent runs, dead-letter outcomes, feature flags |

Roles in code: `OWNER`, `APPROVER`, `OPS_ADMIN`, `LEAD_OWNER`, plus per-member custom permission overrides (server-enforced: `can_approve`, `can_settings`, `can_billing`, `can_export`, `can_manage_team`, `leads_scope`).

---

## 3. Business model and packaging

Per-seat subscription, billed through Stripe. Trials run 30 days and start on the Crew plan.

| Plan | Seats (logins) | List | Billed annually | Annual total |
|---|---|---|---|---|
| Solo | 1 | $29.99/mo | **$19.99/mo** | $239.88/yr |
| Team | 2 | $69.99/mo | **$49.99/mo** | $599.88/yr |
| Crew | 3 | $109.99/mo | **$79.99/mo** | $959.88/yr |
| Enterprise | Custom | — | — | — |

Rules implemented in code:

- Seat limits count **login users only** (roster workers are free and unlimited) and are enforced server-side (`POST /api/users` → `422 seat_limit`).
- Legacy plan keys alias forward (`starter→solo`, `growth→team`, `pro→crew`).
- No plan + no trial = plans-only paywall (Billing/Compliance reachable; business APIs return `403 PLAN_REQUIRED`).
- One 30-day trial per user; canceling never truncates a running trial.
- Plan switching is prorated through Stripe; prices render cents-exact everywhere (landing, billing, code).

---

## 4. System architecture

### 4.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js 24 (native TypeScript type-stripping) | No transpile step for the server |
| API server | Express (TypeScript, ESM) | Single process; modular registration (`registerCrm`, `registerDocTemplates`, `registerHome`, …) |
| Database (dev/pilot) | SQLite via `node:sqlite` | File DB; idempotent startup migrations (additive `ALTER`s, guarded `CREATE TABLE IF NOT EXISTS`) |
| Database (production target) | PostgreSQL | Full Postgres schema + migration pack included in repo |
| Client | React + Vite, single-file app (`src/main.tsx`), custom CSS design system (`src/styles.css`) | PWA-capable; dark mode; ⌘K palette |
| Documents | `docx` library for proposal DOCX export; server-rendered HTML for print/PDF and the public sign page | |
| Push | Web Push (VAPID) | Notification deep-linking by entity |
| Background work | In-process worker (`server/worker.ts`) | Follow-up cadence processing, automation sweeps (~6h per workspace), webhook delivery with retries + DLQ |
| Hosting (pilot) | DigitalOcean droplet (shared with ClaimPaid), `/opt/workpile`, port 4173, SQLite at `/opt/workpile/data/leadflow.db` | Deploy = idempotent shell script pulled from GitHub `main` |

### 4.2 Server module map (27 modules)

| Module | Responsibility |
|---|---|
| `app.ts` | HTTP composition root: auth, leads CRUD + stage engine, proposals, approvals, settings, billing hooks, sign page, search — the bulk of the REST surface |
| `crm.ts` | v4/v5/v6 layer: accounts/contacts + conversion, feed (Chatter), custom fields, campaigns, duplicates/merge, assignment rules, notes/files aggregation, tasks/calendar, dashboard pins + report builder, doc templates, home aggregate |
| `ai.ts` | Scoring, cleanup preview/apply, insights v1+v2, next-best-action, reactivation, automation runner + run logging |
| `agents.ts` | Named agents: triage, packet check, demand gap; prompt-injection scanner |
| `db.ts` | Schema (62 tables), migrations, password hashing, id/time helpers |
| `metrics.ts` | The metrics engine behind dashboards/reports (FPAR, win rate, cycle times, leaderboard) |
| `comms.ts` | Outbound queue + delivery (Resend/Twilio adapters, honest test mode), notifications (with entity targets), TCPA consent gate |
| `followups.ts` | 12-touch business-day cadence engine, template rendering, enroll/stop logic |
| `inbox.ts` | Email/mbox/CSV backlog parsing, 7-category triage, suggested actions + draft replies |
| `proptemplate.ts` | Proposal document model: workspace header, doc templates resolution, HTML sanitizer, merge fields |
| `docx.ts` | Proposal → DOCX rendering |
| `sign.ts` | E-signature tokens, signing, evidence certificate data |
| `payments.ts` | Stripe deposit links + payment state on proposals |
| `billing.ts` | Workpile's own subscription billing (Stripe), plan state, AI usage metering |
| `timesheets.ts` / `labor.ts` / `fieldreports.ts` | Time entries → weekly timesheets, labor costing with rate snapshots, field reports |
| `statusreport.ts` | Weekly Status Report generation |
| `integrations.ts` | §14.5 Final Outcome Handoff (webhook endpoints, HMAC signing, delivery worker glue), vendor CSV importers |
| `oauth.ts` | Gmail / Microsoft mailbox connections (config-gated) |
| `push.ts` | Web Push delivery |
| `worker.ts` | Scheduled processing loops |
| `admin.ts` | Platform Ops Console data |
| `seed.ts`, `demo-*.ts` | Demo/scale seeders (2,613-lead scale proof) |

### 4.3 Request/data flow (overview)

```
Sources (API · CSV · vendor imports · website embed · email backlog · booking page)
        │  ingestion normalizes → dedupe_key (phone/email) → triage agent
        ▼
LEADS ──► scoring + assignment rules ──► WORK QUEUE / MY DAY (human conveyor)
        │  proposals from price book ──► approval policy gate ──► send (comms)
        ▼
SIGN (public e-sign + deposit) ──► JOB created ──► schedule · time · docs · invoices
        │  final outcome (Won/Lost/No Response/N-A/Junk/Duplicate)
        ▼
§14.5 HANDOFF ──► customer's own platform (pull API + HMAC webhooks, ack/status back)
Side systems: feed/notifications everywhere · agent runs audit-logged · reports/pins
```

### 4.4 Multi-tenancy

Every row carries `workspace_id`; every query is workspace-scoped; sessions bind a user to exactly one active workspace context (workspace switcher re-scopes all data). Cross-workspace access is impossible through the API (verified in tests).

---

## 5. Data model

62 tables. The core graph (simplified):

- **workspaces** — tenant root: plan/trial state, proposal header (`pt_*`), logo, automation toggles (`auto_score/assign/dedupe/reactivate`, `last_automation_at`), approval policy.
- **users** — logins (seat-counted), role, custom permissions JSON, active flag.
- **workers** — roster-only field crew (never seats).
- **contacts** (people) ↔ **accounts** (customers/companies) — the CRM layer; leads link to contacts; WON converts lead → account + contact (`memberships` links people to accounts).
- **leads** — the central record: `state` (pipeline stage), `source_id`, `owner_id`, `pm_id`, `est_value`, `ai_score`, `ai_flags`, `dedupe_key`, `merged_into_id`, `on_hold`, `custom` (JSON custom-field values), `campaign_id`, consent + outcome fields.
- **lead_events** — immutable activity/event log (drives timelines, the 30-day activity series, reports).
- **proposals** — versioned, `line_items` JSON priced from **price_book_items**, Good/Better/Best `options`, `template_id` (doc template), status, expiry, view tracking, `sign_token`, payment status.
- **approvals** — approval inbox records with decisions + tiers.
- **signatures** — e-sign evidence (signer, typed signature, consent, doc hash, timestamps).
- **jobs** — created on signing: stage stepper, value (proposal + change orders), invoice status; **job_schedule**, **job_crew**, **change_orders**, **time_entries**, **timesheets**, **labor_classes**, **field_reports**, **documents** (tracker + files), **portal_uploads**.
- **tasks**, **callbacks**, **site_visits**, **followup_enrollments** — everything the Planner/Calendar aggregates.
- **feed_posts**, **follows**, **notes**, **activities** — the collaboration layer (Chatter-style feed with @mentions → notifications).
- **notifications** — with `lead_id` (legacy) + `entity_type`/`entity_id` (v5: lead/job/account routing).
- **campaigns** + **campaign_members** — pipeline/won revenue per campaign (ROI from real values).
- **custom_fields** — per-workspace field definitions (text/number/date/picklist) for leads/jobs/accounts.
- **assignment_rules** — ordered criteria → owner or round-robin pool.
- **doc_templates** — proposal document templates (intro/terms/footer HTML, logo flag, default).
- **templates** — message templates (email/SMS/follow-up) by kind/service.
- **agent_runs** — every agent action, logged with agent name, output JSON, model tag (`rules-v2`), confidence, human decision.
- **outcome_deliveries**, **webhook_endpoints**, **webhook_deliveries** — §14.5 handoff + generic webhooks (HMAC, retries, DLQ).
- **inbox_items**, **inbox_comments**, **inbox_rules**, **canned_replies** — shared inbox triage.
- **imports**, **api_keys**, **oauth_connections**, **push_subscriptions**, **sessions**, **auth_tokens**, **subscriptions**, **payments**, **feature_flags**, **dashboard_pins**, **favorites**, **audit_log**, **sources**, **services**.

---

## 6. Module catalog (functional specification)

The sidebar (20 destinations after the v5 consolidation) and what each does:

| Module | Specification |
|---|---|
| **Work Queue** | The home screen. A worst-first conveyor of everything needing action (approvals, stale leads, due follow-ups, missing next steps) with J/K/Enter keyboard flow. Designed to be emptied daily. |
| **My Day** | The individual's day: their tasks, callbacks, visits, approvals — personal lens on the same data. |
| **Dashboard** | The command center (v6, §12.3): Morning Brief hero, count-up stat cards, Workpile Agent panel, activity graph, Recently Assigned, goal gauge, Upcoming rail, Quick Links; below: report pins, funnel, approvals waiting, by-service, leaderboard, recent activity. Every number is clickable into its records. |
| **Pulse** | Live activity stream across the workspace. |
| **Leads** | Table (paginated, saved views, inline stage/owner editing, bulk actions), Board (free drag between any stages — finals discipline enforced), **Duplicates mode** (finder + merge). Record page: stage stepper, readiness checklist, AI strip, proposals, messages, feed & notes, custom fields. |
| **Jobs** | Board + record per won job: packet, schedule, crew, time, change orders, documents chase, invoice status. |
| **Customers** | Accounts list + record (related lists: people, jobs, leads; lifetime value from real job values). **People tab**: every contact across accounts and leads. Conversion: one click ⇄, automatic on WON. |
| **Campaigns** | Members with statuses, cost, pipeline, won revenue, ROI — computed from real won values only. |
| **Planner** | **Tasks tab** (all tasks across records: mine/open/overdue/done, create on any record) + **Calendar tab** (month grid; click a day → full agenda of tasks/callbacks/crew/follow-ups/visits incl. completed, type filters, deliberate open actions). |
| **Library** | **Notes tab** + **Files & Documents tab** — every note and document across every record in one searchable list. |
| **Reports** | Report Builder (object × group-by × metric, reconciles with list totals), saved reports, CSV export, Weekly Status Report, dashboard pinning. |
| **Approvals** | The approval inbox: rich packets (lead context, packet-check score, price-book lines), approve/reject with comments; policy-configured routing (off / over-$25k / always). |
| **AI Assistant** | Insights feed with one-click actions, Auto-pilot toggles + run history, per-lead AI strip management, cleanup tools (score/assign/dedupe/spam) with preview-before-apply. |
| **Import CSV** | Guided importer: arbitrary CSV → field mapping → dedupe preview → import; vendor importers for common CRMs; email backlog import (mbox/CSV) into the Inbox. |
| **Demand Gap** | Clusters of genuine unmet demand (lost/unserviceable leads for services not offered) — tells the owner what to sell next; cluster click opens the underlying leads. |
| **Handoffs** | §14.5 outcome delivery monitor: queued/delivered/acknowledged states, dead-letter queue with replay. |
| **Ops Console** | Platform-admin view: workspace health, agent-run counts, DLQ attention flags. |
| **Settings** | Workspace, price book, **doc templates** (§7.4), message templates, services, team + permissions, roster workers, labor & rates, inbox rules, custom fields, assignment rules, integrations/API keys/webhooks. |
| **Billing** | Plan state, trial countdown, seat usage, Stripe checkout/portal, invoices. |
| **Customer portal** (external) | Tokenized per-customer view: proposal, documents in/out, status. |
| **Public pages** | Sign page (§7.3), booking page (public intake → lead), landing + pricing. |

Global systems: **⌘K palette** (commands + grouped record search), **app switcher** (Sales / Ops / Marketing / All presets filter the sidebar), **favorites** (starred leads pinned), **notifications bell** (entity-routed), **dark mode**, **PWA**, **Web Push**.

---

## 7. Core workflows (step-by-step)

### 7.1 Lead lifecycle — intake to outcome

1. **Intake.** A lead enters through the REST API, the guided CSV importer, a vendor importer, the booking page, the website embed form, an inbox item conversion, or manual entry. Fields normalize into the leads schema; the source is recorded.
2. **Dedupe.** A `dedupe_key` (normalized phone, else email) is computed. Exact-key collisions merge fields into the existing record instead of creating a duplicate (the restored record keeps its stage).
3. **Triage (agent).** The triage agent classifies the request against the workspace service catalog, flags scope/value signals from the message, and emits flags (`from_catalog`, `mentions_value`, …). The injection scanner runs over the message first (§9.3).
4. **Score + assign.** The scoring model (§8.1) sets `ai_score`/temperature/flags. Assignment rules evaluate in order — first match wins; round-robin picks the pool member with fewest open leads. Unassigned leads are surfaced until owned (principle #1).
5. **Work.** The lead lives on the board (New · Working · Qualified · Proposal · Sent · Follow-Up) with free movement in both directions — there is no artificial one-way pipeline. **ON_HOLD is a flag, not a stage.** A readiness checklist (contact complete, service set, value estimated, next step scheduled) replaces any hard gate: the record always shows what is missing but never traps the user.
6. **Finals discipline.** Moving to **Lost / No Response requires a reason**; moving to **Won requires a signed proposal or an explicit confirm**; reopening a final **supersedes** the recorded §14.5 outcome (the original is never deleted — it is marked superseded and a fresh delivery is queued).
7. **Outcome.** On a final state, the §14.5 handoff fires (§10.2) and follow-ups stop (Won/Lost) or convert to reactivation eligibility (No Response/Junk stay recoverable).

### 7.2 Proposal workflow

1. **Build.** From the lead record: line items are picked from the **price book only** (free-text lines carry no price authority), quantities and per-line notes; optional **Good / Better / Best** options; deposit requirement; a **document template** is chosen (workspace default preselected) and a **logo** is either taken from the workspace or omitted.
2. **Packet check (agent).** Before send, the packet agent scores completeness: customer name, service, at least one priced line, deposit configured when policy requires — gaps are listed, never silently waived.
3. **Approval gate.** Workspace policy decides: *off* (send directly), *over $25,000* (default), or *always*. Gated proposals enter the Approvals inbox as a rich packet; the approver sees lead context + packet score + lines and approves or rejects with a comment.
4. **Send.** The proposal renders from its chosen doc template (print HTML, DOCX export, and the customer sign page all use the same resolved document) and is delivered via the comms layer (email/SMS adapters, or labeled test mode). Status becomes Sent; **view tracking** records customer opens.
5. **Follow-up cadence auto-enrolls** (§7.5) the moment a proposal is sent.

### 7.3 Signing, deposit, and job creation

1. The customer opens the tokenized **sign page** — rendered with the proposal's own doc template and workspace logo, priced lines, tier options if present.
2. They type their name, accept the ESIGN consent, and sign. The system stores the **evidence set**: signer name/email, typed signature, consent text version, document hash, IP/user-agent, timestamps. Double-signing is rejected.
3. If a deposit is configured, a **Stripe payment link** is issued; payment state syncs back to the proposal (test mode until live keys).
4. On signing: the lead flips to **Won**, converts to **Customer + Person** automatically (idempotent), and a **Job** is created carrying value, packet, schedule shell, and document requirements.

### 7.4 Job execution workflow

Job record: stage stepper (Scheduled → In Progress → Field Work → Reporting → Invoiced → Closed) · **job packet** (scope, contacts, documents) · **schedule** (calendar events + crew) · **time** (§7.6) · **change orders** (priced from the book; approved change orders increase job value) · **document chase** (required-doc checklist with missing flags feeding the Work Queue) · **invoice status**.

### 7.5 Follow-up cadence workflow

- **Enrollment:** automatic on proposal send.
- **Cadence:** 12 touches across business days, mixing email/SMS templates with merge fields ({customer}, {company}, {service}); the first touch fires near-instantly; **callbacks** scheduled by a human override cadence steps.
- **Stops:** customer reply, signature (→ Won), Lost, or manual stop — every stop is reason-coded. **Rehash:** No-Response leads become eligible for reactivation campaigns; the agent's reactivation automation creates tasks rather than sending anything itself.

### 7.6 Time, labor, and field reporting

- **Log time** is one global action (the `⏱` button): pick worker (roster), job/lead, hours — available from any screen.
- **Timesheets** aggregate per worker per week; missing timesheets generate notifications (they are how the owner knows payroll data is incomplete).
- **Labor costing** snapshots the worker's labor-class rate *at entry time* (rate changes never rewrite history); workers without a class are flagged at $0 cost — visibly, not silently.
- **Field reports** are written to the same standard as timesheets and can be chased from the Work Queue like any other missing artifact.

### 7.7 Inbox triage workflow

Email backlogs import (mbox/CSV) or arrive via connected mailboxes → each item is **categorized into 7 buckets** (New Lead, Existing Customer, Vendor, Billing, Spam, Personal, Other) → per-category **playbooks** suggest the action (convert to lead, reply draft, file, ignore) → items support comments, claim/ownership, canned replies, and workspace rules (sender/domain → action). Converting an item creates a lead through the normal intake path (dedupe + triage included).

### 7.8 Weekly Status Report workflow

One click (or scheduled) generates the owner's report: wins and losses with **correct outcome counting** (case-canonical states), approvals rate, proposals sent, pipeline movement, stuck items, crew/time summary. This is the artifact the Ops Admin sends the owner every week — the product's "report out" moment.

### 7.9 Customer conversion & account workflow

Won → **Customer (account)** + **Person (contact)** are created or matched idempotently; lifetime value accumulates from real job values; the account record aggregates its leads, jobs, people, feed, files, and custom fields. People dedupe by email/phone across accounts; `memberships` model many-to-many belonging.

### 7.10 Duplicates & merge workflow

The finder groups records sharing phone/email. Merge: winner keeps its data; loser's proposals, jobs, tasks, events, and enrollments re-point to the winner; the loser is marked `DUPLICATE` / merged-into (hidden everywhere, recoverable in data). Bulk dedupe is also an agent automation — it **previews** affected records before applying (§8.2).

### 7.11 Billing & trial workflow

Registration → workspace on **Crew trial (30 days)** → seat/plan state visible in Billing → checkout via Stripe (annual or monthly price objects) → webhooks sync subscription state → plan changes prorate; seat additions beyond the plan limit are blocked with an upgrade path; trial expiry without a plan → plans-only mode.

### 7.12 Document template workflow

Settings → Doc Templates: pick from seeded varieties (Standard ⭐ default · Detailed Scope & Terms · Government & Prevailing Wage · Short & Simple) or add/duplicate your own; the editor is rich text (headings, lists, tables, **images** — uploaded (auto-downscaled) or by URL — with a sanitizer that allows only safe image sources); set per-template **logo on/off**; mark a default (the last template can never be deleted; deleting the default promotes another). The chosen template renders identically on print, DOCX, and the customer sign page.

---

## 8. The AI system

Workpile's AI is built in three layers. This section describes **what is actually implemented in production code today**, how it works mechanically, and — separately and clearly labeled — the designed extension points. We do not claim capabilities the code does not have.

### 8.0 Honest architecture statement

The production AI layer is a **deterministic, rule-based intelligence engine written in TypeScript** (`server/ai.ts`, `server/agents.ts`) — no external large-language-model API is called in any production path today. This is a deliberate v1 choice:

- **Predictability:** the same lead always scores the same way; owners can learn and trust the behavior.
- **Auditability:** every decision decomposes into named rules and flags (see `scoreLead` flags) — there is no black box to explain to a regulator or a skeptical owner.
- **Cost & latency:** zero inference cost, millisecond decisions, works fully offline.
- **Safety:** by construction, the engine cannot hallucinate a price, a commitment, or a customer message.

The architecture is **model-agnostic by design**: every agent function has a stable input/output contract and writes an `agent_runs` record with a `model` tag (currently `rules-v2`), so an LLM-backed implementation can be swapped behind the same contracts later without changing callers, UI, or audit history (see §8.4).

### 8.1 Layer 1 — Deterministic intelligence (always on)

| Capability | Where | How it works |
|---|---|---|
| **Lead scoring** | `ai.ts → scoreLead` | Additive rule model over value band, source quality, catalog match, message signals, and recency → 0–100 score + temperature (hot/warm/cold) + human-readable flags. Runs on intake and on demand. |
| **Next-Best-Action (NBA)** | `ai.ts → nextBestAction` | Given lead state + proposal age, returns one concrete action with a working button on the record (e.g., "Proposal sent 6 days ago, no view — Nudge now", "No next step set — Set for tomorrow"). Every lead record carries an AI strip: score, temperature, NBA. |
| **Insights engine** | `ai.ts → insights / insightsV2` | Workspace-level detectors: approvals aging > 24h, cold proposals (sent, unviewed, aging), stuck leads (no event in N days), unowned/unnext-stepped leads, demand gaps. Each insight carries a one-click remediation that actually executes (nudge sends the follow-up template + sign link; aging approvals jump to the packet). |
| **Triage agent** | `agents.ts → triageLead` | Classifies an inbound request against the workspace's real service catalog; emits catalog-match and value-mention flags; output feeds scoring and assignment. |
| **Packet-check agent** | `agents.ts → packetCheck` | Pre-send completeness scoring of a proposal packet (part of the FPAR machinery): missing pieces listed explicitly; feeds the approval packet UI. |
| **Demand-gap agent** | `agents.ts → demandPool / demandGap` | Counts only **genuine unmet demand** — Lost/Unserviceable leads for services the workspace does not offer — clustered by requested service, so "what should we sell next" is answered from lost revenue, not opinions. |
| **Inbox intelligence** | `inbox.ts → categorizeEmail, suggestInboxAction` | 7-category classification of inbound mail + per-category suggested action with a pre-drafted reply (subject + body from templates and item context). |
| **Spam/dedupe detection** | `ai.ts → cleanupPreview` | Finds junk-pattern leads, exact dedupe-key collisions, and stale records; produces a **preview list** a human confirms before anything is applied (`cleanupApply`). |

### 8.2 Layer 2 — Agentic automation ("Workpile Agent")

This is the agentic layer: software that **pursues standing goals across the workspace on a schedule, decides what to do from live state, executes multi-step work through the same APIs the UI uses, checks its own results, and escalates what it must not do** — the plan → act → verify → escalate loop from contemporary agentic-AI practice, implemented with deterministic decision functions.

**The loop, concretely** (`ai.ts → runAutomationsFor / processAutomations`, driven by `worker.ts`):

1. **Sense.** The worker wakes on a ~6-hour sweep per workspace (and on demand from the UI) and reads live state: unscored leads, unassigned leads, dedupe collisions, stale No-Response leads, approval queues.
2. **Plan.** For each enabled automation, the runner computes its work set deterministically (e.g., auto-score: leads with no score or stale scores; auto-assign: unowned leads through the assignment rules; auto-dedupe: preview-verified exact-key groups; auto-reactivate: No-Response leads past the reactivation window).
3. **Act.** It executes through internal service functions — the same code paths as the REST API — never through raw SQL shortcuts, so every invariant (ownership, dedupe, stage discipline) holds for agent writes exactly as for human writes.
4. **Verify.** Each action's result is counted and cross-checked (e.g., scored count vs. the set computed in step 2); discrepancies surface in the run summary rather than being hidden.
5. **Record.** Every run writes an `agent_runs` row: workspace, run type (`automation-sweep`), a **structured JSON summary** (`{scored, assigned, archived_duplicates, reactivation_tasks}`), the model tag `rules-v2`, timestamps. Per-lead agent actions (scores, insights) also log individually.
6. **Escalate / stop at the boundary.** The agent never crosses the approval boundary (§9.1): it does not send customer-facing messages, does not set or change prices, and does not approve proposals. Where a human decision is required, it creates the work item (approval packet, task, insight) and stops.

**Autonomy is configured, not assumed.** Four per-workspace toggles — **auto-score, auto-assign, auto-dedupe, auto-reactivate** — default to the workspace's choice; the Home command center shows the live state (e.g., "4/4 automations on"), the last run time, and recent run history. **"Run agent now"** executes the same sweep on demand and returns a full itemized summary in an animated modal (§12.3); if all automations are off, the modal offers one-click enable-all instead of a dead end.

**Scale proof:** on the 2,613-lead demo workspace, a single sweep scored 2,622 leads and created 212 reactivation tasks; on the live G.C. pilot, the agent is enabled 4/4 and logged a run minutes after the v6 deploy — visible in production today via `GET /api/home`.

**Follow-up engine as a bounded agent.** The cadence processor (`followups.ts → processFollowups`) is a second, narrower agent: it advances enrolled cadences on business days, renders the pre-approved template for the current touch, dispatches through the comms layer, watches for stop conditions (reply/signature/lost/manual) on every pass, and records each touch. Its autonomy is bounded by design: it can only send **workspace-approved templates** — it cannot compose novel customer-facing text.

### 8.3 Layer 3 — Generative components

"Generative" in Workpile today means **programmatic generation of finished business artifacts from structured data and templates** — deterministic generation, not stochastic text generation:

| Generative capability | Mechanism |
|---|---|
| **Proposal documents** | The proposal builder assembles priced line items + chosen doc template (intro/terms/footer with merge fields) + workspace branding/logo into a complete customer-ready document — rendered identically to print HTML, DOCX, and the public sign page (`proptemplate.ts`, `docx.ts`, `app.ts` sign route). |
| **Good/Better/Best options** | Tiered proposal variants generated from one line-item set. |
| **Follow-up & notification messages** | Merge-field rendering (`followups.ts → render`) over workspace templates: every outbound touch is generated from the record's live data at send time. |
| **Inbox reply drafts** | `suggestInboxAction` generates a context-specific draft subject/body per item for one-click human send. |
| **Weekly Status Report** | `statusreport.ts` generates the owner's narrative report (outcomes, approval rate, stuck items, crew summary) from the metrics engine. |
| **Morning Brief** | The dashboard hero is generated each load from live workspace state: headline, action chips, top-3 stuck items. |
| **Backlog Audit (GTM)** | The free audit artifact is generated from an imported backlog: counts, aging, rotting value, ownership gaps. |

### 8.4 Designed extension points (not yet in production — stated plainly)

The contracts are ready for these swaps when the business case justifies them; none are claimed as shipped:

- **LLM drafting behind the same contracts:** `suggestInboxAction` and follow-up rendering can be backed by an LLM for novel-text drafting — still approval-gated, still template-priced. The `agent_runs.model` tag exists precisely so rule-based and LLM runs remain distinguishable in audit history.
- **LLM triage/scoring enrichment:** `triageLead`'s flag contract can absorb model-extracted fields (budget mentions, urgency) without schema changes.
- **Natural-language report builder queries** over the existing `/api/reports/build` contract.
- Until then, marketing copy must describe the AI as it is: **rule-based agentic automation with full audit trails** — which is, for this customer segment, a feature (predictable, explainable, no per-token cost), not an apology.

---

## 9. AI governance and safety invariants

These invariants are enforced in code and covered by tests (spec §26 heritage):

1. **Approval boundary.** Customer-facing sends and price-bearing artifacts require (a) a human approval under the workspace policy, or (b) a pre-approved workspace template (follow-up cadences). There is no third path.
2. **Price integrity.** Prices resolve from `price_book_items` at build time and snapshot into the proposal. No agent, template, or import can introduce a price.
3. **Prompt-injection invariant.** All ingested text (email bodies, CSV cells, form fields) passes `agents.ts → injectionScan`, which detects instruction-like patterns ("ignore previous instructions", tool-call syntax, role-play prefixes…). Flagged content is treated as data and marked; it can never trigger an action. **Ingested content is data, never instructions** — this is a load-bearing rule of the codebase.
4. **Honest delivery states.** A message is "sent" only on a verified provider response; test-mode sends are labeled and never upgraded retroactively. Webhook outcomes are "delivered" only on a real HTTP 2xx from the customer endpoint, else they retry and eventually dead-letter visibly.
5. **Auditability.** `agent_runs` + `audit_log` + `lead_events` make every automated action reconstructable: what ran, when, on which records, with what result, and which human approved what.
6. **Code-gated actions.** Send/approve/price operations check permissions and policy in server code — never merely hidden in the UI. Per-member permissions are enforced server-side on every route.
7. **Data minimization in AI.** The rule engine reads only the workspace's own records; nothing leaves the tenant boundary (there is no external inference call to leak to).

---

## 10. Integrations and public API

### 10.1 REST API

- Full REST surface (255 routes) with API-key auth for programmatic intake (`api_keys`, scoped per workspace) plus session auth for the app.
- `GET /api/home`, `/api/dashboard`, `/api/reports/build`, `/api/search` (grouped global search), `/api/calendar` (with `done=1` completed inclusion) are the aggregate workhorses of the UI.

### 10.2 §14.5 Final Outcome Handoff API

When a lead reaches a final outcome, Workpile hands it back to **the customer's own platform** (their CRM/legacy system) so Workpile never becomes a data trap:

- **Outcomes:** Won / Lost / No Response / N-A / Junk / Duplicate, with reason codes and the winning proposal/job references.
- **Push:** webhook delivery to registered endpoints, **HMAC-signed**, with exponential retry and a **dead-letter queue** + manual replay in the Handoffs monitor. "Delivered" means a real 2xx.
- **Pull:** customers can fetch outcomes via API and **acknowledge** them (ack/status-back endpoints) — Workpile tracks delivered vs. acknowledged distinctly.
- **Supersede semantics:** reopening a lead supersedes its outcome; a corrected delivery follows. History is never rewritten silently.

### 10.3 Channels & providers

| Integration | State |
|---|---|
| Stripe (own billing + customer deposits) | Code-complete; test mode until live keys + 6 price objects are created |
| Resend (email) / Twilio (SMS) | Adapters built; honest `test_mode` until credentials are configured; TCPA consent gate enforced before any SMS |
| Gmail / Microsoft mailboxes | OAuth flows coded, config-gated on app registrations |
| Web Push (VAPID) | Built; keys are a founder setup item |
| Vendor CSV importers | Common CRM export shapes mapped in the guided importer |
| QuickBooks Online | Designed (cred registration is a founder item) |

---

## 11. Security, privacy, and compliance

- **Authentication:** email/password (salted hashing in `db.ts`), server-side sessions, password-reset tokens (`auth_tokens`), email verification flags.
- **Authorization:** role + per-member permission overrides, enforced server-side per route; workspace scoping on every query; platform-admin separation for the Ops Console.
- **E-signature:** ESIGN-style consent capture with a full evidence record (document hash, signer identity, timestamps) — a signed proposal is defensible evidence, not a screenshot.
- **TCPA:** SMS sends require recorded consent on the lead; the comms layer refuses otherwise.
- **Audit:** `audit_log` for sensitive actions (billing, settings, deletes), `agent_runs` for automation, immutable `lead_events`.
- **Data handling:** tenant isolation by `workspace_id`; backups of the pilot DB on the droplet; secrets live in server environment only (never in the repo; the repo is public and contains no credentials by design).
- **Privacy posture:** no third-party analytics on customer data; no external AI calls (see §8.0) — customer data never leaves the server in v1.

---

## 12. UX system and design language

### 12.1 Design language

Bright, warm, confident: white cards (16–24px radius, soft shadows) on a soft neutral canvas; Workpile **green** as the brand accent (with an amber highlight reserved for "today/attention"); pastel top-glows on stat cards; big bold numerals; segmented pill controls; avatar rows with relative times; a semicircular tick **goal gauge**. The v6 home redesign translated a best-in-class CRM dashboard reference (Panze studio, Dribbble) into this brand system and onto real Workpile data.

### 12.2 Motion system

A global CSS motion layer (`styles.css`): staggered fade-up entrance for dashboard cards, pop-in for **all** modals, hover lift on interactive cards, a pulsing "LIVE" indicator on the agent panel, animated activity bars, toast slide-ins, and count-up numerals on stat cards. Motion is functional (it directs attention to what changed) and consistent — every modal in the product inherits the same entrance.

### 12.3 The Home command center (v6)

Dashboard composition, top to bottom: **Morning Brief** (generated headline + action chips + stuck top-3) → **stat cards** (Open pipeline · Proposals Sent ★ North Star · FPAR · Won value, count-up animated) → **Workpile Agent panel** (LIVE indicator, 4 automation chips, guardrail statement, recent run history, top insights, **Run agent now**) → **30-day activity bars** (14/30-day toggle, today highlighted) + **Recently Assigned** → right rail: **FPAR goal gauge** (vs. 90% target), **Upcoming** week strip + agenda cards, **Quick Links** → pinned reports, funnel, by-service, leaderboard, recent activity. The **Agent Run modal** animates the real sweep step-by-step (Scoring → Assigning → Tidying duplicates → Reactivating) and lands on the itemized result.

### 12.4 Interaction rules

- **Nothing opens "randomly":** calendar records open only from explicit agenda actions; notification clicks route to the exact record (lead/job/customer) they concern.
- **Every number drills down** to the records composing it.
- Keyboard: ⌘K palette everywhere; J/K/Enter conveyor in the Work Queue.
- Scale-proven UI: the Leads table, dashboard, and reports run against a 2,613-lead / 2,001-won workspace in the demo environment.

---

## 13. Metrics and analytics definitions

| Metric | Definition (as computed by `metrics.ts`) |
|---|---|
| **Proposals Approved & Sent / week** | North Star. Count of proposals reaching Sent state in the trailing 7 days (live on `/api/home`). |
| **FPAR (First-Pass Approval Rate)** | Proposals approved with no change requests ÷ proposals decided. Target ≥ 90%. Shown as the dashboard gauge. |
| **Open pipeline** | Sum of `est_value` over non-final leads. |
| **Won value / Lifetime value** | Sum of actual job values (proposal total + approved change orders) — never estimates. |
| **Win rate** | Won ÷ (Won + Lost) over decided finals. |
| **Cycle times** | Intake → first proposal; proposal → decision; median age per board column; "rotting" = open beyond the workspace's age threshold. |
| **Agent activity** | Runs, records scored/assigned/deduped/reactivated per period (from `agent_runs`). |
| **Demand gap value** | Count + estimated value of genuine unmet-demand clusters (§8.1). |
| **Campaign ROI** | Won revenue attributed to campaign members ÷ campaign cost. |

Report Builder cross-checks: grouped totals reconcile with list totals (tested); the Weekly Status Report and dashboard read from the same engine so numbers never disagree between screens (the Slice-27 case bug — outcome counting by exact string vs. canonical state — is the cautionary tale encoded in tests).

---

## 14. Engineering handbook

### 14.1 Development setup

```bash
git clone https://github.com/Shehreyarkhann/workpile-crm
cd workpile-crm
npm install
npm run dev            # API server (node server/index.ts)
npm run dev:client     # Vite client (separate terminal)
npm test               # 117 tests (node --test, explicit file list in package.json)
npm run smoke          # end-to-end smoke against a running server
npm run build          # production client bundle
```

Environment: `LEADFLOW_DB` (SQLite path), `PORT` (default 4173), provider keys (`STRIPE_*`, `RESEND_*`, `TWILIO_*`, `VAPID_*`, OAuth client IDs) — all optional in dev; absent keys degrade to labeled test modes, never to silent failure.

**House rules learned in production (enforced by tests/reviews):**

- New test files must be appended to the `test` script in `package.json` (the list is explicit).
- `vite build` does **not** typecheck the server — server changes are verified by tests, not by the build.
- React hooks never sit below an early return (the v3 React #310 crash); every modal is render-tested.
- After editing an SQL `INSERT`, count placeholders against columns.
- Bulk find/replace passes get grep-verified before build (a fused-token corruption class of bug).

### 14.2 Testing strategy

- **117 automated tests** across 31 files (`tests/`): core lifecycle, every slice's routes, v3 model rules (finals discipline, supersede), v4 CRM (conversion idempotency, merge re-pointing), v5 (calendar completed inclusion, notification entities, doc-template guards), v6 (home aggregate shape).
- **Smoke test** boots the server and walks the golden path.
- **Scale fixtures:** the demo seeder builds a 2,613-lead / 2,001-won / $28.3M workspace; migrations and heavy endpoints (jobs backfill, dashboard) are verified against it — the v3 migration backfilled 2,001 jobs from won leads on this data.
- **Screenshot QA:** every release is captured headlessly at desktop width across the changed surfaces before deploy (screenshot sets v1–v13 retained in the spec folder).

### 14.3 CI/CD

- **GitHub Actions** runs install + full test suite + build on every push to `main`; merges are expected green.
- Releases are **slice-based**: each slice lands as its own commit with tests (e.g., v5 `6f781e1`, v6 `b513704`), keeping rollback a single revert.

### 14.4 Deployment

Pilot deployment (current production):

```bash
# On the droplet console — the only step a human runs:
curl -fsSL https://raw.githubusercontent.com/Shehreyarkhann/workpile-crm/main/deploy/deploy-workpile.sh | bash
```

The script is self-contained and idempotent: clones/pulls `/opt/workpile`, installs, builds, restarts the service (port 4173), and the server **auto-migrates the database additively on boot** (new tables/columns appear without downtime steps). Post-deploy verification (outside-in, as a real user) is part of the release ritual: login, home aggregate, template routes, calendar, plus a check that co-hosted properties (claimpaid.io) are unaffected.

Target production topology (post-pilot): dedicated host, PostgreSQL (schema + migration pack already in repo), object storage for files, managed Stripe/Resend/Twilio credentials, domain `workpile.io`.

### 14.5 Operations

- **Ops Console** (in-app, platform admin): workspace health, agent-run volumes, DLQ depth, feature flags/canary controls.
- **SLO synthetics + runbooks** ship in the repo (health endpoint, restart, DB backup/restore drills); backups are age-encrypted in the pilot setup.
- **Feature flags** (`feature_flags` table) gate risky surfaces per workspace.

### 14.6 Version history (release slices)

| Version | Contents |
|---|---|
| Slices 1–4 | Auth/RBAC, stage machine, ingestion, Completeness Gate, Approval Inbox, price-book proposals, §14.5 handoff, e-sign, deposits, change orders, portal, own billing, OAuth (gated), Postgres/Docker/CI packs, landing + legal drafts |
| Slices 5–16 | Salesforce-parity client rewrite, brand/auth redesign, multi-tenancy, Lead Sync, AI scoring/cleanup/Auto-pilot, two-way REST API + webhooks + Slack hooks, comms (test-mode honest), password reset, notifications, cadences, ⌘K, Pulse, PWA, My Day, bulk ops, two-way SMS, push, dark mode, booking page, forecast, speed-to-lead |
| Slices 17–24 | Proposal template editor, email backlog import + Inbox playbooks, timesheets, labor costing, field reports, crew scheduling, Weekly Status Report, G.C. pilot workspace |
| Slice 25–27 | Per-seat pricing + seat enforcement; status-report counting fix |
| **v3 (28–36)** | Lead→Proposal→Job model: free stage movement, finals discipline, readiness checklist, approval policy, roster workers, Jobs layer, Work Queue home, G/B/B proposals, 12-touch cadences |
| **v4 (37–46)** | Salesforce parity: Customers/People/conversion, feed + mentions, custom fields, Tasks + Calendar, Campaigns + ROI, duplicates + merge, assignment rules, Notes/Files, app switcher + grouped search, Report Builder + pins, inline editing |
| **v5 (47–50)** | Calendar day-agenda rebuild, notification record-targeting fix, sidebar consolidation (26→20), document template system + workspace logo + rich-text images + template picker + sign-page rendering |
| **v6 (51)** | Agentic command center: `/api/home`, HomeDash (agent panel + run modal), activity graph, goal gauge, full motion system |

---

## 15. Current state, known gaps, and roadmap

**Live today (Nov 10, 2026):** the full product above, on workpile.claimpaid.io, with the G.C. Environmental pilot workspace in daily-shaped use: 50 leads, 6 jobs, 6 customers, agent automations enabled 4/4 in production, 11 proposals sent in the current week.

**Founder-owned setup items (the only blockers to full commercial launch — all in `LAUNCH.md`):**

1. Register **workpile.io** and point production DNS.
2. Stripe **live** keys + create the 6 price objects (annual $239.88 / $599.88 / $959.88; monthly at list).
3. Resend + Twilio credentials (until then, comms remain honestly labeled test mode).
4. VAPID keys for Web Push; Gmail/Microsoft OAuth app registrations; Intuit (QuickBooks) credentials.
5. Attorney pass over legal drafts (terms, privacy, e-sign language).

**Known product gaps (acknowledged, sequenced):**

- Postgres cutover for production scale (SQLite serves the pilot; schema pack ready).
- LLM-backed drafting/triage behind existing contracts (§8.4) — deliberately deferred until rule-based limits are actually hit in the field.
- Native mobile apps (the PWA covers the pilot).
- Signing auto-flips lead → Won is implemented via the sign flow; the manual "mark won" path still asks for explicit confirmation by design (finals discipline).

**Roadmap themes:** deepen the agent (follow-up drafting within templates, approval-packet auto-assembly), demand-gap → service-launch playbooks, richer customer portal, marketplace of vendor importers, and the Backlog Audit as a self-serve public funnel on workpile.io.

---

*End of specification — Workpile, November 10, 2026. Companion documents: `FULL-SPEC.md` (v2.0 product spec, §§1–26), `FULL-SPEC-V3.md`, `FULL-SPEC-V4.md` (slice plans), `COMPETITIVE-AUDIT.md`, `LAUNCH.md` (founder checklist). This document describes the system as built and deployed; where it describes intent beyond the code, it says so explicitly (§8.4, §15).*

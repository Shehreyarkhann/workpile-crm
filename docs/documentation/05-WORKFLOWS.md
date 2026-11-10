# Workpile — Workflow Descriptions

*Extracted verbatim from the Master Specification (§7), current at v6 / commit `6155c8a`.*

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

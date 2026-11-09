# LEADFLOW OS — FULL PRODUCT SPECIFICATION
### AI-Agentic Lead Backlog, Approval & Proposal SaaS for Small Service Businesses
**Working name:** LeadFlow OS (alternatives: BacklogZero, ClearPipeline, ApproveFlow — name clearance required before launch)
**Version:** 1.0 — Founder Spec | **Date:** November 9, 2026
**Author role:** Founder / Full-Stack Engineer
**Status:** Build-ready MVP specification. No customer data in this document. All volumes cited from a real design-partner pattern (1,000+ lead backlog, 3,000+ email backlog) are illustrative of the target segment, not a commitment by any named business.

---

## TABLE OF CONTENTS
1. Executive Summary & Product Thesis
2. Problem, Market & ICP
3. Product Principles (Silicon Valley Standards)
4. Lead Ingestion — API, CSV & Integrations
5. Core Workflow & State Machine
6. The 90%+ Approval System
7. Ownership, Project Managers & Accountability
8. Follow-Up Engine
9. Generative Proposals
10. KPI System, Insights & Analysis
11. Demand Gap Engine — Services You're Missing
12. AI Agent Architecture
13. Data Model
14. Public API Specification
15. UX — Screen-by-Screen
16. Tech Stack & Infrastructure
17. Security, Privacy & Compliance Roadmap
18. Pricing & Packaging
19. Go-To-Market
20. 90-Day Build Roadmap & Sprint Plan
21. Metrics, North Star & Instrumentation
22. Risks, Moats & Defensibility
23. Fundraising Narrative
24. Open Decisions & Build Gates

---

## 1. EXECUTIVE SUMMARY & PRODUCT THESIS

### 1.1 One-liner
LeadFlow OS clears a small service business's lead backlog, routes every qualified lead through a one-tap owner approval, generates the proposal from the business's own templates and price book, and never lets a lead sit without an owner and a next follow-up date.

### 1.2 Thesis
Small service businesses (5–50 staff) do not lose revenue because they lack leads. They lose it in the gap between *lead arrives* and *proposal sent*:

- Leads arrive in 6+ places (website, email, phone notes, marketplaces, spreadsheets, referrals) and are never unified.
- Triage is manual, so backlogs grow to 500–3,000+ untouched inquiries.
- The few leads that get worked stall waiting for the owner/CEO to approve scope and price — approval is a bottleneck, not a quality gate, because submissions arrive incomplete.
- Proposals are rebuilt from scratch in Word each time, even though 90% is a template.
- Follow-up is memory-based. No owner, no date, no cadence = silent revenue loss.
- Owners have no trustworthy numbers: which source closes, which service makes money, which PM is overloaded, and — most valuable — which services customers keep asking for that the business does not offer.

Generic CRMs (HubSpot, Salesforce, GoHighLevel, Jobber, ServiceTitan) store leads. None of them is built *backlog-first, approval-first, and proposal-first* for an owner-operated business where the owner is the approver.

### 1.3 The wedge
**Backlog Clear:** Connect the inbox + upload the spreadsheet on Day 1. Within 24 hours the owner sees a Backlog Audit: total leads, duplicates removed, hot/warm/stale split, estimated pipeline value, proposals never followed up, and a projected clear date. That audit sells the subscription; the daily operating system retains it.

### 1.4 What this is NOT
- Not a general CRM replacement in V1. It is the revenue workflow layer on top of whatever they have.
- Not an autonomous sender. No customer-facing message or proposal sends without human approval in V1/V2 autonomy levels (see §12.4).
- Not a field-service dispatch, invoicing, or payments platform in MVP. Those are integrations, not builds.

### 1.5 North Star Metric
**Proposals Approved & Sent per Workspace per Week.** Every feature must move this number, approval cycle time, or win rate — or it is cut.

---

## 2. PROBLEM, MARKET & ICP

### 2.1 Ideal Customer Profile (V1 — one vertical only)
- **Vertical:** Field-service / environmental / home-service companies first (remediation, HVAC, plumbing, electrical, landscaping, cleaning, pest, roofing, general contracting). One vertical's language, templates, and price-book structure in MVP; horizontal expansion in Phase 3.
- **Size:** 5–50 employees, $500k–$10M revenue, owner still personally approves proposals above a threshold.
- **Lead volume:** 50–500 new leads/month + an existing backlog of 200+.
- **Current stack:** Gmail/Outlook, Excel/Google Sheets, Word proposals, maybe a basic CRM they don't maintain. No dedicated RevOps staff.
- **Buyer:** Owner/CEO. **Daily user:** Operations coordinator / office manager. **Approvers:** Owner + 1–3 managers. **Contributors:** Lead owners, project managers (PMs), field managers.
- **Disqualifiers:** <20 leads/month (no backlog pain), enterprise sales cycles, businesses requiring regulated proposal compliance beyond standard terms (defer).

### 2.2 Jobs To Be Done
1. "Show me every lead I have, once, in one place — and tell me which are still worth working."
2. "Only bring me approvals I can say yes to in 10 seconds."
3. "Make the proposal for me from our template and our prices — don't invent numbers."
4. "Tell me who is working what, who is late, and what happens next — without me asking in a meeting."
5. "Tell me every Monday where revenue is leaking and what service I should add next."

### 2.3 Market framing (for GTM/fundraising, verify before external use)
US service SMBs number in the millions; the serviceable wedge is owner-operated field-service firms with 50+ leads/month. Pricing at $299–$999/mo positions below ServiceTitan/enterprise tools and above a raw CRM seat — justified only by recovered proposals, not seats. TAM/SAM figures must be sourced from current Census/IBISWorld data before any investor material ships; no unsourced numbers in this spec are to be quoted externally.

### 2.4 Competitive positioning
| Competitor class | Their strength | Our counter-position |
|---|---|---|
| Generic CRM (HubSpot, Pipedrive) | Contacts, email marketing | We run the approval + proposal workflow they leave manual |
| Vertical FSM (Jobber, ServiceTitan) | Scheduling, dispatch, invoicing | We sit *before* the job: backlog, qualification, approval, proposal |
| AI SDR / outreach tools | Cold outbound volume | We work *inbound demand they already paid for* — higher intent, no spam risk |
| Spreadsheets + inbox | Free, familiar | We give the same simplicity with ownership, SLAs, and an audit trail |

---

## 3. PRODUCT PRINCIPLES (SILICON VALLEY STANDARDS)

1. **Time to first value < 24 hours.** Signup → connect/upload → Backlog Audit the same day. No implementation project.
2. **Approval-gated AI, always.** AI drafts, summarizes, scores, and assembles. Humans approve anything customer-facing or price-bearing.
3. **Deterministic core, probabilistic edge.** State machine, pricing, permissions, SLAs, dedupe keys = code. Summaries, classification, drafting = LLM with structured output + confidence.
4. **No lead without owner + next step.** Enforced by the data model, not by training.
5. **Design bar: Linear/Stripe.** Fast (<200ms list interactions), keyboard-first for ops staff, phone-perfect for owners approving on the go. No dashboard that requires a manual to read.
6. **Every number is drillable.** Any KPI tile clicks through to the exact leads/proposals behind it. No vanity metrics.
7. **Audit everything.** Who saw, drafted, edited, approved, sent — timestamped, immutable.
8. **Data portability.** Full export (CSV/JSON) at any time. Trust beats lock-in.
9. **Ship the wedge, earn the platform.** MVP proves backlog → approval → proposal. Platform features (Demand Gap, auto-approval tiers) unlock after workflow trust exists.

---

## 4. LEAD INGESTION — API, CSV & INTEGRATIONS

Design rule: the business changes nothing about how leads arrive. LeadFlow meets every existing channel.

### 4.1 Tier 1 — MVP integrations
| Channel | Mechanism | Notes |
|---|---|---|
| Website form | JS embed snippet (1 line) + hosted form fallback | Works on any site; WordPress/Wix/Squarespace/Webflow plugins are thin wrappers on the same endpoint |
| Public API | `POST /v1/leads` (see §14) | API keys per workspace + per source; idempotency key required |
| Webhook inbound | Signed webhook receiver (HMAC) | For form tools (Typeform, Gravity Forms, Jotform), CRMs, custom sites |
| CSV / Excel import | AI column-mapping wizard | The backlog wedge. Maps messy columns, validates phones/emails, previews dedupe before commit |
| Email inbox | Gmail + Microsoft 365 OAuth | Inquiry emails auto-create leads; thread attaches to the lead record; original email never altered |
| Manual entry | Quick-add (30-second form) | Phone/walk-in/referral leads; voice-note-to-lead is Phase 2 |

### 4.2 Tier 2 — Phase 2 integrations
Meta Lead Ads, Google Local Services Ads, Angi, Thumbtack, Yelp, Zapier/Make (catch-all), Google Business Profile messages, call-tracking (CallRail/WhatConverts — call summary becomes a lead), HubSpot/Salesforce 2-way *status* sync only.

### 4.3 Ingestion pipeline (every source, same path)
```
Source → Normalize (names, phone E.164, email lowercase, address)
       → Validate (deliverability/format, spam heuristics)
       → Dedupe (exact phone/email match → fuzzy name+address match → human merge queue if ambiguous)
       → Enrich (prior customer? prior proposals? source history)
       → Classify (service, urgency, value band — §12 Agent 2)
       → Create Lead in state NEW + assign owner by rule (§7.2)
       → SLA clock starts (first-response timer)
```
- Every ingestion event is logged with raw payload (retention: 90 days raw, lead record permanent).
- Duplicate policy: never silently delete. Merge keeps all source records linked; merge is reversible for 30 days.
- Spam/junk goes to a Junk queue with one-tap restore — false positives in triage must be cheap to undo, or owners stop trusting the system.

### 4.4 Backlog Import Mode (special flow)
For an existing 500–3,000 item backlog: bulk import → dedupe report → age + last-contact analysis → AI split into **Still Hot / Worth One Touch / Stale — Reactivation Candidate / Dead** with reasons shown per bucket. Owner approves the bucket plan once; the system then works the queue in priority order instead of dumping 1,000 rows on one person. Progress shows as a burn-down with projected clear date (§10).

---

## 5. CORE WORKFLOW & STATE MACHINE

### 5.1 Lead lifecycle (states are enforced; no free-form statuses in MVP)
`NEW → TRIAGED → QUALIFYING → QUALIFIED → READY_FOR_APPROVAL → APPROVED → PROPOSAL_DRAFTED → PROPOSAL_SENT → IN_FOLLOW_UP → WON | LOST | NO_RESPONSE`
Side states: `JUNK`, `DUPLICATE (merged into #)`, `ON_HOLD (reason + resume date required)`, `UNSERVICEABLE (feeds Demand Gap, §11)`.

Rules:
- Transitions are validated server-side. A lead cannot enter READY_FOR_APPROVAL without passing the Completeness Gate (§6.2).
- Every transition writes an activity event (actor, from, to, timestamp, note).
- Every non-terminal state requires: `owner_id`, `next_action`, `next_action_due_at`. The nightly SLA job flags breaches.
- WON auto-creates a Project record and assigns the PM (§7). LOST requires a reason code (§9.4).

### 5.2 Queues (the daily work surfaces)
1. **My Queue** — everything I own, sorted by due date, then value.
2. **Approval Inbox** — approver's single list; the product's hero screen (§6).
3. **Unassigned / Stuck** — ops view: no owner, SLA breached, follow-up overdue, pending approval > threshold.
4. **Backlog Burn-Down** — the imported backlog as a counted queue with pace + clear date.

### 5.3 SLA defaults (workspace-configurable)
- First response to NEW lead: 15 min (hot) / 4 business hours (standard).
- Qualification decision: 1 business day.
- Approval decision: 4 business hours → reminder; 24h → escalate to owner.
- Proposal sent after approval: same business day.
- Follow-up cadence: per §8.

---

## 6. THE 90%+ APPROVAL SYSTEM

### 6.1 Definition (this is a contractual product metric, show it in-app)
**First-Pass Approval Rate (FPAR) = approvals granted with no edits ÷ all approval decisions.**
Baseline in target businesses is typically 40–60% (incomplete packets, off-template pricing, unqualified leads). **Product target: ≥90% FPAR within 60 days of go-live**, plus approval cycle time < 4 business hours median. Both are displayed on the Executive Dashboard and in the weekly brief. If FPAR is not rising, the Insight Agent must say why, by reject-reason (§6.5).

### 6.2 Completeness Gate (the single biggest lever)
A lead/proposal packet cannot be submitted for approval until all workspace-required fields pass:
- Contact (name, phone, email), service requested, service location, scope notes
- Source + estimated value (or value band)
- Photos/documents if the service type requires them
- Price built from the Price Book (§9.2) — free-typed prices require a manager override with reason
- Proposed PM + proposed timeline
Missing items route back to the Lead Owner as tasks — the approver never sees an incomplete packet.

### 6.3 Pre-submission AI check
Before submission, Agent 4 (§12) scores the packet against the workspace's won-deal history: template match, margin band, scope clarity, missing-risk flags. Score + flags show to the *submitter* first ("Price 14% above your won average for this service — approver will likely push back"). Submitters self-fix before the approver ever sees it. This pre-check is what moves FPAR; the approval button alone does not.

### 6.4 Approval Inbox UX (approver)
- One list, phone-first. Each card: 3-line AI summary, value, margin band, PM, risk flags, win-probability band, one-tap **Approve / Request Changes (reason required) / Reject (reason required)**.
- Bulk approve for low-risk tier (below value threshold + standard template + repeat service).
- Tiered routing: value/ discount / service rules assign Manager vs CEO. Rules are workspace settings, versioned, and every routing decision is logged.
- Delegate + vacation mode: approvals re-route with full history; nothing waits on an absent approver.

### 6.5 Rejection learning loop
Reject/change reasons are structured codes: `PRICE, SCOPE, NOT_QUALIFIED, MISSING_INFO, DUPLICATE, TIMING, OTHER(+note)`.
Weekly, the system aggregates by code and by approver, and auto-tightens the gate: e.g., 5× MISSING_INFO on photos → photos become a hard gate for that service. Approver patterns are learned per-approver, not globally (two approvers rarely reject for the same reasons).

### 6.6 Graduated autonomy (earned, never default)
- **L1 Draft-Only:** AI drafts everything; human submits + approves + sends. (Default)
- **L2 Trusted Templates:** Packets matching proven templates + below value cap can be flagged "auto-ready" — approver still taps approve, but in bulk.
- **L3 Scoped Auto-Approval (Phase 3, opt-in per rule):** Only for a named service + value cap + template the workspace explicitly enables, with a daily digest of everything auto-approved and one-tap undo window. Customer-facing sends still require approval at L3 in this spec.

---

## 7. OWNERSHIP, PROJECT MANAGERS & ACCOUNTABILITY

### 7.1 Four roles on every lead (all visible on the record + board)
| Role | Owns | Set by |
|---|---|---|
| **Lead Owner** | Working the lead: contact, qualification, follow-ups | Assignment rules / manual |
| **Project Manager (PM)** | Delivery if won; consulted pre-proposal on scope/timeline | Service + territory + capacity rules |
| **Approver** | The approval decision (§6) | Tiered routing rules |
| **Watcher** | Visibility without responsibility (owner, ops coordinator) | Workspace default |

### 7.2 Assignment engine
Modes (combinable, in priority order): explicit source rule → service-line rule → territory (ZIP/postcode) → PM capacity cap (max active projects) → round-robin within the eligible pool. Every auto-assignment logs its reason ("Assigned to Maria — territory North + lowest active load: 6"). Manual reassign requires a note; reassignment history is permanent (accountability without blame-gaming: the timeline shows handoffs, not just current owner).

### 7.3 Accountability surfaces
- **Workload board:** per person — active leads, overdue follow-ups, avg first-response, proposals out, win rate.
- **Stuck detector (nightly job):** no activity 48h on an active lead, follow-up overdue, approval pending >24h, proposal sent with no next step → appears in Stuck queue + morning brief, routed to the owner of the *stage*, not broadcast to everyone.
- **Field/PM compliance:** PMs who must confirm scope, site notes, or completion documents get their own task list; compliance % by PM is a KPI (§10) — the same pattern as field-report compliance tracking in operations roles.

### 7.4 Permissions (RBAC)
Roles: `OWNER, ADMIN, MANAGER/APPROVER, LEAD_OWNER, PM, VIEWER`. Permissions are per-workspace; price-book editing, template editing, approval limits, and export are separately gated. All permission changes are audit-logged.

---

## 8. FOLLOW-UP ENGINE

### 8.1 Rule
A lead in an active state always has a next follow-up date. Closing/advancing a task auto-prompts the next one. "No next step" is a system error state, surfaced daily — not a user preference.

### 8.2 Default cadences (workspace-editable per stage)
- **NEW, no contact yet:** Day 0, Day 1, Day 3, Day 7 — then reactivation pool.
- **QUALIFYING, waiting on customer info:** Day 2, Day 5.
- **PROPOSAL SENT:** Day 2 (check-in), Day 5 (value recap), Day 10 (direct ask), Day 21 (breakup + future check-in date).
- **NO_RESPONSE terminal:** enters reactivation pool with a 60/90-day touch option; never deleted.

### 8.3 How follow-ups work
Task created → owner notified (in-app + email digest; SMS in Phase 2) → AI drafts the message in the workspace's voice from the lead's history (channel: email first) → **owner taps send** (L1/L2) → outcome logged (replied / no reply / bad contact) → next step auto-scheduled or stage advanced. Calendar sync (Google/Microsoft) shows follow-ups alongside site visits. Overdue follow-ups escalate: owner Day +1, manager Day +3, morning brief until cleared.

### 8.4 Reactivation campaigns (Phase 2)
One-tap campaign to a filtered stale pool (e.g., "Lost on price, 6+ months ago") with approval-gated batch drafts, per-lead personalization from history, and hard opt-out/suppression handling. Reactivation revenue is reported separately — it is the easiest ROI story in renewal conversations.

---

## 9. GENERATIVE PROPOSALS

### 9.1 Inputs the system learns from
On onboarding, the workspace uploads 5–20 past proposals (won + lost). The system extracts: structure, scope phrasing, terms, exclusions, warranty language, and pricing patterns. The workspace approves the extracted Template Library before any generation. **No template goes live unreviewed.**

### 9.2 Building blocks (all workspace-owned)
- **Template Library:** per service line — sections, order, boilerplate.
- **Scope Library:** reusable scope paragraphs, editable, versioned.
- **Price Book:** services/items, unit, standard price, floor price, cost/margin band (margin visible only to approver roles). Prices in proposals come *only* from here unless an override with reason is logged.
- **Terms Library:** payment terms, validity window (default 14 days), exclusions, warranty.

### 9.3 Generation flow
Lead data + scope notes (+ photos/site notes from PM) → Agent 5 assembles draft: tailored intro referencing the customer's stated problem, scope from library + lead specifics, line items from Price Book, timeline, terms, e-sign block → internal checks (margin band, missing exclusions, win-probability band vs won history) → Approval Inbox (§6.4) → on approval: PDF rendered on workspace letterhead + send via connected email with tracked open/view events → follow-up cadence (§8.2) starts automatically.

### 9.4 Win/Loss capture
- **Won:** signature/payment signal or manual mark → Project created, PM confirmed, onboarding task list generated, proposal + actuals feed the learning set — **and the Project Handoff Package is published to the customer's own platform via the Handoff API (§14.5). LeadFlow's job ends at Won; delivery lives in their system, not ours.**
- **Lost:** reason code required: `PRICE, TIMING, COMPETITOR, NO_DECISION, UNRESPONSIVE, NOT_A_FIT, OTHER` + optional competitor name. Lost-reason data powers §10 insights and §11 Demand Gap. A lost proposal is data, not a dead end — **and the final outcome is delivered to the customer's own platform via §14.5, same as Won.**
- **All other finals — No Response / N/A–Unserviceable / Junk / Duplicate:** Every terminal outcome is a deliverable, not a silent archive. Each fires a Final Outcome Delivery (§14.5) with its outcome code + reason, so the customer's CRM/ERP/project system closes the loop on their side too: no duplicate outreach, clean source ROI, suppression lists stay in sync.

### 9.5 Integrations
Native PDF + e-signature in MVP (embedded signing flow or DocuSign/PandaDoc connector — choose one at build gate, §24); proposal view tracking via signed links; QuickBooks/Xero invoice creation on Won is Phase 2.

---

## 10. KPI SYSTEM, INSIGHTS & ANALYSIS

### 10.1 Dashboard tiers
**A. Executive (owner, weekly + at-a-glance):**
Pipeline value (by stage), Win Rate, Avg Ticket, Revenue Won (period), FPAR + Approval Cycle Time, Backlog Remaining + Projected Clear Date, Lead Source ROI table, Demand Gap top 3 (§11).

**B. Operations (coordinator/managers, daily):**
Leads by state + aging buckets (0–1d, 2–3d, 4–7d, 7d+), First-Response Time (median, by owner), % Leads With No Next Step, Overdue Follow-Ups, Approval Queue depth + oldest pending, Proposal Aging (sent, no decision, by day band), PM Workload + Field/PM Compliance %, Follow-Up Compliance by person.

**C. Funnel (analysis page, any period, drillable):**
Lead → Qualified %, Qualified → Proposal %, Proposal → Won %, overall Lead → Won % — each sliceable by source, service line, lead owner, PM, and value band. Every % clicks to the underlying records.

### 10.2 KPI definitions (locked — same definition in app, exports, and briefs)
First-Response Time = first logged customer contact − lead created (business hours variant shown alongside). FPAR per §6.1. Win Rate = Won ÷ (Won + Lost), No-Response excluded and shown separately. Backlog Clear Date = remaining ÷ trailing 14-day daily clear rate. Definitions live in a single metrics service in code (§16) — no KPI is computed twice in two places.

### 10.3 Insight Agent (not charts — findings)
Weekly + on-demand, each insight = finding + evidence (drillable) + recommended action:
- "Proposals sent >48h after approval win 22 pts less. 11 proposals breached this week — approval speed, not price, is the leak."
- "Angi leads: 212 in, 9% qualified, $310 avg margin-adjusted return vs website leads at 34% / $1,940. Recommend pausing Angi spend for 30 days."
- "PM workload: 2 PMs at 140% of capacity cap; their projects' proposal cycle is 2.1× the workspace median."
Insight rules start as deterministic queries over the metrics service; the LLM only phrases them and ranks by estimated revenue impact. An insight with no action is not shipped.

### 10.4 Morning Brief (daily, 6 AM workspace time, owner + ops)
While-you-were-away changes, ranked work plan for the day, approvals waiting (with one-tap links), stuck items, yesterday's wins/losses, backlog pace. Delivered in-app + email. This is the retention habit loop; it must be accurate above all — a brief that is wrong twice gets muted forever.

### 10.5 Reporting & export
One-page Weekly Status Report (auto-composed numbers + insights, human adds decisions/next steps) — PDF/email to owner. Scheduled exports, full data export, and a read-only reporting API are Pro tier (§18).

---

## 11. DEMAND GAP ENGINE — SERVICES YOU'RE MISSING

### 11.1 Purpose
Turn lost/unserviceable demand into the owner's growth roadmap. This is the feature no CRM offers and the strongest expansion/retention lever in the product.

### 11.2 How it works
1. **Collect:** Every lead marked UNSERVICEABLE or LOST–NOT_A_FIT, every inquiry email/form asking for something outside the Service Catalog, and every Qualification note mentioning an unlisted service, enters the Demand Pool with its raw text preserved.
2. **Cluster:** Embedding + clustering groups the pool into candidate services (e.g., "mold remediation," "24/7 emergency water extraction," "septic inspection") with human-readable labels. A human (ops/admin) can merge/split/rename clusters in a review UI — clusters are never presented to the owner unreviewed if confidence is low.
3. **Size:** For each candidate: lead count (30/90/365d), trend, % repeat askers, geographic concentration, and estimated revenue = count × workspace avg ticket for the nearest existing service (labeled an estimate, with the basis shown — never a fabricated market price).
4. **Score — Opportunity Score (0–100):** demand volume (30) + trend (15) + estimated ticket (20) + adjacency to current crew/equipment/services (20, workspace-set) + margin signal from nearest service (15).
5. **Recommend:** Each candidate gets one of three paths with a starter playbook: **Launch** (add to catalog + price book draft + reactivation list of everyone who asked), **Partner** (referral partner + referral-fee tracking), or **Ignore** (low fit — keep logging, revisit quarterly).

### 11.3 Outputs
- Demand Gap page: ranked candidate services with evidence (the actual leads behind each count, drillable).
- Quarterly Opportunity Report for the owner.
- On Launch: one-click conversion of the candidate into a Service Catalog entry + automatic reactivation campaign (§8.4) to the historical askers — the launch announces itself to proven demand.

### 11.4 Adjacent mining (same engine)
- **Cross-sell gaps:** Won customers whose service history + property/job profile matches a service they never bought.
- **Dead-source detection:** Sources with volume but near-zero qualification for 90 days → spend-cut recommendation (§10.3).

### 11.5 Honesty rules
Estimates are labeled, bases are shown, sample sizes are shown. A candidate built on 4 leads says "4 leads — thin signal." The engine recommends; the owner decides. This module's credibility is the product's credibility.

---

## 12. AI AGENT ARCHITECTURE

### 12.1 Agents (small, specialized, auditable — no single mega-agent)
| # | Agent | Job | Output (structured) | Autonomy |
|---|---|---|---|---|
| 1 | Ingestion Parser | Messy email/form/note → lead fields | JSON lead draft + field confidences | Auto-create; low-confidence fields flagged |
| 2 | Triage & Scoring | Classify service, urgency, value band, hot/warm/stale, spam likelihood | Scores + reasons (shown in UI) | Auto; junk only to queue, never deleted |
| 3 | Dedupe Assistant | Propose merges | Merge proposal + evidence | Human confirms ambiguous merges |
| 4 | Packet Checker | Pre-submission completeness + win-pattern check (§6.3) | Pass/flags + score | Advisory to submitter |
| 5 | Proposal Assembler | Draft proposal from template + price book + lead data | Proposal draft (versioned) | Draft only |
| 6 | Follow-Up Drafter | Next-touch message from history + cadence stage | Message draft | Human sends (L1/L2) |
| 7 | Insight Analyst | Rank findings from metrics service (§10.3) | Insight cards + brief text | Internal only |
| 8 | Demand Miner | Cluster + size unmet demand (§11) | Candidate services + scores | Internal; owner decides |

### 12.2 Engineering rules for all agents
- **Structured output only** (JSON schema validated; free text only inside designated draft fields). Schema failure → retry once → human task, never a silent bad write.
- **Every agent output stores:** model, prompt version, input hash, output, confidence, and the human decision that followed (accepted/edited/rejected). This dataset is the eval set and the moat.
- **Evals before ship:** Each agent has a golden set (50–200 real-pattern cases) run in CI; regression on accuracy/precision thresholds blocks deploy. Triage precision on JUNK matters most — a real lead junked is the costliest error class.
- **Cost discipline:** Cheap/small models for parse/classify; frontier models only for proposal assembly + insight phrasing. Per-workspace AI usage metered (plan limits, §18); per-lead AI cost displayed in admin (target: <$0.50 fully-worked lead at MVP volumes).
- **Grounding:** Proposal/pricing content comes only from Price Book + Template/Scope Libraries. The model's job is assembly and tailoring of approved language — if a needed price/scope is missing, it flags, it does not invent.

### 12.3 Human-in-the-loop by design
Approval Inbox, merge queue, cluster review, template approval — these are not friction to remove later; they are the trust mechanism that generates the labeled data that makes later automation safe.

### 12.4 Autonomy ladder (workspace setting, per workflow)
L1 Draft-Only (default) → L2 Bulk-Approve Trusted → L3 Scoped Auto-Approval (Phase 3, §6.6). Downgrading autonomy is instant and retroactive to pending items. Autonomy changes are owner-only + audit-logged.

---

## 13. DATA MODEL (core entities — Postgres, all tenant-scoped by `workspace_id`)

| Entity | Key fields |
|---|---|
| `workspaces` | id, name, vertical, timezone, business_hours, autonomy_level, plan, created_at |
| `users` | id, workspace_id, name, email, role, approval_limit, active |
| `contacts` | id, workspace_id, name, phone_e164, email, address, is_customer, merged_into_id |
| `companies` | id, workspace_id, name, address, notes (B2B leads) |
| `sources` | id, workspace_id, type (api/form/email/csv/marketplace/manual), name, api_key_id, utm defaults |
| `leads` | id, workspace_id, contact_id, company_id, source_id, external_id, dedupe_key, service_requested, service_catalog_id (nullable → Demand Pool), state, urgency, value_band, est_value, owner_id, pm_id, approver_id, next_action, next_action_due_at, sla_due_at, first_response_at, qualified_at, lost_reason, hold_reason/resume_at, raw_payload_ref, created_at, updated_at |
| `lead_events` | id, lead_id, actor (user/agent/system), type, from_state, to_state, payload, created_at — immutable |
| `activities` | id, lead_id, user_id, type (call/email/note/meeting/site_visit), body, outcome, created_at |
| `tasks` | id, workspace_id, lead_id, assignee_id, type (follow_up/info_chase/compliance), due_at, status, completed_at, draft_ref |
| `approvals` | id, lead_id, proposal_id, submitted_by, approver_id, tier, decision (approved/changes/rejected), reason_code, edits_diff, submitted_at, decided_at |
| `services` | id, workspace_id, name, active, is_catalog (false = Demand candidate), opportunity_score |
| `price_book_items` | id, workspace_id, service_id, name, unit, standard_price, floor_price, cost_band |
| `templates` | id, workspace_id, service_id, kind (proposal/email), body, version, approved_by, active |
| `proposals` | id, lead_id, template_id, version, status, line_items (jsonb), total, margin_band, win_prob_band, pdf_ref, sent_at, viewed_at, signed_at, outcome, lost_reason, competitor |
| `projects` | id, lead_id, proposal_id, pm_id, status, starts_at, handoff_status (pending/delivered/acknowledged/failed), external_project_id, external_system, handoff_delivered_at, handoff_acked_at — created on Won, delivered via §14.5 |
| `project_handoffs` | id, project_id, workspace_id, channel (api_pull/webhook_push/connector), destination_ref, payload_hash, attempts, last_status, last_error, delivered_at, acknowledged_at |
| `outcome_deliveries` | id, lead_id, workspace_id, outcome (won/lost/no_response/na_unserviceable/junk/duplicate), channel, destination_ref, payload_hash, attempts, last_status, last_error, delivered_at, acknowledged_at — one row per final-outcome delivery attempt (§14.5) |
| `integrations` | id, workspace_id, provider, status, oauth_ref (vault), last_sync_at, error |
| `api_keys` | id, workspace_id, label, hashed_key, scopes, last_used_at, revoked_at |
| `imports` | id, workspace_id, file_ref, mapping (jsonb), totals, dedupe_report, status |
| `insights` | id, workspace_id, kind, finding, evidence_ref, action, est_impact, period, created_at, dismissed_at |
| `demand_candidates` | id, workspace_id, label, cluster_ref, counts, est_revenue, score, path (launch/partner/ignore), status |
| `agent_runs` | id, workspace_id, agent, lead_id/proposal_id, model, prompt_version, input_hash, output (jsonb), confidence, human_decision, cost, created_at |
| `audit_log` | id, workspace_id, user_id, action, entity, entity_id, diff, created_at — immutable, exportable |

Indexes: `(workspace_id, state, next_action_due_at)`, `(workspace_id, dedupe_key)`, `(workspace_id, source_id, created_at)`, full-text on lead notes/activities. Row-level security by workspace in the app layer + DB policies as backstop.

---

## 14. PUBLIC API SPECIFICATION (v1)

Base: `https://api.leadflow.example/v1` — final domain TBD at naming. Auth: Bearer API key (workspace-scoped, scopes: `leads:write, leads:read, proposals:read`). All writes accept `Idempotency-Key`. Rate limit: 600 req/min per key (burst 60). Errors: standard envelope `{error:{code,message,details}}`, HTTP codes conventional.

### 14.1 Create lead (the website/integration endpoint)
```
POST /v1/leads
{
  "external_id": "form-88412",            // sender's id, dedupe aid
  "source": "website-form",
  "contact": {"name":"Jane Alvarez","phone":"+15165550134","email":"jane@example.com"},
  "company": {"name":""}, "service_requested": "Water damage cleanup",
  "location": {"address":"...", "zip":"11706"},
  "urgency": "this_week", "message": "Basement flooded yesterday...",
  "utm": {"source":"google","medium":"cpc","campaign":"q4"},
  "consent": {"contact_ok": true}
}
→ 201 {"id":"lead_...","state":"NEW","duplicate":false,"owner":"..."}
→ 200 with "duplicate":true + existing id when dedupe_key matches (never a second record)
```

### 14.2 Other endpoints (MVP)
- `GET /v1/leads?state=&since=&owner=` (cursor pagination), `GET /v1/leads/{id}`
- `PATCH /v1/leads/{id}` (state transitions validated; invalid transition → 422 with allowed transitions)
- `POST /v1/leads/{id}/activities`, `POST /v1/leads/{id}/notes`
- `GET /v1/proposals/{id}`, `GET /v1/metrics/summary?period=` (Pro)
- `POST /v1/imports` (CSV: returns mapping preview → `POST /v1/imports/{id}/commit`)
- **Final outcomes (§14.5):** `GET /v1/outcomes`, `GET /v1/projects/{id}`, `GET /v1/leads/{id}/outcome`, `POST /v1/outcomes/{delivery_id}/ack`, `POST /v1/projects/{id}/status`

### 14.3 Outbound webhooks (signed, HMAC-SHA256, retry 5× exponential)
`lead.created, lead.state_changed, lead.assigned, proposal.sent, proposal.viewed, proposal.signed, proposal.won, proposal.lost, lead.finalized, project.created, lead.no_response, lead.na_unserviceable, approval.requested, approval.decided`. Each event: id, type, workspace, data snapshot, timestamp. Delivery log + manual replay in admin. **Final-outcome events follow the §14.5 acknowledgement rules — they retry/escalate until the customer's system confirms receipt.**

### 14.4 Embed snippet
```html
<script src="https://cdn.leadflow.example/embed/v1.js" data-workspace="ws_..." data-form="main"></script>
```
Binds to an existing form (no rebuild) or renders a hosted form. Captures UTM + page URL automatically. Graceful fallback: if JS fails, form posts natively to the webhook endpoint — a lead is never lost to a script error.

### 14.5 Final Outcome Handoff API — Won, Lost, N/A & Every Terminal State (NEW — Nov 9 requirement)

**Principle: LeadFlow is the front door, not the house.** Leads are worked, approved, and proposed in LeadFlow. The moment a lead reaches a *final* outcome, a complete, structured record is delivered into the customer's own software — because a Won lead becomes a project they run on their platform, and Lost / N/A / No-Response records must close, suppress, and inform that same platform. Nothing terminal stays trapped in LeadFlow.

**Outcomes covered (all of them, no exceptions):**
`WON` · `LOST` (with reason + competitor) · `NO_RESPONSE` · `NA_UNSERVICEABLE` (not-a-fit / service not offered / out of area — feeds their records + our Demand Gap) · `JUNK` · `DUPLICATE` (with pointer to the surviving lead/external ID)

**Three delivery modes — customer picks per destination:**
1. **Pull API (we provide, they ingest):** Their system polls or fetches on demand.
   - `GET /v1/outcomes?since={cursor}&outcome=won,lost,na_unserviceable` — cursor-paginated final-outcome feed, exactly-once semantics via delivery IDs
   - `GET /v1/projects/{id}` — the full Won Project Package (below)
   - `GET /v1/leads/{id}/outcome` — single lead's final record
   - Scopes: new key scope `outcomes:read` (+ `projects:read`); sandbox keys + full developer docs + Postman/OpenAPI spec ship with MVP
2. **Push webhooks (we deliver, they receive):** Events `lead.finalized`, `project.created` (Won), `lead.lost`, `lead.no_response`, `lead.na_unserviceable` — signed HMAC, retry 5× exponential with delivery log + manual replay (§14.3 infrastructure). A delivery is not "done" until their endpoint returns 2xx or they pull-acknowledge it.
3. **Native connectors (Phase 2, same payload):** ServiceTitan, Jobber, HubSpot, Salesforce, Zoho, Monday, QuickBooks (invoice shell on Won), generic REST/SFTP + Zapier/Make for everything else. Field mapping is per-workspace, configured in Settings → Handoff, with a mapping test + sample payload preview before go-live.

**Won Project Package payload (the contract — versioned as `project.v1`):**
```json
{
  "delivery_id": "dlv_...", "outcome": "won", "finalized_at": "...",
  "lead": {"id":"lead_...","external_id":"...","source":"...","utm":{}},
  "contact": {"name":"...","phone":"+1...","email":"...","address":"..."},
  "company": {"name":"..."},
  "service": {"requested":"...","catalog_id":"...","location":"..."},
  "proposal": {"id":"...","version":2,"total":18400,"currency":"USD",
               "line_items":[{"item":"...","qty":1,"unit_price":0}],
               "pdf_url":"https://…signed, 30-day…","signed_at":"..."},
  "people": {"lead_owner":{"name":"...","email":"..."},
             "project_manager":{"name":"...","email":"..."},
             "approver":{"name":"..."}},
  "schedule": {"proposed_start":"...","notes":"..."},
  "documents": [{"name":"site-photos.zip","url":"https://…signed…"}],
  "notes": "Full scope + qualification notes, activity summary",
  "custom_fields": {}
}
```
Lost / N/A / No-Response payloads use the same envelope, swapping `proposal/project` for: `outcome_reason_code`, `outcome_reason_detail`, `competitor` (if any), `last_contact_at`, `follow_up_history_summary`, and `suppress_future_outreach` (true for Junk/Unserviceable, per workspace rule) — so their platform can close the opportunity, stop campaigns to that contact, and report true source ROI.

**Acknowledgement & status-back (closes the loop both ways):**
- `POST /v1/outcomes/{delivery_id}/ack {"external_id":"their-project-or-record-id","status":"ingested"}` — stores their ID on our record; Lead Detail then shows "In their system as #12345" with a deep link if their system supports it.
- `POST /v1/projects/{id}/status {"status":"scheduled|in_progress|completed|on_hold","external_id":"..."}` — optional callback so LeadFlow's dashboards can show delivery progress without owning delivery. Status-back never mutates the lead's final outcome.
- Unacknowledged deliveries escalate: retry → admin alert at 24h → listed in the Morning Brief as "3 finals not yet picked up by your system." A Won lead that never lands in their platform is a sev-level workflow failure, surfaced — never silent.

**Developer experience (Silicon Valley standard):** OpenAPI 3 spec + interactive docs, sandbox workspace with sample Won/Lost/N/A payloads, test-delivery button per destination, delivery log with payload viewer + one-click replay, schema versioning (`*.v1`, additive-only changes within a version), and a status page for the API. Their developer — or their ops person with Zapier — must be able to complete an integration in under a day; that is the acceptance test for this section.

---

## 15. UX — SCREEN-BY-SCREEN (MVP = screens 1–9)

1. **Onboarding Wizard (target <30 min to audit):** Business basics → Connect inbox → Upload backlog/past proposals → Invite approvers → Backlog Audit reveal.
2. **Backlog Audit (the aha screen):** totals, dedupe result, hot/warm/stale buckets with reasons, est. pipeline, projected clear date, bucket plan approval.
3. **Board:** Leads by state (kanban + list toggle), owner/PM avatars, aging + SLA color, value totals per column. Filters: source, service, owner, PM, mine.
4. **Lead Detail:** 3-line AI summary on top; contact + history timeline; ownership block (owner/PM/approver + change with note); completeness checklist; activities; tasks; proposals tab; agent activity (what AI did + confidence).
5. **Approval Inbox:** §6.4 — the owner's hero screen, phone-first.
6. **My Queue / Tasks:** Today / overdue / upcoming; follow-up drafts inline with send.
7. **Proposals:** list by status + aging; builder view (template sections, price-book picker, margin + win-band checks, version diff).
8. **Dashboards:** Executive / Operations / Funnel (§10.1) + Weekly Status Report generator.
9. **Morning Brief:** daily digest screen + approval deep-links.
10. **Demand Gap (Phase 2 UI, data collected from Day 1):** §11.3.
11. **Settings:** Services & Price Book, Templates, Assignment + Approval Rules, Cadences, Integrations & API Keys, **Handoff / Developer (outcome destinations, field mapping, test delivery, delivery log + replay, sandbox keys — §14.5)**, Team & Permissions, Billing, Audit Log, Export.
12. **Handoff Monitor:** Every final-outcome delivery (Won/Lost/N/A/etc.) with status — delivered / acknowledged (with their external ID + deep link) / failed / pending >24h — filterable by outcome and destination. This screen is the proof that nothing terminal got lost between the two systems.

Design system: single component library, dark-on-light data-dense ops theme + high-contrast owner mobile views; every list virtualized; optimistic UI only where reversal is safe (never on approvals/sends).

---

## 16. TECH STACK & INFRASTRUCTURE

- **Frontend:** Next.js / React + TypeScript, Tailwind, component system per §15. Mobile web (responsive, installable PWA for Approval Inbox) before any native app.
- **Backend:** Node.js + TypeScript (NestJS or Express with strict layering), REST API (§14) + internal service layer. Single **Metrics Service** computes every KPI once (§10.2).
- **Data:** Postgres (primary, tenant-scoped), Redis + BullMQ (agent jobs, cadence scheduler, SLA scanner, webhook retries), S3-compatible storage (proposal PDFs, imports, attachments), pgvector (Demand clustering) — add Meilisearch only when lead search latency proves it.
- **AI layer:** Provider-abstracted (Claude primary for assembly/insights; smaller models for parse/classify). All calls through one gateway enforcing schemas, logging (§13 `agent_runs`), budgets, and fallbacks. No provider SDK calls scattered in feature code.
- **Email/calendar:** Gmail + Microsoft Graph OAuth; sending via the user's connected mailbox where possible (deliverability + trust), else Resend/SES with workspace domain authentication (SPF/DKIM guided setup).
- **Infra:** Containerized deploy (DigitalOcean/AWS — decide at build gate; MVP fine on a managed Postgres + 2 app instances), IaC from day 1, staging mirrors prod shape, nightly encrypted backups (age-encrypted, tested restores), uptime + error monitoring (Sentry-class), structured logs with workspace/lead trace IDs.
- **Quality gates:** TypeScript strict, migration tests against legacy-shaped DBs, agent eval suites in CI (§12.2), smoke test of the built frontend bundle (logged-in + logged-out renders) before every deploy — a green build is not a working app.
- **Performance targets:** Board/list p95 < 400ms at 10k leads/workspace; API p95 < 300ms non-AI; AI triage < 10s async (never blocks lead creation).

## 17. SECURITY, PRIVACY & COMPLIANCE ROADMAP

- Tenant isolation enforced in queries + RLS backstop; cross-workspace access is a sev-1 bug class with an automated test suite.
- Encryption in transit + at rest; OAuth tokens/API secrets in a vault/KMS, never in app DB plaintext; API keys stored hashed.
- RBAC (§7.4), full audit log (§13), session security (httpOnly cookies, MFA for owner/admin at GA).
- PII: lead contact data is the customer's data — DPA available at GA, sub-processor list published, deletion/export on request, data residency US at launch.
- SOC 2 Type I: start control mapping at first enterprise-adjacent prospect; Type II in Year 2. Do not claim certifications not held — in any copy, ever.
- AI data handling: customer data used to run their workspace only; cross-workspace learning uses aggregated, de-identified patterns (win bands, reject patterns) with opt-out. No training on customer proposals without written consent.

---

## 18. PRICING & PACKAGING

| | Starter $299/mo | Growth $599/mo | Pro $999/mo |
|---|---|---|---|
| Workspaces / seats | 1 / 5 | 1 / 15 | 3 / 30 |
| Leads / mo | 500 | 2,000 | Unlimited (fair use) |
| Ingestion | API, form, CSV, 1 inbox | + Zapier, marketplace feeds | + Multi-inbox, custom sources |
| Approval workflow | Single approver | Tiered routing + bulk | + Delegation, L3-ready |
| Generative proposals | 1 template set | Unlimited templates | + A/B template analytics |
| AI usage included | 1,000 agent actions | 5,000 | 20,000 (overage priced) |
| KPI / insights | Core dashboard | + Weekly Insight Agent | + Reporting API, Demand Gap full |
| Support | Email, 1 business day | Priority | Named contact |

- **Backlog Clear onboarding: $750–$1,500 one-time** (waivable on annual Growth/Pro): covers bulk import, dedupe, bucket plan, price-book + template extraction. It filters for serious buyers and funds onboarding labor.
- Annual = 2 months free. No discounting below list in MVP — compete on recovered revenue, show the math in-app ("Proposals sent this month: $X").
- Pricing principle: charge on workflow + outcomes capacity, not per-seat punishment for adding the PMs the product requires.

## 19. GO-TO-MARKET

1. **Design Partner #1 (Weeks 1–6):** One real owner-operated service business, backlog imported, founder runs onboarding personally. Success bar: backlog audit delivered, approval cycle measured before/after, first 20 proposals through the system. Written permission required before any case-study use — no exceptions.
2. **Free Backlog Audit tool (public, self-serve):** Upload a CSV / connect inbox read-only → instant audit report (counts, dupes, stale %, est. pipeline) with the full product as the fix. This is the top of funnel, mirroring the proven free-audit pattern.
3. **Local density first:** One metro, one vertical (e.g., Long Island field-service). Owner associations, trade groups, supplier referrals. 20 customers in one trade community beat 200 scattered signups for referrals + template data.
4. **Content wedge:** Short-form "backlog teardowns" (anonymized): "1,042 leads, 317 dupes, $214k in un-followed proposals — here's the clear plan." Revenue-recovery stories, not AI hype.
5. **Partner channel (Phase 2):** Website agencies + bookkeepers/ops consultants who serve service SMBs — they see the backlog pain first; referral rev-share 20% Year 1.
6. **Sales motion:** Founder-led calls until 10 paying; every call demos with the prospect's own audit, never a generic deck.

---

## 20. 90-DAY BUILD ROADMAP & SPRINT PLAN

### Phase 0 — Foundations (Weeks 1–2)
Auth + workspaces + RBAC, Postgres schema (§13), audit log, API skeleton + keys, design system, CI with agent-eval harness, staging/prod infra. **Exit:** a lead can be created via API and seen on an empty Board.

### Phase 1 — MVP Wedge (Weeks 3–6)
Ingestion (API, embed form, CSV wizard, Gmail), dedupe, triage agent, Board + Lead Detail, ownership/assignment, Completeness Gate, Approval Inbox (single + tiered), tasks + follow-up cadences (manual send), Morning Brief v1. **Exit:** Design Partner #1's real backlog is imported, bucketed, and being worked daily in the product.

### Phase 2 — Proposals + KPIs (Weeks 7–10)
Template/Price Book extraction + builder, Proposal Assembler, PDF + e-sign (one provider, §24), view tracking, Won→Project flow, **Final Outcome Handoff API (§14.5: pull API + push webhooks + ack/status-back + Handoff Monitor; native connectors in Phase 3)**, Executive/Operations/Funnel dashboards, Insight Agent v1 (deterministic findings), Weekly Status Report. **Exit:** ≥20 real proposals generated, approved, sent, and outcome-tracked — with every final (Won/Lost/N/A) verifiably delivered + acknowledged in the partner's own system; FPAR + approval cycle time measured and reported to the partner.

### Phase 3 — Moat (Weeks 11–13 + ongoing)
Demand Gap page (data already collected) + Opportunity Report, reactivation campaigns, Outlook inbox, Tier-2 integrations (Zapier first), L2 bulk-approve trusted templates, public Free Backlog Audit tool. **Exit:** First Demand Gap report delivered to a paying workspace; audit tool live as GTM engine.

### Team shape (founder-led MVP)
1 founder/full-stack (product + backend + AI), 1 frontend-leaning engineer (or founder covers + contractor for design polish), part-time designer for the §3.5 bar. Do not hire sales before 10 paying workspaces; do not hire a data scientist before Demand Gap has real pools to mine.

## 21. METRICS, NORTH STAR & INSTRUMENTATION

- **North Star:** Proposals Approved & Sent / workspace / week.
- **Activation:** Workspace delivers its Backlog Audit + works ≥25 leads in first 7 days.
- **Product proof metrics (per workspace, vs their baseline):** FPAR (target ≥90%), Approval Cycle Time (target median <4 business hrs), First-Response Time, Backlog Clear Date movement, Proposal Win Rate delta, Reactivation Revenue.
- **Business metrics:** MRR, net revenue retention (expansion = seats/sources/AI usage), logo churn (target <3%/mo SMB), CAC payback (<6 months at $599 ARPA with audit-led GTM), AI cost per workspace (<8% of revenue).
- **Instrumentation rule:** Every state transition, approval, agent run, and KPI view is an event from Day 1. If it isn't measured, it doesn't get a slide and doesn't get a roadmap slot.

## 22. RISKS, MOATS & DEFENSIBILITY

| Risk | Mitigation |
|---|---|
| Owners don't trust AI with proposals | Approval-gated everything; price only from their book; audit trail; L1 default |
| CRM incumbents copy the workflow | Speed + vertical depth + the dataset below |
| Messy real-world data breaks triage | Human merge/junk queues; precision-first thresholds; evals on real patterns |
| Inbox/email deliverability + OAuth revocation | Send via customer mailbox; graceful re-auth flows; queue + alert, never silent drop |
| SMB churn / seasonality | Annual plans tied to recovered-revenue reporting; reactivation + Demand Gap create off-season value |
| Support burden from non-technical users | Onboarding fee funds white-glove setup; product must self-explain (§3) |

**Moat (compounding, in order):** (1) Per-workspace labeled dataset — every approval/edit/reject trains that workspace's gates; switching costs are real because their templates, price book, and approval patterns live here. (2) Vertical template + price-pattern library (aggregated, de-identified, opt-out) — the 50th environmental company onboards in an hour because the 49 before it taught the system the trade. (3) Demand dataset — cross-workspace (de-identified) view of unmet services by geography is a data asset no single CRM customer can replicate.

## 23. FUNDRAISING NARRATIVE (for when it's needed — product first)

- **Story:** "Every service business is sitting on a backlog of demand it already paid to generate. We recover it, run the approval workflow the owner was the bottleneck in, and then tell them what business to add next — from their own lost leads."
- **Proof sequence:** Design-partner before/after (approval time, FPAR, proposals sent, won revenue from backlog) → 10 paying in one vertical/metro → audit-tool funnel economics → raise on density + NRR, not on signups.
- **Use of funds shape:** Engineering (integrations breadth), onboarding/CS for the wedge, Demand Gap data depth. Not paid acquisition until audit funnel CAC is proven.
- All market-size and proof numbers in external materials must be sourced/measured at the time of writing (§2.3). No projected customer results are presented as actuals.

## 24. OPEN DECISIONS & BUILD GATES

1. **Name + domain clearance** (trademark + .com/.io) — gate before any public artifact.
2. **E-signature:** Native-lite vs DocuSign vs PandaDoc for MVP — decide on partner's existing tool.
3. **Cloud:** DigitalOcean (founder familiarity, cost) vs AWS (enterprise perception) — decide Phase 0; either is acceptable if IaC + backups are real.
4. **Design Partner terms:** Free/discounted pilot in exchange for measured results + feedback cadence; case-study use only with written permission.
5. **First vertical lock:** Environmental/field-service assumed in this spec — confirm before template/price-book extraction work begins.
6. **AI provider + budget caps per plan** — finalize after eval results on Triage + Proposal Assembler golden sets.

---

## 25. DESIGN-PARTNER REQUIREMENTS — GREGORY COLLINS / G.C. ENVIRONMENTAL (added Nov 9, from GREGORY-REVIEW.md)

Full analysis: `GREGORY-REVIEW.md` in this folder. Summary of binding additions — a pilot for an owner-operator of Gregory's profile is not complete without the P0 items:

- **P0-1 Field Reports & Time Sheets (chase module):** `field_reports` + `timesheets` entities — due rules per manager, submission inbox, missing/late flags, reminder drafts (human sends), compliance % by manager in §10 KPIs + Weekly Status Report, escalation after 2 missed chases. Submission/completeness tracking only — no payroll processing.
- **P0-2 Full Inbox Triage:** §4 inbox ingestion expands from lead-only to categories: Lead / Proposal / Field / Client–Active Job / Vendor / Finance / Admin — each with owner + next action under the same no-orphan rule as leads.
- **P0-3 Scheduling & Site Visits:** Site Visit step between Qualification and Proposal — calendar-synced, assigned, outcome + photos/notes feed the proposal packet; "visit completed" is a Completeness Gate field for services that require it.
- **P0-4 No-Code Handoff Destinations:** §14.5 gains equal-status MVP destinations: email Handoff Packet (PDF + CSV), Google Sheet/Excel sync, scheduled CSV export, Zapier/Make. Onboarding includes a Week-1 discovery task: name the customer's actual project/job system before configuring any handoff — never assume an API exists on their side.
- **P0-5 Documents & Paperwork Tracking:** Per lead/project required-doc checklist, missing-doc chase tasks, expiry alerts for certs/licenses. Tracking/chasing only.
- **Pitch/UX rules for this profile:** Weekly Status Report is a headline feature; owner UI shows ~6 plain buckets over the full state machine; proposals export as fully editable DOCX as well as PDF; 20-second call log on the lead record in MVP; pilot pricing = Backlog Clear fee + 90-day pilot with before/after numbers as the renewal gate.
- **P1:** Read-only invoice/PO aging in the Weekly Status Report; `OPS_ADMIN` RBAC role (timesheets/documents/handoffs, no pricing/approval rights).

---

## 26. PRODUCTION-COMPLETENESS ADDENDUM (v2.0 — from ENGINEERING-REVIEW.md, Nov 9)

Full review: `ENGINEERING-REVIEW.md` in this folder. The following are **binding requirements**; priority tags: **[PB]** = production blocker, **[G30]** = within 30 days of GA, **[SC]** = scale (50+ workspaces).

**A. Complete-the-business additions**
- **[PB] Unified Communications Center:** One thread per lead/contact across email + SMS + calls. SMS via A2P 10DLC with consent at capture, global instant opt-out, quiet hours. Call log in MVP; recording/AI summaries [G30] with per-state consent rules. All outbound templates versioned + workspace-approved.
- **[PB-light] Money bridge:** Stripe deposit/final payment link on the proposal view; payment status webhooks update Won + §14.5 payload (`payment_status`). Read-only invoice/PO aging sync [G30]. No invoicing/payroll build.
- **[PB] Change Orders:** Delta scope/price object linked to the Won project, reusing §6 approval + §9 e-sign, versioned against the original proposal.
- **[G30] Customer 360 + repeat/referral:** Single customer timeline across leads/proposals/projects/comms; post-completion review/referral flow triggered by status-back `completed`; simple recurring/maintenance plans with renewal follow-ups.
- **[G30] Customer portal (signed link, no login):** Proposal view/sign/pay, site-visit self-scheduling, document upload feeding §25 P0-5 checklists, job status from status-back.
- **[PB] Global search (Cmd-K), saved views, safe bulk actions** (assign/follow-up/export; audit-logged, reversible where destructive).
- **[G30] People/scale edges:** Employee-exit reassignment wizard; OOO/delegate for all roles; workspace business/holiday calendar pausing SLA clocks; `locations` dimension on leads/boards/dedupe (rollups [SC]).

**B. AI & integration trust layer**
- **[PB] Prompt-injection invariant:** All ingested content (emails, forms, uploads) is data, never instructions. Price changes, approval transitions, and sends are code-gated and cannot be triggered by agent output alone. Red-team injection suite in CI.
- **[PB] Online AI quality:** 2–5% human sampling queue per agent; acceptance/edit/reject dashboards per prompt/model version; drift alerts; trace replay + "why did the AI say this?" with cited evidence in Lead Detail; model changes require full golden + injection suites + 1-week shadow mode; per-agent cost/latency budgets enforced with graceful degradation.
- **[PB] PII hardening:** Redaction in logs/traces/analytics; bulk PII export requires admin + is logged; per-workspace retention settings; operable customer-data deletion workflow; AI sub-processors named in the DPA.
- **[PB] Outbox everywhere:** Every external effect (inbox sync, webhooks, handoffs, payments, calendar) via durable outbox — idempotency keys, backoff+jitter, DLQ with operator replay, circuit breakers. UI statuses always distinguish queued/delivered/acknowledged/failed; a bare "sent" over an unverified send is a sev-class bug.
- **[G30] Import hardening:** Chunked, resumable bulk imports with progress, per-row error file, and 24h one-click rollback.

**C. Platform, release & operations**
- **[PB] SLOs/observability:** 99.9% core-workflow SLO, error budgets + burn alerts, per-tenant health, synthetic checks on the 5 critical journeys (API lead create, mobile approve, proposal generate, Won handoff delivery, morning brief), runbooks for the top 8 incidents before GA.
- **[PB] Release discipline:** Per-workspace feature flags; canary deploys; pre-push smoke test of the built bundle in logged-in + logged-out states; backward-compatible API changes within a version; DB migrations tested against legacy-shaped DBs with child rows (expand-migrate-contract).
- **[PB] Admin/support plane:** Internal console (workspace lookup, integration + DLQ health, agent cost/quality, audit search); consent-gated, audit-logged, auto-expiring support impersonation; public status page.
- **[PB] Billing completeness:** Trials, 80% soft-warn limits (approvals never blocked by a billing edge), dunning, proration, Stripe Tax, metering reconciliation job.
- **[G30] Field-ready UX:** WCAG 2.1 AA on owner flows; offline-queued approve/send with conflict handling for poor field connectivity; push notifications with email fallback, deep-linked to the exact card.
- **[PB] Legal checklist (tracked like features, with owner + evidence):** TCPA consent/records, CAN-SPAM, ESIGN/UETA signature evidence certificate per proposal, call-recording consent matrix, state privacy request workflow, published terms/DPA/privacy, cookie consent.

**Production Gate:** We move to production build when (1) every [PB] item has a spec home, data-model home, and a named test/eval suite; (2) the 5 critical journeys have SLOs + synthetics + runbooks; (3) the injection red-team suite passes in CI; (4) billing/consent/e-sign/deletion are operable by a non-engineer admin. Where §25 (Gregory/pilot) and §26 compete on scope, §25 wins for the pilot; [SC] items defer — in writing, here.
**Still explicitly out:** full accounting/payroll, dispatch/routing optimization, native mobile apps (PWA first), multi-language UI, autonomous customer-facing sending.

---
*End of Spec v2.0 — PRODUCTION-COMPLETE. Next step on founder's word: production build, starting Phase 0 (§20) with [PB] items folded into their phases.*

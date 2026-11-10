# WORKPILE — FULL SPEC v3.0 (Speed Rebuild)

**Date:** 2026-11-10. **IMPLEMENTED 2026-11-10 — Slices 28–36 shipped (server + client), 101/101 tests + smoke + build green; legacy migration verified on the 2,613-lead demo DB (states mapped, 2,001 WON backfilled to jobs); screenshots in screenshots-v10/. One render bug caught in QA and fixed (hooks below an early return in LeadDetail). Reaches the live pilot when the deploy one-liner is re-run (prod DB auto-migrates at server start).** **Status:** supersedes FULL-SPEC v2.0 workflow model (§§3–9, 13–14) where they conflict. Pricing, §14.5 handoff contract, §25 Gregory P0s, §26 invariants remain in force unless amended here.
**Trigger:** founder pilot verdict — "the lead flow is broken, it's just another dashboard." Verified against the code before writing a word of this spec (§0).

---

## 0. What v2 got wrong — verified, not vibes

1. **One-way ratchet flow.** `TRANSITIONS` allows almost no backward movement. WON / LOST / UNSERVICEABLE / DUPLICATE are terminal with zero exits; PROPOSAL_SENT cannot return to APPROVED; QUALIFIED cannot return to QUALIFYING. Real work moves backward constantly (customer reopens, scope was wrong, proposal needs rework). A tool that traps records is a tool people route around — in spreadsheets.
2. **Workers = seats.** `logTime()` requires the worker to be a row in `users` — a login account burning a paid seat. Real crews include day labor, temps, and subs who will never have logins. Every competitor time tool (Workyard, ClockShark, Connecteam) treats workers as a **roster** (name + phone), not accounts.
3. **Time logging is buried.** Exactly one entry point exists: a tab inside a lead record. Logging hours — the most frequent field action in the business — takes ~6 clicks and a record dive.
4. **Dashboard-first, work-second.** v2 surfaces are reporting surfaces (KPIs, charts) with work hidden underneath. Every category winner inverts this: the board/queue IS the product; metrics live on the work surface.
5. **The Completeness Gate is a wall, not a checklist.** It hard-blocks stage movement. Winners (Pipedrive, JobNimbus) use visible readiness + rotting flags and let the human decide.
6. **Won is a dead end.** Signing doesn't create the operational object (a job with crew, schedule, paperwork, invoicing). The sales pipeline and the work itself are different jobs; v2 has only the first.

## 1. Design laws (every v3 feature is tested against these)

1. **Two clicks to anything.** Any frequent action (move stage, log time, assign, nudge, snooze) is reachable in ≤2 clicks or one keyboard shortcut from wherever the record is visible.
2. **Nothing is a dead end.** Every state is reversible, every action undoable (toast Undo, 10s; audit log keeps the truth), every error recoverable in place.
3. **Type-to-create everywhere.** Workers, services, customers, price items: if it doesn't exist, typing its name creates it in the same field. No "go to Settings first."
4. **The queue is the home screen.** The product opens on *work to do*, worst-first — never on a chart.
5. **Warnings, not walls.** Missing data shows as an inline readiness checklist with one-click fixes. Only money/commit actions (send, sign, price below floor) keep hard checks.
6. **Metrics live on the work surface.** Aging on the board column, labor-vs-estimate on the job card, response-time on the queue item. A separate Reports view exists; it is not the product.
7. **Every record carries its next action + due time, always visible.** No next action = the record glows on the board until it has one.

## 2. What the winners do — competitive findings (researched 2026-11-10)

| Pattern | Who does it | v2 state | v3 answer |
|---|---|---|---|
| Drag-anywhere pipeline; stage is a label, not a prison; rotting-deal flags | Pipedrive, JobNimbus | One-way state machine | §4 free movement + aging |
| Activity-based selling: finishing an activity immediately prompts the next; log a call in 3 seconds | Pipedrive, Close | Next step exists but passive | §4.4 next-action loop |
| Follow-up-date-driven dashboard; stale-bid alerts; bid calendar | Followup CRM | Partial (cadences) | §6 queue + §9 timers |
| Won → JOB object with its own lifecycle (schedule → progress → invoice) | Jobber, ServiceTitan, Housecall Pro | Won is terminal | §3, §10 Job layer |
| Good/Better/Best proposal options, optional line items, client hub approve+sign+pay deposit in one flow | Housecall Pro, ServiceTitan, Jobber | Single-option proposals | §8 |
| Automated quote follow-ups; proposal open/view tracking | Jobber, AccuLynx, JobNimbus | Cadence exists, no view tracking | §8.3, §9 |
| Roster workers (name+phone, no login); foreman/kiosk crew clock-in; job + cost code at the punch; live labor-vs-budget | Workyard, ClockShark, Connecteam | Workers must be users | §5 |
| One-click assign, internal comments on the thread, who's-replying collision detection, snooze, Send & Archive, canned replies with variables, rules engine | Front, Missive | Inbox queue exists; no comments/collision/rules | §7 |
| Keyboard-first processing (100+ shortcuts), split inboxes | Superhuman, Missive | ⌘K + a few keys | §12 full keymap |
| Work-to-zero inbox: worst-first (never contacted → overdue → replied), business-hours-aware follow-up timers, 12-touch cadences, rehash campaigns for unsold estimates | Hatch, DigiAds Tracker | Cadences fixed-step, wall-clock | §6, §9 |
| Speed-to-lead: <60s automated first touch on every channel; missed-call text-back | Hatch, ServiceTitan Marketing Pro | Missed-call endpoint only | §9.2 |

**Positioning sharpened:** Workpile is not a CRM and not a dashboard. It is the **work queue for the whole lead-to-cash pile**: every lead, email, approval, proposal, and job in one worst-first queue, worked to zero daily, with the pipeline board and job board as views of the same records.

## 3. Core model v3 — Lead → Proposal → Job

One customer thread, three linked objects:

- **Lead** — the opportunity. Sales stages (§4). Owns contact, source, scope, next action.
- **Proposal** — versioned document(s) on the lead: options, line items, status (draft → out → viewed → signed / declined / expired). Multiple proposals per lead allowed; one is *current*.
- **Job** — created automatically the moment a proposal is signed (or a lead is marked Won). Has its OWN ops stages, independent of the lead: `SCHEDULED → IN_PROGRESS → FIELD_DONE → PAPERWORK → INVOICED → PAID → CLOSED` (+ `ON_HOLD` from any). Owns crew, schedule, time entries, field reports, documents checklist, change orders, invoice state. The lead closes as Won; the job is where the business actually runs.

Data: new `jobs` table (lead_id unique for the won conversion, own stage, scheduled dates, est vs actual rollup). `time_entries`, `job_schedule`, `field_reports`, `documents` re-point from lead_id to job_id (lead_id retained via job for history; migration in §14).

## 4. Flow v3 — free movement, soft guardrails

### 4.1 Sales stages (workspace-editable labels, canonical keys)
`NEW → WORKING → QUALIFIED → PROPOSAL → SENT → FOLLOWUP` + finals `WON / LOST / NO_RESPONSE` + exits `JUNK / DUPLICATE / UNSERVICEABLE` + `ON_HOLD` overlay (a flag with a reason + wake date, not a stage — a held lead keeps its stage).

### 4.2 Movement rules (the fix)
- **Any stage → any stage**, from board drag, record stage menu, list bulk bar, or keyboard. No server-side transition table for sales stages; server validates only: finals require a reason code (lost/no-response), WON requires (signed proposal) OR (explicit "mark won without proposal" + value).
- Every move writes an event (from, to, actor, optional note) — the audit trail replaces the ratchet as the control mechanism.
- **Undo:** toast with Undo for 10 seconds on every move; board drag is reversible by dragging back; finals can be reopened (`reopen` returns the lead to its pre-final stage, keeps the reason in history, cancels pending handoff or marks it superseded).
- Stage entry automations (workspace-configurable, defaults on): entering SENT starts the follow-up cadence; entering WON creates the Job + job-packet task; entering LOST prompts reason + offers a 90-day reactivation task.

### 4.3 Readiness checklist (replaces the Gate)
Each lead shows a readiness strip: contact ✓ · scope ✓ · site/location ✓ · owner ✓ · PM ✓ · proposal ✓. Moving to PROPOSAL/SENT with gaps shows the checklist inline with one-click fix fields (assign PM from a dropdown right there, add scope in a popover) — and a **"Move anyway"** that always works. Only two hard blocks remain in the whole product: sending a proposal with zero line items, and pricing a line below floor without an approver override (price integrity is money, §26 invariant stands).

### 4.4 Approval policy (replaces mandatory approval)
Workspace setting, three modes: **Off** (send freely), **By amount** (proposals over $X need approval — default $25,000), **Always**. Approval is a queue item (§6), decidable in one click from the queue, My Day, or the record — approve / request changes (with the checklist diff shown) / reject with reason. Below-threshold proposals never touch the inbox. First-pass approval rate stays measured for the workspaces that use approvals.

### 4.5 Next-action loop
Completing any activity (call log, email, note, visit) ends with one prompt: **"Next step?"** — pre-filled suggestion (AI strip logic from v2, kept), one tap to accept (date presets: tomorrow, 2d, next week, pick). A lead with no next action shows an amber dot everywhere it appears.

## 5. Workers & time v3 — roster, not seats

### 5.1 Worker roster
New `workers` table per workspace: `name` (required, free text), `phone` (optional), `labor_class_id` (optional), `linked_user_id` (optional), `active`. **Workers never count as seats and never need email or login.** Team members (users) automatically appear in the roster as linked workers. Manage in Settings → Workers (add in bulk by pasting names, one per line) — and inline everywhere (§5.2).

### 5.2 Log time — from anywhere, in ≤10 seconds
- Entry points: job header button, board card hover action, list row action, My Day "Log time" quick button, global **+** menu, keyboard **T** (with a record in context) / global quick-log with job picker.
- The form: **Worker** — typeahead over roster + users; *typing a new name offers "Add worker 'Mike T.'" as the first result* (creates a roster worker, optionally with class, in the same submit). **Date** defaults today (steppers for yesterday). **Hours** steppers (0.5 increments + type). **Note** optional. Job pre-filled from context. Recent workers (last 5 used) pinned on top.
- Submit returns you to exactly where you were, toast confirms "8h · Mike T. · School Phase II — $880 at govt PM rate" with Undo.
- Weekly grid: Workers × Jobs matrix for the office (fill a week of hours in one screen, totals + cost live) — this replaces per-record logging for office staff doing Friday entry.
- Rate resolution unchanged (class × job sector, snapshotted at log time); a worker with no class logs at $0 and is visibly flagged "no rate set — tap to set" (one-click class picker on the flag).

### 5.3 Crew & schedule
Crew picker on a job = roster + users (same type-to-create). Schedule board rows = roster workers (not only users); scheduling a roster worker needs no account — their day shows on the board; optional SMS to their phone when a number exists (test-mode honest until Twilio keys). Kiosk mode (shared tablet, PIN per worker, clocks a whole crew) is spec'd as Tier-2 (§16) — the roster model is what makes it possible later.

### 5.4 Timesheets
Timesheets are generated per **worker** (roster), not per user: expected weekly sheet for every active roster worker with a class or any hours; office logs on their behalf from the grid (§5.2); chase flow (v2, kept) targets the worker's linked user or the office, by name. Payroll CSV groups by worker name + class — identical output shape to v2 plus roster workers.

## 6. The Work Queue — home screen v3

One queue, worst-first, everything actionable in place. Replaces My Day as the default landing (My Day remains as the personal filter of the same queue).

**Item types:** untouched lead (age-weighted) · follow-up due/overdue · inbox email awaiting action · approval waiting · proposal viewed-not-signed · proposal going cold · job paperwork missing · field report missing · timesheet missing · handoff failed.
**Ordering:** overdue finals-risk first (SLA breaches), then oldest untouched money (value × age), then approvals, then inbox by age. Workspace-tunable weights later; v3 ships one good default order.
**Working it:** each card shows the *one primary action* (Call / Reply / Approve / Send proposal / Chase / Log time) + secondary menu. Keyboard: **J/K** move, **Enter** open, **E** done, **S** snooze (1d/1w/pick), **A** assign, **X** select for bulk. A "Work to zero" progress bar for the day. Filters: Mine / Team / type chips. This is the screen in every screenshot and demo from v3 on.

## 7. Inbox v3 — email backlog, worked like a queue

The v2 inbox queue stays; v3 adds the collaboration and automation layer the winners have:

- **Internal comments on any inbox item** (threaded, @mention notifies) — the team discusses the DEC email *on* the DEC email, not in a hallway.
- **Collision detection:** an item shows "Daniel is replying…" live; opening an item claims it visibly.
- **Send & Done** one button (reply + close + set lead next action in one motion).
- **Canned replies with variables** ({customer}, {job}, {date}, {sign_link}) — workspace library, per-category defaults from the v2 playbooks.
- **Rules engine** (workspace settings, plain builder): IF sender contains / subject contains / category is → THEN assign to · tag · convert to lead · snooze until · auto-reply with template (auto-reply limited to pre-approved templates, §26 invariant) · mark done. Example Gregory rule: "sender is a .gov or 'DEC' → tag REGULATORY, assign Shehreyar, due tomorrow."
- **Split views:** Needs reply / Waiting on them / Paperwork / Noise — counts on the tabs; noise (spam, FYI) bulk-clearable with one click + Undo.
- **Attach to record:** any inbox item links to a lead/job with one search-and-click; converting keeps the full thread on the record timeline.
- **Backlog import stays** (mbox/CSV/JSON, v2) but triage now lands items INTO the Work Queue (§6) with ages intact — import Monday morning, work to zero by Friday is a visible progress bar, not a hope.

## 8. Proposals v3

- **Options (Good / Better / Best):** a proposal can carry up to 3 named options, each its own line-item set + total; the customer picks one on the sign page; the picked option becomes the job value. Optional add-on lines the customer can toggle (priced, from the price book).
- **Clone & templates:** "New proposal from…" — clone any past proposal (same customer or similar job) with prices intact; per-service starter templates (e.g., Phase II standard scope) so a common proposal is 60 seconds, not 20 minutes.
- **Build speed:** line-item typeahead with recent items first; keyboard entry (Enter adds a line); totals + margin band live; below-floor lines flagged inline (approver override per §4.3).
- **View tracking:** the sign page records first-view + each view (timestamp); "Viewed 2h ago, not signed" becomes a queue item + a one-click nudge (call script + text template side by side).
- **Sign flow completes the chain:** sign → deposit request (if configured) → **Job created** → customer gets the job-packet link (§11) → internal queue item "Schedule the job" pre-filled with the customer + service. (Fixes the v2 dead end where signing changed nothing downstream.)
- Expiry: proposals carry a valid-until date; expired proposals show as such and re-issue in one click (new version, same lines).

## 9. Follow-up engine v3

- **Business-hours timers:** all SLAs and cadences count the workspace's business hours (default Mon–Fri 8:00–17:30, editable). An 8pm lead is "due at 8am," never "overdue all night."
- **12-touch default cadence** for sent proposals (call/email/text mix, day pattern 0/1/3/5/8/12/18/26/35/45/60/75), per-stage cadence templates, stop-on: reply, sign, call outcome logged, manual stop (reason kept).
- **Speed-to-lead:** new lead (any source) triggers an instant first touch inside 60 seconds — pre-approved template text/email ("Got your request for {service} — {owner} will call you by {time}") — plus a queue item pinned until a human touches it. Missed-call text-back (v2 endpoint) joins the same flow.
- **Callbacks:** "call me Thursday 10am" is a first-class object on the lead: resurfaces in the queue at the time, with the note attached.
- **Rehash:** No-Response and Lost (price/timing only) leads enter reactivation campaigns at 30/90/180 days with fresh templates; one reply revives the lead to WORKING with history intact.
- **Touches counter everywhere:** lead cards show touches made vs the cadence plan ("touch 3 of 12 · next tomorrow") — the Followup CRM lesson: deals die from under-touching, visibly.

## 10. Jobs & ops v3 (the second half of the business)

- **Job Board:** columns = job stages (§3); cards show customer, service, value, scheduled date, crew, labor-vs-estimate bar, paperwork dots. Drag to move (free, like §4). This is Gregory's morning screen #2.
- **Job record:** header with stage stepper (click any stage, either direction), tabs: Overview (scope, customer, site, documents checklist) · Crew & Time (§5 — roster workers, grid entry) · Schedule · Field Reports · Billing (deposit, invoice state, change orders) · Timeline (everything, incl. the lead history it came from).
- **Documents/paperwork checklist per job:** auto-seeded by service (e.g., spill job → DEC case #, disposal manifests, closure report; school job → certified payroll, COI sent) — each doc: required/received/verified, chase button per missing doc (email to the holder with the template). Workspace-level compliance docs (v2) stay.
- **Field reports on the job:** file from the job (not a global list first); missing-report queue items per worker name (§5.4 model); a report is 3 fields + photos.
- **Change orders:** from the job, priced from the price book, sent for e-sign like a mini-proposal; approved COs add to job value + appear in the Weekly Report.
- **Invoicing handoff:** mark job ready-to-invoice → invoice draft via the existing outcome/finance plumbing (QBO when connected; otherwise a clean invoice document + "sent" state). Job can't reach CLOSED with an open balance without an explicit write-off reason.

## 11. Handoff v3 — "send it over"

- **§14.5 Final Outcome API stays as-is** (it was never the problem) + finals now fire from free movement (§4.2) incl. reopen-supersede semantics.
- **Job Packet (new):** one link per job bundling scope, signed proposal, schedule, site contacts, documents checklist — sendable to a customer, a sub, or an internal system; the packet page is the same customer-portal surface as v2's portal, extended. "Send it over" = one click from the job header: pick recipient (customer / sub / email), packet + message template, sent; delivery state shown honestly.
- **Won → Job auto-handoff:** on sign, the job is created with proposal lines → job scope, documents seeded, crew unassigned flagged as a queue item ("Crew needed Thu"), so nothing about a won deal ever waits for someone to re-type it.

## 12. Speed toolkit (applies everywhere)

- **Quick Add (+)** global: lead, email task, time entry, field report, schedule entry, note — each a one-field-first modal, keyboard completable.
- **⌘K does actions,** not just search: "log time", "move to Sent", "assign to me", "nudge", "schedule visit" — executed on the current record or a searched one.
- **Bulk everywhere:** any list/board selection → assign, stage, next-step date, message (template), export, archive. With Undo.
- **Hover cards** on any lead/job name (status, next action, last touch, value) — no record dive to answer "where does this stand?"
- **Full keymap** (help overlay on `?`): J/K navigate, Enter open, E done, S snooze, A assign, T log time, M move stage, N new, / search, G+letter nav (kept), [ / ] switch queue items in record view ("next record" flow — work the pile without returning to the list).
- **Next-record flow:** opening a record from the queue/list adds ‹ › arrows + position ("7 of 41") — processing a pile is a conveyor belt, not a scavenger hunt.

## 13. Metrics — on the surface, not a destination

- Board column headers: count, value, **median age, # rotting (>X days untouched, X per stage)**.
- Job cards: labor $ vs proposal $ (live bar, red over 90%).
- Queue header: today's counts by type, zero-by-when projection ("at this pace, zero by Thu").
- Dashboard (kept, demoted to a tab): FPAR (where approvals on), win rate, touches/win, first-touch median (business hours), backlog burn-down. Weekly Status Report (kept — Gregory's headline) gains: jobs completed, paperwork outstanding, labor variance top-5, touches made, rehash wins.

## 14. Data model & migration

- `workers` (new): id, workspace_id, name, phone, labor_class_id, linked_user_id NULL, active, created_at.
- `time_entries`: + `worker_id` (roster), `user_id` becomes nullable (kept when the worker is a linked user). Rate/class snapshot columns unchanged.
- `job_crew`, `job_schedule`, `field_reports`, `timesheets`: worker_id added alongside user_id (nullable); schedule/reports/timesheets resolve display name worker → user fallback.
- `jobs` (new): id, workspace_id, lead_id, proposal_id, stage, scheduled_start/end, value (from signed option), sector (copied from lead), created_from ('sign'|'manual'), closed_at.
- `leads.state` values migrate: NEW→NEW, TRIAGED/QUALIFYING→WORKING, QUALIFIED→QUALIFIED, READY_FOR_APPROVAL/APPROVED/PROPOSAL_DRAFTED→PROPOSAL, PROPOSAL_SENT→SENT, IN_FOLLOW_UP→FOLLOWUP, finals unchanged, ON_HOLD→ stage preserved + `hold` flag columns (hold_reason, hold_until). Old state kept in `legacy_state` for audit.
- `approvals` stays (policy-driven per §4.4); existing pending approvals in the live pilot remain valid queue items.
- Migration runs against local demo AND live pilot DBs; pilot data (41 leads, 5 won) must land as 41 leads + 5 jobs with crew/time re-pointed to jobs and workers created for Daniel/Shehreyar (linked) — verified by census before/after.
- Server transition table for sales stages is DELETED; `transition()` becomes `setStage()` with reason/final guards only. §26 invariants preserved: price/send code-gating where money moves, ingested content is data, honest delivered states.

## 15. API changes (additive where possible)

- `POST /api/leads/:id/stage {to, reason?, note?}` (replaces /transition for sales stages; /transition kept as a shim one release).
- `POST /api/leads/:id/reopen {}`, `POST /api/leads/:id/hold {reason, until}`, `DELETE hold`.
- `GET/POST/PATCH /api/workers`, `POST /api/workers/bulk {names[]}`.
- `POST /api/time {job_id|lead_id, worker_id|worker_name, entry_date, hours, note}` — worker_name type-to-create server-side too.
- `GET /api/jobs`, `GET/PATCH /api/jobs/:id`, `POST /api/jobs/:id/stage`, `POST /api/jobs/:id/packet/send`.
- `GET /api/queue` — the unified work queue (server-ordered, typed items with primary actions).
- `POST /api/inbox/:id/comments`, rules CRUD `GET/POST/PATCH /api/inbox-rules`.
- Proposals: `POST /api/leads/:id/proposals` accepts `options[]`; sign payload returns job_id.

## 16. Build order (each slice: tests + smoke + screenshots, same bar as v2)

- **Slice 28 — Flow freedom.** setStage any→any + finals reasons + reopen + hold-as-flag + undo toasts + board drag both directions + readiness checklist replaces the Gate (warnings + Move anyway). Stage migration for local + pilot data. *Acceptance: a WON lead reopens; a QUALIFIED lead drags back to WORKING; nothing 422s on a legal human intent.*
- **Slice 29 — Workers & time anywhere.** Roster CRUD + bulk paste + time form v3 (type-to-create worker) at all entry points + weekly grid + timesheets per worker. *Acceptance: log 8h for a brand-new named worker with no account in ≤10s from the board; payroll CSV shows him.*
- **Slice 30 — Jobs layer.** jobs table + sign→job + manual won→job + job board + job record (crew/time/schedule/reports/docs tabs re-pointed). *Acceptance: signing a proposal produces a schedulable job with its paperwork checklist; pilot's 5 wins exist as jobs.*
- **Slice 31 — Work Queue home.** /api/queue + queue UI as default landing + keyboard conveyor + next-record flow. *Acceptance: Gregory's morning — approvals, spill email, missing report, cold proposal — all actionable from one screen without navigation.*
- **Slice 32 — Proposals v3.** Options, clone/templates, view tracking, expiry/re-issue, sign completes chain (§8). 
- **Slice 33 — Inbox v3.** Comments, collision, Send & Done, canned library, rules engine, split views.
- **Slice 34 — Follow-up engine v3.** Business-hours timers, 12-touch cadences, instant first touch, callbacks, rehash.
- **Slice 35 — Job ops finish.** Job packet send, change orders on jobs, invoice handoff states, documents chase.
- **Slice 36 — Metrics on surfaces + Weekly Report v3.** Column aging/rotting, labor bars, report additions.
- Tier-2 later: kiosk/PIN clock-in, GPS stamps, native mobile capture, calendar sync — unchanged from v2 roadmap.

## 17. What v2 got right and stays

Price-book-only pricing with floor control · §14.5 outcome handoff (delivered-only-on-2xx honesty) · e-sign evidence model · prompt-injection invariant · per-seat pricing + seat enforcement (now counting logins only) · Weekly Status Report concept · G.C.-shaped ops (field reports, timesheets, paperwork) · the pilot dataset itself (migrated, §14).

*The v2 mistake was architectural, not effortful: it modeled the business as a funnel with gates. The business is a pile with a queue. v3 models the pile.*

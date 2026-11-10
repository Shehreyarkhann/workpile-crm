# Workpile — Competitive Audit (2026-11-09)

Benchmarks: Salesforce Sales Cloud, HubSpot, Pipedrive, Close, GoHighLevel, and the
field-service CRMs our buyers actually run — ServiceTitan, Jobber, Housecall Pro.
Researched from vendor/review sources on 2026-11-09. Verdicts are against the
Workpile build as of Slice 8 (338b436).

## Where they beat us today (deficiencies)

| # | Gap | Who proves it matters | Severity |
|---|-----|----------------------|----------|
| 1 | **Automated follow-up sequences** — staged nudges on unanswered estimates (Day 1/3/7), auto-stop on reply/sign | Jobber (2 auto quote follow-ups), Housecall Pro (First/Second/Third Follow-Up → auto-decline), ServiceTitan Marketing Pro (unsold-estimate campaigns) | **P0 — the category's signature automation; we had manual messages only** |
| 2 | **Two-way conversation threading** — replies land back on the customer record in one inbox | GoHighLevel unified inbox, Close, ServiceTitan two-way texting | P1 — outbound exists; inbound email triage exists but doesn't thread onto the lead |
| 3 | **Review requests + reputation** — automated Google review ask after a won job | Jobber, ServiceTitan ("excellent"), Housecall Pro | P1 — we finalize WON and stop; the highest-ROI moment is unused |
| 4 | **Calendar sync + online booking** for site visits | Jobber, Housecall Pro, GHL, Salesforce (Activity Capture) | P1 — visits are internal records; no Google/Outlook calendar sync, no public booking page (OAuth-gated) |
| 5 | **Source → revenue attribution** | ServiceTitan marketing ROI (channel → completed revenue) | P1 — we track source names; no by-source revenue report (data exists) |
| 6 | **Assignment rules by criteria** (service/territory → owner) | Salesforce assignment rules + queues | P2 — we have round-robin inside AI cleanup only |
| 7 | **Native QuickBooks/accounting sync** | Jobber, ServiceTitan, Housecall Pro | P2 — covered by API/webhooks, no native connector |
| 8 | **Calling** — click-to-call, recording, transcripts | Close (power dialer), ServiceTitan | P2 — we have a 20-second call log pattern in tasks; no telephony |
| 9 | **Native mobile apps** | All field-service CRMs | P2 — responsive web + PWA install is our answer at this stage |
| 10 | **Forecasting** (weighted pipeline) | Salesforce Opportunities | P3 — pipeline value exists; no stage-weighted expected revenue |

## Where we already beat them (keep saying it)
- **Completeness Gate + approval discipline**: nobody in field service gates proposals on packet completeness; FPAR is ours.
- **Backlog-first**: they are CRMs that tolerate backlogs; Workpile's whole job is clearing one (audit, burn-down, Morning Brief).
- **Final Outcome Handoff**: every final — won AND lost — delivered into the customer's own platform with ack tracking. Competitors trap outcomes inside themselves.
- **Price-book-only AI proposals + e-sign + deposit in one flow.**
- **Price**: flat $299–$999/business vs per-seat math everywhere else (ServiceTitan $245+/tech).

## Daily-use UX/UI — "living in it" gaps
| Gap | Reference | Fix shipped in Slice 9 |
|-----|-----------|------------------------|
| No command palette | Linear/Attio ⌘K is the primary navigation pattern | ✅ ⌘K palette: leads, views, actions |
| No keyboard shortcuts | Linear: J/K, /, C, ? help | ✅ /, N, G-nav, ? overlay |
| No workspace activity pulse | Salesforce Chatter/timeline, Linear inbox | ✅ Pulse view (workspace event stream) |
| Approvals empty state is a dead end | "Inbox zero" moments (Superhuman/Gmail) | ✅ Inbox-zero state |
| No recently-viewed | Salesforce/Linear recents | ✅ Recents inside ⌘K (local) |
| Row-level quick actions missing | Pipedrive hover actions | Roadmap (list already dense) |
| Dark mode | Attio/Linear | Roadmap — needs a token pass over hardcoded colors |
| Density toggle | Salesforce Lightning density | Roadmap |

## Slice 9 build list (this audit's P0/P1 + UX)
1. Follow-up cadences: Day 2 email / Day 5 SMS / Day 10 email on sent proposals, workspace-configurable steps, auto-stop on sign/final/new inbound, visible + stoppable per lead.
2. Review-on-Won: Google review link in Settings; on WON, one review request email is queued/sent (opt-in toggle).
3. ⌘K command palette + keyboard shortcuts + ? help + recents.
4. Pulse activity view (GET /api/activity).
5. Reports: revenue by source (leads, won, win rate, revenue).
6. Approvals inbox-zero state; PWA manifest (installable).

## Honest roadmaps (not this slice)
Calendar sync + booking page (OAuth apps first), two-way SMS threading (Twilio inbound webhook — small once a number exists), QuickBooks native, assignment rules UI, dark mode, native apps.


## The road to #1 (added after Slice 9, 2026-11-09)
"#1" for Workpile does not mean out-Salesforcing Salesforce. It means owning one
sentence in the buyer's head: *"the system that clears and controls the pile."*

**Tier 1 — finish the daily-driver moat (code, near-term)**
- ✅ My Day personal command center (Slice 10) — the app now opens on YOUR queue.
- Bulk actions on the leads table (assign / advance / archive many at once).
- Two-way texting: Twilio inbound webhook threads replies onto the lead.
- Saved-view sharing + lead hover cards; dark mode (token pass).
- Push notifications to the approver's phone (PWA push) — approvals under 10 seconds from a lock screen.

**Tier 2 — integration gravity (why platforms win)**
- QuickBooks Online native sync (won job → invoice draft), Google/Outlook calendar sync for site visits, public booking page.
- Zapier/Make public app listing (we already have the API + webhooks they wrap).
- Native importers: one-click migration from Jobber / Housecall Pro / ServiceTitan / Salesforce CSV shapes.

**Tier 3 — AI that competitors can't bolt on**
- AI receptionist intake: missed call → AI callback/text in 60 seconds → qualified lead in the pile (approval-gated).
- Win/loss intelligence: the Demand Gap + lost-reason data becomes pricing/coaching insight per rep and per service.
- Forecast: stage-weighted pipeline + "at-risk" flags on proposals going cold (the follow-up engine already watches them).

**Tier 4 — proof, the actual moat**
- One design partner's numbers (backlog cleared in N days, FPAR, recovered $) published as the category benchmark.
- The free Backlog Audit as the permanent top-of-funnel; Annual "State of the Pile" report from anonymized data.
- SOC 2 Type I path + status page + one-click full data export (trust is a feature in this market).

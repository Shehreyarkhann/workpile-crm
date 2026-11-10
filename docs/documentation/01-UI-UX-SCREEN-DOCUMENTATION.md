# Workpile — UI/UX Screenshots & Screen Documentation

Current at v6 (commit `b513704`). Screenshots ship inside this package under `screenshots/` in three sets that together cover the current UI:

- `screenshots/v13-v6-ui/` — the v6 command center (latest)
- `screenshots/v12-v5-ui/` — v5 surfaces (Planner agenda, templates, consolidated sidebar)
- `screenshots/v11-v4-ui/` — v4 surfaces (CRM modules) — layouts unchanged in v5/v6 except where v12/v13 supersede them

Full-resolution captures of every release since v1 are retained in the project archive (`lead-backlog-saas-spec/screenshots*`).

## Design system (summary)

Bright warm canvas · white cards, 16–24px radius, soft shadows · Workpile green brand accent, amber reserved for "today/attention" · pastel top-glows on stat cards · big bold numerals · segmented pill controls · avatar rows with relative times · semicircular tick goal gauge · global motion layer (staggered fade-up entrances, modal pop-in, hover lift, LIVE pulse, count-up numerals, toast slide-ins). Dark mode supported. Full treatment: Master Specification §12.

## Screen inventory

| # | Screen | Screenshot | Purpose & key elements |
|---|---|---|---|
| 1 | **Home / Dashboard (v6 command center)** | `v13-v6-ui/01-home-command-center.png` | Morning Brief hero (generated headline, action chips, stuck top-3) → count-up stat cards (Open pipeline · Proposals Sent ★ · FPAR · Won value) with pastel glows → **Workpile Agent panel** (LIVE pulse, 4 automation chips, guardrail line, run history, top insights, Run Agent now) → 30-day activity bars (14/30 toggle, today in amber) + Recently Assigned avatar rows → right rail: FPAR goal gauge, Upcoming week strip + agenda cards, Quick Links → below: pinned reports, funnel, by-service, leaderboard, recent activity. Every number drills into its records. |
| 2 | **Agent Run modal** | `v13-v6-ui/02-agent-run-modal.png` | Animated step-through of a real automation sweep (Scoring → Assigning → Tidying duplicates → Reactivating steps light up as the server completes them), then the itemized result counts + View AI Assistant. If all automations are off: one-click enable-all state instead of a dead end. |
| 3 | **Dashboard + consolidated sidebar (v5)** | `v12-v5-ui/01-sidebar-dashboard.png` | The 20-destination sidebar after consolidation (Customers+People, Planner, Library merged; Duplicates inside Leads). App-switcher presets filter it (Sales/Ops/Marketing/All). |
| 4 | **Planner — Calendar agenda** | `v12-v5-ui/02-planner-calendar-agenda.png` | Month grid; "+N more — click the day"; clicking a day opens the full agenda panel: all of that day's tasks (incl. completed), callbacks, crew schedule, follow-ups, site visits, with per-type filter chips and counts. Records open **only** via the agenda's "Open record →" actions. |
| 5 | **Planner — Tasks** | `v12-v5-ui/03-planner-tasks.png` | Every task across every record: Mine / Open / Overdue / Done filters, create on any record, complete in place. |
| 6 | **Customers + People** | `v12-v5-ui/04-customers-people.png` · `v11-v4-ui/01-customers.png` · `v11-v4-ui/10-people.png` | Accounts tab (lifetime value from real jobs) and People tab (every contact). Account record (`v11-v4-ui/02-customer-detail.png`): related lists — people, jobs, leads — feed, files, custom fields. |
| 7 | **Library — Notes** | `v12-v5-ui/05-library-notes.png` | All notes across all records in one searchable list (Files & Documents is the sibling tab: the full document tracker). |
| 8 | **Settings — Document Templates** | `v12-v5-ui/06-doc-templates.png` | The template system: seeded varieties with default star, add/duplicate/delete (guarded), rich-text editor (formatting, tables, images by upload or URL), per-template logo toggle, merge-field help. |
| 9 | **Proposal builder — Template picker** | `v12-v5-ui/07-proposal-template-picker.png` | Inside the lead's proposal builder: template cards (default preselected) beside price-book line items, Good/Better/Best options, deposit setting. The chosen template renders on print, DOCX, and the customer sign page. |
| 10 | **Campaigns** | `v11-v4-ui/03-campaigns.png` | Campaign cards + detail: members with statuses, cost, pipeline, won revenue, ROI (real values only). |
| 11 | **Calendar (v4 month view)** | `v11-v4-ui/04-calendar.png` | Superseded by screen 4 in v5; retained for history. |
| 12 | **Lead record — Feed** | `v11-v4-ui/06-lead-feed.png` | Chatter-style collaboration on a record: posts, @mentions (→ notifications), followers. The same feed pattern appears on jobs and accounts. |
| 13 | **Settings — Custom Fields** | `v11-v4-ui/07-settings-custom-fields.png` | Workspace-defined fields (text/number/date/picklist) for leads, jobs, accounts — rendered on records, the builder, and reports. |
| 14 | **Dashboard — Pinned reports** | `v11-v4-ui/08-dashboard-pins.png` | Any Report Builder output pinned to the dashboard (title, total, bar visualization). |
| 15 | **Report Builder** | `v11-v4-ui/09-report-builder.png` | Object × group-by × metric with totals reconciled against list views; save, export CSV, pin. |

## Screens documented in the Master Specification (§6, §12)

The remaining surfaces — Work Queue conveyor, My Day, Leads table/board/duplicates, Lead & Job record pages, Approvals inbox, AI Assistant, Import wizard, Demand Gap, Handoffs monitor, Ops Console, Billing, Weekly Status Report, customer portal, public sign page, booking page, ⌘K palette — are specified element-by-element in the Master Specification's module catalog; their captures live in the earlier archive sets (v7–v10) and the live pilot at workpile.claimpaid.io.

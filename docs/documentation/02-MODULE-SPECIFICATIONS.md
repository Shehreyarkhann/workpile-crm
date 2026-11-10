# Workpile — Individual Module Specifications

Server modules (`server/`, TypeScript, Node 24) plus the client. Route counts, exported functions, and table usage are extracted from source at commit `6155c8a`.


## server/admin.ts — 50 lines

**Purpose.** Platform Ops Console data: workspace health, agent volumes, dead-letter attention.

**Exported functions (4):** `getFlags`, `setFlag`, `workspaceHealth`, `runSynthetics`

**API routes registered:** 0

**Tables read/written (5):** `agent_runs`, `feature_flags`, `leads`, `outcome_deliveries`, `workspaces`


## server/agents.ts — 123 lines

**Purpose.** Named agents: triage (catalog classification), packet check (pre-send completeness), demand gap/pool analysis, and the prompt-injection scanner applied to all ingested content.

**Exported functions (5):** `injectionScan`, `triageLead`, `packetCheck`, `demandPool`, `demandGap`

**API routes registered:** 0


## server/ai.ts — 132 lines

**Purpose.** Deterministic intelligence: lead scoring, cleanup preview/apply, insights v1/v2, next-best-action, reactivation, the automation runner (Auto-pilot) and agent-run logging.

**Exported functions (10):** `scoreLead`, `cleanupPreview`, `cleanupApply`, `insights`, `reactivateStale`, `nextBestAction`, `insightsV2`, `logAgentRun`, `runAutomationsFor`, `processAutomations`

**API routes registered:** 0

**Tables read/written (9):** `agent_runs`, `approvals`, `contacts`, `lead_events`, `leads`, `proposals`, `tasks`, `users`, `workspaces`


## server/app.ts — 1774 lines

**Purpose.** HTTP composition root and the core domain: authentication/sessions, workspaces, leads CRUD + stage engine + finals discipline, proposals, approvals, settings, price book, services, team, search, public sign page, landing data.

**Exported functions (10):** `outcomePayload`, `approvalRequiredFor`, `pendingApprovalFor`, `approvedApprovalFor`, `maybeRequestApproval`, `setStage`, `ensureJobForLead`, `permsOf`, `applyInboxRules`, `workspaceDefaults`

**API routes registered:** 208

**Tables read/written (46):** `activities`, `agent_runs`, `api_keys`, `approvals`, `auth_tokens`, `callbacks`, `canned_replies`, `change_orders`, `contacts`, `documents`, `field_reports`, `followup_enrollments`, `imports`, `inbox_comments`, `inbox_items`, `inbox_rules`, `job_crew`, `job_schedule`, `jobs`, `labor_classes`, `lead_events`, `leads`, `memberships`, `messages_outbox`, `notifications`, `outbox`, `outcome_deliveries`, `payments`, `portal_uploads`, `price_book_items`, `projects`, `proposals`, `services`, `sessions`, `signatures`, `site_visits`, `sources`, `subscriptions`, `tasks`, `templates`, `time_entries`, `timesheets`, `users`, `webhook_endpoints`, `workers`, `workspaces`


## server/billing.ts — 99 lines

**Purpose.** Workpile's own subscription billing: plans, trials, seat accounting, Stripe checkout/portal/webhooks, usage metering.

**Exported functions (8):** `planOf`, `seatsUsed`, `seatCheck`, `ensureSubscription`, `billingStatus`, `ingestionAllowed`, `createCheckout`, `handleBillingEvent`

**API routes registered:** 0

**Tables read/written (5):** `agent_runs`, `leads`, `subscriptions`, `users`, `workspaces`


## server/comms.ts — 58 lines

**Purpose.** Outbound communications: message queue, email/SMS adapters (Resend/Twilio) with honest test mode, notifications with entity targets, TCPA consent gate, notification fan-out helpers (notify).

**Exported functions (5):** `queueMessage`, `deliverMessage`, `queueAndDeliver`, `notify`, `notifyOwners`

**API routes registered:** 0

**Tables read/written (4):** `messages_outbox`, `notifications`, `users`, `workspaces`


## server/crm.ts — 316 lines

**Purpose.** CRM + platform layer (v4–v6): accounts/contacts & WON conversion, feed with mentions, custom fields, campaigns, duplicates & merge, assignment rules, notes/files aggregation, tasks & calendar, report builder & dashboard pins, document templates, home aggregate.

**Exported functions (9):** `initCrmSchema`, `convertLeadToCustomer`, `backfillConversions`, `applyAssignmentRules`, `onLeadCreated`, `registerCrm`, `ensureDocTemplates`, `registerDocTemplates`, `registerHome`

**API routes registered:** 46

**Tables read/written (28):** `accounts`, `agent_runs`, `assignment_rules`, `callbacks`, `campaign_members`, `campaigns`, `contacts`, `custom_fields`, `dashboard_pins`, `doc_templates`, `documents`, `favorites`, `feed_posts`, `follows`, `followup_enrollments`, `job_schedule`, `jobs`, `lead_events`, `leads`, `notes`, `portal_uploads`, `proposals`, `site_visits`, `sources`, `tasks`, `users`, `workers`, `workspaces`


## server/db.ts — 193 lines

**Purpose.** Schema definition for all tables, additive startup migrations, password hashing, id/timestamp helpers, database connection.

**Exported functions (6):** `hashPassword`, `verifyPassword`, `initSchema`, `logEvent`, `audit`, `logAgentRun`

**API routes registered:** 0

**Tables read/written (9):** `agent_runs`, `audit_log`, `job_crew`, `job_schedule`, `lead_events`, `leads`, `time_entries`, `users`, `workers`


## server/demo-rich.ts — 68 lines

**Purpose.** Rich demo dataset seeder (G.C.-shaped pilot data).

**API routes registered:** 0

**Tables read/written (15):** `approvals`, `change_orders`, `contacts`, `documents`, `inbox_items`, `lead_events`, `leads`, `outcome_deliveries`, `price_book_items`, `projects`, `proposals`, `site_visits`, `tasks`, `users`, `workspaces`


## server/demo-scale.ts — 33 lines

**Purpose.** Scale seeder: 2,613-lead / 2,001-won proof workspace.

**API routes registered:** 0

**Tables read/written (4):** `contacts`, `leads`, `users`, `workspaces`


## server/docx.ts — 42 lines

**Purpose.** Proposal → DOCX document generation.

**Exported functions (1):** `proposalDocx`

**API routes registered:** 0


## server/fieldreports.ts — 34 lines

**Purpose.** Field reports written to the timesheet standard; completeness chasing.

**Exported functions (4):** `todayStr`, `ensureDay`, `chaseReport`, `chaseMissingReports`

**API routes registered:** 0

**Tables read/written (4):** `field_reports`, `job_schedule`, `users`, `workers`


## server/followups.ts — 80 lines

**Purpose.** Follow-up cadence engine: 12-touch business-day sequences, template merge rendering, enrollment/stop rules, cadence processing, callback handling.

**Exported functions (6):** `addBusinessDays`, `stepsFor`, `enrollFollowup`, `stopFollowups`, `render`, `processFollowups`

**API routes registered:** 0

**Tables read/written (5):** `contacts`, `followup_enrollments`, `leads`, `proposals`, `workspaces`


## server/inbox.ts — 99 lines

**Purpose.** Shared inbox: email/mbox/CSV backlog parsing, 7-category triage classification, suggested actions with drafted replies, canned replies, inbox rules.

**Exported functions (7):** `categorizeEmail`, `extractPhone`, `parseEmail`, `parseMbox`, `parseCsvRows`, `parseEmailCsv`, `suggestInboxAction`

**API routes registered:** 0


## server/index.ts — 14 lines

**Purpose.** Server entrypoint: module registration, static client serving, port binding.

**API routes registered:** 1


## server/integrations.ts — 47 lines

**Purpose.** Final Outcome Handoff (§14.5): outcome deliveries, HMAC-signed webhooks with retry/DLQ/replay, pull API + ack endpoints, vendor CSV importers.

**Exported functions (4):** `signPayload`, `emitEvent`, `notifySlack`, `processEventDeliveries`

**API routes registered:** 0

**Tables read/written (3):** `webhook_deliveries`, `webhook_endpoints`, `workspaces`


## server/labor.ts — 83 lines

**Purpose.** Labor classes and rate-snapshot costing for time entries.

**Exported functions (6):** `resolveWorker`, `rateForWorker`, `rateFor`, `logTime`, `jobLabor`, `listWorkers`

**API routes registered:** 0

**Tables read/written (6):** `job_crew`, `labor_classes`, `leads`, `time_entries`, `users`, `workers`


## server/metrics.ts — 45 lines

**Purpose.** The metrics engine: FPAR, win rate, cycle times, funnel, by-service, leaderboard, dashboard aggregates — the single source every screen and report reads.

**Exported functions (2):** `metrics`, `morningBrief`

**API routes registered:** 0

**Tables read/written (7):** `approvals`, `field_reports`, `leads`, `outcome_deliveries`, `sources`, `tasks`, `users`


## server/oauth.ts — 44 lines

**Purpose.** Gmail / Microsoft mailbox OAuth connections (config-gated).

**Exported functions (4):** `providerStatus`, `authUrl`, `recordConnection`, `listConnections`

**API routes registered:** 0

**Tables read/written (1):** `oauth_connections`


## server/payments.ts — 74 lines

**Purpose.** Stripe deposit links and payment state synchronization on proposals.

**Exported functions (5):** `stripeMode`, `createDeposit`, `markPaid`, `verifyStripeSignature`, `handleStripeEvent`

**API routes registered:** 0

**Tables read/written (4):** `outbox`, `payments`, `proposals`, `workspaces`


## server/proptemplate.ts — 85 lines

**Purpose.** Proposal document model: workspace header resolution, document-template resolution, merge fields, HTML sanitizer (safe image sources only).

**Exported functions (5):** `sanitizeHtml`, `htmlToParagraphs`, `getTemplate`, `mergeFields`, `proposalDocument`

**API routes registered:** 0

**Tables read/written (5):** `contacts`, `doc_templates`, `leads`, `proposals`, `workspaces`


## server/push.ts — 26 lines

**Purpose.** Web Push (VAPID) subscription and delivery.

**Exported functions (4):** `pushConfigured`, `vapidPublicKey`, `saveSubscription`, `sendPush`

**API routes registered:** 0

**Tables read/written (1):** `push_subscriptions`


## server/seed.ts — 56 lines

**Purpose.** Base demo seeder.

**API routes registered:** 0

**Tables read/written (11):** `api_keys`, `contacts`, `field_reports`, `leads`, `outcome_deliveries`, `price_book_items`, `services`, `templates`, `timesheets`, `users`, `workspaces`


## server/sign.ts — 56 lines

**Purpose.** E-signature: signing tokens, sign flow, evidence record (hash, consent, signer, timestamps).

**Exported functions (4):** `docHash`, `ensureSignToken`, `getByToken`, `sign`

**API routes registered:** 0

**Tables read/written (5):** `contacts`, `leads`, `proposals`, `signatures`, `workspaces`


## server/statusreport.ts — 68 lines

**Purpose.** Weekly Status Report generation for the owner.

**Exported functions (1):** `weeklyReport`

**API routes registered:** 0

**Tables read/written (15):** `activities`, `approvals`, `contacts`, `documents`, `field_reports`, `inbox_items`, `job_schedule`, `jobs`, `lead_events`, `leads`, `messages_outbox`, `outcome_deliveries`, `proposals`, `time_entries`, `timesheets`


## server/timesheets.ts — 43 lines

**Purpose.** Time entries → weekly timesheet aggregation and missing-timesheet detection.

**Exported functions (5):** `weekStartOf`, `ensureWeek`, `chaseRow`, `chaseMissing`, `sumDays`

**API routes registered:** 0

**Tables read/written (3):** `timesheets`, `users`, `workers`


## server/worker.ts — 62 lines

**Purpose.** Background scheduler: follow-up processing, automation sweeps (~6h per workspace), delivery retries.

**Exported functions (4):** `signPayload`, `processDeliveries`, `replayDelivery`, `startWorker`

**API routes registered:** 0

**Tables read/written (4):** `leads`, `outcome_deliveries`, `projects`, `webhook_endpoints`


## src/main.tsx — the client (1,947 lines)

**Purpose.** The entire web application as a single-file React app: all 20 module views (Work Queue, My Day, Dashboard + HomeDash command center, Pulse, Leads, Jobs, Customers, Campaigns, Planner, Library, Reports, Approvals, AI Assistant, Import, Demand Gap, Handoffs, Ops Console, Settings, Billing, auth + landing), the record pages, every modal, the ⌘K palette, the app switcher, and the Agent Run experience. Styling lives in `src/styles.css` (design tokens + the global motion system).


## scripts/ (operational tooling)

- `scripts/seed-gc-pilot.mjs` / `repair-gc-pilot.mjs` — G.C. Environmental pilot seeding & repair against any base URL.
- `deploy/deploy-workpile.sh` — the idempotent production deploy (see Technical Architecture).
- Screenshot capture scripts live outside the repo (`~/workspace/shottools/`) and produce the UI/UX sets in this package.

# Workpile — Product Intelligence & Transformation

## Complete Target-State Product Specification

- **Document type:** Product strategy and target-state requirements
- **Version:** 1.0 · **Status:** Proposed target state (approved by founder, Nov 10, 2026)
- **Product:** Workpile · **Product category:** Revenue execution and service operations SaaS
- **Primary market:** Small and mid-sized service businesses · **Initial vertical focus:** Environmental services and adjacent field-service businesses

**Central recommendation:** evolve Workpile from a broad CRM and operations application into a **service-business revenue and execution platform**. This requires challenging several existing product decisions — not simply adding more features. The target state preserves the strongest parts of the current foundation (including deterministic AI rather than an LLM-dependent product) while defining what should change, what should be simplified, what should be built, and what should be deferred.

**The transformation — from CRM to Revenue Execution OS:** Workpile should help a service business capture demand, recover missed opportunities, execute sales workflows, coordinate field operations, and measure the financial outcome — all through one connected operational system.

**The promise:** Every opportunity has an owner. Every active job has a next action. Every commercial decision is traceable. Every important operational exception is visible.

---

## 1. Executive product vision

**1.1 Product definition.** Workpile is a multi-tenant revenue execution and service operations platform designed to help service businesses convert inbound demand into profitable, completed, and documented work. It connects: lead acquisition and intake; customer and contact management; qualification and prioritization; assignment and accountability; proposal creation and approval; customer communication; electronic signatures; deposits and payment workflows; job creation and execution; scheduling and crew coordination; field reporting and timesheets; document management; operational reporting; revenue intelligence; automation and AI-assisted decisions. Workpile is not intended to be a generic CRM, a generic project-management tool, or a replacement accounting system. It is the operational system connecting the commercial process to the work that must actually be delivered.

**1.2 Core product promise.** Workpile must answer five questions at any moment: (1) What opportunities are we losing or neglecting? (2) What must happen next to convert those opportunities? (3) Who is responsible for each action? (4) What work has been sold, scheduled, completed, and documented? (5) What is the actual financial outcome?

**1.3 Strategic positioning.** *Workpile — Turn Every Opportunity Into Accountable Work.* Positioned around measurable outcomes: recover overlooked leads; reduce time from inquiry to proposal; prevent unowned opportunities; reduce proposal approval delays; improve customer follow-up; connect signed work to operational delivery; improve field documentation compliance; make actual revenue and operational performance visible.

**1.4 Product principles.** (1) Operational clarity over feature quantity. (2) One source of truth for every business entity. (3) Every active record must have an owner and a next action. (4) Every financial number must have a defined source and calculation. (5) Every consequential action must be auditable. (6) Automation must be explainable and reversible where possible. (7) AI must never bypass authorization or business policy. (8) Customer-facing communications must be consent-aware. (9) Mobile usability is a core requirement. (10) The product must remain usable without AI. (11) Features must work end-to-end, not merely exist as screens or API routes. (12) No customer should need founder intervention to complete routine workflows.

## 2. Strategic product decisions

- **Decision A — Stop pursuing generic CRM feature parity.** Do not recreate every feature of Salesforce/HubSpot or a full field-service ERP. Deliver superior execution across the lead-to-revenue-to-job lifecycle.
- **Decision B — Make the Work Queue the operational center.** The dashboard provides executive visibility; the Work Queue is where operational work gets completed. The dashboard answers "How is the business performing?"; the Work Queue answers "What must I do next?"
- **Decision C — Separate pipeline revenue from realized job revenue.** Estimated lead value, proposal value, signed contract value, invoiced value, and collected cash are different financial concepts. They must never be combined into one ambiguous revenue number.
- **Decision D — Make job execution a real domain.** A job is not a converted lead with extra fields: it needs its own lifecycle, ownership, schedule, scope, crew, documents, labor, change orders, costs, and financial state.
- **Decision E — Treat AI as an accountable operator assistant.** AI identifies opportunities, explains risks, recommends actions, prepares drafts, executes permitted tasks. It must not be marketed as an autonomous workforce until the product can demonstrate safe, reliable, measurable autonomy.
- **Decision F — Make vertical configuration a first-class capability.** Support service-business variation through configurable templates, service catalogs, checklists, pricing rules, job requirements, and workflows — not a separate codebase per industry.

## 3. Target customers and personas

**3.1 Ideal customer profile.** 5–50 office and operational users; service businesses with recurring inbound inquiries; currently using spreadsheets, email, phone calls, disconnected apps; owners personally supervise proposals and approvals; field workers with operational documentation requirements; a meaningful backlog of old or neglected opportunities; enough sales volume to justify workflow automation. Initial verticals ranked by customer validation: (1) Environmental and restoration services. (2) Commercial cleaning and maintenance. (3) HVAC and plumbing. (4) Landscaping and other scheduled field services.

**3.2 Personas.** **Owner/Executive:** performance overview, actual revenue and pipeline visibility, approval inbox, financial/operational exceptions, employee accountability, weekly summaries, billing. **Operations Manager:** Work Queue, assignments, scheduling, job status, missing documentation, timesheet oversight, customer coordination, exception resolution. **Sales/Estimator:** assigned leads, customer history, qualification, site visits, price-book proposals, follow-up tasks, communications, proposal status. **Field Manager:** crew schedules, job instructions, site details, required documents, field reports, timesheet review, job progress and blockers. **Field Worker:** mobile access, assigned work, job location/instructions, time entry, field report submission, document/photo upload, simple completion workflow. **Customer:** proposal access, signature, deposit payment, job status where enabled, document exchange, communication history, invoice/payment access where integrated. **Workpile Platform Administrator:** workspace administration, subscription/entitlement visibility, platform & integration health, failed job/webhook monitoring, security events, support tools, feature flags, controlled impersonation with mandatory audit.

## 4. Information architecture

**4.1 Primary navigation:** 1. Home · 2. Work Queue · 3. Leads · 4. Customers · 5. Proposals · 6. Jobs · 7. Schedule · 8. Inbox · 9. Reports · 10. Automations · 11. Settings. Contextual sub-sections rather than top-level destinations where possible: Approvals within Work Queue and Proposals; Tasks within Work Queue and record detail; Field Reports within Jobs; Timesheets within Jobs and Schedule; Documents within Customers, Proposals, Jobs; Campaigns within Growth/Marketing when enabled; Billing within Workspace Settings; platform administration outside the customer workspace.

**4.2 Global interface.** Every authenticated screen: global search, command palette, create action, notification center, user profile + workspace switcher, contextual help, keyboard shortcuts, responsive mobile navigation. Global search must search authorized records only — never another workspace's records or inaccessible private information.

## 5. Home — executive command center

**5.1 Purpose.** Executive and operational overview, not a duplicate of the Work Queue: business health, urgent exceptions, performance, next important decisions.

**5.2 Sections.** **A. Morning Brief** — concise generated summary: new opportunities, high-priority leads, approvals waiting, overdue tasks, proposals at risk, jobs with blockers, missing field reports, revenue/collection exceptions. Every statement links to underlying records. **B. Performance indicators** — open pipeline, proposals sent, proposal approval rate, proposal-to-Won conversion, actual signed contract value, invoiced value, collected cash, overdue receivables, active jobs, operational completion rate. Never show estimated pipeline as realized revenue. **C. Priority exceptions** — unassigned high-value leads, proposals awaiting approval, overdue customer responses, jobs without scheduled work, jobs with missing documentation, overdue timesheets, failed customer communications, failed integrations. **D. Performance trends** — this week vs previous week, this month vs previous month, quarter to date, custom range. **E. Agent activity** — automation runs, records processed, recommendations accepted/rejected, errors, actions awaiting approval, time-saved estimates clearly labeled as estimates.

**5.3 Acceptance criteria.** Every metric has a documented calculation; every metric drills down to contributing records; filters consistent across widgets; timezones workspace-aware; empty states explain why data is unavailable; dashboard loading independent of expensive background processing; one widget's failure must not break the dashboard.

## 6. Work Queue — operational execution

**6.1 Purpose.** The central work-management surface: all actionable work across sales, approvals, customers, and jobs.

**6.2 Work item types.** Lead follow-up; lead qualification; unassigned lead; site visit; proposal preparation; proposal approval; customer response; proposal follow-up; job scheduling; job blocker; missing document; field report; timesheet; change order approval; payment exception; integration failure; automation review.

**6.3 Work item model.** Unique identifier; workspace; entity reference; work type; title; description; priority; owner; due date; status; source; created/updated timestamps; escalation policy; completion reason; audit history.

**6.4 Views.** My Work; Team Work; Unassigned; Overdue; Due Today; Upcoming; Waiting on Customer; Waiting on Approval; Blocked; Completed.

**6.5 Behavior.** Assign/reassign; set priority; change due date; complete work; add notes; attach documents; open source record; snooze with a reason; escalate; bulk update where safe. A completed task records who completed it and when. A task must not disappear without an auditable completion or cancellation state.

## 7. Lead management

**7.1 Canonical states:** New · Contacting · Qualified · Site Visit · Proposal · Negotiation · Won · Lost · No Response · Junk · Unserviceable. Hold is a flag/separate operational condition, not a stage.

**7.2 Creation channels.** Manual entry; web forms; REST API; CSV import; email ingestion; connected mailboxes; external CRM imports; referral entry; booking requests; integration events.

**7.3 Required core fields.** Customer/prospect identity; primary contact; email; phone; service requested; description; source; location; estimated value; owner; priority; current stage; next action; next-action due date; created date; last activity. Additional fields configurable by workspace and service type.

**7.4 Deduplication — identity resolution (replaces single-field dedupe).** Signals: normalized phone; normalized email; company name; external source ID; address; customer reference; historical contact relationships. Behavior: (1) exact match detection; (2) probabilistic candidate matching; (3) confidence score; (4) duplicate review when ambiguous; (5) merge preview; (6) field-level conflict resolution; (7) merge audit; (8) merge reversal where technically safe. Never silently discard an incoming record. Preserve source history even when records are merged.

**7.5 Readiness.** Non-blocking checklist: customer identified; contact details complete; service identified; location confirmed; scope understood; value estimated; owner assigned; next action scheduled; required site visit completed. Show missing items and their importance; do not block ordinary work over nonessential fields.

**7.6 Activity timeline.** Creation; assignment; reassignment; stage changes; calls; emails; SMS; notes; documents; site visits; tasks; proposal changes; approval decisions; signatures; payments; automation actions. The timeline must distinguish human actions from system and agent actions.

## 8. Customer and contact management

**8.1 Separate entities.** A customer is an organization or individual buying services; a person is an individual contact. A customer may have multiple people and locations; a person may relate to more than one customer where appropriate.

**8.2 Customer profile.** Identity; primary/secondary contacts; billing details; service locations; customer type; account owner; status; communication preferences; consent records; documents; lead, proposal, and job history; invoice and payment references; lifetime value; outstanding balance; notes and activity.

**8.3 Conversion.** When a lead becomes Won: create or match customer; create or match person; preserve the lead relationship; preserve original source; create job; snapshot approved commercial terms; transfer relevant documents; create required operational tasks. Conversion must be idempotent — repeated requests must not create duplicate customers, jobs, or financial records.

## 9. Proposals and commercial workflow

**9.1 Builder.** Price-book items; quantities; units; line descriptions; per-line notes; optional Good/Better/Best packages; taxes where applicable; discounts with permission rules; deposits; payment milestones; scope; exclusions; terms; expiration date; customer-specific notes; attachments; document templates. Every proposal version preserves the exact prices and terms used at creation.

**9.2 Price-book integrity.** All standard priced lines come from the workspace price book. Free-text descriptions may be allowed but must not silently become authoritative priced items. Price overrides require: permission; reason; previous value; new value; timestamp; approver where policy requires.

**9.3 Approval.** Configurable policies: none; above a defined amount; discounts above a threshold; low-margin proposals; selected services; always; by designated role or named approver. Approval binds to an immutable proposal version — any material change after approval invalidates it and requires a new decision.

**9.4 Delivery.** Email; SMS link; customer portal; downloadable PDF; DOCX export; print-ready HTML. Track: created; submitted for approval; approved; rejected; sent; delivered where provider data exists; viewed; signed; expired; withdrawn. Never claim an email was delivered merely because a send request was accepted.

**9.5 Follow-up.** Configurable cadence policies, each defining: touch sequence; business-day rules; channel; template; delay; quiet hours; stop conditions; escalation; human override. Stop on: customer reply; signature; Lost status; explicit opt-out; manual stop; expired proposal. Every stop reason-coded.

## 10. Signatures, deposits and contract evidence

**10.1 Signing page.** Customer identity; proposal version; scope; price; terms; deposit requirements; signature consent; signer name; signer email where collected.

**10.2 Evidence record.** Signed document hash; proposal version; signer identity; consent text and version; timestamp; IP address; user agent; signature event; relevant audit history. Do not treat a typed name alone as sufficient proof that all applicable legal requirements have been met. Obtain legal review of the complete e-signature workflow.

**10.3 Deposits.** Requirement; percentage or fixed amount; payment link; provider transaction ID; payment state; failure; refund; reconciliation. A successful signature and a successful deposit are separate states. Never silently mark a deposit paid merely because a payment link was created.

## 11. Job management

**11.1 Lifecycle:** Awaiting Scheduling · Scheduled · Ready · In Progress · Field Work · Reporting · Completed · Invoiced · Closed · Cancelled. Job status is distinct from payment status and document-completion status.

**11.2 Job record.** Job number; customer; primary contact; service location; original lead; approved proposal; contract value; job owner; operations manager; crew; schedule; scope; instructions; required documents; field reports; timesheets; change orders; costs; invoices; payments; activity history.

**11.3 Job creation (reliable business transaction).** The system must: (1) validate the Won state; (2) validate proposal and signature requirements; (3) snapshot approved scope and pricing; (4) create or match customer; (5) create job; (6) transfer relevant records; (7) create operational tasks; (8) create handoff events; (9) commit the local transaction; (10) dispatch external notifications through an outbox. Failure must not leave an incomplete job conversion.

**11.4 Change orders.** Description; reason; line items; price-book reference; customer approval; internal approval; signature evidence where needed; revised job value; audit history. Approved change orders affect contract value; unapproved ones must not be included in approved contract value.

## 12. Scheduling and field operations

**12.1 Scheduling.** Calendar views; day agenda; week view; month view; crew assignment; worker availability; job duration; site visit scheduling; rescheduling; conflict detection; travel considerations; notifications.

**12.2 Constraints — warn about:** double booking; worker unavailability; missing required skills; overlapping appointments; incomplete job prerequisites; unconfirmed customer availability. Never automatically overwrite an existing assignment without explicit confirmation.

**12.3 Field worker experience.** Mobile-first: today's assignments; job instructions; location and contact details; start/finish work; record time; submit field reports; upload photos; capture notes; report blockers; request assistance. Support unreliable connectivity through an offline-capable workflow where justified by pilot conditions; offline changes sync safely and surface conflicts.

**12.4 Field reports.** Templates configurable by service type. Contents: job and location; worker; date/time; work performed; observations; materials; issues; customer acknowledgement; photos; attachments; follow-up required. Submitted reports have a controlled correction/revision process.

## 13. Timesheets and labor costing

**13.1 Time entry.** Worker; job; date; start/end time or duration; breaks; work category; notes; submission status.

**13.2 Lifecycle.** Draft · Submitted · Reviewed · Approved · Rejected · Exported.

**13.3 Labor costing.** Snapshot labor rates at time of entry — a later rate change must not rewrite historical labor cost. Missing labor classifications are visible as incomplete data, not silently treated as free labor. The platform must not claim to be a payroll system unless payroll functionality is deliberately added and legally reviewed.

## 14. Document management

**14.1 Categories.** Customer documents; proposal documents; signed agreements; job documents; field reports; photos; insurance documents; compliance documents; invoices; internal files.

**14.2 Controls.** Version history; file type validation; size limits; malware scanning; access permissions; secure download links; retention rules; audit history; document status; expiration tracking.

**14.3 Checklists.** Configurable by service, job type, and workspace. Missing required documents automatically generate Work Queue items.

## 15. Inbox and communications

**15.1 Unified communications.** Email; SMS; internal notes; customer portal messages; connected mailbox ingestion; communication history.

**15.2 Inbox workflow.** Each message supports: category; sender; customer match; related lead or job; owner; priority; status; suggested action; draft response; comments; conversion to lead; filing; spam handling.

**15.3 Consent and compliance.** Maintain channel-specific consent. Respect: opt-out; suppression; quiet hours; unsubscribe; provider rejection; bounce; complaint. Every outbound message has a traceable origin and responsible actor.

**15.4 Delivery states — distinguish:** Queued; Submitted; Accepted by provider; Delivered (where provider confirms); Failed; Bounced; Rejected; Suppressed; Replied.

## 16. Automation and AI

**16.1 Philosophy.** Deterministic business rules are the foundation; AI models are optional intelligence providers. Core workflows must continue to function when AI services are unavailable.

**16.2 Capabilities.** Lead scoring; lead classification; duplicate candidate detection; assignment recommendations; next-best-action recommendations; missing-data detection; proposal completeness checks; follow-up scheduling; stale-opportunity detection; demand-gap analysis; inbox categorization; weekly summaries; job-document reminders; operational exception detection.

**16.3 Agent permission model.** Every agent has: defined identity; workspace scope; allowed tools; allowed record types; allowed actions; maximum execution limits; approval requirements; audit logging; failure handling.

**16.4 Autonomy levels.** **Level 0 — Observe** (read authorized data, generate insights). **Level 1 — Recommend** (suggest an action with supporting evidence). **Level 2 — Prepare** (create drafts, tasks, or proposed changes without external effects). **Level 3 — Execute low-risk actions** (explicitly authorized, reversible). **Level 4 — Execute controlled business actions** (only where workspace policy, authorization, and audit controls permit). Financial, legal, customer-facing, and irreversible actions require appropriate human approval.

**16.5 Agent execution lifecycle.** Trigger → permission check → context retrieval → input validation → decision → policy validation → approval if required → execution → result verification → audit event → outcome measurement. An agent must never grant itself additional permissions or bypass application authorization.

**16.6 AI quality controls.** Versioned prompts and rules; golden test cases; adversarial tests; human review sampling; confidence thresholds; error monitoring; latency and cost limits; explainable recommendations; replay and investigation tools.

## 17. Reporting and business intelligence

**17.1 Financial definitions — must distinguish:** estimated pipeline; proposal value; approved proposal value; signed contract value; approved change-order value; invoiced value; collected cash; outstanding receivables; refunds and credits. Never presented as interchangeable metrics.

**17.2 Core metrics.** *Sales:* lead volume; lead source; lead response time; qualification rate; proposal creation time; proposal approval time; proposal-to-Won conversion; win rate; lost reasons. *Operations:* active jobs; scheduled jobs; job completion time; delayed jobs; missing field reports; timesheet compliance; crew utilization; change-order frequency. *Financial:* signed contract value; invoiced value; collected cash; outstanding receivables; job costs; gross margin where cost data is complete. *Customer:* repeat customers; retention; lifetime value; customer response time; complaint/issue rate. *Automation:* runs; success rate; failure rate; actions accepted; actions rejected; manual intervention rate; time-saved estimates.

**17.3 Reporting requirements.** Consistent filters; date-range selection; workspace timezone; drill-down; CSV export; saved reports; role-based access; reconciled totals; clear metric definitions.

## 18. Billing and subscription management

**18.1 Billing model.** Subscription plans; monthly and annual billing; trials; seat limits; usage entitlements; upgrades; downgrades; proration; cancellation; failed payments; invoices; tax handling where applicable.

**18.2 Entitlement enforcement.** Server-side. The UI may hide unavailable features but must never be the only enforcement mechanism.

**18.3 Packaging.** **Core:** lead management; customer records; Work Queue; proposals; approval workflow; basic automation; standard reports. **Operations:** jobs; scheduling; field reports; timesheets; document checklists; advanced reporting; operational automation. **Growth:** campaigns; advanced lead-source analytics; demand-gap intelligence; advanced integrations; more automation capacity. **Enterprise:** advanced permissions; multi-location administration; custom workflows; enterprise integrations; higher limits; advanced support and governance. Pricing must be validated through paid customer pilots and customer economics rather than chosen solely from competitor comparisons.

## 19. Platform administration

**19.1 Platform console.** Workspace search; workspace status; subscription state; integration health; job queue health; failed deliveries; dead-letter queue; security events; feature flags; usage metrics; support case history; deployment information.

**19.2 Support access.** Impersonation must: require explicit privileged permission; display a persistent support-mode banner; record administrator and reason; be time-limited; avoid revealing secrets; be fully audited.

## 20. Security, privacy and governance

**20.1 Authentication.** Secure session handling; strong password hashing; password reset; email verification; optional MFA; session revocation; login throttling; secure cookies; device/session visibility.

**20.2 Authorization.** Role-based access combined with explicit permissions and resource-level scope. Enforce authorization on every API operation. A user must not gain access by changing an identifier in a URL or request body.

**20.3 Multi-tenancy.** Every tenant-owned entity scoped to a workspace; database constraints and query-level safeguards where possible. Cross-tenant isolation tested for: reads; writes; search; exports; files; notifications; background jobs; integrations; reports.

**20.4 Secrets.** Never return raw secrets in ordinary settings responses; encrypt integration credentials at rest; rotate credentials; restrict access; audit secret changes; prevent secret exposure in logs.

**20.5 Audit.** Authentication; permission changes; billing; API-key changes; customer data exports; proposal approval; signature events; job changes; data deletion; agent actions; support access.

**20.6 Data governance.** Retention; deletion; export; backup; restoration; legal holds where needed; customer data access; incident response; subprocessor disclosures. Obtain legal review for privacy, e-signature, messaging, payments, and applicable industry obligations.

## 21. Technical target architecture

**21.1 Principles.** Modular monolith initially; clear domain boundaries; transactional business operations; durable asynchronous processing; explicit API contracts; centralized authorization; observable background work; portable infrastructure; no premature microservices.

**21.2 Application architecture.** *Frontend:* React + TypeScript, domain-oriented structure (Leads, Customers, Proposals, Approvals, Jobs, Scheduling, Communications, Reports, Automations, Settings). *Backend:* Node.js + TypeScript may remain; separate route handlers, domain services, repositories, policy/authorization services, integration adapters, background workers. *Database:* **PostgreSQL is the production relational database** — foreign keys, unique constraints, transactions, indexed query paths, versioned migrations, connection pooling. SQLite may remain a local development or controlled demonstration option, but is not the target multi-tenant production database. *Background processing:* durable queue with atomic job claims, visibility timeout/leases, retries, dead-letter handling, idempotency, concurrency controls, monitoring. *File storage:* private object storage with signed URLs, malware scanning, encryption, retention policies, versioning where appropriate. *Integrations:* provider adapters behind stable internal interfaces; a provider outage must not corrupt local business state.

## 22. Core data model

Canonical entities: Workspace · User · Role · Permission · Session · Customer · Person · Customer Location · Lead · Lead Source · Lead Event · Duplicate Candidate · Task · Approval · Proposal · Proposal Version · Proposal Line · Price Book · Price Book Item · Signature · Payment · Job · Job Assignment · Schedule Event · Crew Member · Timesheet · Labor Entry · Field Report · Change Order · Document · Document Requirement · Conversation · Message · Campaign · Automation · Agent Run · Webhook Endpoint · Webhook Delivery · Integration · Audit Event · Subscription · Entitlement · Invoice Reference · Notification · Outbox Event · Background Job. Every entity must have an explicit lifecycle, ownership model, tenant scope, and retention policy.

## 23. Reliability and observability

**23.1 Reliability requirements.** No duplicate jobs from repeated conversion requests; no duplicate payment processing; no silent loss of webhook deliveries; no hidden migration failure; no partial finalization of core business operations; no cross-tenant data leakage; no unbounded background processing; no external request without timeout; no irreversible action without audit evidence.

**23.2 Outbox architecture.** When a business transaction requires an external effect: (1) commit the local business state; (2) persist an outbox event in the same transaction; (3) dispatch asynchronously; (4) record delivery per destination; (5) retry safely; (6) dead-letter after policy limits; (7) allow authorized replay.

**23.3 Monitoring.** API latency; error rates; database performance; queue depth; oldest pending job; webhook failure rate; provider errors; authentication failures; background worker health; backup age; storage consumption. Every critical operational failure has an alert owner and runbook.

## 24. Non-functional requirements (proposed initial targets, to be validated against realistic pilot workloads)

| Area | Target |
|---|---|
| Availability | 99.9% monthly target after production hardening |
| API response | p95 under 500 ms for ordinary read endpoints |
| Core writes | p95 under 750 ms, excluding external provider operations |
| Dashboard | Useful first render under 3 seconds for normal workspace sizes |
| Search | p95 under 1 second for normal indexed searches |
| Tenant isolation | Mandatory security acceptance criterion |
| Backup | Automated daily backups plus defined recovery objectives |
| Recovery | Tested restoration process |
| Queue processing | Observable, retryable, idempotent |
| Accessibility | WCAG 2.2 AA target |
| Mobile | Core field and approval journeys usable on common phone sizes |
| Data export | Authorized export with audit trail |
| Audit | Complete record of designated sensitive actions |

Define formal RPO and RTO with the business before production commitments are published.

## 25. UX and design system

**25.1 Principles.** Calm and professional; clear visual hierarchy; high information density without clutter; strong contrast; consistent spacing; predictable interactions; minimal unnecessary animation; accessible controls; mobile-first operational workflows.

**25.2 Component standards.** Reusable components for: tables; filters; search; status indicators; priority indicators; record headers; timelines; forms; drawers; modals; confirmation dialogs; empty states; error states; loading states; toasts; command palette; date and time controls.

**25.3 UX quality rules.** Destructive actions require confirmation; unsaved changes protected; errors explain recovery; long operations show progress; every status has a clear meaning; every important number is traceable; every important action has a visible result; no decorative feature obscures an operational priority.

## 26. Onboarding and activation

**26.1 Workspace setup (guided).** (1) Company profile. (2) Service catalog. (3) Price book. (4) Team and permissions. (5) Lead sources. (6) Proposal templates. (7) Approval rules. (8) Communication configuration. (9) Job templates. (10) Import existing data.

**26.2 Backlog Audit — the primary acquisition funnel.** Accept common CSV formats; map fields; normalize contacts; detect duplicates; estimate missing data; identify stale leads; identify unassigned leads; estimate pipeline at risk; produce a useful report before requiring payment. Never imply an estimated value is guaranteed recoverable revenue.

**26.3 Activation definition.** A workspace is activated when it has: imported or created real leads; configured a service catalog; added team members; assigned active work; created and sent a proposal; completed at least one meaningful workflow. A signup alone is not activation.

## 27. Product analytics and success measurement

**27.1 Activation:** time to first imported lead; first assigned lead; first proposal; first approval; first Won job. **27.2 Engagement:** weekly active users; Work Queue completion; leads with next actions; proposals created; jobs updated; field reports submitted. **27.3 Business outcomes:** backlog recovery; first-response time; proposal cycle time; win rate; signed contract value; collected cash; job completion time; documentation compliance. **27.4 Retention:** workspace retention; user retention; feature adoption; renewal; expansion revenue; support burden.

## 28. Product roadmap

- **Phase 0 — Correctness and governance:** pin the release baseline; reconcile product documentation; fix critical security issues; correct financial metric definitions; establish canonical business rules; build route permission matrix; establish reliable test baseline.
- **Phase 1 — Core revenue workflow:** harden lead intake; implement reliable identity resolution; strengthen Work Queue; harden proposals and approvals; ensure transactional Won conversion; reconcile customer and job records; improve communications delivery.
- **Phase 2 — Operational execution:** improve job lifecycle; improve scheduling; deliver mobile field workflows; harden field reports; improve timesheets and labor costing; add document requirements and escalation.
- **Phase 3 — Production platform:** PostgreSQL cutover; durable background queue; object storage; secret management; monitoring and alerting; backup and recovery; load and failure testing.
- **Phase 4 — Intelligence and automation:** explainable recommendations; automation policy engine; agent permission boundaries; human approval controls; automation evaluation and replay; demand-gap insights.
- **Phase 5 — Commercial scale:** self-service onboarding; Backlog Audit funnel; repeatable vertical templates; pricing validation; integration ecosystem; customer success workflows; enterprise controls where justified.

## 29. Explicit non-goals

Rebuilding the entire application in a different language without a measured reason · recreating all Salesforce functionality · replacing full accounting software · building a payroll system · native iOS/Android apps before PWA usage justifies them · a marketplace before a real integration ecosystem exists · LLM features merely for marketing · microservices before domain and scaling boundaries require them · complex workflow builders before standard workflows are reliable · expanding into multiple unrelated verticals simultaneously.

## 30. Definition of a successful Workpile

Workpile is commercially successful when a target service business can: (1) import and organize its existing backlog; (2) identify overlooked opportunities; (3) assign ownership and next actions; (4) qualify and prioritize demand; (5) create accurate proposals from controlled pricing; (6) approve and send proposals efficiently; (7) track customer engagement; (8) capture signatures and deposits; (9) convert signed work into jobs reliably; (10) schedule and coordinate employees; (11) capture field reports and labor; (12) track required documents; (13) measure signed, invoiced, and collected value separately; (14) identify operational exceptions; (15) run the system without depending on Workpile's founder or engineering team for routine work. **The ultimate product standard: Workpile must make it measurably harder for opportunities, approvals, customer commitments, and operational responsibilities to disappear.**

---

## Appendix A — The most important challenges to the existing product

| Existing direction | Product challenge | Target decision |
|---|---|---|
| Broad CRM parity | Creates a crowded product with weak differentiation | Focus on revenue execution |
| Large dashboard | Risks duplicating the Work Queue | Separate executive insight from daily work |
| One pipeline value | Creates financial ambiguity | Separate estimated, signed, invoiced, and collected |
| Lead-to-job conversion | Risks treating jobs as an extension of sales records | Establish a real job domain |
| Single-key deduplication | Can lose or incorrectly combine customer data | Identity resolution and controlled merge |
| One-size-fits-all stages | Different services have different workflows | Configurable lifecycle policies |
| Automation as a collection of agents | Can become opaque and difficult to govern | Central automation policy and execution framework |
| Per-seat pricing alone | May not reflect value or support costs | Validate packaging and onboarding economics |
| SQLite pilot architecture | Not the desired multi-tenant production foundation | PostgreSQL production target |
| Feature-rich navigation | Can make a small-business product feel overwhelming | Role-based navigation and contextual actions |

## Appendix B — Product architecture (four pillars on a shared foundation)

**Revenue Intelligence** (Backlog · Leads · Qualification · Prioritization · Demand gaps) · **Commercial Execution** (Proposals · Approvals · Signatures · Deposits · Follow-up) · **Service Operations** (Jobs · Scheduling · Crews · Field reports · Timesheets) · **Automation & Intelligence** (Recommendations · Work Queue · Policy · Agent execution · Analytics) — on the **shared platform foundation**: Identity · Permissions · Customer data · Audit · Billing · Integrations · Reliability.

## Appendix C — The commercial opportunity: sell an outcome, not software modules

The Backlog Audit is potentially Workpile's strongest acquisition mechanism. Instead of asking a business owner to buy a CRM subscription, show them what is happening to their existing opportunities: how many leads are unassigned; how many have not been contacted; how many have stale proposals; how many lack a next action; how much estimated opportunity value is sitting inactive; which service categories are repeatedly requested but not offered. Then demonstrate how Workpile turns that backlog into a controlled operating process. That is a much more compelling sales conversation than showing a prospect 20 navigation items.

## Appendix D — Recommended implementation order

1. **Correctness and trust** — security, data integrity, financial metric correctness, release governance, core workflow reliability before significant new functionality.
2. **The revenue-to-job lifecycle** — intake, ownership, proposal, approval, signature, conversion, job creation exceptionally reliable.
3. **Field operations** — scheduling, field reports, timesheets, documents, job accountability excellent for the initial target vertical.
4. **Intelligence and scale** — only after the first three are reliable: more autonomous AI, complex automation builders, advanced reporting, broad vertical expansion.

## Appendix E — What happens next (per this specification)

This target-state specification is the product blueprint. It is converted into a **requirements traceability and transformation matrix** mapping every existing screen, route, database entity, workflow, test, and documented feature to: **Keep unchanged · Keep but improve · Redesign · Consolidate · Replace · Remove · Build new · Defer** — the critical bridge between the current implementation and this target state, so the specification is not built as a second disconnected product and every change is traceable to an actual deficiency or business objective.

*— End of Target-State Specification v1.0 —*

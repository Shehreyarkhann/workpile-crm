# Workpile — Transformation & Traceability Matrix

**Bridge document:** maps the current implementation (v6 baseline, git tag `baseline-v6`) to the **Target-State Specification v1.0** (`TARGET-STATE-SPEC-V1.md`), section by section.
**Dispositions:** Keep · Keep + Improve · Redesign · Consolidate · Replace · Remove · Build New · Defer
**Phases:** per target spec §28. **Status column** reflects engineering reality as of Nov 10, 2026 (v7 tranche 1 shipped items marked ✅ DONE).

## A. Strategic decisions (§2)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| A — Stop generic CRM parity; win on revenue execution | v4 chased Salesforce parity (feed, campaigns, custom fields) | **Refocus** — parity features stay (sunk, working) but roadmap priority moves to the revenue→job lifecycle; no new parity features | 1+ | ✅ Adopted as policy; reflected in this matrix's sequencing |
| B — Work Queue = operational center; Home = executive | Work Queue exists as home conveyor; Dashboard/HomeDash mixes executive + operational content | **Keep + Improve** | 1 | Home keeps Morning Brief/exceptions/finances (executive); day-to-day completion stays in Work Queue. Add the §6.3 work-item model fields (escalation, completion reason) in Phase 1–2 |
| C — Separate the five money concepts | Home showed "Open pipeline" + "Won value" (blended) | **Replace** | 0 | ✅ **DONE in v7**: `financialSummary` + `GET /api/finances` + Home finances strip — estimated / proposals out / approved / signed / invoiced / collected / receivables, each with its definition |
| D — Job is a real domain | Jobs exist with stage/value/schedule/docs/time/change orders | **Keep + Improve** | 2 | Align stage names to target lifecycle (add Awaiting Scheduling/Ready/Completed/Cancelled semantics); payment & document status already separate fields |
| E — AI = accountable operator assistant | Deterministic agents with audit (`agent_runs`), approval boundary enforced | **Keep** | 4 | Add autonomy-level labels (L0–L4) to every automation + recommendation acceptance metrics |
| F — Vertical configuration first-class | Services catalog, doc templates, custom fields, price book per workspace | **Keep + Improve** | 5 | Package the G.C. configuration as the first repeatable **vertical template** (environmental) |

## B. Experience & IA (§§4–6, 25)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §4.1 Nav → 11 primary destinations | 20 destinations (v5 consolidation) | **Consolidate** | 1–2 | ✅ **DONE in v8**: sidebar = MENU (Home, Work Queue, Leads, Customers, Proposals, Jobs, Schedule, Inbox, Reports, Automations, Settings — the target 11 in order) + MORE group for the rest; new Proposals destination (list + Approvals tab) and standalone Inbox destination built; Schedule/Tasks open the Planner on the right tab; Billing moved inside Settings as a tab |
| §4.2 Global interface (search, ⌘K, create, notifications, switcher) | All present; search is authorized/workspace-scoped | **Keep** | — | ✅ **DONE in v13**: Help & shortcuts card in Settings (⌘K, queue keys, /audit link, how numbers trace) |
| §5 Home acceptance (defined calcs, drill-down, tz-aware, widget isolation) | Metrics defined in `metrics.ts`; drill-downs wired; finances now defined per-figure | **Keep + Improve** | 1 | ✅ **DONE in v13**: GET /api/metrics/periods + Home 'This week vs last week' strip (leads/proposals sent/won/jobs/signed value with deltas; window math + semantics stated in the payload). Workspace timezone already existed in Settings (record corrected) |
| §6 Work Queue item model + views (Waiting on Customer/Approval, Blocked, snooze w/ reason, escalation) | Queue computes items from live records; views: mine/team/overdue exist in My Day + queue filters | **Keep + Improve** | 1–2 | ✅ **DONE in v8 (fields)**: tasks gained snooze_until/snooze_reason/escalation_level/completion_reason/completed_by with API + UI (snoozed tasks leave open lists; completion records who + why). ✅ **DONE in v13**: waiting_customer queue items (proposal sent 3d+ with zero movement since send; the older proposal_cold item now covers the moved-then-quiet case — split in SQL so a lead never gets both). Waiting-on-Approval was already served by approval items |
| §25 UX rules (confirm destructive, progress, traceable numbers) | Mostly honored; finances strip advances traceability | **Keep** | — | Component-library formalization deferred (single-file client works; refactor only with Phase 3 platform work) |

## C. Revenue lifecycle (§§7–10)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §7.1 Canonical lead states (Contacting, Negotiation, Unserviceable as state) | States: NEW/WORKING/QUALIFIED/PROPOSAL/SENT/FOLLOWUP + finals; UNSERVICEABLE exists as lost-reason/final in demand-gap logic | **Keep + Improve** | 1 | ✅ **DONE in v13** exactly as specified: stored values untouched; metrics() now also returns by_state_canonical (WORKING→Contacting, SENT+FOLLOWUP→Negotiation) |
| §7.4 Identity resolution (multi-signal, confidence, review, merge audit, reversal) | Exact-key dedupe + merge with audit + re-pointing | **Improve** | 1 | ✅ **DONE in v7 (server)**: candidate detection across email/phone/name+service/name+location with confidence scores + signals in `/api/duplicates` + UI chips. ✅ **DONE in v13**: duplicate rows show phone/email/location side by side for field comparison; every merge writes a pre-merge snapshot (merge_snapshots) and is reversible from Duplicates → Recent merges — reversal restores the lead + contact and states its limits in the response (post-merge artifacts stay with the survivor) |
| §7.5 Readiness (non-blocking checklist) | Implemented in v3 (replaced the hard gate) | **Keep** | — | ✅ **DONE in v13**: packetCheck carries the item; both call sites (packet-check endpoint, approvals enrichment) compute it from completed site_visits |
| §7.6 Timeline distinguishes human vs system vs agent | lead_events carry actor; agent runs logged separately | **Keep + Improve** | 4 | ✅ **DONE in v13**: timeline events carry 👤 human / 🤖 agent / ⚙️ system chips from lead_events.actor |
| §8 Customer/Person separation + idempotent conversion | Accounts/contacts/memberships; conversion idempotent | **Keep** | 1 | ✅ Conversion now **transactional** in v7 (withTx) — §11.3 compliance |
| §9.2 Price overrides (permission + reason + before/after + approver) | Prices snapshot from price book; free lines unpriced | **Build New** | 1 | ✅ **DONE in v8**: builder price field per line; any change from book price requires a reason + can_approve/can_settings (validated BEFORE creation — rejected overrides persist nothing); recorded in `price_overrides` (prev/new/reason/user) + audit log |
| §9.3 Approval binds to immutable version; material change invalidates | Approval binds to proposal; edits create versions (v3 clone/versioning) | **Keep + Improve** | 1 | ✅ **DONE in v8**: approval stores a content hash at decision time; the send gate recomputes it — any material change returns `approval_invalidated`, creates a fresh pending approval, and notifies the approver (pre-v8 approvals grandfathered) |
| §9.4 Delivery honesty (delivered only on provider confirmation) | Enforced (test-mode labeled; delivered only on provider response) | **Keep** | — | — |
| §9.5 Cadences with quiet hours + reason-coded stops | 12-touch business-day cadence; stops reason-coded | **Keep + Improve** | 1 | ✅ **DONE in v8**: per-workspace quiet window + timezone (`/api/settings/cadence`, UI card in Automations); the cadence processor defers sends inside the window — never drops them |
| §10.2 Signature evidence (hash, consent version, IP/UA) | Evidence set captured incl. doc hash | **Keep** | — | Attorney review of the flow remains a founder/legal item |
| §10.3 Deposit ≠ signature states; no silent "paid" | Separate payment_status; paid only on provider confirmation | **Keep** | — | ✅ **DONE in v13**: POST /api/proposals/:id/refund (approval-gated, balance-enforced) writes a refund payment, moves payment_status to partially_refunded/refunded, audits it; proposal rows expose paid_total/refunded_total |

## D. Operations (§§11–15)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §11.3 Transactional job creation + outbox | Job creation idempotent ("exactly once"); handoff deliveries act as outbox for outcomes | **Improve** | 1 | ✅ **DONE in v7**: `ensureJobForLead` + conversion wrapped in `withTx` (BEGIN IMMEDIATE … COMMIT/ROLLBACK); outcome outbox already durable (deliveries + DLQ + replay) |
| §11.2 Job lifecycle states (Awaiting Scheduling → … → Closed/Cancelled) | 8 stages, different names; payment mixed into stage (PAID) | **Improve** | 2 | ✅ **DONE in v9**: 10 target stages; new jobs start Awaiting Scheduling; migration FIELD_DONE→Work Completed, PAPERWORK→Documentation Pending, PAID→Closed (payment lives in invoice_status, which syncs at Invoiced) |
| §11.4 Change orders affect contract value only when approved | Implemented (approved COs add to job value) | **Keep** | — | — |
| §12.2 Scheduling conflict warnings (double-book etc.) | Crew scheduling flags double-bookings | **Keep + Improve** | 2 | ✅ **DONE in v9**: POST /api/schedule returns same-worker/same-day cross-job conflicts (warning, never a block); exact duplicates still 409. ✅ **DONE in v13 (availability/overload)**: a third same-day assignment for a worker returns an explicit Overload warning in the schedule response. Skills warnings remain future by design — roster workers are name-only with no skills data to check against |
| §12.3 Mobile field experience + offline | PWA; Log Time global; field reports in-app | **Improve** | 2 | ✅ **DONE in v13**: client-side offline outbox (localStorage) for the two field writes — time entries and field-report submissions; failed-offline writes queue on-device with a clear 'saved on this device' message and replay in order on reconnect/app load |
| §13 Timesheets lifecycle (Draft→Submitted→Reviewed→Approved→Rejected→Exported) | Weekly timesheets + missing detection + export | **Keep + Improve** | 2 | ✅ **DONE in v9**: submitted → reviewed → approved/rejected (reason required, can_approve-gated) → exported; payroll CSV exports APPROVED sheets only and marks them exported (two legacy export tests updated to the lifecycle) |
| §13.3 Rate snapshots; missing class visible, never $0-silent | Implemented exactly so | **Keep** | — | — |
| §14 Document checklists → Work Queue items | Required-docs tracker; missing docs surface in queue | **Keep + Improve** | 2 | ✅ **CORRECTED + DONE in v9**: the paperwork queue item existed but its stage filter made it unreachable (dead branch) — fixed; missing required docs on active jobs now surface with the invoicing consequence. ✅ **Expiration DONE in v13**: documents carry expires_at (already in schema), a date control + expiry badge in LeadDetail, and doc_expiring Work Queue items at ≤14 days (score 85 once expired). Malware scanning remains open — it needs a scanning service decision (host-side) |
| §15 Inbox categories/playbooks; delivery states | 7-category triage + playbooks; comms states honest | **Keep** | — | ✅ **DONE in v13**: suppressions table + CRUD UI in Automations; enforcement at the single send door (queueMessage) — suppressed sends are stored as status 'suppressed' with the reason, delivery refuses them, and an active cadence stops reason-coded 'suppressed' |

## E. Intelligence, platform, governance (§§16–24, 26–27)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §16.3/16.4 Agent permission model + autonomy levels L0–L4 | 4 automations with toggles + run audit; approval boundary in code | **Keep + Improve** | 4 | ✅ **DONE in v11**: per-workspace agent_level (L0 Observe / L1 Suggest / L2 Draft / L3 Bounded execution / L4 Controlled execution) enforced in runAutomationsFor — L0 logs insights only, L1/L2 preview-only (L2 may create reactivation tasks), L3 applies armed automations, L4 adds the template first-touch (createLead gate). Policy UI in Automations (radio policy card); changes need can_settings + are audited. Migration preserves behavior: workspaces with follow-ups + automations armed land on L4 (G.C. pilot verified L4 on first boot) |
| §16.6 AI quality controls (golden tests, adversarial) | 121 tests incl. injection-scan coverage; `agent_runs` replayable | **Keep + Improve** | 4 | ✅ **DONE in v11**: tests/golden.test.ts — fixed scoring fixtures (hot 88 / cold 10 with all three flags), triage urgency + spam fixtures, injection adversarial (flagged + a poisoned lead stays NEW), dedupe golden (exact 0.99; notes the API dedupes on ingest, twins arrive via import), below-floor pricing adversarial (flagged, never hidden). Acceptance metrics endpoint + card: runs/actions/FPAR/merges + time-saved explicitly labeled ESTIMATE |
| §17.1 Financial definitions | Blended before v7 | **Replace** | 0 | ✅ **DONE in v7** (see §2C) — definitions ship inside the API payload itself |
| §18 Packaging (Core/Operations/Growth/Enterprise tiers) | Per-seat Solo/Team/Crew | **Validate** | 5 | Founder decision: keep per-seat until pilot economics say otherwise (target spec itself says validate via paid pilots) |
| §19 Platform console + audited impersonation | Ops Console exists; impersonation not built | **Keep + Build New** | 3 | ✅ **DONE in v10**: POST /api/admin/impersonate (platform-admin only, 60-minute window enforced at auth), red banner driven by /api/auth/me, one-click exit restoring the admin session, start/stop written to the target workspace's audit log + outbox |
| §20.2 Route permission matrix + enforcement on every operation | Session auth everywhere; 22 explicit guards pre-v7 | **Improve** | 0 | ✅ **DONE in v7**: matrix generated (`09-ROUTE-PERMISSION-MATRIX.md`, 247 routes inventoried, 38 explicit guards); settings-class writes + agent actions hardened (canned replies, inbox rules, webhooks, custom fields, assignment rules, doc templates, cleanup/reactivate/automation-run) |
| §20.3 Tenant isolation testing | Workspace scoping on all queries; isolation tests exist | **Keep + Improve** | 0/3 | ✅ **DONE in v13**: tests/v13 adds cross-workspace proofs for attachment download (404), lead read (404), merge history, suppression lists, and finances |
| §21 PostgreSQL production; durable queue; object storage | SQLite pilot; Postgres schema pack ready; in-process worker | **Defer→Build** | 3 | ✅ **DONE in v10 (build side)**: PG schema pack REGENERATED from the live schema (66 tables — was 34 and stale) via scripts/gen-pg-schema.mjs + tested sqlite→JSON export tool (12,186 rows on the demo DB); durable background_jobs queue (claim/retry/backoff/dead-letter) in the worker, push notifications as first consumer (no more fire-and-forget); object-storage adapter (local driver) + attachments API/UI. REMAINING: the actual PG cutover run + S3 driver — infrastructure steps for the production host, deliberately not forced mid-pilot |
| §23 Outbox pattern | Outcome deliveries implement it for handoffs | **Keep + Improve** | 3 | ✅ **DONE in v10**: outbox_events recorded with the write for lead.created / proposal.sent / approval.decided / job.created / impersonation; worker relay marks them processed; pending count exposed in /api/health/deep + /api/admin/platform |
| §24 NFR targets (p95, backups, RPO/RTO) | Health endpoint + backups exist; targets not yet formalized | **Defer** | 3 | ✅ **Formalized in v13** (docs/NFR.md): latency/availability/backup/RPO-RTO targets written down with current provisions stated honestly; p95 instrumentation + a restore drill remain as named next steps tied to the PG cutover |
| §26 Guided onboarding + Backlog Audit funnel | 5-step onboarding exists; audit is manual today | **Improve + Build New** | 5 | ✅ **DONE in v12**: public /audit page + POST /api/public/backlog-audit — CSV paste/upload → scored recovery report (recoverable $ with the method printed on it, top-10 work-first list); rows analyzed per-request and NEVER stored (aggregates only when an email is given — proven by test); 2,000-row cap |
| §27 Product analytics (activation/engagement/outcomes) | Metrics engine covers business outcomes; product analytics minimal | **Build New** | 5 | ✅ **DONE in v12**: GET /api/admin/activation — per-workspace milestones (leads/proposals/decided approval/jobs/won/team) + platform % funnel, rendered in Platform Admin. Packaging validation in the same tranche: seat caps enforced from the subscriptions record and proven at the Solo limit (422 seat_limit) |

## F. Mechanical inventories (generated, in the documentation package)

- **Routes:** all 255 registrations → `04-API-DOCUMENTATION.md`; auth/permission per route → `09-ROUTE-PERMISSION-MATRIX.md`. Default disposition: **Keep** (workspace-scoped, tested); exceptions are the v7-hardened guards above.
- **Tables:** all 62 → `03-DATABASE-SCHEMA.md`. Dispositions: **Keep** all current entities; **Build New** in later phases: price-override records (§9.2), persisted work-item fields (§6.3), suppression list (§15.3, built v13), support-access audit (§19.2, built v10). No table is slated for removal; `feature_flags`, `oauth_connections` remain config-gated.
- **Screens:** 20 current destinations → target 11 primary (§4.1): consolidation mapping in row B-1; every screen's function is preserved under the new IA.
- **Tests:** 121 passing at v7 (baseline 117 at v6) — the reliable baseline Phase 0 requires; new suites land with each tranche.

## G. Tranche plan (execution order per target Appendix D)

1. **Tranche 1 (v7) — Correctness:** ✅ baseline tag · docs reconciled · permission matrix + hardening · financial separation · identity resolution v2 · transactional conversion/job creation.
2. **Tranche 2 (v8) — Revenue lifecycle depth:** ✅ SHIPPED — nav consolidation to 11 · Proposals + Inbox destinations · price overrides with audit · approval content-hash invalidation · cadence quiet hours · work-item persisted fields · Billing inside Settings. 126/126 tests.
3. **Tranche 3 (v9) — Operations:** ✅ SHIPPED — job lifecycle alignment (§11.2 stages + migration) · scheduling conflict warnings · timesheet review lifecycle · paperwork→queue fix. (Offline field capture deferred — PWA shell exists; offline write queue is a Tranche 4 platform item.) 130/130 tests.
4. **Tranche 4 (v10) — Production platform:** ✅ SHIPPED — PG pack regenerated + export tool · durable queue · generalized outbox · storage adapter + attachments · health/deep + platform stats · audited impersonation. (Actual PG cutover + S3 driver remain host-side steps.) 135/135 tests.
5. **Tranche 5 (v11) — Intelligence:** ✅ SHIPPED — autonomy L0–L4 + policy UI · golden-case + adversarial suites · acceptance metrics. 145/145 tests.
6. **Tranche 6 (v12) — Commercial scale:** ✅ SHIPPED — Backlog Audit funnel · vertical packs (idempotent, $0 prices) · activation analytics · packaging validation. 149/149 tests.
7. **Tranche 7 (v13) — Close-out:** ✅ SHIPPED — suppression list + send-door enforcement · merge snapshots + reversal · waiting-on-customer view + cold/waiting split · doc expiration queue · refunds · site-visit readiness · canonical state labels · period comparisons · schedule overload warnings · offline field queue · timeline actor badges · help surface · isolation suite extension · NFR targets (docs/NFR.md). 155/155 tests. **Every matrix row is now closed except founder/host items (LAUNCH.md) and two named residuals: malware scanning for uploads (needs a scanner service) and p95 instrumentation/restore drill (tied to the PG cutover).**

*Matrix v1.0 — Nov 10, 2026. Update this file with each tranche; a row is closed only when its gap is verified in production, not when code merges.*

## UX phase (v14) — from the founder's ChatGPT UX review (Nov 10)
| Brief demand | Change | Evidence |
|---|---|---|
| §1 one journey, no dead ends | Server-computed Next step on every lead + a Next-step action bar whose button performs the step (messages/proposals/tasks/details/job) | tests/ux.test.ts; screenshots-v21/02 |
| §2C/§4 Customer 360 | Account detail aggregates proposals, payments, documents + proposed/collected/refunded totals; rendered in CustomerDetail | tests/ux.test.ts; screenshots-v21/04 |
| §3 onboarding = first outcome | GET /api/onboarding (7 data-detected steps) + Home activation checklist w/ progress + deep links; hides when complete | tests/ux.test.ts; screenshots-v21/01 |
| §4 connectivity | Job breadcrumb Lead → signed Proposal → Job (GET /api/jobs/:id origin) | tests/ux.test.ts; screenshots-v21/03 |
| §5 acceptance | One toast pattern; Esc closes modals; focus-visible; UX-ACCEPTANCE.md w/ 5 moderated test scenarios | docs/UX-ACCEPTANCE.md, docs/UX-BLUEPRINT.md |
Remaining by design: moderated testing with unfamiliar users (first cohort = the G.C. pilot team from Nov 16); formal component library deferred (§25).

## V15 — repository-audit close-out (Nov 10, second audit)
| Finding | Verdict on re-check | Fix |
|---|---|---|
| Duplicate onboarding (GettingStarted + OnboardingCard) | REAL — both rendered on Home | GettingStarted removed; single engine at /api/onboarding, 10 steps, stricter semantics (pricing needs a priced item; team = active users; first_send requires a VERIFIED provider delivery — test mode never counts; first_won = WON lead with its job) |
| Next Step buttons only navigate | REAL for most kinds | Bar now executes: Log the call (POST /contact, sets first response), Send the nudge, Create follow-up task, Set next step, inline Assign-owner select, Open the approval; job open/create already executed |
| 360 totals double-count versions | REAL | Proposed = current version per lead only; added signed, net collected (collected − refunds), outstanding (signed − net), with printed definitions |
| 360 rows static | REAL | Proposals/payments/documents rows click through to their lead/job |
| Job origin inferred, unordered | PARTLY STALE — jobs.proposal_id already existed and was written at creation; the v14 breadcrumb query ignored it | Breadcrumb now reads the stored proposal_id (fallback: latest signed, version-ordered); proposal segment clickable |
| API keys unguarded | REAL P0 | can_settings required on list/create/revoke; scope allowlist validated; create/revoke audited |
| Twilio webhook unsigned | REAL P0 | Endpoint disabled without TWILIO_AUTH_TOKEN; HMAC-SHA1 signature verified (timing-safe) when configured |
| Settings returns broad record | REAL in effect — workspaces carries source_api_key | GET /api/settings returns a field whitelist; the sync key never leaves the server; source URL exposed as host only |
| Proposal marked sent on failed delivery | REAL | Send commits only on sent/delivered/test_mode; suppressed → 422, provider failure → 502, no state change, no cadence enrollment |
| Cadence advances on failed delivery | REAL | Failed delivery: no advance, 6h retry, stop after 3 failures (fail_count) |
| Reactivation task duplication | REAL | Sweep skips leads with an open reactivation task |
| Job claiming not atomic | REAL (single-worker today) | Claim is a guarded UPDATE (status='queued' must match) |
| Sync URL SSRF | REAL | Custom source URLs: http(s) only, private/loopback/link-local blocked, redirect refused, 8s timeout |
| Screenshots-v21 not in repo | REAL | docs/screenshots-v21 + v22 committed; acceptance doc carries verification-status labels |
| Outbox has no consumers | PARTLY — webhooks fire via integrations emitEvent at write time; the outbox is the durable event record | Left as-is deliberately: wiring the relay to webhooks would double-deliver events that already emit directly |
| LLM agent orchestrator / PG cutover / monolith split | REAL but phased by design | Agent needs the founder's LLM provider + keys decision; PG remains the host cutover item; the audit itself prescribes incremental (not big-bang) refactor |
Tests: 165/165 (tests/v15.test.ts, 7 tests; slice11 Twilio test now signs its posts; ux onboarding total updated to 10).

## V16 — audit roadmap Phases 2+3 first increment (Nov 10)
| Item | Shipped |
|---|---|
| Customer 360 timeline (§1B.3) | Account detail merges lead events, messages in/out, approvals, signatures, payments, jobs, change orders, site visits into one chronological, clickable History (cap 80) |
| Work Queue bulk (§Priority 1.4) | Multi-select on lead-backed items (approvals excluded — decisions stay individual): bulk assign owner, snooze 1d/3d, create follow-up tasks; POST /api/queue/bulk, audited |
| Agent orchestrator v1 (§Priority 2) | server/orchestrator.ts: tool registry (prepare_proposals, ops_review, recover_revenue, exec_brief) + rules planner + policy = autonomy levels (draft tools plan-only below L2, recovery tasks below L3) + persistent runs (agent_runs) + report UI in AI Assistant ("tell it what to do", example chips, run history). Hard rules in code: never sends, never prices, approvals untouched. LLM provider seam (`llmProvider = null`) awaits the founder's provider/key decision |
Tests: 168/168 (tests/v16.test.ts). Screenshots: docs/screenshots-v23 (agent full-sweep executed live on demo data — 2 drafts created; queue bulk bar; 360 timeline).

## V17 — V15-audit close-out + Agentic AI transformation (Nov 10)
| Audit item | Shipped |
|---|---|
| A. PATCH settings secret return | Both GET and PATCH return the shared DTO (extended with all non-secret UI fields incl. template/booking/review keys); secrets (source_api_key, slack_webhook_url, llm_api_key) never leave the server — test-proven |
| B. Nudge consent + truthful status | SMS consent enforced at the CENTRAL send boundary (comms.queueMessage → blocked_consent) so UI, nudge, cadences and agent tools all inherit it; inbound call/SMS records its consent basis (inbound_call/inbound_sms); nudge returns honest sent/test_mode |
| C. SSRF depth | Resolver-grade guard (server/netguard.ts): every resolved address must be public (v4/v6/CGNAT/metadata/mapped); Slack test additionally pins hooks.slack.com; residual DNS-rebinding race documented in code |
| D. Job crash recovery | Worker leases (120s) + stale-lease recovery on every tick + idempotency keys on enqueue |
| E. True receivables | Invoice records + lines + payment allocation + overpayment refusal + void rules; finances invoiced/AR/overdue now derive from invoices; signed-but-uninvoiced is labeled "uncollected contract value" everywhere; one-click backfill for flag-era jobs |
| F. Delivery evidence | first_send requires provider-confirmed 'delivered' (accepted no longer counts) |
| §3/P1 Agent platform | Provider layer (Anthropic/OpenAI/rules), governed tool registry (13 tools, control classes), persisted executions with per-step approval, global Agent panel, follow-ups via parent executions, token tracking, AGENT-SPEC.md |
| L3≈L4 | L4 sweep now also drafts proposals proactively (test-proven difference) |
Tests: 177/177 (tests/v17.test.ts, 9 tests incl. injection + governance evals; slice9/slice12/slice16/v7 tests updated where v17 deliberately changed contracts — PATCH response shape, nudge truthfulness, invoice-record finances, booking-slug ensure restored after the v15 DTO rewrite dropped it). Screenshots: docs/screenshots-v24.
Named residuals: DNS-rebinding IP pinning; LLM multi-turn tool loop (v17 plans in one structured call); provider delivery callbacks depend on Resend/Twilio credentials (founder items); PG cutover unchanged.

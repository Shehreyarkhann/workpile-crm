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
| §4.2 Global interface (search, ⌘K, create, notifications, switcher) | All present; search is authorized/workspace-scoped | **Keep** | — | Add contextual help surface later |
| §5 Home acceptance (defined calcs, drill-down, tz-aware, widget isolation) | Metrics defined in `metrics.ts`; drill-downs wired; finances now defined per-figure | **Keep + Improve** | 1 | Add period comparison (WoW/MoM) widgets; workspace timezone setting |
| §6 Work Queue item model + views (Waiting on Customer/Approval, Blocked, snooze w/ reason, escalation) | Queue computes items from live records; views: mine/team/overdue exist in My Day + queue filters | **Keep + Improve** | 1–2 | ✅ **DONE in v8 (fields)**: tasks gained snooze_until/snooze_reason/escalation_level/completion_reason/completed_by with API + UI (snoozed tasks leave open lists; completion records who + why). Remaining: Waiting-on-Customer/Approval queue views |
| §25 UX rules (confirm destructive, progress, traceable numbers) | Mostly honored; finances strip advances traceability | **Keep** | — | Component-library formalization deferred (single-file client works; refactor only with Phase 3 platform work) |

## C. Revenue lifecycle (§§7–10)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §7.1 Canonical lead states (Contacting, Negotiation, Unserviceable as state) | States: NEW/WORKING/QUALIFIED/PROPOSAL/SENT/FOLLOWUP + finals; UNSERVICEABLE exists as lost-reason/final in demand-gap logic | **Keep + Improve** | 1 | Rename WORKING→CONTACTING, SENT/FOLLOWUP→NEGOTIATION semantics in reporting labels; keep stored values (migration-safe), canonicalize in the metrics layer |
| §7.4 Identity resolution (multi-signal, confidence, review, merge audit, reversal) | Exact-key dedupe + merge with audit + re-pointing | **Improve** | 1 | ✅ **DONE in v7 (server)**: candidate detection across email/phone/name+service/name+location with confidence scores + signals in `/api/duplicates` + UI chips. Remaining: field-level conflict resolution UI + merge reversal |
| §7.5 Readiness (non-blocking checklist) | Implemented in v3 (replaced the hard gate) | **Keep** | — | Add "required site visit completed" item |
| §7.6 Timeline distinguishes human vs system vs agent | lead_events carry actor; agent runs logged separately | **Keep + Improve** | 4 | Visual actor badges in timeline (client-only change) |
| §8 Customer/Person separation + idempotent conversion | Accounts/contacts/memberships; conversion idempotent | **Keep** | 1 | ✅ Conversion now **transactional** in v7 (withTx) — §11.3 compliance |
| §9.2 Price overrides (permission + reason + before/after + approver) | Prices snapshot from price book; free lines unpriced | **Build New** | 1 | ✅ **DONE in v8**: builder price field per line; any change from book price requires a reason + can_approve/can_settings (validated BEFORE creation — rejected overrides persist nothing); recorded in `price_overrides` (prev/new/reason/user) + audit log |
| §9.3 Approval binds to immutable version; material change invalidates | Approval binds to proposal; edits create versions (v3 clone/versioning) | **Keep + Improve** | 1 | ✅ **DONE in v8**: approval stores a content hash at decision time; the send gate recomputes it — any material change returns `approval_invalidated`, creates a fresh pending approval, and notifies the approver (pre-v8 approvals grandfathered) |
| §9.4 Delivery honesty (delivered only on provider confirmation) | Enforced (test-mode labeled; delivered only on provider response) | **Keep** | — | — |
| §9.5 Cadences with quiet hours + reason-coded stops | 12-touch business-day cadence; stops reason-coded | **Keep + Improve** | 1 | ✅ **DONE in v8**: per-workspace quiet window + timezone (`/api/settings/cadence`, UI card in Automations); the cadence processor defers sends inside the window — never drops them |
| §10.2 Signature evidence (hash, consent version, IP/UA) | Evidence set captured incl. doc hash | **Keep** | — | Attorney review of the flow remains a founder/legal item |
| §10.3 Deposit ≠ signature states; no silent "paid" | Separate payment_status; paid only on provider confirmation | **Keep** | — | Add refund recording |

## D. Operations (§§11–15)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §11.3 Transactional job creation + outbox | Job creation idempotent ("exactly once"); handoff deliveries act as outbox for outcomes | **Improve** | 1 | ✅ **DONE in v7**: `ensureJobForLead` + conversion wrapped in `withTx` (BEGIN IMMEDIATE … COMMIT/ROLLBACK); outcome outbox already durable (deliveries + DLQ + replay) |
| §11.4 Change orders affect contract value only when approved | Implemented (approved COs add to job value) | **Keep** | — | — |
| §12.2 Scheduling conflict warnings (double-book etc.) | Crew scheduling flags double-bookings | **Keep + Improve** | 2 | Add availability + skills + prerequisite warnings |
| §12.3 Mobile field experience + offline | PWA; Log Time global; field reports in-app | **Improve** | 2 | Offline queue for time/reports = Build New (pilot-justified) |
| §13 Timesheets lifecycle (Draft→Submitted→Reviewed→Approved→Rejected→Exported) | Weekly timesheets + missing detection + export | **Keep + Improve** | 2 | Add explicit review states |
| §13.3 Rate snapshots; missing class visible, never $0-silent | Implemented exactly so | **Keep** | — | — |
| §14 Document checklists → Work Queue items | Required-docs tracker; missing docs surface in queue | **Keep** | — | Add expiration tracking + malware scanning (Phase 3, with object storage) |
| §15 Inbox categories/playbooks; delivery states | 7-category triage + playbooks; comms states honest | **Keep** | — | Add suppression list management UI |

## E. Intelligence, platform, governance (§§16–24, 26–27)

| Target | Current state | Disposition | Phase | Status / gap |
|---|---|---|---|---|
| §16.3/16.4 Agent permission model + autonomy levels L0–L4 | 4 automations with toggles + run audit; approval boundary in code | **Keep + Improve** | 4 | Label each automation with its level (score/assign=L3 reversible; dedupe=L2 prepare+confirm; reactivate=L2 tasks only); central policy record per workspace |
| §16.6 AI quality controls (golden tests, adversarial) | 121 tests incl. injection-scan coverage; `agent_runs` replayable | **Keep + Improve** | 4 | Golden-case suite per agent as its own test file |
| §17.1 Financial definitions | Blended before v7 | **Replace** | 0 | ✅ **DONE in v7** (see §2C) — definitions ship inside the API payload itself |
| §18 Packaging (Core/Operations/Growth/Enterprise tiers) | Per-seat Solo/Team/Crew | **Validate** | 5 | Founder decision: keep per-seat until pilot economics say otherwise (target spec itself says validate via paid pilots) |
| §19 Platform console + audited impersonation | Ops Console exists; impersonation not built | **Keep + Build New** | 3 | Impersonation with banner + audit = Build New in Phase 3 |
| §20.2 Route permission matrix + enforcement on every operation | Session auth everywhere; 22 explicit guards pre-v7 | **Improve** | 0 | ✅ **DONE in v7**: matrix generated (`09-ROUTE-PERMISSION-MATRIX.md`, 247 routes inventoried, 38 explicit guards); settings-class writes + agent actions hardened (canned replies, inbox rules, webhooks, custom fields, assignment rules, doc templates, cleanup/reactivate/automation-run) |
| §20.3 Tenant isolation testing | Workspace scoping on all queries; isolation tests exist | **Keep + Improve** | 0/3 | Extend isolation suite to exports/files/background paths |
| §21 PostgreSQL production; durable queue; object storage | SQLite pilot; Postgres schema pack ready; in-process worker | **Defer→Build** | 3 | The Phase 3 tranche: cutover + queue + storage, in that order |
| §23 Outbox pattern | Outcome deliveries implement it for handoffs | **Keep + Improve** | 3 | Generalize to all external effects with the durable queue |
| §24 NFR targets (p95, backups, RPO/RTO) | Health endpoint + backups exist; targets not yet formalized | **Defer** | 3 | Formalize with production hosting decision |
| §26 Guided onboarding + Backlog Audit funnel | 5-step onboarding exists; audit is manual today | **Improve + Build New** | 5 | Self-serve audit page (CSV → report before payment) |
| §27 Product analytics (activation/engagement/outcomes) | Metrics engine covers business outcomes; product analytics minimal | **Build New** | 5 | Activation funnel events (first lead/assignment/proposal/won timestamps per workspace) |

## F. Mechanical inventories (generated, in the documentation package)

- **Routes:** all 255 registrations → `04-API-DOCUMENTATION.md`; auth/permission per route → `09-ROUTE-PERMISSION-MATRIX.md`. Default disposition: **Keep** (workspace-scoped, tested); exceptions are the v7-hardened guards above.
- **Tables:** all 62 → `03-DATABASE-SCHEMA.md`. Dispositions: **Keep** all current entities; **Build New** in later phases: price-override records (§9.2), persisted work-item fields (§6.3), suppression list (§15.3), support-access audit (§19.2). No table is slated for removal; `feature_flags`, `oauth_connections` remain config-gated.
- **Screens:** 20 current destinations → target 11 primary (§4.1): consolidation mapping in row B-1; every screen's function is preserved under the new IA.
- **Tests:** 121 passing at v7 (baseline 117 at v6) — the reliable baseline Phase 0 requires; new suites land with each tranche.

## G. Tranche plan (execution order per target Appendix D)

1. **Tranche 1 (v7) — Correctness:** ✅ baseline tag · docs reconciled · permission matrix + hardening · financial separation · identity resolution v2 · transactional conversion/job creation.
2. **Tranche 2 (v8) — Revenue lifecycle depth:** ✅ SHIPPED — nav consolidation to 11 · Proposals + Inbox destinations · price overrides with audit · approval content-hash invalidation · cadence quiet hours · work-item persisted fields · Billing inside Settings. 126/126 tests.
3. **Tranche 3 (v9) — Operations:** job lifecycle alignment · scheduling warnings · timesheet review states · offline field capture.
4. **Tranche 4 (v10) — Production platform:** PostgreSQL cutover · durable queue + generalized outbox · object storage · monitoring/alerting · impersonation.
5. **Tranche 5 (v11) — Intelligence:** autonomy levels + policy engine UI · golden-case agent suites · acceptance metrics.
6. **Tranche 6 (v12) — Commercial scale:** self-serve Backlog Audit · vertical templates · activation analytics · packaging validation.

*Matrix v1.0 — Nov 10, 2026. Update this file with each tranche; a row is closed only when its gap is verified in production, not when code merges.*

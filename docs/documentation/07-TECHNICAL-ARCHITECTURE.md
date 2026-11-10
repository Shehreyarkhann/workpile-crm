# Workpile — Technical Architecture

*Extracted from the Master Specification (§4, §14.4–14.5), current at v6 / commit `6155c8a`.*

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

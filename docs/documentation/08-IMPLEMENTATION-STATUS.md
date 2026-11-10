# Workpile — Implementation Status

As of **November 10, 2026**, production commit `b513704` (+ docs commit `6155c8a`). Everything below is verified state, not plan.

## Production

| Item | Status |
|---|---|
| Live URL | ✅ workpile.claimpaid.io (pilot bridge on the ClaimPaid droplet) |
| Running version | ✅ **v6** — verified from outside as a real user (login, `/api/home`, doc templates, calendar incl. completed, notifications) |
| CI | ✅ GitHub Actions green on `main` |
| Tests | ✅ **117/117** automated tests + end-to-end smoke |
| Scale proof | ✅ Demo workspace: 2,613 leads / 2,001 won / $28.3M pipeline; v3 migration backfilled 2,001 jobs on it |
| Co-host safety | ✅ claimpaid.io verified unaffected (HTTP 200) after every deploy |

## Pilot workspace — G.C. Environmental (live data)

| Item | Status |
|---|---|
| Members | ✅ 3 seats exactly: Gregory (OWNER), Shehreyar (OPS_ADMIN), Daniel (PM) |
| Catalog | ✅ 55 real services in 4 divisions; 18-item price book at pilot rates (owner replaces with real book) |
| Data | ✅ 50 leads · 6 jobs · 6 customers (auto-converted, $140,205 lifetime) · 2 approvals awaiting Gregory |
| **Agent** | ✅ **4/4 automations enabled in production; a sweep ran minutes after the v6 deploy** |
| North Star | ✅ 11 proposals sent this week (of 17 built) — live from `/api/home` |
| Doc templates | ✅ 4 varieties seeded in the workspace |

## Feature completeness (vs. specification)

| Area | Status |
|---|---|
| Lead lifecycle, board, finals discipline, readiness | ✅ Complete (v3) |
| Proposals, packet check, approval policy, G/B/B, view tracking | ✅ Complete |
| E-sign with evidence, deposits (Stripe, test mode) | ✅ Complete — live Stripe keys pending (founder) |
| Jobs, schedule, time/labor/field reports, change orders, doc chase | ✅ Complete |
| Follow-up cadences (12-touch), callbacks, reactivation | ✅ Complete |
| Inbox triage + playbooks, email backlog import | ✅ Complete |
| §14.5 Outcome Handoff (HMAC webhooks, DLQ, ack) | ✅ Complete |
| CRM layer: accounts/people/conversion, feed, campaigns, custom fields, duplicates/merge, assignment rules | ✅ Complete (v4) |
| Planner (tasks + agenda calendar), Library | ✅ Complete (v5) |
| Notifications with record targeting | ✅ Complete (v5) — targeting applies to notifications created since the deploy; legacy rows route via lead link |
| Document templates + workspace logo + rich-text images | ✅ Complete (v5) |
| Agentic command center (home, agent panel, run modal) | ✅ Complete (v6) |
| Billing: per-seat plans, trials, seat enforcement | ✅ Complete — live Stripe price objects pending (founder) |
| Comms (email/SMS) | ⚠️ Adapters complete; **test mode** until Resend/Twilio credentials (founder) |
| Gmail/Outlook mailboxes, QuickBooks | ⚠️ Code complete, config-gated on app registrations (founder) |
| Web Push | ⚠️ Built; VAPID keys pending (founder) |
| PostgreSQL production cutover | ⚠️ Schema + migration pack ready; pilot runs SQLite by design |

## Founder-owned launch blockers (the complete list — from LAUNCH.md)

1. Register **workpile.io**, point production DNS.
2. Stripe live keys + 6 price objects (annual $239.88 / $599.88 / $959.88; monthly at list).
3. Resend + Twilio credentials.
4. VAPID keys; Gmail/Microsoft OAuth registrations; Intuit credentials.
5. Attorney pass over legal drafts.

## Known limitations (stated plainly)

- No external LLM is used anywhere in production — the AI layer is a deterministic rule engine with agent-run auditing (Master Spec §8.0). LLM-backed drafting is a designed extension point, not a shipped feature.
- The repository is public (founder's decision); it contains no credentials by design — all secrets are server environment variables.
- Deploy is a manually-run (idempotent) script on the droplet console; no downtime steps, additive auto-migrations on boot.

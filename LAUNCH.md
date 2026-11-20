# LAUNCH — Workpile, US Market Readiness
**Updated:** November 20, 2026 · **State:** Live in production at workpile.claimpaid.io (v112+). Full launch audit: `~/workspace/goals/workpile-lead-backlog-saas/files/workpile-launch-audit-2026-11-20.md`.

## What is built, tested, and live (125 test files)
- Core loop: ingestion (API/form/CSV/spreadsheet/inbox) → smart triage gate → Work Queue → proposals (price-book only, approval-gated, content-hash invalidation) → e-sign (document-hash-bound links) → jobs → work orders → inspections (13 standards templates, reviewer separation-of-duties, corrective actions) → invoicing (tax + milestone billing) → payments.
- Chain model: Lead L→Quote Q→Project P numbering on every record; five separated money views (pipeline / proposal / contract / invoiced / collected), each drillable to its records.
- Copilot: multi-turn AI operator with approval-gated tools, business memory, self-learning; per-tool earned autonomy.
- Mail: Gmail connected (90-day paginated backfill, quota backoff); Outlook OAuth built. Public Gmail for all customers awaits Google verification + CASA (test-user cap 100 until then).
- Money integrations (coded, dormant on keys): per-workspace Stripe Connect (client payments land in the client's own account), QuickBooks invoice + payment sync, Workpile's own subscription billing.
- Pricing V2: per-workspace Starter $39 / Pro $119 / Business $299 per month billed annually (monthly $49/$149/$349), metered on active requests (150/750/3,000), office users 2/5/15 the only hard cap, 30-day no-card Pro trial, legacy keys grandfathered.
- Security (v112): parameterized SQL throughout, allowlist HTML sanitizer, attachment MIME allowlist + safe downloads, SSRF-guarded outbound URLs, security headers (CSP/HSTS/nosniff), workspace-scoped authorization, TOTP MFA, fail-closed webhooks.
- Customer portal (flag-gated), tenant data export (secrets stripped), scheduled Word reports, offline field write queue, PWA.

## Open items — founder actions
1. **Name + domain:** "Workpile" trademark clearance + workpile.io registration still open. Product currently lives on workpile.claimpaid.io.
2. **Legal:** Attorney pass on /terms /privacy /dpa (still marked Draft in-product). Do not market certifications not held.
3. **Stripe go-live:** Platform STRIPE_SECRET_KEY + webhook secret + the six Pricing V2 price IDs + Connect events on the webhook. Activates subscription charging and per-workspace client payments.
4. **Sending:** Resend domain verification (DNS first, key second — see runbook), then Twilio out of test mode, then Intuit PRODUCTION keys for QuickBooks sync.
5. **Google verification pack:** Privacy/terms pages + scope justification + demo video → verification + CASA for gmail.readonly (2–6 weeks).
6. **Support channel:** A real support address on a verified domain, linked in-product, before paid customers arrive.

## Open items — code/ops
- Schedule deploy/backup.sh in the deploy (script exists; not wired) + run one restore drill (gates the Postgres cutover).
- Plan-feature enforcement for sms / sending_domain flags (api flag is enforced today).
- Postgres cutover rehearsal before national scale (schema pack: db/postgres-schema.sql, 66 tables).

## Run the readiness check anytime
`node deploy/check-env.mjs` — prints exactly which external accounts are still unset; the app never fakes a live integration.

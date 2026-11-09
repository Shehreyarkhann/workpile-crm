# LAUNCH — Workpile, US Market Readiness
**Date:** November 9, 2026 · **State:** All code complete. Remaining items are accounts/keys/decisions only — listed honestly at the bottom.

## What is built and verified (tests 20/20 + end-to-end smoke + live HTTP checks)
- Core loop: ingestion (API/form/CSV/inbox) → triage/dedupe → qualification → Completeness Gate → Approval Inbox → proposals (price-book only) → e-sign → deposit → follow-ups → finals delivered to the customer's own platform (pull API + signed webhooks + ack) — Won/Lost/No Response/N/A/Junk/Duplicate
- Gregory P0s: field reports + timesheets chase, full inbox triage (7 categories), site visits, documents, no-code handoff data (API + monitor), DOCX-editable proposals, 6-bucket owner board, Weekly Status Report data (metrics service)
- §26 production layer: prompt-injection invariant + red-team tests, outbox + DLQ + replay, admin console, feature-flag canary, SLO synthetics, billing completeness
- Money: customer deposits via Stripe (test mode until live key) + Workpile's own subscriptions ($299/$599/$999, 30-day no-card trial, plan caps with 80% soft-warn, checkout + signed webhooks, past-due handling, Stripe Tax enabled on checkout)
- Customer portal (flag-gated): proposal status, project reference, site visits, document intake
- Change orders: price-book deltas through the same approval discipline
- Marketing: public landing with pricing + trial positioning, /terms /privacy /dpa draft pages, website embed snippet with TCPA consent language
- Deploy: Dockerfile + compose, GitHub Actions CI (test/build/smoke), nightly backup script, db/postgres-schema.sql + cutover guide, deploy/check-env.mjs readiness report

## Launch checklist — founder actions only (no code left)
1. **Name + domain:** Clear "Workpile" (trademark + domain) or pick a final name; buy domain; point DNS at the host.
2. **Hosting:** Deploy the Docker image (DigitalOcean/AWS). Set LEADFLOW_DB volume or run the Postgres cutover (db/MIGRATION.md).
3. **Stripe (one account, ~30 min):** Create account, 3 subscription prices + deposit capability, paste STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_* into .env, register webhook → /webhooks/stripe. Everything flips from test/not-configured to live automatically.
4. **Inbox OAuth apps (optional at launch):** Register Google + Microsoft apps, set client IDs/secrets — connections activate; until then manual/API/CSV ingestion is fully live.
5. **Legal:** Attorney pass on /terms /privacy /dpa drafts (they are marked Draft in-product until this is done). Do not market "SOC 2" or any certification not held.
6. **Design Partner #1:** Run the §19/§25 pilot: Backlog Clear fee + 90 days, before/after numbers (FPAR, approval cycle, backlog clear date) as the renewal + case-study gate — case study only with written permission.
7. **GitHub:** On the founder's word, create the private repo and push `main` (code is committed locally; CI workflow ships with it).

## Run the readiness check anytime
`node deploy/check-env.mjs` — prints exactly which external accounts are still unset; the app never fakes a live integration.

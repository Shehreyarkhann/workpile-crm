# LeadFlow OS

AI-agentic lead backlog, approval & proposal SaaS for small service businesses.
Full product specification: `docs/FULL-SPEC.md` (v2.0, production-complete) ·
Owner-perspective review: `docs/GREGORY-REVIEW.md` ·
Engineering review: `docs/ENGINEERING-REVIEW.md`

**Core loop:** Leads arrive via API / website form / CSV / inbox → triage + dedupe →
qualification → Completeness Gate → one-tap Approval Inbox (target: 90%+ first-pass
approval) → generative proposals from the business's own price book & templates →
follow-up cadence → Won / Lost / N/A — and **every final outcome is delivered to the
customer's own platform** via the Handoff API (pull + webhooks + acknowledgement),
because a Won lead becomes a project they run in their system.

## Quick start
```bash
npm install
node server/seed.ts      # demo workspace (generic sample data only)
npm run build            # build the client
npm start                # http://localhost:4173
```
Demo logins (local demo only): `owner@demo.test` / `manager@demo.test` / `ops@demo.test` — password `demo1234`.
Demo API key is printed by the seed command.

## Public API (spec §14)
- `POST /v1/leads` — API-key auth (`leads:write`), `Idempotency-Key` supported, phone/email dedupe
- `GET /v1/outcomes` — final-outcome feed (won/lost/no_response/na_unserviceable/junk/duplicate)
- `GET /v1/projects/{id}` — Won Project Package
- `POST /v1/outcomes/{deliveryId}/ack` — customer acknowledges ingestion with their external ID

## Tests
```bash
npm test        # unit: state machine, injection guard, triage, gate, demand gap
npm run smoke   # end-to-end journey on a temp DB (create → gate → approve → won → ack)
```

## Architecture
- `server/` — Express + TypeScript (Node type-stripping), Node built-in SQLite for dev
  (schema mirrors spec §13; Postgres is the production target), single Metrics Service (§10.2)
- `src/` — React + Vite client: Board (6 plain owner buckets), Approval Inbox, Executive
  Dashboard, Demand Gap, Handoff Monitor, Ops (field reports / timesheets / site visits)
- Agents (§12) are deterministic-first with structured outputs + `agent_runs` audit;
  ingested content is treated as data, never instructions (§26 prompt-injection invariant).
  Price, approval, and send transitions are code-gated — no agent output can trigger them.

## Status
Phase 0 + Phase 1 core + Phase 2 essentials (proposals, approvals, KPIs, handoffs) implemented
and smoke-verified. See spec §20 for the full roadmap and §26 for production blockers.

# Workpile — Complete Documentation Package

**Product:** Workpile (workpile.io) · **Live pilot:** workpile.claimpaid.io · **Version documented:** v6, commit `6155c8a` · **Date:** November 10, 2026

This package is the complete documentation set for the Workpile software. Every data-driven document (API, schema, modules) was **generated mechanically from the production source code**; narrative documents are extracted from or written against the same codebase. Nothing here describes unreleased software as if it existed — planned items are labeled as such (see Implementation Status).

## Contents

| # | Document | What it covers |
|---|---|---|
| — | [WORKPILE-FULL-SPECIFICATION.md](WORKPILE-FULL-SPECIFICATION.md) | **The master software specification** — product definition, personas, packaging, architecture, data model, module catalog, 12 workflows, the full AI system (deterministic / agentic / generative), governance invariants, integrations, security, UX system, metrics, engineering handbook, roadmap. 15 sections. |
| 01 | [01-UI-UX-SCREEN-DOCUMENTATION.md](01-UI-UX-SCREEN-DOCUMENTATION.md) | Screen-by-screen documentation mapped to the screenshot sets in `screenshots/` (19 captures across v11/v12/v13 sets covering the current UI). |
| 02 | [02-MODULE-SPECIFICATIONS.md](02-MODULE-SPECIFICATIONS.md) | Individual specifications for all **27 server modules** + the client: purpose, line count, exported functions, API routes registered, tables read/written. |
| 03 | [03-DATABASE-SCHEMA.md](03-DATABASE-SCHEMA.md) | All **62 tables** with full column lists, tenancy conventions, and a Mermaid entity-relationship diagram of the core graph. |
| 04 | [04-API-DOCUMENTATION.md](04-API-DOCUMENTATION.md) | All **255 API routes** grouped by module, with auth/tenancy/error conventions. |
| 05 | [05-WORKFLOWS.md](05-WORKFLOWS.md) | The 12 core workflow descriptions (lead lifecycle, proposals, signing→job, cadences, inbox triage, conversion, merge, billing, templates…). |
| 06 | [06-ROLES-AND-PERMISSIONS.md](06-ROLES-AND-PERMISSIONS.md) | The 6-role permission matrix (exact defaults from code), seat rules, override mechanics. |
| 07 | [07-TECHNICAL-ARCHITECTURE.md](07-TECHNICAL-ARCHITECTURE.md) | Stack, module map, request/data flow, multi-tenancy, deployment, operations. |
| 08 | [08-IMPLEMENTATION-STATUS.md](08-IMPLEMENTATION-STATUS.md) | Verified production status: what's live, pilot data, feature completeness, founder-owned blockers, known limitations. |
| — | `screenshots/` | 19 UI captures: `v13-v6-ui/` (command center), `v12-v5-ui/` (Planner, templates), `v11-v4-ui/` (CRM modules). |

## Companion documents (in the spec folder / repo `docs/`)

- `FULL-SPEC.md` — the v2.0 product specification (26 sections, incl. §14.5 handoff contract and §26 engineering invariants)
- `FULL-SPEC-V3.md`, `FULL-SPEC-V4.md` — the v3/v4 slice plans that produced the current model
- `COMPETITIVE-AUDIT.md` — competitive analysis behind the Salesforce-parity rebuild
- `LAUNCH.md` — the founder launch checklist (source of the blocker list in doc 08)

## Reading paths

- **Evaluating the product:** Master Spec §1–3 → Screen Documentation → Implementation Status.
- **Engineering diligence:** Technical Architecture → Database Schema → API Documentation → Module Specifications → Master Spec §14.
- **Understanding the AI:** Master Spec §8 (the three layers, honestly bounded) → §9 (governance invariants) → Implementation Status (limitations).

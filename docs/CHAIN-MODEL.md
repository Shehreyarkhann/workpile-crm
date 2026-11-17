# Chain model — Lead → Quote → Project → Work Orders (v77–v78, Nov 2026)

How real field-service companies run (G.C. pattern), generalized to market standard.
Every record carries a human number; the whole chain is visible from any link.

## Numbers (per workspace, per calendar year, sequential, never reused)
- **Lead** — `L<YY>-<NNNN>` e.g. `L26-0142`. Assigned at creation, every lead, every source.
- **Quote** — `Q<YY>-<NNNN>` e.g. `Q26-0097`. Assigned when a proposal is created.
  (The legacy internal `number` (1001+) stays for compatibility; `quote_no` is the display identity.)
- **Project** — `P<YY>-<NNNN>-<II>` e.g. `P26-0031-00`. Assigned when a lead converts (job created).
  `II` = iteration: starts `00`; bumps when a new signed quote supersedes the project's
  original quote (scope revision), keeping the same serial — the project's identity is stable,
  its revision is visible.
- Counters live in `number_counters (workspace_id, kind, year, last)`; assignment is a single
  atomic upsert. A boot/read sweep (`ensureNumbers`) numbers anything created by a path that
  didn't assign inline, in created order — so no record can ever be numberless.
- Global search matches all three number formats.

## The chain
lead (L) → proposals (Q, versions) → signed proposal converts → job/project (P) →
work orders (below). Every detail header shows the chain as a breadcrumb with click-through:
`L26-0142 → Q26-0097 → P26-0031-00`. All prior data (emails, visits, documents, approvals)
stays attached through the lead, which the project carries by reference.

## Work orders (inside a project)
One project = many work orders. `work_orders` row: per-project sequence (`-W01`, `-W02`, …
displayed as `P26-0031-00-W01`), title, description/scope, status
(planned → scheduled → in_progress → on_hold → completed / cancelled), project manager,
scheduled start/end, location, notes. Crew = `work_order_crew` (workers and/or users).
Photos/files = the generic attachments store with `entity_type='work_order'`.
Every project opens with a default W01 ("full scope") created at conversion, so the tab is
never empty; teams split it as the work is planned. Work orders appear on the calendar.

## Projects tab
A dedicated top-level view (not buried in Ops): every converted project with its number,
customer, stage, value, open work orders, PM, next date. Opening a project shows the chain,
its work orders, schedule, documents, invoices, and the full lead history it came from.

## Queued tranches (designed, in order)
1. **Proposal template builder (v79)** — a numbered section library (Section 1…N: scope,
   inclusions, exclusions, pricing, schedule, warranty, terms, …). A template = header +
   ordered chosen sections + footer; every part editable in-app, saved as a named template;
   proposals render (screen + DOCX) from the composed template.
2. **Fully custom roles (v80)** — named roles with titles on top of the v41 permission
   engine: create/rename/delete roles, per-role module + action + scope matrix, assign to
   people; built-ins remain as starting templates.
3. **Calendar rebuild (v81)** — timezone-correct bucketing/rendering (fixes the UTC-slice
   residual), month/week/day views, projects + work orders + visits + tasks on one calendar.
4. **Top-bar navigation (v82)** — workspace setting: sidebar or a fixed top bar with
   categorized dropdown menus; same nav model, both layouts.

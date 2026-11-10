# Workpile — UX & Workflow Transformation Blueprint (v14)
Implements the founder's UX brief (UX-TRANSFORMATION-BRIEF.md). Principle: less thinking, fewer clicks, no re-typing, no dead ends. This maps the brief's demands to what shipped and what remains a standing standard.

## The owner's journey (brief §1) — how each step now flows
1. Lead arrives (any source) → lands in Work Queue + Leads with score, flags, completeness.
2. "What needs attention" = Work Queue order + Home brief; every lead carries ONE computed **Next step** (server `nextBestAction` + state overrides).
3. Lead detail opens with the **Next-step bar** — a single primary action per state (call/nudge → Messages, approve → Proposals, fix step → Tasks, assign → Details, won → the job). No hunting through tabs.
4. Proposal builds from the lead with price-book lines — zero re-entry (contact, service, location pre-filled).
5. Approval (policy-gated) → send → customer signs by link; content edits after approval invalidate it (v8).
6. Follow-ups run on cadence inside quiet hours; suppressions stop them cold (v13).
7. Signature converts to a job transactionally (v7); the lead's Next step becomes "Open the job".
8. Job detail carries a **breadcrumb**: Lead → signed Proposal → this Job; schedule, crew, time, paperwork, change orders, invoicing in tabs.
9. Customer 360 (below) holds the complete history incl. money.

## Customer 360 (brief §2C/§4) — shipped v14
GET /api/accounts/:id now returns, beside contacts/leads/jobs: **proposals** (status, sent/signed dates), **payments** (kind/mode/status), **documents**, and money totals (proposed, collected, refunded). CustomerDetail renders all sections; every row is a door (leads open the lead, jobs open the job).

## Onboarding (brief §3) — shipped v14
GET /api/onboarding + the Home **activation checklist**: 7 steps ending at the first won job, each detected from real data (never from form completion), each with a "Do it →" deep link; progress bar; dismissible per browser; disappears when complete. Philosophy printed on the card: built around the first sent proposal.

## Relationship standard (brief §4) — standing rule
Every detail view links its relatives both ways; a record is created in exactly one place and referenced everywhere else. Current doors: queue→lead/job/approval; lead→customer/proposals/job/messages; job→lead/proposal (breadcrumb); customer→everything (360); proposal→lead (approvals). New modules must ship their doors in the same tranche.

## Feedback & consistency (brief §5) — shipped v14 + standing
- One toast pattern for completed actions away from forms (`toast()` + ToastHost); inline ✓/error messages remain for form-local feedback.
- Esc closes every modal; `:focus-visible` outline app-wide; stage moves confirm by toast in lead + job.
- Empty states carry the next action, never a bare "none" (leads, proposals, customers, inbox, 360 sections).

## What remains (honest)
- Moderated usability testing with unfamiliar users (brief §5) — needs real people; the pilot (Gregory + team, from Nov 16) is the first test cohort; scenario scripts in UX-ACCEPTANCE.md.
- A formal component library (§25 of the target spec) stays deferred by design; the patterns above are the de-facto system.
- Full screen-reader audit beyond focus visibility/keyboard basics — scheduled with the first external test round.

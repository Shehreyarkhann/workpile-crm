# Response to the "Critical Audit and Category-Leading Blueprint" (2026-11-11)

The audit was written against `WORKPILE-FULL-SPECIFICATION.md` (2026-11-10, commit
b513704) — a spec snapshot that predates tranches v12–v22. Every material claim was
re-verified against the current code before action. Verdicts:

## Stale — already shipped (audit's spec predates it)
- **B-1 Backlog Audit funnel**: shipped v12 — public `/audit` page + POST
  /api/public/backlog-audit (aggregates only, rows never stored). What remains is the
  workpile.io domain (founder item), not the funnel.
- **W-1 onboarding**: GET /api/onboarding (10 steps, strict semantics) + Home card
  shipped v14/v15. A guided first-run *wizard* is still missing — real, queued below.
- **S-1 webhook SSRF**: resolver-grade guard (v17, server/netguard.ts) — all resolved
  addresses must be public; applied to sync + Slack. (Residual: DNS-rebinding race,
  documented in the module.)
- **S-7 suppressions + quiet hours**: shipped v13 (suppression enforced at the send
  boundary; cadence quiet hours defer, never drop). v23 adds the email opt-out
  footer + inbound STOP handling (below).
- **S-11 API keys**: hashed at rest (`hashed_key`), scope allowlist, settings-gated
  (v15). **S-2 password hashing**: scrypt + salt (spec just didn't name it).
- **P-2 "no LLM anywhere"**: provider layer shipped v17 (Anthropic/OpenAI, governed
  tools, honest "deterministic mode" banner when no key is set). UI never claims a
  model is running when one isn't.
- **U-1 nav**: primary nav is the target-state 11 (v8). Secondary destinations live
  under a "More" group — the audit counts them as primary.
- **F-3 invoicing**: real invoices + true AR shipped v17 (the audit's spec predates).
- **A-10/A-1 worker**: durable background_jobs queue with leases + idempotency keys
  (v17). Process split + Postgres remain founder/host decisions (below).
- **S-4 sanitizer**: allowlist-based (tags rebuilt without attributes; img src
  restricted to data:/https:) — materially equivalent posture to the recommendation;
  not swapped for DOMPurify (would risk template rendering for no security gain).

## Real — fixed in v23
- **S-3** No rate limiting on auth/public endpoints → per-IP buckets (429).
- **S-12** Webhook signatures had no timestamp → `t=…,v1=HMAC(t.body)` header added
  (legacy header kept one release).
- **W-6** Ingest dedupe returned the existing lead for ANY non-duplicate match —
  a new request from a different person at a shared office number, or against a
  closed lead, was silently swallowed → closed-state or different-name matches now
  create a new lead flagged `possible_duplicate_of` (event + response), which the
  duplicates review surfaces for a human decision.
- **W-7** sign() enforced doc-hash integrity but not expiry → expired proposals are
  rejected now (`proposal_expired`), and the sign page shows a notice instead of the
  form. On supersession the audit's premise doesn't fit this product: proposals for
  one lead coexist by design (alternatives and re-issues; the test suite proves a
  v1 link must stay signable after v2 exists). The explicit mechanism shipped
  instead: **Withdraw** — a proposal action that sets status `withdrawn`, kills its
  sign link immediately (`proposal_withdrawn`), and is approval-gated + audited.
- **B-4** "Proposals sent" counted test-mode sends → proposals record
  `delivery_mode` at send; /api/metrics/periods and Home split live vs test-mode,
  and the North Star card labels test-mode sends as not delivered.
- **U-5** Reduced-motion only gated one animation → global gate.
- **U-8** Home agent card said "LIVE" for a periodic sweep → now "Armed · last ran …".
- **U-4** J/K shortcuts had no off switch → queue header toggle (persisted).
- **S-7 (rest)** Outbound email had no opt-out footer → footer with business identity
  + reply-STOP instruction; inbound SMS STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT now
  suppresses the number and stops cadences.
- **A-3/A-4** CI gains a typecheck step (scoped config) and glob test discovery.

## Founder decisions (not engineering calls — tee'd up in chat)
- **B-2 pricing model**: the blueprint proposes workspace+usage pricing ($119–$299/mo)
  replacing the per-seat model the founder set on 2026-11-10. Not changed unilaterally.
- **Q3 ICP**: institutional/commercial (blueprint's assumption) vs broader — founder's call.
- **A-1/A-2/R-1/R-2 Postgres + dedicated host**: schema pack + export tooling exist;
  the cutover is a hosting spend/ops decision.
- **S-2 MFA**: real gap; sized as its own tranche (TOTP for Owner/Approver).
- **S-8 counsel**: legal review remains a founder task (already in LAUNCH.md).
- **P-5 design partners, B-6 product analytics, §9 growth**: business motions, not code.

## Disagreements noted
- **P-1**: nav/IA already follows the founder's target-state spec (11 primary);
  Campaigns/Feed/Report Builder are secondary surfaces, not the positioning.
- **W-4**: proposal follow-up first touch is day +2 in the shipped defaults
  (DEF_STEPS 2/5/10) — the "fires seconds after send" claim doesn't match the code.
- **A-12**: scale-proof seed numbers are demo data, labeled as such; not a product metric.

# Operator evals — the release gate

`server/evals.ts` is a standing suite of ten operational scenarios that score
the governed agent machinery. It runs in CI as `tests/v51.test.ts` (any
failure fails the build and names the scenario), and standalone:

```
node scripts/run-evals.ts   # boots a throwaway DB; exits non-zero on failure
```

Scenarios: pricing integrity (proposals price only from the price book) ·
stage guards (finals need reasons, WON needs a proposal) · payment safety
(overpayment refused, exact settlement lands) · consent boundary (a
suppressed customer is never sent to) · dedupe (playbooks/chases never
double) · schedule conflicts (warn, never double-book) · memory round-trip ·
earned autonomy (trust promotes drafts, NEVER promotes customer-facing
sends; weak tools demote) · proactive fire-once · loop observation (the
model reads tool results before continuing).

Rule for new agent capabilities: a tool or planner change ships with a
scenario that would have caught its worst failure mode.

# UX Acceptance — criteria, evidence, and the usability test protocol
The brief's 10 criteria, each with its current evidence (v14) and how it gets re-checked.

| Criterion | Evidence in the product | Re-check |
|---|---|---|
| Discoverability | Next-step bar names the one action per lead state; nav = 11 items in workflow order; ⌘K reaches anything | Test scenario 1 |
| Efficiency | Proposal from lead = 0 re-typed fields; queue rows act in place; offline field posts queue & sync | Scenarios 2–3 |
| Consistency | One modal pattern, one toast, one badge system, one money format; Esc closes all modals | Code review per tranche |
| Connectivity | Job breadcrumb; Customer 360; queue deep-links; lead↔job two-way | Scenario 4 |
| Clarity | Money kept in 5 labeled buckets w/ definitions; job stages = plain words; test-mode labeled everywhere | Scenario 5 |
| Feedback | Toasts for stage moves & completions; inline form errors; sends show verified status or test_mode | Scenario 2 |
| Recovery | Merge reversal; approval invalidation re-asks instead of sending stale content; stage moves are free both ways | Scenario 4 |
| Responsive | Mobile shell + bottom nav; phone-viewport screenshot pass per tranche | Screenshot set per release |
| Accessibility | Focus-visible outlines; Esc handling; keyboard-reachable primary actions; labels on form fields | Keyboard walkthrough per release |
| Onboarding | Activation checklist to first won job; steps detected from data | Scenario 1 (fresh account) |

## Moderated usability scenarios (run with a user who has never seen Workpile; observe, don't coach)
1. **First session:** "You just signed up. Get your business set up and your first lead in." Pass: reaches a qualified lead without help; finds the checklist's next step unaided.
2. **Win a job:** "This lead wants the work. Send them a proposal and get it signed." Pass: proposal sent with no re-typed data; can state what happens on signature.
3. **Run the morning:** "It's 9am. What needs you today?" Pass: works the queue top-down; can explain why each item is there.
4. **Find the story:** "This customer calls about last month's job — pull up everything." Pass: from the customer, reaches lead, proposal, job, payment in ≤2 clicks each.
5. **Money check:** "How much have you actually collected this month vs what's just proposed?" Pass: answers from Home/finances without blending buckets.

Any scenario failure = a UX defect filed against the owning module, fixed before the next release gate.

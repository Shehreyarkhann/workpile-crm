# WORKPILE — FULL SPEC V4: Salesforce Sales Cloud Parity Layer

**Date:** 2026-11-10. **Directive (Shehreyar):** "Looking at salesforce.com I want you to clone it 100% for leads and apps and all what we are doing. Do thorough research and implement all into our app. Not just dummies but working apps and modules and features end to end."
**Status:** Slices 37–46 SHIPPED 2026-11-10 — 111/111 tests + smoke + build green; screenshots screenshots-v11/. Prod deploy = re-run the deploy one-liner (DB migrates itself). V3 laws and §26 invariants remain in force. Where Salesforce's model conflicts with Workpile's Backlog-OS model (Lead → Proposal → Job), the Salesforce *capability* is cloned onto the Workpile object it maps to — nothing is a dummy: every module below reads/writes real data through real flows.

## Parity map (Salesforce → Workpile)

| Salesforce Sales Cloud | Workpile v4 | Slice |
|---|---|---|
| Accounts + Contacts, related lists | **Customers** (accounts) + **People** (contacts) modules; customer record with related leads, jobs, contacts, proposals, lifetime value | 37 |
| Lead Conversion (Lead → Account + Contact + Opportunity) | Winning a lead **converts** it: customer + contact created/linked, lead stamped converted; manual Convert button on any lead; the Job is our Opportunity | 37 |
| Chatter feed on records, @mentions, follow | **Feed** tab on lead/job/customer: posts, @mention → notification, follow toggle; following list | 38 |
| Custom fields (admin-defined) | Settings → Custom Fields for leads/jobs/customers (text, number, date, select); rendered on record forms, saved as real data, shown in lists | 39 |
| Activities: Tasks app + Calendar | **Tasks** app (mine/open/overdue/done across all records) + **Calendar** (tasks, callbacks, job schedule, follow-up due dates, site visits) | 40 |
| Campaigns + Campaign Members + ROI | **Campaigns** module: members with statuses, cost, leads/won/revenue influenced, ROI = (revenue − cost) / cost | 41 |
| Duplicate Rules + Merge | **Duplicates** finder (phone/email/name matches) + **Merge** that moves activities, tasks, proposals, documents, time and history to the survivor; loser becomes DUPLICATE with merged_into pointer | 42 |
| Lead Assignment Rules + round-robin queues | Settings → Assignment Rules: criteria (service, source, value, urgency) in order, assign to a person or round-robin pool; applied on create/import/API | 43 |
| Notes + Files | **Notes** app (notes on any record + standalone list) + **Files** view (documents + portal uploads across records) | 44 |
| App Launcher + Apps (Sales/Service/Marketing tab sets) | **App switcher** in the sidebar: Sales / Operations / Marketing presets filter the nav to that app's modules | 45 |
| Global Search across objects + Recent + Favorites | ⌘K and search return grouped results (leads, jobs, customers, people, tasks, campaigns); star any lead/job/customer as a favorite, pinned in the sidebar | 45 |
| Report Builder (group, chart) + Dashboards | **Report Builder**: pick object + group-by + metric → live table and bar chart; **pin to Dashboard**; Salesforce-style inline editing in the leads table (owner, stage, value, next step) | 46 |
| Path guidance, lead scoring, queues, approvals, forecasting | Already in v3 (Path + guidance copy, AI score, Work Queue, approval policy, forecast) — unchanged | — |

## Data model additions
`accounts` (company: name/phone/email/address/website/industry/notes/custom), `feed_posts`, `follows`, `custom_fields`, `campaigns`, `campaign_members`, `assignment_rules`, `notes`, `favorites`, `dashboard_pins`. Additive columns: `leads.account_id, converted_at, campaign_id, custom, merged_into_id`; `contacts.account_id, title`; `jobs.custom`; `accounts.custom`. All migrations are additive and idempotent; the G.C. pilot data converts in place (its 6 won leads gain customers on first conversion pass).

## Acceptance (all verified by tests + live QA)
Conversion creates exactly one customer per won lead (idempotent, matched by name); merge leaves one survivor with the union of history; assignment rules fire on API-created leads; campaign ROI math is computed from real won values; custom-field values round-trip through the record UI; calendar aggregates all five sources; search finds records in every object; report builder numbers reconcile with board stats.

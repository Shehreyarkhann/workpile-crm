# SPEC REVIEW — Through Gregory Collins' Eyes
### Owner, G.C. Environmental, Inc. — Design Partner #1 (perspective analysis)
**Date:** November 9, 2026 | **Reviews:** FULL-SPEC.md v1.0 (§1–§24, incl. §14.5 Handoff API)
**Basis:** Only what Gregory has actually shown/said in his own process — owner doing everything himself (missed Teams link, slow replies *are* the overload), 1,000+ unworked leads, 3,000+ unread emails, hire's point = take office work off him so he can be in the field and on sales, main interview interest = status reports & KPIs, stressed = conversational skills with clients/field managers, tracking everything for completeness, chasing field managers who don't submit reports or work their leads, written evaluation covered organization, scheduling, communication, paperwork, time sheets, client follow-up. He also probed software/API knowledge hard — he is not anti-tech, he is anti-disruption. Anything below beyond those facts is marked as inference.

---

## 1. GREGORY'S VERDICT (as he would say it)

> "The leads and proposals part — that's my problem, you got that right. But my day isn't only leads. Where are my field reports, my time sheets, my scheduling, my paperwork? If I still have to chase all of that somewhere else, I bought half a system. And don't sell me the AI — sell me the Friday status report and a phone screen where I approve what's waiting and see who hasn't done what."

**Buy decision: Conditional YES as a pilot — NO as a pitch.** He pilots it if: (1) it starts with his backlog + weekly status report, not a platform migration; (2) approval works from his phone in the field; (3) someone sets it up for him (the onboarding fee model works — he does not have implementation hours); (4) field-manager follow-up is real, not a dashboard footnote. He walks if week one requires his team to change how they work before he has seen one recovered proposal.

## 2. WHAT THE SPEC GETS RIGHT FOR HIM (keep, lead with these)

| Spec element | Why Gregory cares |
|---|---|
| Backlog wedge + burn-down with projected clear date (§4.4, §10) | His exact stated pain: 1,000+ leads / 3,000+ emails. A clear date turns a shame-pile into a plan. |
| Approval Inbox, phone-first, one-tap (§6.4) | He IS the bottleneck and he is in the field. This is the feature that buys back his day. |
| Status reports & KPIs as a first-class layer (§10) | His #1 stated interest in interview. The auto-composed Weekly Status Report (§10.5) should be a *headline* feature for him, not a sub-bullet. |
| Ownership + stuck detector + PM/field compliance (§7) | Directly matches his stress on chasing field managers who don't report or work leads. |
| Morning Brief, 6 AM (§10.4) | He runs an 8 AM start business. A brief that says what's waiting on *him* first fits his day exactly. |
| Human-approved AI, price only from his price book (§3, §12) | He will not let software quote his prices to his clients unsupervised. Approval-gating is the trust condition, not a feature. |
| Final Outcome Handoff (§14.5) — with a caveat in §4 below | Right principle: Won must become a project in his world, finals must close out cleanly. |

## 3. WHAT'S MISSING FOR GREGORY — REQUIRED ADDITIONS (P0 = pilot-blocking for him)

### P0-1. Field Reports & Time Sheets — submission chasing, not just a KPI line
The spec mentions field/PM compliance in one line (§7.3) and one dashboard tile. For Gregory this is a *daily workflow*, asked about in writing: field managers owe daily/weekly field reports and time sheets; someone chases the missing ones; payroll and billing depend on them.
**Needs:** Field Report + Time Sheet entities; due rules per manager (report by X, timesheet by Y); submission inbox with missing/late flags; auto-reminder drafts to the manager (human sends); compliance % by manager feeding §10 + the Weekly Status Report; escalation to Gregory only after 2 missed chases. *Not* payroll processing — submission, completeness, and chase only.

### P0-2. Full inbox triage — his 3,000 emails are NOT all leads
The spec's inbox ingestion only extracts leads (§4.1/§4.3). Gregory's backlog also contains proposal replies, field reports, vendor/admin, client questions on live jobs, and finance items. If non-lead mail has nowhere to go, he keeps a second system (his inbox) forever.
**Needs:** Inbox Triage categories — Lead / Proposal / Field / Client–Active Job / Vendor / Finance / Admin — each with an owner + next action, same "nothing without owner + date" rule as leads. Lead extraction becomes one branch of triage, not the whole tree.

### P0-3. Scheduling & site visits
Gregory's written evaluation explicitly covered scheduling; environmental work needs a site visit/assessment before most proposals can be priced. The spec jumps Qualification → Proposal with no visit.
**Needs:** Site Visit as a first-class step: schedule (calendar-synced), assign (PM/field), visit outcome + photos/notes feeding the proposal packet and the Completeness Gate (§6.2 — for many services, "visit completed" IS a required field), no-show/reschedule handling, visit compliance in KPIs.

### P0-4. Handoff without a developer on his side (§14.5 caveat)
§14.5 assumes his platform can ingest an API. **Unknown — and as Gregory, his first question is "who builds that on my end?"** He has software and people he can ask (inference from his interview's software focus), but no idle dev team.
**Needs:** No-code destinations at MVP, equal in status to the API: (a) Handoff Packet by email — Won = project packet PDF + CSV to named recipients; (b) Google Sheet / Excel sync of all finals; (c) CSV export on schedule; (d) Zapier/Make. API/webhooks remain for when his side is ready. Also a Week-1 discovery task in onboarding: *identify his actual project/job system by name* before any handoff is configured — do not assume it.

### P0-5. Paperwork & document tracking
Paperwork was in his written evaluation. Environmental work runs on documents: signed proposals, insurance certs, permits, disposal/manifest paperwork, client documents.
**Needs:** A Documents tab per lead/project: required-doc checklist per service, missing-doc chase tasks (same engine as follow-ups), expiry dates on certs/licenses with renewal alerts. Lightweight — tracking and chasing, not a document-management system.

## 4. WHAT HE'D PUSH BACK ON (fix the pitch, not necessarily the product)

1. **"AI Agentic" leads the pitch — wrong door for him.** He called his own hire "overqualified / IT guy" while still hiring him for ops. Sell order for Gregory: status report → approvals off his plate → backlog clear date → *then* the AI that drafts it all. The Demand Gap (§11) is a Year-1 conversation, not a pilot feature — interesting, but he will not pay pilot money for services he doesn't sell yet.
2. **Price needs a pilot shape.** $599/mo Growth fits his lead volume, but as a single-location owner he will ask for a paid pilot (e.g., Backlog Clear fee + 90 days) with the before/after numbers — approval time, proposals sent, backlog remaining — as the renewal decision. §19's design-partner terms should state this explicitly.
3. **Proposal must be editable his way.** His team works in Word-style documents. The builder (§9) must export a fully editable DOCX, not only a system PDF, or his manager will keep rebuilding proposals outside the system.
4. **Too many states, too much vocabulary.** 12 lead states + autonomy levels + agent names are builder language. His UI view should show ~6 plain buckets (New / Working / Waiting on Me / Proposal Out / Won / Lost) with the full state machine underneath. Simplicity is an adoption requirement, not a design preference.
5. **Call handling is thin.** He stressed conversational/client phone skills; many leads and follow-ups are calls. MVP needs at minimum a 20-second call log (who, outcome, next step) on the lead record — full call-tracking can stay Phase 2.

## 5. P1 — NEEDED SOON FOR HIM (post-pilot, pre-renewal)
- **Invoices / PO visibility (read-only):** Outstanding invoices + aging in the Weekly Status Report (QuickBooks or his existing system, synced read-only). His ops workbook pattern already treats invoice aging as part of the owner's weekly picture; cash questions will land on this system whether we plan for it or not.
- **Client communication on active jobs:** Status-back (§14.5) covers data flow; he also needs the *human* thread — client questions on live jobs routed like triage (P0-2), not lost in personal inboxes.
- **Office Admin / Payroll-adjacent role:** RBAC (§7.4) has no Admin-of-the-office role (timesheets in, paperwork filed, handoff packets sent) — the Debra-in-the-CC-line seat. Add `OPS_ADMIN` with timesheet/document/handoff permissions, no pricing/approval rights.

## 6. SCORE CARD — SPEC AS GREGORY READS IT
| His need | Spec coverage | Grade |
|---|---|---|
| Lead backlog cleared | §4.4, §5, §10 burn-down | **A** |
| Approvals off his plate | §6, Approval Inbox | **A** |
| Status report + KPIs | §10 (under-sold, should headline) | **A−** |
| Who's working what / field chasing | §7 + needs P0-1 depth | **B−** |
| Proposals from templates | §9 (needs DOCX editability) | **B+** |
| Follow-up discipline | §8 | **A−** |
| Scheduling / site visits | Calendar sync only | **D — missing** |
| Time sheets / field reports | One KPI line | **D — missing** |
| Email backlog (non-lead) | Lead extraction only | **C−** |
| Paperwork / documents | Attachments only | **D — missing** |
| Finals into his own system | §14.5 (needs no-code path) | **B** |
| Simplicity for a field-run team | Builder-grade complexity | **C** |

**Bottom line:** As a *lead-to-proposal* system, this spec would impress him. As *Gregory's operating system* — the job he actually hired for — it covers roughly 60% of his day. The P0 additions above are what turn a good pilot into the thing he renews: they are all chase/track/report workflows, which is exactly the product's core strength applied to the rest of his office.

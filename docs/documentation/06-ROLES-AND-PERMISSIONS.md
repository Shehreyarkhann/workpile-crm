# Workpile — User Roles & Permission Matrix

Extracted from the production permission model (`server/app.ts`, `Perms` interface and role defaults) at commit `6155c8a`. Permissions are enforced **server-side on every route** — the UI additionally hides what a member cannot do, but the API is the authority.

## Permission keys

| Key | Meaning |
|---|---|
| `leads_scope` | `all` = sees every lead in the workspace · `own` = sees only leads they own/are assigned |
| `can_approve` | Can decide approval packets (subject to workspace approval policy) |
| `can_billing` | Can see/manage subscription, plans, invoices |
| `can_settings` | Can change workspace settings, price book, templates, integrations |
| `can_export` | Can export data (CSV reports, backups) |
| `can_manage_team` | Can invite/disable users, edit roles & permissions, manage roster workers |

## Role defaults

| Role | leads_scope | approve | billing | settings | export | team |
|---|---|---|---|---|---|---|
| **OWNER** | all | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ADMIN** | all | ✓ | — | ✓ | ✓ | ✓ |
| **OPS_ADMIN** | all | — | ✓ | ✓ | ✓ | ✓ |
| **APPROVER** | all | ✓ | — | — | ✓ | — |
| **LEAD_OWNER** | own | — | — | — | — | — |
| **PM** | own | — | — | — | — | — |

## Rules & notes

- **Custom overrides:** any member's permissions can be adjusted per-key from the role default (stored on the user record); overrides are applied at login and re-checked per request. The OWNER's permissions cannot be reduced.
- **Seats:** roles attach to login users; login users count against the plan seat limit (Solo 1 · Team 2 · Crew 3). **Roster workers are not users** — no login, no seat, name-only records used by scheduling/time.
- **Approval policy is separate from role permission:** even a user with `can_approve` only sees packets when the workspace policy (off / over-$25k / always) routes a proposal to approval.
- **Platform admin** (Workpile operator, Ops Console) is a separate flag (`is_platform_admin`) outside the workspace role system.
- **Customer-facing identities** (sign page, portal) are token-based, not user accounts, and hold no workspace permissions.
- The pilot workspace maps the model to real people: Gregory Collins = OWNER, Shehreyar = OPS_ADMIN, Daniel Reyes = PM.

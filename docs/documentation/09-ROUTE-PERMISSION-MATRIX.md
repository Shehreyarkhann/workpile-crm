# Workpile — Route Permission Matrix

Generated from route registrations in production source (v7). Every route lists its authentication requirement and its permission guard. `session` = logged-in user (workspace-scoped); handlers additionally enforce resource-level workspace checks. Target-state §20.2: authorization is enforced on every API operation, server-side.

**247 routes.** Mutating settings-class routes (price book, templates, custom fields, assignment rules, canned replies, inbox rules, webhooks) require `can_settings`; billing requires `can_billing`; exports require `can_export`; approvals require `can_approve`; agent actions (cleanup apply, reactivation, automation runs) require `can_settings` (v7 Phase-0 hardening).


## app.ts (199)

| Method | Path | Auth | Permission |
|---|---|---|---|
| POST | `/api/auth/login` | public | — |
| GET | `/api/auth/me` | session | — |
| GET | `/api/users` | session | — |
| GET | `/api/leads` | session | — |
| POST | `/api/leads` | session | — |
| GET | `/api/leads/:id` | session | — |
| POST | `/api/leads/:id/transition` | session | — |
| POST | `/api/leads/:id/stage` | session | — |
| POST | `/api/leads/:id/reopen` | session | — |
| POST | `/api/leads/:id/hold` | session | — |
| POST | `/api/leads/:id/contact` | session | — |
| POST | `/api/leads/:id/packet-check` | session | — |
| GET | `/api/price-book` | session | — |
| GET | `/api/templates` | session | — |
| POST | `/api/leads/:id/proposals` | session | — |
| POST | `/api/proposals/:id/clone` | session | — |
| GET | `/api/approvals` | session | — |
| POST | `/api/auth/logout` | public | — |
| POST | `/api/approvals/:id/decide` | session | — |
| GET | `/api/tasks` | session | — |
| POST | `/api/tasks/:id/complete` | session | — |
| GET | `/api/metrics` | session | — |
| GET | `/api/brief` | session | — |
| GET | `/api/demand-gap` | session | — |
| GET | `/api/demand-gap/leads` | session | — |
| GET | `/api/ops` | session | — |
| GET | `/api/timesheets` | session | — |
| POST | `/api/timesheets` | session | — |
| POST | `/api/timesheets/:id/chase` | session | — |
| GET | `/api/timesheets/export` | session | can_export |
| GET | `/api/field-reports` | session | — |
| POST | `/api/field-reports/:id/submit` | session | — |
| POST | `/api/field-reports/:id/chase` | session | — |
| GET | `/api/schedule/jobs` | session | — |
| GET | `/api/schedule` | session | — |
| POST | `/api/schedule` | session | — |
| DELETE | `/api/schedule/:id` | session | — |
| GET | `/api/labor-classes` | session | — |
| POST | `/api/labor-classes` | session | can_settings |
| POST | `/api/labor-classes/seed-defaults` | session | can_settings |
| PATCH | `/api/labor-classes/:id` | session | can_settings |
| DELETE | `/api/labor-classes/:id` | session | can_settings |
| GET | `/api/leads/:id/labor` | session | — |
| POST | `/api/leads/:id/crew` | session | — |
| DELETE | `/api/leads/:id/crew/:userId` | session | — |
| GET | `/api/workers` | session | — |
| POST | `/api/workers` | session | — |
| POST | `/api/workers/bulk` | session | — |
| PATCH | `/api/workers/:id` | session | — |
| POST | `/api/time` | session | — |
| GET | `/api/time/grid` | session | — |
| POST | `/api/time/grid` | session | — |
| POST | `/api/leads/:id/time` | session | — |
| DELETE | `/api/time-entries/:id` | session | — |
| GET | `/api/jobs` | session | — |
| POST | `/api/jobs` | session | — |
| GET | `/api/jobs/:id` | session | — |
| POST | `/api/jobs/:id/stage` | session | — |
| PATCH | `/api/jobs/:id` | session | — |
| POST | `/api/jobs/:id/packet` | session | — |
| POST | `/api/jobs/:id/change-orders` | session | — |
| POST | `/api/change-orders/:id/status` | session | — |
| POST | `/api/documents/:id/chase` | session | — |
| GET | `/api/setup-status` | session | — |
| POST | `/api/timesheets/:id/submit` | session | — |
| POST | `/api/imports/csv` | session | — |
| POST | `/v1/leads` | api-key | — |
| GET | `/v1/leads/:id/outcome` | api-key | — |
| GET | `/v1/outcomes` | api-key | — |
| GET | `/v1/projects/:id` | api-key | — |
| POST | `/v1/outcomes/:deliveryId/ack` | api-key | — |
| GET | `/api/handoffs` | session | — |
| GET | `/api/outbox` | session | — |
| GET | `/api/webhooks` | session | — |
| POST | `/api/webhooks` | session | can_settings |
| DELETE | `/api/webhooks/:id` | session | can_settings |
| POST | `/api/worker/run` | session | — |
| POST | `/api/handoffs/:id/replay` | session | — |
| GET | `/api/proposals/:id/docx` | session | — |
| POST | `/api/inbox/ingest` | session | — |
| POST | `/api/imports/email` | session | — |
| GET | `/api/inbox` | session | — |
| GET | `/api/inbox/:id/suggestion` | session | — |
| PATCH | `/api/inbox/:id` | session | — |
| POST | `/api/inbox/:id/reply` | session | — |
| POST | `/api/inbox/:id/convert-lead` | session | — |
| GET | `/api/inbox/:id/comments` | session | — |
| POST | `/api/inbox/:id/comments` | session | — |
| POST | `/api/inbox/:id/claim` | session | — |
| GET | `/api/canned-replies` | session | — |
| POST | `/api/canned-replies` | session | can_settings |
| DELETE | `/api/canned-replies/:id` | session | can_settings |
| GET | `/api/inbox-rules` | session | — |
| POST | `/api/inbox-rules` | session | can_settings |
| DELETE | `/api/inbox-rules/:id` | session | can_settings |
| POST | `/api/inbox/:id/convert-task` | session | — |
| POST | `/api/proposals/:id/sign-link` | session | — |
| GET | `/sign/:token` | public | — |
| POST | `/sign/:token` | public | — |
| GET | `/api/proposals/:id/certificate` | session | — |
| GET | `/api/queue` | session | — |
| GET | `/api/board-stats` | session | — |
| POST | `/api/leads/:id/callback` | session | — |
| POST | `/api/callbacks/:id/done` | session | — |
| POST | `/api/reactivate` | session | — |
| POST | `/api/proposals/:id/deposit` | session | — |
| GET | `/pay/test/:paymentId` | public | — |
| POST | `/pay/test/:paymentId` | public | — |
| POST | `/webhooks/stripe` | public | — |
| GET | `/api/flags` | session | — |
| POST | `/api/flags` | session | — |
| GET | `/api/admin/synthetics` | session | — |
| GET | `/api/change-orders` | session | — |
| POST | `/api/change-orders` | session | — |
| POST | `/api/change-orders/:id/decide` | session | — |
| GET | `/portal/:token` | public | — |
| POST | `/portal/:token/upload` | public | — |
| GET | `/api/billing` | session | can_billing |
| POST | `/api/billing/checkout` | session | can_billing |
| POST | `/api/billing/change-plan` | session | can_billing |
| GET | `/api/oauth/status` | session | — |
| GET | `/api/oauth/:provider/start` | session | — |
| GET | `/embed/v1.js` | public | — |
| POST | `/api/auth/register` | public | — |
| GET | `/api/workspaces` | session | — |
| POST | `/api/workspaces` | session | — |
| POST | `/api/workspaces/switch` | session | — |
| GET | `/demo-source/leads` | public | — |
| POST | `/api/sync/run` | session | — |
| POST | `/api/ai/cleanup/preview` | session | — |
| POST | `/api/ai/cleanup/apply` | session | can_settings |
| POST | `/api/ai/reactivate` | session | can_settings |
| POST | `/api/leads/:id/message` | session | — |
| GET | `/api/leads/:id/messages` | session | — |
| POST | `/api/proposals/:id/send` | session | — |
| GET | `/api/notifications` | session | — |
| POST | `/api/notifications/:id/read` | session | — |
| POST | `/api/notifications/read-all` | session | — |
| POST | `/api/auth/forgot` | public | — |
| POST | `/api/auth/reset` | public | — |
| POST | `/api/auth/verify` | public | — |
| POST | `/api/auth/resend-verify` | session | — |
| GET | `/v1/leads` | api-key | — |
| GET | `/v1/leads/:id` | api-key | — |
| POST | `/v1/leads/:id/outcome` | api-key | — |
| POST | `/v1/inbox` | api-key | — |
| POST | `/api/integrations/slack/test` | session | — |
| GET | `/api/integrations` | session | — |
| PATCH | `/api/leads/:id` | session | — |
| POST | `/api/tasks` | session | — |
| DELETE | `/api/tasks/:id` | session | — |
| POST | `/api/leads/:id/visits` | session | — |
| POST | `/api/leads/:id/documents` | session | — |
| PATCH | `/api/documents/:id` | session | — |
| POST | `/api/price-book` | session | can_settings |
| PATCH | `/api/price-book/:id` | session | can_settings |
| DELETE | `/api/price-book/:id` | session | can_settings |
| POST | `/api/templates` | session | can_settings |
| PATCH | `/api/templates/:id` | session | can_settings |
| DELETE | `/api/templates/:id` | session | can_settings |
| GET | `/api/services` | session | — |
| POST | `/api/services` | session | can_settings |
| PATCH | `/api/services/:id` | session | can_settings |
| POST | `/api/users` | session | — |
| PATCH | `/api/users/:id` | session | — |
| GET | `/api/settings` | session | — |
| PATCH | `/api/settings` | session | can_settings |
| GET | `/api/api-keys` | session | — |
| POST | `/api/api-keys` | session | — |
| DELETE | `/api/api-keys/:id` | session | — |
| GET | `/api/imports` | session | — |
| GET | `/api/dashboard` | session | — |
| GET | `/api/status-report` | session | — |
| GET | `/api/reports` | session | — |
| GET | `/api/reports/export` | session | can_export |
| GET | `/api/forecast` | session | — |
| POST | `/v1/missed-call` | api-key | — |
| GET | `/api/ai/insights` | session | — |
| GET | `/api/ai/suggest/:leadId` | session | — |
| POST | `/api/ai/autofix-next-steps` | session | — |
| POST | `/api/ai/nudge` | session | — |
| GET | `/api/ai/automations` | session | — |
| POST | `/api/ai/automations` | session | can_settings |
| POST | `/api/ai/automations/run` | session | can_settings |
| GET | `/api/ai/runs` | session | — |
| GET | `/api/proposal-template` | session | — |
| PUT | `/api/proposal-template` | session | can_settings |
| GET | `/api/proposals/:id/document` | session | — |
| GET | `/api/public/book/:slug` | public | — |
| POST | `/api/public/book` | public | — |
| PATCH | `/api/team/:id` | session | can_manage_team |
| POST | `/api/leads/bulk` | session | — |
| POST | `/webhooks/twilio/inbound` | public | — |
| GET | `/api/push/key` | session | — |
| POST | `/api/push/subscribe` | session | — |
| GET | `/api/myday` | session | — |
| GET | `/api/activity` | session | — |
| GET | `/api/leads/:id/followups` | session | — |
| POST | `/api/leads/:id/followups/stop` | session | — |

## crm.ts (47)

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/api/accounts` | session | — |
| POST | `/api/accounts` | session | — |
| GET | `/api/accounts/:id` | session | — |
| PATCH | `/api/accounts/:id` | session | — |
| POST | `/api/leads/:id/convert` | session | — |
| GET | `/api/people` | session | — |
| POST | `/api/people` | session | — |
| PATCH | `/api/people/:id` | session | — |
| GET | `/api/feed/:type/:id` | session | — |
| POST | `/api/feed/:type/:id` | session | — |
| POST | `/api/follow/:type/:id` | session | — |
| GET | `/api/custom-fields` | session | — |
| POST | `/api/custom-fields` | session | can_settings (guard) |
| DELETE | `/api/custom-fields/:id` | session | can_settings (guard) |
| POST | `/api/custom-values` | session | — |
| GET | `/api/campaigns` | session | — |
| POST | `/api/campaigns` | session | — |
| GET | `/api/campaigns/:id` | session | — |
| PATCH | `/api/campaigns/:id` | session | — |
| POST | `/api/campaigns/:id/members` | session | — |
| PATCH | `/api/campaign-members/:id` | session | — |
| DELETE | `/api/campaign-members/:id` | session | — |
| GET | `/api/assignment-rules` | session | — |
| POST | `/api/assignment-rules` | session | can_settings (guard) |
| PATCH | `/api/assignment-rules/:id` | session | can_settings (guard) |
| DELETE | `/api/assignment-rules/:id` | session | can_settings (guard) |
| GET | `/api/duplicates` | session | — |
| POST | `/api/leads/:id/merge` | session | — |
| GET | `/api/notes` | session | — |
| POST | `/api/notes` | session | — |
| DELETE | `/api/notes/:id` | session | — |
| GET | `/api/files` | session | — |
| GET | `/api/tasks-all` | session | — |
| GET | `/api/calendar` | session | — |
| GET | `/api/search` | session | — |
| GET | `/api/favorites` | session | — |
| POST | `/api/favorites` | session | — |
| POST | `/api/reports/build` | session | — |
| GET | `/api/dashboard-pins` | session | — |
| POST | `/api/dashboard-pins` | session | — |
| DELETE | `/api/dashboard-pins/:id` | session | — |
| GET | `/api/doc-templates` | session | — |
| POST | `/api/doc-templates` | session | can_settings (guard) |
| PATCH | `/api/doc-templates/:id` | session | can_settings (guard) |
| DELETE | `/api/doc-templates/:id` | session | can_settings (guard) |
| GET | `/api/finances` | session | — |
| GET | `/api/home` | session | — |

## index.ts (1)

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `*` | public | — |

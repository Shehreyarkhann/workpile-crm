# Workpile — Non-Functional Targets (§24)

Targets are commitments to measure against, not measurements. Current status noted honestly per line.

| Area | Target | Current provision (Nov 10, 2026) |
|---|---|---|
| API latency | p95 < 800ms for workspace reads on the pilot host class (2 vCPU / 4 GB) | Health endpoint live (`/api/health/deep`); no p95 instrumentation yet — adding latency histograms is the next observability step |
| Availability | 99.5% monthly for the app origin | Single-droplet deployment; Cloudflare in front; no multi-host failover (deliberate at pilot scale) |
| Backups | Nightly DB backup, 7-day retention | Droplet-level backups + pre-deploy DB copies in the deploy script; restore drill not yet performed — scheduled before the PG cutover |
| RPO / RTO | RPO 24h · RTO 4h | Follows from nightly backups + the scripted deploy (rebuild from GitHub + restore DB copy) |
| Durability of effects | No customer-facing send or outcome is fire-and-forget | Durable background_jobs queue (retry/backoff/dead-letter) + outbox_events + outcome deliveries with DLQ/replay |
| Data isolation | Workspace scoping on every query; isolation tests incl. files/exports/background paths | Enforced in route handlers; isolation suite extended in v13 |
| Cutover path | PostgreSQL is the production database at scale | Schema pack generated from the live schema (66 tables) + tested export tool; cutover run is a host-side step, gated on the restore drill |

*Review cadence: revisit after the first 5 paying workspaces or the PG cutover, whichever comes first.*

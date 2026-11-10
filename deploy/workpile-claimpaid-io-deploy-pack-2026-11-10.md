# Workpile deploy pack — workpile.claimpaid.io (pilot bridge)

**Prepared:** Tue 2026-11-10. Status: prep only — nothing deployed, no DNS changed, no keys created.
**Why now:** pricing is settled (per-seat, Monthly/Yearly switch, Slice 26, tests 87/87), Slices 17–24 are shipped locally, and the G.C. workspace is built. The remaining launch items are all founder-side: domain, keys, deploy call. This pack turns the deploy call into exact steps.

## Verified facts (checked 2026-11-10 against the repo, not LAUNCH.md)

- App: Express + React/Vite, `~/workspace/leadflow-os/`. Entry `server/index.ts`, default **port 4173**, health endpoint `GET /api/health` returns `{ok:true, service:"leadflow-os"}` (`server/app.ts:1345`).
- DB: SQLite, `LEADFLOW_DB` env or `data/leadflow.db` (`server/db.ts:7`). Docker Compose mounts a `leadflow-data` volume at `/app/data`.
- Sign links / worker use `BASE_URL` (`server/app.ts:1205`, `server/worker.ts:60`) — must be `https://workpile.claimpaid.io` in prod, or sign links and follow-up URLs break.
- **Pricing env names changed with Slice 25/26** (`server/billing.ts:11-14`): `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_CREW` (yearly) + `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_CREW_MONTHLY` (monthly). Six prices to create in Stripe, not three.
- **`.env.example` and `deploy/check-env.mjs` are STALE** — they still list `STRIPE_PRICE_STARTER/GROWTH/PRO` and the old $299/$599/$999 plans, and LAUNCH.md still says "tests 20/20". Do not copy env names from them; use the table below.
- Droplet: ClaimPaid prod is `147.182.218.81`, 2 vCPU / 4 GB, already running Ollama with 4s–30s+ dynamic latency spikes (MEMORY.md). Workpile itself is light; pilot traffic is fine on the same box, but do not put paying Workpile customers on it — it gets its own droplet under workpile.io when it sells.

## Domain — checked 2026-11-10 ~08:10 ET

- **workpile.io is STILL unregistered** — Google DNS returns NXDOMAIN (Status 3). The local resolver returns a synthetic 198.18.x address for *any* unregistered name (verified with a control domain), so do not trust a local `dig` here.
- He said he will register it himself (2026-11-09). Porkbun, checked 2026-11-09: workpile.io $28.12 yr 1 (renews $51.80), getworkpile.com $11.81/yr. Register workpile.io anyway even though the pilot runs on the subdomain — the subdomain does not protect the name.
- **DNS for the pilot (Cloudflare, claimpaid.io zone):** `workpile.claimpaid.io` → A record → `147.182.218.81`. One record, then the deploy below.

## Deploy steps (same console style as ClaimPaid deploys)

On the droplet, in a new directory (NOT the ClaimPaid app dir):

1. Clone the Workpile repo (private repo + push are still on his word — code is committed locally only; if the repo does not exist yet, `scp`/copy the `~/workspace/leadflow-os/` tree instead and skip this step).
2. `cp .env.example .env` then edit `.env` — start with ONLY these; everything else stays in honest test/not-configured mode until keys exist:
   - `PORT=4173`
   - `BASE_URL=https://workpile.claimpaid.io`
   - `LEADFLOW_DB=/app/data/leadflow.db` (Docker) or an absolute host path (systemd)
   - Leave Stripe / Resend / Twilio / Google / MS / VAPID blank for the pilot — the app runs without them.
3. `npm ci && npm run build && npm test` (expect 87/87 + smoke) — or `docker compose up -d --build` (Dockerfile + compose ship in the repo).
4. Reverse-proxy: new vhost `workpile.claimpaid.io` → `127.0.0.1:4173`, HTTPS cert for the subdomain (same cert flow as claimpaid.io).
5. Verify from outside: `https://workpile.claimpaid.io/api/health` → `{"ok":true,...}`; landing loads; log in with a fresh prod account.

**Not verified in this prep:** the Docker build was not run here (`Dockerfile` CMD is `node server/index.ts` — relies on Node 24 type-stripping; confirm `node --version` on the droplet and that the image builds before treating the Docker path as proven). The systemd/node path (`npm start`) is the same command local dev uses.

## Do NOT carry over from the demo

- **Demo data stays local.** The G.C. workspace (ws_-4GuI_qxbkNB, 55 services, Weekly Status Report) lives in the local demo DB `~/workspace/leadflow-os/demo-data/demo.db`. Prod starts with a **fresh empty DB**; recreate the G.C. workspace there or re-run the seed — do not copy demo.db to the droplet (it holds 2,600+ demo leads and test accounts).
- **Temp passwords in the demo are not prod credentials:** `GcEnv2026!temp` / `GcOps2026!temp` were local-only. Real Gregory / Shehreyar logins get fresh passwords on prod.
- **G.C. price book is $0 placeholders** by design — real prices are Gregory's to enter, never invented.

## Same-session note

Deploy #111 for ClaimPaid is still unrun (pushed, reminded 2026-11-07, no confirmation since). If he is already in the DigitalOcean console for Workpile, running the #111 one-liner in the same session closes that too — but it is a separate deploy on the ClaimPaid app, not part of this pack.

## Remaining founder steps after this pack

1. Register workpile.io (himself, Porkbun ~$28).
2. Add the `workpile.claimpaid.io` A record.
3. Run the deploy above; say "Workpile started" for outside verification.
4. Later, when keys day comes: Stripe (6 prices above), Resend, Twilio, Google/MS OAuth apps, attorney pass on /terms /privacy /dpa.

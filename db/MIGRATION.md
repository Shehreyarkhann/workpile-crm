# SQLite → Postgres cutover (production hosting)
1. Provision managed Postgres (DO/AWS RDS), set DATABASE_URL.
2. Apply db/postgres-schema.sql.
3. Export SQLite data: `sqlite3 data/leadflow.db .dump` per-table CSVs, load with psql \copy in FK-safe order (workspaces → users → contacts/sources → leads → children).
4. The data-access layer (server/db.ts) is the only file that talks SQL directly; the Postgres adapter replaces DatabaseSync with a pg Pool behind the same prepare/get/all/run surface — queries were kept ANSI-compatible deliberately (no SQLite-only functions in app code).
5. Cutover gate: run `npm test` + `npm run smoke` against the Postgres adapter, then synthetics (§26) on staging before DNS flip.

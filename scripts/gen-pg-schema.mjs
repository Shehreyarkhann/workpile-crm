// Regenerates db/postgres-schema.sql from the live SQLite schema (single source of truth).
// Run: node scripts/gen-pg-schema.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-pg-"));
process.env.LEADFLOW_DB = path.join(tmp, "gen.db");
const dbm = await import("../server/db.ts");
dbm.initSchema();
await import("../server/app.ts"); // module side effects create the remaining tables (crm, timesheets, ...)
const rows = dbm.db.prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name").all();
const translate = (sql) => sql
  .replace(/REAL/g, "DOUBLE PRECISION")
  .replace(/\bBLOB\b/g, "BYTEA")
  .replace(/WITHOUT ROWID/g, "")
  .trim().replace(/;?$/, ";");
const out = ["-- Workpile — PostgreSQL schema (GENERATED from the SQLite source of truth by scripts/gen-pg-schema.mjs; do not hand-edit)", "-- Generated: " + new Date().toISOString(), ""];
for (const r of rows) if (r.type === "table") out.push(translate(r.sql));
for (const r of rows) if (r.type === "index") out.push(translate(r.sql));
fs.writeFileSync(new URL("../db/postgres-schema.sql", import.meta.url), out.join("\n") + "\n");
console.log("pg schema written:", rows.filter(r => r.type === "table").length, "tables,", rows.filter(r => r.type === "index").length, "indexes");

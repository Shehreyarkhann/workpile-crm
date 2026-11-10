// Exports a SQLite Workpile DB to per-table JSON for PostgreSQL import (cutover tool, §21).
// Run: node scripts/export-data.mjs <sqlite-path> <out-dir>
import fs from "node:fs";
import path from "node:path";
const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) { console.error("usage: export-data.mjs <sqlite-path> <out-dir>"); process.exit(1); }
process.env.LEADFLOW_DB = src;
const dbm = await import("../server/db.ts");
fs.mkdirSync(outDir, { recursive: true });
const tables = dbm.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
const manifest = {};
for (const t of tables) {
  const rows = dbm.db.prepare(`SELECT * FROM "${t}"`).all();
  fs.writeFileSync(path.join(outDir, t + ".json"), JSON.stringify(rows));
  manifest[t] = rows.length;
}
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ exported_at: new Date().toISOString(), source: src, tables: manifest }, null, 2));
console.log("exported", tables.length, "tables,", Object.values(manifest).reduce((a, b) => a + b, 0), "rows ->", outDir);

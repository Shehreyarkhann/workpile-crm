// Wipe the G.C. Environmental workspace from the PROD database — full cascade,
// mirroring the platform-admin DELETE /api/admin/customers/:id logic exactly
// (every workspace_id table swept, platform_audit preserved by design,
// member users whose only home this was are removed with their sessions).
// Run ON the droplet: node scripts/wipe-gc-workspace.mjs [dbPath]
// Target is resolved by Gregory Collins' OWNER membership — never a hard-coded
// workspace id — with name + HQ-collision guards. After this runs, re-seed with:
//   node scripts/seed-gc-pilot.mjs https://workpile.claimpaid.io
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

let dbPath = process.argv[2];
if (!dbPath) {
  try {
    const env = fs.readFileSync("/opt/workpile/.env", "utf8");
    const m = env.match(/^LEADFLOW_DB=(.+)$/m);
    if (m) dbPath = m[1].trim();
  } catch { /* fall through to default */ }
  dbPath = dbPath || "/opt/workpile/data/leadflow.db";
}
console.log("DB:", dbPath);
const db = new DatabaseSync(dbPath);

// --- Resolve + guard the target workspace ---
const targets = db.prepare(
  `SELECT w.id, w.name FROM workspaces w
   JOIN memberships m ON m.workspace_id = w.id
   JOIN users u ON u.id = m.user_id
   WHERE u.email = 'gregory@gcenvironmental.com' AND m.role = 'OWNER'`
).all();
if (targets.length !== 1) { console.error(`ABORT: expected exactly 1 workspace owned by gregory@gcenvironmental.com, found ${targets.length}`); process.exit(1); }
const w = targets[0];
if (!/G\.C\. Environmental/i.test(w.name)) { console.error(`ABORT: workspace name "${w.name}" is not G.C. Environmental`); process.exit(1); }
const hq = db.prepare(
  `SELECT w.id FROM workspaces w JOIN memberships m ON m.workspace_id = w.id JOIN users u ON u.id = m.user_id
   WHERE u.email = 'shehreyarkhann@outlook.com' AND m.role = 'OWNER'`
).all();
if (hq.some((h) => h.id === w.id)) { console.error("ABORT: target collides with the HQ workspace"); process.exit(1); }

const count = (sql, ...a) => { try { return db.prepare(sql).get(...a).c; } catch { return "?"; } };
console.log(`Target: ${w.name} (${w.id})`);
console.log("before: leads", count("SELECT COUNT(*) c FROM leads WHERE workspace_id=?", w.id),
  "| jobs", count("SELECT COUNT(*) c FROM jobs WHERE workspace_id=?", w.id),
  "| proposals", count("SELECT COUNT(*) c FROM proposals WHERE workspace_id=?", w.id),
  "| members", count("SELECT COUNT(*) c FROM memberships WHERE workspace_id=?", w.id));

// --- Cascade (mirrors server/app.ts admin customer delete) ---
const memberIds = db.prepare("SELECT user_id FROM memberships WHERE workspace_id=?").all(w.id).map((r) => r.user_id);
let removed = 0;
db.exec("PRAGMA foreign_keys=OFF");
try {
  db.exec("BEGIN");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  for (const t of tables) {
    if (t.name === "platform_audit") continue; // the operator's ledger outlives the workspace by design
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all().map((c) => c.name);
    if (cols.includes("workspace_id")) {
      const r = db.prepare(`DELETE FROM ${t.name} WHERE workspace_id=?`).run(w.id);
      removed += Number(r.changes || 0);
    }
  }
  for (const uidX of memberIds) {
    const left = db.prepare("SELECT COUNT(*) c FROM memberships WHERE user_id=?").get(uidX).c;
    const u = db.prepare("SELECT workspace_id FROM users WHERE id=?").get(uidX);
    if (left === 0) {
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(uidX);
      db.prepare("DELETE FROM users WHERE id=?").run(uidX);
    } else if (u && u.workspace_id === w.id) {
      const m = db.prepare("SELECT workspace_id, role FROM memberships WHERE user_id=? LIMIT 1").get(uidX);
      db.prepare("UPDATE users SET workspace_id=?, role=? WHERE id=?").run(m.workspace_id, m.role, uidX);
    }
  }
  db.prepare("DELETE FROM workspaces WHERE id=?").run(w.id);
  db.exec("COMMIT");
} catch (e) {
  try { db.exec("ROLLBACK"); } catch { /* noop */ }
  console.error("WIPE FAILED, rolled back:", e.message);
  process.exit(1);
} finally {
  db.exec("PRAGMA foreign_keys=ON");
}

const remaining = db.prepare("SELECT id, name FROM workspaces ORDER BY name").all();
console.log(`WIPED ${w.name}: ${removed} workspace rows removed.`);
console.log("remaining workspaces:", remaining.map((r) => `${r.name} (${r.id})`).join(" | ") || "none");

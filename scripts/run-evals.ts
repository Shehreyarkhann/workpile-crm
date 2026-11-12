// Standalone eval run: node scripts/run-evals.ts
// Boots a throwaway DB, seeds one scratch workspace + owner, runs the full
// scenario suite from server/evals.ts, prints the scorecard, exits non-zero
// on any failure. Nothing here touches a real database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-evals-"));
process.env.LEADFLOW_DB = path.join(dir, "evals.db");
process.chdir(dir);
const dbm = await import("../server/db.ts");
dbm.initSchema();
await import("../server/app.ts"); // boots the CRM schema (campaigns, labels, …) the scenarios exercise
const { runEvals } = await import("../server/evals.ts");
const ws = dbm.uid("ws"), user = dbm.uid("usr");
dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "Eval Scratch Co", dbm.now());
dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,active) VALUES (?,?,?,?,?,?,?)").run(user, ws, "Eval Owner", "owner@eval.test", dbm.hashPassword("eval-only"), "OWNER", 1);
const report = await runEvals(ws, user);
console.log(`\nWorkpile operator evals — ${report.passed}/${report.total} passing\n`);
for (const r of report.results) console.log(`${r.pass ? "✔" : "✖"} ${r.name}\n    ${r.detail}`);
console.log("");
process.exit(report.passed === report.total ? 0 : 1);

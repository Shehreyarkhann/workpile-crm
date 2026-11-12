// V51 Phase 3 — earned autonomy + the eval harness as a release gate.
// The harness itself is under test: every scenario must pass, so a future
// change that breaks pricing integrity, the consent boundary, a stage guard,
// payment safety, dedupe, conflict handling, proactive dedupe, the loop, or
// the earned-autonomy invariants fails CI loudly with a named scenario.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v51-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const evals = await import("../server/evals.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v51", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let wsid = ""; let actor = "";
before(async () => {
  await call("POST", "/api/auth/register", { name: "Olivia Owner", email: "owner@v51.test", password: PW, business_name: "V51 Eval Co" });
  const l = await call("POST", "/api/auth/login", { email: "owner@v51.test", password: PW });
  const me = await call("GET", "/api/auth/me", undefined, l.cookie);
  wsid = me.j.user.workspace_id; actor = me.j.user.id;
});

test("the eval scorecard: every scenario passes", async () => {
  const report = await evals.runEvals(wsid, actor);
  for (const r of report.results) console.log(`${r.pass ? "✔" : "✖"} ${r.name} — ${r.detail}`);
  assert.equal(report.passed, report.total, `eval failures: ${report.results.filter(r => !r.pass).map(r => r.name + ": " + r.detail).join(" | ")}`);
  assert.equal(report.total, 10);
});

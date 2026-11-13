// v74: live agent runs. A run used to hold one HTTP request open from start
// to finish — on a phone connection that's fragile, and the user stared at
// "Working…" with no steps. Now POST /api/agent/execute?async=1 inserts the
// execution and returns it immediately; planning/execution continue in the
// background and persist every step, so clients poll and watch. The stub
// model answers slowly (650ms/turn) so mid-flight states are observable.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v74", "pw", "7411"].join("-");
const ITEM = "itm_v74test1"; const LEAD = "lead_v74test";
const realFetch = globalThis.fetch;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function stubFetch() {
  (globalThis as any).fetch = async (url: any, init: any = {}) => {
    const u = String(url);
    if (u.startsWith("http://127.0.0.1")) return realFetch(url, init);
    await sleep(650); // a real model thinks; the run must be observable meanwhile
    const body = JSON.parse(String(init.body || "{}"));
    const results: any[] = [];
    for (const m of body.messages || []) for (const b of Array.isArray(m.content) ? m.content : []) if (b.type === "tool_result") results.push(b);
    const tri = results.find(r => r.tool_use_id === "tu_1");
    const dr = results.find(r => r.tool_use_id === "tu_2");
    const reply = (content: any[]) => ({ ok: true, status: 200, text: async () => "", json: async () => ({ content, usage: { input_tokens: 5, output_tokens: 5 }, model: "claude-sonnet-5-5" }) });
    if (dr) return reply([{ type: "text", text: "Drafted the reply for the inbox item." }]);
    if (tri) {
      const m = String(tri.content).match(/"items":\[{"id":"([^"]+)"/);
      if (!m) return reply([{ type: "text", text: "I cannot find the item id." }]);
      return reply([{ type: "tool_use", id: "tu_2", name: "draft_inbox_reply", input: { item_id: m[1] } }]);
    }
    return reply([{ type: "tool_use", id: "tu_1", name: "triage_inbox", input: {} }]);
  };
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v74-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner74@demo.test", password: PW, business_name: "V74 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner74@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; const wsId = me.workspace_id;
  const D = dbm.db; const T = new Date().toISOString();
  D.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run("ct_v74", wsId, "Pat Prospect", "pat@example.com");
  D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(LEAD, wsId, "ct_v74", "Tank removal", "NEW", 4200, T, T);
  D.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,lead_id,status,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(ITEM, wsId, "inquiry", "Pat Prospect", "pat@example.com", "Quote for tank removal", "Hi, can you quote a tank removal next week?", LEAD, "open", T, T);
  await call("PATCH", "/api/ai/provider", { provider: "anthropic", model: "claude-sonnet-5-5", api_key: ["sk-ant-api03", "test", "000"].join("-") });
  stubFetch();
});

async function pollUntil(id: string, want: (e: any) => boolean, budgetMs = 25000) {
  const seen: any[] = []; const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const r = await call("GET", `/api/agent/executions/${id}`);
    seen.push(r.body);
    if (r.body && want(r.body)) return { ex: r.body, seen };
    await sleep(100);
  }
  throw new Error("poll budget exhausted; last status: " + (seen[seen.length - 1]?.status || "?"));
}

let exId = ""; let draftStepId = "";
test("async execute returns instantly and the run is observable mid-flight", async () => {
  const t0 = Date.now();
  const r = await call("POST", "/api/agent/execute?async=1", { instruction: "Work my inbox" });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, "planning");
  assert.ok(elapsed < 500, `async start must not block on the model (took ${elapsed}ms)`);
  exId = r.body.id;
  const { ex, seen } = await pollUntil(exId, e => e.status === "awaiting_approval");
  assert.ok(seen.some(e => e.status === "executing"), "a poll must catch the run mid-flight (status executing)");
  assert.ok(seen.some(e => e.status === "executing" && (e.plan || []).length >= 1 && e.plan[0].status === "done"), "steps must appear live as they complete");
  assert.equal(ex.plan.length, 2);
  assert.equal(ex.plan[0].tool, "triage_inbox"); assert.equal(ex.plan[0].status, "done");
  assert.equal(ex.plan[1].tool, "draft_inbox_reply"); assert.equal(ex.plan[1].status, "pending");
  draftStepId = ex.plan[1].id;
});

test("async decide returns instantly and the resumed run streams to completion", async () => {
  const t0 = Date.now();
  const r = await call("POST", `/api/agent/executions/${exId}/decide?async=1`, { approve: [draftStepId] });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(elapsed < 500, `async decide must not block on the resumed loop (took ${elapsed}ms)`);
  const { ex } = await pollUntil(exId, e => e.status === "completed");
  assert.match(String(ex.summary || ""), /Drafted the reply/);
});

test("the synchronous execute path is unchanged for existing callers", async () => {
  const r = await call("POST", "/api/agent/execute", { instruction: "Work my inbox" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.status, "awaiting_approval"); // sync callers still get the paused/finished execution, not a shell
  assert.equal((r.body.plan || []).length, 2);
});

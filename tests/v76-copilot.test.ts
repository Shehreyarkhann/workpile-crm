// v76: one brain, a real chat, real files, self-learning.
//  - The Automations tab's old rules bot (/api/agent/command) is retired;
//    navbar agent and Copilot run the same loop.
//  - Copilot threads: earlier turns ride into a new run's context.
//  - generate_report / draft_document produce downloadable .docx files whose
//    figures come from code (reports) or the run's gathered data (drafts).
//  - After a run completes, the agent distills durable facts into business
//    memory on its own; a deterministic patterns pass learns from the data.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let learning: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v76", "pw", "7611"].join("-");
let wsId = "";
const realFetch = globalThis.fetch;
let MODE = "plain";
let sawThreadContext = false;

function stubFetch() {
  (globalThis as any).fetch = async (url: any, init: any = {}) => {
    const u = String(url);
    if (u.startsWith("http://127.0.0.1")) return realFetch(url, init);
    const body = JSON.parse(String(init.body || "{}"));
    const reply = (content: any[]) => ({ ok: true, status: 200, text: async () => "", json: async () => ({ content, usage: { input_tokens: 5, output_tokens: 5 }, model: "claude-sonnet-5-5" }) });
    if (String(body.system || "").includes("long-term memory")) {
      return reply([{ type: "text", text: "[\"Vince Vendor prefers a yard walk before signing off\", \"Invoice disputes need the PO attached\"]" }]);
    }
    const flat = JSON.stringify(body.messages || []);
    if (flat.includes("Conversation so far in this thread")) sawThreadContext = true;
    const results: any[] = [];
    for (const m of body.messages || []) for (const b of Array.isArray(m.content) ? m.content : []) if (b.type === "tool_result") results.push(b);
    if (results.length) return reply([{ type: "text", text: "Done — the file is generated and attached to this run." }]);
    if (MODE === "report") return reply([{ type: "tool_use", id: "tu_r", name: "generate_report", input: { kind: "weekly_status" } }]);
    if (MODE === "draft") return reply([{ type: "tool_use", id: "tu_d", name: "draft_document", input: { title: "Customer Follow-Up — Vince Vendor", content: "## Summary\nVince Vendor asked to review invoice #44 before sign-off.\n## Next steps\n- Walk the yard with Daniel\n- Attach the PO to the reply" } }]);
    return reply([{ type: "text", text: "First answer: the yard walk is Friday." }]);
  };
}

before(async () => {
  stubFetch();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v76-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  learning = await import("../server/agent-learning.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner76@demo.test", password: PW, business_name: "V76 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner76@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; wsId = me.workspace_id;
  await call("PATCH", "/api/ai/provider", { provider: "anthropic", model: "claude-sonnet-5-5", api_key: ["sk-ant-api03", "test", "000"].join("-") });
  const D = dbm.db; const T = new Date().toISOString();
  D.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run("ct_v76", wsId, "Vince Vendor", "vince@vendor.example");
  for (let i = 0; i < 3; i++) D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("lead_v76_" + i, wsId, "ct_v76", "Equipment rental", "WORKING", 900, T, T);
  D.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("job_v76", wsId, "lead_v76_0", "IN_PROGRESS", 4200, T, T);
});

test("the old rules bot is retired — one brain only", async () => {
  const r = await call("POST", "/api/agent/command", { text: "get organized" });
  assert.equal(r.status, 404);
});

test("generate_report produces a real downloadable file with code-computed figures", async () => {
  MODE = "report";
  const r0 = await call("POST", "/api/agent/execute", { instruction: "Generate the weekly status report as a file" });
  // At the default autonomy level the file step waits for approval — approve
  // it (the earned-autonomy gate working as designed), then it completes.
  const p0 = (r0.body.plan || []).find((s: any) => s.tool === "generate_report");
  const r = r0.body.status === "awaiting_approval" ? await call("POST", `/api/agent/executions/${r0.body.id}/decide`, { approve: [p0.id] }) : r0;
  assert.equal(r.body.status, "completed", JSON.stringify(r.body).slice(0, 300));
  const step = (r.body.plan || []).find((s: any) => s.tool === "generate_report");
  assert.ok(step?.refs?.file_id, "file id in step refs");
  const row = dbm.db.prepare("SELECT * FROM generated_files WHERE id=?").get(step.refs.file_id) as any;
  assert.equal(row.kind, "weekly_status");
  assert.match(row.filename, /^Weekly-Status-Report-\d{4}-\d{2}-\d{2}\.docx$/);
  assert.ok(row.size > 1500, "docx has substance: " + row.size);
  const dl = await fetch(base + `/api/agent/files/${row.id}/download`, { headers: { cookie } });
  assert.equal(dl.status, 200);
  const buf = Buffer.from(await dl.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK");
});

test("draft_document renders the composed document as a file", async () => {
  MODE = "draft";
  const r0 = await call("POST", "/api/agent/execute", { instruction: "Draft a follow-up document for Vince Vendor from his record" });
  const p0 = (r0.body.plan || []).find((s: any) => s.tool === "draft_document");
  const r = r0.body.status === "awaiting_approval" ? await call("POST", `/api/agent/executions/${r0.body.id}/decide`, { approve: [p0.id] }) : r0;
  assert.equal(r.body.status, "completed", JSON.stringify(r.body).slice(0, 300));
  const step = (r.body.plan || []).find((s: any) => s.tool === "draft_document");
  assert.ok(step?.refs?.file_id);
  const row = dbm.db.prepare("SELECT * FROM generated_files WHERE id=?").get(step.refs.file_id) as any;
  assert.equal(row.kind, "draft");
  assert.ok(row.size > 1200);
});

test("Copilot threads carry the conversation into the next run", async () => {
  MODE = "plain"; sawThreadContext = false;
  const t1 = await call("POST", "/api/agent/execute", { instruction: "When is the yard walk?", thread_id: "thr_v76test" });
  assert.equal(t1.body.status, "completed");
  const t2 = await call("POST", "/api/agent/execute", { instruction: "And who should join it?", thread_id: "thr_v76test" });
  assert.equal(t2.body.status, "completed");
  assert.equal(sawThreadContext, true, "the second run's first message carried the thread history");
  const list = await call("GET", "/api/agent/threads");
  const th = (list.body as any[]).find(x => x.thread_id === "thr_v76test");
  assert.ok(th && th.turns === 2, "thread lists with 2 turns");
  const turns = await call("GET", "/api/agent/threads/thr_v76test");
  assert.equal((turns.body as any[]).length, 2);
});

test("the agent learns from finished runs on its own", async () => {
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    const rows = dbm.db.prepare("SELECT * FROM agent_memories WHERE workspace_id=? AND source='learned'").all(wsId) as any[];
    found = rows.some(r => String(r.content).includes("yard walk"));
    if (!found) await new Promise(r => setTimeout(r, 400));
  }
  assert.ok(found, "a distilled fact landed in business memory without anyone teaching it");
  const mem = await call("GET", "/api/agent/memories");
  assert.ok((mem.body as any[]).some((f: any) => f.source === "learned"));
});

test("the daily patterns pass learns from the data itself", async () => {
  learning.learnPatterns(wsId);
  const rows = dbm.db.prepare("SELECT * FROM agent_memories WHERE workspace_id=? AND source='patterns'").all(wsId) as any[];
  assert.ok(rows.some(r => String(r.content).includes("Most requested service")), JSON.stringify(rows.map(r => r.content)));
});

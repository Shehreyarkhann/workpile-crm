// V50 Phase 2 — business memory + proactive operator.
// Memory: taught facts persist, are deduplicated, and appear in the brief the
// loop seeds from — alongside per-tool decision statistics computed from how
// humans actually decided past steps. Proactive: the five money-leak
// situations each prepare a governed execution exactly once per day.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v50-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);
const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
const mem = await import("../server/agent-memory.ts");
const pro = await import("../server/proactive.ts");
const agent = await import("../server/agent.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v50", "pw", "9921"].join("-");
async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie"); return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let owner = ""; let wsid = ""; let owner2 = ""; let ws2 = "";
before(async () => {
  for (const [em, biz, set] of [["owner@v50.test", "V50 Memory Co", "a"], ["owner2@v50.test", "V50 Proactive Co", "b"]] as const) {
    const r = await call("POST", "/api/auth/register", { name: "Olivia Owner", email: em, password: PW, business_name: biz });
    assert.equal(r.s, 201, JSON.stringify(r.j));
    const l = await call("POST", "/api/auth/login", { email: em, password: PW });
    const me = await call("GET", "/api/auth/me", undefined, l.cookie);
    if (set === "a") { owner = l.cookie!; wsid = me.j.user.workspace_id; } else { owner2 = l.cookie!; ws2 = me.j.user.workspace_id; }
  }
});

test("memory: facts persist, dedupe, and the brief carries facts + decision stats", async () => {
  const svc = await call("POST", "/api/services", { name: "Tank Testing" }, owner);
  assert.ok([200, 201].includes(svc.s), JSON.stringify(svc.j));
  const f1 = mem.rememberFact(wsid, "The owner prefers site visits in the morning.", "owner", "u1");
  const f2 = mem.rememberFact(wsid, "The owner prefers site visits in the morning.", "operator", "u2");
  assert.equal(f2.duplicate, true); assert.equal(f1.id, f2.id);
  // decision history: send_message approved 3, rejected 1; record_payment approved 2
  const plan = JSON.stringify([
    ...[1, 2, 3].map(i => ({ id: "s" + i, tool: "send_message", needs_approval: true, status: "done" })),
    { id: "s4", tool: "send_message", needs_approval: true, status: "rejected" },
    ...[1, 2].map(i => ({ id: "p" + i, tool: "record_payment", needs_approval: true, status: "done" })),
    { id: "r1", tool: "search_leads", needs_approval: false, status: "done" },
  ]);
  dbm.db.prepare("INSERT INTO agent_executions (id,workspace_id,user_id,instruction,status,planner,plan,created_at,updated_at) VALUES (?,?,?,?,'completed','loop:test',?,?,?)").run(dbm.uid("exe"), wsid, "u1", "history", plan, dbm.now(), dbm.now());
  const stats = mem.decisionStats(wsid);
  const sm = stats.find(s => s.tool === "send_message");
  assert.equal(sm?.rate, 75); assert.equal(sm?.decided, 4);
  const brief = mem.operatorBrief(wsid);
  assert.match(brief, /Tank Testing/);
  assert.match(brief, /prefers site visits in the morning/);
  assert.match(brief, /send_message approved 75% \(3\/4\)/);
});

test("memory: the loop's seed context includes the remembered facts", async () => {
  dbm.db.prepare("UPDATE workspaces SET llm_api_key='sk-test', llm_provider='anthropic', agent_level=3 WHERE id=?").run(wsid);
  const realFetch = globalThis.fetch; let seedSeen = "";
  (globalThis as any).fetch = async (url: any, init: any) => {
    if (String(url).includes("api.anthropic.com")) { const body = JSON.parse(init.body); seedSeen = JSON.stringify(body.messages); return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Noted." }], usage: { input_tokens: 3, output_tokens: 2 }, model: "claude-sonnet-4-5" }), text: async () => "{}" }; }
    return realFetch(url, init);
  };
  try {
    const ex = await agent.createExecution(wsid, "u1", "Anything I should know?");
    assert.equal(ex.status, "completed");
    assert.ok(seedSeen.includes("prefers site visits in the morning"), "the model started the run already knowing the taught fact");
  } finally { (globalThis as any).fetch = realFetch; }
});

test("proactive: the five leaks prepare governed work — once", async () => {
  const lead = async (name: string, phone: string, state: string) => {
    const r = await call("POST", "/api/leads", { contact: { name, email: name.replace(/\s/g, "").toLowerCase() + "@x.test", phone }, consent: { contact_ok: true }, service_requested: "Tank Testing", est_value: 1500 }, owner2);
    const id = r.j.lead.id; if (state !== "NEW") dbm.db.prepare("UPDATE leads SET state=? WHERE id=?").run(state, id); return id;
  };
  const l1 = await lead("Old Untouched", "6315551111", "NEW");
  dbm.db.prepare("UPDATE leads SET created_at=datetime('now','-2 days'), first_touch_at=NULL, first_response_at=NULL WHERE id=?").run(l1);
  const l2 = await lead("Owes Money", "6315552222", "WON");
  dbm.db.prepare("INSERT INTO invoices (id,workspace_id,lead_id,number,total,paid_amount,status,due_at,created_at) VALUES (?,?,?,'INV-9001',1800,0,'sent',datetime('now','-10 days'),?)").run(dbm.uid("inv"), ws2, l2, dbm.now());
  const l3 = await lead("Cold Proposal", "6315553333", "SENT");
  const propId = dbm.uid("pro");
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,total,status,sent_at,version,created_at) VALUES (?,?,?,2200,'sent',datetime('now','-9 days'),1,?)").run(propId, ws2, l3, dbm.now());
  const jobId = dbm.uid("job");
  dbm.db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,'IN_PROGRESS',3000,?,?)").run(jobId, ws2, l2, dbm.now(), dbm.now());
  dbm.db.prepare("INSERT INTO documents (id,workspace_id,job_id,lead_id,name,required,status) VALUES (?,?,?,?,'COI',1,'missing')").run(dbm.uid("doc"), ws2, jobId, l2);
  dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,tier,submitted_by,submitted_at) VALUES (?,?,?,?,'ops','u1',datetime('now','-3 days'))").run(dbm.uid("apr"), ws2, l3, propId);
  const notifBefore = (dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE workspace_id=?").get(ws2) as any).c;
  const r1 = await pro.processProactive();
  assert.ok(r1.fired.filter(f => f.startsWith(ws2)).length >= 5, JSON.stringify(r1.fired));
  const execs = dbm.db.prepare("SELECT * FROM agent_executions WHERE workspace_id=? AND planner='proactive (rules)'").all(ws2) as any[];
  assert.equal(execs.length, 4, "four execution triggers (stale approvals is a reminder only)");
  assert.ok(execs.every(e => e.instruction.startsWith("[proactive:")));
  assert.ok(execs.some(e => e.status === "awaiting_approval"), "customer-facing steps wait for the human");
  const notifAfter = (dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE workspace_id=?").get(ws2) as any).c;
  assert.ok(notifAfter > notifBefore, "owners were notified");
  const r2 = await pro.processProactive();
  assert.equal(r2.fired.filter(f => f.startsWith(ws2)).length, 0, "24h dedupe: nothing refires");
  const execs2 = dbm.db.prepare("SELECT COUNT(*) c FROM agent_executions WHERE workspace_id=? AND planner='proactive (rules)'").get(ws2) as any;
  assert.equal(execs2.c, 4);
});

// v72: the agent could not work the inbox — tool results fed to the model were
// summary-only prose, so the model never learned item/lead ids and told the
// user it could not act. Fix: the loop appends each tool's structured refs to
// the result the model sees (drive + resume), triage/search carry lead/job
// linkage, and discovery tools (get_inbox_item, list_team, list_jobs,
// list_tasks, list_invoices) make every actionable id findable.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let tools: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v72", "pw", "7211"].join("-");
let wsId = ""; let userId = "";
const ITEM = "itm_v72test1"; const LEAD = "lead_v72test"; const CONTACT = "ct_v72test";
const realFetch = globalThis.fetch;
let sawRefsInTriage = false; let sawDraftRefs = false; let extractedItemId = "";

function stubFetch() {
  (globalThis as any).fetch = async (url: any, init: any = {}) => {
    const u = String(url);
    if (u.startsWith("http://127.0.0.1")) return realFetch(url, init);
    const body = JSON.parse(String(init.body || "{}"));
    const results: any[] = [];
    for (const m of body.messages || []) for (const b of Array.isArray(m.content) ? m.content : []) if (b.type === "tool_result") results.push(b);
    const tri = results.find(r => r.tool_use_id === "tu_1");
    const dr = results.find(r => r.tool_use_id === "tu_2");
    const reply = (content: any[]) => ({ ok: true, status: 200, text: async () => "", json: async () => ({ content, usage: { input_tokens: 5, output_tokens: 5 }, model: "claude-sonnet-5-5" }) });
    if (dr) { sawDraftRefs = String(dr.content).includes("draft_body") && String(dr.content).includes("refs:"); return reply([{ type: "text", text: "Drafted the reply for the inbox item." }]); }
    if (tri) {
      const c = String(tri.content);
      sawRefsInTriage = c.includes("refs:") && c.includes(ITEM) && c.includes('"lead_id":"' + LEAD + '"');
      const m = c.match(/"items":\[\{"id":"([^"]+)"/);
      extractedItemId = m ? m[1] : "";
      if (!extractedItemId) return reply([{ type: "text", text: "I cannot find the item id." }]);
      return reply([{ type: "tool_use", id: "tu_2", name: "draft_inbox_reply", input: { item_id: extractedItemId } }]);
    }
    return reply([{ type: "tool_use", id: "tu_1", name: "triage_inbox", input: {} }]);
  };
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v72-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  tools = await import("../server/tools.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner72@demo.test", password: PW, business_name: "V72 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner72@demo.test", password: PW });
  const me = (await call("GET", "/api/auth/me")).body.user; wsId = me.workspace_id; userId = me.id;
  const D = dbm.db; const T = new Date().toISOString();
  D.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?)").run(CONTACT, wsId, "Pat Prospect", "pat@example.com");
  D.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(LEAD, wsId, CONTACT, "Tank removal", "NEW", 4200, T, T);
  D.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,lead_id,status,received_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(ITEM, wsId, "inquiry", "Pat Prospect", "pat@example.com", "Quote for tank removal", "Hi, can you quote a tank removal next week? Thursday works for a visit.", LEAD, "open", T, T);
  D.prepare("INSERT INTO jobs (id,workspace_id,lead_id,stage,value,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("job_v72test", wsId, LEAD, "SCHEDULED", 4200, T, T);
  D.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,total,created_at) VALUES (?,?,?,?,?,?,?)").run("prop_v72test", wsId, LEAD, 1, "draft", 4200, T);
  D.prepare("INSERT INTO tasks (id,workspace_id,lead_id,assignee_id,type,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("tsk_v72test", wsId, LEAD, userId, "follow_up", "Call Pat back", T, "open", T);
  D.prepare("INSERT INTO invoices (id,workspace_id,lead_id,job_id,number,status,total,paid_amount,created_at) VALUES (?,?,?,?,?,?,?,?,?)").run("inv_v72test", wsId, LEAD, "job_v72test", "INV-9001", "sent", 4200, 0, T);
  await call("PATCH", "/api/ai/provider", { provider: "anthropic", model: "claude-sonnet-5-5", api_key: ["sk-ant-api03", "test", "000"].join("-") });
});

test("the loop feeds refs (item id + lead id) to the model, which chains into draft_inbox_reply", async () => {
  stubFetch();
  const ex = await call("POST", "/api/agent/execute", { instruction: "Work my inbox" });
  assert.ok([200, 201].includes(ex.status), JSON.stringify(ex.body).slice(0, 300));
  let run = ex.body;
  if (run.status === "awaiting_approval") {
    const pend = (run.plan || []).filter((s: any) => s.status === "pending").map((s: any) => s.id);
    assert.ok(pend.length >= 1, "the draft step should be waiting for approval");
    const dec = await call("POST", `/api/agent/executions/${run.id}/decide`, { approve: pend });
    assert.ok([200, 201].includes(dec.status), JSON.stringify(dec.body).slice(0, 200));
    run = dec.body;
  }
  assert.equal(run.status, "completed", JSON.stringify(run).slice(0, 400));
  assert.ok(sawRefsInTriage, "the triage tool result the model received must carry refs with the item id and lead_id");
  assert.equal(extractedItemId, ITEM);
  const draft = (run.plan || []).find((s: any) => s.tool === "draft_inbox_reply");
  assert.ok(draft && draft.status === "done", "draft step done: " + JSON.stringify(run.plan).slice(0, 400));
  assert.equal(draft.refs.item_id, ITEM);
  assert.equal(draft.refs.lead_id, LEAD);
  assert.ok(sawDraftRefs, "after approval, the resumed loop must also receive the draft step's refs");
});

test("discovery tools return the ids every write tool needs", async () => {
  const item = await tools.TOOLS.get_inbox_item.run(wsId, userId, { item_id: ITEM });
  assert.equal(item.refs.lead_id, LEAD); assert.match(item.summary, /tank removal/i);
  const team = await tools.TOOLS.list_team.run(wsId, userId, {});
  assert.ok(team.refs.team.some((u: any) => u.id === userId));
  const jobs = await tools.TOOLS.list_jobs.run(wsId, userId, {});
  assert.ok(jobs.refs.job_ids.includes("job_v72test"));
  const tasks = await tools.TOOLS.list_tasks.run(wsId, userId, {});
  assert.ok(tasks.refs.tasks.some((t: any) => t.id === "tsk_v72test"));
  const invs = await tools.TOOLS.list_invoices.run(wsId, userId, {});
  assert.ok(invs.refs.invoices.some((i: any) => i.id === "inv_v72test" && i.balance === 4200));
  const ctx = await tools.TOOLS.get_customer_context.run(wsId, userId, { lead_id: LEAD });
  assert.equal(ctx.refs.proposal.id, "prop_v72test");
  assert.ok(ctx.refs.job_ids.includes("job_v72test"));
  const tri = await tools.TOOLS.triage_inbox.run(wsId, userId, {});
  const mine = tri.refs.items.find((i: any) => i.id === ITEM);
  assert.ok(mine && mine.lead_id === LEAD, "triage refs carry the lead linkage");
});

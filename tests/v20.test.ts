// V20: agent governance visibility — decision attribution, the playbook (system prompt +
// locked tool list + house rules), global search for invoices/proposals.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v20-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let ck = "";
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const WSID = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,vertical,created_at) VALUES (?,?,?,?)").run(WSID, "V20 Co", "environmental", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), WSID, "Olivia Owner", "o@v20.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("UPDATE workspaces SET agent_level=1 WHERE id=?").run(WSID);
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  ck = (await J("/api/auth/login", { method: "POST", body: { email: "o@v20.co", password: "password1" } })).cookie;
});
const A = () => ({ Cookie: ck });

test("executions record who created and who decided", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Quinn Qual", email: "q@x.co" }, service_requested: "Tank Testing", est_value: 4000 } }, A())).j.lead;
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "QUALIFIED" } }, A());
  const ex = await J("/api/agent/execute", { method: "POST", body: { instruction: "Prepare proposals for qualified leads" } }, A());
  assert.equal(ex.j.status, "awaiting_approval");
  assert.equal(ex.j.creator_name, "Olivia Owner");
  assert.equal(ex.j.decided_by_name, null);
  const pend = ex.j.plan.filter((s: any) => s.status === "pending");
  const done = await J(`/api/agent/executions/${ex.j.id}/decide`, { method: "POST", body: { approve: pend.map((s: any) => s.id) } }, A());
  assert.equal(done.j.status, "completed");
  assert.equal(done.j.decided_by_name, "Olivia Owner", "the decider is on the record");
  assert.ok(done.j.decided_at);
});

test("playbook: system prompt + locked tool list visible; house rules save and apply", async () => {
  const cfg = (await J("/api/agent/config", {}, A())).j;
  assert.match(cfg.system_prompt, /Workpile Agent/);
  assert.equal(cfg.tools.length, 18);
  assert.ok(cfg.tools.every((t: any) => t.name && t.description && ["read", "draft", "execute", "approval"].includes(t.control)));
  assert.ok(cfg.tools.some((t: any) => t.name === "send_message" && t.control === "approval"));
  const saved = await J("/api/agent/config", { method: "PATCH", body: { custom_instructions: "Never schedule on Sundays." } }, A());
  assert.equal(saved.j.custom_instructions, "Never schedule on Sundays.");
  const cfg2 = (await J("/api/agent/config", {}, A())).j;
  assert.equal(cfg2.custom_instructions, "Never schedule on Sundays.");
});

test("global search finds invoices by number and proposals by customer", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Ivy Invoice", email: "ivy@x.co" }, service_requested: "Mold Testing", est_value: 2500 } }, A())).j.lead;
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,total,status,created_at) VALUES (?,?,?,1,2500,'sent',datetime('now'))").run(dbm.uid("prop"), (dbm.db.prepare("SELECT workspace_id FROM leads WHERE id=?").get(lead.id) as any).workspace_id, lead.id);
  await J(`/api/leads/${lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, A());
  const job = (await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, A())).j;
  await J(`/api/jobs/${job.id}/invoice`, { method: "POST", body: {} }, A());
  const byInv = (await J("/api/search?q=INV-", {}, A())).j;
  assert.ok(byInv.invoices.length >= 1 && byInv.invoices[0].job_id === job.id, "invoice found by number");
  const byProp = (await J("/api/search?q=Ivy", {}, A())).j;
  assert.ok(byProp.proposals.some((p: any) => p.lead_id === lead.id), "proposal found by customer name");
});

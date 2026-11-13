// v71: the inbox knows who is writing — sender identity (customer / company /
// known / new), threads attached to the active job, a Sent stream, and the
// AI scan that links and attaches the backlog.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v71", "pw", "7171"].join("-");
let wsId = ""; let custLead = ""; let jobLead = ""; let jobId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v71-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(24000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner71@demo.test", password: PW, business_name: "V71 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner71@demo.test", password: PW });
  wsId = (await call("GET", "/api/auth/me")).body.user.workspace_id;
  // a customer: lead taken to WON (converts to an account)
  const c = await call("POST", "/api/leads", { contact: { name: "Carol Customer", email: "carol@v71.test", phone: "5550177101" }, service_requested: "Remediation", est_value: 20000 });
  custLead = c.body.lead.id;
  const won = await call("POST", `/api/leads/${custLead}/stage`, { to: "WON", confirm_no_proposal: true });
  assert.equal(won.status, 200, JSON.stringify(won.body));
  // a lead with an active job
  const jl = await call("POST", "/api/leads", { contact: { name: "Jim Job", email: "jim@v71.test", phone: "5550177102" }, service_requested: "Tank Removal", est_value: 9000 });
  jobLead = jl.body.lead.id;
  const job = await call("POST", "/api/jobs", { lead_id: jobLead });
  jobId = (job.body?.id || job.body?.job?.id); assert.ok(jobId, JSON.stringify(job.body));
});
async function ingest(from_email: string, from_name: string, subject: string, body: string) {
  const r = await call("POST", "/api/inbox/ingest", { from_name, from_email, subject, body });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return dbm.db.prepare("SELECT * FROM inbox_items WHERE workspace_id=? AND subject=?").get(wsId, subject) as any;
}

test("identity: a customer is recognized, with their company", async () => {
  const it = await ingest("carol@v71.test", "Carol Customer", "Question about the work", "Hi — quick question about the remediation schedule next week.");
  assert.equal(it.lead_id, custLead);
  const list = await call("GET", "/api/inbox");
  const row = (list.body as any[]).find(x => x.id === it.id);
  assert.ok(row.identity, "identity present");
  assert.equal(row.identity.is_customer, true, JSON.stringify(row.identity));
  assert.ok(row.identity.company, "company named: " + JSON.stringify(row.identity));
  assert.equal(row.identity.lead_id, custLead);
});

test("identity: a job thread names the job, attaches at ingest, and shows on the job", async () => {
  const it = await ingest("jim@v71.test", "Jim Job", "Gate code for Friday", "Hi — the gate code for the crew on Friday is 4417. Thanks.");
  assert.equal(it.lead_id, jobLead);
  assert.equal(it.job_id, jobId, "thread attached to the job at ingest");
  const list = await call("GET", "/api/inbox");
  const row = (list.body as any[]).find(x => x.id === it.id);
  assert.equal(row.identity.job?.id, jobId, JSON.stringify(row.identity));
  const q = await call("GET", "/api/queue");
  const qi = (q.body.items || []).find((x: any) => x.inbox_id === it.id);
  assert.equal(qi.identity.job?.id, jobId, "queue item carries the job identity");
  const job = await call("GET", `/api/jobs/${jobId}`);
  assert.ok((job.body.emails || []).some((e: any) => e.id === it.id), "thread listed on the job record");
});

test("identity: a stranger is a new sender; the Sent tab carries our replies", async () => {
  const it = await ingest("nobody@v71.test", "Random Person", "Do you serve my area?", "Hello — do you serve Nassau county? What are your hours?");
  const list = await call("GET", "/api/inbox");
  const row = (list.body as any[]).find(x => x.id === it.id);
  assert.equal(row.identity.known, false, JSON.stringify(row.identity));
  const rep = await call("POST", `/api/inbox/${it.id}/reply`, { body: "We do — Bay Shore and all of Nassau. 8 to 5:30." });
  assert.equal(rep.status, 200, JSON.stringify(rep.body));
  const sent = await call("GET", "/api/inbox/sent");
  assert.ok(Array.isArray(sent.body));
  const mine = (sent.body as any[]).find(m => m.to_addr === "nobody@v71.test");
  assert.ok(mine, "reply is in the Sent stream");
  assert.ok(["sent", "test_mode", "queued"].includes(mine.status), mine.status);
});

test("scan: links the unlinked, attaches jobs, and logs the mail on the record", async () => {
  // simulate pre-v71 mail: an item with no lead and no job, from a known contact
  const id = dbm.uid("inb");
  dbm.db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,owner_id,next_action_due_at,received_at,created_at,lead_id,job_id,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, wsId, "client_active_job", "Jim Job", "jim@v71.test", "Old thread about the tank job", "Following up on the tank removal — see you Friday.", "", new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), null, null, "open");
  const beforeActs = (dbm.db.prepare("SELECT COUNT(*) c FROM activities WHERE lead_id=? AND type='email_in'").get(jobLead) as any).c;
  const r = await call("POST", "/api/ai/scan", {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.linked >= 1, JSON.stringify(r.body));
  assert.ok(r.body.jobs_attached >= 1, JSON.stringify(r.body));
  const after = dbm.db.prepare("SELECT * FROM inbox_items WHERE id=?").get(id) as any;
  assert.equal(after.lead_id, jobLead); assert.equal(after.job_id, jobId);
  const afterActs = (dbm.db.prepare("SELECT COUNT(*) c FROM activities WHERE lead_id=? AND type='email_in'").get(jobLead) as any).c;
  assert.ok(afterActs > beforeActs, "scan logged the linked mail on the record");
});

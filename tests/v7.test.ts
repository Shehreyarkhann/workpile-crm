// V7 (transformation tranche 1): financial separation (§17.1), identity resolution (§7.4),
// transactional/idempotent conversion (§11.3), permission hardening (Phase 0).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv7-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", loCookie = "", wsId = "", leadOpen: any, leadDupA: any, leadDupB: any;

before(async () => {
  const dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V7 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Olivia Owner", "o@v7.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsId, "Larry Lead", "l@v7.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v7.co", password: "password1" } })).cookie;
  loCookie = (await J("/api/auth/login", { method: "POST", body: { email: "l@v7.co", password: "password1" } })).cookie;
  // open lead: estimated pipeline only
  leadOpen = (await J("/api/leads", { method: "POST", body: { contact: { name: "Open Ollie", phone: "+15165550141", email: "ollie@x.co" }, service_requested: "Mold Testing", est_value: 10000 } }, { Cookie: cookie })).j.lead;
  // two leads, different phones (different dedupe keys), SAME email -> identity candidate
  leadDupA = (await J("/api/leads", { method: "POST", body: { contact: { name: "Dup Dana", phone: "+15165550142", email: "dana@x.co" }, service_requested: "Asbestos Survey", est_value: 3000 } }, { Cookie: cookie })).j.lead;
  leadDupB = (await J("/api/leads", { method: "POST", body: { contact: { name: "Dup Dana", phone: "+15165550143", email: "dana@x.co" }, service_requested: "Asbestos Survey", est_value: 3500 } }, { Cookie: cookie })).j.lead;
  // financial fixtures straight into the model: a sent proposal, an approved draft, a signed job (invoiced), a paid deposit
  const P = (id: string, lead: string, status: string, total: number) => dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,status,total,created_at) VALUES (?,?,?,?,?,?)").run(id, wsId, lead, status, total, now());
  P("prop_sent", leadOpen.id, "sent", 5000);
  P("prop_appr", leadOpen.id, "draft", 4000);
  dbm.db.prepare("INSERT INTO approvals (id,workspace_id,lead_id,proposal_id,decision,decided_at) VALUES (?,?,?,?,?,?)").run(uid("appr"), wsId, leadOpen.id, "prop_appr", "approved", now());
  dbm.db.prepare("INSERT INTO jobs (id,workspace_id,lead_id,value,stage,invoice_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("job"), wsId, leadOpen.id, 7000, "SCHEDULED", "invoiced", now(), now());
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,status,created_at,paid_at) VALUES (?,?,?,?,?,?,?,?)").run(uid("pay"), wsId, "prop_sent", "deposit", 2000, "paid", now(), now());
});

test("finances: the five money concepts are separate, defined, and never blended", async () => {
  const f = (await J("/api/finances", {}, { Cookie: cookie })).j;
  assert.equal(f.estimated_pipeline.value, 10000 + 3000 + 3500, "open leads' estimates");
  assert.equal(f.proposal_value_outstanding.value, 5000, "sent proposal only");
  assert.equal(f.approved_proposal_value.value, 4000, "approved, unsigned");
  assert.equal(f.signed_contract_value.value, 7000, "job contract value");
  assert.equal(f.invoiced_value.value, 7000, "invoiced job");
  assert.equal(f.collected_cash.value, 2000, "only cash actually received");
  assert.equal(f.outstanding_receivables.value, 7000, "invoiced, unpaid");
  for (const k of Object.keys(f)) assert.ok(f[k].definition && f[k].definition.length > 10, k + " carries its definition");
  const h = (await J("/api/home", {}, { Cookie: cookie })).j;
  assert.equal(h.finances.signed_contract_value.value, 7000, "home embeds the same separated finances");
});

test("identity resolution: same-email/different-phone leads surface as a scored candidate", async () => {
  const groups = (await J("/api/duplicates", {}, { Cookie: cookie })).j;
  const cand = groups.find((g: any) => g.match_type === "candidate" && g.leads.some((l: any) => l.id === leadDupA.id) && g.leads.some((l: any) => l.id === leadDupB.id));
  assert.ok(cand, "candidate group links the two Dana leads");
  assert.ok(cand.confidence >= 0.9 && cand.confidence < 0.99, "email signal confidence, below exact identity");
  assert.ok(cand.signals.join(" ").includes("email"));
});

test("conversion is transactional + idempotent: double convert -> one customer", async () => {
  const won = (await J("/api/leads", { method: "POST", body: { contact: { name: "Convert Co", phone: "+15165550144", email: "cc@x.co" }, service_requested: "UST Removal", est_value: 9000 } }, { Cookie: cookie })).j.lead;
  const c1 = await J(`/api/leads/${won.id}/convert`, { method: "POST" }, { Cookie: cookie });
  const c2 = await J(`/api/leads/${won.id}/convert`, { method: "POST" }, { Cookie: cookie });
  assert.equal(c1.status, 200); assert.equal(c2.status, 200);
  const id1 = c1.j.account?.id || c1.j.id; const id2 = c2.j.account?.id || c2.j.id;
  assert.equal(id1, id2, "same account both times");
  const accts = (await J("/api/accounts", {}, { Cookie: cookie })).j;
  assert.equal(accts.filter((a: any) => a.name === "Convert Co").length, 1, "exactly one customer created");
});

test("permission hardening: LEAD_OWNER cannot touch settings-class writes or agent actions", async () => {
  assert.equal((await J("/api/canned-replies", { method: "POST", body: { title: "x", body: "y" } }, { Cookie: loCookie })).status, 403);
  assert.equal((await J("/api/custom-fields", { method: "POST", body: { label: "X", object_type: "lead" } }, { Cookie: loCookie })).status, 403);
  assert.equal((await J("/api/ai/automations/run", { method: "POST" }, { Cookie: loCookie })).status, 403);
  assert.equal((await J("/api/canned-replies", { method: "POST", body: { title: "ok", body: "y" } }, { Cookie: cookie })).status, 201, "owner still can");
});

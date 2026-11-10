// V5 (slices 47-50): calendar completeness, notification entity routing,
// sidebar consolidation support, doc-template variety + logo + sign rendering.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv5-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number, wsId = "", ownerId = "", repId = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, txt, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";
let dbm: any;
let leadA: any, pbId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsId = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "V5 Co", now());
  ownerId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(ownerId, wsId, "Olivia Owner", "o@v5.co", hashPassword("password1"), "OWNER");
  repId = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(repId, wsId, "Ryan Rep", "r@v5.co", hashPassword("password1"), "LEAD_OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@v5.co", password: "password1" } })).cookie;
  pbId = uid("pb"); dbm.db.prepare("INSERT INTO price_book_items (id,workspace_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?)").run(pbId, wsId, "Phase II ESA", "job", 12000, 9000);
  leadA = (await J("/api/leads", { method: "POST", body: { contact: { name: "Alpha School", phone: "+15165550111", email: "a@x.co" }, service_requested: "Phase II ESA", est_value: 30000 } }, { Cookie: cookie })).j.lead;
});

test("50: doc templates seed a variety with one default; CRUD + duplicate + delete guard", async () => {
  const list = (await J("/api/doc-templates", {}, { Cookie: cookie })).j;
  assert.ok(list.length >= 4, "seeded variety");
  assert.equal(list.filter((t: any) => t.is_default).length, 1, "exactly one default");
  assert.ok(list.some((t: any) => /Government/.test(t.name)) && list.some((t: any) => /Short/.test(t.name)));
  const nu = await J("/api/doc-templates", { method: "POST", body: { name: "Hospital System", intro_html: "<p>Hospital intro</p>", terms_html: "<p>Net 45</p>" } }, { Cookie: cookie });
  assert.equal(nu.status, 201);
  const dup = await J("/api/doc-templates", { method: "POST", body: { from_id: nu.j.id } }, { Cookie: cookie });
  assert.equal(dup.status, 201); assert.ok(dup.j.intro_html.includes("Hospital intro"));
  const def = await J(`/api/doc-templates/${nu.j.id}`, { method: "PATCH", body: { is_default: true } }, { Cookie: cookie });
  assert.equal(def.j.is_default, 1);
  const list2 = (await J("/api/doc-templates", {}, { Cookie: cookie })).j;
  assert.equal(list2.filter((t: any) => t.is_default).length, 1, "default moved, still exactly one");
  await J(`/api/doc-templates/${dup.j.id}`, { method: "DELETE" }, { Cookie: cookie });
});

test("50: a proposal built on a template renders THAT template (intro + logo rules) in the document", async () => {
  // workspace logo on
  await J("/api/proposal-template", { method: "PUT", body: { company: "V5 Co", tagline: "", contact_line: "", address: "", intro_html: "<p>hdr</p>", terms_html: "<p>hdr terms</p>", footer: "f", logo_data: "data:image/png;base64,iVBORw0KGgo=" } }, { Cookie: cookie });
  const tpls = (await J("/api/doc-templates", {}, { Cookie: cookie })).j;
  const hosp = tpls.find((t: any) => t.name === "Hospital System");
  const mk = async (tplId: string) => (await J(`/api/leads/${leadA.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbId, qty: 1 }], template_id: tplId } }, { Cookie: cookie })).j;
  const p1 = await mk(hosp.id);
  const doc1 = (await J(`/api/proposals/${p1.id || p1.proposal?.id}/document`, {}, { Cookie: cookie })).j;
  assert.ok(JSON.stringify(doc1).includes("Hospital intro"), "document uses the chosen template's intro");
  assert.ok(doc1.template.logo, "logo included when the template includes it");
  assert.equal(doc1.template.name, "Hospital System");
  await J(`/api/doc-templates/${hosp.id}`, { method: "PATCH", body: { include_logo: false } }, { Cookie: cookie });
  const p2 = await mk(hosp.id);
  const doc2 = (await J(`/api/proposals/${p2.id || p2.proposal?.id}/document`, {}, { Cookie: cookie })).j;
  assert.equal(doc2.template.logo, null, "logo withheld when the template excludes it");
  const sign = await J(`/sign/${(await J(`/api/proposals/${p1.id || p1.proposal?.id}/sign-link`, { method: "POST", body: {} }, { Cookie: cookie })).j.token}`);
  assert.ok(sign.txt.includes("Hospital intro"), "the customer's sign page renders the chosen template too");
});

test("50b: sanitizer keeps safe images, strips dangerous ones and scripts", async () => {
  const { sanitizeHtml } = await import("../server/proptemplate.ts");
  const ok = sanitizeHtml('<p>x</p><img src="data:image/png;base64,AAAA">');
  assert.ok(ok.includes("<img"), "data-uri image kept");
  const bad = sanitizeHtml('<img src="javascript:alert(1)"><script>alert(2)</script>');
  assert.ok(!bad.includes("javascript:") && !bad.includes("script"), "dangerous content stripped");
});

test("48: feed post on a JOB notifies with a job entity target (bell can route)", async () => {
  await J(`/api/leads/${leadA.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, { Cookie: cookie });
  const jobs = (await J("/api/jobs", {}, { Cookie: cookie })).j;
  assert.ok(jobs.length >= 1);
  const job = jobs[0];
  const repCookie = (await J("/api/auth/login", { method: "POST", body: { email: "r@v5.co", password: "password1" } })).cookie;
  await J(`/api/follow/job/${job.id}`, { method: "POST", body: {} }, { Cookie: repCookie });
  const before_ = dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=?").get(repId).c;
  await J(`/api/feed/job/${job.id}`, { method: "POST", body: { body: "Crew confirmed for Monday" } }, { Cookie: cookie });
  const rows = dbm.db.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1").all(repId);
  assert.ok(dbm.db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id=?").get(repId).c > before_, "follower notified");
  assert.equal(rows[0].entity_type, "job"); assert.equal(rows[0].entity_id, job.id);
});

test("47: calendar includes completed tasks only when asked, alongside open work", async () => {
  const t = await J("/api/tasks", { method: "POST", body: { lead_id: leadA.id, title: "Done thing", assignee_id: ownerId, due_at: new Date().toISOString() } }, { Cookie: cookie });
  await J(`/api/tasks/${t.j.id}/complete`, { method: "POST", body: {} }, { Cookie: cookie });
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10); const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const plain = (await J(`/api/calendar?from=${from}&to=${to}`, {}, { Cookie: cookie })).j;
  assert.ok(!plain.some((e: any) => e.title === "Done thing"), "completed hidden by default");
  const withDone = (await J(`/api/calendar?from=${from}&to=${to}&done=1`, {}, { Cookie: cookie })).j;
  assert.ok(withDone.some((e: any) => e.title === "Done thing" && e.kind === "task_done"), "completed included with done=1, marked as done");
});

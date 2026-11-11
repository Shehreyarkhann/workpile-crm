// V39 part 1 — the touch model: a lead is untouched only until somebody
// picks it up in ANY way (opened, assigned, contacted). One definition,
// shared by the queue, Home's count, and the agent's triage pile.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Touch Co", email: "own@v39.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v39.test", password: "password123" } })).ck;
const mk = (email: string) => J("/api/leads", { method: "POST", body: { contact: { name: "T " + email, email, phone: "+15165550181" }, service_requested: "Tank Testing", est_value: 100, source: "t" } }, ck);
const untouchedIds = async () => { const q = await J("/api/queue", {}, ck); return q.j.items.filter((i: any) => i.type === "lead_untouched").map((i: any) => i.lead_id); };

test("opening a lead clears it from the untouched pile — everywhere at once", async () => {
  const l1 = await mk("a@touch.example");
  assert.ok((await untouchedIds()).includes(l1.j.lead.id), "starts untouched");
  const home1 = await J("/api/home", {}, ck); assert.ok(home1.j.untouched_count >= 1);
  const t = await J(`/api/leads/${l1.j.lead.id}/touch`, { method: "POST", body: { kind: "open" } }, ck);
  assert.equal(t.j.touched, true);
  assert.ok(!(await untouchedIds()).includes(l1.j.lead.id), "gone from the queue pile");
  const home2 = await J("/api/home", {}, ck); assert.equal(home2.j.untouched_count, home1.j.untouched_count - 1, "Home's count agrees");
  const row = dbm.db.prepare("SELECT first_touch_kind FROM leads WHERE id=?").get(l1.j.lead.id) as any;
  assert.equal(row.first_touch_kind, "open");
  const t2 = await J(`/api/leads/${l1.j.lead.id}/touch`, { method: "POST", body: { kind: "assign" } }, ck);
  assert.equal(t2.j.touched, false, "first touch is recorded once — later touches never rewrite it");
});

test("assigning a lead also clears it — the pile the agent triages is the same pile", async () => {
  const l2 = await mk("b@touch.example");
  const me = (await J("/api/auth/me", {}, ck)).j.user;
  await J(`/api/leads/${l2.j.lead.id}`, { method: "PATCH", body: { owner_id: me.id } }, ck);
  assert.ok(!(await untouchedIds()).includes(l2.j.lead.id), "assigned = touched, off the pile");
  const row = dbm.db.prepare("SELECT first_touch_kind FROM leads WHERE id=?").get(l2.j.lead.id) as any;
  assert.equal(row.first_touch_kind, "assign");
  const tri = await J("/api/agent/triage-untouched", { method: "POST", body: {} }, ck);
  assert.match(tri.j.summary || "", /pile is clear/i, "the agent sees the same empty pile");
});

// ---- V39 part 2: invoice templates --------------------------------------
test("invoice templates: seeded per-kind default, editable, and invoices render from it", async () => {
  const tpls = await J("/api/doc-templates", {}, ck);
  const inv1 = tpls.j.find((t: any) => t.kind === "invoice");
  const propD = tpls.j.find((t: any) => (t.kind || "proposal") === "proposal" && t.is_default);
  assert.ok(inv1 && inv1.is_default, "a default invoice template is seeded");
  assert.ok(propD, "the proposal default coexists (defaults are per kind)");
  const marker = "NET-14 WILDCAT TERMS";
  await J(`/api/doc-templates/${inv1.id}`, { method: "PATCH", body: { terms_html: `<p>${marker}</p>`, intro_html: "<p>Custom invoice note WILDCAT.</p>" } }, ck);
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Tpl Co", email: "t@tpl.example", phone: "+15165550182" }, service_requested: "Tank Testing", est_value: 700, source: "t" } }, ck);
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, ck);
  const inv = await J(`/api/jobs/${job.j.id}/invoice`, { method: "POST", body: {} }, ck);
  const page = await fetch(B + inv.j.link);
  const html = await page.text();
  assert.ok(html.includes(marker), "the pay page renders the custom invoice terms");
  assert.ok(html.includes("Custom invoice note WILDCAT"), "the pay page renders the custom invoice note");
  const docRes = await fetch(B + `/api/invoices/${inv.j.id}/document`, { headers: { Cookie: ck } });
  const buf = Buffer.from(await docRes.arrayBuffer());
  const { execSync } = await import("node:child_process");
  (await import("node:fs")).writeFileSync(join(dir, "inv.docx"), buf);
  const xml = execSync(`python3 -c "import zipfile; print(zipfile.ZipFile('${join(dir, "inv.docx")}').read('word/document.xml').decode())"`).toString();
  assert.ok(xml.includes("WILDCAT TERMS"), "the DOCX renders the custom terms too");
  // a second invoice template can take the default without touching proposals
  const t2 = await J("/api/doc-templates", { method: "POST", body: { name: "Net-30 Formal", kind: "invoice" } }, ck);
  await J(`/api/doc-templates/${t2.j.id}`, { method: "PATCH", body: { is_default: true } }, ck);
  const after = await J("/api/doc-templates", {}, ck);
  assert.equal(after.j.find((t: any) => t.id === t2.j.id).is_default, 1);
  assert.equal(after.j.find((t: any) => t.id === inv1.id).is_default, 0);
  assert.equal(after.j.find((t: any) => t.id === propD.id).is_default, 1, "proposal default untouched by the invoice default change");
});

// ---- V39 part 3: calendar completion writes back to the master record ----
test("every agenda kind completes against its master record and advances the workflow", async () => {
  const post = (p: string, body: any = {}) => J(p, { method: "POST", body }, ck);
  // visit → completes the visit and reports the job gate
  const l1 = await mk("cal1@touch.example");
  const j1 = await post("/api/jobs", { lead_id: l1.j.lead.id });
  await J(`/api/jobs/${j1.j.id}`, { method: "PATCH", body: { requires_site_visit: 1 } }, ck);
  const vis = await post(`/api/leads/${l1.j.lead.id}/visits`, { scheduled_at: new Date().toISOString(), assigned_to: null, notes: "measure" });
  const vrow = dbm.db.prepare("SELECT * FROM site_visits WHERE lead_id=?").get(l1.j.lead.id) as any;
  const cv = await post("/api/calendar/complete", { kind: "visit", ref_id: vrow.id });
  assert.match(cv.j.message, /gate is cleared/);
  assert.equal((dbm.db.prepare("SELECT status FROM site_visits WHERE id=?").get(vrow.id) as any).status, "completed");
  // the mirrored crew row completes its visit too
  const l2 = await mk("cal2@touch.example");
  await post("/api/jobs", { lead_id: l2.j.lead.id });
  await post(`/api/leads/${l2.j.lead.id}/visits`, { scheduled_at: new Date().toISOString(), notes: "mirror check" });
  const srow = dbm.db.prepare("SELECT * FROM job_schedule WHERE lead_id=? AND note LIKE '%Site visit%'").get(l2.j.lead.id) as any;
  assert.ok(srow, "the visit mirrored into the crew schedule");
  await post("/api/calendar/complete", { kind: "schedule", ref_id: srow.id });
  assert.ok((dbm.db.prepare("SELECT done_at FROM job_schedule WHERE id=?").get(srow.id) as any).done_at);
  assert.equal((dbm.db.prepare("SELECT status FROM site_visits WHERE lead_id=?").get(l2.j.lead.id) as any).status, "completed", "crew-day completion completed the mirrored visit");
  // job stage advances from the calendar: start, then work done, then refuses
  await post(`/api/jobs/${j1.j.id}/stage`, { to: "SCHEDULED", scheduled_start: new Date(Date.now() + 3600000).toISOString() });
  const cj1 = await post("/api/calendar/complete", { kind: "job", ref_id: j1.j.id });
  assert.match(cj1.j.message, /In Progress/);
  const cj2 = await post("/api/calendar/complete", { kind: "job", ref_id: j1.j.id });
  assert.match(cj2.j.message, /paperwork/);
  const cj3 = await post("/api/calendar/complete", { kind: "job", ref_id: j1.j.id });
  assert.equal(cj3.s, 422, "a job past the working stages refuses calendar completion");
  // invoice "done" is a real full payment
  const inv = await post(`/api/jobs/${j1.j.id}/invoice`, {});
  await post(`/api/invoices/${inv.j.id}/send`, {});
  const ci = await post("/api/calendar/complete", { kind: "invoice", ref_id: inv.j.id });
  assert.match(ci.j.message, /paid in full/);
  assert.equal((dbm.db.prepare("SELECT status FROM invoices WHERE id=?").get(inv.j.id) as any).status, "paid");
  assert.ok((dbm.db.prepare("SELECT COUNT(*) c FROM payments WHERE invoice_id=? AND status='paid'").get(inv.j.id) as any).c >= 1);
  // callback, document, proposal expiry, follow-up step
  dbm.db.prepare("INSERT INTO callbacks (id,workspace_id,lead_id,due_at,note,status,created_at) VALUES ('cb_t1',?,?,?, 'call them','open',?)").run((await J("/api/auth/me", {}, ck)).j.user.workspace_id, l1.j.lead.id, new Date().toISOString(), dbm.now());
  await post("/api/calendar/complete", { kind: "callback", ref_id: "cb_t1" });
  assert.equal((dbm.db.prepare("SELECT status FROM callbacks WHERE id='cb_t1'").get() as any).status, "done");
  const doc = await post(`/api/leads/${l1.j.lead.id}/documents`, { name: "Insurance cert", required: true });
  dbm.db.prepare("UPDATE documents SET expires_at='2026-12-01' WHERE id=?").run(doc.j.id || doc.j.document?.id);
  const docId = (dbm.db.prepare("SELECT id FROM documents WHERE lead_id=?").get(l1.j.lead.id) as any).id;
  await post("/api/calendar/complete", { kind: "doc", ref_id: docId });
  const drow = dbm.db.prepare("SELECT status, expires_at FROM documents WHERE id=?").get(docId) as any;
  assert.equal(drow.status, "received"); assert.equal(drow.expires_at, null);
  const pb2 = await J("/api/price-book", {}, ck);
  const prop = await post(`/api/leads/${l1.j.lead.id}/proposals`, { line_items: [{ price_book_item_id: pb2.j[0].id, qty: 1 }] });
  dbm.db.prepare("UPDATE proposals SET expires_at='2026-11-20' WHERE id=?").run(prop.j.id);
  const ce = await post("/api/calendar/complete", { kind: "expiry", ref_id: prop.j.id });
  assert.match(ce.j.message, /2026-12-04/);
  await post(`/api/proposals/${prop.j.id}/send`, {});
  let enr = dbm.db.prepare("SELECT * FROM followup_enrollments WHERE lead_id=? AND status='active'").get(l1.j.lead.id) as any;
  if (!enr) { // bare test workspaces carry no cadence template (earlier suites insert directly)
    const wsId = (await J("/api/auth/me", {}, ck)).j.user.workspace_id;
    dbm.db.prepare("INSERT INTO followup_enrollments (id,workspace_id,lead_id,proposal_id,step_idx,next_due_at,status,created_at,updated_at) VALUES ('enr_t1',?,?,?,0,?,'active',?,?)").run(wsId, l1.j.lead.id, prop.j.id, new Date().toISOString(), dbm.now(), dbm.now());
    enr = dbm.db.prepare("SELECT * FROM followup_enrollments WHERE id='enr_t1'").get() as any;
  }
  assert.ok(enr, "an active follow-up enrollment exists");
  const cf = await post("/api/calendar/complete", { kind: "followup", ref_id: enr.id });
  const enr2 = dbm.db.prepare("SELECT step_idx, status FROM followup_enrollments WHERE id=?").get(enr.id) as any;
  assert.ok(enr2.step_idx > enr.step_idx || enr2.status === "done", "the follow-up advanced to its next step");
  assert.match(cf.j.message, /step/i);
});

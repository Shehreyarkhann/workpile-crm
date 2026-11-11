// V36: client file (dossier), email attachments, and document intelligence —
// the AI matcher pre-attaches the W-9 / invoice a customer email asks for.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Dossier Co", email: "own@v36.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v36.test", password: "password123" } })).ck;
const wsId = (await J("/api/auth/me", {}, ck)).j.user.workspace_id;
// company vault: the W-9
const w9 = await J("/api/attachments", { method: "POST", body: { entity_type: "workspace", entity_id: wsId, name: "Form W-9 (2026).pdf", mime: "application/pdf", data_base64: Buffer.from("fake-w9-pdf").toString("base64") } }, ck);
assert.equal(w9.s, 201, JSON.stringify(w9.j).slice(0, 120));
// a customer: lead + job + invoice + site visit + proposal
const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Mercy Facilities", email: "ap@mercy.example", phone: "+15165550199" }, service_requested: "Tank Testing", est_value: 4800, source: "test" } }, ck);
const leadId = lead.j.lead.id;
const pb = await J("/api/price-book", {}, ck);
await J(`/api/leads/${leadId}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j[0].id, qty: 1 }] } }, ck);
// winning the lead converts it to a customer (account) and creates the job —
// the same path the kanban board uses.
const won = await J(`/api/leads/${leadId}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, ck);
assert.equal(won.s, 200, JSON.stringify(won.j).slice(0, 140));
const jobRow = dbm.db.prepare("SELECT id FROM jobs WHERE lead_id=?").get(leadId) as any;
assert.ok(jobRow, "WON created the job");
const job = { j: { id: jobRow.id } };
dbm.db.prepare("UPDATE jobs SET value=4800 WHERE id=?").run(job.j.id);
const inv = await J(`/api/jobs/${job.j.id}/invoice`, { method: "POST", body: {} }, ck);
await J(`/api/leads/${leadId}/visits`, { method: "POST", body: { scheduled_at: "2026-11-20T09:00:00.000Z", notes: "Annual tank test" } }, ck);
await J(`/api/leads/${leadId}/documents`, { method: "POST", body: { name: "Certificate of insurance", required: true, status: "received" } }, ck);
const accountId = (dbm.db.prepare("SELECT account_id FROM leads WHERE id=?").get(leadId) as any).account_id;
assert.ok(accountId, "lead is linked to an account");

test("the client file (dossier) brings the whole record together, printable", async () => {
  const r = await fetch(B + `/api/accounts/${accountId}/dossier`, { headers: { Cookie: ck } });
  assert.equal(r.status, 200);
  const html = await r.text();
  for (const needle of ["Client file", "Tank Testing", "INV-0001", "Form W-9 (2026).pdf", "Documents checklist", "window.print", "$4,800.00"]) assert.ok(html.includes(needle), "dossier missing: " + needle);
});

test("attachables groups the record's files, proposals, invoices and company docs", async () => {
  const g = await J(`/api/attachables?lead_id=${leadId}`, {}, ck);
  assert.equal(g.j.company.length, 1); assert.equal(g.j.company[0].label, "Form W-9 (2026).pdf");
  assert.equal(g.j.invoices.length, 1); assert.equal(g.j.proposals.length, 1);
});

test("the AI matcher reads the ask and pre-attaches the W-9 AND the invoice", async () => {
  const ing = await J("/api/inbox/ingest", { method: "POST", body: { from_email: "ap@mercy.example", from_name: "Mercy AP", subject: "Paperwork for vendor file", body: "Hello — for our vendor records please send your W-9, and also a copy of the invoice for the tank testing job. Thanks!" } }, ck);
  const itemId = (dbm.db.prepare("SELECT id FROM inbox_items WHERE from_email='ap@mercy.example' ORDER BY created_at DESC").get() as any)?.id;
  assert.ok(itemId, "an inbox item was created");
  const sug = await J(`/api/inbox/${itemId}/suggestion`, {}, ck);
  const kinds = (sug.j.attachments || []).map((x: any) => x.kind).sort();
  assert.deepEqual(kinds, ["attachment", "invoice"], JSON.stringify(sug.j.attachments));
  const w9sug = sug.j.attachments.find((x: any) => x.kind === "attachment");
  assert.ok(/W-9/.test(w9sug.why), "the W-9 carries its reason");
  // one-click send (no explicit selection) carries the matched documents
  const sent = await J(`/api/inbox/${itemId}/reply`, { method: "POST", body: { body: "Attached as requested — W-9 and the invoice. Let us know if you need anything else." } }, ck);
  assert.equal(sent.s, 200, JSON.stringify(sent.j).slice(0, 120));
  const row = dbm.db.prepare("SELECT attachments, status FROM messages_outbox WHERE to_addr='ap@mercy.example' ORDER BY created_at DESC").get() as any;
  assert.ok(row.attachments && row.attachments.includes("attachment") && row.attachments.includes("invoice"), "outbox carries both refs: " + row.attachments);
});

test("explicit removal wins, and bogus refs are dropped by validation", async () => {
  const ing = await J("/api/inbox/ingest", { method: "POST", body: { from_email: "ap@mercy.example", subject: "W-9 again", body: "Resend the W-9 please." } }, ck);
  const itemId = (dbm.db.prepare("SELECT id FROM inbox_items WHERE from_email='ap@mercy.example' ORDER BY created_at DESC").get() as any)?.id;
  await J(`/api/inbox/${itemId}/reply`, { method: "POST", body: { body: "Here you go.", attachments: [] } }, ck);
  const row = dbm.db.prepare("SELECT attachments FROM messages_outbox WHERE to_addr='ap@mercy.example' ORDER BY created_at DESC").get() as any;
  assert.equal(row.attachments, null, "human removed all → nothing attached");
  const msg = await J(`/api/leads/${leadId}/message`, { method: "POST", body: { channel: "email", subject: "Docs", body: "See attached.", attachments: [{ kind: "invoice", id: inv.j.id }, { kind: "invoice", id: "inv_bogus" }, { kind: "attachment", id: "att_bogus" }] } }, ck);
  assert.equal(msg.s, 201, JSON.stringify(msg.j).slice(0, 120));
  const row2 = dbm.db.prepare("SELECT attachments FROM messages_outbox WHERE lead_id=? AND subject='Docs'").get(leadId) as any;
  const refs = JSON.parse(row2.attachments);
  assert.equal(refs.length, 1); assert.equal(refs[0].id, inv.j.id, "only the real invoice survived validation");
});

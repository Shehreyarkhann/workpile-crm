// V13 close-out: suppression list, merge reversal, waiting/doc-expiry queue items, refunds,
// site-visit readiness, canonical states, periods, and tenant isolation for files/background (§§5–24).
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-testv13-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number; let dbm: any; let wsA = "", wsB = "";
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const txt = await r.text(); let j: any = {}; try { j = JSON.parse(txt); } catch { j = { raw: txt }; } return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookieA = "", cookieB = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  wsA = uid("ws"); wsB = uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsA, "V13 A", now());
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsB, "V13 B", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsA, "Anna A", "a@v13.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), wsB, "Bob B", "b@v13.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookieA = (await J("/api/auth/login", { method: "POST", body: { email: "a@v13.co", password: "password1" } })).cookie;
  cookieB = (await J("/api/auth/login", { method: "POST", body: { email: "b@v13.co", password: "password1" } })).cookie;
});

test("suppression list stops sends at the door — recorded suppressed, never sent", async () => {
  const add = await J("/api/suppressions", { method: "POST", body: { kind: "email", value: "Nope@X.co", reason: "unsubscribed" } }, { Cookie: cookieA });
  assert.equal(add.status, 201);
  assert.equal(add.j.value, "nope@x.co", "normalized on the way in");
  const dup = await J("/api/suppressions", { method: "POST", body: { kind: "email", value: "nope@x.co" } }, { Cookie: cookieA });
  assert.equal(dup.status, 409);
  const { queueAndDeliver } = await import("../server/comms.ts");
  const out = await queueAndDeliver(wsA, { channel: "email", to: "nope@x.co", subject: "Hi", body: "hello" });
  assert.equal(out.status, "suppressed");
  const row = dbm.db.prepare("SELECT status, error FROM messages_outbox WHERE to_addr='nope@x.co'").get() as any;
  assert.equal(row.status, "suppressed");
  assert.ok(row.error.includes("unsubscribed"));
  const clean = await queueAndDeliver(wsA, { channel: "email", to: "fine@x.co", subject: "Hi", body: "hello" });
  assert.notEqual(clean.status, "suppressed");
  const listB = (await J("/api/suppressions", {}, { Cookie: cookieB })).j;
  assert.equal(listB.length, 0, "suppression lists are workspace-isolated");
});

test("merge is reversible: snapshot restores the duplicate lead's pre-merge state", async () => {
  const mk = async (name: string, email: string) => (await J("/api/leads", { method: "POST", body: { contact: { name, phone: "+15165550301", email }, service_requested: "UST", est_value: 700 } }, { Cookie: cookieA })).j.lead;
  const survivor = await mk("Merge Mary", "mary@x.co");
  // the API dedupes on ingest, so seed the twin the way an import would (same dedupe key)
  const { uid, now } = dbm;
  const cid = uid("ct"), lid = uid("ld");
  const key = (dbm.db.prepare("SELECT dedupe_key FROM leads WHERE id=?").get(survivor.id) as any).dedupe_key;
  dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsA, "Merge Mary", "+15165550301", "mary2@x.co");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,service_requested,state,est_value,dedupe_key,created_at,updated_at) VALUES (?,?,?,?,'WORKING',700,?,?,?)").run(lid, wsA, cid, "UST", key, now(), now());
  const merged = await J(`/api/leads/${lid}/merge`, { method: "POST", body: { into_id: survivor.id } }, { Cookie: cookieA });
  assert.equal(merged.status, 200);
  const afterMerge = dbm.db.prepare("SELECT state FROM leads WHERE id=?").get(lid) as any;
  assert.equal(afterMerge.state, "DUPLICATE");
  const merges = (await J("/api/duplicates/merges", {}, { Cookie: cookieA })).j;
  assert.equal(merges.length, 1);
  const rev = await J(`/api/duplicates/merges/${merges[0].id}/reverse`, { method: "POST", body: {} }, { Cookie: cookieA });
  assert.equal(rev.status, 200);
  assert.ok(rev.j.note.includes("stay with the survivor"), "the reversal's limits are stated, not hidden");
  const restored = dbm.db.prepare("SELECT state, merged_into_id FROM leads WHERE id=?").get(lid) as any;
  assert.equal(restored.state, "WORKING", "pre-merge state restored");
  assert.equal(restored.merged_into_id, null);
  const again = await J(`/api/duplicates/merges/${merges[0].id}/reverse`, { method: "POST", body: {} }, { Cookie: cookieA });
  assert.equal(again.status, 409);
});

test("refunds: partial then full, balance enforced, status honest", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Refund Rita", phone: "+15165550302", email: "rita@x.co" }, service_requested: "Job", est_value: 1000 } }, { Cookie: cookieA })).j.lead;
  const pb = (await J("/api/price-book", { method: "POST", body: { name: "Refundable Work", standard_price: 1000 } }, { Cookie: cookieA })).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.id, qty: 1, unit_price: 1000 }] } }, { Cookie: cookieA })).j;
  const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO payments (id,workspace_id,proposal_id,kind,amount,mode,status,created_at,paid_at) VALUES (?,?,?,'deposit',1000,'test','paid',?,?)").run(uid("pay"), wsA, prop.id, now(), now());
  dbm.db.prepare("UPDATE proposals SET payment_status='deposit_paid' WHERE id=?").run(prop.id);
  const r1 = await J(`/api/proposals/${prop.id}/refund`, { method: "POST", body: { amount: 400, reason: "goodwill" } }, { Cookie: cookieA });
  assert.equal(r1.status, 201);
  assert.equal(r1.j.payment_status, "partially_refunded");
  const over = await J(`/api/proposals/${prop.id}/refund`, { method: "POST", body: { amount: 601 } }, { Cookie: cookieA });
  assert.equal(over.status, 422, "cannot refund more than the un-refunded balance");
  const r2 = await J(`/api/proposals/${prop.id}/refund`, { method: "POST", body: { amount: 600 } }, { Cookie: cookieA });
  assert.equal(r2.j.payment_status, "refunded");
  const list = (await J("/api/proposals", {}, { Cookie: cookieA })).j;
  const row = list.find((p: any) => p.id === prop.id);
  assert.equal(row.paid_total, 1000); assert.equal(row.refunded_total, 1000);
});

test("queue: waiting-on-customer + expiring documents surface as work", async () => {
  const { uid, now } = dbm;
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Waiting Walt", phone: "+15165550303", email: "walt@x.co" }, service_requested: "Phase I", est_value: 2000 } }, { Cookie: cookieA })).j.lead;
  const pb2 = (await J("/api/price-book", { method: "POST", body: { name: "Waiting Work", standard_price: 2000 } }, { Cookie: cookieA })).j;
  const prop = (await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb2.id, qty: 1, unit_price: 2000 }] } }, { Cookie: cookieA })).j;
  const sentAt = new Date(Date.now() - 6 * 86400000).toISOString();
  dbm.db.prepare("UPDATE proposals SET status='sent', sent_at=? WHERE id=?").run(sentAt, prop.id);
  dbm.db.prepare("UPDATE leads SET state='SENT', updated_at=? WHERE id=?").run(sentAt, lead.id);
  const docId = uid("doc");
  dbm.db.prepare("INSERT INTO documents (id,workspace_id,lead_id,name,status,required,expires_at) VALUES (?,?,?,?,'received',1,?)").run(docId, wsA, lead.id, "UST permit", new Date(Date.now() + 5 * 86400000).toISOString());
  const q = (await J("/api/queue", {}, { Cookie: cookieA })).j;
  assert.ok(q.items.some((i: any) => i.type === "waiting_customer" && i.lead_id === lead.id), "silent customer becomes queue work");
  assert.ok(q.items.some((i: any) => i.type === "doc_expiring"), "expiring permit becomes queue work");
  const patched = await J(`/api/documents/${docId}`, { method: "PATCH", body: { expires_at: null } }, { Cookie: cookieA });
  assert.equal(patched.status, 200);
  const q2 = (await J("/api/queue", {}, { Cookie: cookieA })).j;
  assert.ok(!q2.items.some((i: any) => i.type === "doc_expiring"), "clearing the expiry clears the item");
});

test("readiness: site-visit item appears until a visit completes; periods + canonical states report", async () => {
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Visit Vic", phone: "+15165550304", email: "vic@x.co" }, service_requested: "Phase I", est_value: 100, notes: "scope", location: "Bay Shore" } }, { Cookie: cookieA })).j.lead;
  const before = (await J(`/api/leads/${lead.id}/packet-check`, { method: "POST", body: {} }, { Cookie: cookieA })).j;
  assert.ok(before.missing.includes("site visit completed"));
  const { uid, now } = dbm;
  dbm.db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,scheduled_at,status) VALUES (?,?,?,?, 'completed')").run(uid("vis"), wsA, lead.id, now());
  const after = (await J(`/api/leads/${lead.id}/packet-check`, { method: "POST", body: {} }, { Cookie: cookieA })).j;
  assert.ok(!after.missing.includes("site visit completed"));
  const periods = (await J("/api/metrics/periods", {}, { Cookie: cookieA })).j;
  assert.ok(periods.this_week.leads_created >= 1 && periods.note.includes("Mon–Sun"));
  const { metrics } = await import("../server/metrics.ts");
  const m = metrics(wsA);
  assert.ok(m.by_state_canonical && typeof m.by_state_canonical === "object");
});

test("tenant isolation: files, leads, and background surfaces stay in their workspace", async () => {
  const leadA = (await J("/api/leads", { method: "POST", body: { contact: { name: "Iso Ingrid", phone: "+15165550305", email: "ingrid@x.co" }, service_requested: "Mold", est_value: 10 } }, { Cookie: cookieA })).j.lead;
  const up = await J("/api/attachments", { method: "POST", body: { entity_type: "lead", entity_id: leadA.id, name: "secret.txt", mime: "text/plain", data_base64: Buffer.from("wsA only").toString("base64") } }, { Cookie: cookieA });
  assert.equal(up.status, 201);
  const dlB = await fetch(`http://localhost:${port}/api/attachments/${up.j.id}/download`, { headers: { Cookie: cookieB } });
  assert.equal(dlB.status, 404, "workspace B cannot download workspace A's file");
  const leadB = await J(`/api/leads/${leadA.id}`, {}, { Cookie: cookieB });
  assert.equal(leadB.status, 404);
  const mergesB = (await J("/api/duplicates/merges", {}, { Cookie: cookieB })).j;
  assert.equal(mergesB.length, 0, "merge history is workspace-isolated");
  const finB = (await J("/api/finances", {}, { Cookie: cookieB })).j;
  assert.equal(finB.signed_contract_value.value, 0, "B's finances never include A's contracts");
});

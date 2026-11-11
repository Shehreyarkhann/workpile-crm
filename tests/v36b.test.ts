// V36.1 naming discipline: a document's identity is its system name + type,
// not whatever a scanner called the file. Classified (doc_type) documents
// beat filename guesses in the matcher, everything generated carries its
// system number (PROP-/INV-), and any file can be renamed/reclassified.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Naming Co", email: "own@v36b.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v36b.test", password: "password123" } })).ck;
const wsId = (await J("/api/auth/me", {}, ck)).j.user.workspace_id;
const up = (name: string, doc_type?: string) => J("/api/attachments", { method: "POST", body: { entity_type: "workspace", entity_id: wsId, name, mime: "application/pdf", doc_type, data_base64: Buffer.from("x-" + name).toString("base64") } }, ck);
const classified = await up("scan001.pdf", "w9");
const unclassified = await up("Form W-9 (old).pdf");
assert.equal(classified.s, 201); assert.equal(classified.j.doc_type, "w9");

test("the matcher picks the CLASSIFIED W-9 over the descriptively-named unclassified one", async () => {
  const ing = await J("/api/inbox/ingest", { method: "POST", body: { from_email: "ap@unknown.example", subject: "Vendor setup", body: "Please send your W-9 so we can set you up as a vendor." } }, ck);
  const itemId = (dbm.db.prepare("SELECT id FROM inbox_items ORDER BY created_at DESC").get() as any).id;
  const sug = await J(`/api/inbox/${itemId}/suggestion`, {}, ck);
  const att = (sug.j.attachments || []).find((x: any) => x.kind === "attachment");
  assert.ok(att, "a W-9 was suggested");
  assert.equal(att.id, classified.j.id, "scan001.pdf wins because it is classified as the W-9 — identity beats filename");
  assert.equal(att.label, "scan001.pdf");
});

test("any file can be renamed and reclassified after the fact", async () => {
  const p = await J(`/api/attachments/${unclassified.j.id}`, { method: "PATCH", body: { name: "Form W-9 (2024 — superseded).pdf", doc_type: "other" } }, ck);
  assert.equal(p.s, 200); assert.equal(p.j.doc_type, "other"); assert.ok(p.j.name.includes("superseded"));
  const bad = await J(`/api/attachments/${unclassified.j.id}`, { method: "PATCH", body: { doc_type: "passport" } }, ck);
  assert.equal(bad.j.doc_type, null, "unknown types are refused (stored as unclassified, never invented)");
});

test("generated documents carry their system numbers in the filename", async () => {
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Num Co", email: "n@num.example", phone: "+15165550177" }, service_requested: "Tank Testing", est_value: 900, source: "t" } }, ck);
  const pb = await J("/api/price-book", {}, ck);
  const prop = await J(`/api/leads/${lead.j.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j[0].id, qty: 1 }] } }, ck);
  const doc = await fetch(B + `/api/proposals/${prop.j.id}/docx`, { headers: { Cookie: ck } });
  assert.equal(doc.status, 200);
  const cd = doc.headers.get("content-disposition") || "";
  assert.ok(cd.includes("PROP-"), "proposal DOCX filename leads with its number: " + cd);
});

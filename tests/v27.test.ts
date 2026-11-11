// V27: enhance endpoint honesty, job attachments (photos/assets plumbing),
// and the DOCX signature block as an aligned table.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { execSync } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0], headers: r.headers }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V27 Co", email: "o@v27.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v27.test", password: "password123" } })).ck; assert.ok(O);

test("enhance: honest no-provider response, text untouched; empty rejected", async () => {
  const r = await J("/api/ai/enhance", { method: "POST", body: { text: "hi we got your paperworks thanks", purpose: "email reply" } }, O);
  assert.equal(r.s, 200); assert.equal(r.j.source, "none"); assert.equal(r.j.text, "hi we got your paperworks thanks"); assert.ok(r.j.note.includes("Automations"));
  const e = await J("/api/ai/enhance", { method: "POST", body: { text: "   " } }, O); assert.equal(e.s, 422);
});

test("job attachments: upload a photo, list it, inline download, delete", async () => {
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Photo Client", email: "pc@v27.test" }, service_requested: "Phase I ESA", est_value: 2000 } }, O);
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, O);
  const jid = job.j.id || job.j.j?.id; assert.ok(jid, JSON.stringify(job.j).slice(0, 120));
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  const up = await J("/api/attachments", { method: "POST", body: { entity_type: "job", entity_id: jid, name: "site-before.png", mime: "image/png", data_base64: png } }, O);
  assert.equal(up.s, 201, JSON.stringify(up.j));
  const list = await J(`/api/attachments?entity_type=job&entity_id=${jid}`, {}, O);
  assert.equal(list.j.length, 1); assert.equal(list.j[0].mime, "image/png");
  const dl = await fetch(`${B}/api/attachments/${up.j.id}/download?inline=1`, { headers: { Cookie: O } });
  assert.equal(dl.status, 200); assert.ok((dl.headers.get("content-disposition") || "").startsWith("inline"));
  const del = await J(`/api/attachments/${up.j.id}`, { method: "DELETE" }, O); assert.equal(del.s, 200);
  const after = await J(`/api/attachments?entity_type=job&entity_id=${jid}`, {}, O); assert.equal(after.j.length, 0);
});

test("docx: signature block is an aligned table (Signature | Name (print) | Date)", async () => {
  const svc = dbm.db.prepare("SELECT id FROM services LIMIT 1").get() as any;
  const pb = await J("/api/price-book", { method: "POST", body: { name: "Phase I ESA", unit: "job", standard_price: 2500, floor_price: 2000, service_id: svc?.id || null } }, O);
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Doc Client", email: "dc@v27.test" }, service_requested: "Phase I ESA", est_value: 2500 } }, O);
  const prop = await J(`/api/leads/${lead.j.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }] } }, O);
  assert.equal(prop.s, 201, JSON.stringify(prop.j).slice(0, 160));
  const { proposalDocx } = await import("../server/docx.ts");
  const out = await proposalDocx(prop.j.id); assert.ok(out);
  const p = join(dir, "p.docx"); writeFileSync(p, out.buffer);
  const xml = execSync(`python3 -c "import zipfile; print(zipfile.ZipFile('${p}').read('word/document.xml').decode())"`, { maxBuffer: 8 * 1024 * 1024 }).toString();
  const acc = xml.indexOf("Acceptance"); assert.ok(acc > 0);
  const after = xml.slice(acc);
  assert.ok(after.includes("<w:tbl>"), "signature block rendered as a table");
  assert.ok(after.includes("Name (print)") && after.includes("Signature") && after.includes("Date"), "all three fields labeled in columns");
});

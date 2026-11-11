// V31: sequential proposal numbers (PROP-1001…), revisions/clones semantics,
// legacy freeze, and the two-row signature block in the DOCX.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { execSync } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const { proposalDocument } = await import("../server/proptemplate.ts");
const { proposalDocx } = await import("../server/docx.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V31 Co", email: "o@v31.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v31.test", password: "password123" } })).ck; assert.ok(O);
const pb = await J("/api/price-book", { method: "POST", body: { name: "Survey", unit: "job", standard_price: 4000, floor_price: 3000 } }, O);
const pbId = pb.j.id; assert.ok(pbId, JSON.stringify(pb.j).slice(0, 100));
async function mkLead(email: string) { const r = await J("/api/leads", { method: "POST", body: { contact: { name: "C " + email, email }, service_requested: "ESA", est_value: 4000 } }, O); return r.j.lead.id; }
const L1 = await mkLead("a@v31.test"); const L2 = await mkLead("b@v31.test");
const P1 = await J(`/api/leads/${L1}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbId, qty: 1 }] } }, O);
const P2 = await J(`/api/leads/${L2}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pbId, qty: 1 }] } }, O);

test("numbers are sequential per workspace and refs use them", () => {
  assert.equal(P1.s, 201, JSON.stringify(P1.j).slice(0, 160)); assert.equal(P1.j.number, 1001);
  assert.equal(P2.j.number, 1002);
  assert.equal(proposalDocument(P1.j.id).ref, "PROP-1001");
  assert.equal(proposalDocument(P2.j.id).ref, "PROP-1002");
});

test("clone to the same lead keeps the number; clone to another lead gets a fresh one", async () => {
  const same = await J(`/api/proposals/${P1.j.id}/clone`, { method: "POST", body: {} }, O);
  assert.equal(same.s, 201, JSON.stringify(same.j).slice(0, 120)); assert.equal(same.j.number, 1001);
  const other = await J(`/api/proposals/${P1.j.id}/clone`, { method: "POST", body: { lead_id: L2 } }, O);
  assert.equal(other.s, 201); assert.equal(other.j.number, 1003, "max+1 after 1002 (the same-lead clone kept 1001 and does not consume a number)");
});

test("legacy rows freeze a stable number on first render", () => {
  const db = dbm.db; const id = dbm.uid("prop");
  db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at) VALUES (?,?,?,?,?,?,?,?)").run(id, P1.j.workspace_id, L1, 1, "draft", "[]", 100, new Date(Date.now() + 60000).toISOString());
  const d1 = proposalDocument(id); assert.equal(d1.ref, "PROP-1004", d1.ref);
  const row = db.prepare("SELECT number FROM proposals WHERE id=?").get(id) as any; assert.equal(row.number, 1004);
  assert.equal(proposalDocument(id).ref, "PROP-1004", "frozen forever");
});

test("DOCX signature block: signature spans full width, name+date share the row below", async () => {
  const made = await proposalDocx(P2.j.id); assert.ok(made);
  const { writeFileSync } = await import("node:fs"); writeFileSync("/tmp/v31.docx", made.buffer);
  const xml = execSync(`python3 -c "import zipfile; print(zipfile.ZipFile('/tmp/v31.docx').read('word/document.xml').decode())"`).toString();
  const acc = xml.slice(xml.indexOf("Acceptance"));
  assert.ok(acc.includes('gridSpan'), "signature row spans both columns");
  assert.ok(acc.indexOf("Signature") < acc.indexOf("Name (print)"), "signature label above the name/date row");
  assert.ok(acc.indexOf("Name (print)") < acc.indexOf("Date"), "name before date on the shared row");
});

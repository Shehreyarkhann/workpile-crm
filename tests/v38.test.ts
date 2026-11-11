// V38: (1) every invoice payload carries its pay-page token + link — the job
// payload used to omit them, so View was dead and Copy wrote ".../undefined".
// (2) Every figure in "Money — kept separate" drills into its records, and
// the drill total ties EXACTLY to the figure (same definitions, mirrored).
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Drill Co", email: "own@v38.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v38.test", password: "password123" } })).ck;
// pipeline lead (stays open) + a won lead with proposal, job, invoice, payment
const open = await J("/api/leads", { method: "POST", body: { contact: { name: "Pipe Co", email: "p@pipe.example", phone: "+15165550171" }, service_requested: "Tank Testing", est_value: 5000, source: "t" } }, ck);
const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Drill Customer", email: "d@drill.example", phone: "+15165550172" }, service_requested: "Mold Testing", est_value: 4800, source: "t" } }, ck);
const pb = await J("/api/price-book", {}, ck);
const prop = await J(`/api/leads/${lead.j.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j[0].id, qty: 1 }] } }, ck);
await J(`/api/proposals/${prop.j.id}/send`, { method: "POST", body: {} }, ck);
const job = await J("/api/jobs", { method: "POST", body: { lead_id: lead.j.lead.id } }, ck);
const inv = await J(`/api/jobs/${job.j.id}/invoice`, { method: "POST", body: {} }, ck);
await J(`/api/invoices/${inv.j.id}/send`, { method: "POST", body: {} }, ck);
await J(`/api/invoices/${inv.j.id}/payments`, { method: "POST", body: { amount: 1000 } }, ck);
dbm.db.prepare("UPDATE invoices SET due_at='2020-01-01' WHERE id=?").run(inv.j.id); // force overdue

test("invoice payloads carry token + link on the job, the customer file, and the drill", async () => {
  const j = await J(`/api/jobs/${job.j.id}`, {}, ck);
  assert.ok(j.j.invoices[0].token && j.j.invoices[0].link.startsWith("/invoice/"), "job payload: " + JSON.stringify(j.j.invoices[0]).slice(0, 120));
  const drill = await J("/api/finances/drill/invoiced_value", {}, ck);
  assert.ok(drill.j.rows[0].link && drill.j.rows[0].link.startsWith("/invoice/"), "drill row link present");
  const won = await J(`/api/leads/${lead.j.lead.id}/stage`, { method: "POST", body: { to: "WON", confirm_no_proposal: true } }, ck);
  const accs = await J("/api/accounts", {}, ck);
  const acc = accs.j.find((a: any) => a.name && a.name.includes("Drill")) || accs.j[0];
  const det = await J(`/api/accounts/${acc.id}`, {}, ck);
  assert.ok(det.j.invoices[0].link && det.j.invoices[0].link.startsWith("/invoice/"), "customer file invoice link present");
});

test("every money figure's drill-down ties exactly to the figure itself", async () => {
  const fin = await J("/api/finances", {}, ck);
  for (const key of ["estimated_pipeline", "proposal_value_outstanding", "approved_proposal_value", "signed_contract_value", "invoiced_value", "collected_cash", "outstanding_receivables", "overdue_receivables"]) {
    const d = await J(`/api/finances/drill/${key}`, {}, ck);
    assert.equal(d.s, 200, key);
    assert.equal(Math.round(d.j.total * 100), Math.round(fin.j[key].value * 100), `${key}: drill total ${d.j.total} != figure ${fin.j[key].value}`);
    assert.equal(d.j.count, d.j.rows.length, key + " count");
    for (const r of d.j.rows) assert.ok(r.title && r.sub !== undefined && typeof r.amount === "number", key + " row shape");
  }
  const rec = await J("/api/finances/drill/outstanding_receivables", {}, ck);
  assert.ok(rec.j.rows[0].sub.includes("OVERDUE"), "the receivables list flags the overdue invoice");
  assert.equal(rec.j.rows[0].job_id, job.j.id, "the receivable row opens its job");
});

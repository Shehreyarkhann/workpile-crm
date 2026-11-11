// V35: an invoice behaves like a proposal — it appears with a public page, a
// pay link that settles it (test-mode Stripe path), an email send, and a DOCX.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olivia", business_name: "Invoice Co", email: "own@v35.test", password: "password123" } });
const ck = (await J("/api/auth/login", { method: "POST", body: { email: "own@v35.test", password: "password123" } })).ck;
async function leadWithJob(email: string | null, value: number) {
  const r = await J("/api/leads", { method: "POST", body: { contact: { name: "Cust " + Math.random().toString(36).slice(2, 7), email: email || undefined, phone: "+1516555" + Math.floor(1000 + Math.random() * 9000) }, service_requested: "Tank Testing", est_value: value, source: "test" } }, ck);
  const leadId = r.j.lead.id;
  const job = await J("/api/jobs", { method: "POST", body: { lead_id: leadId } }, ck);
  const jobId = job.j.id;
  dbm.db.prepare("UPDATE jobs SET value=? WHERE id=?").run(value, jobId);
  const inv = await J(`/api/jobs/${jobId}/invoice`, { method: "POST", body: {} }, ck);
  return { leadId, jobId, inv };
}
const one = await leadWithJob("cust@v35.test", 4800);

test("the created invoice carries a token, a link and a public page", async () => {
  assert.equal(one.inv.s, 201, JSON.stringify(one.inv.j).slice(0, 160));
  assert.ok(one.inv.j.token && one.inv.j.link === "/invoice/" + one.inv.j.token);
  assert.equal(one.inv.j.number, "INV-0001");
  const page = await fetch(B + one.inv.j.link);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("INV-0001") && html.includes("BALANCE DUE") && html.includes("$4,800.00"), "page shows the invoice + balance");
  assert.ok(html.includes("Pay $4,800.00"), "with a pay button");
});

test("the pay link settles the invoice through the test-mode payment page", async () => {
  const payRes = await fetch(B + one.inv.j.link + "/pay", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", redirect: "manual" });
  assert.equal(payRes.status, 302);
  const loc = payRes.headers.get("location") || "";
  assert.ok(loc.includes("/pay/test/"), "test mode routes to the hosted test page: " + loc);
  const payUrl = loc.startsWith("http") ? loc : B + loc;
  const page = await (await fetch(payUrl)).text();
  assert.ok(page.includes("Invoice payment"), "the test page speaks invoice, not deposit");
  await fetch(payUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", redirect: "manual" });
  const list = await J("/api/invoices", {}, ck);
  const inv = list.j.find((i: any) => i.id === one.inv.j.id);
  assert.equal(inv.status, "paid"); assert.equal(inv.paid_amount, 4800); assert.equal(inv.balance, 0);
  const jobRow = dbm.db.prepare("SELECT invoice_status FROM jobs WHERE id=?").get(one.jobId) as any;
  assert.equal(jobRow.invoice_status, "paid");
  const pageAfter = await (await fetch(B + one.inv.j.link)).text();
  assert.ok(pageAfter.includes("paid in full"), "the public page reflects settlement");
});

test("send emails the customer (test mode here) and stamps sent_at; no-email customers 422", async () => {
  const two = await leadWithJob("second@v35.test", 1200);
  const sent = await J(`/api/invoices/${two.inv.j.id}/send`, { method: "POST", body: {} }, ck);
  assert.equal(sent.s, 200, JSON.stringify(sent.j).slice(0, 140));
  assert.equal(sent.j.test_mode, true); assert.ok(sent.j.link.includes("/invoice/"));
  const row = dbm.db.prepare("SELECT sent_at FROM invoices WHERE id=?").get(two.inv.j.id) as any;
  assert.ok(row.sent_at, "sent_at stamped");
  const three = await leadWithJob(null, 900);
  const noEmail = await J(`/api/invoices/${three.inv.j.id}/send`, { method: "POST", body: {} }, ck);
  assert.equal(noEmail.s, 422); assert.equal(noEmail.j.error.code, "no_email");
});

test("a partial manual payment leaves the pay link asking only for the remainder; DOCX downloads", async () => {
  const four = await leadWithJob("four@v35.test", 1000);
  await J(`/api/invoices/${four.inv.j.id}/payments`, { method: "POST", body: { amount: 400 } }, ck);
  const payRes = await fetch(B + four.inv.j.link + "/pay", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "", redirect: "manual" });
  const loc = payRes.headers.get("location") || "";
  const page = await (await fetch(loc.startsWith("http") ? loc : B + loc)).text();
  assert.ok(page.includes("$600.00"), "pay page asks for the $600 remainder, not the full $1,000");
  const doc = await fetch(B + `/api/invoices/${four.inv.j.id}/document`, { headers: { Cookie: ck } });
  assert.equal(doc.status, 200);
  const buf = Buffer.from(await doc.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK", "a real DOCX (zip) downloads");
});

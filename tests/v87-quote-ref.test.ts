// v87: customer-facing proposal documents carry the Q number (the v77 chain
// identity), not the legacy PROP-#### — DOCX, sign page and proposal view all
// read proposalDocument().ref. Legacy rows without a quote_no keep PROP-####.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let pt: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v87", "pw", "8701"].join("-");
let propId = ""; let quoteNo = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v87-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  pt = await import("../server/proptemplate.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Quinn Ref", email: "quinn@v87.test", password: PW, business_name: "V87 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "quinn@v87.test", password: PW });
  const lead = await call("POST", "/api/leads", { contact: { name: "Ref Client", email: "ref@v87.test", phone: "55501000087" }, service_requested: "Mold remediation", est_value: 5000 });
  const leadId = lead.body.lead.id;
  await call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const d = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(d.status, 201, JSON.stringify(d.body)); propId = d.body.proposal.id;
  quoteNo = d.body.proposal.quote_no;
  assert.match(quoteNo, /^Q\d{2}-\d{4}$/, "auto-draft carries a Q number");
});

test("proposalDocument ref is the Q number, and the sign page prints it", async () => {
  const doc = pt.proposalDocument(propId);
  assert.equal(doc.ref, quoteNo);
  const link = await call("POST", `/api/proposals/${propId}/sign-link`, {});
  assert.equal(link.status, 200, JSON.stringify(link.body));
  const page = await fetch(`${base}/sign/${link.body.token}`);
  const html = await page.text();
  assert.ok(html.includes(quoteNo), "sign page shows " + quoteNo);
  assert.ok(!html.includes("PROP-"), "sign page no longer prints PROP-####");
  const docx = await fetch(`${base}/api/proposals/${propId}/docx`, { headers: { cookie } });
  assert.equal(docx.status, 200);
  const buf = Buffer.from(await docx.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK", "docx is a real zip");
});

test("a legacy proposal without a quote number keeps the PROP-#### fallback", async () => {
  const row = dbm.db.prepare("SELECT * FROM proposals WHERE id=?").get(propId) as any;
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,line_items,total,created_at,number,quote_no) VALUES (?,?,?,?,?,?,?,?,?,NULL)")
    .run("prop_v87_legacy", row.workspace_id, row.lead_id, 9, "draft", "[]", 1200, new Date().toISOString(), 1042);
  const doc = pt.proposalDocument("prop_v87_legacy");
  assert.equal(doc.ref, "PROP-1042");
});

// v79: numbered section library + template composition + snapshot discipline.
// Templates pick sections by number in a chosen order; proposals freeze the
// composed sections at creation; the sign page renders them in that order.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v79", "pw", "7913"].join("-");
let sec6 = ""; let sec1 = ""; let sec16 = ""; let propId = ""; let signToken = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v79-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(25000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Sara Sections", email: "owner79@demo.test", password: PW, business_name: "V79 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner79@demo.test", password: PW });
});

test("the library seeds 16 numbered sections", async () => {
  const r = await call("GET", "/api/template-sections");
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 16);
  assert.deepEqual(r.body.map((x: any) => x.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  sec1 = r.body.find((x: any) => x.number === 1).id;
  sec6 = r.body.find((x: any) => x.number === 6).id;
  sec16 = r.body.find((x: any) => x.number === 16).id;
});

test("a template composes sections by number, in a chosen order — and the proposal snapshots them", async () => {
  const tpls = await call("GET", "/api/doc-templates");
  const def = (tpls.body || []).find((t: any) => t.is_default && (t.kind || "proposal") === "proposal") || tpls.body[0];
  const patched = await call("PATCH", `/api/doc-templates/${def.id}`, { sections: [sec6, sec1, sec16] });
  assert.equal(patched.status, 200, JSON.stringify(patched.body).slice(0, 200));
  assert.deepEqual(JSON.parse(patched.body.sections), [sec6, sec1, sec16]);
  const lr = await call("POST", "/api/leads", { contact: { name: "Pat Prospect", email: "pat@v79.test", phone: "55501000079" }, service_requested: "Mold remediation", est_value: 8000 });
  const leadId = lr.body.lead.id;
  const dr = await call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(dr.status, 201, JSON.stringify(dr.body).slice(0, 200));
  propId = dr.body.proposal.id;
  const row = dbm.db.prepare("SELECT sections_snapshot FROM proposals WHERE id=?").get(propId) as any;
  const snap = JSON.parse(row.sections_snapshot || "[]");
  assert.deepEqual(snap.map((x: any) => x.number), [6, 1, 16], "snapshot keeps the composed order");
  assert.match(snap[0].title, /Insurance/);
});

test("the sign page renders sections in composed order — and later library edits don't rewrite the issued quote", async () => {
  const sl = await call("POST", `/api/proposals/${propId}/sign-link`, {});
  assert.equal(sl.status, 200, JSON.stringify(sl.body).slice(0, 160));
  signToken = sl.body.token;
  const page = await call("GET", `/sign/${signToken}`);
  assert.equal(page.status, 200);
  const i6 = page.text.indexOf("Section 6 —"); const i1 = page.text.indexOf("Section 1 —"); const i16 = page.text.indexOf("Section 16 —"); const iT = page.text.indexOf("Terms & Conditions");
  assert.ok(i6 > -1 && i1 > i6 && i16 > i1 && iT > i16, `order 6 < 1 < 16 < terms (got ${i6}, ${i1}, ${i16}, ${iT})`);
  // Edit the library: the issued proposal must keep its frozen wording.
  const ed = await call("PATCH", `/api/template-sections/${sec6}`, { title: "Insurance & Licensing — REWRITTEN" });
  assert.equal(ed.status, 200);
  const page2 = await call("GET", `/sign/${signToken}`);
  assert.ok(page2.text.includes("Section 6 — Insurance & Licensing"), "snapshot title preserved");
  assert.ok(!page2.text.includes("REWRITTEN"), "library edit did not leak into the issued quote");
  // DOCX endpoint serves a real Word file for the same proposal.
  const dx = await fetch(base + `/api/proposals/${propId}/docx`, { headers: { cookie } });
  assert.equal(dx.status, 200, "docx route status");
  const buf = Buffer.from(await dx.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString(), "PK", "docx is a zip (PK)");
});

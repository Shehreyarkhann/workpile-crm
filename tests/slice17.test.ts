// Slice 17: proposal document template — rich text, header/footer, print + DOCX.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test17-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", propId = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T17 Environmental", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t17.co", hashPassword("password1"), "OWNER");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t17.co", password: "password1" } })).cookie;
  const ct = uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(ct, ws, "Pat Prospect", "+15165551111", "pat@x.co");
  const lead = uid("lead");
  dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,service_requested,location,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(lead, ws, ct, "APPROVED", "Mold remediation", "Bay Shore, NY", "Mold in primary bath", now(), now());
  propId = uid("prop");
  dbm.db.prepare("INSERT INTO proposals (id,workspace_id,lead_id,version,status,total,line_items,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(propId, ws, lead, 1, "draft", 4800, JSON.stringify([{ name: "Mold remediation — primary bath", qty: 1, unit_price: 4800 }]), now());
});

test("defaults: template falls back to workspace name + starter wording, marked not customized", async () => {
  const t = await J("/api/proposal-template", {}, { Cookie: cookie });
  assert.equal(t.j.company, "T17 Environmental"); assert.equal(t.j.customized, false);
  assert.match(t.j.intro_html, /\{customer\}/);
});

test("save: rich text kept, scripts and handlers stripped, document merges fields", async () => {
  const put = await J("/api/proposal-template", { method: "PUT", body: {
    company: "T17 Environmental Group", tagline: "Licensed · Insured", contact_line: "(516) 555-0100 · hi@t17.co", address: "1 Main St, Bay Shore, NY",
    intro_html: '<p>Dear {customer},</p><p><b>Thanks</b> for the {service} job.</p><script>alert(1)</script><p onclick="x()">Total {total}</p>',
    terms_html: "<p>Valid 14 days.</p>", footer: "Footer for {business}",
  } }, { Cookie: cookie });
  assert.equal(put.j.customized, true);
  assert.ok(!put.j.intro_html.includes("script") && !put.j.intro_html.includes("onclick"));
  assert.ok(put.j.intro_html.includes("<b>Thanks</b>"));
  const d = await J(`/api/proposals/${propId}/document`, {}, { Cookie: cookie });
  assert.equal(d.j.template.company, "T17 Environmental Group");
  assert.ok(d.j.template.intro_html.includes("Dear Pat Prospect"));
  assert.ok(d.j.template.intro_html.includes("$4,800.00"));
  assert.ok(d.j.template.footer.includes("T17 Environmental Group"));
  assert.ok(d.j.ref.startsWith("PROP-")); assert.equal(d.j.items.length, 1);
});

test("DOCX export renders from the template (200, real .docx package)", async () => {
  const r = await fetch(`http://localhost:${port}/api/proposals/${propId}/docx`, { headers: { Cookie: cookie, Connection: "close" } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") || "", /wordprocessingml/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 2000 && buf.subarray(0, 2).toString() === "PK");
});

test("document endpoint is workspace-scoped (404 for another tenant's proposal)", async () => {
  const ws2 = dbm.uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws2, "Other Co", dbm.now());
  const u2 = dbm.uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(u2, ws2, "Eve", "e@other.co", dbm.hashPassword("password1"), "OWNER");
  const c2 = (await J("/api/auth/login", { method: "POST", body: { email: "e@other.co", password: "password1" } })).cookie;
  const d = await J(`/api/proposals/${propId}/document`, {}, { Cookie: c2 });
  assert.equal(d.status, 404);
});

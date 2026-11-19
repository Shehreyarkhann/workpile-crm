// v91 — Report template builder foundations: all three seeded templates exist,
// the sample preview renders a template with realistic data (merge fields
// resolved), and a block-level edit through the API changes what the preview
// renders.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j, text: t };
}
const PW = ["v91", "pw", "9101"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v91-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(29500 + Math.floor(Math.random() * 4000));
  const dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Bea Builder", email: "bea@v91.test", password: PW, business_name: "V91 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "bea@v91.test", password: PW });
});

test("the three seeded report templates exist with their block shapes", async () => {
  const tpls = await call("GET", "/api/report-templates?all=1");
  const names = tpls.body.map((t: any) => t.name);
  assert.ok(names.includes("Standard Inspection Report"), names.join(","));
  assert.ok(names.includes("Inspection Report Card"), names.join(","));
  assert.ok(names.includes("Clearance Certificate"), names.join(","));
  const card = tpls.body.find((t: any) => t.name === "Inspection Report Card");
  assert.ok(card.blocks.length <= 6, "the card stays short");
  assert.ok(!card.blocks.some((b: any) => b.type === "results"), "the card has no full results block");
  const cert = tpls.body.find((t: any) => t.name === "Clearance Certificate");
  assert.ok(cert.blocks.some((b: any) => b.type === "signoff"), "certificate carries sign-offs");
});

test("sample preview renders the template with sample data and resolved merge fields", async () => {
  const tpls = await call("GET", "/api/report-templates?all=1");
  const std = tpls.body.find((t: any) => t.name === "Standard Inspection Report");
  const prev = await call("GET", `/api/report-templates/${std.id}/sample-preview`);
  assert.equal(prev.status, 200);
  assert.ok(prev.text.includes("Sample Client LLC"), "sample client renders");
  assert.ok(prev.text.includes("Sample Inspector"), "sample inspector renders");
  assert.ok(prev.text.includes("Residue found behind the radiator line"), "sample finding renders");
  assert.ok(!prev.text.includes("{{client}}"), "merge fields resolved in footer");
  assert.ok(prev.text.includes("Confidential — prepared for Sample Client LLC"), "footer merge resolved: " + prev.text.slice(prev.text.indexOf("Confidential") - 40, prev.text.indexOf("Confidential") + 60));
});

test("editing blocks through the API changes the preview; deactivation hides the template from generation lists", async () => {
  const tpls = await call("GET", "/api/report-templates?all=1");
  const cert = tpls.body.find((t: any) => t.name === "Clearance Certificate");
  const withStatic = [...cert.blocks, { type: "static", settings: { title: "Warranty", text: "Ninety-day workmanship warranty for {{company}}." } }];
  const patched = await call("PATCH", `/api/report-templates/${cert.id}`, { blocks: withStatic });
  assert.equal(patched.status, 200, JSON.stringify(patched.body));
  const prev = await call("GET", `/api/report-templates/${cert.id}/sample-preview`);
  assert.ok(prev.text.includes("Warranty"), "static block renders");
  assert.ok(prev.text.includes("Ninety-day workmanship warranty for V91 Environmental"), "merge field inside static text resolves");
  await call("PATCH", `/api/report-templates/${cert.id}`, { active: false });
  const gen = await call("GET", "/api/report-templates");
  assert.ok(!gen.body.some((t: any) => t.id === cert.id), "inactive template leaves the generation list");
  const all = await call("GET", "/api/report-templates?all=1");
  assert.ok(all.body.some((t: any) => t.id === cert.id && !t.active), "but stays in the builder list as inactive");
});

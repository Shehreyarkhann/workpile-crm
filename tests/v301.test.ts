// V30.1: reply_email settings round-trip (the subdomain-sending companion).
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V301 Co", email: "o@v301.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v301.test", password: "password123" } })).ck; assert.ok(O);
test("reply_email saves via settings and reads back in the DTO", async () => {
  const p = await J("/api/settings", { method: "PATCH", body: { from_email: "proposals@send.v301.test", reply_email: "info@v301.test" } }, O);
  assert.equal(p.s, 200, JSON.stringify(p.j)); assert.equal(p.j.workspace.reply_email, "info@v301.test"); assert.equal(p.j.workspace.from_email, "proposals@send.v301.test");
  const g = await J("/api/settings", {}, O); assert.equal(g.j.workspace.reply_email, "info@v301.test");
});

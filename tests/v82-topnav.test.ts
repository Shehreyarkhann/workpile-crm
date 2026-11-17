// v82: workspace navigation layout — sidebar (default) or fixed top bar.
// The choice persists on the workspace, rides /api/auth/me (the shell
// renders from it), and invalid values coerce back to sidebar.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v82", "pw", "8213"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v82-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  const dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Nina Nav", email: "owner82@demo.test", password: PW, business_name: "V82 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner82@demo.test", password: PW });
});

test("nav layout defaults to sidebar, switches to topbar, and coerces bad values", async () => {
  const me0 = await call("GET", "/api/auth/me");
  assert.equal(me0.body.user.nav_layout, "sidebar");
  const patch = await call("PATCH", "/api/settings", { nav_layout: "topbar" });
  assert.equal(patch.status, 200, JSON.stringify(patch.body).slice(0, 160));
  assert.equal(patch.body.workspace.nav_layout, "topbar");
  const me1 = await call("GET", "/api/auth/me");
  assert.equal(me1.body.user.nav_layout, "topbar", "the shell sees the new layout");
  const bad = await call("PATCH", "/api/settings", { nav_layout: "sideways" });
  assert.equal(bad.body.workspace.nav_layout, "sidebar", "invalid values coerce to sidebar");
});

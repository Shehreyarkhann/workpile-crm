// V64 — coordinate grid: the layout sanitizer carries x/y/h for free
// placement, clamps them into the grid, and drops invalid values (the
// client packs items that arrive without coordinates).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let base = "", server: any, cookie = "";
const H = () => ({ cookie, "content-type": "application/json" });
const J = async (r: Response) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const reg = async (email: string) => {
  const r = await fetch(base + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "V", email, password: ["v64", "pw", "4411"].join("-"), business_name: "V64 Co" }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0]; assert.equal(r.status, 201);
};

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-v64-"));
  process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
  const dbm: any = await import("../server/db.ts"); dbm.initSchema();
  const appm: any = await import("../server/app.ts");
  server = appm.app.listen(0); server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { try { server.close(); } catch { /* noop */ } });

test("coordinates round-trip exactly; out-of-range values clamp or drop", async () => {
  await reg("v64a@test.dev");
  const put = await fetch(base + "/api/home/layout", { method: "PUT", headers: H(), body: JSON.stringify({ items: [
    { iid: "clock", wid: "clock", w: 3, x: 9, y: 0, h: 11, settings: { style: "midnight", zone: "Asia/Karachi" } },
    { iid: "calendar", wid: "calendar", w: 4, x: 0, y: 0, h: 19 },
    { iid: "finances", wid: "finances", w: 5, x: 99, y: -3, h: 5000 }, // x/y invalid → dropped; h clamps... h>200 is out of range → dropped too
    { iid: "recent", wid: "recent", w: 8 }, // no coords at all → passes through coord-less
  ] }) }).then(J);
  assert.equal(put.ok, true);
  const got = await fetch(base + "/api/home/layout", { headers: H() }).then(J);
  const by = Object.fromEntries(got.layout.map((i: any) => [i.iid, i]));
  assert.deepEqual({ x: by.clock.x, y: by.clock.y, h: by.clock.h }, { x: 9, y: 0, h: 11 });
  assert.equal(by.clock.settings.zone, "Asia/Karachi");
  assert.deepEqual({ x: by.calendar.x, y: by.calendar.y, h: by.calendar.h }, { x: 0, y: 0, h: 19 });
  assert.equal(by.finances.x, undefined); assert.equal(by.finances.y, undefined); assert.equal(by.finances.h, undefined);
  assert.equal(by.recent.x, undefined);
});

test("h below the floor is dropped; fractional coordinates round", async () => {
  await reg("v64b@test.dev");
  await fetch(base + "/api/home/layout", { method: "PUT", headers: H(), body: JSON.stringify({ items: [
    { iid: "goal", wid: "goal", w: 5, x: 2.6, y: 4.2, h: 1 },
  ] }) }).then(J);
  const got = await fetch(base + "/api/home/layout", { headers: H() }).then(J);
  assert.equal(got.layout[0].x, 3); assert.equal(got.layout[0].y, 4);
  assert.equal(got.layout[0].h, undefined, "h=1 is below the 2-unit floor → dropped for client estimation");
});

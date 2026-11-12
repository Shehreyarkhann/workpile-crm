// V59 — Custom Home layouts. Pinned semantics: layouts are per user AND
// per workspace; nothing saved = null (the client renders its default,
// which is today's Home); writes are sanitized (widget id shape, width
// clamped 2..12, duplicates dropped, item cap, settings size cap);
// malformed payloads are refused without touching the stored layout.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v59-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);

const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v59", "pw", "9921"].join("-");

async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie");
  return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
let cA = "", cB = "";
before(async () => {
  const ra = await call("POST", "/api/auth/register", { name: "Ann A", email: "a@v59.test", password: PW, business_name: "A Co" });
  assert.equal(ra.s, 201); cA = ra.cookie!;
  const rb = await call("POST", "/api/auth/register", { name: "Bob B", email: "b@v59.test", password: PW, business_name: "B Co" });
  assert.equal(rb.s, 201); cB = rb.cookie!;
});

test("no saved layout returns null (client default rules)", async () => {
  const r = await call("GET", "/api/home/layout", undefined, cA);
  assert.equal(r.s, 200);
  assert.equal(r.j.layout, null);
});

test("PUT sanitizes: widths clamped, bad ids dropped, duplicates removed, settings kept", async () => {
  const items = [
    { wid: "clock", w: 99, settings: { style: "midnight" } },
    { wid: "stat_pipeline", w: 1 },
    { wid: "Bad Id!", w: 5 },
    { wid: "clock", w: 4 },
    { wid: "agent", w: 8 },
    "garbage",
    { wid: "goal", w: "5" },
  ];
  const r = await call("PUT", "/api/home/layout", { items }, cA);
  assert.equal(r.s, 200);
  assert.deepEqual(r.j.layout.map((x: any) => x.wid), ["clock", "stat_pipeline", "agent", "goal"]);
  assert.equal(r.j.layout[0].w, 12); // 99 clamped
  assert.equal(r.j.layout[1].w, 2);  // 1 clamped up to the generic floor
  assert.deepEqual(r.j.layout[0].settings, { style: "midnight" });
  assert.equal(r.j.layout[3].w, 5);  // string width coerced
  const g = await call("GET", "/api/home/layout", undefined, cA);
  assert.deepEqual(g.j.layout, r.j.layout);
});

test("layouts are isolated per user", async () => {
  const gb = await call("GET", "/api/home/layout", undefined, cB);
  assert.equal(gb.j.layout, null);
  const pb = await call("PUT", "/api/home/layout", { items: [{ wid: "calendar", w: 4 }] }, cB);
  assert.equal(pb.s, 200);
  const ga = await call("GET", "/api/home/layout", undefined, cA);
  assert.equal(ga.j.layout.length, 4); // A's layout untouched by B's save
  const gb2 = await call("GET", "/api/home/layout", undefined, cB);
  assert.deepEqual(gb2.j.layout, [{ wid: "calendar", w: 4 }]);
});

test("malformed payloads are refused and the stored layout survives", async () => {
  const bad1 = await call("PUT", "/api/home/layout", { items: "nope" }, cA);
  assert.equal(bad1.s, 422);
  const bad2 = await call("PUT", "/api/home/layout", {}, cA);
  assert.equal(bad2.s, 422);
  const g = await call("GET", "/api/home/layout", undefined, cA);
  assert.equal(g.j.layout.length, 4);
});

test("oversized settings are dropped, item cap enforced", async () => {
  const big = "x".repeat(5000);
  const items = Array.from({ length: 45 }, (_, i) => ({ wid: "w" + i, w: 3, settings: { blob: big } }));
  const r = await call("PUT", "/api/home/layout", { items }, cB);
  assert.equal(r.s, 200);
  assert.equal(r.j.layout.length, 40);
  assert.equal(r.j.layout[0].settings, undefined);
});

test("DELETE resets to null", async () => {
  const d = await call("DELETE", "/api/home/layout", undefined, cA);
  assert.equal(d.s, 200);
  const g = await call("GET", "/api/home/layout", undefined, cA);
  assert.equal(g.j.layout, null);
});

test("layout endpoints require auth", async () => {
  const r = await call("GET", "/api/home/layout");
  assert.equal(r.s, 401);
});

// V62 — Custom Home Phase 3: instance identity at the layout API.
// Multiple instances of a multi-capable widget (distinct iid) survive the
// round-trip with their own settings; duplicate iids collapse; legacy
// v59/v60 payloads (no iid, singleton semantics) behave exactly as before.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v62-"));
process.env.LEADFLOW_DB = path.join(dir, "t.db");
process.chdir(dir);

const { app } = await import("../server/app.ts");
const dbm = await import("../server/db.ts");
dbm.initSchema();
const server = app.listen(0); server.unref();
const B = `http://127.0.0.1:${(server.address() as any).port}`;
const PW = ["v62", "pw", "9921"].join("-");
let ck = "";

async function call(method: string, p: string, body?: any, cookie?: string) {
  const r = await fetch(B + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  const sc = r.headers.get("set-cookie");
  return { s: r.status, j, cookie: sc ? sc.split(";")[0] : cookie };
}
before(async () => {
  const r = await call("POST", "/api/auth/register", { name: "Ora O", email: "o@v62.test", password: PW, business_name: "O Co" });
  assert.equal(r.s, 201); ck = r.cookie!;
});

test("two instances of one widget persist with distinct iids and their own settings", async () => {
  const items = [
    { iid: "clock", wid: "clock", w: 3, settings: { style: "analog", zone: "workspace" } },
    { iid: "clock#2", wid: "clock", w: 3, settings: { style: "midnight", zone: "Asia/Karachi" } },
    { iid: "leads_recent#2", wid: "leads_recent", w: 8, settings: { bucket: "won" } },
  ];
  const put = await call("PUT", "/api/home/layout", { items }, ck);
  assert.equal(put.s, 200);
  const got = await call("GET", "/api/home/layout", undefined, ck);
  const lay = got.j.layout;
  assert.equal(lay.length, 3);
  const clocks = lay.filter((x: any) => x.wid === "clock");
  assert.equal(clocks.length, 2, "both clock instances kept");
  assert.deepEqual(clocks.map((c: any) => c.iid).sort(), ["clock", "clock#2"]);
  const kar = clocks.find((c: any) => c.iid === "clock#2");
  assert.equal(kar.settings.zone, "Asia/Karachi");
  assert.equal(kar.settings.style, "midnight");
  const won = lay.find((x: any) => x.iid === "leads_recent#2");
  assert.equal(won.settings.bucket, "won");
});

test("duplicate iid collapses to one instance", async () => {
  const items = [
    { iid: "clock", wid: "clock", w: 3, settings: { style: "analog" } },
    { iid: "clock", wid: "clock", w: 4, settings: { style: "paper" } },
  ];
  const put = await call("PUT", "/api/home/layout", { items }, ck);
  assert.equal(put.s, 200);
  const got = await call("GET", "/api/home/layout", undefined, ck);
  assert.equal(got.j.layout.length, 1);
  assert.equal(got.j.layout[0].w, 3, "first instance wins");
});

test("legacy payload without iids keeps v59/v60 singleton semantics", async () => {
  const items = [
    { wid: "goal", w: 4 },
    { wid: "goal", w: 6 },
    { wid: "clock", w: 3, settings: { style: "paper" } },
  ];
  const put = await call("PUT", "/api/home/layout", { items }, ck);
  assert.equal(put.s, 200);
  const got = await call("GET", "/api/home/layout", undefined, ck);
  assert.equal(got.j.layout.length, 2, "duplicate singleton wid dropped, exactly as before");
  const clk = got.j.layout.find((x: any) => x.wid === "clock");
  assert.equal(clk.settings.style, "paper");
});

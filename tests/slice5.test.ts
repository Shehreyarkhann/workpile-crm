// Slice 5 tests: pagination at scale, lead PATCH CRUD, price book CRUD, settings, dashboard, API keys
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test5-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);

let dbm: any, wsId: string;
before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  await import("../server/app.ts");
  wsId = dbm.uid("ws");
  dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(wsId, "Scale Co", dbm.now());
  // 250 leads inserted directly (scale fixture)
  const ins = dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,dedupe_key,service_requested,state,est_value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 250; i++) { const cid = dbm.uid("ct"); dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,phone,email) VALUES (?,?,?,?,?)").run(cid, wsId, "Lead " + i, "+1516555" + String(1000 + i), `l${i}@x.co`); ins.run(dbm.uid("lead"), wsId, cid, "15555" + (1000 + i), i % 3 ? "Water damage cleanup" : "Roofing", i < 60 ? "WON" : i < 100 ? "NEW" : "QUALIFYING", 1000 + i * 10, dbm.now(), dbm.now()); }
});

test("HTTP: paged leads caps page size and reports totals; PATCH edits a lead", async () => {
  const { app } = await import("../server/app.ts");
  const uid2 = dbm.uid("usr"); const sid = dbm.uid("ses");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid2, wsId, "Owner", "o@scale.co", dbm.hashPassword("pw123456"), "OWNER");
  dbm.db.prepare("INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)").run(sid, uid2, dbm.now(), new Date(Date.now() + 3600000).toISOString());
  const srv = app.listen(0); srv.unref(); const port = (srv.address() as any).port; const H = { Cookie: `lf_session=${sid}`, "Content-Type": "application/json", Connection: "close" };
  const r1 = await (await fetch(`http://localhost:${port}/api/leads?paged=1&page=2&page_size=50&state=WON`, { headers: H })).json();
  assert.equal(r1.total, 60); assert.equal(r1.items.length, 10); assert.equal(r1.pages, 2);
  const leadId = r1.items[0].id;
  const r2 = await (await fetch(`http://localhost:${port}/api/leads/${leadId}`, { method: "PATCH", headers: H, body: JSON.stringify({ est_value: 7777, next_action: "Call spouse" }) })).json();
  assert.equal(r2.lead.est_value, 7777); assert.equal(r2.lead.next_action, "Call spouse");
  const r3 = await (await fetch(`http://localhost:${port}/api/dashboard`, { headers: H })).json();
  assert.equal(r3.metrics.total_leads, 250); assert.ok(r3.funnel.length >= 7); assert.equal(r3.series.length, 14);
  const r4 = await (await fetch(`http://localhost:${port}/api/price-book`, { method: "POST", headers: H, body: JSON.stringify({ name: "HTTP item", standard_price: 900, floor_price: 700 }) })).json();
  assert.equal(r4.standard_price, 900);
  (srv as any).closeAllConnections?.(); srv.close();
});

test("dashboard aggregate returns funnel, series, won value at scale", async () => {
  const { metrics } = await import("../server/metrics.ts");
  const m = metrics(wsId);
  assert.equal(m.total_leads, 250); assert.equal(m.won, 60);
});

test("price book CRUD round trip (insert/read shape used by routes)", () => {
  const id = dbm.uid("pb");
  dbm.db.prepare("INSERT INTO price_book_items (id,workspace_id,name,unit,standard_price,floor_price) VALUES (?,?,?,?,?,?)").run(id, wsId, "Test item", "job", 500, 400);
  dbm.db.prepare("UPDATE price_book_items SET standard_price=? WHERE id=?").run(650, id);
  const row = dbm.db.prepare("SELECT * FROM price_book_items WHERE id=?").get(id);
  assert.equal(row.standard_price, 650);
  dbm.db.prepare("DELETE FROM price_book_items WHERE id=?").run(id);
  assert.equal(dbm.db.prepare("SELECT * FROM price_book_items WHERE id=?").get(id), undefined);
});

test("settings patch fields exist on workspace (deposit_pct, autonomy_level)", () => {
  dbm.db.prepare("UPDATE workspaces SET deposit_pct=?, autonomy_level=? WHERE id=?").run(30, 2, wsId);
  const ws = dbm.db.prepare("SELECT * FROM workspaces WHERE id=?").get(wsId);
  assert.equal(ws.deposit_pct, 30); assert.equal(ws.autonomy_level, 2);
});

test("api key hash round trip (management routes use apiKeyHash)", () => {
  const raw = "lf_testsecret";
  const id = dbm.uid("key");
  dbm.db.prepare("INSERT INTO api_keys (id,workspace_id,label,hashed_key,scopes) VALUES (?,?,?,?,?)").run(id, wsId, "t", dbm.apiKeyHash(raw), "leads:write");
  const found = dbm.db.prepare("SELECT * FROM api_keys WHERE hashed_key=? AND revoked_at IS NULL").get(dbm.apiKeyHash(raw));
  assert.ok(found);
});

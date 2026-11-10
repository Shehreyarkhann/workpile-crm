// Slice 15: Demand Gap counts only genuine unmet demand + cluster lead drill-down.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test15-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T15 Co", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t15.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,?,1)").run(uid("svc"), ws, "Mold remediation", 1);
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t15.co", password: "password1" } })).cookie;
});

async function closedLead(name: string, phone: string, service: string, state: string, reason?: string) {
  const c = await J("/api/leads", { method: "POST", body: { contact: { name, phone, email: phone.slice(-4) + "@x.co" }, service_requested: service, message: "x" } }, { Cookie: cookie });
  const id = c.j.lead.id;
  dbm.db.prepare("UPDATE leads SET state=?, lost_reason=? WHERE id=?").run(state, reason || null, id);
  return id;
}

test("pool: only not-offered demand counts — price, no-response, out-of-area, catalog services excluded", async () => {
  await closedLead("Asbestos Ann", "+15165551001", "Asbestos abatement", "UNSERVICEABLE", "NOT_A_FIT");
  await closedLead("Asbestos Abe", "+15165551002", "Asbestos abatement", "LOST", "NOT_A_FIT");
  await closedLead("Pricey Pam", "+15165551003", "Asbestos abatement", "LOST", "PRICE_TOO_HIGH");      // excluded: budget
  await closedLead("Far Fred", "+15165551004", "Asbestos abatement", "UNSERVICEABLE", "OUT_OF_AREA"); // excluded: coverage
  await closedLead("Ghost Gail", "+15165551005", "Asbestos abatement", "NO_RESPONSE", "NO_RESPONSE"); // excluded: no response (state)
  await closedLead("Catalog Carl", "+15165551006", "Mold remediation", "UNSERVICEABLE", "NOT_A_FIT");  // excluded: we sell it
  await closedLead("Rival Rob", "+15165551007", "Radon testing", "LOST", "COMPETITOR");                // excluded: competitor
  const gaps = await J("/api/demand-gap", {}, { Cookie: cookie });
  assert.equal(gaps.j.length, 1);
  assert.equal(gaps.j[0].service, "Asbestos abatement");
  assert.equal(gaps.j[0].lead_count, 2);
});

test("drill-down: /api/demand-gap/leads returns exactly the counted leads with detail fields", async () => {
  const rows = await J("/api/demand-gap/leads?service=" + encodeURIComponent("Asbestos abatement"), {}, { Cookie: cookie });
  assert.equal(rows.j.length, 2);
  const names = rows.j.map((l: any) => l.contact_name).sort();
  assert.deepEqual(names, ["Asbestos Abe", "Asbestos Ann"]);
  assert.ok(rows.j[0].contact_phone && rows.j[0].created_at);
});

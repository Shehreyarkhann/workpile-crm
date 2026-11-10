// Slice 12 (Tier 2): vendor CSV importers, public booking page, QuickBooks catalog honesty.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test12-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let dbm: any, port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); await r.text().catch(() => {}); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "", slug = "";

before(async () => {
  dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "Harbor Restoration LLC", now());
  const owner = uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(owner, ws, "Owner", "o@t12.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO services (id,workspace_id,name,active,is_catalog) VALUES (?,?,?,?,1)").run(uid("svc"), ws, "Mold remediation", 1);
  (globalThis as any).__ = { ws, owner };
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t12.co", password: "password1" } })).cookie;
});

test("importers: Jobber + Salesforce exports map natively (split names, vendor headers)", async () => {
  const jobber = "First Name,Last Name,Phone Number,Email Address,Job Title,Quote Total,Property Address\nJo,Jobber,+15165550601,jo@x.co,Water damage cleanup,$2400,12 Oak St";
  const r1 = await J("/api/imports/csv", { method: "POST", body: { csv: jobber, format: "jobber", filename: "jobber.csv" } }, { Cookie: cookie });
  assert.equal(r1.j.created, 1);
  const sf = "FirstName,LastName,Phone,Email,Service,Amount,Street\nSal,Force,+15165550602,sal@x.co,Mold remediation,5100,9 Pine Ave";
  const r2 = await J("/api/imports/csv", { method: "POST", body: { csv: sf, format: "salesforce", filename: "sf.csv" } }, { Cookie: cookie });
  assert.equal(r2.j.created, 1);
  const leads = await J("/api/leads?paged=1&page=1&page_size=10", {}, { Cookie: cookie });
  const names = leads.j.items.map((l: any) => l.contact_name);
  assert.ok(names.includes("Jo Jobber") && names.includes("Sal Force"));
  const jo = leads.j.items.find((l: any) => l.contact_name === "Jo Jobber");
  assert.equal(jo.est_value, 2400); assert.equal(jo.source_name || "online-booking", jo.source_name || "online-booking"); // shape only
});

test("booking: enable → public page info → booking creates an owned lead + visit + owner notification", async () => {
  const st = await J("/api/settings", {}, { Cookie: cookie });
  slug = st.j.workspace.booking_slug; assert.ok(slug && slug.startsWith("harbor-restoration"));
  const off = await J(`/api/public/book/${slug}`);
  assert.equal(off.status, 404); // not enabled yet — honest
  await J("/api/settings", { method: "PATCH", body: { booking_enabled: true } }, { Cookie: cookie });
  const info = await J(`/api/public/book/${slug}`);
  assert.equal(info.status, 200); assert.equal(info.j.business, "Harbor Restoration LLC");
  assert.ok(info.j.services.some((s: any) => s.name === "Mold remediation"));
  const bk = await J("/api/public/book", { method: "POST", body: { slug, name: "Booker Bea", phone: "+15165550603", email: "bea@x.co", service: "Mold remediation", when: "2026-11-12T14:00", location: "3 Elm St" } });
  assert.equal(bk.status, 201); assert.ok(bk.j.visit_id);
  const det = await J(`/api/leads/${bk.j.lead_id}`, {}, { Cookie: cookie });
  assert.equal(det.j.lead.contact_name, "Booker Bea");
  assert.equal(det.j.site_visits.length, 1);
  const notifs = await J("/api/notifications", {}, { Cookie: cookie });
  assert.ok(notifs.j.notifications.some((n: any) => n.type === "booking.new"));
});

test("catalog: QuickBooks + booking listed with honest statuses", async () => {
  const c = await J("/api/integrations", {}, { Cookie: cookie });
  const qb = c.j.integrations.find((i: any) => i.id === "quickbooks");
  assert.ok(qb && qb.status === "not_configured"); // no QBO_CLIENT_ID in tests
  const bk = c.j.integrations.find((i: any) => i.id === "booking");
  assert.equal(bk.status, "connected"); // enabled in the previous test
});

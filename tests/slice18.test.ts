// Slice 18: bulk imports at backlog scale — 1,000-row lead CSV + 3k-style email backlog (mbox/CSV) with triage.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lf-test18-"));
process.env.LEADFLOW_DB = path.join(tmp, "test.db");
process.chdir(tmp);
let port: number;
const J = async (p: string, o: any = {}, headers: any = {}) => { const r = await fetch(`http://localhost:${port}${p}`, { method: o.method || "GET", headers: { "Content-Type": "application/json", Connection: "close", ...headers }, body: o.body ? JSON.stringify(o.body) : undefined }); const j = await r.json().catch(() => ({})); return { status: r.status, j, cookie: (r.headers.get("set-cookie") || "").split(";")[0] }; };
let cookie = "";

before(async () => {
  const dbm = await import("../server/db.ts");
  dbm.initSchema();
  const { hashPassword, uid, now } = dbm;
  const ws = uid("ws"); dbm.db.prepare("INSERT INTO workspaces (id,name,created_at) VALUES (?,?,?)").run(ws, "T18 Co", now());
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Owner", "o@t18.co", hashPassword("password1"), "OWNER");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(uid("usr"), ws, "Ops", "ops@t18.co", hashPassword("password1"), "OPS_ADMIN");
  const app = (await import("../server/app.ts")).app;
  const srv = app.listen(0); srv.unref(); port = (srv.address() as any).port;
  cookie = (await J("/api/auth/login", { method: "POST", body: { email: "o@t18.co", password: "password1" } })).cookie;
});

test("1,000-row lead CSV imports in one shot, duplicates skipped", async () => {
  const rows = ["name,phone,email,service,value,location"];
  for (let i = 0; i < 1000; i++) rows.push(`Person ${i},+1516555${String(1000 + i).slice(1)},p${i}@x.co,Water damage cleanup,${2000 + i},Town ${i % 20}`);
  rows.push("Dupe One,+1516555000,dup1@x.co,Water damage cleanup,2000,Town 0");
  rows.push("Dupe Two,+1516555001,dup2@x.co,Water damage cleanup,2001,Town 1");
  const t0 = Date.now();
  const r = await J("/api/imports/csv", { method: "POST", body: { csv: rows.join("\n"), filename: "backlog.csv", format: "generic" } }, { Cookie: cookie });
  const secs = (Date.now() - t0) / 1000;
  assert.equal(r.j.created, 1000); assert.equal(r.j.duplicates, 2);
  assert.ok(secs < 30, `import took ${secs}s`);
});

test("mbox backlog: parsed, triaged by category, leads deduped", async () => {
  const msg = (from: string, subject: string, body: string, date = "Mon, 3 Nov 2026 09:12:00 -0500") => `From ${from.match(/<([^>]+)>/)?.[1] || "x@x.co"} Mon Nov  3 09:12:00 2026\nFrom: ${from}\nSubject: ${subject}\nDate: ${date}\n\n${body}\n`;
  const mbox = [
    msg("Lisa Lead <lisa@home.co>", "Need a quote — water damage", "Basement flooded, need help with cleanup. Call me at +1 516-555-0130 please."),
    msg("Lisa Again <lisa2@home.co>", "Quote please", "Following up — same water damage job, phone +1 516-555-0130."),
    msg("AP Vendor <ap@supply.co>", "Invoice #441 due", "Payment for invoice attached. Please remit."),
    msg("Crew Chief <crew@co.co>", "Field report — site photos", "Daily report: crew finished the tear-out, photos attached."),
    msg("Supply House <orders@supply.co>", "Order confirmation", "Your material order is confirmed; delivery scheduled Friday."),
    msg("Broker <broker@ins.co>", "Insurance renewal", "Your certificate renewal is due next month."),
  ].join("\n");
  const r = await J("/api/imports/email", { method: "POST", body: { format: "mbox", content: mbox, filename: "takeout.mbox" } }, { Cookie: cookie });
  assert.equal(r.j.received, 6);
  assert.equal(r.j.by_category.lead, 2); assert.equal(r.j.by_category.finance, 1); assert.equal(r.j.by_category.field, 1);
  assert.equal(r.j.by_category.vendor, 1); assert.equal(r.j.by_category.admin, 1);
  assert.equal(r.j.leads_created, 1); assert.equal(r.j.duplicates, 1);
  const inbox = await J("/api/inbox", {}, { Cookie: cookie });
  assert.ok(inbox.j.length >= 4); // every non-lead became an owned inbox item
});

test("email CSV with quoted bodies parses and triages", async () => {
  const csv = 'from_email,from_name,subject,body,date\n"sam@home.co","Sam","Mold problem","We found mold, need an estimate, call 516-555-0141","2026-11-02"\n"ap@vendor.co","AP","Invoice 88","Invoice attached for payment","2026-11-02"';
  const r = await J("/api/imports/email", { method: "POST", body: { format: "csv", content: csv } }, { Cookie: cookie });
  assert.equal(r.j.received, 2); assert.equal(r.j.leads_created, 1); assert.equal(r.j.by_category.finance, 1);
  const bad = await J("/api/imports/email", { method: "POST", body: { format: "mbox", content: "not an mbox at all" } }, { Cookie: cookie });
  assert.equal(bad.status, 422);
});

// v106 — the smart gate: bulk/automated mail is screened BEFORE business
// categorization, so it never becomes a lead, a queue item or a first
// touch; human mail keeps flowing exactly as before; and the retro sweep
// cleans an inbox that filled up before the gate existed.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let inbox: any; let appMod: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v106", "pw", "1601"].join("-");
let wsId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v106-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  inbox = await import("../server/inbox.ts");
  await import("../server/index.ts");
  appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Tess Triage", email: "tess@v106.test", password: PW, business_name: "V106 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body)); wsId = reg.body.user.workspace_id;
  await call("POST", "/api/auth/login", { email: "tess@v106.test", password: PW });
});

test("the screen: bulk and machine mail is classified before business rules ever see it", () => {
  const n = inbox.parseEmail({ from_email: "newsletter@brand.test", subject: "November deals", body: "Huge sale — 40% off everything. Unsubscribe anytime.", headers: { "list-unsubscribe": "<https://brand.test/u>" } });
  assert.equal(n.category, "marketing"); assert.equal(n.is_lead, false);
  const m = inbox.parseEmail({ from_email: "deals@shop.test", subject: "Best price on services!", body: "Get the best price on our services — 50% off today only! Shop now. To stop these emails, unsubscribe here." });
  assert.equal(m.category, "marketing", "promo copy full of lead words is still marketing");
  assert.equal(inbox.parseEmail({ from_email: "noreply@bank.test", subject: "Your statement is ready", body: "Sign in to view it." }).category, "notification");
  assert.equal(inbox.parseEmail({ from_email: "random@x.test", subject: "Congratulations", body: "You have won the lottery! Claim your prize now." }).category, "spam");
  const human = inbox.parseEmail({ from_email: "jane@gmail.com", subject: "Need a quote", body: "Hi — I need a quote for mold removal in my basement. Please call me at 555-010-2233." });
  assert.equal(human.category, "lead"); assert.equal(human.is_lead, true, "a human inquiry still becomes a lead");
  const admin = inbox.parseEmail({ from_email: "broker@insurance.test", subject: "Certificate renewal", body: "Your insurance certificate renewal is due next month." });
  assert.equal(admin.category, "admin"); assert.equal(admin.is_lead, false);
  const footer = inbox.parseEmail({ from_email: "bob@gmail.com", subject: "Hello", body: "x".repeat(700) + " by the way what is your price for this service" });
  assert.equal(footer.is_lead, false, "lead words buried in a footer do not create a lead");
});

test("ingest: marketing mail creates no lead and lands already filed; the queue stays clean", async () => {
  const out = appMod.ingestBatch(wsId, "tester", [
    { from_email: "newsletter@brand.test", from_name: "Brand", subject: "Deals inside", body: "40% off — unsubscribe", headers: { "list-unsubscribe": "<https://brand.test/u>" } },
    { from_email: "jane@gmail.com", from_name: "Jane", subject: "Need a quote", body: "I need a quote for mold removal. Call 555-010-2233." },
  ]);
  assert.equal(out.leads_created, 1, "only the human inquiry became a lead");
  const item = dbm.db.prepare("SELECT * FROM inbox_items WHERE subject='Deals inside'").get() as any;
  assert.equal(item.category, "marketing"); assert.equal(item.status, "done", "screened mail is filed, not left demanding action");
  const q = await call("GET", "/api/queue");
  assert.ok(!JSON.stringify(q.body).includes("Deals inside"), "the marketing mail never reaches the Work Queue");
});

test("the retro sweep files old junk and junks bulk-created leads, sparing real ones", async () => {
  dbm.db.prepare("INSERT INTO inbox_items (id,workspace_id,category,from_name,from_email,subject,body,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(dbm.uid("inb"), wsId, "admin", "Shop", "deals@shop.test", "Old promo", "50% off everything — shop now! unsubscribe", "open", dbm.now());
  const mkLead = (email: string) => {
    const c = dbm.db.prepare("INSERT INTO contacts (id,workspace_id,name,email) VALUES (?,?,?,?) RETURNING id").get(dbm.uid("ct"), wsId, "X", email) as any;
    const l = dbm.db.prepare("INSERT INTO leads (id,workspace_id,contact_id,state,service_requested,created_at,updated_at) VALUES (?,?,?,'NEW','',?,?) RETURNING id").get(dbm.uid("ld"), wsId, c.id, dbm.now(), dbm.now()) as any;
    dbm.db.prepare("INSERT INTO activities (id,lead_id,workspace_id,user_id,type,body,created_at) VALUES (?,?,?,?, 'email_in','',?)").run(dbm.uid("act"), l.id, wsId, "tester", dbm.now());
    return l.id;
  };
  const junkLead = mkLead("noreply@alerts.test");
  const realLead = mkLead("mike@gmail.com");
  const out = inbox.retriageSweep();
  assert.ok(out.archived >= 1, "the old promo item was filed");
  assert.equal((dbm.db.prepare("SELECT state FROM leads WHERE id=?").get(junkLead) as any).state, "JUNK");
  assert.equal((dbm.db.prepare("SELECT state FROM leads WHERE id=?").get(realLead) as any).state, "NEW", "a human's lead is never swept");
});

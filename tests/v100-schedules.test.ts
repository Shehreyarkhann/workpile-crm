// v100 — Scheduled reports: recipient hygiene, timezone-aware due logic
// with the once-per-slot guard, and a send-now that generates the real
// DOCX and queues it to the recipients through the comms path.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let cookie = ""; let dbm: any; let sched: any;
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v100", "pw", "1001"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v100-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(6000 + Math.floor(Math.random() * 4000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  sched = await import("../server/report-schedules.ts");
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Sue Schedule", email: "sue@v100.test", password: PW, business_name: "V100 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "sue@v100.test", password: PW });
});

test("due logic: right slot fires once; wrong day and just-sent do not", () => {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = days[parts.weekday]; const hr = Number(parts.hour) || 0;
  const baseSched = { enabled: 1, weekday: wd, hour: hr, last_sent_at: null };
  assert.equal(sched.scheduleDue(baseSched, "America/New_York"), true, "due in the current slot");
  assert.equal(sched.scheduleDue({ ...baseSched, weekday: (wd + 1) % 7 }, "America/New_York"), false, "not due tomorrow's weekday");
  assert.equal(sched.scheduleDue({ ...baseSched, last_sent_at: new Date().toISOString() }, "America/New_York"), false, "the 20h guard blocks a second send");
  assert.equal(sched.scheduleDue({ ...baseSched, enabled: 0 }, "America/New_York"), false, "disabled never fires");
  assert.deepEqual(sched.parseRecipients("a@x.com, junk, b@y.org ; c@z"), ["a@x.com", "b@y.org"]);
});

test("send-now generates the real report and queues it to clean recipients only", async () => {
  const missing = await call("POST", "/api/report-schedules/weekly_status/send-now", {});
  assert.equal(missing.status, 404);
  const put = await call("PUT", "/api/report-schedules/weekly_status", { weekday: 1, hour: 8, recipients: "owner@v100.test, not-an-email", enabled: true });
  assert.equal(put.status, 200, JSON.stringify(put.body).slice(0, 140));
  assert.equal(put.body.recipients, "owner@v100.test", "bad addresses are dropped at save time");
  const send = await call("POST", "/api/report-schedules/weekly_status/send-now", {});
  assert.equal(send.status, 200, JSON.stringify(send.body).slice(0, 200));
  assert.deepEqual(send.body.sent_to, ["owner@v100.test"]);
  assert.ok(String(send.body.file).endsWith(".docx"));
  const row = dbm.db.prepare("SELECT * FROM report_schedules WHERE kind='weekly_status'").get() as any;
  assert.ok(row.last_sent_at, "last_sent_at stamped");
  const gen = dbm.db.prepare("SELECT * FROM generated_files WHERE kind='weekly_status'").get() as any;
  assert.ok(gen && gen.size > 1000, "a real DOCX was generated");
  const out = dbm.db.prepare("SELECT * FROM messages_outbox WHERE channel='email'").all() as any[];
  assert.ok(out.some(m => (m.to_addr || m.recipient || "").includes("owner@v100.test") || JSON.stringify(m).includes("owner@v100.test")), "the email is queued through the comms path");
});

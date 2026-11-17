// v81: the calendar buckets events by the workspace's LOCAL day, not UTC.
// An 03:00 UTC visit is a 10pm visit the evening before in New York — it
// must appear on the local evening, with the local time, in both the
// calendar and Home's upcoming agenda.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any; let cookie = ""; let wsId = "";
async function call(method: string, p: string, body?: any) {
  const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
  return { status: r.status, body: j };
}
const PW = ["v81", "pw", "8119"].join("-");
const ny = (iso: string) => { const p: any = {}; for (const x of new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso))) p[x.type] = x.value; return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` }; };
let eveningIso = ""; let eveningLocal = { date: "", time: "" }; let utcDate = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v81-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir); process.env.PORT = String(27000 + Math.floor(Math.random() * 8000));
  dbm = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await call("POST", "/api/auth/register", { name: "Tessa Zones", email: "owner81@demo.test", password: PW, business_name: "V81 Environmental" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await call("POST", "/api/auth/login", { email: "owner81@demo.test", password: PW });
  wsId = (await call("GET", "/api/auth/me")).body.user.workspace_id;
  const lr = await call("POST", "/api/leads", { contact: { name: "Vic Visit", email: "vic@v81.test", phone: "55501000081" }, service_requested: "Tank inspection", est_value: 3000 });
  const leadId = lr.body.lead.id;
  // Tomorrow 03:00 UTC = this evening in New York (22:00 EST / 23:00 EDT).
  const tmr = new Date(Date.now() + 86400000);
  utcDate = tmr.toISOString().slice(0, 10);
  eveningIso = `${utcDate}T03:00:00.000Z`;
  eveningLocal = ny(eveningIso);
  assert.notEqual(eveningLocal.date, utcDate, "fixture sanity: local and UTC dates differ");
  dbm.db.prepare("INSERT INTO site_visits (id,workspace_id,lead_id,assigned_to,scheduled_at,status,notes) VALUES (?,?,?,?,?,?,?)")
    .run("vis_v81", wsId, leadId, null, eveningIso, "scheduled", "Evening inspection");
});

test("the evening visit lands on its LOCAL day with its LOCAL time — not the UTC day", async () => {
  const onLocal = await call("GET", `/api/calendar?from=${eveningLocal.date}&to=${eveningLocal.date}`);
  const ev = (onLocal.body || []).find((e: any) => e.kind === "visit" && e.ref_id === "vis_v81");
  assert.ok(ev, "visit present on the local day");
  assert.equal(ev.date, eveningLocal.date);
  assert.equal(ev.time, eveningLocal.time, `local time (expected ${eveningLocal.time})`);
  const onUtc = await call("GET", `/api/calendar?from=${utcDate}&to=${utcDate}`);
  assert.ok(!(onUtc.body || []).some((e: any) => e.ref_id === "vis_v81"), "visit absent from the UTC day");
});

test("Home's upcoming agenda uses the same local bucketing", async () => {
  const home = await call("GET", "/api/home");
  const ev = (home.body.upcoming || []).find((e: any) => e.kind === "visit" && e.ref_id === "vis_v81");
  assert.ok(ev, "visit in Home upcoming");
  assert.equal(ev.date, eveningLocal.date);
  assert.equal(ev.time, eveningLocal.time);
});

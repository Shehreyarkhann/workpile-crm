// v85: client spreadsheet import — his tracker headers map onto stages,
// assignees, follow-ups and custom fields; dry-run plan before commit.
import { test, before } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";

let base = ""; let cookie = "";
const api = async (p: string, opts: any = {}) => {
  const r = await fetch(base + p, { method: opts.method || "GET", headers: { "content-type": "application/json", cookie }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* not json */ }
  return { status: r.status, body: j };
};
const PW = ["v85", "pw", "8501"].join("-");

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v85-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  process.env.PORT = String(28000 + Math.floor(Math.random() * 8000));
  const dbm: any = await import("../server/db.ts"); dbm.initSchema();
  await import("../server/index.ts");
  const appMod: any = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await api("/api/auth/register", { method: "POST", body: { name: "Tessa Zones", email: "tessa@v85.test", password: PW, business_name: "V85 Environmental" } });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await api("/api/auth/login", { method: "POST", body: { email: "tessa@v85.test", password: PW } });
});

function sheetB64(): string {
  const headers = ["STATUS", "LEAD/QUOTE/SURVEY", "CLIENT NAME", "SERVICE REQUESTED", "ASSIGNED TO", "PROJECT TYPE", "SERVICE LOCATION", "FOLLOW-UP NOTES", "FOLLOW-UP DATE", "RECOMMENDED STATUS"];
  const rows = [
    ["Lead", "Lead", "Harbor Point HOA", "Mold remediation", "Tessa Zones", "Commercial", "14 Harbor Way, Bay Shore NY", "Call about access to basement", new Date("2026-11-25T00:00:00Z"), "Call first"],
    ["Quote", "Quote", "Seaside Diner", "Grease trap pumping", "Ghost Person", "Restaurant", "9 Ocean Ave", "Pricing the quarterly contract", "12/02/2026", "Send quote"],
    ["Sent Quote", "Quote", "Northgate Plaza", "Tank removal", "", "Commercial", "220 Industrial Pkwy", "", "", "Follow up Friday"],
    ["Survey", "Survey", "Cedar Hollow Apts", "Phase I assessment", "", "Multifamily", "77 Cedar Hollow Rd", "Survey booked with tenant", "", ""],
    ["In Review", "", "Mystery Client", "Soil testing", "", "", "", "", "", ""],
    ["Won", "Quote", "Won Client LLC", "Soil remediation", "Tessa Zones", "Industrial", "5 Remediation Way", "Signed — kick off", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Leads");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })).toString("base64");
}

test("dry run maps his headers and stages, flags the unknowns", async () => {
  const r = await api("/api/imports/spreadsheet", { method: "POST", body: { filename: "client-leads.xlsx", data_base64: sheetB64(), dry_run: true } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.mapping.client_name, "client name");
  assert.equal(r.body.mapping.status, "status");
  assert.equal(r.body.mapping.follow_date, "follow-up date");
  assert.equal(r.body.total_rows, 6);
  assert.equal(r.body.by_stage.NEW, 2); // Lead + unmapped "In Review"
  assert.equal(r.body.by_stage.PROPOSAL, 1);
  assert.equal(r.body.by_stage.SENT, 1);
  assert.equal(r.body.by_stage.WORKING, 1);
  assert.equal(r.body.by_stage.WON, 1);
  assert.deepEqual(r.body.unmapped_statuses, [{ value: "In Review", count: 1 }]);
  assert.deepEqual(r.body.unmatched_assignees, [{ name: "Ghost Person", count: 1 }]);
  assert.ok(r.body.sample[0].follow_due.startsWith("2026-11-25"), r.body.sample[0].follow_due);
  assert.ok(r.body.sample[0].assignee_id, "Tessa matched by name");
});

test("commit lands every column: stage, owner, next step, due date, custom fields, WON -> job", async () => {
  const r = await api("/api/imports/spreadsheet", { method: "POST", body: { filename: "client-leads.xlsx", data_base64: sheetB64() } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.created, 6);
  const leads = (await api("/api/leads?limit=200")).body;
  const byName = (n: string) => leads.find((l: any) => (l.contact_name || l.name || "") === n) || leads.find((l: any) => JSON.stringify(l).includes(n));
  const harbor = byName("Harbor Point HOA");
  assert.ok(harbor, "harbor imported");
  assert.equal(harbor.state, "NEW");
  assert.equal(harbor.next_action, "Call about access to basement");
  assert.ok(String(harbor.next_action_due_at).startsWith("2026-11-25"), harbor.next_action_due_at);
  const custom = typeof harbor.custom === "string" ? JSON.parse(harbor.custom || "{}") : (harbor.custom || {});
  assert.equal(custom.project_type, "Commercial");
  assert.equal(custom.recommended_status, "Call first");
  assert.equal(custom.lead_quote_survey, "Lead");
  const seaside = byName("Seaside Diner");
  assert.equal(seaside.state, "PROPOSAL");
  assert.ok(String(seaside.next_action_due_at).startsWith("2026-12-02"), seaside.next_action_due_at);
  const northgate = byName("Northgate Plaza");
  assert.equal(northgate.state, "SENT");
  assert.equal(northgate.next_action, "Follow up on the sent quote");
  const cedar = byName("Cedar Hollow Apts");
  assert.equal(cedar.state, "WORKING");
  const won = byName("Won Client LLC");
  assert.equal(won.state, "WON");
  const jobs = (await api("/api/jobs")).body;
  assert.ok(jobs.some((j: any) => j.lead_id === won.id), "WON import created its job");
});

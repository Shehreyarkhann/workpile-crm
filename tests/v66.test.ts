// V66 — overdue next steps: a lead whose next_action_due_at has passed
// surfaces in the queue as a "Work it" followup_overdue item; scheduling
// the next step forward (what the handling modal does) removes it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let base = "", server: any, cookie = "";
const H = () => ({ cookie, "content-type": "application/json" });
const J = async (r: Response) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-v66-"));
  process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
  const dbm: any = await import("../server/db.ts"); dbm.initSchema();
  const appm: any = await import("../server/app.ts");
  server = appm.app.listen(0); server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(base + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "V", email: "v66@test.dev", password: ["v66", "pw", "3315"].join("-"), business_name: "V66 Co" }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0]; assert.equal(r.status, 201);
});
after(() => { try { server.close(); } catch { /* noop */ } });

test("overdue lead surfaces as Work it; scheduling the next step forward clears it", async () => {
  const created = await fetch(base + "/api/leads", { method: "POST", headers: H(), body: JSON.stringify({ contact: { name: "Late Larry", email: "larry@x.co", phone: "6315550166" }, service_requested: "Tank testing", est_value: 4200, consent: { contact_ok: true } }) }).then(J);
  const leadId = created.lead?.id; assert.ok(leadId);
  // Make its first step overdue.
  const past = new Date(Date.now() - 30 * 3600000).toISOString();
  await fetch(base + `/api/leads/${leadId}`, { method: "PATCH", headers: H(), body: JSON.stringify({ next_action: "First contact", next_action_due_at: past }) }).then(J);
  const q1 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  const item = (q1.items || []).find((i: any) => i.type === "followup_overdue" && i.lead_id === leadId);
  assert.ok(item, "overdue item listed");
  assert.equal(item.primary?.label, "Work it");
  assert.ok(item.age_hours >= 29 && item.age_hours <= 31, "age tracks the overdue hours");
  // The modal's Done action: schedule the stage's next step tomorrow.
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  await fetch(base + `/api/leads/${leadId}`, { method: "PATCH", headers: H(), body: JSON.stringify({ next_action: "Qualify the request", next_action_due_at: tomorrow }) }).then(J);
  const q2 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  assert.ok(!(q2.items || []).some((i: any) => i.type === "followup_overdue" && i.lead_id === leadId), "item leaves the queue once the next step is in the future");
  // And a WON lead never surfaces even with a past-due step.
  await fetch(base + `/api/leads/${leadId}/stage`, { method: "POST", headers: H(), body: JSON.stringify({ to: "WON", confirm_no_proposal: true }) }).then(J);
  await fetch(base + `/api/leads/${leadId}`, { method: "PATCH", headers: H(), body: JSON.stringify({ next_action: "First contact", next_action_due_at: past }) }).then(J);
  const q3 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  assert.ok(!(q3.items || []).some((i: any) => i.type === "followup_overdue" && i.lead_id === leadId), "final-state leads never surface as overdue");
});

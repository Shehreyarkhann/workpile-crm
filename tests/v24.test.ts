import { test } from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-v24-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const { db, initSchema } = await import("../server/db.ts"); initSchema();
const { app } = await import("../server/app.ts");
const { planOf, activeRequests, ingestionAllowed } = await import("../server/billing.ts");
const server = app.listen(0); server.unref(); const base = `http://127.0.0.1:${(server.address() as any).port}`;
async function J(path: string, opts: any = {}, headers: any = {}) { const r = await fetch(base + path, { method: opts.method || "GET", headers: { "Content-Type": "application/json", ...headers }, body: opts.body ? JSON.stringify(opts.body) : undefined }); const txt = await r.text(); let j: any = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt, headers: r.headers }; }
async function signup(email: string) { await J("/api/auth/register", { method: "POST", body: { name: "V24", business: "V24 Co", email, password: "Passw0rd!24" } }); const li = await J("/api/auth/login", { method: "POST", body: { email, password: "Passw0rd!24" } }); return li.headers.get("set-cookie") || ""; }

test("v24: plan catalog v2 — new tiers, prices, legacy aliases", async () => {
  const plans = await J("/api/plans");
  const by = Object.fromEntries(plans.j.plans.map((p: any) => [p.key, p]));
  assert.equal(by.starter.annual_price, 39); assert.equal(by.pro.annual_price, 119); assert.equal(by.business.annual_price, 299);
  assert.equal(by.starter.users, 2); assert.equal(by.pro.users, 5); assert.equal(by.business.users, 15);
  assert.equal(by.pro.active_requests, 750);
  assert.equal(planOf("solo").key, "starter"); assert.equal(planOf("team").key, "pro");
  assert.equal(planOf("crew").key, "pro"); assert.equal(planOf("crew").users, 5);
  assert.equal(planOf("nonsense").key, "pro");
});

test("v24: trials start on Pro; user cap follows the plan (starter = 2)", async () => {
  const c = await signup("v24a@x.co");
  const me = await J("/api/auth/me", {}, { Cookie: c });
  const billing = await J("/api/billing", {}, { Cookie: c });
  assert.equal(billing.j.subscription.plan, "pro"); assert.equal(billing.j.plan.name, "Pro");
  // drop to starter: owner + 1 more user fits, the 3rd login is refused
  await J("/api/billing/change-plan", { method: "POST", body: { plan: "starter" } }, { Cookie: c });
  const u2 = await J("/api/users", { method: "POST", body: { name: "Two", email: "two@x.co", password: "Passw0rd!24", role: "LEAD_OWNER" } }, { Cookie: c });
  assert.equal(u2.s, 201);
  const u3 = await J("/api/users", { method: "POST", body: { name: "Three", email: "three@x.co", password: "Passw0rd!24", role: "LEAD_OWNER" } }, { Cookie: c });
  assert.equal(u3.s, 422); assert.equal(u3.j.error.code, "seat_limit");
  assert.ok(u3.j.error.message.includes("office user"), "copy says office users, not seats");
  void me;
});

test("v24: active requests count non-final leads only; intake is never blocked by usage", async () => {
  const c = await signup("v24b@x.co");
  const me = await J("/api/auth/me", {}, { Cookie: c }); const ws = me.j.user.workspace_id;
  await J("/api/billing/change-plan", { method: "POST", body: { plan: "starter" } }, { Cookie: c });
  for (let i = 0; i < 3; i++) await J("/api/leads", { method: "POST", body: { contact: { name: `P${i}`, email: `p${i}@x.co` }, service_requested: "Phase I ESA" } }, { Cookie: c });
  assert.equal(activeRequests(ws), 3);
  const one = await J("/api/leads", {}, { Cookie: c });
  const lid = (one.j.leads || one.j)[0].id;
  await J(`/api/leads/${lid}/stage`, { method: "POST", body: { to: "LOST", lost_reason: "No budget" } }, { Cookie: c });
  assert.equal(activeRequests(ws), 2);
  const ing = ingestionAllowed(ws);
  assert.equal(ing.allowed, true);
  const billing = await J("/api/billing", {}, { Cookie: c });
  assert.equal(billing.j.usage.active_requests, 2); assert.equal(billing.j.usage.active_allowance, 150);
});

test("v24: API keys are a Pro feature (starter blocked, pro allowed)", async () => {
  const c = await signup("v24c@x.co");
  await J("/api/billing/change-plan", { method: "POST", body: { plan: "starter" } }, { Cookie: c });
  const blocked = await J("/api/api-keys", { method: "POST", body: { label: "k", scopes: "leads:read" } }, { Cookie: c });
  assert.equal(blocked.s, 422); assert.equal(blocked.j.error.code, "plan_feature");
  await J("/api/billing/change-plan", { method: "POST", body: { plan: "pro" } }, { Cookie: c });
  const ok = await J("/api/api-keys", { method: "POST", body: { label: "k", scopes: "leads:read" } }, { Cookie: c });
  assert.equal(ok.s, 201);
});

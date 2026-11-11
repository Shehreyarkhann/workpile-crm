// V40: approvals become a real pre-send gate (owner / ops-director), demand
// gap shows the full picture, services carry performance stats, and Reports
// gains the analytics layer (KPIs, funnel, insights, forecast).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v40-")); process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
const { app } = await import("../server/app.ts"); const server = app.listen(0); server.unref();
const dbm: any = await import("../server/db.ts"); dbm.initSchema();
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const J = async (p: string, o: any = {}, ck = "") => { const r = await fetch(base + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} const sc = r.headers.get("set-cookie"); return { s: r.status, j, ck: sc ? sc.split(";")[0] : ck }; };
const PW = ["v40", "pw", "9921"].join("-");
let O = "", PM = "", OPS = "", wsId = "", leadId = "", propId = "";
before(async () => {
  await J("/api/auth/register", { method: "POST", body: { name: "Olga Owner", business_name: "V40 Env", email: "o@v40.test", password: PW } });
  O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v40.test", password: PW } })).ck;
  const me = await J("/api/auth/me", {}, O); wsId = me.j.user.workspace_id;
  const mk = (name: string, email: string, role: string) => { const id = dbm.uid("usr"); dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)").run(id, wsId, name, email, dbm.hashPassword(PW), role); return id; };
  mk("Pete PM", "pm@v40.test", "PM"); mk("Omar Ops", "ops@v40.test", "OPS_ADMIN");
  PM = (await J("/api/auth/login", { method: "POST", body: { email: "pm@v40.test", password: PW } })).ck;
  OPS = (await J("/api/auth/login", { method: "POST", body: { email: "ops@v40.test", password: PW } })).ck;
  const pmMe = await J("/api/auth/me", {}, PM);
  const l = await J("/api/leads", { method: "POST", body: { contact: { name: "Gate Gail", email: "gail@v40.example", phone: "+15165550111" }, service_requested: "Mold Testing", est_value: 500, source: "v40", owner_id: pmMe.j.user.id } }, PM);
  leadId = l.j.lead.id;
  const pb = await J("/api/price-book", { method: "POST", body: { name: "Mold test visit", unit: "visit", standard_price: 500, floor_price: 400 } }, O);
  const pr = await J(`/api/leads/${leadId}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }] } }, PM);
  propId = pr.j.id;
});

test("a $500 proposal from a PM can no longer send ungated — approval routes to the OWNER", async () => {
  const blocked = await J(`/api/proposals/${propId}/send`, { method: "POST", body: { channel: "email" } }, PM);
  assert.equal(blocked.s, 422); assert.equal(blocked.j.error.code, "approval_required");
  const sub = await J(`/api/proposals/${propId}/submit`, { method: "POST", body: {} }, PM);
  assert.equal(sub.s, 201); assert.equal(sub.j.required, true); assert.equal(sub.j.approver_name, "Olga Owner");
  const det = await J(`/api/leads/${leadId}`, {}, PM);
  assert.equal(det.j.proposals.find((p: any) => p.id === propId).approval_state, "pending");
  const stillBlocked = await J(`/api/proposals/${propId}/send`, { method: "POST", body: { channel: "email" } }, PM);
  assert.equal(stillBlocked.s, 422);
});

test("the OPS DIRECTOR can decide it (can_approve), and then it sends", async () => {
  const pend = await J("/api/approvals", {}, OPS);
  const mine = pend.j.rows ? pend.j.rows.find((a: any) => a.proposal_id === propId) : pend.j.find?.((a: any) => a.proposal_id === propId);
  assert.ok(mine, "pending approval visible to ops");
  const dec = await J(`/api/approvals/${mine.id}/decide`, { method: "POST", body: { decision: "approved" } }, OPS);
  assert.equal(dec.s, 200, JSON.stringify(dec.j));
  const sent = await J(`/api/proposals/${propId}/send`, { method: "POST", body: { channel: "email" } }, PM);
  assert.equal(sent.s, 201, JSON.stringify(sent.j));
});

test("the OWNER is never gated (v25 rule kept)", async () => {
  const l = await J("/api/leads", { method: "POST", body: { contact: { name: "Owner Otto", email: "otto@v40.example", phone: "+15165550112" }, service_requested: "Mold Testing", est_value: 900, source: "v40" } }, O);
  const pbs = await J("/api/price-book", {}, O); const item = (pbs.j.items || pbs.j)[0];
  const pr = await J(`/api/leads/${l.j.lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: item.id, qty: 1 }] } }, O);
  const sub = await J(`/api/proposals/${pr.j.id}/submit`, { method: "POST", body: {} }, O);
  assert.equal(sub.j.required, false);
  const sent = await J(`/api/proposals/${pr.j.id}/send`, { method: "POST", body: { channel: "email" } }, O);
  assert.equal(sent.s, 201);
});

test("demand-gap/full shows the wider picture (turned away, not-offered, coverage)", async () => {
  const u = await J("/api/leads", { method: "POST", body: { contact: { name: "Radon Rita", email: "rita@v40.example", phone: "+15165550113" }, service_requested: "Radon Testing", est_value: 700, source: "v40", location: "Hempstead, NY" } }, O);
  await J(`/api/leads/${u.j.lead.id}/stage`, { method: "POST", body: { to: "UNSERVICEABLE", lost_reason: "SERVICE_NOT_OFFERED" } }, O);
  const f = await J("/api/demand-gap/full", {}, O);
  assert.ok(f.j.turned_away.total >= 1);
  assert.ok(f.j.turned_away.by_reason.some((r: any) => r.reason === "SERVICE_NOT_OFFERED"));
  assert.ok(f.j.not_offered.some((s: any) => s.service === "Radon Testing"));
  assert.ok(f.j.coverage.some((c: any) => c.area === "Hempstead"));
});

test("services/stats carries performance per service; analytics returns KPIs, funnel, forecast", async () => {
  const stats = await J("/api/services/stats", {}, O);
  assert.ok(Array.isArray(stats.j) && stats.j.length > 0);
  assert.ok("win_rate" in stats.j[0] && "price_items" in stats.j[0]);
  const an = await J("/api/analytics?period=month", {}, O);
  assert.ok(an.j.kpis.new_leads.now >= 3, JSON.stringify(an.j.kpis.new_leads));
  assert.equal(an.j.funnel[0].stage, "Leads in");
  assert.ok(an.j.funnel[0].n >= an.j.funnel[an.j.funnel.length - 1].n);
  assert.ok(typeof an.j.forecast.weighted_pipeline === "number");
  assert.ok(Array.isArray(an.j.insights) && Array.isArray(an.j.by_service));
});

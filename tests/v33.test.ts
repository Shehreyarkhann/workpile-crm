// V33 smart template picker: a template mapped to a service auto-applies to
// proposals for leads requesting that service; default otherwise; an
// explicit choice always wins. The agent drafter resolves the same way.
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const { proposalDocument } = await import("../server/proptemplate.ts");
const { draftProposalForLead } = await import("../server/proposals-core.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business_name: "V33 Co", email: "o@v33.test", password: "password123" } });
const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v33.test", password: "password123" } })).ck; assert.ok(O);
const tpls = (await J("/api/doc-templates", {}, O)).j as any[];
assert.ok(tpls.length >= 2, "seeded templates");
const def = tpls.find(t => t.is_default) || tpls[0];
const other = tpls.find(t => t.id !== def.id);
const patched = await J(`/api/doc-templates/${other.id}`, { method: "PATCH", body: { applies_to: "Tank Testing", intro_html: "<p>TANK-SPECIAL intro for {customer}</p>" } }, O);
assert.equal(patched.s, 200, JSON.stringify(patched.j).slice(0, 140)); assert.equal(patched.j.applies_to, "Tank Testing");
const me = await J("/api/auth/me", {}, O); const WS = me.j.user.workspace_id;
const pb = await J("/api/price-book", { method: "POST", body: { name: "Tank test", unit: "job", standard_price: 850, floor_price: 700 } }, O);
async function mkLead(email: string, svc: string) { const r = await J("/api/leads", { method: "POST", body: { contact: { name: "C", email }, service_requested: svc, est_value: 850 } }, O); return r.j.lead; }

test("service-matched template auto-applies; the document renders it", async () => {
  const lead = await mkLead("tank@v33.test", "Tank Testing");
  const p = await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }] } }, O);
  assert.equal(p.s, 201, JSON.stringify(p.j).slice(0, 140));
  assert.equal(p.j.template_id, other.id, "auto-picked the Tank Testing template");
  assert.ok(proposalDocument(p.j.id).template.intro_html.includes("TANK-SPECIAL"), "document uses the mapped template");
});

test("unmatched service falls back to the default template", async () => {
  const lead = await mkLead("mold@v33.test", "Mold Remediation");
  const p = await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }] } }, O);
  assert.equal(p.j.template_id, def.id);
});

test("an explicit template choice always wins over the auto-match", async () => {
  const lead = await mkLead("tank2@v33.test", "Tank Testing");
  const p = await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: pb.j.id, qty: 1 }], template_id: def.id } }, O);
  assert.equal(p.j.template_id, def.id);
});

test("the agent drafter resolves the same smart default", () => {
  const lead = dbm.db.prepare("SELECT * FROM leads WHERE workspace_id=? AND service_requested='Tank Testing' LIMIT 1").get(WS) as any;
  const made = draftProposalForLead(WS, lead);
  const row = dbm.db.prepare("SELECT template_id FROM proposals WHERE id=?").get(made.proposal_id) as any;
  assert.equal(row.template_id, other.id);
});

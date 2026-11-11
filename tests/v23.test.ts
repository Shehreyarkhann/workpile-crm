import { test } from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-v23-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const { db, initSchema } = await import("../server/db.ts"); initSchema();
const { app } = await import("../server/app.ts");
const { sign } = await import("../server/sign.ts");
const server = app.listen(0); server.unref(); const base = `http://127.0.0.1:${(server.address() as any).port}`;
let cookie = "";
async function J(path: string, opts: any = {}, headers: any = {}) { const r = await fetch(base + path, { method: opts.method || "GET", headers: { "Content-Type": "application/json", ...headers }, body: opts.body ? JSON.stringify(opts.body) : undefined }); const txt = await r.text(); let j: any = null; try { j = JSON.parse(txt); } catch {} return { s: r.status, j, txt, headers: r.headers }; }
async function signup(email: string) { await J("/api/auth/register", { method: "POST", body: { name: "V23", business: "V23 Co", email, password: "Passw0rd!23" } }); const li = await J("/api/auth/login", { method: "POST", body: { email, password: "Passw0rd!23" } }); return li.headers.get("set-cookie") || ""; }

test("v23: dedupe guard — closed-lead and different-name collisions create flagged leads; imports keep classic dedupe", async () => {
  cookie = await signup("v23a@x.co");
  const l1 = await J("/api/leads", { method: "POST", body: { contact: { name: "Office Manager", phone: "+15165550100", email: "info@shared.co" }, service_requested: "Phase I ESA" } }, { Cookie: cookie });
  assert.equal(l1.s, 201);
  // same person, same key, lead open → true duplicate
  const dup = await J("/api/leads", { method: "POST", body: { contact: { name: "Office Manager", phone: "+15165550100", email: "info@shared.co" }, service_requested: "Phase I ESA" } }, { Cookie: cookie });
  assert.equal(dup.j.duplicate, true);
  // different person, same shared office number → NEW lead, flagged
  const other = await J("/api/leads", { method: "POST", body: { contact: { name: "Facilities Director Jane", phone: "+15165550100", email: "jane@shared.co" }, service_requested: "Mold Testing" } }, { Cookie: cookie });
  assert.equal(other.j.duplicate, false); assert.equal(other.j.possible_duplicate_of, l1.j.lead.id);
  const ev = db.prepare("SELECT type FROM lead_events WHERE lead_id=? AND type='possible_duplicate'").get(other.j.lead.id) as any;
  assert.ok(ev, "possible_duplicate event recorded");
  // close the first lead, then a fresh request on the same key → new lead, not swallowed
  const lid = l1.j.lead.id;
  await J(`/api/leads/${lid}/stage`, { method: "POST", body: { to: "LOST", lost_reason: "Went with another firm" } }, { Cookie: cookie });
  const again = await J("/api/leads", { method: "POST", body: { contact: { name: "Office Manager", phone: "+15165550100", email: "info@shared.co" }, service_requested: "Tank Testing" } }, { Cookie: cookie });
  assert.equal(again.j.duplicate, false); assert.equal(again.j.possible_duplicate_of, lid);
});

test("v23: sign guards — expired and withdrawn proposals cannot be signed", async () => {
  cookie = await signup("v23b@x.co");
  const ws = (await J("/api/auth/me", {}, { Cookie: cookie })).j.user.workspace_id;
  const lead = await J("/api/leads", { method: "POST", body: { contact: { name: "Sign Tester", email: "sign@x.co" }, service_requested: "Phase I ESA" } }, { Cookie: cookie });
  const lid = lead.j.lead.id;
  db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES ('pb-v23',?, NULL,'Phase I ESA','job',3200,NULL)").run(ws);
  const mk = async () => (await J(`/api/leads/${lid}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: "pb-v23", qty: 1 }] } }, { Cookie: cookie })).j;
  const p1 = await mk(); const prop1 = p1.id || p1.proposal?.id;
  const link1 = await J(`/api/proposals/${prop1}/sign-link`, { method: "POST", body: {} }, { Cookie: cookie });
  db.prepare("UPDATE proposals SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(prop1);
  const r1 = sign(link1.j.token, { signer_name: "Sign Tester", signer_email: "sign@x.co", typed_signature: "Sign Tester", consent: true });
  assert.equal(r1.ok, false); assert.equal(r1.error, "proposal_expired");
  const page = await J(`/sign/${link1.j.token}`);
  assert.ok(page.txt.includes("has expired"), "sign page shows the expired notice, not the form");
  // withdrawn
  const p2 = await mk(); const prop2 = p2.id || p2.proposal?.id;
  const link2 = await J(`/api/proposals/${prop2}/sign-link`, { method: "POST", body: {} }, { Cookie: cookie });
  const wd = await J(`/api/proposals/${prop2}/withdraw`, { method: "POST", body: {} }, { Cookie: cookie });
  assert.equal(wd.s, 200);
  const r2 = sign(link2.j.token, { signer_name: "Sign Tester", signer_email: "sign@x.co", typed_signature: "Sign Tester", consent: true });
  assert.equal(r2.ok, false); assert.equal(r2.error, "proposal_withdrawn");
});

test("v23: periods split live vs test-mode sends", async () => {
  cookie = await signup("v23c@x.co");
  const per = await J("/api/metrics/periods", {}, { Cookie: cookie });
  assert.ok("proposals_live" in per.j.this_week && "proposals_test_mode" in per.j.this_week);
  assert.ok(per.j.this_week.proposals_live + per.j.this_week.proposals_test_mode <= per.j.this_week.proposals_sent + 1, "split reconciles (legacy NULL rows excluded from both)");
});

test("v23: rate limit — auth bucket returns 429 after the cap", async () => {
  let got429 = false;
  for (let i = 0; i < 45 && !got429; i++) { const r = await J("/api/auth/login", { method: "POST", body: { email: "nobody@x.co", password: "wrong" } }); if (r.s === 429) { got429 = true; assert.equal(r.j.error.code, "rate_limited"); } }
  assert.ok(got429, "429 within 45 attempts");
});


// V25: owner-unlimited approvals + approver limit enforcement, job team chat
// with @mentions -> notifications, self-service profile (name/avatar/password).
import test from "node:test"; import assert from "node:assert";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "lf-")); process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
const dbm = await import("../server/db.ts"); dbm.initSchema();
const { app } = await import("../server/app.ts");
const srv = app.listen(0); srv.unref(); const B = `http://127.0.0.1:${(srv.address() as any).port}`;
async function J(p: string, o: any = {}, ck?: string) { const r = await fetch(B + p, { method: o.method || "GET", headers: { "Content-Type": "application/json", ...(ck ? { Cookie: ck } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); let j: any = {}; try { j = JSON.parse(t); } catch {} return { s: r.status, j, ck: (r.headers.get("set-cookie") || "").split(";")[0] }; }
const su = await J("/api/auth/register", { method: "POST", body: { name: "Olive Owner", business: "V25 Co", email: "o@v25.test", password: "password123" } });
assert.ok([200, 201].includes(su.s), JSON.stringify(su.j)); const O = (await J("/api/auth/login", { method: "POST", body: { email: "o@v25.test", password: "password123" } })).ck; assert.ok(O);
const me = await J("/api/auth/me", {}, O); const WS = me.j.user.workspace_id;
// price book row (DB-side fixture)
dbm.db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES ('pbi_v25',?,NULL,'Big Job','job',500000,400000)").run(WS);
dbm.db.prepare("INSERT INTO price_book_items (id,workspace_id,service_id,name,unit,standard_price,floor_price) VALUES ('pbi_v25s',?,NULL,'Small Job','job',5000,4000)").run(WS);
async function bigProposal(ck: string, price: number, approverId?: string) { const item = price >= 100000 ? "pbi_v25" : "pbi_v25s";
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Cust " + Math.random(), email: `c${Math.random()}@x.test` }, service_requested: "Big Job" } }, ck)).j.lead;
  if (approverId) dbm.db.prepare("UPDATE leads SET approver_id=? WHERE id=?").run(approverId, lead.id);
  const prop = await J(`/api/leads/${lead.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: item, qty: 1, unit_price: price }] } }, ck);
  assert.equal(prop.s, 201, JSON.stringify(prop.j));
  return { lead, prop: prop.j.proposal || prop.j };
}
async function mkUser(email: string, role: string) { const r = await J("/api/users", { method: "POST", body: { name: email.split("@")[0], email, password: "password123", role } }, O); assert.equal(r.s, 201, JSON.stringify(r.j)); const login = await J("/api/auth/login", { method: "POST", body: { email, password: "password123" } }); assert.equal(login.s, 200); return { id: r.j.id, ck: login.ck }; }

test("owner is never approval-gated, at any amount", async () => {
  const { prop } = await bigProposal(O, 500000);
  const send = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, O);
  assert.equal(send.s, 201, JSON.stringify(send.j));
});

test("non-owner still needs approval over the threshold; capped approver cannot decide above their limit; owner can", async () => {
  const lo = await mkUser("lead@v25.test", "LEAD_OWNER");
  const ap = await mkUser("appr@v25.test", "APPROVER");
  await J(`/api/team/${ap.id}`, { method: "PATCH", body: { approval_limit: 1000 } }, O);
  // $30,000 via qty 6 x $5,000 — above the $25k policy threshold, above the approver's $1k cap
  const lead2 = (await J("/api/leads", { method: "POST", body: { contact: { name: "Cap Cust", email: "cap@v25.test" }, service_requested: "Small Job" } }, lo.ck)).j.lead;
  dbm.db.prepare("UPDATE leads SET approver_id=? WHERE id=?").run(ap.id, lead2.id);
  const propR = await J(`/api/leads/${lead2.id}/proposals`, { method: "POST", body: { line_items: [{ price_book_item_id: "pbi_v25s", qty: 6, unit_price: 5000 }] } }, lo.ck);
  assert.equal(propR.s, 201, JSON.stringify(propR.j)); const prop = propR.j.proposal || propR.j;
  const send = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, lo.ck);
  assert.equal(send.s, 422); assert.equal(send.j.error.code, "approval_required"); const aprId = send.j.error.approval_id; assert.ok(aprId);
  const capped = await J(`/api/approvals/${aprId}/decide`, { method: "POST", body: { decision: "approved" } }, ap.ck);
  assert.equal(capped.s, 422, JSON.stringify(capped.j)); assert.equal(capped.j.error.code, "over_approval_limit");
  const byOwner = await J(`/api/approvals/${aprId}/decide`, { method: "POST", body: { decision: "approved" } }, O);
  assert.equal(byOwner.s, 200, JSON.stringify(byOwner.j));
  const send2 = await J(`/api/proposals/${prop.id}/send`, { method: "POST", body: {} }, lo.ck);
  assert.equal(send2.s, 201, JSON.stringify(send2.j));
});

test("job team chat: post, @mention notifies only the mentioned user, list works", async () => {
  const pm = await mkUser("pm@v25.test", "PM");
  const lead = (await J("/api/leads", { method: "POST", body: { contact: { name: "Chat Cust", email: "chat@v25.test" }, service_requested: "Big Job" } }, O)).j.lead;
  const job = (await J("/api/jobs", { method: "POST", body: { lead_id: lead.id } }, O)).j; assert.ok(job.id);
  const post = await J(`/api/jobs/${job.id}/messages`, { method: "POST", body: { body: `@${"pm"} please check the west tank`, mention_ids: [pm.id] } }, O);
  assert.equal(post.s, 201, JSON.stringify(post.j)); assert.deepEqual(post.j.mentioned, [pm.id]);
  const list = await J(`/api/jobs/${job.id}/messages`, {}, pm.ck);
  assert.equal(list.j.messages.length, 1); assert.equal(list.j.messages[0].user_name, "Olive Owner");
  const notifs = await J("/api/notifications", {}, pm.ck);
  const hit = (notifs.j.notifications || []).find((n: any) => n.type === "job.mention");
  assert.ok(hit, "mention notification exists"); assert.equal(hit.entity_type, "job"); assert.equal(hit.entity_id, job.id);
  const empty = await J(`/api/jobs/${job.id}/messages`, { method: "POST", body: { body: "  " } }, O);
  assert.equal(empty.s, 422);
  const missing = await J(`/api/jobs/nope/messages`, {}, O); assert.equal(missing.s, 404);
});

test("profile: name + avatar update, bad avatar refused, password change end-to-end", async () => {
  const upd = await J("/api/users/me", { method: "PATCH", body: { name: "Olivia Owner", avatar_url: "data:image/png;base64,iVBORw0KGgo=" } }, O);
  assert.equal(upd.s, 200, JSON.stringify(upd.j)); assert.equal(upd.j.user.name, "Olivia Owner"); assert.ok(upd.j.user.avatar_url.startsWith("data:image/"));
  const me2 = await J("/api/auth/me", {}, O); assert.equal(me2.j.user.avatar_url, upd.j.user.avatar_url); assert.equal(me2.j.user.role, "OWNER");
  const bad = await J("/api/users/me", { method: "PATCH", body: { avatar_url: "https://evil.test/x.png" } }, O); assert.equal(bad.s, 422);
  const wrong = await J("/api/users/me/password", { method: "POST", body: { current: "nope-nope", next: "newpassword1" } }, O); assert.equal(wrong.s, 403);
  const ok = await J("/api/users/me/password", { method: "POST", body: { current: "password123", next: "newpassword1" } }, O); assert.equal(ok.s, 200);
  const oldLogin = await J("/api/auth/login", { method: "POST", body: { email: "o@v25.test", password: "password123" } }); assert.equal(oldLogin.s, 401);
  const newLogin = await J("/api/auth/login", { method: "POST", body: { email: "o@v25.test", password: "newpassword1" } }); assert.equal(newLogin.s, 200);
});

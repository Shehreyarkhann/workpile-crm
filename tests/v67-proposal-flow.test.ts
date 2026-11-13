// v67: proposal pipeline discipline — proposal work tops the Work Queue
// (draft → submit → send), and the SENT stage is hard-gated: no proposal, or a
// proposal awaiting its required approval, cannot move to Sent. Approval
// decisions notify the submitter; sending flips the stage.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

let base = ""; let dbm: any;
function client() {
  let cookie = "";
  return {
    async call(method: string, p: string, body?: any) {
      const r = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
      const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* noop */ }
      return { status: r.status, body: j };
    },
  };
}
const owner = client(); const pm = client();
let wsId = ""; let pmId = "";

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-v67-"));
  process.env.LEADFLOW_DB = path.join(dir, "t.db"); process.chdir(dir);
  dbm = await import("../server/db.ts"); dbm.initSchema();
  const { default: srv } = await import("../server/index.ts"); srv.unref();
  const appMod = await import("../server/app.ts");
  await new Promise<void>((res) => { const s = appMod.app.listen(0, () => { base = `http://127.0.0.1:${(s.address() as any).port}`; s.unref(); res(); }); });
  const reg = await owner.call("POST", "/api/auth/register", { name: "Olive Owner", email: "owner67@demo.test", password: ["v67", "pw", "1101"].join("-"), business_name: "V67 Construction" });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  await owner.call("POST", "/api/auth/login", { email: "owner67@demo.test", password: ["v67", "pw", "1101"].join("-") });
  const me = await owner.call("GET", "/api/auth/me"); wsId = me.body.user.workspace_id;
  pmId = dbm.uid("usr");
  dbm.db.prepare("INSERT INTO users (id,workspace_id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(pmId, wsId, "Pete PM", "pm67@demo.test", dbm.hashPassword(["v67", "pw", "4415"].join("-")), "PROJECT_MANAGER", dbm.now());
  const li = await pm.call("POST", "/api/auth/login", { email: "pm67@demo.test", password: ["v67", "pw", "4415"].join("-") });
  assert.equal(li.status, 200, JSON.stringify(li.body));
});

async function pmLead(): Promise<string> {
  const r = await pm.call("POST", "/api/leads", { contact: { name: "Gated Gail", email: "gail@v67.test", phone: "5550199" + Math.floor(1000 + Math.random() * 9000) }, service_requested: "Roof Replacement", est_value: 9000 });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.lead.id;
  dbm.db.prepare("UPDATE leads SET owner_id=? WHERE id=?").run(pmId, id);
  return id;
}
const queueHas = async (c: any, type: string, leadId: string) => {
  const q = await c.call("GET", "/api/queue");
  return (q.body.items || []).some((i: any) => i.type === type && i.lead_id === leadId);
};

test("the full discipline: draft tops the queue, SENT is gated until approved, send flips the stage", async () => {
  const leadId = await pmLead();
  let r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  assert.equal(r.status, 200, JSON.stringify(r.body));

  // no proposal yet: draft work tops the queue, and SENT refuses
  assert.equal(await queueHas(pm, "proposal_draft", leadId), true);
  r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422); assert.equal(r.body.error.code, "proposal_required");

  // draft it in place
  r = await pm.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const propId = r.body.proposal.id;
  assert.equal(await queueHas(pm, "proposal_draft", leadId), false);
  assert.equal(await queueHas(pm, "proposal_review", leadId), true); // drafted, unsubmitted

  // drafted but unapproved: SENT still refuses
  r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422); assert.equal(r.body.error.code, "proposal_not_approved");

  // submit → approver notified; pending is still not approved
  r = await pm.call("POST", `/api/proposals/${propId}/submit`, {});
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.state, "pending");
  const on = await owner.call("GET", "/api/notifications");
  assert.ok((on.body.notifications || []).some((n: any) => n.kind === "approval.requested"), "approver notified");
  r = await pm.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(r.status, 422); assert.equal(r.body.error.code, "proposal_not_approved");

  // owner approves → submitter notified → send item tops the queue
  const pend = dbm.db.prepare("SELECT * FROM approvals WHERE proposal_id=? AND decision IS NULL").get(propId) as any;
  r = await owner.call("POST", `/api/approvals/${pend.id}/decide`, { decision: "approved" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const pn = await pm.call("GET", "/api/notifications");
  assert.ok((pn.body.notifications || []).some((n: any) => n.kind === "approval.decided"), "submitter notified of the decision");
  assert.equal(await queueHas(pm, "proposal_send", leadId), true);

  // send → stage flips to SENT, queue clears
  r = await pm.call("POST", `/api/proposals/${propId}/send`, { channel: "email" });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const l = await pm.call("GET", `/api/leads/${leadId}`);
  assert.equal(l.body.lead.state, "SENT");
  assert.equal(await queueHas(pm, "proposal_send", leadId), false);
});

test("the owner is their own approver: draft → send item → stage move passes", async () => {
  const r0 = await owner.call("POST", "/api/leads", { contact: { name: "Owner Otto", email: "otto@v67.test", phone: "55501998877" }, service_requested: "Deck Build", est_value: 4000 });
  assert.equal(r0.status, 201, JSON.stringify(r0.body));
  const leadId = r0.body.lead.id;
  await owner.call("POST", `/api/leads/${leadId}/stage`, { to: "PROPOSAL" });
  const dr = await owner.call("POST", `/api/leads/${leadId}/proposals/auto-draft`, {});
  assert.equal(dr.status, 201);
  assert.equal(await queueHas(owner, "proposal_send", leadId), true);
  const mv = await owner.call("POST", `/api/leads/${leadId}/stage`, { to: "SENT" });
  assert.equal(mv.status, 200, JSON.stringify(mv.body));
});

// V65 — Work Queue inbox handling: an ingested email surfaces in the queue
// as a Handle item carrying its inbox_id (the client opens the handling
// modal from it), and replying closes the item so it leaves the queue.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let base = "", server: any, cookie = "";
const H = () => ({ cookie, "content-type": "application/json" });
const J = async (r: Response) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-v65-"));
  process.env.LEADFLOW_DB = join(dir, "t.db"); process.chdir(dir);
  const dbm: any = await import("../server/db.ts"); dbm.initSchema();
  const appm: any = await import("../server/app.ts");
  server = appm.app.listen(0); server.unref();
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await fetch(base + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "V", email: "v65@test.dev", password: ["v65", "pw", "7712"].join("-"), business_name: "V65 Co" }) });
  cookie = (r.headers.get("set-cookie") || "").split(";")[0]; assert.equal(r.status, 201);
});
after(() => { try { server.close(); } catch { /* noop */ } });

test("ingested mail appears in the queue as a Handle item with inbox_id; replying removes it", async () => {
  const ing = await fetch(base + "/api/inbox/ingest", { method: "POST", headers: H(), body: JSON.stringify({ from_name: "Permit Office", from_email: "permits@town.gov", subject: "Permit question", body: "Which form do we file for a tank pull?" }) }).then(J);
  assert.equal(ing.ingested, 1);
  const q1 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  const item = (q1.items || []).find((i: any) => i.type === "inbox");
  assert.ok(item, "queue carries the inbox item");
  assert.ok(item.inbox_id, "item carries inbox_id for the handling modal");
  assert.equal(item.primary?.label, "Handle");
  const rep = await fetch(base + `/api/inbox/${item.inbox_id}/reply`, { method: "POST", headers: H(), body: JSON.stringify({ body: "Use form TP-2 — happy to walk you through it." }) }).then(J);
  assert.equal(rep.sent, true);
  const q2 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  assert.ok(!(q2.items || []).some((i: any) => i.type === "inbox" && i.inbox_id === item.inbox_id), "replied item leaves the queue");
});

test("marking done from the modal's PATCH also clears the queue item", async () => {
  const ing = await fetch(base + "/api/inbox/ingest", { method: "POST", headers: H(), body: JSON.stringify({ from_name: "New Person", from_email: "np@x.co", subject: "Insurance renewal", body: "Certificate renewal paperwork." }) }).then(J);
  assert.equal(ing.ingested, 1);
  const q1 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  const item = (q1.items || []).find((i: any) => i.type === "inbox");
  assert.ok(item?.inbox_id);
  const patched = await fetch(base + `/api/inbox/${item.inbox_id}`, { method: "PATCH", headers: H(), body: JSON.stringify({ status: "done" }) }).then(J);
  assert.equal(patched.status, "done");
  const q2 = await fetch(base + "/api/queue", { headers: H() }).then(J);
  assert.ok(!(q2.items || []).some((i: any) => i.type === "inbox"), "done item leaves the queue");
});
